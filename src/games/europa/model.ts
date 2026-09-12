/**
 * ЧУБУПА УНИВЕРСАЛИС — модель кампании.
 *
 * Здесь только правила: карта, здания, бой, ИИ, ранги. Никакого React и
 * никакого CSS — из-за этого модель можно проверить без браузера
 * (npm run check:perf гоняет её на заглушках) и править баланс, не залазя
 * в отрисовку.
 *
 * Как игра задумана. Ты владеешь общагой и постепенно забираешь колледж:
 * каждое здание даёт своё войско и свой доход, между зданиями есть дороги.
 * За ход можно качать здания, докупать войско,special-действиями ломать
 * соседям оборону — и напасть. Напасть можно СРАЗУ НЕСКОЛЬКИМИ зданиями:
 * они складывают войска в один удар (это и есть «объединиться»), поэтому
 * связка «общага + спортзал» берёт столовую, которую поодиночке не взяла
 * бы. Захватчик оставляет гарнизон в тылу, иначе блицкриг наказывал бы
 * сам себя, а ИИ каждый ход растёт и контратакует — отсиживаться нельзя.
 */

import type { IconName } from "../../ui/Icon";

export type Owner = "me" | "ai" | "ntrl";

export type Kind =
  | "dorm" | "gym" | "canteen" | "library" | "workshop"
  | "hall" | "smoke" | "dean" | "shop" | "guard" | "laundry" | "basement";

/**
 * ЗДАНИЕ = ТИП ВОЙСКА. Раньше все провинции были одинаковыми цифрами, и
 * «что за иконка» было не понять. Теперь у каждого здания свой отряд со
 * своим свойством, и это свойство видно в подсказке и в панели.
 */
export interface KindInfo {
  name: string;
  /** как называются бойцы — под подпись к иконке на карте */
  troop: string;
  icon: IconName;
  /** множители силы (0.1 = +10 %) */
  atk: number;
  def: number;
  /** золота в ход */
  inc: number;
  /** чем полезно, коротко — в легенду и в панель */
  note: string;
  /** спецдействие этого здания (см. special()) */
  action?: "siege" | "agitate" | "sabotage" | "reinforce";
}

export const KIND: Record<Kind, KindInfo> = {
  dorm: {
    name: "ОБЩАГА", troop: "БАРЫГИ", icon: "home", atk: 0.04, def: 0, inc: 3,
    note: "Живут плотно: доход с торговли и никаких потерь в коридоре",
  },
  gym: {
    name: "СПОРТЗАЛ", troop: "КАЧКИ", icon: "hammer", atk: 0.22, def: -0.04, inc: 0,
    note: "+22 % к атаке. Лезут первыми и не умеют обороняться",
    action: "reinforce",
  },
  canteen: {
    name: "СТОЛОВАЯ", troop: "ПОВАРА", icon: "burger", atk: 0, def: 0.05, inc: 6,
    note: "Сытые не разбегаются: больше всех кормит, лечит соседей",
    action: "reinforce",
  },
  library: {
    name: "БИБЛИОТЕКА", troop: "УМНИКИ", icon: "brain", atk: 0.06, def: 0.08, inc: 1,
    note: "Разведка: прогноз боя точный, а не на глаз",
  },
  workshop: {
    name: "МАСТЕРСКИЕ", troop: "СБОРЩИКИ", icon: "gear", atk: 0.12, def: 0.06, inc: 1,
    note: "Осадные телеги: штурм игнорирует стены соседа",
    action: "siege",
  },
  hall: {
    name: "АКТОВЫЙ ЗАЛ", troop: "АГИТАТОРЫ", icon: "music", atk: 0, def: 0.04, inc: 3,
    note: "Слово — оружие: можно переманить соседнее здание на свою сторону",
    action: "agitate",
  },
  smoke: {
    name: "КУРИЛКА", troop: "ДЫМАРИ", icon: "fire", atk: 0.1, def: 0.12, inc: 0,
    note: "Дымовуха: сосед теряет войско ещё до атаки",
    action: "sabotage",
  },
  dean: {
    name: "ДЕКАНАТ", troop: "АДМИНИСТРАЦИЯ", icon: "crown", atk: 0.05, def: 0.26, inc: 8,
    note: "Главная крепость: стены, бумага и печать. Держится до конца",
  },
  shop: {
    name: "ЛАРЁК", troop: "ТОРГОВЦЫ", icon: "coin", atk: -0.02, def: 0.02, inc: 7,
    note: "Всё дешевле: и войско, и стройка",
  },
  guard: {
    name: "ПОСТ ОХРАНЫ", troop: "ДЕЖУРНЫЕ", icon: "shield", atk: 0.02, def: 0.2, inc: 1,
    note: "Спит вполглаза: +20 % к обороне всего этажа",
  },
  laundry: {
    name: "ПРАЧЕЧНАЯ", troop: "СТИРАЛЬЩИКИ", icon: "snow", atk: 0, def: 0.06, inc: 4,
    note: "Чистые руки: стабильный доход, мало шума",
  },
  basement: {
    name: "ПОДВАЛ", troop: "ТОЛКУНЧИКИ", icon: "lock", atk: 0.06, def: 0.14, inc: 0,
    note: "Склад всего на свете: гарнизон помещается больше, чем влезает",
  },
};

