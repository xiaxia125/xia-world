/**
 * 岛屿分区表：3D 地图牌、DOM 地图面板和「访客印章」共用同一份数据。
 *
 * 坐标系与世界一致（x 向东，z 向南），范围与树篱一致：±50。伸进树篱以外的
 * 山丘不参与分区。分区之间允许轻微重叠，`zoneAt` 按数组顺序取第一个命中，
 * 所以更具体的区域（密室、天台）要排在它们的父区域（工作室）前面。
 */
export interface WorldZone {
  id: string;
  index: string;
  name: string;
  subtitle: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** 可选的高度范围，用来区分同一块平面上的天台与工作室。 */
  minY?: number;
  maxY?: number;
  /** 地图上的强调色。 */
  color: string;
}

export const WORLD_BOUNDS = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 } as const;

export const ZONES: readonly WorldZone[] = [
  {
    id: "secret",
    index: "04",
    name: "书架密室",
    subtitle: "留言与终端",
    x0: 0.8,
    x1: 9.2,
    z0: -38.2,
    z1: -30.9,
    maxY: 6.2,
    color: "#7dffb0",
  },
  {
    id: "roof",
    index: "07",
    name: "天台",
    subtitle: "电台 / 望远镜 / 星空",
    x0: -10.4,
    x1: 10.4,
    z0: -31.4,
    z1: -16.6,
    minY: 6.8,
    color: "#9fe6ff",
  },
  {
    id: "studio",
    index: "03",
    name: "工作室",
    subtitle: "电脑 / 海报 / 书架",
    x0: -10.6,
    x1: 10.6,
    z0: -31.6,
    z1: -16.4,
    maxY: 7,
    color: "#d8ff5f",
  },
  {
    id: "gallery",
    index: "02",
    name: "项目展厅",
    subtitle: "三块项目屏",
    x0: -36.6,
    x1: -16.4,
    z0: -5.6,
    z1: 9.6,
    color: "#ff8a4c",
  },
  {
    id: "court",
    index: "05",
    name: "篮球场",
    subtitle: "投篮 / 夜间灯光",
    x0: 15.6,
    x1: 36.4,
    z0: -5.4,
    z1: 9.4,
    color: "#f3a35c",
  },
  {
    id: "pond",
    index: "06",
    name: "池塘",
    subtitle: "鸭子 / 鱼 / 码头",
    x0: 15.8,
    x1: 28.8,
    z0: 19.8,
    z1: 29.2,
    color: "#4f9bb5",
  },
  {
    id: "camp",
    index: "09",
    name: "篝火营地",
    subtitle: "烤火 / 帐篷 / 小船",
    x0: 29,
    x1: 45,
    z0: 10,
    z1: 26,
    color: "#ff6d8a",
  },
  {
    id: "trail",
    index: "08",
    name: "五年小径",
    subtitle: "2021 → NOW",
    x0: -42.5,
    x1: -12.6,
    z0: 12,
    z1: 36,
    color: "#e5c07b",
  },
  {
    id: "windmill",
    index: "10",
    name: "风车与菜园",
    subtitle: "风 / 雨水 / 作物",
    x0: 22,
    x1: 44,
    z0: -36,
    z1: -17,
    color: "#6aa558",
  },
  {
    id: "lookout",
    index: "11",
    name: "观景台",
    subtitle: "拍照点",
    x0: -46,
    x1: -26,
    z0: -40,
    z1: -18,
    color: "#c5bead",
  },
  {
    id: "plaza",
    index: "01",
    name: "广场",
    subtitle: "喷泉 / 档案屏 / 地图",
    x0: -13.4,
    x1: 13.4,
    z0: -13.4,
    z1: 13.4,
    color: "#a89f8b",
  },
] as const;

/** 找一个位置所属的分区；高度不满足时（例如站在天台），跳过下面的房间。 */
export function zoneAt(x: number, y: number, z: number): WorldZone | null {
  for (const zone of ZONES) {
    if (x < zone.x0 || x > zone.x1 || z < zone.z0 || z > zone.z1) continue;
    if (zone.minY !== undefined && y < zone.minY) continue;
    if (zone.maxY !== undefined && y > zone.maxY) continue;
    return zone;
  }
  return null;
}

/** 把世界坐标折算成地图面板里的百分比位置。 */
export function zoneBox(zone: WorldZone) {
  const width = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
  const depth = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ;
  return {
    left: `${((zone.x0 - WORLD_BOUNDS.minX) / width) * 100}%`,
    top: `${((zone.z0 - WORLD_BOUNDS.minZ) / depth) * 100}%`,
    width: `${((zone.x1 - zone.x0) / width) * 100}%`,
    height: `${((zone.z1 - zone.z0) / depth) * 100}%`,
  };
}

/** 地图上不重复画出来的区域（天台画在工作室上面，只作为内嵌小框）。 */
export const MAP_ZONE_ORDER = [
  "plaza",
  "gallery",
  "studio",
  "roof",
  "court",
  "pond",
  "trail",
  "camp",
  "windmill",
  "lookout",
  "secret",
] as const;
