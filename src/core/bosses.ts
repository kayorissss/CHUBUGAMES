/**
 * Ежечасные боссы — воспитатели в общаге.
 *
 * Раз в час на смену заступает один из них. Драться с ним можно ВЕСЬ ЧАС,
 * пока не победишь: раньше окно длилось 15 минут, и, если человек в них не
 * попал, босс пропадал до следующего часа — а там можно было промахнуться
 * снова. Теперь пропустить босса нельзя: он ждёт до конца своего часа.
 * Победил — дальше ждёшь следующего, это и есть перерыв.
 *
 * Хранится отдельным ключом, чтобы не трогать migrate() основного сейва.
 */

import type { FriendLook } from "./types";

const KEY = "chubgames.bosses";

export const BOSS_EVERY_MS = 60 * 60 * 1000;   // раз в час
/**
 * Сколько времени босс «дежурит» после появления.
 * Равно целому часу: смена длится ровно до прихода следующего.
 */
export const BOSS_WINDOW_MS = BOSS_EVERY_MS;

export interface BossDef {
  id: string;
  name: string;
  nick: string;
  quote: string;
  /** Реплики во время боя */
  taunts: string[];
  /**
   * Запас здоровья.
   *
   * Подобран перебором (см. /tmp/boss3.mjs, 500 боёв на конфигурацию).
   * С прежними значениями бой длился 7-12 секунд, а после появления
   * слабых мест и добивания «умный» игрок сносил босса за 18с — событие
   * часа заканчивалось быстрее, чем успевало начаться.
   *
   * Итог при текущих числах:
   *   долбёжка одной кнопкой  —   0% побед (наказывается всегда),
   *   средняя игра            —  22-100% в зависимости от босса,
   *   точная игра             —  99-100%, бой 28-37 секунд.
   */
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
    hp: 6240,
    dmg: 12,
    every: 1050,
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
    hp: 7680,
    dmg: 15,
    every: 910,
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
    hp: 4800,
    dmg: 8,
    every: 1260,
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
    hp: 6720,
    dmg: 14,
    every: 980,
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

/**
 * Босс ещё «на смене».
 *
 * Смена занимает весь час, поэтому дежурный есть всегда — пока его не
 * побили. Функция оставлена, чтобы не переписывать вызовы на экранах.
 */
export function bossActive(t = Date.now()): boolean {
  return t - hourStart(t) < BOSS_WINDOW_MS;
}

/**
 * Сколько осталось до конца смены.
 * Совпадает с временем до следующего босса: смена длится весь час.
 */
export function windowLeft(t = Date.now()): number {
  return Math.max(0, hourStart(t) + BOSS_WINDOW_MS - t);
}

/**
 * Расписание ближайших смен — для локальных уведомлений.
 *
 * Сеть не нужна: кто и когда заступит, считается формулой, поэтому
 * напоминания можно поставить заранее на много часов вперёд.
 */
export function upcomingBosses(
  count = 12,
  t = Date.now(),
): { at: number; name: string }[] {
  const out: { at: number; name: string }[] = [];
  for (let i = 1; i <= count; i++) {
    const at = hourStart(t) + i * BOSS_EVERY_MS;
    out.push({ at, name: bossOfHour(at).name });
  }
  return out;
}

/* ─────────────────────────── Хранилище ─────────────────────────── */

export interface BossStore {
  /** Час, за который уже забрали ПОЛНУЮ награду */
  clearedHour: number;
  /** id -> сколько раз побеждён */
  wins: Record<string, number>;
  /** Всего попыток */
  fights: number;
  /** Час, к которому относится счётчик добиваний */
  runHour: number;
  /** Сколько раз уже завалили босса в текущий час */
  runKills: number;
}

const EMPTY: BossStore = { clearedHour: -1, wins: {}, fights: 0, runHour: -1, runKills: 0 };

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

/** Полную награду за этот час уже забрали */
export function clearedThisHour(s: BossStore, t = Date.now()): boolean {
  return s.clearedHour === hourIndex(t);
}

/**
 * Можно ли драться прямо сейчас.
 *
 * СОБЫТИЕ ИДЁТ ВЕСЬ ЧАС И НЕ ЗАКРЫВАЕТСЯ ПОСЛЕ ПЕРВОГО УБИЙСТВА.
 *
 * Раньше здесь стояло `&& !clearedThisHour(...)`: завалил босса за
 * полминуты — и смена схлопывалась, экран показывал «приходи через час».
 * Пользователь: «а не за секунду убить и всё, у других она тоже
 * закрылась». Теперь бой доступен всю смену: первое убийство даёт полную
 * награду, дальше можно добивать сколько успеешь, но выплата за каждое
 * следующее падает (см. `killRewardScale`) — чтобы фарм за час не
 * ломал экономику.
 */
export function canFight(_s: BossStore, t = Date.now()): boolean {
  return bossActive(t);
}

/** Сколько раз уже завалили дежурного в текущий час */
export function killsThisHour(s: BossStore, t = Date.now()): number {
  return s.runHour === hourIndex(t) ? s.runKills : 0;
}

/**
 * Множитель награды за очередное убийство в пределах одной смены.
 *
 * Первое — полное, дальше половина, четверть и так далее, но не ниже
 * 8%: добивать всегда чуть выгоднее, чем стоять без дела, и при этом
 * час фарма одного босса не перебивает обычные игры.
 */
export function killRewardScale(prevKills: number): number {
  return Math.max(0.08, Math.pow(0.5, prevKills));
}

/**
 * Насколько крепче становится босс с каждым добиванием за смену.
 * Иначе повторные заходы превращаются в бессмысленное тапание.
 */
export function killHpScale(prevKills: number): number {
  return 1 + prevKills * 0.35;
}
