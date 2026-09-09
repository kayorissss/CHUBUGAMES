import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { useCanvas, GameHUD, GameOver, Countdown } from "./shell";
import { hexRgb, shade } from "../core/head";

/**
 * БАШНЯ ЛЁХИ — складывай бургеры друг на друга.
 * Слой ездит влево-вправо, тап роняет его. Что вылезло за край —
 * срезается, башня становится уже. Промазал полностью — конец.
 * Идеальное попадание (±6 px) даёт комбо и немного возвращает ширину.
 */

interface Layer {
  x: number;     // левый край, px
  w: number;
  y: number;     // индекс слоя снизу
  hue: number;
  /** Слой уже въехал в кадр — можно разворачивать у краёв */
  entered?: boolean;
}

const BASE_W = 0.62;   // доля ширины экрана
const LAYER_H = 26;
const PERFECT = 6;

/** Сколько слоёв в одном этаже — дальше меняется оформление и темп */
const FLOOR_SIZE = 8;

/** Этажи башни: свой фон, название и прибавка к скорости */
const FLOORS = [
  { name: "СТОЛОВАЯ",  top: "#0b0b10", bot: "#15151d", tint: "#FFB020" },
  { name: "ОБЩАГА",    top: "#0a0f16", bot: "#131c26", tint: "#8FD3FF" },
  { name: "КРЫША",     top: "#120a16", bot: "#1d1226", tint: "#C89BFF" },
  { name: "ОБЛАКА",    top: "#0a1614", bot: "#12241f", tint: "#59FF9E" },
  { name: "КОСМОС",    top: "#08080c", bot: "#101019", tint: "#FF6B8A" },
];

const floorOf = (n: number) => Math.min(FLOORS.length - 1, Math.floor(n / FLOOR_SIZE));

