import type { UISnapshot } from "../../ui";

/**
 * 望远镜目镜面板：在画面上叠一层取景框，把星座信号的内容用 DOM 渲染。
 *
 * 为什么不画在 3D 里：相机进入望远镜后 FOV 收到 24°，贴在天空里的文字平面
 * 会被缩到几乎读不出字，换分辨率只会更糊。DOM 文字永远按屏幕像素渲染，
 * 而且能和页面共用一套字号与对比度规范。
 *
 * 面板不接管鼠标：取景时仍要能转动视角瞄准星点，所以整体 pointer-events: none，
 * 装饰层 aria-hidden，只有正文区域作为状态区让读屏软件播报。
 */
export function ScopeView({ snapshot }: { snapshot: UISnapshot }) {
  if (!snapshot.scopeOpen) return null;
  const reading = snapshot.scopeReading;
  const linkedCount = snapshot.scopeEntries.filter((entry) => entry.state === "linked").length;
  const total = snapshot.scopeEntries.length;

  return (
    <div className="scope">
      {/* 取景框与准星：纯装饰，交代"正在透过望远镜看" */}
      <div className="scope-mask" aria-hidden="true" />
      <div className="scope-reticle" aria-hidden="true">
        <span />
        <span />
      </div>

      <div className="scope-hud" role="status" aria-live="polite">
        <p className="scope-kicker">XIA HOME / SKY SIGNAL</p>
        {reading ? (
          <article className="scope-reading">
            <p className="scope-index">
              {reading.index} · {reading.label}
            </p>
            <h2 className="scope-title">{reading.title}</h2>
            <p className="scope-body">{reading.body}</p>
            <ul className="scope-tags">
              {reading.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
            <p className="scope-count">
              已连入 <span>{linkedCount}</span>/{total}
            </p>
          </article>
        ) : (
          <div className="scope-index-list">
            <p className="scope-prompt">用准星瞄准夜空里的星点，按 E 把它连进你正在画的星座</p>
            <p className="scope-count">
              已连入 <span>{linkedCount}</span>/{total}
            </p>
            <ul>
              {snapshot.scopeEntries.map((entry) => (
                <li key={entry.id} className={entry.state === "linked" ? "is-linked" : "is-open"}>
                  <span>{entry.index}</span>
                  <span>{entry.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="scope-exit" aria-hidden="true">
        <kbd>Esc</kbd>
        <span>退出望远镜</span>
      </div>
    </div>
  );
}
