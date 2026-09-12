import { DAILY_LADDER } from "./content";
import { daysBetween, today } from "./format";

/**
 * ЕСТЬ ЛИ ЧТО ЗАБРАТЬ ПРЯМО СЕЙЧАС.
 *
 * Отдельный модуль — потому что про «можно ли забрать ежедневный вход»
 * раньше знала только страница прогресса. Из-за этого и красной точки ни на
 * чём не было: игрок обязан был зайти в Прогресс, чтобы узнать, что там
 * лежит награда. Теперь один источник правды: точка на вкладке, плашка на
 * странице и подсказка при первом запуске считают из одного места.
 */

export interface DailyState {
  /** можно забрать сегодня */
  canClaim: boolean;
  /** сколько дней прошло с прошлого входа (999 = впервые) */
  gap: number;
  /** какой день лесенки горит (0..6) */
  idx: number;
  /** что дадут */
  coins: number;
  gems: number;
  /** текущая серия (в днях) */
  streak: number;
}

export function dailyState(s: { daily?: { lastClaim?: string; streak?: number } }): DailyState {
  const last = s.daily?.lastClaim || "";
  const t = today();
  const gap = last ? daysBetween(last, t) : 999;
  const canClaim = gap >= 1;
  const streak = s.daily?.streak || 0;
  const idx = Math.min(6, canClaim ? (gap === 1 ? streak : 0) : Math.max(0, streak - 1));
  const rw = DAILY_LADDER[idx] || DAILY_LADDER[0];
  return { canClaim, gap, idx, coins: rw.coins, gems: rw.gems, streak };
}

/** есть ли незабранная награда (для красной точки на разделе) */
export function hasLoot(s: { daily?: { lastClaim?: string; streak?: number } }): boolean {
  return dailyState(s).canClaim;
}
