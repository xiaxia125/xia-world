import * as THREE from "three";
import WebGL from "three/addons/capabilities/WebGL.js";
import "./style.css";
import { AudioSystem } from "./audio";
import { Environment } from "./environment";
import { Player } from "./player";
import { getEmailAddress } from "./profile";
import { UI } from "./ui";
import { WeatherSystem } from "./weather";
import { VoxelWorld } from "./world/world";
import { ZONES, zoneAt } from "./world/zones";
import { disposeThreeScene } from "./runtime/dispose-scene";
import type { BimSceneHandle } from "./bim/bim-scene";
import { typeLabel as typeLabelOf, type BimElement } from "./bim/building";
import type { Interactable, Quality, WeatherType } from "./world/types";

const SAVE_KEY = "voxel-home-v1";
const CURRENT_SAVE_KEY = "xia-home-save";
/** 操作说明只在第一次进岛时自动弹一次；用户自己按 H 不算。 */
const HELP_SEEN_KEY = "xia-home-help-seen";
const EGG_TOTAL = 5;
const EGG_IDS = new Set([
  "court",
  "duck",
  "radio",
  "secret",
  "workstation",
]);

interface SaveData {
  x?: number;
  y?: number;
  z?: number;
  yaw?: number;
  pitch?: number;
  time?: number;
  weather?: WeatherType;
  quality?: Quality;
  sensitivity?: number;
  volume?: number;
  music?: boolean;
  timeScale?: number;
  eggs?: string[];
  stamps?: string[];
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(CURRENT_SAVE_KEY) ?? localStorage.getItem(SAVE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as SaveData;
    if (!data || typeof data !== "object") return {};
    return data;
  } catch {
    return {};
  }
}

