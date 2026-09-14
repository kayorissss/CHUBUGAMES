import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useGame } from "../core/store";
import { tr } from "../core/i18n";
import { drawHead } from "../core/head";
import { useCanvas, GameHUD, GameOver, Countdown, HudStat } from "./shell";
import { haptic, sfx } from "../core/fx";
import { startBeat, stopBeat } from "../core/music";
import {
  clearTrack, decode, detectOnsets, loadTrack, playTrack, saveTrack, stopTrack,
  type Onset,
} from "../core/track";
import Icon from "../ui/Icon";
import GameIntro, { IntroGroup } from "../ui/GameIntro";

/**
 * РИТМ РАДОМИРА.
 *
 * Играет либо встроенный синтезированный бит, либо трек, который
 * пользователь сам загрузил с телефона (например «Фембойчик» — onokami).
 * Для загруженного трека ноты расставляются анализом самой музыки.
 *
 * Ноты бывают обычные (тап) и длинные (держать) — длинные строятся из
 * плотных серий ударов в одной полосе.
 */

/**
 * Треки, которые лежат В ПРИЛОЖЕНИИ и работают офлайн. По просьбе добавлены
 * вторым «Move Your Body» (Eiffel 65) — файлы кладутся в public/, откуда
 * попадают и в APK, и в desktop-сборку.
 *
 * Если файла в конкретной сборке нет (например, веб-версия собирается одним
 * HTML), трек просто не предлагается: игра откатывается на синтезированный
 * бит вместо чёрного экрана — проверка на res.ok тут не косметика.
 */
export const BEAT_TRACKS: { id: string; src: string; title: string; artist: string }[] = [
  { id: "femboichik", src: "femboichik.mp3", title: "Фембойчик", artist: "onokami" },
  {
    id: "eiffel",
    src: "Eiffel_65_-_Move_Your_Body_Golden_Remixes_80920129.mp3",
    title: "Move Your Body",
    artist: "Eiffel 65 · Golden Remixes",
  },
];

/**
 * УРОВНИ РИТМА. Просьба: «добавить уровней».
 *
 * Уровень — это не «просто быстрее»: он решает, сколько нот успевает
 * влезть в трек (минимальный шаг между онсетами), сколько длинных нот
 * можно держать одновременно, сколько жизней дают и во сколько раз
 * вырастает награда. Шаг 210 мс — это уже две руки впритык, поэтому
 * «БЕЗ РИТМА» жизни жрёт быстро.
 */
export const BEAT_LEVELS: { name: string; gap: number; hold: number; lives: number; mult: number }[] = [
  { name: "НОВИЧОК", gap: 460, hold: 1, lives: 6, mult: 1 },
  { name: "В РИТМЕ", gap: 340, hold: 1, lives: 5, mult: 1.25 },
  { name: "РАЗОГРЕВ", gap: 260, hold: 2, lives: 4, mult: 1.55 },
  { name: "БЕЗ РИТМА", gap: 210, hold: 2, lives: 3, mult: 2 },
];

const LV_KEY = "chubgames.beat.level";
const TRACK_KEY = "chubgames.beat.track";

/** Уровень → старый селектор чарта: чтобы настройки игры оставались в силе. */
function diffOf(lv: number): "chill" | "normal" | "insane" {
  return BEAT_LEVELS[lv].gap >= 440 ? "chill" : BEAT_LEVELS[lv].gap >= 300 ? "normal" : "insane";
}

/** Запомнить выбор: играют-то с телефона, по нескольку раз за вечер. */
function readNum(key: string, def: number, max: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    if (Number.isFinite(v) && v >= 0 && v < max) return Math.floor(v);
  } catch { /* приватный режим */ }
  return def;
}
function writeNum(key: string, v: number) {
  try { localStorage.setItem(key, String(v)); } catch { /* приватный режим */ }
}

type Phase = "menu" | "count" | "play" | "over";

interface Note {
  lane: 0 | 1 | 2;
  t: number; // мс, когда нота должна быть на линии
  hold: number; // длительность удержания в мс (0 — обычный тап)
  hit: boolean;
  missed: boolean;
  holding: boolean; // сейчас зажата
  holdOk: number; // сколько мс удержано
  done: boolean; // длинная нота завершена
}

