import { useEffect, useState, useSyncExternalStore } from "react";
import "../css/base.css";
import "../css/world.css";
import "../css/panels.css";
import "../css/fallback.css";
import { getEmailDisplay, getEmailHref, PROFILE } from "../profile";
import { WorldInterface } from "./WorldInterface";
import { ProfilePanel } from "./components/ProfilePanel";
import { ui } from "../ui";

/** Mounts the React shell before loading the imperative Three.js world. */
export function App() {
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [bootFailed, setBootFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let disposeEngine: (() => void) | undefined;
    void import("../engine")
      .then(({ boot }) => {
        if (active) disposeEngine = boot(() => setWebglUnavailable(true));
      })
      .catch(() => {
        // WebGL 检测通过但引擎初始化抛错时，不能让开始页永远停在加载中。
        if (active) setBootFailed(true);
      });
    return () => {
      active = false;
      disposeEngine?.();
      ui.dispose();
    };
  }, []);

  if (webglUnavailable || bootFailed) {
    return <ErrorScreen bootFailed={bootFailed} />;
  }

  return (
    <>
      <canvas id="scene" tabIndex={-1} aria-label="三维世界画布" />
      <WorldInterface />
    </>
  );
}

/** 3D 世界起不来时的兜底页：职业档案仍然可以独立打开阅读。 */
function ErrorScreen({ bootFailed }: { bootFailed: boolean }) {
  // 只在这个兜底页订阅快照，正常路径下 App 不跟着 HUD 时钟重渲染。
  const snapshot = useSyncExternalStore(ui.subscribe, ui.getSnapshot, ui.getSnapshot);

  return (
    <>
      <section
        className="webgl-error"
        aria-labelledby="webgl-error-title"
        inert={snapshot.profileOpen}
      >
        <div>
          <p className="eyebrow">{bootFailed ? "LOADING ERROR" : "WEBGL UNAVAILABLE"}</p>
          <h1 id="webgl-error-title">
            {bootFailed ? "世界初始化失败了。" : <>这个浏览器<br />暂时进不了 3D 世界。</>}
          </h1>
          <p>
            {bootFailed
              ? "页面资源加载或初始化出了问题，刷新一次通常可以解决；仍不行请换用桌面版 Chrome 或 Edge 打开。"
              : "你的设备或浏览器没有开启 WebGL。请换用支持 WebGL 的浏览器查看可交互职业档案。"}
          </p>
          <p style={{ marginTop: 24 }}>{PROFILE.shortIntro}</p>
          <div className="webgl-error-actions">
            <button
              className="btn-primary"
              type="button"
              onClick={() => ui.openProfile("overview")}
            >
              <span>先看职业档案</span>
              <span className="btn-arrow" aria-hidden="true">→</span>
            </button>
            <p>
              邮箱：<a href={getEmailHref()}>{getEmailDisplay()}</a>
            </p>
          </div>
        </div>
      </section>
      <ProfilePanel snapshot={snapshot} closeLabel="返回" />
    </>
  );
}
