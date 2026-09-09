import type { SaveState, GameId } from "./types";
import { DEFAULT_FRIENDS, QUEST_POOL, SKILLS } from "./content";
import { today } from "./format";

export const SAVE_KEY = "chubgames.save.v1";
const VERSION = 1;

function emptyGame() {
  return { best: 0, plays: 0, totalScore: 0, timeMs: 0 };
}

export function pickQuests(seed: string) {
  // детерминированно по дате — одни и те же задания весь день
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const pool = [...QUEST_POOL];
  const out: SaveState["daily"]["quests"] = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const idx = h % pool.length;
    out.push({ id: pool[idx].id, progress: 0, done: false, claimed: false });
    pool.splice(idx, 1);
  }
  return out;
}

/** Все мини-игры — открыты сразу, без уровней-замков. */
export const ALL_GAMES: GameId[] = [
  "burger", "clicker", "bite", "dino", "radomir", "merge", "whack",
  "stack", "sort", "memory", "flap", "defend",
];

export function freshSave(): SaveState {
  const now = Date.now();
  return {
    v: VERSION,
    createdAt: now,
    lastSeen: now,
    coins: 250,
    gems: 0,
    xp: 0,
    level: 1,
    prestige: 0,
    prestigePoints: 0,
    totalCoinsEver: 250,
    clicker: { tapPower: 1, autoLvl: 0, critLvl: 0, comboLvl: 0, offlineLvl: 0, totalTaps: 0, earned: 0 },
    skills: {},
    games: {
      burger: emptyGame(), clicker: emptyGame(), bite: emptyGame(),
      dino: emptyGame(), radomir: emptyGame(), merge: emptyGame(), whack: emptyGame(),
      stack: emptyGame(), sort: emptyGame(), memory: emptyGame(),
      flap: emptyGame(), defend: emptyGame(),
    },
    friends: DEFAULT_FRIENDS.map((f) => ({ ...f, look: { ...f.look }, stats: { ...f.stats } })),
    mainFriendId: "lyoha",
    heroSkin: "default",
    ownedSkins: ["default"],
    ownedThemes: ["amber", "violet", "grey", "red", "yellow", "radomir", "sky"],
    cards: { lyoha: 1 },
    achievements: {},
    daily: { lastClaim: "", streak: 0, quests: pickQuests(today()), questsDate: today() },
    season: { id: 1, xp: 0, claimed: [], startedAt: now },
    settings: {
      theme: "dark", lang: "ru", accent: "amber", sound: true, haptics: true,
      fx: true, controls: "touchpad", difficulty: "normal",
    },
    unlockedGames: ALL_GAMES.slice(),
    stats: {
      burgersDodged: 0, burgersHit: 0, tapsTotal: 0, merges: 0,
      whacks: 0, casesOpened: 0, sessions: 0, bites: 0, metersRun: 0, notesHit: 0,
    },
  };
}

export function loadSave(): SaveState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch {
    return freshSave();
  }
}

export function migrate(s: any): SaveState {
  const base = freshSave();
  const out: SaveState = { ...base, ...s };
  out.settings = { ...base.settings, ...(s.settings || {}) };
  out.clicker = { ...base.clicker, ...(s.clicker || {}) };
  out.stats = { ...base.stats, ...(s.stats || {}) };
  out.season = { ...base.season, ...(s.season || {}) };
  out.daily = { ...base.daily, ...(s.daily || {}) };
  out.games = { ...base.games, ...(s.games || {}) };
  ALL_GAMES.forEach((g) => {
    out.games[g] = { ...emptyGame(), ...(out.games[g] || {}) };
  });
  out.skills = s.skills || {};
  out.friends = Array.isArray(s.friends) && s.friends.length ? s.friends : base.friends;
  out.cards = s.cards || base.cards;
  out.achievements = s.achievements || {};
  out.ownedSkins = Array.isArray(s.ownedSkins) && s.ownedSkins.length ? s.ownedSkins : ["default"];
  out.ownedThemes = Array.isArray(s.ownedThemes) && s.ownedThemes.length ? s.ownedThemes : ["amber"];
  // бесплатные темы доступны всем, включая старые сохранения
  for (const free of ["amber", "violet", "grey", "red", "yellow", "radomir", "sky"]) {
    if (!out.ownedThemes.includes(free)) out.ownedThemes.push(free);
  }
  // Все мини-игры доступны сразу — в том числе в старых сохранениях
  out.unlockedGames = ALL_GAMES.slice();
  // Досыпаем новых друзей тем, кто уже играл
  const have = new Set(out.friends.map((f) => f.id));
  for (const f of base.friends) {
    if (!have.has(f.id)) out.friends.push({ ...f, look: { ...f.look }, stats: { ...f.stats } });
  }
  if (!out.friends.some((f) => f.id === out.mainFriendId)) out.mainFriendId = "lyoha";
  out.v = VERSION;
  return out;
}

let writeTimer: number | null = null;
export function persist(s: SaveState) {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    } catch (e) {
      console.warn("save failed", e);
    }
  }, 250);
}

