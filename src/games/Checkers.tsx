import { useCallback, useEffect, useRef, useState } from "react";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { GameHUD, GameOver } from "./shell";
import { tr } from "../core/i18n";
import { CheckerPiece } from "../ui/BoardPiece";
import { isLowFx } from "../core/perf";
import * as CK from "../core/checkers";
import type { Move, Position } from "../core/checkers";

/**
 * ШАШКИ У СТАСА — русские шашки против компьютера.
 *
 * Правила в src/core/checkers.ts, покрыты тестами: обязательное взятие,
 * бой назад простой шашкой, цепочки до упора, превращение в дамку прямо
 * во время боя, дальнобойная дамка.
 *
 * Главное для игрока: когда есть бой, ходить можно только им — такие
 * шашки подсвечены отдельным цветом, чтобы не гадать, почему остальные
 * не двигаются. Цепочка взятий проигрывается по шагам с задержкой,
 * иначе фишка «телепортируется» и непонятно, кого съели.
 */

const LEVELS = [
  { id: 1 as const, name: "НОВИЧОК", sub: "Стас отвлекается" },
  { id: 2 as const, name: "КРЕПКИЙ", sub: "Стас собран" },
  { id: 3 as const, name: "ЗВЕРЬ", sub: "Стас играет на деньги" },
];

const STEP_MS = 240;

