/**
 * Русские шашки: правила + ИИ.
 *
 * Доска 8x8, играем по тёмным клеткам. Русские правила (не международные):
 *   - простая шашка бьёт и вперёд, и назад;
 *   - дамка ходит и бьёт на любое расстояние по диагонали;
 *   - взятие обязательно, и бить надо до конца цепочки;
 *   - шашка, дошедшая до последней горизонтали ВО ВРЕМЯ боя, сразу
 *     становится дамкой и продолжает бой уже как дамка.
 *
 * Обязательность взятия — главное, что отличает шашки от «двигаем кружки».
 * Без неё игра разваливается, поэтому она проверена тестами.
 */

export type Color = "w" | "b";
export interface Piece { color: Color; king: boolean }
export type Cell = Piece | null;
export type Board = Cell[];   // 64 клетки, индекс = r*8+c

export interface Step {
  from: number;
  to: number;
  /** побитая шашка, если это взятие */
  captured?: number;
}
/** Ход целиком: цепочка взятий может состоять из нескольких шагов */
export interface Move {
  steps: Step[];
  from: number;
  to: number;
  captures: number[];
  becameKing: boolean;
}

export interface Position {
  board: Board;
  turn: Color;
  /** ходов подряд без взятий — для ничьей */
  quiet: number;
}

const rowOf = (i: number) => Math.floor(i / 8);
const colOf = (i: number) => i % 8;
const onBoard = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const idx = (r: number, c: number) => r * 8 + c;
/** Тёмная клетка — только на них стоят шашки */
export const isDark = (i: number) => (rowOf(i) + colOf(i)) % 2 === 1;

export function initialPosition(): Position {
  const board: Board = new Array(64).fill(null);
  for (let i = 0; i < 64; i++) {
    if (!isDark(i)) continue;
    const r = rowOf(i);
    if (r <= 2) board[i] = { color: "b", king: false };
    if (r >= 5) board[i] = { color: "w", king: false };
  }
  return { board, turn: "w", quiet: 0 };
}

function clonePos(p: Position): Position {
  return { board: p.board.slice(), turn: p.turn, quiet: p.quiet };
}

const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

/** Последняя горизонталь для цвета */
const lastRow = (c: Color) => (c === "w" ? 0 : 7);

/**
 * Все цепочки взятий из клетки. Возвращает полные ходы (до упора),
 * потому что по русским правилам бой обязателен и прерывать его нельзя.
 */
function captureChains(board: Board, from: number, color: Color, king: boolean): Move[] {
  const results: Move[] = [];

  const walk = (
    b: Board, cur: number, isKing: boolean,
    steps: Step[], caps: number[],
  ) => {
    let extended = false;
    const r = rowOf(cur), c = colOf(cur);

    for (const [dr, dc] of DIRS) {
      if (isKing) {
        // дамка: ищем вдоль диагонали первую фигуру
        let rr = r + dr, cc = c + dc;
        while (onBoard(rr, cc) && !b[idx(rr, cc)]) { rr += dr; cc += dc; }
        if (!onBoard(rr, cc)) continue;
        const victimSq = idx(rr, cc);
        const victim = b[victimSq];
        if (!victim || victim.color === color) continue;
        if (caps.includes(victimSq)) continue;   // дважды одну не бьём
        // за побитой должно быть хотя бы одно свободное поле
        let lr = rr + dr, lc = cc + dc;
        while (onBoard(lr, lc) && !b[idx(lr, lc)]) {
          const land = idx(lr, lc);
          const nb = b.slice();
          nb[cur] = null;
          nb[victimSq] = null;
          nb[land] = { color, king: true };
          extended = true;
          walk(nb, land, true, [...steps, { from: cur, to: land, captured: victimSq }],
            [...caps, victimSq]);
          lr += dr; lc += dc;
        }
      } else {
        // простая: бьёт через одну, в любую сторону
        const mr = r + dr, mc = c + dc;
        const lr = r + 2 * dr, lc = c + 2 * dc;
        if (!onBoard(lr, lc)) continue;
        const victimSq = idx(mr, mc), land = idx(lr, lc);
        const victim = b[victimSq];
        if (!victim || victim.color === color) continue;
        if (b[land]) continue;
        if (caps.includes(victimSq)) continue;
        // дошёл до последней горизонтали в бою — становится дамкой и бьёт дальше
        const promoted = rowOf(land) === lastRow(color);
        const nb = b.slice();
        nb[cur] = null;
        nb[victimSq] = null;
        nb[land] = { color, king: promoted };
        extended = true;
        walk(nb, land, promoted, [...steps, { from: cur, to: land, captured: victimSq }],
          [...caps, victimSq]);
      }
    }

    if (!extended && steps.length > 0) {
      const endSq = steps[steps.length - 1].to;
      results.push({
        steps,
        from,
        to: endSq,
        captures: caps,
        becameKing: !king && rowOf(endSq) === lastRow(color),
      });
    }
  };

  walk(board, from, king, [], []);
  return results;
}

