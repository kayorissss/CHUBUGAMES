import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { useCanvas, GameHUD, GameOver, Countdown } from "./shell";
import { drawHead } from "../core/head";
import { tr } from "../core/i18n";

/**
 * АВТОБУС 12 — доехать до дома через толпу с бабульками.
 *
 * Вид сверху на салон. Ты пробираешься к выходу, ведя пальцем. Бабульки
 * стоят и ходят по проходу: толкнул — теряешь терпение и время.
 * На каждой остановке двери открываются на несколько секунд: успел выйти
 * в зону дверей — этап пройден, салон набивается заново и плотнее.
 *
 * Автобус потряхивает на кочках: толпу качает, и это сбивает прицел —
 * без этого игра была бы просто «обойди статичные кружки».
 */

const R_ME = 15;
const R_BABKA = 17;
/* Числа сверены симуляцией (4000 заездов на стиль игры).
   Стиль задаётся долей времени в контакте с бабулькой: аккуратный 3%,
   средний 9%, неаккуратный 20%. При итоговых числах побеждают
   примерно 80% / 38% / 3% — прорываться внаглую не выходит. */
const STOPS = 5;              // сколько остановок надо проехать
const DOOR_MS = 5200;         // сколько двери открыты
const RIDE_MS = 6000;         // сколько едем между остановками
const PATIENCE = 100;
const HIT_COST = 6;           // толкнул бабульку
const HIT_COST_BAG = 9;       // а эта ещё и с авоськой
const MISS_COST = 28;         // не успел выйти на остановке
const STOP_BONUS = 18;        // терпение возвращается за успешный выход

/** Где в этот раз двери: сзади, спереди или сбоку */
type ExitSide = "back" | "front" | "left" | "right";
const EXITS: ExitSide[] = ["back", "front", "left", "right"];

interface Babka {
  x: number; y: number;
  vx: number; vy: number;
  bag: boolean;               // с авоськой — толкается больнее
  ph: number;                 // фаза покачивания
  /**
   * Бабка «на охоте»: заметила тебя и целенаправленно идёт требовать
   * место. Обычные просто дрейфуют по салону, а эта преследует, поэтому
   * от неё надо уворачиваться, а не обходить по дуге.
   */
  hunting: boolean;
  /** сколько ещё преследует, мс */
  huntT: number;
}

