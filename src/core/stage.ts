/**
 * МАСШТАБ ИНТЕРФЕЙСА ПК-ВЕРСИИ.
 *
 * Раньше здесь была «сцена»: приложение рисовалось в прямоугольник
 * размером с телефон и масштабировалось целиком. Пользователь справедливо
 * сказал, что это не компьютерная версия, а телефон посреди монитора.
 *
 * Теперь интерфейс альбомный и занимает всё окно, а этот модуль отвечает
 * только за КРУПНОСТЬ: на большом мониторе элементы можно увеличить,
 * на маленьком — уплотнить. Реализовано через font-size корня, поэтому
 * масштабируется вся типографика и отступы в rem разом.
 */

export type UiScaleMode = "auto" | "manual";

export interface StageSettings {
  mode: UiScaleMode;
  /** Ручной масштаб 0.8..1.6 */
  zoom: number;
}

const KEY = "chubgames.uiscale";

export const defaultStage = (): StageSettings => ({ mode: "auto", zoom: 1 });

export function readStage(): StageSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultStage();
    return { ...defaultStage(), ...JSON.parse(raw) };
  } catch {
    return defaultStage();
  }
}

export function writeStage(s: StageSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* не критично */
  }
}

/**
 * Автомасштаб по ширине окна.
 *
 * Опорная ширина 1440 px: на ней масштаб равен единице. Уже — слегка
 * уплотняем, шире — увеличиваем, но с потолком, иначе на 4K интерфейс
 * превратится в набор гигантских плашек.
 */
export function autoScale(winW: number): number {
  const k = winW / 1440;
  return Math.max(0.9, Math.min(1.35, k));
}

export function computeScale(winW: number, mode: UiScaleMode, zoom: number): number {
  if (mode === "manual") return Math.max(0.8, Math.min(1.6, zoom));
  return autoScale(winW);
}

/** Применить масштаб к документу, вернуть итоговое значение */
export function applyStage(s: StageSettings): number {
  if (typeof document === "undefined") return 1;
  const scale = computeScale(window.innerWidth, s.mode, s.zoom);
  // 16px — базовый размер шрифта браузера, от него считаются все rem
  document.documentElement.style.fontSize = `${(16 * scale).toFixed(2)}px`;
  return scale;
}
