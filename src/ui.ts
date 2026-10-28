import type { ProfileTab } from "./profile";
import type { SignalCopy } from "./signals";
import type { Quality, WeatherType } from "./world/types";

/** 目镜面板里展示的一条信号：星点 id + 已整理好的文案。 */
export interface SignalReading extends SignalCopy {
  id: string;
}

/** 目镜目录里的一行：只有编号和标签，点开后才是正文。 */
export interface SignalEntry extends Pick<SignalCopy, "index" | "label"> {
  id: string;
}

export interface UIHandlers {
  onEnter: () => void;
  onWeather: () => void;
  onSetWeather: (weather: WeatherType) => void;
  onQuality: (quality: Quality) => void;
  onSensitivity: (value: number) => void;
  onVolume: (value: number) => void;
  onTimeScale: (value: number) => void;
  onReset: () => void;
  onSound: () => void;
  onMusic: () => void;
  onCapturePhoto: () => void;
  onExitPhoto: () => void;
  onPianoKey: (index: number) => void;
  onExitPiano: () => void;
  onResume: () => void;
}

export interface UISnapshot {
  loading: number;
  started: boolean;
  startLeaving: boolean;
  hudVisible: boolean;
  clock: string;
  dayPhase: string;
  weatherLabel: string;
  weatherIcon: string;
  weatherType: WeatherType;
  soundOn: boolean;
  musicOn: boolean;
  eggCount: number;
  eggTotal: number;
  sensitivity: number;
  volume: number;
  quality: Quality;
  timeScale: number;
  prompt: string | null;
  toast: string;
  toastVisible: boolean;
  settingsOpen: boolean;
  /** 操作说明面板：新访客不知道 16 个交互点能做什么，H 键随时可查。 */
  helpOpen: boolean;
  /** 岛屿地图：从地图牌或 HUD 打开，显示分区与已盖章进度。 */
  mapOpen: boolean;
  /** 已盖章的分区 id。 */
  stamps: string[];
  /** 小径石碑 / 风车的正文卡片；null 表示没打开。 */
  reading: SignalReading | null;
  /** 拍照模式：隐藏 HUD，只保留取景框和快门。 */
  photoOpen: boolean;
  /** 钢琴模式：坐在琴凳上，画面下方出现 1—8 的琴键条。 */
  pianoOpen: boolean;
  /** 最近按下的琴键（0..7），PianoBar 用它做一次高亮。 */
  pianoNote: number;
  /** 每次按键递增，避免连按同一个键时 React 看不到变化。 */
  pianoStrike: number;
  /** 当前朝向，0 = 北（-z），顺时针增长。 */
  heading: number;
  /** 最近的区域名，HUD 罗盘下方显示。 */
  nearestZone: string;
  /** 玩家平面坐标，地图面板里的「你在这里」。 */
  playerX: number;
  playerZ: number;
  profileOpen: boolean;
  profileTab: ProfileTab;
  pauseVisible: boolean;
  touchActive: boolean;
  /** 天台躺椅 / 篝火 / 小船坐姿：坐着时 HUD 提示换成「按 E 起身」。 */
  seated: boolean;
  /** 望远镜目镜面板：打开时在画面上叠一层取景框，文字用 DOM 渲染保证清晰。 */
  scopeOpen: boolean;
  /** 目镜里当前展开的星点信号；null 表示只显示星点目录。 */
  scopeReading: SignalReading | null;
  /** 目镜目录：这一片星空里有哪些信号可读。 */
  scopeEntries: readonly SignalEntry[];
  /**
   * BIM 查看器：打开时世界停止渲染、鼠标释放，整个画面交给 BIM 场景。
   * loading 0..100 用于进度条，error 非空时显示重试。
   */
  bimOpen: boolean;
  bimLoading: boolean;
  bimProgress: number;
  bimError: string;
  /** 数据来源：glb 表示读了 public/models/bim.glb，procedural 是程序化生成。 */
  bimOrigin: "glb" | "procedural" | "";
  /** 当前显示楼层；null 表示全部。 */
  bimFloor: number | null;
  /** 选中的构件属性；null 表示没选中。 */
  bimSelection: BimSelection | null;
}

/** 右侧属性卡的内容：一个构件的可读属性。 */
export interface BimSelection {
  id: string;
  name: string;
  type: string;
  floor: number;
  volume: number;
  elevation: number;
  material: string;
}

