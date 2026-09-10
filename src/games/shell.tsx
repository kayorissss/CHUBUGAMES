import { useEffect, useRef, useState } from "react";
import { tr } from "../core/i18n";
import { motion } from "framer-motion";
import { Panel, Tap } from "../ui/Glass";
import { fmt } from "../core/format";
import Icon from "../ui/Icon";
import { useModes, MARATHON_ROUNDS, survivalMult } from "../core/modes";
import { useGame } from "../core/store";
import { canvasScaleCap, isLowFx } from "../core/perf";
import RulesCard, { RulesButton } from "../ui/RulesCard";
import type { GameId } from "../core/types";
import { modalBackdrop, modalCard, springPop, EASE } from "../core/motion";

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
    // На слабом телефоне рисуем в меньшем разрешении: разницы на глаз
    // почти нет, а пикселей на кадр — вдвое меньше.
    const dpr = Math.min(canvasScaleCap(), window.devicePixelRatio || 1);

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
  score, best, extra, onExit, label = tr("ОЧКИ"), rulesId,
}: {
  score: number; best: number; extra?: React.ReactNode; onExit: () => void; label?: string;
  /** Явный id игры для правил. Обычно не нужен — берётся из режима. */
  rulesId?: GameId;
}) {
  /**
   * Кнопка правил живёт прямо в HUD, поэтому появляется сразу во всех
   * играх: пользователь жаловался, что непонятно, что делать, а править
   * 27 экранов по отдельности — верный способ где-нибудь забыть.
   */
  const modes = useModes();
  const gid = rulesId ?? modes?.currentGame ?? null;
  const [rulesOpen, setRulesOpen] = useState(false);

  return (
    <div
      className="absolute left-0 right-0 z-20 flex items-center gap-2 px-3"
      style={{ top: "calc(var(--sat) + 10px)" }}
    >
      {gid && (
        <RulesCard id={gid} open={rulesOpen} onClose={() => setRulesOpen(false)} />
      )}
      {/* Шапка игры непрозрачная: сквозь неё летели снаряды и цифры
          становились нечитаемыми. Отсюда solid, а не стекло. */}
      <Tap
        onClick={onExit}
        r="md"
        solid
        center
        className="shrink-0 flex items-center justify-center"
        style={{ width: 40, height: 40, padding: 0, background: "var(--surface-2)" }}
        sound="swoosh"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Tap>
      <div
        className="px-4 flex-1 flex items-center justify-between"
        style={{
          height: 40,
          borderRadius: "var(--r-md)",
          background: "var(--surface-2)",
          border: "1px solid var(--btn-brd)",
        }}
      >
        <div className="min-w-0">
          <div className="t-label" style={{ fontSize: 8.5, lineHeight: 1.1 }}>{label}</div>
          <div className="t-num" style={{ fontSize: 19, lineHeight: 1.05 }}>{fmt(score)}</div>
        </div>
        <div className="text-right shrink-0" style={{ marginLeft: 10 }}>
          <div className="t-label" style={{ fontSize: 8.5, lineHeight: 1.1 }}>{tr("Рекорд")}</div>
          <div className="t-num acc-text" style={{ fontSize: 14, lineHeight: 1.15 }}>{fmt(best)}</div>
        </div>
      </div>
      {gid && <RulesButton onClick={() => setRulesOpen(true)} />}
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
      variants={modalBackdrop}
      initial="initial"
      animate="animate"
      className="absolute inset-0 z-40 flex items-center justify-center px-5"
      style={{ background: "rgba(6,6,9,0.88)" }}
    >
      <motion.div
        variants={modalCard}
        initial="initial"
        animate="animate"
        className="w-full max-w-sm"
      >
        {/* Итог забега — непрозрачная карточка со ступенями поверхностей.
            Раньше это было полупрозрачное стекло: поверх пёстрой игры
            цифры читались плохо. */}
        <div
          style={{
            borderRadius: "var(--r-xl)",
            background: "var(--surface)",
            border: "1px solid var(--surface-brd)",
            boxShadow: "0 30px 70px -28px rgba(0,0,0,0.95)",
            overflow: "hidden",
          }}
        >
          {/* Шапка: заголовок и результат на подложке потемнее */}
          <div
            className="text-center"
            style={{
              padding: "22px 20px 20px",
              background: "var(--surface-2)",
              borderBottom: "1px solid var(--surface-brd)",
            }}
          >
            {isRecord && (
              <motion.div
                initial={{ scale: 0, rotate: -8 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.22, ...springPop }}
                className="tag tag-acc"
                style={{ marginBottom: 12 }}
              >
                <Icon name="medal" size={13} />
                {tr("НОВЫЙ РЕКОРД")}
              </motion.div>
            )}
            <div className="t-display" style={{ fontSize: 32, lineHeight: 1.1 }}>{title}</div>
            {sub && (
              <div className="t-body" style={{ marginTop: 5 }}>{sub}</div>
            )}

            <div style={{ marginTop: 18 }}>
              <div className="t-label" style={{ marginBottom: 4 }}>{tr("Результат")}</div>
              <CountUp
                value={score}
                className="t-num acc-text"
                style={{ fontSize: 54, lineHeight: 1 }}
              />
              <div className="t-caption" style={{ marginTop: 5 }}>
                {tr("рекорд")} {fmt(Math.max(best, score))}
              </div>
            </div>
          </div>

          {/* Награда */}
          <div style={{ padding: "16px 20px 20px" }}>
            <div className="flex" style={{ gap: 10, marginBottom: 16 }}>
              {[
                { v: coins, l: tr("монет"), i: "coin" as const, d: 0.28 },
                { v: xp, l: tr("опыта"), i: "level" as const, d: 0.36 },
              ].map((it) => (
                <motion.div
                  key={it.l}
                  className="flex-1 flex items-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: it.d, duration: 0.3, ease: EASE }}
                  style={{
                    gap: 10,
                    padding: "11px 12px",
                    borderRadius: "var(--r-md)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--surface-brd)",
                  }}
                >
                  <span className="ico-box ico-box-acc" style={{ width: 30, height: 30 }}>
                    <Icon name={it.i} size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="t-num block" style={{ fontSize: 17, lineHeight: 1.1 }}>
                      +{fmt(it.v)}
                    </span>
                    <span className="t-label block" style={{ fontSize: 8.5, marginTop: 1 }}>
                      {it.l}
                    </span>
                  </span>
                </motion.div>
              ))}
            </div>

            {onRevive && (
              <Tap
                onClick={onRevive}
                r="md"
                solid
                center
                className="w-full t-title"
                style={{
                  fontSize: 13,
                  marginBottom: 10,
                  padding: "13px 0",
                  background: "var(--ok-soft)",
                  border: "1.5px solid var(--ok-brd)",
                  color: "var(--ok)",
                }}
                sound="power"
              >
                <span className="inline-flex items-center" style={{ gap: 8 }}>
                  <Icon name="play" size={15} />{tr("ПРОДОЛЖИТЬ ЗА РЕКЛАМУ")}
                </span>
              </Tap>
            )}

            {/* Обе кнопки одной высоты и с центрированным текстом. */}
            <div className="flex" style={{ gap: 10 }}>
              <Tap
                onClick={onExit}
                r="md" center solid
                className="t-title"
                style={{
                  fontSize: 13, flex: "0 0 36%", padding: "14px 0", lineHeight: 1.1,
                  background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
                }}
                sound="swoosh"
              >
                {tr("Выйти")}
              </Tap>
              <Tap
                onClick={onRetry}
                accent r="md" center
                className="t-title"
                style={{ fontSize: 14, flex: 1, padding: "14px 0", lineHeight: 1.1 }}
                sound="power"
              >
                {tr("ЕЩЁ РАЗ")}
              </Tap>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Отсчёт перед стартом.
 *
 * Только цифра. Раньше вокруг счётчика расходилось кольцо — пользователь
 * назвал это «уродскими кругами», так что никаких колец, рамок и подложек:
 * число появляется, слегка ужимается и уходит.
 */
export function Countdown({ n }: { n: number }) {
  return (
    <motion.div
      key={n}
      initial={{ scale: 1.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.82, opacity: 0 }}
      transition={{ duration: 0.26, ease: EASE }}
      className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
    >
      <div
        className="t-display"
        style={{
          fontSize: n > 0 ? 128 : 92,
          lineHeight: 1,
          color: "var(--text)",
          // мягкая тень только чтобы цифра читалась на светлом фоне игры
          textShadow: "0 6px 30px rgba(0,0,0,0.7)",
        }}
      >
        {n > 0 ? n : "GO"}
      </div>
    </motion.div>
  );
}

/**
 * Число, которое набегает до значения.
 *
 * Итог забега приятнее читать, когда счёт «докручивается», а не падает
 * готовым. Считаем через requestAnimationFrame по времени, а не по
 * шагам: иначе на слабом телефоне анимация растянется во времени.
 */
export function CountUp({
  value, className, style, ms = 620,
}: { value: number; className?: string; style?: React.CSSProperties; ms?: number }) {
  const [shown, setShown] = useState(isLowFx() ? value : 0);

  useEffect(() => {
    if (isLowFx()) { setShown(value); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      // та же кривая, что и у остальных анимаций
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(value * e));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);

  return <div className={className} style={style}>{fmt(shown)}</div>;
}
