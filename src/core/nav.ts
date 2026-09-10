/**
 * Аппаратная и жестовая навигация «назад».
 *
 * На Android свайп от края экрана и системная кнопка «назад» должны
 * закрывать текущий экран внутри приложения, а не выкидывать из игры.
 * Реализовано через history.pushState: каждый «слой» (игра, подстраница,
 * модалка) кладёт запись в историю, системный «назад» её снимает.
 *
 * ВАЖНО про баг, который здесь чинится.
 * Раньше `pushBack` клал запись в историю, а функция снятия слоя (когда
 * экран закрыли кнопкой внутри приложения) только удаляла обработчик из
 * массива, но запись в истории оставляла. Каждый вход-выход в казино
 * копил «мусорный» шаг истории. После двух-трёх заходов системная кнопка
 * «назад» отматывала эти пустые шаги и внешне не делала НИЧЕГО — ровно
 * жалоба «из казино нельзя выйти кнопкой назад».
 *
 * Теперь запись истории всегда парная: слой снят изнутри — сразу
 * подчищаем history.back(), а обработчик popstate этот «свой» шаг
 * пропускает по счётчику `pending`.
 */

type Handler = () => void;

const stack: { key: string; fn: Handler }[] = [];
let inited = false;
/** Сколько popstate-событий мы вызвали сами и должны молча проглотить */
let pending = 0;

function onPop() {
  if (pending > 0) {
    pending--;
    return;
  }
  const top = stack.pop();
  if (top) {
    top.fn();
    // Запись этого слоя история уже сняла — восстанавливать её не нужно.
    // Нижние слои держат собственные записи.
    if (stack.length === 0) {
      // Кончились слои: возвращаем «якорь», чтобы следующий свайп назад
      // не закрыл приложение сразу и мы могли его обработать.
      history.pushState({ chub: true, anchor: true }, "");
    }
  } else {
    history.pushState({ chub: true, anchor: true }, "");
  }
}

function init() {
  if (inited) return;
  inited = true;
  history.pushState({ chub: true, anchor: true }, "");
  window.addEventListener("popstate", onPop);
}

/** Зарегистрировать обработчик «назад» для слоя. Возвращает функцию снятия. */
export function pushBack(key: string, fn: Handler): () => void {
  init();
  stack.push({ key, fn });
  history.pushState({ chub: true, key }, "");
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const i = stack.findIndex((x) => x.key === key);
    if (i < 0) return;   // слой уже сняли через popstate — история чистая
    stack.splice(i, 1);
    // Слой закрыли кнопкой внутри приложения: снимаем его запись истории,
    // иначе она копится и системный «назад» начинает «не работать».
    pending++;
    history.back();
  };
}

/** Сколько слоёв сейчас открыто */
export const backDepth = () => stack.length;