export interface Prov {
  id: number;
  name: string;
  kind: Kind;
  x: number; y: number;          // 0..1 на карте
  owner: Owner;
  /** экономика: доход и немного обороны */
  dev: number;
  /** стены: главная оборона */
  wall: number;
  /** казармы: сколько влезает войска и насколько оно дешевле */
  barr: number;
  /** разведка: точность прогноза и шанс в бою */
  intel: number;
  army: number;
  links: number[];
  /** уже наступала в этом ходу */
  moved: boolean;
  /** спецдействие использовано в этом ходу */
  used: boolean;
}

export interface Level {
  id: number;
  name: string;
  sub: string;
  turns: number;
  gold: number;
  /** насколько ИИ сильнее: множитель прироста войска и aggressiveness */
  aiPower: number;
  aiAggro: number;
  /** нейтральные здания: их никто не держит, но они кусаются */
  provs: { name: string; kind: Kind; x: number; y: number; links: number[]; owner?: Owner; army?: number; dev?: number }[];
}

/*
 * Карты рисовались руками, а не генератором: в такой игре важна
 * «читаемость» — дороги не должны пересекаться, а ключевые здания обязаны
 * стоять там, где их ждут (деканат наверху, общага внизу).
 */
export const LEVELS: Level[] = [
  {
    id: 1,
    name: "ПЕРВЫЙ ЭТАЖ",
    sub: "6 дверей, тётка на вахте и один общий коридор",
    turns: 24,
    gold: 52,
    aiPower: 0.65,
    aiAggro: 0.3,
    provs: [
      { name: "ОБЩАГА", kind: "dorm", x: 0.5, y: 0.82, links: [1, 2], owner: "me", army: 8, dev: 2 },
      { name: "КУХНЯ", kind: "canteen", x: 0.16, y: 0.6, links: [0, 3], owner: "ai", army: 3 },
      { name: "СПОРТЗАЛ", kind: "gym", x: 0.84, y: 0.6, links: [0, 4], owner: "ai", army: 3 },
      { name: "КОМНАТА СТУРА", kind: "guard", x: 0.28, y: 0.34, links: [1, 4, 5], owner: "me", army: 5 },
      { name: "КУРИЛКА", kind: "smoke", x: 0.74, y: 0.34, links: [2, 3, 5], owner: "ntrl", army: 4 },
      { name: "ВАХТА", kind: "dean", x: 0.5, y: 0.12, links: [3, 4], owner: "ntrl", army: 8 },
    ],
  },
  {
    id: 2,
    name: "ОБЩАГА",
    sub: "Весь корпус: 8 зданий, деканат на третьем",
    turns: 30,
    gold: 50,
    aiPower: 0.9,
    aiAggro: 0.5,
    provs: [
      { name: "ОБЩАГА", kind: "dorm", x: 0.5, y: 0.8, links: [1, 2, 3], owner: "me", army: 8, dev: 2 },
      { name: "СТОЛОВАЯ", kind: "canteen", x: 0.2, y: 0.64, links: [0, 4, 1] },
      { name: "СПОРТЗАЛ", kind: "gym", x: 0.8, y: 0.64, links: [0, 5, 2] },
      { name: "КУРИЛКА", kind: "smoke", x: 0.5, y: 0.54, links: [0, 4, 5, 6] },
      { name: "БИБЛИОТЕКА", kind: "library", x: 0.18, y: 0.36, links: [1, 3, 6], owner: "me", army: 5, dev: 1 },
      { name: "МАСТЕРСКИЕ", kind: "workshop", x: 0.82, y: 0.36, links: [2, 3, 7] },
      { name: "АКТОВЫЙ ЗАЛ", kind: "hall", x: 0.36, y: 0.18, links: [3, 4, 7] },
      { name: "ДЕКАНАТ", kind: "dean", x: 0.68, y: 0.14, links: [5, 6] },
    ],
  },
  {
    id: 3,
    name: "КАРПУС B",
    sub: "Жилой корпус: ларьки, прачечная и охрана без чувства юмора",
    turns: 30,
    gold: 52,
    aiPower: 1.0,
    aiAggro: 0.62,
    provs: [
      { name: "ОБЩАГА", kind: "dorm", x: 0.5, y: 0.86, links: [1, 2, 3], owner: "me", army: 8, dev: 2 },
      { name: "ЛАРЁК", kind: "shop", x: 0.16, y: 0.72, links: [0, 4], owner: "me", army: 6, dev: 1 },
      { name: "ПРАЧЕЧНАЯ", kind: "laundry", x: 0.84, y: 0.72, links: [0, 5], owner: "me", army: 6, dev: 1 },
      { name: "КУРИЛКА", kind: "smoke", x: 0.5, y: 0.6, links: [0, 4, 5, 6] },
      { name: "ПОСТ ОХРАНЫ", kind: "guard", x: 0.18, y: 0.46, links: [1, 3, 7] },
      { name: "СПОРТЗАЛ", kind: "gym", x: 0.82, y: 0.46, links: [2, 3, 8] },
      { name: "ПОДВАЛ", kind: "basement", x: 0.34, y: 0.3, links: [3, 7, 9] },
      { name: "БИБЛИОТЕКА", kind: "library", x: 0.14, y: 0.18, links: [4, 6, 9] },
      { name: "СТОЛОВАЯ", kind: "canteen", x: 0.86, y: 0.18, links: [5, 8] },
      { name: "ДЕКАНАТ", kind: "dean", x: 0.58, y: 0.1, links: [6, 7, 8] },
    ],
  },
  {
    id: 4,
    name: "ВЕСЬ КОЛЛЕДЖ",
    sub: "12 зданий, три двора, деканат держит центр",
    turns: 32,
    gold: 56,
    aiPower: 1.1,
    aiAggro: 0.75,
    provs: [
      { name: "ОБЩАГА", kind: "dorm", x: 0.5, y: 0.9, links: [1, 2, 3], owner: "me", army: 9, dev: 2 },
      { name: "ДВОР А", kind: "basement", x: 0.2, y: 0.78, links: [0, 4, 5], owner: "me", army: 6, dev: 1 },
      { name: "ДВОР B", kind: "gym", x: 0.8, y: 0.78, links: [0, 6, 7], owner: "me", army: 6, dev: 1 },
      { name: "КУРИЛКА", kind: "smoke", x: 0.5, y: 0.7, links: [0, 5, 6, 8] },
      { name: "ЛАРЁК", kind: "shop", x: 0.1, y: 0.58, links: [1, 8, 9] },
      { name: "СТОЛОВАЯ", kind: "canteen", x: 0.32, y: 0.56, links: [1, 3, 8, 9] },
      { name: "СПОРТЗАЛ", kind: "gym", x: 0.68, y: 0.56, links: [2, 3, 8, 10] },
      { name: "МАСТЕРСКИЕ", kind: "workshop", x: 0.9, y: 0.58, links: [2, 10] },
      { name: "ПОДВАЛ", kind: "basement", x: 0.5, y: 0.5, links: [3, 5, 6, 9, 10, 11] },
      { name: "БИБЛИОТЕКА", kind: "library", x: 0.22, y: 0.36, links: [4, 5, 8, 11] },
      { name: "АКТОВЫЙ ЗАЛ", kind: "hall", x: 0.78, y: 0.36, links: [6, 7, 8, 11] },
      { name: "ДЕКАНАТ", kind: "dean", x: 0.5, y: 0.14, links: [8, 9, 10] },
    ],
  },
  {
    id: 5,
    name: "УНИВЕРСАЛИС",
    sub: "14 зданий, нейтральные банды во дворах, ИИ без тормозов",
    turns: 36,
    gold: 60,
    aiPower: 1.2,
    aiAggro: 0.9,
    provs: [
      { name: "ОБЩАГА", kind: "dorm", x: 0.5, y: 0.92, links: [1, 2, 3], owner: "me", army: 10, dev: 2 },
      { name: "ЛАРЬКИ", kind: "shop", x: 0.16, y: 0.8, links: [0, 4, 5], owner: "me", army: 7, dev: 1 },
      { name: "ПРАЧЕЧНАЯ", kind: "laundry", x: 0.84, y: 0.8, links: [0, 6, 7], owner: "me", army: 7, dev: 1 },
      { name: "КУРИЛКА", kind: "smoke", x: 0.5, y: 0.72, links: [0, 5, 6, 8], owner: "me", army: 6, dev: 1 },
      { name: "ДВОР С ТУЧЕЙ", kind: "basement", x: 0.1, y: 0.6, links: [1, 5, 9], owner: "ntrl", army: 6 },
      { name: "СТОЛОВАЯ", kind: "canteen", x: 0.32, y: 0.56, links: [1, 3, 4, 9, 10] },
      { name: "СПОРТЗАЛ", kind: "gym", x: 0.68, y: 0.56, links: [2, 3, 11, 10] },
      { name: "ГАРАЖ", kind: "workshop", x: 0.9, y: 0.6, links: [2, 11], owner: "ntrl", army: 6 },
      { name: "ПОСТ ОХРАНЫ", kind: "guard", x: 0.5, y: 0.52, links: [3, 10, 12] },
      { name: "ЗАБРОШЕННЫЙ БЛОК", kind: "basement", x: 0.18, y: 0.38, links: [4, 5, 10], owner: "ntrl", army: 8 },
      { name: "БИБЛИОТЕКА", kind: "library", x: 0.38, y: 0.34, links: [5, 6, 8, 9, 12] },
      { name: "АКТОВЫЙ ЗАЛ", kind: "hall", x: 0.7, y: 0.34, links: [6, 7, 12, 13] },
      { name: "МЕДИА-ТОЧКА", kind: "laundry", x: 0.52, y: 0.2, links: [8, 10, 11, 13] },
      { name: "ДЕКАНАТ", kind: "dean", x: 0.8, y: 0.1, links: [11, 12], dev: 3, army: 20 },
    ],
  },
];

