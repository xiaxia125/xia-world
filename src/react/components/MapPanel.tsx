import { useEffect, type CSSProperties } from "react";
import { ui, type UISnapshot } from "../../ui";
import { MAP_ZONE_ORDER, WORLD_BOUNDS, ZONES, zoneBox } from "../../world/zones";

/** 天台和工作室在同一块平面上，标签各让开一点，免得叠在一起。 */
const LABEL_TOP: Record<string, string> = {
  roof: "22%",
  studio: "74%",
};

/**
 * 岛屿地图面板。数据直接来自 `world/zones.ts`，和广场上的 3D 地图牌、
 * 访客印章共用一份分区表，改一处三处同步。
 */
export function MapPanel({ snapshot }: { snapshot: UISnapshot }) {
  useEffect(() => {
    if (!snapshot.mapOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        ui.closeMap();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [snapshot.mapOpen]);

  if (!snapshot.mapOpen) return null;

  const width = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
  const depth = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ;
  const playerLeft = `${((snapshot.playerX - WORLD_BOUNDS.minX) / width) * 100}%`;
  const playerTop = `${((snapshot.playerZ - WORLD_BOUNDS.minZ) / depth) * 100}%`;
  const stamped = new Set(snapshot.stamps);
  const ordered = MAP_ZONE_ORDER.map((id) => ZONES.find((zone) => zone.id === id)).filter(
    (zone): zone is (typeof ZONES)[number] => Boolean(zone),
  );

  return (
    <section className="map-panel" role="dialog" aria-modal="true" aria-labelledby="map-title">
      <div className="map-shell">
        <header className="map-topbar">
          <div className="map-topbar-title">
            <span className="map-live-dot" aria-hidden="true" />
            <h2 id="map-title">ISLAND MAP / 岛屿地图</h2>
          </div>
          <div className="map-progress">
            <span>
              访客印章 <b>{snapshot.stamps.length}</b> / {ordered.length}
            </span>
            <button className="map-close" type="button" onClick={() => ui.closeMap()}>
              <span>返回世界</span>
              <kbd>ESC</kbd>
            </button>
          </div>
        </header>

        <div className="map-body">
          <div className="map-canvas" aria-label="岛屿分区图">
            <div className="map-grid" aria-hidden="true" />
            {ordered.map((zone) => {
              const isStamp = stamped.has(zone.id);
              const box = zoneBox(zone);
              return (
                <div
                  key={zone.id}
                  className={`map-zone${isStamp ? " is-stamped" : ""}${zone.id === "roof" ? " is-overlay" : ""}`}
                  style={
                    {
                      left: box.left,
                      top: box.top,
                      width: box.width,
                      height: box.height,
                      "--zone-color": zone.color,
                    } as CSSProperties
                  }
                >
                  <span className="map-zone-index">{zone.index}</span>
                  <span
                    className="map-zone-label"
                    style={LABEL_TOP[zone.id] ? { top: LABEL_TOP[zone.id] } : undefined}
                  >
                    {zone.name}
                    {isStamp ? <i aria-label="已盖章">✓</i> : null}
                  </span>
                </div>
              );
            })}

            <span className="map-player" style={{ left: playerLeft, top: playerTop }} aria-label="你的位置">
              <i aria-hidden="true" />
              <b>YOU</b>
            </span>

            <span className="map-north" aria-hidden="true">
              N ↑
            </span>
          </div>

          <aside className="map-legend" aria-label="分区与印章">
            <p className="map-legend-kicker">ZONES / 11</p>
            <ul>
              {ZONES.map((zone) => {
                const isStamp = stamped.has(zone.id);
                return (
                  <li key={zone.id} className={isStamp ? "is-stamped" : ""}>
                    <span className="map-legend-index" style={{ color: zone.color }}>
                      {zone.index}
                    </span>
                    <span className="map-legend-name">
                      {zone.name}
                      <small>{zone.subtitle}</small>
                    </span>
                    <span className="map-legend-stamp" aria-label={isStamp ? "已盖章" : "未盖章"}>
                      {isStamp ? "✓" : "·"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="map-legend-note">
              走进一个新区域会自动盖一枚章。当前：<b>{snapshot.nearestZone}</b>
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