const initialSnapshot: UISnapshot = {
  loading: 0,
  started: false,
  startLeaving: false,
  hudVisible: false,
  clock: "09:30",
  dayPhase: "MORNING",
  weatherLabel: "晴",
  weatherIcon: "☀",
  weatherType: "clear",
  soundOn: true,
  musicOn: true,
  eggCount: 0,
  eggTotal: 5,
  sensitivity: 1,
  volume: 0.55,
  quality: "high",
  timeScale: 1,
  prompt: null,
  toast: "",
  toastVisible: false,
  settingsOpen: false,
  helpOpen: false,
  mapOpen: false,
  stamps: [],
  reading: null,
  photoOpen: false,
  pianoOpen: false,
  pianoNote: -1,
  pianoStrike: 0,
  heading: 0,
  nearestZone: "岛上",
  playerX: 0,
  playerZ: 30,
  profileOpen: false,
  profileTab: "overview",
  pauseVisible: false,
  touchActive: false,
  seated: false,
  scopeOpen: false,
  scopeReading: null,
  scopeEntries: [],
  bimOpen: false,
  bimLoading: false,
  bimProgress: 0,
  bimError: "",
  bimOrigin: "",
  bimFloor: null,
  bimSelection: null,
};

let snapshot = initialSnapshot;
const listeners = new Set<() => void>();
let activeHandlers: UIHandlers | null = null;
let activeUI: UI | null = null;

