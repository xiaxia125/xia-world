import * as THREE from "three";
import { ZONES } from "./zones";

type Ctx = CanvasRenderingContext2D;

function canvas(width: number, height: number): { c: HTMLCanvasElement; ctx: Ctx } {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  return { c, ctx };
}

function finish(c: HTMLCanvasElement, anisotropy = 4): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

function wrapLines(ctx: Ctx, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const character of text) {
    const next = line + character;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = character;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function profileBoardTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(1024, 640);
  ctx.fillStyle = "#07100c";
  ctx.fillRect(0, 0, 1024, 640);

  const glow = ctx.createRadialGradient(812, 172, 20, 812, 172, 420);
  glow.addColorStop(0, "rgba(216,255,95,0.2)");
  glow.addColorStop(1, "rgba(216,255,95,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1024, 640);

  ctx.strokeStyle = "rgba(216,255,95,0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, 980, 596);

  ctx.fillStyle = "#d8ff5f";
  ctx.font = "600 17px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("PUBLIC PROFILE / XIA HOME", 52, 70);
  ctx.fillStyle = "rgba(241,236,223,0.44)";
  ctx.font = "400 14px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("FRONTEND ENGINEER / 2026", 52, 98);

  ctx.fillStyle = "#d8ff5f";
  ctx.fillRect(52, 126, 7, 66);
  ctx.fillStyle = "#f1ecdf";
  ctx.font = "900 78px 'Arial Black', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText("夏夏", 78, 186);
  ctx.fillStyle = "rgba(241,236,223,0.84)";
  ctx.font = "500 27px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText("前端开发工程师 · 5 年经验", 78, 226);

  ctx.strokeStyle = "rgba(241,236,223,0.14)";
  ctx.beginPath();
  ctx.moveTo(52, 272);
  ctx.lineTo(972, 272);
  ctx.stroke();

  ctx.fillStyle = "rgba(241,236,223,0.72)";
  ctx.font = "400 23px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText("复杂业务前端 · 数据可视化", 52, 328);
  ctx.fillText("地图 / 三维 · 跨端小程序", 52, 368);

  const tags = ["VUE", "REACT", "TYPESCRIPT", "ECHARTS", "UNIAPP"];
  let tagX = 52;
  ctx.font = "600 14px 'Cascadia Code', Consolas, monospace";
  for (const tag of tags) {
    const width = ctx.measureText(tag).width + 24;
    ctx.fillStyle = "rgba(216,255,95,0.09)";
    ctx.fillRect(tagX, 424, width, 34);
    ctx.strokeStyle = "rgba(216,255,95,0.32)";
    ctx.strokeRect(tagX, 424, width, 34);
    ctx.fillStyle = "#d8ff5f";
    ctx.fillText(tag, tagX + 12, 447);
    tagX += width + 8;
  }

  ctx.fillStyle = "#d8ff5f";
  ctx.font = "700 24px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("> 按 E 打开完整职业档案", 52, 538);
  ctx.fillStyle = "rgba(241,236,223,0.38)";
  ctx.font = "400 15px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("PROJECTS / EXPERIENCE / SKILLS / CONTACT", 52, 578);

  return finish(c, 8);
}

export function projectTexture(
  index: string,
  title: string,
  category: string,
  summary: string,
  stack: string[],
): THREE.CanvasTexture {
  const { c, ctx } = canvas(1024, 640);
  const accents = ["#d8ff5f", "#ff8a4c", "#9fe6ff", "#e5c07b"];
  const accent = accents[(Number(index) - 1) % accents.length] ?? accents[0]!;
  ctx.fillStyle = "#07100c";
  ctx.fillRect(0, 0, 1024, 640);

  const glow = ctx.createRadialGradient(760, 140, 20, 760, 140, 430);
  glow.addColorStop(0, `${accent}22`);
  glow.addColorStop(1, `${accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1024, 640);

  ctx.strokeStyle = "rgba(241,236,223,0.14)";
  ctx.lineWidth = 1;
  for (let x = 0; x < 1024; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 640);
    ctx.stroke();
  }
  for (let y = 0; y < 640; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // 序号只作为角落里的小编号保留，不再占一块醒目的色块。
  ctx.fillStyle = `${accent}22`;
  ctx.fillRect(42, 42, 44, 30);
  ctx.strokeStyle = `${accent}66`;
  ctx.lineWidth = 1;
  ctx.strokeRect(42, 42, 44, 30);
  ctx.fillStyle = accent;
  ctx.font = "700 17px 'Cascadia Code', Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(index, 64, 58);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "rgba(241,236,223,0.44)";
  ctx.font = "500 14px 'Cascadia Code', Consolas, monospace";
  ctx.fillText(category.toUpperCase(), 130, 68);
  ctx.fillText("SELECTED PROJECT / 2026", 130, 94);

  ctx.fillStyle = "#f1ecdf";
  ctx.font = "800 48px 'Arial Black', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  const titleLines = wrapLines(ctx, title, 860);
  let y = 188;
  for (const line of titleLines.slice(0, 2)) {
    ctx.fillText(line, 44, y);
    y += 60;
  }

  ctx.fillStyle = "rgba(241,236,223,0.74)";
  ctx.font = "400 23px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  const summaryLines = wrapLines(ctx, summary, 880);
  y += 4;
  for (const line of summaryLines.slice(0, 3)) {
    ctx.fillText(line, 46, y);
    y += 36;
  }

  ctx.strokeStyle = "rgba(241,236,223,0.14)";
  ctx.beginPath();
  ctx.moveTo(44, 424);
  ctx.lineTo(980, 424);
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.font = "600 14px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("TECH STACK", 44, 462);
  ctx.fillStyle = "rgba(241,236,223,0.78)";
  ctx.font = "400 18px 'Cascadia Code', Consolas, monospace";
  ctx.fillText(stack.slice(0, 5).join("  /  "), 44, 496);

  ctx.fillStyle = "rgba(241,236,223,0.4)";
  ctx.font = "400 15px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("靠近后按 E 打开项目档案", 44, 580);

  return finish(c, 8);
}

export function radialTexture(
  inner: string,
  outer: string,
  size = 256,
): THREE.CanvasTexture {
  const { c, ctx } = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.38, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return finish(c, 1);
}

export function ballTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(256, 128);
  ctx.fillStyle = "#d96f2f";
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = "#7d3d1b";
  ctx.fillRect(0, 0, 256, 3);
  ctx.fillRect(0, 125, 256, 3);
  ctx.fillRect(126, 0, 3, 128);
  ctx.strokeStyle = "#51250f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(128, 64, 62, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, 64, 62, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.stroke();
  // A few darker speckles for a used ball.
  ctx.fillStyle = "rgba(90, 40, 16, 0.35)";
  for (let i = 0; i < 40; i += 1) {
    const x = (i * 73) % 256;
    const y = (i * 41) % 128;
    ctx.fillRect(x, y, 2, 2);
  }
  return finish(c, 4);
}

export function signTexture(
  title: string,
  subtitle: string,
  accent = "#d8ff5f",
): THREE.CanvasTexture {
  const { c, ctx } = canvas(1024, 256);
  ctx.fillStyle = "#07100c";
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = "rgba(241,236,223,0.18)";
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 1004, 236);
  ctx.fillStyle = accent;
  ctx.fillRect(34, 34, 10, 188);
  ctx.fillStyle = "#f1ecdf";
  ctx.font = "800 86px 'Arial Black', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(title, 70, 112);
  ctx.fillStyle = "rgba(241,236,223,0.55)";
  ctx.font = "500 22px 'Cascadia Code', Consolas, monospace";
  ctx.letterSpacing = "3px";
  ctx.fillText(subtitle, 74, 190);
  return finish(c, 4);
}

export function signalTexture(
  title: string,
  lines: string[],
  wide = false,
): THREE.CanvasTexture {
  const width = wide ? 1024 : 768;
  const height = wide ? 576 : 1024;
  const { c, ctx } = canvas(width, height);
  const pad = wide ? 56 : 48;
  ctx.fillStyle = "#07110c";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(216,255,95,0.3)";
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, width - 36, height - 36);
  ctx.fillStyle = "#d8ff5f";
  ctx.font = "600 18px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("XIA HOME / SIGNAL", pad, pad + 8);
  ctx.fillStyle = "#f1ecdf";
  ctx.font = `800 ${wide ? 48 : 54}px 'Arial Black', 'PingFang SC', sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillText(title, pad, wide ? 108 : 128, width - pad * 2);
  ctx.fillStyle = "rgba(241,236,223,0.82)";
  ctx.font = `${wide ? 24 : 28}px 'PingFang SC', 'Microsoft YaHei', sans-serif`;
  const lineHeight = wide ? 44 : 48;
  let y = wide ? 190 : 260;
  const maxWidth = width - pad * 2;
  for (const paragraph of lines) {
    let line = "";
    for (const character of paragraph) {
      const next = line + character;
      if (ctx.measureText(next).width > maxWidth && line) {
        ctx.fillText(line, pad, y);
        y += lineHeight;
        line = character;
      } else {
        line = next;
      }
    }
    if (line) {
      ctx.fillText(line, pad, y);
      y += lineHeight;
    }
    y += wide ? 12 : 18;
  }
  ctx.fillStyle = "rgba(241,236,223,0.5)";
  ctx.font = "400 16px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("PRESS E TO RETURN", pad, height - pad);
  return finish(c, 8);
}

/** Small amber-lit tuner face for the rooftop weather radio. */
export function radioTunerTexture(): THREE.CanvasTexture {
  const width = 512;
  const height = 128;
  const { c, ctx } = canvas(width, height);
  ctx.fillStyle = "#0d1711";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(216,255,95,0.5)";
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, width - 8, height - 8);

  ctx.fillStyle = "rgba(216,255,95,0.72)";
  ctx.font = "600 16px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("FM / WEATHER", 24, 17);

  const start = 30;
  const end = width - 30;
  const scaleY = 84;
  ctx.strokeStyle = "rgba(241,236,223,0.42)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(start, scaleY);
  ctx.lineTo(end, scaleY);
  ctx.stroke();

  for (let i = 0; i <= 10; i += 1) {
    const x = start + ((end - start) * i) / 10;
    const tall = i % 2 === 0;
    ctx.strokeStyle = tall ? "rgba(216,255,95,0.8)" : "rgba(241,236,223,0.36)";
    ctx.beginPath();
    ctx.moveTo(x, scaleY);
    ctx.lineTo(x, scaleY - (tall ? 18 : 10));
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(241,236,223,0.5)";
  ctx.font = "500 13px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("87", start - 2, scaleY + 8);
  ctx.fillText("94", width / 2 - 8, scaleY + 8);
  ctx.fillText("108", end - 15, scaleY + 8);

  const needleX = start + ((end - start) * (88.7 - 87)) / (108 - 87);
  ctx.strokeStyle = "#ffb36b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(needleX, 33);
  ctx.lineTo(needleX, 96);
  ctx.stroke();
  ctx.fillStyle = "#ffb36b";
  ctx.beginPath();
  ctx.moveTo(needleX - 5, 96);
  ctx.lineTo(needleX + 5, 96);
  ctx.lineTo(needleX, 104);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#d8ff5f";
  ctx.font = "800 36px 'Arial Black', 'PingFang SC', sans-serif";
  ctx.fillText("88.7", width - 122, 25);
  return finish(c, 4);
}

export function screenTexture(score: number, eggs: number, totalEggs = 5): THREE.CanvasTexture {
  const { c, ctx } = canvas(1024, 576);
  ctx.fillStyle = "#07110c";
  ctx.fillRect(0, 0, 1024, 576);
  const glow = ctx.createRadialGradient(512, 280, 30, 512, 280, 560);
  glow.addColorStop(0, "rgba(216,255,95,0.13)");
  glow.addColorStop(1, "rgba(216,255,95,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1024, 576);

  ctx.strokeStyle = "rgba(216,255,95,0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, 976, 528);

  ctx.fillStyle = "#d8ff5f";
  ctx.font = "600 20px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("XIA HOME // PUBLIC PROFILE", 52, 72);

  ctx.fillStyle = "rgba(241,236,223,0.4)";
  ctx.font = "400 16px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("5 YEARS / FRONTEND ENGINEER / OPEN TO WORK", 52, 108);

  ctx.fillStyle = "#f1ecdf";
  ctx.font = "800 72px 'Arial Black', 'PingFang SC', sans-serif";
  ctx.fillText("WORKING PROFILE", 50, 198);

  ctx.font = "400 24px 'Cascadia Code', Consolas, monospace";
  ctx.fillStyle = "rgba(241,236,223,0.72)";
  ctx.fillText("01  COMPLEX BUSINESS      VUE / REACT / TS", 54, 254);
  ctx.fillText("02  DATA + MAP            ECHARTS / MAP / 3D", 54, 296);
  ctx.fillText("03  CROSS-PLATFORM        UNIAPP / H5 / MP", 54, 338);

  ctx.strokeStyle = "rgba(241,236,223,0.12)";
  ctx.beginPath();
  ctx.moveTo(52, 376);
  ctx.lineTo(972, 376);
  ctx.stroke();

  ctx.fillStyle = "#d8ff5f";
  ctx.font = "700 26px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("> PRESS P FOR THE PUBLIC PROFILE", 52, 434);
  ctx.fillStyle = "rgba(241,236,223,0.36)";
  ctx.font = "400 18px 'Cascadia Code', Consolas, monospace";
  ctx.fillText(`BASKETS ${score}/3   ·   EGGS ${eggs}/${totalEggs}`, 52, 486);

  ctx.fillStyle = "rgba(216,255,95,0.5)";
  ctx.font = "400 14px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("LIVE RENDER · 60FPS TARGET", 700, 72);
  return finish(c, 8);
}

export function posterTexture(
  index: string,
  title: string,
  meta: string,
  desc: string,
  palette: [string, string, string],
): THREE.CanvasTexture {
  const { c, ctx } = canvas(768, 1024);
  const [bg, accent, light] = palette;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 768, 1024);

  // Background pixel field.
  ctx.globalAlpha = 0.35;
  for (let y = 0; y < 13; y += 1) {
    for (let x = 0; x < 10; x += 1) {
      if ((x * 7 + y * 13 + Number(index)) % 5 === 0) {
        ctx.fillStyle = x % 2 === 0 ? accent : light;
        ctx.globalAlpha = 0.06 + ((x + y) % 4) * 0.03;
        ctx.fillRect(x * 78, y * 78, 76, 76);
      }
    }
  }
  ctx.globalAlpha = 1;

  // Big number block.
  ctx.fillStyle = accent;
  ctx.fillRect(52, 52, 96, 96);
  ctx.fillStyle = bg;
  ctx.font = "800 58px 'Arial Black', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(index, 74, 104);

  ctx.fillStyle = light;
  ctx.font = "800 78px 'Arial Black', 'PingFang SC', sans-serif";
  const words = title.split(" ");
  let y = 320;
  for (const word of words) {
    ctx.fillText(word, 54, y);
    y += 86;
  }

  // Abstract architecture.
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = accent;
  ctx.fillRect(54, 618, 660, 4);
  ctx.fillStyle = light;
  ctx.fillRect(54, 646, 210, 210);
  ctx.fillStyle = accent;
  ctx.fillRect(282, 720, 190, 136);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(490, 646, 224, 92);
  ctx.fillRect(490, 756, 224, 100);
  ctx.globalAlpha = 1;

  ctx.fillStyle = light;
  ctx.font = "500 20px 'Cascadia Code', Consolas, monospace";
  ctx.fillText(meta.toUpperCase(), 54, 920);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "400 16px 'Cascadia Code', Consolas, monospace";
  const lines = desc.split("\n");
  lines.forEach((line, i) => ctx.fillText(line, 54, 956 + i * 24));

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, 736, 992);
  return finish(c, 8);
}

/**
 * 工作室里的立式白板。原来是三张各讲一个方向的海报，读起来像简历分栏；
 * 现在合成一块白板，把界面 / 数据 / 交互写成同一条工作链。
 */
export function whiteboardTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 640;
  const { c, ctx } = canvas(width, height);

  ctx.fillStyle = "#eceade";
  ctx.fillRect(0, 0, width, height);
  // 白板长期使用的擦痕：很淡的中性色块，不是贴图噪点。
  ctx.fillStyle = "rgba(120,126,116,0.06)";
  for (let i = 0; i < 9; i += 1) {
    ctx.fillRect((i * 137) % width, (i * 83) % height, 180, 46);
  }

  ctx.fillStyle = "#2f5547";
  ctx.font = "700 46px 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText("怎么把复杂信息做清楚", 56, 86);
  ctx.fillStyle = "#d8ff5f";
  ctx.fillRect(56, 104, 468, 10);

  ctx.fillStyle = "rgba(47,85,71,0.55)";
  ctx.font = "500 18px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("STUDIO BOARD / WORKING NOTES / 2026", 58, 138);

  const columns: Array<{ no: string; title: string; lines: string[]; accent: string }> = [
    {
      no: "01",
      title: "界面",
      lines: ["Vue 2/3 · React · TS", "先理清路径，再谈动效", "组件拆到能复用为止"],
      accent: "#2f5547",
    },
    {
      no: "02",
      title: "数据",
      lines: ["ECharts · 地图 · 三维", "同一组数字，换个尺度", "先让人看懂，再让人惊叹"],
      accent: "#b26a2f",
    },
    {
      no: "03",
      title: "交互",
      lines: ["Three.js · UniApp · H5", "桌面到手机是同一条线", "把入口做明显，把退路留好"],
      accent: "#3f6070",
    },
  ];

  columns.forEach((column, index) => {
    const x = 58 + index * 316;
    ctx.fillStyle = column.accent;
    ctx.font = "800 34px 'Cascadia Code', Consolas, monospace";
    ctx.fillText(column.no, x, 218);
    ctx.font = "700 34px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillText(column.title, x + 58, 218);
    ctx.fillRect(x, 236, 268, 4);
    ctx.font = "500 22px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    column.lines.forEach((line, i) => {
      ctx.fillStyle = "rgba(38,48,43,0.82)";
      ctx.fillText(line, x, 286 + i * 42);
    });
  });

  // 便签：三张不同颜色，写的是还没做完的事。
  const notes: Array<{ x: number; color: string; text: string }> = [
    { x: 84, color: "#d8ff5f", text: "把地图性能再测一遍" },
    { x: 396, color: "#ffcf8a", text: "接口错误态补文案" },
    { x: 700, color: "#f1b6b0", text: "手机端再走一次流程" },
  ];
  notes.forEach((note, i) => {
    ctx.save();
    ctx.translate(note.x, 470 + (i % 2) * 18);
    ctx.rotate((i - 1) * 0.035);
    ctx.fillStyle = note.color;
    ctx.fillRect(0, 0, 236, 110);
    ctx.fillStyle = "rgba(30,40,34,0.78)";
    ctx.font = "600 20px 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillText(note.text, 20, 46);
    ctx.fillStyle = "rgba(30,40,34,0.4)";
    ctx.font = "500 15px 'Cascadia Code', Consolas, monospace";
    ctx.fillText("TODO / NEXT", 20, 84);
    ctx.restore();
  });

  // 右下角的小流程图：界面 → 数据 → 交互，最后回到用户。
  ctx.strokeStyle = "rgba(47,85,71,0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(690, 564);
  ctx.lineTo(930, 564);
  ctx.stroke();
  ctx.fillStyle = "rgba(47,85,71,0.85)";
  ctx.font = "600 18px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("界面 → 数据 → 交互 → 用户", 690, 602);

  ctx.strokeStyle = "rgba(47,85,71,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, width - 40, height - 40);
  return finish(c, 8);
}

