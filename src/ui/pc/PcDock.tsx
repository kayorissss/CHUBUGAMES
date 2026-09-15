import { motion } from "framer-motion";
import Icon from "../Icon";
import PcBoost from "./PcBoost";
import { sfx, haptic } from "../../core/fx";
import { tr } from "../../core/i18n";
import { useDeferredUpdate } from "../../core/updateState";
import type { Tab } from "../../components/Nav";
import type { SubPage } from "../../App";

/**
 * ПРАВЫЙ НИЖНИЙ УГОЛ ПК-ОБОЛОЧКИ.
 *
 * Просьба: «кнопки „Настройки“ и „Поддержать“ перенести над плашкой
 * „смотреть рекламу“, в круглые кнопки и просто иконки». То есть угол
 * собирается в одну колонку:
 *
 *        [ ! ]  ← только когда отложено обновление
 *        [♥] [⚙]
 *        ( +2 400 за ролик · СМОТРЕТЬ )
 *
 * Почему это не «ещё один слой»: раньше эти две кнопки жили в верхней панели
 * и спорили с разделами за место — отсюда и «наслаивание» на 1280 px. В углу
 * они всегда на одном месте, не зависят от ширины окна и перекрывают только
 * поле библиотеки, где ничего не кликается под ними.
 *
 * Знак «!» на шестерёнке и отдельная круглая кнопка обновления горят, пока
 * отложенная версия не станет установленной (core/updateState.ts).
 */

export default function PcDock({
  tab, sub, onTab, onOpen,
}: {
  tab: Tab;
  sub: SubPage | null;
  onTab: (t: Tab) => void;
  onOpen: (p: SubPage) => void;
}) {
  const later = useDeferredUpdate();

  return (
    // .pc-dock без transform: внутри живёт AdModal с position: fixed, и любая
    // анимация на контейнере превратила бы его в «fixed внутри блока».
    <div className="pc-dock">
      <motion.div
        className="pc-dock-rounds"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
      >
        {later && (
          <button
            type="button"
            className="pc-round pc-round-update"
            title={`${tr("Вышло обновление")} ${later}`}
            aria-label={`${tr("Вышло обновление")} ${later}`}
            onClick={() => { sfx.click(); haptic("light"); onOpen("update"); }}
          >
            <Icon name="arrowUp" size={16} />
            <span className="pc-round-flag" aria-hidden />
          </button>
        )}
        <button
          type="button"
          className={`pc-round ${sub === "donate" ? "on" : ""}`}
          title={tr("Поддержать")}
          aria-label={tr("Поддержать")}
          onClick={() => { sfx.click(); haptic("light"); onOpen("donate"); }}
        >
          <Icon name="heart" size={16} />
        </button>
        <button
          type="button"
          className={`pc-round ${tab === "settings" ? "on" : ""}`}
          title={tr("Настройки")}
          aria-label={tr("Настройки")}
          aria-current={tab === "settings" ? "page" : undefined}
          onClick={() => { sfx.click(); haptic("light"); onTab("settings"); }}
        >
          <Icon name="settings" size={16} />
          {later && <span className="pc-round-flag" aria-hidden />}
        </button>
      </motion.div>
      <PcBoost />
    </div>
  );
}
