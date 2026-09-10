import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { HERO_SKINS } from "../core/content";
import { drawHead } from "../core/head";
import { sfx, haptic } from "../core/fx";
import Icon, { type IconName } from "../ui/Icon";
import { useCanvas, GameHUD, GameOver, Countdown } from "./shell";
import AdModal from "../ui/AdModal";
import { hasAds, noteRevive } from "../core/ads";

type PType = "burger" | "cheese" | "nugget" | "shake" | "fries";
interface Proj {
  x: number; y: number; vx: number; vy: number; r: number; type: PType;
  rot: number; vr: number; scored: boolean;
  /** Своё ускорение: рассчитано из времени полёта на момент вылета */
  g: number;
}
type BType = "shield" | "slow" | "magnet" | "x2" | "heal";
/** Бонус спускается на парашюте; sway — фаза покачивания на стропах */
interface Bonus { x: number; y: number; vy: number; type: BType; t: number; sway: number }
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; s: number }
interface Pop { x: number; y: number; txt: string; life: number; c: string }

/**
 * Темп игры задаётся ВРЕМЕНЕМ ПОЛЁТА снаряда, а не скоростью в пикселях.
 *
 * Так игра одинаково честная на любом экране и, главное, её можно
 * сверить с человеческой реакцией. Считали по трём слагаемым:
 *   простая зрительная реакция          ~250 мс
 *   выбор, в какую сторону уходить      ~120 мс
 *   сам сдвиг пальца на треть экрана    ~220 мс
 * Итого уклонение занимает ~590 мс. Ниже этого опускаться нельзя.
 *
 * fallMax — сколько летит снаряд на первой секунде забега;
 * fallMin — предел, к которому всё сходится (у «ада» это 820 мс,
 *           то есть даже там остаётся запас 230 мс);
 * tau     — за сколько миллисекунд разгон проходит большую часть пути.
 * Разгон плавный (экспонента), а не рывком: пользователь жаловался,
 * что еда сразу летит слишком быстро.
 */
const DIFF = {
  chill: { spawn: 1150, fallMax: 2400, fallMin: 1250, tau: 90000 },
  normal: { spawn: 900, fallMax: 2050, fallMin: 1000, tau: 75000 },
  insane: { spawn: 640, fallMax: 1750, fallMin: 820, tau: 60000 },
};

/**
 * Скорость снижения аирдропа.
 *
 * 0.035 — это ~4.8 секунды от верха экрана до земли. Чтобы дойти до
 * парашюта через весь экран, нужно ~700 мс на движение плюс ~370 мс на
 * «заметил и решил», то есть минимум ~1.1 с; 4.8 с дают спокойный запас
 * и при этом бонус не висит в воздухе вечно.
 */
const PARA_FALL = 0.035;

/**
 * Доля средней скорости, с которой снаряд ВЫЛЕТАЕТ изо рта.
 * Остальное добирается ускорением: при 0.7 снаряд к земле разгоняется
 * в 1.86 раза — падение живое, но в начале не «зависает».
 *
 * Почему не фиксированная гравитация: тогда стартовую скорость надо было
 * бы считать как (dist - g*t²/2)/t, и на коротком экране (360x640)
 * выражение уходило в МИНУС — снаряды полетели бы вверх. Проверено
 * расчётом: при dist=398 и полёте 2400 мс получалось v0 = -0.17.
 * Теперь и скорость, и ускорение выводятся из времени полёта, поэтому
 * оба положительны на любом экране.
 */
const LAUNCH_K = 0.7;

/** Стартовая вертикальная скорость, чтобы пролететь `dist` за `ms` */
function speedForTime(dist: number, ms: number): number {
  return (LAUNCH_K * dist) / ms;
}

/** Ускорение, добирающее остаток пути ровно за то же время */
function gravForTime(dist: number, ms: number): number {
  return (2 * dist * (1 - LAUNCH_K)) / (ms * ms);
}

/** Текущее время полёта: плавно падает от fallMax к fallMin */
function fallTime(d: typeof DIFF.normal, elapsed: number): number {
  return d.fallMin + (d.fallMax - d.fallMin) * Math.exp(-elapsed / d.tau);
}

/**
 * Жёсткость пружины, которая ведёт героя за пальцем.
 *
 * Раньше стояла схема «накопить скорость и умножить на 0.74» — она
 * зависела от длины кадра, поэтому на просадках героя мотало: в расчёте
 * получалось до 22 смен направления и перелёт цели на 124%. Критически
 * задемпфированная пружина с omega=22 доходит до цели за 284 мс, вообще
 * без колебаний и перелёта, и остаётся устойчивой даже при 20 кадрах.
 */
const HERO_OMEGA = 22;

/** Шаг физики героя. Подшаг не длиннее 8 мс — тогда провал кадра не ломает пружину. */
function heroStep(px: number, pv: number, target: number, dtMs: number) {
  let left = Math.min(dtMs, 100);
  while (left > 0) {
    const h = Math.min(left, 8) / 1000;
    const a = HERO_OMEGA * HERO_OMEGA * (target - px) - 2 * HERO_OMEGA * pv;
    pv += a * h;
    px += pv * h;
    left -= 8;
  }
  return { px, pv };
}

