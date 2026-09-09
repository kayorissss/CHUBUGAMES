import type { FriendLook } from "./types";

export interface HeadOpts {
  mouth?: number; // 0 закрыт .. 1 широко открыт
  blink?: number; // 0 открыт .. 1 закрыт
  squish?: number; // 0..1 сжатие от удара
  angry?: number; // 0..1 краснота ярости
  tilt?: number; // радианы
  cheeks?: number; // 0..1 надутые щёки
  /** рисовать плечи/одежду под головой */
  body?: boolean;
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

function hexRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
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

  // Плечи и одежда
  if (o.body) drawBody(ctx, look, w, h, r);

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
    ctx.fillStyle = `rgba(220,60,40,${angry * 0.34})`;
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
    ctx.strokeStyle = "rgba(26,26,32,0.92)";
    ctx.lineWidth = Math.max(1.8, r * 0.05);
    [-1, 1].forEach((s) => {
      ctx.beginPath();
      if (look.glasses === 1) {
        ctx.arc(s * w * 0.4, eyeY, eyeR * 1.42, 0, Math.PI * 2);
      } else {
        // прямоугольные — заметно угловатее, лёгкое скругление
        ctx.roundRect(
          s * w * 0.4 - eyeR * 1.62, eyeY - eyeR * 1.16,
          eyeR * 3.24, eyeR * 2.32, eyeR * 0.18,
        );
      }
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
    const tx = -mw * 0.72, ty = my - mh * 0.86, tw = mw * 1.44, th = mh * 0.3;
    ctx.fillStyle = "#f6f6fa";
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, th * 0.32);
    ctx.fill();

    // Брекеты — металлические замочки с дугой
    if (look.braces) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, th, th * 0.32);
      ctx.clip();
      // дуга
      ctx.strokeStyle = "#c8ccd8";
      ctx.lineWidth = Math.max(1, th * 0.16);
      ctx.beginPath();
      ctx.moveTo(tx, ty + th * 0.52);
      ctx.lineTo(tx + tw, ty + th * 0.52);
      ctx.stroke();
      // замочки
      const n = 5;
      for (let i = 0; i < n; i++) {
        const bx = tx + tw * ((i + 0.5) / n);
        ctx.fillStyle = "#9aa2b4";
        ctx.beginPath();
        ctx.roundRect(bx - th * 0.2, ty + th * 0.24, th * 0.4, th * 0.56, th * 0.12);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.beginPath();
        ctx.roundRect(bx - th * 0.12, ty + th * 0.3, th * 0.16, th * 0.18, th * 0.06);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // Растительность на лице
  drawFacial(ctx, look, w, h, r, my, mh);

  ctx.restore();
}

/** Плечи, одежда, реквизит */
function drawBody(
  ctx: CanvasRenderingContext2D,
  look: FriendLook,
  w: number,
  h: number,
  r: number,
) {
  const shirt = look.shirt || "plain";
  const col = look.shirtColor || "#3a3a46";
  const topY = h * 1.02;
  const sw = w * 1.7;

  ctx.save();
  // корпус
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-sw, h * 2.2);
  ctx.quadraticCurveTo(-sw * 0.94, topY, -w * 0.34, topY);
  ctx.lineTo(w * 0.34, topY);
  ctx.quadraticCurveTo(sw * 0.94, topY, sw, h * 2.2);
  ctx.closePath();
  ctx.fill();

