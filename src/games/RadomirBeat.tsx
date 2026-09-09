import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useGame } from "../core/store";
import { drawHead } from "../core/head";
import { useCanvas, GameHUD, GameOver, Countdown } from "./shell";
import { haptic, sfx } from "../core/fx";
import { startBeat, stopBeat } from "../core/music";

/**
 * РИТМ РАДОМИРА — ритм-игра под собственный синтезированный трек.
 *
 * Ноты падают по 3 дорожкам, надо тапать по дорожке в момент, когда нота
 * доходит до линии. Трек генерируется в WebAudio (офлайн, без файлов) —
 * лёгкий синти-поп в духе «фембойчика».
 */

type Phase = "count" | "play" | "over";

interface Note {
  lane: 0 | 1 | 2;
  t: number; // мс от старта, когда нота должна быть на линии
  hit: boolean;
  missed: boolean;
}

const LANES = 3;
const FALL_MS = 1500; // сколько нота летит сверху до линии
const PERFECT = 90;
const GOOD = 175;

/** Паттерн нот: генерируем детерминированно, чтобы трек всегда совпадал */
function buildChart(): Note[] {
  const notes: Note[] = [];
  const bpm = 124;
  const beat = 60000 / bpm;
  let t = 1600;
  let i = 0;
  while (t < 95000) {
    const bar = Math.floor(i / 8);
    const density = bar < 4 ? 2 : bar < 10 ? 3 : bar < 18 ? 4 : 5;
    if (i % 8 < density) {
      const lane = ((i * 7 + bar * 3) % LANES) as 0 | 1 | 2;
      notes.push({ lane, t, hit: false, missed: false });
      // сдвоенные ноты на припеве
      if (bar >= 10 && i % 8 === 0) {
        notes.push({ lane: ((lane + 2) % LANES) as 0 | 1 | 2, t, hit: false, missed: false });
      }
    }
    t += beat / 2;
    i += 1;
  }
  return notes;
}

