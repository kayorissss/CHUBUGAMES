import { useEffect, useState } from "react";
import { useGame } from "../../core/store";
import { fmt } from "../../core/format";
import { tr } from "../../core/i18n";
import { sfx } from "../../core/fx";
import { readGamble } from "../../core/gamble";
import { hasLoot } from "../../core/rewards";
import { useDeferredUpdate } from "../../core/updateState";
import { pcApi } from "../../core/desktop";
import Icon, { type IconName } from "../Icon";
import { BrandMark } from "../Brand";
import type { Tab } from "../../components/Nav";
import type { SubPage } from "../../App";

/**
 * ВЕРХНЯЯ ПАНЕЛЬ И КАСТОМНАЯ ОБОЛОЧКА ОКНА (ПК / EXE).
 *
 * Структура:
 *   [Иконка + CHUBUGAMES]  |  [Магазин · Казино · Персонажи · Прогресс · Доп.]
 *   ... [Уровень] [Кошелёк]  |  [Поддержать (квадр.-скругл.)] [Настройки (квадр.-скругл.)]  |  [—  □  ✕]
 *
 * Вся панель служит областью перетаскивания окна (-webkit-app-region: drag),
 * а интерактивные элементы имеют no-drag. Справа встроены фирменные кнопки
 * управления окном вместо стандартной рамки Windows.
 */

type Dest =
  | { kind: "tab"; tab: Tab }
  | { kind: "sub"; sub: Exclude<SubPage, null> };

const TABS: { id: string; label: string; icon: IconName; to: Dest }[] = [
  { id: "shop",     label: "Магазин",        icon: "shop",     to: { kind: "tab", tab: "shop" } },
  { id: "casino",   label: "Казино",         icon: "dice",     to: { kind: "sub", sub: "casino" } },
  { id: "friends",  label: "Персонажи",      icon: "users",    to: { kind: "tab", tab: "friends" } },
  { id: "progress", label: "Прогресс",       icon: "trophy",   to: { kind: "tab", tab: "progress" } },
  { id: "extra",    label: "Дополнительное", icon: "download", to: { kind: "sub", sub: "network" } },
];

