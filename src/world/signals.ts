import * as THREE from "three";
import { C } from "./builders";



export const CONSTELLATION_STARS: ReadonlyArray<{
  zoneId: string;
  index: string;
  label: string;
  title: string;
  body: string;
  tags: readonly string[];
  position: [number, number, number];
}> = [
  {
    zoneId: "gallery",
    index: "02",
    label: "项目展厅",
    title: "三块屏在讲同一件事",
    body: "展厅里三块大型项目屏，走近按 E 能看到每个项目做了什么、用什么做的。",
    tags: ["项目", "展厅"],
    position: [1.8, 15.2, -8.8],
  },
  {
    zoneId: "studio",
    index: "03",
    label: "工作室",
    title: "书架后面还有一段路",
    body: "工作室的书架按 E 可以推开，露出墙后的一条隐藏留言。",
    tags: ["工作室", "书架"],
    position: [4.2, 16.1, -8.2],
  },
  {
    zoneId: "secret",
    index: "04",
    label: "书架密室",
    title: "给探索者的留言",
    body: "从书架后面进去，密室终端留了一条给探索者的话。",
    tags: ["密室", "留言"],
    position: [6.8, 16.3, -8.6],
  },
  {
    zoneId: "trail",
    index: "08",
    label: "五年小径",
    title: "从 2021 走到 NOW",
    body: "五年小径用五块石碑串起从 2021 到现在的路，尽头是凉亭和邮筒。",
    tags: ["小径", "石碑"],
    position: [9.0, 15.4, -9.8],
  },
  {
    zoneId: "lookout",
    index: "11",
    label: "观景台",
    title: "把这一眼带走",
    body: "观景台的三脚架可以进入拍照模式，把眼前的光影存成一张带水印的图。",
    tags: ["观景台", "拍照"],
    position: [7.0, 14.6, -11.8],
  },
  {
    zoneId: "pond",
    index: "06",
    label: "池塘",
    title: "傍晚有萤火虫",
    body: "在池塘边和鸭子打个招呼；等天色暗下来，萤火虫会沿着水岸亮起来。",
    tags: ["池塘", "萤火虫"],
    position: [3.4, 14.8, -11.6],
  },
];
import { signalTexture } from "./textures";
import type { Interactable } from "./types";
import type { SignalCopy } from "../signals";

export interface WorldSignals {
  applyConstellationState(...args: any[]): any;
  exploredZones: any;
  group: any;
  interactables: any;
  linkSegments: any;
  linkedIds: any;
  linkedPositions(...args: any[]): any;
  quality: any;
  reducedMotion: any;
  resetLinks(...args: any[]): any;
  signalConstellation: any;
  signalConstellationElapsed: any;
  signalConstellationLine: any;
  signalConstellationLineMaterial: any;
  signalConstellationOpen: any;
  signalPulse: any;
  signalReadings: any;
  signalStarPositions: any;
  signalStars: any;
  signalSurfaces: any;
  telescopeInteractable: any;
  toggleSignalConstellation(...args: any[]): any;
  updateLinkGeometry(...args: any[]): any;
  updateSignalConstellation(...args: any[]): any;
}

