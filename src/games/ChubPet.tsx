import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { GameOver, GameHUD, Countdown, HudStat } from "./shell";
import type { FriendLook } from "../core/types";
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
  { id: "food", label: "Сытость", icon: "burger", color: "var(--gold)", drain: 3.1, action: "КОРМИТЬ" },
  { id: "clean", label: "Чистота", icon: "sparkle", color: "#8fd3ff", drain: 2.4, action: "МЫТЬ" },
  { id: "laundry", label: "Одежда", icon: "shop", color: "var(--violet)", drain: 1.9, action: "СТИРАТЬ" },
  { id: "toilet", label: "Терпит", icon: "warn", color: "var(--ok)", drain: 2.7, action: "НА УНИТАЗ" },
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

/**
 * Фигура подопечного целиком.
 *
 * Жалобы пользователя: «показывать изменения на персонаже (толстеет /
 * худеет / грязный / одежда)», «человек целиком», «персонаж двигается
 * от действий». Раньше здесь была ОДНА ГОЛОВА (HeadView), растянутая
 * по горизонтали через scaleX — ни тела, ни одежды, ни грязи.
 *
 * Теперь рисуем человека: голова, шея, торс, руки, ноги. Ширина торса
 * и бёдер считается из веса, футболка меняет цвет по шкале одежды,
 * грязь проступает пятнами при низкой чистоте, а поза зависит от того,
 * что сейчас делаем.
 */