export function PcWinControls({ floating = false }: { floating?: boolean }) {
  const api = pcApi();
  const [winState, setWinState] = useState<{ fullscreen: boolean; maximized: boolean }>({
    fullscreen: false,
    maximized: false,
  });

  useEffect(() => {
    let alive = true;
    api?.getWinState?.().then((st: any) => {
      if (alive && st) setWinState(st);
    }).catch(() => {});
    const off = api?.onWinState?.((st: any) => {
      if (alive && st) setWinState(st);
    });
    const onFsChange = () => {
      if (!api?.getWinState && alive) {
        setWinState((prev) => ({ ...prev, fullscreen: !!document.fullscreenElement }));
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      alive = false;
      off?.();
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, [api]);

  const onMinimize = () => {
    sfx.click();
    if (api?.minimize) {
      api.minimize();
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const onMaximize = () => {
    sfx.click();
    if (api?.maximize) {
      api.maximize().then((st: any) => st && setWinState(st)).catch(() => {});
    } else {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      else document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };

  const onClose = () => {
    sfx.click();
    if (api?.close) {
      api.close();
    } else {
      window.close();
    }
  };

  const isExpanded = winState.fullscreen || winState.maximized;

  return (
    <div
      className={`pc-win-controls ${floating ? "floating pc-win-floating" : ""}`}
      role="group"
      aria-label={tr("Управление окном")}
    >
      <button
        type="button"
        className="pc-win-btn min"
        onClick={onMinimize}
        title={tr("Свернуть")}
        aria-label={tr("Свернуть")}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M2 6.5H10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>

      <button
        type="button"
        className="pc-win-btn max"
        onClick={onMaximize}
        title={isExpanded ? tr("Восстановить окно") : tr("Развернуть")}
        aria-label={isExpanded ? tr("Восстановить окно") : tr("Развернуть")}
      >
        {isExpanded ? (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
            <rect x="2" y="4" width="6.2" height="6.2" rx="1.3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4.3 4V2.8C4.3 2.25 4.75 1.8 5.3 1.8H9.2C9.75 1.8 10.2 2.25 10.2 2.8V6.7C10.2 7.25 9.75 7.7 9.2 7.7H8.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
            <rect x="2.2" y="2.2" width="7.6" height="7.6" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        )}
      </button>

      <button
        type="button"
        className="pc-win-btn pc-win-close close"
        onClick={onClose}
        title={tr("Закрыть")}
        aria-label={tr("Закрыть")}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M2.6 2.6L9.4 9.4M9.4 2.6L2.6 9.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export default function PcTopBar({
  tab,
  sub,
  onTab,
  onOpen,
  goTab,
  openSub,
}: {
  tab: Tab;
  sub: SubPage | null;
  onTab?: (t: Tab) => void;
  onOpen?: (s: SubPage | null) => void;
  goTab?: (t: Tab) => void;
  openSub?: (s: SubPage | null) => void;
}) {
  const { s, levelPct } = useGame();
  const chips = readGamble().chips;
  const loot = hasLoot(s);
  const later = useDeferredUpdate();

  const setTabFn = onTab || goTab || (() => {});
  const setSubFn = onOpen || openSub || (() => {});

  const isActive = (d: Dest) =>
    d.kind === "sub" ? sub === d.sub : sub === null && tab === d.tab;

  const trigger = (d: Dest) => {
    sfx.click();
    if (d.kind === "tab") {
      setSubFn(null);
      setTabFn(d.tab);
    } else {
      setSubFn(sub === d.sub ? null : d.sub);
    }
  };

  const go = (t: Tab) => {
    sfx.click();
    setSubFn(null);
    setTabFn(t);
  };

  const onDonate = sub === "donate";
  const onSettings = sub === null && tab === "settings";

  return (
    <header className="pc-bar">
      {/* ИКОНКА | CHUBUGAMES — клик возвращает на главную */}
      <button
        type="button"
        onClick={() => go("home")}
        className={`pc-bar-brand ${sub === null && tab === "home" ? "on" : ""}`}
        title={tr("На главную")}
      >
        <BrandMark size={30} radius={8} />
        <span className="pc-bar-title">CHUBUGAMES</span>
      </button>

      {/* Навигация по основным разделам */}
      <nav className="pc-bar-tabs" aria-label={tr("Разделы")}>
        {TABS.map((it) => {
          const on = isActive(it.to);
          const dot = it.id === "progress" && loot;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => trigger(it.to)}
              className={`pc-tab ${on ? "on" : ""}`}
            >
              <span className="pc-tab-ico">
                <Icon name={it.icon} size={15} />
              </span>
              <span className="pc-tab-label">{tr(it.label)}</span>
              {dot && <span className="pc-tab-dot" aria-label={tr("есть награда")} />}
            </button>
          );
        })}
      </nav>

      {/* Правая часть: уровень, валюты, квадратно-скруглённые иконки Поддержка и Настройки, кнопки окна */}
      <div className="pc-bar-tail">
        <button
          type="button"
          onClick={() => go("progress")}
          className="pc-bar-level"
          title={tr("Уровень и опыт — открыть прогресс")}
        >
          <span className="pc-bar-lvl-badge">{tr("Ур.")} {s.level}</span>
          <span className="pc-bar-xp-bar" aria-hidden>
            <i style={{ width: `${Math.min(100, levelPct)}%` }} />
          </span>
        </button>

        <div className="pc-bar-wallet">
          <button
            type="button"
            onClick={() => go("shop")}
            className="pc-bar-coin"
            title={tr("Монеты — открыть магазин")}
          >
            <Icon name="coin" size={13} accent />
            <span className="t-num">{fmt(s.coins)}</span>
          </button>

          <button
            type="button"
            onClick={() => go("shop")}
            className="pc-bar-coin gem"
            title={tr("Кристаллы")}
          >
            <Icon name="gem" size={13} />
            <span className="t-num">{fmt(s.gems)}</span>
          </button>

          <button
            type="button"
            onClick={() => { sfx.click(); setSubFn(sub === "casino" ? null : "casino"); }}
            className="pc-bar-coin chip"
            title={tr("Жетоны казино")}
          >
            <Icon name="dice" size={13} />
            <span className="t-num">{fmt(chips)}</span>
          </button>
        </div>

        {/* Квадратно-закруглённые иконки Поддержать и Настройки в верхней панели */}
        <div className="pc-bar-actions pc-top-actions" role="group" aria-label={tr("Быстрые действия")}>
          <button
            type="button"
            onClick={() => {
              sfx.click();
              setSubFn(onDonate ? null : "donate");
            }}
            className={`pc-sq-btn pc-sq-support heart ${onDonate ? "on" : ""}`}
            title={tr("Поддержать")}
            aria-label={tr("Поддержать")}
          >
            <Icon name="heart" size={16} />
          </button>

          <button
            type="button"
            onClick={() => go("settings")}
            className={`pc-sq-btn gear ${onSettings ? "on" : ""} ${later ? "has-update" : ""}`}
            title={later ? `${tr("Настройки")} · ${tr("доступна версия")} ${later}` : tr("Настройки")}
            aria-label={tr("Настройки")}
          >
            <Icon name="gear" size={16} />
            {later && (
              <span className="pc-sq-flag pc-round-flag" aria-label={tr("есть обновление")} />
            )}
          </button>
        </div>

        {/* Кастомные кнопки управления окном EXE */}
        <PcWinControls />
      </div>
    </header>
  );
}
