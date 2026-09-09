import type { Friend, Rarity } from "./types";

/* ============ ДРУЗЬЯ (дефолтные, переименовываются в приложении) ============ */
export const DEFAULT_FRIENDS: Friend[] = [
  {
    id: "chub",
    name: "ЧАБ",
    nick: "Бургерная Голова",
    builtin: true,
    rarity: "legend",
    quote: "Открой рот. Это приказ.",
    look: {
      skin: "#e8b48c", hair: "#2b2118", hairStyle: 2, eyes: "#3a2c1e",
      brow: 1, facial: 1, glasses: 0, wide: 1.18,
    },
    stats: { spit: 97, chub: 99, chaos: 88, luck: 41 },
  },
  {
    id: "shket",
    name: "ШКЕТ",
    nick: "Быстрые Ноги",
    builtin: true,
    rarity: "epic",
    quote: "Я не убегал. Я тактически отступал.",
    look: {
      skin: "#f0c49e", hair: "#7a4a22", hairStyle: 1, eyes: "#2f5d3a",
      brow: 2, facial: 0, glasses: 0, wide: 0.9,
    },
    stats: { spit: 44, chub: 22, chaos: 71, luck: 80 },
  },
  {
    id: "profa",
    name: "ПРОФ",
    nick: "Мозг Компании",
    builtin: true,
    rarity: "epic",
    quote: "Статистически ты уже проиграл.",
    look: {
      skin: "#e2b088", hair: "#1a1a1e", hairStyle: 1, eyes: "#4a4a55",
      brow: 0, facial: 2, glasses: 2, wide: 0.98,
    },
    stats: { spit: 51, chub: 48, chaos: 33, luck: 66 },
  },
  {
    id: "buyan",
    name: "БУЯН",
    nick: "Ходячий Хаос",
    builtin: true,
    rarity: "rare",
    quote: "А чё такого-то?",
    look: {
      skin: "#d9a074", hair: "#c0392b", hairStyle: 3, eyes: "#6b3f1d",
      brow: 1, facial: 3, glasses: 0, wide: 1.06,
    },
    stats: { spit: 78, chub: 63, chaos: 99, luck: 24 },
  },
  {
    id: "tihiy",
    name: "ТИХИЙ",
    nick: "Молчаливый Босс",
    builtin: true,
    rarity: "rare",
    quote: "...",
    look: {
      skin: "#eec9a8", hair: "#4a3520", hairStyle: 5, eyes: "#333340",
      brow: 0, facial: 1, glasses: 1, wide: 1.0,
    },
    stats: { spit: 62, chub: 55, chaos: 18, luck: 92 },
  },
  {
    id: "kudri",
    name: "КУДРИ",
    nick: "Причёска Года",
    builtin: true,
    rarity: "common",
    quote: "Не трогай волосы.",
    look: {
      skin: "#c98a5e", hair: "#241a12", hairStyle: 4, eyes: "#2a1c12",
      brow: 2, facial: 0, glasses: 0, wide: 1.02,
    },
    stats: { spit: 39, chub: 37, chaos: 58, luck: 70 },
  },
];

/* ============ АКЦЕНТЫ ============ */
export const ACCENTS = [
  { id: "amber", name: "Янтарь", hex: "#FFB020", price: 0 },
  { id: "lime", name: "Кислота", hex: "#B6F23C", price: 12000 },
  { id: "cyan", name: "Лёд", hex: "#3EE0E0", price: 12000 },
  { id: "rose", name: "Малина", hex: "#FF4D7E", price: 25000 },
  { id: "violet", name: "Ультра", hex: "#A77BFF", price: 25000 },
  { id: "mono", name: "Платина", hex: "#E8E8F0", price: 90000 },
  { id: "blood", name: "Кровь", hex: "#FF2E2E", price: 180000 },
  { id: "toxic", name: "Радиация", hex: "#59FF9E", price: 400000 },
];

