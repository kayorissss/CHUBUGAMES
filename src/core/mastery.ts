/**
 * МАСТЕРСТВО, РЕКОРДЫ И ИСПЫТАНИЕ ДНЯ.
 *
 * Три вещи, которые дают глубину уже существующим играм, вместо того
 * чтобы добавлять двадцать восьмую игру:
 *
 *   • мастерство — 10 уровней на каждую игру, каждый даёт прибавку к
 *     монетам именно в ней;
 *   • история рекордов — когда поставлен и пять последних результатов;
 *   • испытание дня — одинаковый для всех сид на сутки, одна попытка
 *     в день на игру.
 *
 * Кривая мастерства подобрана расчётом (см. /tmp/mx2.mjs, 200 прогонов
 * на конфигурацию), а не на глаз:
 *   3 забега в день  -> 5 уровень за месяц
 *   6 забегов в день -> 7 уровень за месяц
 *   12 забегов в день -> 10 уровень за месяц
 * Первый уровень берётся почти сразу, десятый остаётся долгой целью.
 */

import type { GameId, GameStats, SaveState } from "./types";

/** Сколько очков мастерства нужно НА уровень l (1..10) */
export const mxNeed = (l: number) => Math.round(3 * Math.pow(l, 1.6));

/** Накопительный порог: сколько всего очков нужно, чтобы иметь уровень l */
export function mxTotal(l: number) {
  let sum = 0;
  for (let i = 1; i <= l; i++) sum += mxNeed(i);
  return sum;
}

export const MX_MAX = 10;

/** Уровень мастерства по накопленным очкам */
export function masteryLevel(mx: number): number {
  let lvl = 0;
  for (let l = 1; l <= MX_MAX; l++) {
    if (mx >= mxTotal(l)) lvl = l;
    else break;
  }
  return lvl;
}

/** Прогресс внутри текущего уровня: 0..1 и числа для подписи */
export function masteryProgress(mx: number) {
  const lvl = masteryLevel(mx);
  if (lvl >= MX_MAX) return { lvl, have: 0, need: 0, frac: 1 };
  const from = mxTotal(lvl);
  const to = mxTotal(lvl + 1);
  return { lvl, have: mx - from, need: to - from, frac: (mx - from) / (to - from) };
}

/**
 * Прибавка к монетам за мастерство: +4% за уровень, максимум +40%.
 * Заметно, но не ломает экономику — престиж даёт больше.
 */
export const masteryBonus = (mx: number) => 1 + masteryLevel(mx) * 0.04;

/** Сколько очков мастерства даёт один забег */
export function mxGain(isRecord: boolean) {
  return 1 + (isRecord ? 2 : 0);
}

/* ─────────────────────────  РЕКОРДЫ  ───────────────────────── */

/** Сколько последних результатов храним на игру */
export const RECENT_KEEP = 5;

/**
 * Обновить статистику игры после забега.
 * Возвращает новый объект — сохранение остаётся неизменяемым.
 */
export function applyRun(
  st: GameStats,
  score: number,
  timeMs: number,
  now = Date.now(),
): GameStats {
  const isRecord = score > (st.best || 0);
  const recent = [{ s: score, t: now }, ...(st.recent || [])].slice(0, RECENT_KEEP);
  return {
    ...st,
    best: isRecord ? score : st.best,
    bestAt: isRecord ? now : st.bestAt,
    plays: (st.plays || 0) + 1,
    totalScore: (st.totalScore || 0) + score,
    timeMs: (st.timeMs || 0) + timeMs,
    recent,
    mx: (st.mx || 0) + mxGain(isRecord),
  };
}

/* ─────────────────────  ИСПЫТАНИЕ ДНЯ  ───────────────────── */

/**
 * Сид испытания дня.
 *
 * Один и тот же для всех игроков в конкретную дату и игру, потому что
 * считается из даты — никакого сервера не нужно, а «одинаковые условия»
 * соблюдаются. Игра может использовать сид, чтобы зафиксировать
 * расстановку, порядок появления и прочую случайность.
 */
export function dailySeed(gameId: string, day: string): number {
  let h = 2166136261;
  const src = `${day}:${gameId}`;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Простой генератор на основе сида — детерминированный */
export function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Пройдено ли уже испытание дня по этой игре */
export function dailyDone(st: GameStats | undefined, day: string) {
  return !!st && st.dcDay === day;
}

/** Награда за испытание дня: тем больше, чем выше мастерство игры */
export function dailyReward(mx: number) {
  return 400 + masteryLevel(mx) * 120;
}

/* ─────────────────────  ИТОГИ НЕДЕЛИ  ───────────────────── */

/**
 * Сводка за неделю по всем играм — для экрана «твоя неделя».
 * Считается из recent-историй, поэтому не требует отдельного лога.
 */
export function weekSummary(save: SaveState, now = Date.now()) {
  const since = now - 7 * 24 * 3600 * 1000;
  let runs = 0;
  let scoreSum = 0;
  let records = 0;
  const perGame: { id: GameId; runs: number; best: number }[] = [];

  for (const [id, st] of Object.entries(save.games) as [GameId, GameStats][]) {
    const rec = (st.recent || []).filter((r) => r.t >= since);
    if (!rec.length) continue;
    runs += rec.length;
    scoreSum += rec.reduce((a, b) => a + b.s, 0);
    if (st.bestAt && st.bestAt >= since) records++;
    perGame.push({ id, runs: rec.length, best: Math.max(...rec.map((r) => r.s)) });
  }

  perGame.sort((a, b) => b.runs - a.runs);
  return { runs, scoreSum, records, top: perGame.slice(0, 3), games: perGame.length };
}
