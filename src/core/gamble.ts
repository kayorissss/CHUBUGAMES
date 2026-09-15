/**
 * Азартный блок: жетоны, предметы, апгрейд, кейс-батл, слоты.
 *
 * Играем на ЖЕТОНАХ, а не на монетах — так фарм нельзя слить в ноль
 * за один вечер. Жетоны капают за ежедневки, рекламу и просто со временем.
 *
 * Всё хранится отдельно от основного сейва (свой ключ), чтобы не трогать
 * migrate() и не рисковать прогрессом.
 */

import type { Rarity } from "./types";

const KEY = "chubgames.gamble";

/* ─────────────────────────── Предметы ─────────────────────────── */

export type SkinKind = "hat" | "glasses" | "chain" | "aura" | "pet";

export interface ItemDef {
  id: string;
  name: string;
  kind: SkinKind;
  rarity: Rarity;
  /** Условная ценность в жетонах — по ней считается апгрейд и продажа */
  value: number;
}

/** Украшения, которые падают из кейсов. Рисуются поверх головы. */
export const ITEMS: ItemDef[] = [
  // обычные
  { id: "cap_black",   name: "Кепка козырьком назад", kind: "hat",     rarity: "common", value: 18 },
  { id: "cap_red",     name: "Красная кепка",         kind: "hat",     rarity: "common", value: 18 },
  { id: "beanie",      name: "Шапка-петушок",         kind: "hat",     rarity: "common", value: 24 },
  { id: "glass_round", name: "Круглые очки",          kind: "glasses", rarity: "common", value: 20 },
  { id: "chain_thin",  name: "Цепочка",               kind: "chain",   rarity: "common", value: 26 },

  // редкие
  { id: "bucket",      name: "Панама",                kind: "hat",     rarity: "rare", value: 85 },
  { id: "glass_vr",    name: "Очки виртуалки",        kind: "glasses", rarity: "rare", value: 105 },
  { id: "glass_deal",  name: "Пиксельные очки",       kind: "glasses", rarity: "rare", value: 120 },
  { id: "chain_gold",  name: "Золотая цепь",          kind: "chain",   rarity: "rare", value: 130 },
  { id: "aura_smoke",  name: "Дымка",                 kind: "aura",    rarity: "rare", value: 100 },

  // эпик
  { id: "crown_plast", name: "Корона из фольги",      kind: "hat",     rarity: "epic", value: 420 },
  { id: "helmet",      name: "Строительная каска",    kind: "hat",     rarity: "epic", value: 390 },
  { id: "aura_fire",   name: "Огненная аура",         kind: "aura",    rarity: "epic", value: 520 },
  { id: "aura_ice",    name: "Ледяная аура",          kind: "aura",    rarity: "epic", value: 520 },
  { id: "pet_burger",  name: "Питомец-бургер",        kind: "pet",     rarity: "epic", value: 580 },

  // эпик подороже — для верхних ступеней линейки кейсов (1.28)
  { id: "hat_vise",    name: "Козырёк «Виза»",        kind: "hat",     rarity: "epic", value: 1250 },
  { id: "chain_silver",name: "Цепь «Серебро общаги»", kind: "chain",   rarity: "epic", value: 1600 },

  // легенды
  { id: "crown_gold",  name: "Корона старосты",       kind: "hat",     rarity: "legend", value: 3200 },
  { id: "aura_rgb",    name: "RGB-подсветка",         kind: "aura",    rarity: "legend", value: 3800 },
  { id: "pet_chub",    name: "Мини-Чубуков",          kind: "pet",     rarity: "legend", value: 5000 },
  /* Три верхние легенды появились вместе с линейкой из 10 кейсов: у
     «Схрона» и «Трона» должен быть реальный повод их открывать, а не та же
     пятитысячная цепь. Ценность — не только цифра: она задаёт ожидание
     кейса (caseExpectation), и по ней же «Вещи» показывают, за сколько
     предмет можно продать. */
  { id: "aura_thunder",name: "Грозовая аура",         kind: "aura",    rarity: "legend", value: 9400 },
  { id: "pet_golem",   name: "Питомец-голем",         kind: "pet",     rarity: "legend", value: 15000 },
  { id: "crown_chub",  name: "Корона Чуба",           kind: "hat",     rarity: "legend", value: 24000 },
];

