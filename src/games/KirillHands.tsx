import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { useCanvas, GameHUD, GameOver, Countdown, HudStat } from "./shell";
import { tr } from "../core/i18n";

/**
 * КИРИЛЛ ХУДОЙ — лезет в портфель, а ты бьёшь по рукам.
 *
 * Из-за краёв экрана тянутся руки к твоему портфелю в центре. Бьёшь по
 * руке тапом — она отдёргивается. Дотянулась до сумки — утащила вещь.
 * Потерял все вещи — конец.
 *
 * Ловушка: иногда тянется твоя собственная рука (светлая, со шнурком на
 * запястье) — по ней бить нельзя, это штраф. Приходится смотреть, а не
 * долбить по всему подряд.
 */

interface Hand {
  side: -1 | 1;      // откуда лезет
  y: number;
  reach: number;     // 0..1 насколько дотянулась
  speed: number;
  mine: boolean;     // своя рука — не бить
  slap: number;      // анимация отдёргивания
  dead: boolean;
  /**
   * Что делает рука прямо сейчас.
   *
   * Раньше рука доходила до сумки, вещь молча списывалась, а рука
   * просто исчезала — со стороны казалось, что руки «стоят и мешают».
   * Теперь у кражи три фазы: тянется, хватает вещь (короткая пауза с
   * рывком) и уносит её обратно за край экрана вместе с добычей.
   */
  state: "reach" | "grab" | "carry";
  /** сколько осталось держать паузу захвата, мс */
  grabT: number;
  /** какую вещь утащила — рисуем её в кулаке */
  loot: string | null;
  /**
   * Кто тянется и за чем.
   *
   * Жалоба: «непонятно кто и что ворует». Теперь у каждой руки есть имя
   * владельца и цель, выбранные ЗАРАНЕЕ, и подпись видна, пока рука
   * ползёт к портфелю — успеваешь понять, свою бьёшь или чужую.
   */
  who: string;
  target: string;
}

const ITEMS = ["ТЕЛЕФОН", "КОШЕЛЁК", "НАУШНИКИ", "ЗАРЯДКА", "ТЕТРАДЬ", "КЛЮЧИ"];
/** Кому принадлежат чужие руки — подписываем, чтобы было ясно, кто ворует */
const THIEVES = ["КИРИЛЛ", "СТАС", "РОМА", "АНТОН", "КУДРЯ", "СЕРЁГА"];
/** Пауза захвата: последний шанс успеть ударить по руке */
const GRAB_MS = 420;

