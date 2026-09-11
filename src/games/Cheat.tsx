import { useCallback, useEffect, useRef, useState } from "react";
import { useGame } from "../core/store";
import { tr } from "../core/i18n";
import { sfx, haptic } from "../core/fx";
import { useCanvas, GameHUD, GameOver, Countdown, HudStat } from "./shell";
import { drawHead } from "../core/head";
import { scene } from "../core/palette";
import type { FriendLook } from "../core/types";

/**
 * СПИСАТЬ НА ПАРЕ.
 *
 * Шитов стоит у доски. Пока он отвернулся — пишешь, держа палец на
 * экране. Повернулся — надо успеть убрать руку, иначе спалит.
 *
 * Это единственная в наборе игра про СДЕРЖАННОСТЬ: выигрывает не тот,
 * кто быстрее тапает, а тот, кто вовремя останавливается. Отсюда и
 * управление — удержание, а не серия тапов.
 *
 * Темп подобран расчётом (см. комментарий к TELL_MS): у человека на
 * реакцию уходит около 250 мс, поэтому предупреждение о повороте
 * длится заметно дольше, но сокращается с уровнем.
 */

type Phase = "count" | "play" | "over";

/** Куда смотрит препод */
type Look = "board" | "turning" | "class";

/**
 * Сколько длится замах на поворот (предупреждение).
 *
 * Средняя простая реакция человека — 250 мс, у уставшего студента
 * больше. Стартуем с 900 мс, к десятому уровню сжимаем до 420 мс:
 * всё ещё выше порога реакции, но требует внимания.
 */
const TELL_0 = 900;
const TELL_MIN = 500;

/** Сколько препод смотрит в класс */
const WATCH_0 = 1500;
const WATCH_MIN = 900;

/** Пауза между поворотами: случайная, чтобы нельзя было зазубрить ритм */
const CALM_MIN = 700;
const CALM_MAX = 2200;

/**
 * Скорость письма: доля билета за миллисекунду.
 *
 * Подобрана перебором (500 забегов на конфигурацию). Билет требует
 * 2.9 секунды непрерывного письма — то есть НЕСКОЛЬКИХ окон подряд.
 * При более высокой скорости окна переставали что-либо значить: билет
 * дописывался за половину одного окна.
 */
const WRITE_RATE = 0.00035;

/**
 * Потолок ускорения письма.
 *
 * Без него множитель (1 + lvl * 0.04) рос бесконечно: на 400-м билете
 * один билет писался за 27 мс, и симуляция выдавала 442 билета за пару.
 * Теперь предел — вдвое быстрее старта.
 */
const SPD_CAP = 2;

/**
 * ПАРА ДЛИТСЯ ОГРАНИЧЕННОЕ ВРЕМЯ.
 *
 * Первая версия была «на выживание», но аккуратный игрок не проигрывал
 * никогда: забег упирался в потолок симуляции и длился бесконечно.
 * Теперь цель — успеть списать как можно больше за пару, а три палева
 * заканчивают её досрочно.
 */
const LESSON_MS = 75000;

/** Штраф за палево */
const MAX_CAUGHT = 3;

