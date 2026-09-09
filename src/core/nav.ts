/**
 * Аппаратная и жестовая навигация «назад».
 *
 * На Android свайп от края экрана и системная кнопка «назад» должны
 * закрывать текущий экран внутри приложения, а не выкидывать из игры.
 * Реализовано через history.pushState: каждый «слой» (игра, модалка)
 * кладёт запись в историю,системный «назад» её снимает.
 */

type Handler = () => void;

const stack: { key: string; fn: Handler }[] = [];
let inited = false;

function onPop() {
  const top = stack.pop();
  if (top) {
    top.fn();
    // остаётся ещё слой — держим запись в истории,
    // чтобы следующий «назад» тоже остался внутри приложения
    if (stack.length > 0) history.pushState({ chub: true }, "");
  } else {
    // слоёв нет: возвращаем «якорь», приложение не закрывается свайпом случайно
    history.pushState({ chub: true }, "");
  }
}

function init() {
  if (inited) return;
  inited = true;
  history.pushState({ chub: true }, "");
  window.addEventListener("popstate", onPop);
}

/** Зарегистрировать обработчик «назад» для слоя. Возвращает функцию снятия. */
export function pushBack(key: string, fn: Handler): () => void {
  init();
  stack.push({ key, fn });
  history.pushState({ chub: true, key }, "");
  return () => {
    const i = stack.findIndex((x) => x.key === key);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Сколько слоёв сейчас открыто */
export const backDepth = () => stack.length;
