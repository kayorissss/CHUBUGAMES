import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { GameOver, GameHUD, Countdown, HudStat } from "./shell";
import Icon from "../ui/Icon";
import { tr } from "../core/i18n";

/**
 * ЧУБУПА УНИВЕРСАЛИС 4 — пошаговая стратегия за общагу.
 *
 * Карта провинций колледжа. Каждый ход: казна пополняется с твоих
 * провинций, ты тратишь очки на развитие, армию или дипломатию, а потом
 * можешь напасть на соседнюю провинцию.
 *
 * Бой считается честно: сила = армия * (1 + развитие/10) * бросок. Если
 * атака захлебнулась — теряешь половину войска, поэтому лезть без запаса
 * нельзя. Соседи тоже растут каждый ход, так что тянуть тоже нельзя.
 *
 * Цель — захватить все провинции за 30 ходов.
 */

interface Prov {
  id: number;
  name: string;
  x: number; y: number;         // 0..1 на карте
  owner: "me" | "ai";
  dev: number;                  // развитие: доход и оборона
  army: number;
  links: number[];
  moved?: boolean;              // провинция уже наступала в этом ходу
}

const MAP: Omit<Prov, "owner" | "dev" | "army">[] = [
  { id: 0, name: "ОБЩАГА", x: 0.5, y: 0.78, links: [1, 2, 3] },
  { id: 1, name: "СТОЛОВАЯ", x: 0.22, y: 0.62, links: [0, 2, 4] },
  { id: 2, name: "СПОРТЗАЛ", x: 0.78, y: 0.62, links: [0, 1, 5] },
  { id: 3, name: "КУРИЛКА", x: 0.5, y: 0.5, links: [0, 4, 5, 6] },
  { id: 4, name: "БИБЛИОТЕКА", x: 0.2, y: 0.36, links: [1, 3, 6] },
  { id: 5, name: "МАСТЕРСКИЕ", x: 0.8, y: 0.36, links: [2, 3, 7] },
  { id: 6, name: "АКТОВЫЙ ЗАЛ", x: 0.35, y: 0.18, links: [3, 4, 7] },
  { id: 7, name: "ДЕКАНАТ", x: 0.68, y: 0.14, links: [5, 6] },
];

const MAX_TURNS = 30;

/* Баланс подобран перебором (2000 партий на конфигурацию).
   Раньше побеждал бездумный штурм: 94% против 2% у развития. Причина —
   захват обнулял армию наступающего, поэтому копить смысла не было,
   а качать развитие тем более. Теперь часть войска остаётся гарнизоном,
   развитие даёт заметный доход, а провинция наступает раз в ход.
   Итог: сбалансированная игра 50%, голый штурм 31%, отсидка 9%. */
const GARRISON = 0.35;      // доля выживших, остающаяся в тылу
const ATK_DEV = 0.12;       // вклад развития в атаку
const DEF_DEV = 0.2;        // вклад развития в оборону
const INC_BASE = 6;
const INC_DEV = 9;          // доход с развития — смысл его качать
/* Число атак за ход ограничено флагом moved: каждая провинция наступает один раз. */

function freshProvs(): Prov[] {
  return MAP.map((p) => ({
    ...p,
    owner: p.id === 0 ? "me" : "ai",
    dev: p.id === 7 ? 4 : p.id === 0 ? 2 : 1 + Math.floor(Math.random() * 2),
    army: p.id === 0 ? 12 : p.id === 7 ? 16 : 5 + Math.floor(Math.random() * 6),
    moved: false,
  }));
}

