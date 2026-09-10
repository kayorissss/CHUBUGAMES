import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { useCanvas, GameHUD, GameOver, Countdown } from "./shell";
import { tr } from "../core/i18n";

/**
 * ЧУБУ-БАСКЕТ — свайп-броски в кольцо.
 *
 * Ведёшь пальцем от мяча назад (как рогатку) и отпускаешь. Кольцо ездит
 * влево-вправо и с каждым уровнем быстрее. Чистое попадание без щита —
 * «чистяк», он держит комбо и даёт больше очков.
 *
 * Время ограничено, но каждое попадание добавляет секунды: пока не
 * мажешь — игра не кончается. Это и есть темп.
 */

/**
 * Гравитация и сила броска подобраны перебором, а не на глаз: при
 * исходных значениях попасть можно было только строго вертикальным
 * свайпом на максимальной силе (1% бросков из 180 проверенных).
 * С этими числами окно попадания — 60–70 px по длине свайпа на каждом
 * разумном угле, то есть промах читается как ошибка игрока, а не игры.
 */
const GRAV = 0.0016;        // px/мс²
const BALL_R = 17;
const RIM_HALF = 34;        // половина ширины кольца
const START_MS = 45000;
const ADD_MS = 2600;        // сколько времени даёт попадание

interface Ball {
  x: number; y: number; vx: number; vy: number;
  live: boolean;            // летит
  hitBoard: boolean;        // задел щит/дужку — уже не чистяк
  passed: boolean;          // уже засчитан
}

