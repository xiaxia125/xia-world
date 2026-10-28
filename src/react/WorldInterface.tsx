import { useEffect, useSyncExternalStore } from "react";
import { ui } from "../ui";
import { HelpPanel } from "./components/HelpPanel";
import { BimView } from "./components/BimView";
import { Hud } from "./components/Hud";
import { Overlay } from "./components/Overlay";
import { ProfilePanel } from "./components/ProfilePanel";
import { ScopeView } from "./components/ScopeView";
import { SettingsSheet } from "./components/SettingsSheet";
import { StartScreen } from "./components/StartScreen";
import { TouchControls } from "./components/TouchControls";

/** Composes every world-facing surface while leaving simulation ownership in the engine. */
export function WorldInterface() {
  const snapshot = useSyncExternalStore(ui.subscribe, ui.getSnapshot, ui.getSnapshot);
  const handlers = ui.actions;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === "xia-home:close-2d") handlers.onClose2D(false);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handlers]);

  return (
    <div id="ui">
      <div className="vignette" aria-hidden="true" />
      <StartScreen loading={snapshot.loading} leaving={snapshot.startLeaving} onEnter={handlers.onEnter} onOpenProfile={() => ui.openProfile("overview")} />
      <Hud snapshot={snapshot} handlers={handlers} onOpenSettings={() => ui.openSettings()} onOpenProfile={() => ui.openProfile("overview")} onOpenHelp={() => ui.openHelp()} />
      <SettingsSheet
        snapshot={snapshot}
        handlers={handlers}
        onClose={() => ui.closeSettings()}
      />
      <HelpPanel snapshot={snapshot} />
      <Overlay snapshot={snapshot} handlers={handlers} />
      <ProfilePanel snapshot={snapshot} />
      <ScopeView snapshot={snapshot} />
      <BimView snapshot={snapshot} />
      <TouchControls snapshot={snapshot} />
    </div>
  );
}