  if (shirt === "mesh") {
    // сетчатая рубашка — решётка поверх ткани
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-sw, h * 2.2);
    ctx.quadraticCurveTo(-sw * 0.94, topY, -w * 0.34, topY);
    ctx.lineTo(w * 0.34, topY);
    ctx.quadraticCurveTo(sw * 0.94, topY, sw, h * 2.2);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = "rgba(0,0,0,0.42)";
    ctx.lineWidth = Math.max(1, r * 0.035);
    const step = r * 0.19;
    for (let x = -sw; x <= sw; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, h * 2.2);
      ctx.stroke();
    }
    for (let y = topY; y <= h * 2.2; y += step) {
      ctx.beginPath();
      ctx.moveTo(-sw, y);
      ctx.lineTo(sw, y);
      ctx.stroke();
    }
    // тёмный ворот
    ctx.fillStyle = shade(col, -50);
    ctx.beginPath();
    ctx.ellipse(0, topY, w * 0.46, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (shirt === "suit") {
    // пиджак старосты: лацканы + галстук
    ctx.fillStyle = shade(col, -34);
    ctx.beginPath();
    ctx.moveTo(-w * 0.36, topY);
    ctx.lineTo(0, h * 1.9);
    ctx.lineTo(-w * 0.86, h * 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.36, topY);
    ctx.lineTo(0, h * 1.9);
    ctx.lineTo(w * 0.86, h * 2.2);
    ctx.closePath();
    ctx.fill();
    // рубашка
    ctx.fillStyle = "#eef0f6";
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, topY);
    ctx.lineTo(w * 0.3, topY);
    ctx.lineTo(0, h * 1.92);
    ctx.closePath();
    ctx.fill();
    // галстук
    ctx.fillStyle = "#c0392b";
    ctx.beginPath();
    ctx.moveTo(-w * 0.09, h * 1.12);
    ctx.lineTo(w * 0.09, h * 1.12);
    ctx.lineTo(w * 0.13, h * 1.86);
    ctx.lineTo(0, h * 2.02);
    ctx.lineTo(-w * 0.13, h * 1.86);
    ctx.closePath();
    ctx.fill();
  } else if (shirt === "hoodie") {
    ctx.fillStyle = shade(col, -40);
    ctx.beginPath();
    ctx.ellipse(0, topY + h * 0.1, w * 0.72, h * 0.3, 0, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = "#e8e8f0";
    ctx.lineWidth = Math.max(1.4, r * 0.04);
    ctx.beginPath();
    ctx.moveTo(-w * 0.14, h * 1.3);
    ctx.lineTo(-w * 0.1, h * 1.85);
    ctx.moveTo(w * 0.14, h * 1.3);
    ctx.lineTo(w * 0.1, h * 1.85);
    ctx.stroke();
  }

  // Кружка пива в руке
  if (look.prop === "beer") {
    const bx = w * 1.5, by = h * 1.42;
    const bw = r * 0.5, bh = r * 0.66;
    // ручка
    ctx.strokeStyle = "#d8dce8";
    ctx.lineWidth = Math.max(2, r * 0.075);
    ctx.beginPath();
    ctx.arc(bx + bw * 0.62, by + bh * 0.12, bh * 0.26, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
    // стекло
    ctx.fillStyle = "rgba(226,232,244,0.4)";
    ctx.beginPath();
    ctx.roundRect(bx - bw * 0.5, by - bh * 0.5, bw, bh, bw * 0.14);
    ctx.fill();
    // пиво
    ctx.fillStyle = "#e8a72c";
    ctx.beginPath();
    ctx.roundRect(bx - bw * 0.42, by - bh * 0.18, bw * 0.84, bh * 0.62, bw * 0.1);
    ctx.fill();
    // пена
    ctx.fillStyle = "#fbf7ee";
    ctx.beginPath();
    ctx.ellipse(bx, by - bh * 0.2, bw * 0.44, bh * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.beginPath();
    ctx.roundRect(bx - bw * 0.5, by - bh * 0.5, bw, bh, bw * 0.14);
    ctx.stroke();
  }

  // Планшет старосты
  if (look.prop === "clipboard") {
    const bx = w * 1.46, by = h * 1.5;
    const bw = r * 0.56, bh = r * 0.72;
    ctx.fillStyle = "#8a6a44";
    ctx.beginPath();
    ctx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, bw * 0.08);
    ctx.fill();
    ctx.fillStyle = "#f4f5fa";
    ctx.beginPath();
    ctx.roundRect(bx - bw * 0.42, by - bh * 0.38, bw * 0.84, bh * 0.78, bw * 0.05);
    ctx.fill();
    ctx.strokeStyle = "#9aa0b0";
    ctx.lineWidth = Math.max(1, r * 0.022);
    for (let i = 0; i < 4; i++) {
      const ly = by - bh * 0.24 + i * bh * 0.17;
      ctx.beginPath();
      ctx.moveTo(bx - bw * 0.32, ly);
      ctx.lineTo(bx + bw * 0.3, ly);
      ctx.stroke();
    }
    ctx.fillStyle = "#c8ccd8";
    ctx.beginPath();
    ctx.roundRect(bx - bw * 0.16, by - bh * 0.56, bw * 0.32, bh * 0.12, bw * 0.04);
    ctx.fill();
  }
  ctx.restore();
}

function drawFacial(
  ctx: CanvasRenderingContext2D,
  look: FriendLook,
  w: number,
  h: number,
  r: number,
  my: number,
  mh: number,
) {
  if (!look.facial) return;

  if (look.facial === 1) {
    // щетина
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = `rgba(${hexRgb(look.hair)},0.22)`;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.42, w * 0.6, h * 0.3, 0, 0, Math.PI);
    ctx.fill();
    ctx.restore();
  } else if (look.facial === 2) {
    // полная борода, обрезана по контуру лица
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.moveTo(-w * 0.68, h * 0.16);
    ctx.quadraticCurveTo(-w * 0.56, h * 0.92, 0, h * 0.9);
    ctx.quadraticCurveTo(w * 0.56, h * 0.92, w * 0.68, h * 0.16);
    ctx.quadraticCurveTo(w * 0.36, h * 0.52, 0, h * 0.5);
    ctx.quadraticCurveTo(-w * 0.36, h * 0.52, -w * 0.68, h * 0.16);
    ctx.fill();
    ctx.restore();
  } else if (look.facial === 3) {
    // усы
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.ellipse(0, my - mh - r * 0.1, w * 0.3, r * 0.085, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (look.facial === 4) {
    // Козлиная бородка: аккуратный квадратный клок строго на подбородке,
    // ниже рта — не перекрывает его и не расползается по щекам.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = look.hair;
    const gw = w * 0.26;
    const gy = my + mh + r * 0.1;
    ctx.beginPath();
    ctx.roundRect(-gw, gy, gw * 2, h * 0.34, [w * 0.03, w * 0.03, w * 0.12, w * 0.12]);
    ctx.fill();
    // тонкие бакенбарды-перемычки от уголков рта к бородке
    ctx.lineWidth = Math.max(1.4, r * 0.038);
    ctx.strokeStyle = look.hair;
    [-1, 1].forEach((sg) => {
      ctx.beginPath();
      ctx.moveTo(sg * gw * 0.95, gy + h * 0.04);
      ctx.quadraticCurveTo(sg * w * 0.42, my, sg * w * 0.34, my - mh - r * 0.04);
      ctx.stroke();
    });
    ctx.restore();
    // усы над верхней губой
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.ellipse(0, my - mh - r * 0.1, w * 0.3, r * 0.075, 0, 0, Math.PI * 2);
    ctx.fill();
  }
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

    case 4: {
      // Кудри «горой»: высокая пышная копна из крупных читаемых завитков.
      const base = -h * 0.36;
      const dark = shade(look.hair, -26);
      const lite = shade(look.hair, 34);

      // тёмная подложка-силуэт, чтобы копна имела массу
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.ellipse(0, base - h * 0.3, w * 1.2, h * 0.92, 0, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, base - h * 0.16, w * 1.18, h * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // крупные завитки: внешний контур копны
      const puffs: [number, number, number][] = [
        [-1.02, -0.16, 0.34], [-0.86, -0.62, 0.36], [-0.5, -0.92, 0.36],
        [0.0, -1.04, 0.38], [0.5, -0.92, 0.36], [0.86, -0.62, 0.36],
        [1.02, -0.16, 0.34],
        [-0.62, -0.3, 0.32], [0.0, -0.5, 0.34], [0.62, -0.3, 0.32],
      ];
      for (const [px, py, pr] of puffs) {
        ctx.fillStyle = look.hair;
        ctx.beginPath();
        ctx.arc(px * w, base + py * h, pr * w, 0, Math.PI * 2);
        ctx.fill();
      }
      // блик на каждом завитке — вот что даёт «кудрявость»
      for (const [px, py, pr] of puffs) {
        ctx.fillStyle = lite;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(px * w - pr * w * 0.26, base + py * h - pr * h * 0.3, pr * w * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // тени между завитками
      ctx.fillStyle = dark;
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 6; i++) {
        const a = Math.PI + ((i + 0.5) / 6) * Math.PI;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * w * 0.72, base + Math.sin(a) * h * 0.58, w * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = look.hair;
      break;
    }

    case 5: // кепка
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.5, w * 1.0, h * 0.55, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.34)";
      ctx.beginPath();
      ctx.ellipse(-w * 0.2, -h * 0.48, w * 1.24, h * 0.15, 0.12, Math.PI, 0);
      ctx.fill();
      break;

    case 6: {
      // Ёжик-разнобой: встал в 6 утра, торчит во все стороны
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.48, w * 0.98, h * 0.56, 0, Math.PI, 0);
      ctx.fill();
      // хаотичные пряди, детерминированные по позиции
      const spikes = 16;
      for (let i = 0; i < spikes; i++) {
        const t = i / (spikes - 1);
        const a = Math.PI + t * Math.PI;
        const bx = Math.cos(a) * w * 0.9;
        const by = Math.sin(a) * h * 0.62 - h * 0.16;
        // псевдослучайные, но стабильные значения
        const j1 = Math.sin(i * 12.9898) * 43758.5453;
        const j2 = Math.sin(i * 78.233) * 12345.678;
        const len = h * (0.3 + (j1 - Math.floor(j1)) * 0.42);
        const lean = (j2 - Math.floor(j2) - 0.5) * w * 0.5;
        const wdt = w * (0.07 + (j1 - Math.floor(j1)) * 0.05);
        ctx.beginPath();
        ctx.moveTo(bx - wdt, by);
        ctx.quadraticCurveTo(bx + lean * 0.5, by - len * 0.7, bx + lean, by - len);
        ctx.quadraticCurveTo(bx + lean * 0.4, by - len * 0.5, bx + wdt, by);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    case 7: {
      // Длинные волосы: спадают ниже плеч по бокам
      ctx.beginPath();
      ctx.moveTo(-w * 1.06, -h * 0.1);
      ctx.quadraticCurveTo(-w * 1.14, -h * 1.06, 0, -h * 1.12);
      ctx.quadraticCurveTo(w * 1.14, -h * 1.06, w * 1.06, -h * 0.1);
      ctx.lineTo(w * 1.06, h * 1.24);
      ctx.quadraticCurveTo(w * 0.84, h * 1.36, w * 0.72, h * 0.9);
      ctx.quadraticCurveTo(w * 0.96, h * 0.2, w * 0.86, -h * 0.3);
      ctx.quadraticCurveTo(0, -h * 0.86, -w * 0.86, -h * 0.3);
      ctx.quadraticCurveTo(-w * 0.96, h * 0.2, -w * 0.72, h * 0.9);
      ctx.quadraticCurveTo(-w * 0.84, h * 1.36, -w * 1.06, h * 1.24);
      ctx.closePath();
      ctx.fill();
      // пробор
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, w * 0.03);
      ctx.beginPath();
      ctx.moveTo(-w * 0.1, -h * 1.02);
      ctx.quadraticCurveTo(-w * 0.5, -h * 0.7, -w * 0.82, -h * 0.24);
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 8: {
      // Штрихкод: жёсткие прямые пряди разной ширины, как полосы кода
      const light = shade(look.hair, 62);
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.44, w * 1.0, h * 0.62, 0, Math.PI, 0);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.44, w * 1.0, h * 0.62, 0, Math.PI, 0);
      ctx.clip();
      // чёрные штрихи поверх светлой подложки
      ctx.fillStyle = look.hair;
      const widths = [0.9, 0.35, 1.4, 0.5, 0.35, 1.1, 0.7, 1.5, 0.4, 0.9, 0.35, 1.2, 0.6];
      let x = -w * 1.02;
      for (let i = 0; i < widths.length; i++) {
        const bw = widths[i] * w * 0.075;
        ctx.fillRect(x, -h * 1.16, bw, h * 0.86);
        x += bw + w * 0.052;
        if (x > w) break;
      }
      ctx.restore();

      // ровная плотная чёлка
      ctx.fillStyle = look.hair;
      ctx.beginPath();
      ctx.roundRect(-w * 0.99, -h * 0.58, w * 1.98, h * 0.19, w * 0.025);
      ctx.fill();
      break;
    }

    case 9: {
      // Очень короткая стрижка почти под машинку: плотно по черепу
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.6, w * 0.93, h * 0.44, 0, Math.PI, 0);
      ctx.fill();
      // тонкая кромка у лба
      ctx.beginPath();
      ctx.roundRect(-w * 0.93, -h * 0.64, w * 1.86, h * 0.13, w * 0.04);
      ctx.fill();
      // виски темнее
      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = "#000000";
      [-1, 1].forEach((s) => {
        ctx.beginPath();
        ctx.ellipse(s * w * 0.82, -h * 0.34, w * 0.16, h * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
      break;
    }
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
