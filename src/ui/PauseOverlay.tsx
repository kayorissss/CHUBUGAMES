import { motion } from "framer-motion";
import { tr } from "../core/i18n";
import { usePause } from "../core/pause";
import { isLowFx } from "../core/perf";
import { hasKeyboard } from "../core/desktop";
import Icon from "./Icon";
import { Countdown } from "../games/shell";

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
 *     «Продолжить» и «Выйти»;
 *   • подсказка про Esc показывается только там, где клавиатура реально
 *     есть: на телефоне строка про клавишу — мусор, занимающий место;
 *   • «Продолжить» убирает МЕНЮ СРАЗУ, и над полем игры идёт тот же отсчёт
 *     3-2-1, что встречает игрока в начале партии. Раньше цифра уходила
 *     поверх карточки: человек всё ещё смотрел в меню, а не в игру
 *     (просьба буквальная: «менюшка должна пропасть, и таймер уже в игре
 *     появляется, как в начале самом»);
 *   • в лёгком режиме анимаций нет — цифра просто появляется.
 *
 * Игра стоит всё это время: цикл useCanvas проверяет isPaused() и не
 * копит dt (core/pause.ts), поэтому после возвращения персонаж не улетает.
 */
export default function PauseOverlay({ label }: { label?: string }) {
  const { paused, countdown, resume, exit } = usePause();
  if (!paused) return null;
  const fx = !isLowFx();

  /* Возврат из паузы: только отсчёт, без карточки. */
  if (countdown > 0) {
    return (
      <div className="pause-resume" aria-live="polite">
        <Countdown n={countdown} />
      </div>
    );
  }

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

        {hasKeyboard() && (
          <div className="pause-hint">
            <span className="kbd">Esc</span>
            {tr("— пауза и продолжение")}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
