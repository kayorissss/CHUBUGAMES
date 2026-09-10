/**
 * Правила бильярда: американка (9 шаров) и восьмёрка (8 ball).
 *
 * Здесь только ПРАВИЛА и состояние партии — физика шаров живёт в самой
 * игре. Такое разделение позволяет прогонять правила тестами, не
 * поднимая канвас.
 *
 * Американка:
 *   - на столе биток и шары 1..9;
 *   - первым касанием биток ОБЯЗАН задеть самый младший шар на столе;
 *   - забил девятку — выиграл, но только если удар был чистым;
 *   - забил что-то — продолжаешь бить, нет — ход переходит.
 *
 * Восьмёрка:
 *   - шары 1..7 сплошные, 9..15 полосатые, 8 чёрный;
 *   - до первого забитого группы не закреплены («стол открыт»);
 *   - свою группу надо забить целиком, потом восьмёрку;
 *   - восьмёрка раньше времени или вместе с фолом — поражение.
 */

export type PoolMode = "nine" | "eight";
export type Group = "solid" | "stripe" | null;
export type Side = "me" | "foe";

export interface BallInfo {
  /** 0 — биток */
  num: number;
  potted: boolean;
}

export interface ShotResult {
  /** какой шар биток задел первым (0 — ни одного) */
  firstHit: number;
  /** номера шаров, упавших за удар */
  potted: number[];
  /** биток улетел в лузу */
  cuePotted: boolean;
  /** хоть один шар коснулся борта или был забит после контакта */
  railAfterContact: boolean;
}

export interface Verdict {
  /** был ли фол */
  foul: boolean;
  /** почему фол — короткая строка для игрока */
  reason: string;
  /** переходит ли ход сопернику */
  turnOver: boolean;
  /** партия закончена */
  gameOver: boolean;
  /** кто победил, если закончена */
  winner: Side | null;
  /** назначенная группа после удара (только для восьмёрки) */
  group: Group;
}

export const SOLIDS = [1, 2, 3, 4, 5, 6, 7];
export const STRIPES = [9, 10, 11, 12, 13, 14, 15];
export const BLACK = 8;

/** Номера шаров, которые ставятся в партии */
export function rackNumbers(mode: PoolMode): number[] {
  return mode === "nine"
    ? [1, 2, 3, 4, 5, 6, 7, 8, 9]
    : [...SOLIDS, BLACK, ...STRIPES];
}

export const groupOf = (num: number): Group =>
  num === BLACK || num === 0 ? null : num < BLACK ? "solid" : "stripe";

/** Самый младший шар на столе — по нему обязан быть первый контакт */
export function lowestOnTable(balls: BallInfo[]): number {
  const live = balls.filter((b) => b.num > 0 && !b.potted).map((b) => b.num);
  return live.length ? Math.min(...live) : 0;
}

/** Остались ли у стороны шары своей группы */
export function groupCleared(balls: BallInfo[], group: Group): boolean {
  if (!group) return false;
  const set = group === "solid" ? SOLIDS : STRIPES;
  return set.every((n) => balls.find((b) => b.num === n)?.potted);
}

/**
 * Разбор удара по правилам.
 *
 * `balls` — состояние ПОСЛЕ удара (potted уже проставлены).
 * `group` — группа игрока до удара (для восьмёрки).
 */
export function judge(
  mode: PoolMode,
  balls: BallInfo[],
  shot: ShotResult,
  group: Group,
  who: Side,
): Verdict {
  const other: Side = who === "me" ? "foe" : "me";
  const v: Verdict = {
    foul: false, reason: "", turnOver: false,
    gameOver: false, winner: null, group,
  };

  if (mode === "nine") {
    // на момент удара самым младшим был тот, что лежал до забития
    const before = balls.map((b) => ({ ...b }));
    for (const n of shot.potted) {
      const t = before.find((b) => b.num === n);
      if (t) t.potted = false;
    }
    const need = lowestOnTable(before);

    if (shot.firstHit === 0) {
      v.foul = true; v.reason = "Биток никого не задел";
    } else if (need && shot.firstHit !== need) {
      v.foul = true; v.reason = `Сначала надо было по шару ${need}`;
    } else if (shot.cuePotted) {
      v.foul = true; v.reason = "Биток в лузе";
    } else if (!shot.railAfterContact && shot.potted.length === 0) {
      v.foul = true; v.reason = "Ни один шар не дошёл до борта";
    }

    const nineIn = shot.potted.includes(9);
    if (nineIn) {
      if (v.foul) {
        // девятка при фоле — её возвращают на стол
        const nine = balls.find((b) => b.num === 9);
        if (nine) nine.potted = false;
        v.turnOver = true;
        return v;
      }
      v.gameOver = true;
      v.winner = who;
      return v;
    }
    v.turnOver = v.foul || shot.potted.length === 0;
    return v;
  }

  /* ─────────── восьмёрка ─────────── */
  const blackIn = shot.potted.includes(BLACK);
  const myGroupBefore = group;

  if (shot.firstHit === 0) {
    v.foul = true; v.reason = "Биток никого не задел";
  } else if (shot.cuePotted) {
    v.foul = true; v.reason = "Биток в лузе";
  } else if (myGroupBefore && groupOf(shot.firstHit) !== myGroupBefore) {
    // бить чужую группу нельзя, пока своя не закрыта;
    // по чёрному можно только когда своя группа выбита
    const cleared = groupCleared(balls, myGroupBefore);
    if (!(shot.firstHit === BLACK && cleared)) {
      v.foul = true; v.reason = "Удар не по своей группе";
    }
  } else if (!shot.railAfterContact && shot.potted.length === 0) {
    v.foul = true; v.reason = "Ни один шар не дошёл до борта";
  }

  if (blackIn) {
    const clearedNow = myGroupBefore ? groupCleared(balls, myGroupBefore) : false;
    // выигрыш только если группа выбита и не было фола
    if (clearedNow && !v.foul) {
      v.gameOver = true; v.winner = who;
    } else {
      v.gameOver = true; v.winner = other;
      if (!v.reason) v.reason = "Чёрный забит раньше времени";
    }
    return v;
  }

  // назначение группы: первый забитый после разбития закрепляет группы
  let newGroup = group;
  if (!group) {
    const first = shot.potted.find((n) => n !== BLACK);
    if (first && !v.foul) newGroup = groupOf(first);
  }
  v.group = newGroup;

  const mine = shot.potted.filter((n) => newGroup && groupOf(n) === newGroup);
  v.turnOver = v.foul || mine.length === 0;
  return v;
}

