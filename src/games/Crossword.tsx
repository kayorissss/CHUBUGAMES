import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { GameOver, GameHUD, Countdown } from "./shell";
import Icon from "../ui/Icon";
import { tr } from "../core/i18n";

/**
 * КРОССВОРД БОБКОВОЙ — «докажи, что решал сам».
 *
 * Бобкова не верит, что кроссворд твой. Полоса подозрения растёт сама;
 * каждое верно вписанное слово её сбивает, ошибка — подкидывает.
 * Подсказка стоит подозрения, поэтому спамить ей невыгодно.
 *
 * Сделано на обычной вёрстке, а не на канвасе: буквы должны быть чёткими
 * на любом экране, а сетка мелкая.
 */

interface Word {
  clue: string;
  answer: string;
  row: number;
  col: number;
  dir: "h" | "v";
}

/** Несколько наборов, чтобы вторая партия не была той же самой */
const PUZZLES: Word[][] = [
  /* Сетки собраны генератором и проверены: все пересечения дают
     одинаковую букву, слова не слипаются боками. Раньше здесь были
     сетки «на глаз» — все 10 пересечений конфликтовали, кроссворд
     нельзя было решить в принципе.
       РАДОМИР·
       ·В······
       ·Т·С·Ж··
       ПОРТФЕЛЬ
       ·Б·А·Т··
       ·У·С·О··
       ·С···Н··                                                    */
  [
    { clue: "Стесняется, но танцует", answer: "РАДОМИР", row: 0, col: 0, dir: "h" },
    { clue: "Его обносит Кирилл", answer: "ПОРТФЕЛЬ", row: 3, col: 0, dir: "h" },
    { clue: "Двенадцатый номер", answer: "АВТОБУС", row: 0, col: 1, dir: "v" },
    { clue: "Короткое имя друга", answer: "СТАС", row: 2, col: 3, dir: "v" },
    { clue: "Валюта казино", answer: "ЖЕТОН", row: 2, col: 5, dir: "v" },
  ],
  /* ·М······
     ·О··П·С·
     ·Н··Р·Т·
     ·Е·ДЕКАН
     ·Т··С·С·
     ЗАЧЁТ···
     ····И···
     ····Ж···                                                      */
  [
    { clue: "Валюта в игре", answer: "МОНЕТА", row: 0, col: 1, dir: "v" },
    { clue: "Сброс ради бонуса", answer: "ПРЕСТИЖ", row: 1, col: 4, dir: "v" },
    { clue: "Короткое имя друга", answer: "СТАС", row: 1, col: 6, dir: "v" },
    { clue: "Главный в колледже", answer: "ДЕКАН", row: 3, col: 3, dir: "h" },
    { clue: "Его надо закрыть", answer: "ЗАЧЁТ", row: 5, col: 0, dir: "h" },
  ],
  /* ····К····
     ···АРТЁМ·
     ····О····
     ····С····
     ··С·С····
     ШИТОВ····
     ··А·О····
     ··С·Р····
     ····ДЕКАН                                                     */
  [
    { clue: "То, что ты решаешь", answer: "КРОССВОРД", row: 0, col: 4, dir: "v" },
    { clue: "Брекет-босс", answer: "АРТЁМ", row: 1, col: 3, dir: "h" },
    { clue: "Короткое имя друга", answer: "СТАС", row: 4, col: 2, dir: "v" },
    { clue: "Препод, бегает за тобой", answer: "ШИТОВ", row: 5, col: 0, dir: "h" },
    { clue: "Главный в колледже", answer: "ДЕКАН", row: 8, col: 4, dir: "h" },
  ],
  /* СТАС····
     Т·······
     И·Б··Б··
     ПОРТФЕЛЬ
     А·О··Н··
     ··Н··З··
     ··Я··И··
     ·····Н··                                                      */
  [
    { clue: "Короткое имя друга", answer: "СТАС", row: 0, col: 0, dir: "h" },
    { clue: "Приходит раз в месяц", answer: "СТИПА", row: 0, col: 0, dir: "v" },
    { clue: "Воспитатель-танк", answer: "БРОНЯ", row: 2, col: 2, dir: "v" },
    { clue: "В РФ с ним беда", answer: "БЕНЗИН", row: 2, col: 5, dir: "v" },
    { clue: "Его обносит Кирилл", answer: "ПОРТФЕЛЬ", row: 3, col: 0, dir: "h" },
  ],
];

