/**
 * Шахматный движок: правила + простой ИИ.
 *
 * Отдельным файлом, потому что правила надо проверять тестами, а не
 * глазами. Доска — массив из 64 клеток, индекс 0 = a8, 63 = h1.
 *
 * Реализовано всё, что нужно для честной партии: ходы всех фигур,
 * рокировка, взятие на проходе, превращение пешки, шах, мат и пат.
 * Проверка на «свой король под боем» делается пробным ходом — медленно,
 * но надёжно, а на доске 8x8 скорости хватает с запасом.
 */

export type Color = "w" | "b";
export type PieceKind = "p" | "n" | "b" | "r" | "q" | "k";
export interface Piece { kind: PieceKind; color: Color }
export type Square = Piece | null;
export type Board = Square[];

export interface Move {
  from: number;
  to: number;
  /** во что превращается пешка */
  promo?: PieceKind;
  /** это взятие на проходе */
  ep?: boolean;
  /** рокировка: куда едет ладья */
  castle?: { rookFrom: number; rookTo: number };
  /** что съели — для отката и подсчёта */
  captured?: Piece | null;
}

export interface Position {
  board: Board;
  turn: Color;
  /** права на рокировку: wk, wq, bk, bq */
  castling: { wk: boolean; wq: boolean; bk: boolean; bq: boolean };
  /** клетка, куда можно взять на проходе */
  epSquare: number | null;
  /** полуходов без взятий и ходов пешкой — для правила 50 ходов */
  halfmove: number;
}

const FILES = 8;

export const rowOf = (i: number) => Math.floor(i / FILES);
export const colOf = (i: number) => i % FILES;
const onBoard = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const idx = (r: number, c: number) => r * 8 + c;

/** Начальная расстановка */
export function initialPosition(): Position {
  const back: PieceKind[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const board: Board = new Array(64).fill(null);
  for (let c = 0; c < 8; c++) {
    board[idx(0, c)] = { kind: back[c], color: "b" };
    board[idx(1, c)] = { kind: "p", color: "b" };
    board[idx(6, c)] = { kind: "p", color: "w" };
    board[idx(7, c)] = { kind: back[c], color: "w" };
  }
  return {
    board,
    turn: "w",
    castling: { wk: true, wq: true, bk: true, bq: true },
    epSquare: null,
    halfmove: 0,
  };
}

export function clonexPosition(p: Position): Position {
  return {
    board: p.board.slice(),
    turn: p.turn,
    castling: { ...p.castling },
    epSquare: p.epSquare,
    halfmove: p.halfmove,
  };
}

const SLIDES: Record<string, number[][]> = {
  b: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  r: [[-1, 0], [1, 0], [0, -1], [0, 1]],
  q: [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]],
};
const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

/** Бьёт ли сторона `by` клетку `target` (без учёта связок) */
export function isAttacked(board: Board, target: number, by: Color): boolean {
  const tr = rowOf(target), tc = colOf(target);

  // пешки
  const dir = by === "w" ? 1 : -1;   // откуда пришла бы пешка
  for (const dc of [-1, 1]) {
    const r = tr + dir, c = tc + dc;
    if (onBoard(r, c)) {
      const p = board[idx(r, c)];
      if (p && p.color === by && p.kind === "p") return true;
    }
  }
  // кони
  for (const [dr, dc] of KNIGHT) {
    const r = tr + dr, c = tc + dc;
    if (!onBoard(r, c)) continue;
    const p = board[idx(r, c)];
    if (p && p.color === by && p.kind === "n") return true;
  }
  // король
  for (const [dr, dc] of KING) {
    const r = tr + dr, c = tc + dc;
    if (!onBoard(r, c)) continue;
    const p = board[idx(r, c)];
    if (p && p.color === by && p.kind === "k") return true;
  }
  // слоны/ладьи/ферзь
  for (const [kind, dirs] of [["b", SLIDES.b], ["r", SLIDES.r]] as const) {
    for (const [dr, dc] of dirs) {
      let r = tr + dr, c = tc + dc;
      while (onBoard(r, c)) {
        const p = board[idx(r, c)];
        if (p) {
          if (p.color === by && (p.kind === kind || p.kind === "q")) return true;
          break;
        }
        r += dr; c += dc;
      }
    }
  }
  return false;
}

export function findKing(board: Board, color: Color): number {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.kind === "k" && p.color === color) return i;
  }
  return -1;
}

export function inCheck(pos: Position, color: Color = pos.turn): boolean {
  const k = findKing(pos.board, color);
  if (k < 0) return false;
  return isAttacked(pos.board, k, color === "w" ? "b" : "w");
}

