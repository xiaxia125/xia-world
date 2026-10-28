/**
 * 数据源：优先读 public/models/bim.glb，没有就回退到程序化建筑。
 *
 * 先发一个 HEAD 请求探一下，200 才走 GLTFLoader——这样以后拿到真的 IFC 转出来的
 * 模型，丢个文件进 public/models/ 就自动切过去，不用改代码；没有文件时也不会
 * 在控制台留一条 404 红字。
 *
 * glb 里读出来的构件按 mesh 拆：每个 mesh 算一个构件，包围盒算尺寸和标高，
 * 名字取 mesh.name。这样即使模型不是我们生成的，构件树和属性卡照样有内容。
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { BimBuilding, BimElement, BimElementType } from "./building";

/** 模型路径。用 BASE_URL 拼，部署到子路径也能读到。 */
const MODEL_URL = `${import.meta.env.BASE_URL}models/bim.glb`;

/** 加载结果：数据 + 可选的原始场景（glb 模式才有时有）。 */
export interface BimSource {
  building: BimBuilding;
  /** glb 加载出来的原始对象，渲染时直接用它，不再按构件重建。 */
  model?: THREE.Object3D;
  /** 数据来源，UI 上标注用。 */
  origin: "glb" | "procedural";
  /** glb 读取失败的原因（回退时保留，便于排查）。 */
  note?: string;
}

/**
 * 探测并加载数据源。
 *
 * @param onProgress 0..1 的进度回调，用于加载条
 */
export async function loadBimSource(onProgress?: (value: number) => void): Promise<BimSource> {
  onProgress?.(0.05);
  const exists = await hasModel();
  onProgress?.(0.25);

  if (exists) {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(MODEL_URL);
      onProgress?.(0.9);
      const building = buildingFromGltf(gltf.scene);
      onProgress?.(1);
      return { building, model: gltf.scene, origin: "glb" };
    } catch (err) {
      // 文件在但读不出来（格式坏、缺 Draco 解码器）时也回退，别把页面卡死
      const { buildProceduralBuilding } = await import("./building");
      onProgress?.(1);
      return {
        building: buildProceduralBuilding(),
        origin: "procedural",
        note: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const { buildProceduralBuilding } = await import("./building");
  onProgress?.(1);
  return { building: buildProceduralBuilding(), origin: "procedural" };
}

/**
 * 探测模型文件是否存在。任何异常都当没有。
 *
 * 用带 Range 的 GET 而不是 HEAD：HEAD 没有响应体，Chrome 在 Vite dev server
 * 这类连接上会把它取消掉，Network 面板里留下一条 net::ERR_ABORTED 红字——
 * 每次进 BIM 都刷一条，看起来像功能坏了。Range GET 只取前 1 KB，代价可以忽略。
 *
 * 只认状态码不够：SPA 的 history fallback 对不存在的路径也回 200 + index.html，
 * 所以还要看 content-type 不是 text/html。
 */
async function hasModel() {
  try {
    const res = await fetch(MODEL_URL, { headers: { Range: "bytes=0-1023" } });
    if (!res.ok) return false;
    const type = res.headers.get("content-type") ?? "";
    return !type.includes("text/html");
  } catch {
    return false;
  }
}

/**
 * 把 glb 场景摊成构件清单。
 *
 * 每个带几何的 mesh 算一个构件；几何中心取世界坐标下的包围盒中心，尺寸取
 * 包围盒尺寸。柱子、梁这类细长构件靠长宽比猜类型——只用于分类展示，
 * 不影响点选和属性。
 */
function buildingFromGltf(scene: THREE.Object3D): BimBuilding {
  scene.updateMatrixWorld(true);
  const elements: BimElement[] = [];
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  const overall = new THREE.Box3();

  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || !obj.geometry) return;
    obj.geometry.computeBoundingBox();
    box.copy(obj.geometry.boundingBox!).applyMatrix4(obj.matrixWorld);
    box.getSize(size);
    box.getCenter(center);
    overall.union(box);

    const type = guessType(size);
    const floor = Math.max(1, Math.round(center.y / 3.2) || 1);
    elements.push({
      id: obj.name || `M-${elements.length + 1}`,
      type,
      floor,
      name: obj.name || `构件 ${elements.length + 1}`,
      position: [center.x, center.y, center.z],
      size: [size.x, size.y, size.z],
      volume: Math.round(size.x * size.y * size.z * 1000) / 1000,
      elevation: Math.round((center.y - size.y / 2) * 1000) / 1000,
      material: "模型自带材质",
    });
  });

  // 楼层按实际标高归并，避免出现空楼层
  const floorMap = new Map<number, number>();
  for (const el of elements) {
    if (!floorMap.has(el.floor)) floorMap.set(el.floor, el.elevation);
  }
  const floors = [...floorMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([floor, elevation]) => ({ floor, elevation, label: `${floor}F` }));

  if (!overall.isEmpty()) {
    return {
      elements,
      floors,
      bounds: {
        min: [overall.min.x, overall.min.y, overall.min.z],
        max: [overall.max.x, overall.max.y, overall.max.z],
      },
    };
  }

  // 模型里没有任何网格：给一个最小包围盒，别让相机算出一个 NaN
  return {
    elements,
    floors,
    bounds: { min: [-6, 0, -6], max: [6, 12, 6] },
  };
}

/** 按包围盒长宽比猜构件类型，只影响分类展示。 */
function guessType(size: THREE.Vector3): BimElementType {
  const dims = [size.x, size.y, size.z].sort((a, b) => b - a);
  const [longest, mid, shortest] = dims;
  if (shortest / longest < 0.08 && mid / longest < 0.2) return "wall";
  if (mid / longest < 0.35 && mid / longest > 0.08) return "beam";
  if (longest / Math.max(shortest, 0.001) > 4) return "column";
  if (longest / Math.max(shortest, 0.001) < 1.6) return "slab";
  return "wall";
}
