import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { APP_VERSION } from "../core/version";
import { tr } from "../core/i18n";
import { isLowFx } from "../core/perf";
import { isDesktop } from "../core/desktop";
import { BURGER_PATHS } from "./Brand";
import { EASE } from "../core/motion";

/**
 * ЗАСТАВКА.
 *
 * Что было не так. На телефоне — прыгающая жёлтая плашка с буквами «ЧГ»,
 * на компьютере — такой же блок шириной 340 px посреди монитора. То есть
 * первое, что видит человек, выглядело как заглушка: маленький сжатый
 * прямоугольник в пустоте, и ни масштаба, ни веса.
 *
 * Что стало:
 *  • знак собирается из слоёв бургера — булка, сыр, котлета, булка;
 *  • название набирается размером от ширины окна (clamp), а не фиксированными
 *    38 px: на 27-дюймовом мониторе оно большое, на телефоне — аккуратное;
 *  • живой фон: тёплое свечение и медленно поднимающиеся искры (на слабом
 *    железе и с reduced motion — без них);
 *  • реальные стадии загрузки вместо «анимации до 100%»;
 *  • внизу — подсказки по клавишам на ПК и версия всегда.
 *
 * Тайминги: 1.5 с на телефоне, до 2.2 с на ПК — дольше не стоит, заставка не
 * должна превращаться в ожидание.
 */

const STAGES = ["ЗАГРУЖАЮ СОХРАНЕНИЕ", "СОБИРАЮ ПАЦАНОВ", "РАЗЫГРЕВАЮ ИГРЫ"];

/** Один слой знака: прилетает сверху и встаёт на своё место */
function Layer({
  d, delay, fill, opacity = 1,
}: {
  d: string;
  delay: number;
  fill: string;
  opacity?: number;
}) {
  return (
    <motion.path
      d={d}
      fill={fill}
      opacity={opacity}
      initial={{ opacity: 0, y: -34, scale: 0.86 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 250, damping: 17 }}
      style={{ transformOrigin: "256px 256px" }}
    />
  );
}

function SplashMark({ low }: { low: boolean }) {
  const p = BURGER_PATHS;
  // Размер задаёт CSS (.boot-mark), здесь только viewBox: так знак
  // остаётся чётким при любом окне и не «застывает» после разворачивания.
  return (
    <svg width="100%" height="100%" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet" aria-hidden style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="sBun" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="color-mix(in srgb, #ffffff 44%, var(--acc))" />
          <stop offset="0.55" stopColor="var(--acc)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--acc) 70%, #000)" />
        </linearGradient>
        <linearGradient id="sBunB" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="color-mix(in srgb, var(--acc) 88%, #fff)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--acc) 60%, #000)" />
        </linearGradient>
        <linearGradient id="sCheese" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE27A" />
          <stop offset="1" stopColor="#FFC93C" />
        </linearGradient>
        <linearGradient id="sPatty" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8B5130" />
          <stop offset="1" stopColor="#5A2F18" />
        </linearGradient>
        <linearGradient id="sLeaf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9BE86A" />
          <stop offset="1" stopColor="#3F7C2A" />
        </linearGradient>
      </defs>

      <g>
        {low ? (
          <>
            <path d={p.bunTop} fill="url(#sBun)" />
            {p.leaf && <path d={p.leaf} fill="url(#sLeaf)" />}
            <path d={p.cheeseBar} fill="url(#sCheese)" />
            <path d={p.cheeseDrip} fill="url(#sCheese)" />
            <rect {...p.patty} fill="url(#sPatty)" />
            <path d={p.bunBottom} fill="url(#sBunB)" />
          </>
        ) : (
          <>
            <Layer d={p.bunTop} delay={0.02} fill="url(#sBun)" />
            {p.leaf && <Layer d={p.leaf} delay={0.1} fill="url(#sLeaf)" />}
            <Layer d={p.cheeseBar} delay={0.16} fill="url(#sCheese)" />
            <Layer d={p.cheeseDrip} delay={0.22} fill="url(#sCheese)" />
            <motion.rect
              {...p.patty}
              fill="url(#sPatty)"
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 240, damping: 16 }}
            />
            <Layer d={p.bunBottom} delay={0.38} fill="url(#sBunB)" />
            {/* кунжут досыпается последним — мелочь, которая собирает образ */}
            {p.seeds.map((sd, i) => (
              <motion.ellipse
                key={i}
                cx={sd.cx}
                cy={sd.cy}
                rx="15"
                ry="9"
                fill="#FFF4E2"
                opacity="0.9"
                transform={`rotate(${sd.rot} ${sd.cx} ${sd.cy})`}
                initial={{ opacity: 0, scale: 0.2 }}
                animate={{ opacity: 0.9, scale: 1 }}
                transition={{ delay: 0.52 + i * 0.07, type: "spring", stiffness: 380, damping: 15 }}
              />
            ))}
          </>
        )}
      </g>
    </svg>
  );
}

