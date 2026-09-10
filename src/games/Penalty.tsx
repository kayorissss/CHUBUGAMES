import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useGame } from "../core/store";
import { scene } from "../core/palette";
import { sfx, haptic } from "../core/fx";
import { useCanvas, GameHUD, GameOver, Countdown, HudStat } from "./shell";
import { drawHead } from "../core/head";
import { tr } from "../core/i18n";

/**
 * ПЕНАЛЬТИ ЗА ГАРАЖАМИ — бьёшь свайпом, вратарь прыгает.
 *
 * Ворота разбиты на 5 зон. Вратарь заранее «читает» игру: чем выше счёт,
 * тем чаще угадывает сторону. Чтобы это не превращалось в лотерею, есть
 * подсказка — вратарь чуть смещается к той стороне, куда собрался
 * прыгать, за 250 мс до удара. Наблюдательный игрок это ловит.
 *
 * Три промаха — конец. Попадание в девятку даёт двойные очки.
 */

const LIVES = 3;
const BALL_R = 14;

type Zone = 0 | 1 | 2 | 3 | 4;   // слева-низ, слева-верх, центр, справа-верх, справа-низ

interface Pop { x: number; y: number; t: number; txt: string; col: string }

export default function Penalty({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [cd, setCd] = useState(3);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [streak, setStreak] = useState(0);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const best = s.games.penalty?.best || 0;
  const hard = s.settings.difficulty;
  // базовый шанс, что вратарь пойдёт в правильную сторону
  const readBase = hard === "insane" ? 0.42 : hard === "chill" ? 0.16 : 0.28;

  const keeper = s.friends[Math.min(2, s.friends.length - 1)];

  const G = useRef({
    running: false,
    score: 0,
    lives: LIVES,
    streak: 0,
    shots: 0,
    startT: 0,
    // мяч
    bx: 0, by: 0, bvx: 0, bvy: 0, bScale: 1,
    flying: false,
    // вратарь
    kx: 0, ky: 0, kTarget: 0, kJump: 0, kDive: 0,
    plannedZone: 2 as Zone,
    telegraph: 0,     // 0..1 — насколько уже качнулся
    // прицел
    aiming: false, ax: 0, ay: 0, ox: 0, oy: 0,
    resolveT: 0,      // мс до подведения итога
    resolved: false,
    pops: [] as Pop[],
    shake: 0,
    flash: 0,
    w: 0, h: 0,
    goalX: 0, goalY: 0, goalW: 0, goalH: 0,
  });

  const nextShot = useCallback(() => {
    const g = G.current;
    g.bx = g.w / 2;
    g.by = g.h - 92;
    g.bvx = 0; g.bvy = 0; g.bScale = 1;
    g.flying = false;
    g.resolved = false;
    g.resolveT = 0;
    g.telegraph = 0;
    g.kDive = 0;
    g.kx = g.goalX + g.goalW / 2;
    // вратарь заранее решает, куда прыгнет
    const read = Math.min(0.6, readBase + g.score * 0.012);
    g.plannedZone = (Math.random() < read ? -1 : Math.floor(Math.random() * 5)) as Zone;
  }, [readBase]);

  const reset = useCallback((w: number, h: number) => {
    const g = G.current;
    g.w = w; g.h = h;
    g.goalW = Math.min(w * 0.82, 320);
    g.goalH = g.goalW * 0.42;
    g.goalX = (w - g.goalW) / 2;
    g.goalY = h * 0.20;
    g.ky = g.goalY + g.goalH - 34;
    g.score = 0; g.lives = LIVES; g.streak = 0; g.shots = 0;
    g.pops = []; g.shake = 0; g.flash = 0;
    g.startT = Date.now();
    nextShot();
    setScore(0); setLives(LIVES); setStreak(0);
  }, [nextShot]);

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
    const coins = Math.floor(sc * 38 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 8 + 20);
    setResult({ score: sc, coins, xp });
    setPhase("over");
    sfx.gameOver();
    haptic("error");
    addCoins(coins);
    addXp(xp);
    finishGame("penalty", sc, Date.now() - g.startT);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  /** В какую зону летит мяч по точке в воротах */
  const zoneOf = useCallback((x: number, y: number): Zone => {
    const g = G.current;
    const t = (x - g.goalX) / g.goalW;         // 0..1
    const high = y < g.goalY + g.goalH * 0.5;
    if (t < 0.33) return high ? 1 : 0;
    if (t > 0.67) return high ? 3 : 4;
    return 2;
  }, []);

  const onDown = useCallback((e: React.PointerEvent) => {
    const g = G.current;
    if (!g.running || g.flying) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    g.aiming = true;
    g.ox = g.bx; g.oy = g.by;
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
    if (!g.aiming || g.flying) return;
    g.aiming = false;
    const dx = g.ax - g.ox;
    const dy = g.ay - g.oy;
    if (dy > -30) return;                 // свайп должен быть вверх
    const len = Math.hypot(dx, dy);
    const t = Math.min(1, len / 260);
    // куда придёт мяч в плоскости ворот
    const aimX = g.bx + dx * 1.5;
    const aimY = g.goalY + g.goalH * (1 - Math.min(1, t * 1.25)) * 0.85 + 8;
    g.bvx = (aimX - g.bx) / 620;
    g.bvy = (aimY - g.by) / 620;
    g.flying = true;
    g.resolveT = 620;
    g.shots += 1;
    sfx.swoosh();
    haptic("medium");

    // вратарь бросается: если «прочитал» — в нужную зону, иначе в свою
    const z = zoneOf(aimX, aimY);
    if ((g.plannedZone as number) === -1) g.plannedZone = z;
  }, [zoneOf]);

  const canvasRef = useCanvas((ctx, w, h, dt) => {
    const P = scene();
    const g = G.current;
    if (!g.goalW) reset(w, h);

    const zoneX = (z: Zone) =>
      g.goalX + g.goalW * (z === 0 || z === 1 ? 0.16 : z === 2 ? 0.5 : 0.84);
    const zoneY = (z: Zone) =>
      g.goalY + g.goalH * (z === 1 || z === 3 ? 0.32 : 0.72);

    /* ---------- логика ---------- */
    if (g.running) {
      // телеграф: перед ударом вратарь качается к своей зоне
      if (!g.flying && (g.plannedZone as number) !== -1) {
        g.telegraph = Math.min(1, g.telegraph + dt * 0.0006);
        const tx = zoneX(g.plannedZone);
        const centre = g.goalX + g.goalW / 2;
        g.kx = centre + (tx - centre) * 0.16 * g.telegraph;
      }

      if (g.flying) {
        g.bx += g.bvx * dt;
        g.by += g.bvy * dt;
        g.bScale = Math.max(0.42, g.bScale - dt * 0.0009);   // улетает вдаль

        // вратарь летит в свою зону
        const tx = zoneX(g.plannedZone);
        const ty = zoneY(g.plannedZone);
        g.kx += (tx - g.kx) * Math.min(1, dt * 0.008);
        g.ky += (ty - g.ky) * Math.min(1, dt * 0.006);
        g.kDive = Math.min(1, g.kDive + dt * 0.004);

        g.resolveT -= dt;
        if (g.resolveT <= 0 && !g.resolved) {
          g.resolved = true;
          const hitZone = zoneOf(g.bx, g.by);
          const inGoal =
            g.bx > g.goalX + 6 && g.bx < g.goalX + g.goalW - 6 &&
            g.by > g.goalY && g.by < g.goalY + g.goalH;
          const saved = hitZone === g.plannedZone && inGoal;
          const topCorner = inGoal && (hitZone === 1 || hitZone === 3);

          if (inGoal && !saved) {
            const pts = topCorner ? 2 : 1;
            g.score += pts;
            g.streak += 1;
            setScore(g.score); setStreak(g.streak);
            g.pops.push({
              x: w / 2, y: g.goalY + g.goalH + 30, t: 1,
              txt: topCorner ? tr("ДЕВЯТКА") : tr("ГОЛ"),
              col: topCorner ? "#FFD86B" : "var(--ok)",
            });
            g.flash = 1;
            sfx.coin();
            haptic("success");
          } else {
            g.lives -= 1;
            g.streak = 0;
            setLives(g.lives); setStreak(0);
            g.pops.push({
              x: w / 2, y: g.goalY + g.goalH + 30, t: 1,
              txt: saved ? tr("ВЗЯЛ") : tr("МИМО"),
              col: "var(--danger)",
            });
            g.shake = 12;
            sfx.error();
            haptic("error");
          }
          setTimeout(() => {
            if (G.current.lives <= 0) end();
            else nextShot();
          }, 780);
        }
      }
    }

    for (const p of g.pops) p.t -= dt * 0.0011;
    g.pops = g.pops.filter((p) => p.t > 0);
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 0.03);
    if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 0.002);

    /* ---------- отрисовка ---------- */
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#0a1410");
    grd.addColorStop(0.55, "#12251a");
    grd.addColorStop(1, "#0f1c15");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

    // газон в перспективе — полосы
    for (let i = 0; i < 9; i++) {
      const y0 = g.goalY + g.goalH + i * i * 3.4;
      if (y0 > h) break;
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.022)" : "rgba(0,0,0,0.10)";
      ctx.fillRect(0, y0, w, i * 3.4 + 10);
    }

    // ворота
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(g.goalX, g.goalY + g.goalH);
    ctx.lineTo(g.goalX, g.goalY);
    ctx.lineTo(g.goalX + g.goalW, g.goalY);
    ctx.lineTo(g.goalX + g.goalW, g.goalY + g.goalH);
    ctx.stroke();
    // сетка
    ctx.strokeStyle = "rgba(255,255,255,0.13)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 12; i++) {
      const x = g.goalX + (g.goalW / 12) * i;
      ctx.beginPath(); ctx.moveTo(x, g.goalY); ctx.lineTo(x, g.goalY + g.goalH); ctx.stroke();
    }
    for (let i = 1; i < 6; i++) {
      const y = g.goalY + (g.goalH / 6) * i;
      ctx.beginPath(); ctx.moveTo(g.goalX, y); ctx.lineTo(g.goalX + g.goalW, y); ctx.stroke();
    }

    // подсветка девяток
    ctx.strokeStyle = "rgba(255,216,107,0.30)";
    ctx.lineWidth = 2;
    for (const z of [1, 3] as Zone[]) {
      ctx.beginPath();
      ctx.roundRect(zoneX(z) - 34, g.goalY + 6, 68, g.goalH * 0.36, 4);
      ctx.stroke();
    }

    // вратарь
    const kSquish = g.kDive * 0.35;
    ctx.save();
    ctx.translate(g.kx, g.ky);
    ctx.rotate(((g.kx - (g.goalX + g.goalW / 2)) / g.goalW) * 0.9 * g.kDive);
    /**
     * Руки рисуем ДО головы, чтобы они уходили за вратаря, а не лежали
     * поверх лица.
     *
     * Плечо раньше стояло в точке y=12 при полувысоте головы 28.6 —
     * это 42% высоты лица сверху, то есть руки росли прямо изо рта.
     * Теперь крепление считается от геометрии тела: линия плеч у
     * drawBody начинается на y = h*1.02, поэтому берём чуть ниже
     * подбородка и разводим по ширине корпуса.
     */
    const HR = 27;                     // радиус головы вратаря
    const HH = HR * 1.06;              // полувысота головы
    const SHOULDER_Y = HH * 1.02 + 4;  // линия плеч, под подбородком
    const SHOULDER_X = HR * 0.92;      // разведение плеч по корпусу

    for (const sx of [-1, 1]) {
      const reach = g.kDive;                     // 0 стоит, 1 в прыжке
      const sh = { x: sx * SHOULDER_X, y: SHOULDER_Y };
      const el = { x: sx * (SHOULDER_X + 14 + reach * 12), y: SHOULDER_Y - 10 - reach * 20 };
      const wr = { x: sx * (SHOULDER_X + 24 + reach * 24), y: SHOULDER_Y - 24 - reach * 38 };

      // рукав
      ctx.strokeStyle = "#2e3540";
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(el.x, el.y);
      ctx.lineTo(wr.x, wr.y);
      ctx.stroke();
      // светлая полоса по рукаву, чтобы рука читалась на тёмном фоне
      ctx.strokeStyle = "#4a5563";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(el.x, el.y);
      ctx.lineTo(wr.x, wr.y);
      ctx.stroke();

      // перчатка: ладонь + четыре пальца веером + большой палец
      const ang = Math.atan2(wr.y - el.y, wr.x - el.x);
      ctx.save();
      ctx.translate(wr.x, wr.y);
      ctx.rotate(ang);
      ctx.fillStyle = "#ffb020";
      ctx.beginPath();
      ctx.roundRect(-4, -7, 13, 14, 4);
      ctx.fill();
      ctx.strokeStyle = "#c8791a";
      ctx.lineWidth = 3.2;
      ctx.lineCap = "round";
      for (let f = 0; f < 4; f++) {
        const fa = -0.42 + f * 0.28;
        ctx.beginPath();
        ctx.moveTo(8, -5 + f * 3.4);
        ctx.lineTo(8 + Math.cos(fa) * 9, -5 + f * 3.4 + Math.sin(fa) * 9);
        ctx.stroke();
      }
      // большой палец вбок
      ctx.beginPath();
      ctx.moveTo(1, 6);
      ctx.lineTo(-3, 13);
      ctx.stroke();
      ctx.restore();
    }

    // Голова и корпус поверх рук — плечи перекрывают место крепления,
    // и рука выглядит растущей из-за спины, а не приклеенной к лицу.
    drawHead(ctx, keeper.look, 0, 0, HR, { body: true, squish: kSquish, mouth: g.kDive * 0.7 });
    ctx.restore();

    // мяч
    const r = BALL_R * g.bScale;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    if (!g.flying) {
      ctx.beginPath();
      ctx.ellipse(g.bx, g.by + r * 0.9, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const bg = ctx.createRadialGradient(g.bx - r * 0.3, g.by - r * 0.35, 1, g.bx, g.by, r);
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(1, "#c4ccd4");
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(g.bx, g.by, r, 0, Math.PI * 2); ctx.fill();
    // пятиугольники
    ctx.fillStyle = "#20262e";
    ctx.beginPath(); ctx.arc(g.bx, g.by, r * 0.34, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + g.bx * 0.02;
      ctx.beginPath();
      ctx.arc(g.bx + Math.cos(a) * r * 0.68, g.by + Math.sin(a) * r * 0.68, r * 0.17, 0, Math.PI * 2);
      ctx.fill();
    }

    // прицел
    if (g.aiming && !g.flying) {
      const dx = g.ax - g.ox, dy = g.ay - g.oy;
      if (dy < -20) {
        const t = Math.min(1, Math.hypot(dx, dy) / 260);
        const aimX = g.bx + dx * 1.5;
        const aimY = g.goalY + g.goalH * (1 - Math.min(1, t * 1.25)) * 0.85 + 8;
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(g.bx, g.by); ctx.lineTo(aimX, aimY); ctx.stroke();
        ctx.setLineDash([]);
        // маркер
        ctx.strokeStyle = P.acc;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(aimX, aimY, 15, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(aimX - 20, aimY); ctx.lineTo(aimX + 20, aimY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(aimX, aimY - 20); ctx.lineTo(aimX, aimY + 20); ctx.stroke();
      }
    }

    ctx.restore();

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(89,255,158,${g.flash * 0.12})`;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.textAlign = "center";
    for (const p of g.pops) {
      ctx.globalAlpha = Math.min(1, p.t * 1.6);
      ctx.fillStyle = p.col;
      ctx.font = "800 24px Unbounded, Inter, system-ui, sans-serif";
      ctx.fillText(p.txt, p.x, p.y - (1 - p.t) * 26);
    }
    ctx.globalAlpha = 1;

    if (g.running && g.shots === 0 && !g.flying) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "600 13px Inter, system-ui, sans-serif";
      ctx.fillText(tr("Свайп вверх — удар. Куда ведёшь, туда летит"), w / 2, h - 22);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "play") {
      const c = document.querySelector<HTMLCanvasElement>("[data-penalty-canvas]");
      const r = c?.getBoundingClientRect();
      reset(r?.width || 360, r?.height || 640);
      G.current.running = true;
    }
  }, [phase, reset]);

  return (
    <div className="absolute inset-0" style={{ background: "var(--bg)" }}>
      <canvas
        ref={canvasRef}
        data-penalty-canvas
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
        label={tr("ГОЛЫ")}
        extra={streak > 1 ? <HudStat label={tr("СЕРИЯ")} value={`×${streak}`} tone="warn" min={44} /> : undefined}
        lives={{ value: lives, max: LIVES }}
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
          title={tr("ПРОМАЗАЛ")}
          sub={tr("Три осечки подряд")}
        />
      )}
    </div>
  );
}
