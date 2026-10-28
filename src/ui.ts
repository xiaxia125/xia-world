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
  onClose2D: (requestLock?: boolean) => void;
  onWeather: () => void;
  onSetWeather: (weather: WeatherType) => void;
  onQuality: (quality: Quality) => void;
  onSensitivity: (value: number) => void;
  onVolume: (value: number) => void;
  onTimeScale: (value: number) => void;
  onReset: () => void;
  onSound: () => void;
  onMusic: () => void;
  onArcade: () => void;
  onCinema: () => void;
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
  overlayOpen: boolean;
  overlayUrl: string;
  overlayLabel: string;
  profileOpen: boolean;
  profileTab: ProfileTab;
  pauseVisible: boolean;
  touchActive: boolean;
  /** 天台影院坐姿：坐着时 HUD 提示换成「按 E 起身」，WASD 不再移动。 */
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
  eggTotal: 7,
  sensitivity: 1,
  volume: 0.55,
  quality: "high",
  timeScale: 1,
  prompt: null,
  toast: "",
  toastVisible: false,
  settingsOpen: false,
  helpOpen: false,
  overlayOpen: false,
  overlayUrl: "about:blank",
  overlayLabel: "PUBLIC PROFILE",
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
  onClose2D: (requestLock) => activeHandlers?.onClose2D(requestLock),
  onWeather: () => activeHandlers?.onWeather(),
  onSetWeather: (weather) => activeHandlers?.onSetWeather(weather),
  onQuality: (quality) => activeHandlers?.onQuality(quality),
  onSensitivity: (value) => activeHandlers?.onSensitivity(value),
  onVolume: (value) => activeHandlers?.onVolume(value),
  onTimeScale: (value) => activeHandlers?.onTimeScale(value),
  onReset: () => activeHandlers?.onReset(),
  onSound: () => activeHandlers?.onSound(),
  onMusic: () => activeHandlers?.onMusic(),
  onArcade: () => activeHandlers?.onArcade(),
  onCinema: () => activeHandlers?.onCinema(),
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
      pauseVisible: false,
      touchActive: false,
    });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  closeSettings(resume = true) {
    updateSnapshot({
      settingsOpen: false,
      touchActive: this.isTouch && !snapshot.overlayOpen,
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
      pauseVisible: false,
      touchActive: false,
      prompt: null,
    });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  closeHelp(resume = true) {
    updateSnapshot({
      helpOpen: false,
      touchActive:
        this.isTouch && !snapshot.settingsOpen && !snapshot.overlayOpen && !snapshot.profileOpen,
    });
    if (resume) this.handlers.onResume();
  }

  get isHelpOpen() {
    return snapshot.helpOpen;
  }

  get is2DOpen() {
    return snapshot.overlayOpen;
  }

  get isProfileOpen() {
    return snapshot.profileOpen;
  }

  get isBlocking() {
    return (
      snapshot.settingsOpen ||
      snapshot.overlayOpen ||
      snapshot.profileOpen ||
      snapshot.helpOpen ||
      snapshot.bimOpen
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
      touchActive: this.isTouch && !snapshot.settingsOpen && !snapshot.overlayOpen,
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
      pauseVisible: false,
      touchActive: false,
      prompt: null,
    });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  closeProfile(resume = true) {
    updateSnapshot({
      profileOpen: false,
      touchActive: this.isTouch && !snapshot.settingsOpen && !snapshot.overlayOpen,
    });
    if (resume) this.handlers.onResume();
  }

  selectProfileTab(tab: ProfileTab) {
    if (snapshot.profileOpen) updateSnapshot({ profileTab: tab });
  }

  open2D(url: string, label = "PUBLIC PROFILE") {
    updateSnapshot({
      overlayOpen: true,
      overlayUrl: url,
      overlayLabel: label,
      helpOpen: false,
      pauseVisible: false,
      touchActive: false,
      prompt: null,
    });
    if (document.pointerLockElement) document.exitPointerLock();
  }

  close2D() {
    updateSnapshot({
      overlayOpen: false,
      overlayUrl: "about:blank",
      touchActive: this.isTouch && !snapshot.settingsOpen,
    });
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
      touchActive:
        active &&
        this.isTouch &&
        !snapshot.settingsOpen &&
        !snapshot.overlayOpen &&
        !snapshot.profileOpen &&
        !snapshot.helpOpen,
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
