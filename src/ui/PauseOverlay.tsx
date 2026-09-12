import { AnimatePresence, motion } from "framer-motion";
import { tr } from "../core/i18n";
import { usePause } from "../core/pause";
import { isLowFx } from "../core/perf";
import Icon from "./Icon";

/**
 * ПАУЗА ИГРЫ.
 *
 * Просьба пользователя звучала так: «нажал Esc — ничего не происходит, а
 * игра должна встать на паузу и показать меню с „Продолжить“ и таймером
 * 3-2-1». Реализовано так:
 *
 *   • scrim плотный (var(--scrim-strong)) — за паузой не должно угадываться
 *     поле игры, иначе глаз продолжает следить за партией;
 *   • card — одна карточка по центру: крупная надпись ПАУЗА, кнопки
 *     «Продолжить» и «Выйти», подсказка про Esc;
 *   • «Продолжить» запускает отсчёт 3-2-1 прямо поверх, цифра уходит
 *     уменьшаясь; игра в это время стоит (см. core/pause.ts);
 *   • в лёгком режиме анимаций нет — цифра просто появляется.
 */
export default function PauseOverlay({ label }: { label?: string }) {
  const { paused, countdown, resume, exit } = usePause();
  if (!paused) return null;
  const fx = !isLowFx();

  return (
    <motion.div
      className="pause-scrim"
      initial={fx ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      role="dialog"
      aria-modal="true"
      aria-label={tr("Пауза")}
    >
      <motion.div
        className="pause-card"
        initial={fx ? { scale: 0.9, y: 22, opacity: 0 } : false}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 330, damping: 26 }}
      >
        <div className="pause-kicker">
          <Icon name="pause" size={13} />
          {tr("ПАУЗА")}
        </div>
        {label && <div className="pause-game clip1">{label}</div>}

        <button type="button" className="pause-btn primary" onClick={resume} autoFocus>
          <Icon name="play" size={17} />
          {tr("ПРОДОЛЖИТЬ")}
        </button>
        <button type="button" className="pause-btn" onClick={exit}>
          <Icon name="chevron" size={15} style={{ transform: "rotate(180deg)" }} />
          {tr("Выйти в меню")}
        </button>

        <div className="pause-hint">
          <span className="kbd">Esc</span>
          {tr("— пауза и продолжение")}
        </div>
      </motion.div>

      <AnimatePresence>
        {countdown > 0 && (
          <motion.div
            key={countdown}
            className="pause-count"
            initial={fx ? { scale: 1.6, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 0.9, 0.24, 1] }}
          >
            {countdown}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
