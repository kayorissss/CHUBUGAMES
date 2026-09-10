import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { useCanvas, GameHUD, GameOver, Countdown, HudGauge } from "./shell";
import { drawHead } from "../core/head";
import { tr } from "../core/i18n";

/**
 * АРТЁМ НА МОТОЦИКЛЕ — держи газ, доедь до конца.
 *
 * Держишь палец — газ, отпускаешь — тормоз. Но двигатель греется: держать
 * без перерыва нельзя, перегрев глушит мотор на пару секунд. Поэтому
 * ехать надо рывками, отпуская на спусках.
 *
 * На финише поперёк дороги натянуты нитки на уровне шеи. Их надо
 * проезжать пригнувшись — свайп вниз. Не пригнулся — «чикнуло».
 */

/* Числа проверены симуляцией заезда (шаг 16.7 мс).
   При первых значениях перегрев вообще не наказывал: мотор не остывал
   во время глушения, а газ можно было держать не отпуская. Теперь
   умелая езда рывками — 35 с, «жать всегда» — 49 с, вялая — 47 с,
   то есть управление газом реально решает. */
const ROAD_LEN = 12000;       // условная длина трассы
const HEAT_MAX = 100;
const WIRE_ZONE = 0.78;       // с какой доли трассы начинаются нитки
const ACC = 0.0016;           // разгон
const V_MAX = 1.65;
const HEAT_UP = 0.045;        // нагрев под газом
const COOL = 0.040;           // остывание на выбеге
const COOL_OVER = 0.020;      // остывание при заглохшем моторе
const DECAY = 0.0015;         // потеря скорости на выбеге
const OVERHEAT_MS = 4000;     // сколько мотор молчит после перегрева

/**
 * Препятствие на трассе.
 *
 * `lane` — на какой из трёх полос оно стоит. Раньше полос не было
 * вовсе: препятствие занимало всю дорогу, объехать его было физически
 * нельзя, и оставалось только терять жизнь. Нитки в финале по-прежнему
 * тянутся через всю дорогу (lane = -1) — от них спасает только приседание.
 */
interface Obstacle { at: number; kind: "hole" | "cone" | "wire"; lane: number }

/** Три полосы: 0 верхняя, 1 средняя, 2 нижняя */
const LANES = 3;
/** Расстояние между полосами по вертикали, px */
const LANE_GAP = 30;
/** Скорость перестроения между полосами */
const LANE_SPEED = 0.006;