const LANES = 3;
/** Сколько нота летит сверху вниз. Больше = больше времени среагировать. */
const FALL_MS = 2100;
/** Окна попадания. Расширены: играем большим пальцем на ходу, а не на клавиатуре. */
const PERFECT = 130;
const GOOD = 250;

/**
 * Встроенный чарт под синтезированный бит (124 BPM).
 *
 * Играют одним-двумя пальцами на телефоне, поэтому:
 *  - ноты идут по целым долям (а не по восьмым) — минимум 484 мс между ними;
 *  - аккорды (две ноты разом) только на адском уровне;
 *  - плотность растёт плавно и зависит от выбранной сложности.
 */
function builtinChart(diff: "chill" | "normal" | "insane", seed = 1): Note[] {
  const notes: Note[] = [];
  const beat = 60000 / 124;
  // шаг между возможными нотами: на чилле реже, на адском чаще
  const step = diff === "insane" ? beat / 2 : beat;

  /**
   * Заход генерируется от seed, поэтому каждый раз рисунок нот другой.
   *
   * Пользователь: «уровни должны меняться каждый раз, а то однотипные
   * ноты». Раньше полоса считалась формулой (i*7 + bar*3) % 3 — она
   * детерминированная, и партия была БУКВАЛЬНО одна и та же всегда.
   * Простой ГПСЧ (xorshift) даёт разный рисунок при том же ритме.
   */
  let rnd = (seed * 2654435761) >>> 0;
  const rand = () => {
    rnd ^= rnd << 13; rnd >>>= 0;
    rnd ^= rnd >> 17;
    rnd ^= rnd << 5; rnd >>>= 0;
    return rnd / 4294967296;
  };
  /** каждые 4 такта — свой рисунок: лесенка, качели или разброс */
  const figures = ["stair", "swing", "spread"] as const;

  let t = 2000;
  let i = 0;
  let lastLane = -1;
  while (t < 95000) {
    const bar = Math.floor(i / 8);
    const dMax = diff === "chill" ? 3 : diff === "insane" ? 5 : 4;
    const density = Math.min(dMax, bar < 4 ? 2 : bar < 10 ? 3 : bar < 18 ? 4 : 5);
    if (i % 8 < density) {
      const fig = figures[Math.floor(rand() * figures.length + bar / 4) % figures.length];
      let lane: 0 | 1 | 2;
      if (fig === "stair") lane = ((i + bar) % LANES) as 0 | 1 | 2;
      else if (fig === "swing") lane = ((i % 2 === 0 ? 0 : 2 - (bar % 2))) as 0 | 1 | 2;
      else {
        // разброс, но не две одинаковые полосы подряд
        let l = Math.floor(rand() * LANES);
        if (l === lastLane) l = (l + 1 + Math.floor(rand() * (LANES - 1))) % LANES;
        lane = l as 0 | 1 | 2;
      }
      lastLane = lane;
      // длинная нота пореже, чтобы не сбивать ритм
      const hold = bar >= 6 && i % 32 === 0 ? beat * 2 : 0;
      notes.push({ lane, t, hold, hit: false, missed: false, holding: false, holdOk: 0, done: false });
      // аккорд на два пальца — только для тех, кто сам выбрал адский
      if (diff === "insane" && bar >= 12 && i % 16 === 0) {
        notes.push({
          lane: ((lane + 2) % LANES) as 0 | 1 | 2, t, hold: 0,
          hit: false, missed: false, holding: false, holdOk: 0, done: false,
        });
      }
    }
    t += step;
    i += 1;
  }
  return notes;
}

/**
 * Чарт из онсетов реального трека.
 *
 * Плотность берётся ВПРЯМУЮ из уровня (шаг нот и лимит одновременных
 * длинных), а не из трёхпозиционной «сложности игры»: иначе «РАЗОГРЕВ» и
 * «БЕЗ РИТМА» давали бы один и тот же чарт, и четвёртая ступень была бы
 * фиктивной.
 */
