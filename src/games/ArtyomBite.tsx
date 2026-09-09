import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { drawHead } from "../core/head";
import { useCanvas, GameHUD, GameOver, Countdown } from "./shell";
import { sfx, haptic } from "../core/fx";
import Icon from "../ui/Icon";

/**
 * ЗУБЫ АРТЁМА — игра на нервах.
 *
 * Держи палец на экране — счётчик растёт. Артём приближается и щёлкает
 * зубами (а иногда тычет гелевой ручкой). Успей отпустить до укуса.
 * Отпустил рано — очки за подход зачислены, но время потеряно.
 * Не успел — минус жизнь.
 */

type Phase = "rules" | "count" | "play" | "over";
type Attack = "bite" | "pen";

const WARN_COLOR = "#ff6a4d";

/** Что орёт Артём, когда промахнулся мимо пальца */
const RAGE_LINES = [
  "БЛЯ, УВЁРНУЛСЯ!",
  "ДА ТЫ ЧИТЕР!",
  "СУКА, ЕЩЁ РАЗ!",
  "ДАВАЙ ПАЛЕЦ, ГНИДА",
  "ТЫ ЗАДРАЛ УЖЕ",
  "НУ ХОРОШ БЕГАТЬ!",
  "Я ТЕБЯ ДОСТАНУ",
  "ЧЁ ЗА ХРЕНЬ?!",
];

