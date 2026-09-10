import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { useCanvas, GameHUD, GameOver, Countdown } from "./shell";
import { drawHead } from "../core/head";
import { tr } from "../core/i18n";

/**
 * ВОЛЕЙБОЛ НА ПАРЕ — вид сбоку, сетка посередине.
 *
 * Ты справа, соперник слева. Игрок едет за пальцем (плавно, а не рывком),
 * мяч отбивается от головы. Уронил мяч на своей половине — соперник
 * забрал очко и одну жизнь. Уронил он — очко тебе.
 *
 * Соперник умышленно неидеален: он догоняет мяч с задержкой, которая
 * уменьшается с ростом счёта, — иначе розыгрыш длится вечно.
 */

const GRAV = 0.0016;
const BALL_R = 15;
const HEAD_R = 30;
const NET_H = 0.34;      // доля высоты экрана
const LIVES = 3;

interface Pop { x: number; y: number; t: number; txt: string; col: string }

export default function Volley({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [cd, setCd] = useState(3);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [rally, setRally] = useState(0);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const best = s.games.volley?.best || 0;
  const hard = s.settings.difficulty;
  const aiBase = hard === "insane" ? 0.72 : hard === "chill" ? 0.34 : 0.52;

  const me = s.friends[0];
  const foe = s.friends[Math.min(1, s.friends.length - 1)];

  const G = useRef({
    ball: { x: 0, y: 0, vx: 0, vy: 0, spin: 0 },
    my: { x: 0, y: 0 },        // моя голова
    ai: { x: 0, y: 0, vy: 0 },
    touch: null as number | null,   // куда ведёт палец
    running: false,
    score: 0,
    lives: LIVES,
    rally: 0,
    serveTo: 1 as 1 | -1,      // 1 = подача летит ко мне
    freeze: 0,                 // пауза между розыгрышами
    startT: 0,
    pops: [] as Pop[],
    shake: 0,
    trail: [] as { x: number; y: number; a: number }[],
    w: 0, h: 0,
    myBounce: 0, aiBounce: 0,  // сплющивание при ударе
  });

  const serve = useCallback((w: number, h: number, toMe: boolean) => {
    const g = G.current;
    g.ball.x = toMe ? w * 0.24 : w * 0.76;
    g.ball.y = h * 0.24;
    g.ball.vx = (toMe ? 1 : -1) * 0.13;
    g.ball.vy = 0.02;
    g.ball.spin = 0;
    g.trail = [];
    g.freeze = 420;
  }, []);

  const reset = useCallback((w: number, h: number) => {
    const g = G.current;
    g.w = w; g.h = h;
    g.my = { x: w * 0.74, y: h - 78 };
    g.ai = { x: w * 0.26, y: h - 78, vy: 0 };
    g.touch = null;
    g.score = 0; g.lives = LIVES; g.rally = 0;
    g.pops = []; g.shake = 0;
    g.startT = Date.now();
    serve(w, h, true);
    setScore(0); setLives(LIVES); setRally(0);
  }, [serve]);

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
    const coins = Math.floor(sc * 46 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 9 + 20);
    setResult({ score: sc, coins, xp });
    setPhase("over");
    sfx.gameOver();
    haptic("error");
    addCoins(coins);
    addXp(xp);
    finishGame("volley", sc, Date.now() - g.startT);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  /* палец ведёт игрока — не телепортирует */
  const track = useCallback((e: React.PointerEvent) => {
    const g = G.current;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    g.touch = e.clientX - r.left;
  }, []);

  const canvasRef = useCanvas((ctx, w, h, dt) => {
    const g = G.current;
    if (!g.w) reset(w, h);
    g.w = w; g.h = h;

    const netX = w / 2;
    const netTop = h * (1 - NET_H) - 40;
    const groundY = h - 46;

    /* ---------- логика ---------- */
    if (g.running) {
      if (g.freeze > 0) g.freeze -= dt;

      // мой игрок едет к пальцу с ограничением скорости — плавно
      if (g.touch != null) {
        const lo = netX + HEAD_R + 6, hi = w - HEAD_R - 4;
        const target = Math.max(lo, Math.min(hi, g.touch));
        const d = target - g.my.x;
        g.my.x += Math.max(-0.95 * dt, Math.min(0.95 * dt, d * 0.014 * dt));
      }

      // соперник: тянется к мячу, только когда тот на его половине
      const aiSpeed = aiBase + Math.min(0.35, g.score * 0.02);
      const aiTarget = g.ball.x < netX ? g.ball.x : netX * 0.5;
      const ad = aiTarget - g.ai.x;
      g.ai.x += Math.max(-aiSpeed * dt, Math.min(aiSpeed * dt, ad * 0.011 * dt));
      g.ai.x = Math.max(HEAD_R + 4, Math.min(netX - HEAD_R - 6, g.ai.x));

      if (g.freeze <= 0) {
        const b = g.ball;
        b.vy += GRAV * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.spin += b.vx * dt * 0.02;

        g.trail.push({ x: b.x, y: b.y, a: 1 });
        if (g.trail.length > 12) g.trail.shift();

        // боковые стены
        if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); }
        if (b.x > w - BALL_R) { b.x = w - BALL_R; b.vx = -Math.abs(b.vx); }
        // потолок
        if (b.y < BALL_R + 60) { b.y = BALL_R + 60; b.vy = Math.abs(b.vy) * 0.8; }

        // сетка: столб отбивает
        if (b.x + BALL_R > netX - 4 && b.x - BALL_R < netX + 4 && b.y > netTop) {
          b.vx = b.x < netX ? -Math.abs(b.vx) * 0.8 : Math.abs(b.vx) * 0.8;
          b.x += b.vx > 0 ? 3 : -3;
          sfx.hit();
        }

        // удар головой — мой
        const hitHead = (hx: number, hy: number, mine: boolean) => {
          const d = Math.hypot(b.x - hx, b.y - hy);
          if (d > BALL_R + HEAD_R) return false;
          const nx = (b.x - hx) / (d || 1);
          const ny = (b.y - hy) / (d || 1);
          // отскок вверх и в сторону чужой половины
          const power = 0.52 + Math.min(0.3, g.rally * 0.012);
          b.vx = nx * power + (mine ? -0.18 : 0.18);
          b.vy = -Math.abs(ny * power) - 0.34;
          b.x = hx + nx * (BALL_R + HEAD_R + 1);
          b.y = hy + ny * (BALL_R + HEAD_R + 1);
          return true;
        };

        if (hitHead(g.my.x, g.my.y, true)) {
          g.rally += 1;
          setRally(g.rally);
          g.myBounce = 1;
          sfx.tap();
          haptic("light");
        }
        if (hitHead(g.ai.x, g.ai.y, false)) {
          g.aiBounce = 1;
          sfx.tap();
        }

        // мяч коснулся пола
        if (b.y + BALL_R >= groundY) {
          const onMySide = b.x > netX;
          if (onMySide) {
            g.lives -= 1;
            setLives(g.lives);
            g.rally = 0; setRally(0);
            g.pops.push({ x: w * 0.74, y: h * 0.5, t: 1, txt: tr("ПРОПУСТИЛ"), col: "#FF6B4D" });
            sfx.error();
            haptic("error");
            g.shake = 12;
            if (g.lives <= 0) { end(); return; }
            serve(w, h, true);
          } else {
            g.score += 1;
            setScore(g.score);
            g.pops.push({ x: w * 0.26, y: h * 0.5, t: 1, txt: `${tr("ОЧКО")} +1`, col: "#59FF9E" });
            sfx.coin();
            haptic("success");
            serve(w, h, false);
          }
        }
      }
    }

    for (const p of g.pops) p.t -= dt * 0.0012;
    g.pops = g.pops.filter((p) => p.t > 0);
    for (const t of g.trail) t.a -= dt * 0.005;
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 0.03);
    if (g.myBounce > 0) g.myBounce = Math.max(0, g.myBounce - dt * 0.006);
    if (g.aiBounce > 0) g.aiBounce = Math.max(0, g.aiBounce - dt * 0.006);

    /* ---------- отрисовка ---------- */
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#0c1014");
    grd.addColorStop(1, "#171d22");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

    // пол
    ctx.fillStyle = "#1e252c";
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke();

    // сетка
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(netX, netTop); ctx.lineTo(netX, groundY); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    for (let y = netTop; y < groundY; y += 11) {
      ctx.beginPath(); ctx.moveTo(netX - 9, y); ctx.lineTo(netX + 9, y); ctx.stroke();
    }
    ctx.fillStyle = "var(--acc)";
    ctx.fillRect(netX - 7, netTop - 5, 14, 6);

    // след мяча
    for (const t of g.trail) {
      if (t.a <= 0) continue;
      ctx.fillStyle = `rgba(255,255,255,${t.a * 0.16})`;
      ctx.beginPath(); ctx.arc(t.x, t.y, BALL_R * 0.72, 0, Math.PI * 2); ctx.fill();
    }

    // головы игроков
    const drawGuy = (x: number, y: number, look: typeof me.look, squish: number) => {
      // тень
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(x, groundY + 4, HEAD_R * 0.8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      drawHead(ctx, look, x, y, HEAD_R, { body: true, squish: squish * 0.5, mouth: squish * 0.6 });
    };
    drawGuy(g.ai.x, g.ai.y, foe.look, g.aiBounce);
    drawGuy(g.my.x, g.my.y, me.look, g.myBounce);

    // мяч — волейбольный, с полосами
    const b = g.ball;
    const bg = ctx.createRadialGradient(b.x - 5, b.y - 5, 2, b.x, b.y, BALL_R);
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(1, "#c9d3dd");
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.spin);
    ctx.strokeStyle = "rgba(40,60,80,0.6)";
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, BALL_R * 0.92, BALL_R * 0.34, (i * Math.PI) / 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();

    // всплывашки
    ctx.textAlign = "center";
    for (const p of g.pops) {
      ctx.globalAlpha = Math.min(1, p.t * 1.6);
      ctx.fillStyle = p.col;
      ctx.font = "800 18px Unbounded, Inter, system-ui, sans-serif";
      ctx.fillText(p.txt, p.x, p.y - (1 - p.t) * 30);
    }
    ctx.globalAlpha = 1;

    if (g.running && g.score === 0 && g.rally < 2) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "600 13px Inter, system-ui, sans-serif";
      ctx.fillText(tr("Веди пальцем — игрок бежит за ним"), w / 2, h - 16);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "play") {
      const c = document.querySelector<HTMLCanvasElement>("[data-volley-canvas]");
      const r = c?.getBoundingClientRect();
      reset(r?.width || 360, r?.height || 640);
      G.current.running = true;
    }
  }, [phase, reset]);

  return (
    <div className="absolute inset-0" style={{ background: "var(--bg)" }}>
      <canvas
        ref={canvasRef}
        data-volley-canvas
        className="absolute inset-0 w-full h-full"
        onPointerDown={(e) => { e.preventDefault(); track(e); }}
        onPointerMove={track}
        style={{ touchAction: "none" }}
      />

      <GameHUD
        score={score}
        best={best}
        onExit={onExit}
        label={tr("ОЧКИ")}
        extra={
          <div className="flex items-center shrink-0" style={{ gap: 7 }}>
            {rally > 2 ? (
              <div
                className="t-num shrink-0"
                style={{
                  padding: "8px 10px", borderRadius: "var(--r-md)",
                  background: "var(--btn-bg)", border: "1px solid rgba(255,255,255,0.16)",
                  color: "#fff", fontSize: 13,
                }}
              >
                ×{rally}
              </div>
            ) : null}
            <div
              className="shrink-0 flex items-center"
              style={{
                padding: "9px 11px", borderRadius: "var(--r-md)",
                background: "var(--btn-bg)", border: "1px solid rgba(255,255,255,0.16)",
                gap: 4,
              }}
            >
              {Array.from({ length: LIVES }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 8, height: 8, borderRadius: 999,
                    background: i < lives ? "#FF6B4D" : "rgba(255,255,255,0.18)",
                    display: "block",
                  }}
                />
              ))}
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
          title={tr("МАТЧ ОКОНЧЕН")}
          sub={tr("Мяч на полу трижды")}
        />
      )}
    </div>
  );
}
