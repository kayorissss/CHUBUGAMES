import { useEffect, useState } from "react";

/**
 * «ИДЕТ ИГРА» — общий флаг для всего приложения.
 *
 * Зачем. Пока открыта игра, под ней по-прежнему живёт главный экран:
 * полоса босса пульсирует, кубик в казино крутится, сундук переливается,
 * а в store каждую секунду тикает автодоход. На телефоне это незаметно,
 * на слабом компьютере — минус треть кадров в игре, потому что браузер
 * честно перерисовывает всё, что под оверлеем.
 *
 * Флаг читается и из React (usePlaying), и из императивного кода (isPlaying),
 * и вешает класс на <html>, чтобы CSS мог выключить анимации целиком.
 */

let playing = false;
const subs = new Set<(v: boolean) => void>();

export function isPlaying(): boolean {
  return playing;
}

export function setPlaying(v: boolean): void {
  if (playing === v) return;
  playing = v;
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("is-playing", v);
  }
  subs.forEach((f) => f(v));
}

export function onPlaying(f: (v: boolean) => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}

/** React-подписка на флаг */
export function usePlaying(): boolean {
  const [v, setV] = useState(playing);
  useEffect(() => onPlaying(setV), []);
  return v;
}
