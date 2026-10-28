import { useEffect, useState } from "react";
import "../style.css";
import { getEmailDisplay, getEmailHref, PROFILE } from "../profile";
import { WorldInterface } from "./WorldInterface";
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
    return (
      <section className="webgl-error" aria-labelledby="webgl-error-title">
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
          <p style={{ marginTop: 16 }}>
            邮箱：<a href={getEmailHref()}>{getEmailDisplay()}</a>
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <canvas id="scene" tabIndex={-1} aria-label="三维世界画布" />
      <WorldInterface />
    </>
  );
}
