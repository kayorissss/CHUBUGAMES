import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { APP_VERSION } from "../core/version";
import { tr } from "../core/i18n";

/**
 * ЭКРАН ЗАПУСКА ПК-ВЕРСИИ.
 *
 * На телефоне приложение открывается мгновенно из иконки, а на
 * компьютере запуск программы ощущается пустым: окно появилось — и
 * сразу интерфейс. Здесь короткая заставка: анимированный фон, логотип,
 * название и полоса загрузки.
 *
 * Держится ровно столько, сколько нужно на подготовку, но не дольше
 * MAX_MS: заставка не должна превращаться в ожидание.
 */

const MIN_MS = 1400;
const MAX_MS = 2600;

/** Фоновые «бургеры», медленно плывущие вверх */
function Backdrop() {
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

    // частицы: мягкие светящиеся точки, поднимающиеся снизу вверх
    const parts = Array.from({ length: 46 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1 + Math.random() * 2.6,
      v: 0.00004 + Math.random() * 0.00011,
      a: 0.16 + Math.random() * 0.4,
    }));

    let last = performance.now();
    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(48, now - last);
      last = now;
      const w = c.width;
      const h = c.height;

      ctx.clearRect(0, 0, w, h);

      // тёплое свечение сверху — фирменный акцент
      const g = ctx.createRadialGradient(w * 0.5, -h * 0.15, 10, w * 0.5, h * 0.2, h * 0.9);
      g.addColorStop(0, "rgba(255,176,32,0.16)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

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

  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}

/** Логотип: бургер, собирающийся из слоёв */
function Logo() {
  const layers = [
    { w: 92, h: 15, y: 0, c: "linear-gradient(180deg,#fff,#d8d8e0)", r: 12 },
    { w: 104, h: 13, y: 20, c: "linear-gradient(180deg,#ffb020,#e08a10)", r: 7 },
    { w: 98, h: 12, y: 38, c: "linear-gradient(180deg,#f4f4f8,#cfcfd8)", r: 6 },
  ];
  return (
    <div style={{ position: "relative", width: 110, height: 62, margin: "0 auto" }}>
      {layers.map((l, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: -26, scaleX: 0.6 }}
          animate={{ opacity: 1, y: 0, scaleX: 1 }}
          transition={{ delay: 0.12 + i * 0.14, type: "spring", stiffness: 260, damping: 18 }}
          style={{
            position: "absolute",
            left: (110 - l.w) / 2,
            top: l.y,
            width: l.w,
            height: l.h,
            borderRadius: i === 0 ? `${l.r}px ${l.r}px 4px 4px` : l.r,
            background: l.c,
            boxShadow: "0 4px 14px -6px rgba(0,0,0,0.8)",
          }}
        />
      ))}
    </div>
  );
}

export default function PcBoot({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const started = performance.now();
    let raf = 0;

    const tick = () => {
      const el = performance.now() - started;
      // плавно доходим до 100% за MIN_MS, потом ждём готовности
      const p = Math.min(100, (el / MIN_MS) * 100);
      setPct(p);
      if (el < MAX_MS && p < 100) {
        raf = requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          setShow(false);
          setTimeout(onDone, 420);
        }, 180);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "var(--n-000)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <Backdrop />

          <div style={{ position: "relative", textAlign: "center", width: 340 }}>
            <Logo />

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42, duration: 0.5 }}
              className="t-display"
              style={{
                marginTop: 26,
                fontSize: 38,
                letterSpacing: "0.04em",
                backgroundImage: "linear-gradient(96deg, var(--text) 26%, var(--acc))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              CHUBUGAMES
            </motion.h1>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="t-label"
              style={{ marginTop: 8, fontSize: 9.5, color: "var(--text-mute)" }}
            >
              {tr("мини-игры про друзей")}
            </motion.div>

            {/* Полоса загрузки */}
            <div
              style={{
                marginTop: 30,
                height: 4,
                borderRadius: 99,
                background: "var(--surface-2)",
                overflow: "hidden",
              }}
            >
              <motion.div
                animate={{ width: `${pct}%` }}
                transition={{ ease: "linear", duration: 0.1 }}
                style={{
                  height: "100%",
                  background: "linear-gradient(90deg, var(--acc), #ffd98a)",
                }}
              />
            </div>

            <div
              className="flex items-center"
              style={{ marginTop: 10, justifyContent: "space-between" }}
            >
              <span className="t-caption" style={{ fontSize: 9 }}>
                {pct >= 100 ? tr("Готово") : tr("Загрузка")}
              </span>
              <span className="t-num" style={{ fontSize: 9, color: "var(--text-mute)" }}>
                v{APP_VERSION}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
