import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { drawHead } from "../core/head";
import { fmt } from "../core/format";
import { sfx, haptic } from "../core/fx";
import { GameHUD, GameOver } from "./shell";
import { Panel, Tap } from "../ui/Glass";
import type { Friend } from "../core/types";

const N = 4;
interface Cell { v: number; id: number; x: number; y: number; nx: number; ny: number; merged?: boolean; born?: boolean }

let uid = 1;

export default function MergeHeads({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, bump, finishGame, questProgress } = useGame();
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
    if (!undoState || s.coins < 2000) { sfx.error(); haptic("error"); return; }
    sfx.buy();
    setCells(undoState.cells);
    setScore(undoState.score);
    setUndoState(null);
  };

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "var(--bg)" }}>
      <GameHUD score={score} best={s.games.merge.best} onExit={onExit} />

      <div className="flex-1 flex flex-col items-center justify-center px-4" style={{ paddingTop: 70 }}>
        <div className="w-full max-w-sm mb-3 flex items-center justify-between px-1">
          <div className="t-label">свайпай в любую сторону</div>
          <Tap
            onClick={doUndo}
            disabled={!undoState || s.coins < 2000}
            r="sm"
            className="px-3 py-1.5"
            style={{ fontSize: 11, fontWeight: 700 }}
            sound="none"
          >
            ↩ Отмена · 2K🪙
          </Tap>
        </div>

        <Panel r="xl" className="p-2.5 w-full max-w-sm" strong>
          <div ref={boardRef} className="relative w-full" style={{ aspectRatio: "1", touchAction: "none" }}>
            {Array.from({ length: N * N }).map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: `${((i % N) * 100) / N}%`, top: `${(Math.floor(i / N) * 100) / N}%`,
                  width: `${100 / N}%`, height: `${100 / N}%`, padding: 4,
                }}
              >
                <div style={{ width: "100%", height: "100%", borderRadius: 14, background: "rgba(255,255,255,0.045)" }} />
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
                  transition={{ type: "spring", stiffness: 520, damping: 34 }}
                  style={{ width: `${100 / N}%`, height: `${100 / N}%`, padding: 4 }}
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
          <Tap onClick={restart} r="md" className="px-4 py-2 t-title" style={{ fontSize: 12 }} sound="swoosh">
            ↻
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
  const lvl = Math.log2(v) - 1; // 2 -> 1
  const f = friends[(lvl - 1) % friends.length];
  const isBig = v >= 128;

  useEffect(() => {
    const c = ref.current;
    if (!c || !f || f.photo) return;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const size = 90;
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawHead(ctx, f.look, size / 2, size * 0.55, size * 0.33, { mouth: isBig ? 0.35 : 0.08 });
  }, [f, isBig]);

  return (
    <motion.div
      animate={pop ? { scale: [1, 1.16, 1] } : {}}
      transition={{ duration: 0.28 }}
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
      {f?.photo ? (
        <img src={f.photo} alt="" style={{ width: "62%", height: "62%", borderRadius: "50%", objectFit: "cover" }} />
      ) : (
        <canvas ref={ref} style={{ width: "72%", height: "72%" }} />
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
