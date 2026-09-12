import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import type { GameId, SaveState, Friend } from "./types";
import {
  loadSave, persist, persistNow, freshSave, xpForLevel, xpMult,
  autoRate, offlineRate, offlineCapHours, prestigeGain, spentSkillPoints,
} from "./save";
import { isPlaying, onPlaying } from "./play";
import {
  ACHIEVEMENTS, ACCENTS, QUEST_POOL, DAILY_LADDER, GAME_META,
  SEASON_XP_PER_TIER, SEASON_TIERS,
} from "./content";
import { refreshPalette } from "./palette";
import { today, daysBetween } from "./format";
import { sfx, haptic, setSound, setHaptics } from "./fx";
import { pickQuests } from "./save";
import { makeT, setLang, tr } from "./i18n";
import { applyRun, masteryBonus, masteryLevel } from "./mastery";
import {
  readFriendship, writeFriendship, friendLevel, friendBonus, FR_PER_RUN,
} from "./friendship";
import type { IconName } from "../ui/Icon";

export interface Toast {
  id: number;
  title: string;
  sub?: string;
  icon?: IconName;
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
  /** Показать уведомление. Сам СПИСОК тостов живёт в отдельном контексте,
   *  чтобы всплывающее уведомление не перерисовывало всё приложение. */
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

/**
 * Тосты живут в ОТДЕЛЬНОМ контексте.
 *
 * Раньше список тостов лежал в общем значении контекста игры. Из-за
 * этого каждое всплывающее уведомление перерисовывало всех 53
 * подписчиков — включая запущенную мини-игру. Замер показал до 13
 * пропущенных кадров на серии ачивок: ровно тот фриз, который видно
 * глазами, когда «приходит уведомление».
 *
 * Теперь на список тостов подписан только сам компонент Toasts.
 */
interface ToastCtx {
  toasts: Toast[];
  toast: (t: Omit<Toast, "id">) => void;
}
const TC = createContext<ToastCtx>(null as any);
export const useToasts = () => useContext(TC);

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

  /**
   * Копия сейва перед изменением. structuredClone примерно в 10 раз быстрее
   * связки JSON.parse(JSON.stringify(...)) — заметно на тапах в кликере,
   * где сейв копируется на каждое касание. На старых WebView, где его нет,
   * откатываемся на JSON.
   */
  const clone = useCallback((v: SaveState): SaveState => {
    try {
      return structuredClone(v);
    } catch {
      return JSON.parse(JSON.stringify(v)) as SaveState;
    }
  }, []);

  const set = useCallback((fn: (d: SaveState) => void) => {
    setS((prev) => {
      const next = clone(prev);
      fn(next);
      persist(next);
      return next;
    });
  }, [clone]);

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

