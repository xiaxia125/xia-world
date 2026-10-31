import * as THREE from "three";
import type { SignalCopy } from "../signals";
import type { AABB, Interactable, Quality, ShelterZone, WeatherType } from "./types";
/**
 * Builds the walkable Three.js scene and exposes its colliders and interactable surfaces.
 * React owns the surrounding controls; this module keeps world state and rendering-side resources together.
 */
import { screenTexture } from "./textures";
import { applyMixins, BoxSpec, C, WorldBuilder } from "./builders";
import { CAT_SLIDE_BIASES } from "./creatures";
import { WorldCreatures } from "./creatures";
import { CONSTELLATION_STARS } from "./signals";
import { WorldSignals } from "./signals";

/**
 * 鸟的朝向/俯仰辅助。
 *
 * 之前直接用 `atan2(-vz, vx)` 每帧写 yaw。鸟在降落接近、急转或离场时水平速度
 * 会掉到 0 附近，atan2 的正负号来回跳，整只鸟就会突然掉头 180°，看起来像
 * 头和尾巴一直在换位置。这里加一个最小水平速度门槛，并让朝向按最短弧平滑转，
 * 速度很小的时候保持上一帧的朝向。
 */
interface FlyingBird {
  group: THREE.Group;
  heading: number;
}

function steerBird(bird: FlyingBird, vx: number, vz: number, dt: number) {
  const horiz = Math.hypot(vx, vz);
  if (horiz > 0.45) {
    const target = Math.atan2(-vz, vx);
    const delta = Math.atan2(Math.sin(target - bird.heading), Math.cos(target - bird.heading));
    bird.heading += delta * Math.min(1, dt * 5);
    bird.group.rotation.y = bird.heading;
  }
  return horiz;
}

function pitchBird(bird: FlyingBird, vy: number, horiz: number, dt: number) {
  // 俯仰只做小幅示意；速度很小时回正，避免鸟头直上直下。
  const target = horiz > 0.5 ? THREE.MathUtils.clamp(Math.atan2(vy, horiz), -0.35, 0.35) : 0;
  bird.group.rotation.z += (target - bird.group.rotation.z) * Math.min(1, dt * 5);
}

/**
 * 望远镜探索星座：6 颗星，一颗对应一个分区。盖过该分区的访客印章才点亮，
 * 亮起的星才可瞄准读取；读出来的是指向该分区的一条探索线索。
 */


/**
 * 鸟群可停靠的屋顶/地面平面点：x, 停靠高度, z。
 * 每个点上方必须开阔（无树冠、无建筑凸起），鸟才能垂直降落而不穿模。
 * 天台屋顶 7.55 / 观景台平台 1.45 / 广场地面 0.12。
 */


/**
 * 猫的碰撞足迹：身体、头、尾巴三个圆，按朝向旋转后逐点检测。
 * 单点 + 固定半径会让 1.5 米长的猫把头尾插进墙里。
 */

/** 猫身高度：低于这个高度的东西挡不住它。 */

/** 猫能迈上去的高度，和玩家的 STEP_HEIGHT 一致，这样台阶、木台它都能跟上去。 */

/** 撞到障碍时依次试探的偏转角（弧度）：先直行，再贴墙滑行，最后几乎掉头。 */

/** 猫不会下水的区域（池塘水面），进入会半截身子穿进水里。 */