/* ============ СКИНЫ ГЕРОЯ ============ */
export interface HeroSkin {
  id: string;
  name: string;
  desc: string;
  price: number;
  rarity: Rarity;
  body: string;
  accentPart: string;
  hat: 0 | 1 | 2 | 3 | 4; // нет / кепка / корона / цилиндр / нимб
}
export const HERO_SKINS: HeroSkin[] = [
  { id: "default", name: "Обычный Ты", desc: "Стартовый комплект", price: 0, rarity: "common", body: "#d8d8e2", accentPart: "#4a4a55", hat: 0 },
  { id: "shadow", name: "Тень", desc: "Тебя почти не видно", price: 4000, rarity: "common", body: "#2a2a33", accentPart: "#6b6b78", hat: 0 },
  { id: "cap", name: "Кепарь", desc: "Козырёк отбивает бургеры. Морально.", price: 9000, rarity: "rare", body: "#c9c9d4", accentPart: "#1f6feb", hat: 1 },
  { id: "steel", name: "Сталь", desc: "Металлический блеск 2026", price: 22000, rarity: "rare", body: "#9aa3b2", accentPart: "#e8eef7", hat: 0 },
  { id: "king", name: "Король", desc: "+5% монет во всех играх", price: 60000, rarity: "epic", body: "#f0e6c8", accentPart: "#ffb020", hat: 2 },
  { id: "gent", name: "Джентльмен", desc: "Уклоняется с достоинством", price: 120000, rarity: "epic", body: "#1c1c21", accentPart: "#f2f2f5", hat: 3 },
  { id: "ghost", name: "Призрак", desc: "+8% шанс уклона в Burger Rain", price: 300000, rarity: "legend", body: "#cfe8ff", accentPart: "#8fd0ff", hat: 4 },
  { id: "gold", name: "Золотой", desc: "+15% монет во всех играх", price: 1000000, rarity: "legend", body: "#ffcf4d", accentPart: "#fff3c4", hat: 2 },
];

/* ============ ДЕРЕВО НАВЫКОВ (за очки престижа) ============ */
export interface SkillNode {
  id: string;
  name: string;
  desc: string;
  max: number;
  cost: (lvl: number) => number;
  branch: "coin" | "power" | "luck";
  req?: string;
  icon: string;
}
export const SKILLS: SkillNode[] = [
  { id: "greed", name: "Жадность", desc: "+10% монет за уровень", max: 10, cost: (l) => 1 + l, branch: "coin", icon: "🪙" },
  { id: "vault", name: "Хранилище", desc: "+15% офлайн-дохода", max: 8, cost: (l) => 2 + l * 2, branch: "coin", req: "greed", icon: "🏦" },
  { id: "midas", name: "Мидас", desc: "+50% монет, но −10% XP", max: 5, cost: (l) => 6 + l * 4, branch: "coin", req: "vault", icon: "👑" },
  { id: "fist", name: "Кулак", desc: "+12% сила тапа", max: 10, cost: (l) => 1 + l, branch: "power", icon: "✊" },
  { id: "engine", name: "Мотор", desc: "+18% автодоход", max: 8, cost: (l) => 2 + l * 2, branch: "power", req: "fist", icon: "⚙️" },
  { id: "berserk", name: "Берсерк", desc: "Комбо держится дольше на 20%", max: 5, cost: (l) => 5 + l * 3, branch: "power", req: "engine", icon: "🔥" },
  { id: "clover", name: "Клевер", desc: "+3% шанс крита", max: 10, cost: (l) => 1 + l, branch: "luck", icon: "🍀" },
  { id: "magnet", name: "Магнит", desc: "Бонусы падают на 12% чаще", max: 8, cost: (l) => 2 + l * 2, branch: "luck", req: "clover", icon: "🧲" },
  { id: "fate", name: "Судьба", desc: "+8% редкие карточки из кейсов", max: 5, cost: (l) => 5 + l * 3, branch: "luck", req: "magnet", icon: "🎲" },
];

/* ============ АЧИВКИ ============ */
export interface Achievement {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  reward: number;
  check: (s: any) => boolean;
}
const A = (
  id: string, name: string, desc: string, rarity: Rarity, reward: number,
  check: (s: any) => boolean,
): Achievement => ({ id, name, desc, rarity, reward, check });

