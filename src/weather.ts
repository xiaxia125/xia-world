import * as THREE from "three";
import type { Quality, ShelterZone, WeatherType } from "./world/types";
import { radialTexture } from "./world/textures";

interface Drop {
  x: number;
  y: number;
  z: number;
  speed: number;
  len: number;
}

export class WeatherSystem {
  type: WeatherType = "clear";

  private readonly scene: THREE.Scene;
  private readonly rain: THREE.LineSegments;
  private readonly rainPositions: Float32Array;
  private readonly drops: Drop[] = [];
  private readonly rainMaterial: THREE.LineBasicMaterial;

  private readonly snow: THREE.Points;
  private readonly snowPositions: Float32Array;
  private readonly snowSpeed: Float32Array;
  private readonly snowPhase: Float32Array;
  private readonly snowMaterial: THREE.PointsMaterial;

  private rainOpacity = 0;
  private snowOpacity = 0;
  private shelters: ShelterZone[] = [];
  private readonly dropCount: number;
  private readonly flakeCount: number;

  constructor(scene: THREE.Scene, quality: Quality) {
    this.scene = scene;
    this.dropCount = quality === "high" ? 1100 : 520;
    this.flakeCount = quality === "high" ? 760 : 360;

    this.rainPositions = new Float32Array(this.dropCount * 6);
    for (let i = 0; i < this.dropCount; i += 1) {
      this.drops.push({
        x: (Math.random() - 0.5) * 48,
        y: Math.random() * 26,
        z: (Math.random() - 0.5) * 48,
        speed: 20 + Math.random() * 16,
        len: 0.55 + Math.random() * 0.9,
      });
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute("position", new THREE.BufferAttribute(this.rainPositions, 3));
    this.rainMaterial = new THREE.LineBasicMaterial({
      color: 0xa9c8ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: true,
    });
    this.rain = new THREE.LineSegments(rainGeo, this.rainMaterial);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);

    this.snowPositions = new Float32Array(this.flakeCount * 3);
    this.snowSpeed = new Float32Array(this.flakeCount);
    this.snowPhase = new Float32Array(this.flakeCount);
    for (let i = 0; i < this.flakeCount; i += 1) {
      this.snowPositions[i * 3] = (Math.random() - 0.5) * 46;
      this.snowPositions[i * 3 + 1] = Math.random() * 24;
      this.snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 46;
      this.snowSpeed[i] = 0.7 + Math.random() * 1.4;
      this.snowPhase[i] = Math.random() * Math.PI * 2;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute("position", new THREE.BufferAttribute(this.snowPositions, 3));
    this.snowMaterial = new THREE.PointsMaterial({
      color: 0xf4f8ff,
      size: 0.18,
      map: radialTexture("rgba(255,255,255,0.95)", "rgba(255,255,255,0)", 64),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.snow = new THREE.Points(snowGeo, this.snowMaterial);
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    scene.add(this.snow);
  }

  setType(type: WeatherType) {
    this.type = type;
  }

  setShelters(zones: ShelterZone[]) {
    this.shelters = zones;
  }

  /** True when the camera is below a roof, used to muffle rain audio indoors. */
  isIndoors(position: THREE.Vector3) {
    return this.isSheltered(position.x, position.y, position.z);
  }

  private roofAt(x: number, z: number) {
    let roofY: number | undefined;
    for (const zone of this.shelters) {
      if (x > zone.minX && x < zone.maxX && z > zone.minZ && z < zone.maxZ) {
        roofY = roofY === undefined ? zone.roofY : Math.min(roofY, zone.roofY);
      }
    }
    return roofY;
  }

  private isSheltered(x: number, y: number, z: number) {
    const roofY = this.roofAt(x, z);
    return roofY !== undefined && y < roofY;
  }

  cycle(): WeatherType {
    const order: WeatherType[] = ["clear", "rain", "snow", "fog"];
    const index = order.indexOf(this.type);
    this.type = order[(index + 1) % order.length];
    return this.type;
  }

  get rainAmount() {
    return this.rainOpacity;
  }

  get label() {
    return { clear: "晴", rain: "雨", snow: "雪", fog: "雾" }[this.type];
  }

  get icon() {
    return { clear: "☀", rain: "☂", snow: "❄", fog: "≋" }[this.type];
  }

  update(dt: number, camera: THREE.Vector3) {
    this.rainOpacity = THREE.MathUtils.damp(
      this.rainOpacity,
      this.type === "rain" ? 1 : 0,
      3.2,
      dt,
    );
    this.snowOpacity = THREE.MathUtils.damp(
      this.snowOpacity,
      this.type === "snow" ? 1 : 0,
      3.2,
      dt,
    );

    this.rain.visible = this.rainOpacity > 0.01;
    this.rainMaterial.opacity = this.rainOpacity * 0.62;
    this.snow.visible = this.snowOpacity > 0.01;
    this.snowMaterial.opacity = this.snowOpacity * 0.9;

    if (this.rain.visible) this.updateRain(dt, camera);
    if (this.snow.visible) this.updateSnow(dt, camera);
  }

  private updateRain(dt: number, camera: THREE.Vector3) {
    const pos = this.rain.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < this.dropCount; i += 1) {
      const d = this.drops[i];
      d.y -= d.speed * dt;
      if (
        this.isSheltered(d.x, d.y, d.z) ||
        d.y < camera.y - 3 ||
        Math.abs(d.x - camera.x) > 30 ||
        Math.abs(d.z - camera.z) > 30
      ) {
        d.x = camera.x + (Math.random() - 0.5) * 46;
        d.z = camera.z + (Math.random() - 0.5) * 46;
        d.y = camera.y + 17 + Math.random() * 10;
      }
      const j = i * 6;
      const roofY = this.roofAt(d.x, d.z);
      const bottom = roofY === undefined ? d.y - d.len : Math.max(d.y - d.len, roofY);
      arr[j] = d.x;
      arr[j + 1] = d.y;
      arr[j + 2] = d.z;
      arr[j + 3] = d.x - 0.08 * d.len;
      arr[j + 4] = bottom;
      arr[j + 5] = d.z + 0.03 * d.len;
    }
    pos.needsUpdate = true;
  }

  private updateSnow(dt: number, camera: THREE.Vector3) {
    const pos = this.snow.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const t = performance.now() * 0.001;
    for (let i = 0; i < this.flakeCount; i += 1) {
      const j = i * 3;
      arr[j + 1] -= this.snowSpeed[i] * dt;
      arr[j] += Math.sin(t * 0.9 + this.snowPhase[i]) * dt * 0.45;
      arr[j + 2] += Math.cos(t * 0.7 + this.snowPhase[i]) * dt * 0.3;
      if (
        this.isSheltered(arr[j], arr[j + 1], arr[j + 2]) ||
        arr[j + 1] < camera.y - 3 ||
        Math.abs(arr[j] - camera.x) > 28 ||
        Math.abs(arr[j + 2] - camera.z) > 28
      ) {
        arr[j] = camera.x + (Math.random() - 0.5) * 42;
        arr[j + 1] = camera.y + 17 + Math.random() * 9;
        arr[j + 2] = camera.z + (Math.random() - 0.5) * 42;
      }
    }
    pos.needsUpdate = true;
  }

  setQuality(quality: Quality) {
    // The particle buffers are allocated at construction. Reducing the draw
    // range is a cheap way to scale down on low-end devices.
    const stride = quality === "high" ? 1 : 1;
    this.rain.geometry.setDrawRange(0, Math.floor(this.dropCount * 2) * stride);
    this.snow.geometry.setDrawRange(0, Math.floor(this.flakeCount) * stride);
  }
}
