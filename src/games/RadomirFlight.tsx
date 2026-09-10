import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useGame } from "../core/store";
import { tr } from "../core/i18n";
import { sfx, haptic } from "../core/fx";
import { useCanvas, GameHUD, GameOver, Countdown } from "./shell";
import { drawHead } from "../core/head";

/**
 * ПОЛЁТ РАДОМИРА — держи палец, чтобы набирать высоту, отпусти чтобы падать.
 * Не тап-тап-тап как в флаппи, а плавная тяга: удобнее на телефоне
 * и лучше ложится на «вести пальцем», а не долбить по экрану.
 * Пролетай в проёмы между партами.
 */

interface Gate {
  x: number;      // px
  gapY: number;   // 0..1 центр проёма
  gap: number;    // 0..1 высота проёма
  passed: boolean;
}

export default function RadomirFlight({ onExit }: { onExit: () => void }) {
  const { s, mainFriend, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [cd, setCd] = useState(3);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const best = s.games.flap?.best || 0;
  const diff = s.settings.difficulty;
  /**
   * Числа пересчитаны, а не подобраны на глаз (/tmp/flight2.mjs).
   *
   * Как было: проёмы ставились в полосе 0.24…0.76 (разброс 0.52), а тяга
   * давала максимум 0.00075 доли высоты в мс. На normal перелёт из самого
   * нижнего проёма в самый верхний занимал 935 мс при окне между воротами
   * 930 мс — то есть запас −5 мс, на insane −275 мс. Игрок физически не
   * успевал, полёт ощущался «тяжёлым и кривым».
   *
   * Стало: проёмы разнесены слабее и по-разному на разных сложностях,
   * тяга и падение бодрее, ворота чуть дальше друг от друга. Запас на
   * манёвр: chill 683 мс, normal 385 мс, insane 155 мс.
   */
  const GAP = diff === "insane" ? 0.29 : diff === "chill" ? 0.42 : 0.35;
  const SPEED = diff === "insane" ? 0.275 : diff === "chill" ? 0.185 : 0.225;
  /** Разброс центров проёмов по высоте */
  const SPREAD = diff === "insane" ? 0.38 : diff === "chill" ? 0.5 : 0.44;
  /** Множитель расстояния между воротами (в ширинах экрана) */
  const SPACING_K = diff === "insane" ? 0.68 : diff === "chill" ? 0.72 : 0.7;

  const G = useRef({
    y: 0.5,          // 0..1 позиция героя
    v: 0,            // скорость
    thrust: false,
    gates: [] as Gate[],
    dist: 0,
    score: 0,
    running: false,
    startT: 0,
    shake: 0,
    trail: [] as { x: number; y: number; a: number }[],
    tilt: 0,
  });

  const reset = useCallback(() => {
    const g = G.current;
    g.y = 0.42;
    g.v = 0;
    g.thrust = false;
    g.gates = [];
    g.dist = 0;
    g.score = 0;
    g.shake = 0;
    g.trail = [];
    g.tilt = 0;
    g.startT = Date.now();
    setScore(0);
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
    const coins = Math.floor(sc * 26 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 5 + 15);
    setResult({ score: sc, coins, xp });
    setPhase("over");
    sfx.gameOver();
    haptic("error");
    addCoins(coins);
    addXp(xp);
    finishGame("flap", sc, Date.now() - g.startT);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  const canvasRef = useCanvas(
    (ctx, w, h, dt, t) => {
      const g = G.current;
      const HERO_X = w * 0.28;
      const HERO_R = Math.min(26, w * 0.075);

      if (g.running) {
        // тяга/гравитация; ускорение в долях высоты за мс²
        g.v += (g.thrust ? -0.0000042 : 0.0000032) * dt;
        g.v = Math.max(-0.00095, Math.min(0.00095, g.v));
        g.y += g.v * dt;
        // наклон догоняет плавнее (было 0.006 — герой «щёлкал» между углами)
        g.tilt += ((g.thrust ? -0.32 : 0.4) - g.tilt) * Math.min(1, dt * 0.0042);

        // потолок и пол
        if (g.y < 0.05) { g.y = 0.05; g.v = 0; }
        if (g.y > 0.95) { g.y = 0.95; sfx.hit(); g.shake = 12; end(); }

        // ворота
        g.dist += SPEED * dt;
        const spacing = w * SPACING_K;
        const lastX = g.gates.length ? g.gates[g.gates.length - 1].x : w * 0.9;
        if (lastX < w + spacing) {
          g.gates.push({
            x: lastX + spacing,
            // центр проёма держим в полосе SPREAD вокруг середины и не
            // даём соседним воротам прыгать с края на край
            gapY: (() => {
              const lo = 0.5 - SPREAD / 2;
              const prev = g.gates.length ? g.gates[g.gates.length - 1].gapY : 0.5;
              const want = lo + Math.random() * SPREAD;
              const step = SPREAD * 0.62;   // максимальный скачок между воротами
              return Math.max(lo, Math.min(lo + SPREAD, prev + Math.max(-step, Math.min(step, want - prev))));
            })(),
            gap: GAP,
            passed: false,
          });
        }
        for (const gt of g.gates) gt.x -= SPEED * dt;
        g.gates = g.gates.filter((gt) => gt.x > -w * 0.3);

        // столкновения + счёт
        for (const gt of g.gates) {
          const halfW = w * 0.07;
          const heroY = g.y * h;
          const gapTop = (gt.gapY - gt.gap / 2) * h;
          const gapBot = (gt.gapY + gt.gap / 2) * h;
          const overlapX = Math.abs(gt.x - HERO_X) < halfW + HERO_R * 0.8;
          if (overlapX && (heroY - HERO_R * 0.75 < gapTop || heroY + HERO_R * 0.75 > gapBot)) {
            sfx.hit();
            haptic("error");
            g.shake = 14;
            end();
            break;
          }
          if (!gt.passed && gt.x < HERO_X - halfW) {
            gt.passed = true;
            g.score += 1;
            setScore(g.score);
            sfx.coin();
            haptic("light");
          }
        }

        // след
        g.trail.push({ x: HERO_X, y: g.y * h, a: 1 });
        if (g.trail.length > 22) g.trail.shift();
        for (const p of g.trail) { p.a -= dt * 0.0016; p.x -= SPEED * dt * 0.72; }
      }
      if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 0.05);

      /* ---------- отрисовка ---------- */
      const grd = ctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, "#12101a");
      grd.addColorStop(1, "#1b1522");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

      // дальний фон — окна аудитории
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      const off = (g.dist * 0.15) % 120;
      for (let x = -off; x < w; x += 120) {
        ctx.fillRect(x, h * 0.12, 64, h * 0.3);
      }

      // ворота (парты сверху и снизу)
      for (const gt of g.gates) {
        const halfW = w * 0.07;
        const gapTop = (gt.gapY - gt.gap / 2) * h;
        const gapBot = (gt.gapY + gt.gap / 2) * h;
        const grad = ctx.createLinearGradient(gt.x - halfW, 0, gt.x + halfW, 0);
        grad.addColorStop(0, "#6b4a8f");
        grad.addColorStop(0.5, "#8f63bd");
        grad.addColorStop(1, "#5c3f7c");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(gt.x - halfW, 0, halfW * 2, gapTop, 8);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(gt.x - halfW, gapBot, halfW * 2, h - gapBot, 8);
        ctx.fill();
        // кромки проёма
        ctx.fillStyle = "#FF9FD6";
        ctx.beginPath();
        ctx.roundRect(gt.x - halfW - 3, gapTop - 9, halfW * 2 + 6, 9, 4);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(gt.x - halfW - 3, gapBot, halfW * 2 + 6, 9, 4);
        ctx.fill();
      }

      // след
      for (const p of g.trail) {
        if (p.a <= 0) continue;
        ctx.fillStyle = `rgba(255,159,214,${p.a * 0.4})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, HERO_R * 0.42 * p.a, 0, Math.PI * 2);
        ctx.fill();
      }

      // герой — голова Радомира (или главного друга)
      const heroY = g.y * h;
      ctx.save();
      ctx.translate(HERO_X, heroY);
      ctx.rotate(g.tilt * 0.5);
      // язычок пламени при тяге
      if (g.thrust && g.running) {
        const f = 0.7 + Math.sin(t * 0.03) * 0.3;
        const fg = ctx.createLinearGradient(0, HERO_R * 0.6, 0, HERO_R * (1.5 + f * 0.5));
        fg.addColorStop(0, "rgba(255,159,214,0.9)");
        fg.addColorStop(1, "rgba(255,159,214,0)");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(-HERO_R * 0.4, HERO_R * 0.6);
        ctx.lineTo(HERO_R * 0.4, HERO_R * 0.6);
        ctx.lineTo(0, HERO_R * (1.5 + f * 0.5));
        ctx.closePath();
        ctx.fill();
      }
      const radomir = s.friends.find((f) => f.id === "radomir") || mainFriend;
      drawHead(ctx, radomir.look, 0, 0, HERO_R, {
        mouth: g.thrust ? 0.5 : 0.16,
        blink: 0,
        squish: 1,
        angry: 0,
        tilt: 0,
      });
      ctx.restore();

      ctx.restore();

      // подсказка в начале
      if (g.running && g.score === 0 && g.gates.length < 3) {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "600 13px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(tr("Держи палец — летишь вверх. Отпусти — вниз."), w / 2, h - 40);
      }
    },
    [phase, mainFriend, GAP, SPEED, SPREAD, SPACING_K],
  );

  const hold = (on: boolean) => {
    G.current.thrust = on;
    if (on) { sfx.dodge?.(); haptic("light"); }
  };

  return (
    <div className="absolute inset-0" style={{ background: "var(--bg)" }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); hold(true); }}
        onPointerUp={() => hold(false)}
        onPointerCancel={() => hold(false)}
        onPointerLeave={() => hold(false)}
      />

      <GameHUD score={score} best={best} onExit={onExit} label="ПАРТЫ" />

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
          title={tr("ПРИЗЕМЛИЛСЯ")}
          sub={`${tr("Проёмов пройдено")}: ${result.score}`}
        />
      )}
    </div>
  );
}