export const ACHIEVEMENTS: Achievement[] = [
  A("first_blood", "Первый Бургер", "Сыграй в Burger Rain", "common", 500, (s) => s.games.burger.plays >= 1),
  A("dodge_100", "Уклонист", "Уклонись от 100 бургеров", "common", 1500, (s) => s.stats.burgersDodged >= 100),
  A("dodge_1000", "Матрица", "Уклонись от 1 000 бургеров", "rare", 12000, (s) => s.stats.burgersDodged >= 1000),
  A("dodge_10000", "Неуловимый", "Уклонись от 10 000 бургеров", "epic", 150000, (s) => s.stats.burgersDodged >= 10000),
  A("burger_50", "Разогрев", "50 очков в Burger Rain", "common", 800, (s) => s.games.burger.best >= 50),
  A("burger_250", "Профи Уклона", "250 очков в Burger Rain", "rare", 9000, (s) => s.games.burger.best >= 250),
  A("burger_1000", "Легенда Кафе", "1 000 очков в Burger Rain", "legend", 250000, (s) => s.games.burger.best >= 1000),
  A("tap_1000", "Пальцы", "1 000 тапов", "common", 1000, (s) => s.stats.tapsTotal >= 1000),
  A("tap_50000", "Отбитый Палец", "50 000 тапов", "epic", 120000, (s) => s.stats.tapsTotal >= 50000),
  A("tap_500000", "Киборг", "500 000 тапов", "legend", 900000, (s) => s.stats.tapsTotal >= 500000),
  A("coin_10k", "Первая Десятка", "Накопи 10 000 монет", "common", 1000, (s) => s.totalCoinsEver >= 10000),
  A("coin_1m", "Миллионер", "Заработай 1 000 000 всего", "rare", 30000, (s) => s.totalCoinsEver >= 1e6),
  A("coin_1b", "Миллиардер", "Заработай 1 000 000 000 всего", "legend", 5e6, (s) => s.totalCoinsEver >= 1e9),
  A("merge_first", "Слияние", "Сделай первое слияние", "common", 500, (s) => s.stats.merges >= 1),
  A("merge_500", "Мастер Слияний", "500 слияний", "rare", 15000, (s) => s.stats.merges >= 500),
  A("merge_boss", "Финальная Форма", "Собери максимальную голову", "legend", 400000, (s) => s.games.merge.best >= 2048),
  A("whack_50", "Молоточник", "Прибей 50 голов", "common", 800, (s) => s.stats.whacks >= 50),
  A("whack_1000", "Каратель", "Прибей 1 000 голов", "epic", 90000, (s) => s.stats.whacks >= 1000),
  A("lvl_10", "Десятка", "Достигни 10 уровня", "common", 2000, (s) => s.level >= 10),
  A("lvl_30", "Ветеран", "Достигни 30 уровня", "rare", 25000, (s) => s.level >= 30),
  A("lvl_60", "Босс Района", "Достигни 60 уровня", "epic", 200000, (s) => s.level >= 60),
  A("lvl_100", "Сотка", "Достигни 100 уровня", "legend", 2e6, (s) => s.level >= 100),
  A("prestige_1", "Перерождение", "Первый престиж", "rare", 20000, (s) => s.prestige >= 1),
  A("prestige_5", "Круговорот", "5 престижей", "epic", 300000, (s) => s.prestige >= 5),
  A("prestige_15", "Бесконечность", "15 престижей", "legend", 4e6, (s) => s.prestige >= 15),
  A("streak_7", "Неделя", "7 дней подряд", "rare", 20000, (s) => s.daily.streak >= 7),
  A("streak_30", "Месяц", "30 дней подряд", "legend", 600000, (s) => s.daily.streak >= 30),
  A("case_10", "Коллекционер", "Открой 10 кейсов", "common", 3000, (s) => s.stats.casesOpened >= 10),
  A("case_100", "Кейсомания", "Открой 100 кейсов", "epic", 150000, (s) => s.stats.casesOpened >= 100),
  A("friends_10", "Компания", "Заведи 10 друзей", "rare", 15000, (s) => s.friends.length >= 10),
  A("all_games", "Всё Попробовал", "Сыграй во все игры", "rare", 12000, (s) =>
    ["burger", "clicker", "merge", "whack"].every((g) => s.games[g].plays >= 1)),
  A("skin_5", "Модник", "Купи 5 скинов", "rare", 18000, (s) => s.ownedSkins.length >= 5),
  A("skill_max", "Мастер Навыков", "Прокачай любой навык до максимума", "epic", 100000, (s) =>
    Object.entries(s.skills).some(([k, v]: any) => {
      const n = SKILLS.find((x) => x.id === k);
      return n && v >= n.max;
    })),
  A("night", "Ночной Дожор", "Играй между 02:00 и 05:00", "rare", 8000, () => {
    const h = new Date().getHours();
    return h >= 2 && h < 5;
  }),
  A("hoarder", "Скупердяй", "Держи 5 000 000 монет одновременно", "epic", 250000, (s) => s.coins >= 5e6),
];

