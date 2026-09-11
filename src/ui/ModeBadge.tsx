import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Icon from "./Icon";
import { tr } from "../core/i18n";
import { useModes, MARATHON_ROUNDS, survivalTarget, survivalMult } from "../core/modes";
import { useGame } from "../core/store";
import { fmt } from "../core/format";

/**
 * ПЛАШКА АКТИВНОГО РЕЖИМА поверх игры.
 *
 * Раньше, начав марафон или выживание, игрок терял из виду, где он
 * находится: HUD показывал обычный счёт, а какой это раунд, сколько
 * нужно набрать и сколько осталось времени — нигде. Игра выглядела
 * сломанной, хотя режим работал.
 *
 * Плашка висит под HUD и показывает ровно то, что нужно прямо сейчас.
 */
export default function ModeBadge() {
  const modes = useModes();
  const { s } = useGame();
  const [, tick] = useState(0);

  const spr = modes?.sprint ?? null;

  // Таймер спринта надо перерисовывать каждую секунду
  useEffect(() => {
    if (!spr || spr.finished) return;
    const iv = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(iv);
  }, [spr, spr?.finished]);

  if (!modes) return null;
  const run = modes.run;
  const surv = modes.survival;

  let icon: "run" | "shield" | "bolt" = "run";
  let name = "";
  let info = "";
  let color = "var(--acc)";

  if (run && !run.finished) {
    icon = "run";
    color = "var(--acc)";
    name = tr("Марафон");
    const done = run.scores.reduce((a, b) => a + b, 0);
    info = `${tr("игра")} ${run.idx + 1}/${MARATHON_ROUNDS} · ${fmt(done)} ${tr("очк")}`;
  } else if (surv && !surv.finished) {
    icon = "shield";
    color = "var(--danger)";
    name = tr("Выживание");
    // Цель раунда считается от личного рекорда именно в текущей игре
    const best = s.games[surv.game]?.best ?? 0;
    const need = survivalTarget(surv.cleared, best);
    info = `${tr("нужно")} ${fmt(need)} · ${tr("серия")} ${surv.cleared} · x${survivalMult(surv.cleared).toFixed(2)}`;
  } else if (spr && !spr.finished) {
    icon = "bolt";
    color = "var(--info)";
    name = tr("Спринт");
    const left = Math.max(0, spr.endsAt - Date.now());
    const mm = Math.floor(left / 60000);
    const ss = Math.floor((left % 60000) / 1000);
    info = `${mm}:${String(ss).padStart(2, "0")} · ${fmt(spr.score)} ${tr("очк")}`;
  } else {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute z-20 flex items-center"
      style={{
        /*
         * Плашка висит НАД полосой HUD и не занимает высоту в потоке:
         * игры считают свой верхний отступ от HUD_PAD, и любой лишний
         * блок сдвинул бы игровое поле во всех 29 играх сразу.
         * Поэтому позиционируем абсолютно и делаем её тонкой.
         */
        left: 10, right: 10,
        top: "calc(var(--sat) + 8px + 44px + 4px)",
        gap: 8,
        padding: "4px 10px",
        borderRadius: 999,
        // Непрозрачный фон: поверх игры полупрозрачное не читается
        background: "var(--surface-2)",
        border: `1px solid ${color}`,
        pointerEvents: "none",
      }}
    >
      <span style={{ color, lineHeight: 0 }}>
        <Icon name={icon} size={13} />
      </span>
      <span className="t-label shrink-0" style={{ fontSize: 8.5, color }}>
        {name.toUpperCase()}
      </span>
      <span
        className="t-num flex-1 text-right clip1"
        style={{ fontSize: 10.5, color: "var(--text-dim)" }}
      >
        {info}
      </span>
    </motion.div>
  );
}
