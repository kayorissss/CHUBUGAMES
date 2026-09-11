/**
 * СЦЕНА ПК-ВЕРСИИ: размер, масштаб и режим отображения.
 *
 * Игра свёрстана под вертикальный телефон. На мониторе её нельзя просто
 * растянуть: часть эффектов считает координаты от window.innerWidth, а
 * портретная вёрстка на широком экране разъезжается.
 *
 * Поэтому приложение рисуется в «сцену» фиксированного логического
 * размера, а сцена масштабируется под окно через CSS transform. Внутри
 * игры ничего не меняется — она по-прежнему думает, что работает на
 * телефоне выбранного разрешения.
 */

export type StageMode = "fit" | "fill" | "actual";

export interface StagePreset {
  id: string;
  label: string;
  w: number;
  h: number;
}

/**
 * Пресеты разрешения — реальные размеры популярных телефонов в CSS-пикселях
 * (логических, не физических: именно их видит вёрстка).
 */
export const STAGE_PRESETS: StagePreset[] = [
  { id: "compact", label: "Компактный · 360 × 780", w: 360, h: 780 },
  { id: "phone", label: "Обычный · 412 × 900", w: 412, h: 900 },
  { id: "xiaomi", label: "Xiaomi 17 · 440 × 980", w: 440, h: 980 },
  { id: "tall", label: "Высокий · 430 × 1040", w: 430, h: 1040 },
  { id: "tablet", label: "Планшет · 600 × 960", w: 600, h: 960 },
];

export const DEFAULT_PRESET = "phone";

export interface StageSettings {
  preset: string;
  mode: StageMode;
  /** Ручной масштаб для режима "actual", 0.5..3 */
  zoom: number;
}

const KEY = "chubgames.stage";

export const defaultStage = (): StageSettings => ({
  preset: DEFAULT_PRESET,
  mode: "fit",
  zoom: 1,
});

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

export const presetOf = (id: string) =>
  STAGE_PRESETS.find((p) => p.id === id) || STAGE_PRESETS[1];

/**
 * Посчитать масштаб сцены под текущее окно.
 *
 * fit    — вписать целиком, сохраняя пропорции (по умолчанию);
 * fill   — заполнить окно, обрезав лишнее по длинной стороне;
 * actual — ручной масштаб пользователя.
 *
 * Небольшой отступ по краям в режиме fit нужен, чтобы рамка и тень сцены
 * не упирались в границу окна.
 */
export function computeScale(
  winW: number,
  winH: number,
  stageW: number,
  stageH: number,
  mode: StageMode,
  zoom: number,
): number {
  if (mode === "actual") return Math.max(0.4, Math.min(3, zoom));

  const pad = mode === "fit" ? 24 : 0;
  const kw = (winW - pad) / stageW;
  const kh = (winH - pad) / stageH;

  if (mode === "fill") {
    /*
     * «Во весь экран».
     *
     * Наивный max(kw, kh) на широком мониторе давал масштаб ×4.66:
     * сцена растягивалась по ширине и обрезалась по высоте так, что от
     * игры оставалась примерно четверть — пользоваться невозможно.
     *
     * Поэтому заполняем по ВЫСОТЕ (для портретной игры это естественная
     * длинная сторона), а по ширине разрешаем обрезать не больше 12%.
     */
    const byHeight = winH / stageH;
    const maxCrop = (winW * 1.12) / stageW;
    return Math.max(0.3, Math.min(byHeight, maxCrop));
  }

  return Math.max(0.3, Math.min(kw, kh));
}

/**
 * Применить настройки сцены к документу.
 * Возвращает получившийся масштаб — его показываем в настройках.
 */
export function applyStage(s: StageSettings): number {
  if (typeof document === "undefined") return 1;
  const p = presetOf(s.preset);
  const root = document.documentElement;

  const scale = computeScale(
    window.innerWidth,
    window.innerHeight,
    p.w,
    p.h,
    s.mode,
    s.zoom,
  );

  root.style.setProperty("--stage-w", `${p.w}px`);
  root.style.setProperty("--stage-h", `${p.h}px`);
  root.style.setProperty("--stage-scale", String(scale));
  root.classList.toggle("stage-fill", s.mode === "fill");

  return scale;
}