export default function ArtyomBite({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, bump, finishGame, questProgress } = useGame();
  const artyom =
    s.friends.find((f) => f.id === "artyom") || s.friends[0];

  const [phase, setPhase] = useState<Phase>("rules");
  const [cd, setCd] = useState(3);
  const [uiScore, setUiScore] = useState(0);
  const [uiLives, setUiLives] = useState(3);
  const [uiHold, setUiHold] = useState(false);
  const [uiCharge, setUiCharge] = useState(0);
  const [uiRage, setUiRage] = useState("");
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const G = useRef({
    running: false,
    holding: false,
    score: 0,
    lives: 3,
    charge: 0, // очки, накопленные за текущий подход
    elapsed: 0,
    // Артём
    approach: 0, // 0 далеко .. 1 у самого пальца
    windup: 0, // сколько осталось до атаки, мс
    attackIn: 0,
    attack: "bite" as Attack,
    biting: 0, // анимация укуса
    mouth: 0,
    shake: 0,
    flash: 0,
    round: 0,
    combo: 0,
    pops: [] as { x: number; y: number; txt: string; c: string; life: number }[],
    bites: 0,
    safeReleases: 0,
    rage: 0, // 0..1 краснота от злости
    rageLine: "",
    rageT: 0,
  });

  const reset = useCallback(() => {
    const g = G.current;
    g.running = false; g.holding = false;
    g.score = 0; g.lives = 3; g.charge = 0; g.elapsed = 0;
    g.approach = 0; g.windup = 0; g.attackIn = 0; g.biting = 0;
    g.mouth = 0; g.shake = 0; g.flash = 0; g.round = 0; g.combo = 0;
    g.pops = []; g.bites = 0; g.safeReleases = 0;
    g.rage = 0; g.rageLine = ""; g.rageT = 0;
    setUiScore(0); setUiLives(3); setUiHold(false); setUiCharge(0); setUiRage("");
  }, []);

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
      return;
    }
    sfx.click();
    const t = setTimeout(() => setCd((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, cd]);

  const end = useCallback(() => {
    const g = G.current;
    g.running = false;
    const score = Math.floor(g.score);
    const coins = Math.floor(score * 3.4 * (1 + s.prestige * 0.12));
    const xp = Math.floor(score * 0.9 + 25);
    setResult({ score, coins, xp });
    setPhase("over");
    sfx.gameOver();
    haptic("error");
    addCoins(coins);
    addXp(xp);
    finishGame("bite", score, g.elapsed);
    bump("bites", g.safeReleases);
    questProgress("score", score);
  }, [addCoins, addXp, finishGame, bump, questProgress, s.prestige]);

  /* ---------- новый подход Артёма ---------- */
  const newRound = (g: typeof G.current) => {
    g.round += 1;
    g.approach = 0;
    g.biting = 0;
    // с каждым раундом окно реакции сжимается, но не до невозможного
    const diffK = Math.min(1, g.round / 22);
    g.windup = 900 + Math.random() * 1500 - diffK * 450;
    g.attack = Math.random() < 0.28 ? "pen" : "bite";
    g.attackIn = g.windup;
  };

  /* ---------- ввод: держим палец ---------- */
  const press = () => {
    const g = G.current;
    if (!g.running || g.holding) return;
    g.holding = true;
    g.charge = 0;
    setUiHold(true);
    newRound(g);
    sfx.click();
  };

  const release = () => {
    const g = G.current;
    if (!g.running || !g.holding) return;
    g.holding = false;
    setUiHold(false);
    // успел убрать руку — забираем накопленное
    const gained = Math.floor(g.charge);
    if (gained > 0) {
      g.combo += 1;
      const bonus = 1 + Math.min(1.5, g.combo * 0.08);
      const total = Math.floor(gained * bonus);
      g.score += total;
      g.safeReleases += 1;
      setUiScore(Math.floor(g.score));
      g.pops.push({
        x: 0.5, y: 0.62, txt: `+${total}${g.combo > 2 ? ` x${bonus.toFixed(1)}` : ""}`,
        c: "#8fe08f", life: 900,
      });
      sfx.coin?.();
      haptic("light");

      // Артём не успел — краснеет и орёт
      g.rage = Math.min(1, g.rage + 0.42);
      g.rageLine = RAGE_LINES[Math.floor(Math.random() * RAGE_LINES.length)];
      g.rageT = 1500;
      setUiRage(g.rageLine);
    }
    g.charge = 0;
    g.approach = 0;
    setUiCharge(0);
  };

  const surfRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = surfRef.current;
    if (!el) return;
    const down = (e: PointerEvent) => { e.preventDefault(); press(); };
    const up = (e: PointerEvent) => { e.preventDefault(); release(); };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* ---------- цикл ---------- */
  const canvasRef = useCanvas((ctx, W, H, dt) => {
    const g = G.current;
    ctx.clearRect(0, 0, W, H);

    const headR = Math.min(W * 0.3, H * 0.19);
    const fingerY = H * 0.72;

    if (g.running) {
      g.elapsed += dt;
      g.shake *= 0.9;
      g.flash *= 0.92;
      g.mouth += ((g.holding ? 0.35 + g.approach * 0.5 : 0.1) - g.mouth) * 0.02 * dt * 0.1;

      if (g.holding) {
        // копим очки всё быстрее
        g.charge += dt * 0.014 * (1 + g.round * 0.03);
        setUiCharge(Math.floor(g.charge));

        g.attackIn -= dt;
        g.approach = Math.max(0, Math.min(1, 1 - g.attackIn / g.windup));

        if (g.attackIn <= 0) {
          // УКУС
          g.holding = false;
          setUiHold(false);
          g.biting = 320;
          g.lives -= 1;
          g.combo = 0;
          g.charge = 0;
          g.bites += 1;
          setUiCharge(0);
          setUiLives(g.lives);
          g.shake = 26;
          g.flash = 1;
          sfx.hit();
          haptic("heavy");
          g.pops.push({
            x: 0.5, y: 0.55,
            txt: g.attack === "pen" ? "РУЧКОЙ!" : "АМ!",
            c: WARN_COLOR, life: 1000,
          });
          if (g.lives <= 0) { end(); return; }
        }
      } else {
        g.approach += (0 - g.approach) * 0.012 * dt;
      }

      if (g.biting > 0) g.biting -= dt;

      // ярость спадает
      if (g.rageT > 0) {
        g.rageT -= dt;
        if (g.rageT <= 0) { g.rageLine = ""; setUiRage(""); }
      }
      g.rage = Math.max(0, g.rage - dt * 0.00022);

      for (let i = g.pops.length - 1; i >= 0; i--) {
        g.pops[i].life -= dt;
        g.pops[i].y -= dt * 0.00012;
        if (g.pops[i].life <= 0) g.pops.splice(i, 1);
      }
    }

    /* --- отрисовка --- */
    ctx.save();
    if (g.shake > 0.4) {
      ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    }

    // фон-парта
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "rgba(255,255,255,0.05)");
    bg.addColorStop(1, "rgba(0,0,0,0.2)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // линия парты
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, fingerY + headR * 0.5);
    ctx.lineTo(W, fingerY + headR * 0.5);
    ctx.stroke();

    // Артём приближается сверху
    const artY = H * 0.26 + g.approach * (fingerY - H * 0.26 - headR * 0.9);
    const bite = g.biting > 0 ? Math.sin((1 - g.biting / 320) * Math.PI) : 0;
    drawHead(ctx, artyom.look, W / 2, artY + bite * 26, headR, {
      mouth: Math.max(g.mouth, bite),
      angry: Math.min(1, 0.3 + g.approach * 0.6 + g.rage * 0.6),
      cheeks: 0,
      tilt: Math.sin(g.elapsed * 0.002) * 0.05 + bite * 0.12,
    });

    // гелевая ручка в атаке "pen"
    if (g.holding && g.attack === "pen" && g.approach > 0.45) {
      ctx.save();
      ctx.translate(W / 2 + headR * 0.95, artY + headR * 0.2);
      ctx.rotate(0.6 + g.approach * 0.5);
      ctx.fillStyle = "#2f6fe0";
      ctx.beginPath();
      ctx.roundRect(-4, -headR * 0.55, 8, headR * 1.1, 4);
      ctx.fill();
      ctx.fillStyle = "#e8e8f0";
      ctx.beginPath();
      ctx.moveTo(-4, headR * 0.55);
      ctx.lineTo(4, headR * 0.55);
      ctx.lineTo(0, headR * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // палец игрока
    const fx = W / 2;
    ctx.save();
    ctx.translate(fx, fingerY);
    const shrink = g.holding ? 1 : 0.92;
    ctx.fillStyle = "#f0c9a4";
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-16 * shrink, -6, 32 * shrink, headR * 0.95, 15);
    ctx.fill();
    ctx.stroke();
    // ноготь
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.ellipse(0, 4, 8 * shrink, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // индикатор опасности
    if (g.holding) {
      const danger = g.approach;
      ctx.strokeStyle = `rgba(255,106,77,${0.25 + danger * 0.65})`;
      ctx.lineWidth = 3 + danger * 5;
      ctx.beginPath();
      ctx.arc(fx, fingerY + headR * 0.3, headR * 0.75, 0, Math.PI * 2);
      ctx.stroke();
    }

    // попапы
    ctx.textAlign = "center";
    ctx.font = "800 22px Inter, system-ui, sans-serif";
    for (const p of g.pops) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 500));
      ctx.fillStyle = p.c;
      ctx.fillText(p.txt, p.x * W, p.y * H);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (g.flash > 0.02) {
      ctx.fillStyle = `rgba(255,60,40,${g.flash * 0.3})`;
      ctx.fillRect(0, 0, W, H);
    }
  }, [artyom]);

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
        best={s.games.bite.best}
        onExit={onExit}
        extra={
          <div className="flex shrink-0" style={{ gap: 4 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ opacity: i < uiLives ? 1 : 0.22, lineHeight: 0 }}>
                <Icon name="tooth" size={16} />
              </span>
            ))}
          </div>
        }
      />

      {/* Подсказка и накопитель */}
      {phase === "play" && (
        <div
          className="absolute left-0 right-0 flex flex-col items-center pointer-events-none"
          style={{ bottom: "calc(var(--sab) + 26px)", padding: "0 24px" }}
        >
          {uiHold ? (
            <div
              className="t-num"
              style={{ fontSize: 34, color: "var(--acc)", lineHeight: 1 }}
            >
              +{uiCharge}
            </div>
          ) : (
            <div className="t-title-sm" style={{ opacity: 0.85 }}>
              Прижми и держи палец — очки капают
            </div>
          )}
          <div className="t-caption text-center" style={{ marginTop: 8 }}>
            {uiHold ? "УБЕРИ ПАЛЕЦ, ПОКА НЕ УКУСИЛ" : "Отпустишь вовремя — заберёшь накопленное"}
          </div>
        </div>
      )}

      <AnimatePresence>
        {phase === "rules" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center"
            style={{ background: "rgba(6,6,9,0.9)", padding: 20 }}
          >
            <motion.div
              initial={{ y: 24, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
              className="w-full"
              style={{
                maxWidth: 350,
                background: "var(--surface)",
                border: "1px solid var(--surface-brd)",
                borderRadius: "var(--r-xl)",
                padding: 20,
              }}
            >
              <div className="t-title" style={{ marginBottom: 4 }}>ЗУБЫ АРТЁМА</div>
              <div className="t-caption" style={{ marginBottom: 16 }}>
                Игра на нервах. Защищаться не надо — надо рисковать.
              </div>

              {[
                ["1", "Держи палец на экране — счётчик очков растёт, пока держишь."],
                ["2", "Артём подкрадывается и щёлкает зубами. Иногда вместо укуса тычет гелевой ручкой — это не больно, но пугает."],
                ["3", "Убери палец до укуса — очки за подход зачислены. Убрал рано — очков мало, но живой."],
                ["4", "Не успел — минус зуб. Их всего три."],
              ].map(([n, txt]) => (
                <div key={n} className="flex" style={{ gap: 11, marginBottom: 11 }}>
                  <div
                    className="t-num shrink-0 flex items-center justify-center"
                    style={{
                      width: 22, height: 22, borderRadius: "var(--r-xs)",
                      background: "var(--acc)", color: "var(--acc-ink)", fontSize: 11,
                    }}
                  >
                    {n}
                  </div>
                  <div className="t-body" style={{ lineHeight: 1.45 }}>{txt}</div>
                </div>
              ))}

              <div
                className="t-caption"
                style={{
                  marginTop: 14, padding: "10px 12px",
                  borderRadius: "var(--r-md)", background: "var(--btn-bg)", lineHeight: 1.5,
                }}
              >
                Чем дольше держишь — тем больше очков и тем выше шанс остаться без зуба.
                Жадность наказуема.
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
                ПОНЯЛ, ПОЕХАЛИ
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

      {/* Артём матерится, когда не успел укусить */}
      <AnimatePresence>
        {phase === "play" && uiRage && (
          <motion.div
            key={uiRage}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 480, damping: 26 }}
            className="absolute left-0 right-0 flex justify-center pointer-events-none"
            style={{ top: "calc(var(--sat) + 108px)", padding: "0 24px" }}
          >
            <div
              className="t-title-sm text-center"
              style={{
                padding: "8px 14px",
                borderRadius: "var(--r-md)",
                background: "rgba(190,40,30,0.92)",
                border: "1px solid rgba(255,120,100,0.6)",
                color: "#fff",
                fontSize: 13,
                maxWidth: 300,
              }}
            >
              {uiRage}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{phase === "count" && <Countdown n={cd} />}</AnimatePresence>

      <AnimatePresence>
        {phase === "over" && (
          <GameOver
            score={result.score}
            best={s.games.bite.best}
            coins={result.coins}
            xp={result.xp}
            onRetry={start}
            onExit={onExit}
            title="СКУСАЛ"
            sub="Артём доволен. Ты — нет."
          />
        )}
      </AnimatePresence>

      {phase === "play" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute pointer-events-none"
          style={{ top: "calc(var(--sat) + 72px)", left: 0, right: 0, textAlign: "center" }}
        >
          <span className="t-label" style={{ opacity: 0.6 }}>
            подход {G.current.round}
          </span>
        </motion.div>
      )}
    </div>
  );
}
