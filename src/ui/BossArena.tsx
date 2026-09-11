import { useRef } from "react";
import { useCanvas } from "../games/shell";
import { drawHead } from "../core/head";
import { scene, alpha } from "../core/palette";
import type { FriendLook } from "../core/types";

/**
 * АРЕНА БОЯ С БОССОМ.
 *
 * Раньше бой выглядел так: висящая в воздухе голова босса и две кнопки.
 * Никакой драки на экране не происходило — только цифры в полосках.
 * Пользователь: «бой с боссом можно и получше, детальней интереснее и с
 * анимациями, а то чо просто тыкать кнопку».
 *
 * Здесь рисуется настоящая сцена: два бойца ЦЕЛИКОМ (голова, торс, руки
 * с локтями, ноги), которые дышат, шагают, бьют, закрываются в блок,
 * отлетают от ударов и падают. Плюс пыль, искры удара, цифры урона,
 * тряска экрана и телеграф замаха.
 *
 * Состояние приходит снаружи через мутабельный объект (ArenaFx), а не
 * через пропсы: перерисовка идёт 60 раз в секунду, и гонять её через
 * React-состояние на слабом телефоне нельзя.
 */

export interface ArenaFx {
  /** 0..1 доля здоровья */
  bossHp: number;
  myHp: number;
  /** босс замахнулся — идёт телеграф */
  windup: boolean;
  /** игрок держит блок */
  blocking: boolean;
  /** блок совпал с ударом — парирование */
  perfect: number;
  /** босс в ярости */
  rage: boolean;
  /** газовая атака Данила */
  fog: boolean;
  /** босс оглушён, мс */
  stun: number;
  /** бой окончен: "win" | "lose" | null */
  over: "win" | "lose" | null;

  /* ——— события, которые арена проигрывает и обнуляет сама ——— */
  /** игрок бьёт: счётчик увеличивается снаружи */
  punchSeq: number;
  /** босс бьёт */
  bossSeq: number;
  /** очередь всплывающих цифр */
  pops: Array<{ x: number; y: number; t: number; txt: string; col: string; up: number }>;
  /** частицы */
  parts: Array<{
    x: number; y: number; vx: number; vy: number;
    life: number; max: number; r: number; col: string;
  }>;
  /** сила тряски */
  shake: number;
}

export function freshFx(): ArenaFx {
  return {
    bossHp: 1, myHp: 1,
    windup: false, blocking: false, perfect: 0,
    rage: false, fog: false, stun: 0, over: null,
    punchSeq: 0, bossSeq: 0,
    pops: [], parts: [], shake: 0,
  };
}

/** Поза бойца на текущем кадре */
interface Pose {
  /** 0..1 вынос кулака вперёд */
  punch: number;
  /** 0..1 руки подняты в защиту */
  guard: number;
  /** 0..1 отлетел от удара */
  recoil: number;
  /** качание дыхания */
  breathe: number;
  /** 0..1 оглушён — шатается */
  stun: number;
  /** 0..1 повержен — лежит */
  down: number;
}

/**
 * Боец целиком: голова, шея, торс, руки с локтями, ноги.
 *
 * Рисуем от точки на полу (gx, gy), чтобы ноги всегда стояли на земле,
 * а не висели. `face` = 1 смотрит вправо, -1 влево.
 */
