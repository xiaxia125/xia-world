export type SignalId = "interface" | "data" | "space" | "cross";

export type SignalCopy = {
  index: string;
  label: string;
  title: string;
  body: string;
  tags: readonly string[];
};

/**
 * Shared signal vocabulary keeps the rooftop constellation aligned without turning the world into a résumé.
 */
export const SIGNALS: Record<SignalId, SignalCopy> = {
  interface: {
    index: "01",
    label: "界面",
    title: "把复杂的界面变得清楚",
    body: "在 Vue、React 与 TypeScript 之间保持秩序，让操作顺着信息自然发生。",
    tags: ["Vue", "React", "TypeScript"],
  },
  data: {
    index: "02",
    label: "数据",
    title: "让信息在合适的尺度上被看懂",
    body: "从 ECharts、地图到可视化叙事，把密集的数据整理成可以继续追问的线索。",
    tags: ["ECharts", "地图", "可视化"],
  },
  space: {
    index: "03",
    label: "空间",
    title: "让信息拥有可以漫游的空间",
    body: "从三维场景到跨端体验，关注交互如何把静态内容变成可被发现的路径。",
    tags: ["Three.js", "空间", "交互"],
  },
  cross: {
    index: "04",
    label: "跨端",
    title: "让同一条信息继续工作",
    body: "在 H5、UniApp 与手机触控之间保持体验的连续，让入口不被设备切断。",
    tags: ["H5", "UniApp", "触控"],
  },
};
