import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { GameOver, GameHUD, Countdown, HudStat } from "./shell";
import HeadView from "../ui/HeadView";
import Icon, { type IconName } from "../ui/Icon";
import { tr } from "../core/i18n";

/**
 * ЧУБУ-ТАМАГОЧИ — «ухаживай за мной, чтобы я не похудел».
 *
 * Похоже на игру про Тома: у подопечного четыре шкалы, все ползут вниз.
 * Твоя задача — успевать: кормить, мыть, стирать и вовремя сажать на
 * унитаз (а если разъелся до предела — сразу на два).
 *
 * Смысл в конфликте: еда роняет чистоту и наполняет мочевой пузырь, так
 * что бездумно кормить нельзя. Чем дольше держишься, тем быстрее падают
 * шкалы, — поэтому забег конечен и есть за что бороться.
 */

type Need = "food" | "clean" | "laundry" | "toilet";

interface NeedDef {
  id: Need;
  label: string;
  icon: IconName;
  color: string;
  /** Сколько единиц теряется в секунду на первом уровне */
  drain: number;
  action: string;
}

const NEEDS: NeedDef[] = [
  { id: "food", label: "Сытость", icon: "burger", color: "#FFB020", drain: 3.1, action: "КОРМИТЬ" },
  { id: "clean", label: "Чистота", icon: "sparkle", color: "#8FD3FF", drain: 2.4, action: "МЫТЬ" },
  { id: "laundry", label: "Одежда", icon: "shop", color: "#C89BFF", drain: 1.9, action: "СТИРАТЬ" },
  { id: "toilet", label: "Терпит", icon: "warn", color: "#59FF9E", drain: 2.7, action: "НА УНИТАЗ" },
];

const TICK = 250;

/* Проверено симуляцией идеального игрока (250 партий на конфигурацию).
   При первых числах партия тянулась 342 с и всегда обрывалась на унитазе —
   остальные шкалы не успевали стать проблемой. Теперь средняя партия
   около 150 с, а проигрыш приходит и от голода, и от унитаза. */
const RAMP = 0.45;          // насколько быстрее текут шкалы с каждым уровнем
const LVL_STEP = 700;       // очков на уровень
const GAIN = 74;            // сколько восстанавливает действие
const GAIN_TOILET_HUGE = 62;
const FOOD_DIRT = 9;        // еда пачкает
const FOOD_BLADDER = 13;    // и наполняет пузырь
const FAT_AT = 70;          // выше этой сытости начинает набирать вес
const THIN_AT = 30;
const GAIN_RATE = 0.42;     // кг/с при перекорме
const LOSE_RATE = 0.9;      // кг/с при голоде
const HUGE_AT = 95;         // с этого веса нужны два унитаза

