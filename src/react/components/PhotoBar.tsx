import type { UIHandlers, UISnapshot } from "../../ui";

/** 拍照模式：只留取景框、快门和退出。截图本身由 engine 在渲染后合成水印。 */
export function PhotoBar({ snapshot, handlers }: { snapshot: UISnapshot; handlers: UIHandlers }) {
  if (!snapshot.photoOpen) return null;

  return (
    <div className="photo-ui">
      <div className="photo-frame" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="photo-hud" role="status">
        <p className="photo-kicker">PHOTO MODE / XIA HOME</p>
        <p className="photo-meta">
          {snapshot.weatherLabel} · {snapshot.clock} · {snapshot.nearestZone}
        </p>
      </div>

      <div className="photo-actions">
        <button
          className="photo-shutter"
          type="button"
          onClick={handlers.onCapturePhoto}
          title="拍照并下载 PNG (F)"
        >
          <span aria-hidden="true" />
          拍照
          <kbd>F</kbd>
        </button>
        <button className="photo-exit" type="button" onClick={handlers.onExitPhoto}>
          退出 <kbd>ESC</kbd>
        </button>
      </div>
    </div>
  );
}
