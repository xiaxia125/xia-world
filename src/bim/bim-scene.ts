/**
 * BIM 查看器的三维部分：独立 scene + 自己的相机 + OrbitControls。
 *
 * 和主世界共用同一个 renderer，进出时不重建 WebGL 上下文——重建才是显存
 * 持续上涨的来源。退出时调 dispose() 把这一套几何、材质、纹理全部释放。
 *
 * 几何按「楼层 + 类型」分组成 InstancedMesh：一个 InstancedMesh 不能单独隐藏
 * 某个实例，所以楼层切片只能靠分组 + 切 visible 实现；6 层 × 4 类最多 24 个
 * draw call，实际一层只有 4 类，全部可见时也在预算内。
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { BimBuilding, BimElement, BimElementType } from "./building";

/** 每个类型一个材质，颜色区分专业。 */
const TYPE_COLOR: Record<BimElementType, number> = {
  column: 0xd8ff5f,
  wall: 0x7fb6c9,
  beam: 0xff8a4c,
  slab: 0x9aa4a8,
};

const HIGHLIGHT = 0xfff4a3;

/** 一组同楼层同类型的构件，一个 InstancedMesh。 */
interface InstanceGroup {
  mesh: THREE.InstancedMesh;
  elements: BimElement[];
  type: BimElementType;
  floor: number;
  /** 该组的基础色，取消高亮时恢复。 */
  baseColor: THREE.Color;
}

export interface BimSceneHandle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  /** 场景里的建筑分组，dispose 时要整体释放。 */
  root: THREE.Group;
  /** 画布上的 DOM 事件目标（renderer 的 canvas）。 */
  attach: (canvas: HTMLCanvasElement) => void;
  detach: () => void;
  /** 只显示某一层；null 表示全部显示。 */
  showFloor: (floor: number | null) => void;
  /** 当前显示的楼层，null 表示全部。 */
  readonly visibleFloor: number | null;
  /** 射线拾取：返回命中的构件，没命中返回 null。 */
  pick: (clientX: number, clientY: number) => BimElement | null;
  /** 高亮某个构件；传 null 取消。 */
  highlight: (id: string | null) => void;
  /** 当前高亮的构件 id。 */
  readonly highlighted: string | null;
  resize: (width: number, height: number) => void;
  render: () => void;
  dispose: () => void;
  /** 构件总数与 draw call 数，验收时读。 */
  readonly stats: { elements: number; drawCalls: number };
}

/**
 * 建好场景并返回操作句柄。
 *
 * @param building 构件数据（程序化生成或从 glb 读出的都行）
 * @param canvas 主 renderer 的 canvas，事件绑在它上面
 */