export const itemById = (id: string) => ITEMS.find((i) => i.id === id);

/* ─────────────────────────── Кейсы ─────────────────────────── */

export interface GambleCase {
  id: string;
  name: string;
  price: number;               // в жетонах
  odds: Record<Rarity, number>;
  /**
   * Ниже — то, чего не хватало, чтобы линейка кейсов выглядела линейкой, а
   * не тремя случайными плашками (просьба 1.28: «кейсов мало, иконок нет,
   * выглядят по-уродски, почему всего 3»).
   */
  /** короткая подпись под названием: что это за ящик */
  tag: string;
  /** 1..10 — ступень в линейке; рисуется номером на корпусе */
  tier: number;
  /** цвет подсветки корпуса и призовой кромки (hex, не var(): идёт в style) */
  tint: string;
  /** иконка на корпусе */
  icon: "case" | "gift" | "lock" | "crown" | "skull" | "burger" | "trophy" | "star" | "bolt" | "fire";
  /** самый ценный предмет, который может отсюда выпасть — для витрины */
  jackpot: number;
  /**
   * Потолок ценности дропа. Нужен по-настоящему: без него «Пакет из
   * столовой» за 70 жетоонов мог выдать «Корону Чуба» за 24 000, и дешёвые
   * кейсы превращались в бесконечный принтер жетонов (средняя ценность
   * предмета в дешёвом кейсе была ВЫШЕ его цены). Теперь у каждой ступени
   * свой потолок, и редкие «миллионники» живут только там, где им место.
   */
  cap: number;
}

/*
 * ЛИНЕЙКА КЕЙСОВ: 10 ступеней.
 *
 * Цена растёт примерно вдвое через каждые две ступени, а шансы — наоборот:
 * у первого кейса легенда это «раз в двести», у последнего — «каждый второй».
 * Верхний кейс («ТРОН ЧУБА») задуман как дальняя цель: он стоит 90 000 жетонов
 * и отдаёт предметы дороже 5 000 — чтобы было к чему идти, а не «три кейса на
 * выбор и всё».
 *
 * Сумма odds у каждого кейса равна 1 — это проверяет check:ui, потому что
 * rollRarity() нормализует таблицу сам и кривые шансы молча превратились бы
 * в «легенда выпадает чаще, чем написано в интерфейсе».
 */
export const GAMBLE_CASES: GambleCase[] = [
  {
    id: "pack", name: "Пакет из столовой", tag: "на сдачу", tier: 1, price: 30,
    tint: "#9AA0AE", icon: "case", jackpot: 26,
    cap: 60,
    odds: { common: 0.70, rare: 0.24, epic: 0.055, legend: 0.005 },
  },
  {
    id: "shelf", name: "Полка у окна", tag: "первая коллекция", tier: 2, price: 80,
    tint: "#8FB6D6", icon: "gift", jackpot: 85,
    cap: 130,
    odds: { common: 0.60, rare: 0.33, epic: 0.062, legend: 0.008 },
  },
  {
    id: "locker", name: "Шкафчик в общаге", tag: "классика", tier: 3, price: 90,
    tint: "#7ED08A", icon: "lock", jackpot: 130,
    cap: 260,
    odds: { common: 0.42, rare: 0.40, epic: 0.155, legend: 0.025 },
  },
  {
    id: "canteen", name: "Поднос раздачи", tag: "жирное и быстрое", tier: 4, price: 260,
    tint: "#E2A13C", icon: "burger", jackpot: 390,
    cap: 600,
    odds: { common: 0.28, rare: 0.44, epic: 0.24, legend: 0.04 },
  },
  {
    id: "garage", name: "Гараж Артёма", tag: "металл и дым", tier: 5, price: 360,
    tint: "#C9773B", icon: "bolt", jackpot: 520,
    cap: 900,
    odds: { common: 0.15, rare: 0.38, epic: 0.39, legend: 0.08 },
  },
  {
    id: "gym", name: "Тренажёрка на районе", tag: "пот и цепи", tier: 6, price: 600,
    tint: "#6FD1C7", icon: "trophy", jackpot: 580,
    cap: 1700,
    odds: { common: 0.06, rare: 0.34, epic: 0.47, legend: 0.13 },
  },
  {
    id: "studio", name: "Студия Радомира", tag: "светомузыка", tier: 7, price: 1800,
    tint: "#FF9FD6", icon: "star", jackpot: 3800,
    cap: 5200,
    odds: { common: 0.02, rare: 0.26, epic: 0.52, legend: 0.20 },
  },
  {
    id: "deans", name: "Сейф деканата", tag: "закрыто на совесть", tier: 8, price: 3500,
    tint: "#E4C75A", icon: "lock", jackpot: 5000,
    cap: 15000,
    odds: { common: 0.01, rare: 0.18, epic: 0.53, legend: 0.28 },
  },
  {
    id: "vault", name: "Схрон за прачечной", tag: "ход слухов", tier: 9, price: 6300,
    tint: "#B48CFF", icon: "skull", jackpot: 5000,
    cap: 24000,
    odds: { common: 0, rare: 0.08, epic: 0.50, legend: 0.42 },
  },
  {
    id: "throne", name: "Трон Чуба", tag: "для тех, кто дожил", tier: 10, price: 10000,
    tint: "#FFD479", icon: "crown", jackpot: 5000,
    cap: 24000,
    odds: { common: 0, rare: 0, epic: 0.24, legend: 0.76 },
  },
];