export class WorldSignals {
  buildSignalConstellation() {
    const highQuality = this.quality === "high";
    const sphereSegments = highQuality ? 14 : 8;
    const coreGeometry = new THREE.SphereGeometry(0.16, sphereSegments, sphereSegments);
    const haloGeometry = new THREE.SphereGeometry(1, sphereSegments, sphereSegments);
    const hitGeometry = new THREE.SphereGeometry(1.3, 8, 6);
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

    this.signalConstellation.name = "rooftop-explore-constellation";
    this.signalConstellation.visible = false;
    this.group.add(this.signalConstellation);

    for (let index = 0; index < CONSTELLATION_STARS.length; index += 1) {
      const star = CONSTELLATION_STARS[index]!;
      const [x, y, z] = star.position;
      const position = new THREE.Vector3(x, y, z);
      const object = new THREE.Group();
      object.name = `explore-star-${star.zoneId}`;
      object.position.copy(position);
      object.visible = false;

      // 每颗星独立材质：盖章状态只改颜色，不阻塞连星。
      const coreMaterial = new THREE.MeshBasicMaterial({ color: 0x7fb0c9, toneMapped: false });
      const core = new THREE.Mesh(coreGeometry, coreMaterial);
      core.userData.noShadow = true;
      object.add(core);

      const halo = new THREE.Mesh(haloGeometry, haloMaterial);
      halo.scale.setScalar(0.36);
      halo.visible = false;
      halo.userData.noShadow = true;
      object.add(halo);

      const hitArea = new THREE.Mesh(hitGeometry, hitMaterial);
      hitArea.userData.noShadow = true;
      object.add(hitArea);

      const id = `explore-${star.zoneId}`;
      // 星点只做取景目标。文字不再贴成 3D 平面：24° 视野下那块贴图必然发糊，
      // 内容改由 DOM 目镜面板渲染，任何分辨率下都清晰。
      this.signalReadings.set(id, {
        index: star.index,
        label: star.label,
        title: star.title,
        body: star.body,
        tags: star.tags,
      });
      const interactable: Interactable = {
        id,
        object,
        label: `${star.index} · ${star.label}`,
        maxDistance: 35,
      };
      this.signalConstellation.add(object);
      this.signalStarPositions.push(position);
      this.signalStars.push({
        object,
        core,
        halo,
        interactable,
        phase: index * 0.8,
        zoneId: star.zoneId,
        explored: false,
        linked: false,
      });
    }

    // 玩家连星座的动态连线：初始为空，每次连入一颗星就往里追加一段线段。
    const linkGeometry = new THREE.BufferGeometry();
    linkGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(0), 3));
    linkGeometry.setDrawRange(0, 0);
    this.signalConstellationLineMaterial = new THREE.LineBasicMaterial({
      color: C.lime,
      transparent: true,
      opacity: highQuality ? 0.78 : 0.42,
      depthWrite: false,
      toneMapped: false,
    });
    this.signalConstellationLine = new THREE.LineSegments(linkGeometry, this.signalConstellationLineMaterial);
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

  registerSignal(id: string, surface: THREE.Mesh, detail: THREE.CanvasTexture) {
    const material = surface.material as THREE.MeshBasicMaterial;
    const base = material.map;
    if (!base) {
      detail.dispose();
      return;
    }
    this.signalSurfaces.set(id, { material, base, detail, open: false });
  }

  toggleSignalConstellation(): boolean {
    if (this.signalStars.length === 0) return false;
    this.signalConstellationOpen = !this.signalConstellationOpen;
    this.signalConstellationElapsed = 0;
    this.signalConstellation.visible = this.signalConstellationOpen;
    this.signalStars.forEach((star: any) => {
      const index = this.interactables.indexOf(star.interactable);
      if (index !== -1) this.interactables.splice(index, 1);
      star.object.visible = this.signalConstellationOpen;
    });
    this.resetLinks();
    if (this.signalPulse) this.signalPulse.visible = false;
    if (this.telescopeInteractable) {
      this.telescopeInteractable.label = this.signalConstellationOpen
        ? "关闭探索星座 · 恢复视野"
        : "用望远镜看探索星座";
    }
    if (this.signalConstellationOpen) {
      // 所有星都可连，加入射线列表；颜色按盖章状态区分。
      this.signalStars.forEach((star: any) => {
        if (!this.interactables.includes(star.interactable)) {
          this.interactables.push(star.interactable);
        }
      });
      this.applyConstellationState();
      this.updateSignalConstellation(0);
    }
    return this.signalConstellationOpen;
  }

  applyConstellationState() {
    for (const star of this.signalStars) {
      star.explored = this.exploredZones.has(star.zoneId);
      const color = star.linked ? 0xffffff : star.explored ? 0xf1ffb3 : 0x7fb0c9;
      (star.core.material as THREE.MeshBasicMaterial).color.set(color);
      if (!star.linked) star.halo.visible = false;
    }
  }

  linkStar(id: string): {
    id: string;
    index: string;
    label: string;
    title: string;
    body: string;
    tags: readonly string[];
    first: boolean;
    nth: number;
    total: number;
    complete: boolean;
  } | null {
    if (this.linkedIds.includes(id)) return null;
    const star = this.signalStars.find((s: any) => s.interactable.id === id);
    if (!star) return null;
    this.linkedIds.push(id);
    star.linked = true;
    (star.core.material as THREE.MeshBasicMaterial).color.set(0xffffff);
    star.halo.visible = this.quality === "high";
    if (this.linkedIds.length >= 2) {
      const prev = this.signalStars.find(
        (s: any) => s.interactable.id === this.linkedIds[this.linkedIds.length - 2],
      );
      if (prev) {
        const p = prev.object.position;
        const q = star.object.position;
        this.linkSegments.push(p.x, p.y, p.z, q.x, q.y, q.z);
        this.updateLinkGeometry();
      }
    }
    const copy = this.signalReadings.get(id);
    return {
      id,
      index: copy?.index ?? "",
      label: copy?.label ?? star.zoneId,
      title: copy?.title ?? "",
      body: copy?.body ?? "",
      tags: copy?.tags ?? [],
      first: this.linkedIds.length === 1,
      nth: this.linkedIds.length,
      total: CONSTELLATION_STARS.length,
      complete: this.linkedIds.length === CONSTELLATION_STARS.length,
    };
  }

  updateLinkGeometry() {
    if (!this.signalConstellationLine) return;
    const geo = this.signalConstellationLine.geometry;
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.linkSegments), 3));
    geo.setDrawRange(0, this.linkSegments.length / 3);
  }

  resetLinks() {
    this.linkedIds.length = 0;
    this.linkSegments.length = 0;
    for (const star of this.signalStars) {
      star.linked = false;
    }
    this.updateLinkGeometry();
  }

  linkedPositions(): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    for (const id of this.linkedIds) {
      const star = this.signalStars.find((s: any) => s.interactable.id === id);
      if (star) out.push(star.object.position);
    }
    return out;
  }

  isConstellationComplete(): boolean {
    return (
      this.signalStars.length > 0 &&
      this.linkedIds.length === CONSTELLATION_STARS.length
    );
  }

  updateSignalConstellation(dt: number) {
    if (!this.signalConstellationOpen || !this.signalConstellationLine) return;
    if (!this.reducedMotion) this.signalConstellationElapsed += dt;
    const elapsed = this.signalConstellationElapsed;
    const highQuality = this.quality === "high";
    for (const star of this.signalStars) {
      star.core.scale.setScalar(
        !this.reducedMotion && highQuality ? 1 + Math.sin(elapsed * 2.4 + star.phase) * 0.12 : 1,
      );
      if (!star.linked && !star.explored) star.halo.visible = false;
    }
    if (this.signalPulse) {
      const positions = this.linkedPositions();
      if (positions.length >= 2 && highQuality && !this.reducedMotion) {
        this.signalPulse.visible = true;
        const phase = (elapsed * 0.6) % (positions.length - 1);
        const link = Math.floor(phase);
        const t = phase - link;
        this.signalPulse.position.copy(positions[link]!).lerp(positions[link + 1]!, t);
      } else {
        this.signalPulse.visible = false;
      }
    }
  }

  readSignal(id: string): boolean {
    const signal = this.signalSurfaces.get(id);
    if (!signal) return false;
    signal.open = !signal.open;
    signal.material.map = signal.open ? signal.detail : signal.base;
    signal.material.needsUpdate = true;
    return true;
  }

  disposeSignals() {
    if (this.signalConstellationOpen) this.toggleSignalConstellation();
    this.signalStars.forEach((star: any) => {
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
}
