import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { tr } from "../core/i18n";
import { drawHead } from "../core/head";
import { sfx, haptic } from "../core/fx";
import Icon from "../ui/Icon";
import { GameHUD, GameOver, Countdown } from "./shell";
import type { Friend } from "../core/types";

const HOLES = 9;
const ROUND_MS = 60000;

interface Mole {
  hole: number; friend: Friend; bad: boolean; gold: boolean;
  t: number; life: number; hit: boolean; id: number;
}

export default function WhackFriend({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, bump, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [cd, setCd] = useState(3);
  const [moles, setMoles] = useState<Mole[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(ROUND_MS);
  const [combo, setCombo] = useState(0);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });
  const [fx, setFx] = useState<{ id: number; hole: number; txt: string; bad: boolean }[]>([]);

  const molesRef = useRef<Mole[]>([]);
  const uid = useRef(1);
  const whacks = useRef(0);
  const startT = useRef(Date.now());
  const running = useRef(false);
  const comboRef = useRef(0);

  const speedBase = s.settings.difficulty === "insane" ? 620 : s.settings.difficulty === "chill" ? 1100 : 830;

  const restart = useCallback(() => {
    molesRef.current = [];
    setMoles([]);
    setScore(0);
    setLives(3);
    setTimeLeft(ROUND_MS);
    setCombo(0);
    comboRef.current = 0;
    whacks.current = 0;
    startT.current = Date.now();
    running.current = false;
    setPhase("count");
    setCd(3);
  }, []);

  useEffect(() => {
    if (phase !== "count") return;
    if (cd < 0) { running.current = true; startT.current = Date.now(); setPhase("play"); return; }
    sfx.click();
    const t = setTimeout(() => setCd((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, cd]);

  const finish = useCallback(
    (final: number) => {
      running.current = false;
      const coins = Math.floor(final * 3.2 * (1 + s.prestige * 0.12));
      const xp = Math.floor(final * 0.55 + 15);
      setResult({ score: final, coins, xp });
      setPhase("over");
      sfx.gameOver();
      haptic("error");
      addCoins(coins);
      addXp(xp);
      finishGame("whack", final, Date.now() - startT.current);
      bump("whacks", whacks.current);
      questProgress("whacks", whacks.current);
    },
    [addCoins, addXp, finishGame, bump, questProgress, s.prestige],
  );

  /* игровой тик */
  useEffect(() => {
    if (phase !== "play") return;
    let raf = 0;
    let last = performance.now();
    let spawnT = 400;

    const loop = (now: number) => {
      const dt = Math.min(60, now - last);
      last = now;
      if (!running.current) return;

      setTimeLeft((t) => {
        const nt = t - dt;
        if (nt <= 0) { setTimeout(() => finish(scoreRef.current), 0); return 0; }
        return nt;
      });

      const progress = 1 - timeRef.current / ROUND_MS;
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = Math.max(230, speedBase * (1 - progress * 0.55)) * (0.7 + Math.random() * 0.6);
        const busy = molesRef.current.map((m) => m.hole);
        const free = Array.from({ length: HOLES }, (_, i) => i).filter((i) => !busy.includes(i));
        if (free.length) {
          const hole = free[Math.floor(Math.random() * free.length)];
          const roll = Math.random();
          const bad = roll < 0.16 + progress * 0.08;
          const gold = !bad && roll > 0.94;
          const f = s.friends[Math.floor(Math.random() * s.friends.length)];
          const life = Math.max(560, (1500 - progress * 700) * (gold ? 0.62 : 1));
          molesRef.current.push({
            hole, friend: f, bad, gold, t: 0, life, hit: false, id: uid.current++,
          });
        }
      }

      let missed = false;
      molesRef.current = molesRef.current.filter((m) => {
        m.t += dt;
        if (m.t > m.life) {
          if (!m.hit && !m.bad) { missed = true; }
          return false;
        }
        return true;
      });
      if (missed) {
        comboRef.current = 0;
        setCombo(0);
      }
      setMoles([...molesRef.current]);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const scoreRef = useRef(0);
  scoreRef.current = score;
  const timeRef = useRef(ROUND_MS);
  timeRef.current = timeLeft;

  const hit = (m: Mole) => {
    if (m.hit || phase !== "play") return;
    m.hit = true;
    const idx = molesRef.current.findIndex((x) => x.id === m.id);
    if (idx >= 0) molesRef.current.splice(idx, 1);
    setMoles([...molesRef.current]);

    if (m.bad) {
      setLives((l) => {
        const nl = l - 1;
        if (nl <= 0) setTimeout(() => finish(scoreRef.current), 0);
        return nl;
      });
      comboRef.current = 0;
      setCombo(0);
      sfx.hit();
      haptic("heavy");
      pushFx(m.hole, "−1 ЖИЗНЬ", true);
    } else {
      whacks.current++;
      comboRef.current++;
      setCombo(comboRef.current);
      const base = m.gold ? 25 : 5;
      const mult = 1 + Math.floor(comboRef.current / 5) * 0.25;
      const pts = Math.floor(base * mult);
      setScore((v) => v + pts);
      sfx.whack();
      haptic(m.gold ? "success" : "medium");
      pushFx(m.hole, `+${pts}`, false);
    }
  };

  const pushFx = (hole: number, txt: string, bad: boolean) => {
    const id = uid.current++;
    setFx((p) => [...p.slice(-8), { id, hole, txt, bad }]);
    setTimeout(() => setFx((p) => p.filter((f) => f.id !== id)), 700);
  };

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "var(--bg)" }}>
      <GameHUD
        score={score} best={s.games.whack.best} onExit={onExit}
        lives={{ value: lives, max: 3 }}
      />

      <div
        className="flex-1 flex flex-col items-center justify-center px-4"
        style={{ paddingTop: "calc(var(--sat) + 62px)" }}
      >
        {/* Таймер — крупной полосой НАД полем, а не мелкой цифрой в углу
            рядом с жизнями. Пользователь просил именно так. */}
        <div className="w-full max-w-sm" style={{ marginBottom: 12 }}>
          <div className="flex items-baseline justify-between" style={{ marginBottom: 6 }}>
            <span className="t-label" style={{ fontSize: 9 }}>{tr("ОСТАЛОСЬ")}</span>
            <span
              className="t-num"
              style={{
                fontSize: 26, lineHeight: 1,
                color: timeLeft < 10000 ? "var(--danger)" : "var(--text)",
              }}
            >
              {Math.ceil(timeLeft / 1000)}<span className="t-label" style={{ fontSize: 10, marginLeft: 3 }}>{tr("СЕК")}</span>
            </span>
          </div>
          <div style={{ height: 7, borderRadius: 999, background: "var(--n-300)", overflow: "hidden", border: "1px solid var(--n-400)" }}>
            <div
              style={{
                width: `${Math.max(0, Math.min(100, (timeLeft / ROUND_MS) * 100))}%`,
                height: "100%",
                background: timeLeft < 10000 ? "var(--danger)" : "var(--acc)",
                transition: "width .2s linear, background .3s",
              }}
            />
          </div>
        </div>

        <AnimatePresence>
          {combo >= 3 && (
            <motion.div
              key="combo"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="t-display acc-text"
              style={{ fontSize: 24, marginBottom: 8 }}
            >
              {tr("КОМБО")} ×{combo}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
          {Array.from({ length: HOLES }).map((_, i) => {
            const m = moles.find((x) => x.hole === i);
            const f = fx.find((x) => x.hole === i);
            return (
              <div key={i} className="relative" style={{ aspectRatio: "1" }}>
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{
                    borderRadius: 20,
                    background: "radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0.55), rgba(255,255,255,0.04))",
                    border: "1px solid var(--glass-brd)",
                  }}
                  onPointerDown={() => m && hit(m)}
                >
                  <AnimatePresence>
                    {m && (
                      <motion.div
                        key={m.id}
                        initial={{ y: "100%" }}
                        animate={{ y: "12%" }}
                        exit={{ y: "100%", opacity: 0.4 }}
                        transition={{ type: "spring", stiffness: 380, damping: 26 }}
                        className="absolute inset-0 flex items-end justify-center"
                      >
                        <MoleHead friend={m.friend} bad={m.bad} gold={m.gold} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <AnimatePresence>
                  {f && (
                    <motion.div
                      key={f.id}
                      initial={{ opacity: 1, y: 0, scale: 1.1 }}
                      animate={{ opacity: 0, y: -34, scale: 1.3 }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none t-num"
                      style={{ fontSize: 20, color: f.bad ? "#ff5a3c" : "var(--acc)", fontWeight: 900 }}
                    >
                      {f.txt}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="t-label mt-5 text-center px-8" style={{ lineHeight: 1.6 }}>
          Бей всех, кроме <span style={{ color: "#ff5a3c" }}>КРАСНЫХ</span>.
          Золотые дают ×5 очков
        </div>
      </div>

      <AnimatePresence>{phase === "count" && <Countdown n={cd} />}</AnimatePresence>

      {phase === "over" && (
        <GameOver
          score={result.score} best={s.games.whack.best} coins={result.coins} xp={result.xp}
          onRetry={restart} onExit={onExit}
          title={lives <= 0 ? "ПРОМАХ" : "ВРЕМЯ"}
          sub={`Прибито голов: ${whacks.current}`}
        />
      )}
    </div>
  );
}

function MoleHead({ friend, bad, gold }: { friend: Friend; bad: boolean; gold: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || friend.photo) return;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const size = 110;
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawHead(ctx, friend.look, size / 2, size * 0.5, size * 0.36, {
      mouth: bad ? 0.6 : 0.2, angry: bad ? 1 : 0,
    });
  }, [friend, bad]);

  return (
    <div
      className="relative"
      style={{
        width: "84%", height: "84%",
        filter: bad
          ? "drop-shadow(0 0 12px rgba(255,60,40,0.95)) saturate(1.5) hue-rotate(-12deg)"
          : gold
            ? "drop-shadow(0 0 16px var(--acc-glow)) saturate(1.4) brightness(1.2)"
            : "none",
      }}
    >
      {friend.photo ? (
        <img
          src={friend.photo} alt=""
          style={{
            width: "100%", height: "100%", objectFit: "cover", borderRadius: "50% 50% 30% 30%",
            border: bad ? "3px solid #ff3c28" : gold ? "3px solid var(--acc)" : "none",
          }}
        />
      ) : (
        <canvas ref={ref} style={{ width: "100%", height: "100%" }} />
      )}
      {bad && (
        <div className="absolute inset-0 flex items-start justify-center" style={{ color: "#ff5a3c" }}>
          <Icon name="cross" size={18} />
        </div>
      )}
      {gold && (
        <div className="absolute" style={{ top: -4, right: 0, color: "var(--acc)" }}><Icon name="star" size={15} /></div>
      )}
    </div>
  );
}
