import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { GameHUD, GameOver, HudStat } from "./shell";
import GameIntro, { IntroGroup, IntroRules } from "../ui/GameIntro";
import { tr } from "../core/i18n";
import { Die } from "../ui/BoardPiece";
import { isLowFx } from "../core/perf";
import * as BG from "../core/backgammon";
import type { Position, Step } from "../core/backgammon";

/**
 * НАРДЫ С АРТУРОМ — длинные (русские) нарды.
 *
 * Правила в src/core/backgammon.ts: одна фишка с головы за ход, дубль
 * даёт четыре хода, правило шести, выход только когда все дома.
 * 200 партий ИИ-против-ИИ прошли без зависаний.
 *
 * Доска нарисована как две половины по 12 пунктов, чтобы влезала в
 * портретный экран. Тап по своей фишке подсвечивает, куда она может
 * пойти каждым доступным кубиком; тап по подсвеченному пункту — ход.
 * Кубики показаны крупно и гасятся по мере использования.
 */

export default function Backgammon({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"menu" | "play" | "over">("menu");
  const [pos, setPos] = useState<Position>(() => BG.initialPosition());
  const [dice, setDice] = useState<number[]>([]);
  const [used, setUsed] = useState<boolean[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });
  const [title, setTitle] = useState("");
  const [sub, setSub] = useState("");
  const [msg, setMsg] = useState("");
  const [flash, setFlash] = useState(0);

  const startT = useRef(Date.now());
  const ended = useRef(false);
  const turns = useRef(0);
  const human: BG.Color = "w";
  const lowFx = isLowFx();

  const best = s.games.nards?.best || 0;

  const start = useCallback(() => {
    const p = BG.initialPosition();
    setPos(p);
    setSel(null); setMsg("");
    ended.current = false; turns.current = 0;
    startT.current = Date.now();
    const d = BG.rollDice();
    // лимит фишек с головы зависит от броска — фиксируем его сразу
    setPos(BG.applyRoll(p, d));
    setDice(d); setUsed(d.map(() => false));
    setPhase("play");
    sfx.tap();
  }, []);

  const finish = useCallback((p: Position, res: BG.Outcome) => {
    if (ended.current) return;
    ended.current = true;
    const win = res === human;
    // марс — соперник не вывел ни одной фишки
    const mars = win && p.off.b === 0;
    let sc = p.off[human] * 60 + Math.max(0, 15 - p.off.b) * 25;
    if (win) sc += mars ? 1400 : 800;
    sc = Math.max(10, Math.floor(sc));

    const coins = Math.floor(sc * 1.4 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 0.38 + 20);
    setResult({ score: sc, coins, xp });
    if (win) {
      setTitle(mars ? tr("МАРС! АРТУР В ШОКЕ") : tr("АРТУР ПРОИГРАЛ"));
      setSub(mars ? tr("Он не вывел ни одной") : tr("Он говорит, что кубики кривые"));
      sfx.legend(); haptic("success");
    } else {
      setTitle(tr("АРТУР ВЫИГРАЛ"));
      setSub(tr("Он всегда так делает"));
      sfx.gameOver(); haptic("error");
    }
    addCoins(coins); addXp(xp);
    finishGame("nards", sc, Date.now() - startT.current);
    questProgress("plays", 1);
    setPhase("over");
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  /** Возможные шаги выбранной фишки: пункт назначения -> индекс кубика */
  const optionsFor = useCallback((from: number) => {
    const out: { to: number; dieIdx: number; step: Step }[] = [];
    const seen = new Set<number>();
    dice.forEach((d, i) => {
      if (used[i]) return;
      if (seen.has(d)) return;
      seen.add(d);
      const steps = BG.stepsFor(pos, d).filter((st) => st.from === from);
      for (const st of steps) out.push({ to: st.bearOff ? -1 : st.to, dieIdx: i, step: st });
    });
    return out;
  }, [pos, dice, used]);

  /** Есть ли вообще ходы этими кубиками */
  const anyMove = useCallback((p: Position, ds: number[], us: boolean[]) => {
    const seen = new Set<number>();
    for (let i = 0; i < ds.length; i++) {
      if (us[i]) continue;
      if (seen.has(ds[i])) continue;
      seen.add(ds[i]);
      if (BG.stepsFor(p, ds[i]).length) return true;
    }
    return false;
  }, []);

  /** Передаём ход сопернику */
  const endTurn = useCallback((p: Position) => {
    const next = BG.switchTurn(p);
    turns.current++;
    setSel(null);
    const d = BG.rollDice();
    setPos(BG.applyRoll(next, d));
    setDice(d); setUsed(d.map(() => false));
    setFlash((f) => f + 1);
  }, []);

  // ход компьютера
  useEffect(() => {
    if (phase !== "play" || pos.turn === human || ended.current) return;
    const res = BG.outcome(pos);
    if (res !== "playing") { finish(pos, res); return; }

    setThinking(true);
    const t = setTimeout(() => {
      const seq = BG.bestTurn(pos, dice);
      let cur = pos;
      // проигрываем шаги по одному, чтобы было видно, что он делает
      let i = 0;
      const tick = () => {
        if (i >= seq.length) {
          setThinking(false);
          const r2 = BG.outcome(cur);
          if (r2 !== "playing") { finish(cur, r2); return; }
          endTurn(cur);
          return;
        }
        cur = BG.applyStep(cur, seq[i]);
        setPos({ ...cur });
        sfx.tap();
        i++;
        setTimeout(tick, 230);
      };
      if (seq.length === 0) {
        setThinking(false);
        setMsg(tr("Артуру нечем ходить"));
        setTimeout(() => { setMsg(""); endTurn(pos); }, 900);
      } else tick();
    }, 400);
    return () => clearTimeout(t);
  }, [phase, pos, dice, finish, endTurn]);

  // если игроку нечем ходить — пропускаем
  useEffect(() => {
    if (phase !== "play" || pos.turn !== human || ended.current || thinking) return;
    const res = BG.outcome(pos);
    if (res !== "playing") { finish(pos, res); return; }
    if (dice.length && !anyMove(pos, dice, used)) {
      setMsg(tr("Ходить нечем — пропуск"));
      const t = setTimeout(() => { setMsg(""); endTurn(pos); }, 1100);
      return () => clearTimeout(t);
    }
  }, [phase, pos, dice, used, thinking, anyMove, endTurn, finish]);

  const applyStepAt = (opt: { to: number; dieIdx: number; step: Step }) => {
    const next = BG.applyStep(pos, opt.step);
    const nu = used.slice();
    nu[opt.dieIdx] = true;
    setPos(next); setUsed(nu); setSel(null);
    if (opt.step.bearOff) { sfx.coin(); haptic("success"); }
    else { sfx.tap(); haptic("light"); }

    const res = BG.outcome(next);
    if (res !== "playing") { finish(next, res); return; }
    // все кубики потрачены или ходов больше нет — передаём ход
    if (nu.every(Boolean) || !anyMove(next, dice, nu)) {
      setTimeout(() => endTurn(next), 320);
    }
  };

  const onPoint = (i: number) => {
    if (pos.turn !== human || thinking || ended.current) return;
    const mine = pos.points[i] > 0;
    if (mine) {
      const opts = optionsFor(i);
      if (!opts.length) { sfx.error(); return; }
      if (sel === i) { setSel(null); return; }
      setSel(i); sfx.tap(); haptic("light");
      return;
    }
    if (sel !== null) {
      const opt = optionsFor(sel).find((o) => o.to === i);
      if (opt) applyStepAt(opt);
      else setSel(null);
    }
  };

  const onBearOff = () => {
    if (sel === null) return;
    const opt = optionsFor(sel).find((o) => o.to === -1);
    if (opt) applyStepAt(opt);
  };

  const opts = sel !== null ? optionsFor(sel) : [];
  const targetSet = new Set(opts.map((o) => o.to));
  const canBearOff = targetSet.has(-1);
  const movableSet = new Set<number>();
  if (pos.turn === human && !thinking) {
    for (let i = 0; i < 24; i++) {
      if (pos.points[i] > 0 && optionsFor(i).length) movableSet.add(i);
    }
  }

  if (phase === "menu") {
    return (
      <GameIntro
        title={tr("НАРДЫ С АРТУРОМ")}
        subtitle={tr("Длинные нарды. Артур Тигранович играет в них с детства, так что не расслабляйся.")}
        icon="dice"
        startLabel={tr("НАЧАТЬ ПАРТИЮ")}
        onStart={start}
        onExit={onExit}
      >
        <IntroGroup label={tr("КАК ХОДИТЬ")}>
          <IntroRules
            lines={[
              "Бросай кубики кнопкой внизу. Выпали разные числа — два хода, дубль — четыре.",
              "Тапни свою фишку: подсветятся пункты, куда она может встать.",
              "С головы (крайний пункт) за ход берётся только одна фишка.",
              "На пункт, занятый фишками Артура, встать нельзя — даже одной.",
              "Когда все двенадцать фишек дома — последние шесть пунктов — начинаешь выводить их с доски.",
              "Кто первым вывел все фишки, тот и выиграл.",
            ]}
          />
        </IntroGroup>
      </GameIntro>
    );
  }

  /* Раскладка: верхний ряд — пункты 12..23, нижний — 11..0.
     Так белые (идут 0 -> 23) визуально движутся по кругу против часовой. */
  const topRow = Array.from({ length: 12 }, (_, k) => 12 + k);
  const botRow = Array.from({ length: 12 }, (_, k) => 11 - k);

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "var(--bg)" }}>
      <GameHUD
        score={pos.off.w}
        best={best}
        onExit={onExit}
        label={tr("ВЫВЕДЕНО")}
        extra={
          <HudStat
            label={tr("ХОД")}
            value={<span style={{ fontSize: 10 }}>{thinking ? tr("АРТУР") : tr("ТВОЙ")}</span>}
            tone={thinking ? "warn" : "ok"}
            min={62}
          />
        }
      />

      <div
        className="flex-1 flex flex-col justify-center"
        style={{ padding: "calc(var(--sat) + 74px) 10px calc(var(--sab) + 20px)" }}
      >
        {/* доска */}
        <div
          style={{
            background: "#2a2a32", border: "1px solid var(--surface-brd)",
            borderRadius: "var(--r-md)", padding: 6, overflow: "hidden",
          }}
        >
          <PointRow
            points={topRow} pos={pos} top
            sel={sel} targets={targetSet} movable={movableSet}
            onPoint={onPoint}
          />
          <div style={{ height: 6 }} />
          <PointRow
            points={botRow} pos={pos} top={false}
            sel={sel} targets={targetSet} movable={movableSet}
            onPoint={onPoint}
          />
        </div>

        {/* выведено */}
        <div className="flex items-center justify-between" style={{ marginTop: 10, gap: 8 }}>
          <div
            style={{
              flex: 1, padding: "8px 11px", borderRadius: "var(--r-md)",
              background: "var(--surface)", border: "1px solid var(--surface-brd)",
            }}
          >
            <div className="t-label" style={{ fontSize: 9, opacity: 0.6 }}>{tr("ТЫ ВЫВЕЛ")}</div>
            <div className="t-num" style={{ fontSize: 17, lineHeight: 1.15 }}>{pos.off.w} / 15</div>
          </div>
          <div
            style={{
              flex: 1, padding: "8px 11px", borderRadius: "var(--r-md)",
              background: "var(--surface)", border: "1px solid var(--surface-brd)",
            }}
          >
            <div className="t-label" style={{ fontSize: 9, opacity: 0.6 }}>{tr("АРТУР ВЫВЕЛ")}</div>
            <div className="t-num" style={{ fontSize: 17, lineHeight: 1.15 }}>{pos.off.b} / 15</div>
          </div>
        </div>

        {/* кубики + кнопка вывода: держим НАД нижним краем, чтобы дотянуться пальцем */}
        <div
          className="flex items-center justify-center"
          style={{ gap: 12, marginTop: 14, minHeight: 46 }}
        >
          <motion.div
            key={flash}
            initial={lowFx ? false : { scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.24 }}
            className="flex items-center"
            style={{ gap: 8 }}
          >
            {dice.map((d, i) => (
              <Die key={i} n={d} size={38} used={used[i]} />
            ))}
          </motion.div>

          {canBearOff && (
            <button
              onClick={onBearOff}
              className="btn-acc t-label"
              style={{ padding: "12px 16px", borderRadius: "var(--r-md)", fontSize: 11 }}
            >
              {tr("ВЫВЕСТИ")}
            </button>
          )}
        </div>

        <div
          className="t-body"
          style={{
            fontSize: 11, opacity: msg ? 1 : 0.5, textAlign: "center",
            marginTop: 8, minHeight: 16, lineHeight: 1.45,
            color: msg ? "var(--acc)" : undefined,
          }}
        >
          {msg || tr("Тапни свою фишку, потом пункт")}
        </div>
      </div>

      {phase === "over" && (
        <GameOver
          score={result.score}
          best={best}
          coins={result.coins}
          xp={result.xp}
          onRetry={start}
          onExit={onExit}
          title={title}
          sub={sub}
        />
      )}
    </div>
  );
}

