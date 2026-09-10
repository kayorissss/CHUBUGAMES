/**
 * Длинные нарды (русские) — правила и ИИ.
 *
 * Почему длинные, а не короткие: в них нет выбивания фишек с доски, а
 * значит нет и обидных откатов на старт — на телефоне в перерыве это
 * играется приятнее и партия короче.
 *
 * Правила:
 *   - у каждого 15 фишек, стоят на своей «голове» (пункты 0 и 12);
 *   - оба идут против часовой стрелки по кругу из 24 пунктов;
 *   - на пункт нельзя встать, если там стоит хотя бы одна чужая фишка;
 *   - с головы за ход берут только одну фишку (кроме первого хода при
 *     дубле 3-3, 4-4, 6-6 — тогда две);
 *   - нельзя запереть все 6 пунктов подряд перед фишками соперника,
 *     если впереди нет ни одной его фишки («правило шести»);
 *   - дубль даёт четыре хода;
 *   - выигрывает тот, кто первым выведет все фишки с доски.
 *
 * Пункты нумеруются 0..23 в порядке хода БЕЛЫХ. Для чёрных тот же круг
 * сдвинут на 12 — так обе стороны считаются одной формулой.
 */

export type Color = "w" | "b";

export interface Position {
  /** points[i] = сколько фишек и чьих; знак задаёт цвет: + белые, − чёрные */
  points: number[];          // длина 24
  turn: Color;
  /** сколько фишек уже выведено */
  off: { w: number; b: number };
  /** сколько фишек снято с головы в этом ходу */
  headTaken: number;
  /**
   * У КАЖДОГО игрока свой первый ход — поблажка с головы положена и
   * белым, и чёрным, поэтому флаг хранится отдельно на цвет.
   */
  firstMove: { w: boolean; b: boolean };
  /**
   * Сколько фишек разрешено снять с головы этим ходом. Зависит от
   * выпавших кубиков, поэтому проставляется при броске, а не выводится
   * из позиции.
   */
  headMax: number;
}

export const HEAD_W = 0;
export const HEAD_B = 12;
/* Дом игрока — последние 6 пунктов его круга, т.е. rel 18..23. */

export function initialPosition(): Position {
  const points = new Array(24).fill(0);
  points[HEAD_W] = 15;    // белые
  points[HEAD_B] = -15;   // чёрные
  return {
    points,
    turn: "w",
    off: { w: 0, b: 0 },
    headTaken: 0,
    firstMove: { w: true, b: true },
    headMax: 1,
  };
}

export function clonePos(p: Position): Position {
  return {
    points: p.points.slice(),
    turn: p.turn,
    off: { ...p.off },
    headTaken: p.headTaken,
    firstMove: { ...p.firstMove },
    headMax: p.headMax,
  };
}

/** Индекс пункта в системе координат игрока: 0 — своя голова, 23 — последний */
export function toRel(i: number, c: Color): number {
  return c === "w" ? i : (i + 12) % 24;
}
export function fromRel(rel: number, c: Color): number {
  return c === "w" ? rel % 24 : (rel + 12) % 24;
}

const countAt = (p: Position, i: number, c: Color) => {
  const v = p.points[i];
  return c === "w" ? Math.max(0, v) : Math.max(0, -v);
};
const isEnemy = (p: Position, i: number, c: Color) =>
  c === "w" ? p.points[i] < 0 : p.points[i] > 0;

/** Все ли фишки игрока в доме — тогда можно выводить */
export function allHome(p: Position, c: Color): boolean {
  for (let i = 0; i < 24; i++) {
    if (countAt(p, i, c) === 0) continue;
    const rel = toRel(i, c);
    if (rel < 18) return false;
  }
  return true;
}

export interface Step { from: number; to: number; die: number; bearOff?: boolean }

/**
 * Правило шести: нельзя выстроить шесть занятых подряд пунктов, если
 * впереди этого блока нет ни одной фишки соперника. Проверяем позицию
 * ПОСЛЕ хода.
 */