/** Иконка «двора» в первой карте не была задумана как отдельный тип */
const KIND_FALLBACK: KindInfo = {
  name: "ДВОР", troop: "ШУСТРЫЕ", icon: "target", atk: 0.04, def: 0.02, inc: 1,
  note: "Пробег между зданиями: +1 атака, если наступать без остановок",
};

export function kindOf(k: Kind): KindInfo {
  return KIND[k] || KIND_FALLBACK;
}

export function freshProvs(lv: Level): Prov[] {
  const raw = lv.provs.map((p, i) => {
    const mine = i === 0;
    const dean = p.kind === "dean";
    return {
      id: i,
      name: p.name,
      kind: p.kind,
      x: p.x, y: p.y,
      owner: p.owner || (mine ? "me" : "ai"),
      dev: p.dev ?? (dean ? 4 : mine ? 2 : 1 + (i % 2)),
      wall: dean ? 3 : mine ? 0 : i % 3 === 0 ? 1 : 0,
      barr: mine ? 1 : 0,
      intel: dean ? 2 : 0,
      army: p.army ?? (mine ? 12 : dean ? 18 : 5 + ((i * 7) % 6)),
      links: [...new Set(p.links.filter((j) => j !== i))],
      moved: false,
      used: false,
    };
  });
  /* Дорога в одну сторону — это баг карты, а не фича: игрок кликает «пойти»,
     а обратно его не пускают. Поэтому связи здесь принудительно симметризуем,
     и можно рисовать уровни быстро, не боясь забыть зеркальную ссылку. */
  for (const p of raw) for (const j of p.links) raw[j]?.links.push(p.id);
  for (const p of raw) p.links = [...new Set(p.links)];
  return raw;
}

