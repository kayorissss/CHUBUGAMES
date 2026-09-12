import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "../Icon";
import AdModal from "../AdModal";
import { useGame } from "../../core/store";
import { tr } from "../../core/i18n";
import { fmt } from "../../core/format";
import { autoRate } from "../../core/save";
import { MAX_BONUS_PER_DAY, bonusesLeft, hasAds, noteBonus } from "../../core/ads";

/**
 * БОНУС ЗА ПРОСМОТР — плашка в правом нижнем углу.
 *
 * Просили конкретно: «плашка с деньгами за просмотр рекламы — это просто
 * маленькая красивая плашечка в правом нижнем углу, поверх всего, и по нажатию
 * на неё он уже может посмотреть рекламу».
 *
 * Почему её больше нет в правой колонке главной: бонус нужен не на главной, а
 * ТАМ, где игрок устал, — то есть сразу после проигранной партии и в любом
 * разделе. В колонке он живёт только на одном экране и его никто не видит в
 * момент, когда он нужен.
 *
 * В углу, а не по центру: он не перекрывает ни меню, ни сцену. Компактный, а
 * не «карточка на пол-экрана»: сумма, точки остатка попыток и одна кнопка.
 * Внутри игры (game != null) и при пустом кошельке роликов плашка молча
 * исчезает — показывать «0 из 5» незачем.
 */
export default function PcBoost() {
  const { s, addCoins, toast } = useGame();
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(() => bonusesLeft());

  if (!hasAds() || left <= 0) return null;

  const reward = Math.max(500, Math.floor(autoRate(s) * 180) + s.level * 250);

  return (
    <>
      <motion.aside
        className="pc-boost"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
      >
        <span className="pc-boost-ico" aria-hidden>
          <Icon name="coin" size={14} />
        </span>
        <span className="pc-boost-text">
          <span className="pc-boost-sum">+{fmt(reward)}</span>
          <span className="pc-boost-cap">{tr("за ролик")}</span>
        </span>
        <span className="pc-boost-dots" title={`${left} ${tr("из")} ${MAX_BONUS_PER_DAY}`}>
          {Array.from({ length: Math.min(MAX_BONUS_PER_DAY, 5) }).map((_, i) => (
            <i key={i} className={i < left ? "on" : ""} />
          ))}
        </span>
        <button
          type="button"
          className="pc-boost-go"
          onClick={() => setOpen(true)}
          title={tr("Посмотреть ролик и получить бонус")}
        >
          <Icon name="play" size={12} />
          {tr("СМОТРЕТЬ")}
        </button>
      </motion.aside>

      <AnimatePresence>
        {open && (
          <AdModal
            reason={`+${fmt(reward)} ${tr("монет")}`}
            onReward={() => {
              addCoins(reward);
              noteBonus();
              setLeft(bonusesLeft());
              toast({
                title: tr("НАГРАДА ПОЛУЧЕНА"),
                sub: `+${fmt(reward)}`,
                icon: "coin",
                tone: "gold",
              });
            }}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
