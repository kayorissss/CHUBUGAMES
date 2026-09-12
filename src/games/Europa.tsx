import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { GameOver, GameHUD, Countdown, HudStat } from "./shell";
import Icon from "../ui/Icon";
import { tr } from "../core/i18n";
import { isLowFx } from "../core/perf";
import { codesFor } from "../core/keymap";
import {
  LEVELS, KIND, aiTurn, applyBattleResult, type Kind, type Level, type Prov, type Verdict,
  armyCost, barrCost, cap, defensePower, devCost, freshProvs, fight, gloryFor,
  income, intelCost, kindOf, rankOf, sabotageable, strikePower, verdictFor, wallCost,
} from "./europa/model";

/**
 * ЧУБУПА УНИВЕРСАЛИС 5 — пошаговая стратегия за колледж.
 *
 * Что изменилось по сравнению с четвёртой частью (по просьбам игрока):
 *   • кампания из пяти уровней вместо одной карты;
 *   • здания разные: спортзал бьёт, столовая кормит, деканат держит;
 *   • в удар можно собрать СРАЗУ НЕСКОЛЬКО своих зданий — войска
 *     складываются в один удар, поэтому «общага + спортзал» берёт то, что
 *     поодиночке не взять;
 *   • клик по зданию открывает справа меню прокачки: четыре ветки, наём
 *     войска, спецдействие, соседи и оценка угрозы;
 *   • бой анимирован: точки-бойцы идут по дороге к цели, вспышка, потом
 *     итог — взял или отбились, и сколько легло с обеих сторон;
 *   • слева сверху — консоль: что произошло и за какой раунд;
 *   • ранг считается по славе через все партии;
 *   • полностью играется клавиатурой (стрелки — по дорогам, Enter — удар,
 *     пробел — следующий ход, 1…4 — прокачка).
 *
 * Правила живут в europa/model.ts, здесь только отрисовка и состояние.
 * Анимации сознательно дешёвые: transform и opacity, без blur и теней,
 * чтобы режим не ронял FPS на слабом компьютере.
 */

type Phase = "pick" | "count" | "play" | "battle" | "over";

interface LogLine {
  txt: string;
  tone: "ok" | "bad" | "info";
  turn: number;
}

interface Battle {
  to: number;
  froms: number[];
  res: ReturnType<typeof fight>;
  /** фаза: марш → столкновение → итог */
  step: 0 | 1 | 2;
}

