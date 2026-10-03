import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "./Icon";
import { useGame } from "../core/store";
import { tr } from "../core/i18n";
import { fmt } from "../core/format";
import { sfx, haptic } from "../core/fx";
import { updateGamble } from "../core/gamble";
import {
  readFriendship, writeFriendship, chestLeft, chestReady, chestReward, CHEST_MS,
} from "../core/friendship";

/**
 * ЕЖЕЧАСНЫЙ СУНДУК.
 *
 * Повод заглянуть между парами: раз в час копится небольшая награда.
 * Специально сделан слабее одного забега — он дополняет игру, а не заменяет
 * её (расчёт в friendship.ts).
 *
 * Почему переверстан (жалоба «ежечасный сундук вообще стрёмный»): раньше это
 * была горизонтальная полоска на всю ширину — иконка 40 px, текст в одну
 * строку и тонкая полоска прогресса. Ни накопления, ни ожидания, ни «что
 * внутри»: выглядело как уведомление, а не как награда. Теперь это отдельная
 * карточка-сейф: крупный таймер, ряд ячеек накопления (12 делений — видно,
 * как час заполняется), явная награда двумя чипами и кнопка, которая светится
 * ровно тогда, когда можно забрать.
 */

function mmss(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 12 ячеек накопления: сколько заполнено — видно без линейки */
const CELLS = 12;

export default function ChestCard() {
  const { s, addCoins, toast } = useGame();
  const [st, setSt] = useState(() => readFriendship());
  const [, tick] = useState(0);
  const [burst, setBurst] = useState(false);

  // ежесекундно пересчитываем таймер
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const ready = chestReady(st);
  const left = chestLeft(st);
  const rw = chestReward(s.level, st.chestCount);
  const frac = Math.max(0, Math.min(1, 1 - left / CHEST_MS));
  const filled = ready ? CELLS : Math.floor(frac * CELLS);

  const take = () => {
    if (!ready) return;
    const next = { ...st, chestAt: Date.now(), chestCount: st.chestCount + 1 };
    writeFriendship(next);
    setSt(next);

    addCoins(rw.coins);
    // прирастание к АКТУАЛЬНОМУ балансу: если жетоны успели измениться
    // (казино открыто в другом окне), «снимок» затрёт чужую запись
    updateGamble((x) => ({ chips: x.chips + rw.chips }));

    setBurst(true);
    setTimeout(() => setBurst(false), 900);
    sfx.coin?.();
    haptic("success");
    toast({
      title: tr("СУНДУК ОТКРЫТ"),
      sub: `+${fmt(rw.coins)} ${tr("и")} ${rw.chips} ${tr("жетонов")}`,
      icon: "case",
      tone: "gold",
    });
  };

  return (
    <div className={`chest2 ${ready ? "ready" : ""}`}>
      {/* вспышка при открытии */}
      <AnimatePresence>
        {burst && (
          <motion.div
            initial={{ opacity: 0.85, scale: 0.6 }}
            animate={{ opacity: 0, scale: 2.1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            className="chest2-burst"
          />
        )}
      </AnimatePresence>

      <div className="chest2-head">
        <motion.span
          className="chest2-ico"
          animate={ready ? { rotate: [0, -6, 6, -3, 0], scale: [1, 1.07, 1] } : {}}
          transition={{ duration: 1.2, repeat: ready ? Infinity : 0, repeatDelay: 1.8 }}
        >
          <Icon name="case" size={20} />
        </motion.span>
        <div className="min-w-0">
          <div className="t-label chest2-kicker">{tr("ЕЖЕЧАСНЫЙ СУНДУК")}</div>
          <div className="t-caption chest2-state">
            {ready ? tr("можно забирать") : `${tr("откроется через")} ${mmss(left)}`}
          </div>
        </div>
        {st.chestCount > 0 && (
          <span className="chest2-count" title={tr("открыто сундуков")}>
            ×{st.chestCount}
          </span>
        )}
      </div>

      <div className={`chest2-timer ${ready ? "go" : ""}`}>
        {ready ? tr("ГОТОВ") : mmss(left)}
      </div>

      {/* накопление: 12 ячеек вместо тонкой полоски — видно прогресс часа */}
      <div className="chest2-cells" aria-hidden>
        {Array.from({ length: CELLS }).map((_, i) => (
          <span
            key={i}
            className={`chest2-cell ${i < filled ? "on" : ""}`}
            style={{ transitionDelay: `${i * 24}ms` }}
          />
        ))}
      </div>

      <div className="chest2-prize">
        <span className="chest2-chip">
          <Icon name="coin" size={12} />+{fmt(rw.coins)}
        </span>
        <span className="chest2-chip violet">
          <Icon name="ticket" size={12} />+{rw.chips}
        </span>
      </div>

      <button
        type="button"
        className={`chest2-btn ${ready ? "on" : ""}`}
        onClick={take}
        disabled={!ready}
        onMouseEnter={() => ready && haptic("light")}
      >
        {ready ? (
          <>
            <Icon name="bolt" size={15} />
            {tr("ЗАБРАТЬ")}
          </>
        ) : (
          <>
            <Icon name="clock" size={15} />
            {tr("ЖДЁМ")}
          </>
        )}
      </button>
    </div>
  );
}
