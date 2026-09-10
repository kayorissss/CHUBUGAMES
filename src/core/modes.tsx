import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import type { GameId } from "./types";
import { ALL_GAMES } from "./save";
import { today } from "./format";

/* ─────────────────────────── Хранилище режимов ───────────────────────────
   Держим отдельно от основного сейва: не трогаем migrate() и не рискуем
   сломать прогресс, если структура режимов ещё будет меняться.          */

const KEY = "chubgames.modes";

type Store = {
  /** Рекорд марафона (сумма очков за все раунды) */
  marathonBest: number;
  /** Сколько марафонов пройдено до конца */
  marathonRuns: number;
  /** Дата последнего пройденного испытания дня */
  challengeDate: string;
  /** Испытание дня уже засчитано */
  challengeDone: boolean;
  /** Награда за испытание уже забрана */
  challengeClaimed: boolean;
  /** Серия пройденных испытаний подряд */
  challengeStreak: number;
  /** Рекорд «Выживания»: сколько игр пройдено без единого провала */
  survivalBest: number;
  /** Рекорд «Спринта»: очков за две минуты */
  sprintBest: number;
};

const EMPTY: Store = {
  marathonBest: 0,
  marathonRuns: 0,
  challengeDate: "",
  challengeDone: false,
  challengeClaimed: false,
  challengeStreak: 0,
  survivalBest: 0,
  sprintBest: 0,
};

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Store>) };
  } catch {
    return { ...EMPTY };
  }
}

function write(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* приватный режим — просто не сохраняем */
  }
}

/* ──────────────────────────── Испытание дня ────────────────────────────
   Детерминированно по дате: у всех одинаковое задание в один день,
   и оно не меняется при перезапуске приложения.                        */

export type Challenge = {
  game: GameId;
  /** Сколько очков надо набрать за один заход */
  target: number;
  reward: number;
  gems: number;
};

/** Базовая «цена очка» у игр разная — приводим цель к разумной величине. */
const CHALLENGE_TARGET: Record<GameId, number> = {
  burger: 40, clicker: 900, bite: 18, dino: 550, radomir: 320, merge: 700,
  whack: 26, stack: 14, sort: 30, memory: 9, flap: 12, defend: 24,
  basket: 22, volley: 5, penalty: 6, pool: 90,
};