export default function Basket({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [cd, setCd] = useState(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [left, setLeft] = useState(START_MS);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const best = s.games.basket?.best || 0;
  const hard = s.settings.difficulty;
  const speedBase = hard === "insane" ? 0.135 : hard === "chill" ? 0.062 : 0.095;

  const G = useRef({
    ball: null as Ball | null,
    hoopX: 0,
    hoopDir: 1,
    hoopSpeed: speedBase,
    hoopY: 0,
    running: false,
    score: 0,
    combo: 0,
    shots: 0,
    made: 0,
    left: START_MS,
    shownSec: Math.ceil(START_MS / 1000),
    startT: 0,
    // прицеливание
    aiming: false,
    ax: 0, ay: 0,       // текущая точка пальца
    ox: 0, oy: 0,       // точка старта (мяч)
    pops: [] as { x: number; y: number; t: number; txt: string; col: string }[],
    trail: [] as { x: number; y: number; a: number }[],
    shake: 0,
    w: 0, h: 0,
  });

  const spawnBall = useCallback((w: number, h: number) => {
    const g = G.current;
    g.ball = {
      x: w / 2, y: h - 96, vx: 0, vy: 0,
      live: false, hitBoard: false, passed: false,
    };
  }, []);

  const reset = useCallback((w: number, h: number) => {
    const g = G.current;
    g.w = w; g.h = h;
    g.hoopX = w / 2;
    g.hoopY = h * 0.34;
    g.hoopDir = Math.random() < 0.5 ? 1 : -1;
    g.hoopSpeed = speedBase;
    g.score = 0; g.combo = 0; g.shots = 0; g.made = 0;
    g.left = START_MS;
    g.pops = []; g.trail = []; g.shake = 0;
    g.aiming = false;
    g.startT = Date.now();
    spawnBall(w, h);
    setScore(0); setCombo(0); setLeft(START_MS);
  }, [speedBase, spawnBall]);

  const restart = useCallback(() => {
    G.current.running = false;
    setPhase("count");
    setCd(3);
  }, []);

  useEffect(() => {
    if (phase !== "count") return;
    if (cd < 0) {
      G.current.running = true;
      setPhase("play");
      return;
    }
    sfx.click();
    const t = setTimeout(() => setCd((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, cd]);

  const end = useCallback(() => {
    const g = G.current;
    if (!g.running) return;
    g.running = false;
    const sc = Math.floor(g.score);
    const coins = Math.floor(sc * 3.4 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 0.8 + 20);
    setResult({ score: sc, coins, xp });
    setPhase("over");
    sfx.gameOver();
    haptic("error");
    addCoins(coins);
    addXp(xp);
    finishGame("basket", sc, Date.now() - g.startT);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  /* ─── управление: тянем от мяча и отпускаем ─── */
  const onDown = useCallback((e: React.PointerEvent) => {
    const g = G.current;
    if (!g.running || !g.ball || g.ball.live) return;
    const r = (e.target as HTMLElement).getBoundingClientRect();
    g.aiming = true;
    g.ox = g.ball.x; g.oy = g.ball.y;
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
    if (!g.aiming || !g.ball) return;
    g.aiming = false;
    // вектор броска — противоположен оттяжке
    const dx = g.ox - g.ax;
    const dy = g.oy - g.ay;
    const len = Math.hypot(dx, dy);
    if (len < 18) return;                 // слишком короткий свайп — не бросок
    const power = Math.min(len, 230) / 230;
    const sp = 0.28 + power * 1.67;       // px/мс
    g.ball.vx = (dx / len) * sp;
    g.ball.vy = (dy / len) * sp;
    g.ball.live = true;
    g.shots += 1;
    sfx.swoosh();
    haptic("light");
  }, []);

  const canvasRef = useCanvas((ctx, w, h, dt) => {
    const g = G.current;
    if (!g.ball) reset(w, h);
    g.w = w; g.h = h;
    g.hoopY = h * 0.34;

    /* ---------- физика ---------- */
    if (g.running) {
      g.left -= dt;
      if (g.left <= 0) { g.left = 0; setLeft(0); end(); }
      // Перерисовываем счётчик не каждый кадр, а на смене секунды:
      // иначе setState на 60 fps впустую дёргает React.
      else if (Math.ceil(g.left / 1000) !== g.shownSec) {
        g.shownSec = Math.ceil(g.left / 1000);
        setLeft(g.left);
      }

      // кольцо ездит
      g.hoopX += g.hoopDir * g.hoopSpeed * dt;
      const margin = RIM_HALF + 26;
      if (g.hoopX < margin) { g.hoopX = margin; g.hoopDir = 1; }
      if (g.hoopX > w - margin) { g.hoopX = w - margin; g.hoopDir = -1; }

      const b = g.ball!;
      if (b.live) {
        b.vy += GRAV * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // след
        g.trail.push({ x: b.x, y: b.y, a: 1 });
        if (g.trail.length > 16) g.trail.shift();

        // стенки
        if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx) * 0.72; }
        if (b.x > w - BALL_R) { b.x = w - BALL_R; b.vx = -Math.abs(b.vx) * 0.72; }

        // щит над кольцом
        const boardY = g.hoopY - 76;
        if (b.y - BALL_R < g.hoopY - 6 && b.y + BALL_R > boardY &&
            Math.abs(b.x - g.hoopX) < RIM_HALF + 8 && b.vy < 0) {
          // отскок от щита сверху вниз бывает редко; главное — дужки ниже
        }

        // дужки кольца — два кружка по краям
        for (const side of [-1, 1]) {
          const rx = g.hoopX + side * RIM_HALF;
          const ry = g.hoopY;
          const d = Math.hypot(b.x - rx, b.y - ry);
          if (d < BALL_R + 4) {
            const nx = (b.x - rx) / (d || 1);
            const ny = (b.y - ry) / (d || 1);
            const dot = b.vx * nx + b.vy * ny;
            b.vx = (b.vx - 2 * dot * nx) * 0.62;
            b.vy = (b.vy - 2 * dot * ny) * 0.62;
            b.x = rx + nx * (BALL_R + 4);
            b.y = ry + ny * (BALL_R + 4);
            b.hitBoard = true;
            sfx.hit();
            haptic("light");
          }
        }

        // засчитываем: центр мяча прошёл линию кольца сверху вниз
        if (!b.passed && b.vy > 0 &&
            b.y > g.hoopY && b.y - b.vy * dt <= g.hoopY &&
            Math.abs(b.x - g.hoopX) < RIM_HALF - 4) {
          b.passed = true;
          const clean = !b.hitBoard;
          g.combo = clean ? g.combo + 1 : Math.max(1, g.combo);
          const pts = (clean ? 3 : 2) + Math.min(6, g.combo - 1);
          g.score += pts;
          g.made += 1;
          g.left = Math.min(START_MS, g.left + ADD_MS);
          setScore(Math.floor(g.score));
          setCombo(g.combo);
          setLeft(g.left);
          g.pops.push({
            x: g.hoopX, y: g.hoopY + 30, t: 1,
            txt: clean ? `${tr("ЧИСТЯК")} +${pts}` : `+${pts}`,
            col: clean ? "#59FF9E" : "#ffb020",
          });
          // кольцо ускоряется — но не бесконечно
          g.hoopSpeed = Math.min(0.26, g.hoopSpeed + 0.006);
          sfx.coin();
          haptic("success");
          g.shake = 6;
        }

        // мяч ушёл вниз — промах
        if (b.y > h + 60) {
          if (!b.passed) {
            g.combo = 0;
            setCombo(0);
            g.pops.push({ x: w / 2, y: h * 0.55, t: 1, txt: tr("МИМО"), col: "#FF6B4D" });
            haptic("error");
          }
          g.trail = [];
          spawnBall(w, h);
        }
      }
    }

    for (const p of g.pops) p.t -= dt * 0.0013;
    g.pops = g.pops.filter((p) => p.t > 0);
    for (const t of g.trail) t.a -= dt * 0.004;
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 0.02);

    /* ---------- отрисовка ---------- */
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#0d1016");
    grd.addColorStop(1, "#161a22");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

    // пол зала + разметка
    const floorY = h - 58;
    ctx.fillStyle = "#1b2029";
    ctx.fillRect(0, floorY, w, h - floorY);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, floorY); ctx.lineTo(w, floorY);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(w / 2, floorY, w * 0.34, 16, 0, Math.PI, Math.PI * 2);
    ctx.stroke();

    // щит
    const bw = 96, bh = 62;
    const bx = g.hoopX - bw / 2, by = g.hoopY - bh - 12;
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.strokeStyle = "rgba(255,255,255,0.24)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(255,176,32,0.65)";
    ctx.beginPath(); ctx.roundRect(g.hoopX - 22, g.hoopY - 40, 44, 32, 4); ctx.stroke();

    // кольцо
    ctx.strokeStyle = "#ff6b3d";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(g.hoopX - RIM_HALF, g.hoopY);
    ctx.lineTo(g.hoopX + RIM_HALF, g.hoopY);
    ctx.stroke();
    // сетка
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const x0 = g.hoopX - RIM_HALF + t * RIM_HALF * 2;
      ctx.beginPath();
      ctx.moveTo(x0, g.hoopY);
      ctx.lineTo(g.hoopX + (x0 - g.hoopX) * 0.5, g.hoopY + 30);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(g.hoopX - RIM_HALF * 0.5, g.hoopY + 30);
    ctx.lineTo(g.hoopX + RIM_HALF * 0.5, g.hoopY + 30);
    ctx.stroke();

    // след мяча
    for (const t of g.trail) {
      if (t.a <= 0) continue;
      ctx.fillStyle = `rgba(255,176,32,${t.a * 0.22})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, BALL_R * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // мяч
    const b = g.ball;
    if (b) {
      const bg = ctx.createRadialGradient(b.x - 5, b.y - 6, 2, b.x, b.y, BALL_R);
      bg.addColorStop(0, "#ff9c4a");
      bg.addColorStop(1, "#d4551d");
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(40,16,6,0.75)";
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x - BALL_R, b.y); ctx.lineTo(b.x + BALL_R, b.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x, b.y - BALL_R); ctx.lineTo(b.x, b.y + BALL_R); ctx.stroke();
    }

    // линия прицела — пунктирная траектория
    if (g.aiming && b && !b.live) {
      const dx = g.ox - g.ax, dy = g.oy - g.ay;
      const len = Math.hypot(dx, dy);
      if (len > 8) {
        const power = Math.min(len, 230) / 230;
        const sp = 0.28 + power * 1.67;
        let px = b.x, py = b.y;
        let pvx = (dx / len) * sp, pvy = (dy / len) * sp;
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        for (let i = 0; i < 26; i++) {
          pvy += GRAV * 26;
          px += pvx * 26; py += pvy * 26;
          if (py > h || px < 0 || px > w) break;
          ctx.globalAlpha = 1 - i / 28;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        // индикатор силы
        ctx.strokeStyle = power > 0.92 ? "#FF6B4D" : "var(--acc)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(g.ax, g.ay);
        ctx.stroke();
      }
    }

    ctx.restore();

    // всплывашки
    ctx.textAlign = "center";
    for (const p of g.pops) {
      ctx.globalAlpha = Math.min(1, p.t * 1.6);
      ctx.fillStyle = p.col;
      ctx.font = "800 19px Unbounded, Inter, system-ui, sans-serif";
      ctx.fillText(p.txt, p.x, p.y - (1 - p.t) * 34);
    }
    ctx.globalAlpha = 1;

    if (g.running && g.shots === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "600 13px Inter, system-ui, sans-serif";
      ctx.fillText(tr("Тяни от мяча назад и отпусти"), w / 2, h - 24);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "play") {
      const c = document.querySelector<HTMLCanvasElement>("[data-basket-canvas]");
      const r = c?.getBoundingClientRect();
      reset(r?.width || 360, r?.height || 640);
      G.current.running = true;
    }
  }, [phase, reset]);

  const secs = Math.ceil(left / 1000);

  return (
    <div className="absolute inset-0" style={{ background: "var(--bg)" }}>
      <canvas
        ref={canvasRef}
        data-basket-canvas
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
              className="t-num shrink-0"
              style={{
                padding: "8px 11px", borderRadius: "var(--r-md)",
                background: "var(--btn-bg)",
                border: `1px solid ${secs <= 8 ? "#FF6B4D" : "rgba(255,255,255,0.16)"}`,
                color: secs <= 8 ? "#FF6B4D" : "#fff", fontSize: 14, minWidth: 44,
                textAlign: "center",
              }}
            >
              {secs}
            </div>
            {combo > 1 ? (
              <div
                className="t-num shrink-0"
                style={{
                  padding: "8px 11px", borderRadius: "var(--r-md)",
                  background: "rgba(89,255,158,0.14)",
                  border: "1px solid rgba(89,255,158,0.5)",
                  color: "#59FF9E", fontSize: 14,
                }}
              >
                ×{combo}
              </div>
            ) : null}
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
          title={tr("СВИСТОК")}
          sub={tr("Время вышло")}
        />
      )}
    </div>
  );
}
