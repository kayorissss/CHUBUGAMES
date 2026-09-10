import type { Friend, Rarity } from "./types";
import type { IconName } from "../ui/Icon";

/* ============ ДРУЗЬЯ (дефолтные, переименовываются в приложении) ============ */
export const DEFAULT_FRIENDS: Friend[] = [
  {
    id: "lyoha",
    name: "ЛЁХА БУРГЕР",
    nick: "Два метра голода",
    builtin: true,
    rarity: "legend",
    quote: "Я не толстый, я просто дважды высокий.",
    look: {
      skin: "#f0c9a4", hair: "#b98b4e", hairStyle: 2, eyes: "#5a4a2e",
      brow: 1, facial: 0, glasses: 0, wide: 1.16,
    },
    stats: { spit: 99, chub: 94, chaos: 82, luck: 44 },
  },
  {
    id: "vanya",
    name: "ВАНЯ СТАРОСТОВИЧ",
    nick: "Староста группы",
    builtin: true,
    rarity: "legend",
    quote: "Так, кого сегодня отмечать? Я всё вижу.",
    look: {
      skin: "#eec9a8", hair: "#2b2118", hairStyle: 1, eyes: "#4a5a3a",
      brow: 0, facial: 0, glasses: 0, wide: 0.98,
      shirt: "suit", shirtColor: "#2a3140", prop: "clipboard",
    },
    stats: { spit: 55, chub: 50, chaos: 40, luck: 88 },
  },
  {
    id: "maks",
    name: "БЕЗУМНЫЙ МАКС",
    nick: "Танк на максималках",
    builtin: true,
    rarity: "epic",
    quote: "Немного толстый? Прям много толстый.",
    look: {
      skin: "#f2cba6", hair: "#6b5230", hairStyle: 1, eyes: "#3a2c1e",
      brow: 1, facial: 4, glasses: 0, wide: 1.08,
      shirt: "plain", shirtColor: "#4a4033", prop: "beer",
    },
    stats: { spit: 84, chub: 99, chaos: 90, luck: 31 },
  },
  {
    id: "seryoga",
    name: "СЕРЁГА КАРАКУЛИК",
    nick: "Карманный шторм",
    builtin: true,
    rarity: "epic",
    quote: "Маленький, но громкий. И безопасный.",
    look: {
      skin: "#e8b48c", hair: "#4a3520", hairStyle: 1, eyes: "#2f4d6a",
      brow: 1, facial: 0, glasses: 0, wide: 0.86,
    },
    stats: { spit: 71, chub: 26, chaos: 95, luck: 62 },
  },
  {
    id: "artyom",
    name: "АРТЁМ ТРАМПОВИЧ",
    nick: "Брекет-босс",
    builtin: true,
    rarity: "epic",
    quote: "Стой смирно, я только куснууу.",
    look: {
      skin: "#f4d2b0", hair: "#d8c48a", hairStyle: 2, eyes: "#5a7a9a",
      brow: 1, facial: 0, glasses: 0, wide: 1.0, braces: true,
    },
    stats: { spit: 92, chub: 44, chaos: 97, luck: 38 },
  },
  {
    id: "radomir",
    name: "РАДОМИР",
    nick: "Нежный хаос",
    builtin: true,
    rarity: "legend",
    quote: "Ой... а можно я не буду драться?",
    look: {
      skin: "#f6d3b0", hair: "#8a6440", hairStyle: 6, eyes: "#4a6a5a",
      brow: 2, facial: 0, glasses: 2, wide: 0.9,
      shirt: "hoodie", shirtColor: "#c86a9a",
    },
    stats: { spit: 22, chub: 30, chaos: 44, luck: 99 },
  },
  {
    id: "kudrya",
    name: "КУДРЯ",
    nick: "Отчисленный дипломат",
    builtin: true,
    rarity: "rare",
    quote: "Я-я тебе помогу, брат... наверное.",
    look: {
      skin: "#d69a6e", hair: "#3d2a1c", hairStyle: 4, eyes: "#3a2a1a",
      brow: 0, facial: 0, glasses: 0, wide: 0.94,
      shirt: "hoodie", shirtColor: "#3d4756",
    },
    stats: { spit: 58, chub: 42, chaos: 76, luck: 55 },
  },
  {
    id: "shitov",
    name: "ШИТОВ АНДРЕЙ",
    nick: "Системный администратор",
    builtin: true,
    rarity: "legend",
    quote: "Кто трогал настройки в тридцать первом кабинете?",
    look: {
      skin: "#e8b48c", hair: "#17131a", hairStyle: 9, eyes: "#3a3340",
      brow: 1, facial: 0, glasses: 2, wide: 1.24,
      shirt: "plain", shirtColor: "#31384a",
    },
    stats: { spit: 66, chub: 58, chaos: 70, luck: 74 },
  },
  {
    id: "artur",
    name: "АРТУР ТИГРАНОВИЧ",
    nick: "Помощник Шитова",
    builtin: true,
    rarity: "epic",
    quote: "Андрей Николаевич занят. Я за него.",
    look: {
      skin: "#dda878", hair: "#16121c", hairStyle: 8, eyes: "#2a2028",
      brow: 1, facial: 1, glasses: 0, wide: 1.0,
      shirt: "mesh", shirtColor: "#c0392b",
    },
    stats: { spit: 61, chub: 47, chaos: 66, luck: 58 },
  },
  {
    id: "kirill",
    name: "КИРИЛЛ",
    nick: "Тихий длинноволосый",
    builtin: true,
    rarity: "rare",
    quote: "Да мне норм, я просто посижу.",
    look: {
      skin: "#f3ddc8", hair: "#14110f", hairStyle: 7, eyes: "#3a3028",
      brow: 0, facial: 0, glasses: 0, wide: 0.82,
      shirt: "hoodie", shirtColor: "#22252e",
    },
    stats: { spit: 44, chub: 18, chaos: 52, luck: 71 },
  },
  {
    id: "stas",
    name: "СТАС",
    nick: "Два метра спокойствия",
    builtin: true,
    rarity: "rare",
    quote: "Я не лысый. Это аэродинамика.",
    look: {
      skin: "#f2d3b4", hair: "#e8dcc0", hairStyle: 9, eyes: "#5b7fa8",
      brow: 0, facial: 0, glasses: 0, wide: 0.9,
      shirt: "plain", shirtColor: "#f0f0f4",
    },
    stats: { spit: 62, chub: 30, chaos: 38, luck: 66 },
  },
  {
    id: "roma",
    name: "РОМА",
    nick: "Улыбка на проводах",
    builtin: true,
    rarity: "rare",
    quote: "Брекеты снимут — вот тогда заживём.",
    look: {
      skin: "#f0cba6", hair: "#3b2a1e", hairStyle: 1, eyes: "#4a3a2e",
      brow: 0, facial: 0, glasses: 0, wide: 1.0, braces: true,
      shirt: "plain", shirtColor: "#c0392b",
    },
    stats: { spit: 58, chub: 46, chaos: 55, luck: 60 },
  },
  {
    id: "anton",
    name: "АНТОН",
    nick: "Рыжий под машинку",
    builtin: true,
    rarity: "rare",
    quote: "Побрился на лето. Лето кончилось.",
    look: {
      skin: "#f7d9bb", hair: "#c85a22", hairStyle: 9, eyes: "#6a8f4a",
      brow: 0, facial: 0, glasses: 0, wide: 0.96,
      shirt: "plain", shirtColor: "#f0f0f4",
    },
    stats: { spit: 66, chub: 34, chaos: 62, luck: 58 },
  },
  {
    id: "kirill_p",
    name: "КИРИЛЛ ПУХЛЫЙ",
    nick: "Второй Кирилл",
    builtin: true,
    rarity: "rare",
    quote: "Нас двое. Я который побольше.",
    look: {
      skin: "#f2cfae", hair: "#1a1512", hairStyle: 1, eyes: "#3a2f26",
      brow: 0, facial: 0, glasses: 0, wide: 1.14,
      shirt: "plain", shirtColor: "#3a3d44",
    },
    stats: { spit: 50, chub: 82, chaos: 44, luck: 62 },
  },
  {
    id: "anton_r",
    name: "АНТОН РОМАНОВ",
    nick: "Разговор окончен",
    builtin: true,
    rarity: "epic",
    quote: "Чё сказал? Повтори, не расслышал.",
    look: {
      skin: "#e6bd97", hair: "#0d0d0f", hairStyle: 9, eyes: "#2a2a2e",
      brow: 1, facial: 0, glasses: 0, wide: 1.04,
      shirt: "hoodie", shirtColor: "#141418",
    },
    stats: { spit: 88, chub: 58, chaos: 96, luck: 30 },
  },
];

