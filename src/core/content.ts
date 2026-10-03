import type { Friend, Rarity } from "./types";
import type { IconName } from "../ui/Icon";

/* ============ ПЕРСОНАЖИ (основной состав синдиката) ============ */
export const DEFAULT_FRIENDS: Friend[] = [
  {
    id: "lyoha",
    name: "КАЙЗЕР",
    nick: "Шеф ночного гриля · Легенда арены",
    builtin: true,
    rarity: "legend",
    quote: "Держит темп в любой заварушке: пока остальные ищут укрытие, он уже собирает максимальное комбо и забирает банк.",
    look: {
      skin: "#f0c8a4", hair: "#d49b4b", hairStyle: 2, eyes: "#4fa8ff",
      brow: 1, facial: 1, glasses: 0, wide: 1.02,
      shirt: "hoodie", shirtColor: "#5b21b6",
    },
    stats: { spit: 99, chub: 94, chaos: 86, luck: 64 },
  },
  {
    id: "vanya",
    name: "ВЕКТОР",
    nick: "Главный тактик и координатор штаба",
    builtin: true,
    rarity: "legend",
    quote: "Просчитывает три хода вперёд. Любой хаос превращает в чёткую схему, где каждый раунд приносит чистый профит.",
    look: {
      skin: "#eec9a8", hair: "#1e1a28", hairStyle: 1, eyes: "#3ee0e0",
      brow: 0, facial: 0, glasses: 1, wide: 0.98,
      shirt: "suit", shirtColor: "#1f263b", prop: "clipboard",
    },
    stats: { spit: 74, chub: 68, chaos: 55, luck: 92 },
  },
  {
    id: "maks",
    name: "ТИТАН",
    nick: "Тяжёлая броня · Несокрушимый щит",
    builtin: true,
    rarity: "epic",
    quote: "Там, где другие тормозят перед стеной, Титан проходит насквозь. Спокойный, мощный и абсолютно непробиваемый.",
    look: {
      skin: "#ecc29c", hair: "#3d2b1f", hairStyle: 8, eyes: "#f59e0b",
      brow: 1, facial: 2, glasses: 0, wide: 1.05,
      shirt: "hoodie", shirtColor: "#262b3d",
    },
    stats: { spit: 88, chub: 99, chaos: 90, luck: 52 },
  },
  {
    id: "seryoga",
    name: "СПАРК",
    nick: "Импульс скорости · Мастер рывка",
    builtin: true,
    rarity: "epic",
    quote: "Реакция быстрее молнии: срывается с места за долю секунды и вытаскивает победу на последнем миллиметре.",
    look: {
      skin: "#ecc09a", hair: "#2b2038", hairStyle: 3, eyes: "#38bdf8",
      brow: 1, facial: 0, glasses: 2, wide: 0.96,
      shirt: "hoodie", shirtColor: "#1e3a8a",
    },
    stats: { spit: 82, chub: 54, chaos: 95, luck: 72 },
  },
  {
    id: "artyom",
    name: "РЕЙЗЕР",
    nick: "Ночной гонщик · Стальной хват",
    builtin: true,
    rarity: "epic",
    quote: "Живёт на предельных оборотах. Любит риск, скорость и моменты, когда всё решает одно точное движение.",
    look: {
      skin: "#f2cfb0", hair: "#e2c878", hairStyle: 2, eyes: "#60a5fa",
      brow: 1, facial: 0, glasses: 0, wide: 0.99, braces: true,
      shirt: "hoodie", shirtColor: "#181824",
    },
    stats: { spit: 94, chub: 62, chaos: 97, luck: 58 },
  },
  {
    id: "radomir",
    name: "НЕОН",
    nick: "Мастер синтез-ритма · Кибер-бит",
    builtin: true,
    rarity: "legend",
    quote: "Превращает любой раунд в идеальный саундтрек. Ловит волну там, где остальные сбиваются с такта.",
    look: {
      skin: "#f6d5b6", hair: "#a855f7", hairStyle: 6, eyes: "#f472b6",
      brow: 0, facial: 0, glasses: 2, wide: 0.95,
      shirt: "hoodie", shirtColor: "#831843",
    },
    stats: { spit: 64, chub: 52, chaos: 74, luck: 99 },
  },
  {
    id: "kudrya",
    name: "МИРАЖ",
    nick: "Мастер манёвров и дипломатии",
    builtin: true,
    rarity: "rare",
    quote: "Выходит сухим из любой переделки. Умеет договориться, уйти из-под удара и оказаться ровно там, где лежит куш.",
    look: {
      skin: "#dfa67c", hair: "#2d1e18", hairStyle: 4, eyes: "#a78bfa",
      brow: 0, facial: 1, glasses: 0, wide: 0.97,
      shirt: "hoodie", shirtColor: "#312e81",
    },
    stats: { spit: 68, chub: 58, chaos: 80, luck: 76 },
  },
  {
    id: "shitov",
    name: "КОРТЕКС",
    nick: "Главный архитектор сети · Надзор",
    builtin: true,
    rarity: "legend",
    quote: "Держит под контролем все серверы и сектора комплекса. Знает каждый обходной маршрут и не прощает ошибок.",
    look: {
      skin: "#e8ba94", hair: "#161320", hairStyle: 1, eyes: "#818cf8",
      brow: 1, facial: 2, glasses: 1, wide: 1.04,
      shirt: "suit", shirtColor: "#1e1b4b", build: "short",
    },
    stats: { spit: 86, chub: 78, chaos: 84, luck: 82 },
  },
  {
    id: "artur",
    name: "ВАНГАРД",
    nick: "Оперативный куратор · Правая рука штаба",
    builtin: true,
    rarity: "epic",
    quote: "Железная дисциплина и холодный расчёт. Когда он выходит на смену, правила игры меняются мгновенно.",
    look: {
      skin: "#e0ab7e", hair: "#14111a", hairStyle: 8, eyes: "#f43f5e",
      brow: 1, facial: 1, glasses: 0, wide: 1.0,
      shirt: "suit", shirtColor: "#881337",
    },
    stats: { spit: 78, chub: 70, chaos: 76, luck: 68 },
  },
  {
    id: "kirill",
    name: "ФАНТОМ",
    nick: "Тень в ночи · Мастер перехвата",
    builtin: true,
    rarity: "rare",
    quote: "Двигается бесшумно и действует наверняка. Забирает трофеи прямо из-под носа, не оставляя следов.",
    look: {
      skin: "#f2dac4", hair: "#110f18", hairStyle: 7, eyes: "#34d399",
      brow: 0, facial: 0, glasses: 0, wide: 0.94,
      shirt: "hoodie", shirtColor: "#111827",
    },
    stats: { spit: 72, chub: 48, chaos: 78, luck: 86 },
  },
  {
    id: "stas",
    name: "АТЛАС",
    nick: "Хладнокровный страж · Опора команды",
    builtin: true,
    rarity: "rare",
    quote: "Абсолютное спокойствие даже в эпицентре шторма. Никогда не суетится и всегда доводит партию до победы.",
    look: {
      skin: "#f2d3b4", hair: "#cbd5e1", hairStyle: 2, eyes: "#38bdf8",
      brow: 0, facial: 1, glasses: 0, wide: 0.98,
      shirt: "hoodie", shirtColor: "#1e293b",
    },
    stats: { spit: 74, chub: 76, chaos: 52, luck: 75 },
  },
  {
    id: "roma",
    name: "ПУЛЬС",
    nick: "Связной синдиката · Инсайдер",
    builtin: true,
    rarity: "rare",
    quote: "В курсе всех секретов и раскладов до того, как они станут новостями. Всегда знает, где сегодня крупный дроп.",
    look: {
      skin: "#f0cba6", hair: "#3b2518", hairStyle: 1, eyes: "#fb923c",
      brow: 0, facial: 0, glasses: 2, wide: 0.98, braces: true,
      shirt: "hoodie", shirtColor: "#7c2d12",
    },
    stats: { spit: 70, chub: 62, chaos: 68, luck: 80 },
  },
  {
    id: "anton",
    name: "БЛЕЙЗ",
    nick: "Инженер-пиротехник · Огненный темп",
    builtin: true,
    rarity: "rare",
    quote: "Собирает кастомные модули из чего угодно и разгоняет любую систему выше заводского предела.",
    look: {
      skin: "#f5d6b8", hair: "#ea580c", hairStyle: 2, eyes: "#22c55e",
      brow: 1, facial: 0, glasses: 0, wide: 0.97,
      shirt: "hoodie", shirtColor: "#431407",
    },
    stats: { spit: 80, chub: 60, chaos: 82, luck: 70 },
  },
  {
    id: "kirill_p",
    name: "БАСТИОН",
    nick: "Хранитель арсенала · Тяжёлый резерв",
    builtin: true,
    rarity: "rare",
    quote: "Надёжный прикрывающий на любой линии обороны. Держит удар и удваивает запас прочности команды.",
    look: {
      skin: "#f0cca8", hair: "#1f1924", hairStyle: 1, eyes: "#a855f7",
      brow: 1, facial: 2, glasses: 0, wide: 1.04,
      shirt: "hoodie", shirtColor: "#311042",
    },
    stats: { spit: 68, chub: 90, chaos: 64, luck: 72 },
  },
  {
    id: "anton_r",
    name: "РОНИН",
    nick: "Одиночный штурмовик · Решающий удар",
    builtin: true,
    rarity: "epic",
    quote: "Не тратит время на лишние слова: выходит на арену, включает полный фокус и закрывает раунд в свою пользу.",
    look: {
      skin: "#e6bd97", hair: "#0d0d14", hairStyle: 8, eyes: "#ef4444",
      brow: 1, facial: 1, glasses: 2, wide: 1.0,
      shirt: "hoodie", shirtColor: "#18181b",
    },
    stats: { spit: 92, chub: 74, chaos: 96, luck: 66 },
  },
];

