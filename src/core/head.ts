import type { FriendLook } from "./types";

export interface HeadOpts {
  mouth?: number; // 0 закрыт .. 1 широко открыт
  blink?: number; // 0 открыт .. 1 закрыт
  squish?: number; // 0..1 сжатие от удара
  angry?: number; // 0..1 краснота ярости
  tilt?: number; // радианы
  cheeks?: number; // 0..1 надутые щёки
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + amt)));
  g = Math.max(0, Math.min(255, Math.round(g + amt)));
  b = Math.max(0, Math.min(255, Math.round(b + amt)));
  return `rgb(${r},${g},${b})`;
}

/**
 * Рисует процедурную голову друга в canvas.
 * (cx, cy) — центр, r — базовый радиус.
 */
export function drawHead(
  ctx: CanvasRenderingContext2D,
  look: FriendLook,
  cx: number,
  cy: number,
  r: number,
  o: HeadOpts = {},
) {
  const mouth = o.mouth ?? 0;
  const blink = o.blink ?? 0;
  const squish = o.squish ?? 0;
  const angry = o.angry ?? 0;
  const cheeks = o.cheeks ?? 0;

  ctx.save();
  ctx.translate(cx, cy);
  if (o.tilt) ctx.rotate(o.tilt);
  ctx.scale(1 + squish * 0.13, 1 - squish * 0.13);

  const w = r * look.wide * (1 + cheeks * 0.06);
  const h = r * (1.06 - cheeks * 0.02);

  // Шея
  ctx.fillStyle = shade(look.skin, -34);
  ctx.beginPath();
  ctx.roundRect(-w * 0.28, h * 0.62, w * 0.56, h * 0.55, w * 0.16);
  ctx.fill();

  // Лицо
  const grad = ctx.createLinearGradient(0, -h, 0, h);
  grad.addColorStop(0, shade(look.skin, 22 + angry * 26));
  grad.addColorStop(0.55, look.skin);
  grad.addColorStop(1, shade(look.skin, -30 + angry * 20));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  ctx.fill();

  if (angry > 0.02) {
    ctx.fillStyle = `rgba(220,60,40,${angry * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.1, w * 0.98, h * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Уши
  ctx.fillStyle = shade(look.skin, -14);
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.ellipse(s * w * 0.98, h * 0.06, w * 0.13, h * 0.19, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Щёки (надутые)
  if (cheeks > 0.05) {
    ctx.fillStyle = `rgba(226,110,90,${0.16 + cheeks * 0.24})`;
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      ctx.ellipse(s * w * 0.58, h * 0.26, w * 0.26 * (0.7 + cheeks * 0.6), h * 0.2 * (0.7 + cheeks * 0.6), 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Волосы
  drawHair(ctx, look, w, h);

  // Брови
  const browY = -h * 0.3;
  ctx.strokeStyle = shade(look.hair, -18);
  ctx.lineWidth = Math.max(2, r * 0.075);
  ctx.lineCap = "round";
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    const x0 = s * w * 0.22;
    const x1 = s * w * 0.62;
    let y0 = browY,
      y1 = browY;
    if (look.brow === 1 || angry > 0.3) {
      y0 = browY + h * 0.09;
      y1 = browY - h * 0.03;
    } else if (look.brow === 2) {
      y0 = browY - h * 0.06;
      y1 = browY + h * 0.02;
    }
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, y1 - h * 0.05, x1, y1);
    ctx.stroke();
  });

  // Глаза
  const eyeY = -h * 0.1;
  const eyeR = r * 0.16;
  [-1, 1].forEach((s) => {
    const ex = s * w * 0.4;
    ctx.fillStyle = "#fbfbfd";
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, eyeR * 1.1, eyeR * (1 - blink * 0.92), 0, 0, Math.PI * 2);
    ctx.fill();
    if (blink < 0.6) {
      ctx.fillStyle = look.eyes;
      ctx.beginPath();
      ctx.arc(ex + s * eyeR * 0.12, eyeY + eyeR * 0.08, eyeR * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0b0b0e";
      ctx.beginPath();
      ctx.arc(ex + s * eyeR * 0.12, eyeY + eyeR * 0.08, eyeR * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(ex - eyeR * 0.2, eyeY - eyeR * 0.26, eyeR * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Очки
  if (look.glasses > 0) {
    ctx.strokeStyle = "rgba(30,30,38,0.9)";
    ctx.lineWidth = Math.max(1.6, r * 0.045);
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      if (look.glasses === 1) ctx.arc(s * w * 0.4, eyeY, eyeR * 1.42, 0, Math.PI * 2);
      else ctx.roundRect(s * w * 0.4 - eyeR * 1.5, eyeY - eyeR * 1.1, eyeR * 3, eyeR * 2.2, eyeR * 0.4);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(-w * 0.4 + eyeR * 1.45, eyeY);
    ctx.lineTo(w * 0.4 - eyeR * 1.45, eyeY);
    ctx.stroke();
  }

  // Нос
  ctx.strokeStyle = shade(look.skin, -52);
  ctx.lineWidth = Math.max(2, r * 0.055);
  ctx.beginPath();
  ctx.moveTo(0, eyeY + h * 0.1);
  ctx.quadraticCurveTo(w * 0.1, h * 0.18, -w * 0.03, h * 0.22);
  ctx.stroke();

  // Рот
  const my = h * 0.44;
  const mw = w * (0.34 + mouth * 0.22);
  const mh = r * (0.05 + mouth * 0.55);
  ctx.fillStyle = "#2a0c10";
  ctx.beginPath();
  ctx.ellipse(0, my + mh * 0.2, mw, mh, 0, 0, Math.PI * 2);
  ctx.fill();
  if (mouth > 0.25) {
    ctx.fillStyle = "#d9556a";
    ctx.beginPath();
    ctx.ellipse(0, my + mh * 0.6, mw * 0.5, mh * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    // зубы
    ctx.fillStyle = "#f6f6fa";
    ctx.beginPath();
    ctx.roundRect(-mw * 0.72, my - mh * 0.86, mw * 1.44, mh * 0.3, mh * 0.1);
    ctx.fill();
  }

  // Растительность на лице
  if (look.facial === 1) {
    ctx.fillStyle = `rgba(${hexRgb(look.hair)},0.25)`;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.46, w * 0.7, h * 0.42, 0, 0, Math.PI);
    ctx.fill();
  } else if (look.facial === 2) {
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.moveTo(-w * 0.76, h * 0.14);
    ctx.quadraticCurveTo(-w * 0.6, h * 1.18, 0, h * 1.02);
    ctx.quadraticCurveTo(w * 0.6, h * 1.18, w * 0.76, h * 0.14);
    ctx.quadraticCurveTo(w * 0.4, h * 0.6, 0, h * 0.56);
    ctx.quadraticCurveTo(-w * 0.4, h * 0.6, -w * 0.76, h * 0.14);
    ctx.fill();
  } else if (look.facial === 3) {
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.ellipse(0, my - mh - r * 0.11, w * 0.34, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function hexRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function drawHair(ctx: CanvasRenderingContext2D, look: FriendLook, w: number, h: number) {
  ctx.fillStyle = look.hair;
  switch (look.hairStyle) {
    case 0:
      break;
    case 1: // короткие
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.52, w * 0.96, h * 0.52, 0, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(-w * 0.96, -h * 0.58, w * 1.92, h * 0.2, w * 0.1);
      ctx.fill();
      break;
    case 2: // шапка волос
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.42, w * 1.03, h * 0.72, 0, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-w * 1.0, -h * 0.36);
      ctx.quadraticCurveTo(-w * 0.5, -h * 0.06, w * 0.1, -h * 0.32);
      ctx.quadraticCurveTo(w * 0.6, -h * 0.02, w * 1.0, -h * 0.36);
      ctx.lineTo(w * 1.0, -h * 0.6);
      ctx.lineTo(-w * 1.0, -h * 0.6);
      ctx.fill();
      break;
    case 3: // ирокез
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.5, w * 0.95, h * 0.4, 0, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-w * 0.16, -h * 0.72);
      ctx.quadraticCurveTo(0, -h * 1.62, w * 0.16, -h * 0.72);
      ctx.fill();
      break;
    case 4: // кудри
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * w * 0.88, Math.sin(a) * h * 0.82 - h * 0.06, w * 0.24, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 5: // кепка
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.5, w * 1.0, h * 0.55, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.34)";
      ctx.beginPath();
      ctx.ellipse(-w * 0.2, -h * 0.48, w * 1.24, h * 0.15, 0.12, Math.PI, 0);
      ctx.fill();
      break;
  }
}

/** Быстрое превью головы в offscreen-canvas → dataURL (для UI-списков) */
export function headToDataURL(look: FriendLook, size = 120): string {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  drawHead(ctx, look, size / 2, size * 0.52, size * 0.36);
  return c.toDataURL();
}