/** 副屏：竖着一块编辑器，和主屏的公开档案分开。 */
export function codeTexture(): THREE.CanvasTexture {
  const width = 384;
  const height = 512;
  const { c, ctx } = canvas(width, height);
  ctx.fillStyle = "#0b1310";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#152019";
  ctx.fillRect(0, 0, width, 34);
  ctx.fillStyle = "#d8ff5f";
  ctx.font = "600 14px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("App.tsx", 16, 23);
  ctx.fillStyle = "rgba(241,236,223,0.35)";
  ctx.fillText("map.ts", 104, 23);
  ctx.fillText("api.ts", 168, 23);

  const colors = ["#7fb5a2", "#d8ff5f", "#8fb0d8", "#e5c07b", "rgba(241,236,223,0.42)"];
  let y = 66;
  for (let i = 0; i < 17; i += 1) {
    ctx.fillStyle = "rgba(241,236,223,0.18)";
    ctx.font = "400 12px 'Cascadia Code', Consolas, monospace";
    ctx.fillText(String(i + 1).padStart(2, "0"), 12, y);
    ctx.fillStyle = colors[(i * 3 + 1) % colors.length];
    const indent = 34 + ((i * 5) % 3) * 12;
    const w = 60 + ((i * 47) % 220);
    ctx.fillRect(indent, y - 9, w, 8);
    y += 23;
  }

  ctx.fillStyle = "#0f1b15";
  ctx.fillRect(0, 408, width, 104);
  ctx.fillStyle = "#d8ff5f";
  ctx.font = "600 13px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("$ npm run build", 16, 434);
  ctx.fillStyle = "rgba(241,236,223,0.55)";
  ctx.font = "400 12px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("vite v7  ready in 412 ms", 16, 458);
  ctx.fillStyle = "#9fe6ff";
  ctx.fillText("dist/ 611.2 kB  ✓", 16, 480);
  return finish(c, 8);
}

