import * as THREE from "three";
import { C } from "./builders";



export const BIRD_LANDING_SPOTS: ReadonlyArray<readonly [number, number, number]> = [
  [6, 7.55, -20],
  [-5, 7.55, -28],
  [-36.5, 1.45, -26],
  [0, 0.12, -6],
  [0, 0.12, 13],
  [-6, 0.12, 4],
];

export const CAT_HIT_SAMPLES: ReadonlyArray<{ x: number; z: number; r: number }> = [
  { x: 0, z: 0, r: 0.24 },
  { x: 0.42, z: 0, r: 0.17 },
  { x: -0.66, z: 0, r: 0.12 },
];

export const CAT_BODY_HEIGHT = 0.72;

export const CAT_STEP_HEIGHT = 0.6;

export const CAT_SLIDE_BIASES: ReadonlyArray<number> = [0, 0.3, -0.3, 0.65, -0.65, 1.0, -1.0, 1.4, -1.4, 1.9, -1.9];

export const CAT_WATER_ZONES: ReadonlyArray<{ minX: number; maxX: number; minZ: number; maxZ: number }> = [
  { minX: 16.4, maxX: 27.6, minZ: 20.5, maxZ: 27.5 },
];
import { ballTexture } from "./textures";

export interface WorldCreatures {
  activateBird(...args: any[]): any;
  ball: any;
  ballFlying: any;
  ballResetTimer: any;
  ballRestTimer: any;
  ballScored: any;
  ballVelocity: any;
  birds: any;
  cat: any;
  catHearts: any;
  catObstacles: any;
  catObstaclesBuilt: any;
  colliders: any;
  confetti: any;
  crumbs: any;
  duck: any;
  duckBaseY: any;
  duckPoke: any;
  feedCount: any;
  feedPoint: any;
  feedTimer: any;
  fireflies: any;
  fireflyBase: any;
  fireflyPhase: any;
  fishLife: any;
  fountainJets: any;
  group: any;
  interactables: any;
  lightCourt(...args: any[]): any;
  onScore: any;
  pokeDuck(...args: any[]): any;
  quality: any;
  refreshMonitor(...args: any[]): any;
  resetBall(...args: any[]): any;
  rimPositions: any;
  scores: any;
  spawnCrumbs(...args: any[]): any;
  waterMaterial: any;
  waterMeshes: any;
}

