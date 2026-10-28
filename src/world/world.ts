import * as THREE from "three";
import { PROFILE } from "../profile";
import { SIGNALS, type SignalCopy, type SignalId } from "../signals";
import type { AABB, Interactable, Quality, ShelterZone } from "./types";
/**
 * Builds the walkable Three.js scene and exposes its colliders and interactable surfaces.
 * React owns the surrounding controls; this module keeps world state and rendering-side resources together.
 */
import {
  arcadeTexture,
  ballTexture,
  cinemaTexture,
  floorSignTexture,
  neonTexture,
  posterTexture,
  profileBoardTexture,
  projectTexture,
  puddleMaskTexture,
  radialTexture,
  screenTexture,
  radioTunerTexture,
  secretTexture,
  signalTexture,
  signTexture,
} from "./textures";

const C = {
  grass: 0x6f9f5a,
  grassDark: 0x5b884a,
  grassLight: 0x82ad68,
  path: 0xc4bba6,
  pathDark: 0x9d947f,
  plaza: 0xd0c7b2,
  plazaDark: 0xa89f8b,
  stone: 0x8f9288,
  stoneDark: 0x6b7068,
  wood: 0x8b5a3c,
  woodDark: 0x5a3823,
  woodLight: 0xb17850,
  wall: 0xd9d2c2,
  wallSide: 0xc5bead,
  wallDark: 0xa9a292,
  roof: 0x6b6f62,
  metal: 0x3d4547,
  metalLight: 0x6f7a78,
  orange: 0xff8a4c,
  lime: 0xd8ff5f,
  court: 0x3f7a68,
  courtDark: 0x26574b,
  courtLine: 0xe9f1dc,
  water: 0x4f9bb5,
  leaf: 0x4f8a45,
  leafDark: 0x3d7038,
  leafLight: 0x6aa558,
  soil: 0x5b4633,
  flowerA: 0xf3a35c,
  flowerB: 0xf3e6a5,
  flowerC: 0xd66b7a,
  glass: 0x9ec9cf,
  black: 0x1a201e,
  white: 0xece8dc,
  red: 0xb94f45,
};

interface SignalSurface {
  material: THREE.MeshBasicMaterial;
  base: THREE.Texture;
  detail: THREE.CanvasTexture;
  open: boolean;
}

interface SignalConstellationStar {
  object: THREE.Group;
  core: THREE.Mesh;
  halo: THREE.Mesh;
  interactable: Interactable;
  phase: number;
}

interface BoxSpec {
  cx: number;
  cy: number;
  cz: number;
  w: number;
  h: number;
  d: number;
  color: number;
  edge: boolean;
  solid: boolean;
  tag?: string;
}

export interface WorldOptions {
  quality: Quality;
  reducedMotion: boolean;
  onScore?: (score: number) => void;
  onCourtLit?: () => void;
  onSecret?: () => void;
}

export class VoxelWorld {
  readonly group = new THREE.Group();
  readonly colliders: AABB[] = [];
  readonly interactables: Interactable[] = [];
  readonly spawn = new THREE.Vector3(0, 0.4, 30);
  readonly spawnYaw = 0;

  /** Roof footprints used by the weather system to keep rain and snow outside. */
  readonly shelterZones: ShelterZone[] = [
    { minX: -10.3, maxX: 10.3, minZ: -31.3, maxZ: -16.7, roofY: 7.55 },
    { minX: -36.4, maxX: -16.6, minZ: -5.4, maxZ: 9.4, roofY: 6.85 },
    { minX: 0.6, maxX: 9.4, minZ: -38.4, maxZ: -30.9, roofY: 4.85 },
  ];

  scores = 0;
  courtLit = false;
  shelfOpen = false;
  eggCount = 0;
  readonly onScore?: (score: number) => void;
  readonly onCourtLit?: () => void;
  readonly onSecret?: () => void;

  private quality: Quality;
  private reducedMotion: boolean;
  private readonly signalConstellation = new THREE.Group();
  private readonly signalStars: SignalConstellationStar[] = [];
  private readonly signalStarPositions: THREE.Vector3[] = [];
  /** Camera aim target used by the telescope interaction. */
  readonly signalLookAt = new THREE.Vector3(5.6, 15.4, -10.5);
  private signalConstellationOpen = false;
  private signalConstellationElapsed = 0;
  private signalConstellationLine?: THREE.LineSegments;
  private signalConstellationLineMaterial?: THREE.LineBasicMaterial;
  private signalPulse?: THREE.Mesh;
  private telescopeInteractable?: Interactable;
  private telescopeModel?: THREE.Group;
  /** 星座星点的可读内容，按 interactable id 索引，供望远镜目镜面板渲染。 */
  readonly signalReadings = new Map<string, SignalCopy>();

  /** 目镜面板目录：按星点出现顺序列出这一片星空里的信号。 */
  get signalEntries(): ReadonlyArray<{ id: string; index: string; label: string }> {
    return [...this.signalReadings.entries()].map(([id, { index, label }]) => ({
      id,
      index,
      label,
    }));
  }

  private readonly blocks: BoxSpec[] = [];
  private readonly glowBlocks: BoxSpec[] = [];
  private readonly edgePositions: number[] = [];

  private glowMaterial!: THREE.MeshBasicMaterial;
  private poolMaterial!: THREE.MeshBasicMaterial;
  private waterMaterial!: THREE.MeshPhongMaterial;

  private ball!: THREE.Mesh;
  private readonly ballVelocity = new THREE.Vector3();
  private ballFlying = false;
  private ballScored = false;
  private ballResetTimer = 0;
  private ballRestTimer = 0;
  private readonly rimPositions = [
    new THREE.Vector3(17.55, 3.05, 2),
    new THREE.Vector3(34.45, 3.05, 2),
  ];

  private courtOn: THREE.Mesh[] = [];
  private courtOff: THREE.Mesh[] = [];
  private courtLight!: THREE.PointLight;
  private courtLightLevel = 0;
  private courtLightTarget = 0;

  private shelfGroup!: THREE.Group;
  private shelfCollider!: AABB;
  private shelfTargetX = 5.7;
  private secretRevealed = false;
  private radioOn = false;
  private radioLed?: THREE.Mesh;
  private radioLight?: THREE.PointLight;
  private radioBars: THREE.Mesh[] = [];

  private monitorMaterial!: THREE.MeshBasicMaterial;
  private monitorTexture?: THREE.CanvasTexture;
  private readonly signalSurfaces = new Map<string, SignalSurface>();

  private poolLights: THREE.PointLight[] = [];
  private poolLightBase: number[] = [];

  private waterMeshes: THREE.Mesh[] = [];
  private fountainJets: THREE.Mesh[] = [];
  private duck?: THREE.Group;
  private duckBaseY = 0;
  private duckPoke = 0;
  private readonly fishLife: {
    group: THREE.Group;
    tail: THREE.Mesh;
    phase: number;
    radiusX: number;
    radiusZ: number;
    speed: number;
  }[] = [];

  private confetti?: {
    points: THREE.Points;
    velocities: Float32Array;
    life: number;
  };

  /** 鸭子当前所在的池面坐标。巡游与喂食都只是移动这个点，位置不靠解析式直接写。 */
  private readonly duckPos = new THREE.Vector3();
  /** 面包屑落点。喂食后鸭子和鱼都把巡游中心往这里拉。 */
  private readonly feedPoint = new THREE.Vector3(23.2, 0.3, 24.1);
  /** 面包屑剩余时间（秒）。归零后 gather 会自己慢慢散开。 */
  private feedTimer = 0;
  /** 0..1 的聚集程度，用阻尼过渡，避免第一帧整群鱼瞬移。 */
  private feedGather = 0;
  /** 累计喂食次数，第三次解锁彩蛋。 */
  private feedCount = 0;
  private crumbs?: {
    points: THREE.Points;
    velocities: Float32Array;
    life: number;
  };
  /** 室外路面的水膜层。只在雨天浮现，室内地面不在其中。 */
  private wetLayer?: THREE.Mesh;
  private wetMaterial?: THREE.MeshPhongMaterial;
  /** 0..1 的积水量，雨天缓慢上涨、雨停后 30 秒左右退干。 */
  private wetness = 0;
  /** 当前雨量 0..1，由 engine 每帧写入（取自 WeatherSystem.rainAmount）。 */
  private rainAmount = 0;

  private elapsed = 0;

  constructor(scene: THREE.Scene, opts: WorldOptions) {
    this.quality = opts.quality;
    this.reducedMotion = opts.reducedMotion;
    this.onScore = opts.onScore;
    this.onCourtLit = opts.onCourtLit;
    this.onSecret = opts.onSecret;

    this.group.name = "xia-world";
    scene.add(this.group);

    this.waterMaterial = new THREE.MeshPhongMaterial({
      color: C.water,
      transparent: true,
      opacity: 0.78,
      shininess: 110,
      specular: 0xbfe7ee,
      depthWrite: true,
    });

    this.buildGround();
    this.buildPaths();
    this.buildPlaza();
    this.buildProfileKiosk();
    this.buildCourt();
    this.buildGallery();
    this.buildStudio();
    this.buildSecretRoom();
    this.buildArcade();
    this.buildRooftop();
    this.buildCinema();
    this.buildBimPavilion();
    this.buildPond();
    this.buildTrees();
    this.buildLamps();
    this.buildPerimeter();

    this.createStaticMeshes(opts.quality);
    this.buildWetLayer();
    this.createBall();
    this.createFountain();
    this.createDuck();
    this.createFish();

    this.setShadows(opts.quality === "high");
  }

