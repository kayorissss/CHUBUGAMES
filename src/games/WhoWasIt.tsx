import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { GameOver, GameHUD } from "./shell";
import HeadView from "../ui/HeadView";
import type { Friend } from "../core/types";

/**
 * КТО ЭТО БЫЛ — головы вспыхивают по очереди, надо повторить порядок.
 * Классическая «Саймон», только на друзьях. Каждый раунд +1 к цепочке.
 * Ошибка — конец. Показ ускоряется, чтобы не засыпать.
 */

type Phase = "idle" | "show" | "input" | "over";

export default function WhoWasIt({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seq, setSeq] = useState<number[]>([]);
  const [lit, setLit] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [round, setRound] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const best = s.games.memory?.best || 0;
  const startT = useRef(Date.now());
  const timers = useRef<number[]>([]);

  // берём шесть друзей на поле
  const pool: Friend[] = s.friends.slice(0, 6);

  const showMs =
    s.settings.difficulty === "insane" ? 380 : s.settings.difficulty === "chill" ? 700 : 520;

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  /** Проиграть последовательность игроку */
  const playSeq = useCallback(
    (list: number[]) => {
      setPhase("show");
      setLit(null);
      const gap = Math.max(240, showMs - list.length * 12);
      list.forEach((idx, i) => {
        timers.current.push(
          window.setTimeout(() => {
            setLit(idx);
            sfx.tap();
            haptic("light");
          }, i * gap + 260),
        );
        timers.current.push(
          window.setTimeout(() => setLit(null), i * gap + 260 + gap * 0.55),
        );
      });
      timers.current.push(
        window.setTimeout(() => {
          setPhase("input");
          setStep(0);
        }, list.length * gap + 400),
      );
    },
    [showMs],
  );

  const nextRound = useCallback(
    (prev: number[]) => {
      const next = [...prev, Math.floor(Math.random() * pool.length)];
      setSeq(next);
      setRound(next.length);
      clearTimers();
      playSeq(next);
    },
    [playSeq, pool.length],
  );

  const start = useCallback(() => {
    clearTimers();
    setSeq([]);
    setRound(0);
    setStep(0);
    setWrong(null);
    startT.current = Date.now();
    nextRound([]);
  }, [nextRound]);

  // автостарт
  useEffect(() => {
    if (phase === "idle") {
      const t = setTimeout(start, 500);
      return () => clearTimeout(t);
    }
  }, [phase, start]);

  const finish = useCallback(
    (reached: number) => {
      clearTimers();
      const sc = Math.max(0, reached - 1);
      const coins = Math.floor(sc * 42 * (1 + s.prestige * 0.12));
      const xp = Math.floor(sc * 8 + 14);
      setResult({ score: sc, coins, xp });
      setPhase("over");
      sfx.gameOver();
      haptic("error");
      addCoins(coins);
      addXp(xp);
      finishGame("memory", sc, Date.now() - startT.current);
      questProgress("plays", 1);
    },
    [addCoins, addXp, finishGame, questProgress, s.prestige],
  );

  const tapHead = (idx: number) => {
    if (phase !== "input") return;
    setLit(idx);
    setTimeout(() => setLit(null), 160);

    if (seq[step] === idx) {
      sfx.tap();
      haptic("light");
      const nextStep = step + 1;
      if (nextStep >= seq.length) {
        // раунд пройден
        sfx.crit();
        haptic("medium");
        setPhase("show");
        timers.current.push(window.setTimeout(() => nextRound(seq), 620));
      } else {
        setStep(nextStep);
      }
    } else {
      setWrong(idx);
      sfx.error();
      haptic("error");
      setTimeout(() => finish(seq.length), 520);
    }
  };

  const hint =
    phase === "show" ? "Смотри и запоминай" :
    phase === "input" ? `Повтори · ${step}/${seq.length}` :
    "Готовься";

  return (
    <div className="absolute inset-0" style={{ background: "var(--bg)" }}>
      <GameHUD score={round} best={best} onExit={onExit} label="РАУНД" />

      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ paddingTop: "calc(var(--sat) + 70px)", paddingInline: 18 }}
      >
        <motion.div
          key={hint}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="t-title-sm"
          style={{ marginBottom: 20, color: phase === "input" ? "var(--acc)" : "var(--text-mute)" }}
        >
          {hint}
        </motion.div>

        <div className="grid grid-cols-3" style={{ gap: 12, width: "100%", maxWidth: 340 }}>
          {pool.map((f, i) => {
            const on = lit === i;
            const bad = wrong === i;
            return (
              <motion.button
                key={f.id}
                type="button"
                disabled={phase !== "input"}
                onPointerDown={() => tapHead(i)}
                animate={{ scale: on ? 1.08 : 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="flex flex-col items-center justify-center"
                style={{
                  aspectRatio: "1", padding: 8,
                  borderRadius: "var(--r-lg)",
                  background: bad
                    ? "rgba(255,77,77,0.2)"
                    : on
                      ? "rgba(255,176,32,0.2)"
                      : "var(--surface-2)",
                  border: `2px solid ${bad ? "#FF4D4D" : on ? "var(--acc)" : "var(--surface-brd)"}`,
                  boxShadow: on ? "0 0 30px -6px var(--acc-glow)" : "none",
                  opacity: phase === "input" ? 1 : 0.92,
                  transition: "background .12s, border-color .12s, box-shadow .12s",
                }}
              >
                <HeadView friend={f} size={54} />
                <span className="t-caption clip1" style={{ marginTop: 5, fontSize: 9 }}>
                  {f.name}
                </span>
              </motion.button>
            );
          })}
        </div>

        <div className="t-caption text-center" style={{ marginTop: 22, lineHeight: 1.5 }}>
          Цепочка растёт каждый раунд. Ошибся — всё сначала.
        </div>
      </div>

      <AnimatePresence>
        {phase === "over" && (
          <GameOver
            score={result.score}
            best={best}
            coins={result.coins}
            xp={result.xp}
            onRetry={() => { setPhase("idle"); setWrong(null); }}
            onExit={onExit}
            title="ЗАБЫЛ"
            sub={`Цепочка из ${result.score} голов`}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