export function persistNow(s: SaveState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

/* ================= ЭКОНОМИКА ================= */

export function skillLvl(s: SaveState, id: string) {
  return s.skills[id] || 0;
}

/**
 * Статы главного босса — не декорация, они реально работают.
 * Каждый стат 0..100 даёт свой бонус:
 *   Меткость      → шанс крита в ЧУБКЛИКЕРЕ (до +8%)
 *   Выносливость  → офлайн-доход, пока приложение закрыто (до +40%)
 *   Безбашенность → монеты за все мини-игры (до +15%)
 *   Удача         → шанс редких бонусов и хороших дропов (до +10%)
 */
export function bossStats(s: SaveState) {
  const f = s.friends.find((x) => x.id === s.mainFriendId) || s.friends[0];
  const st = f?.stats || { spit: 0, chub: 0, chaos: 0, luck: 0 };
  const n = (v: number) => Math.max(0, Math.min(100, v)) / 100;
  return {
    critBonus: n(st.spit) * 0.08,
    offlineBonus: n(st.chub) * 0.4,
    coinBonus: n(st.chaos) * 0.15,
    luckBonus: n(st.luck) * 0.1,
  };
}

export function coinMult(s: SaveState): number {
  let m = 1;
  m *= 1 + 0.1 * skillLvl(s, "greed");
  m *= 1 + 0.5 * skillLvl(s, "midas");
  m *= 1 + 0.12 * s.prestige;
  if (s.heroSkin === "king") m *= 1.05;
  if (s.heroSkin === "gold") m *= 1.15;
  // бонус от коллекции карточек
  const cardBonus = Object.values(s.cards).reduce((a, b) => a + b, 0) * 0.004;
  m *= 1 + cardBonus;
  // бонус от безбашенности главного босса
  m *= 1 + bossStats(s).coinBonus;
  return m;
}

export function xpMult(s: SaveState): number {
  return Math.max(0.4, 1 - 0.1 * skillLvl(s, "midas")) * (1 + 0.05 * s.prestige);
}

export function tapValue(s: SaveState): number {
  const base = 1 + (s.clicker.tapPower - 1) * 1.7 + Math.pow(s.clicker.tapPower, 1.42);
  return base * (1 + 0.12 * skillLvl(s, "fist")) * coinMult(s);
}

export function autoRate(s: SaveState): number {
  if (s.clicker.autoLvl <= 0) return 0;
  const base = Math.pow(s.clicker.autoLvl, 1.55) * 1.1;
  return base * (1 + 0.18 * skillLvl(s, "engine")) * coinMult(s);
}

export function critChance(s: SaveState): number {
  return Math.min(
    0.75,
    s.clicker.critLvl * 0.022 + skillLvl(s, "clover") * 0.03 + bossStats(s).critBonus,
  );
}
export function critMult(s: SaveState): number {
  return 3 + s.clicker.critLvl * 0.28;
}
export function comboWindow(s: SaveState): number {
  return (1100 + s.clicker.comboLvl * 90) * (1 + 0.2 * skillLvl(s, "berserk"));
}
export function comboMax(s: SaveState): number {
  return 1.5 + s.clicker.comboLvl * 0.35;
}
export function offlineCapHours(s: SaveState): number {
  return 2 + s.clicker.offlineLvl * 1.5;
}
export function offlineRate(s: SaveState): number {
  return (
    autoRate(s) *
    (0.35 + 0.05 * s.clicker.offlineLvl) *
    (1 + 0.15 * skillLvl(s, "vault")) *
    (1 + bossStats(s).offlineBonus)
  );
}

export const UPGRADES = [
  { key: "tapPower" as const, name: "Сила тапа", icon: "fist", desc: "Больше монет за каждый тап", base: 60, growth: 1.16 },
  { key: "autoLvl" as const, name: "Автокормилка", icon: "gear", desc: "Друг жрёт сам и приносит монеты", base: 400, growth: 1.19 },
  { key: "critLvl" as const, name: "Криты", icon: "bolt", desc: "Шанс критического тапа", base: 1200, growth: 1.23 },
  { key: "comboLvl" as const, name: "Комбо", icon: "fire", desc: "Множитель за серию тапов", base: 3000, growth: 1.26 },
  { key: "offlineLvl" as const, name: "Холодильник", icon: "snow", desc: "Дольше копит, пока ты спишь", base: 8000, growth: 1.3 },
];

export function upgradeCost(base: number, growth: number, lvl: number) {
  return Math.floor(base * Math.pow(growth, lvl));
}

export function xpForLevel(lvl: number) {
  return Math.floor(140 * Math.pow(lvl, 1.55));
}

export function prestigeGain(s: SaveState): number {
  const p = Math.floor(Math.pow(s.totalCoinsEver / 2.5e6, 0.42));
  return Math.max(0, p - s.prestigePoints - spentSkillPoints(s));
}

export function spentSkillPoints(s: SaveState): number {
  let total = 0;
  for (const node of SKILLS) {
    const lvl = s.skills[node.id] || 0;
    for (let i = 0; i < lvl; i++) total += node.cost(i);
  }
  return total;
}

export function canPrestige(s: SaveState) {
  return s.totalCoinsEver >= 2.5e6;
}