/* ============ ЕЖЕДНЕВНЫЕ ЗАДАНИЯ ============ */
export interface QuestDef {
  id: string;
  name: string;
  target: number;
  reward: number;
  metric: "dodge" | "taps" | "plays" | "merges" | "whacks" | "score";
}
export const QUEST_POOL: QuestDef[] = [
  { id: "q_dodge", name: "Уклонись от {n} бургеров", target: 120, reward: 6000, metric: "dodge" },
  { id: "q_dodge2", name: "Уклонись от {n} бургеров", target: 400, reward: 18000, metric: "dodge" },
  { id: "q_taps", name: "Сделай {n} тапов", target: 800, reward: 5000, metric: "taps" },
  { id: "q_taps2", name: "Сделай {n} тапов", target: 3000, reward: 16000, metric: "taps" },
  { id: "q_plays", name: "Сыграй {n} раз в любую игру", target: 5, reward: 7000, metric: "plays" },
  { id: "q_merges", name: "Сделай {n} слияний", target: 60, reward: 8000, metric: "merges" },
  { id: "q_whacks", name: "Прибей {n} голов", target: 40, reward: 6500, metric: "whacks" },
  { id: "q_score", name: "Набери {n} очков суммарно", target: 500, reward: 9000, metric: "score" },
];

/* ============ ЛЕСЕНКА ЕЖЕДНЕВНОГО ВХОДА ============ */
export const DAILY_LADDER = [
  { coins: 2500, gems: 0 },
  { coins: 5000, gems: 0 },
  { coins: 9000, gems: 1 },
  { coins: 16000, gems: 0 },
  { coins: 28000, gems: 2 },
  { coins: 45000, gems: 0 },
  { coins: 100000, gems: 5 },
];

/* ============ СЕЗОН ============ */
export const SEASON_TIERS = 30;
export const SEASON_XP_PER_TIER = 900;
export function seasonReward(tier: number): { coins: number; gems: number; label: string } {
  if ((tier + 1) % 10 === 0) return { coins: 200000 * (tier + 1), gems: 10, label: "МЕГА" };
  if ((tier + 1) % 5 === 0) return { coins: 60000 * (tier + 1), gems: 4, label: "БОЛЬШОЙ" };
  return { coins: 8000 * (tier + 1), gems: 0, label: "" };
}

/* ============ КЕЙСЫ ============ */
export interface CaseDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  odds: Record<Rarity, number>;
}
export const CASES: CaseDef[] = [
  { id: "bronze", name: "Бумажный пакет", desc: "Что-то в нём точно есть", price: 15000,
    odds: { common: 0.68, rare: 0.26, epic: 0.055, legend: 0.005 } },
  { id: "silver", name: "Фольга", desc: "Шансы получше", price: 90000,
    odds: { common: 0.4, rare: 0.4, epic: 0.17, legend: 0.03 } },
  { id: "gold", name: "Золотой контейнер", desc: "Для тех, кто фармил", price: 500000,
    odds: { common: 0.12, rare: 0.38, epic: 0.38, legend: 0.12 } },
];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "ОБЫЧНАЯ", rare: "РЕДКАЯ", epic: "ЭПИК", legend: "ЛЕГЕНДА",
};
export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#8f8f9c", rare: "#5fa8ff", epic: "#b07bff", legend: "#ffb020",
};
export const RARITY_MULT: Record<Rarity, number> = { common: 1, rare: 2.2, epic: 5, legend: 14 };

/* ============ ИГРЫ ============ */
export const GAME_META = [
  { id: "burger" as const, name: "BURGER RAIN", tag: "Уклоняйся", desc: "Голова друга плюётся бургерами. Не поймай ни одного.", unlockLvl: 0, icon: "🍔" },
  { id: "clicker" as const, name: "CHUBCLICKER", tag: "Фарм", desc: "Тапай по морде. Копи миллиарды. Не спи.", unlockLvl: 0, icon: "👆" },
  { id: "merge" as const, name: "MERGE HEADS", tag: "Пазл", desc: "Сливай одинаковых друзей в новых. 2048 из голов.", unlockLvl: 3, icon: "🧩" },
  { id: "whack" as const, name: "WHACK-A-FRIEND", tag: "Реакция", desc: "Головы лезут из люков. Прибей. Но не всех.", unlockLvl: 6, icon: "🔨" },
];
