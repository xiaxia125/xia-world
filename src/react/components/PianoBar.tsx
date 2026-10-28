import { useEffect, useState } from "react";
import type { UIHandlers, UISnapshot } from "../../ui";

/** 8 个白键，正好对上音阶里的一段；键位沿用键盘的 1—8。 */
const KEYS = [
  { key: "1", note: "C" },
  { key: "2", note: "D" },
  { key: "3", note: "E" },
  { key: "4", note: "F" },
  { key: "5", note: "G" },
  { key: "6", note: "A" },
  { key: "7", note: "B" },
  { key: "8", note: "C" },
];

/**
 * 钢琴模式：底部一条琴键。键盘 1—8 和鼠标点击走同一条 strikePiano，
 * 所以 3D 琴键、音色和这里的高亮始终同步。
 */
export function PianoBar({ snapshot, handlers }: { snapshot: UISnapshot; handlers: UIHandlers }) {
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    if (!snapshot.pianoOpen || snapshot.pianoStrike === 0) return;
    setActive(snapshot.pianoNote);
    const timer = window.setTimeout(() => setActive(null), 170);
    return () => window.clearTimeout(timer);
  }, [snapshot.pianoOpen, snapshot.pianoNote, snapshot.pianoStrike]);

  if (!snapshot.pianoOpen) return null;

  return (
    <div className="piano-ui">
      <div className="piano-head">
        <p className="piano-kicker">PIANO / XIA HOME</p>
        <p className="piano-hint">按 1—8 弹奏 · 也可以点琴键 · E 收起</p>
      </div>

      <div className="piano-keys" role="group" aria-label="钢琴键">
        {KEYS.map((item, index) => (
          <button
            key={item.key}
            type="button"
            className={`piano-key${active === index ? " is-active" : ""}`}
            onClick={() => handlers.onPianoKey(index)}
            title={`${item.note} · 键 ${item.key}`}
          >
            <span className="piano-note">{item.note}</span>
            <kbd>{item.key}</kbd>
          </button>
        ))}
      </div>

      <button className="piano-exit" type="button" onClick={handlers.onExitPiano}>
        收起 <kbd>E</kbd>
      </button>
    </div>
  );
}