/* ──────────────── экономика ──────────────── */

/** казармы решают, сколько войска влезает в здание */
export const CAP_BASE = 14;
export const CAP_PER_BARR = 6;

export function cap(p: Prov): number {
  return CAP_BASE + p.barr * CAP_PER_BARR + (p.kind === "basement" ? 6 : 0);
}

/** доход здания за ход */
export function income(p: Prov): number {
  if (p.owner !== "me") return 0;
  return 6 + p.dev * 9 + kindOf(p.kind).inc;
}

/** скидка ларька: если у тебя есть ларёк, всё вокруг дешевле на 15 % */
export function discount(provs: Prov[], from: Prov): number {
  const shop = provs.some((p) => p.owner === "me" && p.kind === "shop" && p.links.includes(from.id));
  return shop ? 0.85 : 1;
}

export function devCost(p: Prov, provs: Prov[]): number {
  return Math.round((18 + p.dev * 12) * discount(provs, p));
}
export function wallCost(p: Prov, provs: Prov[]): number {
  return Math.round((16 + p.wall * 11) * discount(provs, p));
}
export function barrCost(p: Prov, provs: Prov[]): number {
  return Math.round((22 + p.barr * 14) * discount(provs, p));
}
export function intelCost(p: Prov, provs: Prov[]): number {
  return Math.round((20 + p.intel * 13) * discount(provs, p));
}
export function armyCost(p: Prov, provs: Prov[]): number {
  return Math.max(6, Math.round((14 + p.army * 0.45 - p.barr * 1.5) * discount(provs, p)));
}

