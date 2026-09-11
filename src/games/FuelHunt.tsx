import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { GameOver, GameHUD, HudStat } from "./shell";
import Icon from "../ui/Icon";
import { tr } from "../core/i18n";

/**
 * ОХОТА ЗА БЕНЗИНОМ — «в РФ сейчас беда с ним».
 *
 * Катаешься по заправкам на остатке топлива. На каждой — очередь, свой
 * ценник и шанс, что бензина уже нет. Дорога до заправки жрёт топливо,
 * так что ехать наугад через весь город — верный способ встать посреди
 * трассы.
 *
 * Задача: залить бак до цели, не спалив весь бензин на разъезды и не
 * разорившись. Разведка показывает, есть ли топливо, но стоит денег.
 */

interface Station {
  id: number;
  name: string;
  dist: number;        // сколько топлива съест дорога
  price: number;       // за литр
  queue: number;       // минуты
  stock: number;       // литров реально есть
  known: boolean;      // разведана ли
  visited: boolean;
}

const BRANDS = ["ЛУКОЙЛ", "РОСНЕФТЬ", "ГАЗПРОМ", "ТАТНЕФТЬ", "БАШНЕФТЬ", "У ДЯДИ ВОВЫ", "АЗС №7", "НЕФТЬ-СЕРВИС"];
/* Числа подобраны перебором (4000 партий на конфигурацию):
   при них победа ~57%, а разведка реально выгоднее слепых разъездов
   (57% против 48%). При щедрой казне разведка была бесполезна —
   каждый рубль проще было залить в бак. */
const START_FUEL = 26;
const START_MONEY = 4600;
const GOAL = 50;          // литров надо залить
const SCOUT_COST = 120;
const DISTRICT_INCOME = 800;   // подработка при переезде в новый район

/**
 * Шанс, что заправка окажется сухой, на данном круге.
 *
 * Вынесен отдельно, потому что теперь это число показывается игроку:
 * раньше дефицит был скрыт, и решение «ехать или разведать» принималось
 * вслепую — понять систему было невозможно.
 */
export function dryChance(round: number): number {
  return 0.52 + Math.min(0.34, round * 0.06);
}

function makeStations(round: number): Station[] {
  const n = 5;
  const out: Station[] = [];
  const names = [...BRANDS].sort(() => Math.random() - 0.5);
  // Дефицит растёт с каждым кругом — иначе игра не кончается
  const dry = dryChance(round);
  for (let i = 0; i < n; i++) {
    const empty = Math.random() < dry;
    out.push({
      id: round * 100 + i,
      name: names[i % names.length],
      dist: 4 + Math.round(Math.random() * 11),
      price: 58 + Math.round(Math.random() * 26) + round * 3,
      queue: Math.round(Math.random() * 40),
      stock: empty ? 0 : 8 + Math.round(Math.random() * 26),
      known: false,
      visited: false,
    });
  }
  return out;
}

