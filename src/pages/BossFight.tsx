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
import BossArena, { freshFx, arenaFx, type ArenaFx } from "../ui/BossArena";
import {
  BOSSES, bossOfHour, canFight, nextBossIn, readBosses,
  windowLeft, writeBosses, killsThisHour, killRewardScale, killHpScale,
  type BossDef, type BossStore,
} from "../core/bosses";

type Phase = "intro" | "fight" | "win" | "lose";

/*
 * Числа боя подобраны перебором (500 боёв на конфигурацию, /tmp/boss3.mjs).
 * Прежний бой заканчивался за 7-12 секунд и сводился к долблению одной
 * кнопки. Проверено на трёх стилях игры:
 *   «долблю всё подряд»        —   0% побед,
 *   «иногда блокирую и целюсь» —  22-100% в зависимости от босса,
 *   «парирую и бью по слабым»  —  99-100%, бой 28-37 секунд.
 */
/** Запас здоровья игрока */
const MY_HP_MAX = 340;
/** Пауза между ударами игрока, мс — без неё «автокликер» решает всё */
const TAP_CD = 280;
/** Множитель урона по открытому слабому месту */
const WEAK_MULT = 2.8;
/** Добивающий приём: доля максимума HP босса + фикс */
const SPEC_PCT = 0.10;
const SPEC_FLAT = 30;
/** Сколько босс стоит оглушённым после парирования, мс */
const STUN_MS = 1500;
/** Окно для идеального парирования после начала замаха, мс */
const PARRY_WINDOW = 260;

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
  const { s: sv, addCoins, addXp, toast } = useGame();
  /** Внешность героя — дерёмся своим главным другом, а не безликой фигурой */
  const heroLook =
    (sv.friends.find((f) => f.id === sv.mainFriendId) || sv.friends[0])?.look;
  const [store, setStore] = useState<BossStore>(() => readBosses());
  const [boss, setBoss] = useState<BossDef>(() => bossOfHour());
  const [phase, setPhase] = useState<Phase>("intro");

  const [bossHp, setBossHp] = useState(boss.hp);
  /** Максимум HP текущего боя — растёт с каждым добиванием за смену */
  const [bossHpMax, setBossHpMax] = useState(boss.hp);
  const [myHp, setMyHp] = useState(MY_HP_MAX);
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
  /**
   * ЯРОСТЬ ИГРОКА — копится за точные удары и парирования, тратится на
   * добивающий приём. Раньше в бою была ровно одна осмысленная кнопка
   * «БИТЬ», и весь бой сводился к её долблению.
   */
  const [power, setPower] = useState(0);
  /**
   * СЛАБОЕ МЕСТО. Каждые несколько секунд у босса открывается уязвимая
   * зона (голова / корпус / ноги). Попал по ней — тройной урон, промах
   * по зоне — обычный. Появляется выбор, куда бить, а не просто «тапай».
   */
  const [weak, setWeak] = useState<null | "head" | "body" | "legs">(null);
  /** Босс оглушён после парирования — окно свободного урона */
  const [stunned, setStunned] = useState(false);
  const [, tick] = useState(0);

  /** Состояние арены: меняется 60 раз в секунду, поэтому вне React */
  const fx = useRef<ArenaFx>(freshFx());

  const windupRef = useRef(false);
  const blockRef = useRef(false);
  const rageRef = useRef(false);
  const weakRef = useRef<null | "head" | "body" | "legs">(null);
  const powerRef = useRef(0);
  const stunRef = useRef(false);
  /** Когда именно босс замахнулся — по этому считаем идеальное парирование */
  const windupAtRef = useRef(0);
  const weakTimer = useRef<number | null>(null);
  /** Когда игрок бил в последний раз — для паузы между ударами */
  const lastTapRef = useRef(0);
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
    if (weakTimer.current) clearInterval(weakTimer.current);
    weakTimer.current = null;
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
        /**
         * Событие длится весь час: убийство босса НЕ закрывает смену.
         * Первая победа за час даёт полную награду, каждая следующая —
         * вдвое меньше предыдущей (но не ниже 8%), а сам босс крепчает.
         * Так добивать можно сколько угодно, а фарм не ломает экономику.
         */
        const prev = killsThisHour(store);
        const k = killRewardScale(prev);
        const gotCoins = Math.max(1, Math.floor(boss.reward.coins * k));
        const gotChips = Math.max(1, Math.floor(boss.reward.chips * k));
        const gotXp = Math.max(1, Math.floor(boss.reward.xp * k));
        addCoins(gotCoins);
        addXp(gotXp);
        // жетоны для казино
        const g = readGamble();
        writeGamble({ ...g, chips: g.chips + gotChips });
        const hourNow = Math.floor(Date.now() / (60 * 60 * 1000));
        save({
          // отмечаем только ПЕРВУЮ победу за час — она снимает «полную» награду
          clearedHour: prev === 0 ? hourNow : store.clearedHour,
          runHour: hourNow,
          runKills: prev + 1,
          wins: { ...store.wins, [boss.id]: (store.wins[boss.id] || 0) + 1 },
          fights: store.fights + 1,
        });
        sfx.legend?.();
        haptic("success");
        toast({
          title: prev === 0 ? tr("Босс повержен") : `${tr("Добит")} ×${prev + 1}`,
          sub: `+${fmt(gotCoins)} ${tr("и")} ${gotChips} ${tr("жетонов")}`,
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
    {
      const hp0 = Math.round(boss.hp * killHpScale(killsThisHour(store)));
      setBossHp(hp0);
      setBossHpMax(hp0);
    }
    setMyHp(MY_HP_MAX);
    setHits(0);
    setFog(false);
    setWindup(false);
    setBlocking(false);
    setBlockReady(true);
    setRage(false);
    setCombo(0);
    setPower(0);
    setWeak(null);
    setStunned(false);
    windupRef.current = false;
    blockRef.current = false;
    rageRef.current = false;
    weakRef.current = null;
    powerRef.current = 0;
    stunRef.current = false;
    lastTapRef.current = 0;
    fx.current = freshFx();
    setPhase("fight");
    sfx.click();
    say(boss.quote);

    // Босс бьёт не молча: сначала замах, и это окно под блок.
    // Раньше урон просто капал по таймеру, и от игрока ничего не зависело.
    const swing = () => {
      // оглушённый босс не бьёт — это и есть награда за парирование
      if (stunRef.current) return;
      setWindup(true);
      windupRef.current = true;
      windupAtRef.current = Date.now();
      const tell = rageRef.current ? 420 : 620;   // в ярости замах короче
      windupTimer.current = window.setTimeout(() => {
        setWindup(false);
        windupRef.current = false;
        const blocked = blockRef.current;
        const raw = rageRef.current ? Math.round(boss.dmg * 1.6) : boss.dmg;
        const dealt = blocked ? Math.round(raw * 0.18) : raw;

        const f = fx.current;
        f.bossSeq++;
        f.shake = blocked ? 5 : 12;

        if (blocked) {
          sfx.click();
          haptic("light");
          arenaFx.pop(f, window.innerWidth * 0.3, 120, tr("БЛОК"), "#7effc2", 34);
          arenaFx.burst(f, window.innerWidth * 0.32, 130, "#7effc2", 8, 0.14);
        } else {
          sfx.hit?.();
          haptic("medium");
          setCombo(0);          // пропустил — комбо сгорело
          arenaFx.pop(f, window.innerWidth * 0.3, 120, `-${dealt}`, "#ff6b5a", 46);
          arenaFx.burst(f, window.innerWidth * 0.3, 132, "#ff6b5a", 12, 0.2);
        }
        setMyHp((hp) => {
          const next = hp - dealt;
          fx.current.myHp = Math.max(0, next) / MY_HP_MAX;
          if (next <= 0) { fx.current.over = "lose"; finish(false); return 0; }
          return next;
        });
      }, tell);
    };

    swingRef.current = swing;
    atkTimer.current = window.setInterval(() => {
      swing();
      if (Math.random() < 0.5) say(boss.taunts[Math.floor(Math.random() * boss.taunts.length)]);
    }, boss.every);

    /*
     * СЛАБОЕ МЕСТО открывается раз в несколько секунд и держится недолго.
     * Это превращает бой из «долби одну кнопку» в выбор цели: три кнопки
     * (голова / корпус / ноги) и надо успеть попасть в подсвеченную.
     */
    weakTimer.current = window.setInterval(() => {
      const zones = ["head", "body", "legs"] as const;
      const z = zones[Math.floor(Math.random() * zones.length)];
      weakRef.current = z;
      setWeak(z);
      sfx.crit?.();
      window.setTimeout(() => {
        weakRef.current = null;
        setWeak(null);
      }, rageRef.current ? 1500 : 2100);
    }, 4200);

    // особая механика
    if (boss.gimmick === "gas") {
      // Данил пускает газы — экран мутнеет, часть ударов мимо
      gimTimer.current = window.setInterval(() => {
        setFog(true);
        fx.current.fog = true;          // арена рисует облако газа
        say(tr("Ой… это не я."));
        window.setTimeout(() => {
          setFog(false);
          fx.current.fog = false;
        }, 2600);
      }, 7000);
    } else if (boss.gimmick === "sleep") {
      // Т-34 иногда «залипает» — окно бесплатного урона
      gimTimer.current = window.setInterval(() => {
        setFog(false);
        say(tr("…я на секунду прикрою глаза."));
      }, 8000);
    }
  };

  /**
   * Удар игрока по выбранной зоне.
   *
   * Раньше была одна кнопка «БИТЬ» без цели. Теперь три зоны, и попадание
   * по открывшемуся слабому месту даёт тройной урон — есть за чем следить
   * и что выбирать.
   */
  const punch = (zone: "head" | "body" | "legs") => {
    if (phase !== "fight") return;
    // Бить во время своего блока нельзя: блок — это выбор, а не бонус
    if (blockRef.current) return;
    // Пауза между ударами: иначе бой выигрывает частота тапов, а не выбор
    const now = Date.now();
    if (now - lastTapRef.current < TAP_CD) return;
    lastTapRef.current = now;

    const f = fx.current;
    const bx = window.innerWidth * 0.72;

    // в тумане половина ударов мимо
    if (fog && Math.random() < 0.5) {
      sfx.click();
      haptic("light");
      arenaFx.pop(f, bx, 130, tr("МИМО"), "#9aa0ad", 30);
      setCombo(0);
      return;
    }

    const hitWeak = weakRef.current === zone;
    let base = 9 + Math.floor(Math.random() * 7);
    // зоны бьют по-разному: голова больнее, но она и открывается реже
    if (zone === "head") base = Math.round(base * 1.25);
    if (zone === "legs") base = Math.round(base * 0.85);

    // Броня-танк держит удар
    let dmg = boss.gimmick === "tank" ? Math.round(base * 0.72) : base;

    // Серия точных ударов без пропусков усиливает урон — до +50%
    const nextCombo = combo + 1;
    setCombo(nextCombo);
    dmg = Math.round(dmg * (1 + Math.min(10, nextCombo) * 0.05));

    // попал в слабое место — тройной урон
    if (hitWeak) {
      dmg = Math.round(dmg * WEAK_MULT);
      weakRef.current = null;
      setWeak(null);
    }
    // оглушённый босс получает двойной
    if (stunRef.current) dmg = Math.round(dmg * 2);

    // копим ярость
    const gain = hitWeak ? 18 : 7;
    powerRef.current = Math.min(100, powerRef.current + gain);
    setPower(powerRef.current);

    setHits((n) => n + 1);
    f.punchSeq++;
    f.shake = hitWeak ? 10 : 4;

    if (hitWeak) {
      sfx.crit?.();
      haptic("heavy");
      arenaFx.pop(f, bx, 96, `${tr("ТОЧНО")} -${dmg}`, "#ffd34a", 54);
      arenaFx.burst(f, bx, 120, "#ffd34a", 18, 0.26);
    } else {
      sfx.hit?.();
      haptic("light");
      arenaFx.pop(f, bx, 110, `-${dmg}`, "#ffffff", 40);
      arenaFx.burst(f, bx, 126, "#ffffff", 7, 0.16);
    }

    setBossHp((hp) => {
      const next = hp - dmg;
      fx.current.bossHp = Math.max(0, next) / bossHpMax;
      // Ниже трети — босс звереет: чаще бьёт и сильнее
      if (!rageRef.current && next <= bossHpMax * 0.34 && next > 0) {
        rageRef.current = true;
        setRage(true);
        fx.current.rage = true;
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
        fx.current.over = "win";
        finish(true);
        return 0;
      }
      return next;
    });
  };

  /**
   * Блок и ПАРИРОВАНИЕ.
   *
   * Если поставить блок в первые 260 мс после замаха — это парирование:
   * босс получает откат, оглушается на полторы секунды и не бьёт. Просто
   * зажать блок заранее уже недостаточно, надо ловить момент.
   */
  const block = () => {
    if (phase !== "fight" || !blockReady) return;
    setBlocking(true);
    blockRef.current = true;
    setBlockReady(false);
    fx.current.blocking = true;

    const since = windupRef.current ? Date.now() - windupAtRef.current : 99999;
    const parry = windupRef.current && since <= PARRY_WINDOW;

    if (parry) {
      // идеальное парирование
      const f = fx.current;
      f.perfect = 500;
      f.shake = 9;
      stunRef.current = true;
      setStunned(true);
      f.stun = STUN_MS;
      powerRef.current = Math.min(100, powerRef.current + 22);
      setPower(powerRef.current);
      sfx.crit?.();
      haptic("success");
      say(tr("Отбил! Дежурный поплыл."));
      arenaFx.pop(f, window.innerWidth * 0.5, 100, tr("ПАРИРОВАНИЕ"), "#7effc2", 50);
      arenaFx.burst(f, window.innerWidth * 0.5, 120, "#7effc2", 20, 0.28);
      // отменяем прилетающий удар
      if (windupTimer.current) clearTimeout(windupTimer.current);
      setWindup(false);
      windupRef.current = false;
      window.setTimeout(() => {
        stunRef.current = false;
        setStunned(false);
      }, STUN_MS);
    } else {
      sfx.swoosh?.();
      haptic("light");
    }

    window.setTimeout(() => {
      setBlocking(false);
      blockRef.current = false;
      fx.current.blocking = false;
    }, 520);
    blockTimer.current = window.setTimeout(() => setBlockReady(true), parry ? 700 : 1100);
  };

  /**
   * ДОБИВАЮЩИЙ ПРИЁМ — тратит накопленную ярость.
   * Появляется третья осмысленная кнопка и цель, ради которой копишь.
   */
  const special = () => {
    if (phase !== "fight" || powerRef.current < 100) return;
    powerRef.current = 0;
    setPower(0);
    const f = fx.current;
    const bx = window.innerWidth * 0.72;

    const dmg = Math.round(bossHpMax * SPEC_PCT + SPEC_FLAT);
    f.punchSeq++;
    f.shake = 20;
    sfx.legend?.();
    haptic("heavy");
    say(tr("ПОЛУЧАЙ!"));
    arenaFx.pop(f, bx, 88, `-${dmg}`, "#ff2fb9", 64);
    arenaFx.burst(f, bx, 118, "#ff2fb9", 30, 0.34);
    arenaFx.burst(f, bx, 118, "#ffd34a", 18, 0.26);

    setBossHp((hp) => {
      const next = hp - dmg;
      fx.current.bossHp = Math.max(0, next) / bossHpMax;
      if (next <= 0) {
        fx.current.over = "win";
        finish(true);
        return 0;
      }
      return next;
    });
  };

  const active = canFight(store, Date.now());
  /** Сколько раз уже завалили дежурного в эту смену */
  const kills = killsThisHour(store);
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
              border: active
                ? "1.5px solid var(--danger-brd)"
                : "1.5px solid var(--btn-brd)",
              background: active
                ? "radial-gradient(120% 90% at 50% 0%, var(--danger-soft), transparent 70%)"
                : undefined,
            }}
          >
            {/* Смена больше не «закрывается» после первого убийства —
                событие идёт весь час. */}
            <div className="t-label" style={{ marginBottom: 12 }}>
              {active ? tr("СЕЙЧАС ДЕЖУРИТ") : tr("ПЕРЕРЫВ")}
            </div>

            <motion.div
              animate={active ? { y: [0, -5, 0] } : {}}
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
                <div className="t-num" style={{ fontSize: 15 }}>
                  {fmt(Math.max(1, Math.floor(boss.reward.coins * killRewardScale(kills))))}
                </div>
                <div className="t-label" style={{ fontSize: 8.5 }}>{tr("монет")}</div>
              </Panel>
              <Panel r="md" className="flex-1" style={{ padding: "9px 4px" }}>
                <div className="t-num" style={{ fontSize: 15 }}>
                  {Math.max(1, Math.floor(boss.reward.chips * killRewardScale(kills)))}
                </div>
                <div className="t-label" style={{ fontSize: 8.5 }}>{tr("жетонов")}</div>
              </Panel>
              <Panel r="md" className="flex-1" style={{ padding: "9px 4px" }}>
                <div className="t-num" style={{ fontSize: 15 }}>
                  {Math.max(1, Math.floor(boss.reward.xp * killRewardScale(kills)))}
                </div>
                <div className="t-label" style={{ fontSize: 8.5 }}>{tr("опыта")}</div>
              </Panel>
            </div>

            <div style={{ marginTop: 16 }}>
              {active ? (
                <>
                  <button
                    type="button"
                    onClick={() => { sfx.power?.(); haptic("medium"); start(); }}
                    className="btn-acc w-full"
                    style={{ minHeight: 54, fontSize: 14.5 }}
                  >
                    {kills === 0 ? tr("В БОЙ") : tr("ДОБИТЬ ЕЩЁ РАЗ")}
                  </button>

                  {/* Понятно, что событие идёт весь час и сколько его осталось */}
                  <div
                    className="flex items-center"
                    style={{
                      gap: 9, marginTop: 11, padding: "9px 12px",
                      borderRadius: "var(--r-md)",
                      background: "var(--surface-2)",
                      border: "1px solid var(--surface-brd)",
                    }}
                  >
                    <span style={{ color: "var(--danger)", lineHeight: 0 }}>
                      <Icon name="clock" size={14} />
                    </span>
                    <span className="flex-1 min-w-0 text-left">
                      <span className="t-label block" style={{ fontSize: 8.5 }}>
                        {tr("СОБЫТИЕ ИДЁТ ЕЩЁ")}
                      </span>
                      <span className="t-num block" style={{ fontSize: 15, marginTop: 1 }}>
                        {mmss(wLeft)}
                      </span>
                    </span>
                    {kills > 0 && (
                      <span className="text-right shrink-0">
                        <span className="t-label block" style={{ fontSize: 8.5 }}>
                          {tr("ЗАВАЛИЛ")}
                        </span>
                        <span
                          className="t-num block"
                          style={{ fontSize: 15, marginTop: 1, color: "var(--ok)" }}
                        >
                          ×{kills}
                        </span>
                      </span>
                    )}
                  </div>

                  {kills > 0 && (
                    <div className="t-caption" style={{ marginTop: 8, lineHeight: 1.5 }}>
                      {tr("Полную награду за смену уже забрал. Босс стал крепче, за добивание платят меньше — но событие открыто до конца часа.")}
                    </div>
                  )}
                </>
              ) : (
                <div className="t-caption">
                  {tr("Следующий дежурный через")} {mmss(nLeft)}
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
                  {store.wins[b.id] || 0} {tr("побед")}
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
                {Math.max(0, bossHp)} / {bossHpMax}
              </span>
            </div>
            <HpBar v={bossHp} max={bossHpMax} color="var(--danger)" />
          </Panel>

          {/*
            АРЕНА. Вместо висящей в воздухе головы — сцена с двумя
            бойцами целиком: они дышат, бьют, ставят блок, отлетают от
            ударов и падают. Всё рисование в канвасе (BossArena), сюда
            приходят только события.
          */}
          <div style={{ position: "relative", marginBottom: 10 }}>
            <BossArena
              fx={fx}
              bossLook={boss.look}
              heroLook={heroLook}
              height={236}
            />

            {/* реплика босса поверх арены */}
            <AnimatePresence>
              {taunt && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="t-caption"
                  style={{
                    position: "absolute", left: 10, right: 10, top: 10,
                    zIndex: 3, textAlign: "center",
                    padding: "7px 11px", borderRadius: "var(--r-md)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--btn-brd)",
                    fontSize: 11, lineHeight: 1.35,
                  }}
                >
                  {taunt}
                </motion.div>
              )}
            </AnimatePresence>

            {/* подпись про замах — крупно и поверх сцены */}
            <AnimatePresence>
              {windup && !stunned && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="t-label"
                  style={{
                    position: "absolute", left: 0, right: 0, bottom: 10,
                    zIndex: 4, textAlign: "center",
                    color: "var(--danger)", fontSize: 11,
                  }}
                >
                  {tr("ЗАМАХНУЛСЯ — ЖМИ БЛОК")}
                </motion.div>
              )}
            </AnimatePresence>

            {stunned && (
              <div
                className="t-label"
                style={{
                  position: "absolute", left: 0, right: 0, bottom: 10,
                  zIndex: 4, textAlign: "center",
                  color: "var(--ok)", fontSize: 11,
                }}
              >
                {tr("ОГЛУШЁН — БЕЙ, УРОН ВДВОЕ")}
              </div>
            )}
          </div>

          {/* Здоровье игрока */}
          <Panel r="lg" style={{ padding: 13, marginBottom: 10 }}>
            <div className="flex items-center" style={{ gap: 9, marginBottom: 8 }}>
              <span className="t-title-sm flex-1">{tr("Ты")}</span>
              <span className="t-num" style={{ fontSize: 12 }}>{Math.max(0, myHp)} / {MY_HP_MAX}</span>
            </div>
            <HpBar v={myHp} max={MY_HP_MAX} color="var(--ok)" />

            {/* шкала ярости под здоровьем */}
            <div className="flex items-center" style={{ gap: 8, marginTop: 9 }}>
              <span className="t-label" style={{ fontSize: 8, color: "var(--text-mute)" }}>
                {tr("ЯРОСТЬ")}
              </span>
              <span className="flex-1">
                <div
                  style={{
                    height: 6, borderRadius: 99, overflow: "hidden",
                    background: "var(--surface-3)",
                  }}
                >
                  <motion.div
                    animate={{ width: `${power}%` }}
                    transition={{ duration: 0.2 }}
                    style={{
                      height: "100%",
                      background: power >= 100 ? "var(--gold)" : "var(--violet)",
                    }}
                  />
                </div>
              </span>
              <span className="t-num" style={{ fontSize: 10, color: power >= 100 ? "var(--gold)" : "var(--text-mute)" }}>
                {Math.round(power)}%
              </span>
            </div>
          </Panel>

          {/*
            УПРАВЛЕНИЕ. Вместо одной кнопки «БИТЬ» — выбор зоны удара.
            Подсвеченная зона = открытое слабое место, попадание по ней
            даёт тройной урон.
          */}
          <div className="flex" style={{ gap: 7, marginBottom: 8 }}>
            {([
              { id: "head" as const, label: tr("В ГОЛОВУ"), icon: "skull" as const },
              { id: "body" as const, label: tr("В КОРПУС"), icon: "fist" as const },
              { id: "legs" as const, label: tr("ПО НОГАМ"), icon: "run" as const },
            ]).map((z) => {
              const open = weak === z.id;
              return (
                <Tap
                  key={z.id}
                  onClick={() => punch(z.id)}
                  r="md"
                  center
                  className="t-label"
                  style={{
                    flex: 1, padding: "15px 0", fontSize: 9,
                    background: open ? "var(--gold-soft)" : undefined,
                    border: open ? "1.5px solid var(--gold)" : undefined,
                    color: open ? "var(--gold)" : undefined,
                  }}
                  sound="none"
                >
                  <span className="flex flex-col items-center" style={{ gap: 4 }}>
                    <Icon name={z.icon} size={16} />
                    <span style={{ fontSize: 8.5 }}>{z.label}</span>
                    {open && (
                      <motion.span
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 0.7, repeat: Infinity }}
                        className="t-label"
                        style={{ fontSize: 7.5, color: "var(--gold)" }}
                      >
                        ×3
                      </motion.span>
                    )}
                  </span>
                </Tap>
              );
            })}
          </div>

          <div className="flex" style={{ gap: 8 }}>
            <Tap
              onClick={block}
              r="md" center
              disabled={!blockReady}
              className="t-title"
              style={{
                fontSize: 13, padding: "17px 0", flex: 1,
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
                <Icon name="shield" size={16} />{tr("БЛОК")}
              </span>
            </Tap>

            <Tap
              onClick={special}
              r="md" center
              disabled={power < 100}
              accent={power >= 100}
              className="t-title"
              style={{
                fontSize: 13, padding: "17px 0", flex: 1,
                opacity: power >= 100 ? 1 : 0.4,
              }}
              sound="none"
            >
              <span className="inline-flex items-center" style={{ gap: 7 }}>
                <Icon name="fire" size={16} />{tr("ДОБИТЬ")}
              </span>
            </Tap>
          </div>

          {/* Подсказка ведёт по механикам, а не просто считает удары */}
          <div className="t-caption" style={{ marginTop: 9, textAlign: "center", lineHeight: 1.4 }}>
            {fog
              ? tr("Ничего не видно — половина ударов мимо")
              : stunned
                ? tr("Оглушён! Бей, пока не очнулся")
                : power >= 100
                  ? tr("Ярость полная — жми ДОБИТЬ")
                  : weak
                    ? tr("Открылось слабое место — бей по подсвеченной зоне")
                    : windup
                      ? tr("Успей поставить блок в момент замаха — это парирование")
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
              style={{ fontSize: 30, color: phase === "win" ? "var(--ok)" : "var(--danger)" }}
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
