import type { Transition, Variants } from "framer-motion";

/**
 * Единый язык движения для всего приложения.
 *
 * Раньше каждая анимация задавала свои цифры на глаз: где-то 0.2 с
 * easeOut, где-то пружина 320/26, где-то 0.25 без указания кривой. На
 * глаз это читается как «разнобой» — экраны въезжают с разной скоростью
 * и кажется, что приложение собрано из кусков.
 *
 * Здесь описаны несколько именованных характеров движения. Правило
 * простое: короткие реакции на палец — spring, появление и уход
 * контента — tween с одной и той же кривой.
 *
 * Кривая ease взята «мягкий выход» (0.22, 1, 0.36, 1): быстрый старт и
 * долгое затухание. Она читается как отзывчивость, потому что первые
 * миллисекунды элемент проходит большую часть пути.
 */

/** Основная кривая приложения */
export const EASE = [0.22, 1, 0.36, 1] as const;
/** Для ухода элемента — чуть более резкая */
export const EASE_IN = [0.6, 0, 0.9, 0.4] as const;

/** Мгновенная реакция на нажатие: жёсткая пружина без раскачки */
export const springTap: Transition = { type: "spring", stiffness: 700, damping: 30 };
/** Перемещение блока: заметная, но собранная пружина */
export const springSoft: Transition = { type: "spring", stiffness: 420, damping: 34 };
/** Всплывающее окно: с лёгким «доездом» */
export const springPop: Transition = { type: "spring", stiffness: 340, damping: 26 };

/** Появление контента */
export const tweenIn: Transition = { duration: 0.26, ease: EASE };
/** Исчезновение — всегда быстрее появления, иначе интерфейс «залипает» */
export const tweenOut: Transition = { duration: 0.16, ease: EASE_IN };

/**
 * Переход между вкладками. Контент слегка приподнимается и проявляется;
 * уходит вниз — так глаз понимает, что старое ушло, а не мигнуло.
 */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.995 },
  animate: { opacity: 1, y: 0, scale: 1, transition: tweenIn },
  exit: { opacity: 0, y: -10, scale: 0.995, transition: tweenOut },
};

/** Подстраница выезжает справа, как в родных приложениях */
export const subPageVariants: Variants = {
  initial: { opacity: 0, x: 34 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.28, ease: EASE } },
  exit: { opacity: 0, x: 28, transition: tweenOut },
};

/** Запуск игры: экран «наезжает» на игрока */
export const gameVariants: Variants = {
  initial: { opacity: 0, scale: 1.06 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: EASE } },
  exit: { opacity: 0, scale: 0.965, transition: tweenOut },
};

/**
 * Список, который проявляется по одному элементу.
 * Задержка маленькая: при 0.08 с и десяти карточках последняя появится
 * почти через секунду — это уже раздражает.
 */
export const listStagger = (step = 0.035): Variants => ({
  animate: { transition: { staggerChildren: step } },
});

export const listItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
};

/** Всплывающее окно поверх затемнения */
export const modalBackdrop: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: EASE } },
  exit: { opacity: 0, transition: tweenOut },
};

export const modalCard: Variants = {
  initial: { opacity: 0, scale: 0.88, y: 26 },
  animate: { opacity: 1, scale: 1, y: 0, transition: springPop },
  exit: { opacity: 0, scale: 0.94, y: 14, transition: tweenOut },
};