export default function FuelHunt({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [fuel, setFuel] = useState(START_FUEL);
  const [money, setMoney] = useState(START_MONEY);
  const [got, setGot] = useState(0);
  const [round, setRound] = useState(0);
  /** Куда едем прямо сейчас — для полоски дороги */
  const [trip, setTrip] = useState<{ name: string; dist: number } | null>(null);
  const [stations, setStations] = useState<Station[]>(() => makeStations(0));
  const [log, setLog] = useState<{ txt: string; ok: boolean }[]>([]);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });
  const [won, setWon] = useState(false);
  const [driving, setDriving] = useState(false);

  const best = s.games.fuel?.best || 0;
  const startT = useRef(Date.now());
  const ended = useRef(false);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  /*
   * Пользователь просил «убрать таймер в начале»: отсчёт 3-2-1 здесь был
   * бессмысленным — игра пошаговая, никто никуда не бежит. Вместо него
   * показываем брифинг с правилами, и партия стартует по кнопке.
   */
  const beginRun = useCallback(() => {
    startT.current = Date.now();
    sfx.click();
    setPhase("play");
  }, []);

  const say = useCallback((txt: string, ok: boolean) => {
    setLog((l) => [{ txt, ok }, ...l].slice(0, 5));
  }, []);

  const end = useCallback((victory: boolean, sc: number) => {
    if (ended.current) return;
    ended.current = true;
    const total = Math.floor(sc + (victory ? 700 : 0));
    const coins = Math.floor(total * 3.4 * (1 + s.prestige * 0.12));
    const xp = Math.floor(total * 0.65 + 20);
    setResult({ score: total, coins, xp });
    setWon(victory);
    setPhase("over");
    if (victory) { sfx.legend(); haptic("success"); } else { sfx.gameOver(); haptic("error"); }
    addCoins(coins);
    addXp(xp);
    finishGame("fuel", total, Date.now() - startT.current);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  /** Разведка: узнать, есть ли бензин, за деньги */
  const scout = (st: Station) => {
    if (phase !== "play" || driving || st.known || st.visited) return;
    if (money < SCOUT_COST) { sfx.error(); say(tr("Не хватает на звонок"), false); return; }
    setMoney((m) => m - SCOUT_COST);
    setStations((arr) => arr.map((x) => (x.id === st.id ? { ...x, known: true } : x)));
    sfx.tap();
    haptic("light");
    say(st.stock > 0 ? `${st.name}: ${tr("бензин есть")}` : `${st.name}: ${tr("сухо")}`, st.stock > 0);
  };

  /** Поехать на заправку */
  const drive = (st: Station) => {
    if (phase !== "play" || driving || st.visited) return;
    setTrip({ name: st.name, dist: st.dist });   // для анимации дороги
    setDriving(true);
    sfx.click();

    setTimeout(() => {
      const cost = st.dist;
      const nf = fuel - cost;
      setFuel(nf);

      if (nf <= 0) {
        say(tr("Встал посреди дороги"), false);
        setDriving(false);
        setTrip(null);
        end(false, scoreRef.current);
        return;
      }

      setStations((arr) => arr.map((x) => (x.id === st.id ? { ...x, visited: true, known: true } : x)));

      if (st.stock <= 0) {
        say(`${st.name}: ${tr("бензина нет")}`, false);
        sfx.error();
        haptic("error");
        setDriving(false);
        setTrip(null);
        checkStuck(nf);
        return;
      }

      // очередь: чем длиннее, тем больше шанс, что при тебе всё разберут
      const lost = Math.random() < st.queue / 90;
      const canBuy = Math.min(st.stock, Math.floor(money / st.price));
      const liters = lost ? Math.floor(canBuy * 0.35) : canBuy;

      if (liters <= 0) {
        say(tr("Денег не хватило даже на литр"), false);
        sfx.error();
        setDriving(false);
        setTrip(null);
        checkStuck(nf);
        return;
      }

      const spend = liters * st.price;
      setMoney((m) => m - spend);
      setFuel((f) => f + liters);
      setGot((g) => {
        const ng = g + liters;
        if (ng >= GOAL) {
          const sc = scoreRef.current + liters * 12;
          setScore(sc);
          setTimeout(() => end(true, sc), 300);
        }
        return ng;
      });
      setScore((v) => v + liters * 12 + (lost ? 0 : 40));
      say(
        lost
          ? `${st.name}: ${tr("разобрали при тебе")}, +${liters} ${tr("л")}`
          : `${st.name}: +${liters} ${tr("л")} ${tr("за")} ${spend} ₽`,
        !lost,
      );
      sfx.coin();
      haptic("success");
      setDriving(false);
      setTrip(null);
      checkStuck(nf + liters);
    }, 620);
  };

  /** Если ехать больше некуда и не на что — конец */
  const checkStuck = (curFuel: number) => {
    setStations((arr) => {
      const open = arr.filter((x) => !x.visited);
      const reachable = open.filter((x) => x.dist < curFuel);
      if (reachable.length === 0) {
        if (open.length === 0) {
          // круг пройден — новый район города
          const nr = round + 1;
          setRound(nr);
          setTimeout(() => {
            setStations(makeStations(nr));
            setMoney((m) => m + DISTRICT_INCOME);
            say(`${tr("Новый район")}, +${DISTRICT_INCOME} ₽`, true);
          }, 400);
          return arr;
        }
        setTimeout(() => end(false, scoreRef.current), 400);
      }
      return arr;
    });
  };

  const restart = () => {
    ended.current = false;
    setFuel(START_FUEL); setMoney(START_MONEY); setGot(0); setRound(0);
    setStations(makeStations(0)); setLog([]); setScore(0); setWon(false);
    setDriving(false); setTrip(null); setPhase("count");
  };

  const goalPct = Math.min(100, (got / GOAL) * 100);
  const dryPct = Math.round(dryChance(round) * 100);

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "var(--bg)" }}>
      <GameHUD score={score} best={best} onExit={onExit} label={tr("ОЧКИ")}
        extra={
          <>
            <HudStat
              label={tr("БЕНЗИН")}
              value={`${Math.max(0, Math.round(fuel))} ${tr("л")}`}
              tone={fuel < 12 ? "danger" : "ok"}
              min={52}
            />
            <HudStat label={tr("ДЕНЬГИ")} value={`${money} ₽`} tone="warn" min={54} />
          </>
        }
      />

      <div
        className="flex-1 flex flex-col overflow-y-auto"
        style={{ padding: "calc(var(--sat) + 74px) 16px calc(var(--sab) + 26px)" }}
      >
        {/* цель */}
        <div
          style={{
            padding: "12px 14px", borderRadius: "var(--r-md)",
            background: "var(--surface)", border: "1px solid var(--surface-brd)",
            marginBottom: 12,
          }}
        >
          <div className="flex items-center" style={{ gap: 8, marginBottom: 8 }}>
            <span className="t-label flex-1" style={{ fontSize: 9 }}>{tr("НАЛИТО В БАК")}</span>
            <span className="t-num" style={{ fontSize: 12 }}>{got} / {GOAL} {tr("л")}</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "var(--fill-2)", overflow: "hidden" }}>
            <motion.div
              animate={{ width: `${goalPct}%` }}
              style={{ height: "100%", background: "var(--ok)" }}
            />
          </div>
        </div>

        {/*
          Обстановка по стране: показываем реальный шанс, что заправка
          окажется сухой, и на сколько километров хватит бака. Раньше
          дефицит был скрыт и решения принимались вслепую.
        */}
        <div
          style={{
            padding: "12px 14px", borderRadius: "var(--r-md)",
            background: "var(--surface)", border: "1px solid var(--surface-brd)",
            marginBottom: 12,
          }}
        >
          <div className="flex items-center" style={{ gap: 8, marginBottom: 9 }}>
            <span className="t-label flex-1" style={{ fontSize: 9 }}>{tr("ОБСТАНОВКА С БЕНЗИНОМ")}</span>
            <span
              className="t-num"
              style={{ fontSize: 12, color: dryPct > 70 ? "var(--danger)" : dryPct > 55 ? "var(--gold)" : "var(--ok)" }}
            >
              {dryPct}% {tr("сухо")}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "var(--ok-soft)", overflow: "hidden" }}>
            <motion.div
              animate={{ width: `${dryPct}%` }}
              transition={{ duration: 0.3 }}
              style={{ height: "100%", background: dryPct > 70 ? "var(--danger)" : "var(--gold)" }}
            />
          </div>
          <div className="t-caption" style={{ fontSize: 10.5, marginTop: 7, opacity: 0.7 }}>
            {tr("Круг")} {round + 1} · {tr("хватит на")} {Math.floor(fuel)} {tr("л пути")}
          </div>
        </div>

        {/* Дорога: видно, куда едем и сколько топлива останется */}
        {driving && trip && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: "12px 14px", borderRadius: "var(--r-md)",
              background: "var(--surface-2)", border: "1px solid var(--acc)",
              marginBottom: 12,
            }}
          >
            <div className="t-label" style={{ fontSize: 9, marginBottom: 8 }}>
              {tr("В ПУТИ")}: {trip.name}
            </div>
            <div style={{ position: "relative", height: 26 }}>
              <div
                style={{
                  position: "absolute", left: 0, right: 0, top: 12,
                  height: 3, borderRadius: 2,
                  background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.35) 0 8px, transparent 8px 16px)",
                }}
              />
              <motion.div
                initial={{ left: "0%" }}
                animate={{ left: "88%" }}
                transition={{ duration: 1.1, ease: "linear" }}
                style={{ position: "absolute", top: 0 }}
              >
                <Icon name="speed" size={22} />
              </motion.div>
            </div>
            <div className="t-caption" style={{ fontSize: 10.5, marginTop: 4, opacity: 0.72 }}>
              −{trip.dist} {tr("л")} · {tr("останется")} {Math.max(0, Math.floor(fuel - trip.dist))} {tr("л")}
            </div>
          </motion.div>
        )}

        {/* заправки */}
        <div className="flex flex-col" style={{ gap: 9 }}>
          {stations.map((st) => {
            const far = st.dist >= fuel;
            return (
              <div
                key={st.id}
                style={{
                  padding: "12px 13px", borderRadius: "var(--r-md)",
                  background: "var(--surface)",
                  border: `1px solid ${
                    st.visited ? "var(--fill-1)"
                      : st.known ? (st.stock > 0 ? "rgba(89,255,158,0.45)" : "rgba(255,107,77,0.45)")
                        : "var(--surface-brd)"
                  }`,
                  opacity: st.visited ? 0.42 : 1,
                }}
              >
                <div className="flex items-center" style={{ gap: 9, marginBottom: 9 }}>
                  <span style={{ color: "var(--acc)", lineHeight: 0 }}>
                    <Icon name="bolt" size={14} />
                  </span>
                  <span className="t-body clip1 flex-1" style={{ fontSize: 12.5 }}>{st.name}</span>
                  {st.known && (
                    <span
                      className="t-label shrink-0"
                      style={{
                        fontSize: 8, padding: "3px 7px", borderRadius: 999,
                        background: st.stock > 0 ? "rgba(89,255,158,0.14)" : "rgba(255,107,77,0.14)",
                        color: st.stock > 0 ? "var(--ok)" : "var(--danger)",
                      }}
                    >
                      {st.stock > 0 ? tr("ЕСТЬ") : tr("СУХО")}
                    </span>
                  )}
                </div>

                <div className="flex items-center" style={{ gap: 12, marginBottom: 8 }}>
                  <span className="t-caption" style={{ color: far ? "var(--danger)" : "var(--text-mute)" }}>
                    {tr("дорога")} −{st.dist} {tr("л")}
                  </span>
                  <span className="t-caption" style={{ color: "var(--text-mute)" }}>
                    {st.price} ₽/{tr("л")}
                  </span>
                  <span className="t-caption" style={{ color: "var(--text-mute)" }}>
                    {tr("очередь")} {st.queue} {tr("мин")}
                  </span>
                </div>

                {/*
                  «Непонятно сколько денег» — считаем прямо на карточке,
                  сколько литров ты вообще способен купить на текущие
                  деньги по этому ценнику. Голый ₽/л ни о чём не говорил.
                */}
                <div
                  className="flex items-center"
                  style={{
                    gap: 6, marginBottom: 10, padding: "6px 9px",
                    borderRadius: "var(--r-xs)",
                    background: "var(--fill-1)",
                  }}
                >
                  <span className="t-label" style={{ fontSize: 8, color: "var(--text-mute)" }}>
                    {tr("ХВАТИТ НА")}
                  </span>
                  <span
                    className="t-num"
                    style={{
                      fontSize: 11.5,
                      color: Math.floor(money / st.price) >= 10 ? "var(--ok)" : "var(--gold)",
                    }}
                  >
                    {Math.floor(money / st.price)} {tr("л")}
                  </span>
                  <span className="t-caption flex-1 text-right" style={{ fontSize: 9.5 }}>
                    {tr("осталось налить")} {Math.max(0, GOAL - got)} {tr("л")}
                  </span>
                </div>

                <div className="flex" style={{ gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => scout(st)}
                    disabled={st.known || st.visited || driving || money < SCOUT_COST}
                    className="t-label"
                    style={{
                      flex: 1, padding: "10px 8px", borderRadius: "var(--r-sm)",
                      background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
                      color: "var(--text)", fontSize: 9,
                      opacity: st.known || st.visited || money < SCOUT_COST ? 0.4 : 1,
                    }}
                  >
                    {tr("УЗНАТЬ")} {SCOUT_COST}₽
                  </button>
                  <button
                    type="button"
                    onClick={() => drive(st)}
                    disabled={st.visited || driving}
                    className="t-label"
                    style={{
                      flex: 1.3, padding: "10px 8px", borderRadius: "var(--r-sm)",
                      background: far ? "rgba(255,107,77,0.16)" : "var(--acc)",
                      border: `1px solid ${far ? "rgba(255,107,77,0.5)" : "var(--acc)"}`,
                      color: far ? "var(--danger)" : "#0b0b0e", fontSize: 9,
                      opacity: st.visited || driving ? 0.4 : 1,
                    }}
                  >
                    {driving ? tr("ЕДУ…") : far ? tr("НЕ ХВАТИТ") : tr("ЕХАТЬ")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* лог */}
        {log.length > 0 && (
          <div className="flex flex-col" style={{ gap: 5, marginTop: 12 }}>
            {log.map((l, i) => (
              <div
                key={i}
                className="t-caption clip1"
                style={{
                  padding: "7px 10px", borderRadius: "var(--r-sm)",
                  background: "var(--surface)",
                  color: l.ok ? "var(--ok)" : "var(--danger)",
                  opacity: 1 - i * 0.16,
                }}
              >
                {l.txt}
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {phase === "count" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col justify-center"
            style={{
              zIndex: 80, background: "var(--scrim)",
              padding: "calc(var(--sat) + 74px) 20px calc(var(--sab) + 30px)",
            }}
          >
            <div
              style={{
                padding: "18px 16px", borderRadius: "var(--r-xl)",
                background: "var(--surface)", border: "1px solid var(--surface-brd)",
              }}
            >
              <div className="t-h2" style={{ marginBottom: 4 }}>{tr("ГДЕ БЕНЗИН")}</div>
              <div className="t-caption" style={{ marginBottom: 14, lineHeight: 1.4 }}>
                {tr("В стране дефицит. Твоя задача — залить полный бак, пока не встал посреди дороги.")}
              </div>

              {[
                { n: "1", t: tr("Залей {goal} л в бак — это победа").replace("{goal}", String(GOAL)) },
                { n: "2", t: tr("Дорога до каждой заправки жрёт бензин: цифра «−N л» на карточке") },
                { n: "3", t: tr("Половина заправок сухие. Звонок-разведка стоит {c} ₽, зато не поедешь зря").replace("{c}", String(SCOUT_COST)) },
                { n: "4", t: tr("Кончился бензин или деньги — проиграл") },
              ].map((r) => (
                <div key={r.n} className="flex" style={{ gap: 10, marginBottom: 9 }}>
                  <span
                    className="t-num"
                    style={{
                      fontSize: 11, width: 22, height: 22, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: "var(--r-xs)",
                      background: "var(--acc)", color: "var(--acc-ink)",
                    }}
                  >
                    {r.n}
                  </span>
                  <span className="t-caption flex-1" style={{ fontSize: 11, lineHeight: 1.4 }}>
                    {r.t}
                  </span>
                </div>
              ))}

              <div
                className="flex"
                style={{
                  gap: 10, marginTop: 14, paddingTop: 12,
                  borderTop: "1px solid var(--surface-brd)",
                }}
              >
                <div className="flex-1">
                  <div className="t-label" style={{ fontSize: 8.5 }}>{tr("В БАКЕ")}</div>
                  <div className="t-num" style={{ fontSize: 15 }}>{START_FUEL} {tr("л")}</div>
                </div>
                <div className="flex-1">
                  <div className="t-label" style={{ fontSize: 8.5 }}>{tr("НА РУКАХ")}</div>
                  <div className="t-num" style={{ fontSize: 15 }}>{START_MONEY} ₽</div>
                </div>
              </div>

              <button
                className="btn-acc w-full"
                style={{ marginTop: 14, height: 46, borderRadius: "var(--r-md)" }}
                onClick={beginRun}
              >
                <span className="t-label" style={{ fontSize: 11 }}>{tr("ПОЕХАЛИ")}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "over" && (
        <GameOver
          score={result.score}
          best={best}
          coins={result.coins}
          xp={result.xp}
          onRetry={restart}
          onExit={onExit}
          title={won ? tr("БАК ПОЛНЫЙ") : tr("БЕНЗИН КОНЧИЛСЯ")}
          sub={won ? tr("Нашёл, где налили") : tr("В РФ беда с бензином")}
        />
      )}
    </div>
  );
}
