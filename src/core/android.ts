/**
 * Системная кнопка «назад» и жест свайпом на Android.
 *
 * ЧТО БЫЛО НЕ ТАК. Оболочка полагалась только на `history.pushState`
 * (core/nav.ts): жест «назад» снимает запись истории, обработчик popstate
 * закрывает слой. Работает ровно до тех пор, пока слои есть. А на нуле
 * nav.ts подкладывает новый «якорь» — и следующий «назад» уходит в этот
 * якорь. Пользователь видел ровно то, что описал: «делаю жест назад и
 * ничего не происходит». На корневом экране так было всегда.
 *
 * ЧТО СТАЛО. Слушаем настоящее событие Android через @capacitor/app и
 * разбираемся по порядку:
 *
 *   1) открыт слой, который сам заявил права на «назад» (окно обновления,
 *      «что нового», плашка офлайна) — закрываем его;
 *   2) игра на паузе — снимаем паузу с отсчётом 3-2-1;
 *   3) есть слой приложения (игра, подстраница, панель) — history.back();
 *   4) мы на корневом экране — приложение сворачивается (App.minimizeApp),
 *      как в любой другой программе: не вылет и не «ничего не происходит».
 *
 * В браузере и на компьютере ничего не подключается: там у «назад» свои
 * хозяева — клавиша Esc (core/desktop.ts) и кнопка «Назад» в интерфейсе.
 */

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { backDepth } from "./nav";
import { isPaused, resumeWithCountdown } from "./pause";

/** Мы в настоящем приложении на телефоне? */
export const isAndroidApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
};

/* ─────────────────── Очередь владельцев «назад» ─────────────────── */

type Owner = { when: () => boolean; onClose: () => void };
const owners: Owner[] = [];

/**
 * Заявить: «пока это открыто, назад — моя забота». Возвращает снятие.
 * Последний заявившийся обслуживается первым — как стек окон.
 */
export function ownSystemBack(when: () => boolean, onClose: () => void): () => void {
  const o: Owner = { when, onClose };
  owners.push(o);
  return () => {
    const i = owners.indexOf(o);
    if (i >= 0) owners.splice(i, 1);
  };
}

/** Отдать «назад» тому, кто его хочет. true — слой закрылся, дальше не идём. */
export function consumeSystemBack(): boolean {
  for (let i = owners.length - 1; i >= 0; i--) {
    const o = owners[i];
    try {
      if (o.when()) {
        o.onClose();
        return true;
      }
    } catch {
      /* слой отваливается — снимаем его с очереди, чтобы не врал */
      owners.splice(i, 1);
    }
  }
  return false;
}

/** Хук для компонентов: пока `open` — «назад» закрывает тебя. */
export function useSystemBack(open: boolean, onClose: () => void): void {
  useEffect(() => ownSystemBack(() => open, onClose), [open, onClose]);
}

/* ───────────────────────── Подключение плагина ───────────────────────── */

/** Ставит слушателя системной кнопки. Возвращает функцию снятия. */
export function installSystemBack(): () => void {
  if (typeof window === "undefined" || !isAndroidApp()) return () => {};
  let off: (() => void) | null = null;
  let dead = false;

  void import("@capacitor/app")
    .then(({ App }) => {
      if (dead) return undefined;
      return App.addListener("backButton", () => {
        if (consumeSystemBack()) return;
        if (isPaused()) {
          resumeWithCountdown();
          return;
        }
        if (backDepth() > 0) {
          history.back();
          return;
        }
        void App.minimizeApp();
      }).then((h) => {
        if (dead) {
          void h.remove();
          return;
        }
        off = () => { void h.remove(); };
      });
    })
    .catch(() => {
      /* плагина нет (браузер, кривая сборка) — остаётся поведение webview */
    });

  return () => {
    dead = true;
    off?.();
  };
}
