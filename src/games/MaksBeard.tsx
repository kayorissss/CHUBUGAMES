import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { useCanvas, GameHUD, GameOver, Countdown, HudGauge, HudStat } from "./shell";
import { drawHead } from "../core/head";
import { tr } from "../core/i18n";

/**
 * ОЩИПАТЬ МАКСА — выщипать всё до чистоты: борода, грудь, руки.
 *
 * Тянешь волосок пальцем и отпускаешь — вырывается. Но Макс терпит не
 * молча: если дёргать слишком часто подряд, он звереет и бьёт по руке.
 * Между рывками надо выдерживать паузу, а красные волоски (вросшие)
 * требуют более длинной оттяжки.
 *
 * Зоны идут по очереди: лицо -> грудь -> руки. Каждая следующая гуще.
 */

interface Hair {
  x: number; y: number;
  len: number;
  ang: number;
  tough: boolean;    // жёсткий: тянуть дальше
  pulled: number;    // 0..1 насколько оттянут
  gone: boolean;
}

const ZONES = [
  { name: "БОРОДА", count: 22, rage: 1.0 },
  { name: "ГРУДЬ", count: 28, rage: 1.25 },
  { name: "РУКИ", count: 34, rage: 1.55 },
];

const PULL_OK = 46;       // на сколько px оттянуть обычный волосок
const PULL_TOUGH = 78;
const RAGE_MAX = 100;

