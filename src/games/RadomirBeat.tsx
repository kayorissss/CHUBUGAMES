import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { drawHead } from "../core/head";
import { useCanvas, GameHUD, GameOver, Countdown } from "./shell";
import { haptic, sfx } from "../core/fx";
import { startBeat, stopBeat } from "../core/music";
import {
  clearTrack, decode, detectOnsets, loadTrack, playTrack, saveTrack, stopTrack,
  type Onset,
} from "../core/track";
import Icon from "../ui/Icon";

/**
 * РИТМ РАДОМИРА.
 *
 * Играет либо встроенный синтезированный бит, либо трек, который
 * пользователь сам загрузил с телефона (например «Фембойчик» — onokami).
 * Для загруженного трека ноты расставляются анализом самой музыки.
 *
 * Ноты бывают обычные (тап) и длинные (держать) — длинные строятся из
 * плотных серий ударов в одной полосе.
 */

type Phase = "menu" | "count" | "play" | "over";

interface Note {
  lane: 0 | 1 | 2;
  t: number; // мс, когда нота должна быть на линии
  hold: number; // длительность удержания в мс (0 — обычный тап)
  hit: boolean;
  missed: boolean;
  holding: boolean; // сейчас зажата
  holdOk: number; // сколько мс удержано
  done: boolean; // длинная нота завершена
}

const LANES = 3;
/** Сколько нота летит сверху вниз. Больше = больше времени среагировать. */
const FALL_MS = 2100;
/** Окна попадания. Расширены: играем большим пальцем на ходу, а не на клавиатуре. */
const PERFECT = 130;
const GOOD = 250;

/**
 * Встроенный чарт под синтезированный бит (124 BPM).
 *
 * Играют одним-двумя пальцами на телефоне, поэтому:
 *  - ноты идут по целым долям (а не по восьмым) — минимум 484 мс между ними;
 *  - аккорды (две ноты разом) только на адском уровне;
 *  - плотность растёт плавно и зависит от выбранной сложности.
 */
function builtinChart(diff: "chill" | "normal" | "insane"): Note[] {
  const notes: Note[] = [];
  const beat = 60000 / 124;
  // шаг между возможными нотами: на чилле реже, на адском чаще
  const step = diff === "insane" ? beat / 2 : beat;
  let t = 2000;
  let i = 0;
  while (t < 95000) {
    const bar = Math.floor(i / 8);
    const dMax = diff === "chill" ? 3 : diff === "insane" ? 5 : 4;
    const density = Math.min(dMax, bar < 4 ? 2 : bar < 10 ? 3 : bar < 18 ? 4 : 5);
    if (i % 8 < density) {
      const lane = ((i * 7 + bar * 3) % LANES) as 0 | 1 | 2;
      // длинная нота пореже, чтобы не сбивать ритм
      const hold = bar >= 6 && i % 32 === 0 ? beat * 2 : 0;
      notes.push({ lane, t, hold, hit: false, missed: false, holding: false, holdOk: 0, done: false });
      // аккорд на два пальца — только для тех, кто сам выбрал адский
      if (diff === "insane" && bar >= 12 && i % 16 === 0) {
        notes.push({
          lane: ((lane + 2) % LANES) as 0 | 1 | 2, t, hold: 0,
          hit: false, missed: false, holding: false, holdOk: 0, done: false,
        });
      }
    }
    t += step;
    i += 1;
  }
  return notes;
}