/** Кейс по id (для сохранённых ссылок и наград фермы) */
export const caseById = (id: string): GambleCase | undefined =>
  GAMBLE_CASES.find((c) => c.id === id);

/** Самый дешёвый кейс — мерить им «сколько кейсов стоит итог фермы» */
export const CHEAPEST_CASE = GAMBLE_CASES.reduce((a, b) => (b.price < a.price ? b : a));

/**
 * Верхняя ступень линейки: нужна и как цель в «Прогрессе», и чтобы интерфейс
 * мог подписать «дороже только у декана», не переписывая цену руками.
 */
export const TOP_CASE = GAMBLE_CASES.reduce((a, b) => (b.tier > a.tier ? b : a));

/**
 * Ожидание от одного открытия: Σ редкость·средняя ценность предметов.
 * Нужно, чтобы «Трон Чуба» за 90 000 не оказался выгоднее «Пакета» за 70 —
 * раньше такое случилось бы молча, потому что цены и шансы правятся в разных
 * местах. check:ui сверяет, что ожидание растёт вместе с ценой.
 */
export function caseExpectation(c: GambleCase): number {
  let sum = 0;
  for (const r of ["common", "rare", "epic", "legend"] as Rarity[]) {
    const pool = ITEMS.filter((i) => i.rarity === r && i.value <= c.cap);
    if (!pool.length) continue;
    const avg = pool.reduce((a, i) => a + i.value, 0) / pool.length;
    sum += (c.odds[r] || 0) * avg;
  }
  return sum;
}

/**
 * Случайная редкость по шансам кейса.
 *
 * `luck` — бонус удачи главного друга (bossStats().luckBonus, 0..0.1).
 * Он ДОЛЖЕН влиять на дропы: в карточке друга написано «+N% к редким
 * дропам», но раньше это число никуда не передавалось и было враньём.
 *
 * Как применяем: шансы legend/epic/rare умножаются на (1 + luck), а
 * недостача добирается из common. Сумма всегда остаётся равной 1, и
 * common не может уйти в минус.
 */
export function rollRarity(c: GambleCase, luck = 0): Rarity {
  const k = Math.max(0, Math.min(1, luck));
  const legend = c.odds.legend * (1 + k);
  const epic = c.odds.epic * (1 + k);
  const rare = c.odds.rare * (1 + k);
  const common = Math.max(0, 1 - legend - epic - rare);
  const table: Array<[Rarity, number]> = [
    ["legend", legend], ["epic", epic], ["rare", rare], ["common", common],
  ];
  const total = table.reduce((a, [, v]) => a + v, 0);
  let r = Math.random() * total;
  for (const [name, v] of table) {
    r -= v;
    if (r < 0) return name;
  }
  return "common";
}

