import type { UISnapshot } from "../../ui";
import { ui } from "../../ui";

type TouchControlsProps = {
  snapshot: UISnapshot;
};

/** Keeps touch controls mounted so the Three.js player can attach joystick listeners after boot. */
export function TouchControls({ snapshot }: TouchControlsProps) {
  return (
    <div id="touch" className={`touch${snapshot.touchActive ? " is-active" : ""}`} aria-hidden={!snapshot.touchActive} inert={!snapshot.touchActive}>
      <div id="stick" className="stick"><div id="stick-knob" /></div>
      <div className="touch-actions">
        <button id="touch-interact" className="touch-button touch-interact" type="button">E</button>
        <button id="touch-jump" className="touch-button" type="button">↑</button>
        <button id="touch-profile" className="touch-button touch-small" type="button" onClick={() => ui.openProfile("overview")}>CV</button>
      </div>
    </div>
  );
}