export function mirrorTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(1024, 384);
  const g = ctx.createLinearGradient(0, 0, 0, 384);
  g.addColorStop(0, "#16251f");
  g.addColorStop(0.45, "#2c4439");
  g.addColorStop(1, "#0a1410");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 384);

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#cfe6d8";
  ctx.fillRect(80, 50, 180, 290);
  ctx.fillRect(300, 80, 70, 230);
  ctx.fillRect(760, 30, 120, 180);
  ctx.fillStyle = "#d8ff5f";
  ctx.fillRect(610, 190, 90, 6);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "rgba(241,236,223,0.22)";
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, 1000, 360);

  ctx.fillStyle = "rgba(241,236,223,0.42)";
  ctx.font = "500 18px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("NO EXCUSES  /  TRAIN IN THE BLOCK", 42, 348);
  return finish(c, 4);
}

export function neonTexture(text: string, color = "#d8ff5f"): THREE.CanvasTexture {
  const { c, ctx } = canvas(1024, 320);
  ctx.clearRect(0, 0, 1024, 320);
  ctx.font = "900 190px 'Arial Black', 'PingFang SC', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  ctx.shadowBlur = 36;
  ctx.fillStyle = color;
  ctx.fillText(text, 512, 170);
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#f8ffe0";
  ctx.fillText(text, 512, 170);
  return finish(c, 4);
}