/* ───────────────────────── Бот ───────────────────────── */

export interface AimTarget {
  ball: number;
  pocket: { x: number; y: number };
  /** точка, куда бить битком */
  aimX: number;
  aimY: number;
  /** насколько удар «удобный»: 1 — идеально, 0 — безнадёжно */
  quality: number;
}

export interface BallPos { num: number; x: number; y: number; potted: boolean }

/**
 * Выбор удара ботом: перебираем свои шары и все лузы, ищем прямой удар.
 *
 * Для каждой пары (шар, луза) считаем точку контакта — «шар-призрак»,
 * стоящий по линии от лузы к шару на расстоянии двух радиусов. Качество
 * удара тем выше, чем прямее угол и чем ближе шар к лузе. Ход по чужим
 * шарам не рассматриваем — это фол.
 */
export function pickShot(
  balls: BallPos[],
  cue: BallPos,
  pockets: { x: number; y: number }[],
  legal: number[],
  R: number,
): AimTarget | null {
  let best: AimTarget | null = null;

  for (const b of balls) {
    if (b.potted || b.num === 0) continue;
    if (!legal.includes(b.num)) continue;

    for (const p of pockets) {
      // призрачный шар: точка, из которой удар пойдёт в лузу
      const dxp = b.x - p.x, dyp = b.y - p.y;
      const dp = Math.hypot(dxp, dyp) || 1;
      const gx = b.x + (dxp / dp) * R * 2;
      const gy = b.y + (dyp / dp) * R * 2;

      // угол между «биток -> призрак» и «шар -> луза»
      const cx = gx - cue.x, cy = gy - cue.y;
      const dc = Math.hypot(cx, cy) || 1;
      const cosA = -((cx / dc) * (dxp / dp) + (cy / dc) * (dyp / dp));
      if (cosA <= 0.12) continue;      // слишком острый угол — не берём

      // мешает ли кто-то на пути битка к призраку
      let blocked = false;
      for (const o of balls) {
        if (o.potted || o.num === b.num || o.num === 0) continue;
        if (segDist(cue.x, cue.y, gx, gy, o.x, o.y) < R * 1.9) { blocked = true; break; }
      }
      if (blocked) continue;
      // и на пути шара в лузу
      for (const o of balls) {
        if (o.potted || o.num === b.num || o.num === 0) continue;
        if (segDist(b.x, b.y, p.x, p.y, o.x, o.y) < R * 1.9) { blocked = true; break; }
      }
      if (blocked) continue;

      const quality = cosA / (1 + dp / 400 + dc / 700);
      if (!best || quality > best.quality) {
        best = { ball: b.num, pocket: p, aimX: gx, aimY: gy, quality };
      }
    }
  }
  return best;
}

/** Расстояние от точки до отрезка */
export function segDist(
  x1: number, y1: number, x2: number, y2: number, px: number, py: number,
): number {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Какие шары боту законно бить */
export function legalBalls(mode: PoolMode, balls: BallInfo[], group: Group): number[] {
  if (mode === "nine") {
    const low = lowestOnTable(balls);
    return low ? [low] : [];
  }
  if (!group) {
    return balls.filter((b) => !b.potted && b.num !== BLACK && b.num > 0).map((b) => b.num);
  }
  if (groupCleared(balls, group)) return [BLACK];
  const set = group === "solid" ? SOLIDS : STRIPES;
  return set.filter((n) => !balls.find((b) => b.num === n)?.potted);
}