/* ──────────────── сила и прогноз ──────────────── */

/** Общая сила выбранных зданий в один удар (по одному бойцу оставляем в тылу) */
export function strikePower(froms: Prov[]): number {
  let sum = 0;
  for (const p of froms) {
    const men = Math.max(0, p.army - 1);
    const k = kindOf(p.kind);
    sum += men * (1 + k.atk + p.dev * 0.05 + p.barr * 0.03 + p.intel * 0.02);
  }
  return sum;
}

/** сила защиты здания (стены учитываются, если их не сломали осадой) */
export function defensePower(t: Prov, wallsBroken: boolean): number {
  const k = kindOf(t.kind);
  const mult = 1 + k.def + t.dev * 0.07 + t.barr * 0.03 + t.intel * 0.01;
  const walls = wallsBroken ? 1 : 1 + t.wall * 0.14;
  return t.army * mult * walls;
}

export interface Verdict {
  /** 0..1 — вероятность взять здание */
  chance: number;
  /** чего ждать: перевес / ровно / опасно / самоубийство */
  tone: "good" | "even" | "bad" | "mad";
  label: string;
  /** ожидаемые свои потери, людьми */
  loss: number;
  /** сколько врага останется, если не повезёт */
  men: number;
}

/**
 * Прогноз боя. Это та самая «опасно или нет»: игрок прямо на чужом здании
 * видит, что его 10 качков против 10 администраторов с развитием 3 — это
 * бойня, а не бой.
 *
 * Логистическая кривая по отношению сил: 1 к 1 → 50 %, перевес в полтора
 * раза → уже около 78 %. Разведка добавляет чуть-чуть (знать местность —
 * это не сила, но помогает), стены без осады режут шанс заметно.
 */
