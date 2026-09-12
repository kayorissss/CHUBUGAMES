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
import { isPlaying } from "./play";
import { pause, resumeNow, isPaused } from "./pause";

const FORCE_KEY = "chubgames.pc";

/**
 * Запущены ли мы внутри десктопной оболочки.
 *
 * Раскладку можно включить и вручную: `?pc=1` в адресе или
 * localStorage chubgames.pc=1. Зачем: компьютерную версию полезно
 * смотреть и проверять в обычном браузере — на предпросборе, на планшете,
 * где Electron недоступен. Всё, что требует настоящей оболочки
 * (обновление, размер окна, полный экран), там молча отключается:
 * обращения к мосту идут через `?.`, а не через прямые вызовы.
 */
export const isDesktop = (): boolean => {
  if (typeof window === "undefined") return false;
  // Протокол app:// поднимает только наша Electron-оболочка
  if (window.location.protocol === "app:") return true;
  // Запас на случай запуска через electron в разработке
  if (/electron/i.test(navigator.userAgent)) return true;
  if (/[?&]pc=1/.test(window.location.search) || window.location.hash === "#pc") return true;
  try {
    return localStorage.getItem(FORCE_KEY) === "1";
  } catch {
    return false;
  }
};

/** Включить/выключить ПК-раскладку вручную (тумблер в настройках) */
export function forcePcLayout(on: boolean | null) {
  try {
    if (on === null) localStorage.removeItem(FORCE_KEY);
    else localStorage.setItem(FORCE_KEY, on ? "1" : "0");
  } catch {
    /* приватный режим — не критично */
  }
}

/** Мост к Electron-оболочке. В браузере его нет, и это нормально. */
export const pcApi = (): any =>
  typeof window === "undefined" ? undefined : (window as any).chubDesktop;

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

/**
 * Esc внутри игры: первый раз — пауза, второй — снять её. Возвращает true,
 * если событие обработано и «назад» вызывать не нужно. Вынесено отсюда,
 * чтобы обработчик клавиш оставался списком «клавиша → действие».
 */
function toggleEscape(): boolean {
  if (isPaused()) resumeNow();
  else pause();
  return true;
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
      /*
       * Внутри игры Esc сначала СТАВИТ ИГРУ НА ПАУЗУ и только потом, если
       * пауза уже открыта, закрывает её. Выйти из игры — дело кнопки «назад»
       * или пункта «Выйти в меню» в паузе: раньше Esc выкидывал из партии
       * одним нажатием, и это было обидно ровно всегда.
       */
      if (isPlaying() && toggleEscape()) {
        e.preventDefault();
        return;
      }
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
      if (st.mode !== "manual") return;
      e.preventDefault();
      const next = e.key === "0"
        ? 1
        : Math.max(0.8, Math.min(1.6, st.zoom + (e.key === "-" ? -0.05 : 0.05)));
      writeStage({ ...st, zoom: next });
      applyStage({ ...st, zoom: next });
      return;
    }

    /*
     * F11 — полный экран.
     *
     * В собранной ПК-версии режим переключает ОБОЛОЧКА (win.setFullScreen):
     * она же помнит его между запусками, поэтому игра открывается сразу
     * на весь экран, а F11 из него ВЫВОДИТ. Просить браузерный fullscreen
     * поверх оконного было бы двойной работой: оставили его только для
     * случая «открыл в браузере».
     */
    if (e.key === "F11") {
      e.preventDefault();
      // В собранной программе клавишу уже перехватывает оболочка окна
      // (before-input-event в desktop/main.cjs): она же и помнит состояние.
      // Второй переключатель отсюда дал бы ДВОЙНОЕ переключение — «нажал F11,
      // ничего не произошло». Поэтому здесь только выход.
      if (pcApi()?.toggleFullscreen) return;
      const el = document.documentElement;
      if (document.fullscreenElement) document.exitFullscreen?.();
      else el.requestFullscreen?.();
    }
  };

  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
