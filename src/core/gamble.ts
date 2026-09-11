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

  // легенды
  { id: "crown_gold",  name: "Корона старосты",       kind: "hat",     rarity: "legend", value: 3200 },
  { id: "aura_rgb",    name: "RGB-подсветка",         kind: "aura",    rarity: "legend", value: 3800 },
  { id: "pet_chub",    name: "Мини-Чубуков",          kind: "pet",     rarity: "legend", value: 5000 },
];

export const itemById = (id: string) => ITEMS.find((i) => i.id === id);

/* ─────────────────────────── Кейсы ─────────────────────────── */

export interface GambleCase {
  id: string;
  name: string;
  price: number;               // в жетонах
  odds: Record<Rarity, number>;
}

export const GAMBLE_CASES: GambleCase[] = [
  {
    id: "pack", name: "Пакет из столовой", price: 70,
    odds: { common: 0.70, rare: 0.24, epic: 0.055, legend: 0.005 },
  },
  {
    id: "locker", name: "Шкафчик в общаге", price: 200,
    odds: { common: 0.42, rare: 0.40, epic: 0.155, legend: 0.025 },
  },
  {
    id: "deans", name: "Сейф деканата", price: 800,
    odds: { common: 0.15, rare: 0.38, epic: 0.39, legend: 0.08 },
  },
];

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
  const pool = ITEMS.filter((i) => i.rarity === rarity);
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
export const SLOT_SYMBOLS = [
  { id: "burger", weight: 30, pay3: 5,   pay2: 0.5 },
  { id: "tooth",  weight: 25, pay3: 9,   pay2: 0.7 },
  { id: "bolt",   weight: 18, pay3: 18,  pay2: 0.9 },
  { id: "gem",    weight: 12, pay3: 36,  pay2: 1.2 },
  { id: "crown",  weight: 8,  pay3: 90,  pay2: 1.8 },
  { id: "skull",  weight: 5,  pay3: 260, pay2: 3 },
] as const;

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

export function readGamble(): GambleStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<GambleStore>) };
  } catch {
    return { ...EMPTY };
  }
}

export function writeGamble(s: GambleStore) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* приватный режим */
  }
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
