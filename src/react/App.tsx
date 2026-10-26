import { useEffect, useState } from "react";
import "../style.css";
import { getEmailDisplay, getEmailHref, PROFILE } from "../profile";
import { WorldInterface } from "./WorldInterface";
import { ui } from "../ui";

/** Mounts the React shell before loading the imperative Three.js world. */
export function App() {
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    let disposeEngine: (() => void) | undefined;
    void import("../engine").then(({ boot }) => {
      if (active) disposeEngine = boot(() => setWebglUnavailable(true));
    });
    return () => {
      active = false;
      disposeEngine?.();
      ui.dispose();
    };
  }, []);

  if (webglUnavailable) {
    return (
      <section className="webgl-error" aria-labelledby="webgl-error-title">
        <div>
          <p className="eyebrow">WEBGL UNAVAILABLE</p>
          <h1 id="webgl-error-title">这个浏览器<br />暂时进不了 3D 世界。</h1>
          <p>你的设备或浏览器没有开启 WebGL。请换用支持 WebGL 的浏览器查看可交互职业档案。</p>
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