function chartFromOnsets(ons: Onset[], lv = 1): Note[] {
  const notes: Note[] = [];
  const L = BEAT_LEVELS[Math.max(0, Math.min(BEAT_LEVELS.length - 1, lv - 1))];
  // Минимальный промежуток между нотами: пальцем быстрее просто не успеть
  const minGap = L.gap;
  /**
   * Сколько полос разрешено держать ОДНОВРЕМЕННО.
   *
   * Пользователь: «три зажима одновременно, а тебе чо паук чтоль».
   * Проверка старого генератора это подтвердила: длинные ноты
   * накладывались друг на друга и в пике требовалось держать три
   * полосы разом. Причём каждая по отдельности выглядела законной —
   * ограничения на пересечение просто не было.
   *
   * Телефон держат одной-двумя руками, поэтому: 1 палец на чилле,
   * 2 на остальных. Нота, которая не влезает в лимит, становится
   * обычной, а не длинной.
   */
  const maxHold = L.hold;
  let lastT = -9999;
  for (let i = 0; i < ons.length; i++) {
    const o = ons[i];
    if (o.t - lastT < minGap) continue;
    lastT = o.t;
    // длинная нота: если в этой же полосе дальше пауза > 700 мс, а удар сильный
    const nextSame = ons.find((x, j) => j > i && x.band === o.band);
    const gapMs = nextSame ? nextSame.t - o.t : 9999;
    let hold = o.strength > 0.72 && gapMs > 900 ? Math.min(1400, gapMs - 400) : 0;

    if (hold > 0) {
      // сколько длинных нот ещё звучит в этот момент
      const busy = notes.filter((n) => n.hold > 0 && n.t <= o.t && n.t + n.hold >= o.t).length;
      if (busy >= maxHold) hold = 0;
    }

    notes.push({
      lane: o.band, t: o.t, hold,
      hit: false, missed: false, holding: false, holdOk: 0, done: false,
    });
  }
  return notes;
}