/* ============ АКЦЕНТЫ ============ */
export const ACCENTS = [
  // Базовые цвета — бесплатны и доступны сразу. Первым стоит «Фиолет»:
  // с 1.28.0 он задан по умолчанию (просьба пользователя). «Уголёк» — цвет
  // бренда, он вторым; янтарь (#FFB020) на серых поверхностях теряется,
  // поэтому он третьим.
  { id: "violet", name: "Фиолет", hex: "#A77BFF", price: 0 },
  { id: "ember", name: "Уголёк", hex: "#FF7A18", price: 0 },
  { id: "amber", name: "Янтарь", hex: "#FFB020", price: 0 },
  { id: "grey", name: "Графит", hex: "#B4B4C4", price: 0 },
  { id: "red", name: "Красный", hex: "#FF4D4D", price: 0 },
  { id: "yellow", name: "Жёлтый", hex: "#F5DD3C", price: 0 },
  // неоновые темы
  { id: "radomir", name: "Розовый неон", hex: "#FF9FD6", price: 0 },
  { id: "sky", name: "Небесный неон", hex: "#8FD3FF", price: 0 },
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
  { id: "ghost", name: "Призрак", desc: "+8% монет в Burger Rain", price: 300000, rarity: "legend", body: "#cfe8ff", accentPart: "#8fd0ff", hat: 4 },
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
  A("bite_first", "Не Кусайся", "Сыграй в «Стальной капкан»", "common", 500, (s) => s.games.bite.plays >= 1),
  A("bite_60", "Стальные Нервы", "60 очков в «Стальном капкане»", "rare", 14000, (s) => s.games.bite.best >= 60),
  A("bite_200", "Рейзер Сдался", "200 очков в «Стальном капкане»", "epic", 130000, (s) => s.games.bite.best >= 200),
  A("dino_first", "Беглец Сети", "Сыграй в «Побег от Кортекса»", "common", 500, (s) => s.games.dino.plays >= 1),
  A("dino_1000", "Быстрее Надзора", "1 000 метров от Кортекса", "rare", 16000, (s) => s.games.dino.best >= 1000),
  A("dino_5000", "Призрак Сектора", "5 000 метров от Кортекса", "legend", 400000, (s) => s.games.dino.best >= 5000),
  A("rad_first", "Мастер Бита", "Сыграй в «Неоновый ритм»", "common", 500, (s) => s.games.radomir.plays >= 1),
  A("rad_combo", "Идеальный Слух", "Комбо 40 в «Неоновом ритме»", "rare", 18000, (s) => s.games.radomir.best >= 400),
  A("rad_master", "Король Синтвейва", "1 200 очков в «Неоновом ритме»", "epic", 140000, (s) => s.games.radomir.best >= 1200),
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
  { id: "burger" as const, name: "БУРГЕР-ШТОРМ", tag: "Уклоняйся", desc: "Кайзер мечет бургеры на сверхзвуке. Уклоняйся и лови бонусы!", unlockLvl: 0, icon: "burger" as IconName },
  { id: "clicker" as const, name: "ЧУБКЛИКЕР", tag: "Фарм", desc: "Тапай по герою, прокачивай модули и собирай миллиарды монет.", unlockLvl: 0, icon: "tap" as IconName },
  { id: "bite" as const, name: "СТАЛЬНОЙ КАПКАН", tag: "Нервы", desc: "Держи палец и копи множитель. Рейзер атакует — успей убрать руку!", unlockLvl: 0, icon: "tooth" as IconName },
  { id: "dino" as const, name: "ПОБЕГ ОТ КОРТЕКСА", tag: "Бег", desc: "Кортекс преследует тебя по коридорам комплекса. Прыгай через системники!", unlockLvl: 0, icon: "run" as IconName },
  { id: "radomir" as const, name: "НЕОНОВЫЙ РИТМ", tag: "Ритм", desc: "Лови биты под трек. Неон включает максимум драйва на танцполе.", unlockLvl: 0, icon: "music" as IconName },
  { id: "merge" as const, name: "СЛИЯНИЕ ГЕРОЕВ", tag: "Пазл", desc: "Объединяй одинаковых бойцов в новых и дойди до легенды 2048.", unlockLvl: 0, icon: "case" as IconName },
  { id: "whack" as const, name: "ОХОТА ЗА ТЕНЯМИ", tag: "Реакция", desc: "Цели появляются на долю секунды. Бей точно и не задень своих!", unlockLvl: 0, icon: "hammer" as IconName },
  { id: "stack" as const, name: "МЕГА-БАШНЯ", tag: "Точность", desc: "Укладывай ярусы идеально ровно. Промахнулся — край срезало.", unlockLvl: 0, icon: "level" as IconName },
  { id: "cheat" as const, name: "ТИХИЙ ВЗЛОМ", tag: "Нервы", desc: "Пока Кортекс отвернулся — качай данные. Повернулся — замри!", unlockLvl: 0, icon: "brain" as IconName },
  { id: "lift" as const, name: "НОЧНОЙ ЛИФТ", tag: "Логистика", desc: "Развози экипаж по этажам. Перегрузил кабину — сработает тревога.", unlockLvl: 0, icon: "level" as IconName },
  { id: "sort" as const, name: "ЭКСПРЕСС-БАР", tag: "Скорость", desc: "Раздавай заказы по цветам. Очередь не ждёт ни секунды.", unlockLvl: 0, icon: "target" as IconName },
  { id: "memory" as const, name: "КОД ПАМЯТИ", tag: "Память", desc: "Сигналы вспыхивают по очереди. Повтори комбинацию без ошибок.", unlockLvl: 0, icon: "brain" as IconName },
  { id: "flap" as const, name: "НЕОНОВЫЙ ПОЛЁТ", tag: "Нервы", desc: "Держи высоту и пролетай сквозь узкие энергетические шлюзы.", unlockLvl: 0, icon: "rocket" as IconName },
  { id: "defend" as const, name: "ОБОРОНА БАЗЫ", tag: "Защита", desc: "Отбивай волны штурмовиков, пока они не прорвали ворота.", unlockLvl: 0, icon: "shield" as IconName },
  { id: "basket" as const, name: "СТРИТ-БАСКЕТ", tag: "Спорт", desc: "Свайп — бросок. Кольцо двигается, чистые попадания растят комбо.", unlockLvl: 0, icon: "target" as IconName },
  { id: "volley" as const, name: "НЕОН-ВОЛЕЙБОЛ", tag: "Спорт", desc: "Веди и отбивай мяч в воздухе. Три промаха — партия окончена.", unlockLvl: 0, icon: "medal" as IconName },
  { id: "penalty" as const, name: "СЕРИЯ ПЕНАЛЬТИ", tag: "Спорт", desc: "Бей свайпом мимо вратаря. Попадание в девятку — двойные очки.", unlockLvl: 0, icon: "flag" as IconName },
  { id: "pool" as const, name: "НЕОНОВЫЙ БИЛЬЯРД", tag: "Спорт", desc: "Тяни кий и забивай. Каждый точный шар возвращает удар.", unlockLvl: 0, icon: "dice" as IconName },
  { id: "crossword" as const, name: "ШИФР-КРОССВОРД", tag: "Слова", desc: "Разгадай кодовую сетку слов и докажи своё мастерство.", unlockLvl: 0, icon: "brain" as IconName },
  { id: "bus" as const, name: "МАРШРУТ №12", tag: "Квест", desc: "Пробейся к выходу сквозь плотную толпу за шесть остановок.", unlockLvl: 0, icon: "users" as IconName },
  { id: "pet" as const, name: "КИБЕР-ТАМАГОЧИ", tag: "Уход", desc: "Корми, тренируй и следи за настроением своего бойца.", unlockLvl: 0, icon: "heart" as IconName },
  { id: "beard" as const, name: "БАРБЕР-МАСТЕР", tag: "Терпение", desc: "Действуй ювелирно и не спеши — одно резкое движение сорвёт серию.", unlockLvl: 0, icon: "sparkle" as IconName },
  { id: "moto" as const, name: "ТУРБО-БАЙК", tag: "Гонка", desc: "Держи полный газ и следи за перегревом двигателя на трассе.", unlockLvl: 0, icon: "speed" as IconName },
  { id: "fuel" as const, name: "ТОПЛИВНЫЙ РЕЙД", tag: "Стратегия", desc: "Прокладывай маршрут по заправкам на остатке бака.", unlockLvl: 0, icon: "bolt" as IconName },
  { id: "hands" as const, name: "ПЕРЕХВАТ ФАНТОМА", tag: "Реакция", desc: "Чужие руки тянутся к кейсу. Бей по ним, но не задень свою!", unlockLvl: 0, icon: "fist" as IconName },
  { id: "europa" as const, name: "ЧУБУПА УНИВЕРСАЛИС 5", tag: "Стратегия", desc: "5 уровней кампании, сектора со своим гарнизоном, общий штурм и ранг синдиката.", unlockLvl: 0, icon: "flag" as IconName },
  { id: "chess" as const, name: "ШАХМАТЫ С КОРТЕКСОМ", tag: "Настольные", desc: "Полные шахматы против архитектора сети. Три уровня сложности.", unlockLvl: 0, icon: "brain" as IconName },
  { id: "checkers" as const, name: "ШАШКИ С АТЛАСОМ", tag: "Настольные", desc: "Русские шашки: обязательный бой и прорыв в дамки через всю доску.", unlockLvl: 0, icon: "dice" as IconName },
  { id: "nards" as const, name: "НАРДЫ С ВАНГАРДОМ", tag: "Настольные", desc: "Длинные нарды против куратора штаба: тактика, куш и точный расчёт.", unlockLvl: 0, icon: "clover" as IconName },
];

/** Тип одной записи каталога игр (используют плитки, фильтры, экраны) */
export type GameMeta = (typeof GAME_META)[number];
