/**
 * Палитра для <canvas>.
 *
 * ЗАЧЕМ ЭТО НУЖНО.
 * В обычной вёрстке цвет пишется как `var(--acc)`, и браузер сам его
 * разворачивает. В канвасе так нельзя: `ctx.fillStyle = "var(--acc)"` —
 * невалидное значение, спецификация требует его ПРОИГНОРИРОВАТЬ. Канвас
 * молча оставляет прошлый цвет, ошибок в консоли нет, и на экране
 * получается «то серое, то не тот цвет» — ровно то, на что жаловался
 * пользователь. Три таких места уже лежали в коде (Bus12, Penalty,
 * Volley) и рисовали чем придётся.
 *
 * Поэтому цвета для канваса берём отсюда: значение читается один раз из
 * CSS-переменных документа и кешируется. Кеш сбрасывается при смене темы
 * или акцента — за это отвечает `refreshPalette()`, его дёргает store.
 *
 * getComputedStyle — дорогая операция, вызывать её в цикле отрисовки
 * нельзя: на кадре может понадобиться десяток цветов, а это 60 раз в
 * секунду. Кеш решает и это.
 */

const cache = new Map<string, string>();

/** Прочитать CSS-переменную как готовый цвет для канваса. */
export function cssVar(name: string, fallback = "#ffffff"): string {
  const key = name;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let val = "";
  try {
    val = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  } catch {
    val = "";
  }
  const out = val || fallback;
  cache.set(key, out);
  return out;
}

/** Сбросить кеш — вызывается при смене темы/акцента. */
export function refreshPalette() {
  cache.clear();
}

/**
 * Готовый набор цветов для игровых сцен.
 *
 * Игры рисуют свои фоны, поля и фигуры хексами прямо в коде, из-за чего
 * каждая сцена жила в своей случайной палитре. Здесь собран общий
 * словарь: он привязан к дизайн-системе и меняется вместе с темой.
 * Функция, а не константа — значения нужно перечитывать после смены темы.
 */
export function scene() {
  return {
    /** Фон сцены: от почти чёрного к чуть более светлому */
    bg0: cssVar("--n-000", "#0a0a0d"),
    bg1: cssVar("--n-050", "#101014"),
    bg2: cssVar("--n-100", "#16161c"),
    surface: cssVar("--surface", "#16161c"),
    surface2: cssVar("--surface-2", "#21212a"),
    line: cssVar("--surface-brd", "#2b2b35"),
    text: cssVar("--text", "#f4f4f8"),
    dim: cssVar("--text-dim", "#b4b4c2"),
    mute: cssVar("--text-mute", "#8c8c9c"),
    acc: cssVar("--acc", "#ffb020"),
    accInk: cssVar("--acc-ink", "#100c02"),
    ok: cssVar("--ok", "#5ce39b"),
    warn: cssVar("--warn", "#ffc53d"),
    danger: cssVar("--danger", "#ff6b5a"),
    info: cssVar("--info", "#6bb8ff"),
    gold: cssVar("--gold", "#ffc247"),
    violet: cssVar("--violet", "#c89bff"),
  };
}

/** Цвет с альфой: `alpha("--acc", 0.4)`. Понимает #rgb, #rrggbb и rgb(). */
export function alpha(name: string, a: number, fallback = "#ffffff"): string {
  const c = cssVar(name, fallback);
  if (c.startsWith("#")) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split("").map((x) => x + x).join("");
    if (h.length === 8) h = h.slice(0, 6);
    const num = parseInt(h, 16);
    if (Number.isNaN(num)) return `rgba(255,255,255,${a})`;
    const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    return `rgba(${r},${g},${b},${a})`;
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1].split(",").map((x) => parseFloat(x));
    return `rgba(${r},${g},${b},${a})`;
  }
  return `rgba(255,255,255,${a})`;
}