export default function MaksBeard({ onExit }: { onExit: () => void }) {
  const { s, addCoins, addXp, finishGame, questProgress } = useGame();
  const [phase, setPhase] = useState<"count" | "play" | "over">("count");
  const [cd, setCd] = useState(3);
  const [zone, setZone] = useState(0);
  const [left, setLeft] = useState(ZONES[0].count);
  const [rage, setRage] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState({ score: 0, coins: 0, xp: 0 });

  const best = s.games.beard?.best || 0;
  const maks = s.friends.find((f) => f.id === "maks") || s.friends[0];

  const G = useRef({
    hairs: [] as Hair[],
    grabbed: -1,
    hover: false,   // палец на экране — показываем лупу
    px: 0, py: 0,
    running: false,
    zone: 0,
    rage: 0,
    score: 0,
    startT: 0,
    lastPull: 0,
    shake: 0,
    pops: [] as { x: number; y: number; t: number; txt: string; col: string }[],
    w: 0, h: 0,
    faceY: 0,
  });

  /** Разложить волоски по текущей зоне */
  const spawnZone = useCallback((w: number, h: number, zi: number) => {
    const g = G.current;
    const z = ZONES[zi];
    const arr: Hair[] = [];
    const cx = w / 2;
    const faceY = h * 0.32;
    g.faceY = faceY;
    for (let i = 0; i < z.count; i++) {
      let x: number, y: number;
      if (zi === 0) {
        // борода: дуга под лицом
        const a = Math.PI * (0.15 + Math.random() * 0.7);
        const r = 52 + Math.random() * 22;
        x = cx - Math.cos(a) * r;
        y = faceY + 26 + Math.sin(a) * r * 0.62;
      } else if (zi === 1) {
        // грудь: прямоугольник ниже
        x = cx - 78 + Math.random() * 156;
        y = h * 0.55 + Math.random() * 96;
      } else {
        // руки: две полосы по бокам
        const side = Math.random() < 0.5 ? -1 : 1;
        x = cx + side * (96 + Math.random() * 46);
        y = h * 0.48 + Math.random() * 150;
      }
      arr.push({
        x, y,
        len: 13 + Math.random() * 13,
        ang: -Math.PI / 2 + (Math.random() - 0.5) * 1.5,
        tough: Math.random() < 0.24,
        pulled: 0,
        gone: false,
      });
    }
    g.hairs = arr;
  }, []);

  const reset = useCallback((w: number, h: number) => {
    const g = G.current;
    g.w = w; g.h = h;
    g.zone = 0; g.rage = 0; g.score = 0;
    g.grabbed = -1; g.shake = 0; g.pops = []; g.hover = false;
    g.lastPull = 0;
    g.startT = Date.now();
    spawnZone(w, h, 0);
    setZone(0); setLeft(ZONES[0].count); setRage(0); setScore(0);
  }, [spawnZone]);

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
    const sc = Math.floor(g.score + (won ? 900 : 0));
    const coins = Math.floor(sc * 4.8 * (1 + s.prestige * 0.12));
    const xp = Math.floor(sc * 0.75 + 20);
    setResult({ score: sc, coins, xp });
    setPhase("over");
    if (won) { sfx.legend(); haptic("success"); } else { sfx.gameOver(); haptic("error"); }
    addCoins(coins);
    addXp(xp);
    finishGame("beard", sc, Date.now() - g.startT);
    questProgress("plays", 1);
  }, [addCoins, addXp, finishGame, questProgress, s.prestige]);

  const onDown = useCallback((e: React.PointerEvent) => {
    const g = G.current;
    if (!g.running) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    g.px = x; g.py = y;
    g.hover = true;              // палец на экране — показываем лупу
    // берём ближайший волосок в радиусе пальца
    let bi = -1, bd = 30;
    g.hairs.forEach((hr, i) => {
      if (hr.gone) return;
      const d = Math.hypot(hr.x - x, hr.y - y);
      if (d < bd) { bd = d; bi = i; }
    });
    g.grabbed = bi;
    if (bi >= 0) { sfx.click(); haptic("light"); }
  }, []);

  const onMove = useCallback((e: React.PointerEvent) => {
    const g = G.current;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    g.px = e.clientX - r.left;
    g.py = e.clientY - r.top;
    // лупа едет за пальцем даже когда волосок ещё не схвачен —
    // так ей можно прицеливаться
    g.hover = true;
    if (g.grabbed < 0) return;
    const hr = g.hairs[g.grabbed];
    hr.pulled = Math.hypot(g.px - hr.x, g.py - hr.y);
  }, []);

  const onUp = useCallback(() => {
    const g = G.current;
    g.hover = false;
    if (g.grabbed < 0) return;
    const hr = g.hairs[g.grabbed];
    const need = hr.tough ? PULL_TOUGH : PULL_OK;
    g.grabbed = -1;

    if (hr.pulled >= need) {
      hr.gone = true;
      const now = Date.now();
      // Рвать без пауз нельзя: Макс звереет от частых рывков
      const gap = now - g.lastPull;
      g.lastPull = now;
      const zr = ZONES[g.zone].rage;
      if (gap < 420) {
        g.rage = Math.min(RAGE_MAX, g.rage + 15 * zr);
        g.shake = 12;
        sfx.hit();
        haptic("error");
        g.pops.push({ x: hr.x, y: hr.y - 18, t: 1, txt: tr("АЙ!"), col: "var(--danger)" });
      } else {
        g.rage = Math.max(0, g.rage - 3);
        sfx.crit();
        haptic("light");
        g.pops.push({
          x: hr.x, y: hr.y - 18, t: 1,
          txt: hr.tough ? "+30" : "+15",
          col: hr.tough ? "#FFD86B" : "var(--ok)",
        });
      }
      g.score += hr.tough ? 30 : 15;
      setScore(Math.floor(g.score));
      setRage(g.rage);

      const rest = g.hairs.filter((x) => !x.gone).length;
      setLeft(rest);

      if (g.rage >= RAGE_MAX) { end(false); return; }

      if (rest === 0) {
        if (g.zone >= ZONES.length - 1) { end(true); return; }
        g.zone += 1;
        setZone(g.zone);
        g.score += 300;
        setScore(Math.floor(g.score));
        spawnZone(g.w, g.h, g.zone);
        setLeft(ZONES[g.zone].count);
        g.pops.push({
          x: g.w / 2, y: g.h * 0.45, t: 1,
          txt: tr(ZONES[g.zone].name), col: "#FFD86B",
        });
        sfx.achieve();
        haptic("success");
      }
    } else {
      // недотянул — волосок спружинил, Макс дёрнулся
      hr.pulled = 0;
      g.rage = Math.min(RAGE_MAX, g.rage + 6);
      setRage(g.rage);
      sfx.error();
      haptic("light");
      if (g.rage >= RAGE_MAX) end(false);
    }
  }, [end, spawnZone]);

  const canvasRef = useCanvas((ctx, w, h, dt) => {
    const g = G.current;
    if (!g.hairs.length && !g.running) reset(w, h);
    g.w = w; g.h = h;

    if (g.running) {
      // ярость медленно спадает — можно отдышаться
      g.rage = Math.max(0, g.rage - dt * 0.0032);
    }
    for (const p of g.pops) p.t -= dt * 0.0013;
    g.pops = g.pops.filter((p) => p.t > 0);
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt * 0.03);

    /* фон */
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#14100e");
    grd.addColorStop(1, "#1d1714");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (g.shake > 0) ctx.translate((Math.random() - 0.5) * g.shake, (Math.random() - 0.5) * g.shake);

    const cx = w / 2;
    const faceY = g.faceY || h * 0.32;

    // тело: торс и руки, чтобы зоны читались
    ctx.fillStyle = "#e0b08a";
    ctx.beginPath();
    ctx.roundRect(cx - 86, faceY + 42, 172, h * 0.5, 26);
    ctx.fill();
    /*
     * Тело Макса.
     *
     * Раньше это были три скруглённых прямоугольника: две «палки» рук и
     * плита майки — пропорции не читались. Теперь торс рисуется одним
     * контуром с плечами, талией и грудью, руки идут от плеч с локтем
     * и кистью, а майка надета поверх торса, а не заменяет его.
     */
    const SKIN = "#d9a87f";
    const SKIN_DARK = "#c2916a";
    const shY = faceY + 62;              // линия плеч
    const shX = 82;                      // полуширина плеч
    const hipY = faceY + 150 + h * 0.5 - 108;

    // торс: плечи -> талия -> бёдра
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.moveTo(cx - shX, shY + 16);
    ctx.quadraticCurveTo(cx - shX - 6, shY, cx - shX * 0.62, shY - 8);
    ctx.quadraticCurveTo(cx, shY - 20, cx + shX * 0.62, shY - 8);
    ctx.quadraticCurveTo(cx + shX + 6, shY, cx + shX, shY + 16);
    ctx.quadraticCurveTo(cx + shX - 4, faceY + 150, cx + shX * 0.82, hipY);
    ctx.lineTo(cx - shX * 0.82, hipY);
    ctx.quadraticCurveTo(cx - shX + 4, faceY + 150, cx - shX, shY + 16);
    ctx.closePath();
    ctx.fill();

    // грудные мышцы — намёк линией, чтобы читался объём
    ctx.strokeStyle = SKIN_DARK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, shY + 24);
    ctx.lineTo(cx, shY + 74);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - 34, shY + 46, 30, -0.5, 1.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 34, shY + 46, 30, 2.0, 3.6);
    ctx.stroke();

    // руки: плечо -> локоть -> кисть
    for (const sx of [-1, 1]) {
      const p0 = { x: cx + sx * (shX - 6), y: shY + 6 };
      const p1 = { x: cx + sx * (shX + 26), y: shY + 96 };
      const p2 = { x: cx + sx * (shX + 18), y: shY + 186 };
      ctx.strokeStyle = SKIN;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 34;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      // кисть
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.arc(p2.x, p2.y + 12, 19, 0, Math.PI * 2); ctx.fill();
      // пальцы намёком
      ctx.strokeStyle = SKIN_DARK;
      ctx.lineWidth = 2;
      for (let f = -1; f <= 1; f++) {
        ctx.beginPath();
        ctx.moveTo(p2.x + f * 7, p2.y + 20);
        ctx.lineTo(p2.x + f * 8, p2.y + 30);
        ctx.stroke();
      }
    }

    // майка поверх торса
    ctx.fillStyle = "#33404e";
    ctx.beginPath();
    ctx.moveTo(cx - shX + 2, shY + 96);
    ctx.lineTo(cx + shX - 2, shY + 96);
    ctx.quadraticCurveTo(cx + shX - 4, faceY + 150, cx + shX * 0.82, hipY);
    ctx.lineTo(cx - shX * 0.82, hipY);
    ctx.quadraticCurveTo(cx - shX + 4, faceY + 150, cx - shX + 2, shY + 96);
    ctx.closePath();
    ctx.fill();
    // лямки
    ctx.strokeStyle = "#33404e";
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.moveTo(cx - 40, shY + 96); ctx.lineTo(cx - 30, shY + 8);
    ctx.moveTo(cx + 40, shY + 96); ctx.lineTo(cx + 30, shY + 8);
    ctx.stroke();

    // голова Макса
    const angry = g.rage / RAGE_MAX;
    drawHead(ctx, maks.look, cx, faceY, 56, {
      body: false,
      angry,
      mouth: angry * 0.8,
      squish: g.shake > 0 ? 0.25 : 0,
    });

    // волоски (та же процедура переиспользуется внутри лупы)
    const drawHairs = () => {
    for (let i = 0; i < g.hairs.length; i++) {
      const hr = g.hairs[i];
      if (hr.gone) continue;
      const held = i === g.grabbed;
      const tx = held ? g.px : hr.x + Math.cos(hr.ang) * hr.len;
      const ty = held ? g.py : hr.y + Math.sin(hr.ang) * hr.len;
      const need = hr.tough ? PULL_TOUGH : PULL_OK;
      const ready = held && hr.pulled >= need;

      ctx.strokeStyle = ready ? "#59FF9E" : hr.tough ? "#8a3a2a" : "#3a2a1e";
      ctx.lineWidth = hr.tough ? 3.4 : 2.2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(hr.x, hr.y);
      // натянутый волосок изгибается
      if (held) {
        const mx = (hr.x + tx) / 2 + (Math.random() - 0.5) * 2;
        const my = (hr.y + ty) / 2;
        ctx.quadraticCurveTo(mx, my, tx, ty);
      } else {
        ctx.lineTo(tx, ty);
      }
      ctx.stroke();
      // корень
      ctx.fillStyle = hr.tough ? "#a04a34" : "#4a3628";
      ctx.beginPath(); ctx.arc(hr.x, hr.y, hr.tough ? 3 : 2.2, 0, Math.PI * 2); ctx.fill();
    }
    };
    drawHairs();

    /*
     * ЛУПА.
     *
     * Волоски мелкие, и попасть по нужному пальцем было тяжело —
     * пользователь просил «типа лупа преувеличила». Круг под пальцем
     * показывает ту же сцену в увеличении: отсекаем область кругом,
     * масштабируем систему координат вокруг точки касания и повторно
     * рисуем волоски. Никакого второго канваса не нужно.
     */
    if (g.grabbed >= 0 || g.hover) {
      const lx = g.px, ly = g.py;
      const LR = 62;          // радиус лупы
      const ZOOM = 2.1;
      if (lx > 0 && ly > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(lx, ly - LR - 34, LR, 0, Math.PI * 2);
        ctx.clip();
        // фон лупы, чтобы не просвечивало
        ctx.fillStyle = "#e8c9a8";
        ctx.fillRect(lx - LR, ly - LR * 2 - 34, LR * 2, LR * 2);
        // увеличиваем область вокруг пальца и показываем её выше пальца
        ctx.translate(lx, ly - LR - 34);
        ctx.scale(ZOOM, ZOOM);
        ctx.translate(-lx, -ly);
        drawHairs();
        ctx.restore();
        // оправа
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(lx, ly - LR - 34, LR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(lx, ly - LR - 34, LR - 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();

    // всплывашки
    ctx.textAlign = "center";
    for (const p of g.pops) {
      ctx.globalAlpha = Math.min(1, p.t * 1.6);
      ctx.fillStyle = p.col;
      ctx.font = "800 17px Unbounded, Inter, system-ui, sans-serif";
      ctx.fillText(p.txt, p.x, p.y - (1 - p.t) * 26);
    }
    ctx.globalAlpha = 1;

    if (g.running && g.score < 40) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "600 12px Inter, system-ui, sans-serif";
      ctx.fillText(tr("Тяни волосок и отпускай. Не спеши — Макс злится"), w / 2, h - 20);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "play") {
      const c = document.querySelector<HTMLCanvasElement>("[data-beard-canvas]");
      const r = c?.getBoundingClientRect();
      reset(r?.width || 360, r?.height || 640);
      G.current.running = true;
    }
  }, [phase, reset]);

  return (
    <div className="absolute inset-0" style={{ background: "var(--bg)" }}>
      <canvas
        ref={canvasRef}
        data-beard-canvas
        className="absolute inset-0 w-full h-full"
        onPointerDown={(e) => { e.preventDefault(); onDown(e); }}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ touchAction: "none" }}
      />

      <GameHUD
        score={score}
        best={best}
        onExit={onExit}
        extra={
          <>
            <HudStat label={tr(ZONES[zone].name)} value={left} min={54} />
            <HudGauge label={tr("ЗЛОСТЬ")} pct={rage} tone={rage > 60 ? "danger" : "warn"} />
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
          title={rage >= RAGE_MAX ? tr("МАКС ВЗБЕСИЛСЯ") : tr("ЧИСТО")}
          sub={rage >= RAGE_MAX ? tr("Дал по рукам и ушёл") : tr("Ни волоска не осталось")}
        />
      )}
    </div>
  );
}
