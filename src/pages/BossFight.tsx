import { useCallback, useEffect, useRef, useState } from "react";
import { tr } from "../core/i18n";
import { AnimatePresence, motion } from "framer-motion";
import { Panel, Screen, Tap } from "../ui/Glass";
import Icon from "../ui/Icon";
import HeadView from "../ui/HeadView";
import { sfx, haptic } from "../core/fx";
import { fmt } from "../core/format";
import { useGame } from "../core/store";
import { readGamble, writeGamble } from "../core/gamble";
import {
  BOSSES, bossOfHour, canFight, clearedThisHour, nextBossIn, readBosses,
  windowLeft, writeBosses, type BossDef, type BossStore,
} from "../core/bosses";

type Phase = "intro" | "fight" | "win" | "lose";

/** Полоска здоровья */
function HpBar({ v, max, color }: { v: number; max: number; color: string }) {
  return (
    <div
      style={{
        height: 8, borderRadius: 99, overflow: "hidden",
        background: "var(--surface-3)",
      }}
    >
      <motion.div
        animate={{ width: `${Math.max(0, (v / max) * 100)}%` }}
        transition={{ duration: 0.25 }}
        style={{ height: "100%", background: color }}
      />
    </div>
  );
}

function mmss(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export default function BossFight({ onBack }: { onBack: () => void }) {
  const { addCoins, addXp, toast } = useGame();
  const [store, setStore] = useState<BossStore>(() => readBosses());
  const [boss, setBoss] = useState<BossDef>(() => bossOfHour());
  const [phase, setPhase] = useState<Phase>("intro");

  const [bossHp, setBossHp] = useState(boss.hp);
  const [myHp, setMyHp] = useState(100);
  const [taunt, setTaunt] = useState<string | null>(null);
  const [hits, setHits] = useState(0);
  /** Кулак игрока попадает не всегда: во время «газа» шанс промаха */
  const [fog, setFog] = useState(false);
  /** Босс замахнулся: есть окно, чтобы поставить блок */
  const [windup, setWindup] = useState(false);
  /** Блок держится доли секунды и уходит в перезарядку */
  const [blocking, setBlocking] = useState(false);
  const [blockReady, setBlockReady] = useState(true);
  /** Ниже трети здоровья босс звереет: бьёт чаще и больнее */
  const [rage, setRage] = useState(false);
  const [combo, setCombo] = useState(0);
  const [, tick] = useState(0);

  const windupRef = useRef(false);
  const blockRef = useRef(false);
  const rageRef = useRef(false);
  /** Замах босса — нужен и из punch(), когда включается ярость */
  const swingRef = useRef<(() => void) | null>(null);

  const atkTimer = useRef<number | null>(null);
  const gimTimer = useRef<number | null>(null);
  const tauntTimer = useRef<number | null>(null);
  const windupTimer = useRef<number | null>(null);
  const blockTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (atkTimer.current) clearInterval(atkTimer.current);
    if (gimTimer.current) clearInterval(gimTimer.current);
    if (tauntTimer.current) clearTimeout(tauntTimer.current);
    if (windupTimer.current) clearTimeout(windupTimer.current);
    if (blockTimer.current) clearTimeout(blockTimer.current);
    atkTimer.current = null;
    gimTimer.current = null;
    tauntTimer.current = null;
    windupTimer.current = null;
    blockTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // ежесекундно обновляем таймеры окна
  useEffect(() => {
    const iv = setInterval(() => {
      tick((n) => n + 1);
      const cur = bossOfHour();
      if (cur.id !== boss.id && phase === "intro") setBoss(cur);
    }, 1000);
    return () => clearInterval(iv);
  }, [boss.id, phase]);

  const save = useCallback((patch: Partial<BossStore>) => {
    setStore((prev) => {
      const next = { ...prev, ...patch };
      writeBosses(next);
      return next;
    });
  }, []);

  const say = useCallback((text: string) => {
    setTaunt(text);
    if (tauntTimer.current) clearTimeout(tauntTimer.current);
    tauntTimer.current = window.setTimeout(() => setTaunt(null), 2200);
  }, []);

  const finish = useCallback(
    (won: boolean) => {
      clearTimers();
      setPhase(won ? "win" : "lose");
      if (won) {
        addCoins(boss.reward.coins);
        addXp(boss.reward.xp);
        // жетоны для казино
        const g = readGamble();
        writeGamble({ ...g, chips: g.chips + boss.reward.chips });
        save({
          clearedHour: Math.floor(Date.now() / (60 * 60 * 1000)),
          wins: { ...store.wins, [boss.id]: (store.wins[boss.id] || 0) + 1 },
          fights: store.fights + 1,
        });
        sfx.legend?.();
        haptic("success");
        toast({
          title: tr("Босс повержен"),
          sub: `+${fmt(boss.reward.coins)} и ${boss.reward.chips} жетонов`,
          icon: "trophy",
          tone: "gold",
        });
      } else {
        save({ fights: store.fights + 1 });
        sfx.gameOver?.();
        haptic("error");
      }
    },
    [boss, addCoins, addXp, toast, save, store, clearTimers],
  );

  const start = () => {
    setBossHp(boss.hp);
    setMyHp(100);
    setHits(0);
    setFog(false);
    setWindup(false);
    setBlocking(false);
    setBlockReady(true);
    setRage(false);
    setCombo(0);
    windupRef.current = false;
    blockRef.current = false;
    rageRef.current = false;
    setPhase("fight");
    sfx.click();
    say(boss.quote);

    // Босс бьёт не молча: сначала замах, и это окно под блок.
    // Раньше урон просто капал по таймеру, и от игрока ничего не зависело.
    const swing = () => {
      setWindup(true);
      windupRef.current = true;
      const tell = rageRef.current ? 420 : 620;   // в ярости замах короче
      windupTimer.current = window.setTimeout(() => {
        setWindup(false);
        windupRef.current = false;
        const blocked = blockRef.current;
        const raw = rageRef.current ? Math.round(boss.dmg * 1.6) : boss.dmg;
        const dealt = blocked ? Math.round(raw * 0.18) : raw;
        if (blocked) {
          sfx.click();
          haptic("light");
        } else {
          sfx.hit?.();
          haptic("medium");
          setCombo(0);          // пропустил — комбо сгорело
        }
        setMyHp((hp) => {
          const next = hp - dealt;
          if (next <= 0) { finish(false); return 0; }
          return next;
        });
      }, tell);
    };

    swingRef.current = swing;
    atkTimer.current = window.setInterval(() => {
      swing();
      if (Math.random() < 0.5) say(boss.taunts[Math.floor(Math.random() * boss.taunts.length)]);
    }, boss.every);

    // особая механика
    if (boss.gimmick === "gas") {
      // Данил пускает газы — экран мутнеет, часть ударов мимо
      gimTimer.current = window.setInterval(() => {
        setFog(true);
        say(tr("Ой… это не я."));
        window.setTimeout(() => setFog(false), 2600);
      }, 7000);
    } else if (boss.gimmick === "sleep") {
      // Т-34 иногда «залипает» — окно бесплатного урона
      gimTimer.current = window.setInterval(() => {
        setFog(false);
        say(tr("…я на секунду прикрою глаза."));
      }, 8000);
    }
  };

  /** Удар игрока */
  const punch = () => {
    if (phase !== "fight") return;
    // в тумане половина ударов мимо
    if (fog && Math.random() < 0.5) {
      sfx.click();
      haptic("light");
      return;
    }
    const base = 9 + Math.floor(Math.random() * 7);
    // Броня-танк держит удар
    let dmg = boss.gimmick === "tank" ? Math.round(base * 0.72) : base;
    // Серия точных ударов без пропусков усиливает урон — до +50%
    const nextCombo = combo + 1;
    setCombo(nextCombo);
    dmg = Math.round(dmg * (1 + Math.min(10, nextCombo) * 0.05));
    // Бить во время своего блока нельзя: блок — это выбор, а не бесплатный бонус
    if (blockRef.current) return;

    setHits((n) => n + 1);
    sfx.hit?.();
    haptic("light");
    setBossHp((hp) => {
      const next = hp - dmg;
      // Ниже трети — босс звереет: чаще бьёт и сильнее
      if (!rageRef.current && next <= boss.hp * 0.34 && next > 0) {
        rageRef.current = true;
        setRage(true);
        say(tr("Ну всё, ты доигрался."));
        sfx.error?.();
        haptic("heavy");
        if (atkTimer.current) clearInterval(atkTimer.current);
        atkTimer.current = window.setInterval(() => {
          swingRef.current?.();
          if (Math.random() < 0.6) {
            say(boss.taunts[Math.floor(Math.random() * boss.taunts.length)]);
          }
        }, Math.max(700, Math.round(boss.every * 0.62)));
      }
      if (next <= 0) {
        finish(true);
        return 0;
      }
      return next;
    });
  };

  /** Поставить блок: короткое окно и перезарядка, спамить нельзя */
  const block = () => {
    if (phase !== "fight" || !blockReady) return;
    setBlocking(true);
    blockRef.current = true;
    setBlockReady(false);
    sfx.swoosh?.();
    haptic("light");
    window.setTimeout(() => {
      setBlocking(false);
      blockRef.current = false;
    }, 520);
    blockTimer.current = window.setTimeout(() => setBlockReady(true), 1100);
  };

  const active = canFight(store, Date.now());
  const cleared = clearedThisHour(store);
  const wLeft = windowLeft();
  const nLeft = nextBossIn();

  return (
    <Screen
      title={tr("БОССЫ")}
      sub={tr("Воспитатели общаги")}
      right={
        <button
          type="button"
          onClick={() => { sfx.click(); clearTimers(); onBack(); }}
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 34, height: 34, borderRadius: "var(--r-sm)",
            background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
          }}
        >
          <Icon name="cross" size={15} />
        </button>
      }
    >
      {phase === "intro" && (
        <>
          {/* Дежурный */}
          <Panel
            r="xl"
            strong
            style={{
              padding: 20, marginBottom: 12, textAlign: "center",
              border: active && !cleared
                ? "1.5px solid var(--danger-brd)"
                : "1.5px solid var(--btn-brd)",
              background: active && !cleared
                ? "radial-gradient(120% 90% at 50% 0%, rgba(255,90,60,0.13), transparent 70%)"
                : undefined,
            }}
          >
            <div className="t-label" style={{ marginBottom: 12 }}>
              {cleared ? "СМЕНА ЗАКРЫТА" : active ? "СЕЙЧАС ДЕЖУРИТ" : tr("ПЕРЕРЫВ")}
            </div>

            <motion.div
              animate={active && !cleared ? { y: [0, -5, 0] } : {}}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
              className="flex justify-center"
              style={{ marginBottom: 14 }}
            >
              <HeadView friend={{ look: boss.look } as never} size={116} />
            </motion.div>

            <div className="t-display" style={{ fontSize: 26 }}>{boss.name}</div>
            <div className="t-caption" style={{ marginTop: 4 }}>{boss.nick}</div>

            <div
              className="t-body"
              style={{ marginTop: 12, color: "var(--text-mute)", lineHeight: 1.5 }}
            >
              «{boss.quote}»
            </div>

            <div className="flex" style={{ gap: 8, marginTop: 16 }}>
              <Panel r="md" className="flex-1" style={{ padding: "9px 4px" }}>
                <div className="t-num" style={{ fontSize: 15 }}>{fmt(boss.reward.coins)}</div>
                <div className="t-label" style={{ fontSize: 8.5 }}>{tr("монет")}</div>
              </Panel>
              <Panel r="md" className="flex-1" style={{ padding: "9px 4px" }}>
                <div className="t-num" style={{ fontSize: 15 }}>{boss.reward.chips}</div>
                <div className="t-label" style={{ fontSize: 8.5 }}>{tr("жетонов")}</div>
              </Panel>
              <Panel r="md" className="flex-1" style={{ padding: "9px 4px" }}>
                <div className="t-num" style={{ fontSize: 15 }}>{boss.reward.xp}</div>
                <div className="t-label" style={{ fontSize: 8.5 }}>{tr("опыта")}</div>
              </Panel>
            </div>

            <div style={{ marginTop: 16 }}>
              {cleared ? (
                <div className="t-caption">
                  {tr("Уже разобрались. Следующий через")} {mmss(nLeft)}
                </div>
              ) : active ? (
                <>
                  <Tap
                    onClick={start}
                    accent r="md" center
                    className="w-full py-3.5 t-title"
                    style={{ fontSize: 14 }}
                    sound="power"
                  >{tr("В БОЙ")}</Tap>
                  <div className="t-caption" style={{ marginTop: 9 }}>
                    {tr("Дежурит весь час — успей до")} {mmss(wLeft)}
                  </div>
                </>
              ) : (
                <div className="t-caption">
                  Следующий дежурный через {mmss(nLeft)}
                </div>
              )}
            </div>
          </Panel>

          {/* Расписание */}
          <div className="t-label" style={{ marginBottom: 9 }}>{tr("Все воспитатели")}</div>
          {BOSSES.map((b) => (
            <Panel key={b.id} r="lg" style={{ padding: 11, marginBottom: 8 }}>
              <div className="flex items-center" style={{ gap: 11 }}>
                <HeadView friend={{ look: b.look } as never} size={40} />
                <span className="flex-1 min-w-0">
                  <span className="t-title-sm clip1 block">{b.name}</span>
                  <span className="t-caption clip1 block" style={{ marginTop: 2 }}>
                    {b.nick}
                  </span>
                </span>
                <span
                  className="t-num shrink-0"
                  style={{ fontSize: 11, color: "var(--text-mute)" }}
                >
                  {store.wins[b.id] || 0} побед
                </span>
              </div>
            </Panel>
          ))}
        </>
      )}

      {phase === "fight" && (
        <>
          {/* Здоровье босса */}
          <Panel r="lg" style={{ padding: 13, marginBottom: 10 }}>
            <div className="flex items-center" style={{ gap: 9, marginBottom: 8 }}>
              <span className="t-title-sm flex-1 clip1">{boss.name}</span>
              {rage && (
                <motion.span
                  className="t-label shrink-0"
                  animate={{ opacity: [1, 0.45, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                  style={{
                    fontSize: 8.5, padding: "3px 8px", borderRadius: 999,
                    background: "var(--danger-soft)",
                    border: "1px solid var(--danger-brd)",
                    color: "var(--danger)",
                  }}
                >
                  {tr("В ЯРОСТИ")}
                </motion.span>
              )}
              <span className="t-num shrink-0" style={{ fontSize: 12 }}>
                {Math.max(0, bossHp)} / {boss.hp}
              </span>
            </div>
            <HpBar v={bossHp} max={boss.hp} color="#FF5A3C" />
          </Panel>

          {/* Арена */}
          <Panel
            r="xl"
            style={{
              padding: 20, marginBottom: 10, textAlign: "center",
              position: "relative", overflow: "hidden",
              minHeight: 230,
            }}
          >
            <AnimatePresence>
              {taunt && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="t-body"
                  style={{
                    position: "relative", zIndex: 3,
                    padding: "9px 13px", borderRadius: "var(--r-md)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--btn-brd)",
                    marginBottom: 14, display: "inline-block",
                    maxWidth: "100%",
                  }}
                >
                  {taunt}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Замах: красная рамка и надпись — сигнал поставить блок */}
            <AnimatePresence>
              {windup && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute pointer-events-none"
                  style={{
                    inset: 0, zIndex: 5,
                    border: "2.5px solid #FF5A3C",
                    borderRadius: "var(--r-xl)",
                    background:
                      "radial-gradient(circle at 50% 50%, rgba(255,90,60,0.22), transparent 68%)",
                  }}
                />
              )}
            </AnimatePresence>

            <motion.div
              key={hits}
              initial={{ scale: 1 }}
              animate={
                windup
                  ? { scale: [1, 1.1, 1.06], rotate: [0, -4, 3] }
                  : { scale: [1, 0.95, 1], rotate: [0, -2, 2, 0] }
              }
              transition={{ duration: windup ? 0.5 : 0.18 }}
              className="flex justify-center"
              style={{ position: "relative", zIndex: 2 }}
            >
              <HeadView friend={{ look: boss.look } as never} size={128} />
            </motion.div>

            {windup && (
              <motion.div
                className="t-label"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  position: "relative", zIndex: 6, marginTop: 12,
                  color: "var(--danger)", fontSize: 11,
                }}
              >
                {tr("ЗАМАХНУЛСЯ — СТАВЬ БЛОК")}
              </motion.div>
            )}

            {/* Туман от газа */}
            <AnimatePresence>
              {fog && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: "absolute", inset: 0, zIndex: 4,
                    background:
                      "radial-gradient(circle at 50% 60%, rgba(150,200,120,0.34), rgba(120,170,90,0.12) 60%, transparent)",
                    pointerEvents: "none",
                  }}
                />
              )}
            </AnimatePresence>
          </Panel>

          {/* Здоровье игрока */}
          <Panel r="lg" style={{ padding: 13, marginBottom: 12 }}>
            <div className="flex items-center" style={{ gap: 9, marginBottom: 8 }}>
              <span className="t-title-sm flex-1">{tr("Ты")}</span>
              <span className="t-num" style={{ fontSize: 12 }}>{Math.max(0, myHp)} / 100</span>
            </div>
            <HpBar v={myHp} max={100} color="var(--ok)" />
          </Panel>

          <div className="flex" style={{ gap: 9 }}>
            <Tap
              onClick={punch}
              accent r="md" center
              className="t-title"
              style={{ fontSize: 16, padding: "20px 0", flex: 2 }}
              sound="hit"
            >
              <span className="inline-flex items-center" style={{ gap: 9 }}>
                <Icon name="fist" size={19} />{tr("БИТЬ")}
              </span>
            </Tap>

            <Tap
              onClick={block}
              r="md" center
              disabled={!blockReady}
              className="t-title"
              style={{
                fontSize: 14, padding: "20px 0", flex: 1,
                background: blocking ? "var(--ok-soft)" : undefined,
                border: blocking
                  ? "1.5px solid var(--ok)"
                  : windup && blockReady
                    ? "1.5px solid var(--danger)"
                    : undefined,
                opacity: blockReady ? 1 : 0.45,
              }}
              sound="none"
            >
              <span className="inline-flex items-center" style={{ gap: 7 }}>
                <Icon name="shield" size={17} />{tr("БЛОК")}
              </span>
            </Tap>
          </div>

          <div className="t-caption" style={{ marginTop: 9, textAlign: "center" }}>
            {fog
              ? tr("Ничего не видно — половина ударов мимо")
              : combo > 2
                ? `${tr("серия")} ×${combo} · +${Math.min(10, combo) * 5}% ${tr("урона")}`
                : `${tr("ударов")}: ${hits}`}
          </div>
        </>
      )}

      {(phase === "win" || phase === "lose") && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
        >
          <Panel r="xl" strong style={{ padding: 24, textAlign: "center" }}>
            <div
              className="t-display"
              style={{ fontSize: 30, color: phase === "win" ? "var(--ok)" : "#FF6B8A" }}
            >
              {phase === "win" ? "ПОБЕДА" : tr("ОТЧИСЛЕН")}
            </div>
            <div className="t-caption" style={{ marginTop: 8, lineHeight: 1.5 }}>
              {phase === "win"
                ? `${boss.name} ушла писать докладную. Награда твоя.`
                : `${boss.name} оказалась сильнее. Попробуй в следующий час.`}
            </div>

            {phase === "win" && (
              <div className="flex" style={{ gap: 8, marginTop: 16 }}>
                <Panel r="md" className="flex-1" style={{ padding: "10px 4px" }}>
                  <div className="t-num" style={{ fontSize: 15 }}>+{fmt(boss.reward.coins)}</div>
                  <div className="t-label" style={{ fontSize: 8.5 }}>{tr("монет")}</div>
                </Panel>
                <Panel r="md" className="flex-1" style={{ padding: "10px 4px" }}>
                  <div className="t-num" style={{ fontSize: 15 }}>+{boss.reward.chips}</div>
                  <div className="t-label" style={{ fontSize: 8.5 }}>{tr("жетонов")}</div>
                </Panel>
              </div>
            )}

            <Tap
              onClick={() => { setPhase("intro"); sfx.click(); }}
              accent r="md" center
              className="w-full py-3.5 t-title"
              style={{ fontSize: 14, marginTop: 18 }}
              sound="swoosh"
            >{tr("ПОНЯТНО")}</Tap>
          </Panel>
        </motion.div>
      )}
    </Screen>
  );
}