function updateSnapshot(patch: Partial<UISnapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

export const uiActions: UIHandlers = {
  onEnter: () => activeHandlers?.onEnter(),
  onWeather: () => activeHandlers?.onWeather(),
  onSetWeather: (weather) => activeHandlers?.onSetWeather(weather),
  onQuality: (quality) => activeHandlers?.onQuality(quality),
  onSensitivity: (value) => activeHandlers?.onSensitivity(value),
  onVolume: (value) => activeHandlers?.onVolume(value),
  onTimeScale: (value) => activeHandlers?.onTimeScale(value),
  onReset: () => activeHandlers?.onReset(),
  onSound: () => activeHandlers?.onSound(),
  onMusic: () => activeHandlers?.onMusic(),
  onCapturePhoto: () => activeHandlers?.onCapturePhoto(),
  onExitPhoto: () => activeHandlers?.onExitPhoto(),
  onPianoKey: (index) => activeHandlers?.onPianoKey(index),
  onExitPiano: () => activeHandlers?.onExitPiano(),
  onResume: () => activeHandlers?.onResume(),
};

/** Stable bridge shared by the React shell and the imperative Three.js runtime. */
export const ui = {
  subscribe,
  getSnapshot,
  actions: uiActions,
  openSettings: () => activeUI?.openSettings(),
  closeSettings: (resume = true) => activeUI?.closeSettings(resume),
  openHelp: () => activeUI?.openHelp(),
  closeHelp: (resume = true) => activeUI?.closeHelp(resume),
  openProfile: (tab: ProfileTab = "overview") => activeUI?.openProfile(tab),
  closeProfile: (resume = true) => activeUI?.closeProfile(resume),
  selectProfileTab: (tab: ProfileTab) => activeUI?.selectProfileTab(tab),
  openMap: () => activeUI?.openMap(),
  closeMap: (resume = true) => activeUI?.closeMap(resume),
  openReading: (reading: SignalReading) => activeUI?.openReading(reading),
  closeReading: (resume = true) => activeUI?.closeReading(resume),
  setPhotoOpen: (open: boolean) => activeUI?.setPhotoOpen(open),
  setPianoOpen: (open: boolean) => activeUI?.setPianoOpen(open),
  strikePianoNote: (index: number) => activeUI?.strikePianoNote(index),
  hidePause: () => activeUI?.hidePause(),
  dispose: () => activeUI?.dispose(),
};

export class UI {
  readonly isTouch =
    window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  readonly subscribe = subscribe;
  readonly getSnapshot = getSnapshot;

  private readonly handlers: UIHandlers;
  private toastTimer = 0;

  get stick() {
    return requiredElement<HTMLDivElement>("stick");
  }

  get stickKnob() {
    return requiredElement<HTMLDivElement>("stick-knob");
  }

  constructor(handlers: UIHandlers) {
    this.handlers = handlers;
    activeHandlers = handlers;
    activeUI = this;
  }

  setLoading(percent: number) {
    const loading = Math.max(0, Math.min(100, Math.round(percent)));
    updateSnapshot({ loading });
  }

  enter() {
    updateSnapshot({
      started: true,
      startLeaving: true,
      hudVisible: true,
      touchActive: this.isTouch,
    });
  }

  setHudVisible(visible: boolean) {
    updateSnapshot({ hudVisible: visible });
  }

  get isHudVisible() {
    return snapshot.hudVisible;
  }

  setClock(time: string, phase: string) {
    updateSnapshot({ clock: time, dayPhase: phase });
  }

  setWeather(label: string, icon: string, type: WeatherType) {
    updateSnapshot({ weatherLabel: label, weatherIcon: icon, weatherType: type });
  }

  setSound(on: boolean) {
    updateSnapshot({ soundOn: on });
  }

  setMusic(on: boolean) {
    updateSnapshot({ musicOn: on });
  }

  setEggs(count: number, total: number) {
    updateSnapshot({ eggCount: count, eggTotal: total });
  }

  setSensitivity(value: number) {
    updateSnapshot({ sensitivity: value });
  }

  setVolume(value: number) {
    updateSnapshot({ volume: value });
  }

  setQuality(value: Quality) {
    updateSnapshot({ quality: value });
  }

  setTimeScale(value: number) {
    updateSnapshot({ timeScale: value });
  }

  setPrompt(text: string | null) {
    updateSnapshot({ prompt: text });
  }

  toast(text: string, duration = 3200) {
    window.clearTimeout(this.toastTimer);
    updateSnapshot({ toast: text, toastVisible: true });
    this.toastTimer = window.setTimeout(() => {
      updateSnapshot({ toast: "", toastVisible: false });
    }, duration);
  }

  openSettings() {
    updateSnapshot({
      settingsOpen: true,
      helpOpen: false,
      mapOpen: false,
      reading: null,
      pauseVisible: false,
      touchActive: false,
    });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  closeSettings(resume = true) {
    updateSnapshot({
      settingsOpen: false,
      touchActive: this.isTouch && !this.anyPanelOpen(),
    });
    if (resume) this.handlers.onResume();
  }

  get isSettingsOpen() {
    return snapshot.settingsOpen;
  }

  /**
   * 操作说明面板。和设置面板一样要释放鼠标锁定，但打开期间 isBlocking 为真，
   * 所以 pointerlockchange 里不会弹出「点击继续」的遮罩。
   */
  openHelp() {
    updateSnapshot({
      helpOpen: true,
      settingsOpen: false,
      mapOpen: false,
      reading: null,
      pauseVisible: false,
      touchActive: false,
      prompt: null,
    });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  closeHelp(resume = true) {
    updateSnapshot({
      helpOpen: false,
      touchActive: this.isTouch && !this.anyPanelOpen(),
    });
    if (resume) this.handlers.onResume();
  }

  get isHelpOpen() {
    return snapshot.helpOpen;
  }

  /** 任意会挡住世界操作的面板。触屏控件和暂停遮罩都按它决定要不要出现。 */
  private anyPanelOpen() {
    return (
      snapshot.settingsOpen ||
      snapshot.helpOpen ||
      snapshot.mapOpen ||
      snapshot.profileOpen ||
      snapshot.bimOpen ||
      snapshot.reading !== null
    );
  }

  // ------------------------------------------------------------- 地图 / 阅读

  openMap() {
    updateSnapshot({
      mapOpen: true,
      helpOpen: false,
      settingsOpen: false,
      pauseVisible: false,
      touchActive: false,
      prompt: null,
    });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  closeMap(resume = true) {
    updateSnapshot({
      mapOpen: false,
      touchActive: this.isTouch && !this.anyPanelOpen(),
    });
    if (resume) this.handlers.onResume();
  }

  get isMapOpen() {
    return snapshot.mapOpen;
  }

  /** 小径石碑 / 风车正文。打开时释放鼠标，正文交给 DOM 渲染，走近才展开。 */
  openReading(reading: SignalReading) {
    updateSnapshot({
      reading,
      pauseVisible: false,
      touchActive: false,
      prompt: null,
    });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  closeReading(resume = true) {
    updateSnapshot({
      reading: null,
      touchActive: this.isTouch && !this.anyPanelOpen(),
    });
    if (resume) this.handlers.onResume();
  }

  get isReadingOpen() {
    return snapshot.reading !== null;
  }

  /** 拍照模式：隐藏 HUD 只留取景框。退出时不强制重新锁定，交给调用方。 */
  setPhotoOpen(open: boolean) {
    updateSnapshot({
      photoOpen: open,
      touchActive: open ? false : this.isTouch && !this.anyPanelOpen(),
    });
    if (open && document.pointerLockElement) document.exitPointerLock();
  }

  get isPhotoOpen() {
    return snapshot.photoOpen;
  }

  /** 钢琴模式：只换 HUD 下方的浮层，不释放鼠标锁定，免得弹到一半弹回暂停遮罩。 */
  setPianoOpen(open: boolean) {
    updateSnapshot({ pianoOpen: open, pianoNote: -1 });
  }

  strikePianoNote(index: number) {
    updateSnapshot({ pianoNote: index, pianoStrike: snapshot.pianoStrike + 1 });
  }

  setStamps(stamps: readonly string[]) {
    updateSnapshot({ stamps: [...stamps] });
  }

  /** 罗盘与最近分区：engine 每 0.25 秒推一次，heading 单位是度。 */
  setCompass(heading: number, nearestZone: string) {
    updateSnapshot({ heading, nearestZone });
  }

  setPosition(x: number, z: number) {
    updateSnapshot({ playerX: x, playerZ: z });
  }

  get isProfileOpen() {
    return snapshot.profileOpen;
  }

  get isBlocking() {
    return (
      snapshot.settingsOpen ||
      snapshot.mapOpen ||
      snapshot.profileOpen ||
      snapshot.helpOpen ||
      snapshot.bimOpen ||
      snapshot.photoOpen ||
      snapshot.reading !== null
    );
  }

  // ------------------------------------------------------------- BIM 查看器

  /**
   * 打开 BIM 查看器。和设置面板一样要释放鼠标锁定，但 isBlocking 为真，
   * 所以 pointerlockchange 里不会弹「点击继续」遮罩。
   */
  openBim() {
    updateSnapshot({
      bimOpen: true,
      bimLoading: true,
      bimProgress: 0,
      bimError: "",
      bimOrigin: "",
      bimFloor: null,
      bimSelection: null,
      settingsOpen: false,
      helpOpen: false,
      mapOpen: false,
      reading: null,
      pauseVisible: false,
      touchActive: false,
      prompt: null,
    });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  setBimProgress(value: number) {
    updateSnapshot({ bimProgress: Math.round(Math.max(0, Math.min(1, value)) * 100) });
  }

  setBimReady(origin: "glb" | "procedural") {
    updateSnapshot({ bimLoading: false, bimProgress: 100, bimOrigin: origin });
  }

  setBimError(message: string) {
    updateSnapshot({ bimLoading: false, bimError: message });
  }

  setBimFloor(floor: number | null) {
    if (!snapshot.bimOpen) return;
    updateSnapshot({ bimFloor: floor });
  }

  selectBimElement(selection: BimSelection | null) {
    if (!snapshot.bimOpen) return;
    updateSnapshot({ bimSelection: selection });
  }

  closeBim(resume = true) {
    updateSnapshot({
      bimOpen: false,
      bimLoading: false,
      bimProgress: 0,
      bimError: "",
      bimOrigin: "",
      bimFloor: null,
      bimSelection: null,
      touchActive: this.isTouch && !this.anyPanelOpen(),
    });
    if (resume) this.handlers.onResume();
  }

  get isBimOpen() {
    return snapshot.bimOpen;
  }

  openProfile(tab: ProfileTab = "overview") {
    updateSnapshot({
      profileOpen: true,
      profileTab: tab,
      settingsOpen: false,
      helpOpen: false,
      mapOpen: false,
      reading: null,
      pauseVisible: false,
      touchActive: false,
      prompt: null,
    });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  closeProfile(resume = true) {
    updateSnapshot({
      profileOpen: false,
      touchActive: this.isTouch && !this.anyPanelOpen(),
    });
    if (resume) this.handlers.onResume();
  }

  selectProfileTab(tab: ProfileTab) {
    if (snapshot.profileOpen) updateSnapshot({ profileTab: tab });
  }

  showPause(show: boolean) {
    updateSnapshot({ pauseVisible: show });
  }

  hidePause() {
    updateSnapshot({ pauseVisible: false });
  }

  /** 坐姿开关只由 engine 在入座/起身时调用，不在任何面板里切换。 */
  setSeated(seated: boolean) {
    updateSnapshot({ seated });
  }

  setTouchActive(active: boolean) {
    updateSnapshot({
      touchActive: active && this.isTouch && !this.anyPanelOpen(),
    });
  }

  /** 进入/退出望远镜目镜。退出时一并清掉展开的详情，避免下次进来还停在旧内容。 */
  setScopeOpen(open: boolean) {
    updateSnapshot({ scopeOpen: open, scopeReading: open ? snapshot.scopeReading : null });
  }

  /** 展开或收起目镜里的某条信号；传 null 只保留目录。 */
  setScopeReading(reading: SignalReading | null) {
    updateSnapshot({ scopeReading: reading });
  }

  /** 灌入目镜目录（进入望远镜时由世界提供，星点数量随场景变化）。 */
  setScopeEntries(entries: readonly SignalEntry[]) {
    updateSnapshot({ scopeEntries: entries });
  }

  dispose() {
    window.clearTimeout(this.toastTimer);
    if (activeUI !== this) return;
    activeUI = null;
    activeHandlers = null;
    updateSnapshot(initialSnapshot);
  }

  setQualityOptions() {
    // No-op hook reserved for future UI-only options.
  }
}