/** Выпадение предмета из кейса (luck — бонус удачи главного друга) */
export function rollItem(c: GambleCase, luck = 0): ItemDef {
  const rarity = rollRarity(c, luck);
  /* потолок ступени: из редкости берём только то, что не дороже cap;
     если в редкости таких нет (у «Пакета» эпика до 60 жетонов не бывает) —
     честно скатываемся на редкость ниже, а не показываем пустоту */
  let r = rarity;
  for (let guard = 0; guard < 4; guard++) {
    const inCap = ITEMS.filter((i) => i.rarity === r && i.value <= c.cap);
    if (inCap.length) return inCap[Math.floor(Math.random() * inCap.length)];
    const order: Rarity[] = ["legend", "epic", "rare", "common"];
    const idx = order.indexOf(r);
    if (idx < 0 || idx === order.length - 1) break;
    r = order[idx + 1];
  }
  const pool = ITEMS.filter((i) => i.rarity === r);
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ─────────────────────────── Апгрейд ─────────────────────────── */

/**
 * Апгрейд как в кейс-дропе: ставишь предмет и шанс.
 * Чем выше множитель, тем меньше шанс. Дом забирает 5%.
 */
export const UPGRADE_HOUSE = 0.05;

export function upgradeChance(from: number, to: number): number {
  if (to <= from) return 0.95;
  return Math.max(0.01, Math.min(0.95, (from / to) * (1 - UPGRADE_HOUSE)));
}

/** Предметы, на которые осмысленно апгрейдить (дороже текущего) */
export function upgradeTargets(fromValue: number): ItemDef[] {
  return ITEMS.filter((i) => i.value > fromValue * 1.15).sort((a, b) => a.value - b.value);
}

/* ─────────────────────────── Слоты ─────────────────────────── */

/** Барабаны: символ и его вес (чем больше, тем чаще) */
/**
 * Символы барабана.
 *
 * name — обязателен: «символам нужны подписи» было отдельной претензией.
 * Голые иконки не читаются как язык игры — игрок не понимает, что дорого,
 * а что дёшево, и таблица выплат превращается в набор цифр.
 */
export const SLOT_SYMBOLS = [
  { id: "burger", name: "БУРГЕР",    weight: 30, pay3: 5,   pay2: 0.5 },
  { id: "tooth",  name: "ЗУБ МУДРОСТИ", weight: 25, pay3: 9,  pay2: 0.7 },
  { id: "bolt",   name: "ГАЙКА",     weight: 18, pay3: 18,  pay2: 0.9 },
  { id: "gem",    name: "КРИСТАЛЛ",  weight: 12, pay3: 36,  pay2: 1.2 },
  { id: "crown",  name: "КОРОНА",    weight: 8,  pay3: 90,  pay2: 1.8 },
  { id: "skull",  name: "ЧЕРЕП",     weight: 5,  pay3: 260, pay2: 3 },
] as const;

/** подпись символа для барабана и таблицы выплат */
export function symbolName(id: SlotSymbol): string {
  return SLOT_SYMBOLS.find((s) => s.id === id)?.name ?? id;
}

export type SlotSymbol = (typeof SLOT_SYMBOLS)[number]["id"];

const TOTAL_W = SLOT_SYMBOLS.reduce((a, b) => a + b.weight, 0);

export function spinReel(): SlotSymbol {
  let r = Math.random() * TOTAL_W;
  for (const s of SLOT_SYMBOLS) {
    r -= s.weight;
    if (r < 0) return s.id;
  }
  return "burger";
}

/** Выплата за спин: тройка, пара или ничего */
export function slotPayout(reels: SlotSymbol[], bet: number): number {
  const [a, b, c] = reels;
  if (a === b && b === c) {
    const sym = SLOT_SYMBOLS.find((s) => s.id === a)!;
    return Math.round(bet * sym.pay3);
  }
  const pair = a === b ? a : b === c ? b : a === c ? a : null;
  if (pair) {
    const sym = SLOT_SYMBOLS.find((s) => s.id === pair)!;
    return Math.round(bet * sym.pay2);
  }
  return 0;
}

/* ─────────────────────────── Хранилище ─────────────────────────── */

export interface GambleStore {
  chips: number;
  /** id предмета -> сколько штук */
  items: Record<string, number>;
  /** Надетые украшения по типу */
  equipped: Partial<Record<SkinKind, string>>;
  /** Когда последний раз начислялись бесплатные жетоны */
  lastFree: number;
  /** Статистика для интереса */
  spins: number;
  won: number;
  lost: number;
  battles: number;
  battleWins: number;
}

const EMPTY: GambleStore = {
  chips: 300,
  items: {},
  equipped: {},
  lastFree: 0,
  spins: 0,
  won: 0,
  lost: 0,
  battles: 0,
  battleWins: 0,
};

/** Зеркало. Нужнo, чтобы одна неудачная запись не съела инвентарь. */
const KEY_BAK = `${KEY}.bak`;

/** то, чем хранилище обязано быть, чтобы его нельзя было потерять */
function sane(v: unknown): v is GambleStore {
  if (!v || typeof v !== "object") return false;
  const o = v as Partial<GambleStore>;
  return typeof o.chips === "number" && !!o.items && typeof o.items === "object";
}

function parse(raw: string | null): GambleStore | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<GambleStore>;
    return sane(v) ? { ...EMPTY, ...v, items: { ...v.items } } : null;
  } catch {
    return null;
  }
}

