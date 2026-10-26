import * as THREE from "three";
import WebGL from "three/addons/capabilities/WebGL.js";
import "./style.css";
import { AudioSystem } from "./audio";
import { Environment } from "./environment";
import { Player } from "./player";
import { UI } from "./ui";
import { WeatherSystem } from "./weather";
import { VoxelWorld } from "./world/world";
import { disposeThreeScene } from "./runtime/dispose-scene";
import type { Interactable, Quality, WeatherType } from "./world/types";

const SAVE_KEY = "voxel-home-v1";
const CURRENT_SAVE_KEY = "xia-home-save";
const EGG_TOTAL = 7;
const EGG_IDS = new Set([
  "arcade",
  "cinema",
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
    onClose2D: (requestLock) => close2D(requestLock),
    onWeather: () => cycleWeather(),
    onSetWeather: (type) => setWeather(type, true),
    onQuality: (next) => applyQuality(next),
    onSensitivity: (value) => {
      sensitivity = value;
      player.sensitivity = value;
      save();
    },
    onVolume: (value) => {
      volume = value;
      if (!muted) audio.setVolume(value);
      save();
    },
    onTimeScale: (value) => {
      timeScale = value;
      environment.timeScale = value;
      save();
    },
    onReset: () => {
      localStorage.removeItem(CURRENT_SAVE_KEY);
      localStorage.removeItem(SAVE_KEY);
      window.location.reload();
    },
    onSound: () => toggleSound(),
    onMusic: () => toggleMusic(),
    onArcade: () => openArcade(),
    onCinema: () => openCinema(),
    onResume: () => resumeGame(),
  });

  ui.setLoading(100);
  ui.setSensitivity(sensitivity);
  ui.setVolume(volume);
  ui.setQuality(quality);
  ui.setTimeScale(timeScale);
  ui.setEggs(eggs.size, EGG_TOTAL);
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

  function openPage(file: string, label: string, egg?: string) {
    if (!state.started) return;
    if (ui.isSettingsOpen) ui.closeSettings(false);
    const base = import.meta.env.BASE_URL || "./";
    ui.open2D(`${base}pages/${file}`, label);
    player.enabled = false;
    ui.hidePause();
    if (egg) collectEgg(egg);
  }

  function openArcade() {
    openPage("arcade.html", "ARCADE / XIA RUNNER", "arcade");
    audio.arcade();
  }

  function openCinema() {
    openPage("cinema.html", "CINEMA / SMALL WORLD", "cinema");
    audio.cinema();
  }

  function close2D(requestLock = true) {
    ui.close2D();
    resumeGame(requestLock);
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
    aimTelescope();
    ui.toast(
      "望远镜已对准信号星座。移动鼠标观察，瞄准星点按 E 读取；移动、WASD 或空处 E 退出。",
      7000,
    );
  }

  function exitTelescope(announce = false) {
    if (!telescopeActive) return;
    telescopeActive = false;
    if (world.isSignalConstellationOpen) world.toggleSignalConstellation();
    if (announce) ui.toast("已收起望远镜，视野恢复正常。", 2600);
  }

  function interact() {
    if (!state.started || ui.isBlocking) return;
    const target = currentTarget;
    if (!target) {
      if (telescopeActive) exitTelescope(true);
      return;
    }
    audio.click();
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
      case "arcade":
        openArcade();
        break;
      case "cinema":
        openCinema();
        break;
      case "duck":
        world.pokeDuck();
        audio.quack();
        collectEgg("duck");
        ui.toast("嘎。鸭子不太想理你，但它记得你来过。", 3600);
        break;
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
        ui.toast("7/7 · 你把这个家逛完了。下次见。", 5200);
      }, 3800);
    }
  }

  function save() {
    if (!state.started) return;
    const data: SaveData = {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      yaw: player.yaw,
      pitch: player.pitch,
      time: environment.time,
      weather: weather.type,
      quality: state.quality,
      sensitivity,
      volume,
      music: musicOn,
      timeScale,
      eggs: [...eggs],
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
    } else if (event.code === "KeyG") {
      event.preventDefault();
      if (!ui.isBlocking) openArcade();
    } else if (event.code === "KeyC") {
      event.preventDefault();
      if (!ui.isBlocking) openCinema();
    } else if (event.code === "Escape") {
      if (ui.is2DOpen) close2D();
      else if (ui.isSettingsOpen) ui.closeSettings();
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
    }

    if (!state.started) {
      const t = elapsed * 0.055;
      camera.fov = 56;
      camera.position.set(Math.sin(t) * 37, 18.5 + Math.sin(t * 0.7) * 3.2, Math.cos(t) * 37);
      camera.lookAt(0, 3.4, -2);
      camera.updateProjectionMatrix();
      environment.update(dt, camera.position);
      weather.update(dt, camera.position);
      world.update(dt, elapsed);
      world.setNight(environment.night);
      audio.setRain(rainLevel());
      renderer.render(scene, camera);
      return;
    }

    if (telescopeActive && (ui.isBlocking || !player.enabled)) exitTelescope(false);

    if (!ui.isBlocking) {
      player.update(dt);
      if (telescopeActive && player.hasMoveInput) exitTelescope(true);
      environment.update(dt, camera.position);
      weather.update(dt, camera.position);
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
      world.update(dt * 0.35, elapsed);
      world.setNight(environment.night);
      audio.setRain(rainLevel());
    }

    renderer.render(scene, camera);
  }

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

  // The world is assembled synchronously; this short progress pass gives the
  // browser a chance to paint the start screen before the first frame.
  let loadValue = 0;
  const loadTimer = window.setInterval(() => {
    loadValue += 7 + Math.random() * 9;
    if (loadValue >= 100) {
      loadValue = 100;
      window.clearInterval(loadTimer);
    }
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
