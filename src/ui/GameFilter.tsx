import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "./Icon";
import { tr } from "../core/i18n";
import { sfx, haptic } from "../core/fx";

/**
 * ПОИСК И ФИЛЬТР ИГР.
 *
 * Первая версия была плохой: четыре чипа сортировки занимали целый ряд,
 * поиска не было вообще, а фильтровать по 20 разным тегам не имело
 * смысла — половина тегов встречается у одной игры.
 *
 * Здесь: одна строка поиска, категории (сгруппированные теги) и
 * сортировка спрятана в выпадающее меню, чтобы не занимать место.
 */

export type SortKey = "default" | "best" | "plays" | "recent" | "name";

/**
 * КАТЕГОРИИ.
 *
 * Теги в GAME_META писались по вкусу и разрослись до двадцати штук
 * («Уклоняйся», «Терпение», «Точность»…). Фильтровать по ним нельзя —
 * пользователь не помнит, какой игре какой тег достался. Поэтому
 * группируем их в шесть понятных корзин.
 */
export const CATEGORIES: { id: string; label: string; tags: string[] }[] = [
  { id: "all", label: "Все", tags: [] },
  {
    id: "arcade",
    label: "Аркады",
    tags: ["Реакция", "Уклоняйся", "Точность", "Ритм", "Бег", "Гонка", "Нервы", "Скорость"],
  },
  { id: "sport", label: "Спорт", tags: ["Спорт"] },
  { id: "brain", label: "Думать", tags: ["Пазл", "Память", "Слова", "Стратегия", "Настольные", "Логистика"] },
  { id: "farm", label: "Фарм", tags: ["Фарм", "Уход", "Терпение", "Защита", "Квест"] },
  { id: "fav", label: "Закреплённые", tags: [] },
];

const SORTS: { k: SortKey; label: string }[] = [
  { k: "default", label: "По порядку" },
  { k: "name", label: "По названию" },
  { k: "best", label: "По рекорду" },
  { k: "plays", label: "По забегам" },
  { k: "recent", label: "Недавние" },
];

export default function GameFilter({
  query, onQuery, cat, onCat, sort, onSort, found, total,
}: {
  query: string;
  onQuery: (v: string) => void;
  cat: string;
  onCat: (v: string) => void;
  sort: SortKey;
  onSort: (v: SortKey) => void;
  found: number;
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // закрываем меню сортировки по тапу мимо
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (searching) inputRef.current?.focus();
  }, [searching]);

  const sortLabel = SORTS.find((x) => x.k === sort)?.label || SORTS[0].label;

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Строка: поиск + сортировка */}
      <div className="flex items-center" style={{ gap: 8, marginBottom: 9 }}>
        <div
          className="flex items-center flex-1 min-w-0"
          style={{
            gap: 8, padding: "9px 12px", borderRadius: "var(--r-sm)",
            background: "var(--surface-2)",
            border: `1px solid ${searching || query ? "var(--acc)" : "var(--surface-brd)"}`,
          }}
        >
          <span style={{ color: query ? "var(--acc)" : "var(--text-mute)", lineHeight: 0 }}>
            <Icon name="search" size={15} />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onFocus={() => setSearching(true)}
            onBlur={() => setSearching(false)}
            placeholder={tr("Найти игру")}
            className="t-body flex-1 min-w-0"
            style={{
              background: "transparent", border: "none", outline: "none",
              color: "var(--text)", fontSize: 13, padding: 0,
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => { onQuery(""); sfx.click(); }}
              style={{ color: "var(--text-mute)", lineHeight: 0 }}
            >
              <Icon name="cross" size={14} />
            </button>
          )}
        </div>

        {/* Сортировка — компактная кнопка с меню */}
        <div ref={boxRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => { setOpen((v) => !v); sfx.click(); haptic("light"); }}
            className="flex items-center shrink-0"
            style={{
              gap: 6, padding: "10px 12px", borderRadius: "var(--r-sm)",
              background: sort === "default" ? "var(--surface-2)" : "var(--acc)",
              color: sort === "default" ? "var(--text)" : "var(--acc-ink)",
              border: `1px solid ${sort === "default" ? "var(--surface-brd)" : "var(--acc)"}`,
            }}
          >
            <Icon name="sort" size={15} />
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.16 }}
                style={{
                  position: "absolute", right: 0, top: "calc(100% + 6px)",
                  zIndex: 40, minWidth: 172,
                  borderRadius: "var(--r-md)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--btn-brd)",
                  boxShadow: "0 18px 44px -16px rgba(0,0,0,0.8)",
                  overflow: "hidden",
                }}
              >
                {SORTS.map((o) => (
                  <button
                    key={o.k}
                    type="button"
                    onClick={() => { onSort(o.k); setOpen(false); sfx.click(); haptic("light"); }}
                    className="flex items-center w-full"
                    style={{
                      gap: 8, padding: "11px 13px",
                      background: sort === o.k ? "var(--btn-bg)" : "transparent",
                      borderBottom: "1px solid var(--surface-brd)",
                    }}
                  >
                    <span
                      className="t-body flex-1 text-left"
                      style={{ fontSize: 12.5, color: sort === o.k ? "var(--acc)" : "var(--text)" }}
                    >
                      {tr(o.label)}
                    </span>
                    {sort === o.k && (
                      <span style={{ color: "var(--acc)", lineHeight: 0 }}>
                        <Icon name="check" size={13} />
                      </span>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Категории вместо двадцати разрозненных тегов */}
      <div
        className="flex items-center"
        style={{
          gap: 6, overflowX: "auto", paddingBottom: 2,
          scrollbarWidth: "none",
        }}
      >
        {CATEGORIES.map((c) => {
          const on = cat === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => { onCat(c.id); sfx.click(); haptic("light"); }}
              className="t-label shrink-0"
              style={{
                padding: "7px 12px", fontSize: 9.5, borderRadius: 999,
                background: on ? "var(--acc)" : "var(--surface-2)",
                color: on ? "var(--acc-ink)" : "var(--text-dim)",
                border: `1px solid ${on ? "var(--acc)" : "var(--surface-brd)"}`,
                whiteSpace: "nowrap",
              }}
            >
              {tr(c.label)}
            </button>
          );
        })}
      </div>

      {/* Сколько нашлось — видно только когда фильтр реально что-то отсёк */}
      {(query || cat !== "all" || sort !== "default") && (
        <div
          className="flex items-center"
          style={{ gap: 7, marginTop: 8 }}
        >
          <span className="t-caption flex-1" style={{ fontSize: 10 }}>
            {found === 0
              ? tr("Ничего не нашлось")
              : `${tr("Показано")} ${found} ${tr("из")} ${total} · ${tr(sortLabel)}`}
          </span>
          <button
            type="button"
            onClick={() => { onQuery(""); onCat("all"); onSort("default"); sfx.click(); }}
            className="t-label shrink-0"
            style={{
              padding: "5px 10px", fontSize: 8.5, borderRadius: 999,
              background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
              color: "var(--text-dim)",
            }}
          >
            {tr("СБРОСИТЬ")}
          </button>
        </div>
      )}
    </div>
  );
}