function violatesSix(p: Position, c: Color): boolean {
  const enemy: Color = c === "w" ? "b" : "w";
  let run = 0;
  for (let rel = 0; rel < 24; rel++) {
    const i = fromRel(rel, c);
    if (countAt(p, i, c) > 0) {
      run++;
      if (run >= 6) {
        // есть ли хоть одна фишка врага впереди блока
        let ahead = false;
        for (let r2 = rel + 1; r2 < 24; r2++) {
          if (countAt(p, fromRel(r2, c), enemy) > 0) { ahead = true; break; }
        }
        if (!ahead) return true;
      }
    } else run = 0;
  }
  return false;
}

/** Можно ли поставить фишку на пункт */
function canLand(p: Position, i: number, c: Color): boolean {
  return !isEnemy(p, i, c);
}

/** Один шаг фишкой на `die` пунктов; null — нельзя */
function tryStep(p: Position, from: number, die: number, c: Color): Step | null {
  if (countAt(p, from, c) === 0) return null;

  // с головы — не больше одной за ход (кроме первого дубля 3/4/6)
  const head = c === "w" ? HEAD_W : HEAD_B;
  if (from === head && p.headTaken >= headLimit(p)) return null;

  const rel = toRel(from, c);
  const nrel = rel + die;

  if (nrel > 23) {
    // выход с доски — только когда все дома
    if (!allHome(p, c)) return null;
    // точный выход или из самого дальнего пункта
    if (nrel === 24) return { from, to: -1, die, bearOff: true };
    for (let r = 18; r < rel; r++) {
      if (countAt(p, fromRel(r, c), c) > 0) return null; // есть дальше — нельзя
    }
    return { from, to: -1, die, bearOff: true };
  }

  const to = fromRel(nrel, c);
  if (!canLand(p, to, c)) return null;
  return { from, to, die };
}

/** Лимит фишек с головы за текущий ход (проставлен при броске) */
function headLimit(p: Position): number {
  return Math.max(1, p.headMax);
}

export function applyStep(p: Position, s: Step): Position {
  const n = clonePos(p);
  const c = p.turn;
  const sign = c === "w" ? 1 : -1;
  n.points[s.from] -= sign;
  if (s.bearOff) n.off[c] += 1;
  else n.points[s.to] += sign;

  const head = c === "w" ? HEAD_W : HEAD_B;
  if (s.from === head) n.headTaken += 1;
  return n;
}

/**
 * Все допустимые шаги данным кубиком.
 *
 * Про правило шести есть тонкость, из-за которой партия однажды зависла
 * намертво: блок из шести пунктов может стать «запрещённым» уже ПОСЛЕ
 * того, как был законно построен — например, соперник увёл последнюю
 * фишку из зоны впереди блока. Если в такой позиции запрещать вообще
 * всё, у игрока не остаётся ни одного хода и партия встаёт навсегда.
 *
 * Поэтому запрещаем не «наличие» нарушения, а его СОЗДАНИЕ: ход режется
 * только если до него нарушения не было, а после появилось. Плюс на
 * всякий случай оставлен запасной выход — если фильтр съел все ходы,
 * возвращаем нефильтрованные, чтобы игра не могла заклиниться.
 */
export function stepsFor(p: Position, die: number): Step[] {
  const out: Step[] = [];
  const raw: Step[] = [];
  const c = p.turn;
  const alreadyBad = violatesSix(p, c);

  for (let i = 0; i < 24; i++) {
    if (countAt(p, i, c) === 0) continue;
    const s = tryStep(p, i, die, c);
    if (!s) continue;
    raw.push(s);
    if (!alreadyBad && violatesSix(applyStep(p, s), c)) continue;
    out.push(s);
  }
  return out.length ? out : raw;
}

/** Бросок кубиков: дубль даёт четыре хода */
export function rollDice(): number[] {
  const a = 1 + Math.floor(Math.random() * 6);
  const b = 1 + Math.floor(Math.random() * 6);
  return a === b ? [a, a, a, a] : [a, b];
}

/**
 * Сколько фишек можно снять с головы этим броском.
 *
 * Обычно одну. Исключение: САМЫМ ПЕРВЫМ ходом игрока при дубле 3-3, 4-4
 * или 6-6 разрешено снять две — иначе такой дубль почти невозможно
 * разыграть, все фишки ещё стоят на голове.
 */
