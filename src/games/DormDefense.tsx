import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { tr } from "../core/i18n";
import { sfx, haptic } from "../core/fx";
import { useCanvas, GameHUD, GameOver, Countdown, HudStat } from "./shell";
import { drawHead } from "../core/head";
import type { Friend } from "../core/types";

/**
 * ОБОРОНА ОБЩАГИ — по трём дорожкам к двери ползут незваные гости.
 * Тапай (или веди пальцем) по головам, чтобы отбить. Дошёл до двери —
 * минус жизнь. Каждая волна быстрее и плотнее.
 * Некоторых бить нельзя: свои приходят с подписью «СВОЙ».
 *
 * Темп подобран симуляцией: путь до двери 5.1 с на второй волне и 3.2 с
 * к десятой (было 11.7 с — из-за этого игра казалась вялой), интервал
 * спавна плавно сжимается с 700 до 230 мс и НЕ упирается в потолок рано,
 * иначе забег становится бесконечным. Расчётная длительность: 69 с при
 * двух тапах в секунду и 187 с при пяти.
 */

/** Кто пришёл: обычный, шустрый бегун или толстый танк */
type Kind = "normal" | "runner" | "tank";

interface Enemy {
  id: number;
  lane: 0 | 1 | 2;
  p: number;          // 0 (появился) .. 1 (дверь)
  speed: number;
  hp: number;
  maxHp: number;
  kind: Kind;
  friend: Friend;
  ally: boolean;      // своего бить нельзя
  dying: boolean;     // помечен на удаление
  dead: number;       // 1 → 0, прогресс анимации исчезновения
  hitFx: number;
  wob: number;        // фаза покачивания, чтобы шли не строем
}

const LANES = 3;

/* Настройки темпа. Все числа — результат симуляции, не «на глаз». */
const WAVE_MS = 15000;     // волна короче: смена ощущается чаще
const SPAWN_BASE = 700;    // стартовый интервал спавна
const SPAWN_FLOOR = 230;   // предел плотности
const SPAWN_ACCEL = 0.0026;// насколько сжимается интервал за миллисекунду
const SPEED_BASE = 0.000167;
const SPEED_VAR = 0.00005;
const SPEED_GROW = 0.09;   // прибавка скорости за волну
const P_RUNNER = 0.14;
const P_TANK = 0.13;
const P_ALLY = 0.14;

