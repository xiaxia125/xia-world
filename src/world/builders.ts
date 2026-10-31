import * as THREE from "three";
import { PROFILE } from "../profile";
import type { SignalCopy } from "../signals";
import type { AABB, Interactable, Quality } from "./types";
import {
  codeTexture, floorSignTexture, islandMapTexture, neonTexture,
  photoPrintTexture,
  profileBoardTexture, projectTexture, puddleMaskTexture, radialTexture,
  screenTexture, radioTunerTexture, secretTexture, signalTexture, signTexture,
  whiteboardTexture,
} from "./textures";

/** 体素配色板（原 world.ts 顶部）。 */
export const C = {
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
}

export interface BoxSpec {
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

/** 从 VoxelWorld 拆出的地形/建筑/物件构建器，经 applyMixins 合并回 VoxelWorld。 */
export class WorldBuilder {
  addBox(
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
  
      addEdges(
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
  
    addFloor(
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
  
      addWallX(
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
  
      addWallZ(
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
  
      addSign(
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
  
      buildWetLayer() {
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
          { x0: -31.2, x1: -13, z0: 9.2, z1: 11.4, y: 0.072 }, // 五年小径（横）
          { x0: -31.2, x1: -28.8, z0: 11.4, z1: 31.6, y: 0.072 }, // 五年小径（纵）
          { x0: -35.8, x1: -28.8, z0: 29.2, z1: 31.6, y: 0.072 }, // 凉亭入口
          { x0: 13, x1: 31, z0: 12.4, z1: 14.6, y: 0.072 },  // 营地路
          { x0: 30.5, x1: 41, z0: 13.2, z1: 20.6, y: 0.062 }, // 营地空地
          { x0: 35, x1: 37.2, z0: -17, z1: -5, y: 0.072 },   // 风车路（纵）
          { x0: 28.6, x1: 36, z0: -19, z1: -16.6, y: 0.072 }, // 风车路（横）
          { x0: 27, x1: 42.5, z0: -33.5, z1: -19, y: 0.062 }, // 菜园空地
          { x0: -16.2, x1: -14, z0: -24, z1: -1.4, y: 0.072 }, // 观景台路（纵）
          { x0: -34, x1: -14, z0: -23.5, z1: -19.4, y: 0.072 }, // 观景台路（横）
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
  
      buildGround() {
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
  
      buildPaths() {
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
        // 池塘支路继续往东北，沿池塘北岸通到篝火营地（旧营地直路已移除）。
        // 与支路只在 x=15.6 处接边，不叠放同高地面。
        this.addFloor(15.6, 30.5, 16.8, 19.8, 0.06, 0.12, C.path, { edge: false, tag: "camp-path" });
    
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
  
      buildPlaza() {
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
  
      addBench(
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
  
      buildProfileKiosk() {
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
  
      buildCourt() {
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
  
      buildCourtLamp(x: number, z: number, _side: number) {
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
  
      buildGallery() {
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
  
      buildStudio() {
        const x0 = -10;
        const x1 = 10;
        const z0 = -31;
        const z1 = -17;
    
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
    
        // ---------------------------------------------------------------- 阅读角
        // 西墙这条原本空着，摆一组沙发和边桌，工作室就不是只有一张工位。
        this.addBox(-7.2, 0.15, -20.4, 4.4, 0.03, 3.6, 0x4c594d, { solid: false, edge: false });
        this.addBox(-7.2, 0.17, -20.4, 3.8, 0.02, 3.0, 0x6b7a66, { solid: false, edge: false });
    
        this.addBox(-9.05, 0.36, -20.4, 1.35, 0.44, 3.0, C.woodDark, { tag: "studio" });
        this.addBox(-8.95, 0.62, -20.4, 1.1, 0.16, 2.85, 0x4f6a56, { solid: false });
        this.addBox(-9.5, 0.98, -20.4, 0.3, 0.9, 3.0, 0x45604d, { solid: false });
        this.addBox(-9.05, 0.78, -21.8, 1.25, 0.5, 0.2, 0x45604d, { solid: false });
        this.addBox(-9.05, 0.78, -19.0, 1.25, 0.5, 0.2, 0x45604d, { solid: false });
        for (const z of [-21.1, -19.7]) {
          this.addBox(-8.95, 0.76, z, 0.7, 0.14, 0.7, 0x6f8a70, { solid: false, edge: false });
        }
    
        // 边桌 + 一本书 + 杯子
        this.addBox(-8.5, 0.42, -18.15, 0.55, 0.06, 0.55, C.wood);
        this.addBox(-8.5, 0.2, -18.15, 0.09, 0.4, 0.09, C.woodDark, { solid: false });
        this.addBox(-8.5, 0.47, -18.15, 0.34, 0.03, 0.24, 0x4f6f8f, { solid: false, edge: false });
        this.addBox(-8.5, 0.55, -18.4, 0.12, 0.14, 0.12, C.white, { solid: false, edge: false });
    
        // 茶几
        this.addBox(-6.9, 0.42, -20.4, 1.0, 0.08, 0.6, C.wood, { tag: "studio-table" });
        for (const x of [-7.32, -6.48]) {
          for (const z of [-20.64, -20.16]) {
            this.addBox(x, 0.22, z, 0.06, 0.36, 0.06, C.woodDark, { solid: false });
          }
        }
        this.addBox(-7.0, 0.5, -20.45, 0.4, 0.06, 0.28, 0x7b5a3c, { solid: false, edge: false });
        this.addBox(-6.55, 0.5, -20.3, 0.2, 0.08, 0.2, 0x3f6070, { solid: false, edge: false });
    
        // 落地灯：白天是摆件，晚上给阅读角留一盏暖光。
        this.addBox(-9.3, 0.14, -22.9, 0.32, 0.04, 0.32, C.metal, { solid: false, edge: false });
        this.addBox(-9.3, 0.92, -22.9, 0.06, 1.55, 0.06, C.metal, { solid: false, edge: false });
        this.addBox(-9.3, 1.78, -22.9, 0.5, 0.34, 0.5, 0x3a423d, { solid: false });
        this.addBox(-9.3, 1.58, -22.9, 0.36, 0.04, 0.36, 0xffe3b0, {
          glow: true,
          solid: false,
          edge: false,
        });
    
        // ---------------------------------------------------------------- 工作台
        // 桌面 1.41 m；显示器、副屏、键盘、鼠标都按落在这块板上算高度。
        this.addBox(-4.4, 1.32, -28.7, 6.0, 0.18, 2.0, C.wood);
        for (const x of [-6.9, -1.9]) {
          for (const z of [-29.5, -27.9]) {
            this.addBox(x, 0.65, z, 0.16, 1.3, 0.16, C.woodDark);
          }
        }
        // 右侧抽屉柜，三个抽屉面朝房间。
        this.addBox(-1.75, 0.72, -28.85, 0.8, 1.2, 0.75, C.woodDark);
        for (let i = 0; i < 3; i += 1) {
          this.addBox(-1.75, 0.32 + i * 0.36, -28.46, 0.68, 0.26, 0.04, 0x6a4a32, {
            solid: false,
            edge: false,
          });
          this.addBox(-1.75, 0.32 + i * 0.36, -28.43, 0.3, 0.03, 0.03, C.metal, {
            solid: false,
            edge: false,
          });
        }
    
        // 主屏：仍保留公开档案和彩蛋计数。
        this.addBox(-4.6, 1.95, -29.02, 1.85, 1.08, 0.14, C.black);
        this.addBox(-4.6, 1.435, -29.0, 1.0, 0.04, 0.5, C.metal, { solid: false, edge: false });
        this.addBox(-4.6, 1.62, -29.0, 0.12, 0.36, 0.1, C.metal, { solid: false, edge: false });
        const screen = this.addSign(
          screenTexture(this.scores, this.eggCount),
          1.72,
          0.98,
          -4.6,
          1.95,
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
        this.registerSignal("monitor", screen, signalTexture({
          title: "工作方式",
          subtitle: "HOW I WORK / 5 YEARS",
          rows: [
            ["01", "复杂业务", "VUE 2/3 · REACT · TS"],
            ["02", "数据与空间", "ECHARTS · 地图 · WEBGL"],
            ["03", "跨端交付", "UNIAPP · H5 · 小程序"],
          ],
          corner: "STUDIO / WORKSTATION",
          hint: "> 按 E 回到工作台",
        }));
    
        // 副屏竖着放，跑的是编辑器和构建日志。
        this.addBox(-6.3, 2.02, -29.02, 0.72, 1.2, 0.12, C.black);
        this.addBox(-6.3, 1.435, -29.0, 0.5, 0.04, 0.3, C.metal, { solid: false, edge: false });
        this.addSign(codeTexture(), 0.64, 1.1, -6.3, 2.02, -28.92);
    
        // 键盘：桌面顶 1.41，键帽从 1.45 起，不再埋进板子里。
        this.addBox(-4.4, 1.445, -27.95, 2.2, 0.05, 0.62, 0x2a302d, {
          solid: false,
          edge: false,
        });
        for (let row = 0; row < 3; row += 1) {
          for (let i = 0; i < 9; i += 1) {
            this.addBox(-5.3 + i * 0.21, 1.475, -28.12 + row * 0.16, 0.16, 0.02, 0.12, 0x3f4641, {
              solid: false,
              edge: false,
            });
          }
        }
        this.addBox(-2.9, 1.42, -27.95, 0.46, 0.02, 0.4, 0x1d2621, {
          solid: false,
          edge: false,
        });
        this.addBox(-2.9, 1.455, -27.95, 0.14, 0.05, 0.22, 0x3f4641, {
          solid: false,
          edge: false,
        });
    
        // 桌面小物：杯子、笔筒、绿植、台灯、一摞书。
        this.addBox(-1.95, 1.52, -28.2, 0.17, 0.2, 0.17, C.white, { solid: false, edge: false });
        this.addBox(-1.85, 1.54, -28.2, 0.04, 0.12, 0.08, C.white, { solid: false, edge: false });
        this.addBox(-6.6, 1.58, -27.85, 0.16, 0.3, 0.16, C.woodDark, { solid: false });
        for (const [dx, c] of [[-0.04, C.red], [0.01, C.metalLight], [0.05, C.lime]] as const) {
          this.addBox(-6.6 + dx, 1.78, -27.85, 0.03, 0.24, 0.03, c, { solid: false, edge: false });
        }
        this.addBox(-7.05, 1.53, -29.1, 0.26, 0.22, 0.26, C.woodDark, { solid: false });
        this.addBox(-7.05, 1.74, -29.1, 0.42, 0.26, 0.42, C.leaf, { solid: false, edge: false });
        this.addBox(-1.75, 1.44, -29.25, 0.3, 0.05, 0.3, C.metal, { solid: false, edge: false });
        this.addBox(-1.75, 1.78, -29.25, 0.06, 0.68, 0.06, C.metal, { solid: false, edge: false });
        this.addBox(-1.75, 2.12, -29.05, 0.44, 0.1, 0.28, C.woodDark, { solid: false });
        this.addBox(-1.75, 2.05, -29.02, 0.34, 0.03, 0.2, 0xffe3b0, {
          glow: true,
          solid: false,
          edge: false,
        });
        this.addBox(-7.0, 1.46, -27.95, 0.46, 0.06, 0.3, 0x9a5a4c, { solid: false, edge: false });
        this.addBox(-7.0, 1.51, -27.92, 0.4, 0.05, 0.28, 0x4f6f8f, { solid: false, edge: false });
    
        // 办公椅：座面 + 靠背 + 扶手 + 十字脚，替换掉原来那块 1×1 的黑色凳背。
        this.addBox(-4.4, 0.08, -26.95, 0.95, 0.06, 0.16, C.metal, { solid: false, edge: false });
        this.addBox(-4.4, 0.08, -26.95, 0.16, 0.06, 0.95, C.metal, { solid: false, edge: false });
        this.addBox(-4.4, 0.33, -26.95, 0.13, 0.5, 0.13, C.metal, { solid: false });
        this.addBox(-4.4, 0.6, -26.95, 0.66, 0.14, 0.62, 0x3c4340, { solid: false });
        this.addBox(-4.4, 1.02, -26.6, 0.62, 0.72, 0.14, 0x3c4340, { solid: false });
        for (const dx of [-0.38, 0.38]) {
          this.addBox(-4.4 + dx, 0.78, -26.75, 0.08, 0.06, 0.46, C.metal, { solid: false, edge: false });
          this.addBox(-4.4 + dx, 0.62, -26.95, 0.05, 0.3, 0.05, C.metal, { solid: false, edge: false });
        }
    
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
    
        // 立式白板：原来三张海报和一条 WORKING SIGNALS 横幅占着整面墙，
        // 现在合成一块板，界面 / 数据 / 交互写成同一条工作链，只读一次。
        this.addBox(1.35, 1.42, -30.62, 3.2, 2.1, 0.1, C.woodDark, { solid: false });
        const board = this.addSign(whiteboardTexture(), 3.0, 1.9, 1.35, 1.45, -30.55);
        for (const x of [-0.15, 2.85]) {
          this.addBox(x, 0.24, -30.55, 0.09, 0.5, 0.09, C.metal, { solid: false });
          this.addBox(x, 0.06, -30.55, 0.12, 0.06, 0.62, C.metal, { solid: false });
        }
        this.addBox(1.35, 0.46, -30.44, 2.7, 0.05, 0.14, C.metal, { solid: false, edge: false });
        for (const [dx, color] of [[-0.9, C.red], [0, 0x3f6070], [0.9, C.lime]] as const) {
          this.addBox(1.35 + dx, 0.49, -30.44, 0.02, 0.02, 0.2, color, { solid: false, edge: false });
        }
        this.interactables.push({
          id: "studio-board",
          object: board,
          label: "看白板",
          maxDistance: 4.4,
        });
        this.plaqueReadings.set("studio-board", {
          index: "01",
          label: "工作室 · 白板",
          title: "一块白板，三种做法",
          body: "界面先理路径：不急着加动效，先把用户从入口到结果要走的那几步摆平。数据换尺度：同一组数字，在驾驶舱、地图和手机上是三种读法。交互留退路：把入口做明显，把返回、撤销和错误提示一起做完。三件事其实是同一条线——让密集的信息有结构、有路径、能被使用。",
          tags: ["界面", "数据", "交互"],
        });
    
        // 工作台上方的置物板：书、相机、一个小盆栽。
        this.addBox(-4.6, 2.62, -30.66, 4.6, 0.08, 0.36, C.wood, { solid: false });
        const shelfBookColors = [0x9a5a4c, 0x4f6f8f, 0x7b8a4f, 0xc4a45a, 0x6e5b7e, 0x4f8a7e];
        for (let i = 0; i < 7; i += 1) {
          this.addBox(
            -6.4 + i * 0.34,
            2.82,
            -30.66,
            0.2,
            0.3 + (i % 3) * 0.05,
            0.24,
            shelfBookColors[i % shelfBookColors.length]!,
            { solid: false, edge: false },
          );
        }
        this.addBox(-3.1, 2.78, -30.66, 0.34, 0.24, 0.26, 0x2f3733, { solid: false, edge: false });
        this.addBox(-2.7, 2.74, -30.66, 0.14, 0.16, 0.16, 0x1d2621, { solid: false, edge: false });
        this.addBox(-2.05, 2.76, -30.66, 0.24, 0.2, 0.24, C.woodDark, { solid: false });
        this.addBox(-2.05, 2.92, -30.66, 0.36, 0.16, 0.36, C.leaf, { solid: false, edge: false });
    
        // 墙钟：工作室里唯一一块不发光的东西，提醒这里也有下班时间。
        this.addBox(-8.5, 3.35, -30.66, 0.6, 0.6, 0.08, C.woodDark, { solid: false });
        this.addBox(-8.5, 3.35, -30.6, 0.48, 0.48, 0.02, C.white, { solid: false, edge: false });
        this.addBox(-8.5, 3.43, -30.57, 0.03, 0.18, 0.02, C.black, { solid: false, edge: false });
        this.addBox(-8.43, 3.35, -30.56, 0.16, 0.03, 0.02, C.black, { solid: false, edge: false });
    
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
    
        // 阅读角落灯：夜里这块应该比工位更暖一点，人才会想坐过去。
        const cornerLamp = new THREE.PointLight(0xffc98a, 0, 7, 2);
        cornerLamp.position.set(-9.0, 1.55, -22.9);
        this.group.add(cornerLamp);
        this.poolLights.push(cornerLamp);
        this.poolLightBase.push(7);
    
        // 桌面台灯：只照亮键盘那一小块，屏幕本身是自发光的。
        const deskLamp = new THREE.PointLight(0xffd9a6, 0, 4.5, 2);
        deskLamp.position.set(-1.75, 2.0, -29.1);
        this.group.add(deskLamp);
        this.poolLights.push(deskLamp);
        this.poolLightBase.push(5);
      }
  
      buildBookshelf() {
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
  
      buildSecretRoom() {
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
    
        // 窄控制台：一台 CRT、一块键盘，和外面那张宽办公桌明显不是一个地方。
        this.addBox(5.4, 0.86, -37.5, 2.4, 0.1, 0.8, 0x2c3830);
        for (const x of [4.36, 6.44]) {
          this.addBox(x, 0.43, -37.55, 0.1, 0.86, 0.1, C.metal, { solid: false });
          this.addBox(x, 0.7, -37.86, 0.08, 0.6, 0.08, C.metal, { solid: false });
        }
        // 正面挡板 + 散热条：从门口看是一台设备，不是一张空长凳。
        this.addBox(5.4, 0.52, -37.11, 2.2, 0.62, 0.06, 0x3b4740, { solid: false });
        for (let i = 0; i < 9; i += 1) {
          this.addBox(5.4, 0.28 + i * 0.05, -37.07, 1.9, 0.02, 0.03, 0x2a332d, {
            solid: false,
            edge: false,
          });
        }
        this.addBox(5.4, 0.5, -37.07, 0.06, 0.5, 0.04, C.metal, { solid: false, edge: false });
        this.addBox(6.0, 0.78, -37.07, 0.18, 0.03, 0.03, 0x72ffad, {
          glow: true,
          solid: false,
          edge: false,
        });
        this.addBox(5.4, 0.5, -37.55, 2.2, 0.06, 0.06, C.metal, { solid: false, edge: false });
        // 台灯压在桌角，屏幕不亮的时候也能看清键盘。
        this.addBox(6.24, 0.98, -37.72, 0.06, 0.16, 0.06, C.metal, { solid: false, edge: false });
        this.addBox(6.24, 1.08, -37.62, 0.3, 0.05, 0.18, 0x2f3a33, { solid: false, edge: false });
        this.addBox(6.24, 1.05, -37.56, 0.24, 0.02, 0.1, 0xffe3b0, {
          glow: true,
          solid: false,
          edge: false,
        });
    
        this.addBox(5.4, 1.31, -37.62, 1.1, 0.85, 0.72, 0x1c2721);
        this.addBox(5.4, 0.95, -37.18, 1.0, 0.05, 0.34, 0x39453c, { solid: false, edge: false });
        // 键帽压在键盘底板上，别再横穿过 CRT 屏幕。
        for (let i = 0; i < 4; i += 1) {
          this.addBox(5.4, 0.985, -37.3 + i * 0.07, 0.94, 0.02, 0.05, 0x45524a, {
            solid: false,
            edge: false,
          });
        }
        const terminal = this.addSign(secretTexture(), 0.94, 0.68, 5.4, 1.33, -37.25);
        terminal.name = "terminal";
        this.interactables.push({
          id: "terminal",
          object: terminal,
          label: "读取留言",
          maxDistance: 3.4,
        });
        this.registerSignal("terminal", terminal, signalTexture({
          title: "给探索者的留言",
          subtitle: "BOOKSHELF // 05 — 不在地图上的房间",
          body: [
            "你找到了。这块屏幕本来没打算给谁看。",
            "把复杂的事拆开，再一块块摆回原位。",
            "没有彩蛋，只有一句实话：多走一步。",
          ],
          corner: "SECRET / TERMINAL",
          hint: "> 按 E 收起留言",
        }));
    
        // 矮凳：不是办公椅，谁值班谁坐。
        this.addBox(5.4, 0.47, -36.25, 0.5, 0.08, 0.5, C.wood, { solid: false });
        for (const x of [5.2, 5.6]) {
          for (const z of [-36.45, -36.05]) {
            this.addBox(x, 0.23, z, 0.06, 0.46, 0.06, C.woodDark, { solid: false });
          }
        }
        this.addBox(5.4, 0.24, -36.25, 0.34, 0.04, 0.34, C.metal, { solid: false, edge: false });
    
        // 旧地毯：把凳子从水泥地上拎出来。
        this.addBox(5.4, 0.115, -34.8, 2.8, 0.03, 1.9, 0x3d4740, { solid: false, edge: false });
    
        // 两座机柜：面板、散热栅和一排状态灯，和工作室的显示器区分开。
        for (const z of [-36.1, -34.3]) {
          this.addBox(1.9, 1.0, z, 0.8, 2.0, 1.4, 0x232d27, { tag: "secret" });
          this.addBox(2.31, 1.0, z, 0.04, 1.7, 1.1, 0x2f3a33, { solid: false, edge: false });
          for (let i = 0; i < 5; i += 1) {
            this.addBox(2.34, 0.45 + i * 0.28, z, 0.02, 0.05, 0.86, 0x45524a, {
              solid: false,
              edge: false,
            });
          }
          for (let i = 0; i < 6; i += 1) {
            this.addBox(2.34, 1.55, z - 0.48 + i * 0.19, 0.03, 0.06, 0.06, i % 3 === 0 ? C.lime : 0x72ffad, {
              glow: true,
              solid: false,
              edge: false,
            });
          }
          // 机柜顶上盘着的线
          this.addBox(1.9, 2.06, z, 0.5, 0.08, 0.9, 0x171f1b, { solid: false, edge: false });
        }
    
        // 东墙档案架：铁架 + 文件盒，纸质归档和机房放在同一间。
        for (const y of [0.6, 1.3, 2.0, 2.7]) {
          this.addBox(8.65, y, -35.0, 0.7, 0.06, 2.8, 0x55605a, { solid: false, edge: false });
        }
        for (const x of [8.32, 8.98]) {
          for (const z of [-36.38, -33.62]) {
            this.addBox(x, 1.4, z, 0.07, 2.8, 0.07, C.metal, { solid: false });
          }
        }
        const fileColors = [0x6b7266, 0x7a6b52, 0x4f5a62, 0x8a7d63, 0x5e6b5e];
        for (let row = 0; row < 4; row += 1) {
          for (let i = 0; i < 5; i += 1) {
            const h = 0.38 + ((row + i) % 3) * 0.05;
            this.addBox(8.64, 0.63 + row * 0.7 + h / 2, -36.24 + i * 0.58, 0.5, h, 0.44, fileColors[(row + i) % fileColors.length]!, {
              solid: false,
              edge: false,
            });
          }
        }
    
        // 角落里的纸箱：搬家没拆完的那一批。
        this.addBox(7.9, 0.36, -32.2, 0.7, 0.5, 0.7, 0x9a7c53, { solid: false });
        this.addBox(7.9, 0.63, -32.2, 0.12, 0.04, 0.7, 0x7d6242, { solid: false, edge: false });
        this.addBox(7.55, 0.2, -32.55, 0.5, 0.38, 0.5, 0x8a6c46, { solid: false });
    
        // 吊灯：这间屋子没有窗，全靠它和人说话。
        this.addBox(5.4, 4.0, -35.2, 0.04, 1.0, 0.04, C.metal, { solid: false, edge: false });
        this.addBox(5.4, 3.42, -35.2, 0.5, 0.18, 0.5, 0x2f3a33, { solid: false });
        this.addBox(5.4, 3.3, -35.2, 0.36, 0.03, 0.36, 0xffe3b0, {
          glow: true,
          solid: false,
          edge: false,
        });
    
        // 东墙铁牌：不再复读门口的 “YOU FOUND IT”。
        this.addSign(
          signTexture("ARCHIVE 05", "NOT ON THE MAP / KEEP IT QUIET", "#9fe6ff"),
          2.0,
          0.5,
          8.97,
          3.2,
          -35.0,
          -Math.PI / 2,
        );
    
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
        deskFill.position.set(5.4, 3.05, -35.2);
        this.group.add(deskFill);
    
        // Green accent at the terminal.
        this.addBox(5.5, ceilingLightY, -36.0, 2.6, 0.1, 0.24, 0x7dffb0, { glow: true, solid: false });
        const glow = new THREE.PointLight(0x72ffad, 2.4, 8, 2);
        glow.position.set(5.5, 2.7, -36.5);
        this.group.add(glow);
        this.poolLights.push(glow);
        this.poolLightBase.push(2.4);
      }
  
      buildRooftop() {
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
          signTexture("ROOFTOP", "LOUNGE / RADIO / SKY", "#d8ff5f"),
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
  
      buildPond() {
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
  
      addWater(cx: number, top: number, cz: number, w: number, d: number) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), this.waterMaterial);
        mesh.position.set(cx, top, cz);
        mesh.receiveShadow = true;
        mesh.userData.noShadow = true;
        this.group.add(mesh);
        this.waterMeshes.push(mesh);
      }
  
      buildRooftopSkyDeck() {
        // 影院撤掉后，天台西侧改成两张躺椅：白天晒太阳，晚上看星星。
        for (const z of [-22.4, -26.4]) {
          this.addBox(-7.0, 7.64, z, 2.4, 0.18, 1.05, C.woodDark, { tag: "rooftop-lounger" });
          this.addBox(-8.0, 7.98, z, 0.18, 0.78, 1.05, C.woodDark, { tag: "rooftop-lounger" });
          this.addBox(-5.95, 7.72, z, 0.22, 0.3, 0.9, C.metal, { tag: "rooftop-lounger" });
    
          const proxy = new THREE.Mesh(
            new THREE.BoxGeometry(2.4, 1.7, 1.2),
            new THREE.MeshBasicMaterial({ visible: false }),
          );
          proxy.position.set(-7.0, 8.2, z);
          proxy.name = `sky-lounger-${z}`;
          proxy.userData.seat = { x: -7.0, y: 7.51, z, yaw: -Math.PI / 2, eyeOffset: -0.5, lookUp: true };
          this.group.add(proxy);
          this.interactables.push({
            id: "sky-lounger",
            object: proxy,
            label: "躺下看星星",
            maxDistance: 2.6,
          });
        }
    
        this.addBox(-9.7, 8.22, -24.4, 0.12, 1.2, 1.2, C.metal, { solid: false });
        this.addSign(
          signTexture("NIGHT", "SIT / LOOK UP / 21:00", "#9fe6ff"),
          1.5,
          0.375,
          -9.58,
          8.7,
          -24.4,
          Math.PI / 2,
        );
      }
  
      buildTrail() {
        this.addFloor(-31.2, -13, 9.2, 11.4, 0.06, 0.12, C.path, { edge: false, tag: "trail" });
        this.addFloor(-31.2, -28.8, 11.4, 31.6, 0.06, 0.12, C.path, { edge: false, tag: "trail" });
        this.addFloor(-35.8, -28.8, 29.2, 31.6, 0.06, 0.12, C.path, { edge: false, tag: "trail" });
    
        const milestones: Array<{
          id: string;
          year: string;
          label: string;
          x: number;
          z: number;
          rot: number;
          copy: SignalCopy;
        }> = [
          {
            id: "start",
            year: "2021",
            label: "入行 / 格物至微",
            x: -16.5,
            z: 12.9,
            rot: Math.PI,
            copy: {
              index: "01",
              label: "2021 · 入行",
              title: "从业务页面开始",
              body: "第一份前端工作，做业务页面、接口联调和交互实现。也是在这里养成组件化的习惯：先把重复的部分抽出来，再谈页面。",
              tags: ["Vue", "接口联调", "组件化"],
            },
          },
          {
            id: "hailai",
            year: "2021—2026",
            label: "海莱云智 / 五年",
            x: -21.5,
            z: 12.9,
            rot: Math.PI,
            copy: {
              index: "02",
              label: "2021—2026 · 海莱云智",
              title: "海洋、景区、民生与图谱",
              body: "在同一个团队里跨过四种业务域：可视化驾驶舱、三维地图、小程序和数据平台。核心页面、通用组件、接口联调和性能优化都在这里发生。",
              tags: ["可视化", "地图", "小程序", "性能"],
            },
          },
          {
            id: "degree",
            year: "2024—2026",
            label: "河南大学 / 在职本科",
            x: -26.5,
            z: 12.9,
            rot: Math.PI,
            copy: {
              index: "03",
              label: "2024—2026 · 河南大学",
              title: "一边工作，一边把基础补齐",
              body: "在职读计算机科学与技术本科。不是简历上的装饰，而是把工作中遇到的网络、数据结构和系统问题，放回更完整的知识框架里。",
              tags: ["计算机科学与技术", "在职", "基础"],
            },
          },
          {
            id: "projects",
            year: "5 YEARS",
            label: "4 个代表项目",
            x: -27.4,
            z: 19.0,
            rot: -Math.PI / 2,
            copy: {
              index: "04",
              label: "五年 · 四个代表项目",
              title: "把复杂信息做成可操作的界面",
              body: "海洋监管平台、景区治理驾驶舱、海岛数字生活小程序、知识图谱平台。四件事看起来不同，做的其实是同一件事：让密集的信息有结构、有路径、能被使用。",
              tags: ["ECharts", "GeoServer", "UniApp", "AntV G6"],
            },
          },
          {
            id: "cross",
            year: "CROSS",
            label: "跨端 / 空间",
            x: -27.4,
            z: 25.0,
            rot: -Math.PI / 2,
            copy: {
              index: "05",
              label: "跨端 · 空间",
              title: "同一条信息，在不同设备上继续工作",
              body: "从 H5、UniApp、微信小程序到 Three.js 场景，入口在变，核心路径不能断。这个可以走进来的主页，就是这条思路的一次练习。",
              tags: ["H5", "UniApp", "Three.js"],
            },
          },
        ];
    
        for (const stone of milestones) {
          this.addBox(stone.x, 0.48, stone.z, 1.25, 0.96, 0.55, C.stone, {
            tag: "trail-stone",
          });
          this.addBox(stone.x, 0.98, stone.z, 1.4, 0.1, 0.7, C.stoneDark, {
            tag: "trail-stone",
          });
          const sign = this.addSign(
            signTexture(stone.year, stone.label, "#e5c07b"),
            1.8,
            0.45,
            stone.x,
            1.28,
            stone.z,
            stone.rot,
          );
          sign.name = `milestone-${stone.id}`;
          this.interactables.push({
            id: `milestone-${stone.id}`,
            object: sign,
            label: `阅读 · ${stone.year}`,
            maxDistance: 4.0,
          });
          this.plaqueReadings.set(`milestone-${stone.id}`, stone.copy);
        }
    
        // Pavilion at the end of the trail: the "now" of the timeline.
        this.addFloor(-40.8, -34.8, 27.4, 33.4, 0.42, 0.4, C.woodLight, {
          edge: false,
          tag: "pavilion",
        });
        for (const [x, z] of [
          [-40.2, 28.0],
          [-35.4, 28.0],
          [-40.2, 32.8],
          [-35.4, 32.8],
        ] as const) {
          this.addBox(x, 2.05, z, 0.24, 3.3, 0.24, C.woodDark, { tag: "pavilion" });
        }
        this.addBox(-37.8, 3.78, 28.0, 5.6, 0.22, 0.3, C.woodDark, { tag: "pavilion" });
        this.addBox(-37.8, 3.78, 32.8, 5.6, 0.22, 0.3, C.woodDark, { tag: "pavilion" });
        this.addBox(-40.2, 3.78, 30.4, 0.3, 0.22, 5.4, C.woodDark, { tag: "pavilion" });
        this.addBox(-35.4, 3.78, 30.4, 0.3, 0.22, 5.4, C.woodDark, { tag: "pavilion" });
        this.addBox(-37.8, 3.96, 30.4, 6.2, 0.18, 6.6, C.roof, { tag: "pavilion" });
        this.addBox(-37.8, 4.12, 30.4, 5.0, 0.12, 5.4, 0x585c50, { tag: "pavilion" });
    
        // 吊灯：天黑后自动亮起来，凉亭晚上也能坐。
        this.addBox(-37.8, 3.62, 30.4, 0.05, 0.7, 0.05, C.metal, { solid: false, edge: false });
        this.addBox(-37.8, 3.2, 30.4, 0.42, 0.36, 0.42, 0xffd89a, { glow: true, solid: false });
        this.addBox(-37.8, 3.42, 30.4, 0.5, 0.08, 0.5, C.metal, { solid: false, edge: false });
        const pavilionLight = new THREE.PointLight(0xffd2a0, 0, 12, 2);
        pavilionLight.position.set(-37.8, 2.95, 30.4);
        this.group.add(pavilionLight);
        this.poolLights.push(pavilionLight);
        this.poolLightBase.push(16);
    
        this.addBench(-39.4, 0.42, 30.4, -1, "x");
    
        // 邮筒：以前正好杵在凉亭入口的正中间，进出都要绕。挪到木台东南角外侧。
        this.addBox(-33.0, 0.55, 33.2, 0.16, 1.1, 0.16, C.metal, { solid: false });
        this.addBox(-33.0, 1.28, 33.2, 0.8, 0.62, 0.55, C.red);
        this.addBox(-33.0, 1.52, 33.2, 0.86, 0.06, 0.6, C.metal);
        const mailbox = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.9, 0.7),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        mailbox.position.set(-33.0, 1.22, 33.2);
        this.group.add(mailbox);
        this.interactables.push({
          id: "mailbox",
          object: mailbox,
          label: "打开邮筒 · 联系方式",
          maxDistance: 3.2,
        });
    
        // NOW：挂到凉亭东侧檐下、面朝来路，不再贴着北侧屋檐侧对入口。
        this.addSign(
          signTexture("NOW", "OPEN TO WORK / 2026", "#d8ff5f"),
          3.0,
          0.75,
          -35.5,
          3.3,
          30.4,
          Math.PI / 2,
        );
      }
  
      buildCamp() {
        // 地面由 buildPaths 沿池塘北岸铺过来，这里只留营地自己的碎石空地。
        this.addFloor(30.5, 41.0, 13.2, 20.6, 0.05, 0.1, 0x6f6350, { edge: false, tag: "camp" });
    
        const cx = 35.2;
        const cz = 17.2;
        for (let i = 0; i < 9; i += 1) {
          const a = (i / 9) * Math.PI * 2;
          this.addBox(cx + Math.cos(a) * 1.15, 0.2, cz + Math.sin(a) * 1.15, 0.42, 0.36, 0.38, C.stoneDark, {
            edge: false,
            tag: "camp",
          });
        }
        this.addBox(cx, 0.1, cz, 1.7, 0.14, 1.7, 0x2a2620, { solid: false, edge: false });
        for (const [dx, dz, rot] of [
          [-0.32, 0, 0.5],
          [0.32, 0, -0.5],
          [0, 0.32, Math.PI / 2],
        ] as const) {
          this.addBox(cx + dx, 0.24, cz + dz, 1.15, 0.24, 0.24, C.woodDark, {
            solid: false,
            edge: false,
          });
          // Rotating a single block is not possible through addBox, so the crossed
          // log look comes from three separate short logs instead.
          void rot;
        }
    
        const flameMat = new THREE.MeshBasicMaterial({
          color: 0xff9a4c,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        });
        for (let i = 0; i < 3; i += 1) {
          const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34 - i * 0.07, 0.9 + i * 0.25, 5), flameMat);
          flame.position.set(cx + (i - 1) * 0.22, 0.7 + i * 0.08, cz + (i % 2) * 0.16);
          flame.userData.noShadow = true;
          flame.visible = this.campfireOn;
          this.group.add(flame);
          this.campfireFlames.push(flame);
        }
        this.campfireLight = new THREE.PointLight(0xff8a4c, 0, 10, 2);
        this.campfireLight.position.set(cx, 1.3, cz);
        this.group.add(this.campfireLight);
    
        this.spawnCampfireEmbers(cx, cz);
    
        // Seat proxy on a log, looking at the fire.
        this.addBox(cx, 0.34, cz + 1.75, 1.5, 0.3, 0.55, C.woodDark, { tag: "camp" });
        const seat = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 1.4, 0.9),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        seat.position.set(cx, 0.9, cz + 1.75);
        seat.name = "camp-seat";
        seat.userData.seat = { x: cx, y: 0.05, z: cz + 1.45, yaw: 0, eyeOffset: -0.32 };
        this.group.add(seat);
        this.interactables.push({ id: "camp-seat", object: seat, label: "坐下烤火", maxDistance: 2.6 });
    
        const fireProxy = new THREE.Mesh(
          new THREE.BoxGeometry(1.7, 1.6, 1.7),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        fireProxy.position.set(cx, 0.9, cz);
        fireProxy.name = "campfire";
        this.group.add(fireProxy);
        this.interactables.push({ id: "campfire", object: fireProxy, label: "点燃篝火", maxDistance: 3.4 });
    
        // Tent: four stepped layers read as a voxel A-frame from the path.
        const tx = 39.2;
        const tz = 17.2;
        this.addFloor(tx - 1.8, tx + 1.8, tz - 1.8, tz + 1.8, 0.06, 0.12, 0x4c4a3e, {
          edge: false,
          tag: "camp",
        });
        for (let i = 0; i < 4; i += 1) {
          this.addBox(tx, 0.3 + i * 0.42, tz, 3.2 - i * 0.72, 0.42, 3.0 - i * 0.5, i % 2 === 0 ? 0x7b5a3c : 0x8d6a46, {
            tag: "camp",
          });
        }
        this.addBox(tx - 1.45, 0.85, tz, 0.08, 1.0, 1.4, 0x241d16, { solid: false, edge: false });
        this.addBox(tx, 1.92, tz, 0.9, 0.12, 0.9, C.lime, { glow: true, solid: false, edge: false });
    
        // 营地牌：立在新入口北侧、牌面朝西——沿池塘北岸走过来正好迎面读到。
        for (const offset of [-0.86, 0.86]) {
          this.addBox(30.9, 0.7, 15.4 - offset, 0.1, 1.4, 0.1, C.woodDark, {
            solid: false,
            tag: "camp-sign",
          });
        }
        this.addSign(
          signTexture("CAMP", "FIRE / TENT / SLOW DOWN", "#ff8a4c"),
          2.2,
          0.55,
          30.9,
          1.55,
          15.4,
          -Math.PI / 2,
        );
      }
  
      spawnCampfireEmbers(cx: number, cz: number) {
        const count = this.quality === "high" ? 34 : 16;
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);
        for (let i = 0; i < count; i += 1) {
          positions[i * 3] = cx + (Math.random() - 0.5) * 0.8;
          positions[i * 3 + 1] = 0.5 + Math.random() * 0.8;
          positions[i * 3 + 2] = cz + (Math.random() - 0.5) * 0.8;
          velocities[i * 3] = (Math.random() - 0.5) * 0.25;
          velocities[i * 3 + 1] = 0.5 + Math.random() * 0.7;
          velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
          color: 0xffb36b,
          size: 0.07,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        });
        const points = new THREE.Points(geo, mat);
        points.name = "campfire-embers";
        points.userData.noShadow = true;
        this.group.add(points);
        this.campfireEmbers = { points, velocities, life: 0 };
      }
  
      buildPondDock() {
        // A short pier over the east edge of the pond.
        for (let i = 0; i < 6; i += 1) {
          this.addBox(24.0 + i * 0.72, 0.52, 22.6, 0.66, 0.12, 1.6, i % 2 === 0 ? C.wood : C.woodLight, {
            tag: "dock",
          });
        }
        for (const x of [24.0, 26.3, 28.4]) {
          for (const z of [21.9, 23.3]) {
            this.addBox(x, 0.28, z, 0.18, 1.05, 0.18, C.woodDark, { solid: false, tag: "dock" });
          }
        }
    
        // Rowboat moored just south of the pier.
        const bx = 24.9;
        const bz = 25.6;
        this.addBox(bx, 0.46, bz, 2.2, 0.2, 1.0, C.woodDark, { tag: "boat" });
        this.addBox(bx, 0.62, bz - 0.5, 2.0, 0.32, 0.12, C.wood, { tag: "boat" });
        this.addBox(bx, 0.62, bz + 0.5, 2.0, 0.32, 0.12, C.wood, { tag: "boat" });
        this.addBox(bx - 0.9, 0.62, bz, 0.12, 0.32, 0.9, C.wood, { tag: "boat" });
        this.addBox(bx + 0.9, 0.62, bz, 0.12, 0.32, 0.9, C.wood, { tag: "boat" });
        this.addBox(bx, 0.58, bz, 1.4, 0.1, 0.42, C.woodLight, { solid: false, tag: "boat" });
    
        const boat = new THREE.Mesh(
          new THREE.BoxGeometry(2.3, 1.0, 1.2),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        boat.position.set(bx, 0.7, bz);
        boat.name = "boat";
        boat.userData.seat = { x: bx, y: 0.42, z: bz, yaw: -Math.PI / 2, eyeOffset: -0.28 };
        this.group.add(boat);
        this.interactables.push({ id: "boat", object: boat, label: "坐进小船", maxDistance: 3.0 });
    
        // 池塘指示牌：从支路过来先看到正面，所以牌面朝西（来路方向）。
        // 位置退到池塘西岸的草地上（x=15.2, z=22.9），既不在路的铺装里，
        // 也不会挡住沿北岸去营地的通道。
        const signX = 15.2;
        const signZ = 22.9;
        const signRot = -Math.PI / 2;
        for (const offset of [-0.86, 0.86]) {
          this.addBox(
            signX + Math.cos(signRot) * offset,
            0.72,
            signZ - Math.sin(signRot) * offset,
            0.1,
            1.5,
            0.1,
            C.woodDark,
            { solid: false, tag: "pond-sign" },
          );
        }
        this.addSign(
          signTexture("POND", "FEED / SIT / DRIFT", "#9fe6ff"),
          2.2,
          0.55,
          signX,
          1.62,
          signZ,
          signRot,
        );
      }
  
      buildWindmill() {
        this.addFloor(35.0, 37.2, -17, -5.0, 0.06, 0.12, C.path, { edge: false, tag: "windmill-path" });
        this.addFloor(28.6, 36.0, -19.0, -16.6, 0.06, 0.12, C.path, { edge: false, tag: "windmill-path" });
        this.addFloor(27.0, 42.5, -33.5, -19.0, 0.05, 0.1, 0x5d7d4c, { edge: false, tag: "windmill" });
    
        const x = 30;
        const z = -27;
        this.addBox(x, 1.0, z, 4.2, 2.0, 4.2, C.wallSide, { tag: "windmill" });
        this.addBox(x, 3.1, z, 3.3, 2.2, 3.3, C.wall, { tag: "windmill" });
        this.addBox(x, 5.2, z, 2.5, 2.2, 2.5, C.wallSide, { tag: "windmill" });
        this.addBox(x, 6.45, z, 2.9, 0.28, 2.9, C.roof, { tag: "windmill" });
        this.addBox(x, 0.85, z + 2.11, 1.0, 1.7, 0.12, C.woodDark, { solid: false, tag: "windmill" });
    
        const blades = new THREE.Group();
        blades.name = "windmill-blades";
        // 叶片盘面必须整体落在塔身正面（z + 2.1）之外：之前放在 z + 1.32，
        // 四片 4.6 m 长的叶片有一半埋进塔身，从正面看就是「穿模」。
        blades.position.set(x, 6.05, z + 2.34);
        const bladeMat = new THREE.MeshLambertMaterial({ color: C.woodLight });
        // 转子半径 2.8 m，和 6.6 m 高的塔身成比例；原来的 4.6 m 会一直垂到地面。
        for (let i = 0; i < 4; i += 1) {
          const a = (i / 4) * Math.PI * 2;
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.8, 0.1), bladeMat);
          arm.position.set(Math.cos(a) * 1.4, Math.sin(a) * 1.4, 0);
          arm.rotation.z = a - Math.PI / 2;
          arm.userData.noShadow = true;
          blades.add(arm);
          const sail = new THREE.Mesh(new THREE.BoxGeometry(0.52, 1.05, 0.06), new THREE.MeshLambertMaterial({ color: 0xd9cfae }));
          sail.position.set(Math.cos(a) * 2.05, Math.sin(a) * 2.05, 0);
          sail.rotation.z = a - Math.PI / 2;
          sail.userData.noShadow = true;
          blades.add(sail);
        }
        const hub = new THREE.Mesh(
          new THREE.CylinderGeometry(0.26, 0.26, 0.4, 8),
          new THREE.MeshLambertMaterial({ color: C.metal }),
        );
        hub.rotation.x = Math.PI / 2;
        hub.userData.noShadow = true;
        blades.add(hub);
        this.group.add(blades);
        this.windmillBlades = blades;
    
        // Windsock on the west edge of the garden.
        const poleX = 25.8;
        const poleZ = -22.5;
        this.addBox(poleX, 2.2, poleZ, 0.16, 4.4, 0.16, C.metal, { solid: false });
        const sock = new THREE.Group();
        sock.position.set(poleX, 4.25, poleZ);
        const sockMat = new THREE.MeshLambertMaterial({ color: 0xff8a4c });
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.5, 10), sockMat);
        cone.rotation.z = -Math.PI / 2;
        cone.position.x = 0.85;
        cone.userData.noShadow = true;
        sock.add(cone);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 5, 10), sockMat);
        ring.rotation.y = Math.PI / 2;
        ring.position.x = 0.12;
        ring.userData.noShadow = true;
        sock.add(ring);
        this.group.add(sock);
        this.windsock = sock;
    
        const proxy = new THREE.Mesh(
          new THREE.BoxGeometry(4.4, 9.0, 4.4),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        proxy.position.set(x, 4.5, z);
        proxy.name = "windmill-proxy";
        this.group.add(proxy);
        this.interactables.push({ id: "windmill", object: proxy, label: "查看风车", maxDistance: 5.0 });
        this.plaqueReadings.set("windmill", {
          index: "10",
          label: "风车与菜园",
          title: "天气不只是粒子效果",
          body: "风车叶片、风向袋、晾衣绳和雨水桶都接在同一套天气系统上：雨天风大、衣服会收起来、桶里的水会涨。切换天气再回来看看。",
          tags: ["天气", "风向", "雨水"],
        });
      }
  
      buildGarden() {
        const beds: Array<[number, number]> = [
          [36.5, -21.2],
          [39.8, -21.2],
          [36.5, -24.8],
          [39.8, -24.8],
        ];
        for (const [x, z] of beds) {
          this.addBox(x, 0.22, z, 2.7, 0.44, 2.7, C.woodDark, { tag: "garden" });
          this.addBox(x, 0.46, z, 2.4, 0.08, 2.4, C.soil, { solid: false, edge: false });
          for (let i = 0; i < 3; i += 1) {
            for (let j = 0; j < 3; j += 1) {
              const px = x - 0.72 + i * 0.72;
              const pz = z - 0.72 + j * 0.72;
              const h = 0.34 + ((i + j) % 3) * 0.12;
              this.addBox(px, 0.5 + h / 2, pz, 0.16, h, 0.16, C.leaf, {
                solid: false,
                edge: false,
              });
              this.addBox(px, 0.5 + h + 0.06, pz, 0.24, 0.12, 0.24, (i + j) % 2 === 0 ? C.flowerB : C.leafLight, {
                solid: false,
                edge: false,
              });
            }
          }
        }
    
        // Rain barrel: the water plane rises and falls with the weather.
        const bx = 33.9;
        const bz = -20.2;
        this.addBox(bx, 0.6, bz, 1.1, 1.2, 1.1, C.woodDark, { tag: "rain-barrel" });
        this.addBox(bx, 1.23, bz, 1.2, 0.08, 1.2, C.metal, { solid: false, tag: "rain-barrel" });
        const water = new THREE.Mesh(
          new THREE.BoxGeometry(0.86, 0.04, 0.86),
          this.waterMaterial,
        );
        water.position.set(bx, 1.0, bz);
        water.userData.noShadow = true;
        this.group.add(water);
        this.barrelWater = water;
    
        this.addSign(
          signTexture("GARDEN", "RAIN / SOIL / GROW", "#6aa558"),
          2.0,
          0.5,
          37.9,
          1.45,
          -27.4,
          0,
        );
      }
  
      buildLookout() {
        this.addFloor(-16.2, -14.0, -24.0, -1.4, 0.06, 0.12, C.path, { edge: false, tag: "lookout-path" });
        this.addFloor(-34.0, -14.0, -23.5, -19.4, 0.06, 0.12, C.path, { edge: false, tag: "lookout-path" });
    
        // 日落照片台：比原来略大一圈，铺木板、加串灯、照片墙和坐垫。
        const x0 = -40.0;
        const x1 = -33.5;
        const z0 = -28.5;
        const z1 = -21.5;
        const floorTop = 1.38;
        const cx = (x0 + x1) / 2;
        const cz = (z0 + z1) / 2;
    
        // 支撑柱：四角 + 两条长边中点。
        for (const [x, z] of [
          [x0 + 0.45, z0 + 0.45],
          [x1 - 0.45, z0 + 0.45],
          [x0 + 0.45, z1 - 0.45],
          [x1 - 0.45, z1 - 0.45],
          [x0 + 0.45, cz],
          [x1 - 0.45, cz],
        ] as const) {
          this.addBox(x, 0.63, z, 0.26, 1.26, 0.26, C.woodDark, { tag: "lookout" });
        }
    
        // 深色底板 + 交错木板：原来是一整块单色板，看起来像临时搭的台子。
        this.addFloor(x0, x1, z0, z1, 1.26, 0.24, C.woodDark, { edge: false, tag: "lookout" });
        const plankTones = [C.woodLight, C.wood, 0xa9704a];
        for (let i = 0; i < 12; i += 1) {
          this.addBox(cx, floorTop - 0.06, z0 + 0.34 + i * 0.578, x1 - x0 - 0.12, 0.12, 0.5, plankTones[i % 3], {
            edge: false,
            tag: "lookout-planks",
          });
        }
        for (const z of [z0 + 0.05, z1 - 0.05]) {
          this.addBox(cx, floorTop + 0.02, z, x1 - x0, 0.06, 0.1, C.woodDark, { solid: false, edge: false });
        }
        for (const x of [x0 + 0.05, x1 - 0.05]) {
          this.addBox(x, floorTop + 0.02, cz, 0.1, 0.06, z1 - z0, C.woodDark, { solid: false, edge: false });
        }
    
        // 栏杆：扶手 + 中横杆 + 密一点的立柱。原来竖杆高出扶手一截，像没装完。
        const railY = 2.56;
        const midY = 1.98;
        const postY = 1.97;
        const railHeight = 1.18;
        for (const z of [z0 + 0.08, z1 - 0.08]) {
          this.addBox(cx, railY, z, x1 - x0 - 0.1, 0.12, 0.14, C.wood, { solid: false });
          this.addBox(cx, midY, z, x1 - x0 - 0.1, 0.07, 0.1, C.wood, { solid: false });
        }
        this.addBox(x0 + 0.08, railY, cz, 0.14, 0.12, z1 - z0 - 0.1, C.wood, { solid: false });
        this.addBox(x0 + 0.08, midY, cz, 0.1, 0.07, z1 - z0 - 0.1, C.wood, { solid: false });
    
        // 东侧留出楼梯口，两边各留一小段栏杆把入口收住。
        for (const [a, b] of [[z0 + 0.08, -26.35], [-23.65, z1 - 0.08]] as const) {
          this.addBox(x1 - 0.08, railY, (a + b) / 2, 0.14, 0.12, b - a, C.wood, { solid: false });
          this.addBox(x1 - 0.08, midY, (a + b) / 2, 0.1, 0.07, b - a, C.wood, { solid: false });
        }
    
        for (const [x, z] of [
          [x0 + 0.08, z0 + 0.08],
          [x1 - 0.08, z0 + 0.08],
          [x0 + 0.08, z1 - 0.08],
          [x1 - 0.08, z1 - 0.08],
        ] as const) {
          this.addBox(x, postY, z, 0.17, railHeight, 0.17, C.wood, { solid: false });
          this.addBox(x, railY + 0.1, z, 0.24, 0.08, 0.24, C.woodDark, { solid: false, edge: false });
        }
        for (let x = x0 + 0.65; x <= x1 - 0.65; x += 1.12) {
          this.addBox(x, postY, z0 + 0.08, 0.08, railHeight, 0.08, C.wood, { solid: false });
          this.addBox(x, postY, z1 - 0.08, 0.08, railHeight, 0.08, C.wood, { solid: false });
        }
        for (let z = z0 + 0.65; z <= z1 - 0.65; z += 1.12) {
          this.addBox(x0 + 0.08, postY, z, 0.08, railHeight, 0.08, C.wood, { solid: false });
        }
        for (const z of [-26.35, -23.65]) {
          this.addBox(x1 - 0.08, postY, z, 0.1, railHeight, 0.1, C.wood, { solid: false });
        }
    
        // 四步石阶：最上一级和台面齐平，不再比地板高出一截。
        for (let i = 0; i < 4; i += 1) {
          const top = 0.46 + i * 0.306;
          this.addBox(-33.2 - i * 0.32, top / 2, -25.0, 0.88, top, 1.6, i % 2 === 0 ? C.stone : C.stoneDark, {
            tag: "lookout",
          });
        }
    
        // 长椅 + 坐垫、靠枕、叠好的毯子。
        this.addBench(-39.05, floorTop, -25.0, -1, "x");
        this.addBox(-39.05, floorTop + 0.64, -25.0, 0.68, 0.08, 2.2, 0x2f5d54, { solid: false, edge: false });
        this.addBox(-39.24, floorTop + 0.84, -25.78, 0.16, 0.42, 0.52, 0xe8e0cc, { solid: false });
        this.addBox(-39.24, floorTop + 0.84, -24.22, 0.16, 0.42, 0.52, C.flowerA, { solid: false });
        this.addBox(-39.02, floorTop + 0.72, -25.9, 0.58, 0.14, 0.6, 0x9a5a46, { solid: false, edge: false });
        this.addBox(-39.02, floorTop + 0.8, -25.9, 0.59, 0.04, 0.61, 0xd8c7a6, { solid: false, edge: false });
    
        // 小边桌：保温杯、速写本，给拍照的人放东西。
        this.addBox(-39.0, floorTop + 0.29, -22.55, 0.72, 0.58, 0.62, C.woodDark, { tag: "lookout-table" });
        this.addBox(-39.0, floorTop + 0.61, -22.55, 0.8, 0.06, 0.7, C.woodLight, { solid: false, edge: false });
        this.addBox(-39.14, floorTop + 0.82, -22.62, 0.14, 0.3, 0.14, C.metalLight, { solid: false });
        this.addBox(-39.14, floorTop + 0.99, -22.62, 0.16, 0.05, 0.16, C.lime, { solid: false, edge: false });
        this.addBox(-38.8, floorTop + 0.67, -22.5, 0.34, 0.05, 0.26, C.flowerB, { solid: false, edge: false });
        this.addBox(-38.8, floorTop + 0.7, -22.5, 0.3, 0.03, 0.22, C.white, { solid: false, edge: false });
    
        // 棉麻地毯：压住木板的单调，也给相机三脚架一个中心。
        this.addBox(-36.6, floorTop + 0.012, -24.3, 2.4, 0.02, 1.8, 0x33564d, { solid: false, edge: false });
        this.addBox(-36.6, floorTop + 0.022, -24.3, 2.2, 0.01, 1.6, 0x3d665b, { solid: false, edge: false });
        for (const z of [-25.0, -23.6]) {
          this.addBox(-36.6, floorTop + 0.03, z, 2.24, 0.01, 0.05, 0xd8c7a6, { solid: false, edge: false });
        }
    
        // 两侧花箱：把楼梯口和休息区区分开。
        for (const z of [-27.45, -22.55]) {
          this.addBox(-34.2, floorTop + 0.28, z, 0.86, 0.56, 0.86, C.woodDark, { tag: "lookout-planter" });
          this.addBox(-34.2, floorTop + 0.58, z, 0.7, 0.06, 0.7, C.soil, { solid: false, edge: false });
          for (let i = 0; i < 3; i += 1) {
            const ox = (i - 1) * 0.22;
            this.addBox(-34.2 + ox, floorTop + 0.85, z, 0.06, 0.48, 0.06, C.leaf, { solid: false, edge: false });
            this.addBox(-34.2 + ox, floorTop + 1.12, z, 0.16, 0.12, 0.16, i % 2 === 0 ? C.flowerA : C.flowerB, {
              solid: false,
              edge: false,
            });
          }
        }
    
        // 两盏落地灯：夜里从岛西侧看过来，这是唯一亮着的暖光。
        for (const z of [-27.7, -22.3]) {
          this.addBox(-39.55, floorTop + 0.18, z, 0.26, 0.36, 0.26, C.woodDark, { solid: false });
          this.addBox(-39.55, floorTop + 0.48, z, 0.22, 0.24, 0.22, 0xffd9a0, { glow: true, solid: false });
          this.addBox(-39.55, floorTop + 0.64, z, 0.3, 0.06, 0.3, C.woodDark, { solid: false, edge: false });
        }
    
        // 西侧串灯：沿着扶手挂一排小灯泡，黄昏后能看见一条暖线。
        this.addBox(x0 + 0.1, railY - 0.1, cz, 0.02, 0.02, z1 - z0 - 0.8, C.metal, { solid: false, edge: false });
        for (let z = z0 + 0.5; z <= z1 - 0.4; z += 0.55) {
          this.addBox(x0 + 0.1, railY - 0.16, z, 0.12, 0.12, 0.12, 0xffd9a0, { glow: true, solid: false, edge: false });
        }
    
        // 北侧栏杆上的照片墙：三张在这里拍下的落日。
        const printZ = z0 + 0.16;
        const prints = [
          photoPrintTexture("01", "18:24 WEST", ["#e8a06b", "#ffd98a", "#43564b"]),
          photoPrintTexture("02", "BLUE HOUR", ["#6d86a8", "#f2d6a0", "#34424c"]),
          photoPrintTexture("03", "AFTER RAIN", ["#8f9a96", "#d8ff5f", "#2f4a3c"]),
        ];
        this.addBox(cx, railY - 0.08, printZ, 4.0, 0.02, 0.02, C.metal, { solid: false, edge: false });
        prints.forEach((texture, i) => {
          const x = -38.4 + i * 1.7;
          this.addBox(x, 2.24, printZ + 0.03, 0.74, 0.9, 0.03, C.woodDark, { solid: false, edge: false });
          this.addSign(texture, 0.68, 0.84, x, 2.24, printZ + 0.055);
          this.addBox(x, 2.68, printZ + 0.045, 0.04, 0.12, 0.04, C.metal, { solid: false, edge: false });
        });
    
        // Camera tripod for photo mode：镜头朝西，对着日落。
        const tripod = new THREE.Group();
        tripod.position.set(-35.9, floorTop, -26.0);
        tripod.rotation.y = Math.PI;
        tripod.name = "photo-tripod";
        const legMat = new THREE.MeshStandardMaterial({ color: C.metal, roughness: 0.6 });
        for (let i = 0; i < 3; i += 1) {
          const a = (i / 3) * Math.PI * 2;
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.35, 6), legMat);
          leg.position.set(Math.cos(a) * 0.32, 0.65, Math.sin(a) * 0.32);
          leg.rotation.z = Math.cos(a) * 0.22;
          leg.rotation.x = -Math.sin(a) * 0.22;
          tripod.add(leg);
        }
        const cameraBody = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.34, 0.26),
          new THREE.MeshStandardMaterial({ color: 0x222a28, roughness: 0.5 }),
        );
        cameraBody.position.set(0, 1.42, 0);
        tripod.add(cameraBody);
        const lens = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 0.16, 10),
          new THREE.MeshStandardMaterial({ color: 0x9ec9cf, roughness: 0.2, metalness: 0.4 }),
        );
        lens.rotation.z = Math.PI / 2;
        lens.position.set(0.3, 1.42, 0);
        tripod.add(lens);
        tripod.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.userData.noShadow = true;
          }
        });
        this.group.add(tripod);
        this.interactables.push({
          id: "photo",
          object: tripod,
          label: "进入拍照模式",
          maxDistance: 3.2,
        });
    
