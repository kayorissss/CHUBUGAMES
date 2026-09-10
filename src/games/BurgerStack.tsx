import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { tr } from "../core/i18n";
import { sfx, haptic } from "../core/fx";
import { useCanvas, GameHUD, GameOver, Countdown, HudStat } from "./shell";
import { shade } from "../core/head";
import Icon from "../ui/Icon";

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

/**
 * Темп башни выставлен по эталону жанра, а не на глаз.
 *
 * Замерено у Tower Blocks / Ketchapp Stack (движок отдаётся несжатым,
 * числа читаются прямо из game.js): блок стартует на 156 px/s, прибавляет
 * 7.8 px/s за слой и упирается в потолок 600 px/s на 57-м слое; допуск
 * идеального попадания — 5 px.
 *
 * Что было у нас: старт 310 px/s (ВДВОЕ быстрее эталона), потолок 780 px/s
 * и выход на него уже к 30-му слою. Отсюда «слишком быстро, не нормально
 * настроена система». Теперь как в эталоне, но скорость задаётся в долях
 * ширины экрана: на 412-пиксельном телефоне блок не должен пролетать
 * тот же путь заметно быстрее, чем на 320-пиксельном.
 */
const REF_W = 375;                        // ширина, на которой мерили эталон
const SPD_0 = 156 / 1000 / REF_W;         // долей ширины в мс
const SPD_STEP = 7.8 / 1000 / REF_W;
const SPD_MAX = 600 / 1000 / REF_W;

const BASE_W = 0.62;   // доля ширины экрана
const LAYER_H = 26;
/** Допуск идеала: 5 px эталона + 2 px на палец вместо мыши */
const PERFECT = 7;

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
  /** Множитель темпа от сложности. Эталон = «нормально». */
  const speedK =
    s.settings.difficulty === "insane" ? 1.22 : s.settings.difficulty === "chill" ? 0.82 : 1;

  const G = useRef({
    layers: [] as Layer[],
    cur: null as Layer | null,
    dir: 1,
    speed: 0.16,   // перезаписывается в reset() под ширину экрана
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
    g.speed = SPD_0 * speedK * w;   // px/мс на этом экране
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
  }, [speedK]);

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

    // следующий слой: заезжает то слева, то справа.
    // Прибавка и потолок — в долях ширины, как в эталоне жанра.
    g.speed = Math.min(SPD_MAX * speedK * g.wid, g.speed + SPD_STEP * speedK * g.wid);
    const fromLeft = Math.random() < 0.5;
    g.dir = fromLeft ? 1 : -1;
    const nextY = cur.y + 1;
    // на новом этаже слой ещё и ускоряется
    const fl = floorOf(nextY);
    if (fl > g.floor) {
      g.floor = fl;
      /* На новом этаже больше не подкручиваем скорость отдельно: раньше
         +0.05 за этаж поверх обычной прибавки и выбрасывало кривую за
         пределы человеческой точности уже к третьему этажу. */
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
  }, [end, speedK]);

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

      /* Подсказка рисуется НЕ текстом на канвасе (он не переводится,
         не масштабируется и тонет в фоне), а плашкой в разметке — см. ниже. */
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
        label={tr("СЛОИ")}
        extra={combo > 1 ? <HudStat label={tr("СЕРИЯ")} value={`×${combo}`} tone="acc" min={44} /> : undefined}
      />

      {/* Этаж — отдельной строкой под шапкой. Раньше «СТОЛОВАЯ» висела
          в шапке безо всякого пояснения и читалась как случайное слово. */}
      <div
        className="absolute flex items-center justify-center pointer-events-none"
        style={{ top: "calc(var(--sat) + 58px)", left: 0, right: 0, zIndex: 20, gap: 7 }}
      >
        <span
          className="t-label"
          style={{
            fontSize: 9, padding: "5px 10px", borderRadius: "var(--r-sm)",
            background: "var(--surface-2)", border: `1px solid ${FLOORS[floor].tint}`,
            color: FLOORS[floor].tint, letterSpacing: "0.1em",
          }}
        >
          {tr("ЭТАЖ")} {floor + 1} · {tr(FLOORS[floor].name)}
        </span>
      </div>

      {/* Подсказка: непрозрачная плашка над зоной пальца, уходит после
          третьего слоя. Раньше это был серый текст прямо на канвасе. */}
      <AnimatePresence>
        {phase === "play" && score < 3 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="absolute flex justify-center pointer-events-none"
            style={{ left: 0, right: 0, bottom: "calc(var(--sab) + 88px)", zIndex: 20 }}
          >
            <span
              className="t-title-sm flex items-center"
              style={{
                gap: 8, padding: "10px 16px", borderRadius: "var(--r-md)",
                background: "var(--surface-2)", border: "1px solid var(--btn-brd)",
                fontSize: 12.5,
              }}
            >
              <Icon name="tap" size={15} accent />
              {tr("Тапни, когда слой над башней")}
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
          title={tr("УПАЛО")}
          sub={tr("Башня Лёхи не выдержала")}
        />
      )}
    </div>
  );
}
