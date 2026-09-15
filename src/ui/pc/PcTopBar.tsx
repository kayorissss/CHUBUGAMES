import { motion } from "framer-motion";
import { useGame } from "../../core/store";
import { tr } from "../../core/i18n";
import { fmt } from "../../core/format";
import { sfx, haptic } from "../../core/fx";
import { BrandMark } from "../Brand";
import Icon, { type IconName } from "../Icon";
import type { Tab } from "../../components/Nav";
import type { SubPage } from "../../App";
import { readGamble } from "../../core/gamble";
import { hasLoot } from "../../core/rewards";

/**
 * ВЕРХНЯЯ ПАНЕЛЬ ПК-ВЕРСИИ.
 *
 * Порядок слева направо — ровно как просил пользователь:
 *
 *   [ИКОНКА] CHUBUGAMES | МАГАЗИН | КАЗИНО | ПЕРСОНАЖИ | ПРОГРЕСС …… [ур.] [💰 🪙 💎 🎟]
 *
 *  • Знак + название = кнопка «на главную»: отдельной вкладки «Игры» нет.
 *  • «Настройки» и «Поддержать» из панели убраны целиком: они переехали в
 *    правый нижний угол круглыми кнопками-иконками (ui/pc/PcDock.tsx) — там,
 *    где и просили, над плашкой бонуса за ролик. На 1280 px они влезали в
 *    панель только ценой наложения групп, что и выглядело «криво».
 *  • Освободившийся правый край отдали кошельку: уровень (компактный чип,
 *    а не плашка на треть панели) и три валюты.
 *  • Версия и подсказки F11/Esc из панели убраны: версия — в строке состояния
 *    внизу окна, клавиши — в «Настройки → Игра».
 *
 * Ничего не накладывается: у панели `flex-wrap: nowrap`, каждая группа
 * `flex: 0 0 auto`, сужается только то, что умеет (метки вкладок скрываются
 * медиазапросом, а не наползанием).
 */

/** Разделы. Тот порядок, что назван пользователем, — справа от названия. */
const TABS: { id: Tab | "casino"; label: string; icon: IconName; sub?: boolean }[] = [
  { id: "shop", label: "Магазин", icon: "shop" },
  { id: "casino", label: "Казино", icon: "ticket", sub: true },
  { id: "friends", label: "Персонажи", icon: "users" },
  { id: "progress", label: "Прогресс", icon: "chart" },
];

export default function PcTopBar({
  tab, sub, onTab, onOpen,
}: {
  tab: Tab;
  sub: SubPage | null;
  onTab: (t: Tab) => void;
  onOpen?: (p: SubPage) => void;
}) {
  const { s, levelPct, toast } = useGame();
  const chips = readGamble().chips;
  const go = (next: Tab) => { sfx.click(); haptic("light"); onTab(next); };

  return (
    <header className="pc-bar">
      {/* Знак = дом. */}
      <button
        type="button"
        className={`pc-bar-brand ${tab === "home" && !sub ? "on" : ""}`}
        onClick={() => go("home")}
        title={tr("На главную")}
        aria-label={tr("CHUBUGAMES — на главную")}
      >
        <BrandMark size={28} />
        <span className="t-display pc-bar-word">CHUBUGAMES</span>
      </button>

      <span className="pc-bar-sep" aria-hidden />

      {/* Разделы */}
      <nav className="pc-bar-tabs" aria-label={tr("Разделы")}>
        {TABS.map((it) => {
          const on = it.sub ? sub === it.id : tab === it.id && !sub;
          /* точка-сигнал: есть что забрать (ежедневный вход) — иначе о
             награде узнаёшь, только зайдя внутрь раздела */
          const loot = it.id === "progress" && hasLoot(s);
          return (
            <button
              key={it.id}
              type="button"
              className={`pc-tab ${on ? "on" : ""}`}
              aria-current={on ? "page" : undefined}
              onClick={() => (it.sub ? (sfx.click(), haptic("light"), onOpen?.("casino")) : go(it.id as Tab))}
            >
              {on && (
                <motion.span
                  layoutId="pc-tab-active"
                  className="pc-tab-pill"
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                  aria-hidden
                />
              )}
              <span className="pc-tab-ico">
                <Icon name={it.icon} size={15} />
              </span>
              <span className="t-body pc-tab-label">{tr(it.label)}</span>
              {loot && <span className="pc-tab-dot" aria-label={tr("есть награда")} />}
            </button>
          );
        })}
      </nav>

      {/* Правый край: кошелёк. Уровень — маленький чип ПЕРЕД валютами (так
          просили), валюты по-прежнему кликабельны и объясняют себя тостом. */}
      <div className="pc-bar-tail">
        <button
          type="button"
          className="pc-bar-level"
          onClick={() => go("progress")}
          title={`${tr("Уровень")} ${s.level} · ${Math.round(levelPct)}% ${tr("до следующего")}`}
        >
          <span className="t-num pc-bar-lvl">{tr("Ур.")} {s.level}</span>
          <span className="pc-bar-xp" aria-hidden>
            <span style={{ width: `${levelPct}%` }} />
          </span>
        </button>

        <div className="pc-bar-wallet">
          <button
            type="button"
            className="pc-wallet-item"
            onClick={() => {
              haptic("light");
              toast({
                title: tr("ЧУБКОИНЫ"),
                sub: tr("Основная валюта: игры, магазин, кейсы"),
                icon: "coin",
                tone: "gold",
              });
            }}
          >
            <span style={{ color: "var(--gold)", lineHeight: 0 }}><Icon name="coin" size={14} /></span>
            <span className="t-num">{fmt(s.coins)}</span>
          </button>
          <button
            type="button"
            className="pc-wallet-item pc-wallet-gem"
            onClick={() => {
              haptic("light");
              toast({
                title: tr("АЛМАЗЫ"),
                sub: tr("Редкая валюта: скины, крупные покупки"),
                icon: "gem",
                tone: "normal",
              });
            }}
          >
            <span style={{ color: "var(--violet)", lineHeight: 0 }}><Icon name="gem" size={14} /></span>
            <span className="t-num">{fmt(s.gems)}</span>
          </button>
          {chips > 0 && (
            <button
              type="button"
              className="pc-wallet-item pc-wallet-chips"
              onClick={() => { haptic("light"); onOpen?.("casino"); }}
              title={tr("Жетоны казино")}
            >
              <span style={{ color: "var(--violet)", lineHeight: 0 }}><Icon name="ticket" size={14} /></span>
              <span className="t-num">{fmt(chips)}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