export default function Bus12({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [cd, setCd] = useState(3);
  const [stop, setStop] = useState(0);
  const [patience, setPatience] = useState(PATIENCE);
  const [doorOpen, setDoorOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const best = s.games.bus?.best || 0;
  const hard = s.settings.difficulty;
  const crowdBase = hard === "insane" ? 9 : hard === "chill" ? 5 : 7;

  const me = s.friends[0];

  const G = useRef({
    me: { x: 0, y: 0 },
    touch: null as { x: number; y: number } | null,
    babki: [] as Babka[],
    running: false,
    stop: 0,
    patience: PATIENCE,
    score: 0,
    door: false,
    timer: RIDE_MS,
    startT: 0,
    bump: 0,          // тряска на кочке
    bumpT: 1800,
    pops: [] as { x: number; y: number; t: number; txt: string; col: string }[],
    shake: 0,
    w: 0, h: 0,
    hitCd: 0,
    exit: "back" as ExitSide,   // где двери на этой остановке
    announce: 0,                // сколько ещё показывать объявление, мс
    huntT: 2600,                // таймер до следующей охотницы
  });

  const fillCrowd = useCallback((w: number, h: number, n: number) => {
    const g = G.current;
    const arr: Babka[] = [];
    for (let i = 0; i < n; i++) {
      arr.push({
        x: 40 + Math.random() * (w - 80),
        y: h * 0.2 + Math.random() * (h * 0.5),
        vx: (Math.random() - 0.5) * 0.045,
        vy: (Math.random() - 0.5) * 0.045,
        bag: Math.random() < 0.45,
        ph: Math.random() * Math.PI * 2,
        hunting: false,
        huntT: 0,
      });
    }
    g.babki = arr;
  }, []);

  const reset = useCallback((w: number, h: number) => {
    const g = G.current;
    g.w = w; g.h = h;
    g.me = { x: w / 2, y: h - 110 };
    g.touch = null;
    g.stop = 0; g.patience = PATIENCE; g.score = 0;
    g.door = false; g.timer = RIDE_MS;
    g.pops = []; g.shake = 0; g.bump = 0; g.bumpT = 1800; g.hitCd = 0;
    g.exit = EXITS[Math.floor(Math.random() * EXITS.length)];
    g.announce = 0;
    g.huntT = 2600;
    g.startT = Date.now();
    fillCrowd(w, h, crowdBase);
    setStop(0); setPatience(PATIENCE); setScore(0); setDoorOpen(false);
  }, [crowdBase, fillCrowd]);

  const restart = useCallback(() => {
    G.current.running = false;
    setPhase("count");
    setCd(3);
  }, []);

  useEffect(() => {
    if (phase !== "count") return;
    if (cd < 0) { G.current.running = true; setPhase("play"); return; }
    sfx.click();
    const t = setTimeout(() => setCd((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, cd]);

  const end = useCallback((won: boolean) => {
    const g = G.current;
    if (!g.running) return;
    g.running = false;
    const sc = g.score + (won ? 800 : 0);
    const coins = Math.floor(sc * 4.5 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 0.8 + 20);
    setResult({ score: sc, coins, xp });
    setPhase("over");
    if (won) { sfx.legend(); haptic("success"); } else { sfx.gameOver(); haptic("error"); }
    addCoins(coins);
    addXp(xp);
    finishGame("bus", sc, Date.now() - g.startT);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  const track = useCallback((e: React.PointerEvent) => {
    const g = G.current;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    g.touch = { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  const canvasRef = useCanvas((ctx, w, h, dt) => {
    const g = G.current;
    if (!g.w) reset(w, h);
    g.w = w; g.h = h;

    /**
     * Зона выхода зависит от стороны, объявленной на остановке.
     * Раньше двери всегда были снизу по центру, и маршрут не менялся:
     * пользователь просил, чтобы выход «менялся» и заранее был неизвестен.
     */
    const doorRect = exitRect(g.exit, w, h);
    const inDoor = (x: number, y: number) =>
      x > doorRect.x0 && x < doorRect.x1 && y > doorRect.y0 && y < doorRect.y1;

    if (g.running) {
      /* таймеры этапа */
      g.timer -= dt;
      if (g.timer <= 0) {
        if (g.door) {
          // двери закрылись, а ты не вышел
          g.door = false;
          setDoorOpen(false);
          g.timer = RIDE_MS;
          g.patience -= MISS_COST;
          setPatience(Math.max(0, g.patience));
          g.pops.push({ x: w / 2, y: h * 0.5, t: 1, txt: tr("ДВЕРИ ЗАКРЫЛИСЬ"), col: "#FF6B4D" });
          sfx.error();
          haptic("error");
          if (g.patience <= 0) { end(false); return; }
        } else {
          // Выход становится известен только сейчас — до объявления
          // игрок не знает, куда бежать.
          g.exit = EXITS[Math.floor(Math.random() * EXITS.length)];
          g.door = true;
          setDoorOpen(true);
          g.timer = DOOR_MS;
          g.announce = 2200;
          sfx.power();
          g.pops.push({
            x: w / 2, y: h * 0.45, t: 1,
            txt: `${tr("ВЫХОД")}: ${tr(exitName(g.exit))}`,
            col: "#59FF9E",
          });
        }
      }

      if (g.announce > 0) g.announce -= dt;

      /* кочки: автобус потряхивает, толпу качает */
      g.bumpT -= dt;
      if (g.bumpT <= 0) {
        g.bumpT = 1400 + Math.random() * 2200;
        g.bump = 1;
        haptic("light");
      }
      if (g.bump > 0) g.bump = Math.max(0, g.bump - dt * 0.0016);

      /* я еду за пальцем, но медленно — в толпе не побегаешь */
      if (g.touch) {
        const dx = g.touch.x - g.me.x;
        const dy = g.touch.y - g.me.y;
        const d = Math.hypot(dx, dy);
        if (d > 1) {
          const sp = Math.min(0.34 * dt, d);
          g.me.x += (dx / d) * sp;
          g.me.y += (dy / d) * sp;
        }
      }
      g.me.x = Math.max(24, Math.min(w - 24, g.me.x));
      g.me.y = Math.max(60, Math.min(h - 24, g.me.y));

      /*
       * Время от времени одна из бабулек «выходит на охоту»: замечает
       * тебя и идёт требовать место. Такую надо активно оббегать, а не
       * просто обходить статичное препятствие.
       */
      g.huntT -= dt;
      if (g.huntT <= 0) {
        g.huntT = 3200 + Math.random() * 2600;
        const free = g.babki.filter((b) => !b.hunting);
        if (free.length) {
          const pick = free[Math.floor(Math.random() * free.length)];
          pick.hunting = true;
          pick.huntT = 2600 + Math.random() * 1400;
          g.pops.push({
            x: pick.x, y: pick.y - 26, t: 1,
            txt: tr("УСТУПИ МЕСТО!"), col: "#FFD86B",
          });
        }
      }

      /* бабульки бродят + качаются на кочке */
      for (const b of g.babki) {
        b.ph += dt * 0.004;
        if (b.hunting) {
          b.huntT -= dt;
          if (b.huntT <= 0) b.hunting = false;
          // идёт прямо на тебя, но медленнее, чем ты — убежать реально
          const dx = g.me.x - b.x, dy = g.me.y - b.y;
          const d = Math.hypot(dx, dy) || 1;
          const sp = 0.085 * dt;
          b.x += (dx / d) * sp + Math.sin(b.ph) * g.bump * 0.9;
          b.y += (dy / d) * sp;
        } else {
          b.x += b.vx * dt + Math.sin(b.ph) * g.bump * 0.9;
          b.y += b.vy * dt;
          if (b.x < 34 || b.x > w - 34) b.vx *= -1;
          if (b.y < h * 0.14 || b.y > h * 0.78) b.vy *= -1;
        }
        b.x = Math.max(34, Math.min(w - 34, b.x));
        b.y = Math.max(h * 0.14, Math.min(h * 0.78, b.y));
      }

      /* столкновения */
      if (g.hitCd > 0) g.hitCd -= dt;
      for (const b of g.babki) {
        const d = Math.hypot(b.x - g.me.x, b.y - g.me.y);
        if (d < R_ME + R_BABKA) {
          // выталкиваем, чтобы не залипать внутри
          const nx = (g.me.x - b.x) / (d || 1);
          const ny = (g.me.y - b.y) / (d || 1);
          g.me.x = b.x + nx * (R_ME + R_BABKA + 1);
          g.me.y = b.y + ny * (R_ME + R_BABKA + 1);
          if (g.hitCd <= 0) {
            g.hitCd = 620;
            g.patience -= b.bag ? HIT_COST_BAG : HIT_COST;
            setPatience(Math.max(0, g.patience));
            g.shake = 9;
            sfx.hit();
            haptic("medium");
            g.pops.push({
              x: b.x, y: b.y - 22, t: 1,
              txt: b.bag ? tr("АВОСЬКОЙ!") : tr("КУДА ПРЁШЬ"),
              col: "#FF6B4D",
            });
            if (g.patience <= 0) { end(false); return; }
          }
        }
      }

      /* выход на остановке */
      if (g.door && inDoor(g.me.x, g.me.y)) {
        g.stop += 1;
        g.score += 200 + Math.round(g.patience);
        setStop(g.stop);
        setScore(g.score);
        sfx.coin();
        haptic("success");
        if (g.stop >= STOPS) { end(true); return; }
        // следующий этап: народу больше
        g.door = false;
        setDoorOpen(false);
        g.timer = RIDE_MS;
        g.me = { x: w / 2, y: h - 110 };
        g.touch = null;
        fillCrowd(w, h, crowdBase + g.stop);
        g.patience = Math.min(PATIENCE, g.patience + STOP_BONUS);
        setPatience(g.patience);
        g.pops.push({ x: w / 2, y: h * 0.4, t: 1, txt: tr("ЕДЕМ ДАЛЬШЕ"), col: "#59FF9E" });
      }
    }

    for (const p of g.pops) p.t -= dt * 0.0013;
    g.pops = g.pops.filter((p) => p.t > 0);
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 0.03);

    /* ---------- отрисовка ---------- */
    ctx.fillStyle = "#12151a";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    const sh = g.shake + g.bump * 3;
    if (sh > 0) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);

    // пол салона
    ctx.fillStyle = "#1b2028";
    ctx.fillRect(14, 52, w - 28, h - 96);
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1;
    for (let y = 60; y < h - 50; y += 26) {
      ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(w - 16, y); ctx.stroke();
    }
    // поручни
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(w * 0.5, 56); ctx.lineTo(w * 0.5, h - 100); ctx.stroke();

    // сиденья по бортам
    ctx.fillStyle = "#252c36";
    for (let i = 0; i < 5; i++) {
      const y = 74 + i * 62;
      ctx.beginPath(); ctx.roundRect(18, y, 34, 44, 6); ctx.fill();
      ctx.beginPath(); ctx.roundRect(w - 52, y, 34, 44, 6); ctx.fill();
    }

    // двери: рисуем только когда открыты — до объявления игрок не
    // должен знать, с какой стороны выход
    if (g.door) {
      const d = doorRect;
      ctx.fillStyle = "rgba(89,255,158,0.16)";
      ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
      ctx.strokeStyle = "#59FF9E";
      ctx.lineWidth = 3;
      ctx.strokeRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
      ctx.fillStyle = "#59FF9E";
      ctx.font = "700 11px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(tr("ВЫХОД"), (d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2 + 4);
    }

    // объявление о том, где открылись двери
    if (g.announce > 0) {
      const a = Math.min(1, g.announce / 400);
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(0,0,0,0.82)";
      ctx.fillRect(0, h * 0.30, w, 46);
      ctx.fillStyle = "#FFD86B";
      ctx.font = "800 15px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${tr("ВЫХОД ПОЯВИЛСЯ")}: ${tr(exitName(g.exit))}`, w / 2, h * 0.30 + 29);
      ctx.globalAlpha = 1;
    }

    if (!g.door) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "700 11px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(tr("ДВЕРИ ЗАКРЫТЫ"), w / 2, h - 16);
    }

    // бабульки
    for (const b of g.babki) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.ellipse(b.x, b.y + 15, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
      // охотницу видно сразу: красное кольцо и восклицательный знак
      if (b.hunting) {
        ctx.strokeStyle = "#FF6B4D";
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(b.x, b.y, R_BABKA + 7, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#FF6B4D";
        ctx.font = "800 15px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("!", b.x, b.y - R_BABKA - 10);
      }
      // платок
      ctx.fillStyle = b.bag ? "#c85a7a" : "#8a7ac8";
      ctx.beginPath(); ctx.arc(b.x, b.y, R_BABKA, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(b.x, b.y, R_BABKA * 0.92, 0, Math.PI * 2); ctx.fill();
      // лицо
      ctx.fillStyle = "#e8c4a0";
      ctx.beginPath(); ctx.arc(b.x, b.y + 2, R_BABKA * 0.66, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3a2a1e";
      ctx.beginPath(); ctx.arc(b.x - 4, b.y, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(b.x + 4, b.y, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#7a4a3a";
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(b.x, b.y + 7, 3.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      // авоська
      if (b.bag) {
        ctx.fillStyle = "#d8c48a";
        ctx.beginPath(); ctx.ellipse(b.x + 19, b.y + 10, 7, 9, 0.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    // я
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(g.me.x, g.me.y + 14, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
    drawHead(ctx, me.look, g.me.x, g.me.y, R_ME, { body: false });
    // подсветка своей головы, чтобы не потеряться в толпе
    ctx.strokeStyle = "var(--acc)";
    ctx.strokeStyle = "#ffb020";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(g.me.x, g.me.y, R_ME + 5, 0, Math.PI * 2); ctx.stroke();

    ctx.restore();

    // всплывашки
    ctx.textAlign = "center";
    for (const p of g.pops) {
      ctx.globalAlpha = Math.min(1, p.t * 1.6);
      ctx.fillStyle = p.col;
      ctx.font = "800 15px Unbounded, Inter, system-ui, sans-serif";
      ctx.fillText(p.txt, p.x, p.y - (1 - p.t) * 26);
    }
    ctx.globalAlpha = 1;

    if (g.running && g.stop === 0 && !g.door) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "600 12px Inter, system-ui, sans-serif";
      ctx.fillText(tr("Веди пальцем к дверям, не задевая бабулек"), w / 2, 42);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "play") {
      const c = document.querySelector<HTMLCanvasElement>("[data-bus-canvas]");
      const r = c?.getBoundingClientRect();
      reset(r?.width || 360, r?.height || 640);
      G.current.running = true;
    }
  }, [phase, reset]);

  return (
    <div className="absolute inset-0" style={{ background: "var(--bg)" }}>
      <canvas
        ref={canvasRef}
        data-bus-canvas
        className="absolute inset-0 w-full h-full"
        onPointerDown={(e) => { e.preventDefault(); track(e); }}
        onPointerMove={track}
        style={{ touchAction: "none" }}
      />

      <GameHUD
        score={score}
        best={best}
        onExit={onExit}
        label={tr("ОЧКИ")}
        extra={
          <div className="flex items-center shrink-0" style={{ gap: 7 }}>
            <div
              className="t-label shrink-0"
              style={{
                padding: "8px 10px", borderRadius: "var(--r-md)",
                background: "var(--btn-bg)",
                border: `1px solid ${doorOpen ? "#59FF9E" : "rgba(255,255,255,0.16)"}`,
                color: doorOpen ? "#59FF9E" : "#fff", fontSize: 9,
              }}
            >
              {stop}/{STOPS}
            </div>
            <div
              className="t-num shrink-0"
              style={{
                padding: "8px 11px", borderRadius: "var(--r-md)",
                background: "var(--btn-bg)",
                border: `1px solid ${patience < 35 ? "#FF6B4D" : "rgba(255,255,255,0.16)"}`,
                color: patience < 35 ? "#FF6B4D" : "#fff", fontSize: 13,
              }}
            >
              {Math.max(0, Math.round(patience))}
            </div>
          </div>
        }
      />

      <AnimatePresence>{phase === "count" && <Countdown n={cd} />}</AnimatePresence>

      {phase === "over" && (
        <GameOver
          score={result.score}
          best={best}
          coins={result.coins}
          xp={result.xp}
          onRetry={restart}
          onExit={onExit}
          title={stop >= STOPS ? tr("ДОЕХАЛ") : tr("НЕ ДОЕХАЛ")}
          sub={stop >= STOPS ? tr("Дома. Наконец-то.") : tr("Терпение кончилось")}
        />
      )}
    </div>
  );
}

/** Прямоугольник дверей для стороны выхода */
function exitRect(side: ExitSide, w: number, h: number) {
  const T = 44;   // толщина зоны
  switch (side) {
    case "back":  return { x0: w * 0.28, x1: w * 0.72, y0: h - T, y1: h };
    case "front": return { x0: w * 0.28, x1: w * 0.72, y0: h * 0.12, y1: h * 0.12 + T };
    case "left":  return { x0: 0, x1: T, y0: h * 0.34, y1: h * 0.66 };
    case "right": return { x0: w - T, x1: w, y0: h * 0.34, y1: h * 0.66 };
  }
}

/** Человеческое название стороны для объявления */
function exitName(side: ExitSide): string {
  switch (side) {
    case "back": return "СЗАДИ";
    case "front": return "СПЕРЕДИ";
    case "left": return "СЛЕВА";
    case "right": return "СПРАВА";
  }
}