export function boot(onWebGLUnavailable: () => void = () => {}): () => void {
  const canvas = document.getElementById("scene") as HTMLCanvasElement | null;
  if (!canvas) return () => {};

  const isTouch =
    window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const saved = loadSave();

  let renderer: THREE.WebGLRenderer;
  if (!WebGL.isWebGL2Available()) {
    onWebGLUnavailable();
    return () => {};
  }

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isTouch,
      powerPreference: "high-performance",
      alpha: false,
      logarithmicDepthBuffer: true,
    });
  } catch {
    onWebGLUnavailable();
    return () => {};
  }

  let disposed = false;
  let frameId = 0;
  const pendingTimeouts = new Set<number>();
  const events = new AbortController();
  const quality: Quality = saved.quality ?? (isTouch ? "low" : "high");
  let sensitivity = saved.sensitivity ?? 1;
  let volume = saved.volume ?? 0.55;
  let musicOn = saved.music ?? true;
  let timeScale = saved.timeScale ?? 1;
  let muted = false;

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, quality === "high" ? 2 : 1.35),
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = quality === "high" && !isTouch;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.12,
    620,
  );
  camera.rotation.order = "YXZ";

  const environment = new Environment(scene, renderer);
  const weather = new WeatherSystem(scene, quality);
  weather.setType(saved.weather ?? "clear");
  environment.setWeather(saved.weather ?? "clear");

  let ui: UI;
  let audio: AudioSystem;
  let player: Player;

  const savedEggs = Array.isArray(saved.eggs) ? saved.eggs : [];
  const eggs = new Set<string>(
    savedEggs
      .map((id) => (id === "legacy" ? "workstation" : id))
      .filter((id): id is string => typeof id === "string" && EGG_IDS.has(id)),
  );
  /** 访客印章：进过一个分区就记一个 id，地图面板和 HUD 都读它。 */
  const zoneIds = new Set(ZONES.map((zone) => zone.id));
  const stamps = new Set<string>(
    (Array.isArray(saved.stamps) ? saved.stamps : []).filter(
      (id): id is string => typeof id === "string" && zoneIds.has(id),
    ),
  );
  const state = {
    started: false,
    quality,
    savedPosition: {
      x: typeof saved.x === "number" ? saved.x : 0,
      y: typeof saved.y === "number" ? saved.y : 0.4,
      z: typeof saved.z === "number" ? saved.z : 30,
      yaw: typeof saved.yaw === "number" ? saved.yaw : 0,
      pitch: typeof saved.pitch === "number" ? saved.pitch : 0,
    },
    hasSavedPosition: typeof saved.x === "number" && typeof saved.z === "number",
  };

  const world = new VoxelWorld(scene, {
    quality,
    reducedMotion: motionPreference.matches,
    onScore: (score) => {
      audio?.score();
      if (score < 3) {
        ui?.toast(`命中！${score}/3 · 再进 ${3 - score} 球点亮球场`, 3200);
      }
    },
    onCourtLit: () => {
      collectEgg("court");
      audio?.chime();
      ui?.toast("三球命中。球场灯光全亮，彩带落下来了。", 5200);
    },
    onSecret: () => {
      collectEgg("secret");
      audio?.secret();
      ui?.toast("书架后面，居然还有一间房。", 4200);
    },
  });
  weather.setShelters(world.shelterZones);
  world.setWeather(weather.type);
  const rainLevel = () =>
    weather.rainAmount * (weather.isIndoors(camera.position) ? 0.34 : 1);
  motionPreference.addEventListener(
    "change",
    (event) => world.setReducedMotion(event.matches),
    { signal: events.signal },
  );

  player = new Player(camera, canvas, world.colliders);
  player.sensitivity = sensitivity;
  player.touchMode = isTouch;
  if (state.hasSavedPosition) {
    player.setPosition(
      state.savedPosition.x,
      Math.max(0.2, state.savedPosition.y),
      state.savedPosition.z,
      state.savedPosition.yaw,
      state.savedPosition.pitch,
    );
  }

  audio = new AudioSystem();

  ui = new UI({
    onEnter: () => enterWorld(),
    onWeather: () => cycleWeather(),
    onSetWeather: (type) => setWeather(type, true),
    onQuality: (next) => applyQuality(next),
    onSensitivity: (value) => {
      sensitivity = value;
      player.sensitivity = value;
      ui.setSensitivity(value);
      save();
    },
    onVolume: (value) => {
      volume = value;
      if (!muted) audio.setVolume(value);
      ui.setVolume(value);
      save();
    },
    onTimeScale: (value) => {
      timeScale = value;
      environment.timeScale = value;
      ui.setTimeScale(value);
      save();
    },
    onReset: () => {
      localStorage.removeItem(CURRENT_SAVE_KEY);
      localStorage.removeItem(SAVE_KEY);
      window.location.reload();
    },
    onSound: () => toggleSound(),
    onMusic: () => toggleMusic(),
    onCapturePhoto: () => capturePhoto(),
    onExitPhoto: () => exitPhoto(),
    onPianoKey: (index) => {
      if (!pianoActive) return;
      strikePiano(index);
    },
    onExitPiano: () => exitPiano(),
    onResume: () => resumeGame(),
  });

  ui.setSensitivity(sensitivity);
  ui.setVolume(volume);
  ui.setQuality(quality);
  ui.setTimeScale(timeScale);
  ui.setEggs(eggs.size, EGG_TOTAL);
  ui.setStamps([...stamps]);
  world.setEggCount(eggs.size);
  ui.setWeather(weather.label, weather.icon, weather.type);
  ui.setSound(true);
  ui.setMusic(musicOn);

  if (typeof saved.time === "number") environment.setTime(saved.time);
  environment.timeScale = timeScale;
  environment.setWeather(weather.type);

  applyQuality(quality, true);

  function defer(callback: () => void, delay: number) {
    if (disposed) return;
    const timeout = window.setTimeout(() => {
      pendingTimeouts.delete(timeout);
      if (!disposed) callback();
    }, delay);
    pendingTimeouts.add(timeout);
  }

  function applyQuality(next: Quality, initial = false) {
    state.quality = next;
    ui.setQuality(next);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, next === "high" ? 2 : 1.35));
    renderer.shadowMap.enabled = next === "high" && !isTouch;
    renderer.shadowMap.needsUpdate = true;
    environment.setShadowQuality(next);
    world.setShadows(next === "high" && !isTouch);
    world.setQuality(next);
    save();
    if (!initial) ui.toast(next === "high" ? "画质：高 · 阴影已开启" : "画质：低 · 优先流畅", 2200);
  }

  function setWeather(type: WeatherType, announce: boolean) {
    weather.setType(type);
    environment.setWeather(type);
    world.setWeather(type);
    ui.setWeather(weather.label, weather.icon, type);
    if (announce) ui.toast(`天气：${weather.label}${type === "rain" ? " · 去屋顶听听电台？" : ""}`, 2800);
    audio?.click();
    save();
  }

  function cycleWeather() {
    const next = weather.cycle();
    setWeather(next, true);
  }

  function enterWorld() {
    if (state.started) return;
    state.started = true;
    if (!isTouch) player.requestLock();
    void audio.start().then(() => {
      audio.setVolume(muted ? 0 : volume);
      audio.setMusic(musicOn);
      audio.setRain(rainLevel());
    });
    player.enabled = true;
    if (state.hasSavedPosition) {
      player.setPosition(
        state.savedPosition.x,
        Math.max(0.2, state.savedPosition.y),
        state.savedPosition.z,
        state.savedPosition.yaw,
        state.savedPosition.pitch,
      );
    } else {
      player.respawn(world.spawn.x, world.spawn.y, world.spawn.z);
      player.yaw = world.spawnYaw;
    }
    ui.enter();
    ui.setHudVisible(true);
    defer(() => {
      ui.toast("欢迎来到 Xia。按 P 打开职业档案，或走近出生点右侧的档案屏。", 4600);
    }, 900);
    // 新访客不知道岛上能做什么，进岛后给一次操作说明；看过一次就不再打扰。
    defer(() => {
      if (ui.isBlocking || telescopeActive) return;
      let seen = false;
      try {
        seen = localStorage.getItem(HELP_SEEN_KEY) === "1";
      } catch {
        // 隐私模式下读不到就当作没看过，弹一次不影响使用。
      }
      if (seen) return;
      try {
        localStorage.setItem(HELP_SEEN_KEY, "1");
      } catch {
        // 写不进去也无妨，最多下次再弹一次。
      }
      ui.openHelp();
    }, 8000);
    save();
  }

  function toggleSound() {
    muted = !muted;
    audio.setVolume(muted ? 0 : volume);
    ui.setSound(!muted);
    save();
  }

  function toggleMusic() {
    musicOn = !musicOn;
    audio.setMusic(musicOn);
    ui.setMusic(musicOn);
    ui.toast(musicOn ? "背景音乐已打开 · XIA RADIO" : "背景音乐已关闭", 2400);
    save();
  }

  // ------------------------------------------------------------ 拍照 / 钢琴

  function enterPhoto() {
    if (ui.isBlocking) return;
    exitTelescope(false);
    if (player.seated) standUpFromSeat(false);
    player.enabled = true;
    // 先立起面板状态再释放鼠标：pointerlockchange 是异步的，但顺序稳一点。
    ui.setPhotoOpen(true);
    if (document.pointerLockElement) document.exitPointerLock();
    ui.setPrompt(null);
    ui.toast("拍照模式：点画面恢复视角，F 拍照，ESC 退出。", 3600);
  }

  function exitPhoto() {
    if (!ui.isPhotoOpen) return;
    ui.setPhotoOpen(false);
    resumeGame();
  }

  /** 把当前帧画到一张离屏 canvas 上，右下角压一枚水印，再下载成 PNG。 */
  function capturePhoto() {
    if (!ui.isPhotoOpen) return;
    renderer.render(scene, camera);
    const source = renderer.domElement;
    const out = document.createElement("canvas");
    out.width = source.width;
    out.height = source.height;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(source, 0, 0);

    const pad = Math.max(28, Math.round(out.width * 0.03));
    const big = Math.max(20, Math.round(out.width * 0.022));
    const small = Math.max(13, Math.round(out.width * 0.012));
    ctx.fillStyle = "rgba(7,16,12,0.55)";
    ctx.fillRect(pad * 0.5, out.height - pad * 2.4, pad * 9.6, pad * 1.9);

    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f1ecdf";
    ctx.font = `800 ${big}px 'Arial Black', 'PingFang SC', 'Microsoft YaHei', sans-serif`;
    ctx.fillText("XIA HOME", pad, out.height - pad * 1.35);
    ctx.fillStyle = "rgba(241,236,223,0.7)";
    ctx.font = `500 ${small}px 'Cascadia Code', Consolas, monospace`;
    const zone = zoneAt(player.position.x, player.position.y + 0.6, player.position.z);
    ctx.fillText(
      `${zone?.name ?? "岛上"} · ${environment.getTimeLabel()} · ${weather.label} · 2026`,
      pad,
      out.height - pad * 0.8,
    );

    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `xia-home-${Date.now()}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, "image/png");
    audio.click();
    ui.toast("照片已保存到下载目录。", 2600);
  }

  let pianoActive = false;

  function strikePiano(index: number) {
    audio.pianoNote(index);
    world.pressPianoKey(index);
    ui.strikePianoNote(index);
  }

  function enterPiano() {
    if (pianoActive) return;
    pianoActive = true;
    ui.setPrompt(null);
    // 坐在琴凳上弹：以前只弹出一个 toast，画面和人都没有反应。
    sitDown(world.pianoSeat, false);
    player.pitch = -0.24;
    ui.setPianoOpen(true);
    audio.click();
    ui.toast("按 1—8 弹音，也可以点屏幕上的琴键；E 或 ESC 收起。", 4600);
  }

  function exitPiano() {
    if (!pianoActive) return;
    pianoActive = false;
    ui.setPianoOpen(false);
    standUpFromSeat(false);
    ui.toast("钢琴合上了。", 1800);
  }

  async function copyEmail() {
    const address = getEmailAddress();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(address);
        ui.toast(`已复制公开邮箱：${address}`, 4200);
        return;
      }
    } catch {
      // 剪贴板被拒绝时继续走下面的兜底
    }
    const textarea = document.createElement("textarea");
    textarea.value = address;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    ui.toast(ok ? `已复制公开邮箱：${address}` : `公开邮箱：${address}`, 4600);
  }

  function resumeGame(requestLock = true) {
    if (!state.started || ui.isBlocking) return;
    if (isTouch) {
      player.enabled = true;
      ui.hidePause();
      ui.setTouchActive(true);
      return;
    }
    if (!requestLock) {
      player.enabled = true;
      ui.hidePause();
      document.getElementById("scene")?.focus({ preventScroll: true });
      ui.toast("已返回世界。点击画面可恢复鼠标视角。", 3200);
      return;
    }
    player.enabled = false;
    ui.showPause(true);
    document.getElementById("pause")?.focus({ preventScroll: true });
    player.requestLock();
  }

  let telescopeActive = false;

  // ------------------------------------------------------------------ BIM

  /** 打开中的 BIM 场景句柄；null 表示不在查看器里。 */
  let bimHandle: BimSceneHandle | null = null;
  /** 当前数据源的构件索引，id → 构件，选中时查属性用。 */
  let bimElementIndex = new Map<string, BimElement>();
  /** 进 BIM 前的站位，退出时原样还原。 */
  let bimReturn: { x: number; y: number; z: number; yaw: number; pitch: number } | null = null;
  /** 打开过程中被取消（连按 E 或立刻退出）时用它丢弃晚到的加载结果。 */
  let bimToken = 0;

  /**
   * 进入 BIM 查看器。
   *
   * 世界不销毁，只是停止渲染、停止推进——退出时世界还在原处，省掉重建成本，
   * 也不会因为反复进出把显存撑大。BIM 那套 scene 是独立建的，退出时必须 dispose。
   */
  async function enterBim() {
    if (bimHandle || ui.isBlocking) return;
    const token = ++bimToken;

    bimReturn = {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      yaw: player.yaw,
      pitch: player.pitch,
    };
    player.enabled = false;
    exitTelescope(false);
    if (document.pointerLockElement) document.exitPointerLock();
    ui.openBim();
    audio.setWorldPaused(true);

    try {
      // 按需加载：不进 BIM 就不会下载这套代码
      const [{ loadBimSource }, { createBimScene }] = await Promise.all([
        import("./bim/loader"),
        import("./bim/bim-scene"),
      ]);
      const source = await loadBimSource((v) => {
        if (token === bimToken) ui.setBimProgress(v);
      });
      if (token !== bimToken) return;

      // canvas 在 boot 开头已经检查过非空，这里再收窄一次类型给 TS 看
      const sceneCanvas = canvas;
      if (!sceneCanvas) return;
      const handle = createBimScene(source.building, sceneCanvas);
      if (source.model) {
        // glb 模式：用模型自带的网格替换掉按构件重建的那一套，
        // 保留包围盒与构件清单（从模型里读出来的）。
        handle.root.add(source.model);
      }
      bimHandle = handle;
      handle.attach(sceneCanvas);
      handle.resize(window.innerWidth, window.innerHeight);
      bimElementIndex = new Map(source.building.elements.map((el) => [el.id, el]));

      const { setBimPanelData, setBimPanelHandlers } = await import(
        "./react/components/BimView"
      );
      setBimPanelData({ elements: source.building.elements });
      setBimPanelHandlers({
        onShowFloor: (floor) => {
          if (!bimHandle) return;
          bimHandle.showFloor(floor);
          ui.setBimFloor(floor);
        },
        onSelect: (id) => selectBimElement(id),
        onExit: () => exitBim(),
        onRetry: () => {
          exitBim(false);
          void enterBim();
        },
      });

      if (token !== bimToken) return;
      ui.setBimReady(source.origin);
      if (source.note) {
        ui.toast(`模型读取失败，已回退到程序化建筑：${source.note}`, 5200);
      }
    } catch (err) {
      if (token !== bimToken) return;
      // 失败也要把世界放回来，否则玩家卡在空画面里
      ui.setBimError(
        `BIM 场景没能装起来：${err instanceof Error ? err.message : String(err)}`,
      );
      audio.setWorldPaused(false);
    }
  }

  /** 退出：还原站位与朝向，释放 BIM 那套资源。 */
  function exitBim(resume = true) {
    bimToken += 1;
    if (bimHandle) {
      bimHandle.dispose();
      bimHandle = null;
    }
    void import("./react/components/BimView").then(({ setBimPanelHandlers }) => {
      setBimPanelHandlers(null);
    });
    ui.closeBim(false);
    audio.setWorldPaused(false);

    if (bimReturn) {
      player.setPosition(bimReturn.x, bimReturn.y, bimReturn.z, bimReturn.yaw, bimReturn.pitch);
      bimReturn = null;
    }
    player.enabled = true;
    if (resume) resumeGame();
  }

  /** 选中一个构件：高亮 + 属性卡。 */
  function selectBimElement(id: string | null) {
    if (!bimHandle) return;
    bimHandle.highlight(id);
    if (!id) {
      ui.selectBimElement(null);
      return;
    }
    const found = bimElementIndex.get(id);
    if (!found) return;
    ui.selectBimElement({
      id: found.id,
      name: found.name,
      type: typeLabelOf(found.type),
      floor: found.floor,
      volume: found.volume,
      elevation: found.elevation,
      material: found.material,
    });
  }

  /** 坐下：位置与朝向来自座椅代理上的 userData，起身时由 Player 自己还原。 */
  function sitDown(anchor: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    eyeOffset: number;
    lookUp?: boolean;
  }, announce = true) {
    player.sitAt(anchor.x, anchor.y, anchor.z, anchor.yaw, anchor.eyeOffset);
    // 天台躺椅坐下后默认抬头看星星；Player 下一帧会把 pitch 同步到相机。
    if (anchor.lookUp) player.pitch = 1.02;
    ui.setSeated(true);
    ui.setPrompt(null);
    if (!announce) return;
    audio.click();
    ui.toast(anchor.lookUp ? "躺下了。抬头就是星空，按 E 或 W 起身。" : "坐下了。按 E 或 W 起身。", 2800);
  }

  function standUpFromSeat(announce = true) {
    if (!player.seated) return;
    player.standUp();
    ui.setSeated(false);
    if (announce) ui.toast("已起身。", 1800);
  }

  function aimTelescope() {
    const target = world.signalLookAt;
    const dx = target.x - camera.position.x;
    const dz = target.z - camera.position.z;
    const dy = target.y - camera.position.y;
    player.yaw = Math.atan2(-dx, -dz);
    player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }

  function enterTelescope() {
    if (!world.isSignalConstellationOpen && !world.toggleSignalConstellation()) return;
    telescopeActive = true;
    // 相机贴近镜筒时模型会挡住整个窄视野，取景期间把它藏起来，退出再放回。
    world.setTelescopeModelVisible(false);
    ui.setScopeEntries(world.signalEntries);
    ui.setScopeOpen(true);
    aimTelescope();
    ui.toast(
      "望远镜已对准信号星座。移动鼠标观察，瞄准星点按 E 读取；移动、WASD 或空处 E 退出。",
      7000,
    );
  }

  function exitTelescope(announce = false) {
    if (!telescopeActive) return;
    telescopeActive = false;
    world.setTelescopeModelVisible(true);
    ui.setScopeOpen(false);
    if (world.isSignalConstellationOpen) world.toggleSignalConstellation();
    if (announce) ui.toast("已收起望远镜，视野恢复正常。", 2600);
  }

  function interact() {
    if (!state.started || ui.isBlocking) return;
    // 钢琴模式里 E 就是「合上琴盖」。
    if (pianoActive) {
      exitPiano();
      return;
    }
    // 坐着时任何 E 都当起身，不看准星对准了什么——否则对着空处按 E 会没反应。
    if (player.seated) {
      standUpFromSeat();
      return;
    }
    const target = currentTarget;
    if (!target) {
      if (telescopeActive) exitTelescope(true);
      return;
    }
    audio.click();
    // 星点内容走 DOM 目镜面板：3D 贴图在 24° 视野里发糊，文字交给 DOM 渲染才清楚。
    const reading = world.signalReadings.get(target.id);
    if (reading) {
      ui.setScopeReading({ ...reading, id: target.id });
      currentTarget = null;
      checkTimer = 0;
      save();
      return;
    }
    // 小径石碑和风车：贴图上只留年份，正文用阅读面板展开。
    const plaque = world.plaqueReadings.get(target.id);
    if (plaque) {
      ui.openReading({ ...plaque, id: target.id });
      currentTarget = null;
      checkTimer = 0;
      save();
      return;
    }
    if (world.readSignal(target.id)) {
      if (target.id === "monitor") collectEgg("workstation");
      currentTarget = null;
      checkTimer = 0;
      save();
      return;
    }
    if (target.id.startsWith("project-")) {
      exitTelescope(false);
      ui.openProfile("projects");
      currentTarget = null;
      checkTimer = 0;
      save();
      return;
    }
    switch (target.id) {
      case "profile":
        exitTelescope(false);
        ui.openProfile("overview");
        break;
      case "bookshelf": {
        const result = world.toggleBookshelf(player.position);
        if (result === "closed") {
          ui.toast("书架合上了。", 2200);
        } else if (result === "blocked") {
          ui.toast("先离开书架门口，再把它合上。", 3200);
        }
        break;
      }
      case "bim":
        void enterBim();
        break;
      case "map":
        ui.openMap();
        break;
      case "photo":
        enterPhoto();
        break;
      case "piano":
        enterPiano();
        break;
      case "campfire": {
        const on = world.toggleCampfire();
        ui.toast(on ? "篝火点起来了。火星正往上飘。" : "篝火熄了，只剩一点余温。", 2800);
        break;
      }
      case "camp-seat":
      case "boat":
      case "sky-lounger": {
        const seat = target.object.userData.seat as
          | { x: number; y: number; z: number; yaw: number; eyeOffset: number; lookUp?: boolean }
          | undefined;
        if (seat) sitDown(seat);
        break;
      }
      case "cat": {
        world.petCat();
        audio.purr();
        ui.toast("猫蹭了蹭你的手，尾巴慢慢摆着。", 3000);
        break;
      }
      case "mailbox":
        void copyEmail();
        break;
      case "duck": {
        const third = world.feedDuck(camera.position);
        audio.quack();
        if (third) {
          collectEgg("duck");
          ui.toast("面包屑一撒，鸭子带着一群鱼游过来了。它记住你了。", 4200);
        } else {
          ui.toast("面包屑撒下去了，鸭子和鱼都往这边游。", 2800);
        }
        break;
      }
      case "ball":
        world.shootBall();
        audio.shoot();
        break;
      case "radio": {
        const on = audio.toggleRadio();
        world.setRadioOn(on);
        if (weather.type === "rain") {
          collectEgg("radio");
          ui.toast(
            on
              ? "雨声电台已打开。频率 88.7 收到了藏在雨里的信号。"
              : "电台关了。雨还在下。",
            4200,
          );
        } else {
          ui.toast(
            on
              ? "FM 88.7 · 夜间电台已打开。切到雨天，会收到另一段信号。"
              : "电台关了。",
            3000,
          );
        }
        break;
      }
      case "telescope": {
        if (telescopeActive) {
          exitTelescope(true);
        } else {
          enterTelescope();
        }
        break;
      }
      default:
        break;
    }
    currentTarget = null;
    checkTimer = 0;
    save();
  }

  function collectEgg(id: string) {
    if (eggs.has(id)) return;
    eggs.add(id);
    ui.setEggs(eggs.size, EGG_TOTAL);
    world.setEggCount(eggs.size);
    save();
    if (eggs.size === EGG_TOTAL) {
      defer(() => {
        ui.toast(`${EGG_TOTAL}/${EGG_TOTAL} · 你把这个家逛完了。下次见。`, 5200);
      }, 3800);
    }
  }

  function save() {
    if (!state.started) return;
    const pose = player.savedPosition;
    const data: SaveData = {
      x: pose.x,
      y: pose.y,
      z: pose.z,
      yaw: pose.yaw,
      pitch: pose.pitch,
      time: environment.time,
      weather: weather.type,
      quality: state.quality,
      sensitivity,
      volume,
      music: musicOn,
      timeScale,
      eggs: [...eggs],
      stamps: [...stamps],
    };
    try {
      localStorage.setItem(CURRENT_SAVE_KEY, JSON.stringify(data));
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }

  // ------------------------------------------------------------ interaction

  const raycaster = new THREE.Raycaster();
  raycaster.far = 45;
  const screenCenter = new THREE.Vector2(0, 0);
  let currentTarget: Interactable | null = null;
  let checkTimer = 0;

  function contains(root: THREE.Object3D, child: THREE.Object3D) {
    let node: THREE.Object3D | null = child;
    while (node) {
      if (node === root) return true;
      node = node.parent;
    }
    return false;
  }

  function updateInteraction(dt: number) {
    checkTimer -= dt;
    if (checkTimer > 0) return;
    checkTimer = 0.12;
    currentTarget = null;
    if (!state.started || ui.isBlocking || !player.enabled) {
      ui.setPrompt(null);
      return;
    }
    // 钢琴模式由琴键条接管，准星不再抢提示；坐下状态留给 exitPiano 自己处理。
    if (pianoActive) {
      ui.setPrompt(null);
      return;
    }
    // 坐着时准星不再找东西，提示固定成「起身」——否则会一直显示「坐下看电影」。
    if (player.seated) {
      ui.setPrompt("起身");
      return;
    }
    raycaster.setFromCamera(screenCenter, camera);
    const roots = world.interactables.map((item) => item.object);
    const hits = raycaster.intersectObjects(roots, true);
    for (const hit of hits) {
      const item = world.interactables.find((entry) => contains(entry.object, hit.object));
      if (!item) continue;
      if (hit.distance > (item.maxDistance ?? 4)) continue;
      currentTarget = item;
      ui.setPrompt(item.label);
      return;
    }
    ui.setPrompt(null);
  }

  // ----------------------------------------------------------------- input

  window.addEventListener("keydown", (event) => {
    if (!state.started) return;
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;

    if (telescopeActive) {
      if (
        event.code === "Escape" ||
        event.code === "KeyW" ||
        event.code === "KeyA" ||
        event.code === "KeyS" ||
        event.code === "KeyD" ||
        event.code === "ArrowUp" ||
        event.code === "ArrowDown" ||
        event.code === "ArrowLeft" ||
        event.code === "ArrowRight" ||
        event.code === "Space"
      ) {
        exitTelescope(true);
      }
    }

    if (ui.isProfileOpen) {
      if (event.code === "KeyP") {
        event.preventDefault();
        ui.closeProfile();
      }
      return;
    }

    // BIM 查看器打开时，整个键盘交给它：Esc 退出，其余按键都不该漏到世界那边。
    if (ui.isBimOpen) {
      if (event.code === "Escape") {
        event.preventDefault();
        exitBim();
      }
      return;
    }

    // 钢琴模式：1—8 弹音，E / Esc 合上；一走动就自动收起，不把人锁在琴前。
    if (pianoActive) {
      if (event.code === "Escape" || event.code === "KeyE") {
        event.preventDefault();
        exitPiano();
        return;
      }
      const digit = /^(?:Digit|Numpad)([1-8])$/.exec(event.code);
      if (digit) {
        event.preventDefault();
        strikePiano(Number(digit[1]) - 1);
        return;
      }
      if (
        event.code === "KeyW" ||
        event.code === "KeyA" ||
        event.code === "KeyS" ||
        event.code === "KeyD" ||
        event.code === "Space" ||
        event.code.startsWith("Arrow")
      ) {
        exitPiano();
      }
    }

    if (event.code === "KeyH") {
      event.preventDefault();
      if (ui.isHelpOpen) ui.closeHelp();
      else if (!ui.isBlocking) ui.openHelp();
      return;
    }

    // 坐着时按 W（或 ↑）起身。只用前进键：A/S/D 坐着时什么也不做，
    // 这样「坐着不会移动」和「按 W 起身」两条不会打架。
    if (player.seated && !ui.isBlocking && (event.code === "KeyW" || event.code === "ArrowUp")) {
      standUpFromSeat();
      return;
    }

    if (event.code === "KeyP") {
      event.preventDefault();
      if (!ui.isBlocking) ui.openProfile("overview");
    } else if (event.code === "KeyE") {
      event.preventDefault();
      interact();
    } else if (event.code === "KeyR") {
      event.preventDefault();
      if (!ui.isBlocking) cycleWeather();
    } else if (event.code === "KeyM") {
      event.preventDefault();
      toggleMusic();
    } else if (event.code === "KeyN") {
      event.preventDefault();
      if (ui.isMapOpen) ui.closeMap();
      else if (!ui.isBlocking) ui.openMap();
    } else if (event.code === "KeyF") {
      if (ui.isPhotoOpen) {
        event.preventDefault();
        capturePhoto();
      }
    } else if (event.code === "Escape") {
      if (ui.isPhotoOpen) exitPhoto();
      else if (ui.isMapOpen) ui.closeMap();
      else if (ui.isReadingOpen) ui.closeReading();
      else if (ui.isSettingsOpen) ui.closeSettings();
      else if (ui.isHelpOpen) ui.closeHelp();
    }
  }, { signal: events.signal });

  player.onStep = () => audio.footstep();

  player.onLockChange = (locked) => {
    if (isTouch) return;
    if (!locked && state.started && !ui.isBlocking) {
      player.enabled = false;
      ui.showPause(true);
      document.getElementById("pause")?.focus({ preventScroll: true });
    } else if (locked) {
      player.enabled = true;
      ui.showPause(false);
      document.getElementById("scene")?.focus({ preventScroll: true });
    }
  };

  // ------------------------------------------------------------ touch input

  let releaseTouchInput: (() => void) | undefined;
  if (isTouch) {
    const stick = ui.stick;
    const knob = ui.stickKnob;
    let stickPointer = -1;
    let lookPointer = -1;
    let lookX = 0;
    let lookY = 0;

    const setStick = (event: PointerEvent) => {
      const rect = stick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const radius = rect.width * 0.38;
      const length = Math.hypot(dx, dy);
      const scale = length > radius ? radius / length : 1;
      const nx = (dx * scale) / radius;
      const ny = (dy * scale) / radius;
      knob.style.transform = `translate(calc(-50% + ${nx * radius}px), calc(-50% + ${ny * radius}px))`;
      player.setJoystick(nx, ny);
    };

    stick.addEventListener("pointerdown", (event) => {
      if (!state.started || ui.isBlocking) return;
      stickPointer = event.pointerId;
      stick.setPointerCapture(event.pointerId);
      setStick(event);
    }, { signal: events.signal });
    stick.addEventListener("pointermove", (event) => {
      if (event.pointerId !== stickPointer) return;
      setStick(event);
    }, { signal: events.signal });
    const releaseStick = (event: PointerEvent) => {
      if (event.pointerId !== stickPointer) return;
      stickPointer = -1;
      knob.style.transform = "translate(-50%, -50%)";
      player.setJoystick(0, 0);
    };
    stick.addEventListener("pointerup", releaseStick, { signal: events.signal });
    stick.addEventListener("pointercancel", releaseStick, { signal: events.signal });

    canvas.addEventListener("pointerdown", (event) => {
      if (!state.started || ui.isBlocking) return;
      if (event.clientX < window.innerWidth * 0.38) return;
      lookPointer = event.pointerId;
      lookX = event.clientX;
      lookY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    }, { signal: events.signal });
    canvas.addEventListener("pointermove", (event) => {
      if (event.pointerId !== lookPointer) return;
      const dx = event.clientX - lookX;
      const dy = event.clientY - lookY;
      lookX = event.clientX;
      lookY = event.clientY;
      player.addLook(dx * 1.25, dy * 1.25);
    }, { signal: events.signal });
    const releaseLook = (event: PointerEvent) => {
      if (event.pointerId === lookPointer) lookPointer = -1;
    };
    canvas.addEventListener("pointerup", releaseLook, { signal: events.signal });
    canvas.addEventListener("pointercancel", releaseLook, { signal: events.signal });

    document.getElementById("touch-jump")?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      player.queueJump();
    }, { signal: events.signal });
    document.getElementById("touch-interact")?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      interact();
    }, { signal: events.signal });
  }

  // ------------------------------------------------------------------ loop

  let lastFrame = performance.now();
  let elapsed = 0;
  let uiClock = 0;
  let autoSave = 0;

  function animate() {
    if (disposed) return;
    frameId = requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    elapsed += dt;

    uiClock -= dt;
    if (uiClock <= 0) {
      uiClock = 0.25;
      ui.setClock(environment.getTimeLabel(), environment.getPhaseLabel());
      if (state.started) {
        // yaw = 0 朝 -z（北）；罗盘顺时针，0° 指北。
        const heading = (((-player.yaw * 180) / Math.PI) % 360 + 360) % 360;
        const zone = zoneAt(player.position.x, player.position.y + 0.6, player.position.z);
        ui.setCompass(heading, zone?.name ?? "岛上");
        ui.setPosition(player.position.x, player.position.z);
        // 第一次走进一个分区就盖一枚访客印章，地图和 HUD 立刻能看到。
        if (zone && !stamps.has(zone.id)) {
          stamps.add(zone.id);
          ui.setStamps([...stamps]);
          audio.click();
          ui.toast(`访客印章 +1 · ${zone.name}`, 2400);
          save();
        }
      }
    }

    if (!state.started) {
      const t = elapsed * 0.055;
      camera.fov = 56;
      camera.position.set(Math.sin(t) * 37, 18.5 + Math.sin(t * 0.7) * 3.2, Math.cos(t) * 37);
      camera.lookAt(0, 3.4, -2);
      camera.updateProjectionMatrix();
      environment.update(dt, camera.position);
      weather.update(dt, camera.position);
      world.setRainAmount(weather.rainAmount);
      world.update(dt, elapsed);
      world.setNight(environment.night);
      audio.setRain(rainLevel());
      renderer.render(scene, camera);
      if (!firstFrameRendered) {
        firstFrameRendered = true;
        window.clearInterval(loadTimer);
        ui.setLoading(100);
      }
      return;
    }

    if (telescopeActive && (ui.isBlocking || !player.enabled)) exitTelescope(false);

    // BIM 查看器占着整个画面：世界这一帧不推进也不渲染，只把 BIM 场景画出来。
    if (bimHandle && ui.isBimOpen) {
      bimHandle.resize(window.innerWidth, window.innerHeight);
      bimHandle.controls.update();
      renderer.render(bimHandle.scene, bimHandle.camera);
      return;
    }

    if (!ui.isBlocking) {
      player.update(dt);
      if (telescopeActive && player.hasMoveInput) exitTelescope(true);
      environment.update(dt, camera.position);
      weather.update(dt, camera.position);
      world.setRainAmount(weather.rainAmount);
      world.setPlayerPosition(player.position.x, player.position.z);
      world.update(dt, elapsed);
      world.setNight(environment.night);
      audio.setRain(rainLevel());

      updateInteraction(dt);

      const targetFov = telescopeActive ? 24 : player.isSprinting ? 79 : 72;
      const nextFov = THREE.MathUtils.damp(camera.fov, targetFov, 7, dt);
      if (Math.abs(nextFov - camera.fov) > 0.001) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }

      autoSave += dt;
      if (autoSave > 2.5) {
        autoSave = 0;
        save();
      }
    } else {
      // The world keeps breathing behind the settings panel; time itself pauses.
      weather.update(dt * 0.35, camera.position);
      world.setRainAmount(weather.rainAmount);
      world.update(dt * 0.35, elapsed);
      world.setNight(environment.night);
      audio.setRain(rainLevel());
    }

    renderer.render(scene, camera);
  }

  // BIM 查看器里的点选：用 click 而不是 pointerdown，这样拖动旋转结束时不会误选。
  // 只有几乎没移动的点击才算「点了一下」。
  let bimDown: { x: number; y: number } | null = null;
  canvas.addEventListener("pointerdown", (event) => {
    if (!ui.isBimOpen || !bimHandle) return;
    bimDown = { x: event.clientX, y: event.clientY };
  }, { signal: events.signal });
  canvas.addEventListener("pointerup", (event) => {
    if (!ui.isBimOpen || !bimHandle || !bimDown) return;
    const moved = Math.hypot(event.clientX - bimDown.x, event.clientY - bimDown.y);
    bimDown = null;
    if (moved > 4) return; // 拖动过，是在转模型，不是点构件
    const hit = bimHandle.pick(event.clientX, event.clientY);
    selectBimElement(hit ? hit.id : null);
  }, { signal: events.signal });

  window.addEventListener("resize", () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, state.quality === "high" ? 2 : 1.35),
    );
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }, { signal: events.signal });

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  }, { signal: events.signal });
  window.addEventListener("beforeunload", () => save(), { signal: events.signal });

  // The world is assembled synchronously, so this progress pass exists only to
  // give the start screen something readable to show. It stops at 90% and the
  // first rendered frame below is what actually completes it — otherwise the
  // bar would claim "ready" while nothing had been drawn yet.
  let loadValue = 0;
  let firstFrameRendered = false;
  const loadTimer = window.setInterval(() => {
    loadValue = Math.min(90, loadValue + 7 + Math.random() * 9);
    ui.setLoading(loadValue);
  }, 55);
  animate();

  const debugHandle = {
    world,
    environment,
    weather,
    player,
    state,
    renderer,
    camera,
    scene,
    audio,
    /** UI 快照桥：验收时用来直接打开钢琴条 / 拍照层等 DOM 面板。 */
    ui,
    /** 验收用：无 rAF 的自动化窗口里没法靠准星按 E，直接进出钢琴模式。 */
    enterPiano,
    exitPiano,
    /** 验收用：读钢琴模式开关。 */
    get pianoActive() {
      return pianoActive;
    },
    /** BIM 查看器的句柄；不在查看器里时为 null。验收要读它自己的相机与统计。 */
    get bim() {
      return bimHandle;
    },
  };
  if (import.meta.env.DEV) {
    (window as unknown as { __xia?: unknown }).__xia = debugHandle;
  }

  return () => {
    if (disposed) return;
    disposed = true;
    window.clearInterval(loadTimer);
    window.cancelAnimationFrame(frameId);
    frameId = 0;
    pendingTimeouts.forEach((timeout) => window.clearTimeout(timeout));
    pendingTimeouts.clear();
    events.abort();
    save();
    player.dispose();
    audio.dispose();
    world.disposeSignals();
    ui.dispose();
    disposeThreeScene(scene);
    renderer.dispose();
    if (import.meta.env.DEV) {
      const debugWindow = window as unknown as { __xia?: unknown };
      if (debugWindow.__xia === debugHandle) delete debugWindow.__xia;
    }
  };
}