function drawFighter(
  ctx: CanvasRenderingContext2D,
  look: FriendLook,
  gx: number,
  gy: number,
  scale: number,
  face: 1 | -1,
  pose: Pose,
  tint: string | null,
) {
  const S = scale;
  const headR = 15 * S;
  // высота фигуры от пола
  const hipY = gy - 46 * S;
  const shY = gy - 84 * S;
  const neckY = shY - 4 * S;
  const headY = neckY - headR * 0.9;

  ctx.save();

  // повержен — валимся набок
  if (pose.down > 0) {
    ctx.translate(gx, gy);
    ctx.rotate(face * pose.down * 1.35);
    ctx.translate(-gx, -gy + pose.down * 14 * S);
  }

  // отлёт от удара + дыхание
  const dx = -face * pose.recoil * 13 * S + Math.sin(pose.stun * 20) * pose.stun * 4 * S;
  const dy = Math.sin(pose.breathe) * 1.8 * S;
  ctx.translate(dx, dy);

  const cx = gx;
  const skin = look.skin || "#e8b98f";
  const shirt = look.shirtColor || "#3a4152";
  const pants = "#2b3040";

  // ——— тень под ногами ———
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.beginPath();
  ctx.ellipse(cx, gy + 2, 26 * S, 5.5 * S, 0, 0, Math.PI * 2);
  ctx.fill();

  // ——— ноги ———
  const stance = 13 * S;
  ctx.strokeStyle = pants;
  ctx.lineWidth = 10 * S;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // задняя нога
  ctx.beginPath();
  ctx.moveTo(cx - face * 4 * S, hipY);
  ctx.lineTo(cx - face * stance, gy - 20 * S);
  ctx.lineTo(cx - face * (stance + 3 * S), gy);
  ctx.stroke();
  // передняя нога
  ctx.beginPath();
  ctx.moveTo(cx + face * 3 * S, hipY);
  ctx.lineTo(cx + face * (stance * 0.8), gy - 20 * S);
  ctx.lineTo(cx + face * (stance * 0.9 + 3 * S), gy);
  ctx.stroke();
  // стопы
  ctx.fillStyle = "#1c1f2a";
  ctx.beginPath();
  ctx.ellipse(cx - face * (stance + 4 * S), gy, 7 * S, 3 * S, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + face * (stance * 0.9 + 4 * S), gy, 7 * S, 3 * S, 0, 0, Math.PI * 2);
  ctx.fill();

  // ——— торс ———
  const torsoW = 21 * S;
  const hipW = 16 * S;
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.moveTo(cx - torsoW, shY + 2 * S);
  ctx.quadraticCurveTo(cx, shY - 3 * S, cx + torsoW, shY + 2 * S);
  ctx.lineTo(cx + hipW, hipY);
  ctx.quadraticCurveTo(cx, hipY + 4 * S, cx - hipW, hipY);
  ctx.closePath();
  ctx.fill();
  // подсветка объёма
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.beginPath();
  ctx.ellipse(cx + face * torsoW * 0.45, (shY + hipY) / 2, torsoW * 0.4, (hipY - shY) * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // ——— руки ———
  // Локоть считаем явно: плечо толще, предплечье тоньше — рука читается
  // как рука, а не как палка.
  const armUp = 7.5 * S;
  const armLo = 6 * S;

  const drawArm = (side: 1 | -1) => {
    const shx = cx + side * torsoW * 0.85;
    const shy = shY + 6 * S;
    let ex: number, ey: number, hx: number, hy: number;

    const front = side === face;
    if (pose.punch > 0.02 && front) {
      // бьющая рука вылетает вперёд
      const p = pose.punch;
      ex = shx + face * (14 + 12 * p) * S;
      ey = shy + (6 - 4 * p) * S;
      hx = shx + face * (20 + 34 * p) * S;
      hy = shy + (4 - 6 * p) * S;
    } else if (pose.guard > 0.02) {
      // блок: обе руки к лицу
      const g = pose.guard;
      ex = shx + side * (10 - 3 * g) * S;
      ey = shy + (12 - 6 * g) * S;
      hx = cx + side * (9 + 2 * g) * S;
      hy = shy - (6 + 8 * g) * S;
    } else {
      // стойка
      ex = shx + side * 10 * S;
      ey = shy + 14 * S;
      hx = shx + side * 6 * S + face * 6 * S;
      hy = shy + 26 * S;
    }

    ctx.strokeStyle = shirt;
    ctx.lineWidth = armUp;
    ctx.beginPath();
    ctx.moveTo(shx, shy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    ctx.strokeStyle = skin;
    ctx.lineWidth = armLo;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    // кулак
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(hx, hy, 5.2 * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 1 * S;
    ctx.stroke();
    return { hx, hy };
  };

  // дальняя рука за телом
  drawArm(-face as 1 | -1);

  // ——— шея и голова ———
  ctx.fillStyle = skin;
  ctx.fillRect(cx - 3.5 * S, neckY - 2 * S, 7 * S, 8 * S);

  drawHead(ctx, look, cx + face * pose.punch * 4 * S, headY, headR, {
    body: false,
    angry: pose.stun > 0 ? 0.2 : 0.55,
    mouth: pose.punch > 0.4 ? 0.7 : pose.recoil > 0.2 ? 0.9 : 0.15,
    squish: pose.recoil * 0.35,
    tilt: face * (pose.punch * 0.16 - pose.recoil * 0.2) + pose.stun * Math.sin(pose.stun * 18) * 0.25,
  });

  // ближняя рука поверх тела
  const fist = drawArm(face);

  // ——— эффекты состояния ———
  if (tint) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = tint;
    ctx.fillRect(cx - 60 * S, headY - headR * 2, 120 * S, gy - headY + headR * 2 + 10);
    ctx.globalCompositeOperation = "source-over";
  }

  // звёздочки над оглушённым
  if (pose.stun > 0.05) {
    const t = Date.now() * 0.006;
    for (let i = 0; i < 3; i++) {
      const a = t + (i * Math.PI * 2) / 3;
      const sx = cx + Math.cos(a) * 17 * S;
      const sy = headY - headR * 1.5 + Math.sin(a) * 5 * S;
      ctx.fillStyle = "#ffd34a";
      ctx.beginPath();
      ctx.arc(sx, sy, 2.6 * S, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
  return fist;
}

export default function BossArena({
  fx, bossLook, heroLook, height = 260,
}: {
  fx: React.MutableRefObject<ArenaFx>;
  bossLook: FriendLook;
  heroLook: FriendLook;
  height?: number;
}) {
  // локальные, сглаженные во времени величины поз
  const A = useRef({
    heroPunch: 0, heroGuard: 0, heroRecoil: 0,
    bossPunch: 0, bossRecoil: 0, bossWind: 0,
    breathe: 0, lastPunch: 0, lastBoss: 0,
    heroDown: 0, bossDown: 0,
    flash: 0, flashCol: "#fff",
  });

  const ref = useCanvas((ctx, w, h, dt) => {
    const P = scene();
    const a = A.current;
    const f = fx.current;
    const k = 1 - Math.pow(0.0015, dt / 1000);

    a.breathe += dt * 0.0035;

    /* ——— реакция на события ——— */
    if (f.punchSeq !== a.lastPunch) {
      a.lastPunch = f.punchSeq;
      a.heroPunch = 1;
    }
    if (f.bossSeq !== a.lastBoss) {
      a.lastBoss = f.bossSeq;
      a.bossPunch = 1;
    }

    // затухания
    a.heroPunch = Math.max(0, a.heroPunch - dt * 0.0055);
    a.bossPunch = Math.max(0, a.bossPunch - dt * 0.0045);
    a.heroRecoil = Math.max(0, a.heroRecoil - dt * 0.004);
    a.bossRecoil = Math.max(0, a.bossRecoil - dt * 0.005);
    a.flash = Math.max(0, a.flash - dt * 0.004);
    a.heroGuard += ((f.blocking ? 1 : 0) - a.heroGuard) * k;
    a.bossWind += ((f.windup ? 1 : 0) - a.bossWind) * k;
    a.heroDown += ((f.over === "lose" ? 1 : 0) - a.heroDown) * (k * 0.5);
    a.bossDown += ((f.over === "win" ? 1 : 0) - a.bossDown) * (k * 0.5);
    if (f.shake > 0) f.shake = Math.max(0, f.shake - dt * 0.03);
    if (f.stun > 0) f.stun = Math.max(0, f.stun - dt);
    if (f.perfect > 0) f.perfect = Math.max(0, f.perfect - dt);

    /* ——— фон арены: коридор общаги ——— */
    const groundY = h - 26;
    const g0 = ctx.createLinearGradient(0, 0, 0, h);
    g0.addColorStop(0, P.bg0);
    g0.addColorStop(0.62, P.bg1);
    g0.addColorStop(1, P.bg2);
    ctx.fillStyle = g0;
    ctx.fillRect(0, 0, w, h);

    // задняя стена с дверями
    ctx.fillStyle = alpha("text", 0.04, "rgba(255,255,255,0.04)");
    for (let i = 0; i < 4; i++) {
      const dxw = 14 + i * (w - 28) / 4;
      ctx.fillRect(dxw, groundY - 74, 30, 74);
    }
    // лампы
    for (let i = 0; i < 3; i++) {
      const lx = (w / 3) * (i + 0.5);
      const lg = ctx.createRadialGradient(lx, 8, 2, lx, 8, 54);
      lg.addColorStop(0, alpha("gold", 0.2, "rgba(255,200,80,0.2)"));
      lg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(lx, 8, 54, 0, Math.PI * 2);
      ctx.fill();
    }

    // пол
    ctx.fillStyle = alpha("text", 0.07, "rgba(255,255,255,0.07)");
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.strokeStyle = alpha("text", 0.13, "rgba(255,255,255,0.13)");
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();

    /* ——— тряска ——— */
    ctx.save();
    if (f.shake > 0) {
      ctx.translate((Math.random() - 0.5) * f.shake, (Math.random() - 0.5) * f.shake);
    }

    /* ——— бойцы ——— */
    const S = Math.min(1.15, w / 320);
    const heroX = w * 0.28;
    const bossX = w * 0.72;

    // босс крупнее игрока — он и должен пугать
    const bossPose: Pose = {
      punch: a.bossPunch,
      guard: 0,
      recoil: a.bossRecoil,
      breathe: a.breathe * 0.9,
      stun: f.stun > 0 ? Math.min(1, f.stun / 400) : 0,
      down: a.bossDown,
    };
    const heroPose: Pose = {
      punch: a.heroPunch,
      guard: a.heroGuard,
      recoil: a.heroRecoil,
      breathe: a.breathe,
      stun: 0,
      down: a.heroDown,
    };

    drawFighter(ctx, heroLook, heroX, groundY, S, 1, heroPose, null);
    drawFighter(
      ctx, bossLook, bossX, groundY, S * 1.22, -1, bossPose,
      f.rage ? "rgba(255,60,40,0.22)" : null,
    );

    /* ——— телеграф замаха ——— */
    if (a.bossWind > 0.02) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.02);
      ctx.strokeStyle = `rgba(255,90,60,${0.5 * a.bossWind + 0.3 * pulse * a.bossWind})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bossX, groundY - 56 * S, (34 + pulse * 8) * S, 0, Math.PI * 2);
      ctx.stroke();
      // стрелка в сторону игрока
      ctx.fillStyle = `rgba(255,90,60,${0.8 * a.bossWind})`;
      const ax = bossX - 46 * S - pulse * 6;
      ctx.beginPath();
      ctx.moveTo(ax, groundY - 58 * S);
      ctx.lineTo(ax + 12, groundY - 66 * S);
      ctx.lineTo(ax + 12, groundY - 50 * S);
      ctx.closePath();
      ctx.fill();
    }

    /* ——— вспышка парирования ——— */
    if (f.perfect > 0) {
      const p = f.perfect / 500;
      ctx.strokeStyle = `rgba(120,255,190,${p})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(heroX, groundY - 60 * S, (30 + (1 - p) * 34) * S, 0, Math.PI * 2);
      ctx.stroke();
    }

    /* ——— газ ——— */
    if (f.fog) {
      const t = Date.now() * 0.001;
      for (let i = 0; i < 5; i++) {
        const fxp = bossX - 30 + Math.sin(t + i) * 40;
        const fyp = groundY - 40 - ((t * 18 + i * 30) % 90);
        const rr = 22 + i * 5;
        const fg = ctx.createRadialGradient(fxp, fyp, 1, fxp, fyp, rr);
        fg.addColorStop(0, "rgba(150,210,110,0.3)");
        fg.addColorStop(1, "rgba(120,180,90,0)");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(fxp, fyp, rr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* ——— частицы ——— */
    for (const p of f.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += dt * 0.0016;
    }
    f.parts = f.parts.filter((p) => p.life > 0);
    for (const p of f.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* ——— цифры урона ——— */
    for (const p of f.pops) p.t -= dt;
    f.pops = f.pops.filter((p) => p.t > 0);
    ctx.textAlign = "center";
    for (const p of f.pops) {
      const k2 = 1 - p.t / 900;
      ctx.globalAlpha = Math.min(1, p.t / 320);
      ctx.font = `800 ${Math.round(15 + (1 - k2) * 5)}px Unbounded, Inter, system-ui, sans-serif`;
      ctx.fillStyle = p.col;
      ctx.fillText(p.txt, p.x, p.y - k2 * p.up);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    /* ——— полноэкранная вспышка удара ——— */
    if (a.flash > 0) {
      ctx.fillStyle = a.flashCol;
      ctx.globalAlpha = a.flash * 0.3;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }, [bossLook, heroLook]);

  return (
    <canvas
      ref={ref}
      style={{
        width: "100%", height, display: "block",
        borderRadius: "var(--r-xl)",
        border: "1px solid var(--surface-brd)",
      }}
    />
  );
}

/** Хелперы, которыми экран боя наполняет арену эффектами */
export const arenaFx = {
  pop(f: ArenaFx, x: number, y: number, txt: string, col: string, up = 42) {
    f.pops.push({ x, y, t: 900, txt, col, up });
  },
  burst(f: ArenaFx, x: number, y: number, col: string, n = 10, power = 0.18) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = power * (0.4 + Math.random());
      f.parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 0.05,
        life: 380 + Math.random() * 320,
        max: 700,
        r: 1.6 + Math.random() * 2.6,
        col,
      });
    }
  },
};