export default function ChubPet({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [cd, setCd] = useState(3);
  const [bars, setBars] = useState<Record<Need, number>>({
    food: 82, clean: 78, laundry: 85, toilet: 80,
  });
  const [weight, setWeight] = useState(70);      // кг: цель — не похудеть
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [busy, setBusy] = useState<Need | null>(null);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });
  const [flash, setFlash] = useState<string | null>(null);

  const best = s.games.pet?.best || 0;
  const pet = s.friends[0];
  const startT = useRef(Date.now());
  const ended = useRef(false);
  const barsRef = useRef(bars);
  barsRef.current = bars;
  const weightRef = useRef(weight);
  weightRef.current = weight;

  /** Разъелся — нужно два унитаза, шутка пользователя вживую */
  const huge = weight >= HUGE_AT;

  const end = useCallback((reason: string) => {
    if (ended.current) return;
    ended.current = true;
    const sc = Math.floor(scoreRef.current);
    const coins = Math.floor(sc * 3.2 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 0.6 + 20);
    setResult({ score: sc, coins, xp });
    setFlash(reason);
    setPhase("over");
    sfx.gameOver();
    haptic("error");
    addCoins(coins);
    addXp(xp);
    finishGame("pet", sc, Date.now() - startT.current);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  const scoreRef = useRef(0);
  scoreRef.current = score;

  useEffect(() => {
    if (phase !== "count") return;
    if (cd < 0) { startT.current = Date.now(); setPhase("play"); return; }
    sfx.click();
    const t = setTimeout(() => setCd((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, cd]);

  /* главный тик: шкалы падают, вес меняется, очки капают */
  useEffect(() => {
    if (phase !== "play") return;
    const iv = setInterval(() => {
      const secs = TICK / 1000;
      const lvl = 1 + Math.floor(scoreRef.current / LVL_STEP);
      setLevel(lvl);
      const speed = 1 + (lvl - 1) * RAMP;

      setBars((prev) => {
        const next = { ...prev };
        for (const n of NEEDS) {
          next[n.id] = Math.max(0, prev[n.id] - n.drain * speed * secs);
        }
        return next;
      });

      setWeight((wgt) => {
        // голодный — худеет; сытый — набирает
        const food = barsRef.current.food;
        const d =
          food < THIN_AT ? -LOSE_RATE * secs
            : food > FAT_AT ? GAIN_RATE * secs
              : -0.12 * secs;
        const nw = Math.max(35, Math.min(120, wgt + d));
        if (nw <= 45) end(tr("Ты похудел до костей"));
        return nw;
      });

      setScore((v) => v + 10 * secs * speed);

      // провал по любой шкале
      const b = barsRef.current;
      if (b.toilet <= 0) end(tr("Не добежал до унитаза"));
      else if (b.food <= 0) end(tr("Голодный обморок"));
      else if (b.clean <= 0) end(tr("От тебя все разбежались"));
      else if (b.laundry <= 0) end(tr("Надеть больше нечего"));
    }, TICK);
    return () => clearInterval(iv);
  }, [phase, end]);

  /** Действие: занимает время, поэтому нельзя чинить всё сразу */
  const doAction = (n: NeedDef) => {
    if (phase !== "play" || busy) return;
    setBusy(n.id);
    sfx.tap();
    haptic("light");

    // унитаз при большом весе занимает вдвое дольше — «на два унитаза»
    const dur = n.id === "toilet" && huge ? 1500 : 850;

    setTimeout(() => {
      setBars((prev) => {
        const next = { ...prev };
        next[n.id] = Math.min(
          100,
          prev[n.id] + (n.id === "toilet" && huge ? GAIN_TOILET_HUGE : GAIN),
        );
        // Побочные эффекты: кормёжка пачкает и наполняет пузырь.
        // Без этого можно было бы просто жать «кормить» без конца.
        if (n.id === "food") {
          next.clean = Math.max(0, next.clean - FOOD_DIRT);
          next.toilet = Math.max(0, next.toilet - FOOD_BLADDER);
        }
        if (n.id === "clean") next.laundry = Math.max(0, next.laundry - 7);
        return next;
      });
      setScore((v) => v + 40);
      setBusy(null);
      sfx.coin();
    }, dur);
  };

  const restart = () => {
    ended.current = false;
    setBars({ food: 82, clean: 78, laundry: 85, toilet: 80 });
    setWeight(70); setScore(0); setLevel(1); setBusy(null); setFlash(null);
    setCd(3); setPhase("count");
  };

  const worst = NEEDS.reduce((a, b) => (bars[a.id] < bars[b.id] ? a : b));
  const mood = bars[worst.id] < 25 ? "плохо" : bars[worst.id] < 55 ? "так себе" : "норм";

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "var(--bg)" }}>
      <GameHUD score={Math.floor(score)} best={best} onExit={onExit} label={tr("ОЧКИ")}
        extra={<HudStat label={tr("УРОВЕНЬ")} value={level} tone="acc" min={50} />}
      />

      <div
        className="flex-1 flex flex-col overflow-y-auto"
        style={{ padding: "calc(var(--sat) + 74px) 16px calc(var(--sab) + 26px)" }}
      >
        {/* Подопечный */}
        <div
          className="flex flex-col items-center"
          style={{
            padding: "18px 14px", borderRadius: "var(--r-xl)",
            background: "var(--surface)", border: "1px solid var(--surface-brd)",
            marginBottom: 14,
          }}
        >
          <motion.div
            animate={
              busy
                ? { scale: [1, 1.08, 1], rotate: [0, -4, 4, 0] }
                : bars[worst.id] < 25
                  ? { x: [0, -4, 4, 0] }
                  : { y: [0, -5, 0] }
            }
            transition={{ duration: busy ? 0.5 : 2.6, repeat: Infinity, ease: "easeInOut" }}
            style={{
              // толстеет на глазах: масштаб по весу
              transform: `scaleX(${(0.86 + weight / 200).toFixed(3)})`,
            }}
          >
            <HeadView friend={pet} size={118} />
          </motion.div>

          <div className="flex items-center" style={{ gap: 9, marginTop: 12 }}>
            <span className="t-num" style={{ fontSize: 22 }}>{weight.toFixed(1)}</span>
            <span className="t-label" style={{ fontSize: 9 }}>{tr("КГ")}</span>
            <span
              className="t-label"
              style={{
                fontSize: 8.5, padding: "3px 9px", borderRadius: 999,
                background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
              }}
            >
              {tr(mood)}
            </span>
          </div>

          {huge && (
            <div
              className="t-caption"
              style={{ marginTop: 8, color: "#FFB020", textAlign: "center" }}
            >
              {tr("Разъелся — теперь нужно два унитаза")}
            </div>
          )}
        </div>

        {/* Шкалы */}
        <div className="flex flex-col" style={{ gap: 9, marginBottom: 14 }}>
          {NEEDS.map((n) => {
            const v = bars[n.id];
            const low = v < 30;
            return (
              <div
                key={n.id}
                style={{
                  padding: "10px 12px", borderRadius: "var(--r-md)",
                  background: "var(--surface)",
                  border: `1px solid ${low ? "rgba(255,107,77,0.5)" : "var(--surface-brd)"}`,
                }}
              >
                <div className="flex items-center" style={{ gap: 8, marginBottom: 7 }}>
                  <span style={{ color: n.color, lineHeight: 0 }}>
                    <Icon name={n.icon} size={13} />
                  </span>
                  <span className="t-label flex-1" style={{ fontSize: 9 }}>{tr(n.label)}</span>
                  <span
                    className="t-num"
                    style={{ fontSize: 11, color: low ? "#FF6B4D" : "var(--text-mute)" }}
                  >
                    {Math.round(v)}
                  </span>
                </div>
                <div
                  style={{
                    height: 6, borderRadius: 999,
                    background: "rgba(255,255,255,0.08)", overflow: "hidden",
                  }}
                >
                  <motion.div
                    animate={{ width: `${v}%` }}
                    transition={{ duration: 0.2 }}
                    style={{ height: "100%", background: low ? "#FF6B4D" : n.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Кнопки ухода */}
        <div className="grid grid-cols-2" style={{ gap: 9, marginTop: "auto" }}>
          {NEEDS.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => doAction(n)}
              disabled={!!busy || phase !== "play"}
              className="flex flex-col items-center justify-center"
              style={{
                padding: "15px 8px", borderRadius: "var(--r-md)",
                background: busy === n.id ? n.color : "var(--btn-bg)",
                border: `1px solid ${busy === n.id ? n.color : "var(--btn-brd)"}`,
                color: busy === n.id ? "#0b0b0e" : "var(--text)",
                opacity: busy && busy !== n.id ? 0.45 : 1,
                gap: 7,
              }}
            >
              <Icon name={n.icon} size={19} />
              <span className="t-label clip1" style={{ fontSize: 9.5 }}>
                {busy === n.id ? tr("ДЕЛАЮ…") : tr(n.action)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>{phase === "count" && <Countdown n={cd} />}</AnimatePresence>

      {phase === "over" && (
        <GameOver
          score={result.score}
          best={best}
          coins={result.coins}
          xp={result.xp}
          onRetry={restart}
          onExit={onExit}
          title={tr("НЕ УСЛЕДИЛ")}
          sub={flash || undefined}
        />
      )}
    </div>
  );
}
