import { useSyncExternalStore } from "react";
import { ui } from "../ui";
import { HelpPanel } from "./components/HelpPanel";
import { BimView } from "./components/BimView";
import { Hud } from "./components/Hud";
import { MapPanel } from "./components/MapPanel";
import { PhotoBar } from "./components/PhotoBar";
import { PianoBar } from "./components/PianoBar";
import { ProfilePanel } from "./components/ProfilePanel";
import { ReadingPanel } from "./components/ReadingPanel";
import { ScopeView } from "./components/ScopeView";
import { SettingsSheet } from "./components/SettingsSheet";
import { StartScreen } from "./components/StartScreen";
import { TouchControls } from "./components/TouchControls";

/** Composes every world-facing surface while leaving simulation ownership in the engine. */
export function WorldInterface() {
  const snapshot = useSyncExternalStore(ui.subscribe, ui.getSnapshot, ui.getSnapshot);
  const handlers = ui.actions;

  return (
    <div id="ui">
      <div className="vignette" aria-hidden="true" />
      <StartScreen loading={snapshot.loading} leaving={snapshot.startLeaving} onEnter={handlers.onEnter} onOpenProfile={() => ui.openProfile("overview")} />
      <Hud snapshot={snapshot} handlers={handlers} onOpenSettings={() => ui.openSettings()} onOpenProfile={() => ui.openProfile("overview")} onOpenHelp={() => ui.openHelp()} onOpenMap={() => ui.openMap()} />
      <SettingsSheet
        snapshot={snapshot}
        handlers={handlers}
        onClose={() => ui.closeSettings()}
      />
      <HelpPanel snapshot={snapshot} />
      <MapPanel snapshot={snapshot} />
      <ReadingPanel snapshot={snapshot} />
      <PhotoBar snapshot={snapshot} handlers={handlers} />
      <PianoBar snapshot={snapshot} handlers={handlers} />
      <ProfilePanel snapshot={snapshot} />
      <ScopeView snapshot={snapshot} />
      <BimView snapshot={snapshot} />
      <TouchControls snapshot={snapshot} />
    </div>
  );
}
