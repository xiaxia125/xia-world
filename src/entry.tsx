import { inject } from "@vercel/analytics";
import { createRoot } from "react-dom/client";
import { App } from "./react/App";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing React root element");
}

createRoot(rootElement).render(<App />);

// 用非 React 的 inject()，避开 react 入口在 dev 下与项目自身 React 副本冲突（Invalid hook call）。
// mode 默认 auto：只有部署在 Vercel 生产环境才真的上报，本地开发不发请求。
inject();