export function secretTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = "#07100c";
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "#d8ff5f";
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, 476, 476);
  ctx.fillStyle = "#d8ff5f";
  ctx.font = "700 58px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("YOU", 58, 150);
  ctx.fillText("FOUND", 58, 218);
  ctx.fillText("IT.", 58, 286);
  ctx.fillStyle = "rgba(241,236,223,0.5)";
  ctx.font = "400 20px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("BOOKSHELF // 05", 58, 380);
  ctx.fillText("NOT EVERY ROOM IS ON THE MAP.", 58, 416);
  return finish(c, 4);
}

export function floorSignTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(1024, 512);
  ctx.fillStyle = "#07100c";
  ctx.fillRect(0, 0, 1024, 512);
  ctx.strokeStyle = "rgba(216,255,95,0.2)";
  ctx.strokeRect(20, 20, 984, 472);

  ctx.fillStyle = "#d8ff5f";
  ctx.font = "600 18px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("A PERSONAL WORLD / EST. 2026", 54, 72);

  ctx.fillStyle = "#f1ecdf";
  ctx.font = "900 150px 'Arial Black', 'PingFang SC', sans-serif";
  ctx.fillText("XIA", 50, 226);
  ctx.strokeStyle = "#f1ecdf";
  ctx.lineWidth = 3;
  ctx.strokeText("HOME", 50, 366);

  ctx.fillStyle = "rgba(241,236,223,0.55)";
  ctx.font = "400 22px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("WALK IN. LOOK AROUND. PRESS P.", 54, 442);
  return finish(c, 4);
}


