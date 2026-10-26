type StartScreenProps = {
  loading: number;
  leaving: boolean;
  onEnter: () => void;
  onOpenProfile: () => void;
};

/** Renders the walkable-world entry screen from the current loading state. */
export function StartScreen({ loading, leaving, onEnter, onOpenProfile }: StartScreenProps) {
  const label = loading >= 100 ? "进入世界" : `正在生成世界 ${String(loading).padStart(2, "0")}%`;

  return (
    <main id="start" className={`start${leaving ? " is-leaving" : ""}`}>
      <div className="start-grid" aria-hidden="true" />
      <header className="start-top">
        <span>XIA HOME <b>/ 001</b></span>
        <span className="start-top-right">FRONTEND ENGINEER <i /> OPEN TO WORK</span>
      </header>

      <div className="start-body">
        <p className="eyebrow" data-reveal>夏夏 / FRONTEND ENGINEER / 5 YEARS</p>
        <h1 className="start-title">
          <span data-reveal>XIA</span>
          <span className="outline" data-reveal>HOME</span>
        </h1>
        <p className="start-lede" data-reveal>
          你好，我是夏夏，一名前端开发工程师。把复杂业务、数据与空间，做成可以被操作的东西。
        </p>
        <p className="start-lede start-lede-small" data-reveal>
          先看职业档案，或者直接进入世界：广场、项目展厅和工作室里都留着可以继续阅读的线索。
        </p>

        <div className="start-actions" data-reveal>
          <button id="enter" className="btn-primary" disabled={loading < 100} onClick={onEnter} type="button">
            <span id="enter-label">{label}</span>
            <span className="btn-arrow" aria-hidden="true">→</span>
          </button>
          <button className="btn-link" type="button" onClick={onOpenProfile}>
            先看职业档案 <span aria-hidden="true">↗</span>
          </button>
        </div>

        <ul className="start-meta" data-reveal>
          <li><b>01</b> 5 年前端开发</li>
          <li><b>02</b> 可视化 · 地图 · 跨端</li>
          <li><b>03</b> 求职中 · 2026</li>
        </ul>
      </div>

      <footer className="start-bottom">
        <span>夏夏 · 前端开发工程师 · XIA HOME</span>
        <span>WASD 移动 / P 职业档案 / ESC 释放鼠标</span>
      </footer>
    </main>
  );
}