export function verdictFor(froms: Prov[], target: Prov, siegeReady: boolean): Verdict {
  const atk = strikePower(froms);
  const def = defensePower(target, siegeReady);
  const intel = Math.max(...froms.map((p) => p.intel), 0);
  const ratio = (atk * (1 + intel * 0.015)) / Math.max(1, def);
  const chance = 1 / (1 + Math.exp(-Math.log(Math.max(0.02, ratio)) * 1.5));
  const men = froms.reduce((a, p) => a + Math.max(0, p.army - 1), 0);
  const loss = Math.round(men * Math.min(0.92, def / (atk + def)));
  const tone: Verdict["tone"] =
    chance >= 0.78 ? "good" : chance >= 0.55 ? "even" : chance >= 0.33 ? "bad" : "mad";
  const label =
    tone === "good" ? "ПЕРЕВЕС" : tone === "even" ? "РАВНЫЙ БОЙ"
      : tone === "bad" ? "ОПАСНО" : "САМОУБИЙСТВО";
  return { chance, tone, label, loss, men: target.army };
}

/* ──────────────── сам бой ──────────────── */

export interface BattleResult {
  win: boolean;
  atkRoll: number;
  defRoll: number;
  /** потери с обеих сторон, людьми */
  lostMine: number;
  lostTheirs: number;
  /** сколько бойцов всего шло в атаку */
  men: number;
  /** сколько из них вернётся в свои здания (гарнизон + выжившие) */
  keepBack: number;
  /** сколько займёт взятое здание */
  occupy: number;
}

/** доля выживших, которая остаётся в тылу атакующего здания */
const GARRISON = 0.35;

export function fight(froms: Prov[], target: Prov, siegeReady: boolean): BattleResult {
  const atk0 = strikePower(froms);
  const def0 = defensePower(target, siegeReady);
  const atk = atk0 * (0.82 + Math.random() * 0.36);
  const def = def0 * (0.85 + Math.random() * 0.3);
  const win = atk > def;
  const men = froms.reduce((a, p) => a + Math.max(0, p.army - 1), 0);

  if (win) {
    const lostMine = Math.max(1, Math.round(men * Math.min(0.8, def / (atk + def))));
    const surv = Math.max(1, men - lostMine);
    // часть выживших остаётся гарнизоном в тылу: иначе блицкриг
    // обнажал бы свои здания, и игрок наказывался за саму смелость
    const garrison = Math.max(1, Math.round(surv * GARRISON));
    return {
      win: true, atkRoll: atk, defRoll: def,
      lostMine, lostTheirs: target.army,
      men, keepBack: garrison, occupy: Math.max(1, surv - garrison),
    };
  }
  const lostMine = Math.max(1, Math.round(men * 0.55));
  const lostTheirs = Math.max(1, Math.round(target.army * Math.min(0.5, atk / (def0 + 1))));
  return {
    win: false, atkRoll: atk, defRoll: def,
    lostMine, lostTheirs, men, keepBack: Math.max(0, men - lostMine), occupy: 0,
  };
}

