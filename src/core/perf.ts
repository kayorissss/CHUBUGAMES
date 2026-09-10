/**
 * Автоопределение слабого телефона.
 *
 * На Xiaomi 17 всё летает, а на Realme C3 те же экраны лагают. Виноват не
 * код игр, а оформление: backdrop-filter: blur(28px) на каждой панели,
 * три анимированных пятна фона и полноэкранные размытия поверх них.
 * Размытие пересчитывается каждый кадр по всей площади под элементом —
 * на слабом GPU это десятки миллисекунд.
 *
 * Класс `low-fx` на <html> отключает самое дорогое, ничего не ломая:
 * панели остаются, просто становятся непрозрачными вместо размытых.
 *
 * Решение принимаем по железу, а не по названию телефона: список моделей
 * пришлось бы вечно пополнять.
 */

export type PerfMode = "auto" | "high" | "low";

const KEY = "chubgames.perf";

/** Грубая оценка: слабое ли устройство */
export function detectWeak(): boolean {
  if (typeof navigator === "undefined") return false;

  // Ядра процессора: у бюджетников обычно 4 слабых
  const cores = navigator.hardwareConcurrency || 4;
  // Оперативка (Chrome отдаёт округлённо: 0.5, 1, 2, 4, 8)
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  // Плотность пикселей: чем выше, тем больше площадь под размытие
  const dpr = window.devicePixelRatio || 1;
  const px = window.screen.width * window.screen.height * dpr * dpr;

  // Человек сам попросил меньше движения — уважаем
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  if (reduced) return true;
  if (mem <= 2) return true;              // 2 ГБ и меньше — точно слабый
  if (cores <= 4 && mem <= 4) return true; // 4 ядра + 4 ГБ — бюджетник
  if (cores <= 4 && px > 2_000_000) return true; // слабый чип с крупным экраном
  return false;
}

/** Что выбрал пользователь: auto по умолчанию */
export function readPerfMode(): PerfMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "high" || v === "low" || v === "auto") return v;
  } catch {
    /* localStorage может быть недоступен */
  }
  return "auto";
}

export function writePerfMode(m: PerfMode): void {
  try {
    localStorage.setItem(KEY, m);
  } catch {
    /* не критично */
  }
}

/** Итог: включать ли облегчённый режим */
export function isLowFx(mode: PerfMode = readPerfMode()): boolean {
  if (mode === "low") return true;
  if (mode === "high") return false;
  return detectWeak();
}

/**
 * Вешает класс на <html>. Вызывать при старте и при смене настройки.
 * Возвращает применённое значение — удобно для подписи в настройках.
 */
export function applyPerfMode(mode: PerfMode = readPerfMode()): boolean {
  const low = isLowFx(mode);
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("low-fx", low);
  }
  return low;
}

/**
 * Во сколько раз ужимать канвас относительно devicePixelRatio.
 * Рисовать в 3x на слабом чипе бессмысленно: разница не видна, а кадров
 * втрое меньше.
 */
export function canvasScaleCap(): number {
  return isLowFx() ? 1.5 : 2.5;
}
