 import * as THREE from "three";
import type { AABB } from "./world/types";

const EYE_HEIGHT = 1.62;
const PLAYER_HEIGHT = 1.78;
const PLAYER_HALF = 0.32;
const STEP_HEIGHT = 0.62;
const GRAVITY = 22;
const WALK_SPEED = 5.2;
const SPRINT_SPEED = 8.3;
const MAX_FRAME = 0.05;
const FIXED_STEP = 1 / 90;
const JUMP_BUFFER = 0.14;
const COYOTE_TIME = 0.11;

export class Player {
  readonly position = new THREE.Vector3(0, 0.4, 30);
  readonly velocity = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  sensitivity = 1;
  enabled = false;
  onGround = false;
  touchMode = false;
  /** 坐姿：只靠禁用位移 + 眼高偏移实现，不碰碰撞体，起身时恢复。 */
  seated = false;
  private eyeOffset = 0;
  private seatSave: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    velocity: THREE.Vector3;
  } | null = null;

  onStep?: () => void;
  onLockChange?: (locked: boolean) => void;

  private readonly camera: THREE.PerspectiveCamera;
  private readonly dom: HTMLCanvasElement;
  private readonly colliders: AABB[];
  private readonly keys = new Set<string>();
  private readonly events = new AbortController();
  private disposed = false;
  private joystickX = 0;
  private joystickY = 0;
  private jumpBuffer = 0;
  private coyote = 0;
  private bobPhase = 0;
  private bobAmount = 0;
  private stepOffset = 0;
  private stepTimer = 0;
  private sprinting = false;
  private horizontalSpeed = 0;

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLCanvasElement, colliders: AABB[]) {
    this.camera = camera;
    this.dom = dom;
    this.colliders = colliders;
    this.attach();
  }

  get isLocked() {
    return document.pointerLockElement === this.dom;
  }

  get isSprinting() {
    return this.sprinting;
  }

  /** Movement input, including the touch joystick, without waiting for velocity. */
  get hasMoveInput() {
    if (
      this.keys.has("KeyW") ||
      this.keys.has("KeyA") ||
      this.keys.has("KeyS") ||
      this.keys.has("KeyD") ||
      this.keys.has("ArrowUp") ||
      this.keys.has("ArrowLeft") ||
      this.keys.has("ArrowDown") ||
      this.keys.has("ArrowRight")
    ) {
      return true;
    }
    return Math.hypot(this.joystickX, this.joystickY) > 0.12;
  }

  private attach() {
    const { signal } = this.events;
    window.addEventListener("keydown", (event) => {
      if (!this.enabled) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName)) return;
      const code = event.code;
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Space",
          "ShiftLeft",
          "ShiftRight",
        ].includes(code)
      ) {
        event.preventDefault();
      }
      if (code === "Space" && !event.repeat) this.queueJump();
      this.keys.add(code);
    }, { signal });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
    }, { signal });

    window.addEventListener("blur", () => {
      this.keys.clear();
      this.joystickX = 0;
      this.joystickY = 0;
    }, { signal });

    document.addEventListener("mousemove", (event) => {
      if (!this.enabled || !this.isLocked) return;
      // Pointer-lock can occasionally emit a huge movement spike when the
      // window regains focus. Clamping keeps the view from teleporting.
      const dx = THREE.MathUtils.clamp(event.movementX, -140, 140);
      const dy = THREE.MathUtils.clamp(event.movementY, -140, 140);
      this.addLook(dx, dy);
    }, { signal });

    document.addEventListener("pointerlockchange", () => {
      this.onLockChange?.(this.isLocked);
    }, { signal });
    document.addEventListener("pointerlockerror", () => {
      this.onLockChange?.(this.isLocked);
    }, { signal });

    this.dom.addEventListener("click", () => {
      if (!this.enabled || this.touchMode || this.isLocked) return;
      this.requestLock();
    }, { signal });
  }

  /** Stops player input and releases pointer lock when the world is unmounted. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.enabled = false;
    this.keys.clear();
    this.joystickX = 0;
    this.joystickY = 0;
    this.events.abort();
    if (this.isLocked) document.exitPointerLock();
    this.onStep = undefined;
    this.onLockChange = undefined;
  }

  requestLock() {
    if (this.disposed || this.touchMode) return;
    try {
      const result = this.dom.requestPointerLock() as unknown as Promise<void> | undefined;
      if (result && typeof result.catch === "function") {
        result.catch(() => this.onLockChange?.(this.isLocked));
      }
    } catch {
      this.onLockChange?.(this.isLocked);
    }
  }

  addLook(dx: number, dy: number) {
    const scale = 0.0022 * this.sensitivity;
    this.yaw -= dx * scale;
    this.pitch -= dy * scale;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
  }

  setJoystick(x: number, y: number) {
    this.joystickX = THREE.MathUtils.clamp(x, -1, 1);
    this.joystickY = THREE.MathUtils.clamp(y, -1, 1);
  }

  queueJump() {
    // 坐着时不该攒跳跃：起身那一刻把缓冲放出去会让人突然弹一下。
    if (this.seated) return;
    this.jumpBuffer = JUMP_BUFFER;
  }

  setPosition(x: number, y: number, z: number, yaw?: number, pitch?: number) {
    this.position.set(x, y, z);
    if (typeof yaw === "number") this.yaw = yaw;
    if (typeof pitch === "number") this.pitch = pitch;
    this.velocity.set(0, 0, 0);
    this.onGround = false;
    this.stepOffset = 0;
    this.bobPhase = 0;
    this.bobAmount = 0;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.syncCamera();
  }

  respawn(x: number, y: number, z: number) {
    this.setPosition(x, y, z, 0, 0);
  }

  /**
   * 坐下：吸附到座位点、朝向朝银幕、眼高下降到坐姿。位移与跳跃在 step() 里被跳过，
   * 但视角照常可转。存档里不写坐姿，所以把入座前的状态记在内存，起身时原样恢复。
   */
  sitAt(x: number, y: number, z: number, yaw: number, eyeOffset: number) {
    this.seatSave = {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      yaw: this.yaw,
      pitch: this.pitch,
      velocity: this.velocity.clone(),
    };
    this.seated = true;
    this.eyeOffset = eyeOffset;
    this.position.set(x, y, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.velocity.set(0, 0, 0);
    this.bobPhase = 0;
    this.bobAmount = 0;
    this.syncCamera();
  }

  standUp() {
    const saved = this.seatSave;
    this.seated = false;
    this.eyeOffset = 0;
    this.seatSave = null;
    // 起身往往是用 W 触发的，那个键此刻还按着；不清掉就会一站起来就往前冲。
    this.keys.clear();
    if (!saved) {
      this.syncCamera();
      return;
    }
    this.position.set(saved.x, saved.y, saved.z);
    this.yaw = saved.yaw;
    this.pitch = saved.pitch;
    this.velocity.copy(saved.velocity);
    this.syncCamera();
  }

  /**
   * 存档用的位置：坐着时返回入座前的站位，否则刷新后会从座位里站起来。
   * 朝向和俯仰也一起回退，避免存档里留下一个朝银幕的姿势。
   */
  get savedPosition() {
    if (this.seatSave) {
      const { x, y, z, yaw, pitch } = this.seatSave;
      return { x, y, z, yaw, pitch };
    }
    return { x: this.position.x, y: this.position.y, z: this.position.z, yaw: this.yaw, pitch: this.pitch };
  }

  update(dt: number) {
    if (!this.enabled) return;

    const frameDt = THREE.MathUtils.clamp(dt, 0, MAX_FRAME);
    if (frameDt <= 0) {
      this.syncCamera();
      return;
    }

    // Physics runs on small, uniform substeps. This removes the micro-stutter
    // that appeared when collision resolution ran on variable frame times.
    const steps = Math.max(1, Math.min(5, Math.ceil(frameDt / FIXED_STEP)));
    const stepDt = frameDt / steps;
    for (let i = 0; i < steps; i += 1) this.step(stepDt);

    // Smooth the camera over kerbs and stairs without delaying the body.
    this.stepOffset = THREE.MathUtils.damp(this.stepOffset, 0, 14, frameDt);
    this.stepOffset = THREE.MathUtils.clamp(this.stepOffset, -0.78, 0);
    this.syncCamera();
  }

  private step(dt: number) {
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    // 坐着时不动腿：速度清零、不重力、不碰撞，但 onGround 保持为真让视野呼吸稳定。
    if (this.seated) {
      this.velocity.set(0, 0, 0);
      this.onGround = true;
      this.bobAmount = THREE.MathUtils.damp(this.bobAmount, 0, 8, dt);
      return;
    }

    const forwardInput =
      (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) -
      (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0) -
      this.joystickY;
    const strafeInput =
      (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
      (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0) +
      this.joystickX;

    let forward = THREE.MathUtils.clamp(forwardInput, -1, 1);
    let strafe = THREE.MathUtils.clamp(strafeInput, -1, 1);
    const magnitude = Math.hypot(forward, strafe);
    if (magnitude > 1) {
      forward /= magnitude;
      strafe /= magnitude;
    }

    const sprintKey = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    this.sprinting = sprintKey && forward > 0.1;
    const speed = this.sprinting ? SPRINT_SPEED : WALK_SPEED;

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wishX = (-sin * forward + cos * strafe) * speed;
    const wishZ = (-cos * forward - sin * strafe) * speed;

    const hasInput = magnitude > 0.01;
    const lambda = this.onGround ? (hasInput ? 13 : 10) : hasInput ? 2.6 : 0.9;
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, wishX, lambda, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, wishZ, lambda, dt);

    this.coyote = this.onGround ? COYOTE_TIME : Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0 && (this.onGround || this.coyote > 0)) {
      this.velocity.y = 7.5;
      this.onGround = false;
      this.jumpBuffer = 0;
      this.coyote = 0;
    }

    // A terminal fall speed keeps collision checks stable on long drops.
    this.velocity.y = Math.max(-32, this.velocity.y - GRAVITY * dt);

    this.moveAxis("x", this.velocity.x * dt);
    this.moveAxis("z", this.velocity.z * dt);
    this.moveAxis("y", this.velocity.y * dt);

    if (this.position.y < -8) {
      this.respawn(0, 0.4, 30);
      return;
    }
    this.position.x = THREE.MathUtils.clamp(this.position.x, -46.5, 46.5);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -46.5, 46.5);

    this.horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    const bobTarget = this.onGround ? Math.min(1, this.horizontalSpeed / WALK_SPEED) : 0;
    this.bobAmount = THREE.MathUtils.damp(this.bobAmount, bobTarget, 8, dt);
    if (this.onGround) {
      this.bobPhase += dt * this.horizontalSpeed * 1.4;
      this.stepTimer -= dt;
      if (this.horizontalSpeed > 1.2 && this.stepTimer <= 0) {
        this.stepTimer = this.sprinting ? 0.29 : 0.41;
        this.onStep?.();
      }
    } else {
      this.bobAmount = THREE.MathUtils.damp(this.bobAmount, 0, 5, dt);
    }
    if (this.bobAmount < 0.01) this.bobPhase = 0;
  }

  private syncCamera() {
    const bob = this.onGround ? Math.sin(this.bobPhase * 2) * 0.019 * this.bobAmount : 0;
    this.camera.position.set(
      this.position.x,
      this.position.y + EYE_HEIGHT + this.eyeOffset + this.stepOffset + bob,
      this.position.z,
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  private moveAxis(axis: "x" | "y" | "z", delta: number) {
    if (delta === 0) {
      if (axis === "y") this.checkGround();
      return;
    }

    this.position[axis] += delta;

    if (axis === "y") {
      const oldY = this.position.y - delta;
      this.onGround = false;
      if (delta < 0) {
        let top = -Infinity;
        for (const c of this.colliders) {
          if (
            this.overlapsHorizontal(c, this.position.x, this.position.z) &&
            c.maxY <= oldY + 0.001 &&
            c.maxY >= this.position.y - 0.001
          ) {
            top = Math.max(top, c.maxY);
          }
        }
        if (top > -Infinity) {
          this.position.y = top + 0.0005;
          this.onGround = true;
          this.velocity.y = 0;
        }
      } else {
        let bottom = Infinity;
        for (const c of this.colliders) {
          if (
            this.overlapsHorizontal(c, this.position.x, this.position.z) &&
            c.minY >= oldY + PLAYER_HEIGHT - 0.001 &&
            c.minY <= this.position.y + PLAYER_HEIGHT + 0.001
          ) {
            bottom = Math.min(bottom, c.minY);
          }
        }
        if (bottom < Infinity) {
          this.position.y = bottom - PLAYER_HEIGHT - 0.0005;
          this.velocity.y = 0;
        }
      }
      this.checkGround();
      return;
    }

    // Horizontal movement, with a small step-up for stairs and kerbs.
    const half = PLAYER_HALF;
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const hit = this.collidesAt(this.position.x, this.position.y, this.position.z);
      if (!hit) break;

      if (this.onGround) {
        const targetY = hit.maxY + 0.0005;
        if (
          hit.maxY - this.position.y <= STEP_HEIGHT + 0.01 &&
          !this.collidesAt(this.position.x, targetY, this.position.z)
        ) {
          const rise = targetY - this.position.y;
          this.position.y = targetY;
          this.stepOffset = Math.max(-0.78, this.stepOffset - Math.max(0, rise));
          this.velocity.y = 0;
          break;
        }
      }

      if (axis === "x") {
        if (delta > 0) this.position.x = hit.minX - half - 0.001;
        else this.position.x = hit.maxX + half + 0.001;
        this.velocity.x = 0;
      } else {
        if (delta > 0) this.position.z = hit.minZ - half - 0.001;
        else this.position.z = hit.maxZ + half + 0.001;
        this.velocity.z = 0;
      }
    }
  }

  private checkGround() {
    if (this.velocity.y > 0.5) {
      this.onGround = false;
      return;
    }
    const probeY = this.position.y - 0.07;
    let top = -Infinity;
    for (const c of this.colliders) {
      if (
        this.overlapsHorizontal(c, this.position.x, this.position.z) &&
        probeY < c.maxY &&
        this.position.y + PLAYER_HEIGHT > c.minY &&
        this.position.y >= c.maxY - 0.12
      ) {
        top = Math.max(top, c.maxY);
      }
    }
    if (top > -Infinity) {
      const drop = Math.max(0, this.position.y - (top + 0.0005));
      this.onGround = true;
      this.position.y = top + 0.0005;
      if (drop > 0.03) this.stepOffset = Math.max(-0.78, this.stepOffset + drop);
      return;
    }
    this.onGround = false;
  }

  private overlapsHorizontal(c: AABB, x: number, z: number) {
    return (
      x + PLAYER_HALF > c.minX + 0.001 &&
      x - PLAYER_HALF < c.maxX - 0.001 &&
      z + PLAYER_HALF > c.minZ + 0.001 &&
      z - PLAYER_HALF < c.maxZ - 0.001
    );
  }

  private collidesAt(x: number, y: number, z: number): AABB | null {
    for (const c of this.colliders) {
      if (
        x + PLAYER_HALF > c.minX + 0.001 &&
        x - PLAYER_HALF < c.maxX - 0.001 &&
        y + PLAYER_HEIGHT > c.minY + 0.001 &&
        y < c.maxY - 0.001 &&
        z + PLAYER_HALF > c.minZ + 0.001 &&
        z - PLAYER_HALF < c.maxZ - 0.001
      ) {
        return c;
      }
    }
    return null;
  }
}
