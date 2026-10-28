/**
 * 程序化 BIM 建筑：数据是主体，几何只是数据的呈现。
 *
 * 这里产出的是一份真实的构件清单——每根柱、每片墙、每块板都有自己的 id、
 * 类型、楼层、尺寸和属性，和 IFC 解析出来的结构同构。将来把 public/models/bim.glb
 * 换成一个从 IFC 转出来的模型，也只需要换数据源，上面的构件树、点选、属性卡
 * 逻辑一行都不用改。
 */

/** 构件类型：决定它在构件树里归到哪个专业下。 */
export type BimElementType = "column" | "beam" | "slab" | "wall";

/** 一个构件。position 是几何中心，size 是三向尺寸（米）。 */
export interface BimElement {
  id: string;
  type: BimElementType;
  /** 楼层号，1 起。0 表示基础。 */
  floor: number;
  /** 构件名，属性卡第一行。 */
  name: string;
  position: [number, number, number];
  size: [number, number, number];
  /** 体积，立方米。构造时算好，属性卡直接用。 */
  volume: number;
  /** 构件底面标高（米），BIM 里最常被问的一个数。 */
  elevation: number;
  material: string;
}

/** 一栋楼的全部构件 + 楼层信息。 */
export interface BimBuilding {
  elements: BimElement[];
  /** 楼层号 → 该层标高（米），用于楼层切换条。 */ 
  floors: { floor: number; elevation: number; label: string }[];
  /** 整栋楼的包围盒，用于相机取景。 */
  bounds: { min: [number, number, number]; max: [number, number, number] };
}

const FLOOR_COUNT = 6;
const FLOOR_HEIGHT = 3.2;
/** 平面尺寸：12 m × 9 m，柱网 4 × 3，开间 4 m / 3 m。 */
const WIDTH = 12;
const DEPTH = 9;
const COLUMN = 0.45;
const SLAB = 0.24;
const BEAM_W = 0.32;
const BEAM_H = 0.5;
const WALL = 0.22;

const TYPE_LABEL: Record<BimElementType, string> = {
  column: "柱",
  beam: "梁",
  slab: "楼板",
  wall: "外墙",
};

const MATERIAL_OF: Record<BimElementType, string> = {
  column: "C40 混凝土",
  beam: "C35 混凝土",
  slab: "C30 混凝土",
  wall: "加气混凝土砌块",
};

/**
 * 生成一栋 6 层框架结构。
 *
 * 每层按「柱 → 梁 → 板 → 外墙」的顺序产出，和实际施工顺序一致；梁只在
 * 每层顶部一圈加两道次梁，不做密肋，控制三角面数量。
 */
