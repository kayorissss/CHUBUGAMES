import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { GameHUD, GameOver, Countdown } from "./shell";
import { Panel } from "../ui/Glass";
import Icon from "../ui/Icon";

/**
 * СТОЛОВКА — раздавай подносы по окнам нужного цвета.
 * Поднос едет снизу, свайпаешь его пальцем в одно из трёх окон.
 * Правильно — очки и время; ошибка — минус жизнь.
 * Управление именно перетаскиванием, а не тапом.
 */

type Slot = 0 | 1 | 2;

const SLOT_COLORS = ["#59FF9E", "#FFB020", "#8FD3FF"];
const SLOT_NAMES = ["ПЕРВОЕ", "ВТОРОЕ", "КОМПОТ"];
const DISHES = [
  ["Борщ", "Щи", "Суп"],
  ["Котлета", "Пюре", "Гречка"],
  ["Компот", "Чай", "Морс"],
];

const ROUND_MS = 60000;

interface Tray {
  id: number;
  kind: Slot;
  dish: string;
  x: number;      // 0..1 позиция по горизонтали
  y: number;      // 0..1 снизу вверх, для анимации ухода
  gone: boolean;
}

export default function Canteen({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [cd, setCd] = useState(3);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_MS);
  const [tray, setTray] = useState<Tray | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<Slot | null>(null);
  const [pop, setPop] = useState<{ id: number; slot: Slot; ok: boolean } | null>(null);
  const [served, setServed] = useState(0);

  const best = s.games.sort?.best || 0;
  const wrapRef = useRef<HTMLDivElement>(null);
  const uid = useRef(1);
  const startT = useRef(Date.now());
  const running = useRef(false);
  const comboRef = useRef(0);
  const livesRef = useRef(3);
  const scoreRef = useRef(0);
  const servedRef = useRef(0);

  const nextTray = useCallback(() => {
    const kind = Math.floor(Math.random() * 3) as Slot;
    setTray({
      id: uid.current++,
      kind,
      dish: DISHES[kind][Math.floor(Math.random() * 3)],
      x: 0.5,
      y: 0,
      gone: false,
    });
    setDrag(null);
    setHover(null);
  }, []);

  const restart = useCallback(() => {
    running.current = false;
    scoreRef.current = 0;
    comboRef.current = 0;
    livesRef.current = 3;
    servedRef.current = 0;
    setScore(0);
    setCombo(0);
    setLives(3);
    setServed(0);
    setTimeLeft(ROUND_MS);
    setTray(null);
    setPhase("count");
    setCd(3);
  }, []);

  useEffect(() => {
    if (phase !== "count") return;
    if (cd < 0) {
      running.current = true;
      startT.current = Date.now();
      setPhase("play");
      nextTray();
      return;
    }
    sfx.click();
    const t = setTimeout(() => setCd((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, cd, nextTray]);

  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const finish = useCallback(() => {
    if (!running.current) return;
    running.current = false;
    const sc = scoreRef.current;
    const coins = Math.floor(sc * 2.9 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 0.6 + 16);
    setResult({ score: sc, coins, xp });
    setPhase("over");
    sfx.gameOver();
    haptic("error");
    addCoins(coins);
    addXp(xp);
    finishGame("sort", sc, Date.now() - startT.current);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  // таймер раунда
  useEffect(() => {
    if (phase !== "play") return;
    const iv = setInterval(() => {
      const left = ROUND_MS - (Date.now() - startT.current);
      setTimeLeft(Math.max(0, left));
      if (left <= 0) finish();
    }, 100);
    return () => clearInterval(iv);
  }, [phase, finish]);

  /** Отдать поднос в окно */
  const serve = useCallback(
    (slot: Slot) => {
      const t = tray;
      if (!t || !running.current) return;
      const ok = slot === t.kind;
      setPop({ id: t.id, slot, ok });
      setTimeout(() => setPop(null), 420);

      if (ok) {
        comboRef.current += 1;
        const gain = 10 + Math.min(20, comboRef.current * 2);
        scoreRef.current += gain;
        servedRef.current += 1;
        setScore(scoreRef.current);
        setCombo(comboRef.current);
        setServed(servedRef.current);
        sfx.coin();
        haptic("light");
      } else {
        comboRef.current = 0;
        livesRef.current -= 1;
        setCombo(0);
        setLives(livesRef.current);
        sfx.error();
        haptic("error");
        if (livesRef.current <= 0) {
          setTray(null);
          finish();
          return;
        }
      }
      nextTray();
    },
    [tray, nextTray, finish],
  );

  /* ---------- перетаскивание ---------- */
  const slotAt = (clientX: number, clientY: number): Slot | null => {
    const el = wrapRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const relY = (clientY - r.top) / r.height;
    if (relY > 0.42) return null;           // окна только в верхней части
    const relX = (clientX - r.left) / r.width;
    const i = Math.floor(relX * 3);
    return (i < 0 ? 0 : i > 2 ? 2 : i) as Slot;
  };

  const onDown = (e: React.PointerEvent) => {
    if (phase !== "play" || !tray) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ x: e.clientX, y: e.clientY });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    setDrag({ x: e.clientX, y: e.clientY });
    setHover(slotAt(e.clientX, e.clientY));
  };
  const onUp = (e: React.PointerEvent) => {
    if (!drag) return;
    const slot = slotAt(e.clientX, e.clientY);
    setDrag(null);
    setHover(null);
    if (slot !== null) serve(slot);
  };

  const timePct = timeLeft / ROUND_MS;
  const wrapRect = wrapRef.current?.getBoundingClientRect();

  return (
    <div className="absolute inset-0" style={{ background: "var(--bg)" }}>
      <GameHUD
        score={score}
        best={best}
        onExit={onExit}
        label="ОЧКИ"
        extra={
          <div
            className="shrink-0 flex items-center"
            style={{
              gap: 4, padding: "9px 11px", borderRadius: "var(--r-md)",
              background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
            }}
          >
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ color: i < lives ? "#FF4D4D" : "var(--btn-brd)", lineHeight: 0 }}>
                <Icon name="heart" size={13} />
              </span>
            ))}
          </div>
        }
      />

      {/* полоса времени */}
      <div
        className="absolute left-0 right-0"
        style={{ top: "calc(var(--sat) + 68px)", padding: "0 12px", zIndex: 20 }}
      >
        <div style={{ height: 4, borderRadius: 999, background: "var(--track)", overflow: "hidden" }}>
          <motion.div
            animate={{ width: `${timePct * 100}%` }}
            transition={{ duration: 0.1 }}
            style={{
              height: "100%",
              background: timePct < 0.2 ? "#FF4D4D" : "var(--acc)",
            }}
          />
        </div>
      </div>

      <div
        ref={wrapRef}
        className="absolute inset-0"
        style={{ touchAction: "none", paddingTop: "calc(var(--sat) + 86px)" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* окна раздачи */}
        <div className="flex" style={{ gap: 8, padding: "0 12px", height: "31%" }}>
          {[0, 1, 2].map((i) => {
            const on = hover === i;
            const col = SLOT_COLORS[i];
            return (
              <motion.div
                key={i}
                animate={{ scale: on ? 1.04 : 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
                className="flex-1 flex flex-col items-center justify-center"
                style={{
                  borderRadius: "var(--r-lg)",
                  background: on ? `${col}22` : "var(--surface-2)",
                  border: `2px ${on ? "solid" : "dashed"} ${on ? col : "var(--btn-brd)"}`,
                  boxShadow: on ? `0 0 26px -6px ${col}` : "none",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: col, opacity: on ? 1 : 0.75,
                  }}
                />
                <span className="t-label" style={{ fontSize: 9, color: on ? col : "var(--text-mute)" }}>
                  {SLOT_NAMES[i]}
                </span>

                <AnimatePresence>
                  {pop && pop.slot === i && (
                    <motion.span
                      initial={{ opacity: 0, y: 6, scale: 0.7 }}
                      animate={{ opacity: 1, y: -12, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="t-title-sm absolute"
                      style={{ color: pop.ok ? "#59FF9E" : "#FF4D4D", fontSize: 13 }}
                    >
                      {pop.ok ? "+" : "×"}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* подсказка */}
        <div className="t-caption text-center" style={{ marginTop: 14, opacity: 0.75 }}>
          Тяни поднос пальцем в нужное окно
        </div>

        {/* поднос */}
        <div className="absolute left-0 right-0 flex justify-center" style={{ bottom: "13%" }}>
          <AnimatePresence mode="popLayout">
            {tray && (
              <motion.div
                key={tray.id}
                initial={{ y: 90, opacity: 0, scale: 0.9 }}
                animate={
                  drag && wrapRect
                    ? {
                        x: drag.x - wrapRect.left - wrapRect.width / 2,
                        y: drag.y - wrapRect.top - wrapRect.height * 0.87,
                        opacity: 1, scale: 1.05,
                      }
                    : { x: 0, y: 0, opacity: 1, scale: 1 }
                }
                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                transition={
                  drag
                    ? { type: "spring", stiffness: 900, damping: 45, mass: 0.4 }
                    : { type: "spring", stiffness: 320, damping: 26 }
                }
              >
                <Panel
                  r="lg"
                  strong
                  className="flex flex-col items-center"
                  style={{
                    padding: "16px 22px", gap: 9, minWidth: 148,
                    border: `2px solid ${SLOT_COLORS[tray.kind]}`,
                    boxShadow: `0 12px 34px -12px ${SLOT_COLORS[tray.kind]}`,
                  }}
                >
                  <span
                    style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: SLOT_COLORS[tray.kind],
                    }}
                  />
                  <span className="t-title-sm" style={{ fontSize: 14 }}>{tray.dish}</span>
                  <span className="t-label" style={{ fontSize: 8.5 }}>
                    {SLOT_NAMES[tray.kind]}
                  </span>
                </Panel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* счётчик выданных */}
        <div
          className="absolute t-caption"
          style={{ bottom: "5%", left: 0, right: 0, textAlign: "center" }}
        >
          выдано {served}
          {combo > 2 && <span className="acc-text"> · серия {combo}</span>}
        </div>
      </div>

      <AnimatePresence>
        {phase === "count" && <Countdown n={cd} />}
      </AnimatePresence>

      {phase === "over" && (
        <GameOver
          score={result.score}
          best={best}
          coins={result.coins}
          xp={result.xp}
          onRetry={restart}
          onExit={onExit}
          title="ПЕРЕМЕНА"
          sub={lives <= 0 ? "Очередь тебя сожрала" : "Смена окончена"}
        />
      )}
    </div>
  );
}