export class WorldCreatures {
  createCat() {
    const cat = new THREE.Group();
    cat.name = "cat";
    const orange = new THREE.MeshStandardMaterial({ color: 0xe0a15c, roughness: 0.85 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xf4e6c8, roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.8 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.32, 0.36), orange);
    body.position.y = 0.25;
    cat.add(body);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.3), cream);
    chest.position.set(0.3, 0.26, 0);
    cat.add(chest);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.32), orange);
    head.position.set(0.46, 0.48, 0);
    cat.add(head);
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.2), cream);
    muzzle.position.set(0.62, 0.43, 0);
    cat.add(muzzle);
    for (const z of [-0.09, 0.09]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.06), orange);
      ear.position.set(0.43, 0.68, z);
      cat.add(ear);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.04), dark);
      eye.position.set(0.62, 0.52, z * 0.9);
      cat.add(eye);
    }
    for (let i = 0; i < 4; i += 1) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.1), i % 2 === 0 ? orange : cream);
      leg.position.set(-0.22 + (i % 2) * 0.42, 0.1, i < 2 ? -0.12 : 0.12);
      cat.add(leg);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.08), orange);
    tail.position.set(-0.58, 0.46, 0);
    tail.name = "cat-tail";
    cat.add(tail);

    cat.position.set(7.2, 0.02, 6.2);
    cat.traverse((obj: any) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.userData.noShadow = true;
      }
    });
    this.group.add(cat);
    this.cat = cat;
    this.interactables.push({ id: "cat", object: cat, label: "摸摸猫", maxDistance: 3.0 });
  }

  buildCatObstacles() {
    this.catObstacles = this.colliders;
    this.catObstaclesBuilt = true;
  }

  catOverlapDepth(x: number, z: number, yaw: number, feetY: number): number {
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const stepTop = feetY + CAT_STEP_HEIGHT;
    const topY = feetY + CAT_BODY_HEIGHT;
    let depth = 0;

    for (const c of this.catObstacles) {
      if (c.maxY <= stepTop + 0.001 || c.minY >= topY) continue;
      for (const s of CAT_HIT_SAMPLES) {
        const wx = x + s.x * cos + s.z * sin;
        const wz = z - s.x * sin + s.z * cos;
        const dx = Math.min(wx + s.r - c.minX, c.maxX - (wx - s.r));
        const dz = Math.min(wz + s.r - c.minZ, c.maxZ - (wz - s.r));
        if (dx > 0 && dz > 0) depth = Math.max(depth, Math.min(dx, dz));
      }
    }

    // 水面永远不进：猫站在水里会整只沉到水面以下。
    for (const w of CAT_WATER_ZONES) {
      for (const s of CAT_HIT_SAMPLES) {
        const wx = x + s.x * cos + s.z * sin;
        const wz = z - s.x * sin + s.z * cos;
        const dx = Math.min(wx + s.r - w.minX, w.maxX - (wx - s.r));
        const dz = Math.min(wz + s.r - w.minZ, w.maxZ - (wz - s.r));
        if (dx > 0 && dz > 0) depth = Math.max(depth, Math.min(dx, dz));
      }
    }
    return depth;
  }

  catGroundAt(x: number, z: number, feetY: number): number {
    let top = 0;
    for (const c of this.catObstacles) {
      if (c.maxY > feetY + CAT_STEP_HEIGHT + 0.02) continue;
      if (c.maxY < feetY - 1.6) continue;
      if (
        x + 0.18 > c.minX &&
        x - 0.18 < c.maxX &&
        z + 0.18 > c.minZ &&
        z - 0.18 < c.maxZ
      ) {
        top = Math.max(top, c.maxY);
      }
    }
    return top;
  }

  createFireflies() {
    const count = this.quality === "high" ? 46 : 22;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const inPond = i % 3 !== 0;
      const x = inPond ? 17 + Math.random() * 12 : -41 + Math.random() * 27;
      const z = inPond ? 20 + Math.random() * 9 : 16 + Math.random() * 18;
      const y = 0.6 + Math.random() * 1.8;
      this.fireflyBase.push(new THREE.Vector3(x, y, z));
      this.fireflyPhase.push(Math.random() * Math.PI * 2);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffe38a,
      size: 0.1,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const points = new THREE.Points(geo, mat);
    points.name = "fireflies";
    points.userData.noShadow = true;
    this.group.add(points);
    this.fireflies = points;
  }

  createPigeons() {
    // 低多边形流线鸟池：预建 6 只，运行时按需随机激活/隐藏，实现数量随机刷新。
    // 飞行范围横跨整座岛、高度多变，不会只窝在头顶同一个区域。
    // 麻雀真实配色：棕褐身、浅色肚、深棕翼尾、橙嘴、黑眼，多部位分色，不再是单一色块。
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x8a6a4c, toneMapped: false });
    const bellyMat = new THREE.MeshBasicMaterial({ color: 0xe6ddc6, toneMapped: false });
    const wingMat = new THREE.MeshBasicMaterial({ color: 0x5c442e, toneMapped: false });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0x4f3826, toneMapped: false });
    const beakMat = new THREE.MeshBasicMaterial({ color: 0xd8a05a, toneMapped: false });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, toneMapped: false });
    for (let i = 0; i < 6; i += 1) {
      const group = new THREE.Group();
      group.name = "bird";
      group.visible = false;
      // 缩小整只鸟：缩到 0.5，小巧自然，不再偏大。
      group.scale.setScalar(0.5);
      // 流线身体：拉长的卵形，头朝 +X（前方）
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 9), bodyMat);
      body.scale.set(1.4, 0.62, 0.6);
      group.add(body);
      // 腹部：下方一块浅色，模拟麻雀的浅灰白肚子
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), bellyMat);
      belly.scale.set(1.1, 0.5, 0.9);
      belly.position.set(0.02, -0.18, 0);
      group.add(belly);
      // 头
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), bodyMat);
      head.position.set(0.6, 0.16, 0);
      group.add(head);
      // 眼睛：头两侧小黑点
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), eyeMat);
      eyeL.position.set(0.74, 0.26, -0.15);
      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), eyeMat);
      eyeR.position.set(0.74, 0.26, 0.15);
      group.add(eyeL, eyeR);
      // 嘴：锥体尖端朝前，橙黄
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 5), beakMat);
      beak.rotation.z = Math.PI / 2;
      beak.position.set(0.9, 0.1, 0);
      group.add(beak);
      // 尾羽：上翘，深棕
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.2), tailMat);
      tail.position.set(-0.86, 0.04, 0);
      tail.rotation.z = 0.55;
      group.add(tail);
      // 双翼：独立分组，深棕，绕身体纵轴上下扇动
      const wingGeom = new THREE.BoxGeometry(0.14, 0.52, 1.05);
      const leftWing = new THREE.Group();
      const lw = new THREE.Mesh(wingGeom, wingMat);
      lw.position.set(0, 0.16, -0.6);
      leftWing.add(lw);
      leftWing.position.set(0, 0.08, 0);
      group.add(leftWing);
      const rightWing = new THREE.Group();
      const rw = new THREE.Mesh(wingGeom, wingMat);
      rw.position.set(0, 0.16, 0.6);
      rightWing.add(rw);
      rightWing.position.set(0, 0.08, 0);
      group.add(rightWing);

      group.userData.noShadow = true;
      this.group.add(group);
      this.birds.push({
        group,
        leftWing,
        rightWing,
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        target: new THREE.Vector3(),
        turnTimer: 0,
        speed: 0,
        flapPhase: i * 1.7,
        perched: false,
        perchTimer: 0,
        perchSpot: null,
        leaving: false,
      });
    }
    // 开局随机激活 2~4 只。
    const inactive = [...this.birds];
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i += 1) {
      if (inactive.length === 0) break;
      const bird = inactive.splice(Math.floor(Math.random() * inactive.length), 1)[0]!;
      this.activateBird(bird);
    }
  }

  activateBird(bird: (typeof this.birds)[number]) {
    const x = (Math.random() * 2 - 1) * 55;
    const z = (Math.random() * 2 - 1) * 55;
    const y = 10 + Math.random() * 6;
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.2 + Math.random() * 3;
    bird.pos.set(x, y, z);
    bird.vel.set(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(speed);
    bird.target.set(
      (Math.random() * 2 - 1) * 55,
      10 + Math.random() * 6,
      (Math.random() * 2 - 1) * 55,
    );
    bird.turnTimer = 2 + Math.random() * 3;
    bird.speed = speed;
    bird.perched = false;
    bird.perchTimer = 5 + Math.random() * 8;
    bird.perchSpot = null;
    bird.leaving = false;
    bird.active = true;
    bird.group.position.copy(bird.pos);
    bird.group.visible = true;
  }

  pickLandingSpot(): [number, number, number] {
    const taken = this.birds
      .filter((b: any) => b.perched && b.perchSpot)
      .map((b: any) => b.perchSpot!.join(","));
    const free = BIRD_LANDING_SPOTS.filter((s: any) => !taken.includes(s.join(",")));
    const pool = free.length > 0 ? free : BIRD_LANDING_SPOTS;
    return (pool[Math.floor(Math.random() * pool.length)] ?? BIRD_LANDING_SPOTS[0]) as [number, number, number];
  }

  startDeparture(bird: (typeof this.birds)[number]) {
    bird.leaving = true;
    const dir = bird.vel.clone();
    if (dir.lengthSq() < 0.01) dir.set(1, 0, 0);
    dir.normalize();
    bird.target.set(
      bird.pos.x + dir.x * 150,
      bird.pos.y + Math.random() * 4,
      bird.pos.z + dir.z * 150,
    );
    bird.turnTimer = 9999; // 一直朝远处飞，不再换目标
    bird.speed = bird.speed + 1.6;
    if (bird.perched) {
      bird.perched = false;
      bird.perchSpot = null;
    }
  }

  deactivateBird(bird: (typeof this.birds)[number]) {
    bird.active = false;
    bird.leaving = false;
    bird.group.visible = false;
  }

  spawnCatHearts() {
    if (!this.cat) return;
    if (this.catHearts) {
      this.group.remove(this.catHearts.points);
      this.catHearts.points.geometry.dispose();
      (this.catHearts.points.material as THREE.Material).dispose();
    }
    const count = 18;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = this.cat.position.x + (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = this.cat.position.y + 0.5 + Math.random() * 0.3;
      positions[i * 3 + 2] = this.cat.position.z + (Math.random() - 0.5) * 0.5;
      velocities[i * 3] = (Math.random() - 0.5) * 0.4;
      velocities[i * 3 + 1] = 0.4 + Math.random() * 0.4;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xff8aa8,
      size: 0.14,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      toneMapped: false,
    });
    const points = new THREE.Points(geo, mat);
    points.userData.noShadow = true;
    this.group.add(points);
    this.catHearts = { points, velocities, life: 1.8 };
  }

  createFountain() {
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

  createDuck() {
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
    duck.traverse((obj: any) => {
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

  spawnCrumbs(x: number, z: number) {
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

  updateCrumbs(dt: number) {
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

  createFish() {
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

  createBall() {
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

  spawnConfetti() {
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

  updateBall(dt: number) {
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

  resetBall() {
    this.ball.position.set(26, 0.47, 2);
    this.ballVelocity.set(0, 0, 0);
    this.ball.rotation.set(0, 0, 0);
    this.ballFlying = false;
    this.ballScored = false;
    this.ballResetTimer = 0;
    this.ballRestTimer = 0;
  }

  updateConfetti(dt: number) {
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
