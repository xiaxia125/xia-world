/**
 * Public professional profile.
 *
 * Privacy boundary:
 * - Keep the public site focused on work, skills and education.
 * - Never add the private phone number, age, gender or political status here.
 * - The contact email is assembled at runtime so it is not copied into static HTML.
 * - Anything added to this file is intended to be readable by every visitor.
 */

export type ProfileTab = "overview" | "projects" | "experience" | "skills" | "contact";

export interface ProfileProject {
  slug: string;
  index: string;
  title: string;
  category: string;
  summary: string;
  highlights: readonly string[];
  stack: readonly string[];
}

export interface ProfileExperience {
  company: string;
  role: string;
  period: string;
  summary: string;
  highlights: string[];
}

export interface ProfileEducation {
  school: string;
  major: string;
  degree: string;
  period: string;
  /** 就读形式，如「非全日制」。与全职工作时间重叠的学历必须如实标注。 */
  mode?: string;
}

export interface ProfileSkillGroup {
  title: string;
  items: string[];
}

const EMAIL_USER = "xiazw888";
const EMAIL_DOMAIN = "163.com";

export const PROFILE = {
  name: "夏夏",
  latin: "XIA",
  role: "前端开发工程师",
  status: "求职中",
  years: "5 年",
  tagline: "把复杂业务，做成清楚、可靠的界面。",
  intro:
    "5 年前端开发经验，长期参与海洋监管、景区治理、数字生活与数据可视化项目。擅长 Vue / React / TypeScript，关注复杂信息的组织、地图可视化与跨端体验。",
  shortIntro:
    "5 年前端开发经验，专注复杂业务、数据可视化、地图与跨端体验。",
  target: "前端开发工程师",
  focus: ["复杂业务前端", "数据可视化", "地图 / 三维", "跨端小程序"],
  highlights: [
    "长期处理可视化驾驶舱、地图、视频监控与海量点位场景",
    "熟悉 Vue / React 技术栈与组件化、状态管理、接口联调",
    "有 UniApp / Taro 小程序、H5 与移动端适配经验",
    "关注真实性能瓶颈，习惯在业务迭代中持续优化体验",
  ],
  projects: [
    {
      slug: "maritime-dashboard",
      index: "01",
      title: "海洋监管综合管控平台",
      category: "数据可视化 / 地图 / 视频监控",
      summary:
        "面向海洋监管场景的多维可视化驾驶舱，融合海图、船舶点位、视频资源与实时预警信息。",
      highlights: [
        "可视化驾驶舱核心页面（海图、船舶点位、预警信息），用 ECharts + WebSocket 承载实时数据",
        "海康视频资源接入：RTSP 播放、多路切换与监控画面布局，值班人员在同一屏看到现场",
        "GeoServer 与海图服务融合，把地图、业务数据和监控资源放进同一空间，支持轨迹追踪与区域围栏",
        "海量点位渲染优化：点位聚合 + 分层加载，船舶与浮标点位随缩放级别稳定呈现",
      ],
      stack: ["Vue 3", "TypeScript", "ECharts", "GeoServer", "WebSocket", "H5 Player", "Vite"],
    },
    {
      slug: "scenic-dashboard",
      index: "02",
      title: "景区多维智治驾驶舱",
      category: "三维地图 / 数据大屏",
      summary:
        "整合倾斜摄影三维场景、视频资源与业务数据的景区治理驾驶舱，让分散信息在同一空间里被看见。",
      highlights: [
        "驾驶舱核心页面与 ECharts 统计指标，支撑大屏的实时数据展示",
        "Hmap 倾斜摄影模型加载，还原三维地图与码头环境",
        "多路视频接入、窗口切换与驾驶舱交互动画",
        "地图点位与图层的聚合、分层加载和渲染策略优化",
      ],
      stack: ["ECharts", "Hmap", "H5Player", "Animation", "三维地图"],
    },
    {
      slug: "island-life",
      index: "03",
      title: "海岛数字生活服务平台",
      category: "UniApp / 微信小程序",
      summary:
        "覆盖智慧停车、车船票、活动积分、线上商城与共享球场的本地数字生活服务小程序。",
      highlights: [
        "UniApp + Vue 搭建小程序架构，覆盖智慧停车、车船票、活动积分、线上商城与共享球场五类业务",
        "封装 Axios 请求、鉴权与异常处理，让各业务模块共用一套数据流",
        "集成腾讯地图、二维码、微信支付与自定义分享",
        "UCharts 呈现潮汐、天气数据，完成多业务场景适配",
      ],
      stack: ["UniApp", "Vue", "Vuex", "Axios", "UCharts", "腾讯地图", "微信支付"],
    },
    {
      slug: "knowledge-graph",
      index: "04",
      title: "知识图谱可视化平台",
      category: "图谱 / 数据关系",
      summary:
        "面向实体关系分析的可视化平台，支持知识图谱查询、关系展开与第三方系统集成。",
      highlights: [
        "AntV G6 实现实体节点、关系连线与图谱交互",
        "节点展开、关系查看、缩放拖拽与条件查询结果展示",
        "通过 iframe 把图谱能力嵌入其他业务平台，实现跨系统复用",
        "用 patch-package 维护第三方依赖补丁，降低版本升级成本",
      ],
      stack: ["Vue 3", "AntV G6", "relation-graph", "patch-package"],
    },
  ],
  moreProjects: [
    {
      title: "交通信号可视化编辑器",
      detail: "基于 ZRender 实现相位、周期、相位差与绿波带的图形化配置，使用 Vue 3 + Pinia 管理路网状态。",
      stack: "Vue 3 · Pinia · ZRender · TypeScript",
    },
    {
      title: "数据智能应用系统",
      detail: "负责业务组件化、ECharts 多维可视化、复杂表格与敏感数据脱敏展示。",
      stack: "Vue 3 · ECharts · VXE-Table · TypeScript",
    },
    {
      title: "惠残辅具租赁服务平台",
      detail: "基于 UniApp + Vue 2 完成辅具二维码全生命周期、租赁点位地图与线上租赁流程。",
      stack: "UniApp · Vue 2 · 腾讯地图 · QRCode",
    },
  ],
  experience: [
    {
      company: "浙江海莱云智科技有限公司",
      role: "前端开发工程师",
      period: "2021.11 — 2026.06",
      summary:
        "面向海洋监管、景区治理、数字民生与知识图谱等业务，负责中大型项目的前端开发与持续迭代。",
      highlights: [
        "负责可视化驾驶舱、地图、视频监控、小程序和数据平台等核心页面与模块",
        "参与项目架构、通用组件封装、接口联调与性能优化",
        "在多个业务域中处理复杂数据展示、跨端适配与交互体验问题",
      ],
    },
    {
      company: "郑州格物至微科技有限公司",
      role: "前端开发工程师",
      period: "2021.04 — 2021.09",
      summary: "参与前端业务页面开发与组件实现。",
      highlights: ["完成业务页面、接口联调和交互实现，建立组件化开发习惯。"],
    },
  ],
  education: [
    {
      school: "河南大学",
      major: "计算机科学与技术",
      degree: "本科",
      period: "2024.03 — 2026.07",
      mode: "非全日制（在职期间就读）",
    },
    {
      school: "黄河水利职业技术学院",
      major: "计算机应用与技术",
      degree: "专科",
      period: "2017.09 — 2020.07",
    },
    // 标注类型：否则 as const 会让「有 mode」与「没 mode」成为两个不兼容的字面量分支。
  ] as readonly ProfileEducation[],
  skillGroups: [
    {
      title: "前端基础",
      items: ["HTML5", "CSS3", "JavaScript (ES6+)", "TypeScript", "响应式布局"],
    },
    {
      title: "框架与状态",
      items: ["Vue 2 / 3", "React", "Pinia / Vuex", "组件化", "接口联调"],
    },
    {
      title: "跨端开发",
      items: ["UniApp", "Taro", "微信小程序", "H5", "移动端适配"],
    },
    {
      title: "可视化 / 地图",
      items: ["ECharts", "AntV G6", "Leaflet", "OpenLayers", "BMap", "GeoServer", "Hmap"],
    },
    {
      title: "UI / 工程化",
      items: ["Tailwind CSS", "Sass / SCSS", "PostCSS", "Vite", "Webpack", "性能优化"],
    },
    {
      title: "辅助能力",
      items: ["Node.js 基础", "Three.js", "Axios", "WebSocket", "Web 视频播放", "AI 辅助开发"],
    },
  ],
  aiTools: ["Cursor", "Windsurf", "Claude", "Codex", "Antigravity"],
  principles: [
    "先把信息结构理清，再决定界面形态。",
    "复杂交互拆成可维护的组件和状态。",
    "性能优化从真实瓶颈出发，而不是堆叠参数。",
    "跨端不是缩小页面，而是保持核心路径连续。",
  ],
  contact: {
    emailUser: EMAIL_USER,
    emailDomain: EMAIL_DOMAIN,
    label: "邮箱联系",
    github: "https://github.com/xiaxia125",
    githubRepo: "https://github.com/xiaxia125/xia-world",
    note: "公开版档案仅提供邮箱与 GitHub。手机号、年龄、性别、政治面貌等私人信息不对外展示。",
  },
} as const;

export function getEmailAddress() {
  return `${PROFILE.contact.emailUser}@${PROFILE.contact.emailDomain}`;
}

export function getEmailDisplay() {
  return getEmailAddress();
}

export function getEmailHref() {
  const subject = encodeURIComponent("前端开发工程师岗位沟通");
  return `mailto:${getEmailAddress()}?subject=${subject}`;
}
