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

/* ================= РАЗРЕШЕНИЕ РИСОВАНИЯ ==================
 *
 * Главная причина «2–7 FPS на слабом компьютере» — не логика игр, а
 * количество пикселей на кадр. Окно 1920×1080 при devicePixelRatio 1 —
 * это 2,07 млн пикселей, и canvas перерисовывает их каждый кадр со всеми
 * тенями, градиентами и свечениями. На встраиваемом GPU это те самые
 * единичные кадры в секунду.
 *
 * Лечится честно и незаметно: у канваса остаётся размер окна (он
 * растягивается CSS-ом), но внутреннее разрешение берётся ровно столько,
 * сколько выдерживает железо. Игры при этом продолжают думать в
 * CSS-пикселях — useCanvas передаёт им ширину и высоту окна, а не буфера.
 */

export type RenderMode = "auto" | "full" | "eco";

const RKEY = "chubgames.renderscale";

export function readRenderMode(): RenderMode {
  try {
    const v = localStorage.getItem(RKEY);
    if (v === "full" || v === "eco" || v === "auto") return v;
  } catch {
    /* localStorage может быть недоступен */
  }
  return "auto";
}

export function writeRenderMode(m: RenderMode): void {
  try {
    localStorage.setItem(RKEY, m);
  } catch {
    /* не критично */
  }
}

/** Сколько пикселей рисуем на кадр */
export function pixelBudget(): number {
  const m = readRenderMode();
  if (m === "full") return Infinity;
  if (m === "eco") return 0.7e6;
  return isLowFx() ? 0.85e6 : 2.1e6;
}

/**
 * Масштаб внутреннего буфера канваса: не больше devicePixelRatio и ровно
 * такой, чтобы площадь пикселей влезла в бюджет. 0.55 — пол: ниже начинает
 * мылить линии, а выигрыш уже не спасает.
 */
export function renderScale(cssW: number, cssH: number): number {
  const cap = Math.min(canvasScaleCap(), (typeof window !== "undefined" && window.devicePixelRatio) || 1);
  const area = Math.max(1, Math.abs(cssW * cssH));
  const k = Math.sqrt(pixelBudget() / area);
  const base = Math.max(0.62, Math.min(cap, k));
  // адаптив (см. ниже) имеет право ужать сильнее — на слабом железе
  // 45 % разрешения дают вдвое больше кадров, а в динамичной игре это
  // заметнее, чем мыло
  return Math.max(0.45, base * adapt);
}

/**
 * Единая ручка «качество картинки» для настроек.
 *
 * Раньше их было две — «эффекты» и «разрешение» — и выбрать правильный
 * вариант без линейки было нельзя. Одна ручка заодно решает и то, и другое:
 *   «Красиво» — все свечения и полное разрешение,
 *   «Авто»    — железо меряется само (вердикт замера запоминается),
 *   «Эко»     — никаких тяжёлых фильтров и буфер в 0.7 млн пикселей.
 */
export type Quality = RenderMode;

export function readQuality(): Quality {
  return readRenderMode();
}

export function writeQuality(q: Quality): void {
  writeRenderMode(q);
  resetAdapt();
  writePerfMode(q === "full" ? "high" : q === "eco" ? "low" : "auto");
  applyPerfMode();
}

/** Забыть прежний замер и померить прямо сейчас; cb — когда будет вердикт */
export function remeasureNow(onDecided?: (low: boolean) => void): void {
  clearMeasured();
  resetAdapt();
  uiWatchReset();
  writePerfMode("auto");
  writeRenderMode("auto");
  applyPerfMode();
  measurePerfOnce(onDecided);
}

/** Итоговое разрешение как оно есть — для подписи в настройках */
export function renderScaleInfo(cssW: number, cssH: number) {
  const s = renderScale(cssW, cssH);
  return {
    scale: s,
    px: Math.round(cssW * s) * Math.round(cssH * s),
    budget: pixelBudget(),
    mode: readRenderMode(),
    low: isLowFx(),
    adapt,
  };
}

