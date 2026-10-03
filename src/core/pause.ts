import { useEffect, useState } from "react";

/**
 * ПАУЗА В ИГРЕ.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ МОДУЛЬ, А НЕ СОСТОЯНИЕ В ИГРЕ.
 * Игр тридцать, и у каждой свой цикл: канвас в useCanvas, свои таймеры, свои
 * экраны «ВСЁ». Просить каждую игру понимать Esc — это тридцать правок и
 * тридцать способов разъехаться. Поэтому пауза живёт здесь: один флаг, одна
 * кнопка, один класс на <html>, и играм достаточно не рисовать кадры, пока
 * флаг поднят — это делает useCanvas, то есть одна правка на все канвас-игры.
 *
 * Что даёт пауза:
 *   • useCanvas перестаёт вызывать draw, канвас остаётся с последним кадром
 *     (не чернеет и не мигает);
 *   • html.is-paused в CSS ставит на паузу CSS-анимации внутри игры;
 *   • поверх ложится PauseOverlay: «Продолжить» с обратным отсчётом 3-2-1,
 *     чтобы не начать играть с пол-кадра;
 *   • dt не накапливается: после возвращения первый кадр короткий, иначе
 *     персонаж подпрыгнул бы на полэкрана — классический баг «привет, пауза».
 *
 * Чего пауза НЕ делает: не замораживает setTimeout-игры (кликер, стек,
 * сортировка, память, лифт) — там нет «промаха из-за паузы», а воровать у них
 * таймер означало бы переписать их логику.
 */

export type PauseState = { paused: boolean; countdown: number };

/** шаг обратного отсчёта, мс */
const COUNT_MS = 620;

let state: PauseState = { paused: false, countdown: 0 };
const subs = new Set<(s: PauseState) => void>();
let timer = 0;

/** выход из игры — App регистрирует сюда свой setGame(null) */
const exitGameRef: { fn: (() => void) | null } = { fn: null };

function emit(): void {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("is-paused", state.paused);
  }
  subs.forEach((f) => f(state));
}

export function isPaused(): boolean {
  return state.paused;
}

export function setPauseExitHandler(fn: (() => void) | null): void {
  exitGameRef.fn = fn;
}

export function pause(): void {
  if (state.paused) return;
  if (typeof window !== "undefined") window.clearTimeout(timer);
  state = { paused: true, countdown: 0 };
  emit();
}

export function resumeNow(): void {
  if (!state.paused && !state.countdown) return;
  if (typeof window !== "undefined") window.clearTimeout(timer);
  state = { paused: false, countdown: 0 };
  emit();
}

/**
 * Выйти из паузы с отсчётом. Пока идёт 3-2-1, пауза НЕ снята: игра стоит,
 * человек успевает вернуть руки на клавиши и понять, что происходит.
 */
export function resumeWithCountdown(onDone?: () => void): void {
  if (!state.paused) {
    onDone?.();
    return;
  }
  window.clearTimeout(timer);
  state = { paused: true, countdown: 3 };
  emit();
  const step = () => {
    if (state.countdown <= 1) {
      resumeNow();
      onDone?.();
      return;
    }
    state = { paused: true, countdown: state.countdown - 1 };
    emit();
    timer = window.setTimeout(step, COUNT_MS);
  };
  timer = window.setTimeout(step, COUNT_MS);
}

export function togglePause(): void {
  if (state.paused) resumeNow();
  else pause();
}

export function onPause(f: (s: PauseState) => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}

/** React-подписка на паузу: состояние + два готовых действия. */
export function usePause(): PauseState & { resume: () => void; exit: () => void } {
  const [st, setSt] = useState<PauseState>(state);
  useEffect(() => onPause(setSt), []);
  return {
    ...st,
    resume: () => resumeWithCountdown(),
    exit: () => {
      resumeNow();
      exitGameRef.fn?.();
    },
  };
}
