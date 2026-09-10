/**
 * Ежечасные боссы — воспитатели в общаге.
 *
 * Раз в час «на смену заступает» один из них: приходит уведомление,
 * можно зайти и подраться. Пропустил — ждёшь следующего.
 *
 * Хранится отдельным ключом, чтобы не трогать migrate() основного сейва.
 */

import type { FriendLook } from "./types";

const KEY = "chubgames.bosses";

export const BOSS_EVERY_MS = 60 * 60 * 1000;   // раз в час
/** Сколько времени босс «дежурит» после появления */
export const BOSS_WINDOW_MS = 15 * 60 * 1000;

export interface BossDef {
  id: string;
  name: string;
  nick: string;
  quote: string;
  /** Реплики во время боя */
  taunts: string[];
  /** Запас здоровья. Втрое выше «интуитивного»: при прежних значениях бой
   *  заканчивался за 3-5 секунд тапания и блок ни на что не влиял. */
  hp: number;
  /** Урон за одну атаку по игроку */
  dmg: number;
  /** Как часто атакует, мс */
  every: number;
  reward: { coins: number; chips: number; xp: number };
  look: FriendLook;
  /** Особая механика */
  gimmick: "gas" | "tank" | "sleep" | "kind";
}

export const BOSSES: BossDef[] = [
  {
    id: "bronya",
    name: "БРОНЯ",
    nick: "Ходит как танк",
    quote: "Так, а ну разошлись по комнатам!",
    taunts: [
      "Ты почему не на паре?",
      "Я всё вижу, между прочим.",
      "Комендантский час, забыл?",
      "Ещё слово — и родителям звоню.",
    ],
    hp: 780,
    dmg: 12,
    every: 1500,
    reward: { coins: 14000, chips: 180, xp: 520 },
    gimmick: "tank",
    look: {
      skin: "#f2cdaa", hair: "#4a3222", hairStyle: 10, eyes: "#5a4030",
      brow: 1, facial: 0, glasses: 0, wide: 1.06,
      shirt: "plain", shirtColor: "#7a4a6a", build: "wide",
    },
  },
  {
    id: "t34",
    name: "Т-34",
    nick: "Броня крепка",
    quote: "Я тут двадцать лет работаю. Двадцать.",
    taunts: [
      "Не спорь со мной.",
      "У меня смена с шести утра.",
      "Молча. Просто молча.",
      "Я таких, как ты, видела сотни.",
    ],
    hp: 960,
    dmg: 15,
    every: 1300,
    reward: { coins: 17000, chips: 220, xp: 620 },
    gimmick: "sleep",
    look: {
      skin: "#e8c9a8", hair: "#5a5148", hairStyle: 9, eyes: "#4a4a44",
      brow: 1, facial: 0, glasses: 0, wide: 1.0, tired: true,
      shirt: "plain", shirtColor: "#5a6470",
    },
  },
  {
    id: "dobraya",
    name: "ДОБРАЯ",
    nick: "Всех жалеет",
    quote: "Ну что ты, милый, кушал сегодня?",
    taunts: [
      "Ты бы поспал, а не бегал.",
      "Я никому не скажу, ладно?",
      "Возьми пирожок, я испекла.",
      "Ой, ну не расстраивайся.",
    ],
    hp: 600,
    dmg: 8,
    every: 1800,
    reward: { coins: 11000, chips: 150, xp: 430 },
    gimmick: "kind",
    look: {
      skin: "#f8d8c0", hair: "#ff8fc0", hairStyle: 11, eyes: "#7a5a8a",
      brow: 2, facial: 0, glasses: 0, wide: 1.1,
      shirt: "plain", shirtColor: "#e8a0c0", build: "short",
    },
  },
  {
    id: "danil",
    name: "ДАНИЛ",
    nick: "Сосед Вани",
    quote: "Дверь не открывай. Серьёзно.",
    taunts: [
      "Это не я, это батарея.",
      "Проветрим потом.",
      "Ты сам виноват.",
      "Держись, сейчас пройдёт.",
    ],
    hp: 840,
    dmg: 14,
    every: 1400,
    reward: { coins: 15500, chips: 195, xp: 560 },
    gimmick: "gas",
    look: {
      skin: "#eec9a4", hair: "#161210", hairStyle: 9, eyes: "#2e2620",
      brow: 1, facial: 0, glasses: 0, wide: 0.98,
      shirt: "plain", shirtColor: "#f0f0f4",
    },
  },
];

export const bossById = (id: string) => BOSSES.find((b) => b.id === id);

/* ─────────────────────────── Расписание ─────────────────────────── */

/** Номер «часа» с эпохи — по нему детерминированно выбираем дежурного */
function hourIndex(t = Date.now()): number {
  return Math.floor(t / BOSS_EVERY_MS);
}

/** Кто дежурит в этот час */
export function bossOfHour(t = Date.now()): BossDef {
  return BOSSES[hourIndex(t) % BOSSES.length];
}

/** Когда начался текущий час дежурства */
export function hourStart(t = Date.now()): number {
  return hourIndex(t) * BOSS_EVERY_MS;
}

/** Сколько осталось до следующего босса */
export function nextBossIn(t = Date.now()): number {
  return hourStart(t) + BOSS_EVERY_MS - t;
}

/** Босс ещё «на смене» (окно 15 минут с начала часа) */
export function bossActive(t = Date.now()): boolean {
  return t - hourStart(t) < BOSS_WINDOW_MS;
}

/** Сколько осталось до конца окна */
export function windowLeft(t = Date.now()): number {
  return Math.max(0, hourStart(t) + BOSS_WINDOW_MS - t);
}

/* ─────────────────────────── Хранилище ─────────────────────────── */

export interface BossStore {
  /** Час, за который уже забрали награду */
  clearedHour: number;
  /** id -> сколько раз побеждён */
  wins: Record<string, number>;
  /** Всего попыток */
  fights: number;
}

const EMPTY: BossStore = { clearedHour: -1, wins: {}, fights: 0 };

export function readBosses(): BossStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<BossStore>) };
  } catch {
    return { ...EMPTY };
  }
}

export function writeBosses(s: BossStore) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* приватный режим */
  }
}

/** Босса этого часа уже побили */
export function clearedThisHour(s: BossStore, t = Date.now()): boolean {
  return s.clearedHour === hourIndex(t);
}

/** Можно ли драться прямо сейчас */
export function canFight(s: BossStore, t = Date.now()): boolean {
  return bossActive(t) && !clearedThisHour(s, t);
}