/** Псевдолегальные ходы одной фигуры (без проверки на свой шах) */
function pseudoMoves(pos: Position, from: number): Move[] {
  const p = pos.board[from];
  if (!p) return [];
  const out: Move[] = [];
  const r = rowOf(from), c = colOf(from);
  const me = p.color;
  const enemy = me === "w" ? "b" : "w";

  const push = (to: number, extra: Partial<Move> = {}) => {
    out.push({ from, to, captured: pos.board[to] ?? null, ...extra });
  };

  if (p.kind === "p") {
    const dir = me === "w" ? -1 : 1;
    const startRow = me === "w" ? 6 : 1;
    const lastRow = me === "w" ? 0 : 7;
    const one = idx(r + dir, c);
    if (onBoard(r + dir, c) && !pos.board[one]) {
      if (r + dir === lastRow) {
        for (const promo of ["q", "r", "b", "n"] as PieceKind[]) push(one, { promo });
      } else {
        push(one);
        const two = idx(r + 2 * dir, c);
        if (r === startRow && !pos.board[two]) push(two);
      }
    }
    for (const dc of [-1, 1]) {
      const rr = r + dir, cc = c + dc;
      if (!onBoard(rr, cc)) continue;
      const t = idx(rr, cc);
      const victim = pos.board[t];
      if (victim && victim.color === enemy) {
        if (rr === lastRow) {
          for (const promo of ["q", "r", "b", "n"] as PieceKind[]) push(t, { promo });
        } else push(t);
      } else if (pos.epSquare === t) {
        // взятие на проходе: съеденная пешка стоит рядом, не на целевой клетке
        out.push({
          from, to: t, ep: true,
          captured: pos.board[idx(r, cc)] ?? null,
        });
      }
    }
    return out;
  }

  if (p.kind === "n") {
    for (const [dr, dc] of KNIGHT) {
      const rr = r + dr, cc = c + dc;
      if (!onBoard(rr, cc)) continue;
      const t = idx(rr, cc);
      if (pos.board[t]?.color === me) continue;
      push(t);
    }
    return out;
  }

  if (p.kind === "k") {
    for (const [dr, dc] of KING) {
      const rr = r + dr, cc = c + dc;
      if (!onBoard(rr, cc)) continue;
      const t = idx(rr, cc);
      if (pos.board[t]?.color === me) continue;
      push(t);
    }
    // рокировка: король и ладья не ходили, между ними пусто,
    // и король не проходит через битое поле
    const row = me === "w" ? 7 : 0;
    if (from === idx(row, 4) && !inCheck(pos, me)) {
      const kingSide = me === "w" ? pos.castling.wk : pos.castling.bk;
      const queenSide = me === "w" ? pos.castling.wq : pos.castling.bq;
      const opp = enemy;
      if (kingSide) {
        const f1 = idx(row, 5), g1 = idx(row, 6), h1 = idx(row, 7);
        const rook = pos.board[h1];
        if (
          rook && rook.kind === "r" && rook.color === me &&
          !pos.board[f1] && !pos.board[g1] &&
          !isAttacked(pos.board, f1, opp) && !isAttacked(pos.board, g1, opp)
        ) {
          out.push({ from, to: g1, captured: null, castle: { rookFrom: h1, rookTo: f1 } });
        }
      }
      if (queenSide) {
        const d1 = idx(row, 3), c1 = idx(row, 2), b1 = idx(row, 1), a1 = idx(row, 0);
        const rook = pos.board[a1];
        if (
          rook && rook.kind === "r" && rook.color === me &&
          !pos.board[d1] && !pos.board[c1] && !pos.board[b1] &&
          !isAttacked(pos.board, d1, opp) && !isAttacked(pos.board, c1, opp)
        ) {
          out.push({ from, to: c1, captured: null, castle: { rookFrom: a1, rookTo: d1 } });
        }
      }
    }
    return out;
  }

  const dirs = p.kind === "q" ? SLIDES.q : p.kind === "b" ? SLIDES.b : SLIDES.r;
  for (const [dr, dc] of dirs) {
    let rr = r + dr, cc = c + dc;
    while (onBoard(rr, cc)) {
      const t = idx(rr, cc);
      const victim = pos.board[t];
      if (victim) {
        if (victim.color === enemy) push(t);
        break;
      }
      push(t);
      rr += dr; cc += dc;
    }
  }
  return out;
}

/** Применить ход, вернув новую позицию */
export function applyMove(pos: Position, m: Move): Position {
  const n = clonexPosition(pos);
  const p = n.board[m.from]!;
  const isPawn = p.kind === "p";
  const isCapture = !!m.captured;

  n.board[m.to] = m.promo ? { kind: m.promo, color: p.color } : p;
  n.board[m.from] = null;

  if (m.ep) {
    // съеденная пешка стоит на строке исходной, в колонке целевой
    n.board[idx(rowOf(m.from), colOf(m.to))] = null;
  }
  if (m.castle) {
    n.board[m.castle.rookTo] = n.board[m.castle.rookFrom];
    n.board[m.castle.rookFrom] = null;
  }

  // права на рокировку теряются при ходе королём или ладьёй
  if (p.kind === "k") {
    if (p.color === "w") { n.castling.wk = false; n.castling.wq = false; }
    else { n.castling.bk = false; n.castling.bq = false; }
  }
  const corners: Record<number, keyof Position["castling"]> = {
    [idx(7, 7)]: "wk", [idx(7, 0)]: "wq", [idx(0, 7)]: "bk", [idx(0, 0)]: "bq",
  };
  if (corners[m.from]) n.castling[corners[m.from]] = false;
  if (corners[m.to]) n.castling[corners[m.to]] = false;

  // поле для взятия на проходе появляется только после прыжка на две
  n.epSquare = null;
  if (isPawn && Math.abs(rowOf(m.to) - rowOf(m.from)) === 2) {
    n.epSquare = idx((rowOf(m.from) + rowOf(m.to)) / 2, colOf(m.from));
  }

  n.halfmove = isPawn || isCapture ? 0 : n.halfmove + 1;
  n.turn = pos.turn === "w" ? "b" : "w";
  return n;
}