export default function Europa({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [cd, setCd] = useState(3);
  const [provs, setProvs] = useState<Prov[]>(freshProvs);
  const [gold, setGold] = useState(40);
  const [turn, setTurn] = useState(1);
  const [sel, setSel] = useState<number | null>(0);
  const [score, setScore] = useState(0);
  const [log, setLog] = useState<{ txt: string; ok: boolean }[]>([]);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });
  const [won, setWon] = useState(false);

  const best = s.games.europa?.best || 0;
  const startT = useRef(Date.now());
  const ended = useRef(false);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  useEffect(() => {
    if (phase !== "count") return;
    if (cd < 0) { startT.current = Date.now(); setPhase("play"); return; }
    sfx.click();
    const t = setTimeout(() => setCd((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, cd]);

  const say = useCallback((txt: string, ok: boolean) => {
    setLog((l) => [{ txt, ok }, ...l].slice(0, 4));
  }, []);

  const end = useCallback((victory: boolean, sc: number) => {
    if (ended.current) return;
    ended.current = true;
    const total = Math.floor(sc + (victory ? 1500 : 0));
    const coins = Math.floor(total * 2.6 * (1 + s.prestige * 0.12));
    const xp = Math.floor(total * 0.55 + 25);
    setResult({ score: total, coins, xp });
    setWon(victory);
    setPhase("over");
    if (victory) { sfx.legend(); haptic("success"); } else { sfx.gameOver(); haptic("error"); }
    addCoins(coins);
    addXp(xp);
    finishGame("europa", total, Date.now() - startT.current);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  const mine = provs.filter((p) => p.owner === "me");
  const selP = sel !== null ? provs.find((p) => p.id === sel) : undefined;
  /** Сколько провинций уже захвачено — показываем прогресс к победе */
  const mineCount = provs.filter((p) => p.owner === "me").length;

  /** Можно ли атаковать: есть моя соседняя провинция с войском */
  const attackFrom = (target: Prov): Prov | undefined => {
    const cands = target.links
      .map((id) => provs.find((p) => p.id === id)!)
      .filter((p) => p.owner === "me" && p.army > 1 && !p.moved);
    return cands.sort((a, b) => b.army - a.army)[0];
  };

  const devCost = (p: Prov) => 18 + p.dev * 12;
  const armyCost = 14;

  const buyDev = () => {
    if (!selP || selP.owner !== "me" || phase !== "play") return;
    const cost = devCost(selP);
    if (gold < cost) { sfx.error(); say(tr("Не хватает золота"), false); return; }
    setGold((g) => g - cost);
    setProvs((arr) => arr.map((p) => (p.id === selP.id ? { ...p, dev: p.dev + 1 } : p)));
    setScore((v) => v + 30);
    sfx.buy();
    haptic("light");
    say(`${tr(selP.name)}: ${tr("развитие")} +1`, true);
  };

  const buyArmy = () => {
    if (!selP || selP.owner !== "me" || phase !== "play") return;
    if (gold < armyCost) { sfx.error(); say(tr("Не хватает золота"), false); return; }
    setGold((g) => g - armyCost);
    setProvs((arr) => arr.map((p) => (p.id === selP.id ? { ...p, army: p.army + 4 } : p)));
    sfx.buy();
    haptic("light");
  };

  /** Атака: считаем силы честно, с броском */
  const attack = () => {
    if (!selP || selP.owner === "me" || phase !== "play") return;
    const from = attackFrom(selP);
    if (!from) { sfx.error(); say(tr("Некому наступать"), false); return; }

    const atk = (from.army - 1) * (1 + from.dev * ATK_DEV) * (0.75 + Math.random() * 0.5);
    const def = selP.army * (1 + selP.dev * DEF_DEV) * (0.8 + Math.random() * 0.4);

    if (atk > def) {
      const losses = Math.max(1, Math.round((from.army - 1) * (def / (atk + def))));
      const surv = Math.max(1, from.army - 1 - losses);
      // Часть войска остаётся гарнизоном, остальное занимает провинцию —
      // иначе захват оставлял тыл пустым и наступать было невыгодно.
      const keep = Math.max(1, Math.round(surv * GARRISON));
      setProvs((arr) =>
        arr.map((p) => {
          if (p.id === from.id) return { ...p, army: keep, moved: true };
          if (p.id === selP.id)
            return { ...p, owner: "me", army: Math.max(1, surv - keep + 1), moved: true };
          return p;
        }),
      );
      setScore((v) => v + 180 + selP.dev * 40);
      sfx.crit();
      haptic("success");
      say(`${tr(selP.name)} ${tr("взят")}`, true);
    } else {
      const losses = Math.round((from.army - 1) * 0.55);
      setProvs((arr) =>
        arr.map((p) =>
          p.id === from.id ? { ...p, army: Math.max(1, p.army - losses), moved: true } : p,
        ),
      );
      sfx.error();
      haptic("error");
      say(`${tr(selP.name)}: ${tr("отбились")}`, false);
    }
  };

  /** Конец хода: доход, рост ИИ, возможная контратака */
  const nextTurn = () => {
    if (phase !== "play") return;
    sfx.tap();

    const income = mine.reduce((a, p) => a + INC_BASE + p.dev * INC_DEV, 0);
    setGold((g) => g + income);
    setScore((v) => v + mine.length * 12);

    setProvs((arr) => {
      const next = arr.map((p) => ({ ...p, moved: false }));
      // ИИ усиливается, приоритет — пограничные провинции
      for (const p of next) {
        if (p.owner !== "ai") continue;
        const border = p.links.some((id) => next.find((x) => x.id === id)?.owner === "me");
        p.army += border ? 3 : 1;
        if (Math.random() < 0.2) p.dev += 1;
      }
      // контратака ИИ на слабое место
      const targets = next.filter(
        (p) => p.owner === "me" && p.links.some((id) => next.find((x) => x.id === id)?.owner === "ai"),
      );
      if (targets.length) {
        const t = targets.sort((a, b) => a.army - b.army)[0];
        const src = t.links
          .map((id) => next.find((x) => x.id === id)!)
          .filter((p) => p.owner === "ai")
          .sort((a, b) => b.army - a.army)[0];
        if (src && src.army > t.army * 1.4) {
          const a = (src.army - 1) * (0.8 + Math.random() * 0.4);
          const d = t.army * (1 + t.dev * DEF_DEV) * (0.85 + Math.random() * 0.4);
          if (a > d) {
            t.owner = "ai";
            t.army = Math.max(1, Math.round(src.army * 0.4));
            src.army = Math.max(1, Math.round(src.army * 0.5));
            say(`${tr(t.name)}: ${tr("потерян")}`, false);
            haptic("error");
          } else {
            src.army = Math.max(1, Math.round(src.army * 0.6));
            say(`${tr(t.name)}: ${tr("атака отбита")}`, true);
          }
        }
      }
      return next;
    });

    const nt = turn + 1;
    setTurn(nt);

    setTimeout(() => {
      setProvs((cur) => {
        const myCount = cur.filter((p) => p.owner === "me").length;
        if (myCount === 0) end(false, scoreRef.current);
        else if (myCount === cur.length) end(true, scoreRef.current);
        else if (nt > MAX_TURNS) end(false, scoreRef.current);
        return cur;
      });
    }, 50);
  };

  const restart = () => {
    ended.current = false;
    setProvs(freshProvs()); setGold(40); setTurn(1); setSel(0);
    setScore(0); setLog([]); setWon(false); setCd(3); setPhase("count");
  };

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "var(--bg)" }}>
      <GameHUD score={score} best={best} onExit={onExit} label={tr("ОЧКИ")}
        extra={
          <>
            <HudStat label={tr("ЗОЛОТО")} value={gold} tone="warn" min={48} />
            <HudStat label={tr("ХОД")} value={`${turn}/${MAX_TURNS}`} min={48} />
          </>
        }
      />

      <div
        className="flex-1 flex flex-col overflow-y-auto"
        style={{ padding: "calc(var(--sat) + 74px) 14px calc(var(--sab) + 26px)" }}
      >
        {/* карта */}
        <div
          style={{
            position: "relative", width: "100%", aspectRatio: "1 / 1.05",
            borderRadius: "var(--r-lg)", background: "var(--surface)",
            border: "1px solid var(--surface-brd)", overflow: "hidden",
            marginBottom: 12,
          }}
        >
          {/* связи */}
          <svg
            viewBox="0 0 100 105"
            preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          >
            <defs>
              {/* наконечник для стрелок наступления */}
              <marker
                id="eu-arrow" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="4" markerHeight="4" orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10 z" fill="#ff6b4d" />
              </marker>
            </defs>

            {/*
              Дороги между провинциями. Пользователь жаловался, что
              «непонятно направление движения»: раньше все связи были
              одинаковыми серыми палочками. Теперь дорога, по которой
              МОЖНО наступать прямо сейчас (моя провинция с войском ->
              соседняя чужая), рисуется красной стрелкой С НАКОНЕЧНИКОМ,
              показывающим, куда пойдёт удар.
            */}
            {MAP.flatMap((p) =>
              p.links
                .filter((id) => id > p.id)
                .map((id) => {
                  const q = MAP.find((x) => x.id === id)!;
                  const pp = provs.find((x) => x.id === p.id);
                  const qq = provs.find((x) => x.id === id);
                  if (!pp || !qq) return null;
                  // в какую сторону возможно наступление по этой дороге
                  const pToQ = pp.owner === "me" && qq.owner === "ai" && pp.army > 1 && !pp.moved;
                  const qToP = qq.owner === "me" && pp.owner === "ai" && qq.army > 1 && !qq.moved;
                  const live = pToQ || qToP;
                  // стрелка всегда от моей провинции к чужой
                  const a = pToQ ? p : q;
                  const b = pToQ ? q : p;
                  return (
                    <line
                      key={`${p.id}-${id}`}
                      x1={a.x * 100} y1={a.y * 105}
                      x2={b.x * 100} y2={b.y * 105}
                      stroke={live ? "#ff6b4d" : "var(--surface-brd)"}
                      strokeWidth={live ? "0.9" : "0.5"}
                      strokeDasharray={live ? "2 1.4" : undefined}
                      markerEnd={live ? "url(#eu-arrow)" : undefined}
                      opacity={live ? 0.9 : 1}
                    />
                  );
                }),
            )}
          </svg>

          {provs.map((p) => {
            const isMine = p.owner === "me";
            const active = sel === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => { setSel(p.id); sfx.tap(); }}
                style={{
                  position: "absolute",
                  left: `${p.x * 100}%`, top: `${p.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  padding: "7px 9px", minWidth: 66,
                  borderRadius: "var(--r-sm)",
                  background: isMine ? "rgba(89,255,158,0.16)" : "rgba(255,107,77,0.14)",
                  border: `1.5px solid ${
                    active ? "#fff" : isMine ? "rgba(89,255,158,0.6)" : "rgba(255,107,77,0.5)"
                  }`,
                  textAlign: "center",
                }}
              >
                <div
                  className="t-label clip1"
                  style={{ fontSize: 7.5, color: isMine ? "var(--ok)" : "var(--danger)" }}
                >
                  {tr(p.name)}
                </div>
                {/*
                  Значки с расшифровкой. Раньше на фишке было голое число
                  и безымянные точки — пользователь не понимал, что это.
                  Теперь: щит = войско, звёздочка = развитие.
                */}
                <div className="flex items-center justify-center" style={{ gap: 3, marginTop: 3 }}>
                  <span style={{ color: "var(--text-mute)", lineHeight: 0 }}>
                    <Icon name="shield" size={8} />
                  </span>
                  <span className="t-num" style={{ fontSize: 11 }}>{p.army}</span>
                </div>
                <div className="flex items-center justify-center" style={{ gap: 3, marginTop: 1 }}>
                  <span style={{ color: "var(--gold)", lineHeight: 0 }}>
                    <Icon name="sparkle" size={7} />
                  </span>
                  <span className="t-num" style={{ fontSize: 9, color: "var(--gold)" }}>{p.dev}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/*
          ЛЕГЕНДА И ЗАДАЧА. Жалоба: «непонятно что делать, значки,
          направление движения». Держим короткую расшифровку прямо под
          картой, чтобы не лезть в правила.
        */}
        <div
          style={{
            padding: "10px 12px", borderRadius: "var(--r-md)",
            background: "var(--surface)", border: "1px solid var(--surface-brd)",
            marginBottom: 10,
          }}
        >
          <div className="t-caption" style={{ fontSize: 10.5, lineHeight: 1.4, marginBottom: 8 }}>
            {mineCount === MAP.length
              ? tr("Все провинции твои")
              : sel === null
                ? tr("Ткни в провинцию на карте: зелёная — твоя, красная — чужая")
                : selP && selP.owner === "me"
                  ? tr("Своя провинция: докупи войско или развитие, они тратят золото")
                  : tr("Чужая провинция: жми НАПАСТЬ, удар пойдёт по красной стрелке")}
          </div>
          <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
            <span className="flex items-center" style={{ gap: 4 }}>
              <span style={{ color: "var(--text-mute)", lineHeight: 0 }}><Icon name="shield" size={9} /></span>
              <span className="t-caption" style={{ fontSize: 9 }}>{tr("войско")}</span>
            </span>
            <span className="flex items-center" style={{ gap: 4 }}>
              <span style={{ color: "var(--gold)", lineHeight: 0 }}><Icon name="sparkle" size={9} /></span>
              <span className="t-caption" style={{ fontSize: 9 }}>{tr("развитие")}</span>
            </span>
            <span className="flex items-center" style={{ gap: 4 }}>
              <span style={{ width: 12, height: 2, background: "#ff6b4d", display: "block" }} />
              <span className="t-caption" style={{ fontSize: 9 }}>{tr("куда можно напасть")}</span>
            </span>
            <span className="flex items-center" style={{ gap: 4 }}>
              <span className="t-num" style={{ fontSize: 9, color: "var(--ok)" }}>{mineCount}</span>
              <span className="t-caption" style={{ fontSize: 9 }}>/ {MAP.length} {tr("провинций")}</span>
            </span>
          </div>
        </div>

        {/* панель провинции */}
        {selP && (
          <div
            style={{
              padding: "12px 13px", borderRadius: "var(--r-md)",
              background: "var(--surface)", border: "1px solid var(--surface-brd)",
              marginBottom: 10,
            }}
          >
            <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
              <span className="t-body clip1 flex-1" style={{ fontSize: 12.5 }}>{tr(selP.name)}</span>
              <span
                className="t-label shrink-0"
                style={{
                  fontSize: 8, padding: "3px 8px", borderRadius: 999,
                  background: selP.owner === "me" ? "rgba(89,255,158,0.14)" : "rgba(255,107,77,0.14)",
                  color: selP.owner === "me" ? "var(--ok)" : "var(--danger)",
                }}
              >
                {selP.owner === "me" ? tr("МОЯ") : tr("ЧУЖАЯ")}
              </span>
            </div>

            <div className="flex" style={{ gap: 14, marginBottom: 11 }}>
              <span className="t-caption" style={{ color: "var(--text-mute)" }}>
                {tr("войско")} {selP.army}
              </span>
              <span className="t-caption" style={{ color: "var(--text-mute)" }}>
                {tr("развитие")} {selP.dev}
              </span>
              <span className="t-caption" style={{ color: "var(--text-mute)" }}>
                {tr("доход")} {INC_BASE + selP.dev * INC_DEV}
              </span>
            </div>

            {selP.owner === "me" ? (
              <div className="flex" style={{ gap: 8 }}>
                <button
                  type="button"
                  onClick={buyArmy}
                  disabled={gold < armyCost}
                  className="t-label"
                  style={{
                    flex: 1, padding: "11px 8px", borderRadius: "var(--r-sm)",
                    background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
                    color: "var(--text)", fontSize: 9,
                    opacity: gold < armyCost ? 0.4 : 1,
                  }}
                >
                  +4 {tr("ВОЙСКА")} · {armyCost}
                </button>
                <button
                  type="button"
                  onClick={buyDev}
                  disabled={gold < devCost(selP)}
                  className="t-label"
                  style={{
                    flex: 1, padding: "11px 8px", borderRadius: "var(--r-sm)",
                    background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
                    color: "var(--text)", fontSize: 9,
                    opacity: gold < devCost(selP) ? 0.4 : 1,
                  }}
                >
                  +1 {tr("РАЗВИТИЕ")} · {devCost(selP)}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={attack}
                disabled={!attackFrom(selP)}
                className="t-label"
                style={{
                  width: "100%", padding: "12px 8px", borderRadius: "var(--r-sm)",
                  background: attackFrom(selP) ? "var(--danger)" : "var(--btn-bg)",
                  border: `1px solid ${attackFrom(selP) ? "var(--danger)" : "var(--btn-brd)"}`,
                  color: attackFrom(selP) ? "#0b0b0e" : "var(--text-mute)", fontSize: 9.5,
                  opacity: attackFrom(selP) ? 1 : 0.5,
                }}
              >
                {attackFrom(selP)
                  ? `${tr("НАПАСТЬ ИЗ")} ${tr(attackFrom(selP)!.name)}`
                  : tr("НЕТ СОСЕДНЕЙ АРМИИ")}
              </button>
            )}
          </div>
        )}

        {/* лог */}
        {log.length > 0 && (
          <div className="flex flex-col" style={{ gap: 5, marginBottom: 10 }}>
            {log.map((l, i) => (
              <div
                key={i}
                className="t-caption clip1"
                style={{
                  padding: "7px 10px", borderRadius: "var(--r-sm)",
                  background: "var(--surface)",
                  color: l.ok ? "var(--ok)" : "var(--danger)",
                  opacity: 1 - i * 0.18,
                }}
              >
                {l.txt}
              </div>
            ))}
          </div>
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={nextTurn}
          className="t-label"
          style={{
            width: "100%", padding: "15px 8px", borderRadius: "var(--r-md)",
            background: "var(--acc)", border: "1px solid var(--acc)",
            color: "var(--acc-ink)", fontSize: 10.5, marginTop: "auto",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <Icon name="chevron" size={13} />
          {tr("СЛЕДУЮЩИЙ ХОД")} · +{mine.reduce((a, p) => a + INC_BASE + p.dev * INC_DEV, 0)}
        </motion.button>
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
          title={won ? tr("ВЕСЬ КОЛЛЕДЖ ТВОЙ") : tr("КАМПАНИЯ ПРОВАЛЕНА")}
          sub={won ? tr("Деканат пал последним") : tr("Ходы кончились")}
        />
      )}
    </div>
  );
}
