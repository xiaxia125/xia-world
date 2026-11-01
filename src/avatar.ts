import * as THREE from "three";

/**
 * 第三人称下的小人：方块比例（接近 Minecraft 的 Steve），但换成了这个站点里的人——
 * 深绿外套、奶白围巾、深色短发，背一只小背包。只做低多边形，和岛上的体素语言一致。
 *
 * 朝向约定：模型正面朝 -Z，和相机 yaw = 0 时的视线方向一致，所以 group.rotation.y
 * 直接等于身体朝向即可，不用额外加 π。
 */

export interface AvatarPose {
  /** 水平速度（m/s），用来决定步幅和摆臂幅度。 */
  speed: number;
  onGround: boolean;
  seated: boolean;
}

const SKIN = 0xe9c3a0;
const HAIR = 0x2b2320;
const JACKET = 0x2f5d54;
const JACKET_DARK = 0x254b44;
const PANTS = 0x353c46;
const SHOE = 0x1e2428;
const PACK = 0x8a5a3c;
const PACK_DARK = 0x6f452d;
const SCARF = 0xf1ecdf;
const LIME = 0xd8ff5f;

/** 简单的方块脸：两只眼睛、一点腮红和一条短嘴。 */
function faceTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  ctx.fillStyle = "#e9c3a0";
  ctx.fillRect(0, 0, 64, 64);

  // 眼睛
  ctx.fillStyle = "#2b2320";
  ctx.fillRect(15, 25, 8, 11);
  ctx.fillRect(41, 25, 8, 11);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(17, 27, 3, 3);
  ctx.fillRect(43, 27, 3, 3);

  // 腮红
  ctx.fillStyle = "rgba(226,140,120,0.4)";
  ctx.fillRect(9, 39, 9, 5);
  ctx.fillRect(46, 39, 9, 5);

  // 嘴
  ctx.fillStyle = "rgba(90,54,44,0.85)";
  ctx.fillRect(28, 44, 8, 3);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material | THREE.Material[],
  x = 0,
  y = 0,
  z = 0,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class Avatar {
  readonly group = new THREE.Group();
  /** 头部相对身体的额外转动，让小人「往你瞄的方向看」。 */
  private readonly head = new THREE.Group();
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly torso = new THREE.Group();

  private walkPhase = 0;
  private idleTime = 0;
  /** 身体朝向（由 Player 每帧写入）。 */
  bodyYaw = 0;
  /** 头部相对身体的偏转。 */
  headYaw = 0;

  constructor() {
    this.group.name = "player-avatar";
    this.group.visible = false;

    const skin = new THREE.MeshLambertMaterial({ color: SKIN });
    const hair = new THREE.MeshLambertMaterial({ color: HAIR });
    const jacket = new THREE.MeshLambertMaterial({ color: JACKET });
    const jacketDark = new THREE.MeshLambertMaterial({ color: JACKET_DARK });
    const pants = new THREE.MeshLambertMaterial({ color: PANTS });
    const shoe = new THREE.MeshLambertMaterial({ color: SHOE });
    const pack = new THREE.MeshLambertMaterial({ color: PACK });
    const packDark = new THREE.MeshLambertMaterial({ color: PACK_DARK });
    const scarf = new THREE.MeshLambertMaterial({ color: SCARF });
    const lime = new THREE.MeshLambertMaterial({ color: LIME });

    // 腿：髋部为轴心，网格向下延伸，方便绕 X 摆动。
    for (const [group, x] of [[this.legL, 0.13], [this.legR, -0.13]] as const) {
      group.position.set(x, 0.66, 0);
      group.add(box(0.2, 0.56, 0.24, pants, 0, -0.28, 0));
      group.add(box(0.21, 0.14, 0.3, shoe, 0, -0.62, -0.03));
      this.group.add(group);
    }

    // 躯干：外套 + 前襟拉链 + 奶白围巾。
    this.torso.position.set(0, 0.66, 0);
    this.torso.add(box(0.52, 0.58, 0.3, jacket, 0, 0.29, 0));
    this.torso.add(box(0.5, 0.1, 0.31, jacketDark, 0, 0.03, 0));
    this.torso.add(box(0.04, 0.46, 0.02, jacketDark, 0, 0.3, -0.155));
    this.torso.add(box(0.34, 0.09, 0.34, scarf, 0, 0.58, 0));
    this.torso.add(box(0.1, 0.22, 0.03, scarf, -0.12, 0.45, -0.165));
    this.group.add(this.torso);

    // 背包：第三人称主要看到的是背面，所以这里多花一点细节。
    const backpack = new THREE.Group();
    backpack.position.set(0, 1.0, 0.23);
    backpack.add(box(0.34, 0.4, 0.16, pack));
    backpack.add(box(0.28, 0.12, 0.05, packDark, 0, -0.02, 0.1));
    backpack.add(box(0.14, 0.12, 0.02, lime, 0, 0.1, 0.09));
    backpack.add(box(0.05, 0.42, 0.02, packDark, 0.17, 0.02, -0.09));
    backpack.add(box(0.05, 0.42, 0.02, packDark, -0.17, 0.02, -0.09));
    this.group.add(backpack);

    // 手臂：肩部为轴心，袖子 + 露出来的手。
    for (const [group, x] of [[this.armL, 0.33], [this.armR, -0.33]] as const) {
      group.position.set(x, 1.16, 0);
      group.add(box(0.16, 0.46, 0.18, jacket, 0, -0.23, 0));
      group.add(box(0.15, 0.14, 0.17, skin, 0, -0.53, 0));
      this.group.add(group);
    }

    // 头：方块脸 + 短发（顶盖、后脑、两侧、刘海）。
    this.head.position.set(0, 1.26, 0);
    const face = faceTexture();
    const faceMat = new THREE.MeshLambertMaterial({ map: face });
    const headBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.44, 0.44),
      [skin, skin, skin, skin, skin, faceMat],
    );
    headBox.position.set(0, 0.22, 0);
    headBox.castShadow = true;
    this.head.add(headBox);
    this.head.add(box(0.48, 0.12, 0.48, hair, 0, 0.46, 0));
    this.head.add(box(0.46, 0.34, 0.08, hair, 0, 0.24, 0.22));
    this.head.add(box(0.06, 0.34, 0.46, hair, 0.23, 0.23, 0));
    this.head.add(box(0.06, 0.34, 0.46, hair, -0.23, 0.23, 0));
    this.head.add(box(0.44, 0.1, 0.06, hair, 0, 0.41, -0.23));
    this.head.add(box(0.1, 0.12, 0.06, hair, -0.19, 0.34, -0.23));
    this.group.add(this.head);

    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) object.userData.noShadow = false;
    });
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  /** 把模型摆到玩家脚下；朝向和头部偏转由 Player 决定。 */
  setTransform(x: number, y: number, z: number, bodyYaw: number, headYaw: number) {
    this.bodyYaw = bodyYaw;
    this.headYaw = headYaw;
    this.group.position.set(x, y, z);
    this.group.rotation.y = bodyYaw;
    this.head.rotation.y = headYaw;
  }

  update(dt: number, pose: AvatarPose) {
    const move = THREE.MathUtils.clamp(pose.speed / 5.2, 0, 1.35);

    if (pose.seated) {
      this.idleTime += dt;
      // 腿向前（-Z）抬起接近水平，手落在膝盖上。之前这里用了负角度，腿是朝后
      // 翘出去的，看上去像趴在凳子上。
      this.legL.rotation.x = THREE.MathUtils.damp(this.legL.rotation.x, 1.42, 10, dt);
      this.legR.rotation.x = THREE.MathUtils.damp(this.legR.rotation.x, 1.42, 10, dt);
      this.legL.rotation.z = 0;
      this.legR.rotation.z = 0;
      this.armL.rotation.x = THREE.MathUtils.damp(this.armL.rotation.x, 0.6, 8, dt);
      this.armR.rotation.x = THREE.MathUtils.damp(this.armR.rotation.x, 0.6, 8, dt);
      this.armL.rotation.z = THREE.MathUtils.damp(this.armL.rotation.z, -0.1, 8, dt);
      this.armR.rotation.z = THREE.MathUtils.damp(this.armR.rotation.z, 0.1, 8, dt);
      this.torso.rotation.x = THREE.MathUtils.damp(this.torso.rotation.x, 0.04, 8, dt);
      this.torso.position.y = 0.66;
      return;
    }

    if (!pose.onGround) {
      // 跳起来时收腿、抬臂，落地前再伸开。
      this.legL.rotation.x = THREE.MathUtils.damp(this.legL.rotation.x, 0.34, 9, dt);
      this.legR.rotation.x = THREE.MathUtils.damp(this.legR.rotation.x, -0.26, 9, dt);
      this.armL.rotation.x = THREE.MathUtils.damp(this.armL.rotation.x, -0.7, 9, dt);
      this.armR.rotation.x = THREE.MathUtils.damp(this.armR.rotation.x, -0.7, 9, dt);
      this.armL.rotation.z = THREE.MathUtils.damp(this.armL.rotation.z, -0.16, 9, dt);
      this.armR.rotation.z = THREE.MathUtils.damp(this.armR.rotation.z, 0.16, 9, dt);
      this.torso.rotation.x = THREE.MathUtils.damp(this.torso.rotation.x, -0.05, 9, dt);
      return;
    }

    if (move > 0.05) {
      this.idleTime = 0;
      this.walkPhase += dt * (3.6 + pose.speed * 1.35);
      const swing = Math.sin(this.walkPhase) * 0.62 * Math.min(1, move);
      const lift = Math.abs(Math.cos(this.walkPhase)) * 0.03 * Math.min(1, move);
      this.legL.rotation.x = THREE.MathUtils.damp(this.legL.rotation.x, swing, 14, dt);
      this.legR.rotation.x = THREE.MathUtils.damp(this.legR.rotation.x, -swing, 14, dt);
      this.armL.rotation.x = THREE.MathUtils.damp(this.armL.rotation.x, -swing * 0.85, 12, dt);
      this.armR.rotation.x = THREE.MathUtils.damp(this.armR.rotation.x, swing * 0.85, 12, dt);
      this.armL.rotation.z = THREE.MathUtils.damp(this.armL.rotation.z, -0.06, 10, dt);
      this.armR.rotation.z = THREE.MathUtils.damp(this.armR.rotation.z, 0.06, 10, dt);
      this.torso.rotation.x = THREE.MathUtils.damp(this.torso.rotation.x, 0.04 + move * 0.03, 10, dt);
      this.torso.position.y = 0.66 + lift;
    } else {
      this.idleTime += dt;
      const idle = Math.sin(this.idleTime * 1.6) * 0.02;
      this.legL.rotation.x = THREE.MathUtils.damp(this.legL.rotation.x, 0, 8, dt);
      this.legR.rotation.x = THREE.MathUtils.damp(this.legR.rotation.x, 0, 8, dt);
      this.armL.rotation.x = THREE.MathUtils.damp(this.armL.rotation.x, idle, 6, dt);
      this.armR.rotation.x = THREE.MathUtils.damp(this.armR.rotation.x, -idle, 6, dt);
      this.armL.rotation.z = THREE.MathUtils.damp(this.armL.rotation.z, -0.04, 6, dt);
      this.armR.rotation.z = THREE.MathUtils.damp(this.armR.rotation.z, 0.04, 6, dt);
      this.torso.rotation.x = THREE.MathUtils.damp(this.torso.rotation.x, 0, 6, dt);
      this.torso.position.y = 0.66 + Math.sin(this.idleTime * 1.6) * 0.006;
    }
  }
}