/** Искры: мягкие точки, поднимающиеся вверх. Дёшево: один canvas, без blur */
function Sparks() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let alive = true;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      c.width = Math.floor(c.clientWidth * dpr);
      c.height = Math.floor(c.clientHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const parts = Array.from({ length: 54 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1 + Math.random() * 2.4,
      v: 0.00004 + Math.random() * 0.00012,
      a: 0.14 + Math.random() * 0.36,
    }));

    let last = performance.now();
    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(48, now - last);
      last = now;
      const { width: w, height: h } = c;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.y -= p.v * dt;
        if (p.y < -0.05) {
          p.y = 1.05;
          p.x = Math.random();
        }
        ctx.fillStyle = `rgba(255,205,120,${p.a})`;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="boot-sparks" />;
}

export default function BootScreen({
  onDone,
  minMs = 1400,
  maxMs = 2200,
}: {
  onDone: () => void;
  /** сколько минимум длится показ */
  minMs?: number;
  /** жёсткий потолок: заставка не должна превращаться в ожидание */
  maxMs?: number;
}) {
  const low = isLowFx();
  const desktop = isDesktop();
  const [stage, setStage] = useState(0);
  const [pct, setPct] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timers = STAGES.map((_, i) =>
      window.setTimeout(() => setStage(i), (minMs / (STAGES.length + 1)) * (i + 1) * 0.72),
    );
    const started = performance.now();
    let raf = 0;
    const tick = () => {
      const el = performance.now() - started;
      setPct(Math.min(100, (el / minMs) * 100));
      if (el < minMs) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const end = window.setTimeout(() => setShow(false), Math.max(minMs + 220, Math.min(maxMs, minMs + 520)));
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(end);
      cancelAnimationFrame(raf);
    };
  }, [minMs, maxMs]);

  useEffect(() => {
    if (show) return;
    const off = window.setTimeout(onDone, 420);
    return () => clearTimeout(off);
  }, [show, onDone]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="boot"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(0px)", scale: desktop ? 1.015 : 1.04 }}
          transition={{ duration: 0.44, ease: EASE }}
        >
          {/* фон: тёплое свечение + сетка + искры */}
          <span className="boot-glow" aria-hidden />
          <span className="boot-grid" aria-hidden />
          {!low && <Sparks />}

          <div className="boot-inner">
            <motion.div
              className="boot-mark"
              initial={{ opacity: 0, scale: 0.82 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 19 }}
            >
              <SplashMark low={low} />
            </motion.div>

            <motion.h1
              className="t-display boot-title"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.34, duration: 0.5, ease: EASE }}
            >
              CHUBUGAMES
            </motion.h1>

            <motion.p
              className="t-label boot-sub"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.52 }}
            >
              {tr("мини-игры про друзей")}
            </motion.p>

            {/* прогресс и стадии */}
            <div className="boot-load">
              <div className="boot-track">
                <motion.div
                  className="boot-fill"
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ ease: "linear", duration: 0.12 }}
                />
              </div>
              <div className="boot-stages">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={stage}
                    className="t-label boot-stage"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    {pct >= 100 ? tr("Готово") : tr(STAGES[stage])}
                  </motion.span>
                </AnimatePresence>
                <span className="t-num boot-pct">{Math.round(pct)}%</span>
              </div>
            </div>
          </div>

          <footer className="boot-foot">
            <span className="t-num boot-ver">v{APP_VERSION}</span>
            {desktop && (
              <span className="t-caption boot-keys">
                <b>F11</b> {tr("полный экран")} · <b>Esc</b> {tr("назад")} · <b>1–5</b> {tr("разделы")}
              </span>
            )}
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
