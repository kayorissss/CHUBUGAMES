import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { GameHUD, GameOver, HudStat } from "./shell";
import { tr } from "../core/i18n";
import { ChessPiece } from "../ui/BoardPiece";
import { isLowFx } from "../core/perf";
import BoardMenu from "../ui/BoardMenu";
import { EASE } from "../core/motion";
import * as CH from "../core/chess";
import type { Move, PieceKind, Position } from "../core/chess";

/**
 * ШАХМАТЫ С ШИТОВЫМ — полноценные шахматы против компьютера.
 *
 * Правила живут в src/core/chess.ts и проверены perft-тестом
 * (20 / 400 / 8902 / 197281 из начальной позиции), поэтому здесь только
 * представление: доска, ввод и подсветки.
 *
 * Управление сделано под палец: можно и тапнуть «откуда-куда», и просто
 * тащить фигуру — она едет за пальцем, а клетка под ней подсвечивается.
 * Панель управления вынесена НАД нижним краем, чтобы до неё дотягивался
 * большой палец и её не перекрывал жест «домой».
 */

type VsMode = "bot" | "duo";

const LEVELS = [
  { id: 1 as const, name: "НОВИЧОК", sub: "Шитов после пары" },
  { id: 2 as const, name: "КРЕПКИЙ", sub: "Шитов в форме" },
  { id: 3 as const, name: "ЗВЕРЬ", sub: "Шитов на кафедре" },
];

/** Очки за партию: за победу много, за ничью средне, за материал немного */
function scoreFor(pos: Position, res: CH.Outcome, human: "w" | "b", level: number, moves: number) {
  let sc = 0;
  const mat = CH.evaluate(pos) * (human === "w" ? 1 : -1);
  sc += Math.max(0, Math.floor(mat / 8));
  if (res === "checkmate") {
    // мат поставил тот, чей ход НЕ наступил
    const loser = pos.turn;
    if (loser !== human) sc += 900 * level;
    else sc += Math.floor(sc * 0.1);
  } else if (res !== "playing") {
    sc += 220 * level;
  }
  sc += Math.max(0, 60 - moves) * 2;
  return Math.max(10, Math.floor(sc));
}

