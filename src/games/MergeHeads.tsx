import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { tr } from "../core/i18n";
import { drawHead } from "../core/head";
import { fmt } from "../core/format";
import { sfx, haptic } from "../core/fx";
import Icon from "../ui/Icon";
import { GameHUD, GameOver } from "./shell";
import { Panel, Tap } from "../ui/Glass";
import type { Friend } from "../core/types";

const N = 4;
/** Цена отката хода в монетах */
const UNDO_COST = 2000;
interface Cell { v: number; id: number; x: number; y: number; nx: number; ny: number; merged?: boolean; born?: boolean }

let uid = 1;

export default function MergeHeads({ onExit }: { onExit: () => void }) {
  const { s, set, addCoins, addXp, bump, finishGame, questProgress } = useGame();
  const [cells, setCells] = useState<Cell[]>([]);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0, best: 0 });
  const [undoState, setUndoState] = useState<{ cells: Cell[]; score: number } | null>(null);
  const startT = useRef(Date.now());
  const mergesRef = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const friends = s.friends;

  const spawn = useCallback((list: Cell[]): Cell[] => {
    const free: { x: number; y: number }[] = [];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++)
        if (!list.find((c) => c.nx === x && c.ny === y)) free.push({ x, y });
    if (!free.length) return list;
    const p = free[Math.floor(Math.random() * free.length)];
    return [
      ...list,
      { v: Math.random() < 0.88 ? 2 : 4, id: uid++, x: p.x, y: p.y, nx: p.x, ny: p.y, born: true },
    ];
  }, []);

  const restart = useCallback(() => {
    let l: Cell[] = [];
    l = spawn(l);
    l = spawn(l);
    setCells(l);
    setScore(0);
    setOver(false);
    setUndoState(null);
    mergesRef.current = 0;
    startT.current = Date.now();
  }, [spawn]);

  useEffect(() => { restart(); }, [restart]);

  const canMove = (list: Cell[]) => {
    if (list.length < N * N) return true;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const c = list.find((k) => k.nx === x && k.ny === y);
        if (!c) return true;
        const r = list.find((k) => k.nx === x + 1 && k.ny === y);
        const d = list.find((k) => k.nx === x && k.ny === y + 1);
        if (r && r.v === c.v) return true;
        if (d && d.v === c.v) return true;
      }
    return false;
  };

  const finish = useCallback(
    (finalScore: number) => {
      const coins = Math.floor(finalScore * 1.4 * (1 + s.prestige * 0.12));
      const xp = Math.floor(finalScore * 0.22 + 15);
      setResult({ score: finalScore, coins, xp, best: s.games.merge.best });
      setOver(true);
      sfx.gameOver();
      haptic("error");
      addCoins(coins);
      addXp(xp);
      finishGame("merge", finalScore, Date.now() - startT.current);
      bump("merges", mergesRef.current);
      questProgress("merges", mergesRef.current);
    },
    [addCoins, addXp, finishGame, bump, questProgress, s.prestige, s.games.merge.best],
  );

  const move = useCallback(
    (dir: "l" | "r" | "u" | "d") => {
      if (over) return;
      setCells((prev) => {
        const before = JSON.stringify(prev.map((c) => [c.nx, c.ny, c.v]));
        const grid: (Cell | null)[][] = Array.from({ length: N }, () => Array(N).fill(null));
        prev.forEach((c) => { grid[c.ny][c.nx] = { ...c, x: c.nx, y: c.ny, merged: false, born: false }; });

        let gained = 0;
        let mergeCount = 0;
        const horiz = dir === "l" || dir === "r";
        const rev = dir === "r" || dir === "d";

        for (let i = 0; i < N; i++) {
          let line: (Cell | null)[] = [];
          for (let j = 0; j < N; j++) line.push(horiz ? grid[i][j] : grid[j][i]);
          let vals = line.filter(Boolean) as Cell[];
          if (rev) vals.reverse();

          const out: Cell[] = [];
          for (let k = 0; k < vals.length; k++) {
            if (k + 1 < vals.length && vals[k].v === vals[k + 1].v) {
              const nv = vals[k].v * 2;
              gained += nv;
              mergeCount++;
              out.push({ ...vals[k], v: nv, merged: true });
              vals[k + 1].v = -1;
              k++;
            } else out.push(vals[k]);
          }
          if (rev) out.reverse();
          const placed: (Cell | null)[] = Array(N).fill(null);
          out.forEach((c, idx) => {
            const pos = rev ? N - out.length + idx : idx;
            placed[pos] = c;
          });
          for (let j = 0; j < N; j++) {
            const c = placed[j];
            if (horiz) grid[i][j] = c ? { ...c, nx: j, ny: i } : null;
            else grid[j][i] = c ? { ...c, nx: i, ny: j } : null;
          }
        }

        let next: Cell[] = [];
        for (let y = 0; y < N; y++)
          for (let x = 0; x < N; x++) if (grid[y][x]) next.push(grid[y][x]!);

        const after = JSON.stringify(next.map((c) => [c.nx, c.ny, c.v]));
        if (before === after) return prev;

        if (mergeCount) {
          mergesRef.current += mergeCount;
          sfx.merge();
          haptic("medium");
        } else {
          sfx.swoosh();
          haptic("light");
        }

        setUndoState({ cells: prev, score });
        const ns = score + gained;
        setScore(ns);
        next = spawn(next);
        if (!canMove(next)) setTimeout(() => finish(ns), 420);
        return next;
      });
    },
    [over, score, spawn, finish],
  );

  /* свайпы */
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const down = (e: PointerEvent) => { touch.current = { x: e.clientX, y: e.clientY }; };
    const up = (e: PointerEvent) => {
      if (!touch.current) return;
      const dx = e.clientX - touch.current.x;
      const dy = e.clientY - touch.current.y;
      touch.current = null;
      if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? "r" : "l");
      else move(dy > 0 ? "d" : "u");
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    const key = (e: KeyboardEvent) => {
      const m: any = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d" };
      if (m[e.key]) { e.preventDefault(); move(m[e.key]); }
    };
    window.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("keydown", key);
    };
  }, [move]);

  const doUndo = () => {
    if (!undoState || s.coins < UNDO_COST) { sfx.error(); haptic("error"); return; }
    sfx.buy();
    // Отмена платная — раньше цена показывалась, но монеты не списывались
    set((d) => { d.coins -= UNDO_COST; });
    setCells(undoState.cells);
    setScore(undoState.score);
    setUndoState(null);
  };

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "var(--bg)" }}>
      <GameHUD score={score} best={s.games.merge.best} onExit={onExit} />

      <div className="flex-1 flex flex-col items-center justify-center px-4" style={{ paddingTop: 70 }}>
        {/* Кнопка отмены была серой плашкой 11-м кеглем — её не замечали.
            Теперь она акцентная, когда доступна, и явно гаснет, когда нет. */}
        <div className="w-full max-w-sm mb-3 flex items-center justify-between" style={{ gap: 10 }}>
          <div className="t-caption clip1">{tr("Свайпай в любую сторону")}</div>
          {(() => {
            const canUndo = !!undoState && s.coins >= UNDO_COST;
            return (
              <button
                type="button"
                onClick={() => { if (canUndo) doUndo(); else { sfx.error(); haptic("error"); } }}
                disabled={!undoState}
                className="shrink-0 inline-flex items-center"
                style={{
                  gap: 6, padding: "9px 13px", borderRadius: "var(--r-md)",
                  background: canUndo ? "var(--acc)" : "var(--surface-2)",
                  color: canUndo ? "var(--acc-ink)" : "var(--text-mute)",
                  border: `1px solid ${canUndo ? "var(--acc)" : "var(--btn-brd)"}`,
                  fontSize: 11.5, fontWeight: 700,
                  opacity: undoState ? 1 : 0.5,
                  transition: "background .16s, color .16s",
                }}
              >
                <Icon name="refresh" size={13} />
                {tr("ОТМЕНА")} · {fmt(UNDO_COST)}
              </button>
            );
          })()}
        </div>

        <Panel r="xl" className="p-2.5 w-full max-w-sm" strong>
          <div ref={boardRef} className="relative w-full" style={{ aspectRatio: "1", touchAction: "none" }}>
            {Array.from({ length: N * N }).map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${((i % N) * 100) / N}%`, top: `${(Math.floor(i / N) * 100) / N}%`,
                  width: `${100 / N}%`, height: `${100 / N}%`, padding: 5,
                  boxSizing: "border-box",
                }}
              >
                <div style={{ width: "100%", height: "100%", borderRadius: 12, background: "var(--fill-2)" }} />
              </div>
            ))}
            <AnimatePresence>
              {cells.map((c) => (
                <motion.div
                  key={c.id}
                  className="absolute"
                  initial={{
                    left: `${(c.x * 100) / N}%`, top: `${(c.y * 100) / N}%`,
                    scale: c.born ? 0 : 1, opacity: c.born ? 0 : 1,
                  }}
                  animate={{
                    left: `${(c.nx * 100) / N}%`, top: `${(c.ny * 100) / N}%`,
                    scale: 1, opacity: 1,
                  }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  /* Помягче, чем было (520/34): при жёсткой пружине плитка
                     «телепортировалась» и путь свайпа не читался. */
                  transition={{ type: "spring", stiffness: 340, damping: 30, mass: 0.7 }}
                  style={{
                    width: `${100 / N}%`, height: `${100 / N}%`,
                    padding: 5, boxSizing: "border-box",
                  }}
                >
                  <Tile v={c.v} friends={friends} pop={!!c.merged} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Panel>

        <div className="flex gap-2 mt-4 w-full max-w-sm">
          <Panel r="md" className="flex-1 py-2 text-center">
            <div className="t-num acc-text" style={{ fontSize: 17 }}>{fmt(Math.max(...cells.map((c) => c.v), 0))}</div>
            <div className="t-label" style={{ fontSize: 9 }}>максимум</div>
          </Panel>
          <Panel r="md" className="flex-1 py-2 text-center">
            <div className="t-num" style={{ fontSize: 17 }}>{mergesRef.current}</div>
            <div className="t-label" style={{ fontSize: 9 }}>слияний</div>
          </Panel>
          <Tap onClick={restart} r="md" center className="px-4 py-2" sound="swoosh">
            <Icon name="refresh" size={16} />
          </Tap>
        </div>
      </div>

      {over && (
        <GameOver
          score={result.score} best={result.best} coins={result.coins} xp={result.xp}
          onRetry={restart} onExit={onExit} title="ТУПИК"
          sub={`Максимальная голова: ${Math.max(...cells.map((c) => c.v), 0)}`}
        />
      )}
    </div>
  );
}

function Tile({ v, friends, pop }: { v: number; friends: Friend[]; pop: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // v = 2 -> первый друг, дальше по порядку. Раньше индекс уходил в -1
  // и часть плиток оставалась пустой.
  const step = Math.max(0, Math.round(Math.log2(v)) - 1);
  const f = friends.length ? friends[step % friends.length] : undefined;
  const isBig = v >= 128;

  useEffect(() => {
    const c = ref.current;
    if (!c || !f || f.photo) return;

    const paint = () => {
      const rect = c.getBoundingClientRect();
      const size = Math.max(24, Math.round(rect.width || 90));
      const dpr = Math.min(2.5, window.devicePixelRatio || 1);
      c.width = Math.round(size * dpr);
      c.height = Math.round(size * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      drawHead(ctx, f.look, size / 2, size * 0.55, size * 0.33, { mouth: isBig ? 0.35 : 0.08 });
    };

    paint();
    // плитка меняет размер при повороте экрана — перерисовываем
    const ro = new ResizeObserver(paint);
    ro.observe(c);
    return () => ro.disconnect();
  }, [f, isBig]);

  return (
    <motion.div
      /* Слияние должно быть видно: плитка подскакивает сильнее и коротко
         вспыхивает акцентом. Пользователь просил, чтобы было понятно,
         «куда ты и во что объединил». */
      animate={pop
        ? { scale: [1, 1.24, 0.96, 1], rotate: [0, -2.5, 1.5, 0] }
        : { scale: 1, rotate: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        borderRadius: 12,
        // плотный непрозрачный фон: на стекле головы сливались с полем
        background: isBig
          ? `linear-gradient(160deg, color-mix(in srgb, var(--acc) 30%, var(--surface-2)), var(--surface-2))`
          : "var(--surface-2)",
        border: `1px solid ${isBig ? "color-mix(in srgb, var(--acc) 55%, transparent)" : "var(--surface-brd)"}`,
        boxShadow: isBig ? "0 0 20px -8px var(--acc-glow)" : "none",
      }}
    >
      {/* вспышка в момент слияния */}
      <AnimatePresence>
        {pop && (
          <motion.span
            initial={{ opacity: 0.85, scale: 0.7 }}
            animate={{ opacity: 0, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            style={{
              position: "absolute", inset: 0, borderRadius: 12,
              background: "radial-gradient(circle, var(--acc-glow), transparent 70%)",
              pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>

      {f?.photo ? (
        <img src={f.photo} alt="" style={{ width: "62%", height: "62%", borderRadius: "50%", objectFit: "cover" }} />
      ) : (
        <canvas ref={ref} style={{ width: "78%", height: "78%", display: "block" }} />
      )}
      <div
        className="t-num absolute"
        style={{
          bottom: 3, fontSize: v >= 1024 ? 9.5 : 11,
          padding: "1px 6px", borderRadius: 999, lineHeight: 1.35,
          background: "rgba(0,0,0,0.42)",
          color: isBig ? "var(--acc)" : "#e8e8f0",
        }}
      >
        {v}
      </div>
    </motion.div>
  );
}