function PetBody({
  look, weight, clean, laundry, toilet, busy, size = 150,
}: {
  look: FriendLook;
  weight: number;
  clean: number;
  laundry: number;
  toilet: number;
  busy: Need | null;
  size?: number;
}) {
  // 60 кг -> худой, 70 -> обычный, 110 -> очень толстый
  const k = Math.max(0, Math.min(1, (weight - 55) / 60));
  const torsoW = 26 + k * 30;        // ширина торса
  const hipW = 22 + k * 26;
  const headR = 15 + k * 3.2;

  // одежда: чистая футболка -> насыщенный цвет, грязная -> серо-бурая
  const shirtFresh = Math.max(0, Math.min(1, laundry / 100));
  const shirt = laundry > 55 ? "#4a7fd4" : laundry > 25 ? "#6b6f52" : "#5a5040";
  const pants = laundry > 40 ? "#33384a" : "#3a3630";

  // грязь: чем ниже чистота, тем больше пятен
  const dirt = Math.max(0, Math.min(1, (60 - clean) / 60));
  // припёрло: поза «ноги вместе», лёгкий наклон
  const urgent = toilet < 30;

  const cx = 50;
  return (
    <svg width={size} height={size * 1.18} viewBox="0 0 100 118">
      {/* тень */}
      <ellipse cx={cx} cy="113" rx={hipW * 0.9} ry="4" fill="var(--n-000)" opacity="0.4" />

      {/* ноги */}
      <path
        d={`M${cx - hipW * 0.42} 82 L${cx - (urgent ? hipW * 0.16 : hipW * 0.34)} 110`}
        stroke={pants} strokeWidth={9 + k * 4} strokeLinecap="round"
      />
      <path
        d={`M${cx + hipW * 0.42} 82 L${cx + (urgent ? hipW * 0.16 : hipW * 0.34)} 110`}
        stroke={pants} strokeWidth={9 + k * 4} strokeLinecap="round"
      />
      {/* стопы */}
      <ellipse cx={cx - (urgent ? hipW * 0.16 : hipW * 0.34)} cy="111" rx="6" ry="2.8" fill="var(--n-200)" />
      <ellipse cx={cx + (urgent ? hipW * 0.16 : hipW * 0.34)} cy="111" rx="6" ry="2.8" fill="var(--n-200)" />

      {/* торс: с весом становится бочкой */}
      <path
        d={`M${cx - torsoW / 2} 48
            Q${cx} 44 ${cx + torsoW / 2} 48
            L${cx + hipW / 2} 84
            Q${cx} 88 ${cx - hipW / 2} 84 Z`}
        fill={shirt}
      />
      {/* живот-«пузо» отдельной дугой, когда разъелся */}
      {k > 0.45 && (
        <ellipse cx={cx} cy={72} rx={torsoW * 0.42} ry={10 + k * 7} fill="var(--n-000)" opacity="0.12" />
      )}

      {/* пятна грязи на футболке */}
      {dirt > 0.15 && (
        <>
          <ellipse cx={cx - torsoW * 0.24} cy="60" rx={3 + dirt * 4} ry={2.4 + dirt * 3} fill="#4a3a22" opacity={0.3 + dirt * 0.5} />
          <ellipse cx={cx + torsoW * 0.2} cy="70" rx={2.6 + dirt * 4} ry={2 + dirt * 3} fill="#4a3a22" opacity={0.25 + dirt * 0.5} />
        </>
      )}
      {dirt > 0.6 && (
        <ellipse cx={cx + torsoW * 0.1} cy="53" rx="3.4" ry="2.6" fill="#3d3018" opacity="0.6" />
      )}

      {/* руки: при мытье подняты, при еде — ко рту */}
      {busy === "clean" ? (
        <>
          <path d={`M${cx - torsoW / 2 + 2} 52 Q${cx - torsoW * 0.8} 40 ${cx - torsoW * 0.66} 28`} stroke={shirt} strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d={`M${cx + torsoW / 2 - 2} 52 Q${cx + torsoW * 0.8} 40 ${cx + torsoW * 0.66} 28`} stroke={shirt} strokeWidth="7" strokeLinecap="round" fill="none" />
        </>
      ) : busy === "food" ? (
        <>
          <path d={`M${cx - torsoW / 2 + 2} 54 Q${cx - torsoW * 0.5} 48 ${cx - 8} 38`} stroke={shirt} strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d={`M${cx + torsoW / 2 - 2} 54 Q${cx + torsoW * 0.5} 62 ${cx + torsoW * 0.62} 74`} stroke={shirt} strokeWidth="7" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d={`M${cx - torsoW / 2 + 2} 52 Q${cx - torsoW * 0.72} 64 ${cx - torsoW * 0.62} 78`} stroke={shirt} strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d={`M${cx + torsoW / 2 - 2} 52 Q${cx + torsoW * 0.72} 64 ${cx + torsoW * 0.62} 78`} stroke={shirt} strokeWidth="7" strokeLinecap="round" fill="none" />
        </>
      )}

      {/* шея */}
      <rect x={cx - 4} y={40} width="8" height="9" rx="3" fill={look.skin} />

      {/* голова */}
      <circle cx={cx} cy={40 - headR} r={headR} fill={look.skin} />
      {/* волосы */}
      <path
        d={`M${cx - headR} ${40 - headR - 1} Q${cx} ${40 - headR * 2.4} ${cx + headR} ${40 - headR - 1} Z`}
        fill={look.hair}
      />
      {/* глаза: при нужде — зажмуренные */}
      {urgent || (busy && busy === "toilet") ? (
        <>
          <path d={`M${cx - 5.4} ${40 - headR} q2.4 -2 4.8 0`} stroke="#1a1a1f" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <path d={`M${cx + 0.6} ${40 - headR} q2.4 -2 4.8 0`} stroke="#1a1a1f" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx={cx - 4.4} cy={40 - headR} r="1.7" fill="#1a1a1f" />
          <circle cx={cx + 4.4} cy={40 - headR} r="1.7" fill="#1a1a1f" />
        </>
      )}
      {/* рот: настроение по худшей шкале */}
      {busy === "food" ? (
        <ellipse cx={cx} cy={40 - headR + 5.6} rx="3.4" ry="2.8" fill="#5a2a2a" />
      ) : Math.min(clean, laundry, toilet) < 30 ? (
        <path d={`M${cx - 4} ${40 - headR + 7} q4 -3.4 8 0`} stroke="#5a2a2a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      ) : (
        <path d={`M${cx - 4} ${40 - headR + 5} q4 3.4 8 0`} stroke="#5a2a2a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      )}

      {/* мушки над головой, когда совсем грязный */}
      {dirt > 0.55 && (
        <>
          <circle cx={cx - headR - 5} cy={40 - headR * 2 - 2} r="1.3" fill="#2f2f38" />
          <circle cx={cx + headR + 4} cy={40 - headR * 2 + 3} r="1.1" fill="#2f2f38" />
        </>
      )}

      {/* капли воды при мытье */}
      {busy === "clean" && (
        <>
          <circle cx={cx - 16} cy={26} r="2" fill="#8fd3ff" opacity="0.85" />
          <circle cx={cx + 14} cy={20} r="1.6" fill="#8fd3ff" opacity="0.7" />
          <circle cx={cx + 2} cy={16} r="1.8" fill="#8fd3ff" opacity="0.8" />
        </>
      )}

      {/* свежая футболка блестит после стирки */}
      {busy === "laundry" && shirtFresh > 0.2 && (
        <path d={`M${cx - torsoW * 0.3} 56 L${cx - torsoW * 0.1} 52`} stroke="#ffffff" strokeWidth="2" opacity="0.6" strokeLinecap="round" />
      )}
    </svg>
  );
}

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
      {/* Вес переехал в шапку: пользователь просил «кг в нормальное место».
          Раньше он висел отдельной строкой под персонажем и читался как
          часть картинки, а не как показатель. */}
      <GameHUD score={Math.floor(score)} best={best} onExit={onExit} label={tr("ОЧКИ")}
        extra={
          <>
            <HudStat label={tr("УРОВЕНЬ")} value={level} tone="acc" min={50} />
            <HudStat
              label={tr("ВЕС, КГ")}
              value={weight.toFixed(1)}
              tone={weight >= HUGE_AT ? "danger" : weight <= THIN_AT + 10 ? "warn" : "plain"}
              min={62}
            />
          </>
        }
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
          {/*
            Персонаж двигается от действий (просьба пользователя):
              • кормим — подпрыгивает и жуёт;
              • моем — трясётся, руки подняты, летят капли;
              • стираем — крутится, как в барабане;
              • на унитаз — семенит мелкой дрожью;
              • плохо по шкале — качается из стороны в сторону;
              • всё хорошо — спокойно дышит.
            Ширину больше не подделываем через scaleX: тело само
            становится шире, потому что рисуется от веса.
          */}
          <motion.div
            animate={
              busy === "food" ? { y: [0, -8, 0], scaleY: [1, 0.94, 1] }
              : busy === "clean" ? { x: [0, -5, 5, -3, 0], rotate: [0, -3, 3, 0] }
              : busy === "laundry" ? { rotate: [0, -8, 8, 0] }
              : busy === "toilet" ? { x: [0, -2.5, 2.5, -2.5, 0] }
              : bars[worst.id] < 25 ? { rotate: [0, -4, 4, 0] }
              : { y: [0, -5, 0] }
            }
            transition={{
              duration: busy === "toilet" ? 0.26 : busy ? 0.6 : 2.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ transformOrigin: "50% 90%" }}
          >
            <PetBody
              look={pet.look}
              weight={weight}
              clean={bars.clean}
              laundry={bars.laundry}
              toilet={bars.toilet}
              busy={busy}
              size={150}
            />
          </motion.div>

          <div className="flex items-center" style={{ gap: 8, marginTop: 12 }}>
            <span
              className="t-label"
              style={{
                fontSize: 9, padding: "5px 11px", borderRadius: "var(--r-sm)",
                background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
              }}
            >
              {tr(mood)}
            </span>
            {/* короткая расшифровка, что сейчас видно на персонаже */}
            <span className="t-caption clip1" style={{ fontSize: 10 }}>
              {busy
                ? tr("ДЕЛАЮ…")
                : bars.clean < 35 ? tr("Грязный")
                : bars.laundry < 35 ? tr("Одежда несвежая")
                : bars.toilet < 30 ? tr("Приспичило")
                : weight >= HUGE_AT ? tr("Разъелся")
                : weight <= THIN_AT + 8 ? tr("Отощал")
                : tr("Всё в порядке")}
            </span>
          </div>

          {huge && (
            <div
              className="t-caption"
              style={{ marginTop: 8, color: "var(--gold)", textAlign: "center" }}
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
                    style={{ fontSize: 11, color: low ? "var(--danger)" : "var(--text-mute)" }}
                  >
                    {Math.round(v)}
                  </span>
                </div>
                <div
                  style={{
                    height: 6, borderRadius: 999,
                    background: "var(--fill-2)", overflow: "hidden",
                  }}
                >
                  <motion.div
                    animate={{ width: `${v}%` }}
                    transition={{ duration: 0.2 }}
                    style={{ height: "100%", background: low ? "var(--danger)" : n.color }}
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
