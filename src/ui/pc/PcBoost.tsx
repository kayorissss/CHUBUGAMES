import { useState } from "react";
import { useGame } from "../../core/store";
import { fmt } from "../../core/format";
import { tr } from "../../core/i18n";
import { sfx, haptic } from "../../core/fx";
import { updateGamble } from "../../core/gamble";
import Icon from "../Icon";
import AdModal from "../AdModal";

/**
 * СПОНСОРСКИЙ ДРОП (переработанный баннер просмотра ролика в углу экрана).
 *
 * Компактная неоновая капсула в кибер-стиле игры с возможностью свернуть
 * в мини-значок, чтобы не мешать обзору библиотеки.
 */
export default function PcBoost() {
  const { set, toast } = useGame();
  const [ad, setAd] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const reward = () => {
    setAd(false);
    const coins = 10_000;
    const gems = 10;
    const chips = 75;
    set((d) => {
      d.coins += coins;
      d.totalCoinsEver += coins;
      d.gems += gems;
    });
    updateGamble((g) => ({ ...g, chips: g.chips + chips }));
    sfx.legend();
    haptic("success");
    toast({
      title: tr("ДРОП ПОЛУЧЕН!"),
      sub: `+${fmt(coins)} ${tr("монет")} · +${gems} ◆ · +${chips} ${tr("жетонов")}`,
      icon: "gift",
      tone: "gold",
    });
  };

  if (collapsed) {
    return (
      <>
        <div className="pc-boost pc-boost-mini">
          <button
            type="button"
            className="pc-boost-pill"
            onClick={() => {
              sfx.click();
              setCollapsed(false);
            }}
            title={tr("Развернуть бонус-дроп")}
          >
            <span className="pc-boost-orb">
              <Icon name="gift" size={14} />
            </span>
            <span className="pc-boost-pill-txt">{tr("Бонус-дроп")}</span>
            <span className="pc-boost-pill-tag">+10K</span>
          </button>
        </div>
        <AdModal
          open={ad}
          reason={tr("Спонсорский дроп: +10 000 монет, +10 кристаллов и +75 жетонов")}
          onReward={reward}
          onClose={() => setAd(false)}
        />
      </>
    );
  }

  return (
    <>
      <div className="pc-boost">
        <span className="pc-boost-glow" aria-hidden />

        <div className="pc-boost-head">
          <span className="pc-boost-orb" aria-hidden>
            <Icon name="gift" size={15} />
          </span>
          <div className="pc-boost-titles">
            <span className="pc-boost-kicker">{tr("КИБЕР-КАПСУЛА · 15 СЕК")}</span>
            <span className="pc-boost-title">{tr("Спонсорский дроп")}</span>
          </div>
          <button
            type="button"
            className="pc-boost-hide"
            onClick={() => {
              sfx.click();
              setCollapsed(true);
            }}
            title={tr("Свернуть")}
            aria-label={tr("Свернуть")}
          >
            <Icon name="cross" size={11} />
          </button>
        </div>

        <div className="pc-boost-loot">
          <span className="pc-boost-chip coin">
            <Icon name="coin" size={11} />
            <b>+10 000</b>
          </span>
          <span className="pc-boost-chip gem">
            <Icon name="gem" size={11} />
            <b>+10</b>
          </span>
          <span className="pc-boost-chip casino">
            <Icon name="dice" size={11} />
            <b>+75</b>
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            sfx.click();
            setAd(true);
          }}
          className="pc-boost-go"
        >
          <span className="pc-boost-play-ico" aria-hidden>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
              <path d="M3 2.2L10 6L3 9.8V2.2Z" />
            </svg>
          </span>
          <span>{tr("Забрать награду")}</span>
        </button>
      </div>

      <AdModal
        open={ad}
        reason={tr("Спонсорский дроп: +10 000 монет, +10 кристаллов и +75 жетонов")}
        onReward={reward}
        onClose={() => setAd(false)}
      />
    </>
  );
}
