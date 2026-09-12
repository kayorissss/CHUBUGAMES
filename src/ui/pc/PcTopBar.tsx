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

/**
 * ВЕРХНЯЯ ПАНЕЛЬ ПК-ВЕРСИИ.
 *
 * Что в ней было до этого: знак, пять разделов, пять «вторых страниц»
 * (босс, казино, фанфики, сеть, поддержать), кошелёк, подсказка про F11 и
 * номер версии. Восемь групп в полосе высотой 3.5rem — они не влезали даже
 * на 1920 px: на узких окнах начиналось наслаивание, а половина кнопок
 * дублировала то, что уже есть на самой странице (босс, казино, фанфики).
 *
 * Теперь правило одно: в панели только то, что нужно ВСЕГДА и ВСЮДУ.
 *
 *   CHUBUGAMES | Ур. 3 | 💰 26к 💎 310 🎟 40 | Прогресс Магазин Персонажи | … | Поддержать Настройки
 *
 * • CHUBUGAMES — кнопка «на главную»: отдельной вкладки «Игры» больше нет.
 * • Уровень, опыт и валюты — одна строка сверху: дублировать их в шапке
 *   главной страницы смысла нет (именно это и выглядело как «ужас справа»).
 * • Разделов три. Босс, казино и фанфики живут карточками на главной,
 *   сеть уехала в настройки — кнопки-дубли сверху лишние.
 * • Настройки — в правом углу, «Поддержать» сразу левее них.
 * • F11/Esc и номер версии убраны: подсказка по клавишам есть в настройках,
 *   а версия — внизу настроек же, где про неё и спрашивают.
 *
 * Ничего не накладывается: у панели `flex-wrap: nowrap`, каждая группа
 * `flex: 0 0 auto`, а сужается только то, что умеет (метки вкладок и лишние
 * валюты скрываются медиазапросами, а не наползанием друг на друга).
 */

/** Разделы. Порядок = порядок вкладок на телефоне, цифры 1–5 те же. */
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "progress", label: "Прогресс", icon: "chart" },
  { id: "shop", label: "Магазин", icon: "shop" },
  { id: "friends", label: "Персонажи", icon: "users" },
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

      {/* Уровень и опыт. Тап — в прогресс: больше nowhere уровень не нужен. */}
      <button
        type="button"
        className="pc-bar-level"
        onClick={() => go("progress")}
        title={tr("Уровень и опыт")}
      >
        <span className="t-num pc-bar-lvl">{tr("Ур.")} {s.level}</span>
        <span className="pc-bar-xp" aria-hidden>
          <span style={{ width: `${levelPct}%` }} />
        </span>
        <span className="t-caption pc-bar-xp-num">{Math.round(levelPct)}%</span>
      </button>

      {/* Валюты. Тап по каждой — что это за валюта (просьба пользователя). */}
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

      {/* Разделы */}
      <nav className="pc-bar-tabs" aria-label={tr("Разделы")}>
        {TABS.map((it) => {
          const on = tab === it.id && !sub;
          return (
            <button
              key={it.id}
              type="button"
              className={`pc-tab ${on ? "on" : ""}`}
              aria-current={on ? "page" : undefined}
              onClick={() => go(it.id)}
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
            </button>
          );
        })}
      </nav>

      {/* Правый угол: поддержка и настройки. Настройки — последними, в углу,
          как и просили; «Поддержать» — сразу левее них. */}
      <div className="pc-bar-tail">
        <button
          type="button"
          className={`pc-xtra ${sub === "donate" ? "on" : ""}`}
          onClick={() => { sfx.click(); haptic("light"); onOpen?.("donate"); }}
        >
          <span style={{ lineHeight: 0 }}><Icon name="heart" size={14} /></span>
          <span className="t-body">{tr("Поддержать")}</span>
        </button>
        <button
          type="button"
          className={`pc-tab pc-tab-gear ${tab === "settings" || sub === "network" ? "on" : ""}`}
          aria-current={tab === "settings" && !sub ? "page" : undefined}
          onClick={() => go("settings")}
        >
          <span className="pc-tab-ico">
            <Icon name="settings" size={15} />
          </span>
          <span className="t-body pc-tab-label">{tr("Настройки")}</span>
        </button>
      </div>
    </header>
  );
}
