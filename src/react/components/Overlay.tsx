import type { UIHandlers, UISnapshot } from "../../ui";

type OverlayProps = {
  snapshot: UISnapshot;
  handlers: UIHandlers;
};

/** Displays the selected embedded experience while keeping the world mounted underneath. */
export function Overlay({ snapshot, handlers }: OverlayProps) {
  return (
    <section id="overlay" className={`overlay${snapshot.overlayOpen ? "" : " is-hidden"}`} aria-hidden={!snapshot.overlayOpen} aria-label="内嵌页面">
      <header className="overlay-bar">
        <div className="overlay-title">
          <i className="dot live" />
          <span>2D MODE</span>
          <span id="overlay-label" className="overlay-sub">{snapshot.overlayLabel}</span>
        </div>
        <button id="overlay-close" className="overlay-close" type="button" onClick={() => handlers.onClose2D(true)}>
          返回世界 <kbd>ESC</kbd>
        </button>
      </header>
      <iframe id="overlay-frame" title={snapshot.overlayLabel || "内嵌页面"} src={snapshot.overlayUrl} />
    </section>
  );
}
