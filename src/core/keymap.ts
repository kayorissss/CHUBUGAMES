/**
 * КЛАВИШИ УПРАВЛЕНИЯ В ИГРАХ — свои, а не те, что назначили мы.
 *
 * Игрок просил: «добавь управление клавиатурой любой клавишей и удобно для
 * человека». Действий шесть (четыре направления, «нажать», «быстрее»), и
 * каждое может держать сколько угодно клавиш: у кого-то рука лежит на
 * `W A S D`, у кого-то на `Z Q S D` (французская раскладка), у кого-то на
 * цифровой клавиатуре справа. Стрелки при этом работают всегда и их нельзя
 * случайно «потерять» — они базовые.
 *
 * Выбор кладётся в localStorage, а не в сохранение: это настройка
 * железая (клавиатура), а не прогресс, и переносить её с телефона на
 * компьютер смысла нет.
 */

export type KeyAction = "up" | "down" | "left" | "right" | "act" | "boost";

export const ACTIONS: { id: KeyAction; name: string; hint: string }[] = [
  { id: "up", name: "ВВЕРХ", hint: "движение пальца вверх" },
  { id: "down", name: "ВНИЗ", hint: "движение пальца вниз" },
  { id: "left", name: "ВЛЕВО", hint: "движение пальца влево" },
  { id: "right", name: "ВПРАВО", hint: "движение пальца вправо" },
  { id: "act", name: "НАЖАТЬ", hint: "тап, прицел, прыжок, удержание" },
  { id: "boost", name: "БЫСТРО", hint: "вдвое быстрее, пока держишь" },
];

/** то, что всегда работает само по себе, независимо от настроек */
export const ALWAYS: Record<KeyAction, string[]> = {
  up: ["ArrowUp"], down: ["ArrowDown"], left: ["ArrowLeft"], right: ["ArrowRight"],
  act: ["Space", "Enter", "NumpadEnter"], boost: ["ShiftLeft", "ShiftRight"],
};

const DEFAULTS: Record<KeyAction, string[]> = {
  up: ["KeyW"], down: ["KeyS"], left: ["KeyA"], right: ["KeyD"],
  act: [], boost: [],
};

const KEY = "chubgames.keymap";

function empty(): Record<KeyAction, string[]> {
  return { up: [], down: [], left: [], right: [], act: [], boost: [] };
}

let cache: Record<KeyAction, string[]> | null = null;

export function readKeymap(): Record<KeyAction, string[]> {
  if (cache) return cache;
  const out = empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<KeyAction, string[]>>;
      for (const a of Object.keys(out) as KeyAction[]) {
        if (Array.isArray(parsed[a])) out[a] = parsed[a]!.filter((c) => typeof c === "string");
        else out[a] = [...DEFAULTS[a]];
      }
    } else {
      for (const a of Object.keys(out) as KeyAction[]) out[a] = [...DEFAULTS[a]];
    }
  } catch {
    for (const a of Object.keys(out) as KeyAction[]) out[a] = [...DEFAULTS[a]];
  }
  cache = out;
  return out;
}

function write(m: Record<KeyAction, string[]>) {
  cache = m;
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* приватный режим — просто не запомнится */
  }
}

/** все клавиши действия: базовые + назначенные игроком */
export function codesFor(a: KeyAction): string[] {
  const m = readKeymap();
  return [...ALWAYS[a], ...(m[a] || [])];
}

/** какое действие у этой клавиши (для слоя keymouse) */
export function actionFor(code: string): KeyAction | undefined {
  const m = readKeymap();
  for (const a of Object.keys(m) as KeyAction[]) {
    if (ALWAYS[a].includes(code) || (m[a] || []).includes(code)) return a;
  }
  return undefined;
}

/** добавить клавишу к действию; если она уже где-то стоит — убрать оттуда */
export function bind(a: KeyAction, code: string): Record<KeyAction, string[]> {
  const m = readKeymap();
  for (const k of Object.keys(m) as KeyAction[]) {
    m[k] = (m[k] || []).filter((c) => c !== code);
  }
  // базовые клавиши дублировать не нужно
  if (!ALWAYS[a].includes(code)) m[a] = [...(m[a] || []), code];
  write(m);
  return m;
}

export function unbind(a: KeyAction, code: string): Record<KeyAction, string[]> {
  const m = readKeymap();
  m[a] = (m[a] || []).filter((c) => c !== code);
  write(m);
  return m;
}

export function resetKeymap(): Record<KeyAction, string[]> {
  const m = empty();
  for (const a of Object.keys(m) as KeyAction[]) m[a] = [...DEFAULTS[a]];
  write(m);
  return m;
}

/** человекский ответ: что назначено сверх стрелок */
export function userCodes(a: KeyAction): string[] {
  return readKeymap()[a] || [];
}

/**
 * Красивое имя клавиши для подсказки: `KeyW` → `W`, `Space` → `ПРОБЕЛ`.
 * По-русски и по-английски читаемо, потому что мы подписываем и то, и другое.
 */
export function pretty(code: string): string {
  if (code === "Space") return "ПРОБЕЛ";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `${code.slice(6)} (цифры)`;
  if (code.startsWith("Arrow")) return { Up: "↑", Down: "↓", Left: "←", Right: "→" }[code.slice(5) as "Up"] || code;
  if (code === "Enter" || code === "NumpadEnter") return "ENTER";
  if (code.startsWith("Shift")) return "SHIFT";
  if (code.startsWith("Control")) return "CTRL";
  if (code.startsWith("Alt")) return "ALT";
  return code.toUpperCase();
}
