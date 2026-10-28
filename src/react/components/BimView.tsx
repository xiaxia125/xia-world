import { useEffect, useMemo, useRef, useState } from "react";
import { ui, type UISnapshot } from "../../ui";
import { groupByFloor, groupByType, typeLabel, type BimElement } from "../../bim/building";
import "./bim-view.css";

/**
 * BIM 查看器的界面层：左侧构件树、右侧属性卡、顶部楼层条。
 *
 * 三维部分由 engine 驱动（同一个 renderer 画另一个 scene），这里只负责
 * 数据展示与操作入口。点构件树的行会调 uiActions 里注册的回调去切楼层，
 * 点属性卡的关闭只清选中，不退出查看器。
 */

/** engine 在打开查看器时把这份数据挂进来，组件只读。 */
export interface BimTreeData {
  elements: BimElement[];
}

/** 由 engine 提供的操作回调；面板不直接碰三维。 */
export interface BimPanelHandlers {
  onShowFloor: (floor: number | null) => void;
  onSelect: (id: string) => void;
  onExit: () => void;
  onRetry: () => void;
}

let panelHandlers: BimPanelHandlers | null = null;
let treeData: BimTreeData = { elements: [] };

/** engine 用这两个函数把数据和回调送进来，避免把三维句柄传进 React。 */
export function setBimPanelData(data: BimTreeData) {
  treeData = data;
}

export function setBimPanelHandlers(handlers: BimPanelHandlers | null) {
  panelHandlers = handlers;
}

/**
 * 面板本体。打开时铺满画面，世界那层由 engine 停止渲染。
 */
export function BimView({ snapshot }: { snapshot: UISnapshot }) {
  const open = snapshot.bimOpen;
  const [expandedFloors, setExpandedFloors] = useState<Set<number>>(new Set());
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const bodyRef = useRef<HTMLDivElement>(null);

  // 每次重新打开都把折叠状态清掉，回到「全部收起」的初始视图
  useEffect(() => {
    if (!open) {
      setExpandedFloors(new Set());
      setExpandedTypes(new Set());
    }
  }, [open]);

  const floors = useMemo(() => groupByFloor(treeData.elements), [open, treeData.elements]);

  if (!open) return null;

  const toggleFloor = (floor: number) => {
    setExpandedFloors((prev) => {
      const next = new Set(prev);
      if (next.has(floor)) next.delete(floor);
      else next.add(floor);
      return next;
    });
  };

  const toggleType = (key: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div id="bim" className="bim" role="dialog" aria-modal="true" aria-label="BIM 建筑模型查看器">
      <header className="bim-head">
        <div className="bim-title">
          <span className="bim-kicker">BIM VIEWER / 技术演示</span>
          <h2>建筑构件模型</h2>
          {snapshot.bimOrigin && (
            <span className="bim-origin">
              {snapshot.bimOrigin === "glb" ? "数据源：models/bim.glb" : "数据源：程序化生成"}
            </span>
          )}
        </div>

        <div className="bim-floors" role="group" aria-label="楼层切换">
          <button
            type="button"
            className={`bim-floor${snapshot.bimFloor === null ? " is-active" : ""}`}
            onClick={() => panelHandlers?.onShowFloor(null)}
          >
            全部
          </button>
          {floors.map(([floor]) => (
            <button
              key={floor}
              type="button"
              className={`bim-floor${snapshot.bimFloor === floor ? " is-active" : ""}`}
              onClick={() => panelHandlers?.onShowFloor(floor)}
            >
              {floor}F
            </button>
          ))}
        </div>

        <button className="mini-button bim-exit" type="button" onClick={() => panelHandlers?.onExit()}>
          返回世界
        </button>
      </header>

      {snapshot.bimLoading && (
        <div className="bim-loading" role="status">
          <p>正在装配构件…</p>
          <div className="bim-bar" aria-hidden="true">
            <span style={{ width: `${snapshot.bimProgress}%` }} />
          </div>
          <p className="bim-loading-num">{snapshot.bimProgress}%</p>
        </div>
      )}

      {snapshot.bimError && (
        <div className="bim-error" role="alert">
          <p>{snapshot.bimError}</p>
          <button className="mini-button" type="button" onClick={() => panelHandlers?.onRetry()}>
            重试
          </button>
        </div>
      )}

      <div className="bim-body" ref={bodyRef}>
        <aside className="bim-tree" aria-label="构件树">
          <p className="bim-tree-head">构件树</p>
          <ul className="bim-tree-list">
            {floors.map(([floor, elements]) => {
              const floorOpen = expandedFloors.has(floor);
              return (
                <li key={floor}>
                  <button
                    type="button"
                    className={`bim-tree-row is-floor${snapshot.bimFloor === floor ? " is-active" : ""}`}
                    aria-expanded={floorOpen}
                    onClick={() => toggleFloor(floor)}
                  >
                    <span className="bim-caret">{floorOpen ? "−" : "+"}</span>
                    <span>{floor}F</span>
                    <span className="bim-count">{elements.length}</span>
                  </button>
                  {floorOpen && (
                    <ul className="bim-tree-sub">
                      {groupByType(elements).map(([type, list]) => {
                        const key = `${floor}:${type}`;
                        const typeOpen = expandedTypes.has(key);
                        return (
                          <li key={key}>
                            <button
                              type="button"
                              className="bim-tree-row is-type"
                              aria-expanded={typeOpen}
                              onClick={() => toggleType(key)}
                            >
                              <span className="bim-caret">{typeOpen ? "−" : "+"}</span>
                              <span>{typeLabel(type)}</span>
                              <span className="bim-count">{list.length}</span>
                            </button>
                            {typeOpen && (
                              <ul className="bim-tree-sub">
                                {list.map((el) => (
                                  <li key={el.id}>
                                    <button
                                      type="button"
                                      className={`bim-tree-row is-part${
                                        snapshot.bimSelection?.id === el.id ? " is-active" : ""
                                      }`}
                                      onClick={() => panelHandlers?.onSelect(el.id)}
                                    >
                                      <span className="bim-part-name">{el.name}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>

        <aside className="bim-props" aria-label="构件属性" aria-live="polite">
          {snapshot.bimSelection ? (
            <>
              <div className="bim-props-head">
                <p className="bim-props-kicker">SELECTED / 已选中</p>
                <h3>{snapshot.bimSelection.name}</h3>
              </div>
              <dl className="bim-props-list">
                <div>
                  <dt>类型</dt>
                  <dd>{snapshot.bimSelection.type}</dd>
                </div>
                <div>
                  <dt>楼层</dt>
                  <dd>{snapshot.bimSelection.floor}F</dd>
                </div>
                <div>
                  <dt>体积</dt>
                  <dd>{snapshot.bimSelection.volume.toFixed(3)} m³</dd>
                </div>
                <div>
                  <dt>标高</dt>
                  <dd>{snapshot.bimSelection.elevation.toFixed(2)} m</dd>
                </div>
                <div>
                  <dt>材质</dt>
                  <dd>{snapshot.bimSelection.material}</dd>
                </div>
                <div>
                  <dt>构件编号</dt>
                  <dd className="bim-mono">{snapshot.bimSelection.id}</dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="bim-props-empty">
              <p className="bim-props-kicker">NO SELECTION</p>
              <p>点模型里的柱子或墙，这里显示它的名称、类型、体积和标高。</p>
              <p className="bim-props-hint">
                左键拖动旋转 · 滚轮缩放 · 右键拖动平移
              </p>
            </div>
          )}
        </aside>
      </div>

      <p className="bim-foot-hint">
        <kbd>Esc</kbd> 返回世界
      </p>
    </div>
  );
}
