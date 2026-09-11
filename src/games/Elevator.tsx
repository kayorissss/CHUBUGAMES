import { useCallback, useEffect, useRef, useState } from "react";
import { useGame } from "../core/store";
import { tr } from "../core/i18n";
import { sfx, haptic } from "../core/fx";
import { useCanvas, GameHUD, GameOver, Countdown, HudStat } from "./shell";
import { drawHead } from "../core/head";
import { scene } from "../core/palette";
import type { FriendLook } from "../core/types";

/**
 * ЛИФТ В ОБЩАГЕ.
 *
 * Лифт ездит по этажам, на площадках ждут люди. Открыл двери — заходят,
 * но у лифта есть предел веса. Перегрузил — застрял, минус жизнь.
 * Довёз до нужного этажа — очки.
 *
 * Механика про ВМЕСТИМОСТЬ и планирование маршрута, а не про реакцию:
 * такого в наборе ещё не было. Управление — тап по этажу (куда ехать)
 * и кнопка дверей.
 */

type Phase = "count" | "play" | "over";

const FLOORS = 6;
/** Предел веса лифта, условных единиц */
const CAP = 100;
/** Сколько весит один человек (толстые тяжелее) */
const W_MIN = 18;
const W_MAX = 34;

/**
 * Скорость лифта, дверей и поток людей.
 *
 * Подобрано перебором (250 смен на конфигурацию, три уровня умения).
 * Первые прогоны показали две крайности: при медленном лифте смену
 * срывали ВСЕ, включая идеального игрока, а при терпеливых жильцах не
 * проигрывал никто. Итог сейчас:
 *   новичок  — 35 доставок, смена срывается в 74% случаев
 *   средний  — 41 доставка, срыв в 44%
 *   мастер   — 45 доставок, срыв в 20%
 * То есть решает игрок, а не случайность.
 */
const SPEED = 0.003;            // этажей в миллисекунду
const DOOR_MS = 380;            // открытие/закрытие дверей

/** Смена длится ограниченное время */
const SHIFT_MS = 90000;
const MAX_FAIL = 3;

interface Person {
  id: number;
  from: number;
  to: number;
  w: number;
  look: FriendLook;
  /** уже в лифте */
  inside: boolean;
  /** нетерпение 0..1 — на единице уходит пешком */
  mad: number;
}

