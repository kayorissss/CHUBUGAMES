import { actionFor } from "./keymap";

/**
 * КЛАВИАТУРА И МЫШЬ В ИГРАХ (компьютерная версия).
 *
 * Почему так, а не «по кнопке на игру».
 *
 * Игр двадцать девять, и почти все они читают указатель: `onPointerMove`
 * и `onPointerDown` на своём контейнере (на телефоне это палец). Писать для
 * каждой отдельный клавиатурный слой — значит получить двадцать девять
 * слегка разных реализаций, которые разъедутся при первой же правке.
 *
 * Поэтому слой один: клавиатура управляет ВИРТУАЛЬНЫМ УКАЗАТЕЛЕМ и шлёт
 * настоящие PointerEvent туда, где он стоит. Игра получает ровно то, что
 * получила бы от мыши, — и управление появляется сразу везде.
 *
 *   W A S D и стрелки  — двигают указатель (мышью он синхронизируется,
 *                        поэтому можно водить мышкой, а нажимать с клавиатуры)
 *   ПРОБЕЛ / ENTER     — нажать и держать (прицел, прыжок, удержание)
 *   SHIFT              — в два раза быстрее (для длинных дорожек)
 *
 * Для кнопочных игр (шахматы, шашки, кроссворд, автобус) на отпускании
 * клавиши летит ещё и обычный `click` — иначе кнопка бы не нажалась: на
 * `pointerdown`+`pointerup` DOM-кнопка не реагирует. Для канвасных игр
 * клик не отправляется специально: там «отпустил» — это конец перетаскивания
 * (прицел в бильярде, свайп), и лишний click сломал бы прицеливание.
 */

export interface KeyState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** ПРОБЕЛ или ENTER — «нажать» */
  act: boolean;
  /** SHIFT — быстро */
  boost: boolean;
  /** координаты виртуального указателя в пикселях окна */
  x: number;
  y: number;
  /** последним двигался клавиатурой (показывать курсор-кольцо) */
  usingKeys: boolean;
}

/**
 * Игры, которые читают клавиатуру сами: Burger Rain (a/d и стрелки),
 * 2048 (стрелки), Забег Шитова (пробел и стрелки) и Радомир Бит (буквы).
 *
 * Наш слой туда ставить нельзя: вышло бы двойное нажатие — стрелка
 * передвинула бы и героя, и виртуальный палец, а пробел в «Забеге» ещё и
 * заставил бы прыгнуть дважды. Чубупа Универсалис — стратегия: там стрелки
 * шагают по дорогам между зданиями, и палец водить нечем. Для этих четырёх игр слой не ставится вовсе,
 * и кольцо-указатель там не нужен.
 */
export const NATIVE_KEY_GAMES: ReadonlySet<string> = new Set([
  "burger", "merge", "dino", "radomir",
  // стратегия: там стрелки ходят ПО ДОРОГАМ между зданиями, а не водят палец
  "europa",
]);

export function handlesKeysNatively(id: string | null): boolean {
  return !!id && NATIVE_KEY_GAMES.has(id);
}

const state: KeyState = {
  up: false, down: false, left: false, right: false,
  act: false, boost: false,
  x: 0, y: 0, usingKeys: false,
};

/** базовая скорость указателя, px/сек */
const SPEED = 720;
const BOOST = 2;

/*
 * Соответствие «клавиша → действие» живёт в core/keymap.ts: игрок может
 * назначить что угодно (французская раскладка, цифровой блок, одна рука),
 * а стрелки, пробел и Shift работают всегда, даже если ничего не настроено.
 */
function keyAction(code: string): keyof KeyState | undefined {
  return actionFor(code) as keyof KeyState | undefined;
}

/**
 * Запись в поле состояния. Отдельная функция, а не `state[k] = true`:
 * при `k: keyof KeyState` TypeScript требует пересечение типов полей
 * (там и числа, и булевые), и прямое присваивание не проходит.
 */
function setKey(k: keyof KeyState, v: boolean) {
  (state as unknown as Record<string, boolean>)[k] = v;
}

type Listener = (s: KeyState) => void;
const subs = new Set<Listener>();

/*
 * Два независимых способа сообщить об изменении.
 *
 * onKeys — про состояние кнопок (кто нажат, показывать ли кольцо). Его
 * слушает React, поэтому дёргаем его не чаще, чем раз в 120 мс: иначе
 * кольцо заставляло бы React перерисовываться каждый кадр, и «оптимизация»
 * съела бы те самые кадры, которые мы бережём.
 *
 * onKeysPtr — про координаты. Его слушает курсор и пишет transform прямо в
 * DOM, минуя React. Здесь каждый кадр, но без единой перерисовки.
 */
const ptrSubs = new Set<(x: number, y: number, act: boolean) => void>();

