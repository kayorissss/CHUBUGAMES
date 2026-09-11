import { motion } from "framer-motion";
import { useGame } from "../core/store";
import { tr } from "../core/i18n";
import { fmt } from "../core/format";
import { sfx, haptic } from "../core/fx";
import { Bar } from "./Glass";
import Icon from "./Icon";
import type { IconName } from "./Icon";
import type { Tab } from "../components/Nav";
import type { SubPage } from "../App";

/**
 * БОКОВАЯ ПАНЕЛЬ ПК-ВЕРСИИ.
 *
 * На телефоне разделы живут в нижней навигации — пальцем до неё удобно.
 * На мониторе тянуться мышью вниз экрана неудобно, а места по бокам
 * полно, поэтому разделы, профиль и валюта переезжают в левую колонку.
 *
 * Раскладка задана в .pc-grid (src/index.css): слева эта панель,
 * справа сетка игр, сверху во всю ширину — босс.
 */

const ITEMS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "home", label: "Игры", icon: "play" },
  { id: "progress", label: "Прогресс", icon: "chart" },
  { id: "shop", label: "Магазин", icon: "shop" },
  { id: "friends", label: "Друзья", icon: "users" },
  { id: "settings", label: "Настройки", icon: "settings" },
];

const EXTRA: { id: SubPage; label: string; icon: IconName; tone: string }[] = [
  { id: "casino", label: "Казино", icon: "dice", tone: "var(--violet)" },
  { id: "network", label: "Сеть", icon: "wifi", tone: "var(--info)" },
  { id: "fanfic", label: "Фанфики", icon: "note", tone: "var(--violet)" },
  { id: "donate", label: "Поддержать", icon: "heart", tone: "var(--gold)" },
];

export default function PcSidebar({
  tab, onTab, onOpen, onOpenProfile,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  onOpen?: (p: SubPage) => void;
  onOpenProfile?: () => void;
}) {
  const { s, levelPct, mainFriend } = useGame();

  return (
    <div className="flex flex-col" style={{ gap: 12, height: "100%" }}>
      {/* Профиль: уровень, полоса опыта, валюта */}
      <button
        type="button"
        onClick={() => { sfx.click(); haptic("light"); onOpenProfile?.(); }}
        className="w-full text-left"
        style={{
          padding: 14, borderRadius: "var(--r-lg)",
          background: "var(--surface)",
          border: "1px solid var(--surface-brd)",
        }}
      >
        <div className="flex items-center" style={{ gap: 11, marginBottom: 10 }}>
          <span
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 40, height: 40, borderRadius: "var(--r-sm)",
              background: "var(--acc)", color: "var(--acc-ink)",
            }}
          >
            <span className="t-num" style={{ fontSize: 15 }}>{s.level}</span>
          </span>
          <span className="flex-1 min-w-0">
            <span className="t-title-sm clip1 block">{mainFriend?.name || tr("Игрок")}</span>
            <span className="t-caption clip1 block" style={{ marginTop: 2, fontSize: 9.5 }}>
              {tr("УР")} {s.level} · {tr("престиж")} {s.prestige}
            </span>
          </span>
        </div>
        <Bar pct={levelPct} h={5} />
        <div className="flex items-center" style={{ gap: 12, marginTop: 11 }}>
          <span className="t-num inline-flex items-center" style={{ gap: 5, fontSize: 12.5, color: "var(--gold)" }}>
            <Icon name="coin" size={13} />{fmt(s.coins)}
          </span>
          <span className="t-num inline-flex items-center" style={{ gap: 5, fontSize: 12.5, color: "var(--violet)" }}>
            <Icon name="gem" size={13} />{fmt(s.gems)}
          </span>
        </div>
      </button>

      {/* Основные разделы */}
      <div
        style={{
          padding: 7, borderRadius: "var(--r-lg)",
          background: "var(--surface)",
          border: "1px solid var(--surface-brd)",
        }}
      >
        {ITEMS.map((it) => {
          const on = tab === it.id;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => { sfx.click(); haptic("light"); onTab(it.id); }}
              className="flex items-center w-full relative"
              style={{
                gap: 11, padding: "11px 12px", borderRadius: "var(--r-sm)",
                color: on ? "var(--acc-ink)" : "var(--text-dim)",
              }}
            >
              {on && (
                <motion.span
                  layoutId="pc-nav-active"
                  className="absolute"
                  style={{
                    inset: 0, borderRadius: "var(--r-sm)",
                    background: "var(--acc)", zIndex: 0,
                  }}
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                />
              )}
              <span style={{ position: "relative", zIndex: 1, lineHeight: 0 }}>
                <Icon name={it.icon} size={16} />
              </span>
              <span
                className="t-body flex-1 text-left"
                style={{ position: "relative", zIndex: 1, fontSize: 13 }}
              >
                {tr(it.label)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Дополнительные страницы */}
      <div
        style={{
          padding: 7, borderRadius: "var(--r-lg)",
          background: "var(--surface)",
          border: "1px solid var(--surface-brd)",
        }}
      >
        {EXTRA.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => { sfx.click(); haptic("light"); onOpen?.(it.id); }}
            className="flex items-center w-full"
            style={{ gap: 11, padding: "10px 12px", borderRadius: "var(--r-sm)" }}
          >
            <span style={{ color: it.tone, lineHeight: 0 }}>
              <Icon name={it.icon} size={15} />
            </span>
            <span className="t-body flex-1 text-left" style={{ fontSize: 12.5 }}>
              {tr(it.label)}
            </span>
            <Icon name="chevron" size={13} />
          </button>
        ))}
      </div>

      {/* Подсказка по клавишам — на ПК это уместно */}
      <div
        className="t-caption"
        style={{
          marginTop: "auto", padding: "10px 12px", borderRadius: "var(--r-sm)",
          background: "var(--surface-2)", border: "1px solid var(--surface-brd)",
          fontSize: 9.5, lineHeight: 1.6,
        }}
      >
        <b style={{ color: "var(--text-dim)" }}>1–5</b> {tr("разделы")} ·{" "}
        <b style={{ color: "var(--text-dim)" }}>Esc</b> {tr("назад")} ·{" "}
        <b style={{ color: "var(--text-dim)" }}>F11</b> {tr("полный экран")}
      </div>
    </div>
  );
}
