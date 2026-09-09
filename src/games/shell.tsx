import { useEffect, useRef } from "react";
import { tr } from "../core/i18n";
import { motion } from "framer-motion";
import { Panel, Tap } from "../ui/Glass";
import { fmt } from "../core/format";
import Icon from "../ui/Icon";
import { useModes, MARATHON_ROUNDS, survivalMult } from "../core/modes";
import { useGame } from "../core/store";

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
  score, best, extra, onExit, label = tr("ОЧКИ"),
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
          <div className="t-label" style={{ fontSize: 9 }}>{tr("Рекорд")}</div>
          <div className="t-num acc-text" style={{ fontSize: 15, lineHeight: 1.2 }}>{fmt(best)}</div>
        </div>
      </Panel>
      {extra}
    </div>
  );
}

export function GameOver({
  score, best, coins, xp, onRetry, onExit, title = tr("ВСЁ"), sub, onRevive,
}: {
  score: number; best: number; coins: number; xp: number;
  onRetry: () => void; onExit: () => void; title?: string; sub?: string;
  /** Если передан — покажем «Продолжить за рекламу» (одна попытка за забег) */
  onRevive?: () => void;
}) {
  const isRecord = score >= best && score > 0;
  const modes = useModes();
  const run = modes?.run ?? null;
  const surv = modes?.survival ?? null;
  const spr = modes?.sprint ?? null;
  const { addCoins, toast } = useGame();

  // В марафоне свой экран итогов: очки складываются, «Ещё раз» не нужен
  const reported = useRef(false);
  useEffect(() => {
    if (run && !run.pending && !run.finished && !reported.current) {
      reported.current = true;
      modes?.reportRound(score);
    }
  }, [run, score, modes]);

  // Выживание: сообщаем результат раунда ровно один раз
  const survReported = useRef(false);
  useEffect(() => {
    if (surv && !surv.pending && !surv.finished && !survReported.current) {
      survReported.current = true;
      modes?.reportSurvival(score);
    }
  }, [surv, score, modes]);

  // Спринт: складываем очки и сразу перезапускаем, пока не вышло время
  const sprReported = useRef(false);
  useEffect(() => {
    if (spr && !spr.finished && !sprReported.current) {
      sprReported.current = true;
      modes?.reportSprint(score);
    }
  }, [spr, score, modes]);

  // Испытание дня засчитывается из любой игры — проверяем один раз за заход
  const chDone = useRef(false);
  useEffect(() => {
    if (chDone.current || !modes?.currentGame) return;
    chDone.current = true;
    if (modes.reportChallenge(modes.currentGame, score)) {
      setTimeout(() => {
        toast({
          title: tr("Испытание дня выполнено"),
          sub: tr("Забери награду на главной"),
          icon: "target",
          tone: "gold",
        });
      }, 900);
    }
  }, [modes, score, toast]);

  /* ─── Выживание: одна ошибка — и всё ─── */
  if (surv) {
    const mult = survivalMult(surv.cleared);
    const prize = Math.floor((2000 + surv.total * 2) * mult);
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
            <div className="t-label" style={{ marginBottom: 6 }}>
              {surv.failed ? tr("Серия оборвалась") : tr("Выживание")}
            </div>
            <div
              className="t-display"
              style={{ fontSize: 32, color: surv.failed ? "#FF6B4D" : undefined }}
            >
              {surv.failed ? tr("НЕ ХВАТИЛО") : tr("ДЕРЖИШЬСЯ")}
            </div>

            <div className="my-5">
              <div className="t-label mb-1">{tr("Игр подряд")}</div>
              <div className="t-num acc-text" style={{ fontSize: 50, lineHeight: 1 }}>
                {surv.cleared}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text-mute)" }}>
                {tr("множитель награды")} x{mult.toFixed(2)}
              </div>
            </div>

            {surv.finished ? (
              <Tap
                onClick={() => {
                  addCoins(prize);
                  toast({
                    title: tr("Выживание"),
                    sub: `+${fmt(prize)}`,
                    icon: "shield",
                    tone: "gold",
                  });
                  modes?.closeSurvival();
                }}
                accent r="md" center
                className="w-full py-3.5 t-title"
                style={{ fontSize: 14 }}
                sound="coin"
              >
                {tr("ЗАБРАТЬ")} +{fmt(prize)}
              </Tap>
            ) : (
              <div className="flex gap-2.5">
                <Tap
                  onClick={() => {
                    addCoins(prize);
                    toast({ title: tr("Забрал и вышел"), sub: `+${fmt(prize)}`, icon: "coin", tone: "gold" });
                    modes?.closeSurvival();
                  }}
                  r="md" className="px-5 py-3.5 t-title"
                  style={{ fontSize: 13 }} sound="coin"
                >
                  {tr("ЗАБРАТЬ")}
                </Tap>
                <Tap
                  onClick={() => modes?.nextSurvival()}
                  accent r="md" center
                  className="flex-1 py-3.5 t-title"
                  style={{ fontSize: 13 }} sound="power"
                >
                  {tr("РИСКНУТЬ ДАЛЬШЕ")}
                </Tap>
              </div>
            )}
          </Panel>
        </motion.div>
      </motion.div>
    );
  }

  /* ─── Спринт: две минуты, экран показываем только в конце ─── */
  if (spr?.finished) {
    const prize = Math.floor(1500 + spr.score * 2.5);
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
            <div className="t-label" style={{ marginBottom: 6 }}>{tr("Спринт окончен")}</div>
            <div className="t-display" style={{ fontSize: 32 }}>{tr("ВРЕМЯ ВЫШЛО")}</div>
            <div className="my-5">
              <div className="t-label mb-1">{tr("Очков за две минуты")}</div>
              <div className="t-num acc-text" style={{ fontSize: 50, lineHeight: 1 }}>
                {fmt(spr.score)}
              </div>
            </div>
            <Tap
              onClick={() => {
                addCoins(prize);
                toast({ title: tr("Спринт"), sub: `+${fmt(prize)}`, icon: "bolt", tone: "gold" });
                modes?.closeSprint();
              }}
              accent r="md" center
              className="w-full py-3.5 t-title"
              style={{ fontSize: 14 }}
              sound="coin"
            >
              {tr("ЗАБРАТЬ")} +{fmt(prize)}
            </Tap>
          </Panel>
        </motion.div>
      </motion.div>
    );
  }

  if (run) {
    const total = run.scores.reduce((a, b) => a + b, 0);
    const roundNo = Math.min(run.idx + 1, MARATHON_ROUNDS);
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
            <div className="t-label" style={{ marginBottom: 6 }}>
              {run.finished ? "Марафон пройден" : `Раунд ${roundNo} из ${MARATHON_ROUNDS}`}
            </div>
            <div className="t-display" style={{ fontSize: 32 }}>
              {run.finished ? "ФИНИШ" : title}
            </div>

            <div className="my-5">
              <div className="t-label mb-1">{run.finished ? "Всего очков" : tr("Сумма")}</div>
              <div className="t-num acc-text" style={{ fontSize: 50, lineHeight: 1 }}>
                {fmt(total)}
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--text-mute)" }}>
                за этот раунд +{fmt(score)}
              </div>
            </div>

            {/* Точки прогресса марафона */}
            <div className="flex justify-center" style={{ gap: 7, marginBottom: 20 }}>
              {Array.from({ length: MARATHON_ROUNDS }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 9, height: 9, borderRadius: 99,
                    background: i < run.scores.length ? "var(--acc)" : "rgba(255,255,255,0.16)",
                  }}
                />
              ))}
            </div>

            {run.finished ? (
              <Tap
                onClick={() => {
                  // бонус за то, что дошёл до конца, а не бросил на середине
                  const bonus = 2500 + total * 3;
                  addCoins(bonus);
                  toast({
                    title: tr("Марафон пройден"),
                    sub: `+${fmt(bonus)} сверху`,
                    icon: "trophy",
                    tone: "gold",
                  });
                  modes?.closeMarathon();
                }}
                accent r="md" center
                className="w-full py-3.5 t-title"
                style={{ fontSize: 14 }}
                sound="coin"
              >
                ЗАБРАТЬ +{fmt(2500 + total * 3)}
              </Tap>
            ) : (
              <div className="flex gap-2.5">
                <Tap
                  onClick={() => modes?.closeMarathon()}
                  r="md" className="px-5 py-3.5 t-title"
                  style={{ fontSize: 13 }} sound="swoosh"
                >{tr("Сдаться")}</Tap>
                <Tap
                  onClick={() => modes?.nextRound()}
                  accent r="md" className="flex-1 py-3.5 t-title"
                  style={{ fontSize: 14 }} sound="power"
                >{tr("ДАЛЬШЕ")}</Tap>
              </div>
            )}
          </Panel>
        </motion.div>
      </motion.div>
    );
  }

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
              <span className="inline-flex items-center" style={{ gap: 7 }}><Icon name="medal" size={14} />{tr("НОВЫЙ РЕКОРД")}</span>
            </motion.div>
          )}
          <div className="t-display" style={{ fontSize: 36 }}>{title}</div>
          {sub && <div className="text-sm mt-1" style={{ color: "var(--text-mute)" }}>{sub}</div>}

          <div className="my-5">
            <div className="t-label mb-1">{tr("Результат")}</div>
            <div className="t-num acc-text" style={{ fontSize: 52, lineHeight: 1 }}>{fmt(score)}</div>
            <div className="text-xs mt-1" style={{ color: "var(--text-mute)" }}>
              рекорд {fmt(Math.max(best, score))}
            </div>
          </div>

          <div className="flex gap-2 mb-5">
            <Panel r="md" className="flex-1 py-2.5">
              <div className="t-num" style={{ fontSize: 17 }}>+{fmt(coins)}</div>
              <div className="t-label" style={{ fontSize: 9 }}>{tr("монет")}</div>
            </Panel>
            <Panel r="md" className="flex-1 py-2.5">
              <div className="t-num" style={{ fontSize: 17 }}>+{fmt(xp)}</div>
              <div className="t-label" style={{ fontSize: 9 }}>{tr("опыта")}</div>
            </Panel>
          </div>

          {onRevive && (
            <Tap
              onClick={onRevive}
              r="md"
              solid
              center
              className="w-full py-3.5 t-title"
              style={{
                fontSize: 13, marginBottom: 10,
                border: "1.5px solid #59FF9E",
                color: "#59FF9E",
              }}
              sound="power"
            >
              <span className="inline-flex items-center" style={{ gap: 8 }}>
                <Icon name="play" size={15} />{tr("ПРОДОЛЖИТЬ ЗА РЕКЛАМУ")}</span>
            </Tap>
          )}

          <div className="flex gap-2.5">
            <Tap onClick={onExit} r="md" className="px-5 py-3.5 t-title" style={{ fontSize: 13 }} sound="swoosh">{tr("Выйти")}</Tap>
            <Tap onClick={onRetry} accent r="md" className="flex-1 py-3.5 t-title" style={{ fontSize: 14 }} sound="power">{tr("ЕЩЁ РАЗ")}</Tap>
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