const ALPHABET = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split("");

const SUSPICION_MS = 95000;   // за столько подозрение дойдёт до предела само

export default function Crossword({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [cd, setCd] = useState(3);
  const [puzzleIdx, setPuzzleIdx] = useState(() => Math.floor(Math.random() * PUZZLES.length));
  const words = PUZZLES[puzzleIdx];

  const [solved, setSolved] = useState<boolean[]>(() => words.map(() => false));
  const [active, setActive] = useState(0);
  const [typed, setTyped] = useState("");
  const [susp, setSusp] = useState(0);          // 0..1
  const [score, setScore] = useState(0);
  const [shake, setShake] = useState(0);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });
  const startT = useRef(Date.now());
  const ended = useRef(false);

  const best = s.games.crossword?.best || 0;

  /** Сетка: буква в каждой занятой клетке */
  const grid = useMemo(() => {
    const g = new Map<string, { ch: string; wi: number[] }>();
    words.forEach((w, wi) => {
      for (let i = 0; i < w.answer.length; i++) {
        const r = w.dir === "h" ? w.row : w.row + i;
        const c = w.dir === "h" ? w.col + i : w.col;
        const k = `${r},${c}`;
        const prev = g.get(k);
        g.set(k, { ch: w.answer[i], wi: prev ? [...prev.wi, wi] : [wi] });
      }
    });
    return g;
  }, [words]);

  const rows = useMemo(() => Math.max(...[...grid.keys()].map((k) => +k.split(",")[0])) + 1, [grid]);
  const cols = useMemo(() => Math.max(...[...grid.keys()].map((k) => +k.split(",")[1])) + 1, [grid]);

  const end = useCallback((won: boolean) => {
    if (ended.current) return;
    ended.current = true;
    const solvedCount = solved.filter(Boolean).length;
    const sc = solvedCount * 100 + (won ? 300 : 0);
    const coins = Math.floor(sc * 6 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 0.7 + 20);
    setResult({ score: sc, coins, xp });
    setPhase("over");
    if (won) { sfx.legend(); haptic("success"); } else { sfx.gameOver(); haptic("error"); }
    addCoins(coins);
    addXp(xp);
    finishGame("crossword", sc, Date.now() - startT.current);
    questProgress("plays", 1);
  }, [solved, s.prestige, addCoins, addXp, finishGame, questProgress]);

  /* отсчёт */
  useEffect(() => {
    if (phase !== "count") return;
    if (cd < 0) { startT.current = Date.now(); setPhase("play"); return; }
    sfx.click();
    const t = setTimeout(() => setCd((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, cd]);

  /* подозрение растёт само */
  useEffect(() => {
    if (phase !== "play") return;
    const iv = setInterval(() => {
      setSusp((v) => {
        const next = v + 220 / SUSPICION_MS;
        if (next >= 1) { end(false); return 1; }
        return next;
      });
    }, 220);
    return () => clearInterval(iv);
  }, [phase, end]);

  const pushLetter = (ch: string) => {
    if (phase !== "play" || solved[active]) return;
    const w = words[active];
    const next = (typed + ch).slice(0, w.answer.length);
    setTyped(next);
    sfx.tap();
    if (next.length < w.answer.length) return;

    if (next === w.answer) {
      const ns = solved.slice();
      ns[active] = true;
      setSolved(ns);
      setTyped("");
      setScore((v) => v + 100);
      setSusp((v) => Math.max(0, v - 0.2));
      sfx.crit();
      haptic("success");
      const nextUnsolved = ns.findIndex((x) => !x);
      if (nextUnsolved === -1) { setTimeout(() => end(true), 400); return; }
      setActive(nextUnsolved);
    } else {
      setTyped("");
      setSusp((v) => Math.min(1, v + 0.12));
      setShake((n) => n + 1);
      sfx.error();
      haptic("error");
    }
  };

  const hint = () => {
    if (phase !== "play" || solved[active]) return;
    const w = words[active];
    setTyped(w.answer.slice(0, Math.min(w.answer.length - 1, typed.length + 1)));
    setSusp((v) => Math.min(1, v + 0.16));
    sfx.click();
  };

  const restart = () => {
    ended.current = false;
    const idx = (puzzleIdx + 1) % PUZZLES.length;
    setPuzzleIdx(idx);
    setSolved(PUZZLES[idx].map(() => false));
    setActive(0); setTyped(""); setSusp(0); setScore(0);
    setCd(3); setPhase("count");
  };

  const w = words[active];
  const suspColor = susp > 0.7 ? "var(--danger)" : susp > 0.4 ? "var(--gold)" : "var(--ok)";

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "var(--bg)" }}>
      <GameHUD score={score} best={best} onExit={onExit} label={tr("ОЧКИ")} />

      <div
        className="flex-1 flex flex-col overflow-y-auto"
        style={{ padding: "calc(var(--sat) + 74px) 16px calc(var(--sab) + 26px)" }}
      >
        {/* Подозрение Бобковой */}
        <div
          style={{
            padding: "11px 13px", borderRadius: "var(--r-md)",
            background: "var(--surface)", border: "1px solid var(--surface-brd)",
            marginBottom: 14,
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 7 }}>
            <span className="t-label" style={{ fontSize: 9 }}>{tr("БОБКОВА ПОДОЗРЕВАЕТ")}</span>
            <span className="t-num" style={{ fontSize: 12, color: suspColor }}>
              {Math.round(susp * 100)}%
            </span>
          </div>
          <div style={{ height: 7, borderRadius: 999, background: "var(--fill-2)", overflow: "hidden" }}>
            <motion.div
              animate={{ width: `${susp * 100}%` }}
              transition={{ duration: 0.2 }}
              style={{ height: "100%", background: suspColor }}
            />
          </div>
        </div>

        {/*
          Вопрос активного слова — крупно и целиком.
          Раньше он висел одной строкой над клавиатурой с обрезкой clip1,
          и длинные вопросы просто не читались.
        */}
        <div
          style={{
            padding: "12px 14px", borderRadius: "var(--r-md)",
            background: "var(--surface)",
            border: `1px solid ${solved[active] ? "rgba(89,255,158,0.5)" : "var(--acc)"}`,
            marginBottom: 14,
          }}
        >
          <div className="flex items-center justify-between" style={{ gap: 10, marginBottom: 6 }}>
            <span className="t-label" style={{ fontSize: 9, opacity: 0.6 }}>
              {tr("ВОПРОС")} {active + 1}/{words.length} · {w.dir === "h" ? tr("ПО ГОРИЗОНТАЛИ") : tr("ПО ВЕРТИКАЛИ")}
            </span>
            <span className="t-num shrink-0" style={{ fontSize: 11, opacity: 0.75 }}>
              {w.answer.length} {tr("букв")}
            </span>
          </div>
          <div
            className="t-title"
            style={{ fontSize: 15, lineHeight: 1.35, textAlign: "left" }}
          >
            {tr(w.clue)}
          </div>
          {/* набранные буквы отдельной строкой — видно, что уже введено */}
          <div className="flex items-center" style={{ gap: 4, marginTop: 9, flexWrap: "wrap" }}>
            {Array.from({ length: w.answer.length }).map((_, i) => (
              <span
                key={i}
                className="t-num flex items-center justify-center"
                style={{
                  width: 20, height: 24, borderRadius: 4, fontSize: 13,
                  background: i < typed.length ? "var(--acc-soft)" : "var(--surface-2)",
                  border: `1px solid ${i < typed.length ? "var(--acc)" : "var(--surface-brd)"}`,
                  color: i < typed.length ? "var(--acc)" : "var(--text-mute)",
                }}
              >
                {solved[active] ? w.answer[i] : (typed[i] || "")}
              </span>
            ))}
          </div>
        </div>

        {/* Сетка */}
        <motion.div
          key={shake}
          animate={shake ? { x: [0, -7, 7, -4, 0] } : {}}
          transition={{ duration: 0.28 }}
          className="flex justify-center"
          style={{ marginBottom: 16 }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: 4,
              width: "100%",
              maxWidth: Math.min(cols * 46, 330),
            }}
          >
            {Array.from({ length: rows * cols }).map((_, i) => {
              const r = Math.floor(i / cols);
              const c = i % cols;
              const cell = grid.get(`${r},${c}`);
              if (!cell) return <div key={i} />;
              const inActive = cell.wi.includes(active);
              // буква видна, если её слово решено или её уже набрали
              let shown = "";
              for (const wi of cell.wi) {
                if (solved[wi]) { shown = cell.ch; break; }
              }
              if (!shown && inActive) {
                const wd = words[active];
                const pos = wd.dir === "h" ? c - wd.col : r - wd.row;
                if (pos < typed.length) shown = typed[pos];
              }
              const done = cell.wi.some((wi) => solved[wi]);
              return (
                <div
                  key={i}
                  className="t-num flex items-center justify-center"
                  style={{
                    aspectRatio: "1",
                    borderRadius: 6,
                    fontSize: 15,
                    background: done
                      ? "rgba(89,255,158,0.16)"
                      : inActive ? "var(--acc-soft)" : "var(--surface)",
                    border: `1px solid ${
                      done ? "rgba(89,255,158,0.5)"
                        : inActive ? "var(--acc)" : "var(--surface-brd)"
                    }`,
                    color: done ? "var(--ok)" : "var(--text)",
                  }}
                >
                  {shown}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Вопросы */}
        <div className="flex flex-col" style={{ gap: 7, marginBottom: 14 }}>
          {words.map((wd, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { if (!solved[i]) { setActive(i); setTyped(""); sfx.click(); } }}
              className="w-full text-left"
              style={{
                padding: "10px 12px", borderRadius: "var(--r-sm)",
                background: i === active ? "var(--acc-soft)" : "var(--surface)",
                border: `1px solid ${i === active ? "var(--acc)" : "var(--surface-brd)"}`,
                opacity: solved[i] ? 0.5 : 1,
              }}
            >
              <span className="flex items-center" style={{ gap: 6 }}>
                {solved[i] && (
                  <span style={{ color: "var(--ok)", lineHeight: 0, flexShrink: 0 }}>
                    <Icon name="check" size={11} />
                  </span>
                )}
                <span className="t-caption clip1" style={{ fontSize: 11 }}>
                  {solved[i] ? wd.answer : wd.clue}
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* Клавиатура */}
        {!solved[active] && (
          <div style={{ marginTop: "auto" }}>
            <div className="flex items-center justify-end" style={{ marginBottom: 8 }}>
              <button
                type="button"
                onClick={hint}
                className="t-label shrink-0"
                style={{
                  padding: "6px 11px", borderRadius: 999,
                  background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
                  fontSize: 9,
                }}
              >
                {tr("ПОДСКАЗКА")}
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                gap: 4,
              }}
            >
              {ALPHABET.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => pushLetter(ch)}
                  className="t-num"
                  style={{
                    padding: "9px 0", borderRadius: 6, fontSize: 13,
                    background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
                    color: "var(--text)",
                  }}
                >
                  {ch}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setTyped((v) => v.slice(0, -1)); sfx.click(); }}
                className="t-label"
                style={{
                  gridColumn: "span 2", padding: "9px 0", borderRadius: 6, fontSize: 9,
                  background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
                }}
              >
                {tr("СТЕРЕТЬ")}
              </button>
            </div>
          </div>
        )}
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
          title={solved.every(Boolean) ? tr("ПОВЕРИЛА") : tr("НЕ ПОВЕРИЛА")}
          sub={solved.every(Boolean) ? tr("Кроссворд признан твоим") : tr("Бобкова забрала листок")}
        />
      )}
    </div>
  );
}
