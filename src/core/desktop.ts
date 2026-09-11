/**
 * Определение ПК-версии и десктопные удобства.
 *
 * ПК-сборка (Windows .exe на Electron) грузит ту же самую игру, что и
 * телефон, по протоколу app://. Отличать её нужно для мелочей: показать
 * подсказки по клавишам, не предлагать «установить APK», не рисовать
 * элементы, которые нужны только на телефоне.
 */

/** Запущены ли мы внутри десктопной оболочки */
import { applyStage, readStage, writeStage } from "./stage";

export const isDesktop = (): boolean => {
  if (typeof window === "undefined") return false;
  // Протокол app:// поднимает только наша Electron-оболочка
  if (window.location.protocol === "app:") return true;
  // Запас на случай запуска через electron в разработке
  return /electron/i.test(navigator.userAgent);
};

/**
 * Есть ли у пользователя настоящая мышь и клавиатура.
 *
 * Отдельно от isDesktop(), потому что игру можно открыть и в обычном
 * браузере на компьютере — там тоже уместны подсказки по клавишам.
 */
export const hasKeyboard = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches ?? false;
};

/**
 * Глобальные горячие клавиши.
 *
 * На телефоне «назад» — системный жест, на ПК его нет, поэтому вешаем
 * Escape на тот же механизм (см. core/nav.ts): он снимает верхний слой —
 * закрывает игру, модалку или подстраницу.
 *
 * Возвращает функцию снятия обработчика.
 */
/**
 * Следить за размером окна и пересчитывать масштаб сцены.
 * Возвращает функцию отписки.
 */
export function initStage(): () => void {
  if (typeof window === "undefined") return () => {};
  let raf = 0;
  const apply = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => applyStage(readStage()));
  };
  apply();
  window.addEventListener("resize", apply);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", apply);
  };
}

export function initDesktopKeys(): () => void {
  if (typeof window === "undefined") return () => {};

  const onKey = (e: KeyboardEvent) => {
    // не мешаем вводу в поля (кроссворд вводится системной клавиатурой)
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
      return;
    }

    /*
     * Цифры 1–5 переключают разделы: на ПК это быстрее, чем целиться
     * мышью в боковую панель. Событие слушает App через window.
     */
    if (/^[1-5]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
      window.dispatchEvent(new CustomEvent("chub:nav", { detail: Number(e.key) - 1 }));
      return;
    }

    if (e.key === "Escape") {
      // history.back() поднимет popstate, а его уже слушает core/nav.ts
      e.preventDefault();
      history.back();
      return;
    }

    /*
     * Ctrl +/- и Ctrl+0 меняют масштаб сцены, как в браузере.
     * Работают только в ручном режиме: в «вписать» и «во весь экран»
     * масштаб считается автоматически, и менять его руками бессмысленно.
     */
    if (e.ctrlKey && (e.key === "=" || e.key === "+" || e.key === "-" || e.key === "0")) {
      const st = readStage();
      if (st.mode !== "actual") return;
      e.preventDefault();
      const next = e.key === "0"
        ? 1
        : Math.max(0.4, Math.min(3, st.zoom + (e.key === "-" ? -0.1 : 0.1)));
      writeStage({ ...st, zoom: next });
      applyStage({ ...st, zoom: next });
      return;
    }

    // F11 — полноэкранный режим (обрабатывает сам Electron), но в браузере
    // на ПК его тоже полезно поддержать
    if (e.key === "F11") {
      e.preventDefault();
      const el = document.documentElement;
      if (document.fullscreenElement) document.exitFullscreen?.();
      else el.requestFullscreen?.();
    }
  };

  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