export default function KirillHands({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [cd, setCd] = useState(3);
  const [items, setItems] = useState(ITEMS.length);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const best = s.games.hands?.best || 0;

  const G = useRef({
    running: false,
    hands: [] as Hand[],
    items: ITEMS.length,
    score: 0,
    combo: 0,
    spawnT: 900,
    elapsed: 0,
    startT: 0,
    shake: 0,
    bagPulse: 0,
    pops: [] as { x: number; y: number; t: number; txt: string; col: string }[],
    w: 0, h: 0,
  });

  const reset = useCallback(() => {
    const g = G.current;
    g.hands = []; g.items = ITEMS.length; g.score = 0; g.combo = 0;
    g.spawnT = 900; g.elapsed = 0; g.shake = 0; g.bagPulse = 0; g.pops = [];
    g.startT = Date.now();
    setItems(ITEMS.length); setScore(0); setCombo(0);
  }, []);

  const restart = useCallback(() => {
    G.current.running = false;
    setPhase("count");
    setCd(3);
  }, []);

  useEffect(() => {
    if (phase !== "count") return;
    if (cd < 0) { reset(); G.current.running = true; setPhase("play"); return; }
    sfx.click();
    const t = setTimeout(() => setCd((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, cd, reset]);

  const end = useCallback(() => {
    const g = G.current;
    if (!g.running) return;
    g.running = false;
    const sc = Math.floor(g.score);
    const coins = Math.floor(sc * 3.8 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 0.7 + 20);
    setResult({ score: sc, coins, xp });
    setPhase("over");
    sfx.gameOver();
    haptic("error");
    addCoins(coins);
    addXp(xp);
    finishGame("hands", sc, Date.now() - g.startT);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  /** Координата кисти руки на экране */
  const handTip = (hnd: Hand, w: number, h: number) => {
    const bagX = w / 2;
    const fromX = hnd.side < 0 ? -30 : w + 30;
    const x = fromX + (bagX - fromX) * hnd.reach;
    const y = hnd.y + (h * 0.52 - hnd.y) * hnd.reach * 0.65;
    return { x, y };
  };

  const onTap = useCallback((e: React.PointerEvent) => {
    const g = G.current;
    if (!g.running) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;

    let hit = false;
    for (const hnd of g.hands) {
      if (hnd.dead || hnd.slap > 0) continue;
      const tip = handTip(hnd, g.w, g.h);
      if (Math.hypot(tip.x - x, tip.y - y) < 44) {
        hit = true;
        if (hnd.mine) {
          // своя рука — штраф
          hnd.slap = 300;
          hnd.state = "carry";   // отдёрнулась и уходит
          g.combo = 0;
          g.score = Math.max(0, g.score - 60);
          g.shake = 12;
          setCombo(0);
          setScore(Math.floor(g.score));
          sfx.error();
          haptic("error");
          g.pops.push({ x: tip.x, y: tip.y - 22, t: 1, txt: tr("СВОЯ РУКА!"), col: "var(--danger)" });
        } else {
          hnd.slap = 320;
          hnd.state = "carry";   // получила по рукам и убирается ни с чем
          g.combo += 1;
          const bonus = 25 + Math.min(g.combo, 10) * 6;
          g.score += bonus;
          setCombo(g.combo);
          setScore(Math.floor(g.score));
          sfx.crit();
          haptic("medium");
          g.pops.push({
            x: tip.x, y: tip.y - 22, t: 1,
            txt: `+${bonus}`,
            col: g.combo > 4 ? "#FFD86B" : "var(--ok)",
          });
        }
        break;
      }
    }
    if (!hit) {
      g.combo = 0;
      setCombo(0);
    }
  }, []);

  const canvasRef = useCanvas((ctx, w, h, dt) => {
    const g = G.current;
    g.w = w; g.h = h;

    if (g.running) {
      g.elapsed += dt;
      // темп растёт: к концу руки лезут пачками
      const ramp = 1 + g.elapsed / 26000;
      g.spawnT -= dt * ramp;
      if (g.spawnT <= 0) {
        g.spawnT = 620 + Math.random() * 520;
        const mine = Math.random() < 0.18;
        const target = ITEMS[Math.floor(Math.random() * ITEMS.length)];
        g.hands.push({
          who: mine ? "ТВОЯ РУКА" : THIEVES[Math.floor(Math.random() * THIEVES.length)],
          target,
          side: Math.random() < 0.5 ? -1 : 1,
          y: h * 0.24 + Math.random() * h * 0.42,
          reach: 0,
          speed: (0.00019 + Math.random() * 0.00016) * ramp,
          mine,
          slap: 0,
          dead: false,
          state: "reach",
          grabT: 0,
          loot: null,
        });
      }

      for (const hnd of g.hands) {
        if (hnd.slap > 0) {
          hnd.slap -= dt;
          hnd.reach = Math.max(0, hnd.reach - dt * 0.004);
          if (hnd.slap <= 0 && hnd.reach <= 0.02) hnd.dead = true;
          continue;
        }

        if (hnd.state === "reach") {
          hnd.reach += hnd.speed * dt;
          if (hnd.reach >= 1) {
            hnd.reach = 1;
            if (hnd.mine) { hnd.state = "carry"; hnd.loot = null; continue; }
            // хватает вещь: короткая пауза, за которую ещё можно ударить
            hnd.state = "grab";
            hnd.grabT = GRAB_MS;
            g.bagPulse = 1;
            sfx.tap();
          }
          continue;
        }

        if (hnd.state === "grab") {
          hnd.grabT -= dt;
          if (hnd.grabT <= 0) {
            // вещь ушла — теперь рука уносит её
            hnd.state = "carry";
            hnd.loot = hnd.target || "ВЕЩЬ";
            g.items -= 1;
            g.combo = 0;
            setCombo(0);
            setItems(g.items);
            g.shake = 16;
            sfx.hit();
            haptic("error");
            g.pops.push({
              x: w / 2, y: h * 0.52 - 40, t: 1,
              txt: `−${tr(hnd.loot)}`,
              col: "var(--danger)",
            });
            if (g.items <= 0) { end(); return; }
          }
          continue;
        }

        // carry: уползает обратно вместе с добычей
        hnd.reach -= hnd.speed * dt * 1.5;
        if (hnd.reach <= 0) hnd.dead = true;
      }
      g.hands = g.hands.filter((x) => !x.dead);
      if (!g.running) return;
    }

    for (const p of g.pops) p.t -= dt * 0.0013;
    g.pops = g.pops.filter((p) => p.t > 0);
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 0.03);
    if (g.bagPulse > 0) g.bagPulse = Math.max(0, g.bagPulse - dt * 0.002);

    /* ---------- отрисовка ---------- */
    ctx.fillStyle = "#101318";
    ctx.fillRect(0, 0, w, h);
    // парта
    ctx.fillStyle = "#1a1f27";
    ctx.fillRect(0, h * 0.32, w, h * 0.68);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let y = h * 0.36; y < h; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

    const bagX = w / 2, bagY = h * 0.52;

    /*
     * Голова Кирилла сверху УБРАНА (жалоба: «голова улетела и не нужна
     * сверху»). Она висела в воздухе без тела на h*0.15 и выглядела как
     * оторванная. Сцена теперь читается сама: твой портфель в центре,
     * чужие руки лезут к нему с боков.
     */

    // портфель
    const bp = 1 + g.bagPulse * 0.06;
    ctx.save();
    ctx.translate(bagX, bagY);
    ctx.scale(bp, bp);
    ctx.fillStyle = g.bagPulse > 0 ? "#5a3a34" : "#43342c";
    ctx.beginPath(); ctx.roundRect(-62, -46, 124, 96, 14); ctx.fill();
    ctx.fillStyle = "#33261f";
    ctx.beginPath(); ctx.roundRect(-62, -46, 124, 30, 12); ctx.fill();
    // лямки
    ctx.strokeStyle = "#33261f";
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(0, -46, 34, Math.PI, 0); ctx.stroke();
    // замок
    ctx.fillStyle = "#c8a26a";
    ctx.beginPath(); ctx.roundRect(-11, -6, 22, 15, 4); ctx.fill();
    ctx.restore();

    // вещи-точки на портфеле
    for (let i = 0; i < ITEMS.length; i++) {
      const alive = i < g.items;
      ctx.fillStyle = alive ? "#FFD86B" : "rgba(255,255,255,0.12)";
      ctx.beginPath();
      ctx.arc(bagX - 44 + i * 18, bagY + 62, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // руки
    for (const hnd of g.hands) {
      const tip = handTip(hnd, w, h);
      const fromX = hnd.side < 0 ? -20 : w + 20;
      const skin = hnd.mine ? "#f0c9a4" : "#d9a87f";

      /*
       * РУКА, А НЕ НОГА.
       *
       * Жалоба: «руки похожи на ноги». Раньше это была одна дуга
       * постоянной толщины 17 px с шариком на конце — ровно силуэт
       * ноги со ступнёй. Теперь рисуем анатомию: плечо толще,
       * предплечье тоньше, между ними ЛОКОТЬ с изломом, дальше
       * запястье и уже потом кисть с пальцами.
       */
      const dir = hnd.side < 0 ? 1 : -1;
      // локоть — точка излома между плечом и кистью
      const ex = fromX + (tip.x - fromX) * 0.46;
      const ey = hnd.y + (tip.y - hnd.y) * 0.3 - 16;
      // запястье чуть не доходит до кисти
      const wxp = tip.x - dir * 12;
      const wyp = tip.y - (tip.y - ey) * 0.12;

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // плечо: от края экрана до локтя, толстое
      ctx.strokeStyle = skin;
      ctx.lineWidth = 19;
      ctx.beginPath();
      ctx.moveTo(fromX, hnd.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // предплечье: от локтя к запястью, заметно тоньше — так рука
      // перестаёт читаться как ровная нога
      ctx.lineWidth = 13.5;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(wxp, wyp);
      ctx.stroke();

      // тень на сгибе локтя — подчёркивает, что это сустав
      ctx.strokeStyle = hnd.mine ? "rgba(0,0,0,0.16)" : "rgba(0,0,0,0.22)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ex, ey, 8, 0.4, 2.6);
      ctx.stroke();

      // рукав на плече
      ctx.strokeStyle = hnd.mine ? "#3a4a5e" : "#2e3a2c";
      ctx.lineWidth = 23;
      ctx.beginPath();
      ctx.moveTo(fromX + hnd.side * -50, hnd.y - 4);
      ctx.lineTo(fromX + (ex - fromX) * 0.32, hnd.y + (ey - hnd.y) * 0.32);
      ctx.stroke();
      // манжет
      ctx.strokeStyle = hnd.mine ? "#4a5e75" : "#3c4a38";
      ctx.lineWidth = 25;
      ctx.beginPath();
      ctx.moveTo(fromX + (ex - fromX) * 0.26, hnd.y + (ey - hnd.y) * 0.26);
      ctx.lineTo(fromX + (ex - fromX) * 0.34, hnd.y + (ey - hnd.y) * 0.34);
      ctx.stroke();

      // ЛАДОНЬ: не круг, а вытянутая кисть поперёк направления
      ctx.save();
      ctx.translate(tip.x, tip.y);
      ctx.rotate(Math.atan2(tip.y - wyp, tip.x - wxp));
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.roundRect(-4, -11, 17, 22, 7);
      ctx.fill();
      ctx.restore();

      // пальцы веером от ладони
      for (let f = 0; f < 4; f++) {
        const a = -0.62 + f * 0.4;
        ctx.strokeStyle = skin;
        ctx.lineWidth = 4.8 - f * 0.35;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tip.x + dir * 4, tip.y + Math.sin(a) * 6);
        ctx.lineTo(tip.x + dir * (4 + Math.cos(a) * 16), tip.y + Math.sin(a) * 17);
        ctx.stroke();
      }
      // большой палец — отдельно и в другую сторону, это ключевой признак руки
      ctx.lineWidth = 5.8;
      ctx.beginPath();
      ctx.moveTo(tip.x - dir * 2, tip.y - 4);
      ctx.lineTo(tip.x + dir * 9, tip.y - 15);
      ctx.stroke();

      /*
       * ПОДПИСЬ: кто тянется и за чем. Висит у самого края экрана,
       * рядом с плечом — не перекрывает портфель и не пляшет вместе
       * с кистью.
       */
      {
        const lblX = hnd.side < 0 ? 8 : w - 8;
        ctx.save();
        ctx.textAlign = hnd.side < 0 ? "left" : "right";
        ctx.font = "800 9.5px Unbounded, Inter, system-ui, sans-serif";
        ctx.fillStyle = hnd.mine ? "#59FF9E" : "#ff9a80";
        ctx.fillText(tr(hnd.who), lblX, hnd.y - 26);
        if (!hnd.mine) {
          ctx.font = "600 9px Inter, system-ui, sans-serif";
          ctx.fillStyle = "rgba(255,255,255,0.72)";
          ctx.fillText(`${tr("тянется за")}: ${tr(hnd.target)}`, lblX, hnd.y - 14);
        } else {
          ctx.font = "600 9px Inter, system-ui, sans-serif";
          ctx.fillStyle = "rgba(89,255,158,0.8)";
          ctx.fillText(tr("не бей"), lblX, hnd.y - 14);
        }
        ctx.restore();
      }

      // своя рука помечена шнурком на запястье
      if (hnd.mine) {
        ctx.strokeStyle = "#59FF9E";
        ctx.lineWidth = 4;
        const wx = tip.x - dir * 20, wy = tip.y - 3;
        ctx.beginPath();
        ctx.moveTo(wx, wy - 9); ctx.lineTo(wx, wy + 9);
        ctx.stroke();
      }
    }

    ctx.restore();

    ctx.textAlign = "center";
    for (const p of g.pops) {
      ctx.globalAlpha = Math.min(1, p.t * 1.6);
      ctx.fillStyle = p.col;
      ctx.font = "800 16px Unbounded, Inter, system-ui, sans-serif";
      ctx.fillText(p.txt, p.x, p.y - (1 - p.t) * 28);
    }
    ctx.globalAlpha = 1;

    /*
     * Подсказка внизу убрана: она сидела в 22 px от края, на полоске
     * жестов. Кто есть кто теперь подписано у самих рук.
     */
  }, [phase]);

  return (
    <div className="absolute inset-0" style={{ background: "var(--bg)" }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onPointerDown={(e) => { e.preventDefault(); onTap(e); }}
        style={{ touchAction: "none" }}
      />

      <GameHUD
        score={score}
        best={best}
        onExit={onExit}
        extra={
          <>
            {combo > 1 && <HudStat label={tr("СЕРИЯ")} value={`×${combo}`} tone="warn" min={44} />}
            <HudStat
              label={tr("ОСТАЛОСЬ")}
              value={`${items}/${ITEMS.length}`}
              tone={items <= 2 ? "danger" : "plain"}
              min={50}
            />
          </>
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
          title={tr("ОБНЕСЛИ")}
          sub={tr("Кирилл унёс всё до последнего")}
        />
      )}
    </div>
  );
}