/**
 * 积水遮罩：黑色底 + 若干柔边白斑，用作水膜层的 alphaMap。
 * 白的地方积水、黑的地方干，所以雨停后路面是一块块水洼而不是整片镜面。
 * 用固定种子的伪随机，保证每次刷新水洼位置一样，不会看起来在漂。
 */
export function puddleMaskTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 512, 512);

  // 线性同余，种子固定 · 每次加载水洼形状一样
  let seed = 20261028;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  // 大块水洼：边缘用径向渐变糊开，看起来像摊开的水而不是贴上去的圆
  for (let i = 0; i < 26; i += 1) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 26 + rand() * 62;
    const g = ctx.createRadialGradient(x, y, r * 0.25, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.62, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
  // 每块水洼由几段半径不同的弧拼成，避免全是标准圆
    const lobes = 9;
    for (let s = 0; s <= lobes; s += 1) {
      const a = (s / lobes) * Math.PI * 2;
      const wobble = 0.72 + rand() * 0.5;
      const px = x + Math.cos(a) * r * wobble;
      const py = y + Math.sin(a) * r * wobble;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // 小水点：让大片水洼之间也有零散反光
  for (let i = 0; i < 90; i += 1) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 3 + rand() * 9;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = finish(c, 4);
  // 遮罩只取亮度，不能按 sRGB 采样，否则水洼边缘会偏亮
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/**
 * 广场上的岛屿地图牌。和 DOM 地图面板共用 zones.ts 的分区表，
 * 所以以后挪动区域只需要改一处。
 */
export function islandMapTexture(): THREE.CanvasTexture {
  const size = 1024;
  const { c, ctx } = canvas(size, size);
  const pad = 56;
  const inner = size - pad * 2;
  const px = (x: number) => pad + ((x + 50) / 100) * inner;
  const pz = (z: number) => pad + ((z + 50) / 100) * inner;

  ctx.fillStyle = "#07100c";
  ctx.fillRect(0, 0, size, size);

  // 岛面与海面
  const sea = ctx.createLinearGradient(0, 0, size, size);
  sea.addColorStop(0, "#0b1d18");
  sea.addColorStop(1, "#0d241d");
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#24402c";
  ctx.fillRect(pad, pad, inner, inner);

  // 海面波纹
  ctx.strokeStyle = "rgba(159,230,255,0.08)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i += 1) {
    const y = pad + 18 + i * 22;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    for (let x = 0; x <= inner; x += 24) {
      ctx.lineTo(pad + x, y + Math.sin((x + i * 30) * 0.03) * 5);
    }
    ctx.stroke();
  }

  // 网格
  ctx.strokeStyle = "rgba(241,236,223,0.06)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i += 1) {
    const x = pad + (inner / 10) * i;
    const z = pad + (inner / 10) * i;
    ctx.beginPath();
    ctx.moveTo(x, pad);
    ctx.lineTo(x, pad + inner);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pad, z);
    ctx.lineTo(pad + inner, z);
    ctx.stroke();
  }

  // 道路
  ctx.fillStyle = "rgba(196,187,166,0.32)";
  const road = (x0: number, x1: number, z0: number, z1: number) => {
    ctx.fillRect(px(x0), pz(z0), px(x1) - px(x0), pz(z1) - pz(z0));
  };
  road(-3, 3, 13, 31);
  road(-3, 3, -17, -13);
  road(13, 16, -1.6, 3.6);
  road(-17, -13, -1.6, 3.6);
  road(3, 15.6, 18.4, 21.6);
  road(-30, -13, 9.2, 11.4);
  road(-31.2, -28.8, 11.4, 31.6);
  road(-35.6, -28.8, 29.2, 31.6);
  road(15.6, 30.5, 16.8, 19.8);
  road(35, 37.2, -17, -5);
  road(28.6, 36, -19, -16.6);
  road(-16, -13.8, -22, -2);
  road(-34, -14, -21.6, -19.4);

  const labels: Array<{ x: number; z: number; text: string; color: string; small?: boolean }> = [];
  for (const zone of ZONES) {
    const x0 = px(zone.x0);
    const z0 = pz(zone.z0);
    const w = px(zone.x1) - x0;
    const h = pz(zone.z1) - z0;
    ctx.fillStyle = `${zone.color}2e`;
    ctx.strokeStyle = `${zone.color}cc`;
    ctx.lineWidth = zone.id === "roof" || zone.id === "secret" ? 2 : 3;
    ctx.setLineDash(zone.id === "roof" ? [8, 6] : []);
    ctx.fillRect(x0, z0, w, h);
    ctx.strokeRect(x0, z0, w, h);
    ctx.setLineDash([]);
    labels.push({ x: x0 + w / 2, z: z0 + h / 2, text: zone.name, color: zone.color, small: w < 120 || h < 90 });
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const label of labels) {
    ctx.font = `${label.small ? 16 : 21}px 'PingFang SC', 'Microsoft YaHei', sans-serif`;
    ctx.fillStyle = "rgba(7,16,12,0.72)";
    ctx.fillText(label.text, label.x + 1, label.z + 2);
    ctx.fillStyle = label.color;
    ctx.fillText(label.text, label.x, label.z + 1);
  }

  // 出生点
  const sx = px(0);
  const sz = pz(30);
  ctx.fillStyle = "#f1ecdf";
  ctx.beginPath();
  ctx.arc(sx, sz, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "600 15px 'Cascadia Code', Consolas, monospace";
  ctx.fillStyle = "rgba(241,236,223,0.75)";
  ctx.fillText("START", sx, sz + 24);

  // 边框与标题
  ctx.strokeStyle = "rgba(216,255,95,0.35)";
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, size - 36, size - 36);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#d8ff5f";
  ctx.font = "700 22px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("ISLAND MAP / 岛屿地图", 42, 48);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(241,236,223,0.55)";
  ctx.font = "500 16px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("N ↑ / 100 × 100 m", size - 42, 48);

  return finish(c, 8);
}