export default function Europa({ onExit }: { onExit: () => void }) {
  const { s, set, addCoins, addXp, finishGame, questProgress } = useGame();
  const [lv, setLv] = useState<Level>(LEVELS[1]);
  const [phase, setPhase] = useState<Phase>("pick");
  const [cd, setCd] = useState(3);
  const [provs, setProvs] = useState<Prov[]>(() => freshProvs(LEVELS[1]));
  const [gold, setGold] = useState(44);
  const [turn, setTurn] = useState(1);
  const [sel, setSel] = useState<number | null>(null);
  /** мои здания, отправленные в сегодняшний удар */
  const [strike, setStrike] = useState<number[]>([]);
  /** мастерские, подготовившие осаду: следующий удар игнорирует стены */
  const [siege, setSiege] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [taken, setTaken] = useState(0);
  const [log, setLog] = useState<LogLine[]>([]);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [banner, setBanner] = useState<{ round: number; inc: number } | null>(null);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });
  const [won, setWon] = useState(false);

  const best = s.games.europa?.best || 0;
  const unlocked = Math.max(1, s.games.europa?.prog || 1);
  const glory = (s.games.europa?.totalScore || 0) + (s.games.europa?.mx || 0);
  const rank = rankOf(glory);
  const lowFx = isLowFx();

  const startT = useRef(Date.now());
  const ended = useRef(false);
  const scoreRef = useRef(0);
  scoreRef.current = score;
  const takenRef = useRef(0);
  takenRef.current = taken;
  const turnRef = useRef(1);
  turnRef.current = turn;

  const mine = provs.filter((p) => p.owner === "me");
  const selP = sel !== null ? provs.find((p) => p.id === sel) : undefined;

  const say = useCallback((txt: string, tone: LogLine["tone"] = "info") => {
    setLog((l) => [{ txt, tone, turn: turnRef.current }, ...l].slice(0, 7));
  }, []);

  useEffect(() => {
    if (phase !== "count") return;
    if (cd < 0) { startT.current = Date.now(); setPhase("play"); return; }
    sfx.click();
    const t = setTimeout(() => setCd((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, cd]);

  const startLevel = (l: Level) => {
    setLv(l);
    setProvs(freshProvs(l));
    setGold(l.gold);
    setTurn(1); setSel(0); setStrike([]); setSiege([]);
    setScore(0); setTaken(0); setLog([]); setBattle(null); setWon(false);
    setCd(3); setPhase("count");
    ended.current = false;
  };

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
    // слава за кампанию: ранг растёт от неё, а не от одного удачного хода
    set((d) => { d.games.europa.mx = (d.games.europa.mx || 0) + gloryFor(takenRef.current, turnRef.current, victory, lv.id); });
    if (victory) {
      set((d) => {
        const cur = d.games.europa.prog || 1;
        d.games.europa.prog = Math.min(LEVELS.length + 1, Math.max(cur, lv.id + 1));
      });
    }
  }, [addCoins, addXp, finishGame, questProgress, set, s.prestige, lv.id]);

  /** все мои соседние здания, которые могут ударить по цели */
  const attackersFor = useCallback((target: Prov): Prov[] => {
    const pool = strike.length
      ? provs.filter((p) => strike.includes(p.id) && p.owner === "me" && target.links.includes(p.id) && p.army > 1 && !p.moved)
      : provs.filter((p) => p.owner === "me" && target.links.includes(p.id) && p.army > 1 && !p.moved);
    return pool.sort((a, b) => strikePower([b]) - strikePower([a]));
  }, [provs, strike]);

  const froms = selP && selP.owner !== "me" ? attackersFor(selP) : [];
  const siegeReady = froms.some((p) => siege.includes(p.id));
  const vw: Verdict | null = selP && selP.owner !== "me" && froms.length
    ? verdictFor(froms, selP, siegeReady)
    : null;

  /** чем мне угрожают соседи выбранного здания */
  const threats = useMemo(() => {
    if (!selP) return [];
    return selP.links
      .map((id) => provs.find((p) => p.id === id)!)
      .filter((p) => p && p.owner !== "me" && p.army > 2)
      .map((p) => ({ p, pow: Math.round(strikePower([p])), canHit: p.army - 1 > defensePower(selP, false) * 0.75 }))
      .sort((a, b) => b.pow - a.pow)
      .slice(0, 3);
  }, [selP, provs]);

  /* ─────────────── экономика хода ─────────────── */

  const buy = (what: "dev" | "wall" | "barr" | "intel") => {
    if (!selP || selP.owner !== "me" || phase !== "play") return;
    const p = selP;
    const cost =
      what === "dev" ? devCost(p, provs)
        : what === "wall" ? wallCost(p, provs)
          : what === "barr" ? barrCost(p, provs)
            : intelCost(p, provs);
    const max = what === "dev" ? 8 : what === "wall" ? 6 : what === "barr" ? 5 : 4;
    if (p[what] >= max) { sfx.error(); say(`${tr(p.name)}: ${tr("потолок")}`, "bad"); return; }
    if (gold < cost) { sfx.error(); say(tr("Не хватает золота"), "bad"); return; }
    setGold((g) => g - cost);
    setProvs((arr) => arr.map((x) => (x.id === p.id ? { ...x, [what]: x[what] + 1 } : x)));
    setScore((v) => v + 30);
    sfx.buy(); haptic("light");
    say(`${tr(p.name)} · ${tr(UP[what].name)} ${p[what] + 1}`, "ok");
  };

  const recruit = (n: number) => {
    if (!selP || selP.owner !== "me" || phase !== "play") return;
    const p = selP;
    const room = cap(p) - p.army;
    const want = n === 0 ? room : Math.min(n, room);
    if (want <= 0) { sfx.error(); say(`${tr(p.name)}: ${tr("казармы забиты")}`, "bad"); return; }
    const unit = armyCost(p, provs);
    let cnt = 0;
    while (cnt < want && gold - cnt * unit >= unit) cnt++;
    if (cnt <= 0) { sfx.error(); say(tr("Не хватает золота"), "bad"); return; }
    setGold((g) => g - cnt * unit);
    setProvs((arr) => arr.map((x) => (x.id === p.id ? { ...x, army: x.army + cnt } : x)));
    sfx.buy(); haptic("light");
    say(`${tr(p.name)}: +${cnt} ${tr(KIND[p.kind].troop)}`, "ok");
  };

  const doSpecial = () => {
    if (!selP || selP.owner !== "me" || phase !== "play") return;
    const k = kindOf(selP.kind);
    if (!k.action) return;
    if (selP.used) { sfx.error(); say(`${tr(p_used(selP))}`, "bad"); return; }
    const cost = k.action === "agitate" ? 45 : k.action === "reinforce" ? 30 : 24;
    if (gold < cost) { sfx.error(); say(tr("Не хватает золота"), "bad"); return; }

    const neighbors = selP.links.map((id) => provs.find((p) => p.id === id)!).filter(Boolean);

    if (k.action === "siege") {
      setGold((g) => g - cost);
      setSiege((arr) => (arr.includes(selP.id) ? arr : [...arr, selP.id]));
      setProvs((arr) => arr.map((x) => (x.id === selP.id ? { ...x, used: true } : x)));
      sfx.tap(); say(`${tr(selP.name)}: ${tr("осадные телеги готовы")}`, "ok");
      return;
    }
    if (k.action === "sabotage") {
      const tgt = sabotageable(provs, selP);
      if (!tgt) { sfx.error(); say(tr("Курить не на кого"), "bad"); return; }
      setGold((g) => g - cost);
      setProvs((arr) => arr.map((x) =>
        x.id === tgt.id ? { ...x, army: Math.max(1, x.army - 2), wall: Math.max(0, x.wall - 1) } : x.id === selP.id ? { ...x, used: true } : x));
      sfx.crit(); say(`${tr(tgt.name)}: ${tr("дымовуха")} −2 ${tr("войска")} −1 ${tr("стена")}`, "ok");
      return;
    }
    if (k.action === "agitate") {
      const tgt = neighbors.find((x) => x.owner === "ai" && x.army <= 3 + selP.intel * 2);
      if (!tgt) { sfx.error(); say(tr("Переманить некого: или сильны, или свои"), "bad"); return; }
      setGold((g) => g - cost);
      setProvs((arr) => arr.map((x) => x.id === tgt.id ? { ...x, owner: "me", moved: true } : x.id === selP.id ? { ...x, used: true } : x));
      setTaken((v) => v + 1);
      setScore((v) => v + 140);
      sfx.legend(); haptic("success");
      say(`${tr(tgt.name)}: ${tr("перешли на нашу сторону")}`, "ok");
      return;
    }
    // reinforce: кухня и качалка кормят соседей
    const help = neighbors.filter((x) => x.owner === "me");
    if (!help.length) { sfx.error(); say(tr("Своих рядом нет"), "bad"); return; }
    setGold((g) => g - cost);
    setProvs((arr) => arr.map((x) => {
      if (x.id === selP.id) return { ...x, used: true };
      if (help.some((h) => h.id === x.id)) return { ...x, army: Math.min(cap(x), x.army + 3) };
      return x;
    }));
    sfx.buy();
    say(`${tr(selP.name)}: ${tr("подкормили")} ${help.length} × +3`, "ok");
  };

  /* ──────────────── удар ──────────────── */

  const attack = () => {
    if (phase !== "play" || !selP || selP.owner === "me") return;
    if (!froms.length) { sfx.error(); say(tr("Некому наступать"), "bad"); return; }
    const target = selP;
    const srcs = froms;
    const res = fight(srcs, target, siegeReady);
    setBattle({ to: target.id, froms: srcs.map((p) => p.id), res, step: 0 });
    setPhase("battle");
    sfx.tap();
    haptic("medium");
  };

  /* шаги анимации боя: марш → столкновение → итог */
  useEffect(() => {
    if (!battle) return;
    const t1 = window.setTimeout(() => setBattle((b) => (b ? { ...b, step: 1 } : b)), lowFx ? 60 : 620);
    const t2 = window.setTimeout(() => setBattle((b) => (b ? { ...b, step: 2 } : b)), lowFx ? 90 : 980);
    const t3 = window.setTimeout(() => {
      const { to, froms: ids, res } = battle;
      /*
       * Итоги боя. Каждый, кто шёл в атаку, получает обратно свою долю
       * вернувшихся — иначе два здания, собравшиеся в один удар, забирали
       * бы разное: сильнейший молча терял бы всё, слабый ничего.
       */
      const obj = provs.find((p) => p.id === to);
      /*
       * Итог исполняет модель: доля потерь каждому, кто шёл в удар, гарнизон
       * победителю, разбитые стены. У ИИ ровно этот же код — иначе «честный
       * размен» был бы словами.
       */
      setProvs((arr) => {
        const next = arr.map((p) => ({ ...p }));
        applyBattleResult(next, ids, to, res);
        return next;
      });
      if (res.win) {
        setTaken((v) => v + 1);
        setScore((v) => v + 180 + (obj?.dev || 1) * 40);
        sfx.crit(); haptic("success");
        say(`${tr(obj?.name || "")} ${tr("взят")} · −${res.lostMine} ${tr("казны")} +${income({ ...p0(obj), dev: (obj?.dev || 1) + 1 })}`, "ok");
      } else {
        sfx.error(); haptic("error");
        say(`${tr(obj?.name || "")}: ${tr("отбились")} · −${res.lostMine}`, "bad");
      }
      setStrike([]);
      setBattle(null);
      setPhase((ph) => (ph === "battle" ? "play" : ph));
      // победа может наступить прямо от захвата
      window.setTimeout(() => {
        setProvs((cur) => {
          const c = cur.filter((p) => p.owner === "me").length;
          if (c === cur.length) end(true, scoreRef.current);
          return cur;
        });
      }, 30);
    }, lowFx ? 140 : 2300);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle]);

  /* ──────────────── следующий ход ──────────────── */

  const nextTurn = () => {
    if (phase !== "play") return;
    sfx.tap();
    const inc = mine.reduce((a, p) => a + income(p), 0);
    setGold((g) => g + inc);
    setScore((v) => v + mine.length * 12);
    say(`${tr("казна")} +${inc} · ${tr("зданий")} ${mine.length}/${provs.length}`, "info");

    setProvs((arr) => {
      const next = arr.map((p) => ({ ...p, moved: false, used: false }));
      const mv = aiTurn(next, lv.aiPower, lv.aiAggro);
      if (mv) {
        const from = next.find((p) => p.id === mv.from)!;
        const to = next.find((p) => p.id === mv.to)!;
        say(`${tr(to.name)}: ${tr("атаковал")} ${tr(from.name)}`, "bad");
        haptic("error");
      }
      return next;
    });

    const nt = turn + 1;
    setTurn(nt);
    setBanner({ round: nt, inc });
    window.setTimeout(() => setBanner(null), 1500);
    // телеги куплены — они с нами до конца уровня; сбрасываем только очередь удара
    setStrike([]);

    window.setTimeout(() => {
      setProvs((cur) => {
        const c = cur.filter((p) => p.owner === "me").length;
        if (c === 0) end(false, scoreRef.current);
        else if (c === cur.length) end(true, scoreRef.current);
        else if (nt > lv.turns) end(false, scoreRef.current);
        return cur;
      });
    }, 80);
  };

  /* ──────────────── клавиатура ──────────────── */

  useEffect(() => {
    if (phase === "pick" || phase === "over") return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      /* Ходить по дорогам можно клавишами из настроек («Клавиши управления в
         играх»): стрелки работают всегда, а WASD — это только значение по
         умолчанию. Французская раскладка или цифровой блок — те же права. */
      const dir: Record<string, [number, number]> = {};
      for (const [act, vec] of [["up", [0, -1]], ["down", [0, 1]], ["left", [-1, 0]], ["right", [1, 0]]] as const) {
        for (const code of codesFor(act)) dir[code] = vec as [number, number];
      }
      if (dir[e.code]) {
        e.preventDefault();
        stepSel(dir[e.code]);
        return;
      }
      if (e.code === "Space") { e.preventDefault(); nextTurn(); return; }
      if (e.key === "Enter") {
        e.preventDefault();
        if (selP && selP.owner !== "me") attack();
        else if (selP) toggleStrike(selP.id);
        return;
      }
      if (e.key === "q" || e.key === "Q" || e.key === "й" || e.key === "Й") {
        if (selP) { toggleStrike(selP.id); }
        return;
      }
      if (e.key === "x" || e.key === "X" || e.key === "ч" || e.key === "Ч") { doSpecial(); return; }
      const n = Number(e.key);
      if (n >= 1 && n <= 4) { buy((["dev", "wall", "barr", "intel"] as const)[n - 1]); return; }
      if (e.key === "5") { recruit(3); return; }
      if (e.key === "6") { recruit(0); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /** стрелка уводит выбор в соседнее здание в указанном направлении */
  const stepSel = ([dx, dy]: [number, number]) => {
    setSel((cur) => {
      const from = cur === null ? null : provs.find((p) => p.id === cur);
      if (!from) return 0;
      let bestId = from.id;
      let bestDot = -2;
      for (const id of from.links) {
        const q = provs.find((p) => p.id === id)!;
        const vx = q.x - from.x, vy = q.y - from.y;
        const len = Math.hypot(vx, vy) || 1;
        const dot = (vx / len) * dx + (vy / len) * dy;
        if (dot > bestDot) { bestDot = dot; bestId = id; }
      }
      return bestDot > 0.1 ? bestId : cur;
    });
  };

  const toggleStrike = (id: number) => {
    const p = provs.find((x) => x.id === id);
    if (!p || p.owner !== "me") return;
    setStrike((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
    sfx.click();
  };

  /* ──────────────── отрисовка ──────────────── */

  if (phase === "pick") {
    return (
      <LevelPick
        unlocked={unlocked}
        rank={rank}
        glory={glory}
        onStart={startLevel}
        onExit={onExit}
      />
    );
  }

  return (
    <div className="eu-root absolute inset-0 flex flex-col" style={{ background: "var(--bg)" }}>
      <GameHUD
        score={score}
        best={best}
        onExit={() => { setPhase("pick"); onExit(); }}
        label={tr("ОЧКИ")}
        extra={
          <>
            <HudStat label={tr("ЗОЛОТО")} value={gold} tone="warn" min={48} />
            <HudStat label={tr("РАУНД")} value={`${turn}/${lv.turns}`} min={52} />
            <HudStat label={tr("ЗДАНИЙ")} value={`${mine.length}/${provs.length}`} min={52} />
          </>
        }
      />

      <div className="eu-stage">
        {/* ── карта ── */}
        <div className="eu-map">
          <div className="eu-map-inner" style={{ aspectRatio: "1 / 1.02" }}>
            <Roads provs={provs} battle={battle} strike={strike} froms={froms} selId={sel} />
            {provs.map((p) => (
              <MapNode
                key={p.id}
                p={p}
                active={sel === p.id}
                queued={strike.includes(p.id)}
                siegeReady={siege.includes(p.id)}
                target={!!battle && battle.to === p.id}
                onPick={() => { setSel(p.id); sfx.tap(); haptic("light"); }}
                onQueue={() => toggleStrike(p.id)}
              />
            ))}

            {battle && <BattleMark battle={battle} provs={provs} step={battle.step} lowFx={lowFx} />}

            {/* консоль событий — слева сверху, как просят */}
            <div className="eu-console">
              {log.map((l, i) => (
                <div key={`${l.turn}-${i}`} className={`eu-line eu-${l.tone}`} style={{ opacity: 1 - i * 0.13 }}>
                  <b>Х{String(l.turn).padStart(2, "0")}</b> {l.txt}
                </div>
              ))}
            </div>

            {/* легенда значков — слева снизу, чтобы не лезть в правила */}
            <div className="eu-hints">
              <span><i className="dot me" /> {tr("твоё")}</span>
              <span><i className="dot enemy" /> {tr("чужое")}</span>
              <span><i className="dot ntrl" /> {tr("нейтралы")}</span>
              <span><Icon name="shield" size={9} /> {tr("войско")}</span>
              <span><Icon name="brain" size={9} /> {tr("умники: разведка")}</span>
              <span><Icon name="lock" size={9} /> {tr("стены")}</span>
              <span><i className="ln live" /> {tr("можно ударить")}</span>
              <span><i className="ring" /> {tr("в ударе")}</span>
            </div>

            <AnimatePresence>
              {banner && (
                <motion.div
                  className="eu-banner"
                  initial={{ opacity: 0, y: lowFx ? 0 : 10, scale: lowFx ? 1 : 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: lowFx ? 1 : 1.04 }}
                  transition={{ duration: lowFx ? 0.01 : 0.22 }}
                >
                  <div className="t-display eu-banner-n">{tr("РАУНД")} {banner.round}</div>
                  <div className="t-label eu-banner-sub">
                    +{banner.inc} {tr("казны")} · {tr("зданий")} {mine.length}/{provs.length}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── панель справа: прокачка, наём, инфо, угроза ── */}
        <AnimatePresence>
          {selP && (
            <motion.aside
              key={selP.id}
              className="eu-side"
              initial={{ opacity: 0, x: lowFx ? 0 : 22 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: lowFx ? 0 : 16 }}
              transition={{ duration: lowFx ? 0.01 : 0.2, ease: "easeOut" }}
            >
              <SidePanel
                p={selP}
                provs={provs}
                gold={gold}
                onBuy={buy}
                onRecruit={recruit}
                onSpecial={doSpecial}
                onToggleStrike={() => toggleStrike(selP.id)}
                queued={strike.includes(selP.id)}
                onAttack={attack}
                froms={froms}
                vw={vw}
                threats={threats}
                siegeReady={siegeReady}
                play={phase === "play"}
              />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ── нижняя строка: сводка удара и следующий ход ── */}
      <div className="eu-foot">
        <div className="eu-foot-left">
          {strike.length > 0 ? (
            <div className="eu-strike">
              <span className="t-label">{tr("В УДАРЕ")}</span>
              {strike.map((id) => {
                const p = provs.find((x) => x.id === id);
                if (!p) return null;
                return (
                  <button key={id} type="button" className="eu-chip" onClick={() => toggleStrike(id)}>
                    {tr(p.name)} · {p.army - 1}
                    <Icon name="cross" size={9} />
                  </button>
                );
              })}
              <span className="t-caption" style={{ fontSize: 9 }}>
                {tr("сила")} {Math.round(strikePower(froms)) || Math.round(strikePower(provs.filter((p) => strike.includes(p.id))))}
              </span>
            </div>
          ) : (
            <div className="t-caption" style={{ fontSize: 9.5 }}>
              {tr("Shift+клик по своему зданию — отправить его в общий удар")}
            </div>
          )}
        </div>
        <button type="button" className="eu-next" onClick={nextTurn} disabled={phase !== "play"}>
          <Icon name="chevron" size={13} />
          {tr("СЛЕДУЮЩИЙ РАУНД")} · +{mine.reduce((a, p) => a + income(p), 0)}
        </button>
      </div>

      <AnimatePresence>{phase === "count" && <Countdown n={cd} />}</AnimatePresence>

      {phase === "over" && (
        <GameOver
          score={result.score}
          best={best}
          coins={result.coins}
          xp={result.xp}
          onRetry={() => startLevel(lv)}
          onExit={onExit}
          title={won ? `${tr("УРОВЕНЬ")} ${lv.id}: ${tr("КОЛЛЕДЖ ТВОЙ")}` : tr("КАМПАНИЯ ПРОВАЛЕНА")}
          sub={won
            ? `${tr("ранг")}: ${rank.rank.name} · ${taken} ${tr("зданий взято")}`
            : turn > lv.turns ? tr("Раунды кончились") : tr("Общага потеряна")}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════ ветки прокачки ═══════════════════════════ */

/** доход здания сразу после захвата — для строки в консоли */
function p0(obj: Prov | undefined): Prov {
  return obj || { id: -1, name: "", kind: "dorm", x: 0, y: 0, owner: "me", dev: 0, wall: 0, barr: 0, intel: 0, army: 1, links: [], moved: false, used: false };
}

const UP = {
  dev: { name: "РАЗВИТИЕ", icon: "sparkle" as const, hint: "доход и немного обороны" },
  wall: { name: "СТЕНЫ", icon: "lock" as const, hint: "режут входящий удар" },
  barr: { name: "КАЗАРМЫ", icon: "home" as const, hint: "больше войска и дешевле" },
  intel: { name: "РАЗВЕДКА", icon: "eye" as const, hint: "точный прогноз и +шанс" },
};

/** чем здание полезно спецдействием — одна строка в панель */
function specialName(k: Kind): string {
  const a = KIND[k].action;
  if (a === "siege") return "ОСАДА — следующий удар игнорирует стены";
  if (a === "agitate") return "АГИТАЦИЯ — переманить слабого соседа";
  if (a === "sabotage") return "САБОТАЖ — соседу −2 войска и −1 стена";
  if (a === "reinforce") return "ПОДКОРМКА — соседним своим +3 войска";
  return "";
}

function p_used(p: Prov): string {
  return `${p.name}: действие уже использовано в этом раунде`;
}



/* ═══════════════════════════ части интерфейса ═══════════════════════════ */

function Roads({ provs, battle, strike, froms, selId }: {
  provs: Prov[]; battle: Battle | null; strike: number[];
  froms: Prov[]; selId: number | null;
}) {
  const lines: ReactElement[] = [];
  const seen = new Set<string>();
  for (const p of provs) {
    for (const id of p.links) {
      if (id < p.id) continue;
      const key = `${p.id}-${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const q = provs.find((x) => x.id === id);
      if (!q) continue;
      const meToThem = (p.owner === "me" && q.owner !== "me") || (q.owner === "me" && p.owner !== "me");
      /* «живая» дорога — та, по которой от выбранного здания можно идти в бой:
         от моего соседа к цели и наоборот. Стрелка на конце обязательна: без
         неё линия «мой ↔ чужой» читается как «мы allied». */
      const canGo = (x: Prov) => x.owner === "me" && x.army > 1 && !x.moved;
      const live = meToThem && !battle && (
        (canGo(p) && q.id === selId) || (canGo(q) && p.id === selId)
      );
      // дорога уже заявленного в общий удар здания — отдельная, плотная
      const queued = meToThem && !battle && selId !== null && (
        (strike.includes(p.id) && q.id === selId) || (strike.includes(q.id) && p.id === selId)
      );
      const attacking = !!battle && ((battle.froms.includes(p.id) && battle.to === id) || (battle.froms.includes(q.id) && battle.to === p.id));
      const mineEdge = p.owner === "me" && q.owner === "me" && (froms.some((f) => f.id === p.id) || froms.some((f) => f.id === q.id));
      const a = p.owner === "me" ? p : q;
      const b = p.owner === "me" ? q : p;
      lines.push(
        <line
          key={key}
          x1={a.x * 100} y1={a.y * 100} x2={b.x * 100} y2={b.y * 100}
          className={`eu-road${live ? " live" : ""}${queued ? " queued" : ""}${attacking ? " war" : ""}${mineEdge ? " union" : ""}`}
          markerEnd={live || queued || attacking ? "url(#eu-arrow)" : undefined}
        />,
      );
    }
  }
  return (
    <svg className="eu-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <defs>
        <marker id="eu-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="eu-arrow" />
        </marker>
      </defs>
      {lines}
    </svg>
  );
}

export function MapNode({ p, active, queued, siegeReady, target, onPick, onQueue }: {
  p: Prov; active: boolean; queued: boolean; siegeReady: boolean; target: boolean;
  onPick: () => void; onQueue: () => void;
}) {
  const k = kindOf(p.kind);
  return (
    <button
      type="button"
      className={[
        "eu-node",
        p.owner === "me" ? "me" : p.owner === "ntrl" ? "ntrl" : "enemy",
        active ? "active" : "",
        queued ? "queued" : "",
        target ? "target" : "",
        p.moved ? "spent" : "",
      ].join(" ")}
      style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
      onClick={(e) => { if (e.shiftKey) onQueue(); else onPick(); }}
      onContextMenu={(e) => { e.preventDefault(); onQueue(); }}
      title={`${tr(k.name)} · ${tr(k.troop)} — ${tr(k.note)}`}
    >
      <span className="eu-node-icon"><Icon name={k.icon} size={13} /></span>
      <span className="eu-node-name t-label clip1">{tr(p.name)}</span>
      <span className="eu-node-army t-num">{p.army}</span>
      <span className="eu-node-bits">
        <i title={tr("стены")}><Icon name="lock" size={8} />{p.wall || ""}</i>
        <i title={tr("развитие")}><Icon name="sparkle" size={8} />{p.dev || ""}</i>
      </span>
      {siegeReady && <span className="eu-node-tag t-label">{tr("осада")}</span>}
    </button>
  );
}

/**
 * САМ БОЙ: точки-бойцы идут от своих зданий к цели, в конце вспышка и
 * табличка итога. Дешёвая по железу: двигаются восемь-двенадцать
 * трансформаций, никаких фильтров.
 */
export function BattleMark({ battle, provs, step, lowFx }: {
  battle: Battle; provs: Prov[]; step: 0 | 1 | 2; lowFx: boolean;
}) {
  const to = provs.find((p) => p.id === battle.to);
  if (!to) return null;
  const dots: ReactElement[] = [];
  battle.froms.forEach((id, si) => {
    const from = provs.find((p) => p.id === id);
    if (!from) return;
    const n = Math.min(6, Math.max(2, Math.round((from.army - 1) / 2)));
    for (let i = 0; i < n; i++) {
      // разброс по колонне: без него отряд выглядит одной точкой
      const jx = (((i * 37) % 9) - 4) * 0.16;
      const jy = (((i * 53) % 7) - 3) * 0.16;
      dots.push(
        <motion.circle
          key={`${id}-${i}`}
          className={`eu-dot ${battle.res.win ? "win" : "lose"}`}
          initial={{ cx: from.x * 100 + jx, cy: from.y * 100 + jy, opacity: 0.35 }}
          animate={{
            cx: step === 0 && !lowFx ? from.x * 100 + jx : to.x * 100 + jx * 2.2,
            cy: step === 0 && !lowFx ? from.y * 100 + jy : to.y * 100 + jy * 2.2,
            opacity: 1,
          }}
          transition={{ duration: lowFx ? 0.01 : 0.62, delay: lowFx ? 0 : i * 0.035 + si * 0.05, ease: "easeIn" }}
        />,
      );
    }
  });
  return (
    <div className="eu-battle">
      <svg className="eu-battle-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {dots}
        {step >= 1 && (
          <motion.circle
            className="eu-clash"
            cx={to.x * 100}
            cy={to.y * 100}
            initial={{ r: lowFx ? 6 : 1, opacity: 0.95 }}
            animate={{ r: lowFx ? 6 : 8.5, opacity: 0 }}
            transition={{ duration: lowFx ? 0.02 : 0.72, ease: "easeOut" }}
          />
        )}
      </svg>
      {step >= 2 && (
        <motion.div
          className={`eu-result ${battle.res.win ? "win" : "lose"}`}
          initial={{ opacity: 0, y: lowFx ? 0 : 12, scale: lowFx ? 1 : 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: lowFx ? 0.01 : 0.2 }}
        >
          <div className="t-display" style={{ fontSize: 16 }}>
            {battle.res.win ? tr("ВЗЯТО") : tr("ОТБИЛИСЬ")}
          </div>
          <div className="t-caption" style={{ fontSize: 9.5 }}>
            {tr("у нас −")}{battle.res.lostMine} · {tr("у них −")}{battle.res.lostTheirs}
            {" · "}{Math.round(battle.res.atkRoll)} : {Math.round(battle.res.defRoll)}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function SidePanel({ p, provs, gold, onBuy, onRecruit, onSpecial, onToggleStrike, queued, onAttack, froms, vw, threats, siegeReady, play }: {
  p: Prov; provs: Prov[]; gold: number;
  onBuy: (w: "dev" | "wall" | "barr" | "intel") => void;
  onRecruit: (n: number) => void;
  onSpecial: () => void;
  onToggleStrike: () => void;
  queued: boolean;
  onAttack: () => void;
  froms: Prov[];
  vw: Verdict | null;
  threats: { p: Prov; pow: number; canHit: boolean }[];
  siegeReady: boolean;
  play: boolean;
}) {
  const k = kindOf(p.kind);
  const mine = p.owner === "me";
  const unit = armyCost(p, provs);
  const room = cap(p) - p.army;
  return (
    <div className="eu-side-in">
      <div className="flex items-center" style={{ gap: 8 }}>
        <span className="eu-side-icon" style={{ color: mine ? "var(--ok)" : p.owner === "ntrl" ? "var(--text-mute)" : "var(--danger)" }}>
          <Icon name={k.icon} size={16} />
        </span>
        <span className="t-body clip1 flex-1" style={{ fontSize: 12.5 }}>{tr(p.name)}</span>
        <span className={`eu-owner ${mine ? "me" : p.owner === "ntrl" ? "ntrl" : "enemy"}`}>
          {mine ? tr("МОЁ") : p.owner === "ntrl" ? tr("НЕЙТРАЛЫ") : tr("ЧУЖОЕ")}
        </span>
      </div>
      <div className="t-caption eu-side-troop">{tr(k.troop)} — {tr(k.note)}</div>

      <div className="eu-stats">
        <Stat label={tr("войско")} value={`${p.army}/${cap(p)}`} icon="shield" />
        <Stat label={tr("доход")} value={mine ? income(p) : "—"} icon="coin" />
        <Stat label={tr("стены")} value={p.wall} icon="lock" />
        <Stat label={tr("развитие")} value={p.dev} icon="sparkle" />
        <Stat label={tr("казармы")} value={p.barr} icon="home" />
        <Stat label={tr("разведка")} value={p.intel} icon="eye" />
        <Stat label={tr("оборона")} value={Math.round(defensePower(p, false))} icon="target" />
        <Stat label={tr("удар соседям")} value={Math.round(strikePower([p]))} icon="fist" />
      </div>

      {mine ? (
        <>
          <div className="eu-rows">
            {(Object.keys(UP) as (keyof typeof UP)[]).map((w, i) => {
              const cost = w === "dev" ? devCost(p, provs) : w === "wall" ? wallCost(p, provs) : w === "barr" ? barrCost(p, provs) : intelCost(p, provs);
              const can = gold >= cost && p[w] < (w === "dev" ? 8 : w === "wall" ? 6 : w === "barr" ? 5 : 4);
              return (
                <button key={w} type="button" className={`eu-row ${can ? "" : "off"}`} disabled={!can || !play} onClick={() => onBuy(w)}>
                  <span className="eu-row-k"><Icon name={UP[w].icon} size={12} />{tr(UP[w].name)}</span>
                  <span className="eu-row-lvl t-num">{p[w]}</span>
                  <span className="eu-row-hint clip1">{tr(UP[w].hint)}</span>
                  <span className="eu-row-cost t-num">{cost}</span>
                  <span className="eu-row-key">{i + 1}</span>
                </button>
              );
            })}
          </div>

          <div className="eu-recruit">
            <span className="t-label">{tr("НАНЯТЬ")} · {unit} {tr("за бойца")}</span>
            <div className="flex" style={{ gap: 6 }}>
              <button type="button" disabled={!play || room <= 0} className="eu-btn" onClick={() => onRecruit(1)}>+1</button>
              <button type="button" disabled={!play || room <= 0} className="eu-btn" onClick={() => onRecruit(3)}>+3</button>
              <button type="button" disabled={!play || room <= 0} className="eu-btn wide" onClick={() => onRecruit(0)}>
                {tr("ВСЕ")} · {room}
              </button>
              <span className="eu-btn-key">5 / 6</span>
            </div>
            <div className="t-caption" style={{ fontSize: 9 }}>
              {tr("казармы")} {p.barr} · {tr("свободно")} {Math.max(0, room)}
            </div>
          </div>

          {k.action && (
            <button type="button" className={`eu-btn eu-special ${p.used ? "off" : ""}`} disabled={!play || p.used} onClick={onSpecial}>
              <Icon name="bolt" size={12} />
              <span className="clip1">{tr(specialName(p.kind))}</span>
              <span className="eu-row-cost t-num">{k.action === "agitate" ? 45 : k.action === "reinforce" ? 30 : 24}</span>
            </button>
          )}

          <button type="button" className={`eu-btn eu-queue ${queued ? "on" : ""}`} disabled={!play} onClick={onToggleStrike}>
            <Icon name="fist" size={12} />
            {queued ? tr("УБРАТЬ ИЗ УДАРА") : tr("ОТПРАВИТЬ В УДАР")}
            <span className="eu-btn-key">Q</span>
          </button>
        </>
      ) : (
        <>
          <div className="eu-odds">
            <div className="flex items-center" style={{ gap: 8 }}>
              <span className="t-label">{tr("ШАНС ВЗЯТЬ")}</span>
              <span className={`eu-odds-n ${vw ? vw.tone : "info"}`}>{vw ? `${Math.round(vw.chance * 100)}%` : "—"}</span>
              <span className={`eu-odds-v ${vw ? vw.tone : ""}`}>{vw ? tr(vw.label) : tr("некому идти")}</span>
            </div>
            <div className="eu-odds-bar"><i style={{ width: `${vw ? Math.round(vw.chance * 100) : 0}%` }} className={vw ? vw.tone : ""} /></div>
            {vw && (
              <div className="t-caption" style={{ fontSize: 9.5 }}>
                {tr("пойдёт")} {froms.length} {tr("здания")} · {vw.men} {tr("бойцов")} · {tr("ожидать потерь")} ~{vw.loss}
                {siegeReady && ` · ${tr("стены сломаны осадой")}`}
              </div>
            )}
            {vw && vw.tone !== "good" && (
              <div className={`eu-warn ${vw.tone}`}>
                <Icon name={vw.tone === "mad" ? "skull" : "warn"} size={11} />
                {vw.tone === "mad"
                  ? tr("Туда не надо: кладбище качков гарантировано")
                  : tr("Может не взять — подкрепи соседей или качай осаду")}
              </div>
            )}
          </div>

          <button type="button" className="eu-btn eu-attack" disabled={!play || !froms.length} onClick={onAttack}>
            <Icon name="fist" size={13} />
            {froms.length
              ? `${tr("УДАРИТЬ")} · ${froms.map((f) => tr(f.name)).join(" + ")}`
              : tr("НЕТ СОСЕДНЕГО ВОЙСКА")}
            <span className="eu-btn-key">↵</span>
          </button>

          <div className="t-caption eu-side-neigh">
            {tr("соседи:")}: {p.links.map((id) => provs.find((x) => x.id === id)).filter(Boolean).map((x) => tr(x!.name)).join(", ")}
          </div>
        </>
      )}

      {threats.length > 0 && (
        <div className="eu-threats">
          <div className="t-label">{tr("КТО СМОТРИТ НА ТЕБЯ")}</div>
          {threats.map(({ p: t, pow, canHit }) => (
            <div key={t.id} className={`eu-threat ${canHit ? "hot" : ""}`}>
              <span className="clip1 flex-1">{tr(t.name)}</span>
              <span className="t-num">{pow}</span>
              <span className="t-label">{canHit ? tr("бьёт") : tr("не дотянет")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: Parameters<typeof Icon>[0]["name"] }) {
  return (
    <div className="eu-stat">
      <span className="eu-stat-i"><Icon name={icon} size={10} /></span>
      <span className="eu-stat-l">{label}</span>
      <span className="eu-stat-v t-num">{value}</span>
    </div>
  );
}

/* ═══════════════════════ выбор уровня кампании ═══════════════════════ */

export function LevelPick({ unlocked, rank, glory, onStart, onExit }: {
  unlocked: number;
  rank: ReturnType<typeof rankOf>;
  glory: number;
  onStart: (l: Level) => void;
  onExit: () => void;
}) {
  return (
    <div className="eu-pick absolute inset-0 flex flex-col" style={{ background: "var(--bg)" }}>
      <div className="eu-pick-top">
        <button type="button" className="eu-back" onClick={onExit} aria-label={tr("Назад")}>
          <Icon name="chevron" size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="t-display" style={{ fontSize: 17 }}>ЧУБУПА УНИВЕРСАЛИС 5</div>
          <div className="t-caption" style={{ fontSize: 10 }}>{tr("Захват колледжа: 5 уровней, общий ранг")}</div>
        </div>
        <div className="eu-rank">
          <span><Icon name={rank.rank.icon} size={12} /></span>
          <div>
            <div className="t-label" style={{ fontSize: 7.5 }}>{tr("РАНГ")}</div>
            <div className="t-title-sm" style={{ fontSize: 11 }}>{rank.rank.name}</div>
          </div>
        </div>
      </div>

      <div className="eu-pick-body scroll">
        <div className="eu-glory">
          <div className="flex items-center justify-between">
            <span className="t-label">{tr("СЛАВА")}</span>
            <span className="t-num" style={{ fontSize: 13 }}>{glory}</span>
          </div>
          <div className="eu-glory-bar">
            <i style={{ width: `${Math.min(100, rank.next ? (glory / rank.next.at) * 100 : 100)}%` }} />
          </div>
          <div className="t-caption" style={{ fontSize: 9 }}>
            {rank.next
              ? `${tr("до ранга")} ${rank.next.name} — ${rank.left} ${tr("славы")}`
              : tr("Выше ранга нет: ты и есть универсалис")}
          </div>
        </div>

        <div className="eu-levels">
          {LEVELS.map((l) => {
            const open = l.id <= unlocked;
            return (
              <button
                key={l.id}
                type="button"
                className={`eu-lvl ${open ? "" : "locked"}`}
                disabled={!open}
                onClick={() => open && onStart(l)}
              >
                <span className="eu-lvl-n t-display">{l.id}</span>
                <span className="eu-lvl-main">
                  <span className="t-title-sm clip1">{tr(l.name)}</span>
                  <span className="t-caption clip1" style={{ fontSize: 9.5 }}>{tr(l.sub)}</span>
                  <span className="eu-lvl-meta">
                    <span>{l.provs.length} {tr("зданий")}</span>
                    <span>{l.turns} {tr("раундов")}</span>
                    <span>{l.aiAggro >= 1 ? tr("злой ИИ") : l.aiAggro >= 0.7 ? tr("ИИ на грани") : tr("ИИ спокойный")}</span>
                  </span>
                </span>
                <span className="eu-lvl-go">{open ? <Icon name="chevron" size={14} /> : <Icon name="lock" size={14} />}</span>
              </button>
            );
          })}
        </div>

        <div className="eu-how">
          <div className="t-label" style={{ marginBottom: 6 }}>{tr("КАК ИГРАТЬ")}</div>
          <ul>
            <li>{tr("Клик по зданию — справа откроется прокачка: развитие, стены, казармы, разведка и наём войска")}</li>
            <li>{tr("Shift+клик по СВОЕМУ зданию — отправить его в общий удар; так можно собрать в кулак два-три корпуса")}</li>
            <li>{tr("Клик по ЧУЖОМУ — видно шанс взятия и чего ждать: равный бой, опасно или самоубийство")}</li>
            <li>{tr("Клавиатура: стрелки — ходить по дорогам, Enter — удар, пробел — следующий раунд, 1…4 — качать, 5/6 — нанимать, Q — в удар")}</li>
            <li>{tr("Захваченное здание оставляет гарнизон у соседа: блицкриг без запаса наказывается")}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
