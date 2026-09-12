/**
 * ЦВЕТОВАЯ МАТЕМАТИКА.
 *
 * ЗАЧЕМ ЭТО НУЖНО.
 * Акцент в приложении выбирается пользователем (12 тем), и раньше текст на
 * акцентной заливке был одним жёстким значением: `--acc-ink: #12100a`,
 * «почти чёрный». Для янтарного или лимонного акцента это правильно, а для
 * тёмного (кровь #FF2E2E, платина на светлой теме) — текст на кнопке
 * становился нечитаемым. Плюс при светлой теме акцентный ТЕКСТ на белой
 * поверхности выцветал в ноль.
 *
 * Здесь считается относительная яркость (WCAG), и по ней подбирается:
 *   • чернила на заливке — тёмные или светлые, всегда с контрастом >= 4.5;
 *   • акцент как цвет текста — подмешиванием белого (тёмная тема) или
 *     чёрного (светлая) до контраста >= 4.5 к поверхности;
 *   • подсветка верхней кромки кнопки и нижняя тень — те же производные.
 *
 * Всё это — чистые функции без DOM: их можно вызывать и в тестах
 * (check:ui сверяет несколько контрольных значений).
 */

/** #rgb / #rrggbb → [r,g,b] 0..255. Нераспознанное → [0,0,0]. */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return [0, 0, 0];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Относительная яркость по WCAG 2.x (линеаризация sRGB). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Контраст двух цветов по WCAG, 1..21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Смешать hex с другим цветом (0..1) — как color-mix, но предсказуемо. */
export function mix(hex: string, withHex: string, k: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(withHex);
  return rgbToHex(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
}

const DARK_INK = "#12100a";
const LIGHT_INK = "#0b0b0e";
const WHITE = "#ffffff";
const BLACK = "#000000";

/**
 * Чернила на акцентной заливке: тёмные на светлом акценте, светлые на тёмном.
 * Критерий — контраст, а не «яркость больше половины»: жёлтый #F5DD3C
 * даёт 12.9 к чёрному и 3.1 к белому, красный #FF2E2E — 4.6 к чёрному и
 * 2.8 к белому, поэтому для него нужны светлые чернила.
 */
export function inkOn(accent: string): string {
  const dark = contrast(accent, DARK_INK);
  const light = contrast(accent, LIGHT_INK);
  return light > dark ? LIGHT_INK : DARK_INK;
}

/**
 * Акцент как цвет ТЕКСТА на данной поверхности.
 *
 * На тёмном фоне bright-акцент читается сам, но бледный (платина) нужно
 * слегка осветлить; на белом фоне любой насыщенный акцент тонет, поэтому
 * подмешиваем чёрный, пока контраст не станет >= 4.5 (или не упрёмся в 55 %).
 */
export function accentText(accent: string, surface: string, light: boolean): string {
  let out = accent;
  const step = light ? BLACK : WHITE;
  for (let k = 0; k <= 0.55; k += 0.05) {
    out = mix(accent, step, k);
    if (contrast(out, surface) >= 4.5) return out;
  }
  return out;
}

/**
 * Всё, что приложение выставляет в CSS-переменные из выбранного акцента.
 * Ключи — имена переменных без `--`.
 */
export function accentTokens(
  accent: string,
  opts: { light?: boolean; surface?: string; mono?: boolean } = {},
): Record<string, string> {
  const light = !!opts.light;
  const surface = opts.surface || (light ? "#ffffff" : "#16161c");
  const rgb = hexToRgb(accent).join(",");
  const ink = opts.mono ? (light ? "#0b0b0e" : "#0b0b0e") : inkOn(accent);
  return {
    "acc": accent,
    "acc-soft": `rgba(${rgb},0.16)`,
    "acc-glow": `rgba(${rgb},0.45)`,
    "acc-ink": ink,
    "acc-text": accentText(accent, surface, light),
    "acc-line": mix(accent, surface, 0.48),
    /* заливка кнопки: верхняя гранка светлее, нижняя темнее — кнопка
       выглядит литой, а не наклеенным прямоугольником */
    "acc-hi": mix(accent, WHITE, light ? 0.18 : 0.34),
    "acc-lo": mix(accent, BLACK, 0.26),
  };
}