function hash(seed: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function dailyChallenge(date = today()): Challenge {
  const h = hash(`challenge:${date}`);
  const game = ALL_GAMES[h % ALL_GAMES.length];
  // ±20% к базовой цели, чтобы дни отличались
  const swing = 0.8 + ((h >>> 8) % 41) / 100;
  const target = Math.max(1, Math.round(CHALLENGE_TARGET[game] * swing));
  return {
    game,
    target,
    reward: 4000 + ((h >>> 16) % 9) * 500,
    gems: 2,
  };
}

/* ─────────────────────────────── Марафон ───────────────────────────────
   5 случайных игр подряд, счёт суммируется. Выход в меню = сдался.     */

export const MARATHON_ROUNDS = 5;

export type MarathonRun = {
  queue: GameId[];
  /** Индекс текущего раунда, 0..MARATHON_ROUNDS-1 */
  idx: number;
  /** Очки за уже завершённые раунды */
  scores: number[];
  /** Раунд отыгран, ждём нажатия «Дальше» */
  pending: boolean;
  /** Марафон завершён — показываем итог */
  finished: boolean;
};

/**
 * Выживание: игры идут подряд случайным образом, но провал любой из них
 * заканчивает забег. Чем дальше — тем жирнее множитель наград.
 */
export type SurvivalRun = {
  /** Сколько игр уже пройдено */
  cleared: number;
  /** Сумма очков */
  total: number;
  /** Текущая игра */
  game: GameId;
  /** Ждём решения игрока между играми */
  pending: boolean;
  /** Забег окончен */
  finished: boolean;
  /** Последний раунд провален */
  failed: boolean;
};

/** Спринт: одна игра, две минуты, задача — выбить максимум очков */
export type SprintRun = {
  game: GameId;
  /** Когда закончится, мс эпохи */
  endsAt: number;
  score: number;
  finished: boolean;
};

export const SPRINT_MS = 2 * 60 * 1000;

/** Порог, ниже которого раунд выживания считается проваленным */
export function survivalTarget(cleared: number, best: number): number {
  // Цель растёт вместе с серией, но всегда отталкивается от личного рекорда:
  // новичку хватит четверти рекорда, к десятой игре нужно почти повторить его.
  const k = 0.25 + Math.min(cleared, 10) * 0.07;
  return Math.max(1, Math.floor(best * k));
}

/** Множитель наград за длину серии выживания */
export function survivalMult(cleared: number): number {
  // Потолок нужен: цель раунда перестаёт расти после десятой игры, и без
  // ограничения сильный игрок фармил бы бесконечно растущий множитель.
  return 1 + Math.min(cleared, 12) * 0.35;
}

export function marathonQueue(): GameId[] {
  const pool = [...ALL_GAMES];
  const out: GameId[] = [];
  for (let i = 0; i < MARATHON_ROUNDS && pool.length; i++) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

/* ──────────────────────────────── Контекст ──────────────────────────── */

type Ctx = {
  store: Store;
  /** Активный марафон или null */
  run: MarathonRun | null;
  /** Испытание дня на сегодня */
  challenge: Challenge;
  challengeDone: boolean;
  challengeClaimed: boolean;
  challengeStreak: number;

  /** Активное выживание */
  survival: SurvivalRun | null;
  /** Активный спринт */
  sprint: SprintRun | null;

  startMarathon: () => void;
  startSurvival: () => void;
  /** Экран итогов сообщает результат раунда выживания */
  reportSurvival: (score: number) => void;
  /** Следующая игра в выживании */
  nextSurvival: () => void;
  closeSurvival: () => void;
  startSprint: (g: GameId) => void;
  reportSprint: (score: number) => void;
  closeSprint: () => void;
  /** Вызывается экраном итогов игры: записать очки раунда */
  reportRound: (score: number) => void;
  /** Перейти к следующему раунду */
  nextRound: () => void;
  /** Закрыть марафон (сдаться или забрать итог) */
  closeMarathon: () => void;

  /** Игра, открытая прямо сейчас (для испытания дня) */
  currentGame: GameId | null;
  /** Проверить результат игры на испытание дня */
  reportChallenge: (g: GameId, score: number) => boolean;
  claimChallenge: () => void;
};

const ModesCtx = createContext<Ctx | null>(null);

export function ModesProvider({
  children, onSwitchGame, currentGame = null, bestOf,
}: {
  children: React.ReactNode;
  /** Переключить активную мини-игру (null — выйти в меню) */
  onSwitchGame: (g: GameId | null) => void;
  /** Какая мини-игра открыта сейчас */
  currentGame?: GameId | null;
  /** Личный рекорд в игре — нужен «Выживанию», чтобы посчитать цель раунда */
  bestOf: (g: GameId) => number;
}) {
  const [store, setStore] = useState<Store>(() => read());
  const [run, setRun] = useState<MarathonRun | null>(null);
  const [survival, setSurvival] = useState<SurvivalRun | null>(null);
  const [sprint, setSprint] = useState<SprintRun | null>(null);
  const challenge = useMemo(() => dailyChallenge(), []);
  const switchRef = useRef(onSwitchGame);
  switchRef.current = onSwitchGame;
  const bestRef = useRef(bestOf);
  bestRef.current = bestOf;

  // Новый день — сбрасываем отметки испытания
  useEffect(() => {
    const d = today();
    if (store.challengeDate !== d) {
      const next: Store = {
        ...store,
        challengeDate: d,
        challengeDone: false,
        challengeClaimed: false,
      };
      setStore(next);
      write(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback((patch: Partial<Store>) => {
    setStore((prev) => {
      const next = { ...prev, ...patch };
      write(next);
      return next;
    });
  }, []);

  const startMarathon = useCallback(() => {
    const queue = marathonQueue();
    setRun({ queue, idx: 0, scores: [], pending: false, finished: false });
    switchRef.current(queue[0]);
  }, []);

  const reportRound = useCallback((score: number) => {
    setRun((r) => {
      if (!r || r.pending || r.finished) return r;
      const scores = [...r.scores, score];
      const last = r.idx >= r.queue.length - 1;
      if (last) {
        const total = scores.reduce((a, b) => a + b, 0);
        setStore((prev) => {
          const next: Store = {
            ...prev,
            marathonRuns: prev.marathonRuns + 1,
            marathonBest: Math.max(prev.marathonBest, total),
          };
          write(next);
          return next;
        });
      }
      return { ...r, scores, pending: true, finished: last };
    });
  }, []);

  const nextRound = useCallback(() => {
    setRun((r) => {
      if (!r || r.finished) return r;
      const idx = r.idx + 1;
      switchRef.current(r.queue[idx]);
      return { ...r, idx, pending: false };
    });
  }, []);

  const closeMarathon = useCallback(() => {
    setRun(null);
    switchRef.current(null);
  }, []);

  /* ───────────────────────── Выживание ───────────────────────── */

  const pickGame = useCallback((exclude?: GameId): GameId => {
    const pool = ALL_GAMES.filter((g) => g !== exclude);
    return pool[Math.floor(Math.random() * pool.length)];
  }, []);

  const startSurvival = useCallback(() => {
    const g = pickGame();
    setSurvival({ cleared: 0, total: 0, game: g, pending: false, finished: false, failed: false });
    switchRef.current(g);
  }, [pickGame]);

  const reportSurvival = useCallback((score: number) => {
    setSurvival((r) => {
      if (!r || r.pending || r.finished) return r;
      // Цель считаем от личного рекорда в этой игре — она лежит в основном
      // сейве, поэтому берём её через окно, а не через стор режимов.
      const best = bestRef.current(r.game);
      const need = survivalTarget(r.cleared, best);
      const ok = score >= need;
      if (!ok) {
        setStore((prev) => {
          const next: Store = { ...prev, survivalBest: Math.max(prev.survivalBest, r.cleared) };
          write(next);
          return next;
        });
        return { ...r, pending: true, finished: true, failed: true, total: r.total + score };
      }
      return { ...r, pending: true, cleared: r.cleared + 1, total: r.total + score };
    });
  }, []);

  const nextSurvival = useCallback(() => {
    setSurvival((r) => {
      if (!r || r.finished) return r;
      const g = pickGame(r.game);
      switchRef.current(g);
      return { ...r, game: g, pending: false };
    });
  }, [pickGame]);

  const closeSurvival = useCallback(() => {
    setSurvival(null);
    switchRef.current(null);
  }, []);

  /* ────────────────────────── Спринт ────────────────────────── */

  const startSprint = useCallback((g: GameId) => {
    setSprint({ game: g, endsAt: Date.now() + SPRINT_MS, score: 0, finished: false });
    switchRef.current(g);
  }, []);

  const reportSprint = useCallback((score: number) => {
    setSprint((r) => {
      if (!r || r.finished) return r;
      const total = r.score + score;
      const timeUp = Date.now() >= r.endsAt;
      if (timeUp) {
        setStore((prev) => {
          const next: Store = { ...prev, sprintBest: Math.max(prev.sprintBest, total) };
          write(next);
          return next;
        });
        return { ...r, score: total, finished: true };
      }
      // время ещё есть — сразу перезапускаем ту же игру
      switchRef.current(null);
      setTimeout(() => switchRef.current(r.game), 30);
      return { ...r, score: total };
    });
  }, []);

  const closeSprint = useCallback(() => {
    setSprint(null);
    switchRef.current(null);
  }, []);

  const reportChallenge = useCallback(
    (g: GameId, score: number) => {
      if (store.challengeDone) return false;
      if (g !== challenge.game || score < challenge.target) return false;
      save({ challengeDone: true, challengeDate: today() });
      return true;
    },
    [challenge, store.challengeDone, save],
  );

  const claimChallenge = useCallback(() => {
    save({
      challengeClaimed: true,
      challengeStreak: store.challengeStreak + 1,
    });
  }, [save, store.challengeStreak]);

  const value: Ctx = {
    store,
    run,
    challenge,
    challengeDone: store.challengeDone,
    challengeClaimed: store.challengeClaimed,
    challengeStreak: store.challengeStreak,
    currentGame,
    survival,
    sprint,
    startMarathon,
    startSurvival,
    reportSurvival,
    nextSurvival,
    closeSurvival,
    startSprint,
    reportSprint,
    closeSprint,
    reportRound,
    nextRound,
    closeMarathon,
    reportChallenge,
    claimChallenge,
  };

  return <ModesCtx.Provider value={value}>{children}</ModesCtx.Provider>;
}

/** Может вернуть null — режимы доступны только внутри провайдера. */
export function useModes() {
  return useContext(ModesCtx);
}