  /* --- тик автодохода ---
     *
     * Во время игры он не дёргает весь интерфейс каждую секунду: доход
     * капает, но React перерисовывается раз в пять секунд (суммой). На
     * слабом компьютере это буквально лишние пять перерисовок в секунду
     * под канвасом, а деньги всё равно приходят честно — за те же пять
     * секунд.
     */
  useEffect(() => {
    let pend = 0;
    let n = 0;
    const flush = () => {
      if (pend <= 0) return;
      const amount = pend;
      pend = 0;
      set((d) => {
        d.coins += amount;
        d.totalCoinsEver += amount;
        d.lastSeen = Date.now();
      });
    };
    const iv = setInterval(() => {
      const r = autoRate(ref.current);
      if (r <= 0) return;
      pend += r;
      n += 1;
      if (!isPlaying() || n >= 5) {
        n = 0;
        flush();
      }
    }, 1000);
    const off = onPlaying((v) => { if (!v) flush(); });
    document.addEventListener("visibilitychange", flush);
    return () => {
      clearInterval(iv);
      off();
      document.removeEventListener("visibilitychange", flush);
      flush();
    };
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
    root.classList.toggle("graphite", s.settings.theme === "graphite");
    root.classList.toggle("no-fx", !s.settings.fx);
    const acc = ACCENTS.find((a) => a.id === s.settings.accent) || ACCENTS[0];
    root.style.setProperty("--acc", acc.hex);
    root.style.setProperty("--acc-soft", hexA(acc.hex, 0.16));
    root.style.setProperty("--acc-glow", hexA(acc.hex, 0.45));
    root.style.setProperty("--acc-ink", s.settings.accent === "mono" ? "#0b0b0e" : "#12100a");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", s.settings.theme === "light" ? "#ECECED" : "#08080A");
    // Канвас не понимает var(--…) и кеширует цвета — сбрасываем кеш,
    // иначе игры продолжат рисовать прошлой темой.
    refreshPalette();
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
            toast({ title: a.name, sub: `Ачивка · +${a.reward.toLocaleString("ru-RU")}`, icon: "trophy", tone: "gold" });
          }, 260);
        }
      }
    },
    [toast],
  );

  /**
   * Последняя выплата монет — нужна, чтобы начислить бонус мастерства.
   *
   * Награду считает каждая игра сама (27 разных формул), а мастерство
   * знает только finishGame. Дублировать множитель в 27 файлах — верный
   * способ где-нибудь его забыть, поэтому запоминаем сумму последней
   * выплаты: игры вызывают addCoins и сразу finishGame, и там мы
   * доначисляем недостающую часть.
   */
  const lastPay = useRef<{ n: number; t: number }>({ n: 0, t: 0 });

  const addCoins = useCallback(
    (n: number) => {
      if (n <= 0) return;
      lastPay.current = { n, t: Date.now() };
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
        toast({ title: "Не хватает монет", icon: "coin", tone: "bad" });
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
            toast({ title: `УРОВЕНЬ ${d.level}`, sub: `+${(d.level * 1200).toLocaleString("ru-RU")} монет`, icon: "arrowUp", tone: "gold" });
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
            toast({ title: "Задание выполнено", sub: "Забери награду в Прогрессе", icon: "check" });
          }, 200);
        }
      });
    },
    [set, toast],
  );

  const finishGame = useCallback(
    (g: GameId, score: number, ms: number) => {
      set((d) => {
        const before = d.games[g];
        const isRecord = score > before.best;
        const beforeMx = masteryLevel(before.mx || 0);
        /*
         * Статистику считает applyRun: он же ведёт историю последних
         * результатов, дату рекорда и очки мастерства. Раньше здесь
         * руками менялись четыре поля, и добавить пятое означало
         * править каждое место вызова.
         */
        d.games[g] = applyRun(before, score, ms);
        const afterMx = masteryLevel(d.games[g].mx || 0);

        /*
         * Бонус мастерства к монетам. Игра уже выплатила базовую сумму
         * через addCoins мгновением раньше — доначисляем разницу.
         * Окно в 120 мс отсекает случайные совпадения: если игра монет
         * не платила, бонусу неоткуда взяться.
         */
        const frNow = readFriendship().fp[d.mainFriendId] || 0;
        // мастерство игры и дружба с главным другом складываются
        const mult = masteryBonus(before.mx || 0) + friendBonus(frNow) - 1;
        const pay = lastPay.current;
        if (mult > 1 && pay.n > 0 && Date.now() - pay.t < 120) {
          const extra = Math.floor(pay.n * (mult - 1));
          if (extra > 0) {
            d.coins += extra;
            d.totalCoinsEver += extra;
          }
        }
        lastPay.current = { n: 0, t: 0 };

        /*
         * ДРУЖБА с главным другом растёт за каждый забег. Хранится
         * отдельным ключом, поэтому меняем её здесь же, а не через set.
         */
        const fs0 = readFriendship();
        const fid = d.mainFriendId;
        const wasLvl = friendLevel(fs0.fp[fid] || 0);
        const nowFp = (fs0.fp[fid] || 0) + FR_PER_RUN;
        writeFriendship({ ...fs0, fp: { ...fs0.fp, [fid]: nowFp } });
        const newLvl = friendLevel(nowFp);
        if (newLvl > wasLvl) {
          const fname = d.friends.find((f) => f.id === fid)?.name || fid;
          setTimeout(() => {
            sfx.achieve?.();
            toast({
              title: `${tr("ДРУЖБА")} ${newLvl}`,
              sub: `${fname} · +${Math.round((friendBonus(nowFp) - 1) * 100)}% ${tr("монет")}`,
              icon: "heart",
              tone: "gold",
            });
          }, 900);
        }
        checkAch(d);
        if (isRecord && score > 0) {
          setTimeout(() => {
            sfx.legend();
            toast({ title: "НОВЫЙ РЕКОРД", sub: `${score.toLocaleString("ru-RU")} очков`, icon: "medal", tone: "gold" });
          }, 400);
        }
        // Повышение мастерства — отдельный повод для радости
        if (afterMx > beforeMx) {
          setTimeout(() => {
            sfx.levelUp?.();
            toast({
              title: `${tr("МАСТЕРСТВО")} ${afterMx}`,
              sub: `${GAME_META.find((m) => m.id === g)?.name || g} · +${Math.round((masteryBonus(d.games[g].mx || 0) - 1) * 100)}% ${tr("монет")}`,
              icon: "medal",
              tone: "gold",
            });
          }, isRecord ? 1400 : 400);
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
    toast({ title: "Прогресс сброшен", icon: "skull", tone: "bad" });
  }, [toast]);

  const mainFriend = useMemo(
    () => s.friends.find((f) => f.id === s.mainFriendId) || s.friends[0],
    [s.friends, s.mainFriendId],
  );

  // Выставляем язык до отрисовки детей, чтобы tr() внутри них уже вернул
  // строки на нужном языке в этом же кадре, а не на следующем.
  setLang(s.settings.lang || "ru");
  const t = useMemo(() => makeT(s.settings.lang || "ru"), [s.settings.lang]);

  const accentHex = useMemo(
    () => (ACCENTS.find((a) => a.id === s.settings.accent) || ACCENTS[0]).hex,
    [s.settings.accent],
  );

  const levelPct = useMemo(() => Math.min(1, s.xp / xpForLevel(s.level)), [s.xp, s.level]);
  const prestigeAvailable = useMemo(() => prestigeGain(s), [s]);
  const freePoints = useMemo(() => s.prestigePoints - spentSkillPoints(s), [s]);

  const clearOffline = useCallback(() => setOfflineReport(null), []);

  /**
   * Значение контекста обязано быть мемоизированным. Без useMemo объект
   * создавался заново на каждый рендер провайдера, и React считал
   * контекст изменившимся даже когда данные оставались прежними —
   * перерисовывались все подписчики разом.
   */
  const value: Ctx = useMemo(
    () => ({
      s, set, addCoins, spendCoins, addXp, bump, questProgress, finishGame,
      toast, mainFriend, offlineReport, clearOffline,
      hardReset, levelPct, accentHex, prestigeAvailable, freePoints, t,
    }),
    [
      s, set, addCoins, spendCoins, addXp, bump, questProgress, finishGame,
      toast, mainFriend, offlineReport, clearOffline,
      hardReset, levelPct, accentHex, prestigeAvailable, freePoints, t,
    ],
  );

  const toastValue: ToastCtx = useMemo(() => ({ toasts, toast }), [toasts, toast]);

  return (
    <C.Provider value={value}>
      <TC.Provider value={toastValue}>{children}</TC.Provider>
    </C.Provider>
  );
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export { DAILY_LADDER, SEASON_XP_PER_TIER, SEASON_TIERS, daysBetween };