export default function MotoArtyom({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [cd, setCd] = useState(3);
  const [dist, setDist] = useState(0);
  const [heat, setHeat] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const best = s.games.moto?.best || 0;
  const artyom = s.friends.find((f) => f.id === "artyom") || s.friends[0];

  const G = useRef({
    running: false,
    gas: false,
    speed: 0,
    dist: 0,
    heat: 0,
    overheat: 0,      // мс до остывания
    duck: 0,          // мс, пока пригнут
    lives: 3,
    score: 0,
    obs: [] as Obstacle[],
    hitCd: 0,
    lane: 1,          // текущая полоса
    laneY: 1,         // плавная позиция между полосами
    startT: 0,
    shake: 0,
    wheelPh: 0,
    pops: [] as { x: number; y: number; t: number; txt: string; col: string }[],
    w: 0, h: 0,
  });

  const reset = useCallback((w: number, h: number) => {
    const g = G.current;
    g.w = w; g.h = h;
    g.running = false;
    g.gas = false; g.speed = 0; g.dist = 0; g.heat = 0;
    g.overheat = 0; g.duck = 0; g.lives = 3; g.score = 0;
    g.hitCd = 0; g.shake = 0; g.wheelPh = 0; g.pops = [];
    g.lane = 1; g.laneY = 1;
    g.startT = Date.now();

    // расставляем препятствия; нитки — только в финальной зоне
    const obs: Obstacle[] = [];
    for (let at = 900; at < ROAD_LEN * WIRE_ZONE; at += 420 + Math.random() * 460) {
      // Занимаем одну или две полосы, но НИКОГДА все три: иначе проезд
      // был бы невозможен и игрок терял бы жизнь без вариантов.
      const blocked = Math.random() < 0.32 ? 2 : 1;
      const lanes = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, blocked);
      for (const lane of lanes) {
        obs.push({ at, kind: Math.random() < 0.5 ? "hole" : "cone", lane });
      }
    }
    for (let at = ROAD_LEN * WIRE_ZONE; at < ROAD_LEN - 260; at += 300 + Math.random() * 220) {
      obs.push({ at, kind: "wire", lane: -1 });   // нитка через всю дорогу
    }
    g.obs = obs;
    setDist(0); setHeat(0); setScore(0); setLives(3);
  }, []);

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

  const end = useCallback((won: boolean) => {
    const g = G.current;
    if (!g.running) return;
    g.running = false;
    const sc = Math.floor(g.score + (won ? 1200 : 0));
    const coins = Math.floor(sc * 3.6 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 0.7 + 20);
    setResult({ score: sc, coins, xp });
    setPhase("over");
    if (won) { sfx.legend(); haptic("success"); } else { sfx.gameOver(); haptic("error"); }
    addCoins(coins);
    addXp(xp);
    finishGame("moto", sc, Date.now() - g.startT);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  /* газ по удержанию, свайп вниз — пригнуться */
  const startY = useRef(0);
  const startX = useRef(0);
  const swiped = useRef(false);
  const onDown = useCallback((e: React.PointerEvent) => {
    const g = G.current;
    if (!g.running) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    startY.current = e.clientY - r.top;
    startX.current = e.clientX - r.left;
    swiped.current = false;
    g.gas = true;
  }, []);

  const onMove = useCallback((e: React.PointerEvent) => {
    const g = G.current;
    if (!g.running) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - r.top;
    const x = e.clientX - r.left;
    // свайп вбок — смена полосы, по одной за жест
    if (!swiped.current && Math.abs(x - startX.current) > 34
        && Math.abs(x - startX.current) > Math.abs(y - startY.current)) {
      swiped.current = true;
      const dir = x > startX.current ? 1 : -1;
      const next = Math.max(0, Math.min(LANES - 1, g.lane + dir));
      if (next !== g.lane) {
        g.lane = next;
        sfx.swoosh();
        haptic("light");
      }
    }
    // свайп вниз больше 40 px — пригнуться
    if (y - startY.current > 40 && g.duck <= 0) {
      g.duck = 700;
      sfx.swoosh();
      haptic("light");
      startY.current = y;
    }
  }, []);

  const onUp = useCallback(() => { G.current.gas = false; }, []);

  const canvasRef = useCanvas((ctx, w, h, dt) => {
    const g = G.current;
    if (!g.w) reset(w, h);
    g.w = w; g.h = h;

    const roadY = h * 0.62;      // линия центральной полосы
    const bikeX = w * 0.3;

    if (g.running) {
      /* газ и перегрев */
      if (g.overheat > 0) {
        g.overheat -= dt;
        g.speed = Math.max(0, g.speed - dt * 0.0016);
        // мотор остывает и пока молчит, иначе перегрев был бы вечным
        g.heat = Math.max(0, g.heat - dt * COOL_OVER);
      } else if (g.gas) {
        g.speed = Math.min(V_MAX, g.speed + dt * ACC);
        g.heat = Math.min(HEAT_MAX, g.heat + dt * HEAT_UP);
        if (g.heat >= HEAT_MAX) {
          g.overheat = OVERHEAT_MS;
          sfx.error();
          haptic("error");
          g.pops.push({ x: w / 2, y: h * 0.4, t: 1, txt: tr("ПЕРЕГРЕВ"), col: "var(--danger)" });
        }
      } else {
        g.speed = Math.max(0, g.speed - dt * DECAY);
        g.heat = Math.max(0, g.heat - dt * COOL);
      }
      setHeat(g.heat);

      if (g.duck > 0) g.duck -= dt;
      if (g.hitCd > 0) g.hitCd -= dt;
      g.wheelPh += g.speed * dt * 0.02;
      // байк переезжает между полосами плавно, а не телепортом
      const dLane = g.lane - g.laneY;
      if (Math.abs(dLane) > 0.001) {
        g.laneY += Math.sign(dLane) * Math.min(Math.abs(dLane), LANE_SPEED * dt);
      }

      /* едем */
      g.dist += g.speed * dt * 0.42;
      g.score += g.speed * dt * 0.02;
      setDist(g.dist);
      setScore(Math.floor(g.score));

      if (g.dist >= ROAD_LEN) { end(true); return; }

      /* столкновения */
      for (const o of g.obs) {
        const rel = o.at - g.dist;
        if (Math.abs(rel) < 26 && g.hitCd <= 0) {
          const ducked = g.duck > 0;
          // препятствие на другой полосе просто проезжаем мимо
          if (o.lane >= 0 && Math.abs(g.laneY - o.lane) > 0.45) continue;
          const bad = o.kind === "wire" ? !ducked : true;
          if (o.kind === "wire" && ducked) continue;
          if (bad) {
            g.hitCd = 900;
            g.lives -= 1;
            setLives(g.lives);
            g.speed *= 0.35;
            g.shake = 15;
            sfx.hit();
            haptic("error");
            g.pops.push({
              x: bikeX, y: roadY - 60, t: 1,
              txt: o.kind === "wire" ? tr("НИТКА!") : o.kind === "hole" ? tr("ЯМА") : tr("КОНУС"),
              col: "var(--danger)",
            });
            if (g.lives <= 0) { end(false); return; }
          }
        }
      }
    }

    for (const p of g.pops) p.t -= dt * 0.0013;
    g.pops = g.pops.filter((p) => p.t > 0);
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 0.03);

    /* ---------- отрисовка ---------- */
    const sky = ctx.createLinearGradient(0, 0, 0, roadY);
    sky.addColorStop(0, "#101827");
    sky.addColorStop(1, "#20293a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, roadY);

    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

    // дальние дома — параллакс
    ctx.fillStyle = "#18202e";
    for (let i = 0; i < 14; i++) {
      const bx = ((i * 130 - g.dist * 0.18) % (w + 200)) - 100;
      const bh = 44 + ((i * 37) % 70);
      ctx.fillRect(bx, roadY - bh, 74, bh);
    }

    // дорога
    ctx.fillStyle = "#23262c";
    ctx.fillRect(0, roadY, w, h - roadY);
    // разметка между тремя полосами
    ctx.strokeStyle = "rgba(255,255,255,0.26)";
    ctx.lineWidth = 3;
    ctx.setLineDash([30, 24]);
    ctx.lineDashOffset = -g.dist * 0.9;
    for (let k = 0; k < LANES - 1; k++) {
      const ly = laneToY(roadY, k + 0.5);
      ctx.beginPath();
      ctx.moveTo(0, ly); ctx.lineTo(w, ly);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // препятствия
    for (const o of g.obs) {
      const rel = o.at - g.dist;
      if (rel < -80 || rel > w + 120) continue;
      const ox = bikeX + rel;
      const oy = o.lane >= 0 ? laneToY(roadY, o.lane) : roadY;
      if (o.kind === "hole") {
        ctx.fillStyle = "#0a0b0d";
        ctx.beginPath();
        ctx.ellipse(ox, oy + 6, 24, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (o.kind === "cone") {
        ctx.fillStyle = "#ff7a2a";
        ctx.beginPath();
        ctx.moveTo(ox, oy - 24);
        ctx.lineTo(ox - 11, oy + 6);
        ctx.lineTo(ox + 11, oy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillRect(ox - 7, oy - 10, 14, 5);
      } else {
        // нитка поперёк на уровне шеи
        ctx.strokeStyle = "#e8e8f0";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(ox, roadY - 96);
        ctx.lineTo(ox, roadY + 20);
        ctx.stroke();
        ctx.setLineDash([]);
        // столбики
        ctx.fillStyle = "#6a6a78";
        ctx.fillRect(ox - 3, roadY - 100, 6, 10);
      }
    }

    // мотоцикл + Артём
    const duck = g.duck > 0;
    // байк стоит на своей полосе; laneY меняется плавно при перестроении
    const by = laneToY(roadY, g.laneY) - 26;
    ctx.save();
    ctx.translate(bikeX, by);
    // колёса
    ctx.fillStyle = "#111";
    for (const wx of [-26, 26]) {
      ctx.beginPath(); ctx.arc(wx, 0, 15, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#4a4a58";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx, 0);
      ctx.lineTo(wx + Math.cos(g.wheelPh) * 12, Math.sin(g.wheelPh) * 12);
      ctx.stroke();
    }
    // рама
    ctx.strokeStyle = "#c8402a";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-26, 0); ctx.lineTo(-6, -18); ctx.lineTo(20, -16); ctx.lineTo(26, 0);
    ctx.stroke();
    // бак
    ctx.fillStyle = "#e05a3a";
    ctx.beginPath(); ctx.roundRect(-14, -26, 30, 13, 5); ctx.fill();
    // руль
    ctx.strokeStyle = "#8a8a98";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(20, -16); ctx.lineTo(30, -30); ctx.stroke();
    // ездок
    const headY = duck ? -44 : -62;
    ctx.strokeStyle = "#2e3540";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-2, -20);
    ctx.lineTo(duck ? 8 : 2, headY + 16);
    ctx.stroke();
    drawHead(ctx, artyom.look, duck ? 10 : 2, headY, 17, { body: false, mouth: g.gas ? 0.5 : 0 });
    ctx.restore();

    // выхлоп при газе
    if (g.gas && g.overheat <= 0) {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = `rgba(200,200,210,${0.16 - i * 0.045})`;
        ctx.beginPath();
        ctx.arc(bikeX - 40 - i * 15, by - 8 + Math.sin(g.wheelPh + i) * 4, 6 + i * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // всплывашки
    ctx.textAlign = "center";
    for (const p of g.pops) {
      ctx.globalAlpha = Math.min(1, p.t * 1.6);
      ctx.fillStyle = p.col;
      ctx.font = "800 19px Unbounded, Inter, system-ui, sans-serif";
      ctx.fillText(p.txt, p.x, p.y - (1 - p.t) * 30);
    }
    ctx.globalAlpha = 1;

    // предупреждение о зоне ниток
    if (g.running && g.dist > ROAD_LEN * WIRE_ZONE - 700 && g.dist < ROAD_LEN * WIRE_ZONE) {
      ctx.fillStyle = "#FF6B4D";
      ctx.font = "800 15px Unbounded, Inter, system-ui, sans-serif";
      ctx.fillText(tr("ВПЕРЕДИ НИТКИ — СВАЙП ВНИЗ"), w / 2, h * 0.2);
    }

    if (g.running && g.dist < 500) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "600 12px Inter, system-ui, sans-serif";
      ctx.fillText(tr("Держи палец — газ. Свайп вниз — пригнуться"), w / 2, h - 18);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "play") {
      const c = document.querySelector<HTMLCanvasElement>("[data-moto-canvas]");
      const r = c?.getBoundingClientRect();
      reset(r?.width || 360, r?.height || 640);
      G.current.running = true;
    }
  }, [phase, reset]);

  const pct = Math.min(100, (dist / ROAD_LEN) * 100);

  return (
    <div className="absolute inset-0" style={{ background: "var(--bg)" }}>
      <canvas
        ref={canvasRef}
        data-moto-canvas
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
        extra={<HudGauge label={tr("ЖАР")} pct={heat} tone={heat > 75 ? "danger" : "warn"} />}
        lives={{ value: lives, max: 3 }}
      />

      {/* Прогресс трассы — под шапкой, непрозрачной подложкой */}
      <div
        className="absolute"
        style={{ left: 12, right: 12, top: "calc(var(--sat) + 58px)", zIndex: 20 }}
      >
        <div style={{ height: 6, borderRadius: 999, background: "var(--n-300)", overflow: "hidden", border: "1px solid var(--n-400)" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "var(--acc)", transition: "width .2s linear" }} />
        </div>
      </div>

      <AnimatePresence>{phase === "count" && <Countdown n={cd} />}</AnimatePresence>

      {phase === "over" && (
        <GameOver
          score={result.score}
          best={best}
          coins={result.coins}
          xp={result.xp}
          onRetry={restart}
          onExit={onExit}
          title={dist >= ROAD_LEN ? tr("ДОЕХАЛ ЦЕЛЫМ") : tr("НЕ ДОЕХАЛ")}
          sub={dist >= ROAD_LEN ? tr("Голова на месте") : tr("Артём сошёл с трассы")}
        />
      )}
    </div>
  );
}

/** Экранная Y-координата полосы: 0 дальняя, 2 ближняя */
function laneToY(roadY: number, lane: number): number {
  return roadY + (lane - 1) * LANE_GAP + 22;
}
