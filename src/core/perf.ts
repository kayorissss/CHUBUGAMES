/**
 * Определение слабого телефона и облегчённый режим.
 *
 * ПОЧЕМУ ПЕРЕПИСАНО. Первая версия гадала по железу и на реальных
 * бюджетниках не срабатывала ни разу:
 *
 *   Realme C3 — Helio G70, ВОСЕМЬ ядер, 3 ГБ. Chrome округляет
 *   deviceMemory до 4, а hardwareConcurrency отдаёт 8. Правило
 *   «мало ядер И мало памяти» мимо. Проверка по площади экрана тоже
 *   мимо: 720x1600 при dpr 2 — это 1.15 млн пикселей, порог был 2 млн.
 *   Итог: телефон, ради которого всё затевалось, считался «обычным».
 *
 * Число ядер вообще ничего не говорит о GPU: у бюджетников часто 8
 * медленных ядер и слабейшая Mali. Поэтому теперь МЕРЯЕМ, а не гадаем:
 * первые секунды после запуска считаем реальные кадры, и если телефон
 * не тянет — переключаемся на облегчённый режим и запоминаем решение.
 *
 * Железные признаки остались, но только как быстрая догадка до первого
 * замера, чтобы первые секунды не лагали на очевидно слабом устройстве.
 */

export type PerfMode = "auto" | "high" | "low";

const KEY = "chubgames.perf";
const MEASURED_KEY = "chubgames.perf.measured";

/** Ниже этого среднего FPS считаем, что телефон не тянет красивый режим */
const FPS_THRESHOLD = 45;
/** Сколько миллисекунд меряем */
const SAMPLE_MS = 2600;

/**
 * Быстрая догадка по железу — только до первого честного замера.
 * Намеренно осторожная: лучше не угадать и померить, чем испортить
 * картинку на нормальном телефоне.
 */
export function detectWeak(): boolean {
  if (typeof navigator === "undefined") return false;

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (reduced) return true;

  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  // 2 ГБ и меньше — гарантированно слабый
  if (typeof mem === "number" && mem <= 2) return true;

  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores <= 4) return true;

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
  // Ручной выбор отменяет прошлый замер: пользователь главнее.
  if (m !== "auto") clearMeasured();
  applyPerfMode(m);
}

/** Итог прошлого замера: true — слабый, false — нормальный, null — не мерили */
function readMeasured(): boolean | null {
  try {
    const v = localStorage.getItem(MEASURED_KEY);
    if (v === "weak") return true;
    if (v === "ok") return false;
  } catch {
    /* игнорируем */
  }
  return null;
}

function writeMeasured(weak: boolean): void {
  try {
    localStorage.setItem(MEASURED_KEY, weak ? "weak" : "ok");
  } catch {
    /* игнорируем */
  }
}

function clearMeasured(): void {
  try {
    localStorage.removeItem(MEASURED_KEY);
  } catch {
    /* игнорируем */
  }
}

/** Итог: включать ли облегчённый режим */
export function isLowFx(mode: PerfMode = readPerfMode()): boolean {
  if (mode === "low") return true;
  if (mode === "high") return false;
  const measured = readMeasured();
  if (measured !== null) return measured;
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
 * Честный замер: считаем кадры в течение SAMPLE_MS и, если телефон не
 * держит планку, включаем облегчённый режим и запоминаем это.
 *
 * Замер идёт один раз на устройство. Первые 600 мс пропускаем — там
 * монтирование и анимация входа, они просядут на любом телефоне.
 */
export function measurePerfOnce(onDecided?: (low: boolean) => void): void {
  if (typeof window === "undefined" || typeof requestAnimationFrame === "undefined") return;
  if (readPerfMode() !== "auto") return;   // пользователь выбрал вручную
  if (readMeasured() !== null) return;     // уже мерили на этом телефоне

  const WARMUP_MS = 600;
  let frames = 0;
  let started = 0;
  let warmupDone = false;

  const tick = (t: number) => {
    if (!started) started = t;
    const elapsed = t - started;

    if (!warmupDone) {
      if (elapsed < WARMUP_MS) {
        requestAnimationFrame(tick);
        return;
      }
      warmupDone = true;
      started = t;
      frames = 0;
      requestAnimationFrame(tick);
      return;
    }

    frames++;
    if (elapsed < SAMPLE_MS) {
      requestAnimationFrame(tick);
      return;
    }

    const fps = (frames * 1000) / elapsed;
    const weak = fps < FPS_THRESHOLD;
    writeMeasured(weak);
    applyPerfMode();
    onDecided?.(weak);
  };

  requestAnimationFrame(tick);
}

/** Последний измеренный вердикт — для подписи в настройках */
export function measuredVerdict(): boolean | null {
  return readMeasured();
}

/** Сбросить замер, чтобы померить заново */
export function remeasure(): void {
  clearMeasured();
  applyPerfMode();
}

/**
 * Во сколько раз ужимать канвас относительно devicePixelRatio.
 * Рисовать в 3x на слабом чипе бессмысленно: разница не видна, а кадров
 * втрое меньше.
 */
export function canvasScaleCap(): number {
  return isLowFx() ? 1.5 : 2.5;
}
