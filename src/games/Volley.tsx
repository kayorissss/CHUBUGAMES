import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useGame } from "../core/store";
import { scene, alpha } from "../core/palette";
import { sfx, haptic } from "../core/fx";
import { useCanvas, GameHUD, GameOver, Countdown, HudStat } from "./shell";
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
/**
 * Высота сетки — ДОЛЯ высоты экрана, а не пиксели.
 * Раньше сетка была h*0.34-40 ≈ 246 px при голове 30 px: мяч бился на
 * 170 px НИЖЕ верха сетки, и перелёт был геометрически невозможен для
 * большинства позиций. Перебор по пяти размерам экрана дал 0.19.
 */
const NET_K = 0.19;
/** Отступ голов от сетки — доля ширины. Меньше 0.06 — головы упираются
 *  в сетку и мяч выставляется уже на чужой половине. */
const GAP_K = 0.06;
const NET_HALF = 4;
const LIVES = 3;
/** Запас над верхом сетки, px */
const NET_CLEAR = 45;
/** Глубина удара: центр головы = короткий пас, край = глубокий кросс */
const HIT_NEAR = 0.3;
const HIT_FAR = 0.92;

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
  /**
   * Сложность соперника. Подобрано перебором (скрипты /tmp/volley21..25):
   * при этих числах розыгрыш длится 3-5 с по медиане, соперник реально
   * забивает, и результат одинаков на экранах от 320 до 430 px.
   */
  const aiSpd = hard === "insane" ? 0.86 : hard === "chill" ? 0.58 : 0.72;
  const aiErr = hard === "insane" ? 52 : hard === "chill" ? 80 : 64;
  const aiReactMs = hard === "insane" ? 150 : hard === "chill" ? 230 : 190;

  /**
   * Колбэк useCanvas пересоздаётся только при смене phase, поэтому
   * замыкание запомнило бы первые значения сложности. Держим их в ref
   * и читаем внутри цикла — иначе смена сложности не подействует.
   */
  const diff = useRef({ aiSpd, aiErr, aiReactMs });
  diff.current = { aiSpd, aiErr, aiReactMs };

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
    aiReact: 0,                // сколько ещё думает соперник
    aiTarget: 0,               // куда он бежит
    lastHit: null as "my" | "ai" | null,
  });

  const serve = useCallback((w: number, h: number, toMe: boolean) => {
    const g = G.current;
    // Подача летит НАД сеткой в середину принимающей половины.
    // Старые числа (x=0.24w, vx=0.13) при новой, более низкой сетке
    // втыкали мяч прямо в неё на всех размерах экрана — проверено
    // прогоном /tmp/serve2.mjs. Стартуем ближе к сетке и быстрее.
    g.ball.x = toMe ? w * 0.32 : w * 0.68;
    g.ball.y = h * 0.18;
    g.ball.vx = (toMe ? 1 : -1) * 0.19;
    g.ball.vy = 0.02;
    g.ball.spin = 0;
    g.trail = [];
    g.freeze = 420;
    // без сброса тот, кто бил последним, не сможет принять новую подачу
    g.lastHit = null;
    g.aiReact = 0;
    g.aiTarget = w * 0.26;
  }, []);

  const reset = useCallback((w: number, h: number) => {
    const g = G.current;
    g.w = w; g.h = h;
    const headY0 = h - 46 - HEAD_R;
    g.my = { x: w * 0.74, y: headY0 };
    g.ai = { x: w * 0.26, y: headY0, vy: 0 };
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
    const P = scene();
    const g = G.current;
    if (!g.w) reset(w, h);
    g.w = w; g.h = h;

    const netX = w / 2;
    const groundY = h - 46;
    const netTop = groundY - h * NET_K;
    const band = NET_HALF + BALL_R;
    const minGap = band + w * GAP_K;
    // границы для голов: вплотную к сетке подходить нельзя
    const myLo = netX + minGap + HEAD_R, myHi = w - HEAD_R - 4;
    const aiLo = HEAD_R + 4, aiHi = netX - minGap - HEAD_R;
    const headY = groundY - HEAD_R;

    /* ---------- логика ---------- */
    if (g.running) {
      if (g.freeze > 0) g.freeze -= dt;

      // мой игрок едет к пальцу с ограничением скорости — плавно
      if (g.touch != null) {
        const target = Math.max(myLo, Math.min(myHi, g.touch));
        const d = target - g.my.x;
        g.my.x += Math.max(-0.95 * dt, Math.min(0.95 * dt, d * 0.02 * dt));
      }
      g.my.x = Math.max(myLo, Math.min(myHi, g.my.x));
      g.my.y = headY;

      /**
       * Соперник. Он НЕ следует за мячом кадр в кадр — он получает цель
       * в момент моего удара (куда мяч приземлится) и бежит туда с
       * задержкой aiReactMs и ошибкой aiErr. Раньше он тянулся к мячу
       * каждый кадр и потому был неберучим: симуляция давала 100%
       * розыгрышей, упиравшихся в лимит времени.
       */
      if (g.aiReact > 0) g.aiReact -= dt;
      const ad = g.aiTarget - g.ai.x;
      g.ai.x += Math.max(-diff.current.aiSpd * dt, Math.min(diff.current.aiSpd * dt, ad * 0.02 * dt));
      g.ai.x = Math.max(aiLo, Math.min(aiHi, g.ai.x));
      g.ai.y = headY;

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
        if (b.x + BALL_R > netX - NET_HALF && b.x - BALL_R < netX + NET_HALF && b.y > netTop) {
          b.vx = b.x < netX ? -Math.abs(b.vx) * 0.8 : Math.abs(b.vx) * 0.8;
          b.x += b.vx > 0 ? 3 : -3;
          sfx.hit();
        }

        /**
         * Проверка траектории прогоном вперёд.
         *
         * Замкнутая формула здесь врёт: полоса сетки имеет ширину
         * 2*(NET_HALF+BALL_R), мяч входит в неё на подъёме, а выходит уже
         * на снижении — клиренс надо соблюсти на ОБЕИХ кромках. Перебор
         * показал, что единственный надёжный способ — прогнать полёт
         * шагами и убедиться, что он реально перелетает.
         */
        const flightOk = (sx: number, sy: number, vx0: number, vy0: number) => {
          let x = sx, y = sy, vy = vy0, t = 0;
          while (t < 9000) {
            t += 16.7; vy += GRAV * 16.7; x += vx0 * 16.7; y += vy * 16.7;
            if (y < BALL_R + 60) return null;
            if (x + BALL_R > netX - NET_HALF && x - BALL_R < netX + NET_HALF && y > netTop) return null;
            if (y + BALL_R >= groundY) return { land: x };
            if (x < BALL_R || x > w - BALL_R) return null;
          }
          return null;
        };

        /** Подобрать удар из sx в targetX, который реально перелетит сетку */
        const solveTo = (sx: number, sy: number, targetX: number) => {
          const dx = targetX - sx;
          if (Math.abs(dx) < 2) return null;
          let base = 0;
          for (const edge of [netX - band, netX + band]) {
            const f = (edge - sx) / dx;
            if (f <= 0.02 || f >= 0.98) continue;
            const num = 2 * (sy + f * (groundY - sy) - (netTop - NET_CLEAR));
            const den = GRAV * f * (1 - f);
            if (num <= 0) continue;
            base = Math.max(base, Math.sqrt(num / den));
          }
          if (base <= 0) return null;
          for (let m = 1; m <= 2.0; m += 0.12) {
            const T = base * m;
            const vy = (groundY - sy - 0.5 * GRAV * T * T) / T;
            if (vy >= 0) continue;
            const ok = flightOk(sx, sy, dx / T, vy);
            if (ok) return { vx: dx / T, vy, land: ok.land };
          }
          return null;
        };

        /** Желаемая цель, а если она недостижима — ближайшая достижимая */
        const solveSafe = (sx: number, sy: number, want: number, mine: boolean) => {
          const lo = mine ? BALL_R + 8 : netX + band + 8;
          const hi = mine ? netX - band - 8 : w - BALL_R - 8;
          const cl = (v: number) => Math.max(lo, Math.min(hi, v));
          const cands = [cl(want)];
          for (let d = 18; d <= hi - lo; d += 18) { cands.push(cl(want - d)); cands.push(cl(want + d)); }
          for (const tx of cands) { const r = solveTo(sx, sy, tx); if (r) return r; }
          return null;
        };

        /**
         * Удар головой. Точка касания решает глубину: край головы,
         * обращённый к сопернику, — глубокий кросс, центр — короткий пас.
         * Мяч стартует НАД головой, иначе у сетки он выставлялся уже на
         * чужой половине и решения не существовало.
         */
        const hitHead = (hx: number, mine: boolean) => {
          if (g.lastHit === (mine ? "my" : "ai")) return false;
          const d = Math.hypot(b.x - hx, b.y - headY);
          if (d > BALL_R + HEAD_R) return false;

          const nxRaw = Math.max(-1, Math.min(1, (b.x - hx) / (BALL_R + HEAD_R)));
          const toward = mine ? -nxRaw : nxRaw;
          const k = (toward + 1) / 2;
          const depth = HIT_NEAR + (HIT_FAR - HIT_NEAR) * k;
          const sy = headY - (HEAD_R + BALL_R + 1);
          const want = mine ? netX * (1 - depth) : netX + netX * depth;

          const r = solveSafe(hx, sy, want, mine);
          if (!r) return false;

          b.vx = r.vx; b.vy = r.vy; b.x = hx; b.y = sy;
          g.lastHit = mine ? "my" : "ai";

          if (mine) {
            // соперник только теперь узнаёт, куда бежать
            g.aiReact = diff.current.aiReactMs;
            g.aiTarget = Math.max(aiLo, Math.min(aiHi,
              r.land + (Math.random() * 2 - 1) * diff.current.aiErr));
          }
          return true;
        };

        if (hitHead(g.my.x, true)) {
          g.rally += 1;
          setRally(g.rally);
          g.myBounce = 1;
          sfx.tap();
          haptic("light");
        }
        if (hitHead(g.ai.x, false)) {
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
            g.pops.push({ x: w * 0.74, y: h * 0.5, t: 1, txt: tr("ПРОПУСТИЛ"), col: "var(--danger)" });
            sfx.error();
            haptic("error");
            g.shake = 12;
            if (g.lives <= 0) { end(); return; }
            serve(w, h, true);
          } else {
            g.score += 1;
            setScore(g.score);
            g.pops.push({ x: w * 0.26, y: h * 0.5, t: 1, txt: `${tr("ОЧКО")} +1`, col: "var(--ok)" });
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
    grd.addColorStop(0, P.bg0);
    grd.addColorStop(1, P.bg2);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

    // пол
    ctx.fillStyle = P.surface2;
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.strokeStyle = alpha("--text", 0.10);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke();

    // Сетка. Ширину рисуем ровно по полосе столкновения (NET_HALF),
    // иначе мяч визуально проходит сквозь неё или отскакивает от воздуха.
    ctx.fillStyle = P.line;
    ctx.fillRect(netX - NET_HALF, netTop, NET_HALF * 2, groundY - netTop);
    ctx.strokeStyle = alpha("--text", 0.16);
    ctx.lineWidth = 1;
    for (let y = netTop + 6; y < groundY; y += 11) {
      ctx.beginPath(); ctx.moveTo(netX - NET_HALF, y); ctx.lineTo(netX + NET_HALF, y); ctx.stroke();
    }
    // белая кромка — по ней игрок целится
    ctx.fillStyle = P.text;
    ctx.fillRect(netX - NET_HALF - 3, netTop - 4, NET_HALF * 2 + 6, 5);

    // след мяча
    for (const t of g.trail) {
      if (t.a <= 0) continue;
      ctx.fillStyle = alpha("--text", t.a * 0.16);
      ctx.beginPath(); ctx.arc(t.x, t.y, BALL_R * 0.72, 0, Math.PI * 2); ctx.fill();
    }

    // головы игроков
    const drawGuy = (x: number, y: number, look: typeof me.look, squish: number) => {
      // тень
      ctx.fillStyle = alpha("--n-000", 0.5, "#000000");
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
        extra={rally > 2 ? <HudStat label={tr("РОЗЫГРЫШ")} value={`×${rally}`} tone="ok" min={50} /> : undefined}
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
          title={tr("МАТЧ ОКОНЧЕН")}
          sub={tr("Мяч на полу трижды")}
        />
      )}
    </div>
  );
}
