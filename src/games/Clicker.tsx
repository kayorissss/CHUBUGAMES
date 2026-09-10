import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { tr } from "../core/i18n";
import {
  UPGRADES, upgradeCost, tapValue, autoRate, critChance, critMult,
  comboWindow, comboMax,
} from "../core/save";
import { drawHead } from "../core/head";
import { fmt } from "../core/format";
import { sfx, haptic } from "../core/fx";
import Icon from "../ui/Icon";
import type { IconName } from "../ui/Icon";
import { Bar } from "../ui/Glass";

interface FloatTxt { id: number; x: number; y: number; txt: string; crit: boolean }

export default function Clicker({ onExit }: { onExit: () => void }) {
  const { s, set, mainFriend, addXp, bump, questProgress, finishGame } = useGame();
  const [floats, setFloats] = useState<FloatTxt[]>([]);
  const [combo, setCombo] = useState(0);
  const [comboPct, setComboPct] = useState(0);
  const [tab, setTab] = useState<"tap" | "shop">("tap");
  const fid = useRef(0);
  const lastTap = useRef(0);
  const comboRef = useRef(0);
  const sessionTaps = useRef(0);
  const sessionStart = useRef(Date.now());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Сколько покупать за раз: 1 / 10 / максимум по деньгам */
  const [buyQty, setBuyQty] = useState<1 | 10 | "max">(1);
  const anim = useRef({ squish: 0, tilt: 0, blink: 0, blinkT: 1200, mouth: 0.08, rings: [] as any[] });
  const photoRef = useRef<HTMLImageElement | null>(null);

  // Эволюция героя: чем больше тапов, тем эпичнее выглядит
  const stage = clickerStage(s.clicker.totalTaps);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  const tv = tapValue(s);
  const ar = autoRate(s);
  const cc = critChance(s);
  const cm = critMult(s);
  const cmax = comboMax(s);
  const cwin = comboWindow(s);

  useEffect(() => {
    if (!mainFriend.photo) { photoRef.current = null; return; }
    const i = new Image();
    i.src = mainFriend.photo;
    i.onload = () => { photoRef.current = i; };
  }, [mainFriend.photo]);

  /* затухание комбо */
  useEffect(() => {
    const iv = setInterval(() => {
      const dt = Date.now() - lastTap.current;
      const pct = Math.max(0, 1 - dt / cwin);
      setComboPct(pct);
      if (pct <= 0 && comboRef.current > 0) {
        comboRef.current = 0;
        setCombo(0);
      }
    }, 60);
    return () => clearInterval(iv);
  }, [cwin]);

  /* рендер головы */
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    let raf = 0;
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const resize = () => {
      const r = c.getBoundingClientRect();
      c.width = r.width * dpr;
      c.height = r.height * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const ctx = c.getContext("2d");
      if (ctx) {
        const W = c.width / dpr;
        const H = c.height / dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        const a = anim.current;
        a.squish += (0 - a.squish) * 0.012 * dt;
        a.tilt += (0 - a.tilt) * 0.01 * dt;
        a.mouth += (0.08 - a.mouth) * 0.008 * dt;
        a.blinkT -= dt;
        if (a.blinkT < 0) {
          a.blink = 1;
          if (a.blinkT < -150) { a.blink = 0; a.blinkT = 1800 + Math.random() * 3000; }
        }
        const r = Math.min(W, H) * 0.36;
        const cy = H * 0.52 + Math.sin(now * 0.0013) * 6;

        // кольца от тапов
        for (let i = a.rings.length - 1; i >= 0; i--) {
          const ring = a.rings[i];
          ring.t += dt;
          const p = ring.t / 620;
          if (p >= 1) { a.rings.splice(i, 1); continue; }
          ctx.strokeStyle = `rgba(255,176,32,${(1 - p) * 0.55})`;
          ctx.lineWidth = 3 * (1 - p) + 0.6;
          ctx.beginPath();
          ctx.arc(W / 2, cy, r * (1 + p * 0.6), 0, Math.PI * 2);
          ctx.stroke();
        }

        // свечение усиливается со стадией
        const st = stageRef.current;
        const glow = ctx.createRadialGradient(W / 2, cy, r * 0.4, W / 2, cy, r * (1.7 + st.idx * 0.16));
        glow.addColorStop(0, `rgba(255,176,32,${0.14 + st.idx * 0.06})`);
        glow.addColorStop(1, "rgba(255,176,32,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        // лучи (со 2-й стадии)
        if (st.rays) {
          ctx.save();
          ctx.translate(W / 2, cy);
          ctx.rotate(now * 0.00022);
          const rays = 12;
          for (let i = 0; i < rays; i++) {
            ctx.rotate((Math.PI * 2) / rays);
            const len = r * (1.5 + Math.sin(now * 0.002 + i) * 0.12);
            const g2 = ctx.createLinearGradient(0, -r * 0.9, 0, -len);
            g2.addColorStop(0, `${st.color}55`);
            g2.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = g2;
            ctx.beginPath();
            ctx.moveTo(-r * 0.07, -r * 0.9);
            ctx.lineTo(r * 0.07, -r * 0.9);
            ctx.lineTo(0, -len);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }

        // крылья (с 3-й стадии)
        if (st.wings) {
          const flap = Math.sin(now * 0.004) * 0.16;
          for (const dir of [-1, 1]) {
            ctx.save();
            ctx.translate(W / 2 + dir * r * 0.86, cy - r * 0.1);
            ctx.rotate(dir * (0.34 + flap));
            ctx.scale(dir, 1);
            const wg = ctx.createLinearGradient(0, 0, r * 1.25, 0);
            wg.addColorStop(0, `${st.color}dd`);
            wg.addColorStop(1, `${st.color}18`);
            ctx.fillStyle = wg;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(r * 0.9, -r * 0.75, r * 1.3, -r * 0.15);
            ctx.quadraticCurveTo(r * 0.85, r * 0.05, r * 0.95, r * 0.5);
            ctx.quadraticCurveTo(r * 0.45, r * 0.2, 0, r * 0.28);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        }

        // корона (4-я стадия)
        if (st.crown) {
          ctx.save();
          ctx.translate(W / 2, cy - r * 1.12);
          ctx.fillStyle = st.color;
          ctx.shadowColor = st.color;
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.moveTo(-r * 0.42, 0);
          ctx.lineTo(-r * 0.3, -r * 0.42);
          ctx.lineTo(-r * 0.12, -r * 0.14);
          ctx.lineTo(0, -r * 0.5);
          ctx.lineTo(r * 0.12, -r * 0.14);
          ctx.lineTo(r * 0.3, -r * 0.42);
          ctx.lineTo(r * 0.42, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        if (photoRef.current) {
          const sq = 1 + a.squish * 0.1;
          ctx.save();
          ctx.translate(W / 2, cy);
          ctx.rotate(a.tilt);
          ctx.scale(sq, 1 / sq);
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(photoRef.current, -r, -r, r * 2, r * 2);
          ctx.restore();
          ctx.strokeStyle = "rgba(255,255,255,0.22)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(W / 2, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          drawHead(ctx, mainFriend.look, W / 2, cy, r, {
            squish: a.squish, tilt: a.tilt, blink: a.blink,
            mouth: a.mouth, cheeks: a.squish * 0.7,
          });
          // Внешность растёт вместе со стадией: свечение кожи,
          // татуировки энергии, огненная аура и нимб — вместо круга.
          drawEvolution(ctx, W / 2, cy, r, st, now);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    /* ВАЖНО: `tab` в зависимостях.
       Вкладка «АПГРЕЙДЫ» размонтирует <canvas>, а при возврате React
       создаёт НОВЫЙ элемент. Раньше зависимостью был только mainFriend,
       эффект не перезапускался, и цикл продолжал рисовать в старый,
       уже оторванный от DOM канвас — герой пропадал до первого тапа.
       Теперь при смене вкладки цикл пересоздаётся на актуальном канвасе. */
  }, [mainFriend, tab]);


  useEffect(() => {
    const st = sessionStart.current;
    return () => {
      if (sessionTaps.current > 0) {
        finishGame("clicker", sessionTaps.current, Date.now() - st);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doTap = useCallback(
    (e: React.PointerEvent) => {
      const now = Date.now();
      const gap = now - lastTap.current;
      lastTap.current = now;
      if (gap < cwin) comboRef.current = Math.min(200, comboRef.current + 1);
      else comboRef.current = 1;
      setCombo(comboRef.current);

      const comboMul = 1 + Math.min(cmax - 1, (comboRef.current / 60) * (cmax - 1));
      const isCrit = Math.random() < cc;
      const gain = tv * comboMul * (isCrit ? cm : 1);

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const fx = e.clientX - rect.left;
      const fy = e.clientY - rect.top;
      const id = ++fid.current;
      setFloats((p) => [
        ...p.slice(-14),
        { id, x: fx, y: fy, txt: `+${fmt(gain)}`, crit: isCrit },
      ]);
      setTimeout(() => setFloats((p) => p.filter((f) => f.id !== id)), 900);

      const a = anim.current;
      a.squish = 1;
      a.tilt = (Math.random() - 0.5) * 0.22;
      a.mouth = 0.55;
      a.rings.push({ t: 0 });
      if (a.rings.length > 6) a.rings.shift();

      sessionTaps.current++;
      if (isCrit) { sfx.crit(); haptic("medium"); } else { sfx.tap(); haptic("light"); }

      set((d) => {
        d.coins += gain;
        d.totalCoinsEver += gain;
        d.clicker.totalTaps += 1;
        d.clicker.earned += gain;
        d.stats.tapsTotal += 1;
      });
      if (sessionTaps.current % 10 === 0) {
        addXp(4);
        questProgress("taps", 10);
        bump("tapsTotal", 0);
      }
    },
    [tv, cc, cm, cmax, cwin, set, addXp, questProgress, bump],
  );

  /**
   * Сколько уровней реально можно купить и во сколько это обойдётся.
   *
   * Цена уровня растёт геометрически, поэтому «купить 10» — это не
   * «цена × 10». Пользователь просил показывать ИТОГОВУЮ цену, а если
   * денег не хватает на всю пачку — сколько получится взять сейчас.
   */
  const planBuy = useCallback((key: (typeof UPGRADES)[number]["key"], base: number, growth: number) => {
    const startLvl = s.clicker[key] as number;
    const limit = buyQty === "max" ? 500 : buyQty;
    let coins = s.coins;
    let lvl = startLvl;
    let count = 0;
    let total = 0;
    for (let i = 0; i < limit; i++) {
      const c = upgradeCost(base, growth, key === "tapPower" ? lvl - 1 : lvl);
      if (coins < c) break;
      coins -= c;
      total += c;
      lvl++;
      count++;
    }
    // цена следующего уровня — показываем всегда, даже если денег нет
    const nextCost = upgradeCost(base, growth, key === "tapPower" ? startLvl - 1 : startLvl);
    return { count, total, nextCost, lvl };
  }, [s.clicker, s.coins, buyQty]);

  const buy = (key: (typeof UPGRADES)[number]["key"], base: number, growth: number) => {
    const plan = planBuy(key, base, growth);
    if (!plan.count) { sfx.error(); haptic("error"); return; }
    sfx.buy();
    haptic("success");
    set((d) => {
      d.coins -= plan.total;
      (d.clicker[key] as number) = plan.lvl;
    });
    addXp(12 * plan.count);
  };

  return (
    <div className="absolute inset-0 flex flex-col" style={{ background: "var(--bg)" }}>
      {/* ── Шапка ──
          Была: кнопка назад + стеклянная панель с монетами + два
          крупных таба во всю ширину. Занимало четверть экрана, а
          главное число тонуло среди мелких подписей. Стало: одна
          строка «назад / монеты / доход» и компактный переключатель. */}
      <div className="px-3 pb-2 z-20 shrink-0" style={{ paddingTop: "calc(var(--sat) + 8px)" }}>
        <div className="flex items-stretch" style={{ gap: 6 }}>
          <button
            type="button"
            onClick={() => { sfx.swoosh(); haptic("light"); onExit(); }}
            className="hud-chip shrink-0 justify-center"
            style={{ width: 44, padding: 0 }}
            aria-label={tr("Выйти")}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="hud-chip flex-1 min-w-0 justify-between" style={{ padding: "0 12px" }}>
            <span className="flex items-center min-w-0" style={{ gap: 8 }}>
              <Icon name="coin" size={17} accent />
              <span className="t-num clip1" style={{ fontSize: 21, lineHeight: 1 }}>{fmt(s.coins)}</span>
            </span>
            <span className="flex flex-col items-end shrink-0" style={{ marginLeft: 10 }}>
              <span className="t-num" style={{ fontSize: 11, lineHeight: 1.2, color: "var(--acc-text)" }}>
                +{fmt(tv)}<span className="t-label" style={{ fontSize: 7.5, marginLeft: 2 }}>{tr("ТАП")}</span>
              </span>
              <span className="t-num" style={{ fontSize: 11, lineHeight: 1.2, color: "var(--ok)" }}>
                +{fmt(ar)}<span className="t-label" style={{ fontSize: 7.5, marginLeft: 2 }}>{tr("СЕК")}</span>
              </span>
            </span>
          </div>
        </div>

        {/* Переключатель — сегментированный, а не две кнопки на всю ширину */}
        <div
          className="flex mt-2"
          style={{
            padding: 3, gap: 3, borderRadius: "var(--r-md)",
            background: "var(--surface)", border: "1px solid var(--surface-brd)",
          }}
        >
          {([["tap", tr("ТАПАТЬ")], ["shop", tr("АПГРЕЙДЫ")]] as const).map(([id, nm]) => (
            <button
              key={id}
              type="button"
              onClick={() => { sfx.click(); haptic("light"); setTab(id); }}
              className="flex-1 t-label"
              style={{
                padding: "9px 0", borderRadius: "var(--r-sm)", fontSize: 10.5,
                background: tab === id ? "var(--acc)" : "transparent",
                color: tab === id ? "var(--acc-ink)" : "var(--text-mute)",
                border: "none", letterSpacing: "0.08em",
                transition: "background .16s, color .16s",
              }}
            >
              {nm}
            </button>
          ))}
        </div>
      </div>

      {tab === "tap" ? (
        <div className="flex-1 relative" onPointerDown={doTap} style={{ touchAction: "none" }}>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          {/* ── Стадия эволюции ──
              Была прижата к самому низу (bottom: 10) и налезала на
              полоску жестов Android — на Xiaomi это выглядело как текст
              прямо на системной панели. Теперь отступ считается от
              безопасной зоны, а блок собран в одну аккуратную плашку. */}
          <div
            className="absolute left-0 right-0 flex justify-center pointer-events-none"
            style={{ bottom: "calc(var(--sab) + 16px)", padding: "0 16px" }}
          >
            <div
              className="flex flex-col items-center"
              style={{
                width: "100%", maxWidth: 300, padding: "10px 14px",
                borderRadius: "var(--r-md)",
                background: "var(--surface-2)",
                border: "1px solid var(--btn-brd)",
              }}
            >
              <div className="flex items-center justify-between w-full" style={{ gap: 10 }}>
                <span
                  className="t-label clip1"
                  style={{ color: stage.color, fontSize: 10, letterSpacing: "0.1em" }}
                >
                  {tr(stage.name)}
                </span>
                <span className="t-num shrink-0" style={{ fontSize: 11, color: "var(--text-mute)" }}>
                  {fmt(s.clicker.totalTaps)}
                </span>
              </div>
              {stage.next !== null && (
                <>
                  <div
                    style={{
                      width: "100%", height: 5, marginTop: 8,
                      borderRadius: 999, background: "var(--n-400)", overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, (s.clicker.totalTaps / stage.next) * 100)}%`,
                        height: "100%", background: stage.color, transition: "width 0.3s",
                      }}
                    />
                  </div>
                  <div className="t-caption clip1" style={{ marginTop: 6, fontSize: 9.5, textAlign: "center" }}>
                    {tr("до формы")} «{tr(nextStageName(stage))}»: {fmt(Math.max(0, stage.next - s.clicker.totalTaps))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* комбо */}
          <AnimatePresence>
            {combo > 2 && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute left-0 right-0 flex flex-col items-center pointer-events-none"
                style={{ top: 8 }}
              >
                <motion.div
                  key={combo}
                  initial={{ scale: 1.35 }}
                  animate={{ scale: 1 }}
                  className="t-display acc-text"
                  style={{ fontSize: 34, textShadow: "0 0 26px var(--acc-glow)" }}
                >
                  ×{combo}
                </motion.div>
                <div style={{ width: 110, marginTop: 4 }}>
                  <Bar pct={comboPct} h={4} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* всплывающие цифры */}
          <AnimatePresence>
            {floats.map((f) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 1, y: 0, scale: f.crit ? 1.4 : 1 }}
                animate={{ opacity: 0, y: -78, scale: f.crit ? 1.7 : 1.1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className="absolute pointer-events-none t-num"
                style={{
                  left: f.x, top: f.y, transform: "translate(-50%,-50%)",
                  fontSize: f.crit ? 26 : 17,
                  color: f.crit ? "var(--acc)" : "var(--text)",
                  textShadow: f.crit ? "0 0 22px var(--acc-glow)" : "0 2px 8px rgba(0,0,0,0.6)",
                  fontWeight: 900,
                }}
              >
                {f.txt}
              </motion.div>
            ))}
          </AnimatePresence>

        </div>
      ) : (
        <div className="flex-1 scroll px-3" style={{ paddingBottom: "calc(var(--sab) + 24px)" }}>
          {/* Выбор размера покупки. Пользователь просил «выбор на сколько
              прокачать сразу» и итоговую цену — вот он. */}
          <div
            className="flex items-center"
            style={{
              gap: 3, padding: 3, marginBottom: 10,
              borderRadius: "var(--r-md)",
              background: "var(--surface)", border: "1px solid var(--surface-brd)",
            }}
          >
            <span className="t-label" style={{ fontSize: 8.5, padding: "0 8px" }}>{tr("БРАТЬ")}</span>
            {([1, 10, "max"] as const).map((q) => (
              <button
                key={String(q)}
                type="button"
                onClick={() => { sfx.click(); haptic("light"); setBuyQty(q); }}
                className="flex-1 t-label"
                style={{
                  padding: "8px 0", borderRadius: "var(--r-sm)", fontSize: 10, border: "none",
                  background: buyQty === q ? "var(--acc)" : "transparent",
                  color: buyQty === q ? "var(--acc-ink)" : "var(--text-mute)",
                  transition: "background .16s, color .16s",
                }}
              >
                {q === "max" ? tr("МАКС") : `×${q}`}
              </button>
            ))}
          </div>

          {UPGRADES.map((u) => {
            const lvl = s.clicker[u.key] as number;
            const plan = planBuy(u.key, u.base, u.growth);
            const can = plan.count > 0;
            return (
              <div
                key={u.key}
                className="mb-2.5"
                style={{
                  borderRadius: "var(--r-lg)",
                  background: "var(--surface)",
                  border: "1px solid var(--surface-brd)",
                  overflow: "hidden",
                }}
              >
                <div className="flex items-center p-3" style={{ gap: 11 }}>
                  {/* Иконка была текстом: в UPGRADES лежит строка "fist",
                      и она буквально печаталась в карточке. Теперь SVG. */}
                  <span
                    className="ico-box ico-box-acc shrink-0"
                    style={{ width: 42, height: 42 }}
                  >
                    <Icon name={u.icon as IconName} size={20} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="t-title clip1" style={{ fontSize: 14 }}>{tr(u.name)}</div>
                    <div className="t-caption clip1" style={{ fontSize: 10.5, marginTop: 1 }}>
                      {tr(u.desc)}
                    </div>
                  </div>
                  <span
                    className="shrink-0 t-num text-center"
                    style={{
                      minWidth: 44, padding: "5px 8px", borderRadius: "var(--r-sm)",
                      background: "var(--surface-3)", border: "1px solid var(--btn-brd)",
                      fontSize: 13, color: "var(--acc-text)", lineHeight: 1.2,
                    }}
                  >
                    <span className="t-label block" style={{ fontSize: 7, letterSpacing: "0.08em" }}>
                      {tr("УР.")}
                    </span>
                    {lvl}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={!can}
                  onClick={() => buy(u.key, u.base, u.growth)}
                  className="w-full flex items-center justify-between"
                  style={{
                    padding: "11px 13px",
                    background: can ? "var(--acc)" : "var(--surface-2)",
                    color: can ? "var(--acc-ink)" : "var(--text-mute)",
                    border: "none",
                    borderTop: "1px solid var(--surface-brd)",
                    cursor: can ? "pointer" : "default",
                    transition: "background .16s",
                  }}
                >
                  <span className="t-label" style={{ fontSize: 10, letterSpacing: "0.08em" }}>
                    {/* Если денег не хватает на всю пачку — честно пишем,
                        сколько уровней получится взять прямо сейчас. */}
                    {can
                      ? `${tr("КУПИТЬ")} +${plan.count} ${tr("УР.")}`
                      : tr("НЕ ХВАТАЕТ МОНЕТ")}
                  </span>
                  <span className="t-num inline-flex items-center" style={{ gap: 5, fontSize: 13 }}>
                    <Icon name="coin" size={13} />
                    {fmt(can ? plan.total : plan.nextCost)}
                  </span>
                </button>
              </div>
            );
          })}

          <div
            className="t-caption"
            style={{
              marginTop: 14, padding: "11px 13px", lineHeight: 1.55, fontSize: 10.5,
              borderRadius: "var(--r-md)",
              background: "var(--surface)", border: "1px solid var(--surface-brd)",
            }}
          >
            {tr("Пока приложение закрыто, «Холодильник» продолжает копить монеты. Заходи почаще — заберёшь больше.")}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Визуальные признаки стадии поверх головы: чем больше тапов,
 * тем эпичнее выглядит персонаж.
 */
function drawEvolution(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  st: Stage, now: number,
) {
  if (st.idx <= 0) return;
  ctx.save();

  // 1 стадия: тёплое свечение по контуру лица
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(cx, cy, r * 0.72, cx, cy, r * 1.16);
  glow.addColorStop(0, `${st.color}00`);
  glow.addColorStop(0.75, `${st.color}${st.idx >= 3 ? "44" : "22"}`);
  glow.addColorStop(1, `${st.color}00`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // 2 стадия: светящиеся руны на щеках
  if (st.idx >= 2) {
    ctx.strokeStyle = `${st.color}dd`;
    ctx.lineWidth = Math.max(1.6, r * 0.035);
    ctx.lineCap = "round";
    ctx.shadowColor = st.color;
    ctx.shadowBlur = 12;
    const pulse = 0.65 + Math.sin(now * 0.004) * 0.35;
    ctx.globalAlpha = pulse;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + dir * r * 0.52, cy + r * 0.06);
      ctx.lineTo(cx + dir * r * 0.66, cy + r * 0.24);
      ctx.moveTo(cx + dir * r * 0.44, cy + r * 0.24);
      ctx.lineTo(cx + dir * r * 0.62, cy + r * 0.4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  // 3 стадия: языки пламени по краям головы
  if (st.idx >= 3) {
    ctx.globalCompositeOperation = "lighter";
    const flames = 9;
    for (let i = 0; i < flames; i++) {
      const a = Math.PI + (i / (flames - 1)) * Math.PI;
      const wob = Math.sin(now * 0.006 + i * 1.7) * 0.5 + 0.5;
      const len = r * (0.26 + wob * 0.3);
      const bx = cx + Math.cos(a) * r * 0.97;
      const by = cy + Math.sin(a) * r * 0.97;
      const fg = ctx.createLinearGradient(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len);
      fg.addColorStop(0, `${st.color}bb`);
      fg.addColorStop(1, `${st.color}00`);
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(a + 0.16) * r * 0.1, by + Math.sin(a + 0.16) * r * 0.1);
      ctx.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len);
      ctx.lineTo(bx + Math.cos(a - 0.16) * r * 0.1, by + Math.sin(a - 0.16) * r * 0.1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  // 4 стадия: нимб над головой
  if (st.idx >= 4) {
    ctx.save();
    ctx.translate(cx, cy - r * 1.3);
    ctx.scale(1, 0.32);
    ctx.strokeStyle = st.color;
    ctx.lineWidth = Math.max(2.4, r * 0.07);
    ctx.shadowColor = st.color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

/* ================= ЭВОЛЮЦИЯ ГЕРОЯ ================= */

export interface Stage {
  idx: number;
  name: string;
  color: string;
  rays: boolean;
  wings: boolean;
  crown: boolean;
  next: number | null;
}

const STAGES: { at: number; name: string; color: string }[] = [
  { at: 0, name: "Обычный", color: "#8f8f9c" },
  { at: 500, name: "Разогретый", color: "#5fa8ff" },
  { at: 5000, name: "Сияющий", color: "#b07bff" },
  { at: 30000, name: "Крылатый", color: "var(--gold)" },
  { at: 150000, name: "ИМБОВЫЙ", color: "#59ff9e" },
];

/** Название следующей формы — для подписи прогресса */
export function nextStageName(st: Stage): string {
  return STAGES[Math.min(STAGES.length - 1, st.idx + 1)].name;
}

/** Стадия внешности по общему числу тапов */
export function clickerStage(taps: number): Stage {
  let i = 0;
  for (let k = 0; k < STAGES.length; k++) if (taps >= STAGES[k].at) i = k;
  const def = STAGES[i];
  return {
    idx: i,
    name: def.name,
    color: def.color,
    rays: i >= 2,
    wings: i >= 3,
    crown: i >= 4,
    next: i < STAGES.length - 1 ? STAGES[i + 1].at : null,
  };
}
