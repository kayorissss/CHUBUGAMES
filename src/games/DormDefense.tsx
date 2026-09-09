import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { useCanvas, GameHUD, GameOver, Countdown } from "./shell";
import { drawHead } from "../core/head";
import Icon from "../ui/Icon";
import type { Friend } from "../core/types";

/**
 * ОБОРОНА ОБЩАГИ — по трём дорожкам к двери ползут незваные гости.
 * Тапай (или веди пальцем) по головам, чтобы отбить. Дошёл до двери —
 * минус жизнь. Каждая волна быстрее и плотнее.
 * Некоторых бить нельзя: свои приходят с подписью «СВОЙ».
 */

interface Enemy {
  id: number;
  lane: 0 | 1 | 2;
  p: number;          // 0 (появился) .. 1 (дверь)
  speed: number;
  hp: number;
  maxHp: number;
  friend: Friend;
  ally: boolean;      // своего бить нельзя
  dying: boolean;     // помечен на удаление
  dead: number;       // 1 → 0, прогресс анимации исчезновения
  hitFx: number;
}

const LANES = 3;

export default function DormDefense({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [cd, setCd] = useState(3);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [wave, setWave] = useState(1);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const best = s.games.defend?.best || 0;
  const diff = s.settings.difficulty;
  const spawnBase = diff === "insane" ? 780 : diff === "chill" ? 1350 : 1050;

  const G = useRef({
    enemies: [] as Enemy[],
    uid: 1,
    spawnT: 0,
    elapsed: 0,
    score: 0,
    lives: 5,
    wave: 1,
    running: false,
    startT: 0,
    shake: 0,
    kills: 0,
    pops: [] as { x: number; y: number; t: number; txt: string; bad: boolean }[],
  });

  const reset = useCallback(() => {
    const g = G.current;
    g.enemies = [];
    g.spawnT = 600;
    g.elapsed = 0;
    g.score = 0;
    g.lives = 5;
    g.wave = 1;
    g.shake = 0;
    g.kills = 0;
    g.pops = [];
    g.startT = Date.now();
    setScore(0);
    setLives(5);
    setWave(1);
  }, []);

  const restart = useCallback(() => {
    G.current.running = false;
    setPhase("count");
    setCd(3);
  }, []);

  useEffect(() => {
    if (phase !== "count") return;
    if (cd < 0) {
      reset();
      G.current.running = true;
      setPhase("play");
      return;
    }
    sfx.click();
    const t = setTimeout(() => setCd((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, cd, reset]);

  const end = useCallback(() => {
    const g = G.current;
    if (!g.running) return;
    g.running = false;
    const sc = g.score;
    const coins = Math.floor(sc * 2.2 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 0.5 + 20);
    setResult({ score: sc, coins, xp });
    setPhase("over");
    sfx.gameOver();
    haptic("error");
    addCoins(coins);
    addXp(xp);
    finishGame("defend", sc, Date.now() - g.startT);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  const canvasRef = useCanvas(
    (ctx, w, h, dt, t) => {
      const g = G.current;
      const topY = h * 0.16;
      const doorY = h * 0.82;
      const laneX = (l: number) => w * (0.2 + l * 0.3);
      const R = Math.min(30, w * 0.085);

      if (g.running) {
        g.elapsed += dt;
        g.wave = 1 + Math.floor(g.elapsed / 22000);
        if (g.wave !== wave) setWave(g.wave);

        // спавн
        g.spawnT -= dt;
        if (g.spawnT <= 0) {
          const interval = Math.max(380, spawnBase - g.elapsed * 0.012);
          g.spawnT = interval * (0.7 + Math.random() * 0.6);
          const ally = Math.random() < 0.16;
          const pool = s.friends;
          const hp = ally ? 1 : 1 + Math.floor(Math.random() * Math.min(3, g.wave));
          g.enemies.push({
            id: g.uid++,
            lane: Math.floor(Math.random() * LANES) as 0 | 1 | 2,
            p: 0,
            speed: (0.000055 + Math.random() * 0.00003) * (1 + g.wave * 0.11),
            hp,
            maxHp: hp,
            friend: pool[Math.floor(Math.random() * pool.length)],
            ally,
            dying: false,
            dead: 0,
            hitFx: 0,
          });
        }

        // движение
        for (const e of g.enemies) {
          if (e.dying) continue;
          e.p += e.speed * dt;
          if (e.hitFx > 0) e.hitFx -= dt * 0.004;
          if (e.p >= 1) {
            if (e.ally) {
              // свой дошёл — ничего страшного, просто ушёл
              e.dying = true; e.dead = 1;
            } else {
              g.lives -= 1;
              setLives(g.lives);
              sfx.hit();
              haptic("error");
              g.shake = 12;
              e.dying = true; e.dead = 1;
              if (g.lives <= 0) { end(); return; }
            }
          }
        }
        // анимация исчезновения: dead идёт 1 → 0, потом враг удаляется
        for (const e of g.enemies) {
          if (e.dying) e.dead = Math.max(0, e.dead - dt * 0.005);
        }
        g.enemies = g.enemies.filter((e) => !(e.dying && e.dead <= 0));
      }

      for (const p of g.pops) p.t -= dt;
      g.pops = g.pops.filter((p) => p.t > 0);
      if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 0.05);

      /* ---------- фон ---------- */
      const grd = ctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, "#0d0d12");
      grd.addColorStop(1, "#17171f");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

      // дорожки
      for (let l = 0; l < LANES; l++) {
        const x = laneX(l);
        const lg = ctx.createLinearGradient(0, topY, 0, doorY);
        lg.addColorStop(0, "rgba(255,255,255,0.02)");
        lg.addColorStop(1, "rgba(255,255,255,0.06)");
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.roundRect(x - w * 0.13, topY, w * 0.26, doorY - topY, 14);
        ctx.fill();
      }

      // дверь
      ctx.fillStyle = "#2a2233";
      ctx.beginPath();
      ctx.roundRect(w * 0.06, doorY, w * 0.88, h * 0.1, 12);
      ctx.fill();
      ctx.strokeStyle = g.lives <= 2 ? "#FF4D4D" : "rgba(255,255,255,0.14)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "700 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("ОБЩАГА", w / 2, doorY + h * 0.062);

      // враги
      for (const e of g.enemies) {
        const x = laneX(e.lane);
        const y = topY + (doorY - topY) * Math.min(1, e.p);
        const alpha = e.dying ? Math.max(0, e.dead) : 1;
        ctx.save();
        ctx.globalAlpha = alpha;
        if (e.dying) {
          ctx.translate(x, y);
          ctx.scale(1 + (1 - e.dead) * 0.4, 1 - (1 - e.dead) * 0.35);
          ctx.translate(-x, -y);
        }

        // подсветка своих
        if (e.ally) {
          ctx.strokeStyle = "#59FF9E";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(x, y, R + 6, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (e.hitFx > 0) {
          ctx.fillStyle = `rgba(255,80,60,${e.hitFx * 0.5})`;
          ctx.beginPath();
          ctx.arc(x, y, R + 10, 0, Math.PI * 2);
          ctx.fill();
        }

        drawHead(ctx, e.friend.look, x, y, R, {
          mouth: 0.35,
          blink: 0,
          squish: 1,
          angry: e.ally ? 0 : 0.8,
          tilt: Math.sin(t * 0.004 + e.id) * 0.08,
        });

        // полоска здоровья
        if (!e.ally && e.maxHp > 1 && !e.dying) {
          const bw = R * 1.7;
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.beginPath();
          ctx.roundRect(x - bw / 2, y - R - 14, bw, 5, 3);
          ctx.fill();
          ctx.fillStyle = "#FF6B4D";
          ctx.beginPath();
          ctx.roundRect(x - bw / 2, y - R - 14, bw * (e.hp / e.maxHp), 5, 3);
          ctx.fill();
        }
        if (e.ally && !e.dying) {
          ctx.fillStyle = "#59FF9E";
          ctx.font = "700 9px Inter, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("СВОЙ", x, y - R - 10);
        }
        ctx.restore();
      }

      // всплывашки
      for (const p of g.pops) {
        const k = p.t / 700;
        ctx.globalAlpha = Math.max(0, k);
        ctx.fillStyle = p.bad ? "#FF4D4D" : "#59FF9E";
        ctx.font = "800 15px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(p.txt, p.x, p.y - (1 - k) * 26);
        ctx.globalAlpha = 1;
      }

      ctx.restore();

      if (g.running && g.elapsed < 4200) {
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = "600 12.5px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Бей чужих. Зелёных своих не трогай.", w / 2, topY - 12);
      }
    },
    [phase, s.friends],
  );

  /** Удар по координате */
  const strike = useCallback(
    (cx: number, cy: number, el: HTMLElement) => {
      const g = G.current;
      if (!g.running) return;
      const r = el.getBoundingClientRect();
      const w = r.width, h = r.height;
      const x = cx - r.left, y = cy - r.top;
      const topY = h * 0.16;
      const doorY = h * 0.82;
      const laneX = (l: number) => w * (0.2 + l * 0.3);
      const R = Math.min(30, w * 0.085);

      let hitOne = false;
      for (const e of g.enemies) {
        if (e.dying) continue;
        const ex = laneX(e.lane);
        const ey = topY + (doorY - topY) * Math.min(1, e.p);
        if (Math.hypot(x - ex, y - ey) > R + 12) continue;

        hitOne = true;
        if (e.ally) {
          // ударил своего
          e.dying = true; e.dead = 1;
          g.score = Math.max(0, g.score - 15);
          setScore(g.score);
          g.pops.push({ x: ex, y: ey, t: 700, txt: "СВОЙ!", bad: true });
          sfx.error();
          haptic("error");
          g.shake = 10;
        } else {
          e.hp -= 1;
          e.hitFx = 1;
          sfx.whack();
          haptic("light");
          if (e.hp <= 0) {
            e.dying = true; e.dead = 1;
            g.kills += 1;
            const gain = 10 + g.wave * 2;
            g.score += gain;
            setScore(g.score);
            g.pops.push({ x: ex, y: ey, t: 700, txt: `+${gain}`, bad: false });
            sfx.coin();
          }
        }
        break;
      }
      if (!hitOne) sfx.dodge?.();
    },
    [],
  );

  const dragging = useRef(false);

  return (
    <div className="absolute inset-0" style={{ background: "var(--bg)" }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          e.preventDefault();
          const el = e.currentTarget as HTMLElement;
          el.setPointerCapture?.(e.pointerId);
          dragging.current = true;
          strike(e.clientX, e.clientY, el);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          strike(e.clientX, e.clientY, e.currentTarget as HTMLElement);
        }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      />

      <GameHUD
        score={score}
        best={best}
        onExit={onExit}
        label="ОЧКИ"
        extra={
          <div
            className="shrink-0 flex items-center"
            style={{
              gap: 4, padding: "9px 11px", borderRadius: "var(--r-md)",
              background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
            }}
          >
            <span style={{ color: lives > 2 ? "#FF4D4D" : "#FF8A3C", lineHeight: 0 }}>
              <Icon name="heart" size={13} />
            </span>
            <span className="t-num" style={{ fontSize: 13 }}>{lives}</span>
          </div>
        }
      />

      {/* номер волны */}
      <div
        className="absolute t-label"
        style={{
          top: "calc(var(--sat) + 74px)", left: 0, right: 0,
          textAlign: "center", fontSize: 9.5, zIndex: 20,
        }}
      >
        ВОЛНА {wave}
      </div>

      <AnimatePresence>
        {phase === "count" && <Countdown n={cd} />}
      </AnimatePresence>

      {phase === "over" && (
        <GameOver
          score={result.score}
          best={best}
          coins={result.coins}
          xp={result.xp}
          onRetry={restart}
          onExit={onExit}
          title="ПРОРВАЛИСЬ"
          sub={`Отбито волн: ${wave}`}
        />
      )}
    </div>
  );
}
