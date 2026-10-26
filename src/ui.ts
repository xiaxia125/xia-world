import type { ProfileTab } from "./profile";
import type { Quality, WeatherType } from "./world/types";

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
  overlayOpen: boolean;
  overlayUrl: string;
  overlayLabel: string;
  profileOpen: boolean;
  profileTab: ProfileTab;
  pauseVisible: boolean;
  touchActive: boolean;
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
  overlayOpen: false,
  overlayUrl: "about:blank",
  overlayLabel: "PUBLIC PROFILE",
  profileOpen: false,
  profileTab: "overview",
  pauseVisible: false,
  touchActive: false,
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
    updateSnapshot({ settingsOpen: true, pauseVisible: false, touchActive: false });
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

  get is2DOpen() {
    return snapshot.overlayOpen;
  }

  get isProfileOpen() {
    return snapshot.profileOpen;
  }

  get isBlocking() {
    return snapshot.settingsOpen || snapshot.overlayOpen || snapshot.profileOpen;
  }

  openProfile(tab: ProfileTab = "overview") {
    updateSnapshot({
      profileOpen: true,
      profileTab: tab,
      settingsOpen: false,
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

  setTouchActive(active: boolean) {
    updateSnapshot({
      touchActive:
        active && this.isTouch && !snapshot.settingsOpen && !snapshot.overlayOpen && !snapshot.profileOpen,
    });
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
