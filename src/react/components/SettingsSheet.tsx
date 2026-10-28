import type { ChangeEvent } from "react";
import type { Quality, WeatherType } from "../../world/types";
import type { UIHandlers, UISnapshot } from "../../ui";

type SettingsSheetProps = {
  snapshot: UISnapshot;
  handlers: UIHandlers;
  onClose: () => void;
};

const weatherOptions: Array<{ type: WeatherType; label: string }> = [
  { type: "clear", label: "晴" },
  { type: "rain", label: "雨" },
  { type: "snow", label: "雪" },
  { type: "fog", label: "雾" },
];

/** Settings are controlled by the shared UI snapshot; changes are sent to the engine handlers. */
export function SettingsSheet({ snapshot, handlers, onClose }: SettingsSheetProps) {
  const changeSensitivity = (event: ChangeEvent<HTMLInputElement>) => {
    handlers.onSensitivity(Number(event.currentTarget.value));
  };
  const changeVolume = (event: ChangeEvent<HTMLInputElement>) => {
    handlers.onVolume(Number(event.currentTarget.value));
  };
  const changeQuality = (event: ChangeEvent<HTMLSelectElement>) => {
    handlers.onQuality(event.currentTarget.value as Quality);
  };
  const changeTimeScale = (event: ChangeEvent<HTMLSelectElement>) => {
    handlers.onTimeScale(Number(event.currentTarget.value));
  };

  return (
    <aside id="settings" className={`sheet${snapshot.settingsOpen ? "" : " is-hidden"}`} aria-label="设置" aria-hidden={!snapshot.settingsOpen} inert={!snapshot.settingsOpen}>
      <div className="sheet-head">
        <div>
          <span className="sheet-kicker">SYSTEM</span>
          <h2>设置</h2>
        </div>
        <button id="settings-close" className="icon-button" type="button" aria-label="关闭设置" onClick={onClose}>×</button>
      </div>

      <div className="sheet-body">
        <label className="field">
          <span>鼠标灵敏度 <output id="sens-value">{snapshot.sensitivity.toFixed(1)}</output></span>
          <input id="set-sens" type="range" min="0.4" max="2.2" step="0.1" value={snapshot.sensitivity} onChange={changeSensitivity} />
        </label>
        <label className="field">
          <span>总音量 <output id="volume-value">{Math.round(snapshot.volume * 100)}%</output></span>
          <input id="set-volume" type="range" min="0" max="1" step="0.05" value={snapshot.volume} onChange={changeVolume} />
        </label>
        <div className="field field-row">
          <span>背景音乐</span>
          <button id="btn-music-setting" className={`mini-button${snapshot.musicOn ? " is-active" : ""}`} type="button" onClick={handlers.onMusic}>
            背景音乐 · {snapshot.musicOn ? "开" : "关"}
          </button>
        </div>
        <div className="field">
          <span>天台娱乐</span>
          <div className="weather-buttons play-buttons">
            <button id="btn-arcade" type="button" onClick={handlers.onArcade}>街机厅</button>
            <button id="btn-cinema" type="button" onClick={handlers.onCinema}>天台影院</button>
          </div>
        </div>
        <label className="field field-row">
          <span>画质</span>
          <select id="set-quality" value={snapshot.quality} onChange={changeQuality}>
            <option value="high">高 · 阴影</option>
            <option value="low">低 · 流畅</option>
          </select>
        </label>
        <label className="field field-row">
          <span>时间流速</span>
          <select id="set-speed" value={String(snapshot.timeScale)} onChange={changeTimeScale}>
            <option value="0.5">慢</option>
            <option value="1">正常</option>
            <option value="4">快</option>
          </select>
        </label>
        <div className="field">
          <span>天气</span>
          <div className="weather-buttons" id="weather-buttons">
            {weatherOptions.map(({ type, label }) => (
              <button key={type} className={snapshot.weatherType === type ? "is-active" : ""} type="button" data-weather={type} onClick={() => handlers.onSetWeather(type)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="sheet-divider" />
        <button id="btn-reset" className="mini-button danger" type="button" onClick={() => {
          if (window.confirm("确定要清空位置、设置和彩蛋进度吗？")) handlers.onReset();
        }}>重置探索进度</button>
        <p className="sheet-note">位置、设置和彩蛋会自动保存在这台设备上。世界每 12 分钟完成一次昼夜循环。</p>
      </div>
    </aside>
  );
}