;

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
  /** 对应分区 id：盖过访客印章的星是亮金色，否则淡蓝；两者都可连。 */
  zoneId: string;
  explored: boolean;
  /** 是否已被玩家连入星座。 */
  linked: boolean;
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
    // 五年小径尽头的凉亭和营地帐篷：雨雪不会穿过屋顶落进来。
    { minX: -40.8, maxX: -34.8, minZ: 27.4, maxZ: 33.4, roofY: 3.7 },
    { minX: 37.4, maxX: 41.2, minZ: 15.3, maxZ: 19.2, roofY: 3.0 },
  ];

  scores = 0;
  courtLit = false;
  shelfOpen = false;
  eggCount = 0;
  readonly onScore: ((score: number) => void) | undefined;
  readonly onCourtLit?: () => void;
  readonly onSecret?: () => void;

  quality: Quality;
  reducedMotion: boolean;
  readonly signalConstellation = new THREE.Group();
  readonly signalStars: SignalConstellationStar[] = [];
  readonly signalStarPositions: THREE.Vector3[] = [];
  /** Camera aim target used by the telescope interaction. */
  readonly signalLookAt = new THREE.Vector3(5.4, 15.5, -10.2);
  signalConstellationOpen = false;
  signalConstellationElapsed = 0;
  signalConstellationLine: any;
  signalConstellationLineMaterial: any;
  signalPulse: any;
  telescopeInteractable: any;
  telescopeModel!: THREE.Group;
  /** 已盖访客印章的分区 id 集合；只影响星点颜色，不阻塞连星。 */
  exploredZones = new Set<string>();
  /** 玩家已连入星座的星点 id，按连接顺序。 */
  readonly linkedIds: string[] = [];
  /** 连星座画出的线段顶点（x,y,z 连续，每段 2 个顶点）。 */
  readonly linkSegments: number[] = [];
  /** 星座星点的可读内容，按 interactable id 索引，供望远镜目镜面板渲染。 */
  readonly signalReadings = new Map<string, SignalCopy>();

  /** 目镜面板目录：列出这一片星空里的全部星点，并标出各自是否已连入星座。 */
  get signalEntries(): ReadonlyArray<{ id: string; index: string; label: string; state: "linked" | "open" }> {
    return CONSTELLATION_STARS.map((star: any) => {
      const id = `explore-${star.zoneId}`;
      return {
        id,
        index: star.index,
        label: star.label,
        state: this.linkedIds.includes(id) ? "linked" : "open",
      };
    });
  }

  readonly blocks: BoxSpec[] = [];
  readonly glowBlocks: BoxSpec[] = [];
  readonly edgePositions: number[] = [];

  glowMaterial!: THREE.MeshBasicMaterial;
  poolMaterial!: THREE.MeshBasicMaterial;
  waterMaterial: any;

  ball: any;
  readonly ballVelocity = new THREE.Vector3();
  ballFlying = false;
  ballScored = false;
  ballResetTimer = 0;
  ballRestTimer = 0;
  readonly rimPositions = [
    new THREE.Vector3(17.55, 3.05, 2),
    new THREE.Vector3(34.45, 3.05, 2),
  ];

  courtOn: THREE.Mesh[] = [];
  courtOff: THREE.Mesh[] = [];
  courtLight!: THREE.PointLight;
  courtLightLevel = 0;
  courtLightTarget = 0;

  shelfGroup!: THREE.Group;
  shelfCollider!: AABB;
  shelfTargetX = 5.7;
  secretRevealed = false;
  radioOn = false;
  radioLed!: THREE.Mesh;
  radioLight!: THREE.PointLight;
  radioBars: THREE.Mesh[] = [];

  monitorMaterial!: THREE.MeshBasicMaterial;
  monitorTexture!: THREE.CanvasTexture;
  readonly signalSurfaces = new Map<string, SignalSurface>();

  poolLights: THREE.PointLight[] = [];
  poolLightBase: number[] = [];

  waterMeshes: THREE.Mesh[] = [];
  fountainJets: THREE.Mesh[] = [];
  duck: any;
  duckBaseY = 0;
  duckPoke = 0;
  readonly fishLife: {
    group: THREE.Group;
    tail: THREE.Mesh;
    phase: number;
    radiusX: number;
    radiusZ: number;
    speed: number;
  }[] = [];

  confetti: any;

  /** 鸭子当前所在的池面坐标。巡游与喂食都只是移动这个点，位置不靠解析式直接写。 */
  readonly duckPos = new THREE.Vector3();
  /** 面包屑落点。喂食后鸭子和鱼都把巡游中心往这里拉。 */
  readonly feedPoint = new THREE.Vector3(23.2, 0.3, 24.1);
  /** 面包屑剩余时间（秒）。归零后 gather 会自己慢慢散开。 */
  feedTimer = 0;
  /** 0..1 的聚集程度，用阻尼过渡，避免第一帧整群鱼瞬移。 */
  feedGather = 0;
  /** 累计喂食次数，第三次解锁彩蛋。 */
  feedCount = 0;
  crumbs: any;
  /** 室外路面的水膜层。只在雨天浮现，室内地面不在其中。 */
  wetLayer!: THREE.Mesh;
  wetMaterial!: THREE.MeshPhongMaterial;
  /** 0..1 的积水量，雨天缓慢上涨、雨停后 30 秒左右退干。 */
  wetness = 0;
  /** 当前雨量 0..1，由 engine 每帧写入（取自 WeatherSystem.rainAmount）。 */
  rainAmount = 0;
  /** 当前天气类型，用来决定风车转速和晾衣绳状态。 */
  weatherType: WeatherType = "clear";
  /** 玩家平面位置，由 engine 每帧写入；猫和鸽子靠它决定要不要靠近/躲开。 */
  readonly playerPos = new THREE.Vector2(0, 30);

  /** 小径石碑的正文。engine 读到同 id 时打开 DOM 阅读面板，而不是翻 3D 贴图。 */
  readonly plaqueReadings = new Map<string, SignalCopy>();

  night = 0;

  campfireOn = false;
  campfireLight!: THREE.PointLight;
  campfireFlames: THREE.Mesh[] = [];
  campfireEmbers!: {
    points: THREE.Points;
    velocities: Float32Array;
    life: number;
  };

  windmillBlades!: THREE.Group;
  windsock!: THREE.Group;
  barrelWater!: THREE.Mesh;
  barrelFill = 0.35;
  laundryClothes: THREE.Object3D[] = [];
  chimeTubes: THREE.Object3D[] = [];

  /** 钢琴白键：每个键单独一个 mesh，按下时只下沉它自己。 */
  readonly pianoKeys: THREE.Mesh[] = [];
  readonly pianoKeyPress: number[] = [];
  /** 琴凳坐点。进入钢琴模式时引擎把玩家吸到这里，起身时再放回原位。 */
  readonly pianoSeat = { x: -6.95, y: 0.05, z: 5.0, yaw: Math.PI / 2, eyeOffset: -0.3 };

  cat: any;
  catPetTimer = 0;
  catState: "idle" | "walk" | "sit" = "idle";
  catTarget = new THREE.Vector3(7.2, 0.02, 6.2);
  /** 猫钻不进去时优先往哪一侧绕。 */
  catAvoid: 1 | -1 = 1;
  /** 猫当前脚下的地面高度，走过台阶、木台时跟着抬起，不再固定贴在 y=0.02。 */
  catGroundY = 0;
  /** 连续走不动的时间；太久就放弃追人回家，避免在池边或墙根原地蹭。 */
  catStuckTimer = 0;
  catGiveUpTimer = 0;
  /** 玩家踩到脚边时让路的临时状态，移动会更快一点。 */
  catDodge = false;
  /** 猫的障碍集合，直接用逐块的碰撞体，而不是合并后的 InstancedMesh 包围盒。 */
  catObstacles: AABB[] = [];
  catObstaclesBuilt = false;
  catHearts: any;

  fireflies: any;
  readonly fireflyBase: THREE.Vector3[] = [];
  readonly fireflyPhase: number[] = [];

  /** 天空中的低多边形群鸟：数量随机增减、路线随机多变，横跨全岛飞行。 */
  readonly birds: Array<{
    group: THREE.Group;
    leftWing: THREE.Group;
    rightWing: THREE.Group;
    active: boolean;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    target: THREE.Vector3;
    turnTimer: number;
    speed: number;
    flapPhase: number;
    /** 是否正停靠在屋顶/地面。 */
    perched: boolean;
    /** 停靠剩余时间；飞行中作为「下次考虑停靠」的倒计时。 */
    perchTimer: number;
    /** 当前停靠点（飞行中为待降落目标），无则为 null。 */
    perchSpot: [number, number, number] | null;
    /** 是否正在离场：朝远处飞去，飞出视野后才真正消失，不会原地消失。 */
    leaving: boolean;
    /** 平滑后的朝向（弧度）。水平速度接近 0 时仍保持上一次朝向，避免头尾来回翻转。 */
    heading: number;
  }> = [];
  /** 鸟群数量随机刷新的计时器：到点随机增减一只。 */
  birdSpawnTimer = 2;

  elapsed = 0;


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
    this.buildRooftop();
    this.buildRooftopSkyDeck();
    this.buildPond();
    this.buildPondDock();
    this.buildTrail();
    this.buildCamp();
    this.buildWindmill();
    this.buildGarden();
    this.buildLookout();
    this.buildWeatherProps();
    this.buildMapBoard();
    this.buildPiano();
    this.buildTrees();
    this.buildLamps();
    this.buildPerimeter();

    this.createStaticMeshes(opts.quality);
    this.buildWetLayer();
    this.createBall();
    this.createFountain();
    this.createDuck();
    this.createFish();
    this.createCat();
    this.createFireflies();
    this.createPigeons();

    this.setShadows(opts.quality === "high");
  }
  setShadows(enabled: boolean) {
    this.group.traverse((obj: any) => {
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
    this.signalStars.forEach((star: any) => {
      star.halo.visible = false;
      (star.halo.material as THREE.MeshBasicMaterial).opacity = quality === "high" ? 0.16 : 0;
    });
    if (this.signalConstellationOpen) this.updateSignalConstellation(0);
    // 低画质下积水更淡，和粒子减半一样是省性能的表现
    if (this.wetMaterial) this.wetMaterial.opacity = this.wetOpacity();
    if (this.fireflies) {
      const count = this.fireflyBase.length;
      this.fireflies.geometry.setDrawRange(0, quality === "high" ? count : Math.floor(count / 2));
    }
  }
  wetOpacity() {
    return this.wetness * (this.quality === "high" ? 0.82 : 0.42);
  }
  setRainAmount(amount: number) {
    this.rainAmount = amount;
  }
  updateWetness(dt: number, rain: number) {
    if (!this.wetLayer || !this.wetMaterial) return;
    // 上涨 λ=0.45（约 7 秒到 95%），退干 λ=0.1（约 30 秒退到 5%）——
    // 下雨来得快、干得慢，符合真实路面。
    const lambda = rain > this.wetness ? 0.45 : 0.1;
    this.wetness = THREE.MathUtils.damp(this.wetness, rain, lambda, dt);
    const visible = this.wetness > 0.01;
    this.wetLayer.visible = visible;
    if (visible) this.wetMaterial.opacity = this.wetOpacity();
  }

  pressPianoKey(index: number) {
    if (index < 0 || index >= this.pianoKeys.length) return;
    this.pianoKeyPress[index] = 0.16;
  }










  setPlayerPosition(x: number, z: number) {
    this.playerPos.set(x, z);
  }
  setWeather(type: WeatherType) {
    this.weatherType = type;
  }
  petCat(): boolean {
    if (!this.cat) return false;
    this.catPetTimer = 1.4;
    this.catState = "sit";
    this.spawnCatHearts();
    return true;
  }
  toggleCampfire(): boolean {
    this.campfireOn = !this.campfireOn;
    this.campfireFlames.forEach((flame: any) => {
      flame.visible = this.campfireOn;
    });
    if (this.campfireEmbers) {
      (this.campfireEmbers.points.material as THREE.PointsMaterial).opacity = this.campfireOn ? 0.9 : 0;
    }
    if (this.campfireLight) this.campfireLight.intensity = this.campfireOn ? 2.6 : 0;
    const item = this.interactables.find((i: any) => i.id === "campfire");
    if (item) item.label = this.campfireOn ? "熄灭篝火" : "点燃篝火";
    return this.campfireOn;
  }












  setExploredZones(zones: ReadonlySet<string>) {
    this.exploredZones = new Set(zones);
    this.applyConstellationState();
  }






  setTelescopeModelVisible(visible: boolean) {
    if (this.telescopeModel) this.telescopeModel.visible = visible;
  }
  setReducedMotion(reducedMotion: boolean) {
    if (this.reducedMotion === reducedMotion) return;
    this.reducedMotion = reducedMotion;
    this.signalConstellationElapsed = 0;
    if (this.signalConstellationOpen) this.updateSignalConstellation(0);
  }

  get isSignalConstellationOpen() {
    return this.signalConstellationOpen;
  }


  toggleBookshelf(player: THREE.Vector3): "opened" | "closed" | "blocked" {
    const item = this.interactables.find((i: any) => i.id === "bookshelf");
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
  refreshMonitor() {
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
  lightCourt() {
    if (this.courtLit) return;
    this.courtLit = true;
    this.courtLightTarget = 240;
    this.courtOn.forEach((m: any) => {
      m.visible = true;
    });
    this.courtOff.forEach((m: any) => {
      m.visible = false;
    });
    this.spawnConfetti();
    this.onCourtLit?.();
  }



  setRadioOn(on: boolean) {
    this.radioOn = on;
    if (this.radioLight) this.radioLight.intensity = on ? 1.8 : 0;
    if (this.radioLed) {
      const material = this.radioLed.material as THREE.MeshBasicMaterial;
      material.color.setHex(on ? 0xd8ff5f : 0x2b332c);
    }
    const item = this.interactables.find((i: any) => i.id === "radio");
    if (item) item.label = on ? "关闭电台" : "打开电台";
  }
  setNight(night: number) {
    const n = THREE.MathUtils.clamp(night, 0, 1);
    this.night = n;
    if (this.glowMaterial) this.glowMaterial.opacity = 0.28 + n * 0.72;
    if (this.poolMaterial) this.poolMaterial.opacity = n * 0.3;
    if (this.fireflies) {
      const mat = this.fireflies.material as THREE.PointsMaterial;
      mat.opacity = n * (this.quality === "high" ? 0.9 : 0.55);
    }
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

    if (this.pianoKeys.length > 0) {
      this.pianoKeys.forEach((key, i) => {
        const press = Math.max(0, (this.pianoKeyPress[i] ?? 0) - dt);
        this.pianoKeyPress[i] = press;
        const targetY = (key.userData.restY as number) - (press > 0 ? 0.035 : 0);
        key.position.y = THREE.MathUtils.damp(key.position.y, targetY, 30, dt);
      });
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

    this.updateAmbientLife(dt, elapsed);
  }
  updateAmbientLife(dt: number, elapsed: number) {
    const wind =
      this.weatherType === "rain"
        ? 2.2
        : this.weatherType === "snow"
          ? 1.1
          : this.weatherType === "fog"
            ? 0.45
            : 0.8;

    if (this.windmillBlades) {
      this.windmillBlades.rotation.z += dt * wind;
    }
    if (this.windsock) {
      this.windsock.rotation.z = Math.sin(elapsed * 1.7) * 0.1 * wind;
      this.windsock.rotation.y = Math.sin(elapsed * 0.8) * 0.22;
    }
    this.chimeTubes.forEach((tube, i) => {
      tube.rotation.z = Math.sin(elapsed * (1.1 + i * 0.17) + i) * 0.09;
      tube.rotation.x = Math.cos(elapsed * (0.9 + i * 0.13) + i) * 0.06;
    });

    // 下雨收衣服：这是场景里最容易被看见的天气反馈。
    const raining = this.rainAmount > 0.25;
    this.laundryClothes.forEach((cloth, i) => {
      cloth.visible = !raining;
      if (!cloth.visible) return;
      cloth.rotation.x = Math.sin(elapsed * 1.5 + i * 0.8) * 0.06;
      cloth.position.z = -14.9 + Math.sin(elapsed * 1.2 + i) * 0.04;
    });

    this.barrelFill = THREE.MathUtils.clamp(
      this.barrelFill + (raining ? 0.055 : -0.018) * dt,
      0.05,
      1,
    );
    if (this.barrelWater) this.barrelWater.position.y = 0.7 + this.barrelFill * 0.45;

    if (this.campfireOn) {
      this.campfireFlames.forEach((flame, i) => {
        flame.scale.setScalar(0.9 + Math.sin(elapsed * 7.2 + i * 2.1) * 0.12);
      });
      if (this.campfireLight) {
        this.campfireLight.intensity =
          2.4 + Math.sin(elapsed * 11) * 0.5 + Math.sin(elapsed * 17.3) * 0.25;
      }
      if (this.campfireEmbers) {
        const pos = this.campfireEmbers.points.geometry.getAttribute("position") as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        const vel = this.campfireEmbers.velocities;
        for (let i = 0; i < pos.count; i += 1) {
          arr[i * 3] += vel[i * 3] * dt;
          arr[i * 3 + 1] += vel[i * 3 + 1] * dt;
          arr[i * 3 + 2] += vel[i * 3 + 2] * dt;
          if (arr[i * 3 + 1] > 3.2) {
            arr[i * 3] = 35.2 + (Math.random() - 0.5) * 0.7;
            arr[i * 3 + 1] = 0.5;
            arr[i * 3 + 2] = 17.2 + (Math.random() - 0.5) * 0.7;
          }
        }
        pos.needsUpdate = true;
      }
    }

    if (this.fireflies) {
      const night = this.night;
      (this.fireflies.material as THREE.PointsMaterial).opacity =
        night * (this.quality === "high" ? 0.9 : 0.55);
      if (night > 0.04) {
        const pos = this.fireflies.geometry.getAttribute("position") as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        for (let i = 0; i < this.fireflyBase.length; i += 1) {
          const base = this.fireflyBase[i]!;
          const phase = this.fireflyPhase[i]!;
          arr[i * 3] = base.x + Math.sin(elapsed * 0.5 + phase) * 0.7;
          arr[i * 3 + 1] = base.y + Math.sin(elapsed * 0.8 + phase * 1.7) * 0.4;
          arr[i * 3 + 2] = base.z + Math.cos(elapsed * 0.4 + phase) * 0.7;
        }
        pos.needsUpdate = true;
      }
    }

    if (this.cat) {
      if (!this.catObstaclesBuilt) this.buildCatObstacles();
      this.catPetTimer = Math.max(0, this.catPetTimer - dt);
      this.catGiveUpTimer = Math.max(0, this.catGiveUpTimer - dt);
      const cat = this.cat;
      const dxPlayer = this.playerPos.x - cat.position.x;
      const dzPlayer = this.playerPos.y - cat.position.z;
      const distance = Math.hypot(dxPlayer, dzPlayer);
      this.catDodge = false;
      if (this.catPetTimer > 0) {
        // 刚被摸过：原地坐着，不再走动，免得玩家一靠近就跑开。
        this.catState = "sit";
        this.catTarget.set(cat.position.x, 0.02, cat.position.z);
      } else if (distance < 1.15) {
        // 玩家已经贴到脚边：往反方向让开，否则第一人称镜头会直接卡进猫身里。
        // 完全重合时没有方向可言，就朝猫的侧面让。
        let ax = 0;
        let az = 0;
        if (distance > 0.001) {
          ax = dxPlayer / distance;
          az = dzPlayer / distance;
        } else {
          const side = cat.rotation.y + Math.PI / 2;
          ax = Math.cos(side);
          az = -Math.sin(side);
        }
        this.catTarget.set(cat.position.x - ax * 3.6, 0.02, cat.position.z - az * 3.6);
        this.catState = "walk";
        this.catDodge = true;
      } else if (this.catGiveUpTimer <= 0 && distance < 10 && distance > 2.2) {
        const scale = 2.4 / Math.max(distance, 0.001);
        this.catTarget.set(this.playerPos.x - dxPlayer * scale, 0.02, this.playerPos.y - dzPlayer * scale);
        this.catState = "walk";
      } else if (this.catGiveUpTimer <= 0 && distance >= 10.5) {
        this.catTarget.set(7.2, 0.02, 6.2);
        this.catState = "walk";
      } else {
        // 站着别动：把旧目标收回到脚下，否则它会继续朝过期的目标走，
        // 一路从玩家身体里穿过去。
        this.catState = "idle";
        this.catTarget.set(cat.position.x, 0.02, cat.position.z);
      }

      const mx = this.catTarget.x - cat.position.x;
      const mz = this.catTarget.z - cat.position.z;
      const move = Math.hypot(mx, mz);
      let walking = false;
      if (move > 0.35) {
        const speed = this.catDodge ? 3.6 : 2.0;
        const step = Math.min(move, speed * dt);
        // 基础方向：朝目标；被挡住就沿着墙滑，而不是直接穿过去。
        const baseAng = Math.atan2(mz, mx);
        const currentDepth = this.catOverlapDepth(
          cat.position.x,
          cat.position.z,
          cat.rotation.y,
          this.catGroundY,
        );
        let nextX = cat.position.x;
        let nextZ = cat.position.z;
        let nextYaw = cat.rotation.y;
        let found = false;
        for (const bias of CAT_SLIDE_BIASES) {
          const ang = baseAng + bias * this.catAvoid;
          const nx = cat.position.x + Math.cos(ang) * step;
          const nz = cat.position.z + Math.sin(ang) * step;
          const yaw = Math.atan2(-Math.sin(ang), Math.cos(ang));
          let delta = yaw - cat.rotation.y;
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta < -Math.PI) delta += Math.PI * 2;
          // 朝向也是平滑转过去的，碰撞要按「转过去之后」的姿态算，
          // 否则头会先扫进墙里，再被卡住。
          const turned = cat.rotation.y + delta * Math.min(1, dt * 8);
          const depth = this.catOverlapDepth(nx, nz, turned, this.catGroundY);
          if (depth <= 0.0005 || depth < currentDepth - 0.0008) {
            nextX = nx;
            nextZ = nz;
            nextYaw = turned;
            found = true;
            break;
          }
        }
        if (found) {
          cat.position.x = nextX;
          cat.position.z = nextZ;
          cat.rotation.y = nextYaw;
          this.catGroundY = this.catGroundAt(nextX, nextZ, this.catGroundY);
          walking = true;
          this.catStuckTimer = 0;
        } else {
          // 所有方向都走不通：在池边或死胡同原地等一会儿，别硬挤。
          this.catStuckTimer += dt;
          if (this.catStuckTimer > 2.5) {
            this.catStuckTimer = 0;
            this.catAvoid = this.catAvoid === 1 ? -1 : 1;
            this.catGiveUpTimer = 2.5;
            this.catTarget.set(7.2, 0.02, 6.2);
            this.catState = "idle";
          }
        }
      } else {
        this.catStuckTimer = 0;
      }

      // 贴地：走到台阶、木台上时整只猫一起抬起，不再固定趴在 y=0.02。
      this.catGroundY = this.catGroundAt(cat.position.x, cat.position.z, this.catGroundY);
      const bob = walking ? Math.abs(Math.sin(elapsed * 9)) * 0.03 : 0;
      cat.position.y = this.catGroundY + 0.02 + bob;
      const tail = cat.getObjectByName("cat-tail");
      if (tail) tail.rotation.y = Math.sin(elapsed * (this.catState === "sit" ? 1.6 : 3.2)) * 0.4;
    }

    if (this.catHearts) {
      const hearts = this.catHearts;
      hearts.life -= dt;
      const pos = hearts.points.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < pos.count; i += 1) {
        arr[i * 3] += hearts.velocities[i * 3] * dt;
        arr[i * 3 + 1] += hearts.velocities[i * 3 + 1] * dt;
        arr[i * 3 + 2] += hearts.velocities[i * 3 + 2] * dt;
      }
      pos.needsUpdate = true;
      (hearts.points.material as THREE.PointsMaterial).opacity = Math.max(0, hearts.life / 1.8);
      if (hearts.life <= 0) {
        this.group.remove(hearts.points);
        hearts.points.geometry.dispose();
        (hearts.points.material as THREE.Material).dispose();
        this.catHearts = undefined;
      }
    }

    // 鸟群数量随机刷新：每 2~4 秒随机增减一只，始终保持在 2~6 之间。
    this.birdSpawnTimer -= dt;
    if (this.birdSpawnTimer <= 0) {
      const on = this.birds.filter((b: any) => b.active);
      const off = this.birds.filter((b: any) => !b.active);
      const roll = Math.random();
      if (roll < 0.45 && off.length > 0) {
        this.activateBird(off[Math.floor(Math.random() * off.length)]!);
      } else if (roll < 0.8 && on.length > 2) {
        // 减一只：不原地消失，让一只飞行中的鸟朝远处飞出去再消失。
        const flying = on.filter((b: any) => !b.perched && !b.leaving);
        if (flying.length > 0) {
          this.startDeparture(flying[Math.floor(Math.random() * flying.length)]!);
        }
      }
      this.birdSpawnTimer = 2 + Math.random() * 3;
    }
    for (const bird of this.birds) {
      if (!bird.active) continue;

      // —— 离场中：一直朝远处飞，飞出视野才真正消失，不突然消失 ——
      if (bird.leaving) {
        const outDist = Math.hypot(bird.pos.x, bird.pos.z);
        if (outDist > 95) {
          this.deactivateBird(bird);
          continue;
        }
        const ldx = bird.target.x - bird.pos.x;
        const ldz = bird.target.z - bird.pos.z;
        const desired = new THREE.Vector3(ldx, 0, ldz).normalize().multiplyScalar(bird.speed);
        bird.vel.lerp(desired, Math.min(1, dt * 1.5));
        // 离场时缓慢爬升，不再用大振幅正弦让鸟一路上下颠。
        const climb = THREE.MathUtils.clamp((bird.target.y - bird.pos.y) * 0.35, -0.5, 0.8);
        bird.vel.y = THREE.MathUtils.lerp(bird.vel.y, climb, Math.min(1, dt * 2));
        bird.pos.addScaledVector(bird.vel, dt);
        bird.group.position.copy(bird.pos);
        const horiz = steerBird(bird, bird.vel.x, bird.vel.z, dt);
        pitchBird(bird, bird.vel.y, horiz, dt);
        bird.leftWing.rotation.x = Math.sin(elapsed * 12 + bird.flapPhase) * 0.8;
        bird.rightWing.rotation.x = -Math.sin(elapsed * 12 + bird.flapPhase) * 0.8;
        continue;
      }

      // —— 停靠中：静止收翅，玩家靠近或停够时间就起飞 ——
      if (bird.perched) {
        bird.perchTimer -= dt;
        const nearPlayer =
          Math.hypot(this.playerPos.x - bird.group.position.x, this.playerPos.y - bird.group.position.z) < 4;
        if (nearPlayer || bird.perchTimer <= 0) {
          bird.perched = false;
          bird.perchSpot = null;
          bird.turnTimer = 1 + Math.random() * 2;
          bird.target.set(
            (Math.random() * 2 - 1) * 55,
            12 + Math.random() * 4,
            (Math.random() * 2 - 1) * 55,
          );
          bird.vel.y = 3; // 起飞抬升，随后被安全高度限制接管
        } else {
          bird.leftWing.rotation.x = 0.14;
          bird.rightWing.rotation.x = -0.14;
          continue;
        }
      }

      // —— 偶尔决定去停靠：飞到某屋顶/地面歇脚 ——
      if (!bird.perched && bird.perchSpot === null) {
        bird.perchTimer -= dt;
        if (bird.perchTimer <= 0) {
          bird.perchTimer = 8 + Math.random() * 10; // 下次再考虑
          if (Math.random() < 0.3) bird.perchSpot = this.pickLandingSpot();
        }
      }

      if (bird.perchSpot) {
        // 去停靠点：慢慢斜向下飞近，最后轻轻落在表面；不横穿建筑，也不螺旋急坠。
        const sx = bird.perchSpot[0] - bird.pos.x;
        const sy = bird.perchSpot[1] + 0.32 - bird.pos.y; // +0.32：让鸟身底部刚好贴在表面上，不穿模
        const sz = bird.perchSpot[2] - bird.pos.z;
        const sdist = Math.hypot(sx, sy, sz);
        if (sdist > 1.0) {
          // 平缓下滑：慢速、斜向接近，看起来是慢慢飞过去落下来，而不是突然螺旋下降。
          const desired = new THREE.Vector3(sx, sy, sz).normalize().multiplyScalar(bird.speed * 0.5);
          bird.vel.lerp(desired, Math.min(1, dt * 1.2));
          bird.pos.addScaledVector(bird.vel, dt);
          bird.group.position.copy(bird.pos);
          const horiz = steerBird(bird, bird.vel.x, bird.vel.z, dt);
          pitchBird(bird, bird.vel.y, horiz, dt);
          bird.leftWing.rotation.x = Math.sin(elapsed * 8 + bird.flapPhase) * 0.4;
          bird.rightWing.rotation.x = -Math.sin(elapsed * 8 + bird.flapPhase) * 0.4;
          continue;
        }
        // 已到停靠点上空：轻轻垂直落下到表面（含抬升量，不穿模）。
        const landY = bird.perchSpot[1] + 0.32;
        bird.pos.y = THREE.MathUtils.lerp(bird.pos.y, landY, Math.min(1, dt * 2));
        bird.group.position.copy(bird.pos);
        // 落地时缓慢回正朝向，不突然旋转 180°（避免看着像螺旋下坠）。
        const straighten = Math.atan2(Math.sin(-bird.heading), Math.cos(-bird.heading));
        bird.heading += straighten * Math.min(1, dt * 4);
        bird.group.rotation.y = bird.heading;
        bird.group.rotation.z += (0 - bird.group.rotation.z) * Math.min(1, dt * 6);
        if (Math.abs(bird.pos.y - landY) < 0.15) {
          bird.pos.set(bird.perchSpot[0], landY, bird.perchSpot[2]);
          bird.group.position.copy(bird.pos);
          bird.perched = true;
          bird.perchTimer = 10 + Math.random() * 16;
          bird.perchSpot = null;
        }
        bird.leftWing.rotation.x = 0.14;
        bird.rightWing.rotation.x = -0.14;
        continue;
      }

      // —— 正常随机飞行 ——
      const dx = bird.target.x - bird.pos.x;
      const dz = bird.target.z - bird.pos.z;
      const dist = Math.hypot(dx, dz);
      bird.turnTimer -= dt;
      if (dist < 1.6 || bird.turnTimer <= 0) {
        bird.target.set(
          (Math.random() * 2 - 1) * 55,
          10 + Math.random() * 6,
          (Math.random() * 2 - 1) * 55,
        );
        bird.turnTimer = 2 + Math.random() * 3;
      } else {
        // 朝目标平滑转向
        const desired = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(bird.speed);
        bird.vel.lerp(desired, Math.min(1, dt * 1.1));
      }
      // 朝目标高度缓慢收敛，只保留很小的起伏；目标是 10~16 米，不会被拉去反复爬升下坠。
      const climb = THREE.MathUtils.clamp((bird.target.y - bird.pos.y) * 0.8, -1.3, 1.3);
      const bob = Math.sin(elapsed * 0.55 + bird.flapPhase) * 0.22;
      bird.vel.y = THREE.MathUtils.lerp(bird.vel.y, climb + bob, Math.min(1, dt * 2.2));
      if (bird.pos.y < 10) bird.vel.y = Math.max(bird.vel.y, 1.8);
      if (bird.pos.y > 17) bird.vel.y = Math.min(bird.vel.y, -1.0);
      bird.pos.addScaledVector(bird.vel, dt);
      // 越界就拉回中心（同时压住高度上限，不让鸟飞进易显黑的深空）
      if (Math.abs(bird.pos.x) > 58 || Math.abs(bird.pos.z) > 58 || bird.pos.y > 18) {
        bird.target.set(bird.pos.x * 0.4, 12, bird.pos.z * 0.4);
        bird.turnTimer = 0;
      }
      bird.group.position.copy(bird.pos);
      // 身体朝飞行方向：本地 +X（头部）对准水平速度；速度很小时保持上一帧朝向。
      const horiz = steerBird(bird, bird.vel.x, bird.vel.z, dt);
      pitchBird(bird, bird.vel.y, horiz, dt);
      // 扇翅
      if (!this.reducedMotion) {
        const flap = Math.sin(elapsed * (9 + bird.speed * 4) + bird.flapPhase) * 0.9;
        bird.leftWing.rotation.x = flap;
        bird.rightWing.rotation.x = -flap;
      } else {
        bird.leftWing.rotation.x = 0.35;
        bird.rightWing.rotation.x = -0.35;
      }
    }
  }

}

export interface VoxelWorld extends WorldBuilder, WorldCreatures, WorldSignals {}
applyMixins(VoxelWorld, [WorldBuilder, WorldCreatures, WorldSignals]);