/* ============ СЛЕЖКА ЗА КАДРЫ САМОГО ИНТЕРФЕЙСА ============

   Автозамер при старте смотрит на интерфейс 3 секунды и успокаивается.
   этого мало: главная страница на слабом видеоадаптере может «просесть»
   позже (открылась правая колонка, поехали пульсации босса), а игры
   вообще живут в своём окне. Поэтому счётчик кадров работает всё время,
   пока открыт интерфейс, и если кадров реально мало — включает лёгкий
   режим сам и запоминает это: следующий запуск начнётся уже лёгким.

   Намеренно одна directional-стрелка: утяжелять режим обратно «на лету»
   нельзя, иначе картинка начнёт мигать туда-сюда. Возврат красоты —
   только руками в настройках.
 */

const UI_WINDOW_MS = 500;
const UI_FLOOR = 42;
/** сколько подряд «плохих» окон нужно, чтобы решение было не на один случайный лаг */
const UI_BAD_WINDOWS = 3;

let uiRaf = 0;
let uiLast = 0;
let uiFrames = 0;
let uiAcc = 0;
let uiBad = 0;
let uiDecided = false;

/** средние кадры интерфейса за последнее окно — для подписи в настройках */
let uiFps = 0;
export function uiFpsValue(): number {
  return uiFps;
}

/** сколько кадров/с рисует интерфейс (не игра): 0 — ещё не мерили */
export function startUiWatch(onDegrade?: (fps: number) => void): () => void {
  if (typeof requestAnimationFrame === "undefined") return () => {};

  const tick = (t: number) => {
    uiRaf = requestAnimationFrame(tick);
    if (!uiLast) { uiLast = t; return; }
    const dt = t - uiLast;
    uiLast = t;
    if (dt <= 0 || dt > 2000) { uiFrames = 0; uiAcc = 0; return; }

    /*
     * Пока идёт канвас-игра, кадры считает её собственный цикл (fpsFeed),
     * и решение о нагрузке принимает адаптив разрешения. Дублировать это
     * слежкой за интерфейсом нельзя: мы бы «чинили» главный экран, которого
     * сейчас и нет на экране.
     */
    if (t - fFedAt < 400) { uiFrames = 0; uiAcc = 0; uiBad = 0; return; }

    uiFrames++;
    uiAcc += dt;
    if (uiAcc < UI_WINDOW_MS) return;

    const fps = Math.round((uiFrames * 1000) / uiAcc);
    uiFps = fps;
    uiFrames = 0;
    uiAcc = 0;

    if (readPerfMode() !== "auto") return;   // человек выбрал руками
    if (fps < UI_FLOOR) uiBad++; else uiBad = 0;
    if (uiDecided || uiBad < UI_BAD_WINDOWS) return;

    uiDecided = true;
    writeMeasured(true);
    const low = applyPerfMode();
    onDegrade?.(low ? fps : 0);
  };

  uiRaf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(uiRaf);
    uiRaf = 0;
    uiLast = 0;
    uiFrames = 0;
    uiAcc = 0;
    uiBad = 0;
  };
}

/** разрешить слежке снова принимать решение (после «Замерить заново») */
export function uiWatchReset(): void {
  uiDecided = false;
  uiBad = 0;
}

/* ================= СЧЁТЧИК КАДРОВ ==================
 *
 * Считаем кадры там, где они и происходят, — в цикле useCanvas. Отдельного
 * requestAnimationFrame на индикатор не вешаем: на слабом устройстве второй
 * цикл сам по себе ест кадры.
 *
 * Обновление отдаём раз в ~450 мс: чаще — цифра дёргается и сама по себе
 * грузит React, реже — не видно, что происходит.
 */

export interface FpsSample { fps: number; ms: number; worst: number }

const fpsSubs = new Set<(s: FpsSample) => void>();
let fFrames = 0;
let fAcc = 0;
let fLast = 0;
let fWorst = 0;
let fCur: FpsSample = { fps: 0, ms: 0, worst: 0 };

/** когда последний раз кто-то принёс кадр (нужно для резервного счёта) */
let fFedAt = 0;

export function fpsFeed(t: number): void {
  fFedAt = t;
  if (!fLast) { fLast = t; return; }
  const dt = t - fLast;
  fLast = t;
  if (dt <= 0 || dt > 2000) return;   // свернули вкладок / уснули — не считаем
  fFrames++;
  fAcc += dt;
  if (dt > fWorst) fWorst = dt;
  if (fAcc < 450) return;
  fCur = {
    fps: Math.round((fFrames * 1000) / fAcc),
    ms: Math.round((fAcc / fFrames) * 10) / 10,
    worst: Math.round(fWorst),
  };
  fFrames = 0;
  fAcc = 0;
  fWorst = 0;
  fpsSubs.forEach((f) => f(fCur));
  // и тут же решаем, не пора ли сменить разрешение
  adaptStep(fCur, t);
}