export function onKeysPtr(f: (x: number, y: number, act: boolean) => void): () => void {
  ptrSubs.add(f);
  return () => ptrSubs.delete(f);
}

export function readKeys(): KeyState {
  return state;
}

export function onKeys(f: Listener): () => void {
  subs.add(f);
  return () => subs.delete(f);
}

let emitAt = 0;
function emit(force = false) {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!force && now - emitAt < 120) return;
  emitAt = now;
  subs.forEach((f) => f(state));
}

function emitPtr() {
  ptrSubs.forEach((f) => f(state.x, state.y, state.act));
}

/** поле ввода (поиск, имя персонажа) — клавиатура должна оставаться его */
function inField(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

function pe(type: string, x: number, y: number, buttons: number, btn = 0): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    buttons,
    button: btn,
  });
}

/**
 * Поставить слой на время игры. Возвращает функцию снятия.
 *
 * root — контейнер игры: внутри него и живёт виртуальный указатель, за его
 * края он не уходит (иначе «палец» уехал бы в настройку рядом и игра
 * продолжила бы тащить объект).
 */
export function initGameKeys(root: HTMLElement): () => void {
  const rect = () => root.getBoundingClientRect();

  // старт — из центра поля: так WASD сразу работает, даже если игрок ни разу
  // не тронул мышь
  const r0 = rect();
  if (!state.usingKeys || !state.x || !state.y) {
    state.x = Math.round(r0.left + r0.width / 2);
    state.y = Math.round(r0.top + r0.height / 2);
  }
  emitPtr();

  let held = 0;   // сколько «нажато» для canvas-игр

  const dispatchAt = (type: string, buttons: number, btn = 0) => {
    const el = document.elementFromPoint(state.x, state.y);
    if (!el) return null;
    el.dispatchEvent(pe(type, state.x, state.y, buttons, btn));
    return el;
  };

  const press = () => {
    if (held) return;
    held = 1;
    dispatchAt("pointerover", 0);
    dispatchAt("pointerdown", 1, 0);
    emit(true);
    emitPtr();
  };

  const release = () => {
    if (!held) return;
    held = 0;
    const el = dispatchAt("pointerup", 0, 0);
    // DOM-кнопке нужен именно click; канвасу — нет (см. шапку файла)
    if (el && el.tagName.toUpperCase() !== "CANVAS") {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: state.x, clientY: state.y }));
    }
    emit(true);
    emitPtr();
  };

  const onDown = (e: KeyboardEvent) => {
    if (inField(e.target)) return;
    const k = keyAction(e.code);
    if (!k) return;
    // стрелки и пробел иначе скроллят страницу и «нажимают» фокусную кнопку
    e.preventDefault();
    if (e.repeat) return;
    setKey(k, true);
    state.usingKeys = true;
    if (k === "act") press();
    emit(true);
    emitPtr();
  };

  const onUp = (e: KeyboardEvent) => {
    const k = keyAction(e.code);
    if (!k) return;
    if (!state[k]) return;
    setKey(k, false);
    if (k === "act") release();
    emit(true);
    emitPtr();
  };

  /*
   * Мышь ведёт тот же указатель: можно целиться мышкой, а нажимать с
   * клавиатуры, и наоборот. Реальный курсор перетягивает виртуальный на
   * себя всегда — ждать, пока «отпустится» клавиатурное кольцо, глупо.
   */
  const onPointer = (e: PointerEvent) => {
    state.x = e.clientX;
    state.y = e.clientY;
    if (state.usingKeys) {
      // кольцо-указатель больше не нужен: игрок перешёл на мышь
      state.usingKeys = false;
      emit(true);
    }
    emitPtr();
  };

  const onBlur = () => {
    state.up = state.down = state.left = state.right = state.act = state.boost = false;
    release();
    emit();
  };

  let raf = 0;
  let last = 0;
  const loop = (t: number) => {
    const dt = last ? Math.min(64, t - last) : 16;
    last = t;
    const vx = (state.right ? 1 : 0) - (state.left ? 1 : 0);
    const vy = (state.down ? 1 : 0) - (state.up ? 1 : 0);
    if (vx || vy) {
      const r = rect();
      const step = (SPEED * (state.boost ? BOOST : 1) * dt) / 1000;
      state.x = Math.min(r.right - 1, Math.max(r.left + 1, state.x + vx * step));
      state.y = Math.min(r.bottom - 1, Math.max(r.top + 1, state.y + vy * step));
      // держим «палец» нажатым, если кнопка не отпускать — игра увидит drag
      dispatchAt("pointermove", state.act ? 1 : 0);
      emit();
      emitPtr();
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("blur", onBlur);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
    window.removeEventListener("pointermove", onPointer);
    window.removeEventListener("blur", onBlur);
    onBlur();
    state.usingKeys = false;
    emit();
  };
}