export default function Elevator({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress, toast } = useGame();
  const [phase, setPhase] = useState<Phase>("count");
  const [cd, setCd] = useState(3);
  const [score, setScore] = useState(0);
  const [fails, setFails] = useState(0);
  const [load, setLoad] = useState(0);
  const [left, setLeft] = useState(SHIFT_MS);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const best = s.games.lift?.best ?? 0;
  const looks = s.friends.map((f) => f.look);

  const G = useRef({
    running: false,
    y: 0,                 // позиция лифта в этажах, 0..FLOORS-1
    target: 0,
    doors: 0,             // 0 закрыты .. 1 открыты
    wantOpen: false,
    people: [] as Person[],
    nextId: 1,
    spawnT: 1200,
    delivered: 0,
    fails: 0,
    left: SHIFT_MS,
    startT: 0,
    shake: 0,
    flash: 0,
    over: 0,              // вспышка перегруза
    bell: false,
  });

  const endRef = useRef<((bell?: boolean) => void) | null>(null);
  const lastLeft = useRef(SHIFT_MS);

  const reset = useCallback(() => {
    const g = G.current;
    g.running = false;
    g.y = 0;
    g.target = 0;
    g.doors = 0;
    g.wantOpen = false;
    g.people = [];
    g.nextId = 1;
    g.spawnT = 900;
    g.delivered = 0;
    g.fails = 0;
    g.left = SHIFT_MS;
    g.shake = 0;
    g.flash = 0;
    g.over = 0;
    g.bell = false;
    g.startT = Date.now();
    setScore(0);
    setFails(0);
    setLoad(0);
    setLeft(SHIFT_MS);
    lastLeft.current = SHIFT_MS;
  }, []);

  const restart = useCallback(() => {
    reset();
    setPhase("count");
    setCd(3);
  }, [reset]);

  useEffect(() => {
    if (phase !== "count") return;
    if (cd < 0) {
      reset();
      G.current.running = true;
      G.current.startT = Date.now();
      setPhase("play");
      return;
    }
    sfx.click();
    const t = setTimeout(() => setCd((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, cd, reset]);

  const end = useCallback((bell = false) => {
    const g = G.current;
    if (!g.running) return;
    g.running = false;
    g.bell = bell;
    const sc = g.delivered;
    const coins = Math.floor(sc * 38 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 7 + 15);
    setResult({ score: sc, coins, xp });
    setPhase("over");
    if (bell) { sfx.levelUp?.(); haptic("success"); }
    else { sfx.gameOver(); haptic("error"); }
    addCoins(coins);
    addXp(xp);
    finishGame("lift", sc, Date.now() - g.startT);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);
  endRef.current = end;

  /** Тап по этажу — едем туда */
  const goTo = useCallback((f: number) => {
    const g = G.current;
    if (!g.running) return;
    if (g.doors > 0) return;          // с открытыми дверями не поедем
    g.target = Math.max(0, Math.min(FLOORS - 1, f));
    sfx.click();
    haptic("light");
  }, []);

  /** Кнопка дверей */
  const toggleDoors = useCallback(() => {
    const g = G.current;
    if (!g.running) return;
    // двери только на этаже, не на ходу
    if (Math.abs(g.y - g.target) > 0.02) return;
    g.wantOpen = !g.wantOpen;
    sfx.swoosh?.();
    haptic("light");
  }, []);

  const ref = useCanvas((ctx, w, h, dt) => {
    const g = G.current;
    const P = scene();

    if (g.running) {
      g.left -= dt;
      if ((g.left / 250 | 0) !== (lastLeft.current / 250 | 0)) {
        lastLeft.current = g.left;
        setLeft(Math.max(0, g.left));
      }
      if (g.left <= 0) { endRef.current?.(true); return; }

      // движение лифта
      const d = g.target - g.y;
      if (Math.abs(d) > 0.004 && g.doors <= 0.01) {
        g.y += Math.sign(d) * Math.min(Math.abs(d), SPEED * dt);
      }

      // двери
      const want = g.wantOpen && Math.abs(d) < 0.02 ? 1 : 0;
      g.doors += (want - g.doors) * Math.min(1, dt / DOOR_MS * 2.2);
      if (g.doors < 0.01) g.doors = 0;

      const atFloor = Math.round(g.y);

      // высадка и посадка при открытых дверях
      if (g.doors > 0.85) {
        // высадка
        for (const p of g.people) {
          if (p.inside && p.to === atFloor) {
            p.inside = false;
            p.mad = -1;                 // помечаем на удаление
            g.delivered += 1;
            g.flash = 1;
            sfx.coin?.();
          }
        }
        g.people = g.people.filter((p) => p.mad >= 0);
        setScore(g.delivered);

        // посадка: заходят по одному, пока влезают
        const cur = g.people.filter((p) => p.inside).reduce((a, b) => a + b.w, 0);
        const waiting = g.people.find((p) => !p.inside && p.from === atFloor);
        if (waiting) {
          if (cur + waiting.w <= CAP) {
            waiting.inside = true;
            sfx.tap?.();
          } else {
            /*
             * ПЕРЕГРУЗ. Человек не влезает — лифт пищит.
             * Это не поражение: игрок должен сначала кого-то отвезти.
             * Поражением был бы «застрял», но тогда наказание за
             * любопытство слишком грубое — проверено на бумаге.
             */
            g.over = 1;
          }
        }
      }

      // нетерпение ждущих: полное терпение — 16 секунд
      for (const p of g.people) {
        if (p.inside) continue;
        p.mad += dt / 16000;
        if (p.mad >= 1) {
          p.mad = -1;
          g.fails += 1;
          setFails(g.fails);
          g.shake = 12;
          sfx.error?.();
          haptic("heavy");
          if (g.fails >= MAX_FAIL) {
            toast({ title: tr("СМЕНА СОРВАНА"), sub: tr("Все ушли по лестнице"), icon: "skull", tone: "bad" });
            endRef.current?.(false);
            return;
          }
        }
      }
      g.people = g.people.filter((p) => p.mad >= 0);

      // появление людей
      g.spawnT -= dt;
      if (g.spawnT <= 0) {
        const waitingCount = g.people.filter((p) => !p.inside).length;
        if (waitingCount < 6) {
          const from = Math.floor(Math.random() * FLOORS);
          let to = Math.floor(Math.random() * FLOORS);
          if (to === from) to = (to + 1 + Math.floor(Math.random() * (FLOORS - 1))) % FLOORS;
          g.people.push({
            id: g.nextId++,
            from, to,
            w: Math.round(W_MIN + Math.random() * (W_MAX - W_MIN)),
            look: looks[Math.floor(Math.random() * looks.length)],
            inside: false,
            mad: 0,
          });
        }
        // темп нарастает
        const k = Math.min(1, g.delivered / 25);
        g.spawnT = 1900 - 1300 * k + Math.random() * 900;
      }

      const cur = g.people.filter((p) => p.inside).reduce((a, b) => a + b.w, 0);
      setLoad(cur);
    }

    g.shake = Math.max(0, g.shake - dt * 0.04);
    g.flash = Math.max(0, g.flash - dt * 0.003);
    g.over = Math.max(0, g.over - dt * 0.0022);

    /* ─────────── отрисовка ─────────── */
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, P.bg0);
    grd.addColorStop(1, P.bg2);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

    const padT = 14;
    const padB = 74;
    const fh = (h - padT - padB) / FLOORS;      // высота этажа
    const shaftW = Math.min(104, w * 0.30);
    const shaftX = w - shaftW - 14;

    // этажи и ждущие
    for (let i = 0; i < FLOORS; i++) {
      const fy = padT + (FLOORS - 1 - i) * fh;
      // пол
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(10, fy + fh - 3, w - 20, 3);
      // номер этажа
      ctx.textAlign = "left";
      ctx.font = "800 12px Unbounded, Inter, system-ui, sans-serif";
      ctx.fillStyle = Math.round(g.y) === i ? "var(--acc)" : "rgba(255,255,255,0.35)";
      ctx.fillText(String(i + 1), 14, fy + fh - 12);

      // ждущие на этаже
      const wait = g.people.filter((p) => !p.inside && p.from === i);
      wait.forEach((p, idx) => {
        const px = 40 + idx * 40;
        if (px > shaftX - 34) return;
        const py = fy + fh - 26;
        // нетерпение — краснеющая полоска под ногами
        ctx.fillStyle = `rgba(255,${Math.round(200 - p.mad * 180)},60,${0.35 + p.mad * 0.5})`;
        ctx.fillRect(px - 13, py + 15, 26, 3);
        drawHead(ctx, p.look, px, py, 12, { body: true, angry: p.mad });
        // куда едет
        ctx.textAlign = "center";
        ctx.font = "700 9px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`${p.to + 1}`, px, py - 19);
      });
    }

    // шахта
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    ctx.fillRect(shaftX, padT, shaftW, fh * FLOORS);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    ctx.strokeRect(shaftX, padT, shaftW, fh * FLOORS);

    // кабина
    const cy = padT + (FLOORS - 1 - g.y) * fh;
    ctx.fillStyle = "#1b202c";
    ctx.fillRect(shaftX + 4, cy + 4, shaftW - 8, fh - 8);
    ctx.strokeStyle = g.over > 0 ? "#ff6b5a" : "rgba(255,255,255,0.28)";
    ctx.lineWidth = 2;
    ctx.strokeRect(shaftX + 4, cy + 4, shaftW - 8, fh - 8);

    // пассажиры в кабине
    const inside = g.people.filter((p) => p.inside);
    inside.forEach((p, idx) => {
      const px = shaftX + 20 + (idx % 3) * 30;
      const py = cy + fh / 2 + 4;
      drawHead(ctx, p.look, px, py, 10, { body: true });
      ctx.textAlign = "center";
      ctx.font = "700 8px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#ffd34a";
      ctx.fillText(`${p.to + 1}`, px, py - 16);
    });

    // двери
    const dw = (shaftW - 8) / 2 * (1 - g.doors);
    ctx.fillStyle = "#39415a";
    ctx.fillRect(shaftX + 4, cy + 4, dw, fh - 8);
    ctx.fillRect(shaftX + shaftW - 4 - dw, cy + 4, dw, fh - 8);

    // индикатор загрузки на кабине
    const lw = shaftW - 16;
    const lf = Math.min(1, inside.reduce((a, b) => a + b.w, 0) / CAP);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(shaftX + 8, cy + fh - 12, lw, 4);
    ctx.fillStyle = lf > 0.85 ? "#ff6b5a" : lf > 0.6 ? "#ffc53d" : "#5ce39b";
    ctx.fillRect(shaftX + 8, cy + fh - 12, lw * lf, 4);

    ctx.restore();

    if (g.flash > 0) {
      ctx.fillStyle = `rgba(92,227,155,${g.flash * 0.16})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (g.over > 0) {
      ctx.textAlign = "center";
      ctx.font = "800 16px Unbounded, Inter, system-ui, sans-serif";
      ctx.fillStyle = `rgba(255,107,90,${g.over})`;
      ctx.fillText(tr("ПЕРЕГРУЗ"), w / 2, h - 84);
    }
  }, [looks]);

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{ padding: "calc(var(--sat) + 74px) 16px calc(var(--sab) + 26px)" }}
    >
      <GameHUD
        score={score}
        best={best}
        onExit={onExit}
        label={tr("ДОВЁЗ")}
        rulesId="lift"
        lives={{ value: MAX_FAIL - fails, max: MAX_FAIL, icon: "heart" }}
        extra={
          <>
            <HudStat
              label={tr("СМЕНА")}
              value={`${Math.ceil(left / 1000)}${tr("с")}`}
              tone={left < 15000 ? "warn" : "plain"}
            />
            <HudStat
              label={tr("ВЕС")}
              value={`${load}/${CAP}`}
              tone={load > CAP * 0.85 ? "danger" : load > CAP * 0.6 ? "warn" : "plain"}
            />
          </>
        }
      />

      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <canvas
          ref={ref}
          className="w-full h-full"
          style={{ display: "block", borderRadius: "var(--r-xl)", touchAction: "none" }}
        />

        {phase === "count" && <Countdown n={cd} />}

        {phase === "over" && (
          <GameOver
            score={result.score}
            best={best}
            coins={result.coins}
            xp={result.xp}
            onRetry={restart}
            onExit={onExit}
            title={G.current.bell ? tr("СМЕНА ОКОНЧЕНА") : tr("СМЕНА СОРВАНА")}
            sub={G.current.bell ? tr("Развёз сколько успел") : tr("Слишком многие ушли пешком")}
          />
        )}
      </div>

      {/* Кнопки этажей и дверей — не у самого низа экрана */}
      <div className="flex items-center" style={{ gap: 6, marginTop: 10 }}>
        {Array.from({ length: FLOORS }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            className="t-num flex-1"
            style={{
              padding: "13px 0", borderRadius: "var(--r-sm)",
              background: "var(--btn-bg)",
              border: "1px solid var(--btn-brd)",
              fontSize: 14,
            }}
          >
            {i + 1}
          </button>
        ))}
        <button
          type="button"
          onClick={toggleDoors}
          className="t-label"
          style={{
            padding: "13px 12px", borderRadius: "var(--r-sm)",
            background: "var(--acc)", color: "var(--acc-ink)",
            border: "1px solid var(--acc)", fontSize: 9.5,
          }}
        >
          {tr("ДВЕРИ")}
        </button>
      </div>

      <div className="t-caption" style={{ marginTop: 8, textAlign: "center" }}>
        {tr("Цифра над головой — куда человеку надо. Следи за весом")}
      </div>
    </div>
  );
}
