import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Panel, Tap } from "../ui/Glass";
import { fmt } from "../core/format";

export function useCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, t: number) => void,
  deps: any[] = [],
) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let raf = 0;
    let last = performance.now();
    let alive = true;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);

    const resize = () => {
      const r = c.getBoundingClientRect();
      c.width = Math.max(1, Math.floor(r.width * dpr));
      c.height = Math.max(1, Math.floor(r.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);

    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(50, now - last);
      last = now;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawRef.current(ctx, c.width / dpr, c.height / dpr, dt, now);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

export function GameHUD({
  score, best, extra, onExit, label = "ОЧКИ",
}: {
  score: number; best: number; extra?: React.ReactNode; onExit: () => void; label?: string;
}) {
  return (
    <div
      className="absolute left-0 right-0 z-20 flex items-center gap-2 px-3"
      style={{ top: "calc(var(--sat) + 10px)" }}
    >
      <Tap onClick={onExit} r="md" className="px-3 py-2.5 shrink-0" sound="swoosh">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Tap>
      <Panel r="md" className="px-4 py-2 flex-1 flex items-center justify-between">
        <div>
          <div className="t-label" style={{ fontSize: 9 }}>{label}</div>
          <div className="t-num" style={{ fontSize: 21, lineHeight: 1 }}>{fmt(score)}</div>
        </div>
        <div className="text-right">
          <div className="t-label" style={{ fontSize: 9 }}>Рекорд</div>
          <div className="t-num acc-text" style={{ fontSize: 15, lineHeight: 1.2 }}>{fmt(best)}</div>
        </div>
      </Panel>
      {extra}
    </div>
  );
}

export function GameOver({
  score, best, coins, xp, onRetry, onExit, title = "ВСЁ", sub,
}: {
  score: number; best: number; coins: number; xp: number;
  onRetry: () => void; onExit: () => void; title?: string; sub?: string;
}) {
  const isRecord = score >= best && score > 0;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-40 flex items-center justify-center px-6"
      style={{ background: "rgba(4,4,6,0.72)", backdropFilter: "blur(18px)" }}
    >
      <motion.div
        initial={{ scale: 0.86, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="w-full max-w-sm"
      >
        <Panel r="xl" strong className="p-6 text-center">
          {isRecord && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 400 }}
              className="inline-block px-3 py-1 rounded-full mb-3 t-label"
              style={{ background: "var(--acc)", color: "var(--acc-ink)", fontSize: 10 }}
            >
              🏅 НОВЫЙ РЕКОРД
            </motion.div>
          )}
          <div className="t-display" style={{ fontSize: 36 }}>{title}</div>
          {sub && <div className="text-sm mt-1" style={{ color: "var(--text-mute)" }}>{sub}</div>}

          <div className="my-5">
            <div className="t-label mb-1">Результат</div>
            <div className="t-num acc-text" style={{ fontSize: 52, lineHeight: 1 }}>{fmt(score)}</div>
            <div className="text-xs mt-1" style={{ color: "var(--text-mute)" }}>
              рекорд {fmt(Math.max(best, score))}
            </div>
          </div>

          <div className="flex gap-2 mb-5">
            <Panel r="md" className="flex-1 py-2.5">
              <div className="t-num" style={{ fontSize: 17 }}>+{fmt(coins)}</div>
              <div className="t-label" style={{ fontSize: 9 }}>монет</div>
            </Panel>
            <Panel r="md" className="flex-1 py-2.5">
              <div className="t-num" style={{ fontSize: 17 }}>+{fmt(xp)}</div>
              <div className="t-label" style={{ fontSize: 9 }}>опыта</div>
            </Panel>
          </div>

          <div className="flex gap-2.5">
            <Tap onClick={onExit} r="md" className="px-5 py-3.5 t-title" style={{ fontSize: 13 }} sound="swoosh">
              Выйти
            </Tap>
            <Tap onClick={onRetry} accent r="md" className="flex-1 py-3.5 t-title" style={{ fontSize: 14 }} sound="power">
              ЕЩЁ РАЗ
            </Tap>
          </div>
        </Panel>
      </motion.div>
    </motion.div>
  );
}

export function Countdown({ n }: { n: number }) {
  return (
    <motion.div
      key={n}
      initial={{ scale: 2.2, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0 }}
      className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
    >
      <div className="t-display acc-text" style={{ fontSize: 110, textShadow: "0 0 60px var(--acc-glow)" }}>
        {n > 0 ? n : "GO"}
      </div>
    </motion.div>
  );
}