export default function BurgerRain({ onExit }: { onExit: () => void }) {
  const { s, mainFriend, addCoins, addXp, bump, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  // реклама за воскрешение: одна попытка на забег
  const [showAd, setShowAd] = useState(false);
  const revivedRef = useRef(false);
  const [cd, setCd] = useState(3);
  const [uiScore, setUiScore] = useState(0);
  const [uiLives, setUiLives] = useState(3);
  const [uiBuffs, setUiBuffs] = useState<{ shield: number; slow: number; magnet: number; x2: number }>({
    shield: 0, slow: 0, magnet: 0, x2: 0,
  });
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });
  const [rage, setRage] = useState(false);

  const skin = HERO_SKINS.find((h) => h.id === s.heroSkin) || HERO_SKINS[0];
  // герой на земле — это ты сам
  const heroFriend = s.friends.find((f) => f.id === "vanya") || s.friends[0];
  const diff = DIFF[s.settings.difficulty];

  const G = useRef({
    px: 0.5, ptx: 0.5, pv: 0,
    projs: [] as Proj[], bonuses: [] as Bonus[], parts: [] as Part[], pops: [] as Pop[],
    score: 0, lives: 3, elapsed: 0, spawnT: 0, bonusT: 4000,
    shield: 0, slow: 0, magnet: 0, x2: 0,
    mouth: 0, blink: 0, blinkT: 1400, cheeks: 0, headShake: 0, headX: 0,
    rage: 0, rageT: 26000, shake: 0, flash: 0, dodged: 0, running: false,
    invuln: 0, comboStreak: 0,
    /** наклон корпуса героя, -1..1 — считается из скорости пружины */
    lean: 0,
  });

  const inputRef = useRef({ left: false, right: false, touchX: null as number | null });

  const reset = useCallback(() => {
    const g = G.current;
    g.px = 0.5; g.ptx = 0.5; g.pv = 0;
    g.projs = []; g.bonuses = []; g.parts = []; g.pops = [];
    g.score = 0; g.lives = 3; g.elapsed = 0; g.spawnT = 700; g.bonusT = 5000;
    g.shield = 0; g.slow = 0; g.magnet = 0; g.x2 = 0;
    g.mouth = 0; g.cheeks = 0; g.headShake = 0; g.headX = 0;
    g.rage = 0; g.rageT = 26000; g.shake = 0; g.flash = 0; g.dodged = 0;
    g.invuln = 0; g.comboStreak = 0; g.running = false; g.lean = 0;
    setUiScore(0); setUiLives(3); setRage(false);
    setUiBuffs({ shield: 0, slow: 0, magnet: 0, x2: 0 });
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
    const ghost = s.heroSkin === "ghost" ? 1.08 : 1;
    const coins = Math.floor(score * 2.6 * ghost * (1 + s.prestige * 0.12));
    const xp = Math.floor(score * 0.7 + 20);
    setResult({ score, coins, xp });
    setPhase("over");
    sfx.gameOver();
    haptic("error");
    addCoins(coins);
    addXp(xp);
    finishGame("burger", score, g.elapsed);
    bump("burgersDodged", g.dodged);
    questProgress("dodge", g.dodged);
  }, [addCoins, addXp, finishGame, bump, questProgress, s.heroSkin, s.prestige]);

  /* ---------- ввод ---------- */
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") inputRef.current.left = true;
      if (e.key === "ArrowRight" || e.key === "d") inputRef.current.right = true;
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") inputRef.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d") inputRef.current.right = false;
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  const surfRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<number | null>(null);

  const track = (e: React.PointerEvent) => {
    const el = surfRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    inputRef.current.touchX = (e.clientX - r.left) / r.width;
  };

  const onDown = (e: React.PointerEvent) => {
    dragId.current = e.pointerId;
    // Захватываем указатель: палец теперь ведёт героя непрерывно,
    // даже если уехал за пределы элемента
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch { /* noop */ }
    track(e);
  };

  const onMove = (e: React.PointerEvent) => {
    if (dragId.current !== e.pointerId) return;
    e.preventDefault();
    track(e);
  };

  const endTouch = (e?: React.PointerEvent) => {
    if (e && dragId.current !== null) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(dragId.current);
      } catch { /* noop */ }
    }
    dragId.current = null;
    inputRef.current.touchX = null;
  };

  /* ---------- игровой цикл ---------- */
  /** Продолжить забег после рекламы: чистим экран и даём 2 жизни */
  const revive = useCallback(() => {
    const g = G.current;
    g.lives = 2;
    setUiLives(2);
    g.projs = [];
    g.bonuses = [];
    g.spawnT = 1400;
    g.rage = 0;
    g.running = true;
    setPhase("play");
    sfx.power?.();
    haptic("success");
  }, []);

  const canvasRef = useCanvas((ctx, W, H, dt) => {
    const g = G.current;
    ctx.clearRect(0, 0, W, H);

    const headCy = H * 0.155;
    const headR = Math.min(W * 0.24, H * 0.14);
    const groundY = H * 0.88;
    const heroR = Math.min(W * 0.062, 30);

    if (g.running) {
      g.elapsed += dt;
      const timeScale = g.slow > 0 ? 0.48 : 1;
      const sdt = dt * timeScale;
      // Сколько времени у игрока на уклонение прямо сейчас. Плавно
      // сокращается по ходу забега, но никогда не опускается ниже
      // порога человеческой реакции (см. комментарий к DIFF).
      // В ярости окно ужимается, но не больше чем на 15%.
      const fall = fallTime(diff, g.elapsed) * (g.rage > 0 ? 0.85 : 1);
      // Расстояние от рта до головы героя — по нему считаем скорость.
      const dropDist = Math.max(1, groundY - heroR - (headCy + headR * 0.5));
      const vy0 = speedForTime(dropDist, fall) * timeScale;
      // Ускорение своё у каждого снаряда: оно вытекает из времени полёта.
      const gNow = gravForTime(dropDist, fall) * timeScale * timeScale;
      // Горизонтальный разброс масштабируем тем же временем полёта:
      // чем быстрее падает, тем меньше должен успевать уехать вбок.
      const spread = (W * 0.22) / fall * timeScale;

      /* ярость */
      g.rageT -= dt;
      if (g.rageT <= 0) {
        if (g.rage > 0) { g.rage = 0; g.rageT = 24000; setRage(false); }
        else { g.rage = 1; g.rageT = 7000; setRage(true); g.shake = 22; sfx.hit(); haptic("heavy"); }
      }

      /* игрок */
      const inp = inputRef.current;
      let target = g.px;
      if (inp.touchX !== null) target = inp.touchX;
      else if (inp.left) target = Math.max(0.06, g.px - 0.05);
      else if (inp.right) target = Math.min(0.94, g.px + 0.05);
      g.ptx = Math.max(0.06, Math.min(0.94, target));
      // Плавное ведение: критически задемпфированная пружина с подшагами.
      // Не колеблется и не перелетает даже на рваном кадре.
      const st = heroStep(g.px, g.pv, g.ptx, dt);
      g.px = Math.max(0.05, Math.min(0.95, st.px));
      // Скорость нужна для наклона корпуса; храним «за кадр», как раньше,
      // чтобы наклон не зависел от частоты обновления.
      g.pv = st.pv;
      g.lean = Math.max(-1, Math.min(1, st.pv * 0.55));

      /* спавн снарядов */
      g.spawnT -= sdt;
      const spawnInt = Math.max(230, diff.spawn / (1 + g.elapsed * 0.00007)) / (g.rage > 0 ? 1.8 : 1);
      if (g.spawnT <= 0) {
        g.spawnT = spawnInt * (0.75 + Math.random() * 0.5);
        g.cheeks = 1;
        g.mouth = 1;
        sfx.spit();
        const roll = Math.random();
        const t = Math.min(1, g.elapsed / 60000);
        let type: PType = "burger";
        if (roll > 0.94 - t * 0.1) type = "shake";
        else if (roll > 0.84 - t * 0.14) type = "nugget";
        else if (roll > 0.7 - t * 0.16) type = "fries";
        else if (roll > 0.48 - t * 0.1) type = "cheese";

        const hx = W * 0.5 + g.headX;
        const my = headCy + headR * 0.5;
        // Куда целится: рядом с игроком, но с промахом — иначе снаряды
        // всегда летели бы точно в лоб и уклоняться было бы нечем.
        const aim = g.px * W + (Math.random() - 0.5) * W * 0.5;
        const dirx = (aim - hx) / dropDist;

        if (type === "nugget") {
          // веер: середина в игрока, края в стороны
          for (let i = -2; i <= 2; i++) {
            g.projs.push({
              x: hx, y: my,
              vx: dirx * vy0 + i * spread * 0.34,
              vy: vy0 * (0.97 + Math.random() * 0.06),
              r: heroR * 0.42,
              type: "nugget", rot: 0, vr: (Math.random() - 0.5) * 0.02, scored: false, g: gNow,
            });
          }
        } else if (type === "fries") {
          // фри летят изо рта веером, а не появляются из воздуха сбоку
          for (let i = -1; i <= 1; i++) {
            g.projs.push({
              x: hx, y: my,
              vx: dirx * vy0 + i * spread * 0.22,
              vy: vy0 * (0.97 + Math.random() * 0.06),
              r: heroR * 0.34, type: "fries", rot: Math.random() * 6,
              vr: (Math.random() - 0.5) * 0.03, scored: false, g: gNow,
            });
          }
        } else {
          // Разница между видами еды — только во внешности и очках.
          // Скорость у всех одна: иначе чизбургер снова стал бы
          // «неуловимым», как жаловался пользователь.
          g.projs.push({
            x: hx, y: my,
            vx: dirx * vy0,
            vy: vy0 * (0.97 + Math.random() * 0.06),
            r: type === "shake" ? heroR * 0.72 : heroR * 0.62,
            type, rot: 0, vr: (Math.random() - 0.5) * 0.016, scored: false, g: gNow,
          });
        }
      }

      /* бонусы */
      g.bonusT -= sdt;
      const bonusChance = 1 + 0.12 * (s.skills.magnet || 0);
      if (g.bonusT <= 0) {
        g.bonusT = (10000 + Math.random() * 8000) / bonusChance;
        const types: BType[] = ["shield", "slow", "magnet", "x2", "heal"];
        const type = types[Math.floor(Math.random() * (g.lives < 3 ? 5 : 4))];
        // Бонус спускается на парашюте: медленно и с покачиванием,
        // чтобы его успевали заметить и добежать. Скорость своя, к
        // темпу еды не привязана — иначе аирдроп «проваливался» бы.
        g.bonuses.push({
          x: 0.12 + Math.random() * 0.76,
          y: -0.08,
          vy: PARA_FALL,
          type,
          t: 0,
          sway: Math.random() * Math.PI * 2,
        });
      }

      /* обновление снарядов */
      const hy = groundY - heroR;
      for (let i = g.projs.length - 1; i >= 0; i--) {
        const p = g.projs[i];
        p.x += p.vx * sdt;
        p.y += p.vy * sdt;
        p.vy += p.g * sdt;
        p.rot += p.vr * sdt;
        if (p.x < p.r || p.x > W - p.r) p.vx *= -0.86;

        const dx = p.x - g.px * W;
        const dy = p.y - hy;
        const hitR = p.r + heroR * 0.72;
        if (g.invuln <= 0 && dx * dx + dy * dy < hitR * hitR) {
          if (g.shield > 0) {
            g.shield = 0;
            setUiBuffs((b) => ({ ...b, shield: 0 }));
            burst(g, p.x, p.y, "#8fd0ff", 22);
            sfx.power();
            haptic("medium");
          } else {
            g.lives -= 1;
            g.invuln = 1300;
            g.comboStreak = 0;
            setUiLives(g.lives);
            g.shake = 26;
            g.flash = 1;
            burst(g, p.x, p.y, "#ff5a3c", 30);
            g.pops.push({ x: p.x, y: p.y, txt: "-1 ЖИЗНЬ", life: 900, c: "#ff5a3c" });
            sfx.hit();
            haptic("heavy");
            if (g.lives <= 0) { end(); return; }
          }
          g.projs.splice(i, 1);
          continue;
        }

        if (!p.scored && p.y > hy + heroR) {
          p.scored = true;
          g.dodged++;
          g.comboStreak++;
          const mult = (g.x2 > 0 ? 2 : 1) * (g.rage > 0 ? 1.5 : 1);
          const pts = (p.type === "shake" ? 3 : p.type === "cheese" ? 2 : 1) * mult;
          g.score += pts;
          setUiScore(Math.floor(g.score));
          if (g.comboStreak > 0 && g.comboStreak % 25 === 0) {
            g.pops.push({ x: g.px * W, y: hy - heroR * 2, txt: `${g.comboStreak} ПОДРЯД!`, life: 1100, c: "#ffb020" });
            sfx.crit();
          }
          sfx.dodge();
        }
        if (p.y > H + 60) g.projs.splice(i, 1);
      }

      /* бонусы движение */
      for (let i = g.bonuses.length - 1; i >= 0; i--) {
        const b = g.bonuses[i];
        b.t += sdt;
        b.y += b.vy * sdt * 0.0055;
        if (g.magnet > 0) b.x += (g.px - b.x) * 0.02;
        // Покачивание на стропах — только визуальное смещение, на
        // попадание не влияет, иначе бонус было бы не поймать.
        const swayX = Math.sin(b.sway + b.t * 0.0016) * W * 0.035;
        const bx = b.x * W + swayX;
        const by = b.y * H;
        const dx = bx - g.px * W;
        const dy = by - hy;
        if (dx * dx + dy * dy < (heroR * 2.1) ** 2) {
          applyBonus(g, b.type, setUiBuffs, setUiLives);
          burst(g, bx, by, "#ffb020", 20);
          g.pops.push({ x: bx, y: by, txt: BONUS_LABEL[b.type], life: 1000, c: "#ffb020" });
          sfx.power();
          haptic("success");
          g.bonuses.splice(i, 1);
          continue;
        }
        if (b.y > 1.1) g.bonuses.splice(i, 1);
      }

      /* таймеры */
      g.invuln = Math.max(0, g.invuln - dt);
      const dec = (v: number) => Math.max(0, v - dt);
      const prev = { shield: g.shield, slow: g.slow, magnet: g.magnet, x2: g.x2 };
      g.shield = dec(g.shield); g.slow = dec(g.slow); g.magnet = dec(g.magnet); g.x2 = dec(g.x2);
      if (
        Math.floor(prev.shield / 500) !== Math.floor(g.shield / 500) ||
        Math.floor(prev.slow / 500) !== Math.floor(g.slow / 500) ||
        Math.floor(prev.magnet / 500) !== Math.floor(g.magnet / 500) ||
        Math.floor(prev.x2 / 500) !== Math.floor(g.x2 / 500)
      ) {
        setUiBuffs({ shield: g.shield, slow: g.slow, magnet: g.magnet, x2: g.x2 });
      }
    }

    /* анимации головы */
    g.mouth += (0 - g.mouth) * 0.012 * dt;
    g.cheeks += (0 - g.cheeks) * 0.006 * dt;
    g.blinkT -= dt;
    if (g.blinkT < 0) { g.blink = 1; if (g.blinkT < -160) { g.blink = 0; g.blinkT = 1600 + Math.random() * 3200; } }
    g.headX = Math.sin(G.current.elapsed * 0.0009) * W * 0.14;
    g.shake *= 0.9;
    g.flash *= 0.9;

    /* частицы / попапы */
    for (let i = g.parts.length - 1; i >= 0; i--) {
      const p = g.parts[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.0012 * dt; p.life -= dt;
      if (p.life <= 0) g.parts.splice(i, 1);
    }
    for (let i = g.pops.length - 1; i >= 0; i--) {
      g.pops[i].y -= 0.03 * dt;
      g.pops[i].life -= dt;
      if (g.pops[i].life <= 0) g.pops.splice(i, 1);
    }

    /* ================= РИСОВАНИЕ ================= */
    ctx.save();
    if (g.shake > 0.4) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

    // земля
    const gg = ctx.createLinearGradient(0, groundY - 40, 0, H);
    gg.addColorStop(0, "rgba(255,255,255,0)");
    gg.addColorStop(1, "rgba(255,255,255,0.09)");
    ctx.fillStyle = gg;
    ctx.fillRect(0, groundY - 40, W, H - groundY + 40);
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();

    // ГОЛОВА ДРУГА
    ctx.save();
    ctx.translate(g.headX, 0);
    if (mainFriend.photo && photoImg.current) {
      const ph = headR * 2.1;
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, headCy, headR * 1.05, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(photoImg.current, W / 2 - ph / 2, headCy - ph / 2, ph, ph);
      ctx.restore();
      ctx.strokeStyle = g.rage > 0 ? "rgba(255,70,50,0.9)" : "rgba(255,255,255,0.24)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(W / 2, headCy, headR * 1.05, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      drawHead(ctx, mainFriend.look, W / 2, headCy, headR, {
        mouth: g.mouth, blink: g.blink, cheeks: g.cheeks,
        angry: g.rage > 0 ? 0.9 : 0.15, tilt: Math.sin(g.elapsed * 0.0013) * 0.055,
      });
    }
    ctx.restore();

    // снаряды
    for (const p of g.projs) drawProj(ctx, p);

    // бонусы — на парашютах
    for (const b of g.bonuses) {
      const swayX = Math.sin(b.sway + b.t * 0.0016) * W * 0.035;
      drawBonus(ctx, b, b.x * W + swayX, b.y * H, heroR * 0.85);
    }

    // ГЕРОЙ
    const hx = g.px * W;
    const hyy = groundY - heroR;
    const blinkV = g.invuln > 0 && Math.floor(g.invuln / 90) % 2 === 0;
    if (!blinkV) drawHero(ctx, hx, hyy, heroR, skin, g.lean, g.shield > 0, heroFriend.look);

    // тень
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    ctx.beginPath();
    ctx.ellipse(hx, groundY + 4, heroR * 0.9, heroR * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // частицы
    for (const p of g.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // попапы
    ctx.textAlign = "center";
    ctx.font = "800 15px Inter, system-ui, sans-serif";
    for (const p of g.pops) {
      ctx.globalAlpha = Math.min(1, p.life / 400);
      ctx.fillStyle = p.c;
      ctx.fillText(p.txt, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // вспышка урона
    if (g.flash > 0.02) {
      ctx.fillStyle = `rgba(255,60,40,${g.flash * 0.3})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (g.rage > 0) {
      ctx.strokeStyle = `rgba(255,60,40,${0.25 + Math.sin(g.elapsed * 0.01) * 0.15})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, W - 6, H - 6);
    }
  }, [mainFriend, skin, heroFriend, s.settings.difficulty]);

  const photoImg = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!mainFriend.photo) { photoImg.current = null; return; }
    const img = new Image();
    img.src = mainFriend.photo;
    img.onload = () => { photoImg.current = img; };
  }, [mainFriend.photo]);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: "var(--bg)" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div
        ref={surfRef}
        className="absolute inset-0 z-10"
        style={{ touchAction: "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={endTouch}
        onPointerCancel={endTouch}
      />

      <GameHUD
        score={uiScore}
        best={s.games.burger.best}
        onExit={onExit}
        extra={
          /* Жизни. Панель непрозрачная — сквозь стекло летели бургеры
             и сердечки было не разобрать. */
          <div
            className="shrink-0 flex items-center justify-center"
            style={{
              gap: 4, height: 40, padding: "0 11px",
              borderRadius: "var(--r-md)",
              background: "var(--surface-2)",
              border: "1px solid var(--btn-brd)",
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  lineHeight: 0,
                  color: i < uiLives ? "var(--danger)" : "var(--surface-3)",
                  transition: "color 0.2s",
                }}
              >
                <Icon name="heart" size={14} />
              </span>
            ))}
          </div>
        }
      />

      {/* активные бонусы */}
      <div className="absolute z-20 left-3 flex flex-col gap-1.5" style={{ top: "calc(var(--sat) + 74px)" }}>
        <AnimatePresence>
          {(["shield", "slow", "magnet", "x2"] as const).map((k) =>
            uiBuffs[k] > 0 ? (
              <motion.div
                key={k}
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -50, opacity: 0 }}
              >
                <div
                  className="flex items-center"
                  style={{
                    gap: 6, padding: "6px 9px",
                    borderRadius: "var(--r-sm)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--acc-line)",
                  }}
                >
                  <span style={{ color: "var(--acc-text)", lineHeight: 0 }}>
                    <Icon name={BONUS_ICON[k]} size={13} />
                  </span>
                  <span className="t-num" style={{ fontSize: 11 }}>
                    {(uiBuffs[k] / 1000).toFixed(1)}
                  </span>
                </div>
              </motion.div>
            ) : null,
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {rage && phase === "play" && (
          <motion.div
            initial={{ scale: 1.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute z-20 left-0 right-0 text-center pointer-events-none"
            style={{ top: "38%" }}
          >
            <div className="t-display" style={{ fontSize: 30, color: "#ff4a30", textShadow: "0 0 30px rgba(255,60,40,0.8)" }}>
              ЯРОСТЬ
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* подсказка управления */}
      <AnimatePresence>
        {phase === "play" && G.current.elapsed < 3500 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute left-0 right-0 z-20 text-center pointer-events-none"
            style={{ bottom: "22%" }}
          >
            <div className="t-label">◀ веди пальцем по экрану ▶</div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{phase === "count" && <Countdown n={cd} />}</AnimatePresence>

      {phase === "over" && (
        <GameOver
          score={result.score}
          best={s.games.burger.best}
          coins={result.coins}
          xp={result.xp}
          onRetry={start}
          onExit={onExit}
          title="СЪЕЛ"
          sub={`Уклонился от ${G.current.dodged} снарядов`}
          onRevive={
            hasAds() && !revivedRef.current
              ? () => setShowAd(true)
              : undefined
          }
        />
      )}

      <AnimatePresence>
        {showAd && (
          <AdModal
            reason="Вторая жизнь"
            onReward={() => {
              revivedRef.current = true;
              noteRevive();
            }}
            onClose={() => {
              setShowAd(false);
              // награда засчитана — продолжаем с того же счёта
              if (revivedRef.current) revive();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================= помощники ================= */

const BONUS_ICON: Record<BType, IconName> = {
  shield: "shield", slow: "clock", magnet: "magnet", x2: "sparkle", heal: "heart",
};
const BONUS_LABEL: Record<BType, string> = {
  shield: "ЩИТ", slow: "SLOW-MO", magnet: "МАГНИТ", x2: "×2 ОЧКИ", heal: "+1 ЖИЗНЬ",
};

function applyBonus(g: any, t: BType, setBuffs: any, setLives: any) {
  if (t === "shield") g.shield = 9000;
  if (t === "slow") g.slow = 5000;
  if (t === "magnet") g.magnet = 8000;
  if (t === "x2") g.x2 = 10000;
  if (t === "heal") { g.lives = Math.min(3, g.lives + 1); setLives(g.lives); }
  setBuffs({ shield: g.shield, slow: g.slow, magnet: g.magnet, x2: g.x2 });
}

function burst(g: any, x: number, y: number, c: string, n: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 0.06 + Math.random() * 0.28;
    g.parts.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.08,
      life: 400 + Math.random() * 400, max: 800, c, s: 1.4 + Math.random() * 3,
    });
  }
}

function drawProj(ctx: CanvasRenderingContext2D, p: Proj) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  const r = p.r;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  if (p.type === "shake") {
    ctx.fillStyle = "#f2eee6";
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r);
    ctx.lineTo(r * 0.6, -r);
    ctx.lineTo(r * 0.42, r);
    ctx.lineTo(-r * 0.42, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f7c9d8";
    ctx.beginPath();
    ctx.ellipse(0, -r, r * 0.62, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e05a7a";
    ctx.fillRect(-r * 0.1, -r * 1.9, r * 0.2, r * 0.95);
  } else if (p.type === "fries") {
    ctx.fillStyle = "#f5c542";
    ctx.beginPath();
    ctx.roundRect(-r * 0.24, -r, r * 0.48, r * 2, r * 0.16);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fillRect(-r * 0.24, -r * 0.2, r * 0.48, r * 0.2);
  } else if (p.type === "nugget") {
    ctx.fillStyle = "#e8a445";
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.4);
    ctx.quadraticCurveTo(-r * 0.2, -r * 1.2, r * 0.7, -r * 0.5);
    ctx.quadraticCurveTo(r * 1.2, r * 0.4, 0, r);
    ctx.quadraticCurveTo(-r * 1.1, r * 0.6, -r, -r * 0.4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.arc(-r * 0.2, -r * 0.3, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // бургер / чизбургер
    const dbl = p.type === "cheese";
    const bunTop = "#e0a55c";
    ctx.fillStyle = bunTop;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.42, r, r * 0.62, 0, Math.PI, 0);
    ctx.fill();
    // кунжут
    ctx.fillStyle = "rgba(255,246,220,0.85)";
    [[-0.45, -0.62], [0.1, -0.78], [0.5, -0.5]].forEach(([sx, sy]) => {
      ctx.beginPath();
      ctx.ellipse(sx * r, sy * r, r * 0.09, r * 0.055, 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
    // салат
    ctx.fillStyle = "#6dbf4a";
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.08);
    for (let i = 0; i <= 8; i++) {
      ctx.lineTo(-r + (i * 2 * r) / 8, -r * 0.08 + (i % 2 ? r * 0.16 : 0));
    }
    ctx.lineTo(r, r * 0.12);
    ctx.lineTo(-r, r * 0.12);
    ctx.fill();
    if (dbl) {
      ctx.fillStyle = "#f3b93c";
      ctx.beginPath();
      ctx.moveTo(-r * 1.02, r * 0.06);
      ctx.lineTo(r * 1.02, r * 0.06);
      ctx.lineTo(r * 0.7, r * 0.36);
      ctx.lineTo(-r * 0.7, r * 0.36);
      ctx.fill();
    }
    // котлета
    ctx.fillStyle = "#6b3a1f";
    ctx.beginPath();
    ctx.roundRect(-r * 0.96, r * (dbl ? 0.26 : 0.1), r * 1.92, r * 0.4, r * 0.18);
    ctx.fill();
    // низ
    ctx.fillStyle = "#cf9450";
    ctx.beginPath();
    ctx.roundRect(-r * 0.94, r * (dbl ? 0.62 : 0.46), r * 1.88, r * 0.42, r * 0.2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBonus(ctx: CanvasRenderingContext2D, b: Bonus, x: number, y: number, r: number) {
  ctx.save();
  ctx.translate(x, y);

  // Наклон всей связки по ходу качания — как настоящий парашют
  const tilt = Math.sin(b.sway + b.t * 0.0016) * 0.16;
  ctx.rotate(tilt);

  const domeR = r * 1.65;
  const domeY = -r * 3.1;

  /* ─── Купол ─── */
  const dome = ctx.createLinearGradient(0, domeY - domeR, 0, domeY + domeR * 0.3);
  dome.addColorStop(0, "#ffd98a");
  dome.addColorStop(1, "#e08a1e");
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.arc(0, domeY, domeR, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  // Дольки купола: без них это просто полукруг
  ctx.strokeStyle = "rgba(90,45,0,0.35)";
  ctx.lineWidth = Math.max(1, r * 0.07);
  for (let i = 1; i < 4; i++) {
    const a = Math.PI + (Math.PI * i) / 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * domeR, domeY + Math.sin(a) * domeR);
    ctx.lineTo(Math.cos(a) * domeR * 0.24, domeY);
    ctx.stroke();
  }
  // нижняя кромка
  ctx.strokeStyle = "rgba(60,30,0,0.45)";
  ctx.beginPath();
  ctx.moveTo(-domeR, domeY);
  ctx.lineTo(domeR, domeY);
  ctx.stroke();

  /* ─── Стропы ─── */
  ctx.strokeStyle = "rgba(240,240,246,0.7)";
  ctx.lineWidth = Math.max(0.9, r * 0.05);
  for (const sx of [-1, -0.4, 0.4, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * domeR * 0.94, domeY + 1);
    ctx.lineTo(sx * r * 0.62, -r);
    ctx.stroke();
  }

  /* ─── Ящик с бонусом ─── */
  const pulse = 1 + Math.sin(b.t * 0.006) * 0.05;
  ctx.save();
  ctx.scale(pulse, pulse);
  ctx.fillStyle = "#1b1b22";
  ctx.strokeStyle = "#ffb020";
  ctx.lineWidth = Math.max(1.8, r * 0.14);
  ctx.beginPath();
  ctx.roundRect(-r, -r, r * 2, r * 2, r * 0.3);
  ctx.fill();
  ctx.stroke();
  // подсветка, чтобы ящик читался на тёмном фоне
  ctx.shadowColor = "rgba(255,176,32,0.75)";
  ctx.shadowBlur = 16;
  ctx.stroke();
  ctx.shadowBlur = 0;
  drawBonusGlyph(ctx, b.type, r * 0.6);
  ctx.restore();

  ctx.restore();
}

/** Векторные символы бонусов — вместо эмодзи, чтобы вид был одинаковый везде */
function drawBonusGlyph(ctx: CanvasRenderingContext2D, type: BType, r: number) {
  ctx.strokeStyle = "#ffd88a";
  ctx.fillStyle = "#ffd88a";
  ctx.lineWidth = Math.max(1.6, r * 0.24);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  switch (type) {
    case "shield":
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.82, -r * 0.5);
      ctx.lineTo(r * 0.82, r * 0.16);
      ctx.quadraticCurveTo(r * 0.82, r * 0.86, 0, r);
      ctx.quadraticCurveTo(-r * 0.82, r * 0.86, -r * 0.82, r * 0.16);
      ctx.lineTo(-r * 0.82, -r * 0.5);
      ctx.closePath();
      ctx.stroke();
      break;
    case "slow":
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.45);
      ctx.lineTo(0, 0);
      ctx.lineTo(r * 0.42, r * 0.24);
      ctx.stroke();
      break;
    case "magnet":
      ctx.moveTo(-r * 0.66, r * 0.7);
      ctx.lineTo(-r * 0.66, -r * 0.16);
      ctx.arc(0, -r * 0.16, r * 0.66, Math.PI, 0);
      ctx.lineTo(r * 0.66, r * 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.66, r * 0.24);
      ctx.lineTo(-r * 0.2, r * 0.24);
      ctx.moveTo(r * 0.2, r * 0.24);
      ctx.lineTo(r * 0.66, r * 0.24);
      ctx.stroke();
      break;
    case "x2":
      ctx.moveTo(-r * 0.7, -r * 0.6);
      ctx.lineTo(r * 0.1, r * 0.24);
      ctx.moveTo(r * 0.1, -r * 0.6);
      ctx.lineTo(-r * 0.7, r * 0.24);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.3, -r * 0.3);
      ctx.quadraticCurveTo(r * 0.95, -r * 0.66, r * 0.95, -r * 0.05);
      ctx.lineTo(r * 0.32, r * 0.62);
      ctx.lineTo(r * 0.98, r * 0.62);
      ctx.stroke();
      break;
    case "heal":
      ctx.moveTo(0, r * 0.72);
      ctx.quadraticCurveTo(-r, r * 0.02, -r * 0.52, -r * 0.44);
      ctx.quadraticCurveTo(-r * 0.1, -r * 0.76, 0, -r * 0.28);
      ctx.quadraticCurveTo(r * 0.1, -r * 0.76, r * 0.52, -r * 0.44);
      ctx.quadraticCurveTo(r, r * 0.02, 0, r * 0.72);
      ctx.fill();
      break;
  }
}

function drawHero(
  ctx: CanvasRenderingContext2D, x: number, y: number, r: number,
  skin: (typeof HERO_SKINS)[number], vel: number, shield: boolean,
  look?: import("../core/types").FriendLook,
) {
  ctx.save();
  ctx.translate(x, y);
  // vel сюда приходит уже нормализованным (-1..1) и сглаженным пружиной,
  // поэтому наклон плавный, а не дёрганый, как при расчёте из «пикселей за кадр».
  const lean = Math.max(-0.3, Math.min(0.3, vel * 0.3));
  ctx.rotate(lean);

  if (shield) {
    ctx.strokeStyle = "rgba(143,208,255,0.85)";
    ctx.lineWidth = 2.6;
    ctx.shadowColor = "rgba(143,208,255,0.9)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.85, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ноги
  ctx.strokeStyle = skin.accentPart;
  ctx.lineWidth = r * 0.3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, r * 0.7);
  ctx.lineTo(-r * 0.44 - lean * r, r * 1.5);
  ctx.moveTo(r * 0.3, r * 0.7);
  ctx.lineTo(r * 0.44 - lean * r, r * 1.5);
  ctx.stroke();

  // тело
  const bg = ctx.createLinearGradient(0, -r, 0, r);
  bg.addColorStop(0, skin.body);
  bg.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(-r * 0.62, -r * 0.2, r * 1.24, r * 1.1, r * 0.4);
  ctx.fill();

  // руки
  ctx.strokeStyle = skin.body;
  ctx.lineWidth = r * 0.24;
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, r * 0.05);
  ctx.lineTo(-r * 1.05 + lean * r * 0.6, r * 0.55);
  ctx.moveTo(r * 0.6, r * 0.05);
  ctx.lineTo(r * 1.05 + lean * r * 0.6, r * 0.55);
  ctx.stroke();

  // голова: настоящее лицо игрока, если оно есть
  if (look) {
    drawHead(ctx, look, 0, -r * 0.82, r * 0.62, { mouth: 0.12 });
  } else {
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.arc(0, -r * 0.72, r * 0.56, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0d0d12";
    ctx.beginPath();
    ctx.arc(-r * 0.2, -r * 0.78, r * 0.09, 0, Math.PI * 2);
    ctx.arc(r * 0.2, -r * 0.78, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }

  // шляпы
  ctx.fillStyle = skin.accentPart;
  if (skin.hat === 1) {
    ctx.beginPath();
    ctx.ellipse(0, -r * 1.26, r * 0.6, r * 0.34, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 1.22, r * 0.74, r * 0.1, 0, Math.PI, 0);
    ctx.fill();
  } else if (skin.hat === 2) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.54, -r * 1.3);
    ctx.lineTo(-r * 0.38, -r * 1.78);
    ctx.lineTo(-r * 0.17, -r * 1.44);
    ctx.lineTo(0, -r * 1.88);
    ctx.lineTo(r * 0.17, -r * 1.44);
    ctx.lineTo(r * 0.38, -r * 1.78);
    ctx.lineTo(r * 0.54, -r * 1.3);
    ctx.closePath();
    ctx.fill();
  } else if (skin.hat === 3) {
    ctx.fillRect(-r * 0.42, -r * 2.04, r * 0.84, r * 0.74);
    ctx.beginPath();
    ctx.ellipse(0, -r * 1.3, r * 0.82, r * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (skin.hat === 4) {
    ctx.strokeStyle = skin.accentPart;
    ctx.lineWidth = r * 0.13;
    ctx.shadowColor = skin.accentPart;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(0, -r * 1.66, r * 0.48, r * 0.14, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}
