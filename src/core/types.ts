export type Rarity = "common" | "rare" | "epic" | "legend";

export type GameId =
  | "burger" | "clicker" | "bite" | "dino" | "radomir" | "merge" | "whack"
  | "stack" | "sort" | "memory" | "flap" | "defend";

/**
 * 0 лысый, 1 короткие, 2 шапка волос, 3 ирокез, 4 кудри-облако,
 * 5 кепка, 6 ёжик-разнобой, 7 длинные, 8 штрихкод (прямые пряди),
 * 9 очень короткая стрижка (почти под машинку)
 */
export type HairStyle = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/** 0 нет / 1 щетина / 2 борода / 3 усы / 4 козлиная квадратная */
export type Facial = 0 | 1 | 2 | 3 | 4;

/** 0 нет / 1 круглые / 2 прямоугольные */
export type Glasses = 0 | 1 | 2;

export interface FriendLook {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  eyes: string;
  brow: 0 | 1 | 2; // нейтральные / злые / удивлённые
  facial: Facial;
  glasses: Glasses;
  wide: number; // 0.8..1.25 ширина лица
  /** брекеты на зубах */
  braces?: boolean;
  /** цвет и тип одежды/аксессуара под головой */
  shirt?: "plain" | "mesh" | "suit" | "hoodie";
  shirtColor?: string;
  /** аксессуар в руке/у лица */
  prop?: "none" | "beer" | "clipboard";
  /** мешки под глазами — усталый вид */
  tired?: boolean;
  /** фигура: обычная, широкая-«танк», низкая-пухлая */
  build?: "normal" | "wide" | "short";
}

export interface Friend {
  id: string;
  name: string;
  nick: string;
  look: FriendLook;
  photo?: string; // dataURL, приоритетнее look
  stats: { spit: number; chub: number; chaos: number; luck: number };
  rarity: Rarity;
  quote: string;
  builtin?: boolean;
}

export interface GameStats {
  best: number;
  plays: number;
  totalScore: number;
  timeMs: number;
}

export interface ClickerState {
  tapPower: number; // уровень
  autoLvl: number;
  critLvl: number;
  comboLvl: number;
  offlineLvl: number;
  totalTaps: number;
  earned: number; // всего заработано за престиж
}

export interface SkillTree {
  [nodeId: string]: number; // уровень узла
}

export interface DailyState {
  lastClaim: string; // YYYY-MM-DD
  streak: number;
  quests: { id: string; progress: number; done: boolean; claimed: boolean }[];
  questsDate: string;
}

export interface SeasonState {
  id: number;
  xp: number;
  claimed: number[];
  startedAt: number;
}

export interface Settings {
  theme: "dark" | "light";
  lang: "ru" | "en";
  accent: string;
  sound: boolean;
  haptics: boolean;
  fx: boolean;
  controls: "touchpad" | "buttons";
  difficulty: "chill" | "normal" | "insane";
}

export interface SaveState {
  v: number;
  createdAt: number;
  lastSeen: number;
  coins: number;
  gems: number;
  xp: number;
  level: number;
  prestige: number;
  prestigePoints: number;
  totalCoinsEver: number;
  clicker: ClickerState;
  skills: SkillTree;
  games: Record<GameId, GameStats>;
  friends: Friend[];
  mainFriendId: string;
  heroSkin: string;
  ownedSkins: string[];
  ownedThemes: string[];
  cards: Record<string, number>; // friendId -> count
  achievements: Record<string, number>; // id -> unlockedAt ms
  daily: DailyState;
  season: SeasonState;
  settings: Settings;
  unlockedGames: GameId[];
  stats: {
    burgersDodged: number;
    burgersHit: number;
    tapsTotal: number;
    merges: number;
    whacks: number;
    casesOpened: number;
    sessions: number;
    bites: number;
    metersRun: number;
    notesHit: number;
  };
}