/** Ряд из 12 пунктов */
function PointRow({
  points, pos, top, sel, targets, movable, onPoint,
}: {
  points: number[]; pos: Position; top: boolean;
  sel: number | null; targets: Set<number>; movable: Set<number>;
  onPoint: (i: number) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 2 }}>
      {points.map((i, k) => {
        const v = pos.points[i];
        const n = Math.abs(v);
        const color: BG.Color | null = v > 0 ? "w" : v < 0 ? "b" : null;
        const isSel = sel === i;
        const isTarget = targets.has(i);
        const canMove = movable.has(i);
        const isHead = i === BG.HEAD_W || i === BG.HEAD_B;

        return (
          <button
            key={i}
            onClick={() => onPoint(i)}
            style={{
              position: "relative",
              height: 118,
              display: "flex",
              flexDirection: top ? "column" : "column-reverse",
              alignItems: "center",
              gap: 1,
              paddingTop: top ? 3 : 0,
              paddingBottom: top ? 0 : 3,
              background: k % 2 === 0 ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.22)",
              border: isSel
                ? "2px solid var(--acc)"
                : isTarget
                  ? "2px solid rgba(255,176,32,0.75)"
                  : canMove
                    ? "1px solid rgba(89,255,158,0.45)"
                    : "1px solid transparent",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            {isTarget && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(255,176,32,0.2)" }} />
            )}
            {isHead && n === 0 && (
              <div
                className="t-label"
                style={{ position: "absolute", top: "45%", fontSize: 7, opacity: 0.3 }}
              >
                {tr("ГОЛОВА")}
              </div>
            )}
            {/* показываем максимум 5 фишек, остальное числом */}
            {Array.from({ length: Math.min(n, 5) }, (_, j) => (
              <div
                key={j}
                style={{
                  width: "84%", maxWidth: 20, aspectRatio: "1", borderRadius: "50%",
                  background: color === "w" ? "#f2f2f5" : "#1d1d23",
                  border: `1.5px solid ${color === "w" ? "#2a2a31" : "#e8e8ee"}`,
                  flexShrink: 0,
                }}
              />
            ))}
            {n > 5 && (
              <div
                className="t-num"
                style={{
                  fontSize: 9, color: color === "w" ? "#fff" : "#fff",
                  background: "rgba(0,0,0,0.6)", borderRadius: 3, padding: "0 3px",
                }}
              >
                +{n - 5}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