export function buildProceduralBuilding(): BimBuilding {
  const elements: BimElement[] = [];
  const floors: BimBuilding["floors"] = [];

  // 柱网：x 方向 4 根、z 方向 3 根
  const xs = [-WIDTH / 2 + 1, -WIDTH / 6, WIDTH / 6, WIDTH / 2 - 1];
  const zs = [-DEPTH / 2 + 1, 0, DEPTH / 2 - 1];

  for (let f = 1; f <= FLOOR_COUNT; f += 1) {
    const base = (f - 1) * FLOOR_HEIGHT;
    floors.push({ floor: f, elevation: base, label: `${f}F` });

    // 柱：每层从本层地面到上层地面
    for (const x of xs) {
      for (const z of zs) {
        const h = FLOOR_HEIGHT;
        elements.push({
          id: `C-${f}-${xs.indexOf(x) + 1}${zs.indexOf(z) + 1}`,
          type: "column",
          floor: f,
          name: `框架柱 KZ-${f}-${xs.indexOf(x) + 1}${zs.indexOf(z) + 1}`,
          position: [x, base + h / 2, z],
          size: [COLUMN, h, COLUMN],
          volume: round3(COLUMN * COLUMN * h),
          elevation: base,
          material: MATERIAL_OF.column,
        });
      }
    }

    // 梁：本层顶面一圈外框 + 中间两道
    const topY = base + FLOOR_HEIGHT - BEAM_H / 2;
    const beamSpecs: { name: string; pos: [number, number, number]; size: [number, number, number] }[] = [];
    for (const z of zs) {
      beamSpecs.push({
        name: `框架梁 KL-${f}-X${zs.indexOf(z) + 1}`,
        pos: [0, topY, z],
        size: [WIDTH, BEAM_H, BEAM_W],
      });
    }
    for (const x of xs) {
      beamSpecs.push({
        name: `框架梁 KL-${f}-Y${xs.indexOf(x) + 1}`,
        pos: [x, topY, 0],
        size: [BEAM_W, BEAM_H, DEPTH],
      });
    }
    beamSpecs.forEach((spec, i) => {
      elements.push({
        id: `B-${f}-${i + 1}`,
        type: "beam",
        floor: f,
        name: spec.name,
        position: spec.pos,
        size: spec.size,
        volume: round3(spec.size[0] * spec.size[1] * spec.size[2]),
        elevation: round3(base + FLOOR_HEIGHT - BEAM_H),
        material: MATERIAL_OF.beam,
      });
    });

    // 楼板：一层一块，铺在梁顶
    const slabY = base + FLOOR_HEIGHT - BEAM_H - SLAB / 2;
    elements.push({
      id: `S-${f}-1`,
      type: "slab",
      floor: f,
      name: `${f}F 楼板 LB-${f}`,
      position: [0, slabY, 0],
      size: [WIDTH, SLAB, DEPTH],
      volume: round3(WIDTH * SLAB * DEPTH),
      elevation: round3(base + FLOOR_HEIGHT - BEAM_H - SLAB),
      material: MATERIAL_OF.slab,
    });

    // 外墙：四片，围在梁外侧，留出窗洞的观感靠半透明材质
    const wallH = FLOOR_HEIGHT - BEAM_H;
    const wallY = base + wallH / 2;
    const wallSpecs: { name: string; pos: [number, number, number]; size: [number, number, number] }[] = [
      { name: `外墙 WQ-${f}-N`, pos: [0, wallY, -DEPTH / 2], size: [WIDTH, wallH, WALL] },
      { name: `外墙 WQ-${f}-S`, pos: [0, wallY, DEPTH / 2], size: [WIDTH, wallH, WALL] },
      { name: `外墙 WQ-${f}-E`, pos: [WIDTH / 2, wallY, 0], size: [WALL, wallH, DEPTH] },
      { name: `外墙 WQ-${f}-W`, pos: [-WIDTH / 2, wallY, 0], size: [WALL, wallH, DEPTH] },
    ];
    wallSpecs.forEach((spec, i) => {
      elements.push({
        id: `W-${f}-${i + 1}`,
        type: "wall",
        floor: f,
        name: spec.name,
        position: spec.pos,
        size: spec.size,
        volume: round3(spec.size[0] * spec.size[1] * spec.size[2]),
        elevation: round3(base),
        material: MATERIAL_OF.wall,
      });
    });
  }

  // 屋顶女儿墙：让顶层收口，不额外算一层
  const roofY = FLOOR_COUNT * FLOOR_HEIGHT + 0.5;
  elements.push({
    id: "W-roof-1",
    type: "wall",
    floor: FLOOR_COUNT,
    name: "屋顶女儿墙",
    position: [0, roofY, 0],
    size: [WIDTH, 1, DEPTH],
    volume: round3(WIDTH * 1 * DEPTH * 0.04),
    elevation: round3(FLOOR_COUNT * FLOOR_HEIGHT),
    material: "钢筋混凝土",
  });

  return {
    elements,
    floors,
    bounds: {
      min: [-WIDTH / 2 - 1, -0.5, -DEPTH / 2 - 1],
      max: [WIDTH / 2 + 1, FLOOR_COUNT * FLOOR_HEIGHT + 1.6, DEPTH / 2 + 1],
    },
  };
}

/** 构件类型的中文名，构件树和属性卡共用。 */
export function typeLabel(type: BimElementType) {
  return TYPE_LABEL[type];
}

/** 按楼层分组，构件树用。 */
export function groupByFloor(elements: BimElement[]) {
  const map = new Map<number, BimElement[]>();
  for (const el of elements) {
    const list = map.get(el.floor);
    if (list) list.push(el);
    else map.set(el.floor, [el]);
  }
  return [...map.entries()].sort((a, b) => b[0] - a[0]);
}

/** 按类型分组，构件树的第二级。 */
export function groupByType(elements: BimElement[]) {
  const order: BimElementType[] = ["column", "wall", "beam", "slab"];
  const map = new Map<BimElementType, BimElement[]>();
  for (const el of elements) {
    const list = map.get(el.type);
    if (list) list.push(el);
    else map.set(el.type, [el]);
  }
  return order.filter((t) => map.has(t)).map((t) => [t, map.get(t)!] as const);
}

function round3(v: number) {
  return Math.round(v * 1000) / 1000;
}