export default function RadomirBeat({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, bump, finishGame, questProgress } = useGame();
  const radomir = s.friends.find((f) => f.id === "radomir") || s.friends[0];

  const [phase, setPhase] = useState<Phase>("count");
  const [cd, setCd] = useState(3);
  const [uiScore, setUiScore] = useState(0);
  const [uiCombo, setUiCombo] = useState(0);
  const [uiLives, setUiLives] = useState(5);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const G = useRef({
    running: false,
    notes: [] as Note[],
    time: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    lives: 5,
    hits: 0,
    perfect: 0,
    flash: [0, 0, 0],
    pops: [] as { lane: number; txt: string; c: string; life: number }[],
    bob: 0,
    shake: 0,
  });

  const reset = useCallback(() => {
    const g = G.current;
    g.running = false;
    g.notes = buildChart();
    g.time = 0; g.score = 0; g.combo = 0; g.bestCombo = 0;
    g.lives = 5; g.hits = 0; g.perfect = 0;
    g.flash = [0, 0, 0]; g.pops = []; g.bob = 0; g.shake = 0;
    setUiScore(0); setUiCombo(0); setUiLives(5);
  }, []);

  const start = useCallback(() => {
    reset();
    setPhase("count");
    setCd(3);
  }, [reset]);

  useEffect(() => {
    if (phase !== "count") return;
    if (cd < 0) {
      G.current.running = true;
      setPhase("play");
      startBeat();
      return;
    }
    sfx.click();
    const t = setTimeout(() => setCd((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, cd]);

  // трек глушим при любом выходе
  useEffect(() => () => stopBeat(), []);

  const end = useCallback(() => {
    const g = G.current;
    g.running = false;
    stopBeat();
    const score = Math.floor(g.score);
    const coins = Math.floor(score * 1.8 * (1 + s.prestige * 0.12));
    const xp = Math.floor(score * 0.5 + 25);
    setResult({ score, coins, xp });
    setPhase("over");
    sfx.gameOver();
    haptic("error");
    addCoins(coins);
    addXp(xp);
    finishGame("radomir", score, g.time);
    bump("notesHit", g.hits);
    questProgress("score", score);
  }, [addCoins, addXp, finishGame, bump, questProgress, s.prestige]);

  /* ---------- удар по дорожке ---------- */
  const tapLane = (lane: number) => {
    const g = G.current;
    if (!g.running) return;
    g.flash[lane] = 1;

    // ближайшая неотыгранная нота на этой дорожке
    let best: Note | null = null;
    let bestDiff = Infinity;
    for (const n of g.notes) {
      if (n.lane !== lane || n.hit || n.missed) continue;
      const d = Math.abs(n.t - g.time);
      if (d < bestDiff) { bestDiff = d; best = n; }
    }

    if (best && bestDiff <= GOOD) {
      best.hit = true;
      g.hits += 1;
      g.combo += 1;
      g.bestCombo = Math.max(g.bestCombo, g.combo);
      const perfect = bestDiff <= PERFECT;
      if (perfect) g.perfect += 1;
      const mult = 1 + Math.min(2, g.combo * 0.03);
      const pts = Math.floor((perfect ? 12 : 6) * mult);
      g.score += pts;
      setUiScore(Math.floor(g.score));
      setUiCombo(g.combo);
      g.pops.push({
        lane, txt: perfect ? "ИДЕАЛЬНО" : "ХОРОШО",
        c: perfect ? "#FF9FD6" : "#8FD3FF", life: 620,
      });
      sfx.tap();
      haptic("light");
    } else {
      // мимо — сбрасываем комбо
      g.combo = 0;
      setUiCombo(0);
      g.pops.push({ lane, txt: "МИМО", c: "#8f8f9c", life: 500 });
      sfx.click();
    }
  };

  const surfRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = surfRef.current;
    if (!el) return;
    const down = (e: PointerEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const lane = Math.max(0, Math.min(LANES - 1, Math.floor(((e.clientX - r.left) / r.width) * LANES)));
      tapLane(lane);
    };
    el.addEventListener("pointerdown", down);
    const kd = (e: KeyboardEvent) => {
      const idx = ["a", "s", "d"].indexOf(e.key.toLowerCase());
      if (idx >= 0) tapLane(idx);
    };
    window.addEventListener("keydown", kd);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", kd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* ---------- цикл ---------- */
  const canvasRef = useCanvas((ctx, W, H, dt) => {
    const g = G.current;
    ctx.clearRect(0, 0, W, H);

    const lineY = H * 0.76;
    const laneW = W / LANES;

    if (g.running) {
      g.time += dt;
      g.bob += dt * 0.004;
      g.shake *= 0.9;
      for (let i = 0; i < LANES; i++) g.flash[i] *= 0.88;

      // промахи
      for (const n of g.notes) {
        if (!n.hit && !n.missed && g.time - n.t > GOOD) {
          n.missed = true;
          g.combo = 0;
          g.lives -= 1;
          setUiCombo(0);
          setUiLives(g.lives);
          g.shake = 14;
          haptic("medium");
          if (g.lives <= 0) { end(); return; }
        }
      }

      for (let i = g.pops.length - 1; i >= 0; i--) {
        g.pops[i].life -= dt;
        if (g.pops[i].life <= 0) g.pops.splice(i, 1);
      }

      // трек закончился
      const last = g.notes[g.notes.length - 1];
      if (last && g.time > last.t + 2200) { end(); return; }
    }

    /* --- отрисовка --- */
    ctx.save();
    if (g.shake > 0.4) ctx.translate((Math.random() - 0.5) * g.shake, 0);

    // фон в розово-голубых тонах Радомира
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "rgba(255,159,214,0.13)");
    bg.addColorStop(0.55, "rgba(143,211,255,0.07)");
    bg.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // дорожки
    for (let i = 0; i < LANES; i++) {
      const x = i * laneW;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.028)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(x, 0, laneW, H);
      if (g.flash[i] > 0.02) {
        const fg = ctx.createLinearGradient(0, lineY - H * 0.3, 0, lineY);
        fg.addColorStop(0, "rgba(255,159,214,0)");
        fg.addColorStop(1, `rgba(255,159,214,${g.flash[i] * 0.35})`);
        ctx.fillStyle = fg;
        ctx.fillRect(x, lineY - H * 0.3, laneW, H * 0.3);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Радомир танцует сверху
    const headR = Math.min(W * 0.15, H * 0.09);
    drawHead(
      ctx, radomir.look, W / 2, H * 0.17 + Math.sin(g.bob) * 7, headR,
      { mouth: 0.2 + Math.abs(Math.sin(g.bob)) * 0.25, tilt: Math.sin(g.bob * 0.7) * 0.16 },
    );

    // линия попадания
    ctx.strokeStyle = "rgba(255,159,214,0.9)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(255,159,214,0.8)";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(W, lineY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ноты
    for (const n of g.notes) {
      if (n.hit || n.missed) continue;
      const dtn = n.t - g.time;
      if (dtn > FALL_MS || dtn < -GOOD) continue;
      const p = 1 - dtn / FALL_MS;
      const y = lineY * p;
      const x = n.lane * laneW + laneW / 2;
      const r = Math.min(laneW * 0.3, 30);

      ctx.save();
      ctx.translate(x, y);
      const grd = ctx.createLinearGradient(0, -r, 0, r);
      grd.addColorStop(0, "#FFC4E6");
      grd.addColorStop(1, "#8FD3FF");
      ctx.fillStyle = grd;
      ctx.shadowColor = "rgba(255,159,214,0.7)";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.roundRect(-r, -r * 0.42, r * 2, r * 0.84, r * 0.42);
      ctx.fill();
      ctx.restore();
    }

    // попапы оценки
    ctx.textAlign = "center";
    ctx.font = "800 15px Inter, system-ui, sans-serif";
    for (const p of g.pops) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 400));
      ctx.fillStyle = p.c;
      ctx.fillText(p.txt, p.lane * laneW + laneW / 2, lineY - 26);
    }
    ctx.globalAlpha = 1;

    // комбо
    if (g.combo > 3) {
      ctx.textAlign = "center";
      ctx.font = "800 30px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,159,214,0.92)";
      ctx.fillText(`${g.combo}x`, W / 2, H * 0.36);
    }
    ctx.restore();
  }, [radomir]);

  return (
    <div className="absolute inset-0" style={{ background: "var(--bg)" }}>
      <div
        ref={surfRef}
        className="absolute inset-0"
        style={{ touchAction: "none", userSelect: "none" }}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      <GameHUD
        score={uiScore}
        best={s.games.radomir.best}
        onExit={onExit}
        extra={
          <div className="flex shrink-0" style={{ gap: 3 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} style={{ fontSize: 12, opacity: i < uiLives ? 1 : 0.2 }}>
                💗
              </span>
            ))}
          </div>
        }
      />

      {phase === "play" && (
        <div
          className="absolute left-0 right-0 text-center pointer-events-none"
          style={{ bottom: "calc(var(--sab) + 18px)" }}
        >
          <div className="t-caption">
            {uiCombo > 3 ? `комбо ${uiCombo}` : "Тапай по дорожке, когда нота на линии"}
          </div>
        </div>
      )}

      <AnimatePresence>{phase === "count" && <Countdown n={cd} />}</AnimatePresence>

      <AnimatePresence>
        {phase === "over" && (
          <GameOver
            score={result.score}
            best={s.games.radomir.best}
            coins={result.coins}
            xp={result.xp}
            onRetry={start}
            onExit={onExit}
            title="ФИНАЛ"
            sub={`Лучшее комбо ${G.current.bestCombo} · идеальных ${G.current.perfect}`}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
