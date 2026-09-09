import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useGame } from "../core/store";
import { drawHead } from "../core/head";
import { useCanvas, GameHUD, GameOver, Countdown } from "./shell";
import { sfx, haptic } from "../core/fx";

/**
 * ПОБЕГ ОТ ШИТОВА — раннер в духе оффлайн-динозаврика.
 *
 * Ты бежишь по коридору колледжа, Шитов Андреевич догоняет сзади.
 * Тап — прыжок (можно двойной), свайп вниз / удержание — подкат.
 * Врезался в системник — препод приближается. Догнал — конец.
 */

type Phase = "count" | "play" | "over";
type ObType = "pc" | "monitor" | "chair" | "cable";

interface Obstacle {
  x: number;
  type: ObType;
  w: number;
  h: number;
  air: boolean; // висит в воздухе — нужно подкатиться
  passed: boolean;
}

const GRAV = 0.0028;
const JUMP_V = -0.95;

export default function ShitovRun({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, bump, finishGame, questProgress } = useGame();
  const shitov = s.friends.find((f) => f.id === "shitov") || s.friends[0];
  const hero = s.friends.find((f) => f.id === "vanya") || s.friends[0];

  const [phase, setPhase] = useState<Phase>("count");
  const [cd, setCd] = useState(3);
  const [uiScore, setUiScore] = useState(0);
  const [uiDanger, setUiDanger] = useState(0);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const G = useRef({
    running: false,
    dist: 0,
    speed: 0.42,
    y: 0, // высота над землёй, в долях
    vy: 0,
    jumps: 0,
    ducking: false,
    obstacles: [] as Obstacle[],
    spawnT: 900,
    chase: 0.18, // 0 далеко .. 1 схватил
    elapsed: 0,
    shake: 0,
    flash: 0,
    run: 0, // фаза анимации бега
    pops: [] as { x: number; y: number; txt: string; c: string; life: number }[],
    hits: 0,
  });

  const reset = useCallback(() => {
    const g = G.current;
    g.running = false; g.dist = 0; g.speed = 0.42;
    g.y = 0; g.vy = 0; g.jumps = 0; g.ducking = false;
    g.obstacles = []; g.spawnT = 900; g.chase = 0.18;
    g.elapsed = 0; g.shake = 0; g.flash = 0; g.run = 0;
    g.pops = []; g.hits = 0;
    setUiScore(0); setUiDanger(0);
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
      return;
    }
    sfx.click();
    const t = setTimeout(() => setCd((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, cd]);

  const end = useCallback(() => {
    const g = G.current;
    g.running = false;
    const score = Math.floor(g.dist);
    const coins = Math.floor(score * 1.1 * (1 + s.prestige * 0.12));
    const xp = Math.floor(score * 0.3 + 25);
    setResult({ score, coins, xp });
    setPhase("over");
    sfx.gameOver();
    haptic("error");
    addCoins(coins);
    addXp(xp);
    finishGame("dino", score, g.elapsed);
    bump("metersRun", score);
    questProgress("score", score);
  }, [addCoins, addXp, finishGame, bump, questProgress, s.prestige]);

  /* ---------- управление ---------- */
  const jump = () => {
    const g = G.current;
    if (!g.running) return;
    if (g.jumps >= 2) return;
    g.vy = JUMP_V * (g.jumps === 0 ? 1 : 0.82);
    g.jumps += 1;
    sfx.swoosh?.();
    haptic("light");
  };

  const surfRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const el = surfRef.current;
    if (!el) return;

    const down = (e: PointerEvent) => {
      e.preventDefault();
      touchStart.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const move = (e: PointerEvent) => {
      const st = touchStart.current;
      if (!st) return;
      const dy = e.clientY - st.y;
      // тянем вниз — подкат
      G.current.ducking = dy > 26 && G.current.y <= 0.02;
    };
    const up = (e: PointerEvent) => {
      const st = touchStart.current;
      touchStart.current = null;
      G.current.ducking = false;
      if (!st) return;
      const dy = e.clientY - st.y;
      const dt = performance.now() - st.t;
      // короткий тап без протяжки вниз — прыжок
      if (dy < 24 && dt < 420) jump();
    };

    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);

    const kd = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === "ArrowUp") { e.preventDefault(); jump(); }
      if (e.key === "ArrowDown") G.current.ducking = true;
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") G.current.ducking = false;
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);

    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* ---------- цикл ---------- */
  const canvasRef = useCanvas((ctx, W, H, dt) => {
    const g = G.current;
    ctx.clearRect(0, 0, W, H);

    const groundY = H * 0.78;
    const heroR = Math.min(W * 0.075, 34);
    const heroX = W * 0.34;

    if (g.running) {
      g.elapsed += dt;
      g.shake *= 0.9;
      g.flash *= 0.92;
      g.run += dt * 0.012 * (g.speed / 0.42);

      // разгон с потолком
      g.speed = Math.min(0.92, 0.42 + g.elapsed * 0.000018);
      g.dist += (dt * g.speed) / 9;
      setUiScore(Math.floor(g.dist));

      // прыжок
      g.vy += GRAV * dt;
      g.y -= g.vy * dt * 0.0016;
      if (g.y <= 0) { g.y = 0; g.vy = 0; g.jumps = 0; }

      // препод постепенно отстаёт, пока ты не врезаешься
      g.chase = Math.max(0.08, g.chase - dt * 0.00002);
      setUiDanger(g.chase);

      // спавн препятствий
      g.spawnT -= dt * g.speed;
      if (g.spawnT <= 0) {
        const gap = 620 + Math.random() * 520 - Math.min(260, g.elapsed * 0.004);
        g.spawnT = Math.max(300, gap);
        const roll = Math.random();
        let type: ObType = "pc";
        let air = false;
        if (roll > 0.82) { type = "cable"; air = true; }
        else if (roll > 0.6) type = "monitor";
        else if (roll > 0.4) type = "chair";
        g.obstacles.push({
          x: 1.12,
          type,
          w: type === "monitor" ? 0.1 : type === "cable" ? 0.16 : 0.075,
          h: type === "monitor" ? 0.13 : type === "chair" ? 0.1 : 0.11,
          air,
          passed: false,
        });
      }

      // движение препятствий
      const heroTop = g.y + (g.ducking ? 0.03 : 0.075);
      const heroBottom = g.y;
      for (let i = g.obstacles.length - 1; i >= 0; i--) {
        const o = g.obstacles[i];
        o.x -= (dt * g.speed) / 1000;
        if (o.x < -0.2) { g.obstacles.splice(i, 1); continue; }

        const heroXn = heroX / W;
        const hit =
          o.x < heroXn + 0.05 &&
          o.x + o.w > heroXn - 0.05 &&
          (o.air
            ? heroTop > 0.055 // висящий провод: надо пригнуться
            : heroBottom < o.h * 0.85); // наземное: надо перепрыгнуть

        if (hit && !o.passed) {
          o.passed = true;
          g.hits += 1;
          g.chase = Math.min(1, g.chase + 0.2);
          g.shake = 24;
          g.flash = 1;
          sfx.hit();
          haptic("heavy");
          g.pops.push({ x: heroXn, y: 0.52, txt: "БАМ!", c: "#ff6a4d", life: 800 });
          setUiDanger(g.chase);
          if (g.chase >= 1) { end(); return; }
        } else if (!o.passed && o.x + o.w < heroXn - 0.05) {
          o.passed = true;
          g.dist += 12;
          g.pops.push({ x: heroXn + 0.1, y: 0.46, txt: "+12", c: "#8fe08f", life: 620 });
        }
      }

      for (let i = g.pops.length - 1; i >= 0; i--) {
        g.pops[i].life -= dt;
        g.pops[i].y -= dt * 0.00011;
        if (g.pops[i].life <= 0) g.pops.splice(i, 1);
      }
    }

    /* --- отрисовка --- */
    ctx.save();
    if (g.shake > 0.4) {
      ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    }

    // коридор
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "rgba(255,255,255,0.055)");
    bg.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // шкафчики на заднем плане
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    const lockerW = W * 0.14;
    const off = (g.dist * 6) % lockerW;
    for (let x = -off; x < W; x += lockerW) {
      ctx.fillRect(x + 4, groundY - H * 0.3, lockerW - 8, H * 0.3);
    }

    // пол
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();

    // разметка пола
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.lineWidth = 2;
    const tileW = W * 0.18;
    const toff = (g.dist * 11) % tileW;
    for (let x = -toff; x < W; x += tileW) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x - W * 0.05, H);
      ctx.stroke();
    }

    // препятствия
    for (const o of g.obstacles) {
      const ox = o.x * W;
      const ow = o.w * W;
      const oh = o.h * H;
      const oy = o.air ? groundY - H * 0.3 : groundY - oh;
      drawObstacle(ctx, o.type, ox, oy, ow, oh);
    }

    // ШИТОВ сзади
    const chaseX = W * (0.03 + (1 - g.chase) * -0.02) + g.chase * heroX * 0.72;
    const shHop = Math.abs(Math.sin(g.run * 0.9)) * 8;
    drawHead(
      ctx, shitov.look, chaseX + heroR * 0.4, groundY - heroR * 1.35 - shHop,
      heroR * 0.92,
      { mouth: 0.4 + Math.sin(g.run) * 0.2, angry: 0.75, tilt: Math.sin(g.run * 0.5) * 0.1 },
    );
    drawRunnerBody(ctx, chaseX + heroR * 0.4, groundY - shHop, heroR * 0.92, g.run, "#4a5a6a", false);

    // ГЕРОЙ
    const hy = groundY - g.y * H;
    const hopPhase = g.y > 0.01 ? 0 : g.run;
    drawRunnerBody(ctx, heroX, hy, heroR, hopPhase, "#d8d8e2", g.ducking);
    drawHead(
      ctx, hero.look, heroX,
      hy - heroR * (g.ducking ? 0.95 : 1.42), heroR * (g.ducking ? 0.78 : 0.86),
      {
        mouth: 0.35, blink: 0,
        angry: g.chase > 0.6 ? 0.5 : 0,
        tilt: g.y > 0.01 ? -0.15 : Math.sin(g.run * 0.5) * 0.07,
      },
    );

    // тени
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(heroX, groundY + 3, heroR * 0.8 * (1 - g.y * 2), heroR * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // попапы
    ctx.textAlign = "center";
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    for (const p of g.pops) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 450));
      ctx.fillStyle = p.c;
      ctx.fillText(p.txt, p.x * W, p.y * H);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (g.flash > 0.02) {
      ctx.fillStyle = `rgba(255,60,40,${g.flash * 0.28})`;
      ctx.fillRect(0, 0, W, H);
    }
  }, [shitov, hero]);

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
        best={s.games.dino.best}
        onExit={onExit}
        label="МЕТРЫ"
        extra={
          <div
            className="shrink-0 flex flex-col items-center justify-center"
            style={{
              width: 46, padding: "6px 0", borderRadius: "var(--r-sm)",
              background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
            }}
          >
            <span style={{ fontSize: 13 }}>🎓</span>
            <div
              style={{
                width: 26, height: 4, borderRadius: 999, marginTop: 4,
                background: "var(--track)", overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.round(uiDanger * 100)}%`, height: "100%",
                  background: uiDanger > 0.6 ? "#ff6a4d" : "var(--acc)",
                  transition: "width 0.2s",
                }}
              />
            </div>
          </div>
        }
      />

      {phase === "play" && (
        <div
          className="absolute left-0 right-0 text-center pointer-events-none"
          style={{ bottom: "calc(var(--sab) + 22px)" }}
        >
          <div className="t-caption">Тап — прыжок (можно двойной) · потяни вниз — подкат</div>
        </div>
      )}

      <AnimatePresence>{phase === "count" && <Countdown n={cd} />}</AnimatePresence>

      <AnimatePresence>
        {phase === "over" && (
          <GameOver
            score={result.score}
            best={s.games.dino.best}
            coins={result.coins}
            xp={result.xp}
            onRetry={start}
            onExit={onExit}
            title="ДОГНАЛ"
            sub="«Ну и куда мы бежим?»"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================= отрисовка ================= */

function drawRunnerBody(
  ctx: CanvasRenderingContext2D,
  x: number, groundY: number, r: number,
  phase: number, color: string, duck: boolean,
) {
  ctx.save();
  ctx.translate(x, groundY);
  const bodyH = duck ? r * 0.55 : r * 0.95;

  // ноги
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.26;
  ctx.lineCap = "round";
  const swing = Math.sin(phase) * r * 0.45;
  ctx.beginPath();
  ctx.moveTo(-r * 0.16, -bodyH * 0.15);
  ctx.lineTo(-r * 0.16 + swing, -2);
  ctx.moveTo(r * 0.16, -bodyH * 0.15);
  ctx.lineTo(r * 0.16 - swing, -2);
  ctx.stroke();

  // корпус
  ctx.fillStyle = color;
  ctx.beginPath();
  if (duck) {
    ctx.roundRect(-r * 0.7, -bodyH - r * 0.05, r * 1.4, bodyH, r * 0.28);
  } else {
    ctx.roundRect(-r * 0.46, -bodyH - r * 0.1, r * 0.92, bodyH, r * 0.3);
  }
  ctx.fill();

  // руки
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.2;
  const arm = Math.sin(phase + Math.PI) * r * 0.4;
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, -bodyH * 0.72);
  ctx.lineTo(-r * 0.62 + arm, -bodyH * 0.28);
  ctx.moveTo(r * 0.4, -bodyH * 0.72);
  ctx.lineTo(r * 0.62 - arm, -bodyH * 0.28);
  ctx.stroke();
  ctx.restore();
}

function drawObstacle(
  ctx: CanvasRenderingContext2D,
  type: ObType, x: number, y: number, w: number, h: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  if (type === "pc") {
    // системник
    ctx.fillStyle = "#3a3a45";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 3);
    ctx.fill();
    ctx.fillStyle = "#6b6b7a";
    ctx.fillRect(w * 0.15, h * 0.12, w * 0.7, h * 0.06);
    ctx.fillStyle = "#59ff9e";
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.32, w * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a2a33";
    ctx.fillRect(w * 0.18, h * 0.55, w * 0.64, h * 0.28);
  } else if (type === "monitor") {
    ctx.fillStyle = "#2a2a33";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h * 0.72, 4);
    ctx.fill();
    ctx.fillStyle = "#3d5a8a";
    ctx.fillRect(w * 0.07, h * 0.07, w * 0.86, h * 0.56);
    ctx.fillStyle = "#4a4a55";
    ctx.fillRect(w * 0.4, h * 0.72, w * 0.2, h * 0.18);
    ctx.fillRect(w * 0.2, h * 0.9, w * 0.6, h * 0.1);
  } else if (type === "chair") {
    ctx.fillStyle = "#4a3a5a";
    ctx.beginPath();
    ctx.roundRect(0, h * 0.45, w, h * 0.22, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(w * 0.05, 0, w * 0.22, h * 0.5, 3);
    ctx.fill();
    ctx.strokeStyle = "#4a3a5a";
    ctx.lineWidth = w * 0.1;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.67);
    ctx.lineTo(w * 0.5, h);
    ctx.stroke();
  } else {
    // висящий провод — надо пригнуться
    ctx.strokeStyle = "#d0a020";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let i = 0; i <= 10; i++) {
      ctx.lineTo((w * i) / 10, Math.sin(i * 0.9) * h * 0.16 + h * 0.2);
    }
    ctx.stroke();
    ctx.fillStyle = "#e8e8f0";
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.28, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