export default function Checkers({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [level, setLevel] = useState<1 | 2 | 3>(2);
  const [phase, setPhase] = useState<"menu" | "play" | "over">("menu");
  const [pos, setPos] = useState<Position>(() => CK.initialPosition());
  const [sel, setSel] = useState<number | null>(null);
  const [moves, setMoves] = useState<Move[]>([]);
  const [lastPath, setLastPath] = useState<number[]>([]);
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });
  const [title, setTitle] = useState("");
  const [sub, setSub] = useState("");
  const [animating, setAnimating] = useState(false);
  const [eaten, setEaten] = useState({ w: 0, b: 0 });

  const [drag, setDrag] = useState<{ from: number; x: number; y: number; over: number | null } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const startT = useRef(Date.now());
  const ended = useRef(false);
  const nMoves = useRef(0);
  const human: CK.Color = "w";
  const lowFx = isLowFx();

  const best = s.games.checkers?.best || 0;

  const start = useCallback(() => {
    setPos(CK.initialPosition());
    setSel(null); setMoves([]); setLastPath([]); setEaten({ w: 0, b: 0 });
    ended.current = false; nMoves.current = 0;
    startT.current = Date.now();
    setPhase("play");
    sfx.tap();
  }, []);

  const finish = useCallback((p: Position, res: CK.Outcome) => {
    if (ended.current) return;
    ended.current = true;
    const mine = CK.countPieces(p, human);
    const his = CK.countPieces(p, human === "w" ? "b" : "w");
    let sc = mine * 45 + (12 - his) * 30;
    if (res === human) sc += 700 * level;
    else if (res === "draw") sc += 150 * level;
    sc = Math.max(10, Math.floor(sc));

    const coins = Math.floor(sc * 1.5 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 0.4 + 20);
    setResult({ score: sc, coins, xp });

    if (res === human) {
      setTitle(tr("СТАС РАЗБИТ")); setSub(tr("Он требует реванш"));
      sfx.legend(); haptic("success");
    } else if (res === "draw") {
      setTitle(tr("НИЧЬЯ")); setSub(tr("Никто не сдвинулся"));
      sfx.gameOver(); haptic("error");
    } else {
      setTitle(tr("СТАС ВЫИГРАЛ")); setSub(tr("Он и не сомневался"));
      sfx.gameOver(); haptic("error");
    }
    addCoins(coins); addXp(xp);
    finishGame("checkers", sc, Date.now() - startT.current);
    questProgress("plays", 1);
    setPhase("over");
  }, [addCoins, addXp, finishGame, questProgress, s.prestige, level]);

  /**
   * Проигрываем ход по шагам. Цепочка из трёх взятий должна выглядеть
   * как три прыжка, а не как один телепорт — иначе игрок не понимает,
   * что произошло.
   */
  const playMove = useCallback((p: Position, m: Move, done?: (n: Position) => void) => {
    setSel(null); setMoves([]);
    setAnimating(true);
    setLastPath([m.from, ...m.steps.map((st) => st.to)]);

    let i = 0;
    let cur = p;
    const tick = () => {
      const st = m.steps[i];
      // применяем шаг вручную, чтобы промежуточные позиции были видны
      const nb = cur.board.slice();
      const piece = nb[st.from]!;
      nb[st.from] = null;
      if (st.captured !== undefined) nb[st.captured] = null;
      const lastRow = piece.color === "w" ? 0 : 7;
      nb[st.to] = { color: piece.color, king: piece.king || Math.floor(st.to / 8) === lastRow };
      cur = { ...cur, board: nb };
      setPos({ ...cur });

      if (st.captured !== undefined) {
        sfx.hit(); haptic("medium");
        setEaten((e) => ({ ...e, [piece.color === "w" ? "b" : "w"]: e[piece.color === "w" ? "b" : "w"] + 1 }));
      } else { sfx.tap(); haptic("light"); }

      i++;
      if (i < m.steps.length) {
        setTimeout(tick, STEP_MS);
      } else {
        const next: Position = {
          board: cur.board,
          turn: p.turn === "w" ? "b" : "w",
          quiet: m.captures.length ? 0 : p.quiet + 1,
        };
        nMoves.current++;
        setPos(next);
        setAnimating(false);
        done?.(next);
      }
    };
    tick();
  }, []);

  // ход компьютера
  useEffect(() => {
    if (phase !== "play" || pos.turn === human || ended.current || animating) return;
    const res = CK.outcome(pos);
    if (res !== "playing") { finish(pos, res); return; }
    setThinking(true);
    const t = setTimeout(() => {
      const m = CK.bestMove(pos, level);
      setThinking(false);
      if (!m) { finish(pos, CK.outcome(pos)); return; }
      playMove(pos, m, (next) => {
        const r2 = CK.outcome(next);
        if (r2 !== "playing") finish(next, r2);
      });
    }, 380);
    return () => clearTimeout(t);
  }, [phase, pos, level, animating, playMove, finish]);

  // конец после хода человека
  useEffect(() => {
    if (phase !== "play" || pos.turn !== human || ended.current || animating) return;
    const res = CK.outcome(pos);
    if (res !== "playing") finish(pos, res);
  }, [phase, pos, animating, finish]);

  const allMoves = phase === "play" && pos.turn === human && !animating ? CK.legalMoves(pos) : [];
  const movable = new Set(allMoves.map((m) => m.from));
  const mustCapture = allMoves.some((m) => m.captures.length > 0);

  const squareFromPoint = (cx: number, cy: number): number | null => {
    const el = boardRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const c = Math.floor(((cx - r.left) / r.width) * 8);
    const rw = Math.floor(((cy - r.top) / r.height) * 8);
    if (c < 0 || c > 7 || rw < 0 || rw > 7) return null;
    return rw * 8 + c;
  };

  const selectAt = (sq: number) => {
    if (!movable.has(sq)) return false;
    const ms = allMoves.filter((m) => m.from === sq);
    setSel(sq); setMoves(ms);
    sfx.tap(); haptic("light");
    return true;
  };

  const onDown = (e: React.PointerEvent) => {
    if (pos.turn !== human || thinking || animating || ended.current) return;
    const sq = squareFromPoint(e.clientX, e.clientY);
    if (sq === null) return;
    if (movable.has(sq)) {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      selectAt(sq);
      setDrag({ from: sq, x: e.clientX, y: e.clientY, over: sq });
      return;
    }
    // тап по подсвеченной клетке-цели
    if (sel !== null) {
      const cand = moves.filter((m) => m.to === sq);
      if (cand.length) {
        const m = cand.sort((a, b) => b.captures.length - a.captures.length)[0];
        playMove(pos, m, (next) => {
          const r2 = CK.outcome(next);
          if (r2 !== "playing") finish(next, r2);
        });
      } else { setSel(null); setMoves([]); }
    }
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    e.preventDefault();
    setDrag({ ...drag, x: e.clientX, y: e.clientY, over: squareFromPoint(e.clientX, e.clientY) });
  };

  const onUp = (e: React.PointerEvent) => {
    if (!drag) return;
    const target = squareFromPoint(e.clientX, e.clientY);
    const d = drag;
    setDrag(null);
    if (target === null || target === d.from) return;
    const cand = moves.filter((m) => m.to === target);
    if (!cand.length) return;
    const m = cand.sort((a, b) => b.captures.length - a.captures.length)[0];
    playMove(pos, m, (next) => {
      const r2 = CK.outcome(next);
      if (r2 !== "playing") finish(next, r2);
    });
  };

  const targets = new Set(moves.map((m) => m.to));
  const dragPiece = drag ? pos.board[drag.from] : null;

  if (phase === "menu") {
    return (
      <div className="absolute inset-0 flex flex-col" style={{ background: "var(--bg)" }}>
        <GameHUD score={0} best={best} onExit={onExit} label={tr("ОЧКИ")} />
        <div
          className="flex-1 flex flex-col justify-center"
          style={{ padding: "calc(var(--sat) + 74px) 20px calc(var(--sab) + 26px)" }}
        >
          <div className="t-display" style={{ fontSize: 26, marginBottom: 6, textAlign: "center" }}>
            {tr("ШАШКИ У СТАСА")}
          </div>
          <div
            className="t-body"
            style={{ fontSize: 12.5, opacity: 0.62, marginBottom: 22, textAlign: "center", lineHeight: 1.5 }}
          >
            {tr("Русские шашки. Бить обязательно, даже когда очень не хочется.")}
          </div>
          {LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() => { setLevel(l.id); sfx.click(); }}
              style={{
                width: "100%", textAlign: "left", marginBottom: 10,
                padding: "13px 15px", borderRadius: "var(--r-md)",
                background: level === l.id ? "var(--acc-soft)" : "var(--surface)",
                border: `1px solid ${level === l.id ? "var(--acc)" : "var(--surface-brd)"}`,
                color: "var(--fg)",
              }}
            >
              <div className="t-label" style={{ fontSize: 12, color: level === l.id ? "var(--acc)" : undefined }}>
                {tr(l.name)}
              </div>
              <div className="t-body" style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{tr(l.sub)}</div>
            </button>
          ))}
          <button
            onClick={start}
            className="btn-acc t-label"
            style={{ width: "100%", marginTop: 14, padding: "15px 0", borderRadius: "var(--r-md)", fontSize: 13 }}
          >
            {tr("НАЧАТЬ ПАРТИЮ")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "var(--bg)" }}>
      <GameHUD
        score={eaten.b}
        best={best}
        onExit={onExit}
        label={tr("СЪЕДЕНО")}
        extra={
          <div
            className="t-label shrink-0"
            style={{
              padding: "8px 10px", borderRadius: "var(--r-md)",
              background: "var(--btn-bg)", border: "1px solid rgba(255,255,255,0.16)",
              color: thinking ? "var(--acc)" : "#fff", fontSize: 9.5, minWidth: 66, textAlign: "center",
            }}
          >
            {thinking ? tr("ДУМАЕТ") : tr("ТВОЙ ХОД")}
          </div>
        }
      />

      <div
        className="flex-1 flex flex-col justify-center"
        style={{ padding: "calc(var(--sat) + 74px) 12px calc(var(--sab) + 22px)" }}
      >
        {mustCapture && (
          <div
            className="t-label"
            style={{
              fontSize: 10, textAlign: "center", marginBottom: 8,
              color: "var(--acc)", letterSpacing: "0.06em",
            }}
          >
            {tr("ЕСТЬ БОЙ — БИТЬ ОБЯЗАТЕЛЬНО")}
          </div>
        )}

        <div
          ref={boardRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{
            width: "100%", aspectRatio: "1", touchAction: "none",
            display: "grid", gridTemplateColumns: "repeat(8, 1fr)",
            borderRadius: "var(--r-md)", overflow: "hidden",
            border: "1px solid var(--surface-brd)",
            userSelect: "none", WebkitUserSelect: "none",
          }}
        >
          {Array.from({ length: 64 }, (_, i) => {
            const r = Math.floor(i / 8), c = i % 8;
            const dark = (r + c) % 2 === 1;
            const pc = pos.board[i];
            const isSel = sel === i;
            const isTarget = targets.has(i);
            const canMove = movable.has(i);
            const inPath = lastPath.includes(i);
            const isOver = drag?.over === i && targets.has(i);
            const hidden = drag?.from === i;

            return (
              <div
                key={i}
                style={{
                  position: "relative",
                  background: dark ? "#3a3a44" : "#8f8f9c",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {inPath && <div style={{ position: "absolute", inset: 0, background: "rgba(255,176,32,0.18)" }} />}
                {isSel && <div style={{ position: "absolute", inset: 0, border: "2px solid var(--acc)" }} />}
                {isOver && <div style={{ position: "absolute", inset: 0, background: "rgba(255,176,32,0.34)" }} />}
                {isTarget && (
                  <div
                    style={{
                      position: "absolute", width: "30%", height: "30%", borderRadius: "50%",
                      background: "rgba(255,176,32,0.7)",
                    }}
                  />
                )}
                {canMove && !isSel && (
                  <div
                    style={{
                      position: "absolute", inset: 2, borderRadius: "50%",
                      border: `2px solid ${mustCapture ? "rgba(255,107,77,0.85)" : "rgba(89,255,158,0.5)"}`,
                    }}
                  />
                )}
                {pc && !hidden && (
                  <div style={{ width: "88%", height: "88%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CheckerFit color={pc.color} king={pc.king} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between" style={{ marginTop: 10, padding: "0 2px" }}>
          <div className="t-body" style={{ fontSize: 11, opacity: 0.62 }}>
            {tr("Твои")}: {CK.countPieces(pos, "w")}
          </div>
          <div className="t-body" style={{ fontSize: 11, opacity: 0.62 }}>
            {tr("Стас")}: {CK.countPieces(pos, "b")}
          </div>
        </div>
        <div
          className="t-body"
          style={{ fontSize: 11, opacity: 0.5, textAlign: "center", marginTop: 6, lineHeight: 1.45 }}
        >
          {tr("Веди шашку пальцем или тапни клетку")}
        </div>
      </div>

      {drag && dragPiece && (
        <div
          style={{
            position: "fixed", left: drag.x, top: drag.y,
            transform: "translate(-50%, -50%) scale(1.2)",
            pointerEvents: "none", zIndex: 40,
            filter: lowFx ? undefined : "drop-shadow(0 6px 14px rgba(0,0,0,0.55))",
          }}
        >
          <CheckerPiece color={dragPiece.color} king={dragPiece.king} size={44} />
        </div>
      )}

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

function CheckerFit({ color, king }: { color: CK.Color; king: boolean }) {
  const fill = color === "w" ? "#f2f2f5" : "#1d1d23";
  const edge = color === "w" ? "#b9b9c4" : "#000";
  const stroke = color === "w" ? "#2a2a31" : "#e8e8ee";
  return (
    <svg viewBox="0 0 48 48" style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }} aria-hidden>
      <circle cx="24" cy="26" r="17" fill={edge} opacity="0.8" />
      <circle cx="24" cy="24" r="17" fill={fill} stroke={stroke} strokeWidth="1.8" />
      <circle cx="24" cy="24" r="12" fill="none" stroke={stroke} strokeWidth="1.1" opacity="0.5" />
      {king && (
        <path
          d="M16 27l-1.6-8 5.2 3.6L24 15l4.4 7.6 5.2-3.6L32 27H16z"
          fill="#ffb020" stroke="#7a5200" strokeWidth="1.1" strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
