import type { UISnapshot } from "../../ui";
import { ui } from "../../ui";

type KeyRow = { keys: string[]; label: string };

/** 三组说明：先讲怎么走，再讲能做什么，最后只提彩蛋存在，不剧透内容。 */
const GROUPS: Array<{ id: string; kicker: string; title: string; rows: KeyRow[] }> = [
  {
    id: "move",
    kicker: "01 / MOVE",
    title: "移动",
    rows: [
      { keys: ["W", "A", "S", "D"], label: "在岛上漫游" },
      { keys: ["SHIFT"], label: "按住奔跑" },
      { keys: ["SPACE"], label: "跳跃" },
      { keys: ["MOUSE"], label: "转动视角" },
    ],
  },
  {
    id: "explore",
    kicker: "02 / EXPLORE",
    title: "探索",
    rows: [
      { keys: ["E"], label: "和眼前的东西互动" },
      { keys: ["P"], label: "打开职业档案" },
      { keys: ["N"], label: "查看岛屿地图" },
      { keys: ["R"], label: "切换天气" },
      { keys: ["M"], label: "开关背景音乐" },
      { keys: ["H"], label: "打开这份说明" },
      { keys: ["ESC"], label: "释放鼠标" },
    ],
  },
];

/** 触屏下换成手势说明，键位那套在手机上按不出来。 */
const TOUCH_GROUPS: typeof GROUPS = [
  {
    id: "move",
    kicker: "01 / MOVE",
    title: "移动",
    rows: [
      { keys: ["左摇杆"], label: "拖动行走" },
      { keys: ["右半屏"], label: "滑动转视角" },
      { keys: ["↑"], label: "跳跃" },
    ],
  },
  {
    id: "explore",
    kicker: "02 / EXPLORE",
    title: "探索",
    rows: [
      { keys: ["E"], label: "和眼前的东西互动" },
      { keys: ["CV"], label: "打开职业档案" },
      { keys: ["▦"], label: "查看岛屿地图" },
    ],
  },
];

/** 触屏与否决定展示键位还是手势，查一次就够，不必每帧重算。 */
const IS_TOUCH =
  window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

/**
 * 操作说明面板：右侧滑入，和设置面板同一套面板语言，但只读——没有任何控件需要操作，
 * 所以整块是 aria 说明区，关闭靠 H / Esc / 右上角按钮。
 */
export function HelpPanel({ snapshot }: { snapshot: UISnapshot }) {
  const groups = IS_TOUCH ? TOUCH_GROUPS : GROUPS;

  return (
    <aside
      id="help"
      className={`help${snapshot.helpOpen ? "" : " is-hidden"}`}
      aria-label="操作说明"
      aria-hidden={!snapshot.helpOpen}
      inert={!snapshot.helpOpen}
    >
      <div className="help-head">
        <div>
          <span className="help-kicker">HOW TO PLAY</span>
          <h2>这座岛怎么玩</h2>
        </div>
        <button
          id="help-close"
          className="icon-button"
          type="button"
          aria-label="关闭操作说明"
          onClick={() => ui.closeHelp()}
        >
          ×
        </button>
      </div>

      <div className="help-body">
        {groups.map((group) => (
          <section key={group.id} className="help-group" aria-labelledby={`help-${group.id}`}>
            <p className="help-group-kicker">{group.kicker}</p>
            <h3 id={`help-${group.id}`}>{group.title}</h3>
            <dl className="help-rows">
              {group.rows.map((row) => (
                <div key={row.label} className="help-row">
                  <dt>
                    {row.keys.map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </dt>
                  <dd>{row.label}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <section className="help-group" aria-labelledby="help-eggs">
          <p className="help-group-kicker">03 / HIDDEN</p>
          <h3 id="help-eggs">还有</h3>
          <p className="help-note">
            这座岛上藏着 5 处可以收集的彩蛋，散在球场、天台、书房和池塘之间。
            走近有反应的东西，按 <kbd>E</kbd> 试试。
          </p>
          <p className="help-note">
            地图上有 11 个分区。第一次走进一个区域会自动盖一枚访客印章，
            集齐后可以在广场的地图牌前对一遍。
          </p>
          <p className="help-note help-note-quiet">
            彩蛋进度 <span className="help-count">{snapshot.eggCount}/{snapshot.eggTotal}</span>
            <span className="help-count-sep">·</span>
            印章 <span className="help-count">{snapshot.stamps.length}/11</span>
          </p>
        </section>
      </div>

      <div className="help-foot">
        <button className="mini-button" type="button" onClick={() => ui.closeHelp()}>
          回到世界
        </button>
        <span className="help-foot-hint">
          <kbd>H</kbd> 或 <kbd>Esc</kbd> 关闭
        </span>
      </div>
    </aside>
  );
}