export default function Cheat({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress, toast } = useGame();
  const [phase, setPhase] = useState<Phase>("count");
  const [cd, setCd] = useState(3);
  const [score, setScore] = useState(0);
  const [caught, setCaught] = useState(0);
  const [left, setLeft] = useState(LESSON_MS);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const best = s.games.cheat?.best ?? 0;

  const G = useRef({
    running: false,
    look: "board" as Look,
    timer: 0,
    /** прогресс текущего билета 0..1 */
    prog: 0,
    /** сколько билетов сдано */
    done: 0,
    caught: 0,
    writing: false,
    startT: 0,
    shake: 0,
    flash: 0,
    /** вспышка «спалил» */
    busted: 0,
    /** уровень — растёт с каждым билетом */
    lvl: 0,
    /** сколько осталось до конца пары, мс */
    left: LESSON_MS,
    /** пара закончилась звонком, а не палевом */
    bell: false,
    look0: null as FriendLook | null,
  });

  const teacher = s.friends.find((f) => f.id === "shitov") || s.friends[0];

  /**
   * Ссылка на end для вызова из кадра отрисовки: сам end объявлен ниже
   * и зависит от колбэков магазина, а useCanvas не должен от них
   * перезапускаться.
   */
  const endRef = useRef<((bell?: boolean) => void) | null>(null);
  /** Последнее переданное в React значение таймера — обновляем 4 раза в секунду,
   *  а не каждый кадр, иначе лишние перерисовки на слабом телефоне. */
  const lastLeftRef = useRef(LESSON_MS);

  const reset = useCallback(() => {
    const g = G.current;
    g.running = false;
    g.look = "board";
    g.timer = 2000;
    g.prog = 0;
    g.done = 0;
    g.caught = 0;
    g.writing = false;
    g.shake = 0;
    g.flash = 0;
    g.busted = 0;
    g.lvl = 0;
    g.left = LESSON_MS;
    g.startT = Date.now();
    setLeft(LESSON_MS);
    setScore(0);
    setCaught(0);
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
    const sc = g.done;
    const coins = Math.floor(sc * 46 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 9 + 15);
    setResult({ score: sc, coins, xp });
    setPhase("over");
    if (bell) { sfx.levelUp?.(); haptic("success"); }
    else { sfx.gameOver(); haptic("error"); }
    addCoins(coins);
    addXp(xp);
    finishGame("cheat", sc, Date.now() - g.startT);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  endRef.current = end;

  /** Палец лёг на экран — пишем */
  const startWrite = useCallback(() => {
    const g = G.current;
    if (!g.running) return;
    g.writing = true;
    // Пишем, когда он смотрит в класс — сразу палево
    if (g.look === "class") {
      g.caught += 1;
      setCaught(g.caught);
      g.busted = 1;
      g.shake = 16;
      sfx.error?.();
      haptic("heavy");
      g.writing = false;
      if (g.caught >= MAX_CAUGHT) {
        toast({ title: tr("СПАЛИЛСЯ"), sub: tr("Шитов забрал листок"), icon: "skull", tone: "bad" });
        end();
      }
    }
  }, [end, toast]);

  const stopWrite = useCallback(() => {
    G.current.writing = false;
  }, []);

  const ref = useCanvas((ctx, w, h, dt) => {
    const g = G.current;
    const P = scene();

    if (g.running) {
      // пара идёт — время кончилось, звонок
      g.left -= dt;
      if ((g.left / 250 | 0) !== (lastLeftRef.current / 250 | 0)) {
        lastLeftRef.current = g.left;
        setLeft(g.left);
      }
      if (g.left <= 0) {
        g.left = 0;
        endRef.current?.(true);
        return;
      }
      const k = Math.min(1, g.lvl / 10);
      const tellMs = TELL_0 - (TELL_0 - TELL_MIN) * k;
      const watchMs = WATCH_0 - (WATCH_0 - WATCH_MIN) * k;

      g.timer -= dt;
      if (g.timer <= 0) {
        if (g.look === "board") {
          g.look = "turning";
          g.timer = tellMs;
          sfx.tap?.();
        } else if (g.look === "turning") {
          g.look = "class";
          g.timer = watchMs;
          // Поймал с поличным
          if (g.writing) {
            g.caught += 1;
            setCaught(g.caught);
            g.busted = 1;
            g.shake = 16;
            g.writing = false;
            sfx.error?.();
            haptic("heavy");
            if (g.caught >= MAX_CAUGHT) {
              toast({ title: tr("СПАЛИЛСЯ"), sub: tr("Шитов забрал листок"), icon: "skull", tone: "bad" });
              end();
            }
          }
        } else {
          g.look = "board";
          // пауза до следующего поворота — случайная, чтобы не зубрить ритм
          g.timer = CALM_MIN + Math.random() * (CALM_MAX - k * 900);
        }
      }

      // пишем только пока палец на экране и он не смотрит
      if (g.writing && g.look !== "class") {
        g.prog += dt * WRITE_RATE * Math.min(SPD_CAP, 1 + g.lvl * 0.04);
        if (g.prog >= 1) {
          g.prog = 0;
          g.done += 1;
          g.lvl += 1;
          setScore(g.done);
          g.flash = 1;
          sfx.coin?.();
          haptic("success");
        }
      }
    }

    g.shake = Math.max(0, g.shake - dt * 0.04);
    g.flash = Math.max(0, g.flash - dt * 0.003);
    g.busted = Math.max(0, g.busted - dt * 0.0022);

    /* ---------- аудитория ---------- */
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, P.bg0);
    grd.addColorStop(1, P.bg2);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (g.shake > 0) {
      ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);
    }

    // доска
    const bw = w * 0.66;
    const bx = (w - bw) / 2;
    const by = 26;
    const bh = Math.min(120, h * 0.24);
    ctx.fillStyle = "#16241c";
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, bw, bh);
    // каракули мелом
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const yy = by + 20 + i * (bh - 30) / 4;
      ctx.beginPath();
      ctx.moveTo(bx + 14, yy);
      ctx.lineTo(bx + 14 + (bw - 40) * (0.4 + ((i * 37) % 50) / 100), yy);
      ctx.stroke();
    }

    // препод
    const tx = w * 0.5;
    const ty = by + bh + 60;
    const facing = g.look === "board" ? 0 : g.look === "turning" ? 0.5 : 1;
    ctx.save();
    ctx.translate(tx, ty);
    // тело
    ctx.fillStyle = "#2c3140";
    ctx.beginPath();
    ctx.moveTo(-24, 34);
    ctx.quadraticCurveTo(0, 22, 24, 34);
    ctx.lineTo(20, 86);
    ctx.quadraticCurveTo(0, 92, -20, 86);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // голова: поворот показываем наклоном и тем, видно ли лицо
    drawHead(
      ctx,
      teacher.look,
      tx,
      ty,
      26,
      {
        body: false,
        tilt: (facing - 0.5) * 0.5,
        angry: facing,
        mouth: g.look === "class" ? 0.5 : 0.1,
      },
    );

    // Спиной к классу — рисуем «затылок»: перекрываем лицо блоком волос
    if (g.look === "board") {
      ctx.fillStyle = teacher.look.hair || "#4a3222";
      ctx.beginPath();
      ctx.arc(tx, ty, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.arc(tx, ty + 4, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    /* ---------- индикатор состояния ---------- */
    const label =
      g.look === "board" ? tr("ПИШИ") : g.look === "turning" ? tr("ПОВОРАЧИВАЕТСЯ") : tr("СМОТРИТ");
    const col =
      g.look === "board" ? "#5ce39b" : g.look === "turning" ? "#ffc53d" : "#ff6b5a";

    ctx.textAlign = "center";
    ctx.font = "800 15px Unbounded, Inter, system-ui, sans-serif";
    ctx.fillStyle = col;
    ctx.fillText(label, w / 2, ty + 118);

    // полоса времени до смены состояния
    if (g.running) {
      const kk = Math.min(1, g.lvl / 10);
      const full =
        g.look === "turning"
          ? TELL_0 - (TELL_0 - TELL_MIN) * kk
          : g.look === "class"
            ? WATCH_0 - (WATCH_0 - WATCH_MIN) * kk
            : 2200;
      const frac = Math.max(0, Math.min(1, g.timer / full));
      const barW = w * 0.5;
      const bxx = (w - barW) / 2;
      const byy = ty + 132;
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(bxx, byy, barW, 6);
      ctx.fillStyle = col;
      ctx.fillRect(bxx, byy, barW * frac, 6);
    }

    /* ---------- листок ---------- */
    const pw = Math.min(240, w * 0.66);
    const px = (w - pw) / 2;
    const py = h - 150;
    const ph = 96;
    ctx.fillStyle = "#f3f0e6";
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);

    // написанные строки = прогресс
    const lines = 5;
    ctx.strokeStyle = "#2b3550";
    ctx.lineWidth = 2.5;
    for (let i = 0; i < lines; i++) {
      const need = (i + 1) / lines;
      const have = Math.min(1, Math.max(0, (g.prog - i / lines) * lines));
      if (have <= 0) continue;
      const yy = py + 18 + i * (ph - 28) / lines;
      ctx.beginPath();
      ctx.moveTo(px + 14, yy);
      ctx.lineTo(px + 14 + (pw - 28) * have, yy);
      ctx.stroke();
      void need;
    }

    // рука с ручкой — видна, пока пишем
    if (g.writing) {
      const hx = px + 14 + (pw - 28) * Math.min(1, (g.prog * lines) % 1);
      const hy = py + 18 + Math.floor(g.prog * lines) * (ph - 28) / lines;
      ctx.strokeStyle = "#e8b98f";
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(hx + 26, hy + 42);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.fillStyle = "#1a1d26";
      ctx.beginPath();
      ctx.arc(hx, hy, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // вспышка сдачи билета
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(92,227,155,${g.flash * 0.22})`;
      ctx.fillRect(0, 0, w, h);
    }
    // вспышка палева
    if (g.busted > 0) {
      ctx.fillStyle = `rgba(255,90,60,${g.busted * 0.3})`;
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.font = "800 20px Unbounded, Inter, system-ui, sans-serif";
      ctx.fillStyle = `rgba(255,255,255,${g.busted})`;
      ctx.fillText(tr("ЗАМЕТИЛ!"), w / 2, h * 0.42);
    }
  }, [teacher]);

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{ padding: "calc(var(--sat) + 74px) 16px calc(var(--sab) + 26px)" }}
    >
      <GameHUD
        score={score}
        best={best}
        onExit={onExit}
        label={tr("БИЛЕТЫ")}
        rulesId="cheat"
        lives={{ value: MAX_CAUGHT - caught, max: MAX_CAUGHT, icon: "eye" }}
        extra={
          <>
            <HudStat
              label={tr("ДО ЗВОНКА")}
              value={`${Math.ceil(left / 1000)}${tr("с")}`}
              tone={left < 15000 ? "warn" : "plain"}
            />
            <HudStat
              label={tr("ПАЛЕВО")}
              value={`${caught}/${MAX_CAUGHT}`}
              tone={caught > 0 ? "danger" : "plain"}
            />
          </>
        }
      />

      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        <canvas
          ref={ref}
          className="w-full h-full"
          style={{ display: "block", borderRadius: "var(--r-xl)", touchAction: "none" }}
          onPointerDown={(e) => { e.preventDefault(); startWrite(); }}
          onPointerUp={stopWrite}
          onPointerLeave={stopWrite}
          onPointerCancel={stopWrite}
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
            title={G.current.bell ? tr("ЗВОНОК") : tr("ЗАБРАЛИ ЛИСТОК")}
            sub={G.current.bell ? tr("Пара кончилась — успел сколько успел") : tr("Шитов всё видел")}
          />
        )}
      </div>

      <div className="t-caption" style={{ marginTop: 9, textAlign: "center" }}>
        {tr("Держи палец — пишешь. Отвернулся — пиши, повернулся — убирай руку")}
      </div>
    </div>
  );
}
