import * as THREE from "three";
import type { WeatherType } from "./world/types";
import { radialTexture } from "./world/textures";

interface SkyKey {
  h: number;
  top: number;
  horizon: number;
  sun: number;
  hemi: number;
}

const SKY_KEYS: SkyKey[] = [
  { h: 0, top: 0x050b16, horizon: 0x0b1626, sun: 0x8fa8ff, hemi: 0.24 },
  { h: 5, top: 0x0a1524, horizon: 0x2a3550, sun: 0x9cb4ff, hemi: 0.3 },
  { h: 6.5, top: 0x5a79b3, horizon: 0xf2a06b, sun: 0xffc08a, hemi: 0.62 },
  { h: 9, top: 0x5ba6e6, horizon: 0xd3e9ff, sun: 0xfff0ce, hemi: 0.94 },
  { h: 12, top: 0x4a9ae6, horizon: 0xdbeeff, sun: 0xfff8e7, hemi: 1 },
  { h: 16, top: 0x5b9ede, horizon: 0xe8f2ff, sun: 0xfff0d2, hemi: 0.92 },
  { h: 18, top: 0x596aa6, horizon: 0xffa16f, sun: 0xffa365, hemi: 0.64 },
  { h: 19.5, top: 0x1d294e, horizon: 0xd66c60, sun: 0xff8e6e, hemi: 0.38 },
  { h: 21, top: 0x0a1224, horizon: 0x17223c, sun: 0xa4b9ff, hemi: 0.27 },
  { h: 24, top: 0x050b16, horizon: 0x0b1626, sun: 0x8fa8ff, hemi: 0.24 },
];

const WEATHER_TINT: Record<WeatherType, { top: number; horizon: number; mix: number }> = {
  clear: { top: 0x000000, horizon: 0x000000, mix: 0 },
  rain: { top: 0x3c4b52, horizon: 0x7e8b8e, mix: 0.65 },
  snow: { top: 0x7f8c95, horizon: 0xd3d8da, mix: 0.6 },
  fog: { top: 0x8f9a96, horizon: 0xc3c8c2, mix: 0.82 },
};

export class Environment {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  time = 9.5;
  timeScale = 1;
  night = 0;
  weather: WeatherType = "clear";

  private readonly sunLight: THREE.DirectionalLight;
  private readonly hemi: THREE.HemisphereLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly stars: THREE.Points;
  private readonly sun: THREE.Mesh;
  private readonly moon: THREE.Mesh;
  private readonly sunGlow: THREE.Sprite;
  private readonly moonGlow: THREE.Sprite;
  private readonly sunDir = new THREE.Vector3();
  private readonly moonDir = new THREE.Vector3();
  private readonly topColor = new THREE.Color();
  private readonly horizonColor = new THREE.Color();
  private readonly tmpA = new THREE.Color();
  private readonly tmpB = new THREE.Color();
  private readonly fog: THREE.FogExp2;
  private fogDensity = 0.007;
  private clouds?: THREE.InstancedMesh;
  private birds: THREE.Group[] = [];
  private cloudDrift = 0;
  private birdTime = 0;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;

    this.fog = new THREE.FogExp2(0xbfd6e6, 0.007);
    scene.fog = this.fog;

    this.hemi = new THREE.HemisphereLight(0xbfe0ff, 0x44513a, 0.8);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(this.ambient);

