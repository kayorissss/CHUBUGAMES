import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { useCanvas, GameHUD, GameOver, HudStat } from "./shell";
import GameIntro, { IntroGroup, IntroOption, IntroRules } from "../ui/GameIntro";
import { tr } from "../core/i18n";
import { isLowFx } from "../core/perf";
import {
  judge, legalBalls, lowestOnTable, pickShot, rackNumbers, BLACK,
  type BallInfo, type Group, type PoolMode, type ShotResult, type Side,
} from "../core/pool";

/**
 * БИЛЬЯРД В ПОДВАЛЕ — по официальным правилам.
 *
 * Три режима:
 *   - один: тренировка, забивай на время без соперника;
 *   - против бота: он реально целится и бьёт;
 *   - с другом: по очереди на одном телефоне.
 *
 * Два свода правил: американка (9 шаров) и восьмёрка (8 ball). Правила
 * вынесены в src/core/pool.ts и покрыты тестами — фолы, назначение
 * групп, победа и поражение на чёрном.
 *
 * Управление: тянешь от битка назад, показывается линия прицела с
 * отражением от борта и точкой контакта. Отпустил — удар.
 */

const R = 11;
const FRICTION = 0.9985;
const STOP_V = 0.02;
const POCKET_R = 20;
const SOLO_SHOTS = 14;

type Mode = "solo" | "bot" | "duo";

interface Ball {
  num: number;
  x: number; y: number;
  vx: number; vy: number;
  in?: boolean;
}

/** Цвета шаров как в настоящем наборе */
const BALL_COLOR: Record<number, string> = {
  1: "#ffd23f", 2: "#2f6fd0", 3: "#e03a3a", 4: "#7d4fc4", 5: "#ef8c2a",
  6: "#2f9e5e", 7: "#8d3b30", 8: "#1a1a1e", 9: "#ffd23f", 10: "#2f6fd0",
  11: "#e03a3a", 12: "#7d4fc4", 13: "#ef8c2a", 14: "#2f9e5e", 15: "#8d3b30",
};