/** Тихие ходы (без взятия) */
function quietMoves(board: Board, from: number, color: Color, king: boolean): Move[] {
  const out: Move[] = [];
  const r = rowOf(from), c = colOf(from);
  const forward = color === "w" ? -1 : 1;

  for (const [dr, dc] of DIRS) {
    if (king) {
      let rr = r + dr, cc = c + dc;
      while (onBoard(rr, cc) && !board[idx(rr, cc)]) {
        const to = idx(rr, cc);
        out.push({ steps: [{ from, to }], from, to, captures: [], becameKing: false });
        rr += dr; cc += dc;
      }
    } else {
      if (dr !== forward) continue;   // простая ходит только вперёд
      const rr = r + dr, cc = c + dc;
      if (!onBoard(rr, cc)) continue;
      const to = idx(rr, cc);
      if (board[to]) continue;
      out.push({
        steps: [{ from, to }], from, to, captures: [],
        becameKing: rowOf(to) === lastRow(color),
      });
    }
  }
  return out;
}

/**
 * Законные ходы. Если есть хоть одно взятие — возвращаем только взятия
 * (бой обязателен). Если указан `only`, фильтруем по клетке-источнику,
 * но обязательность боя считаем по всей доске.
 */
export function legalMoves(pos: Position, only?: number): Move[] {
  const caps: Move[] = [];
  const quiets: Move[] = [];

  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    if (!p || p.color !== pos.turn) continue;
    const ch = captureChains(pos.board, i, p.color, p.king);
    if (ch.length) caps.push(...ch);
    else quiets.push(...quietMoves(pos.board, i, p.color, p.king));
  }

  // Если бьёт хоть кто-то, тихие ходы запрещены всем
  let pool = caps.length ? caps : quiets;

  if (caps.length) {
    // Из нескольких боёв в русских шашках можно выбирать любой,
    // но обрывать начатую цепочку нельзя — она уже целиком в Move.
    pool = caps;
  }
  return only === undefined ? pool : pool.filter((m) => m.from === only);
}

/** Есть ли обязательное взятие */
export function hasCapture(pos: Position): boolean {
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    if (!p || p.color !== pos.turn) continue;
    if (captureChains(pos.board, i, p.color, p.king).length) return true;
  }
  return false;
}

export function applyMove(pos: Position, m: Move): Position {
  const n = clonePos(pos);
  const piece = n.board[m.from]!;
  n.board[m.from] = null;
  for (const sq of m.captures) n.board[sq] = null;
  const becameKing = piece.king || rowOf(m.to) === lastRow(piece.color);
  n.board[m.to] = { color: piece.color, king: becameKing };
  n.turn = pos.turn === "w" ? "b" : "w";
  n.quiet = m.captures.length ? 0 : n.quiet + 1;
  return n;
}

export type Outcome = "playing" | "w" | "b" | "draw";

export function outcome(pos: Position): Outcome {
  const moves = legalMoves(pos);
  if (moves.length === 0) {
    // кто не может ходить — проиграл
    return pos.turn === "w" ? "b" : "w";
  }
  if (pos.quiet >= 30) return "draw";
  return "playing";
}

/* ─────────────────────────────── ИИ ─────────────────────────────── */

function evaluate(pos: Position): number {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    if (!p) continue;
    const sign = p.color === "w" ? 1 : -1;
    // дамка сильно дороже; продвижение к последней горизонтали ценно
    let v = p.king ? 300 : 100;
    if (!p.king) {
      const adv = p.color === "w" ? 7 - rowOf(i) : rowOf(i);
      v += adv * 6;
    }
    // край доски безопаснее
    const c = colOf(i);
    if (c === 0 || c === 7) v += 8;
    score += sign * v;
  }
  return score;
}

function negamax(pos: Position, depth: number, alpha: number, beta: number): number {
  const res = outcome(pos);
  if (res !== "playing") {
    if (res === "draw") return 0;
    const winnerIsTurn = res === pos.turn;
    return winnerIsTurn ? 50000 : -50000 - depth;
  }
  if (depth === 0) {
    const e = evaluate(pos);
    return pos.turn === "w" ? e : -e;
  }
  const moves = legalMoves(pos);
  // сначала самые «жирные» взятия
  moves.sort((a, b) => b.captures.length - a.captures.length);
  let best = -Infinity;
  for (const m of moves) {
    const v = -negamax(applyMove(pos, m), depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function bestMove(pos: Position, level: 1 | 2 | 3 = 2): Move | null {
  const moves = legalMoves(pos);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];

  const depth = level === 1 ? 2 : level === 2 ? 4 : 6;
  let best: Move | null = null;
  let bestVal = -Infinity;

  const sorted = moves.slice().sort((a, b) => b.captures.length - a.captures.length);
  for (const m of sorted) {
    let v = -negamax(applyMove(pos, m), depth - 1, -Infinity, Infinity);
    if (level === 1) v += (Math.random() - 0.5) * 80;
    if (v > bestVal) { bestVal = v; best = m; }
  }
  return best;
}

export function countPieces(pos: Position, color: Color): number {
  return pos.board.filter((p) => p && p.color === color).length;
}
