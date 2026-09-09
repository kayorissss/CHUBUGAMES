import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import type { GameId, SaveState, Friend } from "./types";
import {
  loadSave, persist, persistNow, freshSave, xpForLevel, xpMult,
  autoRate, offlineRate, offlineCapHours, prestigeGain, spentSkillPoints,
} from "./save";
import {
  ACHIEVEMENTS, ACCENTS, QUEST_POOL, DAILY_LADDER, GAME_META,
  SEASON_XP_PER_TIER, SEASON_TIERS,
} from "./content";
import { today, daysBetween } from "./format";
import { sfx, haptic, setSound, setHaptics } from "./fx";
import { pickQuests } from "./save";
import { makeT } from "./i18n";

export interface Toast {
  id: number;
  title: string;
  sub?: string;
  icon?: string;
  tone?: "normal" | "gold" | "bad";
}

interface Ctx {
  s: SaveState;
  set: (fn: (d: SaveState) => void) => void;
  addCoins: (n: number, opts?: { silent?: boolean }) => void;
  spendCoins: (n: number) => boolean;
  addXp: (n: number) => void;
  bump: (metric: keyof SaveState["stats"], n?: number) => void;
  questProgress: (metric: string, n: number) => void;
  finishGame: (g: GameId, score: number, ms: number) => void;
  toasts: Toast[];
  toast: (t: Omit<Toast, "id">) => void;
  mainFriend: Friend;
  offlineReport: { coins: number; hours: number } | null;
  clearOffline: () => void;
  hardReset: () => void;
  levelPct: number;
  accentHex: string;
  t: (k: string) => string;
  prestigeAvailable: number;
  freePoints: number;
}