  setShadows(enabled: boolean) {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = enabled && obj.userData.noShadow !== true;
        obj.receiveShadow = true;
      }
    });
  }

  setQuality(quality: Quality) {
    this.quality = quality;
    if (this.signalConstellationLineMaterial) {
      this.signalConstellationLineMaterial.opacity = quality === "high" ? 0.78 : 0.42;
    }
    if (this.signalPulse) this.signalPulse.visible = false;
    this.signalStars.forEach((star) => {
      star.halo.visible = false;
      (star.halo.material as THREE.MeshBasicMaterial).opacity = quality === "high" ? 0.16 : 0;
    });
    if (this.signalConstellationOpen) this.updateSignalConstellation(0);
    // 低画质下积水更淡，和粒子减半一样是省性能的表现
    if (this.wetMaterial) this.wetMaterial.opacity = this.wetOpacity();
  }

  /**
   * 雨天积水：在室外路面上铺一层半透明水膜。
   *
   * 材质是 MeshLambertMaterial，没有 roughness，改不了「湿」的观感，
   * 所以另起一层带高光的 Phong 薄膜叠在路面上方 12 mm —— 比任何一块地面
   * 都高，避免共面闪烁；室内地面（展厅 / 工作室 / 密室）不在这层里，
   * 所以站在室内看不见积水。
   */
  private buildWetLayer() {
    // 每块都是 { x0, x1, z0, z1, y }：y 取该块地面的顶面 + 0.012
    const rects = [
      { x0: -13, x1: 13, z0: -13, z1: 13, y: 0.082 },    // 广场
      { x0: -3, x1: 3, z0: 13, z1: 31, y: 0.072 },       // 南向主路
      { x0: -3, x1: 3, z0: -17, z1: -13, y: 0.072 },     // 北向主路
      { x0: 13, x1: 16, z0: -1.6, z1: 3.6, y: 0.072 },   // 东向支路
      { x0: -17, x1: -13, z0: -1.6, z1: 3.6, y: 0.072 }, // 西向支路
      { x0: 3, x1: 15.6, z0: 18.4, z1: 21.6, y: 0.072 }, // 池塘支路
      { x0: 16, x1: 36, z0: -5, z1: 9, y: 0.172 },       // 篮球场
      { x0: -10, x1: 10, z0: -31, z1: -17, y: 7.522 },   // 天台
    ];

    // 一个网格装下所有路面：每块两个三角形，UV 用世界坐标除以 TILE 平铺，
    // 这样水洼大小不随路面尺寸变化，接缝处也能连上。
    const TILE = 9;
    const positions = new Float32Array(rects.length * 4 * 3);
    const uvs = new Float32Array(rects.length * 4 * 2);
    const indices: number[] = [];
    rects.forEach((r, i) => {
      const base = i * 4;
      const corners: [number, number][] = [
        [r.x0, r.z0],
        [r.x1, r.z0],
        [r.x1, r.z1],
        [r.x0, r.z1],
      ];
      corners.forEach(([x, z], k) => {
        const v = (base + k) * 3;
        positions[v] = x;
        positions[v + 1] = r.y;
        positions[v + 2] = z;
        const u = (base + k) * 2;
        uvs[u] = x / TILE;
        uvs[u + 1] = z / TILE;
      });
      // 顶点按 (x0,z0)→(x1,z0)→(x1,z1)→(x0,z1) 排，从 +y 往下看是顺时针，
      // 直接按 base,base+1,base+2 组三角会得到朝 -y 的法线、从上方看不见，
      // 所以这里反过来绕，让正面朝上。
      indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mask = puddleMaskTexture();
    mask.wrapS = THREE.RepeatWrapping;
    mask.wrapT = THREE.RepeatWrapping;

    this.wetMaterial = new THREE.MeshPhongMaterial({
      // 深青灰，叠在路面上是「打湿变深」而不是刷了层蓝漆
      color: 0x2b3a3c,
      transparent: true,
      opacity: 0,
      alphaMap: mask,
      // 高光给足才有水面反光条；shininess 太高会整片发白，取中间值
      shininess: 70,
      specular: 0x9fd4dd,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    this.wetLayer = new THREE.Mesh(geo, this.wetMaterial);
    this.wetLayer.name = "wet-ground";
    this.wetLayer.renderOrder = 2;
    this.wetLayer.visible = false;
    this.wetLayer.userData.noShadow = true;
    this.wetLayer.receiveShadow = true;
    this.group.add(this.wetLayer);
  }

  /** 积水层的不透明度：低画质更淡。 */
  private wetOpacity() {
    return this.wetness * (this.quality === "high" ? 0.82 : 0.42);
  }

  /** 雨量 0..1，engine 每帧写一次。室内不削弱——积水层本来就只铺在室外路面上。 */
  setRainAmount(amount: number) {
    this.rainAmount = amount;
  }

  /**
   * 推进积水：雨天涨得快，雨停后慢慢退干。
   *
   * @param dt 帧间隔（秒）
   * @param rain 当前雨量 0..1，来自 WeatherSystem.rainAmount
   */
  private updateWetness(dt: number, rain: number) {
    if (!this.wetLayer || !this.wetMaterial) return;
    // 上涨 λ=0.45（约 7 秒到 95%），退干 λ=0.1（约 30 秒退到 5%）——
    // 下雨来得快、干得慢，符合真实路面。
    const lambda = rain > this.wetness ? 0.45 : 0.1;
    this.wetness = THREE.MathUtils.damp(this.wetness, rain, lambda, dt);
    const visible = this.wetness > 0.01;
    this.wetLayer.visible = visible;
    if (visible) this.wetMaterial.opacity = this.wetOpacity();
  }

  // ---------------------------------------------------------------- build

  private addBox(
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    color: number,
    opts: { glow?: boolean; solid?: boolean; edge?: boolean; tag?: string } = {},
  ) {
    const spec: BoxSpec = {
      cx,
      cy,
      cz,
      w,
      h,
      d,
      color,
      edge: opts.edge !== false,
      solid: opts.solid !== false,
      tag: opts.tag,
    };
    if (opts.glow) this.glowBlocks.push(spec);
    else this.blocks.push(spec);

    if (spec.solid) {
      this.colliders.push({
        minX: cx - w / 2,
        maxX: cx + w / 2,
        minY: cy - h / 2,
        maxY: cy + h / 2,
        minZ: cz - d / 2,
        maxZ: cz + d / 2,
        tag: opts.tag,
      });
    }

    if (
      spec.edge &&
      Math.min(w, h, d) > 0.18 &&
      w * h * d > 0.02 &&
      spec.solid
    ) {
      this.addEdges(cx - w / 2, cy - h / 2, cz - d / 2, cx + w / 2, cy + h / 2, cz + d / 2);
    }
  }

  private addEdges(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
  ) {
    const e = 0.003;
    x0 -= e;
    y0 -= e;
    z0 -= e;
    x1 += e;
    y1 += e;
    z1 += e;
    const p = this.edgePositions;
    const push = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
      p.push(ax, ay, az, bx, by, bz);
    };
    // bottom
    push(x0, y0, z0, x1, y0, z0);
    push(x1, y0, z0, x1, y0, z1);
    push(x1, y0, z1, x0, y0, z1);
    push(x0, y0, z1, x0, y0, z0);
    // top
    push(x0, y1, z0, x1, y1, z0);
    push(x1, y1, z0, x1, y1, z1);
    push(x1, y1, z1, x0, y1, z1);
    push(x0, y1, z1, x0, y1, z0);
    // verticals
    push(x0, y0, z0, x0, y1, z0);
    push(x1, y0, z0, x1, y1, z0);
    push(x1, y0, z1, x1, y1, z1);
    push(x0, y0, z1, x0, y1, z1);
  }

  private addFloor(
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    top: number,
    thickness: number,
    color: number,
    opts: { solid?: boolean; edge?: boolean; tag?: string } = {},
  ) {
    this.addBox(
      (x0 + x1) / 2,
      top - thickness / 2,
      (z0 + z1) / 2,
      x1 - x0,
      thickness,
      z1 - z0,
      color,
      opts,
    );
  }

  private addWallX(
    x: number,
    z0: number,
    z1: number,
    y0: number,
    y1: number,
    color: number,
    thickness = 0.4,
  ) {
    this.addBox(x, (y0 + y1) / 2, (z0 + z1) / 2, thickness, y1 - y0, z1 - z0, color);
  }

  private addWallZ(
    z: number,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    color: number,
    thickness = 0.4,
  ) {
    this.addBox((x0 + x1) / 2, (y0 + y1) / 2, z, x1 - x0, y1 - y0, thickness, color);
  }

  private addSign(
    texture: THREE.Texture,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    rotationY = 0,
    transparent = false,
  ) {
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent,
      side: THREE.DoubleSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotationY;
    mesh.userData.noShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  private addPoster(
    texture: THREE.Texture,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    rotationY: number,
    frame = 0x1d2621,
  ) {
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.18, h + 0.18, 0.1),
      new THREE.MeshLambertMaterial({ color: frame }),
    );
    backing.position.set(x, y, z);
    backing.rotation.y = rotationY;
    backing.translateZ(-0.07);
    this.group.add(backing);
    return this.addSign(texture, w, h, x, y, z, rotationY);
  }

  private buildGround() {
    this.addBox(0, -0.6, 0, 100, 1.2, 100, C.grass, { edge: false, tag: "ground" });

    // Soft color patches so the ground does not read as one flat plane.
    for (let i = 0; i < 26; i += 1) {
      const a = i * 2.399963;
      const r = 8 + ((i * 37) % 38);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const size = 2.2 + ((i * 13) % 10) * 0.28;
      this.addBox(x, 0.01, z, size, 0.03, size * 0.72, i % 3 === 0 ? C.grassLight : C.grassDark, {
        solid: false,
        edge: false,
      });
    }
  }

  private buildPaths() {
    // plaza
    this.addFloor(-13, 13, -13, 13, 0.07, 0.14, C.plaza, { edge: false, tag: "plaza" });
    this.addBox(0, 0.08, 13.2, 26.4, 0.04, 0.7, C.plazaDark, { solid: false, edge: false });
    this.addBox(0, 0.08, -13.2, 26.4, 0.04, 0.7, C.plazaDark, { solid: false, edge: false });
    this.addBox(-13.2, 0.08, 0, 0.7, 0.04, 26.4, C.plazaDark, { solid: false, edge: false });
    this.addBox(13.2, 0.08, 0, 0.7, 0.04, 26.4, C.plazaDark, { solid: false, edge: false });

    // south: spawn to plaza
    this.addFloor(-3, 3, 13, 31, 0.06, 0.12, C.path, { edge: false });
    // north: plaza to studio
    this.addFloor(-3, 3, -17, -13, 0.06, 0.12, C.path, { edge: false });
    // east: plaza to court
    this.addFloor(13, 16, -1.6, 3.6, 0.06, 0.12, C.path, { edge: false });
    // west: plaza to gym
    this.addFloor(-17, -13, -1.6, 3.6, 0.06, 0.12, C.path, { edge: false });
    // pond spur: continue from the south path and stop at the pond's stone edge.
    // 起点对齐主路东缘 x=3，与主路不重叠，避免两块同高地面共面闪烁。
    this.addFloor(3, 15.6, 18.4, 21.6, 0.06, 0.12, C.path, { edge: false, tag: "pond-spur" });

    // path edging
    const edge = (x: number, z: number, w: number, d: number) =>
      this.addBox(x, 0.075, z, w, 0.04, d, C.pathDark, { solid: false, edge: false });
    edge(-3.15, 22, 0.3, 18);
    // 主路东侧边线在池塘支路路口（z 18.4–21.6）处断开，否则一条深色线会横切路口。
    edge(3.15, 15.7, 0.3, 5.4);
    edge(3.15, 26.3, 0.3, 9.4);
    // 支路边缘线沿支路自身长度铺，起点对齐 x=3，不再压到南北主路上。
    edge(9.3, 18.28, 12.6, 0.24);
    edge(9.3, 21.72, 12.6, 0.24);
    edge(-3.15, -15, 0.3, 4);
    edge(3.15, -15, 0.3, 4);
    edge(14.5, -1.75, 3, 0.3);
    edge(14.5, 3.75, 3, 0.3);
    edge(-15, -1.75, 4, 0.3);
    edge(-15, 3.75, 4, 0.3);
  }

  private buildPlaza() {
    // fountain
    const fx = 0;
    const fz = 0;
    this.addBox(fx - 3.4, 0.42, fz, 0.8, 0.84, 7.6, C.stone);
    this.addBox(fx + 3.4, 0.42, fz, 0.8, 0.84, 7.6, C.stone);
    this.addBox(fx, 0.42, fz - 3.4, 6.0, 0.84, 0.8, C.stone);
    this.addBox(fx, 0.42, fz + 3.4, 6.0, 0.84, 0.8, C.stone);
    this.addBox(fx, 1.65, fz, 1.1, 2.5, 1.1, C.stoneDark);
    this.addBox(fx, 2.98, fz, 2.7, 0.28, 2.7, C.stone);
    this.addBox(fx, 3.2, fz, 0.7, 0.3, 0.7, C.stoneDark);

    // benches
    this.addBench(-7.6, 0.12, 0.2, -1, "x");
    this.addBench(7.6, 0.12, 0.2, 1, "x");
    this.addBench(0.4, 0.12, 8.4, 1);

    // flower beds
    for (const [x, z] of [
      [-9.6, -9.6],
      [9.6, -9.6],
      [-9.6, 9.6],
      [9.6, 9.6],
    ]) {
      this.addBox(x, 0.18, z, 3.2, 0.36, 3.2, C.soil);
      this.addBox(x, 0.4, z, 3.0, 0.08, 3.0, C.leafDark, { solid: false, edge: false });
      for (let i = 0; i < 6; i += 1) {
        const color = [C.flowerA, C.flowerB, C.flowerC][i % 3];
        this.addBox(
          x - 1.1 + (i % 3) * 1.1,
          0.55 + (i % 2) * 0.12,
          z - 1.0 + Math.floor(i / 3) * 1.9,
          0.18,
          0.38,
          0.18,
          color,
          { solid: false, edge: false },
        );
      }
    }

    // plaza medallion
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5.6, 0.055, 6, 72),
      new THREE.MeshBasicMaterial({ color: C.plazaDark }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.085, 0);
    this.group.add(ring);

    // welcome arch near the spawn
    this.addBox(-5.7, 2.6, 22.5, 0.6, 5.2, 0.6, C.woodDark);
    this.addBox(5.7, 2.6, 22.5, 0.6, 5.2, 0.6, C.woodDark);
    this.addBox(0, 5.05, 22.5, 12.0, 0.5, 0.8, C.wood);
    // Keep the banner inside the narrow portrait field of view, and use the
    // texture's 2:1 aspect so the lettering is not stretched.
    const welcome = this.addSign(floorSignTexture(), 3.8, 1.9, 0, 4.05, 22.76, 0);
    welcome.name = "welcome-sign";
  }

  private addBench(
    x: number,
    y: number,
    z: number,
    facing: number,
    axis: "z" | "x" = "z",
  ) {
    if (axis === "x") {
      // Side benches face across the plaza. `facing` points from the seat to
      // the backrest, so the sitter looks toward the fountain.
      this.addBox(x, y + 0.52, z, 0.78, 0.18, 2.5, C.wood);
      this.addBox(x + facing * 0.31, y + 0.93, z, 0.14, 0.75, 2.5, C.wood);
      this.addBox(x, y + 0.27, z - 1.0, 0.62, 0.54, 0.18, C.metal);
      this.addBox(x, y + 0.27, z + 1.0, 0.62, 0.54, 0.18, C.metal);
      return;
    }
    this.addBox(x, y + 0.52, z, 2.5, 0.18, 0.78, C.wood);
    this.addBox(x, y + 0.93, z + facing * 0.31, 2.5, 0.75, 0.14, C.wood);
    this.addBox(x - 1.0, y + 0.27, z, 0.18, 0.54, 0.62, C.metal);
    this.addBox(x + 1.0, y + 0.27, z, 0.18, 0.54, 0.62, C.metal);
  }

  private buildProfileKiosk() {
    const x = 8.8;
    const z = 17.2;

    // The kiosk sits directly on the grass. Its old path branch and stone base
    // read as a misaligned slab from the spawn path, so they were removed.
    for (const side of [-1, 1]) {
      this.addBox(x + side * 2.05, 2.1, z + 0.05, 0.18, 4.2, 0.18, C.metal, { solid: false });
    }
    this.addBox(x, 4.22, z + 0.05, 4.5, 0.22, 0.34, C.woodDark, { solid: false, edge: false });
    this.addBox(x, 2.55, z + 0.06, 4.55, 2.75, 0.16, 0x1a211d, { solid: false, edge: false });

    const screen = this.addSign(profileBoardTexture(), 4.2, 2.4, x, 2.55, z + 0.18);
    screen.name = "profile-kiosk-screen";
    this.addBox(x, 3.92, z + 0.18, 4.5, 0.08, 0.1, 0xd8ff5f, { glow: true, solid: false, edge: false });
    this.addBox(x, 1.18, z + 0.18, 4.5, 0.08, 0.1, 0xd8ff5f, { glow: true, solid: false, edge: false });
    this.addSign(
      signTexture("PROFILE", "OPEN / 公开职业档案", "#d8ff5f"),
      3.4,
      0.55,
      x,
      4.42,
      z + 0.22,
    );

    this.interactables.push({
      id: "profile",
      object: screen,
      label: "打开职业档案",
      maxDistance: 4.8,
    });

    for (const side of [-1, 1]) {
      this.addBox(x + side * 2.65, 0.3, z + 0.35, 0.75, 0.6, 0.75, C.stone);
      this.addBox(x + side * 2.65, 0.75, z + 0.35, 0.58, 0.3, 0.58, C.leaf, { solid: false, edge: false });
      this.addBox(x + side * 2.65, 0.95, z + 0.35, 0.3, 0.5, 0.3, C.leafLight, { solid: false, edge: false });
    }
  }

  private buildCourt() {
    const x0 = 16;
    const x1 = 36;
    const z0 = -5;
    const z1 = 9;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;

    this.addFloor(x0, x1, z0, z1, 0.16, 0.3, C.court, { edge: false, tag: "court" });
    this.addBox(cx, 0.17, z0 + 0.22, 20, 0.04, 0.28, C.courtDark, { solid: false, edge: false });
    this.addBox(cx, 0.17, z1 - 0.22, 20, 0.04, 0.28, C.courtDark, { solid: false, edge: false });

    const line = (x: number, z: number, w: number, d: number) =>
      this.addBox(x, 0.2, z, w, 0.025, d, C.courtLine, { solid: false, edge: false });

    // boundary
    line(cx, z0 + 0.45, 19.4, 0.08);
    line(cx, z1 - 0.45, 19.4, 0.08);
    line(x0 + 0.45, cz, 0.08, 13.4);
    line(x1 - 0.45, cz, 0.08, 13.4);
    // halfway line
    line(cx, cz, 0.08, 13.2);
    // rims key boxes
    line(19.4, cz, 0.08, 5.4);
    line(19.4, cz - 2.7, 3.2, 0.08);
    line(19.4, cz + 2.7, 3.2, 0.08);
    line(32.6, cz, 0.08, 5.4);
    line(32.6, cz - 2.7, 3.2, 0.08);
    line(32.6, cz + 2.7, 3.2, 0.08);

    const centerCircle = new THREE.Mesh(
      new THREE.TorusGeometry(1.85, 0.04, 6, 48),
      new THREE.MeshBasicMaterial({ color: C.courtLine }),
    );
    centerCircle.rotation.x = Math.PI / 2;
    centerCircle.position.set(cx, 0.215, cz);
    this.group.add(centerCircle);

    for (const side of [-1, 1] as const) {
      const hoopX = side === -1 ? 17.1 : 34.9;
      // Keep the ring tight to the board instead of floating almost a metre
      // in front of it. The connector below closes the remaining gap.
      const rimX = hoopX - side * 0.45;
      const rimY = 3.05;
      const poleX = side === -1 ? 16.35 : 35.65;

      this.addBox(poleX, 2.5, cz, 0.34, 5.0, 0.34, C.metal);
      this.addBox(
        (poleX + hoopX) / 2,
        4.08,
        cz,
        Math.abs(hoopX - poleX) + 0.32,
        0.16,
        0.18,
        C.metal,
      );
      this.addBox(hoopX, 3.76, cz, 0.18, 1.15, 1.9, C.white);
      this.addBox(hoopX, 3.18, cz, 0.2, 0.06, 1.9, C.orange, { solid: false, edge: false });
      this.addBox(hoopX - side * 0.16, rimY + 0.03, cz, 0.16, 0.08, 0.12, C.metal, {
        solid: false,
        edge: false,
      });

      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.045, 8, 22),
        new THREE.MeshStandardMaterial({ color: C.orange, roughness: 0.5, metalness: 0.2 }),
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.set(rimX, rimY, cz);
      rim.castShadow = true;
      this.group.add(rim);

      const net = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.22, 0.56, 10, 3, true),
        new THREE.MeshBasicMaterial({
          color: 0xf1ecdf,
          wireframe: true,
          transparent: true,
          opacity: 0.38,
        }),
      );
      net.position.set(rimX, rimY - 0.29, cz);
      this.group.add(net);

      // court light poles
      this.buildCourtLamp(rimX - side * 2.2, cz - 7.9, side);
      this.buildCourtLamp(rimX - side * 2.2, cz + 7.9, side);
    }

    this.courtLight = new THREE.PointLight(0xe8ffb4, 0, 42, 2);
    this.courtLight.position.set(cx, 7.4, cz);
    this.group.add(this.courtLight);

    // 两张场边长椅原本背对球场，转 180° 让坐下的人面向球场。
    this.addBench(cx, 0.16, z1 + 1.1, 1);
    this.addBench(cx, 0.16, z0 - 1.1, -1);
  }

  private buildCourtLamp(x: number, z: number, _side: number) {
    this.addBox(x, 3.0, z, 0.24, 6.0, 0.24, C.metal);
    const off = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.5, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x252d29, roughness: 0.7 }),
    );
    off.position.set(x, 6.0, z);
    this.group.add(off);
    this.courtOff.push(off);

    const on = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.52, 1.52),
      new THREE.MeshBasicMaterial({ color: 0xe8ffb4, toneMapped: false }),
    );
    on.position.copy(off.position);
    on.visible = false;
    this.group.add(on);
    this.courtOn.push(on);
  }

  private buildGallery() {
    const x0 = -36;
    const x1 = -17;
    const z0 = -5;
    const z1 = 9;
    const cx = (x0 + x1) / 2;

    this.addFloor(x0, x1, z0, z1, 0.14, 0.3, 0x3b4144, { edge: false, tag: "gallery" });
    this.addBox(cx, 0.16, 2, 18.6, 0.04, 13.6, 0x474e51, { solid: false, edge: false });

    // The entrance is centered on the west approach path (z = 1) and widened
    // into a clear threshold instead of a narrow, offset opening.
    this.addWallX(x0 - 0.2, z0 - 0.2, z1 + 0.2, 0, 6.6, C.wallSide);
    this.addWallZ(z0 - 0.2, x0 - 0.2, x1 + 0.2, 0, 6.6, C.wallSide);
    this.addWallZ(z1 + 0.2, x0 - 0.2, x1 + 0.2, 0, 6.6, C.wallSide);
    this.addWallX(x1 + 0.2, z0 - 0.2, -1.9, 0, 6.6, C.wallSide);
    this.addWallX(x1 + 0.2, 3.9, z1 + 0.2, 0, 6.6, C.wallSide);
    this.addBox(x1 + 0.2, 5.9, 1.0, 0.4, 1.4, 5.8, C.wallSide);
    // The threshold overlaps the gallery slab. Keep its top a few millimetres
    // above the interior floor so the two coplanar surfaces cannot z-fight.
    this.addFloor(-17.45, -16.2, -1.95, 3.95, 0.155, 0.18, C.path, {
      edge: false,
      tag: "gallery-threshold",
    });
    for (const z of [-2.0, 4.0]) {
      this.addBox(x1 + 0.2, 2.6, z, 0.5, 5.2, 0.22, C.metal, { solid: false, edge: false });
    }
    this.addBox(x1 + 0.2, 5.3, 1.0, 0.5, 0.22, 6.24, C.metal, { solid: false, edge: false });
    this.addFloor(x0 - 0.2, x1 + 0.3, z0 - 0.2, z1 + 0.2, 6.8, 0.4, C.roof, { edge: false });

    // overhead lights
    for (const z of [-1.2, 2, 5.2]) {
      this.addBox(cx, 6.45, z, 6.5, 0.14, 0.22, 0xfff1c4, { glow: true, solid: false });
    }

    // reading rug and bench keep the room a calm place to pause instead of a prop warehouse.
    this.addBox(cx, 0.17, 2.0, 7.4, 0.03, 4.6, 0x313a35, { solid: false, edge: false });
    this.addBench(cx, 0.12, 6.7, 1);

    // The old gym equipment is gone. The walls now hold large, readable project screens.
    const projectPanels = PROFILE.projects;
    // 四个项目分两面墙：西墙两个，北墙两个。北墙面板宽 4.4，两块中心间距 4.8，
    // 整体居中在展厅中轴 cx=-26.5：左块中心 -31.0，右块中心 -22.0。
    const panelSlots: Array<{ x: number; z: number; rotationY: number }> = [
      { x: x0 + 0.06, z: 0.8, rotationY: Math.PI / 2 },
      { x: x0 + 0.06, z: 6.0, rotationY: Math.PI / 2 },
      { x: -31.0, z: z0 + 0.06, rotationY: 0 },
      { x: -22.0, z: z0 + 0.06, rotationY: 0 },
    ];
    projectPanels.forEach((project, index) => {
      const texture = projectTexture(
        project.index,
        project.title,
        project.category,
        project.summary,
        [...project.stack],
      );
      const slot = panelSlots[index] ?? panelSlots[panelSlots.length - 1]!;
      const screen = this.addSign(texture, 4.4, 2.75, slot.x, 2.9, slot.z, slot.rotationY);
      if (slot.rotationY === Math.PI / 2) {
        this.addBox(slot.x - 0.08, 2.9, slot.z, 0.1, 3.0, 4.65, 0x202824, { solid: false, edge: false });
        this.addBox(slot.x + 0.05, 4.55, slot.z, 0.08, 0.1, 4.2, 0xd8ff5f, { glow: true, solid: false, edge: false });
      } else {
        this.addBox(slot.x, 2.9, slot.z - 0.08, 4.65, 3.0, 0.1, 0x202824, { solid: false, edge: false });
        this.addBox(slot.x, 4.55, slot.z + 0.05, 4.2, 0.1, 0.08, 0xd8ff5f, { glow: true, solid: false, edge: false });
      }
      screen.name = `project-screen-${index}`;
      this.interactables.push({
        id: `project-${index}`,
        object: screen,
        label: `查看项目 · ${project.title}`,
        maxDistance: 4.8,
      });
    });

    // plant
    this.addBox(-18.6, 0.4, 8.0, 0.9, 0.8, 0.9, C.woodDark);
    this.addBox(-18.6, 1.4, 8.0, 1.2, 1.4, 1.2, C.leafDark, { solid: false });

    this.addSign(
      signTexture("PROJECTS", "SELECTED WORK / 项目档案", "#ff8a4c"),
      4.6,
      1.15,
      x1 + 0.42,
      5.75,
      1.0,
      Math.PI / 2,
    );

    const light = new THREE.PointLight(0xffd7a0, 0, 26, 2);
    light.position.set(cx, 5.6, 2);
    this.group.add(light);
    this.poolLights.push(light);
    this.poolLightBase.push(26);

    // A permanent soft fill keeps the project wall and reading bench legible
    // during the day; the night-scaled light above adds the warmer evening look.
    const fill = new THREE.PointLight(0xffe0b8, 42, 24, 2);
    fill.position.set(cx, 5.2, 2);
    this.group.add(fill);
    const entryFill = new THREE.PointLight(0xffe0b8, 16, 10, 2);
    entryFill.position.set(-18.4, 3.8, 1.0);
    this.group.add(entryFill);
  }

  private buildStudio() {
    const x0 = -10;
    const x1 = 10;
    const z0 = -31;
    const z1 = -17;
    const cx = 0;

    this.addFloor(x0, x1, z0, z1, 0.12, 0.24, C.woodLight, { edge: false, tag: "studio" });
    this.addBox(0, 0.13, -24, 16.4, 0.03, 10.6, 0x9a6a47, { solid: false, edge: false });

    // walls, with a 3.4m gap in the back wall for the hidden room.
    this.addWallX(x0 - 0.2, z0 - 0.2, z1 + 0.2, 0, 7.0, C.wall);
    this.addWallX(x1 + 0.2, z0 - 0.2, z1 + 0.2, 0, 7.0, C.wall);
    this.addWallZ(z0 - 0.2, x0 - 0.2, 4.0, 0, 7.0, C.wallSide);
    this.addWallZ(z0 - 0.2, 7.4, x1 + 0.2, 0, 7.0, C.wallSide);
    this.addWallZ(z0 - 0.2, 4.0, 7.4, 5.0, 7.0, C.wallSide);
    this.addWallZ(z1 + 0.2, x0 - 0.2, -4.0, 0, 7.0, C.wallSide);
    this.addWallZ(z1 + 0.2, 4.0, x1 + 0.2, 0, 7.0, C.wallSide);
    this.addWallZ(z1 + 0.2, -4.0, 4.0, 5.4, 7.0, C.wallSide);
    this.addFloor(x0 - 0.3, x1 + 0.3, z0 - 0.3, z1 + 0.3, 7.5, 0.5, C.roof, { edge: false });

    // facade sign
    this.addSign(
      signTexture("STUDIO", "WORK / PROJECTS / 2026", "#d8ff5f"),
      7.0,
      1.5,
      0,
      6.1,
      z1 + 0.42,
    );

    // interior warm lights
    for (const x of [-6, 0, 6]) {
      this.addBox(x, 6.45, -24, 2.4, 0.12, 0.3, 0xffe3b0, { glow: true, solid: false });
    }

    // rug
    this.addBox(0, 0.15, -23.3, 6.4, 0.03, 4.4, 0x7a443c, { solid: false, edge: false });
    this.addBox(0, 0.17, -23.3, 5.6, 0.02, 3.6, 0xb87962, { solid: false, edge: false });

    // desk
    this.addBox(-4.4, 1.32, -28.7, 6.0, 0.18, 2.0, C.wood);
    for (const x of [-6.9, -1.9]) {
      for (const z of [-29.5, -27.9]) {
        this.addBox(x, 0.65, z, 0.16, 1.3, 0.16, C.woodDark);
      }
    }
    this.addBox(-4.4, 0.9, -28.8, 0.9, 1.1, 0.8, C.woodDark);
    this.addBox(-4.4, 1.85, -29.0, 1.9, 1.15, 0.16, C.black);
    this.addBox(-4.4, 1.42, -28.95, 1.3, 0.3, 0.5, C.metal);
    const screen = this.addSign(
      screenTexture(this.scores, this.eggCount),
      1.72,
      0.98,
      -4.4,
      1.86,
      -28.9,
    );
    screen.name = "monitor";
    this.monitorMaterial = screen.material as THREE.MeshBasicMaterial;
    this.monitorTexture = this.monitorMaterial.map as THREE.CanvasTexture;
    this.interactables.push({
      id: "monitor",
      object: screen,
      label: "读取工作方式",
      maxDistance: 4.2,
    });
    this.registerSignal("monitor", screen, signalTexture("工作方式", [
      "Vue 2/3 · React · TypeScript",
      "数据可视化 · 地图 · 三维 · 跨端",
      "组件封装与接口联调",
    ], true));

    this.addBox(-4.4, 1.36, -27.8, 2.6, 0.12, 0.7, 0x2a302d);
    for (let i = 0; i < 8; i += 1) {
      this.addBox(-5.4 + i * 0.3, 1.43, -27.8, 0.18, 0.03, 0.4, 0x3f4641, {
        solid: false,
        edge: false,
      });
    }

    // chair: the backrest is on the south side so the sitter faces the desk.
    this.addBox(-4.4, 0.62, -26.4, 1.0, 0.16, 1.0, C.black);
    this.addBox(-4.4, 1.15, -25.9, 1.0, 1.0, 0.14, C.black);
    this.addBox(-4.4, 0.25, -26.4, 0.18, 0.5, 0.18, C.metal);

    // shelves on east wall
    this.addBox(9.3, 2.2, -21.2, 0.8, 4.4, 3.6, C.wood);
    for (let i = 0; i < 4; i += 1) {
      this.addBox(9.0, 1.0 + i * 0.95, -21.2, 0.5, 0.08, 3.3, C.woodDark, {
        solid: false,
      });
      for (let j = 0; j < 5; j += 1) {
        this.addBox(8.95, 1.3 + i * 0.95, -22.4 + j * 0.55, 0.3, 0.55, 0.24, [0x9a5a4c, 0x4f6f8f, 0x7b8a4f, 0xc4a45a][(i + j) % 4], {
          solid: false,
          edge: false,
        });
      }
    }

    // posters on the back wall
    this.addSign(
      signTexture("WORKING SIGNALS", "01—03 / READ EACH SIGNAL", "#d8ff5f"),
      6.6,
      1.05,
      -5.0,
      6.5,
      -30.6,
    );
    const interfacePoster = this.addPoster(
      posterTexture("01", "XIA HOME", "3D PERSONAL SITE / 2026", "A world you can walk into.", ["#11251b", "#d8ff5f", "#f1ecdf"]),
      2.25,
      3.0,
      -7.7,
      4.25,
      -30.7,
      0,
    );
    this.interactables.push({ id: "poster-interface", object: interfacePoster, label: "读取界面方向", maxDistance: 4.4 });
    this.registerSignal("poster-interface", interfacePoster, signalTexture("界面方向", [
      "Vue 2/3 · React · TypeScript",
      "把复杂页面整理成可操作的路径。",
    ]));

    const dataPoster = this.addPoster(
      posterTexture("02", "DATA / MAP", "VUE · ECHARTS · MAP", "Make complex information legible.", ["#1e2333", "#ff8a4c", "#e9e4d8"]),
      2.25,
      3.0,
      -3.2,
      4.25,
      -30.7,
      0,
    );
    this.interactables.push({ id: "poster-data", object: dataPoster, label: "读取数据方向", maxDistance: 4.4 });
    this.registerSignal("poster-data", dataPoster, signalTexture("数据方向", [
      "ECharts · 地图 · 数据可视化",
      "让信息在合适的尺度上被看懂。",
    ]));

    const interactionPoster = this.addPoster(
      posterTexture("03", "INTERACTION", "REACT · THREE.JS · UNIAPP", "Interfaces that invite exploration.", ["#2c2320", "#e5c07b", "#f1ecdf"]),
      2.2,
      2.95,
      -9.72,
      4.35,
      -24.8,
      Math.PI / 2,
    );
    this.interactables.push({ id: "poster-interaction", object: interactionPoster, label: "读取交互方向", maxDistance: 4.4 });
    this.registerSignal("poster-interaction", interactionPoster, signalTexture("交互方向", [
      "Three.js · UniApp · H5",
      "让同一条信息在不同设备上继续工作。",
    ]));

    // plant
    this.addBox(7.8, 0.45, -18.6, 0.9, 0.9, 0.9, C.woodDark);
    this.addBox(7.8, 1.5, -18.6, 1.3, 1.6, 1.3, C.leaf, { solid: false });

    // bookshelf door
    this.buildBookshelf();

    const light = new THREE.PointLight(0xffd7a0, 0, 24, 2);
    light.position.set(0, 5.2, -24);
    this.group.add(light);
    this.poolLights.push(light);
    this.poolLightBase.push(24);
  }

  private buildBookshelf() {
    const group = new THREE.Group();
    group.position.set(this.shelfTargetX, 0.12, -30.45);
    group.name = "bookshelf";

    const specs: { x: number; y: number; z: number; w: number; h: number; d: number; c: number }[] = [
      { x: 0, y: 2.4, z: -0.32, w: 3.2, h: 4.7, d: 0.12, c: C.woodDark },
      { x: -1.58, y: 2.4, z: 0, w: 0.16, h: 4.8, d: 0.8, c: C.wood },
      { x: 1.58, y: 2.4, z: 0, w: 0.16, h: 4.8, d: 0.8, c: C.wood },
      { x: 0, y: 4.72, z: 0, w: 3.3, h: 0.16, d: 0.8, c: C.wood },
      { x: 0, y: 0.12, z: 0, w: 3.3, h: 0.2, d: 0.8, c: C.wood },
      { x: 0, y: 1.15, z: 0.04, w: 3.1, h: 0.1, d: 0.7, c: C.woodDark },
      { x: 0, y: 2.15, z: 0.04, w: 3.1, h: 0.1, d: 0.7, c: C.woodDark },
      { x: 0, y: 3.15, z: 0.04, w: 3.1, h: 0.1, d: 0.7, c: C.woodDark },
      { x: 0, y: 4.05, z: 0.04, w: 3.1, h: 0.1, d: 0.7, c: C.woodDark },
    ];

    const bookColors = [0x9a5a4c, 0x4f6f8f, 0x7b8a4f, 0xc4a45a, 0x6e5b7e, 0x4f8a7e];
    // 每排书的落脚面 = 下方格板的顶面（底座 0.22、隔板 1.20/2.20/3.20）。
    // 之前用固定偏移推算书心，导致每本书都悬空约 0.3 并穿进上一层格板，
    // 从门口看就像整排书倒挂在半空。现在按「底面贴着格板」算书心。
    const shelfBases = [0.22, 1.2, 2.2, 3.2];
    for (let row = 0; row < shelfBases.length; row += 1) {
      let bx = -1.28;
      for (let i = 0; i < 7; i += 1) {
        const w = 0.18 + ((i * 7 + row * 3) % 4) * 0.035;
        const h = 0.55 + ((i + row) % 3) * 0.06;
        specs.push({
          x: bx,
          y: shelfBases[row]! + h / 2,
          // 书背贴着背板（-z 侧），书背朝向房间（+z）。
          z: -0.11,
          w,
          h,
          d: 0.3,
          c: bookColors[(i + row * 2) % bookColors.length],
        });
        bx += w + 0.08;
      }
    }

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(geo, mat, specs.length);
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    specs.forEach((s, i) => {
      m.compose(
        new THREE.Vector3(s.x, s.y, s.z),
        new THREE.Quaternion(),
        new THREE.Vector3(s.w, s.h, s.d),
      );
      mesh.setMatrixAt(i, m);
      color.setHex(s.c);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    this.group.add(group);

    this.shelfGroup = group;
    this.shelfCollider = {
      minX: this.shelfTargetX - 1.7,
      maxX: this.shelfTargetX + 1.7,
      minY: 0,
      maxY: 4.9,
      minZ: -30.9,
      maxZ: -30.0,
      tag: "shelf",
    };
    this.colliders.push(this.shelfCollider);

    this.interactables.push({
      id: "bookshelf",
      object: group,
      label: "推开书架",
      maxDistance: 4.0,
    });
  }

  private buildSecretRoom() {
    const x0 = 1.0;
    const x1 = 9.0;
    const z0 = -38.0;
    const z1 = -31.2;

    this.addFloor(x0, x1, z0, z1, 0.1, 0.2, 0x39453c, { edge: false, tag: "secret" });
    // Cover the old floor seam under the bookshelf. The lip sits just above
    // both floor slabs, so walking through is smooth without coplanar flicker.
    this.addFloor(3.8, 7.4, -31.34, -30.96, 0.135, 0.16, 0x6a4a32, {
      edge: false,
      tag: "secret-threshold",
    });
    this.addWallX(x0 - 0.2, z0 - 0.2, z1, 0, 4.8, 0x424f45);
    this.addWallX(x1 + 0.2, z0 - 0.2, z1, 0, 4.8, 0x424f45);
    this.addWallZ(z0 - 0.2, x0 - 0.2, x1 + 0.2, 0, 4.8, 0x39453c);
    this.addFloor(x0 - 0.2, x1 + 0.2, z0 - 0.2, z1, 4.8, 0.3, 0x39453c, { edge: false });
    // 两层墙在 z=-31.4 处相接，避免门洞两侧的共面重叠引起闪烁。
    const frontWallZ = z1 - 0.4;
    this.addWallZ(frontWallZ, x0 - 0.2, 4.0, 0, 4.8, 0x424f45);
    this.addWallZ(frontWallZ, 7.4, x1 + 0.2, 0, 4.8, 0x424f45);
    this.addWallZ(frontWallZ, 4.0, 7.4, 3.4, 4.8, 0x424f45);

    // terminal
    this.addBox(5.5, 0.9, -37.1, 3.6, 1.8, 1.2, 0x26322b);
    this.addBox(5.5, 1.25, -36.9, 3.2, 0.16, 1.0, 0x34443a);
    this.addBox(5.5, 2.0, -37.35, 2.0, 1.3, 0.12, 0x18241d);
    const terminal = this.addSign(secretTexture(), 1.8, 1.2, 5.5, 2.0, -37.28);
    terminal.name = "terminal";
    this.interactables.push({
      id: "terminal",
      object: terminal,
      label: "读取留言",
      maxDistance: 3.2,
    });
    this.registerSignal("terminal", terminal, signalTexture("工作线索", [
      "Vite · Webpack · Axios · WebSocket",
      "组件封装与接口联调",
      "在真实业务里把复杂信息做清楚。",
    ], true));

    // desk chair
    this.addBox(5.5, 0.58, -35.5, 1.0, 0.16, 1.0, C.black);
    this.addBox(5.5, 1.12, -35.0, 1.0, 1.0, 0.14, C.black);

    // poster
    this.addSign(secretTexture(), 2.0, 2.0, 9.32, 2.5, -34.4, -Math.PI / 2);

    // The room is sealed from the sky, so it needs its own permanent fill
    // lights rather than relying on the night-scaled exterior lamp pool.
    // 顶板底面为 4.5m，灯具留出间距，避免嵌入顶板或共面闪烁。
    const ceilingLightY = 4.4;
    for (const x of [3.4, 7.6]) {
      this.addBox(x, ceilingLightY, -34.4, 1.35, 0.08, 0.55, 0xffe5b8, {
        glow: true,
        solid: false,
        edge: false,
      });
    }
    const fill = new THREE.PointLight(0xffd9a8, 55, 14, 2);
    fill.position.set(5.5, 3.35, -34.4);
    this.group.add(fill);
    const entryFill = new THREE.PointLight(0xffd9a8, 20, 8, 2);
    entryFill.position.set(5.5, 2.3, -31.8);
    this.group.add(entryFill);
    const deskFill = new THREE.PointLight(0xffcf9a, 28, 8, 2);
    deskFill.position.set(5.5, 2.6, -36.8);
    this.group.add(deskFill);

    // Green accent at the terminal.
    this.addBox(5.5, ceilingLightY, -36.0, 2.6, 0.1, 0.24, 0x7dffb0, { glow: true, solid: false });
    const glow = new THREE.PointLight(0x72ffad, 2.4, 8, 2);
    glow.position.set(5.5, 2.7, -36.5);
    this.group.add(glow);
    this.poolLights.push(glow);
    this.poolLightBase.push(2.4);
  }

  private buildArcade() {
    // A hidden cabinet in the room behind the bookshelf.
    this.addBox(1.75, 1.02, -35.5, 0.9, 2.04, 1.5, C.black, { tag: "arcade-body" });
    this.addBox(2.24, 0.92, -35.5, 0.12, 0.12, 1.15, C.metalLight);
    this.addBox(1.74, 2.22, -35.5, 1.02, 0.26, 1.62, C.metal);
    this.addBox(1.7, 2.42, -35.5, 0.92, 0.1, 1.5, C.orange, { glow: true, solid: false });

    const screen = this.addSign(
      arcadeTexture(),
      1.02,
      0.94,
      2.23,
      1.48,
      -35.5,
      Math.PI / 2,
    );
    screen.name = "arcade-screen";
    this.interactables.push({
      id: "arcade",
      object: screen,
      label: "投币 · 玩 XIA RUNNER",
      maxDistance: 3.4,
    });

    // Joystick and two chunky buttons.
    this.addBox(2.28, 1.02, -35.1, 0.1, 0.18, 0.1, C.lime, { solid: false, edge: false });
    this.addBox(2.28, 1.02, -35.78, 0.1, 0.12, 0.1, C.orange, { solid: false, edge: false });
    this.addBox(2.28, 1.02, -35.56, 0.1, 0.12, 0.1, 0x9fe6ff, { solid: false, edge: false });

    const light = new THREE.PointLight(0x9fe6ff, 2.2, 6, 2);
    light.position.set(2.8, 2.2, -35.5);
    this.group.add(light);
    this.poolLights.push(light);
    this.poolLightBase.push(2.2);
  }

  private buildCinema() {
    // A rooftop projection screen facing the deck.
    const screen = this.addSign(cinemaTexture(), 5.8, 3.1, -9.72, 9.05, -24, Math.PI / 2);
    screen.name = "cinema-screen";
    this.interactables.push({
      id: "cinema",
      object: screen,
      label: "放映 · 天台影院",
      maxDistance: 4.6,
    });

    this.addBox(-9.85, 9.05, -24, 0.12, 3.5, 6.2, C.black, { solid: false });
    this.addBox(-9.7, 10.92, -24, 0.24, 0.14, 6.4, C.metal);
    this.addBox(-9.7, 7.18, -24, 0.24, 0.14, 6.4, C.metal);

    // Projector on a small stand. The cinema is on the rooftop deck, so all
    // equipment sits above the deck instead of being buried in the studio shell.
    this.addBox(7.1, 8.06, -24, 0.7, 1.1, 0.7, C.metal, { tag: "rooftop-cinema" });
    this.addBox(7.1, 8.71, -24, 0.9, 0.34, 0.65, 0x222a28, { tag: "rooftop-cinema" });
    // The lens sits on the west face of the projector housing, aimed at the screen.
    this.addBox(6.62, 8.73, -24, 0.1, 0.18, 0.3, 0xcfefff, {
      glow: true,
      solid: false,
      edge: false,
    });
    const lamp = new THREE.PointLight(0xcfefff, 0.9, 8, 2);
    lamp.position.set(6.55, 8.8, -24);
    this.group.add(lamp);
    this.poolLights.push(lamp);
    this.poolLightBase.push(0.9);

    // A pair of low seats for the screening. Their backrests face away from
    // the west-facing screen so the viewer sits looking toward the picture.
    for (const z of [-26.2, -21.8]) {
      this.addBox(-2.2, 7.72, z, 2.2, 0.42, 1.1, C.woodDark, { tag: "rooftop-cinema" });
      this.addBox(-1.2, 8.25, z, 0.18, 1.3, 1.1, C.woodDark, { tag: "rooftop-cinema" });

      // 座椅本体是 InstancedMesh 里的一块，没有独立对象可拾取，所以每张椅子配一个
      // 拾取代理：material.visible = false 让它不渲染，raycast 仍然能命中。
      // 代理贴在靠背东面（x = -1.2 那块），做成一块高 2.8 的立板：从过道走近时
      // 眼高 9.13，站到座面上是 9.55，两种高度都能被这块板接住。
      const seatProxy = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 2.8, 1.1),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      seatProxy.position.set(-1.08, 8.9, z);
      seatProxy.name = `cinema-seat-${z}`;
      // 坐下后眼睛落在 8.68（座面 7.93 之上 0.75），比站立眼高 9.13 低 45 cm。
      seatProxy.userData.seat = { x: -2.05, y: 7.51, z, yaw: Math.PI / 2, eyeOffset: -0.45 };
      this.group.add(seatProxy);
      this.interactables.push({
        id: "cinema-seat",
        object: seatProxy,
        label: "坐下看电影",
        maxDistance: 2.6,
      });
    }
  }

  /**
   * 天台东南角的 BIM 观测台：一座 1.5 m 见方的体素建筑剪影 + 一块标识牌。
   *
   * 位置刻意选在 (4.8, -19.2)：影院座椅在 x=-2.2、银幕在 x=-9.72、
   * 投影仪在 (7.1, -24)、楼梯口在 x=11.58，这里都避开了，天台中间的
   * 走道和座椅到银幕的视线也不挡。整块走现有 blocks → InstancedMesh 管道，
   * 不新增 draw call。
   */
  private buildBimPavilion() {
    const x = 4.8;
    const z = -19.2;
    const base = 7.51;

    // 底座：一块深色台面把剪影从屋顶上拎出来
    this.addBox(x, base + 0.06, z, 1.9, 0.12, 1.9, C.stoneDark, { tag: "rooftop-bim" });

    // 三层退台：每层向上收进一点，读起来是一栋楼而不是一个方块
    const tiers = [
      { y: 0.42, w: 1.5, d: 1.5, h: 0.72 },
      { y: 1.16, w: 1.22, d: 1.22, h: 0.76 },
      { y: 1.96, w: 0.94, d: 0.94, h: 0.84 },
    ];
    for (const tier of tiers) {
      this.addBox(x, base + tier.y, z, tier.w, tier.h, tier.d, C.glass, { tag: "rooftop-bim" });
    }

    // 核心筒：偏在一角，比退台高出一截
    this.addBox(x - 0.34, base + 1.62, z + 0.34, 0.36, 3.2, 0.36, C.metal, { tag: "rooftop-bim" });

    // 屋顶设备：两台风机组 + 一根天线
    this.addBox(x + 0.22, base + 2.5, z - 0.18, 0.42, 0.22, 0.42, C.metalLight, { tag: "rooftop-bim" });
    this.addBox(x - 0.06, base + 2.72, z + 0.12, 0.3, 0.2, 0.3, C.metalLight, { tag: "rooftop-bim" });
    this.addBox(x - 0.34, base + 3.42, z + 0.34, 0.06, 0.5, 0.06, C.metal, { solid: false, tag: "rooftop-bim" });

    // 标识牌立在南侧，站在天台上从楼梯口方向过来正好读到
    this.addSign(
      signTexture("BIM", "BUILDING MODEL / 构件模型", "#9fe6ff"),
      1.5,
      0.375,
      x,
      base + 0.62,
      z + 1.05,
    );

    // 拾取代理：剪影是 InstancedMesh 里的方块，没有独立对象可命中，
    // 所以立一块不可见的面板接住射线（raycast 不看 material.visible）。
    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 2.6, 1.7),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    proxy.position.set(x, base + 1.3, z);
    proxy.name = "bim-pavilion-proxy";
    this.group.add(proxy);

    this.interactables.push({
      id: "bim",
      object: proxy,
      label: "查看 BIM 建筑模型",
      maxDistance: 4.2,
    });
  }

  private buildRooftop() {
    // deck
    this.addFloor(-10, 10, -31, -17, 7.51, 0.06, 0x928f80, { edge: false, tag: "roof" });
    this.addBox(0, 7.55, -24, 7.6, 0.02, 5.2, 0x7f6a51, { solid: false, edge: false });

    // parapet
    this.addBox(0, 7.95, -31.1, 20.4, 0.8, 0.35, C.wallDark);
    this.addBox(0, 7.95, -16.9, 20.4, 0.8, 0.35, C.wallDark);
    this.addBox(-10.1, 7.95, -24, 0.35, 0.8, 14.4, C.wallDark);
    // Leave a full-width opening where the outside stair meets the roof.
    this.addBox(10.1, 7.95, -23.125, 0.35, 0.8, 12.65, C.wallDark);

    // Stair from the east side, tucked against the studio wall. The outer
    // guard is solid all the way up so it is not possible to slip between the
    // posts, and the landing is enclosed on its exposed north/east sides.
    const steps = 17;
    const stepH = 0.44;
    const stairX = 11.58;
    for (let i = 0; i < steps; i += 1) {
      const top = stepH * (i + 1);
      const z = -17.7 - i * 0.8;
      this.addBox(stairX, top / 2, z, 2.4, top, 0.82, i % 2 === 0 ? C.stone : C.stoneDark);
      this.addBox(12.98, top + 0.55, z, 0.12, 1.1, 0.86, C.metal);
      this.addBox(12.98, top + 1.13, z, 0.18, 0.05, 0.86, C.metalLight, {
        solid: false,
        edge: false,
      });
    }
    // The landing meets the roof deck exactly, without overlapping its top
    // surface. The old overlap caused a thin moving seam at the roof edge.
    this.addBox(11.5, 7.46, -30.425, 3.0, 0.1, 1.25, C.stone);
    this.addBox(13.02, 8.04, -30.425, 0.12, 1.1, 1.25, C.metal);
    this.addBox(13.02, 8.62, -30.425, 0.18, 0.05, 1.25, C.metalLight, {
      solid: false,
      edge: false,
    });
    this.addBox(11.62, 8.04, -31.04, 2.84, 1.1, 0.12, C.metal);
    this.addBox(11.62, 8.62, -31.04, 2.84, 0.05, 0.18, C.metalLight, {
      solid: false,
      edge: false,
    });

    // A readable arrival marker makes the top of the stair feel intentional.
    // It sits above eye height so it never blocks the view when stepping off
    // the final stair.
    this.addBox(10.55, 9.2, -31.02, 0.06, 1.28, 0.06, C.metal, {
      solid: false,
      edge: false,
    });
    this.addBox(12.69, 9.2, -31.02, 0.06, 1.28, 0.06, C.metal, {
      solid: false,
      edge: false,
    });
    this.addBox(11.62, 10.15, -31.02, 2.34, 0.64, 0.06, C.black, { solid: false, edge: false });
    this.addSign(
      signTexture("ROOFTOP", "CINEMA / RADIO / SKY", "#d8ff5f"),
      2.2,
      0.55,
      11.62,
      10.15,
      -30.98,
    );

    // Low, non-solid lights mark the southward shift and westward roof entry.
    for (const z of [-30.7, -30.0]) {
      this.addBox(10.42, 7.54, z, 0.14, 0.08, 0.14, C.lime, {
        glow: true,
        solid: false,
        edge: false,
        tag: "rooftop-entry-marker",
      });
    }

    // telescope
    const scope = new THREE.Group();
    scope.position.set(5.6, 7.5, -27.2);
    scope.name = "telescope";
    const tripodMat = new THREE.MeshStandardMaterial({ color: C.metal, roughness: 0.6 });
    const legGeo = new THREE.CylinderGeometry(0.045, 0.06, 2.3, 6);
    for (let i = 0; i < 3; i += 1) {
      const leg = new THREE.Mesh(legGeo, tripodMat);
      const a = (i / 3) * Math.PI * 2;
      leg.position.set(Math.cos(a) * 0.55, 1.05, Math.sin(a) * 0.55);
      leg.rotation.z = Math.cos(a) * 0.3;
      leg.rotation.x = Math.sin(a) * 0.3;
      scope.add(leg);
    }
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.25, 2.0, 10),
      new THREE.MeshStandardMaterial({ color: 0x273331, roughness: 0.4, metalness: 0.2 }),
    );
    tube.rotation.x = Math.PI / 2.4;
    tube.position.set(0, 2.15, 0.2);
    scope.add(tube);
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.19, 16),
      new THREE.MeshBasicMaterial({ color: 0xa6d8df }),
    );
    lens.position.set(0, 2.52, 1.2);
    lens.rotation.x = -Math.PI / 2.7;
    scope.add(lens);
    scope.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    this.group.add(scope);
    this.telescopeModel = scope;
    this.telescopeInteractable = {
      id: "telescope",
      object: scope,
      label: "用望远镜看信号星座",
      maxDistance: 3.6,
    };
    this.interactables.push(this.telescopeInteractable);
    this.buildSignalConstellation();

    // radio
    const radio = new THREE.Group();
    radio.position.set(2.0, 7.5, -19.6);
    radio.name = "radio";
    // 电台面板原本背对天台入口，转 180° 让屏幕和旋钮朝向走上天台的一侧。
    radio.rotation.y = Math.PI;
    const radioBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.0, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x9d5d3d, roughness: 0.8 }),
    );
    radioBody.position.y = 0.62;
    radio.add(radioBody);
    const speaker = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 16),
      new THREE.MeshBasicMaterial({ color: 0x2a211b }),
    );
    speaker.position.set(-0.28, 0.62, 0.36);
    radio.add(speaker);
    const dial = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 0.12),
      new THREE.MeshBasicMaterial({ map: radioTunerTexture(), toneMapped: false }),
    );
    dial.position.set(0.32, 0.8, 0.392);
    radio.add(dial);
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 1.2, 5),
      new THREE.MeshBasicMaterial({ color: 0xb8c3bb }),
    );
    antenna.position.set(0.55, 1.55, 0);
    antenna.rotation.z = -0.22;
    radio.add(antenna);

    // Make the set read as a real weather radio instead of an anonymous prop.
    // The little display, LED and level bars all react when it is switched on.
    this.addSign(
      signTexture("88.7", "RAIN RADIO / 天气电台", "#ff8a4c"),
      0.72,
      0.18,
      2.28,
      7.98,
      -19.965,
      Math.PI,
    );
    const ledMaterial = new THREE.MeshBasicMaterial({ color: 0x2b332c });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), ledMaterial);
    led.position.set(0.55, 0.6, 0.37);
    radio.add(led);
    this.radioLed = led;

    for (let i = 0; i < 4; i += 1) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.18, 0.03),
        new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? C.lime : 0xffb36b,
          toneMapped: false,
        }),
      );
      bar.position.set(0.08 + i * 0.11, 0.64, 0.37);
      bar.scale.y = 0.18;
      radio.add(bar);
      this.radioBars.push(bar);
    }

    const radioLight = new THREE.PointLight(0xffb27a, 0, 5, 2);
    radioLight.position.set(0, 1.35, 0.35);
    radio.add(radioLight);
    this.radioLight = radioLight;

    this.group.add(radio);
    this.interactables.push({
      id: "radio",
      object: radio,
      label: "打开电台",
      maxDistance: 3.6,
    });

    this.addBench(-5.2, 7.5, -19.7, 1);

    // Planters frame the deck while keeping the stair landing and its westward turn clear.
    for (const [x, z] of [[-8.2, -29.6], [8.2, -20.4]]) {
      this.addBox(x, 7.75, z, 1.4, 0.5, 1.4, C.woodDark);
      this.addBox(x, 8.35, z, 1.8, 1.4, 1.8, C.leafDark, { solid: false });
    }

    // neon sign
    const neon = this.addSign(neonTexture("HOME"), 6.2, 1.9, 0, 9.25, -30.88, 0, true);
    neon.name = "neon-home";
    const neonMat = neon.material as THREE.MeshBasicMaterial;
    neonMat.blending = THREE.AdditiveBlending;
    neonMat.depthWrite = false;

    // string lights along the parapet
    for (let i = -9; i <= 9; i += 3) {
      this.addBox(i, 8.42, -31.05, 0.16, 0.16, 0.16, 0xffe0a8, {
        glow: true,
        solid: false,
      });
    }
  }

  /** Builds a small, raycastable signal path whose text stays aligned with the public profile. */
  private buildSignalConstellation() {
    const spaceCross = {
      ...SIGNALS.space,
      index: `${SIGNALS.space.index} · ${SIGNALS.cross.index}`,
      label: `${SIGNALS.space.label} / ${SIGNALS.cross.label}`,
      title: `${SIGNALS.space.title} · ${SIGNALS.cross.title}`,
      body: `${SIGNALS.space.body} ${SIGNALS.cross.body}`,
      tags: [...SIGNALS.space.tags, ...SIGNALS.cross.tags],
    };
    const entries: Array<{
      id: SignalId;
      position: [number, number, number];
      copy: typeof SIGNALS.interface;
    }> = [
      { id: "interface", position: [2.4, 15.0, -10.5], copy: SIGNALS.interface },
      { id: "data", position: [5.6, 15.8, -10.5], copy: SIGNALS.data },
      { id: "space", position: [8.8, 15.0, -10.5], copy: spaceCross },
    ];
    const highQuality = this.quality === "high";
    const sphereSegments = highQuality ? 14 : 8;
    const coreGeometry = new THREE.SphereGeometry(0.16, sphereSegments, sphereSegments);
    const haloGeometry = new THREE.SphereGeometry(1, sphereSegments, sphereSegments);
    const hitGeometry = new THREE.SphereGeometry(1.3, 8, 6);
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xf1ffb3, toneMapped: false });
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: C.lime,
      transparent: true,
      opacity: highQuality ? 0.16 : 0,
      depthWrite: false,
      toneMapped: false,
    });
    const hitMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.signalConstellation.name = "rooftop-signal-constellation";
    this.signalConstellation.visible = false;
    this.group.add(this.signalConstellation);

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!;
      const [x, y, z] = entry.position;
      const position = new THREE.Vector3(x, y, z);
      const object = new THREE.Group();
      object.name = `signal-star-${entry.id}`;
      object.position.copy(position);
      object.visible = false;

      const core = new THREE.Mesh(coreGeometry, coreMaterial);
      core.userData.noShadow = true;
      object.add(core);

      const halo = new THREE.Mesh(haloGeometry, haloMaterial);
      halo.scale.setScalar(0.36);
      halo.visible = highQuality;
      halo.userData.noShadow = true;
      object.add(halo);

      const hitArea = new THREE.Mesh(hitGeometry, hitMaterial);
      hitArea.userData.noShadow = true;
      object.add(hitArea);

      const id = `signal-${entry.id}`;
      // 星点只做取景目标。文字不再贴成 3D 平面：24° 视野下那块贴图必然发糊，
      // 内容改由 DOM 目镜面板渲染，任何分辨率下都清晰。
      this.signalReadings.set(id, entry.copy);
      const interactable: Interactable = {
        id,
        object,
        label: `信号 · ${entry.copy.label}`,
        maxDistance: 35,
      };
      this.signalConstellation.add(object);
      this.signalStarPositions.push(position);
      this.signalStars.push({ object, core, halo, interactable, phase: index * 0.8 });
    }

    const segmentsPerLink = highQuality ? 14 : 5;
    const linePositions: number[] = [];
    for (let link = 0; link < this.signalStarPositions.length - 1; link += 1) {
      const start = this.signalStarPositions[link]!;
      const end = this.signalStarPositions[link + 1]!;
      for (let step = 0; step < segmentsPerLink; step += 1) {
        const fromT = step / segmentsPerLink;
        const toT = (step + 1) / segmentsPerLink;
        const from = start.clone().lerp(end, fromT);
        const to = start.clone().lerp(end, toT);
        from.y += Math.sin(fromT * Math.PI) * 0.38;
        to.y += Math.sin(toT * Math.PI) * 0.38;
        linePositions.push(from.x, from.y, from.z, to.x, to.y, to.z);
      }
    }
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    lineGeometry.setDrawRange(0, 0);
    this.signalConstellationLineMaterial = new THREE.LineBasicMaterial({
      color: C.lime,
      transparent: true,
      opacity: highQuality ? 0.78 : 0.42,
      depthWrite: false,
      toneMapped: false,
    });
    this.signalConstellationLine = new THREE.LineSegments(lineGeometry, this.signalConstellationLineMaterial);
    this.signalConstellationLine.frustumCulled = false;
    this.signalConstellationLine.userData.noShadow = true;
    this.signalConstellation.add(this.signalConstellationLine);

    if (highQuality) {
      this.signalPulse = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      );
      this.signalPulse.visible = false;
      this.signalPulse.userData.noShadow = true;
      this.signalConstellation.add(this.signalPulse);
    }
  }

  private buildPond() {
    const cx = 22;
    const cz = 24;
    this.addBox(cx, 0.2, cz - 3.8, 12.4, 0.4, 0.6, C.stone);
    this.addBox(cx, 0.2, cz + 3.8, 12.4, 0.4, 0.6, C.stone);
    this.addBox(cx - 5.9, 0.2, cz, 0.6, 0.4, 7.0, C.stone);
    this.addBox(cx + 5.9, 0.2, cz, 0.6, 0.4, 7.0, C.stone);
    this.addWater(cx, 0.24, cz, 11.2, 7.0);

    // rocks
    for (const [x, z, s] of [
      [17.1, 21.2, 1.3],
      [26.5, 26.4, 1.6],
      [18.2, 26.6, 0.9],
      [26.2, 21.0, 1.1],
    ]) {
      this.addBox(x, 0.35, z, s, 0.7, s * 0.8, C.stoneDark, { edge: false });
    }

    // reeds
    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * Math.PI * 2;
      const x = cx + Math.cos(a) * (4.8 + (i % 3) * 0.5);
      const z = cz + Math.sin(a) * (2.8 + (i % 2) * 0.4);
      this.addBox(x, 0.8, z, 0.08, 1.3 + (i % 4) * 0.18, 0.08, C.leaf, {
        solid: false,
        edge: false,
      });
    }

    // lily pads
    for (const [x, z] of [
      [19.2, 23.2],
      [23.6, 25.1],
      [25.0, 22.4],
      [20.6, 26.0],
    ]) {
      this.addBox(x, 0.3, z, 0.9, 0.03, 0.9, 0x4d8a4d, { solid: false, edge: false });
    }
  }

  private addWater(cx: number, top: number, cz: number, w: number, d: number) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), this.waterMaterial);
    mesh.position.set(cx, top, cz);
    mesh.receiveShadow = true;
    mesh.userData.noShadow = true;
    this.group.add(mesh);
    this.waterMeshes.push(mesh);
  }

  private createFountain() {
    const water = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.14, 6.0), this.waterMaterial);
    water.position.set(0, 0.68, 0);
    water.receiveShadow = true;
    water.userData.noShadow = true;
    this.group.add(water);
    this.waterMeshes.push(water);

    const jetMat = new THREE.MeshBasicMaterial({
      color: 0xa9e4ec,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      toneMapped: false,
    });
    for (const [x, z] of [
      [-1.2, -1.2],
      [1.2, -1.2],
      [-1.2, 1.2],
      [1.2, 1.2],
    ]) {
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), jetMat);
      jet.position.set(x, 1.15, z);
      jet.userData.noShadow = true;
      this.group.add(jet);
      this.fountainJets.push(jet);
    }
  }

  private createDuck() {
    const duck = new THREE.Group();
    duck.position.set(25.6, 0.35, 24.1);
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf2cc4f, roughness: 0.7 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xe07b35, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.42, 0.55), yellow);
    body.position.y = 0.21;
    duck.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.4), yellow);
    head.position.set(0.28, 0.56, 0);
    duck.add(head);
    const beak = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.2), orange);
    beak.position.set(0.55, 0.52, 0);
    duck.add(beak);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xfbf7ea });
    // 头是 0.42 的方块，z 半宽 0.21。眼睛必须贴在头侧面之外才看得见：
    // 眼白中心 z=±0.215（厚 0.03，外露 0.02），瞳孔再往外一点。
    for (const z of [-0.215, 0.215]) {
      const white = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.03), eyeWhiteMat);
      white.position.set(0.36, 0.63, z);
      duck.add(white);
      const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), eyeMat);
      pupil.position.set(0.365, 0.635, z + Math.sign(z) * 0.018);
      duck.add(pupil);
    }
    duck.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.castShadow = true;
    });
    this.group.add(duck);
    this.duck = duck;
    this.duckBaseY = duck.position.y;
    // 鸭子只有 0.42 高、还一直在水面游，准星很难精确压住它。挂一个跟着鸭子走的
    // 不可见代理，把可交互体积撑到 1.6³（世界 y 约 0.37..1.97）：从岸边站立
    // 眼高 2.02 往下看，任何俯角都能命中；作为 duck 的子节点，鸭子游到哪它跟到哪。
    const duckHit = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.6, 1.6),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    duckHit.position.set(0, 0.8, 0);
    duckHit.name = "duck-hit";
    duck.add(duckHit);
    this.interactables.push({
      id: "duck",
      object: duckHit,
      label: "喂鸭子",
      maxDistance: 3.0,
    });
  }

  pokeDuck() {
    this.duckPoke = 1.4;
  }

  /**
   * 撒一把面包屑。落点取鸭子身边一点（不直接压在鸭子身上，否则它会原地打转），
   * 鸭子和鱼群在接下来 3 秒里往这里靠；第三次喂食返回 true 让 engine 解锁彩蛋。
   *
   * @param from 玩家位置，用来决定从哪个方向撒，让落点落在鸭子靠玩家的一侧
   * @returns 这是第几次喂食，达到 3 次时返回 true 表示应当记彩蛋
   */
  feedDuck(from: THREE.Vector3): boolean {
    // 落点：在鸭子和玩家之间取中点，再限制在水面范围内，免得面包屑撒到岸上。
    // 水面是 addWater(22, 0.24, 24, 11.2, 7.0) → x 16.4..27.6 / z 20.5..27.5，
    // 两边各留 0.5 的余量，让面包屑落在水上而不是池沿上。
    const px = this.duck ? this.duck.position.x : 17.7;
    const pz = this.duck ? this.duck.position.z : 24.1;
    const tx = THREE.MathUtils.clamp((px + from.x) / 2, 16.9, 27.1);
    const tz = THREE.MathUtils.clamp((pz + from.z) / 2, 21.0, 27.0);
    this.feedPoint.set(tx, 0.3, tz);
    this.feedTimer = 3;
    this.feedCount += 1;
    this.pokeDuck();
    this.spawnCrumbs(tx, tz);
    return this.feedCount >= 3;
  }

  /** 面包屑粒子：低画质减半，都落在水面上随水轻微浮动。 */
  private spawnCrumbs(x: number, z: number) {
    if (this.crumbs) {
      this.group.remove(this.crumbs.points);
      this.crumbs.points.geometry.dispose();
      (this.crumbs.points.material as THREE.Material).dispose();
    }
    const count = this.quality === "high" ? 36 : 18;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      // 撒成一个半径 0.9 的圆盘，都贴着水面（y 0.30~0.34），不会飞到岸上。
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.9;
      positions[i * 3] = x + Math.cos(a) * r;
      positions[i * 3 + 1] = 0.31 + Math.random() * 0.03;
      positions[i * 3 + 2] = z + Math.sin(a) * r;
      velocities[i * 3] = (Math.random() - 0.5) * 0.06;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.06;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xe8cfa0,
      size: 0.07,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.name = "bread-crumbs";
    points.userData.noShadow = true;
    this.group.add(points);
    this.crumbs = { points, velocities, life: 3.2 };
  }

  private updateCrumbs(dt: number) {
    if (!this.crumbs) return;
    this.crumbs.life -= dt;
    const { points, velocities, life } = this.crumbs;
    const mat = points.material as THREE.PointsMaterial;
    if (life <= 0) {
      this.group.remove(points);
      points.geometry.dispose();
      mat.dispose();
      this.crumbs = undefined;
      return;
    }
    // 最后 0.8 秒淡出，避免面包屑突然消失。
    mat.opacity = Math.min(1, life / 0.8);
    const pos = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += velocities[i] * dt;
      arr[i + 2] += velocities[i + 2] * dt;
    }
    pos.needsUpdate = true;
  }

  private createFish() {
    const palette = [0xf28c45, 0xf2d36b, 0x9fd8e8, 0xe8e2d0, 0xe07b6a];
    const paths = [
      { phase: 0.4, radiusX: 3.2, radiusZ: 1.2, speed: 0.35 },
      { phase: 2.2, radiusX: 2.2, radiusZ: 1.5, speed: -0.3 },
      { phase: 4.1, radiusX: 3.8, radiusZ: 0.9, speed: 0.28 },
      { phase: 5.6, radiusX: 2.6, radiusZ: 1.7, speed: -0.42 },
      { phase: 1.5, radiusX: 3.0, radiusZ: 1.0, speed: 0.46 },
    ];

    paths.forEach((path, index) => {
      const fish = new THREE.Group();
      fish.name = "pond-fish";
      const color = palette[index % palette.length];
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 8, 6),
        new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 }),
      );
      body.scale.set(1.7, 0.55, 0.65);
      fish.add(body);

      const tail = new THREE.Mesh(
        new THREE.ConeGeometry(0.11, 0.22, 3),
        new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
      );
      tail.rotation.z = -Math.PI / 2;
      tail.position.x = -0.28;
      fish.add(tail);

      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
      for (const z of [-0.05, 0.05]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), eyeMat);
        eye.position.set(0.2, 0.025, z);
        fish.add(eye);
      }

      fish.position.set(22 + Math.cos(path.phase) * path.radiusX, 0.24, 24 + Math.sin(path.phase) * path.radiusZ);
      fish.rotation.y = Math.atan2(
        -Math.cos(path.phase) * path.radiusZ * path.speed,
        -Math.sin(path.phase) * path.radiusX * path.speed,
      );
      fish.userData.noShadow = true;
      this.group.add(fish);
      this.fishLife.push({ group: fish, tail, ...path });
    });
  }

  private buildTrees() {
    const trees: [number, number, number][] = [
      [-17, 16, 1.1],
      [16, 16, 0.95],
      [-20, -10, 1.0],
      [20, -10, 0.9],
      [-38, 20, 1.2],
      [38, 20, 1.1],
      [-38, -20, 1.0],
      [38, -20, 1.15],
      [8, 35, 1.0],
      [-10, 35, 0.9],
      [34, 35, 1.2],
      [-42, 39, 0.85],
      [34, -12, 1.05],
      [-34, 11, 1.0],
    ];
    trees.forEach(([x, z, s], index) => {
      const h = 3.2 * s;
      this.addBox(x, h / 2, z, 0.9 * s, h, 0.9 * s, C.woodDark, { edge: false });
      const leafY = h + 0.55 * s;
      const leafColor = index % 2 === 0 ? C.leaf : C.leafDark;
      this.addBox(x, leafY, z, 3.3 * s, 1.35 * s, 3.3 * s, leafColor, {
        solid: false,
        edge: false,
      });
      this.addBox(x + 0.4 * s, leafY + 1.0 * s, z - 0.3 * s, 2.4 * s, 1.1 * s, 2.4 * s, C.leafLight, {
        solid: false,
        edge: false,
      });
      this.addBox(x - 0.7 * s, leafY + 1.65 * s, z + 0.4 * s, 1.5 * s, 0.9 * s, 1.5 * s, C.leaf, {
        solid: false,
        edge: false,
      });
    });

    // bushes and small flowers near paths
    for (const [x, z] of [
      [-11.5, 16.5],
      [11.8, 17.4],
      [-14.5, -6.5],
      [14.6, -6.2],
      [28.5, 14.2],
      [-28.5, 14.0],
    ]) {
      this.addBox(x, 0.6, z, 1.8, 1.2, 1.5, C.leafDark, { solid: false, edge: false });
      this.addBox(x + 0.4, 1.0, z - 0.2, 1.1, 0.7, 1.0, C.leaf, { solid: false, edge: false });
    }
  }

  private buildLamps() {
    this.poolMaterial = new THREE.MeshBasicMaterial({
      map: radialTexture("rgba(255,216,150,0.85)", "rgba(255,216,150,0)"),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    const positions: [number, number][] = [
      [-10.5, -10.5],
      [10.5, -10.5],
      [-10.5, 10.5],
      [10.5, 10.5],
      [-7.2, 19],
      [13.5, -7.2],
      [-13.5, -7.2],
      [17.5, 12.5],
      [30, 12.5],
      [-17.5, 12.5],
      [-30, 12.5],
    ];

    for (const [x, z] of positions) {
      this.addBox(x, 2.1, z, 0.22, 4.2, 0.22, C.metal);
      this.addBox(x, 4.25, z, 0.42, 0.42, 0.42, 0xffd89a, { glow: true, solid: false });
      this.addBox(x, 4.48, z, 0.72, 0.1, 0.72, C.metal);

      const pool = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 7.5), this.poolMaterial);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, 0.09, z);
      pool.userData.noShadow = true;
      this.group.add(pool);
    }
  }

  private buildPerimeter() {
    // hedges keep the player inside the diorama
    this.addBox(0, 1.6, 49.2, 100, 3.2, 2.2, C.leafDark, { edge: false });
    this.addBox(0, 1.6, -49.2, 100, 3.2, 2.2, C.leafDark, { edge: false });
    this.addBox(49.2, 1.6, 0, 2.2, 3.2, 100, C.leafDark, { edge: false });
    this.addBox(-49.2, 1.6, 0, 2.2, 3.2, 100, C.leafDark, { edge: false });

    // distant hills, outside the hedge
    const hills: [number, number, number, number, number, number][] = [
      [-62, 3, -32, 34, 8, 30],
      [62, 4, -28, 36, 10, 34],
      [-58, 2, 34, 30, 6, 26],
      [58, 3, 34, 32, 8, 28],
      [0, 2, -68, 42, 7, 22],
      [0, 3, 68, 46, 9, 24],
    ];
    for (const [x, y, z, w, h, d] of hills) {
      this.addBox(x, y, z, w, h, d, C.grassDark, { solid: false, edge: false });
      this.addBox(x - w * 0.2, y + h * 0.5, z - d * 0.2, w * 0.45, h * 0.4, d * 0.4, C.grassLight, {
        solid: false,
        edge: false,
      });
    }
  }

  private createStaticMeshes(quality: Quality) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(geo, mat, this.blocks.length);
    mesh.name = "static-blocks";
    mesh.frustumCulled = false;
    mesh.castShadow = quality === "high";
    mesh.receiveShadow = true;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();

    this.blocks.forEach((b, i) => {
      pos.set(b.cx, b.cy, b.cz);
      scale.set(b.w, b.h, b.d);
      m.compose(pos, q, scale);
      mesh.setMatrixAt(i, m);
      const jitter = 0.94 + (Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1) * 0.1;
      color.setHex(b.color).multiplyScalar(jitter);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);

    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      toneMapped: false,
      depthWrite: true,
    });
    const glow = new THREE.InstancedMesh(geo, this.glowMaterial, this.glowBlocks.length);
    glow.name = "glow-blocks";
    glow.frustumCulled = false;
    glow.userData.noShadow = true;
    this.glowBlocks.forEach((b, i) => {
      pos.set(b.cx, b.cy, b.cz);
      scale.set(b.w, b.h, b.d);
      m.compose(pos, q, scale);
      glow.setMatrixAt(i, m);
      color.setHex(b.color);
      glow.setColorAt(i, color);
    });
    glow.instanceMatrix.needsUpdate = true;
    if (glow.instanceColor) glow.instanceColor.needsUpdate = true;
    this.group.add(glow);

    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(this.edgePositions, 3));
    const edges = new THREE.LineSegments(
      edgeGeo,
      new THREE.LineBasicMaterial({
        color: 0x142018,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    );
    edges.name = "block-edges";
    edges.frustumCulled = false;
    this.group.add(edges);
  }

  private createBall() {
    const mat = new THREE.MeshStandardMaterial({
      map: ballTexture(),
      roughness: 0.72,
      metalness: 0.02,
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.27, 22, 16), mat);
    ball.position.set(26, 0.47, 2);
    ball.castShadow = true;
    ball.name = "basketball";
    this.group.add(ball);
    this.ball = ball;
    this.interactables.push({
      id: "ball",
      object: ball,
      label: "投篮",
      maxDistance: 4.6,
    });
  }

  // ------------------------------------------------------------ interaction

  shootBall() {
    if (this.ballFlying) return;
    let target = this.rimPositions[0];
    let best = Infinity;
    for (const rim of this.rimPositions) {
      const d = rim.distanceToSquared(this.ball.position);
      if (d < best) {
        best = d;
        target = rim;
      }
    }
    const aimX = target.x + (Math.random() - 0.5) * 0.52;
    const aimZ = target.z + (Math.random() - 0.5) * 0.52;
    const dx = aimX - this.ball.position.x;
    const dz = aimZ - this.ball.position.z;
    const dy = target.y + 0.12 - this.ball.position.y;
    const time = 0.92 + Math.sqrt(dx * dx + dz * dz) * 0.028;
    const g = 20;
    this.ballVelocity.set(dx / time, (dy + 0.5 * g * time * time) / time, dz / time);
    this.ballFlying = true;
    this.ballScored = false;
    this.ballResetTimer = 0;
    this.ballRestTimer = 0;
  }

  /**
   * Keeps a detail texture beside the mounted material so E can reveal information in-world without opening a separate panel.
   */
  private registerSignal(id: string, surface: THREE.Mesh, detail: THREE.CanvasTexture) {
    const material = surface.material as THREE.MeshBasicMaterial;
    const base = material.map;
    if (!base) {
      detail.dispose();
      return;
    }
    this.signalSurfaces.set(id, { material, base, detail, open: false });
  }

  /** 开关只重置既有对象；星点显现后才加入射线列表，避免隐藏对象仍可被瞄准。 */
  toggleSignalConstellation(): boolean {
    if (this.signalStars.length === 0) return false;
    this.signalConstellationOpen = !this.signalConstellationOpen;
    this.signalConstellationElapsed = 0;
    this.signalConstellation.visible = this.signalConstellationOpen;
    this.signalStars.forEach((star) => {
      const index = this.interactables.indexOf(star.interactable);
      if (index !== -1) this.interactables.splice(index, 1);
      star.object.visible = false;
    });
    this.signalConstellationLine?.geometry.setDrawRange(0, 0);
    if (this.signalPulse) this.signalPulse.visible = false;
    if (this.telescopeInteractable) {
      this.telescopeInteractable.label = this.signalConstellationOpen
        ? "关闭信号星座 · 恢复视野"
        : "用望远镜看信号星座";
    }
    if (this.signalConstellationOpen) this.updateSignalConstellation(0);
    return this.signalConstellationOpen;
  }

  /**
   * 望远镜模式下把镜筒本身藏起来。相机贴近镜筒，24° 窄视野里模型会直接糊在
   * 画面前方挡住星座；第一人称望远镜的常规做法是取景时只留目镜后的画面。
   */
  setTelescopeModelVisible(visible: boolean) {
    if (this.telescopeModel) this.telescopeModel.visible = visible;
  }

  /** Keeps signal content readable while honoring the system's reduced-motion preference. */
  setReducedMotion(reducedMotion: boolean) {
    if (this.reducedMotion === reducedMotion) return;
    this.reducedMotion = reducedMotion;
    this.signalConstellationElapsed = 0;
    if (this.signalConstellationOpen) this.updateSignalConstellation(0);
  }

  /** Advances the constellation only when motion is allowed; reduced motion shows its complete static state. */
  private updateSignalConstellation(dt: number) {
    if (!this.signalConstellationOpen || !this.signalConstellationLine) return;
    if (!this.reducedMotion) this.signalConstellationElapsed += dt;
    const elapsed = this.signalConstellationElapsed;
    const highQuality = this.quality === "high";
    this.signalStars.forEach((star, index) => {
      const visible = this.reducedMotion || elapsed >= index * 0.3;
      star.object.visible = visible;
      if (visible && !this.interactables.includes(star.interactable)) {
        this.interactables.push(star.interactable);
      }
      if (!visible) return;
      star.core.scale.setScalar(!this.reducedMotion && highQuality ? 1 + Math.sin(elapsed * 2.4 + star.phase) * 0.12 : 1);
      star.halo.visible = !this.reducedMotion && highQuality;
      if (!this.reducedMotion && highQuality) {
        star.halo.scale.setScalar(0.38 + Math.sin(elapsed * 2.4 + star.phase) * 0.025);
      }
    });
    const geometry = this.signalConstellationLine.geometry;
    const count = geometry.getAttribute("position").count;
    const progress = this.reducedMotion ? 1 : Math.min(1, elapsed / 0.6);
    geometry.setDrawRange(0, Math.floor((count / 2) * progress) * 2);
    if (this.signalPulse) {
      this.signalPulse.visible = !this.reducedMotion && highQuality && elapsed >= 0.6;
      if (this.signalPulse.visible) {
        const phase = ((elapsed - 0.6) * 0.6) % (this.signalStarPositions.length - 1);
        const link = Math.floor(phase);
        const t = phase - link;
        this.signalPulse.position.copy(this.signalStarPositions[link]!).lerp(this.signalStarPositions[link + 1]!, t);
        this.signalPulse.position.y += Math.sin(t * Math.PI) * 0.38;
      }
    }
  }

  /** True while the telescope constellation is visible and raycastable. */
  get isSignalConstellationOpen() {
    return this.signalConstellationOpen;
  }

  /** Toggles an in-world work signal and reports whether the target is a signal surface. */
  readSignal(id: string): boolean {
    const signal = this.signalSurfaces.get(id);
    if (!signal) return false;
    signal.open = !signal.open;
    signal.material.map = signal.open ? signal.detail : signal.base;
    signal.material.needsUpdate = true;
    return true;
  }

  /** Releases off-material detail textures; the scene disposer owns mounted base resources. */
  disposeSignals() {
    if (this.signalConstellationOpen) this.toggleSignalConstellation();
    this.signalStars.forEach((star) => {
      const index = this.interactables.indexOf(star.interactable);
      if (index !== -1) this.interactables.splice(index, 1);
    });
    for (const signal of this.signalSurfaces.values()) {
      signal.detail.dispose();
      if (signal.material.map === signal.detail) {
        signal.material.map = signal.base;
        signal.material.needsUpdate = true;
      }
    }
    this.signalSurfaces.clear();
    this.signalStars.length = 0;
    this.signalStarPositions.length = 0;
    this.signalConstellationLine = undefined;
    this.signalConstellationLineMaterial = undefined;
    this.signalPulse = undefined;
    this.telescopeInteractable = undefined;
  }

  /**
   * Opens or closes the hidden doorway. Closing is only safe from the studio
   * side: otherwise the player could be sealed inside the secret room or
   * caught by the moving shelf.
   */
  toggleBookshelf(player: THREE.Vector3): "opened" | "closed" | "blocked" {
    const item = this.interactables.find((i) => i.id === "bookshelf");
    if (!this.shelfOpen) {
      this.shelfOpen = true;
      this.shelfTargetX = 8.1;
      if (item) item.label = "合上书架";
      if (!this.secretRevealed) {
        this.secretRevealed = true;
        this.onSecret?.();
      }
      return "opened";
    }

    const inSecretRoom = player.z < -30.95;
    const inDoorway =
      player.x > 3.5 &&
      player.x < 7.7 &&
      player.z > -31.3 &&
      player.z < -29.55;
    if (inSecretRoom || inDoorway) return "blocked";

    this.shelfOpen = false;
    this.shelfTargetX = 5.7;
    if (item) item.label = "推开书架";
    return "closed";
  }

  setEggCount(n: number) {
    if (this.eggCount === n) return;
    this.eggCount = n;
    this.refreshMonitor();
  }

  private refreshMonitor() {
    if (!this.monitorMaterial) return;
    const old = this.monitorTexture;
    const next = screenTexture(this.scores, this.eggCount);
    const signal = this.signalSurfaces.get("monitor");
    if (signal) {
      signal.base = next;
      if (!signal.open) this.monitorMaterial.map = next;
    } else {
      this.monitorMaterial.map = next;
    }
    this.monitorMaterial.needsUpdate = true;
    this.monitorTexture = next;
    old?.dispose();
  }

  private lightCourt() {
    if (this.courtLit) return;
    this.courtLit = true;
    this.courtLightTarget = 240;
    this.courtOn.forEach((m) => {
      m.visible = true;
    });
    this.courtOff.forEach((m) => {
      m.visible = false;
    });
    this.spawnConfetti();
    this.onCourtLit?.();
  }

  private spawnConfetti() {
    if (this.confetti) {
      this.group.remove(this.confetti.points);
      this.confetti.points.geometry.dispose();
      (this.confetti.points.material as THREE.Material).dispose();
    }
    const count = 140;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const palette = [C.lime, C.orange, 0x9fe6ff, 0xf1ecdf, 0xff6d8a];
    const color = new THREE.Color();
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = 26 + (Math.random() - 0.5) * 14;
      positions[i * 3 + 1] = 7.5 + Math.random() * 2;
      positions[i * 3 + 2] = 2 + (Math.random() - 0.5) * 10;
      velocities[i * 3] = (Math.random() - 0.5) * 4;
      velocities[i * 3 + 1] = 1 + Math.random() * 5;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 4;
      color.setHex(palette[i % palette.length]);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.name = "confetti";
    this.group.add(points);
    this.confetti = { points, velocities, life: 4.6 };
  }

  private updateBall(dt: number) {
    if (!this.ballFlying) {
      if (this.ballRestTimer > 0) {
        this.ballRestTimer -= dt;
        if (this.ballRestTimer <= 0) this.resetBall();
      }
      return;
    }

    const prevY = this.ball.position.y;
    this.ball.position.addScaledVector(this.ballVelocity, dt);
    this.ballVelocity.y -= 20 * dt;
    this.ball.rotation.x += this.ballVelocity.z * dt * 1.6;
    this.ball.rotation.z -= this.ballVelocity.x * dt * 1.6;

    for (const rim of this.rimPositions) {
      if (
        !this.ballScored &&
        this.ballVelocity.y < 0 &&
        prevY > rim.y &&
        this.ball.position.y <= rim.y + 0.02 &&
        Math.hypot(this.ball.position.x - rim.x, this.ball.position.z - rim.z) < 0.48
      ) {
        this.ballScored = true;
        this.scores += 1;
        this.refreshMonitor();
        this.onScore?.(this.scores);
        this.ballRestTimer = 1.8;
        if (this.scores >= 3) this.lightCourt();
      }
    }

    if (this.ball.position.y < 0.47) {
      this.ball.position.y = 0.47;
      if (Math.abs(this.ballVelocity.y) > 1.2) this.ballVelocity.y *= -0.55;
      else this.ballVelocity.y = 0;
      this.ballVelocity.x *= 0.84;
      this.ballVelocity.z *= 0.84;
      if (this.ballVelocity.lengthSq() < 0.35) {
        this.ballVelocity.set(0, 0, 0);
        this.ballFlying = false;
        if (!this.ballScored) this.ballRestTimer = 1.6;
      }
    }

    this.ballResetTimer += dt;
    if (
      this.ballResetTimer > 8 ||
      this.ball.position.x < 12 ||
      this.ball.position.x > 40 ||
      this.ball.position.z < -9 ||
      this.ball.position.z > 13
    ) {
      this.resetBall();
    }
  }

  private resetBall() {
    this.ball.position.set(26, 0.47, 2);
    this.ballVelocity.set(0, 0, 0);
    this.ball.rotation.set(0, 0, 0);
    this.ballFlying = false;
    this.ballScored = false;
    this.ballResetTimer = 0;
    this.ballRestTimer = 0;
  }

  setRadioOn(on: boolean) {
    this.radioOn = on;
    if (this.radioLight) this.radioLight.intensity = on ? 1.8 : 0;
    if (this.radioLed) {
      const material = this.radioLed.material as THREE.MeshBasicMaterial;
      material.color.setHex(on ? 0xd8ff5f : 0x2b332c);
    }
    const item = this.interactables.find((i) => i.id === "radio");
    if (item) item.label = on ? "关闭电台" : "打开电台";
  }

  setNight(night: number) {
    const n = THREE.MathUtils.clamp(night, 0, 1);
    if (this.glowMaterial) this.glowMaterial.opacity = 0.28 + n * 0.72;
    if (this.poolMaterial) this.poolMaterial.opacity = n * 0.3;
    this.poolLights.forEach((light, i) => {
      light.intensity = n * this.poolLightBase[i];
    });
    if (this.courtLit) {
      this.courtLight.intensity = THREE.MathUtils.lerp(
        this.courtLight.intensity,
        this.courtLightTarget,
        0.08,
      );
    }
  }

  update(dt: number, elapsed: number) {
    this.elapsed = elapsed;
    this.updateBall(dt);
    this.updateConfetti(dt);
    this.updateCrumbs(dt);
    this.updateWetness(dt, this.rainAmount);
    this.updateSignalConstellation(dt);
    if (this.shelfGroup) {
      const current = this.shelfGroup.position.x;
      const next = THREE.MathUtils.damp(current, this.shelfTargetX, 5, dt);
      this.shelfGroup.position.x = next;
      if (this.shelfCollider) {
        this.shelfCollider.minX = next - 1.7;
        this.shelfCollider.maxX = next + 1.7;
      }
    }

    if (this.radioLight) {
      this.radioLight.intensity = this.radioOn
        ? 1.35 + Math.sin(elapsed * 7.2) * 0.35
        : 0;
    }
    if (this.radioBars.length > 0) {
      this.radioBars.forEach((bar, i) => {
        const level = this.radioOn
          ? 0.55 + Math.abs(Math.sin(elapsed * (5.2 + i * 1.3) + i * 1.8)) * 0.9
          : 0.16;
        bar.scale.y = level;
      });
    }
    if (this.radioLed) {
      const pulse = this.radioOn ? 1 + Math.sin(elapsed * 4.6) * 0.18 : 1;
      this.radioLed.scale.setScalar(pulse);
    }

    if (this.duck) {
      this.duckPoke = Math.max(0, this.duckPoke - dt);
      const bounce = this.duckPoke > 0 ? Math.sin(this.duckPoke * 18) * 0.16 : 0;
      this.feedTimer = Math.max(0, this.feedTimer - dt);
      // 聚集程度用阻尼过渡：喂食瞬间从 0 涨到 1，3 秒后自己退回 0，鸭子不会瞬移。
      this.feedGather = THREE.MathUtils.damp(this.feedGather, this.feedTimer > 0 ? 1 : 0, 2.6, dt);
      const t = elapsed * 0.22;
      // 巡游中心平时在西岸浅水（鸭子爱在岸边觅食），喂食时被拉向面包屑落点。
      // 池心离西岸 5.6 m，站在岸上够不到 3 m 的交互距离，所以常态就贴着西岸游。
      const homeX = 17.7;
      const homeZ = 24.1;
      const centerX = THREE.MathUtils.lerp(homeX, this.feedPoint.x, this.feedGather);
      const centerZ = THREE.MathUtils.lerp(homeZ, this.feedPoint.z, this.feedGather);
      // 聚集时把巡游半径收小，鸭子才会真的停在落点附近而不是绕着它转大圈。
      const radiusX = THREE.MathUtils.lerp(0.5, 0.3, this.feedGather);
      const radiusZ = THREE.MathUtils.lerp(1.9, 0.25, this.feedGather);
      const duckX = centerX + Math.cos(t) * radiusX;
      const duckZ = centerZ + Math.sin(t) * radiusZ;
      // 水面范围（addWater 是 11.2 x 7.0，中心 22/24），留 0.6 余量让鸭身不越出池沿。
      this.duckPos.set(
        THREE.MathUtils.clamp(duckX, 22 - 5.6 + 0.6, 22 + 5.6 - 0.6),
        this.duckBaseY + Math.sin(elapsed * 2.1) * 0.025 + Math.abs(bounce),
        THREE.MathUtils.clamp(duckZ, 24 - 3.5 + 0.6, 24 + 3.5 - 0.6),
      );
      const dx = -Math.sin(t) * radiusX * 0.22;
      const dz = Math.cos(t) * radiusZ * 0.22;
      this.duck.position.copy(this.duckPos);
      this.duck.rotation.y =
        Math.atan2(-dz, dx) +
        (this.duckPoke > 0 ? Math.sin(this.duckPoke * 20) * 0.8 : 0);
    }

    for (const fish of this.fishLife) {
      const t = fish.phase + elapsed * fish.speed;
      // 鱼也往落点聚：巡游中心向 feedPoint 靠、半径收小，但保留各自相位差，
      // 否则五条鱼会重叠在同一个点上。
      const cx = THREE.MathUtils.lerp(22, this.feedPoint.x, this.feedGather * 0.85);
      const cz = THREE.MathUtils.lerp(24, this.feedPoint.z, this.feedGather * 0.85);
      const rx = THREE.MathUtils.lerp(fish.radiusX, 0.75, this.feedGather);
      const rz = THREE.MathUtils.lerp(fish.radiusZ, 0.55, this.feedGather);
      const x = cx + Math.cos(t) * rx;
      const z = cz + Math.sin(t) * rz;
      const dx = -Math.sin(t) * rx * fish.speed;
      const dz = Math.cos(t) * rz * fish.speed;
      fish.group.position.set(x, 0.235 + Math.sin(elapsed * 1.7 + fish.phase) * 0.015, z);
      fish.group.rotation.y = Math.atan2(-dz, dx);
      fish.tail.rotation.y = Math.sin(elapsed * 6 + fish.phase) * 0.55;
    }

    this.fountainJets.forEach((jet, i) => {
      const s = 0.75 + Math.sin(elapsed * 2.4 + i) * 0.22;
      jet.scale.y = s;
      jet.position.y = 1.0 + s * 0.18;
    });

    if (this.courtLit) {
      this.courtLight.intensity = THREE.MathUtils.lerp(this.courtLight.intensity, 240, 0.06);
    }
  }

  private updateConfetti(dt: number) {
    if (!this.confetti) return;
    const { points, velocities, life } = this.confetti;
    const pos = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < pos.count; i += 1) {
      velocities[i * 3 + 1] -= 6.5 * dt;
      arr[i * 3] += velocities[i * 3] * dt;
      arr[i * 3 + 1] += velocities[i * 3 + 1] * dt;
      arr[i * 3 + 2] += velocities[i * 3 + 2] * dt;
      if (arr[i * 3 + 1] < 0.4) {
        arr[i * 3 + 1] = 0.4;
        velocities[i * 3 + 1] *= -0.3;
      }
    }
    pos.needsUpdate = true;
    this.confetti.life -= dt;
    const mat = points.material as THREE.PointsMaterial;
    mat.opacity = Math.max(0, Math.min(1, this.confetti.life / 1.2));
    if (this.confetti.life <= 0) {
      this.group.remove(points);
      points.geometry.dispose();
      mat.dispose();
      this.confetti = undefined;
    }
  }
}