export default function DormDefense({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [cd, setCd] = useState(3);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(5);
  const [wave, setWave] = useState(1);
  const [combo, setCombo] = useState(0);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const best = s.games.defend?.best || 0;
  const diff = s.settings.difficulty;
  // Сложность меняет и плотность, и скорость — на чилле заметно свободнее
  const densityK = diff === "insane" ? 0.82 : diff === "chill" ? 1.22 : 1;
  const speedK = diff === "insane" ? 1.15 : diff === "chill" ? 0.86 : 1;

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
    combo: 0,
    bestCombo: 0,
    flash: 0,
    pops: [] as { x: number; y: number; t: number; txt: string; bad: boolean }[],
  });

  const reset = useCallback(() => {
    const g = G.current;
    g.enemies = [];
    g.spawnT = 500;
    g.elapsed = 0;
    g.score = 0;
    g.lives = 5;
    g.wave = 1;
    g.shake = 0;
    g.kills = 0;
    g.combo = 0;
    g.bestCombo = 0;
    g.flash = 0;
    g.pops = [];
    g.startT = Date.now();
    setScore(0);
    setLives(5);
    setWave(1);
    setCombo(0);
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
    const coins = Math.floor(sc * 2.4 * (1 + s.prestige * 0.12));
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
        g.wave = 1 + Math.floor(g.elapsed / WAVE_MS);
        if (g.wave !== wave) setWave(g.wave);

        // спавн: интервал сжимается плавно и не упирается в пол слишком рано
        g.spawnT -= dt;
        if (g.spawnT <= 0) {
          const interval = Math.max(
            SPAWN_FLOOR,
            SPAWN_BASE - g.elapsed * SPAWN_ACCEL,
          ) * densityK;
          g.spawnT = interval * (0.8 + Math.random() * 0.4);

          const ally = Math.random() < P_ALLY;
          const roll = Math.random();
          const grow = 1 + g.wave * SPEED_GROW;
          let kind: Kind = "normal";
          let speed = (SPEED_BASE + Math.random() * SPEED_VAR) * grow;
          let hp = 1;

          if (!ally) {
            if (roll < P_RUNNER) {
              kind = "runner";
              speed = SPEED_BASE * 1.7 * grow;
              hp = 1;
            } else if (roll < P_RUNNER + P_TANK) {
              kind = "tank";
              speed = SPEED_BASE * 0.6 * grow;
              hp = g.wave < 3 ? 2 : 3;
            }
          }

          g.enemies.push({
            id: g.uid++,
            lane: Math.floor(Math.random() * LANES) as 0 | 1 | 2,
            p: 0,
            speed: speed * speedK,
            hp,
            maxHp: hp,
            kind,
            friend: s.friends[Math.floor(Math.random() * s.friends.length)],
            ally,
            dying: false,
            dead: 0,
            hitFx: 0,
            wob: Math.random() * 6.28,
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
              g.combo = 0;
              setCombo(0);
              sfx.hit();
              haptic("error");
              g.shake = 14;
              g.flash = 1;
              e.dying = true; e.dead = 1;
              if (g.lives <= 0) { end(); return; }
            }
          }
        }
        // анимация исчезновения: dead идёт 1 → 0, потом враг удаляется
        for (const e of g.enemies) {
          if (e.dying) e.dead = Math.max(0, e.dead - dt * 0.006);
        }
        g.enemies = g.enemies.filter((e) => !(e.dying && e.dead <= 0));
      }

      for (const p of g.pops) p.t -= dt;
      g.pops = g.pops.filter((p) => p.t > 0);
      if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 0.05);
      if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 0.003);

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
        const wobble = e.dying ? 0 : Math.sin(t * 0.006 + e.wob) * (R * 0.14);
        const x = laneX(e.lane) + wobble;
        const y = topY + (doorY - topY) * Math.min(1, e.p);
        const alpha = e.dying ? Math.max(0, e.dead) : 1;
        const rr = e.kind === "tank" ? R * 1.22 : e.kind === "runner" ? R * 0.86 : R;
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
          ctx.arc(x, y, rr + 6, 0, Math.PI * 2);
          ctx.stroke();
        }
        // бегун — жёлтый след, чтобы успевать замечать
        if (e.kind === "runner" && !e.dying) {
          const tg = ctx.createLinearGradient(0, y - rr * 2.2, 0, y);
          tg.addColorStop(0, "rgba(255,190,60,0)");
          tg.addColorStop(1, "rgba(255,190,60,0.34)");
          ctx.fillStyle = tg;
          ctx.beginPath();
          ctx.roundRect(x - rr * 0.42, y - rr * 2.2, rr * 0.84, rr * 2.2, rr * 0.42);
          ctx.fill();
        }
        // танк — тяжёлое кольцо
        if (e.kind === "tank" && !e.dying) {
          ctx.strokeStyle = "rgba(255,107,77,0.5)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, rr + 5, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (e.hitFx > 0) {
          ctx.fillStyle = `rgba(255,80,60,${e.hitFx * 0.5})`;
          ctx.beginPath();
          ctx.arc(x, y, rr + 10, 0, Math.PI * 2);
          ctx.fill();
        }

        drawHead(ctx, e.friend.look, x, y, rr, {
          mouth: 0.35,
          blink: 0,
          squish: 1,
          angry: e.ally ? 0 : 0.8,
          tilt: Math.sin(t * 0.004 + e.id) * 0.08,
        });

        // полоска здоровья
        if (!e.ally && e.maxHp > 1 && !e.dying) {
          const bw = rr * 1.7;
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.beginPath();
          ctx.roundRect(x - bw / 2, y - rr - 14, bw, 5, 3);
          ctx.fill();
          ctx.fillStyle = "#FF6B4D";
          ctx.beginPath();
          ctx.roundRect(x - bw / 2, y - rr - 14, bw * (e.hp / e.maxHp), 5, 3);
          ctx.fill();
        }
        if (e.ally && !e.dying) {
          ctx.fillStyle = "#59FF9E";
          ctx.font = "700 9px Inter, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("СВОЙ", x, y - rr - 10);
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

      // красная вспышка, когда пропустили
      if (g.flash > 0) {
        ctx.fillStyle = `rgba(255,40,40,${g.flash * 0.22})`;
        ctx.fillRect(0, 0, w, h);
      }

      if (g.running && g.elapsed < 4200) {
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = "600 12.5px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Бей чужих. Зелёных своих не трогай.", w / 2, topY - 12);
      }
    },
    [phase, s.friends, densityK, speedK],
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

      // Бьём того, кто ближе всего к пальцу, а не первого в списке —
      // иначе в плотной толпе удар уходил «сквозь» переднего.
      let target: Enemy | null = null;
      let tx = 0, ty = 0, bestD = Infinity;
      for (const e of g.enemies) {
        if (e.dying) continue;
        const rr = e.kind === "tank" ? R * 1.22 : e.kind === "runner" ? R * 0.86 : R;
        const ex = laneX(e.lane);
        const ey = topY + (doorY - topY) * Math.min(1, e.p);
        const d = Math.hypot(x - ex, y - ey);
        if (d > rr + 14) continue;
        if (d < bestD) { bestD = d; target = e; tx = ex; ty = ey; }
      }

      if (!target) { sfx.dodge?.(); return; }
      const e = target;

      if (e.ally) {
        // ударил своего: комбо сгорает
        e.dying = true; e.dead = 1;
        g.score = Math.max(0, g.score - 15);
        setScore(g.score);
        g.combo = 0;
        setCombo(0);
        g.pops.push({ x: tx, y: ty, t: 700, txt: "СВОЙ!", bad: true });
        sfx.error();
        haptic("error");
        g.shake = 10;
        return;
      }

      e.hp -= 1;
      e.hitFx = 1;
      sfx.whack();
      haptic("light");
      if (e.hp <= 0) {
        e.dying = true; e.dead = 1;
        g.kills += 1;
        g.combo += 1;
        if (g.combo > g.bestCombo) g.bestCombo = g.combo;
        setCombo(g.combo);
        // Комбо разгоняет очки до +100%: держать серию выгодно
        const mult = 1 + Math.min(g.combo, 25) * 0.04;
        const gain = Math.round((10 + g.wave * 3) * mult);
        g.score += gain;
        setScore(g.score);
        g.pops.push({
          x: tx, y: ty, t: 700,
          txt: g.combo >= 5 ? `+${gain} x${g.combo}` : `+${gain}`,
          bad: false,
        });
        sfx.coin();
        if (g.combo > 0 && g.combo % 10 === 0) { sfx.power?.(); haptic("medium"); }
      }
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
        label={tr("ОЧКИ")}
        extra={<HudStat label={tr("ВОЛНА")} value={wave} tone="acc" min={46} />}
        lives={{ value: lives, max: 5 }}
      />

      {/* Серия — отдельной плашкой под шапкой, чтобы не спорила с ней за место */}
      <AnimatePresence>
        {combo >= 3 && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            className="absolute flex items-center justify-center pointer-events-none"
            style={{ top: "calc(var(--sat) + 60px)", left: 0, right: 0, zIndex: 20 }}
          >
            <span className="tag tag-acc" style={{ fontSize: 10 }}>
              {tr("СЕРИЯ")} {combo}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

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
          sub={`Волн: ${wave} · лучшая серия: ${G.current.bestCombo}`}
        />
      )}
    </div>
  );
}