    this.sunLight = new THREE.DirectionalLight(0xfff2d0, 2.4);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 320;
    this.sunLight.shadow.camera.left = -58;
    this.sunLight.shadow.camera.right = 58;
    this.sunLight.shadow.camera.top = 58;
    this.sunLight.shadow.camera.bottom = -58;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.03;
    this.sunLight.target.position.set(0, 0, 0);
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    const skyGeo = new THREE.SphereGeometry(480, 32, 18);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x5ba6e6) },
        horizonColor: { value: new THREE.Color(0xd3e9ff) },
        offset: { value: 0.06 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform float offset;
        varying vec3 vWorldPosition;
        void main() {
          vec3 dir = normalize(vWorldPosition - cameraPosition);
          float h = clamp(dir.y * 0.9 + offset, 0.0, 1.0);
          float t = pow(h, 0.72);
          vec3 col = mix(horizonColor, topColor, t);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff3cc, fog: false, toneMapped: false });
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(9, 18, 12), sunMat);
    this.sun.frustumCulled = false;
    scene.add(this.sun);

    const moonMat = new THREE.MeshBasicMaterial({ color: 0xdbe6ff, fog: false, toneMapped: false });
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 12), moonMat);
    this.moon.frustumCulled = false;
    scene.add(this.moon);

    const glowTex = radialTexture("rgba(255,248,220,0.9)", "rgba(255,248,220,0)", 256);
    this.sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    this.sunGlow.scale.setScalar(92);
    this.sunGlow.frustumCulled = false;
    scene.add(this.sunGlow);

    this.moonGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        transparent: true,
        opacity: 0.32,
        color: 0xa8c2ff,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    this.moonGlow.scale.setScalar(54);
    this.moonGlow.frustumCulled = false;
    scene.add(this.moonGlow);

    const starGeo = new THREE.BufferGeometry();
    const starCount = 900;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const y = 0.06 + Math.random() * 0.94;
      const r = Math.sqrt(1 - y * y);
      positions[i * 3] = Math.cos(a) * r * 430;
      positions[i * 3 + 1] = y * 430;
      positions[i * 3 + 2] = Math.sin(a) * r * 430;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: 0xdfe8ff,
        size: 1.7,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      }),
    );
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    this.buildClouds();
    this.buildBirds();
  }

  /**
   * 方块云：用少量扁平方块拼出一朵，再在半径 320 的天空里摆一圈。
   * 云整体跟随相机平移，所以永远飘在头顶，而不会在漫游时被落下。
   */
  private buildClouds() {
    const cloudCount = 16;
    const puffsPerCloud = 4;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      fog: false,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, cloudCount * puffsPerCloud);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();

    for (let c = 0; c < cloudCount; c += 1) {
      const angle = (c / cloudCount) * Math.PI * 2 + (c % 3) * 0.21;
      const radius = 210 + ((c * 47) % 90);
      const baseY = 88 + ((c * 31) % 62);
      const width = 26 + ((c * 13) % 22);
      for (let p = 0; p < puffsPerCloud; p += 1) {
        const spread = p === 0 ? 0 : (p % 2 === 0 ? 1 : -1) * (0.3 + p * 0.22);
        pos.set(
          Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * width * spread,
          baseY + (p === 0 ? 0 : (p % 2) * 5),
          Math.sin(angle) * radius + Math.sin(angle + Math.PI / 2) * width * spread,
        );
        scale.set(
          width * (p === 0 ? 1 : 0.62),
          p === 0 ? 9 : 6.5,
          width * (p === 0 ? 0.62 : 0.42),
        );
        m.compose(pos, q, scale);
        mesh.setMatrixAt(c * puffsPerCloud + p, m);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;

    this.clouds = mesh;
    this.scene.add(mesh);
  }

  /**
   * 飞鸟：3 只一组，绕世界缓慢盘旋，翅膀用两个薄片交替扇动。
   * 每只鸟是一个 Group，位置由 angle/radius 参数化，避免逐帧三角函数堆积。
   */
  private buildBirds() {
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x2b3230, fog: false });
    const groups: THREE.Group[] = [];
    const specs = [
      { radius: 46, height: 30, speed: 0.22, phase: 0, size: 1 },
      { radius: 58, height: 36, speed: 0.17, phase: 2.1, size: 0.82 },
      { radius: 40, height: 26, speed: 0.26, phase: 4.3, size: 0.7 },
      { radius: 66, height: 42, speed: 0.14, phase: 1.2, size: 0.9 },
      { radius: 52, height: 33, speed: 0.2, phase: 3.4, size: 0.76 },
      { radius: 44, height: 28, speed: 0.24, phase: 5.5, size: 0.66 },
    ];

    for (const spec of specs) {
      const bird = new THREE.Group();
      bird.frustumCulled = false;

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.34, 0.34), birdMat);
      bird.add(body);

      // 两片翅膀各自挂在 body 两侧，扇动时绕 z 轴小角度摆动。
      const wingGeo = new THREE.BoxGeometry(1.5, 0.06, 0.5);
      const left = new THREE.Mesh(wingGeo, birdMat);
      left.position.set(0, 0.06, -0.62);
      const right = new THREE.Mesh(wingGeo, birdMat);
      right.position.set(0, 0.06, 0.62);
      bird.add(left, right);

      bird.userData.wings = [left, right];
      bird.userData.spec = spec;
      bird.scale.setScalar(spec.size);

      groups.push(bird);
      this.scene.add(bird);
    }
    this.birds = groups;
  }

  setWeather(type: WeatherType) {
    this.weather = type;
  }

  setTime(hours: number) {
    this.time = ((hours % 24) + 24) % 24;
  }

  getTimeLabel() {
    const h = Math.floor(this.time);
    const m = Math.floor((this.time - h) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  getPhaseLabel() {
    const h = this.time;
    if (h >= 5 && h < 11) return "MORNING";
    if (h >= 11 && h < 14) return "NOON";
    if (h >= 14 && h < 17) return "AFTERNOON";
    if (h >= 17 && h < 19.5) return "DUSK";
    return "NIGHT";
  }

  update(dt: number, cameraPos: THREE.Vector3) {
    this.time = (this.time + dt * (24 / 720) * this.timeScale) % 24;

    const angle = ((this.time - 6) / 24) * Math.PI * 2;
    this.sunDir.set(Math.cos(angle), Math.sin(angle), 0.26).normalize();
    this.moonDir.copy(this.sunDir).multiplyScalar(-1);

    const sunY = this.sunDir.y;
    const day = THREE.MathUtils.clamp((sunY + 0.08) / 0.32, 0, 1);
    this.night = 1 - THREE.MathUtils.smoothstep(sunY, -0.08, 0.14);

    const { top, horizon, key } = this.sampleSky(this.time);
    this.tmpA.setHex(key.sun);
    this.topColor.copy(top);
    this.horizonColor.copy(horizon);

    const tint = WEATHER_TINT[this.weather];
    if (tint.mix > 0) {
      this.tmpB.setHex(tint.top);
      this.topColor.lerp(this.tmpB, tint.mix * 0.75);
      this.tmpB.setHex(tint.horizon);
      this.horizonColor.lerp(this.tmpB, tint.mix * 0.75);
      this.topColor.multiplyScalar(1 - this.night * 0.45);
      this.horizonColor.multiplyScalar(1 - this.night * 0.42);
    }

    const skyUniforms = this.sky.material.uniforms;
    (skyUniforms.topColor.value as THREE.Color).copy(this.topColor);
    (skyUniforms.horizonColor.value as THREE.Color).copy(this.horizonColor);

    this.fog.color.copy(this.horizonColor).lerp(new THREE.Color(0xffffff), 0.12);

    let targetDensity = 0.0072;
    if (this.weather === "rain") targetDensity = 0.019;
    else if (this.weather === "snow") targetDensity = 0.015;
    else if (this.weather === "fog") targetDensity = 0.035;
    targetDensity += this.night * 0.0018;
    this.fogDensity = THREE.MathUtils.damp(this.fogDensity, targetDensity, 1.8, dt);
    this.fog.density = this.fogDensity;

    // Sun / moon light
    const sunVisible = sunY > -0.06;
    const lightDir = sunVisible ? this.sunDir : this.moonDir;
    this.sunLight.position.copy(lightDir).multiplyScalar(120);
    this.sunLight.target.position.set(0, 0, 0);
    this.sunLight.target.updateMatrixWorld();

    if (sunVisible) {
      const low = 1 - THREE.MathUtils.clamp(sunY / 0.45, 0, 1);
      this.sunLight.color.copy(this.tmpA).lerp(new THREE.Color(0xffb070), low * 0.7);
      this.sunLight.intensity = (0.35 + THREE.MathUtils.clamp(sunY, 0, 1) * 2.3) * (1 - tint.mix * 0.3);
    } else {
      this.sunLight.color.setHex(0x9fb8ff);
      this.sunLight.intensity = 0.34 * (1 - tint.mix * 0.35);
    }

    this.hemi.intensity = (0.22 + day * 0.72) * (1 - tint.mix * 0.18);
    this.hemi.color.copy(this.topColor).lerp(new THREE.Color(0xffffff), 0.3);
    this.hemi.groundColor.setHex(0x3f4a34);
    this.ambient.intensity = 0.14 + day * 0.2 + this.night * 0.04;

    // Sun / moon discs
    this.sun.position.copy(this.sunDir).multiplyScalar(380).add(cameraPos);
    this.moon.position.copy(this.moonDir).multiplyScalar(380).add(cameraPos);
    this.sunGlow.position.copy(this.sun.position);
    this.moonGlow.position.copy(this.moon.position);

    this.sun.visible = sunY > -0.12;
    this.sunGlow.visible = sunY > -0.05;
    this.moon.visible = this.moonDir.y > -0.12;
    this.moonGlow.visible = this.moonDir.y > -0.05;

    this.sunGlow.material.opacity = 0.5 * (1 - tint.mix * 0.75) * (0.55 + day * 0.45);
    this.sunGlow.scale.setScalar(70 + day * 34);
    this.moonGlow.material.opacity = 0.24 * this.night * (1 - tint.mix * 0.7);
    this.moonGlow.scale.setScalar(44 + this.night * 16);

    this.sky.position.copy(cameraPos);
    this.stars.position.copy(cameraPos);
    this.stars.rotation.y += dt * 0.002;
    (this.stars.material as THREE.PointsMaterial).opacity =
      this.night * (1 - tint.mix * 0.9) * (0.72 + Math.sin(this.time * 8) * 0.05);

    this.updateClouds(dt, cameraPos, tint.mix, day);
    this.updateBirds(dt, cameraPos);
  }

  /** 云跟着相机平移，随时间缓慢自转；夜里变暗、雨雾天变浑厚。 */
  private updateClouds(dt: number, cameraPos: THREE.Vector3, tintMix: number, day: number) {
    const clouds = this.clouds;
    if (!clouds) return;

    this.cloudDrift += dt * 0.006;
    clouds.position.copy(cameraPos);
    clouds.rotation.y = this.cloudDrift;

    const mat = clouds.material as THREE.MeshLambertMaterial;
    // 晴天明亮，阴雨天更灰；夜里几乎融进夜空但仍留一点轮廓。
    const brightness = 0.42 + day * 0.58;
    mat.color.setRGB(brightness, brightness, brightness);
    mat.opacity = (1 - tintMix * 0.35) * (0.35 + day * 0.6) * (1 - this.night * 0.55);
    clouds.visible = mat.opacity > 0.02;
  }

  /** 飞鸟绕世界中心盘旋，翅膀按相位交替扇动。 */
  private updateBirds(dt: number, cameraPos: THREE.Vector3) {
    this.birdTime += dt;
    for (const bird of this.birds) {
      const spec = bird.userData.spec as {
        radius: number;
        height: number;
        speed: number;
        phase: number;
        size: number;
      };
      const t = this.birdTime * spec.speed + spec.phase;
      bird.position.set(
        cameraPos.x + Math.cos(t) * spec.radius,
        spec.height + Math.sin(t * 2.1) * 3.5,
        cameraPos.z + Math.sin(t) * spec.radius,
      );
      // 朝向切线方向飞行
      bird.rotation.y = -t + Math.PI / 2;

      const flap = Math.sin(t * 7.5) * 0.55;
      const wings = bird.userData.wings as THREE.Mesh[];
      if (wings) {
        wings[0]!.rotation.x = flap;
        wings[1]!.rotation.x = -flap;
      }

      bird.visible = this.night < 0.85 && this.weather !== "fog";
    }
  }

  private sampleSky(hour: number): { top: THREE.Color; horizon: THREE.Color; key: SkyKey } {
    let a = SKY_KEYS[0];
    let b = SKY_KEYS[1];
    for (let i = 0; i < SKY_KEYS.length - 1; i += 1) {
      if (hour >= SKY_KEYS[i].h && hour <= SKY_KEYS[i + 1].h) {
        a = SKY_KEYS[i];
        b = SKY_KEYS[i + 1];
        break;
      }
    }
    const span = b.h - a.h || 1;
    const raw = THREE.MathUtils.clamp((hour - a.h) / span, 0, 1);
    const u = raw * raw * (3 - 2 * raw);
    const top = new THREE.Color(a.top).lerp(new THREE.Color(b.top), u);
    const horizon = new THREE.Color(a.horizon).lerp(new THREE.Color(b.horizon), u);
    const sun = new THREE.Color(a.sun).lerp(new THREE.Color(b.sun), u);
    return {
      top,
      horizon,
      key: {
        h: hour,
        top: top.getHex(),
        horizon: horizon.getHex(),
        sun: sun.getHex(),
        hemi: THREE.MathUtils.lerp(a.hemi, b.hemi, u),
      },
    };
  }

  setShadowQuality(quality: "high" | "low") {
    this.sunLight.castShadow = quality === "high";
    this.sunLight.shadow.mapSize.set(quality === "high" ? 2048 : 512, quality === "high" ? 2048 : 512);
    if (this.sunLight.shadow.map) {
      this.sunLight.shadow.map.dispose();
      this.sunLight.shadow.map = null;
    }
  }
}
