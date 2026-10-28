import type { UIHandlers, UISnapshot } from "../../ui";

type HudProps = {
  snapshot: UISnapshot;
  handlers: UIHandlers;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenHelp: () => void;
  onOpenMap: () => void;
};

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** 0° = 北（-z），顺时针。罗盘只做展示，真正的朝向由 engine 每 0.25 秒推送。 */
function cardinalOf(heading: number) {
  const index = Math.round((((heading % 360) + 360) % 360) / 45) % CARDINALS.length;
  return CARDINALS[index]!;
}

/** Renders world status and controls without owning any Three.js state. */
export function Hud({ snapshot, handlers, onOpenSettings, onOpenProfile, onOpenHelp, onOpenMap }: HudProps) {
  const cardinal = cardinalOf(snapshot.heading);
  // 拍照模式下整块 HUD 让位，只留 PhotoBar 的取景框和快门。
  const visible = snapshot.hudVisible && !snapshot.photoOpen;

  return (
    <section id="hud" className={`hud${visible ? "" : " is-hidden"}`} aria-label="世界界面" inert={!visible}>
      <header className="hud-top">
        <div className="hud-brand">
          <span className="hud-logo" aria-hidden="true" />
          <span>夏夏 · XIA HOME</span>
        </div>
        <div className="hud-status">
          <span className="chip compass-chip" title="当前朝向">
            <span
              className="compass-rose"
              aria-hidden="true"
              style={{ transform: `rotate(${snapshot.heading}deg)` }}
            >
              <i />
            </span>
            <span className="compass-text">
              <b>{cardinal}</b>
              <small>{snapshot.nearestZone}</small>
            </span>
          </span>
          <button id="btn-map" className="chip chip-button" type="button" title="岛屿地图 (N)" aria-label="打开岛屿地图" onClick={onOpenMap}>
            <span aria-hidden="true">▦</span>
            <span>地图</span>
          </button>
          <button id="btn-profile" className="chip chip-button profile-chip" type="button" title="打开职业档案 (P)" aria-label="打开职业档案" onClick={onOpenProfile}>
            <span aria-hidden="true">CV</span>
            <span>职业档案</span>
          </button>
          <button id="btn-weather" className="chip chip-button" type="button" title="切换天气 (R)" onClick={handlers.onWeather}>
            <span id="weather-icon" aria-hidden="true">{snapshot.weatherIcon}</span>
            <span id="weather-label">{snapshot.weatherLabel}</span>
          </button>
          <span className="chip clock" title="世界时间">
            <span id="clock">{snapshot.clock}</span>
            <span id="day-phase">{snapshot.dayPhase}</span>
          </span>
          <button id="btn-sound" className="icon-button" type="button" title={snapshot.soundOn ? "关闭所有声音" : "开启所有声音"} aria-label={snapshot.soundOn ? "关闭所有声音" : "开启所有声音"} aria-pressed={snapshot.soundOn} onClick={handlers.onSound}>
            <span id="sound-icon" aria-hidden="true">{snapshot.soundOn ? "♫" : "×"}</span>
          </button>
          <button id="btn-help" className="icon-button" type="button" title="操作说明 (H)" aria-label="打开操作说明" onClick={onOpenHelp}>
            <span aria-hidden="true">?</span>
          </button>
          <button id="btn-settings" className="icon-button" type="button" title="设置" aria-label="打开设置" onClick={onOpenSettings}>
            <span aria-hidden="true">≡</span>
          </button>
        </div>
      </header>

      <div className={`crosshair${snapshot.prompt ? " is-active" : ""}`} id="crosshair" aria-hidden="true"><span /></div>

      <div id="prompt" className={`prompt${snapshot.prompt ? "" : " is-hidden"}`} role="status">
        <kbd>E</kbd><span id="prompt-text">{snapshot.prompt ?? ""}</span>
      </div>

      <div id="toast" className={`toast${snapshot.toastVisible ? " is-on" : ""}`} role="status" aria-live="polite">{snapshot.toast}</div>

      <footer className="hud-bottom">
        <div className="hud-hint">
          <span><kbd>WASD</kbd> 漫游</span>
          <span><kbd>SHIFT</kbd> 奔跑</span>
          <span><kbd>SPACE</kbd> 跳跃</span>
          <span><kbd>E</kbd> 互动</span>
          <span><kbd>N</kbd> 地图</span>
          <span><kbd>P</kbd> 职业档案</span>
          <span><kbd>R</kbd> 天气</span>
          <span><kbd>M</kbd> 音乐</span>
          <span><kbd>H</kbd> 说明</span>
          <span><kbd>ESC</kbd> 鼠标</span>
        </div>
        <div className="hud-badges">
          <span className="chip"><i className="dot live" /> 3D MODE</span>
          <span className="chip" id="stamp-counter">◎ 印章 {snapshot.stamps.length}/11</span>
          <span className="chip" id="egg-counter">◇ 彩蛋 {snapshot.eggCount}/{snapshot.eggTotal}</span>
        </div>
      </footer>

      <button id="pause" className={`pause${snapshot.pauseVisible ? "" : " is-hidden"}`} type="button" onClick={handlers.onResume}>
        <b>点击继续</b>
        <span>鼠标已释放 · 点击继续恢复视角</span>
      </button>
    </section>
  );
}