/**
 * Кого можно подкутить дымарями: соседний враг, который стоит на дороге.
 * Отдельно потому, что «выбрать жертву саботажа» — это правило, а не
 * интерфейс: его же показывает подсказка в панели.
 */
export function sabotageable(provs: Prov[], from: Prov): Prov | undefined {
  return from.links
    .map((id) => provs.find((p) => p.id === id)!)
    .filter((p) => p && p.owner !== "me" && p.army > 1)
    .sort((a, b) => a.army - b.army)[0];
}

/* ──────────────── ИИ ──────────────── */

export interface AiMove {
  from: number;
  to: number;
  win: boolean;
  /** сколько зданий ИИ бросило в удар — для журнала и для «он умеет так же» */
  many: number;
}

/**
 * Применяет итог боя к карте: потери делятся между отрядами по доле
 * выживших, победитель вводит гарнизон. Одна функция для игрока и для ИИ —
 * иначе «честность» превращается в «противник играет по другой таблице».
 */
export function applyBattleResult(
  provs: Prov[], fromIds: number[], targetId: number, res: BattleResult,
): number | null {
  const byId = new Map(provs.map((p) => [p.id, p]));
  const share = res.men > 0 ? res.keepBack / res.men : 1;
  for (const id of fromIds) {
    const p = byId.get(id);
    if (!p) continue;
    p.army = 1 + Math.round(Math.max(0, p.army - 1) * share);
    p.moved = true;
  }
  if (!res.win) return null;
  const target = byId.get(targetId);
  if (!target) return null;
  target.owner = "me";
  target.army = Math.max(1, res.occupy);
  target.used = false;
  target.moved = true;
  // стены при захвате всегда достаются победителю помятые: иначе «максимальные
  // стены» означали бы бессмертное здание
  target.wall = Math.max(0, target.wall - 1);
  return target.army;
}

/**
 * Ход ИИ: доход, стройка на границе, дымари и НАСТОЯЩАЯ атака несколькими
 * зданиями — теми же правилами, что и у игрока. Нейтралы не ходят: они сидят
 * и кусаются, зато их можно переманить или добить дешёвой ценой.
 */