/* ================= АДАПТИВНОЕ РАЗРЕШЕНИЕ ==================

   Автозамер при старте меряет главный экран — он на слабом компьютере
   легко держит 60 кадров, а игра в этот же момент идёт на 5. Поэтому
   разрешение подстраивается не «на глаз», а по кадрам самой игры:

     просадка или меньше 26 fps  → ужать кадр буфер на 20 %;
     меньше 46 fps               → ужать на 12 % (реже, с паузой);
     57+ fps подряд              → вернуть разрешение обратно, шаг за шагом.

   Пауза между шагами нужна, чтобы не было «качелей»: ужатие само по себе
   поднимает кадры, и если реагировать на каждый замер, разрешение начнёт
   прыгать туда-сюда. В режиме «Красиво» адаптив выключен — там человек
   выбрал качество руками.
 */

let adapt = 1;
let goodStreak = 0;
let lastAdaptAt = 0;
const adaptSubs = new Set<() => void>();

export function adaptValue(): number {
  return adapt;
}

/** подписка на смену разрешения: канвас должен перестелить буфер */
export function onAdapt(f: () => void): () => void {
  adaptSubs.add(f);
  return () => adaptSubs.delete(f);
}

function setAdapt(v: number) {
  const nv = Math.max(0.45, Math.min(1, Math.round(v * 1000) / 1000));
  if (nv === adapt) return;
  adapt = nv;
  adaptSubs.forEach((f) => f());
}

/** вернутить полное разрешение (смена качества, выход из игры) */
export function resetAdapt(): void {
  adapt = 1;
  goodStreak = 0;
  lastAdaptAt = 0;
  adaptSubs.forEach((f) => f());
}

function adaptStep(s: FpsSample, t: number) {
  if (readRenderMode() === "full") {
    if (adapt !== 1) setAdapt(1);
    return;
  }
  const wait = t - lastAdaptAt;
  if (s.fps === 0) return;
  if (s.worst >= 260 || s.fps < 26) {
    if (wait > 500) {
      setAdapt(adapt * 0.8);
      lastAdaptAt = t;
      goodStreak = 0;
    }
    return;
  }
  if (s.fps < 46) {
    if (wait > 900) {
      setAdapt(adapt * 0.88);
      lastAdaptAt = t;
      goodStreak = 0;
    }
    return;
  }
  if (s.fps >= 57) {
    goodStreak += 1;
    // поднимаем медленно и только если стабильно: 4 окна подряд ≈ 1.8 с
    if (goodStreak >= 4 && wait > 1200) {
      goodStreak = 0;
      lastAdaptAt = t;
      setAdapt(adapt * 1.08);
    }
    return;
  }
  goodStreak = 0;
}

export function readFps(): FpsSample {
  return fCur;
}

export function onFps(f: (s: FpsSample) => void): () => void {
  fpsSubs.add(f);
  return () => fpsSubs.delete(f);
}

/** Сброс показаний (например, при входе в игру, чтобы не светить прошлый экран) */
export function resetFps(): void {
  fFrames = 0;
  fAcc = 0;
  fLast = 0;
  fWorst = 0;
  fCur = { fps: 0, ms: 0, worst: 0 };
  fpsSubs.forEach((f) => f(fCur));
  // новое окно — новая история: старые «просели» не должны тащить разрешение вниз
  goodStreak = 0;
  lastAdaptAt = 0;
}

/*
 * Резервный счётчик для игр без канваса.
 *
 * Шахматы, шашки, кроссворд и «Поймай кота» живут на DOM-е и своего
 * requestAnimationFrame не имеют — считать там нечего. Поэтому индикатор
 * сам крутит пустой rAF-цикл, но только пока настоящий игровой цикл ему не
 * отвечает: как только useCanvas начинает приносить кадры, резервный цикл
 * останавливается сам и не тратит ни одного лишнего кадра.
 */
export function fpsWatch(): () => void {
  if (typeof requestAnimationFrame === "undefined") return () => {};
  let raf = 0;
  let alive = true;
  const loop = (t: number) => {
    if (!alive) return;
    // если цикл игры молчит дольше 0.4 с — считаем кадры страницы сами
    if (t - fFedAt > 400) fpsFeed(t);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
  };
}
