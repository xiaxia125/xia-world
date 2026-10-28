import { ui, type UISnapshot } from "../../ui";

/**
 * 小径石碑、风车的正文面板。3D 上只刻年份和标题，走近按 E 才展开，
 * 这样远处不会糊成一片，正文也不受贴图分辨率限制。
 */
export function ReadingPanel({ snapshot }: { snapshot: UISnapshot }) {
  const reading = snapshot.reading;
  if (!reading) return null;

  return (
    <section className="reading-panel" role="dialog" aria-labelledby="reading-title">
      <article className="reading-card">
        <header className="reading-topbar">
          <span className="reading-kicker">PLAQUE / {reading.index}</span>
          <button className="reading-close" type="button" onClick={() => ui.closeReading()}>
            <span>合上</span>
            <kbd>ESC</kbd>
          </button>
        </header>
        <p className="reading-label">{reading.label}</p>
        <h2 id="reading-title">{reading.title}</h2>
        <p className="reading-body">{reading.body}</p>
        <ul className="reading-tags">
          {reading.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
        <footer className="reading-foot">
          <span>XIA HOME / FIVE YEAR TRAIL</span>
          <button type="button" onClick={() => ui.closeReading()}>
            继续走 <span aria-hidden="true">→</span>
          </button>
        </footer>
      </article>
    </section>
  );
}