export function createBimScene(building: BimBuilding, canvas: HTMLCanvasElement): BimSceneHandle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1210);
  scene.fog = new THREE.Fog(0x0a1210, 40, 90);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 300);
  const center = new THREE.Vector3(
    (building.bounds.min[0] + building.bounds.max[0]) / 2,
    (building.bounds.min[1] + building.bounds.max[1]) / 2,
    (building.bounds.min[2] + building.bounds.max[2]) / 2,
  );
  camera.position.set(center.x + 20, center.y + 14, center.z + 22);
  camera.lookAt(center);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(center);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  // 右键平移、滚轮缩放、左键旋转——三个操作都是 OrbitControls 的默认行为，
  // 这里只把边界收住，避免转到地下或飞太远。
  controls.minDistance = 8;
  controls.maxDistance = 70;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.update();

  // 灯光：一盏顶光 + 一盏侧补光，够看清构件层次，不做阴影
  const hemi = new THREE.HemisphereLight(0xdfe9ff, 0x1a2620, 1.15);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(18, 30, 16);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fe6ff, 0.7);
  rim.position.set(-16, 12, -18);
  scene.add(rim);

  const root = new THREE.Group();
  scene.add(root);

  // 地面网格：给一个尺度参照，读起来像在看模型而不是悬空方块
  const grid = new THREE.GridHelper(48, 24, 0x2f4a44, 0x1b2b28);
  grid.position.y = -0.02;
  root.add(grid);

  // 按楼层 + 类型分组建 InstancedMesh
  const groups: InstanceGroup[] = [];
  const byKey = new Map<string, BimElement[]>();
  for (const el of building.elements) {
    const k = `${el.floor}:${el.type}`;
    const list = byKey.get(k);
    if (list) list.push(el);
    else byKey.set(k, [el]);
  }

  const dummy = new THREE.Object3D();
  for (const [key, list] of byKey) {
    const [floorStr, type] = key.split(":") as [string, BimElementType];
    const color = TYPE_COLOR[type];
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.62,
      metalness: 0.06,
      // 外墙半透明，能看见里面的柱和梁——这正是 BIM 查看器该有的读法
      transparent: type === "wall",
      opacity: type === "wall" ? 0.38 : 1,
      side: THREE.DoubleSide,
    });
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(geo, material, list.length);
    mesh.name = `bim-${floorStr}-${type}`;
    list.forEach((el, i) => {
      dummy.position.set(...el.position);
      dummy.scale.set(...el.size);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    root.add(mesh);
    groups.push({
      mesh,
      elements: list,
      type,
      floor: Number(floorStr),
      baseColor: new THREE.Color(color),
    });
  }

  // ------------------------------------------------------------ 拾取

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let visibleFloor: number | null = null;
  let highlighted: string | null = null;

  /** 按当前可见性过滤：被切掉的楼层不参与拾取。 */
  const activeMeshes = () =>
    groups.filter((g) => visibleFloor === null || g.floor === visibleFloor).map((g) => g.mesh);

  const pick = (clientX: number, clientY: number): BimElement | null => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(activeMeshes(), false);
    if (hits.length === 0) return null;
    const hit = hits[0];
    const mesh = hit.object as THREE.InstancedMesh;
    const group = groups.find((g) => g.mesh === mesh);
    if (!group || hit.instanceId === undefined) return null;
    return group.elements[hit.instanceId] ?? null;
  };

  const highlight = (id: string | null) => {
    highlighted = id;
    const tmp = new THREE.Color();
    for (const g of groups) {
      let dirty = false;
      g.elements.forEach((el, i) => {
        tmp.copy(el.id === id ? new THREE.Color(HIGHLIGHT) : g.baseColor);
        // 外墙保持半透明，其余不透明；高亮时都拉满，让被选中的构件最显眼
        g.mesh.setColorAt(i, tmp);
        dirty = true;
      });
      if (dirty && g.mesh.instanceColor) g.mesh.instanceColor.needsUpdate = true;
    }
  };

  const showFloor = (floor: number | null) => {
    visibleFloor = floor;
    for (const g of groups) g.mesh.visible = floor === null || g.floor === floor;
  };

  const render = () => {
    controls.update();
    // 用主 renderer 画这个 scene，所以这里只做相机与场景的更新，
    // 真正的 renderer.render 由 engine 的循环调用。
  };

  const resize = (width: number, height: number) => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const detachFns: (() => void)[] = [];
  const attach = (el: HTMLCanvasElement) => {
    // OrbitControls 已经在构造时绑好；这里补一层「点选」与「右键不弹菜单」
    const onContext = (e: MouseEvent) => e.preventDefault();
    el.addEventListener("contextmenu", onContext);
    detachFns.push(() => el.removeEventListener("contextmenu", onContext));
  };
  const detach = () => {
    while (detachFns.length) detachFns.pop()?.();
  };

  const dispose = () => {
    detach();
    controls.dispose();
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });
    if (grid.geometry) grid.geometry.dispose();
    if (grid.material) {
      const mats = Array.isArray(grid.material) ? grid.material : [grid.material];
      for (const m of mats) m.dispose();
    }
    root.clear();
    scene.clear();
  };

  return {
    scene,
    camera,
    controls,
    root,
    attach,
    detach,
    showFloor,
    get visibleFloor() {
      return visibleFloor;
    },
    pick,
    highlight,
    get highlighted() {
      return highlighted;
    },
    resize,
    render,
    dispose,
    stats: { elements: building.elements.length, drawCalls: groups.length + 1 },
  };
}
