/**
 * Есть ли что забрать прямо сейчас — одна функция на всё приложение.
 *
 * Просьба: «красный кружок с „!“ — заходишь в игру, и на „Прогрессе“ в
 * нижнем меню видно, что там награда; зашёл — и там тоже „!“ напротив
 * того, что забирается». Раньше каждая точка считала это по-своему
 * (ежедневка — в rewards, сундук — в ChestCard, босс — в своей вкладке),
 * и в меню снизу не было ничего.
 *
 * Считаем по четырём реальным источникам; каждый — одна строка, ни одного
 * «на всякий случай».
 */

import { dailyState } from "./rewards";
import { chestReady, readFriendship } from "./friendship";
import { canFight, readBosses } from "./bosses";
import type { SaveState } from "./types";

export type Claimables = {
  /** ежедневный вход не забран сегодня */
  daily: boolean;
  /** сколько заданий дня готовы и не забраны */
  quests: number;
  /** ежечасный сундук открыт */
  chest: boolean;
  /** босс на дежурстве и с ним ещё не разобрались */
  boss: boolean;
};

export function claimables(s: SaveState): Claimables {
  let chest = false;
  let boss = false;
  try {
    chest = chestReady(readFriendship());
  } catch {
    /* хранилище недоступно — просто не показываем точку */
  }
  try {
    boss = canFight(readBosses());
  } catch {
    /* то же самое */
  }
  return {
    daily: dailyState(s).canClaim,
    quests: (s.daily?.quests || []).filter((q) => q.done && !q.claimed).length,
    chest,
    boss,
  };
}

/** сколько всего мест, где лежит награда: 0 — показывать «!» не за чем */
export function claimableCount(c: Claimables): number {
  return (c.daily ? 1 : 0) + (c.quests > 0 ? 1 : 0) + (c.chest ? 1 : 0) + (c.boss ? 1 : 0);
}