/**
 * Инвентарь казино может быть НЕЦЕЛЫМ: страница закрылась в момент записи,
 * браузер срезал квоту, расширение почистило localStorage. Молча заменить
 * такое на пустое — значит съесть собранные вещи (на это и жаловались:
 * «было 14 вещей, я нажал — они пропали»). Поэтому читаем основное ключевое
 * значение, а при любом подозрении — зеркальную копию; пустота это последний
 * вариант, и она никогда не записывается сама собой.
 */
export function readGamble(): GambleStore {
  try {
    const main = parse(localStorage.getItem(KEY));
    if (main) return main;
    const bak = parse(localStorage.getItem(KEY_BAK));
    if (bak) {
      // зеркало живое, а основной ключ битый или пустой — чиним его сразу,
      // пока пользователь не успел ничего потерять
      try { localStorage.setItem(KEY, JSON.stringify(bak)); } catch { /* приватный режим */ }
      return bak;
    }
  } catch {
    /* приватный режим — играем с нуля, но ничего не затираем */
  }
  return { ...EMPTY, items: {} };
}

export function writeGamble(s: GambleStore) {
  try {
    const json = JSON.stringify(s);
    localStorage.setItem(KEY, json);
    localStorage.setItem(KEY_BAK, json);
  } catch {
    /* приватный режим */
  }
}

/**
 * Патч хранилища: либо готовый кусок, либо функция от АКТУАЛЬНОГО состояния.
 * Вторая форма — правильный способ: она исключает «пишу поверх снимка,
 * снятого до таймаута», из-за которого пропадают чужие записи.
 */
export type GamblePatch = Partial<GambleStore> | ((s: GambleStore) => Partial<GambleStore>);
export type GambleSave = (p: GamblePatch) => void;

/** read-modify-write одним шагом: читаем хранилище в момент записи */
export function updateGamble(patch: GamblePatch): GambleStore {
  const cur = readGamble();
  const p = typeof patch === "function" ? patch(cur) : patch;
  const next: GambleStore = { ...cur, ...p };
  // мусор из старых версий: отрицательные жетоны и пустые позиции
  next.chips = Math.max(0, Math.floor(next.chips || 0));
  const items: Record<string, number> = {};
  for (const [k, n] of Object.entries(next.items || {})) {
    if (typeof n === "number" && n > 0) items[k] = Math.floor(n);
  }
  next.items = items;
  writeGamble(next);
  return next;
}

/** Изменение одной позиции инвентаря (d > 0 — нашли, d < 0 — потратили) */
export function shiftItem(s: GambleStore, id: string, d: number): Record<string, number> {
  const items = { ...s.items };
  const n = (items[id] || 0) + d;
  if (n > 0) items[id] = n;
  else delete items[id];
  return items;
}

/** Бесплатные жетоны раз в 20 минут, чтобы не застревать на нуле */
export const FREE_CHIPS = 60;
export const FREE_EVERY_MS = 20 * 60 * 1000;