/** Все законные ходы стороны, которая ходит */
export function legalMoves(pos: Position, only?: number): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < 64; i++) {
    if (only !== undefined && i !== only) continue;
    const p = pos.board[i];
    if (!p || p.color !== pos.turn) continue;
    for (const m of pseudoMoves(pos, i)) {
      const after = applyMove(pos, m);
      // ход незаконен, если после него свой король под боем
      if (!inCheck(after, pos.turn)) out.push(m);
    }
  }
  return out;
}

export type Outcome = "playing" | "checkmate" | "stalemate" | "draw50" | "material";

export function outcome(pos: Position): Outcome {
  const moves = legalMoves(pos);
  if (moves.length === 0) return inCheck(pos) ? "checkmate" : "stalemate";
  if (pos.halfmove >= 100) return "draw50";
  // ничья по недостатку материала: только короли (+ конь/слон)
  const rest = pos.board.filter((x): x is Piece => !!x && x.kind !== "k");
  if (rest.length === 0) return "material";
  if (rest.length === 1 && (rest[0].kind === "n" || rest[0].kind === "b")) return "material";
  return "playing";
}

/* ──────────────────────────── ИИ ──────────────────────────── */

const VALUE: Record<PieceKind, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

/** Бонусы за расположение: гонят фигуры к центру, пешки — вперёд */
const PAWN_TABLE = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5, 5, 10, 25, 25, 10, 5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -20, -20, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0,
];
const KNIGHT_TABLE = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];

/** Оценка позиции с точки зрения белых */
export function evaluate(pos: Position): number {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    if (!p) continue;
    const sign = p.color === "w" ? 1 : -1;
    // для чёрных таблицу отражаем по вертикали
    const ti = p.color === "w" ? i : 63 - i;
    let bonus = 0;
    if (p.kind === "p") bonus = PAWN_TABLE[ti];
    else if (p.kind === "n") bonus = KNIGHT_TABLE[ti];
    score += sign * (VALUE[p.kind] + bonus * 0.1);
  }
  return score;
}

/** Сортировка: сначала взятия — так отсечения работают лучше */
function orderMoves(moves: Move[]): Move[] {
  return moves.slice().sort((a, b) => {
    const av = a.captured ? VALUE[a.captured.kind] : 0;
    const bv = b.captured ? VALUE[b.captured.kind] : 0;
    return bv - av;
  });
}

function negamax(pos: Position, depth: number, alpha: number, beta: number): number {
  if (depth === 0) {
    const e = evaluate(pos);
    return pos.turn === "w" ? e : -e;
  }
  const moves = legalMoves(pos);
  if (moves.length === 0) {
    // мат хуже всего, пат — ноль
    return inCheck(pos) ? -100000 - depth : 0;
  }
  let best = -Infinity;
  for (const m of orderMoves(moves)) {
    const v = -negamax(applyMove(pos, m), depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;   // отсечение
  }
  return best;
}

/**
 * Выбор хода. `level` 1..3 — глубина перебора; на 1 добавляем
 * случайность, чтобы новичку было не обидно и партии отличались.
 */
export function bestMove(pos: Position, level: 1 | 2 | 3 = 2): Move | null {
  const moves = legalMoves(pos);
  if (moves.length === 0) return null;

  // Мат в один ход ищем всегда, даже на лёгком уровне: перебор с
  // отсечениями иногда предпочитает «жирный» размен вместо мата, и со
  // стороны это выглядит так, будто движок сломан.
  for (const m of moves) {
    if (outcome(applyMove(pos, m)) === "checkmate") return m;
  }

  const depth = level;
  let best: Move | null = null;
  let bestVal = -Infinity;

  for (const m of orderMoves(moves)) {
    let v = -negamax(applyMove(pos, m), depth - 1, -Infinity, Infinity);
    // На лёгком уровне слегка шумим, чтобы ИИ не был идеальным
    if (level === 1) v += (Math.random() - 0.5) * 120;
    if (v > bestVal) { bestVal = v; best = m; }
  }
  return best;
}

/** Человекочитаемое имя клетки: 0 -> a8 */
export function squareName(i: number): string {
  return "abcdefgh"[colOf(i)] + (8 - rowOf(i));
}