export default function Pool({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"menu" | "play" | "over">("menu");
  const [mode, setMode] = useState<Mode>("bot");
  const [rules, setRules] = useState<PoolMode>("nine");

  const [score, setScore] = useState(0);
  const [shots, setShots] = useState(SOLO_SHOTS);
  const [turn, setTurn] = useState<Side>("me");
  const [myGroup, setMyGroup] = useState<Group>(null);
  const [, setFoeGroup] = useState<Group>(null);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });
  const [title, setTitle] = useState("");
  const [sub, setSub] = useState("");
  const [thinking, setThinking] = useState(false);

  const best = s.games.pool?.best || 0;
  const low = isLowFx();

  const G = useRef({
    balls: [] as Ball[],
    running: false,
    moving: false,
    aiming: false,
    ax: 0, ay: 0,
    score: 0,
    shots: SOLO_SHOTS,
    turn: "me" as Side,
    myGroup: null as Group,
    foeGroup: null as Group,
    startT: 0,
    pops: [] as { x: number; y: number; t: number; txt: string; col: string }[],
    shake: 0,
    w: 0, h: 0,
    pad: 0, top: 0, bot: 0,
    // что произошло за текущий удар
    firstHit: 0,
    potted: [] as number[],
    cuePotted: false,
    railHit: false,
    ballInHand: false,
    botTimer: 0,
  });

  const cueBall = () => G.current.balls.find((b) => b.num === 0);

  /** Расставить шары: треугольник для восьмёрки, ромб для американки */
  const setupRack = useCallback((w: number, h: number, m: PoolMode) => {
    const g = G.current;
    g.pad = 18;
    g.top = h * 0.16;
    g.bot = h - 96;
    const nums = rackNumbers(m);
    const balls: Ball[] = [{ num: 0, x: w / 2, y: g.bot - 70, vx: 0, vy: 0 }];
    const cy = g.top + 78;

    if (m === "nine") {
      // ромб: 1 сверху, 9 в центре
      const order = [1, 2, 3, 4, 9, 5, 6, 7, 8];
      const spots: [number, number][] = [
        [0, -2], [-1, -1], [1, -1], [-2, 0], [0, 0], [2, 0], [-1, 1], [1, 1], [0, 2],
      ];
      order.forEach((n, i) => {
        const [sx, sy] = spots[i];
        balls.push({
          num: n, vx: 0, vy: 0,
          x: w / 2 + sx * (R * 1.06), y: cy + sy * (R * 1.86),
        });
      });
    } else {
      // треугольник, восьмёрка в середине
      const rest = nums.filter((n) => n !== BLACK);
      // перемешиваем, но чёрный ставим в центр (позиция 4)
      const shuffled = rest.slice().sort(() => Math.random() - 0.5);
      const seq: number[] = [];
      let k = 0;
      for (let i = 0; i < 15; i++) seq.push(i === 4 ? BLACK : shuffled[k++]);
      let idx = 0;
      for (let row = 0; row < 5; row++) {
        for (let i = 0; i <= row; i++) {
          balls.push({
            num: seq[idx++], vx: 0, vy: 0,
            x: w / 2 + (i - row / 2) * (R * 2.08),
            y: cy + row * (R * 1.84),
          });
        }
      }
    }
    g.balls = balls;
  }, []);

  const start = useCallback((m: Mode, rl: PoolMode) => {
    const g = G.current;
    setMode(m); setRules(rl);
    g.score = 0; g.shots = SOLO_SHOTS; g.turn = "me";
    g.myGroup = null; g.foeGroup = null;
    g.pops = []; g.shake = 0; g.moving = false; g.aiming = false;
    g.ballInHand = false;
    g.startT = Date.now();
    g.running = true;
    setScore(0); setShots(SOLO_SHOTS); setTurn("me");
    setMyGroup(null); setFoeGroup(null); setMsg("");
    setPhase("play");
    if (g.w) setupRack(g.w, g.h, rl);
    sfx.power?.();
  }, [setupRack]);

  const end = useCallback((won: boolean | null, why: string) => {
    const g = G.current;
    if (!g.running) return;
    g.running = false;
    const sc = Math.floor(g.score + (won ? 400 : 0));
    const coins = Math.floor(sc * 5.2 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 1.1 + 20);
    setResult({ score: sc, coins, xp });
    setTitle(won === null ? tr("КИЙ В УГОЛ") : won ? tr("ПАРТИЯ ТВОЯ") : tr("ТЫ ПРОИГРАЛ"));
    setSub(why);
    setPhase("over");
    if (won) { sfx.legend?.(); haptic("success"); }
    else { sfx.gameOver(); haptic("error"); }
    addCoins(coins); addXp(xp);
    finishGame("pool", sc, Date.now() - g.startT);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  /* ─────────── удар ─────────── */

  const strike = useCallback((vx: number, vy: number) => {
    const g = G.current;
    const c = cueBall();
    if (!c) return;
    c.vx = vx; c.vy = vy;
    g.moving = true;
    g.firstHit = 0; g.potted = []; g.cuePotted = false; g.railHit = false;
    if (mode === "solo") { g.shots -= 1; setShots(g.shots); }
    sfx.hit();
    haptic("medium");
  }, [mode]);

  const onDown = useCallback((e: React.PointerEvent) => {
    const g = G.current;
    if (!g.running || g.moving || (mode === "bot" && g.turn === "foe")) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;

    // биток в руках после фола — ставим его пальцем
    if (g.ballInHand) {
      const c = cueBall();
      if (c) {
        c.x = Math.max(g.pad + R, Math.min(g.w - g.pad - R, px));
        c.y = Math.max(g.top + R, Math.min(g.bot - R, py));
        c.in = false; c.vx = 0; c.vy = 0;
        g.ballInHand = false;
        setMsg("");
        sfx.tap();
      }
      return;
    }
    g.aiming = true;
    g.ax = px; g.ay = py;
  }, [mode]);

  const onMove = useCallback((e: React.PointerEvent) => {
    const g = G.current;
    if (!g.aiming) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    g.ax = e.clientX - r.left;
    g.ay = e.clientY - r.top;
  }, []);

  const onUp = useCallback(() => {
    const g = G.current;
    const c = cueBall();
    if (!g.aiming || !c || g.moving) return;
    g.aiming = false;
    const dx = c.x - g.ax, dy = c.y - g.ay;
    const len = Math.hypot(dx, dy);
    if (len < 14) return;
    const power = Math.min(len, 190) / 190;
    const sp = 0.42 + power * 1.5;
    strike((dx / len) * sp, (dy / len) * sp);
  }, [strike]);

  /* ─────────── разбор удара по правилам ─────────── */

  const settle = useCallback(() => {
    const g = G.current;
    const info: BallInfo[] = g.balls
      .filter((b) => b.num > 0)
      .map((b) => ({ num: b.num, potted: !!b.in }));

    const shot: ShotResult = {
      firstHit: g.firstHit,
      potted: g.potted.slice(),
      cuePotted: g.cuePotted,
      railAfterContact: g.railHit,
    };

    // одиночная тренировка: без фолов, просто считаем очки
    if (mode === "solo") {
      if (g.cuePotted) {
        const c = cueBall();
        if (c) { c.in = false; c.x = g.w / 2; c.y = g.bot - 70; c.vx = 0; c.vy = 0; }
      }
      const left = g.balls.filter((b) => b.num > 0 && !b.in).length;
      if (left === 0) { end(true, tr("Стол чист")); return; }
      if (g.shots <= 0) { end(null, tr("Удары кончились")); return; }
      return;
    }

    const who = g.turn;
    const grp = who === "me" ? g.myGroup : g.foeGroup;
    const v = judge(rules, info, shot, grp, who);

    // вернуть на стол шары, которые правило отыграло назад (девятка при фоле)
    for (const b of g.balls) {
      if (b.num > 0 && b.in) {
        const still = info.find((x) => x.num === b.num);
        if (still && !still.potted) {
          b.in = false;
          b.x = g.w / 2; b.y = g.top + 78; b.vx = 0; b.vy = 0;
        }
      }
    }

    if (rules === "eight" && v.group) {
      if (who === "me") { g.myGroup = v.group; setMyGroup(v.group); g.foeGroup = v.group === "solid" ? "stripe" : "solid"; setFoeGroup(g.foeGroup); }
      else { g.foeGroup = v.group; setFoeGroup(v.group); g.myGroup = v.group === "solid" ? "stripe" : "solid"; setMyGroup(g.myGroup); }
    }

    // очки за свои забитые
    const mineIn = shot.potted.filter((n) => n !== BLACK).length;
    if (who === "me" && mineIn > 0 && !v.foul) {
      g.score += 60 * mineIn;
      setScore(g.score);
    }

    if (v.gameOver) {
      end(v.winner === "me", v.winner === "me" ? tr("Чёрный на месте") : v.reason || tr("Соперник дожал"));
      return;
    }

    if (v.foul) {
      setMsg(tr(v.reason));
      g.pops.push({ x: g.w / 2, y: g.h * 0.42, t: 1, txt: tr("ФОЛ"), col: "#FF6B4D" });
      sfx.error(); haptic("error");
      // биток в руки соперника
      const c = cueBall();
      if (c) { c.in = false; c.vx = 0; c.vy = 0; }
      g.ballInHand = true;
    } else {
      setMsg("");
      const c = cueBall();
      if (c && c.in) { c.in = false; c.x = g.w / 2; c.y = g.bot - 70; c.vx = 0; c.vy = 0; }
    }

    if (v.turnOver) {
      g.turn = who === "me" ? "foe" : "me";
      setTurn(g.turn);
      if (mode === "duo") {
        g.pops.push({
          x: g.w / 2, y: g.h * 0.5, t: 1,
          txt: g.turn === "me" ? tr("ХОД ПЕРВОГО") : tr("ХОД ВТОРОГО"),
          col: "#FFD86B",
        });
      }
    }
  }, [mode, rules, end]);

  /* ─────────── ход бота ─────────── */

  useEffect(() => {
    if (phase !== "play" || mode !== "bot" || turn !== "foe") return;
    const g = G.current;
    if (g.moving) return;
    setThinking(true);
    const t = setTimeout(() => {
      setThinking(false);
      const c = cueBall();
      if (!c || !g.running) return;

      // биток в руках — ставим его в удобное место
      if (g.ballInHand) {
        c.x = g.w / 2; c.y = g.bot - 70; c.in = false; c.vx = 0; c.vy = 0;
        g.ballInHand = false;
      }

      const info: BallInfo[] = g.balls.filter((b) => b.num > 0).map((b) => ({ num: b.num, potted: !!b.in }));
      const legal = legalBalls(rules, info, g.foeGroup);
      const pockets = pocketList(g);
      const positions = g.balls.map((b) => ({ num: b.num, x: b.x, y: b.y, potted: !!b.in }));
      const target = pickShot(positions, { num: 0, x: c.x, y: c.y, potted: false }, pockets, legal, R);

      if (target) {
        const dx = target.aimX - c.x, dy = target.aimY - c.y;
        // бот не идеален: чем ниже качество, тем больше разброс
        const err = (1 - target.quality) * 0.16 + 0.02;
        const a = Math.atan2(dy, dx) + (Math.random() * 2 - 1) * err;
        const sp = 1.0 + Math.random() * 0.5;
        strike(Math.cos(a) * sp, Math.sin(a) * sp);
      } else {
        // нечего бить — катим в сторону законного шара, лишь бы не фол
        const info2 = legal[0];
        const tb = g.balls.find((b) => b.num === info2 && !b.in);
        const ang = tb ? Math.atan2(tb.y - c.y, tb.x - c.x) : -Math.PI / 2;
        strike(Math.cos(ang) * 0.9, Math.sin(ang) * 0.9);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [phase, mode, turn, rules, strike]);

  const pocketList = (g: typeof G.current) => {
    const L = g.pad, Rt = g.w - g.pad, T = g.top, B = g.bot;
    return [
      { x: L, y: T }, { x: g.w / 2, y: T }, { x: Rt, y: T },
      { x: L, y: B }, { x: g.w / 2, y: B }, { x: Rt, y: B },
    ];
  };

  /* ─────────── отрисовка и физика ─────────── */

  const canvasRef = useCanvas((ctx, w, h, dt) => {
    const g = G.current;
    if (!g.balls.length) { g.w = w; g.h = h; setupRack(w, h, rules); }
    g.w = w; g.h = h;

    const L = g.pad, Rt = w - g.pad, T = g.top, B = g.bot;
    const pockets = pocketList(g);

    if (g.running && g.moving) {
      const steps = low ? 2 : 3;
      const sdt = dt / steps;
      for (let st = 0; st < steps; st++) {
        for (const b of g.balls) {
          if (b.in) continue;
          b.x += b.vx * sdt;
          b.y += b.vy * sdt;
          const f = Math.pow(FRICTION, sdt);
          b.vx *= f; b.vy *= f;
          if (Math.hypot(b.vx, b.vy) < STOP_V) { b.vx = 0; b.vy = 0; }

          let railed = false;
          if (b.x < L + R) { b.x = L + R; b.vx = Math.abs(b.vx) * 0.86; railed = true; }
          if (b.x > Rt - R) { b.x = Rt - R; b.vx = -Math.abs(b.vx) * 0.86; railed = true; }
          if (b.y < T + R) { b.y = T + R; b.vy = Math.abs(b.vy) * 0.86; railed = true; }
          if (b.y > B - R) { b.y = B - R; b.vy = -Math.abs(b.vy) * 0.86; railed = true; }
          if (railed && g.firstHit) g.railHit = true;
        }

        for (let i = 0; i < g.balls.length; i++) {
          const a = g.balls[i];
          if (a.in) continue;
          for (let j = i + 1; j < g.balls.length; j++) {
            const b = g.balls[j];
            if (b.in) continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const d = Math.hypot(dx, dy);
            if (d === 0 || d >= R * 2) continue;
            const nx = dx / d, ny = dy / d;
            const ov = (R * 2 - d) / 2;
            a.x -= nx * ov; a.y -= ny * ov;
            b.x += nx * ov; b.y += ny * ov;
            const av = a.vx * nx + a.vy * ny;
            const bv = b.vx * nx + b.vy * ny;
            const diff = bv - av;
            a.vx += nx * diff * 0.96; a.vy += ny * diff * 0.96;
            b.vx -= nx * diff * 0.96; b.vy -= ny * diff * 0.96;
            // фиксируем первый контакт битка — по нему судят фол
            if (!g.firstHit && (a.num === 0 || b.num === 0)) {
              g.firstHit = a.num === 0 ? b.num : a.num;
            }
            if (Math.abs(diff) > 0.25) sfx.tap();
          }
        }

        for (const b of g.balls) {
          if (b.in) continue;
          for (const p of pockets) {
            if (Math.hypot(b.x - p.x, b.y - p.y) < POCKET_R) {
              b.in = true;
              b.vx = 0; b.vy = 0;
              if (b.num === 0) {
                g.cuePotted = true;
                g.pops.push({ x: p.x, y: p.y - 20, t: 1, txt: tr("БИТОК"), col: "#FF6B4D" });
                sfx.error();
              } else {
                g.potted.push(b.num);
                g.railHit = true;
                g.pops.push({ x: p.x, y: p.y - 20, t: 1, txt: `${b.num}`, col: "#59FF9E" });
                sfx.coin();
                haptic("success");
              }
              g.shake = 7;
              break;
            }
          }
        }
      }

      const still = g.balls.every((b) => b.in || (b.vx === 0 && b.vy === 0));
      if (still) {
        g.moving = false;
        settle();
      }
    }

    for (const p of g.pops) p.t -= dt * 0.0012;
    g.pops = g.pops.filter((p) => p.t > 0);
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 0.03);

    /* ---------- рисуем ---------- */
    ctx.fillStyle = "#0a0d10";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

    ctx.fillStyle = "#3a2416";
    ctx.beginPath();
    ctx.roundRect(L - 12, T - 12, Rt - L + 24, B - T + 24, 14);
    ctx.fill();

    const felt = ctx.createLinearGradient(0, T, 0, B);
    felt.addColorStop(0, "#1d6b45");
    felt.addColorStop(1, "#155034");
    ctx.fillStyle = felt;
    ctx.fillRect(L, T, Rt - L, B - T);

    for (const p of pockets) {
      ctx.fillStyle = "#080a0c";
      ctx.beginPath();
      ctx.arc(p.x, p.y, POCKET_R * 0.82, 0, Math.PI * 2);
      ctx.fill();
    }

    // линия прицела с точкой контакта
    const c = cueBall();
    if (g.aiming && c && !c.in) {
      const dx = c.x - g.ax, dy = c.y - g.ay;
      const len = Math.hypot(dx, dy);
      if (len > 6) {
        const ux = dx / len, uy = dy / len;
        const trace = traceShot(g.balls, c, ux, uy, L, Rt, T, B);

        ctx.setLineDash([7, 6]);
        ctx.strokeStyle = "rgba(255,255,255,0.72)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        for (const pt of trace.path) ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // призрачный шар в точке контакта
        if (trace.hit) {
          const e = trace.path[trace.path.length - 1];
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(e.x, e.y, R, 0, Math.PI * 2);
          ctx.stroke();
          // куда пойдёт прицельный шар
          ctx.strokeStyle = "rgba(255,216,107,0.85)";
          ctx.beginPath();
          ctx.moveTo(trace.hit.x, trace.hit.y);
          ctx.lineTo(trace.hit.x + trace.hit.dx * 62, trace.hit.y + trace.hit.dy * 62);
          ctx.stroke();
        }

        // индикатор силы
        const power = Math.min(len, 190) / 190;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(L + 6, B - 22, 96, 9);
        ctx.fillStyle = power > 0.8 ? "#FF6B4D" : "#FFD86B";
        ctx.fillRect(L + 6, B - 22, 96 * power, 9);
      }
    }

    // шары
    for (const b of g.balls) {
      if (b.in) continue;
      const col = b.num === 0 ? "#ffffff" : BALL_COLOR[b.num] || "#ccc";
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.arc(b.x + 1.5, b.y + 2.5, R, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
      ctx.fill();

      // полоса у полосатых
      if (b.num > 8) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = "#f4f4f6";
        ctx.fillRect(b.x - R, b.y - R, R * 2, R * 0.62);
        ctx.fillRect(b.x - R, b.y + R * 0.38, R * 2, R * 0.62);
        ctx.restore();
      }
      // белый кружок с номером
      if (b.num > 0) {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(b.x, b.y, R * 0.52, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#111";
        ctx.font = "700 9px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(b.num), b.x, b.y + 0.5);
      }
      // блик
      if (!low) {
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.arc(b.x - R * 0.32, b.y - R * 0.36, R * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // подсказка: какой шар обязателен
    if (rules === "nine" && g.running) {
      const info: BallInfo[] = g.balls.filter((b) => b.num > 0).map((b) => ({ num: b.num, potted: !!b.in }));
      const need = lowestOnTable(info);
      const tb = g.balls.find((b) => b.num === need && !b.in);
      if (tb) {
        ctx.strokeStyle = "rgba(255,216,107,0.9)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(tb.x, tb.y, R + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    for (const p of g.pops) {
      ctx.globalAlpha = Math.max(0, p.t);
      ctx.fillStyle = p.col;
      ctx.font = "800 17px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.txt, p.x, p.y - (1 - p.t) * 24);
      ctx.globalAlpha = 1;
    }

    if (g.ballInHand) {
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = "600 13px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(tr("Тапни по столу — поставь биток"), w / 2, T + 26);
    }

    ctx.restore();
  }, [phase, rules, mode, low, settle, setupRack]);

  useEffect(() => {
    if (phase === "play") {
      const c = document.querySelector<HTMLCanvasElement>("[data-pool-canvas]");
      const r = c?.getBoundingClientRect();
      const g = G.current;
      g.w = r?.width || 360; g.h = r?.height || 640;
      setupRack(g.w, g.h, rules);
      g.running = true;
    }
  }, [phase, rules, setupRack]);

  /* ─────────── меню ─────────── */

  if (phase === "menu") {
    return (
      <GameIntro
        title={tr("БИЛЬЯРД В ПОДВАЛЕ")}
        subtitle={tr("По официальным правилам. Фолы, группы, чёрный шар — всё как надо.")}
        icon="target"
        startLabel={tr("НАЧАТЬ ПАРТИЮ")}
        onStart={() => start(mode, rules)}
        onExit={onExit}
      >
        <IntroGroup label={tr("С КЕМ ИГРАЕМ")}>
          {([
            ["solo", "ОДИН", "Тренировка без соперника"],
            ["bot", "ПРОТИВ БОТА", "Он целится и бьёт по-настоящему"],
            ["duo", "С ДРУГОМ", "По очереди на одном телефоне"],
          ] as [Mode, string, string][]).map(([id, nm, ds]) => (
            <IntroOption
              key={id}
              wide
              label={tr(nm)}
              desc={tr(ds)}
              active={mode === id}
              onClick={() => setMode(id)}
            />
          ))}
        </IntroGroup>

        <IntroGroup label={tr("ПРАВИЛА ПАРТИИ")}>
          <div className="flex" style={{ gap: 8 }}>
            <IntroOption
              label={tr("9 ШАРОВ")}
              desc={tr("быстрая, по номерам")}
              active={rules === "nine"}
              onClick={() => setRules("nine")}
            />
            <IntroOption
              label={tr("ВОСЬМЁРКА")}
              desc={tr("сплошные против полосатых")}
              active={rules === "eight"}
              onClick={() => setRules("eight")}
            />
          </div>
        </IntroGroup>

        {/* Правила показываем сразу, а не за кнопкой «показать»:
            пользователь писал «правила что за, вдруг человек не знает». */}
        <IntroGroup label={tr("ЧТО НУЖНО ЗНАТЬ")}>
          <IntroRules
            lines={
              rules === "nine"
                ? [
                  "На столе биток и шары с 1 по 9.",
                  "Первым касанием бей в САМЫЙ МЛАДШИЙ шар на столе.",
                  "Забил девятку чисто — сразу выиграл.",
                  "Забил любой шар — бьёшь ещё раз.",
                  "Фол: биток в лузу, попал не в тот шар или никто не дошёл до борта.",
                ]
                : [
                  "Шары 1-7 сплошные, 9-15 полосатые, 8 чёрный.",
                  "Пока никто не забил, группы не закреплены.",
                  "Забил свой — группа твоя, бьёшь дальше.",
                  "Выбей всю группу, и только потом клади чёрный.",
                  "Чёрный раньше времени или с фолом — сразу поражение.",
                ]
            }
          />
        </IntroGroup>
      </GameIntro>
    );
  }

  const turnLabel = mode === "solo"
    ? `${tr("УДАРОВ")} ${shots}`
    : turn === "me"
      ? (mode === "duo" ? tr("ПЕРВЫЙ") : tr("ТВОЙ ХОД"))
      : (mode === "duo" ? tr("ВТОРОЙ") : thinking ? tr("ДУМАЕТ") : tr("СОПЕРНИК"));

  return (
    <div className="absolute inset-0" style={{ background: "var(--bg)" }}>
      <canvas
        ref={canvasRef}
        data-pool-canvas
        className="absolute inset-0 w-full h-full"
        onPointerDown={(e) => { e.preventDefault(); onDown(e); }}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ touchAction: "none" }}
      />

      <GameHUD
        score={score}
        best={best}
        onExit={onExit}
        extra={
          <HudStat
            label={tr("ХОД")}
            value={<span style={{ fontSize: 9.5 }}>{turnLabel}</span>}
            tone={turn === "me" ? "ok" : "warn"}
            min={68}
          />
        }
      />

      {/* группа игрока в восьмёрке */}
      {rules === "eight" && myGroup && phase === "play" && (
        <div
          className="absolute left-0 right-0 flex justify-center"
          style={{ top: "calc(var(--sat) + 76px)", pointerEvents: "none" }}
        >
          <div
            className="t-label"
            style={{
              padding: "6px 12px", borderRadius: "var(--r-sm)",
              background: "var(--toast-bg)", border: "1px solid var(--toast-brd)",
              fontSize: 9.5,
            }}
          >
            {tr("ТВОЯ ГРУППА")}: {myGroup === "solid" ? tr("СПЛОШНЫЕ") : tr("ПОЛОСАТЫЕ")}
          </div>
        </div>
      )}

      {msg && phase === "play" && (
        <div
          className="absolute left-0 right-0 flex justify-center px-6"
          style={{ bottom: "calc(var(--sab) + 74px)", pointerEvents: "none" }}
        >
          <div
            className="t-body"
            style={{
              padding: "8px 14px", borderRadius: "var(--r-sm)",
              background: "var(--toast-bg)", border: "1px solid #FF6B4D",
              color: "#FF6B4D", fontSize: 11.5, textAlign: "center",
            }}
          >
            {msg}
          </div>
        </div>
      )}

      <AnimatePresence>
        {phase === "over" && (
          <GameOver
            score={result.score}
            best={best}
            coins={result.coins}
            xp={result.xp}
            onRetry={() => setPhase("menu")}
            onExit={onExit}
            title={title}
            sub={sub}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Трассировка удара для линии прицела.
 *
 * Идём от битка вперёд, пока не упрёмся в шар или борт. Возвращаем
 * ломаную пути и, если попали в шар, направление его отлёта — игроку
 * важно видеть не только куда полетит биток, но и куда пойдёт цель.
 */
function traceShot(
  balls: Ball[], cue: Ball, ux: number, uy: number,
  L: number, Rt: number, T: number, B: number,
) {
  const path: { x: number; y: number }[] = [];
  let x = cue.x, y = cue.y;
  let dx = ux, dy = uy;
  let hit: { x: number; y: number; dx: number; dy: number } | null = null;

  for (let bounce = 0; bounce < 3; bounce++) {
    // ближайший шар по лучу
    let bestT = Infinity;
    let target: Ball | null = null;
    for (const b of balls) {
      if (b.in || b === cue) continue;
      const ox = b.x - x, oy = b.y - y;
      const proj = ox * dx + oy * dy;
      if (proj <= 0) continue;
      const perp2 = ox * ox + oy * oy - proj * proj;
      const rr = (R * 2) * (R * 2);
      if (perp2 > rr) continue;
      const t = proj - Math.sqrt(rr - perp2);
      if (t > 0 && t < bestT) { bestT = t; target = b; }
    }

    // расстояние до бортов
    let wallT = Infinity;
    let axis: "x" | "y" = "x";
    if (dx > 0) { const t = (Rt - R - x) / dx; if (t > 0 && t < wallT) { wallT = t; axis = "x"; } }
    if (dx < 0) { const t = (L + R - x) / dx; if (t > 0 && t < wallT) { wallT = t; axis = "x"; } }
    if (dy > 0) { const t = (B - R - y) / dy; if (t > 0 && t < wallT) { wallT = t; axis = "y"; } }
    if (dy < 0) { const t = (T + R - y) / dy; if (t > 0 && t < wallT) { wallT = t; axis = "y"; } }

    if (target && bestT < wallT) {
      x += dx * bestT; y += dy * bestT;
      path.push({ x, y });
      const nx = (target.x - x), ny = (target.y - y);
      const nl = Math.hypot(nx, ny) || 1;
      hit = { x: target.x, y: target.y, dx: nx / nl, dy: ny / nl };
      break;
    }

    if (!isFinite(wallT)) break;
    x += dx * wallT; y += dy * wallT;
    path.push({ x, y });
    if (axis === "x") dx = -dx; else dy = -dy;
  }

  return { path, hit };
}
