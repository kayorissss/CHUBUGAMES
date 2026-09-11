import { motion } from "framer-motion";
import { useGame } from "../../core/store";
import { tr } from "../../core/i18n";
import { fmt } from "../../core/format";
import { sfx, haptic } from "../../core/fx";
import { BrandMark } from "../Brand";
import Icon, { type IconName } from "../Icon";
import { APP_VERSION } from "../../core/version";
import type { Tab } from "../../components/Nav";
import type { SubPage } from "../../App";

/**
 * ВЕРХНЯЯ ПАНЕЛЬ ПК-ВЕРСИИ.
 *
 * На телефоне разделы живут внизу — до них дотягиваться пальцем удобно.
 * На мониторе нижнее меню выглядело чужеродно, а боковая панель, которую
 * мы делали вместо него, съела треть ширины и оставила игры в узкой
 * колонке справа.
 *
 * Теперь как в нормальных игровых клиентах: сверху одна панель — знак,
 * разделы, дополнительные страницы, кошелёк и подсказка по клавишам.
 * Вся ширина окна отдана контенту, а сама панель не уезжает при скролле.
 */

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "home", label: "Игры", icon: "play" },
  { id: "progress", label: "Прогресс", icon: "chart" },
  { id: "shop", label: "Магазин", icon: "shop" },
  { id: "friends", label: "Друзья", icon: "users" },
  { id: "settings", label: "Настройки", icon: "settings" },
];

const EXTRA: { id: SubPage; label: string; icon: IconName; tone: string }[] = [
  { id: "boss", label: "Босс", icon: "skull", tone: "var(--danger)" },
  { id: "casino", label: "Казино", icon: "dice", tone: "var(--violet)" },
  { id: "fanfic", label: "Фанфики", icon: "note", tone: "var(--violet)" },
  { id: "network", label: "Сеть", icon: "wifi", tone: "var(--info)" },
  { id: "donate", label: "Поддержать", icon: "heart", tone: "var(--gold)" },
];

export default function PcTopBar({
  tab, sub, onTab, onOpen, onOpenProfile,
}: {
  tab: Tab;
  sub: SubPage | null;
  onTab: (t: Tab) => void;
  onOpen: (p: SubPage) => void;
  onOpenProfile?: () => void;
}) {
  const { s, levelPct, toast } = useGame();

  return (
    <header className="pc-bar">
      {/* Знак + вход в профиль */}
      <button
        type="button"
        className="pc-bar-brand"
        onClick={() => { sfx.click(); haptic("light"); onOpenProfile?.(); }}
        title={tr("Открыть профиль")}
      >
        <BrandMark size={30} />
        <span className="t-display pc-bar-word">CHUBUGAMES</span>
        <span className="t-num pc-bar-lvl">
          {tr("УР")} {s.level}
        </span>
        <span className="pc-bar-xp" aria-hidden>
          <span style={{ width: `${levelPct}%` }} />
        </span>
      </button>

      <span className="pc-bar-sep" aria-hidden />

      {/* Разделы */}
      <nav className="pc-bar-tabs" aria-label={tr("Разделы")}>
        {TABS.map((it, i) => {
          const on = tab === it.id && !sub;
          return (
            <button
              key={it.id}
              type="button"
              className={`pc-tab ${on ? "on" : ""}`}
              aria-current={on ? "page" : undefined}
              onClick={() => { sfx.click(); haptic("light"); onTab(it.id); }}
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
              <span className="t-num pc-tab-key">{i + 1}</span>
            </button>
          );
        })}
      </nav>

      {/* Вторые страницы */}
      <nav className="pc-bar-extra" aria-label={tr("Дополнительно")}>
        {EXTRA.map((it) => {
          const on = sub === it.id;
          return (
            <button
              key={it.id}
              type="button"
              className={`pc-xtra ${on ? "on" : ""}`}
              style={on ? { color: "var(--acc-ink)" } : undefined}
              onClick={() => { sfx.click(); haptic("light"); onOpen(it.id); }}
            >
              <span style={{ color: on ? undefined : it.tone, lineHeight: 0 }}>
                <Icon name={it.icon} size={14} />
              </span>
              <span className="t-body">{tr(it.label)}</span>
            </button>
          );
        })}
      </nav>

      {/* Кошелёк */}
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
          className="pc-wallet-item"
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
      </div>

      <span className="t-caption pc-bar-hint">
        <b>F11</b> {tr("полный экран")} · <b>Esc</b> {tr("назад")}
      </span>
      <span className="t-num pc-bar-ver">v{APP_VERSION}</span>
    </header>
  );
}