export default function Chess({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [level, setLevel] = useState<1 | 2 | 3>(2);
  const [vs, setVs] = useState<VsMode>("bot");
  const [side, setSide] = useState<"w" | "b">("w");
  const [phase, setPhase] = useState<"menu" | "play" | "over">("menu");
  const [pos, setPos] = useState<Position>(() => CH.initialPosition());
  const [sel, setSel] = useState<number | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [lastMove, setLastMove] = useState<{ from: number; to: number } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });
  const [title, setTitle] = useState("");
  const [sub, setSub] = useState("");
  const [taken, setTaken] = useState<{ w: PieceKind[]; b: PieceKind[] }>({ w: [], b: [] });
  const [checkSq, setCheckSq] = useState<number | null>(null);

  // перетаскивание
  const [drag, setDrag] = useState<{ from: number; x: number; y: number; over: number | null } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const startT = useRef(Date.now());
  const ended = useRef(false);
  const nMoves = useRef(0);
  /**
   * В игре с другом ходят оба цвета живыми людьми, поэтому «человеком»
   * считается тот, чей сейчас ход — иначе доска заблокируется на
   * чёрных, ожидая бота, которого нет.
   */
  /** За кого играет живой человек. Раньше всегда «белые» — чёрными
      сыграть было нельзя вообще. */
  const human: "w" | "b" = vs === "duo" ? pos.turn : side;
  const lowFx = isLowFx();

  const best = s.games.chess?.best || 0;

  const start = useCallback(() => {
    setPos(CH.initialPosition());
    setSel(null); setMoves([]); setLastMove(null); setPromo(null);
    setTaken({ w: [], b: [] }); setCheckSq(null);
    ended.current = false; nMoves.current = 0;
    startT.current = Date.now();
    setPhase("play");
    sfx.tap();
  }, []);

  const finish = useCallback((p: Position, res: CH.Outcome) => {
    if (ended.current) return;
    ended.current = true;
    const sc = scoreFor(p, res, human, level, nMoves.current);
    const coins = Math.floor(sc * 1.5 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 0.4 + 20);
    setResult({ score: sc, coins, xp });

    const win = res === "checkmate" && p.turn !== "w";
    if (res === "checkmate") {
      if (vs === "duo") {
        // с другом победил тот, кто НЕ должен ходить
        setTitle(p.turn === "b" ? tr("ПОБЕДА БЕЛЫХ") : tr("ПОБЕДА ЧЁРНЫХ"));
        setSub(tr("Мат на доске"));
      } else {
        setTitle(win ? tr("МАТ! ШИТОВ ПОВЕРЖЕН") : tr("МАТ. ШИТОВ СИЛЬНЕЕ"));
        setSub(win ? tr("Он молча собрал фигуры") : tr("Он даже не снял очки"));
      }
    } else if (res === "stalemate") {
      setTitle(tr("ПАТ")); setSub(tr("Ходить некуда, но шаха нет"));
    } else if (res === "draw50") {
      setTitle(tr("НИЧЬЯ")); setSub(tr("50 ходов без взятий"));
    } else {
      setTitle(tr("НИЧЬЯ")); setSub(tr("Матовать нечем"));
    }

    if (win) { sfx.legend(); haptic("success"); } else { sfx.gameOver(); haptic("error"); }
    addCoins(coins); addXp(xp);
    finishGame("chess", sc, Date.now() - startT.current);
    questProgress("plays", 1);
    setPhase("over");
  }, [addCoins, addXp, finishGame, questProgress, s.prestige, level, vs]);

  /** Применяем ход человека или бота, обновляем всё вокруг */
  const doMove = useCallback((p: Position, m: Move) => {
    const next = CH.applyMove(p, m);
    nMoves.current++;
    setLastMove({ from: m.from, to: m.to });

    if (m.captured) {
      const victim = m.captured;
      setTaken((t) => ({ ...t, [victim.color]: [...t[victim.color], victim.kind] }));
      sfx.hit(); haptic("medium");
    } else {
      sfx.tap(); haptic("light");
    }

    const inChk = CH.inCheck(next);
    setCheckSq(inChk ? CH.findKing(next.board, next.turn) : null);
    if (inChk) { sfx.crit(); haptic("heavy"); }

    setPos(next);
    setSel(null); setMoves([]);
    return next;
  }, []);

  // Ход компьютера — с паузой, чтобы игрок успел увидеть свой ход
  useEffect(() => {
    if (vs === "duo") return;                       // с другом бот молчит
    if (phase !== "play" || pos.turn === human || ended.current) return;
    const res = CH.outcome(pos);
    if (res !== "playing") { finish(pos, res); return; }

    setThinking(true);
    // Считаем в setTimeout: иначе на слабом телефоне интерфейс замирает
    // ещё до того, как отрисуется ход игрока.
    const t = setTimeout(() => {
      const m = CH.bestMove(pos, level);
      setThinking(false);
      if (!m) { finish(pos, CH.outcome(pos)); return; }
      const next = doMove(pos, m);
      const r2 = CH.outcome(next);
      if (r2 !== "playing") finish(next, r2);
    }, 420);
    return () => clearTimeout(t);
  }, [phase, pos, level, doMove, finish, vs, human]);

  // Проверяем конец партии после хода человека
  useEffect(() => {
    if (phase !== "play" || ended.current) return;
    if (vs === "bot" && pos.turn !== human) return;
    const res = CH.outcome(pos);
    if (res !== "playing") finish(pos, res);
  }, [phase, pos, finish, vs, human]);

  const pickSquare = useCallback((i: number) => {
    if (pos.turn !== human || thinking || ended.current) return;

    // клик по своей фигуре — выбираем её
    const pc = pos.board[i];
    if (pc && pc.color === human) {
      const ms = CH.legalMoves(pos, i);
      setSel(i); setMoves(ms);
      if (ms.length) sfx.tap();
      return;
    }
    // клик по подсвеченной клетке — ходим
    if (sel !== null) {
      const cand = moves.filter((m) => m.to === i);
      if (cand.length === 0) { setSel(null); setMoves([]); return; }
      if (cand.length > 1 && cand[0].promo) { setPromo({ from: sel, to: i }); return; }
      doMove(pos, cand[0]);
    }
  }, [pos, sel, moves, thinking, doMove]);

  /* ───────── перетаскивание пальцем ───────── */

  const squareFromPoint = (clientX: number, clientY: number): number | null => {
    const el = boardRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const c = Math.floor(((clientX - r.left) / r.width) * 8);
    const rw = Math.floor(((clientY - r.top) / r.height) * 8);
    if (c < 0 || c > 7 || rw < 0 || rw > 7) return null;
    return fromView(rw * 8 + c);
  };

  const onDown = (e: React.PointerEvent) => {
    if (pos.turn !== human || thinking || ended.current || promo) return;
    const sq = squareFromPoint(e.clientX, e.clientY);
    if (sq === null) return;
    const pc = pos.board[sq];
    if (pc && pc.color === human) {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      const ms = CH.legalMoves(pos, sq);
      setSel(sq); setMoves(ms);
      setDrag({ from: sq, x: e.clientX, y: e.clientY, over: sq });
      if (ms.length) { sfx.tap(); haptic("light"); }
    } else {
      pickSquare(sq);
    }
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    e.preventDefault();
    const over = squareFromPoint(e.clientX, e.clientY);
    setDrag({ ...drag, x: e.clientX, y: e.clientY, over });
  };

  const onUp = (e: React.PointerEvent) => {
    if (!drag) return;
    const target = squareFromPoint(e.clientX, e.clientY);
    const d = drag;
    setDrag(null);
    if (target === null) { setSel(null); setMoves([]); return; }
    if (target === d.from) return;             // просто выбрали фигуру
    const cand = moves.filter((m) => m.to === target);
    if (cand.length === 0) {
      // бросили не туда — оставим выбор, вдруг игрок хочет тапнуть
      return;
    }
    if (cand.length > 1 && cand[0].promo) { setPromo({ from: d.from, to: target }); return; }
    doMove(pos, cand[0]);
  };

  const choosePromo = (kind: PieceKind) => {
    if (!promo) return;
    const m = CH.legalMoves(pos, promo.from).find((x) => x.to === promo.to && x.promo === kind);
    setPromo(null);
    if (m) doMove(pos, m);
  };

  /* Доска разворачивается, когда играешь чёрными: свои фигуры должны
     быть внизу, иначе играть неудобно, а рокировка выглядит зеркальной.
     Индекс 0 в позиции — это a8, поэтому переворот — это 63 - i. */
  const flipped = vs === "bot" && side === "b";
  const fromView = (i: number) => (flipped ? 63 - i : i);

  const targets = new Set(moves.map((m) => m.to));
  const dragPiece = drag ? pos.board[drag.from] : null;

  /* ───────── меню выбора уровня ───────── */
  if (phase === "menu") {
    return (
      <div className="absolute inset-0 flex flex-col" style={{ background: "var(--bg)" }}>
        <GameHUD score={0} best={best} onExit={onExit} label={tr("ОЧКИ")} rulesId="chess" />
        <BoardMenu
          title={tr("ШАХМАТЫ С ШИТОВЫМ")}
          subtitle={tr("Он ведёт шахматный кружок. Выбери, насколько тебе не жалко себя.")}
          icon="brain"
          vs={vs}
          onVs={setVs}
          level={level}
          onLevel={setLevel}
          levels={LEVELS}
          onStart={start}
          onExit={onExit}
          side={side}
          onSide={setSide}
          accentPieces={
            <div className="flex items-center justify-center" style={{ gap: 6 }}>
              {(["k", "q", "r", "b", "n", "p"] as PieceKind[]).map((k) => (
                <span key={k} style={{ opacity: 0.9 }}>
                  <ChessPiece kind={k} color="w" size={26} />
                </span>
              ))}
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "var(--bg)" }}>
      <GameHUD
        score={0}
        best={best}
        onExit={onExit}
        label={tr("УРОВЕНЬ")}
        extra={
          <HudStat
            label={tr("ХОД")}
            value={
              <span style={{ fontSize: 10 }}>
                {vs === "duo"
                  ? (pos.turn === "w" ? tr("БЕЛЫЕ") : tr("ЧЁРНЫЕ"))
                  : thinking ? tr("ШИТОВ") : tr("ТВОЙ")}
              </span>
            }
            tone={thinking ? "warn" : "ok"}
            min={62}
          />
        }
      />

      <div
        className="flex-1 flex flex-col justify-center"
        style={{ padding: "calc(var(--sat) + 74px) 12px calc(var(--sab) + 22px)" }}
      >
        {/* съеденные чёрные — сверху */}
        <TakenRow list={taken.b} color="b" />

        <div
          ref={boardRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{
            width: "100%", aspectRatio: "1", touchAction: "none",
            /* gridTemplateRows обязателен.
               Без него строки сжимались по содержимому, и доска выходила
               «кривая, суженная»: клетки становились прямоугольными, а
               подсветки с borderRadius 50% — овальными. */
            display: "grid",
            gridTemplateColumns: "repeat(8, 1fr)",
            gridTemplateRows: "repeat(8, 1fr)",
            borderRadius: "var(--r-md)", overflow: "hidden",
            border: "2px solid var(--board-brd)",
            userSelect: "none", WebkitUserSelect: "none",
          }}
        >
          {Array.from({ length: 64 }, (_, vi) => {
            // vi — клетка на экране, i — та же клетка в позиции
            const i = fromView(vi);
            const r = Math.floor(vi / 8), c = vi % 8;
            const dark = (r + c) % 2 === 1;
            const pc = pos.board[i];
            const isSel = sel === i;
            const isTarget = targets.has(i);
            const isLast = lastMove && (lastMove.from === i || lastMove.to === i);
            const isCheck = checkSq === i;
            const isOver = drag?.over === i && targets.has(i);
            const hidden = drag?.from === i;

            return (
              <div
                key={vi}
                style={{
                  position: "relative",
                  background: dark ? "var(--board-dark)" : "var(--board-light)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {isLast && (
                  <div style={{ position: "absolute", inset: 0, background: "var(--sel)" }} />
                )}
                {isCheck && (
                  <div style={{ position: "absolute", inset: 0, background: "var(--hit)" }} />
                )}
                {isSel && (
                  <div style={{ position: "absolute", inset: 0, border: "2px solid var(--acc)" }} />
                )}
                {isOver && (
                  <div style={{ position: "absolute", inset: 0, background: "var(--sel-strong)" }} />
                )}
                {isTarget && !pc && (
                  <motion.div
                    initial={lowFx ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.16, ease: EASE }}
                    style={{
                      position: "absolute", width: "28%", height: "28%", borderRadius: "50%",
                      background: "var(--acc)",
                    }}
                  />
                )}
                {isTarget && pc && (
                  <div
                    style={{
                      position: "absolute", inset: "6%", borderRadius: "50%",
                      border: "3px solid rgba(255,176,32,0.8)",
                    }}
                  />
                )}
                {pc && !hidden && (
                  <motion.div
                    /* Фигура «оседает» на новой клетке, а не возникает рывком */
                    initial={lowFx ? false : { scale: 0.82, opacity: 0.4 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.18, ease: EASE }}
                    style={{ width: "84%", height: "84%", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <ChessPieceFit kind={pc.kind} color={pc.color} />
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        {/* съеденные белые — снизу */}
        <TakenRow list={taken.w} color="w" />

        <div
          className="t-body"
          style={{ fontSize: 11.5, color: "var(--text-mute)", textAlign: "center", marginTop: 8, lineHeight: 1.45 }}
        >
          {tr("Веди фигуру пальцем или тапни клетку")}
        </div>
      </div>

      {/* фигура под пальцем */}
      {drag && dragPiece && (
        <div
          style={{
            position: "fixed", left: drag.x, top: drag.y,
            transform: "translate(-50%, -50%) scale(1.25)",
            pointerEvents: "none", zIndex: 40,
            filter: lowFx ? undefined : "drop-shadow(0 6px 14px rgba(0,0,0,0.55))",
          }}
        >
          <ChessPiece kind={dragPiece.kind} color={dragPiece.color} size={46} />
        </div>
      )}

      {/* выбор фигуры при превращении */}
      <AnimatePresence>
        {promo && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center"
            style={{ background: "var(--scrim-strong)", padding: 24 }}
          >
            <div
              style={{
                background: "var(--surface)", border: "1px solid var(--surface-brd)",
                borderRadius: "var(--r-lg)", padding: 18, width: "100%", maxWidth: 320,
              }}
            >
              <div className="t-label" style={{ fontSize: 11, textAlign: "center", marginBottom: 14 }}>
                {tr("ПЕШКА ДОШЛА. КЕМ СТАНЕТ?")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {(["q", "r", "b", "n"] as PieceKind[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => choosePromo(k)}
                    style={{
                      padding: 8, borderRadius: "var(--r-md)",
                      background: "var(--surface-2)", border: "1px solid var(--surface-brd)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <ChessPiece kind={k} color={human} size={40} />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "over" && (
        <GameOver
          score={result.score}
          best={best}
          coins={result.coins}
          xp={result.xp}
          onRetry={start}
          onExit={onExit}
          title={title}
          sub={sub}
        />
      )}
    </div>
  );
}

/** Фигура, которая сама подстраивается под размер клетки */
function ChessPieceFit({ kind, color }: { kind: PieceKind; color: "w" | "b" }) {
  return (
    <svg viewBox="0 0 48 48" style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }} aria-hidden>
      <PieceBody kind={kind} color={color} />
    </svg>
  );
}

function PieceBody({ kind, color }: { kind: PieceKind; color: "w" | "b" }) {
  const fill = color === "w" ? "#f4f4f6" : "#1b1b20";
  const stroke = color === "w" ? "#26262c" : "#eaeaef";
  const P: Record<PieceKind, string> = {
    p: "M24 9c-3.2 0-5.8 2.6-5.8 5.8 0 1.9.9 3.6 2.3 4.7-2.4 1.2-4 3.6-4.4 6.6h-.6c-.9 0-1.6.7-1.6 1.6 0 .9.7 1.6 1.6 1.6h1.1c-.3 3.2-1.6 5.9-3.4 7.9h33.6c-1.8-2-3.1-4.7-3.4-7.9h1.1c.9 0 1.6-.7 1.6-1.6 0-.9-.7-1.6-1.6-1.6h-.6c-.4-3-2-5.4-4.4-6.6 1.4-1.1 2.3-2.8 2.3-4.7C41.8 11.6 39.2 9 36 9",
    n: "M17 39h20c.4-4.2-.4-8-2.2-11.3-1.7-3.1-3.7-5.2-5.3-6.6l1.9-3.3c.5-.9.2-2-.7-2.5l-2.6-1.5-1.3 2.2-2.2-1.3.9-1.6c.5-.9.2-2-.7-2.5-.9-.5-2-.2-2.5.7l-1.3 2.2c-3.6.6-6.6 2.7-8.5 5.9-1 1.7-1.6 3.5-1.9 5.2-.2 1.1.6 2.1 1.7 2.2.6.1 1.2-.1 1.6-.5l3.3-3.1 2 1.8-4.3 4.5c-1.9 2-2.4 5.1-2.4 9.5z",
    b: "M24 8c-1.6 0-2.9 1.3-2.9 2.9 0 .9.4 1.7 1.1 2.3-3.4 2.4-5.6 6.3-5.6 10.8 0 2.9.9 5.5 2.5 7.6-.9.6-1.5 1.6-1.5 2.8v.7h12.8v-.7c0-1.2-.6-2.2-1.5-2.8 1.6-2.1 2.5-4.7 2.5-7.6 0-4.5-2.2-8.4-5.6-10.8.7-.6 1.1-1.4 1.1-2.3C26.9 9.3 25.6 8 24 8z M13 39h22c0-1.7-1.3-3-3-3H16c-1.7 0-3 1.3-3 3z",
    r: "M13 39h22v-3H13v3z M15 36h18l-1.5-14h-15L15 36z M13 8v7h4v-3h4v3h6v-3h4v3h4V8H13z",
    q: "M11 39h26v-3.5H11V39z M13 35h22l2-15-6 5-4-11-4 11-4-11-4 11-6-5 4 15z M11 17a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z M19 14a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z M29 14a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z M37 17a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z",
    k: "M22.4 8h3.2v3.4H29v3.2h-3.4V18h-3.2v-3.4H19v-3.2h3.4V8z M13 39h22v-3.5H13V39z M15 35.5h18c1.5-4.5 2.5-8.3 2.5-11 0-3.6-2.6-6.2-5.8-6.2-2.4 0-4.4 1.3-5.7 3.4-1.3-2.1-3.3-3.4-5.7-3.4-3.2 0-5.8 2.6-5.8 6.2 0 2.7 1 6.5 2.5 11z",
  };
  return <path d={P[kind]} fill={fill} stroke={stroke} strokeWidth={1.7} strokeLinejoin="round" />;
}

/** Ряд съеденных фигур */
function TakenRow({ list, color }: { list: PieceKind[]; color: "w" | "b" }) {
  return (
    <div
      style={{
        display: "flex", flexWrap: "wrap", gap: 1, minHeight: 22,
        alignItems: "center", padding: "3px 2px",
      }}
    >
      {list.map((k, i) => (
        <div key={i} style={{ width: 18, height: 18, opacity: 0.75 }}>
          <ChessPieceFit kind={k} color={color} />
        </div>
      ))}
    </div>
  );
}