/* ============ АКЦЕНТЫ ============ */
export const ACCENTS = [
  // 5 базовых цветов — бесплатны и доступны сразу
  { id: "amber", name: "Янтарь", hex: "#FFB020", price: 0 },
  { id: "violet", name: "Фиолет", hex: "#A77BFF", price: 0 },
  { id: "grey", name: "Графит", hex: "#B4B4C4", price: 0 },
  { id: "red", name: "Красный", hex: "#FF4D4D", price: 0 },
  { id: "yellow", name: "Жёлтый", hex: "#F5DD3C", price: 0 },
  // тема Радомира
  { id: "radomir", name: "Радомир", hex: "#FF9FD6", price: 0 },
  { id: "sky", name: "Небо Радомира", hex: "#8FD3FF", price: 0 },
  // покупные
  { id: "lime", name: "Кислота", hex: "#B6F23C", price: 12000 },
  { id: "cyan", name: "Лёд", hex: "#3EE0E0", price: 12000 },
  { id: "rose", name: "Малина", hex: "#FF4D7E", price: 25000 },
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
  icon: IconName;
}
export const SKILLS: SkillNode[] = [
  { id: "greed", name: "Жадность", desc: "+10% монет за уровень", max: 10, cost: (l) => 1 + l, branch: "coin", icon: "coin" },
  { id: "vault", name: "Хранилище", desc: "+15% офлайн-дохода", max: 8, cost: (l) => 2 + l * 2, branch: "coin", req: "greed", icon: "bank" },
  { id: "midas", name: "Мидас", desc: "+50% монет, но −10% XP", max: 5, cost: (l) => 6 + l * 4, branch: "coin", req: "vault", icon: "crown" },
  { id: "fist", name: "Кулак", desc: "+12% сила тапа", max: 10, cost: (l) => 1 + l, branch: "power", icon: "fist" },
  { id: "engine", name: "Мотор", desc: "+18% автодоход", max: 8, cost: (l) => 2 + l * 2, branch: "power", req: "fist", icon: "gear" },
  { id: "berserk", name: "Берсерк", desc: "Комбо держится дольше на 20%", max: 5, cost: (l) => 5 + l * 3, branch: "power", req: "engine", icon: "fire" },
  { id: "clover", name: "Клевер", desc: "+3% шанс крита", max: 10, cost: (l) => 1 + l, branch: "luck", icon: "clover" },
  { id: "magnet", name: "Магнит", desc: "Бонусы падают на 12% чаще", max: 8, cost: (l) => 2 + l * 2, branch: "luck", req: "clover", icon: "magnet" },
  { id: "fate", name: "Судьба", desc: "+8% редкие карточки из кейсов", max: 5, cost: (l) => 5 + l * 3, branch: "luck", req: "magnet", icon: "dice" },
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
    ["burger", "clicker", "bite", "dino", "radomir", "merge", "whack"].every((g) => s.games[g].plays >= 1)),
  A("skin_5", "Модник", "Купи 5 скинов", "rare", 18000, (s) => s.ownedSkins.length >= 5),
  A("skill_max", "Мастер Навыков", "Прокачай любой навык до максимума", "epic", 100000, (s) =>
    Object.entries(s.skills).some(([k, v]: any) => {
      const n = SKILLS.find((x) => x.id === k);
      return n && v >= n.max;
    })),
  A("bite_first", "Не Кусайся", "Сыграй в «Зубы Артёма»", "common", 500, (s) => s.games.bite.plays >= 1),
  A("bite_60", "Стальные Нервы", "60 очков в «Зубах Артёма»", "rare", 14000, (s) => s.games.bite.best >= 60),
  A("bite_200", "Артём Сдался", "200 очков в «Зубах Артёма»", "epic", 130000, (s) => s.games.bite.best >= 200),
  A("dino_first", "Прогульщик", "Сыграй в «Побег от Шитова»", "common", 500, (s) => s.games.dino.plays >= 1),
  A("dino_1000", "Быстрее Препода", "1 000 метров от Шитова", "rare", 16000, (s) => s.games.dino.best >= 1000),
  A("dino_5000", "Отчислен Заочно", "5 000 метров от Шитова", "legend", 400000, (s) => s.games.dino.best >= 5000),
  A("rad_first", "Фембойчик", "Сыграй в «Ритм Радомира»", "common", 500, (s) => s.games.radomir.plays >= 1),
  A("rad_combo", "Идеальный Слух", "Комбо 40 в «Ритме Радомира»", "rare", 18000, (s) => s.games.radomir.best >= 400),
  A("rad_master", "Танцуй Как Радомир", "1 200 очков в «Ритме Радомира»", "epic", 140000, (s) => s.games.radomir.best >= 1200),
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
  { id: "burger" as const, name: "ЛЁХА-БУРГЕР", tag: "Уклоняйся", desc: "Лёха плюётся бургерами с двух метров. Не поймай ни одного.", unlockLvl: 0, icon: "burger" as IconName },
  { id: "clicker" as const, name: "ЧУБКЛИКЕР", tag: "Фарм", desc: "Тапай по морде. Копи миллиарды. Не спи.", unlockLvl: 0, icon: "tap" as IconName },
  { id: "bite" as const, name: "ЗУБЫ АРТЁМА", tag: "Нервы", desc: "Держи палец и копи. Артём кусается — успей убрать руку.", unlockLvl: 0, icon: "tooth" as IconName },
  { id: "dino" as const, name: "ПОБЕГ ОТ ШИТОВА", tag: "Бег", desc: "Препод бежит за тобой по колледжу. Прыгай через системники.", unlockLvl: 0, icon: "run" as IconName },
  { id: "radomir" as const, name: "РИТМ РАДОМИРА", tag: "Ритм", desc: "Лови ноты под трек. Радомир стесняется, но танцует.", unlockLvl: 0, icon: "music" as IconName },
  { id: "merge" as const, name: "СЛИЯНИЕ ГОЛОВ", tag: "Пазл", desc: "Сливай одинаковых пацанов в новых. 2048 из голов.", unlockLvl: 0, icon: "case" as IconName },
  { id: "whack" as const, name: "ПРИБЕЙ ДРУГА", tag: "Реакция", desc: "Головы лезут из люков. Прибей. Но не всех.", unlockLvl: 0, icon: "hammer" as IconName },
  { id: "stack" as const, name: "БАШНЯ ЛЁХИ", tag: "Точность", desc: "Складывай бургеры в башню. Промахнулся — край срезало.", unlockLvl: 0, icon: "level" as IconName },
  { id: "sort" as const, name: "СТОЛОВКА", tag: "Скорость", desc: "Раздавай подносы по цветам. Очередь не ждёт.", unlockLvl: 0, icon: "target" as IconName },
  { id: "memory" as const, name: "КТО ЭТО БЫЛ", tag: "Память", desc: "Головы мигают по очереди. Повтори порядок.", unlockLvl: 0, icon: "brain" as IconName },
  { id: "flap" as const, name: "ПОЛЁТ РАДОМИРА", tag: "Нервы", desc: "Тапай, чтобы не упасть. Пролетай между партами.", unlockLvl: 0, icon: "rocket" as IconName },
  { id: "defend" as const, name: "ОБОРОНА ОБЩАГИ", tag: "Защита", desc: "Тапай по врагам, пока они не дошли до двери.", unlockLvl: 0, icon: "shield" as IconName },
  { id: "basket" as const, name: "ЧУБУ-БАСКЕТ", tag: "Спорт", desc: "Свайп — бросок. Кольцо ездит, попал чисто — комбо растёт.", unlockLvl: 0, icon: "target" as IconName },
  { id: "volley" as const, name: "ВОЛЕЙБОЛ НА ПАРЕ", tag: "Спорт", desc: "Веди пальцем и отбивай головой. Уронил трижды — конец.", unlockLvl: 0, icon: "medal" as IconName },
  { id: "penalty" as const, name: "ПЕНАЛЬТИ ЗА ГАРАЖАМИ", tag: "Спорт", desc: "Бей свайпом мимо вратаря. Девятка — двойные очки.", unlockLvl: 0, icon: "flag" as IconName },
  { id: "pool" as const, name: "БИЛЬЯРД В ПОДВАЛЕ", tag: "Спорт", desc: "Тяни кий и забивай. Каждый шар возвращает удар.", unlockLvl: 0, icon: "dice" as IconName },
  { id: "crossword" as const, name: "КРОССВОРД БОБКОВОЙ", tag: "Слова", desc: "Убеди Бобкову, что кроссворд твой. Она подозревает.", unlockLvl: 0, icon: "brain" as IconName },
  { id: "bus" as const, name: "АВТОБУС №12", tag: "Квест", desc: "Пробейся к дверям через толпу с бабульками. Шесть остановок.", unlockLvl: 0, icon: "users" as IconName },
  { id: "pet" as const, name: "ЧУБУ-ТАМАГОЧИ", tag: "Уход", desc: "Корми, мой, стирай и сажай на унитаз. Не дай похудеть.", unlockLvl: 0, icon: "heart" as IconName },
  { id: "beard" as const, name: "ОЩИПАТЬ МАКСА", tag: "Терпение", desc: "Борода, грудь, руки. Тяни волосок и не спеши — он злится.", unlockLvl: 0, icon: "sparkle" as IconName },
  { id: "moto" as const, name: "МОТО АРТЁМА", tag: "Гонка", desc: "Держи газ, следи за перегревом. На финише — нитки под шею.", unlockLvl: 0, icon: "speed" as IconName },
  { id: "fuel" as const, name: "ГДЕ БЕНЗИН", tag: "Стратегия", desc: "Объезжай заправки на остатке. В РФ сейчас беда с ним.", unlockLvl: 0, icon: "bolt" as IconName },
  { id: "hands" as const, name: "КИРИЛЛ ХУДОЙ", tag: "Реакция", desc: "Лезет в портфель. Бей по рукам, но свою не задень.", unlockLvl: 0, icon: "fist" as IconName },
  { id: "europa" as const, name: "ЧУБУПА УНИВЕРСАЛИС 4", tag: "Стратегия", desc: "Захвати весь колледж за 30 ходов. Деканат так просто не сдастся.", unlockLvl: 0, icon: "flag" as IconName },
  { id: "chess" as const, name: "ШАХМАТЫ С ШИТОВЫМ", tag: "Настольные", desc: "Полные шахматы против препода. Три уровня, и на третьем он не жалеет.", unlockLvl: 0, icon: "brain" as IconName },
  { id: "checkers" as const, name: "ШАШКИ У СТАСА", tag: "Настольные", desc: "Русские шашки. Бить обязательно, дамка ходит через всю доску.", unlockLvl: 0, icon: "dice" as IconName },
  { id: "nards" as const, name: "НАРДЫ С АРТУРОМ", tag: "Настольные", desc: "Длинные нарды. Артур Тигранович играет в них с детства.", unlockLvl: 0, icon: "clover" as IconName },
];
