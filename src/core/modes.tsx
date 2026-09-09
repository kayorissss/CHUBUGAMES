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
};

const EMPTY: Store = {
  marathonBest: 0,
  marathonRuns: 0,
  challengeDate: "",
  challengeDone: false,
  challengeClaimed: false,
  challengeStreak: 0,
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

  startMarathon: () => void;
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
  children, onSwitchGame, currentGame = null,
}: {
  children: React.ReactNode;
  /** Переключить активную мини-игру (null — выйти в меню) */
  onSwitchGame: (g: GameId | null) => void;
  /** Какая мини-игра открыта сейчас */
  currentGame?: GameId | null;
}) {
  const [store, setStore] = useState<Store>(() => read());
  const [run, setRun] = useState<MarathonRun | null>(null);
  const challenge = useMemo(() => dailyChallenge(), []);
  const switchRef = useRef(onSwitchGame);
  switchRef.current = onSwitchGame;

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
    startMarathon,
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