export function freeChipsReady(s: GambleStore): boolean {
  return Date.now() - s.lastFree >= FREE_EVERY_MS;
}

export function freeChipsIn(s: GambleStore): number {
  return Math.max(0, FREE_EVERY_MS - (Date.now() - s.lastFree));
}

/* ─────────────────────────── Кейс-батл ─────────────────────────── */

export interface BattleRound {
  mine: ItemDef;
  foe: ItemDef;
}

/** Разыгрываем батл: N раундов, побеждает большая сумма ценности */
export function runBattle(c: GambleCase, rounds: number): {
  list: BattleRound[];
  mineTotal: number;
  foeTotal: number;
  win: boolean;
} {
  const list: BattleRound[] = [];
  let mineTotal = 0;
  let foeTotal = 0;
  for (let i = 0; i < rounds; i++) {
    const mine = rollItem(c);
    const foe = rollItem(c);
    mineTotal += mine.value;
    foeTotal += foe.value;
    list.push({ mine, foe });
  }
  return { list, mineTotal, foeTotal, win: mineTotal >= foeTotal };
}

/* ═══════════════════════ ШАНСЫ СЛОТОВ ═══════════════════════
 *
 * Просьба: «шансы запихнуть в кнопочку вопросика — наводишься и вылазит там
 * всё». Чтобы кнопка не врала, вероятности считаются здесь, из тех же
 * весов, из которых крутится барабан, а не переписываются руками во втором
 * месте (раньше любая «справка» расходилась с кодом через одну правку).
 *
 * Математика честная и простая: каждый барабан — независимый выбор символа
 * с вероятностью p = weight / сумма весов.
 *   тройка i:        p³
 *   ровно пара i:    3·p²·(1−p)
 *   RTP:             Σ (pay3·p³ + pay2·3p²(1−p)) — сколько возвращается
 *                    на одну поставленную монету, в долях.
 */

export type SlotOddsRow = {
  id: SlotSymbol;
  name: string;
  /** множители */
  pay3: number;
  pay2: number;
  /** вероятности, в процентах на один спин */
  tripPct: number;
  pairPct: number;
  /** вклад символа в возврат, в процентах ставки */
  contribPct: number;
};

export type SlotOdds = {
  rows: SlotOddsRow[];
  anyTripPct: number;
  anyPairPct: number;
  rtpPct: number;
  /** сколько казино забирает в среднем, % (100 − RTP) */
  edgePct: number;
};

export function slotOdds(): SlotOdds {
  const total = SLOT_SYMBOLS.reduce((a, b) => a + b.weight, 0);
  let trip = 0;
  let pair = 0;
  let rtp = 0;
  const rows: SlotOddsRow[] = SLOT_SYMBOLS.map((sy) => {
    const p = sy.weight / total;
    const t = p * p * p;
    const q = 3 * p * p * (1 - p);
    const contrib = sy.pay3 * t + sy.pay2 * q;
    trip += t;
    pair += q;
    rtp += contrib;
    return {
      id: sy.id,
      name: sy.name,
      pay3: sy.pay3,
      pay2: sy.pay2,
      tripPct: t * 100,
      pairPct: q * 100,
      contribPct: contrib * 100,
    };
  });
  return {
    rows: rows.sort((a, b) => b.tripPct - a.tripPct),
    anyTripPct: trip * 100,
    anyPairPct: pair * 100,
    rtpPct: rtp * 100,
    edgePct: (1 - rtp) * 100,
  };
}

/** Процент по-человечески: «1 к 34», «0,9 %», «12,4 %» */
export function fmtPct(v: number): string {
  if (v <= 0) return "0 %";
  if (v < 1) return `${v.toFixed(2).replace(".", ",")} %`;
  if (v < 10) return `${v.toFixed(1).replace(".", ",")} %`;
  return `${Math.round(v)} %`;
}

/** «1 к N» — так шанс читается лучше, чем 2,94 % */
export function fmtOdd(pct: number): string {
  if (pct <= 0) return "—";
  const n = 100 / pct;
  return `1 к ${n >= 10 ? Math.round(n) : n.toFixed(1).replace(".", ",")}`;
}