export function headLimitFor(p: Position, dice: number[]): number {
  const first = p.firstMove[p.turn];
  if (first && dice.length === 4 && [3, 4, 6].includes(dice[0])) return 2;
  return 1;
}

/** Зафиксировать бросок: проставляет лимит головы на этот ход */
export function applyRoll(p: Position, dice: number[]): Position {
  const n = clonePos(p);
  n.headMax = headLimitFor(p, dice);
  return n;
}

export function switchTurn(p: Position): Position {
  const n = clonePos(p);
  n.firstMove = { ...p.firstMove, [p.turn]: false };
  n.turn = p.turn === "w" ? "b" : "w";
  n.headTaken = 0;
  n.headMax = 1;
  return n;
}

export type Outcome = "playing" | "w" | "b";
export function outcome(p: Position): Outcome {
  if (p.off.w >= 15) return "w";
  if (p.off.b >= 15) return "b";
  return "playing";
}

/* ─────────────────────────────── ИИ ─────────────────────────────── */

/** Сумма расстояний до выхода: меньше — лучше */
function pipCount(p: Position, c: Color): number {
  let sum = 0;
  for (let i = 0; i < 24; i++) {
    const n = countAt(p, i, c);
    if (!n) continue;
    sum += n * (24 - toRel(i, c));
  }
  return sum;
}

function evaluate(p: Position, c: Color): number {
  const enemy: Color = c === "w" ? "b" : "w";
  let score = (pipCount(p, enemy) - pipCount(p, c)) * 1.0;
  score += (p.off[c] - p.off[enemy]) * 18;

  // фишки в доме — хорошо; блоки подряд — хорошо
  let run = 0, blocks = 0, home = 0;
  for (let rel = 0; rel < 24; rel++) {
    const i = fromRel(rel, c);
    const n = countAt(p, i, c);
    if (n > 0) {
      run++;
      if (run >= 2) blocks++;
      if (rel >= 18) home += n;
    } else run = 0;
  }
  score += blocks * 4 + home * 3;
  // высокие башни бесполезны — штрафуем
  for (let i = 0; i < 24; i++) {
    const n = countAt(p, i, c);
    if (n > 4) score -= (n - 4) * 3;
  }
  return score;
}

/**
 * Полный ход: перебираем последовательности шагов по кубикам.
 * Правила требуют использовать максимум кубиков, поэтому сначала ищем
 * самые длинные последовательности.
 */
export function enumerateTurns(p0: Position, dice: number[]): { seq: Step[]; end: Position }[] {
  // лимит головы зависит от броска — проставляем его перед перебором
  const p = applyRoll(p0, dice);
  const results: { seq: Step[]; end: Position }[] = [];
  let maxLen = 0;

  const rec = (cur: Position, left: number[], seq: Step[]) => {
    if (seq.length > maxLen) maxLen = seq.length;
    if (left.length === 0) {
      results.push({ seq, end: cur });
      return;
    }
    let any = false;
    const tried = new Set<number>();
    for (let k = 0; k < left.length; k++) {
      const die = left[k];
      if (tried.has(die)) continue;   // одинаковые кубики не дублируем
      tried.add(die);
      const rest = left.slice();
      rest.splice(k, 1);
      for (const s of stepsFor(cur, die)) {
        any = true;
        rec(applyStep(cur, s), rest, [...seq, s]);
      }
    }
    if (!any) results.push({ seq, end: cur });
  };

  // порядок кубиков влияет: пробуем оба
  rec(p, dice, []);
  if (dice.length === 2 && dice[0] !== dice[1]) rec(p, [dice[1], dice[0]], []);

  // обязаны использовать как можно больше кубиков
  const best = results.filter((r) => r.seq.length === maxLen);
  return best.length ? best : results;
}

export function bestTurn(p: Position, dice: number[]): Step[] {
  const options = enumerateTurns(p, dice);
  if (!options.length) return [];
  let best = options[0];
  let bestVal = -Infinity;
  for (const o of options) {
    const v = evaluate(o.end, p.turn);
    if (v > bestVal) { bestVal = v; best = o; }
  }
  return best.seq;
}