export default function BurgerStack({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [cd, setCd] = useState(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [floor, setFloor] = useState(0);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const best = s.games.stack?.best || 0;
  const speedBase =
    s.settings.difficulty === "insane" ? 0.42 : s.settings.difficulty === "chill" ? 0.22 : 0.31;

  const G = useRef({
    layers: [] as Layer[],
    cur: null as Layer | null,
    dir: 1,
    speed: speedBase,
    camY: 0,
    running: false,
    score: 0,
    combo: 0,
    startT: 0,
    shake: 0,
    chips: [] as { x: number; y: number; w: number; vy: number; vx: number; hue: number }[],
    flash: 0,
    floor: 0,
    floorFlash: 0,
    wid: 0,          // ширина канваса, нужна для старта слоя за краем
  });

  const reset = useCallback((w: number) => {
    const g = G.current;
    const bw = w * BASE_W;
    g.layers = [{ x: (w - bw) / 2, w: bw, y: 0, hue: 0 }];
    g.cur = { x: 0, w: bw, y: 1, hue: 1, entered: true };
    g.dir = 1;
    g.speed = speedBase;
    g.camY = 0;
    g.score = 0;
    g.combo = 0;
    g.chips = [];
    g.shake = 0;
    g.flash = 0;
    g.floor = 0;
    g.floorFlash = 0;
    g.wid = w;
    setFloor(0);
    g.startT = Date.now();
    setScore(0);
    setCombo(0);
  }, [speedBase]);

  const restart = useCallback(() => {
    G.current.running = false;
    setPhase("count");
    setCd(3);
  }, []);

  useEffect(() => {
    if (phase !== "count") return;
    if (cd < 0) {
      G.current.running = true;
      G.current.startT = Date.now();
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
    const coins = Math.floor(sc * 4.2 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 0.9 + 18);
    setResult({ score: sc, coins, xp });
    setPhase("over");
    sfx.gameOver();
    haptic("error");
    addCoins(coins);
    addXp(xp);
    finishGame("stack", sc, Date.now() - g.startT);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  /** Уронить текущий слой */
  const drop = useCallback(() => {
    const g = G.current;
    if (!g.running || !g.cur) return;
    const top = g.layers[g.layers.length - 1];
    const cur = g.cur;
    const delta = cur.x - top.x;
    const overlap = cur.w - Math.abs(delta);

    if (overlap <= 2) {
      // мимо совсем
      g.chips.push({ x: cur.x, y: cur.y, w: cur.w, vy: -0.2, vx: delta > 0 ? 0.3 : -0.3, hue: cur.hue });
      sfx.hit();
      haptic("error");
      g.shake = 14;
      end();
      return;
    }

    if (Math.abs(delta) <= PERFECT) {
      // идеально — ширина не теряется, немного возвращается
      cur.x = top.x;
      cur.w = Math.min(top.w + 5, g.layers[0].w);
      g.combo += 1;
      g.score += 1 + g.combo;
      sfx.crit();
      haptic("medium");
      g.flash = 1;
    } else {
      // срезаем лишнее
      const newX = delta > 0 ? cur.x : top.x;
      const cutX = delta > 0 ? cur.x + overlap : cur.x;
      g.chips.push({
        x: cutX, y: cur.y, w: Math.abs(delta),
        vy: -0.12, vx: delta > 0 ? 0.22 : -0.22, hue: cur.hue,
      });
      cur.x = newX;
      cur.w = overlap;
      g.combo = 0;
      g.score += 1;
      sfx.merge();
      haptic("light");
    }

    g.layers.push(cur);
    setScore(Math.floor(g.score));
    setCombo(g.combo);

    // следующий слой: заезжает то слева, то справа
    g.speed = Math.min(0.78, g.speed + 0.011);
    const fromLeft = Math.random() < 0.5;
    g.dir = fromLeft ? 1 : -1;
    const nextY = cur.y + 1;
    // на новом этаже слой ещё и ускоряется
    const fl = floorOf(nextY);
    if (fl > g.floor) {
      g.floor = fl;
      g.speed = Math.min(0.9, g.speed + 0.05);
      g.floorFlash = 1;
      setFloor(fl);
      sfx.achieve?.();
      haptic("success");
    }
    g.cur = {
      x: fromLeft ? -cur.w : g.wid,   // старт за краем экрана
      w: cur.w,
      y: nextY,
      hue: cur.hue + 1,
    };
  }, [end]);

  const canvasRef = useCanvas(
    (ctx, w, h, dt) => {
      const g = G.current;
      if (!g.layers.length) reset(w);

      // ---- физика ----
      g.wid = w;
      if (g.running && g.cur) {
        const c = g.cur;
        c.x += g.dir * g.speed * dt;
        const maxX = w - c.w;
        // пока слой не въехал в кадр — не разворачиваем его
        if (c.x > 0 && c.x < maxX) c.entered = true;
        if (c.entered) {
          if (c.x <= 0) { c.x = 0; g.dir = 1; }
          if (c.x >= maxX) { c.x = maxX; g.dir = -1; }
        }
      }
      for (const ch of g.chips) {
        ch.vy += dt * 0.0022;
        ch.y -= ch.vy * dt * 0.06;
        ch.x += ch.vx * dt;
      }
      g.chips = g.chips.filter((c) => c.y > -14);
      if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 0.05);
      if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 0.004);

      // камера: башня всегда в нижней половине
      const targetCam = Math.max(0, (g.layers.length - 5) * LAYER_H);
      g.camY += (targetCam - g.camY) * Math.min(1, dt * 0.008);

      // ---- фон: свой на каждом этаже, плавно перетекает ----
      const fl = FLOORS[floorOf(g.layers.length)];
      const grd = ctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, fl.top);
      grd.addColorStop(1, fl.bot);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      // подсветка этажа
      if (g.floorFlash > 0) {
        g.floorFlash = Math.max(0, g.floorFlash - dt * 0.0012);
        const rg = ctx.createRadialGradient(w / 2, h * 0.55, 0, w / 2, h * 0.55, w * 0.9);
        rg.addColorStop(0, `${fl.tint}${Math.round(g.floorFlash * 40).toString(16).padStart(2, "0")}`);
        rg.addColorStop(1, "transparent");
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      }

      if (g.flash > 0) {
        ctx.fillStyle = `rgba(255,220,140,${g.flash * 0.13})`;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.save();
      if (g.shake > 0) {
        ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
      }

      const groundY = h - 70;
      const yOf = (idx: number) => groundY - idx * LAYER_H + g.camY;

      // ---- слои ----
      const drawLayer = (x: number, y: number, lw: number, hue: number, ghost = false) => {
        const cols = ["#e8b06a", "#8a5a3b", "#f2d6a0", "#c2703f", "#6f4b32"];
        const col = cols[hue % cols.length];
        ctx.globalAlpha = ghost ? 0.35 : 1;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect(x, y - LAYER_H + 3, lw, LAYER_H - 5, 7);
        ctx.fill();
        // блик сверху
        ctx.fillStyle = shade(col, 26);
        ctx.beginPath();
        ctx.roundRect(x + 3, y - LAYER_H + 5, Math.max(0, lw - 6), 5, 3);
        ctx.fill();
        // кунжут на светлых
        if (hue % cols.length === 0 || hue % cols.length === 2) {
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          const n = Math.max(1, Math.floor(lw / 34));
          for (let i = 0; i < n; i++) {
            const sx = x + lw * ((i + 0.5) / n);
            ctx.beginPath();
            ctx.ellipse(sx, y - LAYER_H + 10, 2.4, 1.4, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      };

      for (const l of g.layers) {
        const y = yOf(l.y);
        if (y < -LAYER_H || y > h + LAYER_H) continue;
        drawLayer(l.x, y, l.w, l.hue);
      }

      // падающие обрезки
      for (const ch of g.chips) {
        drawLayer(ch.x, yOf(ch.y), ch.w, ch.hue, true);
      }

      // текущий слой
      if (g.cur && g.running) {
        const y = yOf(g.cur.y);
        // направляющая тень на вершине
        const top = g.layers[g.layers.length - 1];
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.setLineDash([4, 5]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(top.x, y + 6);
        ctx.lineTo(top.x + top.w, y + 6);
        ctx.stroke();
        ctx.setLineDash([]);
        drawLayer(g.cur.x, y, g.cur.w, g.cur.hue);
      }

      // земля
      ctx.fillStyle = "#1d1d27";
      ctx.fillRect(0, groundY + g.camY, w, h - groundY);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.moveTo(0, groundY + g.camY);
      ctx.lineTo(w, groundY + g.camY);
      ctx.stroke();

      ctx.restore();

      // подсказка
      if (g.running && g.layers.length < 3) {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "600 13px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Тапни, чтобы уронить слой", w / 2, h - 26);
      }
    },
    [phase],
  );

  // старт новой партии при входе в play
  useEffect(() => {
    if (phase === "play") {
      const c = document.querySelector<HTMLCanvasElement>("[data-stack-canvas]");
      const w = c?.getBoundingClientRect().width || 360;
      reset(w);
      G.current.running = true;
    }
  }, [phase, reset]);

  const rgb = hexRgb("#ffb020");

  return (
    <div className="absolute inset-0" style={{ background: "var(--bg)" }}>
      <canvas
        ref={canvasRef}
        data-stack-canvas
        className="absolute inset-0 w-full h-full"
        onPointerDown={(e) => { e.preventDefault(); drop(); }}
        style={{ touchAction: "none" }}
      />

      <GameHUD
        score={score}
        best={best}
        onExit={onExit}
        label="ЭТАЖИ"
        extra={
          <div className="flex items-center shrink-0" style={{ gap: 7 }}>
            <div
              className="t-label shrink-0"
              style={{
                padding: "8px 11px", borderRadius: "var(--r-md)",
                background: "var(--btn-bg)",
                border: `1px solid ${FLOORS[floor].tint}66`,
                color: FLOORS[floor].tint, fontSize: 9.5,
              }}
            >
              {FLOORS[floor].name}
            </div>
            {combo > 1 ? (
            <div
              className="t-num shrink-0"
              style={{
                padding: "8px 11px", borderRadius: "var(--r-md)",
                background: `rgba(${rgb},0.16)`,
                border: `1px solid rgba(${rgb},0.5)`,
                color: "var(--acc)", fontSize: 14,
              }}
            >
              ×{combo}
            </div>
            ) : null}
          </div>
        }
      />

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
          title="УПАЛО"
          sub="Башня Лёхи не выдержала"
        />
      )}
    </div>
  );
}