export function aiTurn(provs: Prov[], powerMul: number, aggro: number): AiMove | null {
  const byId = new Map(provs.map((p) => [p.id, p]));
  const at = (id: number) => byId.get(id)!;
  const aiProvs = provs.filter((p) => p.owner === "ai");
  if (!aiProvs.length) return null;
  let last: AiMove | null = null;

  /* 1 · экономика: та же формула дохода, что у игрока, только умноженная на
       «силу уровня» — на финале противник богаче, и это видно по темпам */
  let gold = 0;
  for (const p of aiProvs) gold += (6 + p.dev * 9 + KIND[p.kind].inc) * powerMul;

  /* 2 · стройка: на границе — люди и стены, в тылу — развитие и казармы */
  for (const p of aiProvs) {
    const border = p.links.some((id) => at(id).owner !== "ai");
    for (;;) {
      const c = armyCost(p, provs);
      if (p.army >= cap(p) || gold < c) break;
      p.army += 1; gold -= c;
    }
    for (;;) {
      const c = wallCost(p, provs);
      if (!border || p.wall >= 5 || gold < c * 1.5) break;
      p.wall += 1; gold -= c;
    }
    for (;;) {
      const c = devCost(p, provs);
      if (p.dev >= 6 || gold < c * 2.5) break;
      p.dev += 1; gold -= c;
    }
    for (;;) {
      const c = barrCost(p, provs);
      if (p.barr >= 3 || gold < c * 4) break;
      p.barr += 1; gold -= c;
    }
  }

  /* 3 · дымари портят войско самого сильного соседa игрока */
  if (Math.random() < 0.55 * aggro) {
    let hit: Prov | null = null;
    let smoker: Prov | null = null;
    for (const p of aiProvs) {
      if (p.kind !== "smoke" || p.used || p.army < 4) continue;
      smoker = p;
      for (const id of p.links) {
        const q = at(id);
        if (q.owner !== "me") continue;
        if (!hit || q.army > hit.army) hit = q;
      }
    }
    if (hit && smoker) {
      hit.army = Math.max(1, hit.army - Math.max(1, Math.round(hit.army * 0.1)));
      smoker.used = true;
    }
  }

  /* 4 · удар: ИИ выбирает цель и собирает на неё ВСЕ свои соседние здания —
       ровно как игрок. Частные атака по одному — это не стратегия, а размен. */
  const siege = aiProvs.some((p) => p.kind === "workshop" && p.dev >= 2);
  const need = 0.66 - 0.14 * aggro;
  for (const src of aiProvs.slice().sort((a, b) => b.army - a.army)) {
    if (src.used || src.moved || src.army <= 2) continue;
    let best: { t: Prov; froms: Prov[]; chance: number } | null = null;
    for (const id of src.links) {
      const t = at(id);
      if (t.owner === "ai" || t.used) continue;
      const froms: Prov[] = [src];
      for (const nid of t.links) {
        const q = at(nid);
        if (q && q.owner === "ai" && !q.used && q.army > 1 && q.id !== src.id) froms.push(q);
      }
      const chance = verdictFor(froms, t, siege).chance;
      if (chance > (best ? best.chance : 0)) best = { t, froms, chance };
    }
    if (!best || best.chance < need) continue;
    const res = fight(best.froms, best.t, siege);
    const share = res.men > 0 ? res.keepBack / res.men : 1;
    for (const f of best.froms) {
      f.army = 1 + Math.round(Math.max(0, f.army - 1) * share);
      f.used = true;
      f.moved = true;
    }
    if (res.win) {
      best.t.owner = "ai";
      best.t.army = Math.max(1, res.occupy);
      best.t.used = true;
    } else {
      best.t.army = Math.max(1, best.t.army - res.lostTheirs);
    }
    best.t.moved = true;
    last = { from: src.id, to: best.t.id, win: res.win, many: best.froms.length };
  }
  return last;
}

/* ──────────────── ранги ──────────────── */

export interface Rank {
  name: string;
  /** сколько славы нужно */
  at: number;
  icon: IconName;
}

/**
 * Слава капает за всё: взятые здания, победоносные ходы, захваченные
 * уровни. Ранг — это то, зачем возвращаться: «Барон столовой» звучит.
 */
export const RANKS: Rank[] = [
  { name: "ШНЫРЬ", at: 0, icon: "user" },
  { name: "ПАЦАН С ЭТАЖА", at: 400, icon: "home" },
  { name: "СМОТРЯЩИЙ ОБЩАГИ", at: 1200, icon: "shield" },
  { name: "АВТОРИТЕТ КОРПУСА", at: 2600, icon: "bolt" },
  { name: "БАРОН СТОЛОВОЙ", at: 4800, icon: "burger" },
  { name: "КРЁСТНЫЙ КАРПУСА", at: 8000, icon: "case" },
  { name: "ХОЗЯИН КОЛЛЕДЖА", at: 13000, icon: "star" },
  { name: "ЧУБУПА УНИВЕРСАЛИС", at: 20000, icon: "crown" },
];

export function rankOf(glory: number): { rank: Rank; next?: Rank; left: number } {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (glory >= RANKS[i].at) idx = i;
  const rank = RANKS[idx];
  const next = RANKS[idx + 1];
  return { rank, next, left: next ? Math.max(0, next.at - glory) : 0 };
}

/** сколько славы даёт исход партии */
export function gloryFor(provsTaken: number, turns: number, victory: boolean, level: number): number {
  return Math.round(provsTaken * 40 + (victory ? 260 + level * 90 : 0) + Math.max(0, 12 - turns) * 6);
}