const C = createContext<Ctx>(null as any);
export const useGame = () => useContext(C);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<SaveState>(() => loadSave());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [offlineReport, setOfflineReport] = useState<{ coins: number; hours: number } | null>(null);
  const ref = useRef(s);
  ref.current = s;
  const tid = useRef(0);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++tid.current;
    setToasts((p) => [...p.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 3400);
  }, []);

  const set = useCallback((fn: (d: SaveState) => void) => {
    setS((prev) => {
      const next: SaveState = JSON.parse(JSON.stringify(prev));
      fn(next);
      persist(next);
      return next;
    });
  }, []);

  /* --- офлайн-доход + ежедневки при запуске --- */
  useEffect(() => {
    const cur = ref.current;
    const now = Date.now();
    const gapMs = Math.max(0, now - cur.lastSeen);
    const capMs = offlineCapHours(cur) * 3600000;
    const eff = Math.min(gapMs, capMs);
    const rate = offlineRate(cur);
    const earn = Math.floor((eff / 1000) * rate);

    set((d) => {
      d.lastSeen = now;
      d.stats.sessions += 1;
      if (d.daily.questsDate !== today()) {
        d.daily.questsDate = today();
        d.daily.quests = pickQuests(today());
      }
      if (earn > 0) {
        d.coins += earn;
        d.totalCoinsEver += earn;
      }
    });
    if (earn > 100 && gapMs > 120000) {
      setOfflineReport({ coins: earn, hours: eff / 3600000 });
    }
    setSound(cur.settings.sound);
    setHaptics(cur.settings.haptics);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- тик автодохода --- */
  useEffect(() => {
    const iv = setInterval(() => {
      const r = autoRate(ref.current);
      if (r <= 0) return;
      set((d) => {
        d.coins += r;
        d.totalCoinsEver += r;
        d.lastSeen = Date.now();
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [set]);

  /* --- сохранение при уходе в фон --- */
  useEffect(() => {
    const save = () => {
      const d = { ...ref.current, lastSeen: Date.now() };
      persistNow(d);
    };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") save();
    });
    return () => window.removeEventListener("pagehide", save);
  }, []);

  /* --- тема / акцент --- */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", s.settings.theme === "light");
    root.classList.toggle("dark", s.settings.theme === "dark");
    root.classList.toggle("no-fx", !s.settings.fx);
    const acc = ACCENTS.find((a) => a.id === s.settings.accent) || ACCENTS[0];
    root.style.setProperty("--acc", acc.hex);
    root.style.setProperty("--acc-soft", hexA(acc.hex, 0.16));
    root.style.setProperty("--acc-glow", hexA(acc.hex, 0.45));
    root.style.setProperty("--acc-ink", s.settings.accent === "mono" ? "#0b0b0e" : "#12100a");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", s.settings.theme === "light" ? "#ECECED" : "#08080A");
  }, [s.settings.theme, s.settings.accent, s.settings.fx]);

  useEffect(() => setSound(s.settings.sound), [s.settings.sound]);
  useEffect(() => setHaptics(s.settings.haptics), [s.settings.haptics]);

  /* --- проверка ачивок --- */
  const checkAch = useCallback(
    (d: SaveState) => {
      for (const a of ACHIEVEMENTS) {
        if (d.achievements[a.id]) continue;
        let ok = false;
        try {
          ok = a.check(d);
        } catch {
          ok = false;
        }
        if (ok) {
          d.achievements[a.id] = Date.now();
          d.coins += a.reward;
          d.totalCoinsEver += a.reward;
          setTimeout(() => {
            sfx.achieve();
            haptic("success");
            toast({ title: a.name, sub: `Ачивка • +${a.reward.toLocaleString("ru-RU")} 🪙`, icon: "🏆", tone: "gold" });
          }, 260);
        }
      }
    },
    [toast],
  );

  const addCoins = useCallback(
    (n: number) => {
      if (n <= 0) return;
      set((d) => {
        d.coins += n;
        d.totalCoinsEver += n;
        checkAch(d);
      });
    },
    [set, checkAch],
  );

  const spendCoins = useCallback(
    (n: number) => {
      if (ref.current.coins < n) {
        sfx.error();
        haptic("error");
        toast({ title: "Не хватает монет", icon: "🪙", tone: "bad" });
        return false;
      }
      set((d) => {
        d.coins -= n;
      });
      return true;
    },
    [set, toast],
  );

  const addXp = useCallback(
    (n: number) => {
      const amt = Math.max(0, Math.floor(n * xpMult(ref.current)));
      if (amt <= 0) return;
      set((d) => {
        d.xp += amt;
        d.season.xp += amt;
        let leveled = 0;
        while (d.xp >= xpForLevel(d.level)) {
          d.xp -= xpForLevel(d.level);
          d.level += 1;
          leveled++;
          const bonus = d.level * 1200;
          d.coins += bonus;
          d.totalCoinsEver += bonus;
          for (const g of GAME_META) {
            if (d.level >= g.unlockLvl && !d.unlockedGames.includes(g.id)) {
              d.unlockedGames.push(g.id);
              setTimeout(() => toast({ title: "ОТКРЫТА ИГРА", sub: g.name, icon: g.icon, tone: "gold" }), 700);
            }
          }
        }
        if (leveled) {
          setTimeout(() => {
            sfx.levelUp();
            haptic("success");
            toast({ title: `УРОВЕНЬ ${d.level}`, sub: `+${(d.level * 1200).toLocaleString("ru-RU")} 🪙`, icon: "⬆️", tone: "gold" });
          }, 120);
        }
        checkAch(d);
      });
    },
    [set, toast, checkAch],
  );

  const bump = useCallback(
    (metric: keyof SaveState["stats"], n = 1) => {
      set((d) => {
        (d.stats[metric] as number) += n;
        checkAch(d);
      });
    },
    [set, checkAch],
  );

  const questProgress = useCallback(
    (metric: string, n: number) => {
      set((d) => {
        let changed = false;
        for (const q of d.daily.quests) {
          const def = QUEST_POOL.find((x) => x.id === q.id);
          if (!def || def.metric !== metric || q.done) continue;
          q.progress += n;
          if (q.progress >= def.target) {
            q.progress = def.target;
            q.done = true;
            changed = true;
          }
        }
        if (changed) {
          setTimeout(() => {
            sfx.achieve();
            toast({ title: "Задание выполнено", sub: "Забери награду в Прогрессе", icon: "✅" });
          }, 200);
        }
      });
    },
    [set, toast],
  );

  const finishGame = useCallback(
    (g: GameId, score: number, ms: number) => {
      set((d) => {
        const gs = d.games[g];
        gs.plays += 1;
        gs.totalScore += score;
        gs.timeMs += ms;
        const isRecord = score > gs.best;
        if (isRecord) gs.best = score;
        checkAch(d);
        if (isRecord && score > 0) {
          setTimeout(() => {
            sfx.legend();
            toast({ title: "НОВЫЙ РЕКОРД", sub: `${score.toLocaleString("ru-RU")} очков`, icon: "🏅", tone: "gold" });
          }, 400);
        }
      });
      questProgress("plays", 1);
      questProgress("score", score);
    },
    [set, checkAch, toast, questProgress],
  );

  const hardReset = useCallback(() => {
    const f = freshSave();
    persistNow(f);
    setS(f);
    toast({ title: "Прогресс сброшен", icon: "💀", tone: "bad" });
  }, [toast]);

  const mainFriend = useMemo(
    () => s.friends.find((f) => f.id === s.mainFriendId) || s.friends[0],
    [s.friends, s.mainFriendId],
  );

  const t = useMemo(() => makeT(s.settings.lang || "ru"), [s.settings.lang]);

  const accentHex = useMemo(
    () => (ACCENTS.find((a) => a.id === s.settings.accent) || ACCENTS[0]).hex,
    [s.settings.accent],
  );

  const levelPct = useMemo(() => Math.min(1, s.xp / xpForLevel(s.level)), [s.xp, s.level]);
  const prestigeAvailable = useMemo(() => prestigeGain(s), [s]);
  const freePoints = useMemo(() => s.prestigePoints - spentSkillPoints(s), [s]);

  const value: Ctx = {
    s, set, addCoins, spendCoins, addXp, bump, questProgress, finishGame,
    toasts, toast, mainFriend, offlineReport, clearOffline: () => setOfflineReport(null),
    hardReset, levelPct, accentHex, prestigeAvailable, freePoints, t,
  };

  return <C.Provider value={value}>{children}</C.Provider>;
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export { DAILY_LADDER, SEASON_XP_PER_TIER, SEASON_TIERS, daysBetween };