/** Чарт из онсетов реального трека */
function chartFromOnsets(
  ons: Onset[],
  diff: "chill" | "normal" | "insane" = "normal",
): Note[] {
  const notes: Note[] = [];
  // Минимальный промежуток между нотами: пальцем быстрее просто не успеть
  const minGap = diff === "chill" ? 420 : diff === "insane" ? 220 : 320;
  let lastT = -9999;
  for (let i = 0; i < ons.length; i++) {
    const o = ons[i];
    if (o.t - lastT < minGap) continue;
    lastT = o.t;
    // длинная нота: если в этой же полосе дальше пауза > 700 мс, а удар сильный
    const nextSame = ons.find((x, j) => j > i && x.band === o.band);
    const gapMs = nextSame ? nextSame.t - o.t : 9999;
    const hold = o.strength > 0.72 && gapMs > 900 ? Math.min(1400, gapMs - 400) : 0;
    notes.push({
      lane: o.band, t: o.t, hold,
      hit: false, missed: false, holding: false, holdOk: 0, done: false,
    });
  }
  return notes;
}

export default function RadomirBeat({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, bump, finishGame, questProgress, toast } = useGame();
  const radomir = s.friends.find((f) => f.id === "radomir") || s.friends[0];

  const [phase, setPhase] = useState<Phase>("menu");
  const [cd, setCd] = useState(3);
  const [uiScore, setUiScore] = useState(0);
  const [uiCombo, setUiCombo] = useState(0);
  const [uiLives, setUiLives] = useState(5);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  // пользовательский трек
  const [trackName, setTrackName] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const audioBuf = useRef<AudioBuffer | null>(null);
  const chartRef = useRef<Note[] | null>(null);
  const clockRef = useRef<(() => number) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const G = useRef({
    running: false,
    notes: [] as Note[],
    time: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    lives: 5,
    hits: 0,
    perfect: 0,
    flash: [0, 0, 0],
    held: [false, false, false],
    pops: [] as { lane: number; txt: string; c: string; life: number }[],
    bob: 0,
    shake: 0,
    endAt: 0,
  });

  /* ---------- загрузка сохранённого трека ---------- */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const st = await loadTrack();
      if (!alive || !st) return;
      setTrackName(st.name);
      try {
        const buf = await decode(st.data);
        if (!alive) return;
        audioBuf.current = buf;
        chartRef.current = chartFromOnsets(detectOnsets(buf), s.settings.difficulty);
      } catch {
        setLoadErr("Файл не читается, загрузи заново");
      }
    })();
    return () => { alive = false; };
  }, []);

  const pickFile = async (f: File) => {
    setAnalyzing(true);
    setLoadErr(null);
    try {
      const data = await f.arrayBuffer();
      const buf = await decode(data);
      const ons = detectOnsets(buf);
      if (ons.length < 12) {
        setLoadErr("В треке не нашлось ритма. Попробуй другой файл.");
        setAnalyzing(false);
        return;
      }
      audioBuf.current = buf;
      chartRef.current = chartFromOnsets(ons, s.settings.difficulty);
      await saveTrack(f.name, data);
      setTrackName(f.name);
      sfx.achieve?.();
      haptic("success");
      toast({ title: "Трек загружен", sub: `${ons.length} нот из твоей музыки`, tone: "gold" });
    } catch {
      setLoadErr("Не удалось прочитать аудио. Нужен mp3, m4a, ogg или wav.");
    }
    setAnalyzing(false);
  };

  const dropTrack = async () => {
    await clearTrack();
    audioBuf.current = null;
    chartRef.current = null;
    setTrackName(null);
    sfx.click();
  };

  const useOwn = !!(trackName && audioBuf.current && chartRef.current);

  const reset = useCallback(() => {
    const g = G.current;
    g.running = false;
    g.notes = (useOwn ? chartRef.current! : builtinChart(s.settings.difficulty)).map((n) => ({ ...n }));
    g.time = 0; g.score = 0; g.combo = 0; g.bestCombo = 0;
    g.lives = 5; g.hits = 0; g.perfect = 0;
    g.flash = [0, 0, 0]; g.held = [false, false, false];
    g.pops = []; g.bob = 0; g.shake = 0;
    const last = g.notes[g.notes.length - 1];
    g.endAt = last ? last.t + last.hold + 2400 : 30000;
    setUiScore(0); setUiCombo(0); setUiLives(5);
  }, [useOwn]);

  const start = useCallback(() => {
    reset();
    setPhase("count");
    setCd(3);
  }, [reset]);

  useEffect(() => {
    if (phase !== "count") return;
    if (cd < 0) {
      G.current.running = true;
      setPhase("play");
      if (useOwn && audioBuf.current) {
        clockRef.current = playTrack(audioBuf.current);
      } else {
        clockRef.current = null;
        startBeat();
      }
      return;
    }
    sfx.click();
    const t = setTimeout(() => setCd((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, cd, useOwn]);

  // музыку глушим при любом выходе
  useEffect(() => () => { stopBeat(); stopTrack(); }, []);

  const end = useCallback(() => {
    const g = G.current;
    g.running = false;
    stopBeat();
    stopTrack();
    clockRef.current = null;
    const score = Math.floor(g.score);
    const coins = Math.floor(score * 1.8 * (1 + s.prestige * 0.12));
    const xp = Math.floor(score * 0.5 + 25);
    setResult({ score, coins, xp });
    setPhase("over");
    sfx.gameOver();
    haptic("error");
    addCoins(coins);
    addXp(xp);
    finishGame("radomir", score, g.time);
    bump("notesHit", g.hits);
    questProgress("score", score);
  }, [addCoins, addXp, finishGame, bump, questProgress, s.prestige]);

  /* ---------- нажатие / отпускание дорожки ---------- */
  const pressLane = (lane: number) => {
    const g = G.current;
    if (!g.running) return;
    g.flash[lane] = 1;
    g.held[lane] = true;

    let best: Note | null = null;
    let bestDiff = Infinity;
    for (const n of g.notes) {
      if (n.lane !== lane || n.hit || n.missed) continue;
      const d = Math.abs(n.t - g.time);
      if (d < bestDiff) { bestDiff = d; best = n; }
    }

    if (best && bestDiff <= GOOD) {
      best.hit = true;
      g.hits += 1;
      g.combo += 1;
      g.bestCombo = Math.max(g.bestCombo, g.combo);
      const perfect = bestDiff <= PERFECT;
      if (perfect) g.perfect += 1;
      const mult = 1 + Math.min(2, g.combo * 0.03);
      const pts = Math.floor((perfect ? 12 : 6) * mult);
      g.score += pts;
      setUiScore(Math.floor(g.score));
      setUiCombo(g.combo);
      if (best.hold > 0) best.holding = true;
      else best.done = true;
      g.pops.push({
        lane, txt: perfect ? "ИДЕАЛЬНО" : "ХОРОШО",
        c: perfect ? "#FF9FD6" : "#8FD3FF", life: 620,
      });
      sfx.tap();
      haptic("light");
    } else {
      g.combo = 0;
      setUiCombo(0);
      g.pops.push({ lane, txt: "МИМО", c: "#8f8f9c", life: 500 });
      sfx.click();
    }
  };

  const releaseLane = (lane: number) => {
    const g = G.current;
    g.held[lane] = false;
    for (const n of g.notes) {
      if (n.lane === lane && n.holding && !n.done) {
        n.holding = false;
        // отпустил раньше конца — нота не засчитана целиком
        if (n.holdOk < n.hold * 0.6) {
          n.done = true;
          g.combo = 0;
          setUiCombo(0);
          g.pops.push({ lane, txt: "РАНО", c: "#ffb020", life: 500 });
        } else {
          n.done = true;
        }
      }
    }
  };

  const surfRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = surfRef.current;
    if (!el || phase !== "play") return;
    const laneOf = (clientX: number) => {
      const r = el.getBoundingClientRect();
      return Math.max(0, Math.min(LANES - 1, Math.floor(((clientX - r.left) / r.width) * LANES)));
    };
    const active = new Map<number, number>();
    const down = (e: PointerEvent) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const l = laneOf(e.clientX);
      active.set(e.pointerId, l);
      pressLane(l);
    };
    const up = (e: PointerEvent) => {
      const l = active.get(e.pointerId);
      if (l !== undefined) { releaseLane(l); active.delete(e.pointerId); }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);

    const keys = new Set<string>();
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const idx = ["a", "s", "d"].indexOf(k);
      if (idx >= 0 && !keys.has(k)) { keys.add(k); pressLane(idx); }
    };
    const ku = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const idx = ["a", "s", "d"].indexOf(k);
      if (idx >= 0) { keys.delete(k); releaseLane(idx); }
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* ---------- цикл ---------- */
  const canvasRef = useCanvas((ctx, W, H, dt) => {
    const g = G.current;
    ctx.clearRect(0, 0, W, H);

    const lineY = H * 0.76;
    const laneW = W / LANES;
    const msToPx = lineY / FALL_MS;

    if (g.running) {
      // время берём от аудио-часов, чтобы ноты не расходились с музыкой
      g.time = clockRef.current ? clockRef.current() : g.time + dt;
      g.bob += dt * 0.004;
      g.shake *= 0.9;
      for (let i = 0; i < LANES; i++) g.flash[i] *= 0.88;

      for (const n of g.notes) {
        // удержание длинной ноты
        if (n.holding && !n.done) {
          if (g.held[n.lane]) {
            n.holdOk += dt;
            if (n.holdOk % 200 < dt) {
              g.score += 2;
              setUiScore(Math.floor(g.score));
            }
            if (n.holdOk >= n.hold) {
              n.done = true;
              n.holding = false;
              g.score += 14;
              setUiScore(Math.floor(g.score));
              g.pops.push({ lane: n.lane, txt: "ДЕРЖАЛ", c: "#B6F23C", life: 560 });
              sfx.crit?.();
            }
          }
        }
        // промах
        if (!n.hit && !n.missed && g.time - n.t > GOOD) {
          n.missed = true;
          g.combo = 0;
          g.lives -= 1;
          setUiCombo(0);
          setUiLives(g.lives);
          g.shake = 14;
          haptic("medium");
          if (g.lives <= 0) { end(); return; }
        }
      }

      for (let i = g.pops.length - 1; i >= 0; i--) {
        g.pops[i].life -= dt;
        if (g.pops[i].life <= 0) g.pops.splice(i, 1);
      }

      if (g.time > g.endAt) { end(); return; }
    }

    /* --- отрисовка --- */
    ctx.save();
    if (g.shake > 0.4) ctx.translate((Math.random() - 0.5) * g.shake, 0);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "rgba(255,159,214,0.13)");
    bg.addColorStop(0.55, "rgba(143,211,255,0.07)");
    bg.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < LANES; i++) {
      const x = i * laneW;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.028)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(x, 0, laneW, H);
      if (g.flash[i] > 0.02 || g.held[i]) {
        const amt = Math.max(g.flash[i], g.held[i] ? 0.5 : 0);
        const fg = ctx.createLinearGradient(0, lineY - H * 0.3, 0, lineY);
        fg.addColorStop(0, "rgba(255,159,214,0)");
        fg.addColorStop(1, `rgba(255,159,214,${amt * 0.35})`);
        ctx.fillStyle = fg;
        ctx.fillRect(x, lineY - H * 0.3, laneW, H * 0.3);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.07)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Радомир танцует сверху
    const headR = Math.min(W * 0.15, H * 0.09);
    drawHead(
      ctx, radomir.look, W / 2, H * 0.17 + Math.sin(g.bob) * 7, headR,
      { mouth: 0.2 + Math.abs(Math.sin(g.bob)) * 0.25, tilt: Math.sin(g.bob * 0.7) * 0.16 },
    );

    // линия попадания
    ctx.strokeStyle = "rgba(255,159,214,0.9)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(255,159,214,0.8)";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(W, lineY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // зоны тапа
    for (let i = 0; i < LANES; i++) {
      const cxp = i * laneW + laneW / 2;
      ctx.strokeStyle = g.held[i] ? "rgba(255,159,214,0.95)" : "rgba(255,255,255,0.24)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cxp - laneW * 0.34, lineY - 18, laneW * 0.68, 36, 10);
      ctx.stroke();
    }

    // ноты
    for (const n of g.notes) {
      if (n.missed || n.done) continue;
      const dtn = n.t - g.time;
      if (dtn > FALL_MS || dtn < -GOOD - n.hold) continue;
      const x = n.lane * laneW + laneW / 2;
      const r = Math.min(laneW * 0.3, 30);
      const y = lineY - dtn * msToPx;

      if (n.hold > 0) {
        // хвост длинной ноты
        const tailTop = y - n.hold * msToPx;
        const grdT = ctx.createLinearGradient(0, tailTop, 0, y);
        grdT.addColorStop(0, "rgba(182,242,60,0.35)");
        grdT.addColorStop(1, "rgba(182,242,60,0.75)");
        ctx.fillStyle = grdT;
        ctx.beginPath();
        ctx.roundRect(x - r * 0.44, Math.min(tailTop, y), r * 0.88, Math.abs(y - tailTop), r * 0.44);
        ctx.fill();
        if (n.holding) {
          ctx.strokeStyle = "rgba(182,242,60,0.95)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(x - r * 0.5, Math.min(tailTop, y), r, Math.abs(y - tailTop), r * 0.5);
          ctx.stroke();
        }
      }

      if (!n.hit) {
        ctx.save();
        ctx.translate(x, y);
        const grd = ctx.createLinearGradient(0, -r, 0, r);
        grd.addColorStop(0, n.hold > 0 ? "#D8FF8F" : "#FFC4E6");
        grd.addColorStop(1, n.hold > 0 ? "#B6F23C" : "#8FD3FF");
        ctx.fillStyle = grd;
        ctx.shadowColor = n.hold > 0 ? "rgba(182,242,60,0.7)" : "rgba(255,159,214,0.7)";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.roundRect(-r, -r * 0.42, r * 2, r * 0.84, r * 0.42);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.textAlign = "center";
    ctx.font = "800 15px Inter, system-ui, sans-serif";
    for (const p of g.pops) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 400));
      ctx.fillStyle = p.c;
      ctx.fillText(p.txt, p.lane * laneW + laneW / 2, lineY - 26);
    }
    ctx.globalAlpha = 1;

    if (g.combo > 3) {
      ctx.textAlign = "center";
      ctx.font = "800 30px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,159,214,0.92)";
      ctx.fillText(`${g.combo}x`, W / 2, H * 0.36);
    }
    ctx.restore();
  }, [radomir]);

  return (
    <div className="absolute inset-0" style={{ background: "var(--bg)" }}>
      <div
        ref={surfRef}
        className="absolute inset-0"
        style={{ touchAction: "none", userSelect: "none" }}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      <GameHUD
        score={uiScore}
        best={s.games.radomir.best}
        onExit={onExit}
        extra={
          <div className="flex items-center shrink-0" style={{ gap: 5 }}>
            <Icon name="heart" size={14} />
            <span className="t-num" style={{ fontSize: 13 }}>{uiLives}</span>
            {uiCombo > 1 && (
              <span className="t-num" style={{ fontSize: 12, color: "var(--acc)", marginLeft: 4 }}>
                {uiCombo}x
              </span>
            )}
          </div>
        }
      />

      {/* Меню трека */}
      <AnimatePresence>
        {phase === "menu" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center"
            style={{ background: "rgba(6,6,9,0.92)", padding: 20 }}
          >
            <motion.div
              initial={{ y: 26, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
              className="w-full"
              style={{
                maxWidth: 360, background: "var(--surface)",
                border: "1px solid var(--surface-brd)",
                borderRadius: "var(--r-xl)", padding: 20,
              }}
            >
              <div className="t-title" style={{ marginBottom: 4 }}>РИТМ РАДОМИРА</div>
              <div className="t-caption" style={{ marginBottom: 16, lineHeight: 1.5 }}>
                Ноты падают по трём дорожкам. Короткие — тап, длинные зелёные — держи палец
                до конца хвоста.
              </div>

              <div
                style={{
                  padding: "12px 13px", borderRadius: "var(--r-md)",
                  background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
                }}
              >
                <div className="flex items-center" style={{ gap: 9 }}>
                  <Icon name="music" size={17} accent />
                  <div className="min-w-0 flex-1">
                    <div className="t-body clip1" style={{ fontWeight: 600 }}>
                      {trackName || "Встроенный бит"}
                    </div>
                    <div className="t-caption">
                      {trackName ? "твой трек, ноты из музыки" : "синтезируется в приложении"}
                    </div>
                  </div>
                </div>

                {loadErr && (
                  <div className="t-caption" style={{ marginTop: 8, color: "var(--danger)" }}>
                    {loadErr}
                  </div>
                )}

                <div className="flex flex-wrap" style={{ gap: 7, marginTop: 11 }}>
                  <button
                    type="button"
                    disabled={analyzing}
                    onClick={() => fileRef.current?.click()}
                    className="t-caption"
                    style={{
                      padding: "8px 12px", borderRadius: "var(--r-sm)",
                      background: "var(--acc)", color: "var(--acc-ink)", fontWeight: 700,
                      opacity: analyzing ? 0.6 : 1,
                    }}
                  >
                    {analyzing ? "Анализирую…" : trackName ? "Заменить трек" : "Загрузить свой трек"}
                  </button>
                  {trackName && (
                    <button
                      type="button"
                      onClick={dropTrack}
                      className="t-caption"
                      style={{
                        padding: "8px 12px", borderRadius: "var(--r-sm)",
                        background: "transparent", border: "1px solid var(--btn-brd)",
                      }}
                    >
                      Убрать
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*,.mp3,.m4a,.ogg,.wav"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void pickFile(f);
                    e.target.value = "";
                  }}
                />
              </div>

              <div
                className="t-caption"
                style={{
                  marginTop: 10, lineHeight: 1.6, padding: "11px 12px",
                  borderRadius: "var(--r-md)",
                  background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
                }}
              >
                <span className="t-title-sm" style={{ fontSize: 11.5, display: "block", marginBottom: 5 }}>
                  КАК ПОСТАВИТЬ «ФЕМБОЙЧИК»
                </span>
                1. Открой ru.hitmoz.org/song/81331674 в браузере.<br />
                2. Скачай mp3 в память телефона.<br />
                3. Жми «Загрузить свой трек» и выбери файл.<br />
                Игра сама разложит удары по дорожкам. Трек останется на телефоне
                и будет играть офлайн — авторские права остаются у onokami,
                поэтому файл не зашит в приложение.
              </div>

              <button
                type="button"
                onClick={() => { sfx.power?.(); haptic("medium"); start(); }}
                className="w-full t-title-sm"
                style={{
                  marginTop: 16, padding: "13px 0", borderRadius: "var(--r-md)",
                  background: "var(--acc)", color: "var(--acc-ink)", fontWeight: 700,
                }}
              >
                ИГРАТЬ
              </button>
              <button
                type="button"
                onClick={onExit}
                className="w-full t-caption"
                style={{ marginTop: 10, padding: 6 }}
              >
                Выйти
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{phase === "count" && <Countdown n={cd} />}</AnimatePresence>

      <AnimatePresence>
        {phase === "over" && (
          <GameOver
            score={result.score}
            best={s.games.radomir.best}
            coins={result.coins}
            xp={result.xp}
            onRetry={start}
            onExit={onExit}
            title={G.current.lives > 0 ? "ТРЕК ПРОЙДЕН" : "СБИЛСЯ С РИТМА"}
            sub={`Лучшее комбо ${G.current.bestCombo}x · идеальных ${G.current.perfect}`}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