export default function RadomirBeat({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, bump, finishGame, questProgress, toast } = useGame();
  const radomir = s.friends.find((f) => f.id === "radomir") || s.friends[0];

  const [phase, setPhase] = useState<Phase>("menu");
  /* Выбранные уровень и трек живут в localStorage: ритм обычно играют
     заходом на вечер, и каждый раз выставлять руками — издевательство. */
  const [lv, setLv] = useState(() =>
    readNum(LV_KEY, s.settings.difficulty === "chill" ? 0 : s.settings.difficulty === "insane" ? 3 : 1, BEAT_LEVELS.length),
  );
  const [trackId, setTrackId] = useState<string>(() => {
    try { return localStorage.getItem(TRACK_KEY) || BEAT_TRACKS[0].id; } catch { return BEAT_TRACKS[0].id; }
  });
  const [cd, setCd] = useState(3);
  const [uiScore, setUiScore] = useState(0);
  const [uiCombo, setUiCombo] = useState(0);
  const [uiLives, setUiLives] = useState(5);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  // пользовательский трек
  const [trackName, setTrackName] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  /** Играет встроенный «Фембойчик» (свой трек не загружен) */
  const [builtinReady, setBuiltinReady] = useState(false);
  const audioBuf = useRef<AudioBuffer | null>(null);
  /*
   * Онсеты выбранного трека держим отдельно: буфер дороги́й (скачать и
   * декодировать 5-8 МБ на телефоне — это секунда), а чарт из тех же онсетов
   * пересобирается на смену уровня за миллисекунды. Без этого каждый выбор
   * уровня заново грузил трек.
   */
  const onsetsRef = useRef<ReturnType<typeof detectOnsets> | null>(null);
  const chartRef = useRef<Note[] | null>(null);
  const clockRef = useRef<(() => number) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const G = useRef({
    running: false,
    notes: [] as Note[],
    time: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    lives: 5,
    hits: 0,
    perfect: 0,
    flash: [0, 0, 0],
    held: [false, false, false],
    pops: [] as { lane: number; txt: string; c: string; life: number }[],
    bob: 0,
    shake: 0,
    endAt: 0,
  });

  /* ---------- загрузка трека ----------
     Сначала пробуем свой (из IndexedDB), иначе — встроенный «Фембойчик»,
     который лежит в приложении и работает офлайн.                        */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const st = await loadTrack();

      /* Свой файл используется, только когда его явно выбрали: иначе
         загруженный однажды трек вечным «по умолчанию» перебивал бы встроенные. */
      if (st && trackId === "own") {
        setTrackName(st.name);
        try {
          const buf = await decode(st.data);
          if (!alive) return;
          audioBuf.current = buf;
          onsetsRef.current = detectOnsets(buf);
          chartRef.current = chartFromOnsets(onsetsRef.current, lv);
        } catch {
          setLoadErr("Файл не читается, загрузи заново");
        }
        return;
      }

      // Трек из приложения. Нет файла — остаётся синтезированный бит.
      const track = BEAT_TRACKS.find((t) => t.id === trackId);
      if (!track) {
        if (alive) setAnalyzing(false);
        return;
      }
      setAnalyzing(true);
      try {
        const res = await fetch(track.src);
        if (!res.ok) throw new Error("нет файла");
        const data = await res.arrayBuffer();
        const buf = await decode(data);
        if (!alive) return;
        const ons = detectOnsets(buf);
        if (ons.length >= 12) {
          audioBuf.current = buf;
          onsetsRef.current = ons;
          chartRef.current = chartFromOnsets(ons, lv);
          setBuiltinReady(true);
        } else {
          setLoadErr("В этом треке не нашлось ритма — играй на синтезированном бите");
        }
      } catch {
        /* файла нет в сборке: молча остаёмся на синтезированном бите */
      }
      if (alive) setAnalyzing(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  /*
   * СМЕНА УРОВНЯ ТРЕК НЕ ПЕРЕЗАПУСКАЕТ. Буфер и онсеты уже в памяти —
   * заново строится только чарт (это дёшево), а audioBuf остаётся тот же.
   */
  useEffect(() => {
    const ons = onsetsRef.current;
    if (!ons || !audioBuf.current) return;
    chartRef.current = chartFromOnsets(ons, lv);
  }, [lv]);

  const pickFile = async (f: File) => {
    setAnalyzing(true);
    setLoadErr(null);
    try {
      const data = await f.arrayBuffer();
      const buf = await decode(data);
      const ons = detectOnsets(buf);
      if (ons.length < 12) {
        setLoadErr("В треке не нашлось ритма. Попробуй другой файл.");
        setAnalyzing(false);
        return;
      }
      audioBuf.current = buf;
      onsetsRef.current = ons;
      chartRef.current = chartFromOnsets(ons, lv);
      await saveTrack(f.name, data);
      setTrackName(f.name);
      sfx.achieve?.();
      haptic("success");
      toast({ title: "Трек загружен", sub: `${ons.length} нот из твоей музыки`, tone: "gold" });
    } catch {
      setLoadErr("Не удалось прочитать аудио. Нужен mp3, m4a, ogg или wav.");
    }
    setAnalyzing(false);
  };

  const dropTrack = async () => {
    await clearTrack();
    audioBuf.current = null;
    chartRef.current = null;
    setTrackName(null);
    sfx.click();
  };

  const useOwn = !!(audioBuf.current && chartRef.current);

  const reset = useCallback(() => {
    const g = G.current;
    g.running = false;
    // seed от времени: каждый заход — новый рисунок нот
    const L = BEAT_LEVELS[lv];
    g.notes = (useOwn ? chartRef.current! : builtinChart(diffOf(lv), Date.now() & 0xffff))
      .map((n) => ({ ...n }));
    g.time = 0; g.score = 0; g.combo = 0; g.bestCombo = 0;
    g.lives = L.lives; g.hits = 0; g.perfect = 0;
    g.flash = [0, 0, 0]; g.held = [false, false, false];
    g.pops = []; g.bob = 0; g.shake = 0;
    const last = g.notes[g.notes.length - 1];
    g.endAt = last ? last.t + last.hold + 2400 : 30000;
    setUiScore(0); setUiCombo(0); setUiLives(BEAT_LEVELS[lv].lives);
  }, [useOwn, lv]);

  const start = useCallback(() => {
    reset();
    setPhase("count");
    setCd(3);
  }, [reset]);

  useEffect(() => {
    if (phase !== "count") return;
    if (cd < 0) {
      G.current.running = true;
      setPhase("play");
      if (useOwn && audioBuf.current) {
        clockRef.current = playTrack(audioBuf.current);
      } else {
        clockRef.current = null;
        startBeat();
      }
      return;
    }
    sfx.click();
    const t = setTimeout(() => setCd((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, cd, useOwn]);

  // музыку глушим при любом выходе
  useEffect(() => () => { stopBeat(); stopTrack(); }, []);

  const end = useCallback(() => {
    const g = G.current;
    g.running = false;
    stopBeat();
    stopTrack();
    clockRef.current = null;
    const score = Math.floor(g.score);
    /* Награда уровня: «БЕЗ РИТМА» платит вдвое — риск должен быть чем-то
       оправдан, иначе все играют на «НОВИЧКЕ». */
    const coins = Math.floor(score * 1.8 * BEAT_LEVELS[lv].mult * (1 + s.prestige * 0.12));
    const xp = Math.floor(score * 0.5 + 25);
    setResult({ score, coins, xp });
    setPhase("over");
    sfx.gameOver();
    haptic("error");
    addCoins(coins);
    addXp(xp);
    finishGame("radomir", score, g.time);
    bump("notesHit", g.hits);
    questProgress("score", score);
  }, [addCoins, addXp, finishGame, bump, questProgress, s.prestige, lv]);

  /* ---------- нажатие / отпускание дорожки ---------- */
  const pressLane = (lane: number) => {
    const g = G.current;
    if (!g.running) return;
    g.flash[lane] = 1;
    g.held[lane] = true;

    let best: Note | null = null;
    let bestDiff = Infinity;
    for (const n of g.notes) {
      if (n.lane !== lane || n.hit || n.missed) continue;
      const d = Math.abs(n.t - g.time);
      if (d < bestDiff) { bestDiff = d; best = n; }
    }

    if (best && bestDiff <= GOOD) {
      best.hit = true;
      g.hits += 1;
      g.combo += 1;
      g.bestCombo = Math.max(g.bestCombo, g.combo);
      const perfect = bestDiff <= PERFECT;
      if (perfect) g.perfect += 1;
      const mult = 1 + Math.min(2, g.combo * 0.03);
      const pts = Math.floor((perfect ? 12 : 6) * mult);
      g.score += pts;
      setUiScore(Math.floor(g.score));
      setUiCombo(g.combo);
      if (best.hold > 0) best.holding = true;
      else best.done = true;
      g.pops.push({
        lane, txt: perfect ? "ИДЕАЛЬНО" : "ХОРОШО",
        c: perfect ? "#FF9FD6" : "#8FD3FF", life: 620,
      });
      sfx.tap();
      haptic("light");
    } else {
      g.combo = 0;
      setUiCombo(0);
      g.pops.push({ lane, txt: "МИМО", c: "#8f8f9c", life: 500 });
      sfx.click();
    }
  };

  const releaseLane = (lane: number) => {
    const g = G.current;
    g.held[lane] = false;
    for (const n of g.notes) {
      if (n.lane === lane && n.holding && !n.done) {
        n.holding = false;
        // отпустил раньше конца — нота не засчитана целиком
        if (n.holdOk < n.hold * 0.6) {
          n.done = true;
          g.combo = 0;
          setUiCombo(0);
          g.pops.push({ lane, txt: "РАНО", c: "var(--gold)", life: 500 });
        } else {
          n.done = true;
        }
      }
    }
  };

  const surfRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = surfRef.current;
    if (!el || phase !== "play") return;
    const laneOf = (clientX: number) => {
      const r = el.getBoundingClientRect();
      return Math.max(0, Math.min(LANES - 1, Math.floor(((clientX - r.left) / r.width) * LANES)));
    };
    const active = new Map<number, number>();
    const down = (e: PointerEvent) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const l = laneOf(e.clientX);
      active.set(e.pointerId, l);
      pressLane(l);
    };
    const up = (e: PointerEvent) => {
      const l = active.get(e.pointerId);
      if (l !== undefined) { releaseLane(l); active.delete(e.pointerId); }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);

    const keys = new Set<string>();
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const idx = ["a", "s", "d"].indexOf(k);
      if (idx >= 0 && !keys.has(k)) { keys.add(k); pressLane(idx); }
    };
    const ku = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const idx = ["a", "s", "d"].indexOf(k);
      if (idx >= 0) { keys.delete(k); releaseLane(idx); }
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* ---------- цикл ---------- */
  const canvasRef = useCanvas((ctx, W, H, dt) => {
    const g = G.current;
    ctx.clearRect(0, 0, W, H);

    const lineY = H * 0.76;
    const laneW = W / LANES;
    const msToPx = lineY / FALL_MS;

    if (g.running) {
      // время берём от аудио-часов, чтобы ноты не расходились с музыкой
      g.time = clockRef.current ? clockRef.current() : g.time + dt;
      g.bob += dt * 0.004;
      g.shake *= 0.9;
      for (let i = 0; i < LANES; i++) g.flash[i] *= 0.88;

      for (const n of g.notes) {
        // удержание длинной ноты
        if (n.holding && !n.done) {
          if (g.held[n.lane]) {
            n.holdOk += dt;
            if (n.holdOk % 200 < dt) {
              g.score += 2;
              setUiScore(Math.floor(g.score));
            }
            if (n.holdOk >= n.hold) {
              n.done = true;
              n.holding = false;
              g.score += 14;
              setUiScore(Math.floor(g.score));
              g.pops.push({ lane: n.lane, txt: "ДЕРЖАЛ", c: "#B6F23C", life: 560 });
              sfx.crit?.();
            }
          }
        }
        // промах
        if (!n.hit && !n.missed && g.time - n.t > GOOD) {
          n.missed = true;
          g.combo = 0;
          g.lives -= 1;
          setUiCombo(0);
          setUiLives(g.lives);
          g.shake = 14;
          haptic("medium");
          if (g.lives <= 0) { end(); return; }
        }
      }

      for (let i = g.pops.length - 1; i >= 0; i--) {
        g.pops[i].life -= dt;
        if (g.pops[i].life <= 0) g.pops.splice(i, 1);
      }

      if (g.time > g.endAt) { end(); return; }
    }

    /* --- отрисовка --- */
    ctx.save();
    if (g.shake > 0.4) ctx.translate((Math.random() - 0.5) * g.shake, 0);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "rgba(255,159,214,0.13)");
    bg.addColorStop(0.55, "rgba(143,211,255,0.07)");
    bg.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < LANES; i++) {
      const x = i * laneW;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.028)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(x, 0, laneW, H);
      if (g.flash[i] > 0.02 || g.held[i]) {
        const amt = Math.max(g.flash[i], g.held[i] ? 0.5 : 0);
        const fg = ctx.createLinearGradient(0, lineY - H * 0.3, 0, lineY);
        fg.addColorStop(0, "rgba(255,159,214,0)");
        fg.addColorStop(1, `rgba(255,159,214,${amt * 0.35})`);
        ctx.fillStyle = fg;
        ctx.fillRect(x, lineY - H * 0.3, laneW, H * 0.3);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Радомир танцует сверху
    const headR = Math.min(W * 0.15, H * 0.09);
    drawHead(
      ctx, radomir.look, W / 2, H * 0.17 + Math.sin(g.bob) * 7, headR,
      { mouth: 0.2 + Math.abs(Math.sin(g.bob)) * 0.25, tilt: Math.sin(g.bob * 0.7) * 0.16 },
    );

    // линия попадания
    ctx.strokeStyle = "rgba(255,159,214,0.9)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(255,159,214,0.8)";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(W, lineY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // зоны тапа
    for (let i = 0; i < LANES; i++) {
      const cxp = i * laneW + laneW / 2;
      ctx.strokeStyle = g.held[i] ? "rgba(255,159,214,0.95)" : "rgba(255,255,255,0.24)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cxp - laneW * 0.34, lineY - 18, laneW * 0.68, 36, 10);
      ctx.stroke();
    }

    // ноты
    for (const n of g.notes) {
      if (n.missed || n.done) continue;
      const dtn = n.t - g.time;
      if (dtn > FALL_MS || dtn < -GOOD - n.hold) continue;
      const x = n.lane * laneW + laneW / 2;
      const r = Math.min(laneW * 0.3, 30);
      const y = lineY - dtn * msToPx;

      if (n.hold > 0) {
        // хвост длинной ноты
        const tailTop = y - n.hold * msToPx;
        const grdT = ctx.createLinearGradient(0, tailTop, 0, y);
        grdT.addColorStop(0, "rgba(182,242,60,0.35)");
        grdT.addColorStop(1, "rgba(182,242,60,0.75)");
        ctx.fillStyle = grdT;
        ctx.beginPath();
        ctx.roundRect(x - r * 0.44, Math.min(tailTop, y), r * 0.88, Math.abs(y - tailTop), r * 0.44);
        ctx.fill();
        if (n.holding) {
          ctx.strokeStyle = "rgba(182,242,60,0.95)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(x - r * 0.5, Math.min(tailTop, y), r, Math.abs(y - tailTop), r * 0.5);
          ctx.stroke();
        }
      }

      if (!n.hit) {
        ctx.save();
        ctx.translate(x, y);
        const grd = ctx.createLinearGradient(0, -r, 0, r);
        grd.addColorStop(0, n.hold > 0 ? "#D8FF8F" : "#FFC4E6");
        grd.addColorStop(1, n.hold > 0 ? "#B6F23C" : "#8FD3FF");
        ctx.fillStyle = grd;
        ctx.shadowColor = n.hold > 0 ? "rgba(182,242,60,0.7)" : "rgba(255,159,214,0.7)";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.roundRect(-r, -r * 0.42, r * 2, r * 0.84, r * 0.42);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.textAlign = "center";
    ctx.font = "800 15px Inter, system-ui, sans-serif";
    for (const p of g.pops) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 400));
      ctx.fillStyle = p.c;
      ctx.fillText(p.txt, p.lane * laneW + laneW / 2, lineY - 26);
    }
    ctx.globalAlpha = 1;

    if (g.combo > 3) {
      ctx.textAlign = "center";
      ctx.font = "800 30px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,159,214,0.92)";
      ctx.fillText(`${g.combo}x`, W / 2, H * 0.36);
    }
    ctx.restore();
  }, [radomir]);

  return (
    <div className="absolute inset-0" style={{ background: "var(--bg)" }}>
      <div
        ref={surfRef}
        className="absolute inset-0"
        style={{ touchAction: "none", userSelect: "none" }}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      <GameHUD
        score={uiScore}
        best={s.games.radomir.best}
        onExit={onExit}
        extra={uiCombo > 1 ? <HudStat label={tr("СЕРИЯ")} value={`×${uiCombo}`} tone="acc" min={44} /> : undefined}
        lives={{ value: uiLives, max: 5 }}
      />

      {/* Меню трека */}
      <AnimatePresence>
        {phase === "menu" && (
          <GameIntro
            title={tr("РИТМ РАДОМИРА")}
            subtitle={tr("Короткие ноты — тап, длинные — держи палец до конца хвоста.")}
            icon="note"
            startLabel={tr("ИГРАТЬ")}
            onStart={start}
            onExit={onExit}
          >
            {/* УРОВЕНЬ. Четыре ступени: от «одной большой палец справится»
                до «две руки и ни одной свободной». Выбор запоминается. */}
            <IntroGroup label={tr("УРОВЕНЬ")}>
              <div className="flex" style={{ gap: 6 }}>
                {BEAT_LEVELS.map((L, i) => (
                  <button
                    key={L.name}
                    type="button"
                    onClick={() => {
                      if (i === lv) return;
                      setLv(i);
                      writeNum(LV_KEY, i);
                      sfx.click();
                      haptic("light");
                    }}
                    className="flex-1 t-label"
                    style={{
                      padding: "9px 2px", borderRadius: "var(--r-sm)", fontSize: 8.5,
                      background: lv === i ? "var(--acc)" : "var(--surface-2)",
                      color: lv === i ? "var(--acc-ink)" : "var(--text-mute)",
                      border: `1px solid ${lv === i ? "var(--acc)" : "var(--btn-brd)"}`,
                      transition: "background .16s, color .16s",
                    }}
                  >
                    {tr(L.name)}
                  </button>
                ))}
              </div>
              <div className="t-caption" style={{ marginTop: 7 }}>
                {BEAT_LEVELS[lv].lives} {tr("жизней")} · {tr("награда")} ×{BEAT_LEVELS[lv].mult}
              </div>
            </IntroGroup>

            {/* ТРЕК. Два лежат в приложении, третий — свой, с телефона. */}
            <IntroGroup label={tr("ТРЕК")}>
              <div className="flex" style={{ gap: 6, flexWrap: "wrap" }}>
                {BEAT_TRACKS.map((T) => (
                  <button
                    key={T.id}
                    type="button"
                    onClick={() => {
                      if (T.id === trackId) return;
                      setTrackId(T.id);
                      try { localStorage.setItem(TRACK_KEY, T.id); } catch { /*noop*/ }
                      setTrackName(null);
                      sfx.click();
                      haptic("light");
                    }}
                    className="t-label"
                    style={{
                      padding: "8px 11px", borderRadius: "var(--r-sm)", fontSize: 9,
                      background: trackId === T.id && !trackName ? "var(--acc)" : "var(--surface-2)",
                      color: trackId === T.id && !trackName ? "var(--acc-ink)" : "var(--text-mute)",
                      border: `1px solid ${trackId === T.id && !trackName ? "var(--acc)" : "var(--btn-brd)"}`,
                    }}
                  >
                    {T.title}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setTrackId("own");
                    try { localStorage.setItem(TRACK_KEY, "own"); } catch { /*noop*/ }
                    sfx.click();
                  }}
                  className="t-label"
                  style={{
                    padding: "8px 11px", borderRadius: "var(--r-sm)", fontSize: 9,
                    background: trackName ? "var(--acc)" : "var(--surface-2)",
                    color: trackName ? "var(--acc-ink)" : "var(--text-mute)",
                    border: `1px solid ${trackName ? "var(--acc)" : "var(--btn-brd)"}`,
                  }}
                >
                  {tr("СВОЙ ФАЙЛ")}
                </button>
              </div>
            </IntroGroup>

            {/* Что играет сейчас. */}
            <IntroGroup label={tr("СЕЙЧАС ИГРАЕТ")}>
              <div
                style={{
                  padding: "14px 15px", borderRadius: "var(--r-md)",
                  background: "var(--surface-2)", border: "1px solid var(--btn-brd)",
                }}
              >
                <div className="flex items-center" style={{ gap: 11 }}>
                  <span className="ico-box ico-box-acc shrink-0" style={{ width: 40, height: 40 }}>
                    <Icon name="music" size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="t-title-sm clip1" style={{ fontSize: 13 }}>
                      {trackName || (builtinReady ? BEAT_TRACKS.find((t) => t.id === trackId)?.title ?? tr("Встроенный бит") : tr("Синтезированный бит"))}
                    </div>
                    <div className="t-caption clip1" style={{ marginTop: 2 }}>
                      {trackName
                        ? tr("твой трек — ноты из музыки")
                        : builtinReady
                          ? `${BEAT_TRACKS.find((t) => t.id === trackId)?.artist ?? ""} — ${tr("ноты из музыки")}`
                          : analyzing ? tr("загружаю трек…") : tr("синтезируется в приложении")}
                    </div>
                  </div>
                </div>

                {loadErr && (
                  <div className="t-caption" style={{ marginTop: 9, color: "var(--danger)" }}>
                    {loadErr}
                  </div>
                )}

                {/* Кнопка крупная и по центру — пользователь просил именно так */}
                <button
                  type="button"
                  disabled={analyzing}
                  onClick={() => { sfx.click(); fileRef.current?.click(); }}
                  className="btn-flat w-full"
                  style={{ marginTop: 12, minHeight: 46, fontSize: 12.5 }}
                >
                  <Icon name="upload" size={15} />
                  {analyzing
                    ? tr("АНАЛИЗИРУЮ…")
                    : trackName ? tr("ЗАМЕНИТЬ ТРЕК") : tr("ЗАГРУЗИТЬ СВОЙ ТРЕК")}
                </button>
                {trackName && (
                  <button
                    type="button"
                    onClick={() => { sfx.click(); dropTrack(); }}
                    className="w-full t-caption"
                    style={{
                      marginTop: 8, minHeight: 38, borderRadius: "var(--r-sm)",
                      background: "transparent", border: "1px solid var(--btn-brd)",
                      color: "var(--text-dim)",
                    }}
                  >
                    {tr("Вернуть встроенный трек")}
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*,.mp3,.m4a,.ogg,.wav"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void pickFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </IntroGroup>

            <div className="t-caption" style={{ lineHeight: 1.55 }}>
              {tr("Рисунок нот собирается заново на каждый заход, так что дважды одинаковых партий не будет.")}
            </div>
          </GameIntro>
        )}
      </AnimatePresence>

      <AnimatePresence>{phase === "count" && <Countdown n={cd} />}</AnimatePresence>

      <AnimatePresence>
        {phase === "over" && (
          <GameOver
            score={result.score}
            best={s.games.radomir.best}
            coins={result.coins}
            xp={result.xp}
            onRetry={start}
            onExit={onExit}
            title={G.current.lives > 0 ? "ТРЕК ПРОЙДЕН" : "СБИЛСЯ С РИТМА"}
            sub={`Лучшее комбо ${G.current.bestCombo}x · идеальных ${G.current.perfect}`}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
