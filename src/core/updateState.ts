/**
 * СОСТОЯНИЕ «ЕСТЬ ОБНОВЛЕНИЕ, НО Я ПОТОМ».
 *
 * Претензия: «если нажал „попозже“ — пусть горит восклицательный знак, и пока
 * не обновится, не исчезнет». Раньше полоса обновления просто закрывалась, и
 * больше нигде о себе не напоминала: человек забывал, что у него устаревшая
 * сборка, а встроенная проверка в следующий раз молча скипала версию по
 * chubgames.skipVersion.
 *
 * Здесь состояние живёт отдельно от интерфейса: его видят и круглая кнопка
 * настроек, и вкладка «Система», и плашка на главной. Храним версию, а не
 * флаг: как только локальная версия догоняет отложенную, знак сам гаснет —
 * ничего «снимать» руками не нужно.
 *
 * useSyncExternalStore вместо контекста: состояние нужно трём разным местам
 * (панель, док, настройки), а прокидывать провайдер через всю оболочку ради
 * одной строки — лишний ререндер всего дерева.
 */

import { useSyncExternalStore } from "react";
import { APP_VERSION } from "./version";

const KEY = "chubgames.update.later";

/** Меньшая версия — как в core/updater.ts: сравнение по числам, не по строкам. */
function cmp(a: string, b: string): number {
  const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

function read(): string | null {
  try {
    const v = localStorage.getItem(KEY);
    if (!v) return null;
    // Локальная версия догнала или перегнала отложенную — напоминание не нужно
    if (cmp(v, APP_VERSION) <= 0) {
      localStorage.removeItem(KEY);
      return null;
    }
    return v;
  } catch {
    return null;
  }
}

let current: string | null = typeof localStorage === "undefined" ? null : read();
const subs = new Set<() => void>();

function emit() {
  for (const fn of subs) fn();
}

/** Отложить обновление на потом — с этого момента горит «!». */
export function deferUpdate(version: string) {
  try { localStorage.setItem(KEY, version); } catch { /* приватный режим */ }
  current = version;
  emit();
}

/** Обновился (или проверил и всё свежее) — знак снимаем. */
export function clearDeferredUpdate() {
  try { localStorage.removeItem(KEY); } catch { /* не критично */ }
  if (current === null) return;
  current = null;
  emit();
}

/** Версия, которую отложили, или null. */
export function deferredUpdate(): string | null {
  return current;
}

/** Перечитать с хранилища — вызывается после проверки обновлений. */
export function syncDeferredUpdate(): string | null {
  current = typeof localStorage === "undefined" ? null : read();
  emit();
  return current;
}

/** React-хук: версия отложенного обновления или null. */
export function useDeferredUpdate(): string | null {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    deferredUpdate,
    () => null,
  );
}