        this.addSign(
          signTexture("LOOKOUT", "SUNSET 18:00 / PHOTO POINT", "#e5c07b"),
          2.4,
          0.6,
          -36.8,
          2.2,
          z1 + 0.08,
          0,
        );
    
        // 台子周围的草与野花，别让木台直接插在空草坪上。
        for (const [x, z] of [
          [-41.2, -29.2],
          [-41.4, -20.9],
          [-32.5, -29.5],
          [-42.5, -25.2],
          [-32.6, -27.9],
          [-34.8, -29.7],
        ] as const) {
          this.addBox(x, 0.36, z, 0.1, 0.72, 0.1, C.leaf, { solid: false, edge: false });
          this.addBox(x + 0.14, 0.26, z + 0.1, 0.09, 0.52, 0.09, C.leafLight, { solid: false, edge: false });
          this.addBox(x - 0.04, 0.74, z, 0.16, 0.12, 0.16, C.flowerB, { solid: false, edge: false });
        }
      }
  
      buildWeatherProps() {
        // Laundry line in front of the studio: the clothes disappear when it rains.
        for (const x of [4.6, 9.6]) {
          this.addBox(x, 1.35, -14.9, 0.14, 2.7, 0.14, C.metal, { solid: false });
        }
        this.addBox(7.1, 2.66, -14.9, 5.2, 0.06, 0.06, 0xcfc7b4, { solid: false, edge: false });
        const clothColors = [0xd66b7a, 0xf3e6a5, 0x9fe6ff, 0xd8ff5f];
        clothColors.forEach((color, i) => {
          const cloth = new THREE.Mesh(
            new THREE.BoxGeometry(0.82, 0.95, 0.05),
            new THREE.MeshLambertMaterial({ color }),
          );
          cloth.position.set(5.55 + i * 1.05, 2.15, -14.9);
          cloth.userData.noShadow = true;
          this.group.add(cloth);
          this.laundryClothes.push(cloth);
        });
    
        // Wind chime under the pavilion roof.
        for (let i = 0; i < 5; i += 1) {
          const tube = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.035, 0.3 + (i % 3) * 0.14, 6),
            new THREE.MeshLambertMaterial({ color: i % 2 === 0 ? C.metalLight : 0xd9cfae }),
          );
          tube.position.set(-37.75 + (i - 2) * 0.16, 3.12, 30.4);
          tube.userData.noShadow = true;
          this.group.add(tube);
          this.chimeTubes.push(tube);
        }
        for (const x of [-38.05, -37.45]) {
          this.addBox(x, 3.55, 30.4, 0.03, 0.5, 0.03, 0x9aa39a, { solid: false, edge: false });
        }
      }
  
      buildMapBoard() {
        // 广场南侧靠西，避开北面迎宾拱门的立柱（x=±5.7, z=22.5），
        // 让出生点的玩家能正面看到地图牌、不被柱子挡住。
        const x = -9.8;
        const z = 19.0;
        this.addBox(x - 1.42, 1.0, z, 0.16, 2.2, 0.16, C.metal, { solid: false });
        this.addBox(x + 1.42, 1.0, z, 0.16, 2.2, 0.16, C.metal, { solid: false });
        this.addBox(x, 2.3, z - 0.06, 3.0, 2.5, 0.18, C.woodDark);
        const board = this.addSign(islandMapTexture(), 2.7, 2.3, x, 2.48, z + 0.06);
        board.name = "island-map";
        this.addBox(x, 3.66, z + 0.04, 3.0, 0.1, 0.12, C.lime, {
          glow: true,
          solid: false,
          edge: false,
        });
        this.interactables.push({
          id: "map",
          object: board,
          label: "查看岛屿地图",
          maxDistance: 3.6,
        });
      }
  
      buildPiano() {
        // A street piano on the west side of the plaza, facing the fountain.
        const x = -8.6;
        const z = 5.0;
        // 琴身：正面（+x）朝喷泉，琴凳在 +x 侧，坐下来正好面对键盘。
        this.addBox(x, 0.72, z, 0.72, 1.2, 1.5, C.woodDark, { tag: "piano" });
        this.addBox(x, 1.34, z, 0.78, 0.1, 1.58, C.black, { tag: "piano" });
        // 键盘台从琴身伸出来，琴键才不会嵌在琴体里。
        this.addBox(x + 0.62, 1.16, z, 0.5, 0.12, 1.5, C.woodDark, { tag: "piano" });
    
        // 8 个白键，1—8 各对应音阶里的一个音；每个键单独一个 mesh 才能按下沉。
        const keyDepth = 0.42;
        const keyPitch = 0.16;
        const keyWidth = 0.15;
        const keyRestY = 1.235;
        const keyX = x + 0.62;
        for (let i = 0; i < 8; i += 1) {
          const key = new THREE.Mesh(
            new THREE.BoxGeometry(keyDepth, 0.075, keyWidth),
            new THREE.MeshLambertMaterial({ color: 0xf3eee2 }),
          );
          key.position.set(keyX, keyRestY, z - (7 * keyPitch) / 2 + i * keyPitch);
          key.userData.restY = keyRestY;
          key.userData.noShadow = true;
          this.group.add(key);
          this.pianoKeys.push(key);
        }
        // 黑键只贴住键尾：视觉上是一条琴键，不参与按压动画。
        for (let i = 0; i < 7; i += 1) {
          const black = new THREE.Mesh(
            new THREE.BoxGeometry(0.24, 0.06, 0.085),
            new THREE.MeshLambertMaterial({ color: 0x1d211f }),
          );
          black.position.set(keyX - 0.12, keyRestY + 0.0675, z - (6 * keyPitch) / 2 + i * keyPitch);
          black.userData.noShadow = true;
          this.group.add(black);
        }
    
        // 谱架：别让 PIANO 牌悬在半空。
        this.addBox(x - 0.36, 1.66, z, 0.06, 0.55, 1.5, C.black, { solid: false, edge: false });
        this.addSign(
          signTexture("PIANO", "PRESS E / THEN 1—8", "#d8ff5f"),
          1.7,
          0.42,
          x - 0.3,
          1.7,
          z,
          Math.PI / 2,
        );
    
        // 琴凳：座面 + 靠背，靠背在 +x 侧，坐上去背对广场。
        // 凳面比原来往后退了 0.45 m，坐下后琴键不会顶到镜头。
        this.addBox(x + 1.45, 0.3, z, 0.62, 0.6, 0.62, C.wood, { tag: "piano" });
        this.addBox(x + 1.7, 0.7, z, 0.18, 1.2, 0.7, C.woodDark, { tag: "piano" });
        this.addBox(x, 0.2, z, 0.8, 0.4, 1.6, C.woodDark, { solid: false, edge: false });
    
        const proxy = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 1.6, 1.9),
          new THREE.MeshBasicMaterial({ visible: false }),
        );
        proxy.position.set(x - 0.2, 1.0, z);
        proxy.name = "piano";
        this.group.add(proxy);
        this.interactables.push({ id: "piano", object: proxy, label: "弹一首", maxDistance: 3.2 });
      }
  
      buildTrees() {
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
          // 原先这丛正好压在五年小径东缘（路 x=-31.2..-28.8），走路会从叶子里穿过去。
          [-26.9, 15.0],
        ]) {
          this.addBox(x, 0.6, z, 1.8, 1.2, 1.5, C.leafDark, { solid: false, edge: false });
          this.addBox(x + 0.4, 1.0, z - 0.2, 1.1, 0.7, 1.0, C.leaf, { solid: false, edge: false });
        }
      }
  
      buildLamps() {
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
          // 池塘北岸那条路的两盏灯，别再站在旧营地的直路上。
          [18.4, 15.4],
          [28.4, 15.4],
          [-17.5, 12.5],
          // 五年小径转角：往南退到 z=14.8，避开 x=-34 那棵树的树冠（原位置灯头插进叶子里）。
          [-32.4, 14.8],
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
  
      buildPerimeter() {
        // hedges keep the player inside the diorama
        this.addBox(0, 1.6, 49.2, 100, 3.2, 2.2, C.leafDark, { edge: false });
        this.addBox(0, 1.6, -49.2, 100, 3.2, 2.2, C.leafDark, { edge: false });
        this.addBox(49.2, 1.6, 0, 2.2, 3.2, 100, C.leafDark, { edge: false });
        // 西侧：观景台正对的那段树篱改成低矮石栏，让日落和远山真正露出来；
        // 石栏 1.65 高，仍高于玩家 1.28 的跳跃高度，边界不会被跳出去。
        this.addBox(-49.2, 1.6, -44, 2.2, 3.2, 12, C.leafDark, { edge: false });
        this.addBox(-49.2, 1.6, 18, 2.2, 3.2, 64, C.leafDark, { edge: false });
        this.addBox(-49.2, 0.78, -26, 1.1, 1.56, 24, C.stone, { edge: false, tag: "lookout-parapet" });
        this.addBox(-49.2, 1.6, -26, 1.34, 0.1, 24.2, C.stoneDark, { edge: false, tag: "lookout-parapet" });
        for (const z of [-38, -14]) {
          this.addBox(-49.2, 1.7, z, 1.5, 3.4, 1.5, C.stoneDark, { edge: false, tag: "lookout-parapet" });
          this.addBox(-49.2, 3.45, z, 1.7, 0.14, 1.7, C.stone, { edge: false, tag: "lookout-parapet" });
        }
    
        // distant hills, outside the hedge：西侧改成两层低矮远山，不再是一堵近处的绿墙。
        const hills: [number, number, number, number, number, number][] = [
          [-78, 1.6, -30, 48, 4.0, 44],
          [-112, 1.0, -52, 70, 6.0, 70],
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
  
      createStaticMeshes(quality: Quality) {
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
}

/** WorldBuilder 用到、但定义在 VoxelWorld 的字段与跨模块方法。 */
export interface WorldBuilder {
  registerSignal(id: string, surface: THREE.Mesh, detail: THREE.CanvasTexture): void;
  buildSignalConstellation(): void;
  blocks: BoxSpec[];
  glowBlocks: BoxSpec[];
  edgePositions: number[];
  colliders: AABB[];
  interactables: Interactable[];
  group: THREE.Group;
  quality: Quality;
  plaqueReadings: Map<string, SignalCopy>;
  scores: number;
  eggCount: number;
  shelfTargetX: number;
  campfireOn: boolean;
  barrelWater: any;
  campfireEmbers: any;
  campfireFlames: any;
  campfireLight: any;
  chimeTubes: any;
  courtLight: any;
  courtOff: any;
  courtOn: any;
  glowMaterial: any;
  laundryClothes: any;
  monitorMaterial: any;
  monitorTexture: any;
  pianoKeys: any;
  poolLightBase: any;
  poolLights: any;
  poolMaterial: any;
  radioBars: any;
  radioLed: any;
  radioLight: any;
  shelfCollider: any;
  shelfGroup: any;
  telescopeInteractable: any;
  telescopeModel: any;
  waterMaterial: any;
  waterMeshes: any;
  wetLayer: any;
  wetMaterial: any;
  windmillBlades: any;
  windsock: any;
}

/** 把 baseCtors 的原型方法合并到 derivedCtor（TypeScript mixin）。 */
export function applyMixins(
  derivedCtor: { prototype: unknown },
  baseCtors: { prototype: unknown }[],
) {
  baseCtors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      Object.defineProperty(derivedCtor.prototype, name, {
        value: (baseCtor.prototype as Record<string, unknown>)[name],
        writable: true,
        configurable: true,
      });
    });
  });
}
