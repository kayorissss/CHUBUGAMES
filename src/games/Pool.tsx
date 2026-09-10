import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { useCanvas, GameHUD, GameOver, Countdown } from "./shell";
import { tr } from "../core/i18n";

/**
 * БИЛЬЯРД В ПОДВАЛЕ — забей все шары за отведённые удары.
 *
 * Тянешь от битка назад — прицел с силой, отпускаешь. Шары честно
 * сталкиваются (упругое столкновение равных масс) и трутся о сукно.
 * Забил — очки и +1 удар в запас. Загнал биток — минус удар.
 *
 * Когда стол пуст, собирается следующая партия: шаров больше, ударов
 * столько же. Так игра растёт в сложности, а не просто повторяется.
 */

const R = 11;                 // радиус шара
const FRICTION = 0.9915;      // затухание за мс (домножается по dt)
const STOP_V = 0.012;
const POCKET_R = 20;
const SHOTS_START = 8;

interface Ball {
  x: number; y: number; vx: number; vy: number;
  col: string; cue?: boolean; in?: boolean;
}

const COLS = ["#ffb020", "#3fa9ff", "#59FF9E", "#FF6B4D", "#C89BFF", "#FFD86B", "#7be0d0"];

export default function Pool({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [cd, setCd] = useState(3);
  const [score, setScore] = useState(0);
  const [shots, setShots] = useState(SHOTS_START);
  const [rack, setRack] = useState(1);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const best = s.games.pool?.best || 0;

  const G = useRef({
    balls: [] as Ball[],
    running: false,
    score: 0,
    shots: SHOTS_START,
    rack: 1,
    moving: false,
    aiming: false,
    ax: 0, ay: 0,
    startT: 0,
    pops: [] as { x: number; y: number; t: number; txt: string; col: string }[],
    shake: 0,
    w: 0, h: 0,
    pad: 0, top: 0, bot: 0,
  });

  /** Расставить новую партию */
  const setupRack = useCallback((w: number, h: number, n: number) => {
    const g = G.current;
    const pad = 18;
    g.pad = pad;
    g.top = h * 0.16;
    g.bot = h - 96;
    const balls: Ball[] = [];
    // биток снизу по центру
    balls.push({ x: w / 2, y: g.bot - 70, vx: 0, vy: 0, col: "#ffffff", cue: true });
    // пирамида сверху
    let placed = 0, row = 0;
    const cy = g.top + 70;
    while (placed < n) {
      const cnt = row + 1;
      for (let i = 0; i < cnt && placed < n; i++) {
        balls.push({
          x: w / 2 + (i - row / 2) * (R * 2.2),
          y: cy + row * (R * 1.95),
          vx: 0, vy: 0,
          col: COLS[placed % COLS.length],
        });
        placed++;
      }
      row++;
    }
    g.balls = balls;
  }, []);

  const reset = useCallback((w: number, h: number) => {
    const g = G.current;
    g.w = w; g.h = h;
    g.score = 0; g.shots = SHOTS_START; g.rack = 1;
    g.pops = []; g.shake = 0; g.moving = false; g.aiming = false;
    g.startT = Date.now();
    setupRack(w, h, 6);
    setScore(0); setShots(SHOTS_START); setRack(1);
  }, [setupRack]);

  const restart = useCallback(() => {
    G.current.running = false;
    setPhase("count");
    setCd(3);
  }, []);

  useEffect(() => {
    if (phase !== "count") return;
    if (cd < 0) { G.current.running = true; setPhase("play"); return; }
    sfx.click();
    const t = setTimeout(() => setCd((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, cd]);

  const end = useCallback(() => {
    const g = G.current;
    if (!g.running) return;
    g.running = false;
    const sc = Math.floor(g.score);
    const coins = Math.floor(sc * 5.2 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 1.1 + 20);
    setResult({ score: sc, coins, xp });
    setPhase("over");
    sfx.gameOver();
    haptic("error");
    addCoins(coins);
    addXp(xp);
    finishGame("pool", sc, Date.now() - g.startT);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  const cue = () => G.current.balls.find((b) => b.cue && !b.in);

  const onDown = useCallback((e: React.PointerEvent) => {
    const g = G.current;
    if (!g.running || g.moving) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    g.aiming = true;
    g.ax = e.clientX - r.left;
    g.ay = e.clientY - r.top;
  }, []);

  const onMove = useCallback((e: React.PointerEvent) => {
    const g = G.current;
    if (!g.aiming) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    g.ax = e.clientX - r.left;
    g.ay = e.clientY - r.top;
  }, []);

  const onUp = useCallback(() => {
    const g = G.current;
    const c = cue();
    if (!g.aiming || !c || g.moving) return;
    g.aiming = false;
    const dx = c.x - g.ax;
    const dy = c.y - g.ay;
    const len = Math.hypot(dx, dy);
    if (len < 14) return;
    const power = Math.min(len, 190) / 190;
    const sp = 0.25 + power * 1.25;
    c.vx = (dx / len) * sp;
    c.vy = (dy / len) * sp;
    g.moving = true;
    g.shots -= 1;
    setShots(g.shots);
    sfx.hit();
    haptic("medium");
  }, []);

  const canvasRef = useCanvas((ctx, w, h, dt) => {
    const g = G.current;
    if (!g.balls.length) reset(w, h);
    g.w = w; g.h = h;

    const L = g.pad, Rt = w - g.pad, T = g.top, B = g.bot;
    const pockets = [
      { x: L, y: T }, { x: w / 2, y: T }, { x: Rt, y: T },
      { x: L, y: B }, { x: w / 2, y: B }, { x: Rt, y: B },
    ];

    /* ---------- физика ---------- */
    if (g.running && g.moving) {
      const steps = 3;                 // подшаги — чтобы не проскакивали
      const sdt = dt / steps;
      for (let st = 0; st < steps; st++) {
        for (const b of g.balls) {
          if (b.in) continue;
          b.x += b.vx * sdt;
          b.y += b.vy * sdt;
          const f = Math.pow(FRICTION, sdt);
          b.vx *= f; b.vy *= f;
          if (Math.hypot(b.vx, b.vy) < STOP_V) { b.vx = 0; b.vy = 0; }

          // борта
          if (b.x < L + R) { b.x = L + R; b.vx = Math.abs(b.vx) * 0.86; }
          if (b.x > Rt - R) { b.x = Rt - R; b.vx = -Math.abs(b.vx) * 0.86; }
          if (b.y < T + R) { b.y = T + R; b.vy = Math.abs(b.vy) * 0.86; }
          if (b.y > B - R) { b.y = B - R; b.vy = -Math.abs(b.vy) * 0.86; }
        }

        // столкновения
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
            // раздвигаем
            const ov = (R * 2 - d) / 2;
            a.x -= nx * ov; a.y -= ny * ov;
            b.x += nx * ov; b.y += ny * ov;
            // обмен нормальными компонентами (равные массы)
            const av = a.vx * nx + a.vy * ny;
            const bv = b.vx * nx + b.vy * ny;
            const diff = bv - av;
            a.vx += nx * diff * 0.96; a.vy += ny * diff * 0.96;
            b.vx -= nx * diff * 0.96; b.vy -= ny * diff * 0.96;
            if (Math.abs(diff) > 0.25) sfx.tap();
          }
        }

        // лузы
        for (const b of g.balls) {
          if (b.in) continue;
          for (const p of pockets) {
            if (Math.hypot(b.x - p.x, b.y - p.y) < POCKET_R) {
              b.in = true;
              if (b.cue) {
                g.shots -= 1;
                setShots(g.shots);
                g.pops.push({ x: p.x, y: p.y - 20, t: 1, txt: tr("БИТОК"), col: "#FF6B4D" });
                sfx.error();
                haptic("error");
              } else {
                g.score += 10 + g.rack * 5;
                setScore(g.score);
                g.shots += 1;
                setShots(g.shots);
                g.pops.push({ x: p.x, y: p.y - 20, t: 1, txt: `+${10 + g.rack * 5}`, col: "#59FF9E" });
                sfx.coin();
                haptic("success");
              }
              g.shake = 7;
              break;
            }
          }
        }
      }

      // всё встало?
      const still = g.balls.every((b) => b.in || (b.vx === 0 && b.vy === 0));
      if (still) {
        g.moving = false;
        // биток вернуть на стол
        const c = g.balls.find((b) => b.cue);
        if (c && c.in) {
          c.in = false;
          c.x = w / 2; c.y = B - 70; c.vx = 0; c.vy = 0;
        }
        // стол пуст — новая партия
        const left = g.balls.filter((b) => !b.cue && !b.in).length;
        if (left === 0) {
          g.rack += 1;
          setRack(g.rack);
          g.pops.push({ x: w / 2, y: h * 0.45, t: 1, txt: tr("ПАРТИЯ ВЗЯТА"), col: "#FFD86B" });
          sfx.achieve?.();
          haptic("success");
          setupRack(w, h, Math.min(15, 6 + g.rack));
        }
        if (g.shots <= 0) { end(); return; }
      }
    }

    for (const p of g.pops) p.t -= dt * 0.0012;
    g.pops = g.pops.filter((p) => p.t > 0);
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 0.03);

    /* ---------- отрисовка ---------- */
    ctx.fillStyle = "#0a0d10";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

    // борт стола
    ctx.fillStyle = "#3a2416";
    ctx.beginPath();
    ctx.roundRect(L - 12, T - 12, Rt - L + 24, B - T + 24, 14);
    ctx.fill();
    // сукно
    const felt = ctx.createLinearGradient(0, T, 0, B);
    felt.addColorStop(0, "#17492f");
    felt.addColorStop(1, "#0f3521");
    ctx.fillStyle = felt;
    ctx.beginPath();
    ctx.roundRect(L, T, Rt - L, B - T, 6);
    ctx.fill();

    // лузы
    for (const p of pockets) {
      ctx.fillStyle = "#05070a";
      ctx.beginPath();
      ctx.arc(p.x, p.y, POCKET_R * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // шары
    for (const b of g.balls) {
      if (b.in) continue;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(b.x + 2, b.y + 3, R, R * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      const bg = ctx.createRadialGradient(b.x - R * 0.35, b.y - R * 0.4, 1, b.x, b.y, R);
      bg.addColorStop(0, "#ffffff");
      bg.addColorStop(0.25, b.col);
      bg.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, Math.PI * 2); ctx.fill();
      if (!b.cue) {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath(); ctx.arc(b.x, b.y, R * 0.36, 0, Math.PI * 2); ctx.fill();
      }
    }

    // прицел
    const c = cue();
    if (g.aiming && c && !g.moving) {
      const dx = c.x - g.ax, dy = c.y - g.ay;
      const len = Math.hypot(dx, dy);
      if (len > 8) {
        const nx = dx / len, ny = dy / len;
        const power = Math.min(len, 190) / 190;
        // луч до первого препятствия
        let dist = 620;
        for (const b of g.balls) {
          if (b.in || b === c) continue;
          const rx = b.x - c.x, ry = b.y - c.y;
          const proj = rx * nx + ry * ny;
          if (proj <= 0) continue;
          const perp = Math.abs(rx * ny - ry * nx);
          if (perp < R * 2) dist = Math.min(dist, proj - Math.sqrt(Math.max(0, (R * 2) ** 2 - perp ** 2)));
        }
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.setLineDash([7, 7]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + nx * dist, c.y + ny * dist);
        ctx.stroke();
        ctx.setLineDash([]);
        // призрак касания
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.beginPath();
        ctx.arc(c.x + nx * dist, c.y + ny * dist, R, 0, Math.PI * 2);
        ctx.stroke();
        // кий сзади
        ctx.strokeStyle = "#c89b62";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(c.x - nx * (16 + power * 40), c.y - ny * (16 + power * 40));
        ctx.lineTo(c.x - nx * (110 + power * 40), c.y - ny * (110 + power * 40));
        ctx.stroke();
        // сила
        ctx.fillStyle = power > 0.9 ? "#FF6B4D" : "#ffb020";
        ctx.fillRect(w - 26, B - 10 - power * 110, 10, power * 110);
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1;
        ctx.strokeRect(w - 26, B - 120, 10, 110);
      }
    }

    ctx.restore();

    ctx.textAlign = "center";
    for (const p of g.pops) {
      ctx.globalAlpha = Math.min(1, p.t * 1.6);
      ctx.fillStyle = p.col;
      ctx.font = "800 18px Unbounded, Inter, system-ui, sans-serif";
      ctx.fillText(p.txt, p.x, p.y - (1 - p.t) * 28);
    }
    ctx.globalAlpha = 1;

    if (g.running && g.shots === SHOTS_START && !g.moving) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "600 13px Inter, system-ui, sans-serif";
      ctx.fillText(tr("Тяни от битка назад и отпусти"), w / 2, h - 24);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "play") {
      const c = document.querySelector<HTMLCanvasElement>("[data-pool-canvas]");
      const r = c?.getBoundingClientRect();
      reset(r?.width || 360, r?.height || 640);
      G.current.running = true;
    }
  }, [phase, reset]);

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
          <div className="flex items-center shrink-0" style={{ gap: 7 }}>
            <div
              className="t-label shrink-0"
              style={{
                padding: "8px 10px", borderRadius: "var(--r-md)",
                background: "var(--btn-bg)", border: "1px solid rgba(255,255,255,0.16)",
                color: "#fff", fontSize: 9.5,
              }}
            >
              {tr("ПАРТИЯ")} {rack}
            </div>
            <div
              className="t-num shrink-0"
              style={{
                padding: "8px 11px", borderRadius: "var(--r-md)",
                background: "var(--btn-bg)",
                border: `1px solid ${shots <= 2 ? "#FF6B4D" : "rgba(255,255,255,0.16)"}`,
                color: shots <= 2 ? "#FF6B4D" : "#fff", fontSize: 14,
              }}
            >
              {shots}
            </div>
          </div>
        }
      />

      <AnimatePresence>{phase === "count" && <Countdown n={cd} />}</AnimatePresence>

      {phase === "over" && (
        <GameOver
          score={result.score}
          best={best}
          coins={result.coins}
          xp={result.xp}
          onRetry={restart}
          onExit={onExit}
          title={tr("КИЙ В УГОЛ")}
          sub={tr("Удары кончились")}
        />
      )}
    </div>
  );
}
