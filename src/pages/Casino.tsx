import { useCallback, useEffect, useRef, useState } from "react";
import { tr } from "../core/i18n";
import { AnimatePresence, motion } from "framer-motion";
import { Panel, Screen, Tap } from "../ui/Glass";
import Icon from "../ui/Icon";
import ItemIcon from "../ui/ItemIcon";
import { sfx, haptic } from "../core/fx";
import { fmt } from "../core/format";
import { useGame } from "../core/store";
import { RARITY_COLOR, RARITY_LABEL } from "../core/content";
import {
  FREE_CHIPS, GAMBLE_CASES, SLOT_SYMBOLS, freeChipsIn, freeChipsReady,
  itemById, readGamble, rollItem, runBattle, slotPayout, spinReel,
  upgradeChance, upgradeTargets, writeGamble,
  type GambleCase, type GambleStore, type ItemDef, type SlotSymbol,
} from "../core/gamble";

type Tab = "slots" | "cases" | "battle" | "upgrade" | "stuff";

const TABS: { id: Tab; name: string }[] = [
  { id: "slots",   name: tr("СЛОТЫ") },
  { id: "cases",   name: tr("КЕЙСЫ") },
  { id: "battle",  name: tr("БАТЛ") },
  { id: "upgrade", name: tr("АПГРЕЙД") },
  { id: "stuff",   name: tr("ВЕЩИ") },
];

/** Значок символа слота */
function SlotGlyph({ id, size = 34 }: { id: SlotSymbol; size?: number }) {
  const map: Record<SlotSymbol, string> = {
    burger: "burger", tooth: "tooth", bolt: "bolt",
    gem: "gem", crown: "crown", skull: "skull",
  };
  const col: Record<SlotSymbol, string> = {
    burger: "#e8b06a", tooth: "#ffffff", bolt: "#FFB020",
    gem: "#8FD3FF", crown: "#FFD84D", skull: "#FF6B8A",
  };
  return (
    <span style={{ color: col[id], lineHeight: 0 }}>
      <Icon name={map[id] as never} size={size} />
    </span>
  );
}

export default function Casino({ onBack }: { onBack: () => void }) {
  const { toast } = useGame();
  const [tab, setTab] = useState<Tab>("slots");
  const [g, setG] = useState<GambleStore>(() => readGamble());

  const save = useCallback((patch: Partial<GambleStore>) => {
    setG((prev) => {
      const next = { ...prev, ...patch };
      writeGamble(next);
      return next;
    });
  }, []);

  /* ── бесплатные жетоны ── */
  const [, tickFree] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tickFree((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const takeFree = () => {
    if (!freeChipsReady(g)) return;
    save({ chips: g.chips + FREE_CHIPS, lastFree: Date.now() });
    sfx.coin?.();
    haptic("success");
    toast({ title: tr("Жетоны получены"), sub: `+${FREE_CHIPS}`, icon: "coin", tone: "gold" });
  };

  const freeLeft = freeChipsIn(g);
  const mm = Math.floor(freeLeft / 60000);
  const ss = Math.floor((freeLeft % 60000) / 1000);

  return (
    <Screen
      title={tr("КАЗИНО")}
      sub={tr("Играем на жетонах — фарм в безопасности")}
      right={
        <button
          type="button"
          onClick={() => { sfx.click(); onBack(); }}
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 34, height: 34, borderRadius: "var(--r-sm)",
            background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
          }}
        >
          <Icon name="cross" size={15} />
        </button>
      }
    >
      {/* Баланс жетонов */}
      <Panel
        r="lg"
        style={{
          padding: 14, marginBottom: 12,
          border: "1.5px solid rgba(255,176,32,0.4)",
          background: "rgba(255,176,32,0.06)",
        }}
      >
        <div className="flex items-center" style={{ gap: 12 }}>
          <span
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 42, height: 42, borderRadius: "var(--r-sm)",
              background: "rgba(255,176,32,0.16)", color: "#FFB020",
            }}
          >
            <Icon name="ticket" size={20} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="t-label block">{tr("Жетоны")}</span>
            <span className="t-num block acc-text" style={{ fontSize: 26, lineHeight: 1.1 }}>
              {fmt(g.chips)}
            </span>
          </span>
          {freeChipsReady(g) ? (
            <Tap
              onClick={takeFree}
              accent r="sm" center
              className="shrink-0 t-title"
              style={{ fontSize: 12, padding: "10px 16px" }}
              sound="coin"
            >
              +{FREE_CHIPS}
            </Tap>
          ) : (
            <span className="t-num shrink-0" style={{ fontSize: 12, color: "var(--text-mute)" }}>
              {mm}:{String(ss).padStart(2, "0")}
            </span>
          )}
        </div>
      </Panel>

      {/* Вкладки */}
      <div className="flex" style={{ gap: 6, marginBottom: 14, overflowX: "auto" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { sfx.click(); setTab(t.id); }}
            className="t-label shrink-0"
            style={{
              padding: "9px 13px",
              borderRadius: "var(--r-sm)",
              fontSize: 10,
              background: tab === t.id ? "var(--acc)" : "var(--btn-bg)",
              color: tab === t.id ? "var(--acc-ink)" : "var(--text-mute)",
              border: `1px solid ${tab === t.id ? "var(--acc)" : "var(--btn-brd)"}`,
            }}
          >
            {t.name}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {tab === "slots"   && <Slots g={g} save={save} />}
          {tab === "cases"   && <Cases g={g} save={save} />}
          {tab === "battle"  && <Battle g={g} save={save} />}
          {tab === "upgrade" && <Upgrade g={g} save={save} />}
          {tab === "stuff"   && <Stuff g={g} save={save} />}
        </motion.div>
      </AnimatePresence>
    </Screen>
  );
}

/* ═══════════════════════════ СЛОТЫ ═══════════════════════════ */

const BETS = [10, 25, 50, 100, 250];

function Slots({ g, save }: { g: GambleStore; save: (p: Partial<GambleStore>) => void }) {
  const [bet, setBet] = useState(25);
  const [reels, setReels] = useState<SlotSymbol[]>(["burger", "tooth", "bolt"]);
  const [spinning, setSpinning] = useState(false);
  const [win, setWin] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const spin = () => {
    if (spinning || g.chips < bet) return;
    setSpinning(true);
    setWin(null);
    save({ chips: g.chips - bet, spins: g.spins + 1 });
    sfx.click();
    haptic("light");

    const final: SlotSymbol[] = [spinReel(), spinReel(), spinReel()];

    // барабаны крутятся и останавливаются по очереди
    const iv = window.setInterval(() => {
      setReels([spinReel(), spinReel(), spinReel()]);
    }, 70);
    timers.current.push(iv);

    [520, 780, 1060].forEach((ms, i) => {
      const t = window.setTimeout(() => {
        setReels((prev) => {
          const next = [...prev];
          next[i] = final[i];
          return next;
        });
        sfx.click();
        if (i === 2) {
          clearInterval(iv);
          const pay = slotPayout(final, bet);
          setWin(pay);
          setSpinning(false);
          if (pay > 0) {
            save({ chips: g.chips - bet + pay, won: g.won + pay, spins: g.spins + 1 });
            sfx.crit?.();
            haptic("success");
          } else {
            save({ chips: g.chips - bet, lost: g.lost + bet, spins: g.spins + 1 });
            haptic("light");
          }
        }
      }, ms);
      timers.current.push(t);
    });
  };

  return (
    <>
      <Panel r="lg" style={{ padding: 16, marginBottom: 12 }}>
        {/* Барабаны */}
        <div className="flex" style={{ gap: 8, marginBottom: 14 }}>
          {reels.map((r, i) => (
            <div
              key={i}
              className="flex-1 flex items-center justify-center"
              style={{
                height: 92,
                borderRadius: "var(--r-md)",
                background: "var(--surface-2)",
                border: `1.5px solid ${win && win > 0 ? "#59FF9E" : "var(--btn-brd)"}`,
              }}
            >
              <motion.div
                key={`${i}-${r}`}
                initial={spinning ? { y: -14, opacity: 0.4 } : { scale: 0.8, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                transition={{ duration: 0.12 }}
              >
                <SlotGlyph id={r} />
              </motion.div>
            </div>
          ))}
        </div>

        {/* Результат */}
        <div style={{ height: 26, marginBottom: 12, textAlign: "center" }}>
          <AnimatePresence mode="wait">
            {win !== null && (
              <motion.div
                key={win}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="t-title-sm"
                style={{ color: win > 0 ? "#59FF9E" : "var(--text-mute)", fontSize: 14 }}
              >
                {win > 0 ? `+${fmt(win)} жетонов` : tr("Мимо")}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Ставка */}
        <div className="flex" style={{ gap: 6, marginBottom: 12 }}>
          {BETS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => { sfx.click(); setBet(b); }}
              className="t-num flex-1"
              style={{
                padding: "9px 0", borderRadius: "var(--r-sm)", fontSize: 12,
                background: bet === b ? "var(--acc)" : "var(--btn-bg)",
                color: bet === b ? "var(--acc-ink)" : "var(--text-mute)",
                border: `1px solid ${bet === b ? "var(--acc)" : "var(--btn-brd)"}`,
              }}
            >
              {b}
            </button>
          ))}
        </div>

        <Tap
          onClick={spin}
          accent r="md" center
          className="w-full py-3.5 t-title"
          style={{ fontSize: 14, opacity: spinning || g.chips < bet ? 0.5 : 1 }}
          sound="power"
        >
          {spinning ? "КРУТИТСЯ…" : g.chips < bet ? "НЕ ХВАТАЕТ ЖЕТОНОВ" : `КРУТИТЬ ЗА ${bet}`}
        </Tap>
      </Panel>

      {/* Таблица выплат */}
      <Panel r="lg" style={{ padding: 14 }}>
        <div className="t-label" style={{ marginBottom: 10 }}>{tr("Выплаты за тройку")}</div>
        {SLOT_SYMBOLS.map((s) => (
          <div
            key={s.id}
            className="flex items-center"
            style={{ gap: 10, padding: "6px 0" }}
          >
            <SlotGlyph id={s.id} size={18} />
            <span className="t-caption flex-1">{tr("три подряд")}</span>
            <span className="t-num" style={{ fontSize: 12 }}>×{s.pay3}</span>
          </div>
        ))}
        <div className="t-caption" style={{ marginTop: 8, lineHeight: 1.5 }}>{tr("Пара тоже платит, но меньше.")}</div>
      </Panel>
    </>
  );
}

/* ═══════════════════════════ КЕЙСЫ ═══════════════════════════ */

function Cases({ g, save }: { g: GambleStore; save: (p: Partial<GambleStore>) => void }) {
  const [opening, setOpening] = useState<GambleCase | null>(null);
  const [got, setGot] = useState<ItemDef | null>(null);
  const [roll, setRoll] = useState<ItemDef[]>([]);

  const open = (c: GambleCase) => {
    if (g.chips < c.price || opening) return;
    const prize = rollItem(c);
    // лента прокрутки: случайные предметы, приз — предпоследний
    const strip = Array.from({ length: 26 }, () => rollItem(c));
    strip[22] = prize;
    setRoll(strip);
    setOpening(c);
    setGot(null);
    save({ chips: g.chips - c.price });
    sfx.click();
    haptic("light");

    window.setTimeout(() => {
      setGot(prize);
      save({
        chips: g.chips - c.price,
        items: { ...g.items, [prize.id]: (g.items[prize.id] || 0) + 1 },
      });
      sfx.legend?.();
      haptic("success");
    }, 2600);
  };

  return (
    <>
      {GAMBLE_CASES.map((c) => (
        <Panel key={c.id} r="lg" style={{ padding: 14, marginBottom: 10 }}>
          <div className="flex items-center" style={{ gap: 12, marginBottom: 12 }}>
            <span
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 44, height: 44, borderRadius: "var(--r-sm)",
                background: "var(--surface-2)", border: "1px solid var(--btn-brd)",
              }}
            >
              <Icon name="case" size={21} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="t-title-sm block">{c.name}</span>
              <span className="t-caption block" style={{ marginTop: 2 }}>
                легенда {(c.odds.legend * 100).toFixed(1)}%
              </span>
            </span>
            <Tap
              onClick={() => open(c)}
              accent r="sm" center
              className="shrink-0 t-title"
              style={{
                fontSize: 12, padding: "10px 16px",
                opacity: g.chips < c.price ? 0.45 : 1,
              }}
              sound="power"
            >
              {c.price}
            </Tap>
          </div>

          {/* Шансы полоской */}
          <div className="flex" style={{ height: 5, borderRadius: 99, overflow: "hidden" }}>
            {(["common", "rare", "epic", "legend"] as const).map((r) => (
              <span
                key={r}
                style={{ width: `${c.odds[r] * 100}%`, background: RARITY_COLOR[r] }}
              />
            ))}
          </div>
        </Panel>
      ))}

      {/* Открытие кейса */}
      <AnimatePresence>
        {opening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center px-5"
            style={{ background: "rgba(4,4,6,0.86)", backdropFilter: "blur(16px)" }}
          >
            <div className="w-full max-w-sm">
              {!got ? (
                <>
                  <div className="t-label text-center" style={{ marginBottom: 14 }}>
                    {opening.name}
                  </div>
                  {/* Лента */}
                  <div
                    style={{
                      position: "relative", height: 96, overflow: "hidden",
                      borderRadius: "var(--r-lg)", border: "1.5px solid var(--btn-brd)",
                      background: "var(--surface-2)",
                    }}
                  >
                    <motion.div
                      className="flex items-center h-full"
                      initial={{ x: 0 }}
                      animate={{ x: -(22 * 84) + 140 }}
                      transition={{ duration: 2.4, ease: [0.15, 0.6, 0.15, 1] }}
                      style={{ gap: 8, paddingLeft: 8 }}
                    >
                      {roll.map((it, i) => (
                        <span
                          key={i}
                          className="shrink-0 flex flex-col items-center justify-center"
                          style={{
                            width: 76, height: 76, borderRadius: "var(--r-md)",
                            background: "var(--surface)",
                            border: `1.5px solid ${RARITY_COLOR[it.rarity]}`,
                            color: RARITY_COLOR[it.rarity],
                          }}
                        >
                          <ItemIcon id={it.id} size={30} />
                        </span>
                      ))}
                    </motion.div>
                    {/* указатель */}
                    <span
                      style={{
                        position: "absolute", left: "50%", top: 0, bottom: 0,
                        width: 2, background: "var(--acc)", transform: "translateX(-50%)",
                      }}
                    />
                  </div>
                </>
              ) : (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                >
                  <Panel r="xl" strong className="p-6 text-center">
                    <div
                      className="t-label"
                      style={{ color: RARITY_COLOR[got.rarity], marginBottom: 12 }}
                    >
                      {RARITY_LABEL[got.rarity]}
                    </div>
                    <span
                      className="inline-flex items-center justify-center"
                      style={{
                        width: 92, height: 92, borderRadius: "var(--r-lg)",
                        background: "var(--surface-2)",
                        border: `2px solid ${RARITY_COLOR[got.rarity]}`,
                        color: RARITY_COLOR[got.rarity],
                        boxShadow: `0 0 40px -10px ${RARITY_COLOR[got.rarity]}`,
                        marginBottom: 14,
                      }}
                    >
                      <ItemIcon id={got.id} size={44} />
                    </span>
                    <div className="t-title" style={{ fontSize: 17, marginBottom: 4 }}>
                      {got.name}
                    </div>
                    <div className="t-caption" style={{ marginBottom: 18 }}>
                      ценность {got.value} жетонов
                    </div>
                    <Tap
                      onClick={() => { setOpening(null); setGot(null); sfx.click(); }}
                      accent r="md" center
                      className="w-full py-3.5 t-title"
                      style={{ fontSize: 14 }}
                      sound="coin"
                    >{tr("ЗАБРАТЬ")}</Tap>
                  </Panel>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ═══════════════════════════ КЕЙС-БАТЛ ═══════════════════════════ */

const FOES = ["Лёха", "Макс", "Серёга", "Артём", "Кудря", "Шитов"];

function Battle({ g, save }: { g: GambleStore; save: (p: Partial<GambleStore>) => void }) {
  const [rounds, setRounds] = useState(3);
  const [caseId, setCaseId] = useState(GAMBLE_CASES[0].id);
  const [live, setLive] = useState<ReturnType<typeof runBattle> | null>(null);
  const [step, setStep] = useState(0);
  const [foe] = useState(() => FOES[Math.floor(Math.random() * FOES.length)]);
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const c = GAMBLE_CASES.find((x) => x.id === caseId)!;
  const cost = c.price * rounds;

  const start = () => {
    if (g.chips < cost || live) return;
    const res = runBattle(c, rounds);
    setLive(res);
    setStep(0);
    save({ chips: g.chips - cost });
    sfx.click();

    // раунды открываются по одному
    for (let i = 1; i <= rounds; i++) {
      const t = window.setTimeout(() => {
        setStep(i);
        sfx.click();
        haptic("light");
        if (i === rounds) {
          const gained: Record<string, number> = { ...g.items };
          if (res.win) {
            // победитель забирает всё
            for (const r of res.list) {
              gained[r.mine.id] = (gained[r.mine.id] || 0) + 1;
              gained[r.foe.id] = (gained[r.foe.id] || 0) + 1;
            }
          }
          save({
            chips: g.chips - cost,
            items: gained,
            battles: g.battles + 1,
            battleWins: g.battleWins + (res.win ? 1 : 0),
          });
          if (res.win) { sfx.legend?.(); haptic("success"); }
          else { sfx.gameOver?.(); haptic("error"); }
        }
      }, i * 900);
      timers.current.push(t);
    }
  };

  return (
    <>
      {!live ? (
        <Panel r="lg" style={{ padding: 15 }}>
          <div className="t-title-sm" style={{ marginBottom: 4 }}>{tr("Кейс-батл")}</div>
          <div className="t-caption" style={{ marginBottom: 14, lineHeight: 1.5 }}>
            Открываете кейсы одновременно с соперником. У кого сумма ценности
            больше — забирает все предметы, включая чужие.
          </div>

          <div className="t-label" style={{ marginBottom: 8 }}>{tr("Кейс")}</div>
          <div className="flex" style={{ gap: 6, marginBottom: 14 }}>
            {GAMBLE_CASES.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => { sfx.click(); setCaseId(x.id); }}
                className="t-caption flex-1"
                style={{
                  padding: "9px 4px", borderRadius: "var(--r-sm)", fontSize: 10,
                  background: caseId === x.id ? "var(--acc)" : "var(--btn-bg)",
                  color: caseId === x.id ? "var(--acc-ink)" : "var(--text-mute)",
                  border: `1px solid ${caseId === x.id ? "var(--acc)" : "var(--btn-brd)"}`,
                }}
              >
                {x.price}
              </button>
            ))}
          </div>

          <div className="t-label" style={{ marginBottom: 8 }}>{tr("Раундов")}</div>
          <div className="flex" style={{ gap: 6, marginBottom: 16 }}>
            {[1, 3, 5].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { sfx.click(); setRounds(r); }}
                className="t-num flex-1"
                style={{
                  padding: "9px 0", borderRadius: "var(--r-sm)", fontSize: 12,
                  background: rounds === r ? "var(--acc)" : "var(--btn-bg)",
                  color: rounds === r ? "var(--acc-ink)" : "var(--text-mute)",
                  border: `1px solid ${rounds === r ? "var(--acc)" : "var(--btn-brd)"}`,
                }}
              >
                {r}
              </button>
            ))}
          </div>

          <Tap
            onClick={start}
            accent r="md" center
            className="w-full py-3.5 t-title"
            style={{ fontSize: 14, opacity: g.chips < cost ? 0.5 : 1 }}
            sound="power"
          >
            {g.chips < cost ? "НЕ ХВАТАЕТ ЖЕТОНОВ" : `В БОЙ ЗА ${cost}`}
          </Tap>

          {g.battles > 0 && (
            <div className="t-caption" style={{ marginTop: 12, textAlign: "center" }}>
              побед {g.battleWins} из {g.battles}
            </div>
          )}
        </Panel>
      ) : (
        <Panel r="lg" style={{ padding: 15 }}>
          <div className="flex" style={{ gap: 10, marginBottom: 12 }}>
            <div className="flex-1 text-center">
              <div className="t-label">{tr("ТЫ")}</div>
              <div className="t-num acc-text" style={{ fontSize: 20 }}>
                {fmt(live.list.slice(0, step).reduce((a, b) => a + b.mine.value, 0))}
              </div>
            </div>
            <div className="flex-1 text-center">
              <div className="t-label">{foe.toUpperCase()}</div>
              <div className="t-num" style={{ fontSize: 20 }}>
                {fmt(live.list.slice(0, step).reduce((a, b) => a + b.foe.value, 0))}
              </div>
            </div>
          </div>

          {live.list.slice(0, step).map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center"
              style={{ gap: 8, marginBottom: 7 }}
            >
              <span
                className="flex-1 flex items-center"
                style={{
                  gap: 7, padding: "8px 9px", borderRadius: "var(--r-sm)",
                  background: "var(--surface-2)",
                  border: `1px solid ${RARITY_COLOR[r.mine.rarity]}66`,
                  color: RARITY_COLOR[r.mine.rarity],
                }}
              >
                <ItemIcon id={r.mine.id} size={17} />
                <span className="t-num" style={{ fontSize: 11 }}>{r.mine.value}</span>
              </span>
              <span
                className="flex-1 flex items-center justify-end"
                style={{
                  gap: 7, padding: "8px 9px", borderRadius: "var(--r-sm)",
                  background: "var(--surface-2)",
                  border: `1px solid ${RARITY_COLOR[r.foe.rarity]}66`,
                  color: RARITY_COLOR[r.foe.rarity],
                }}
              >
                <span className="t-num" style={{ fontSize: 11 }}>{r.foe.value}</span>
                <ItemIcon id={r.foe.id} size={17} />
              </span>
            </motion.div>
          ))}

          {step >= live.list.length && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ marginTop: 14 }}
            >
              <div
                className="t-title text-center"
                style={{
                  fontSize: 18, marginBottom: 12,
                  color: live.win ? "#59FF9E" : "#FF6B8A",
                }}
              >
                {live.win ? "ПОБЕДА" : tr("ПРОИГРЫШ")}
              </div>
              <Tap
                onClick={() => { setLive(null); setStep(0); sfx.click(); }}
                accent r="md" center
                className="w-full py-3.5 t-title"
                style={{ fontSize: 14 }}
                sound="coin"
              >
                {live.win ? "ЗАБРАТЬ ВСЁ" : tr("ЕЩЁ РАЗ")}
              </Tap>
            </motion.div>
          )}
        </Panel>
      )}
    </>
  );
}

/* ═══════════════════════════ АПГРЕЙД ═══════════════════════════ */

function Upgrade({ g, save }: { g: GambleStore; save: (p: Partial<GambleStore>) => void }) {
  const owned = Object.entries(g.items).filter(([, n]) => n > 0);
  const [fromId, setFromId] = useState<string | null>(owned[0]?.[0] ?? null);
  const [toId, setToId] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [res, setRes] = useState<null | boolean>(null);

  const from = fromId ? itemById(fromId) : null;
  const targets = from ? upgradeTargets(from.value) : [];
  const to = toId ? itemById(toId) : null;
  const chance = from && to ? upgradeChance(from.value, to.value) : 0;

  const go = () => {
    if (!from || !to || rolling) return;
    setRolling(true);
    setRes(null);
    sfx.click();
    window.setTimeout(() => {
      const ok = Math.random() < chance;
      const items = { ...g.items };
      items[from.id] = (items[from.id] || 1) - 1;
      if (items[from.id] <= 0) delete items[from.id];
      if (ok) items[to.id] = (items[to.id] || 0) + 1;
      save({ items });
      setRes(ok);
      setRolling(false);
      if (ok) { sfx.legend?.(); haptic("success"); }
      else { sfx.gameOver?.(); haptic("error"); }
      if (!items[from.id]) setFromId(Object.keys(items)[0] ?? null);
    }, 1400);
  };

  if (!owned.length) {
    return (
      <Panel r="lg" style={{ padding: 22, textAlign: "center" }}>
        <Icon name="case" size={30} />
        <div className="t-title-sm" style={{ marginTop: 10 }}>{tr("Нечего апгрейдить")}</div>
        <div className="t-caption" style={{ marginTop: 6 }}>{tr("Открой кейс — появятся предметы.")}</div>
      </Panel>
    );
  }

  return (
    <>
      <Panel r="lg" style={{ padding: 15, marginBottom: 12 }}>
        <div className="t-label" style={{ marginBottom: 9 }}>{tr("Что ставим")}</div>
        <div className="flex flex-wrap" style={{ gap: 6, marginBottom: 16 }}>
          {owned.map(([id, n]) => {
            const it = itemById(id);
            if (!it) return null;
            const on = fromId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => { sfx.click(); setFromId(id); setToId(null); setRes(null); }}
                className="flex items-center"
                style={{
                  gap: 7, padding: "8px 11px", borderRadius: "var(--r-sm)",
                  background: on ? "var(--surface)" : "var(--btn-bg)",
                  border: `1.5px solid ${on ? RARITY_COLOR[it.rarity] : "var(--btn-brd)"}`,
                  color: RARITY_COLOR[it.rarity],
                }}
              >
                <ItemIcon id={id} size={17} />
                <span className="t-num" style={{ fontSize: 11 }}>{n}</span>
              </button>
            );
          })}
        </div>

        {from && (
          <>
            <div className="t-label" style={{ marginBottom: 9 }}>{tr("Во что")}</div>
            <div className="flex flex-wrap" style={{ gap: 6 }}>
              {targets.slice(0, 8).map((it) => {
                const on = toId === it.id;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => { sfx.click(); setToId(it.id); setRes(null); }}
                    className="flex items-center"
                    style={{
                      gap: 7, padding: "8px 11px", borderRadius: "var(--r-sm)",
                      background: on ? "var(--surface)" : "var(--btn-bg)",
                      border: `1.5px solid ${on ? RARITY_COLOR[it.rarity] : "var(--btn-brd)"}`,
                      color: RARITY_COLOR[it.rarity],
                    }}
                  >
                    <ItemIcon id={it.id} size={17} />
                    <span className="t-num" style={{ fontSize: 10 }}>
                      {(upgradeChance(from.value, it.value) * 100).toFixed(0)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Panel>

      {from && to && (
        <Panel r="lg" style={{ padding: 15 }}>
          <div className="flex items-center justify-center" style={{ gap: 14, marginBottom: 14 }}>
            <span style={{ color: RARITY_COLOR[from.rarity] }}>
              <ItemIcon id={from.id} size={38} />
            </span>
            <Icon name="chevron" size={18} />
            <motion.span
              animate={rolling ? { rotate: 360 } : { rotate: 0 }}
              transition={rolling ? { duration: 0.7, repeat: Infinity, ease: "linear" } : {}}
              style={{ color: RARITY_COLOR[to.rarity], lineHeight: 0 }}
            >
              <ItemIcon id={to.id} size={38} />
            </motion.span>
          </div>

          <div className="t-num text-center acc-text" style={{ fontSize: 30, marginBottom: 4 }}>
            {(chance * 100).toFixed(0)}%
          </div>
          <div className="t-caption text-center" style={{ marginBottom: 14 }}>
            шанс поднять до «{to.name}»
          </div>

          {res !== null && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="t-title text-center"
              style={{
                fontSize: 15, marginBottom: 12,
                color: res ? "#59FF9E" : "#FF6B8A",
              }}
            >
              {res ? "ПОДНЯЛ" : tr("СГОРЕЛО")}
            </motion.div>
          )}

          <Tap
            onClick={go}
            accent r="md" center
            className="w-full py-3.5 t-title"
            style={{ fontSize: 14, opacity: rolling ? 0.5 : 1 }}
            sound="power"
          >
            {rolling ? "КРУТИМ…" : tr("АПГРЕЙД")}
          </Tap>
        </Panel>
      )}
    </>
  );
}

/* ═══════════════════════════ ВЕЩИ ═══════════════════════════ */

function Stuff({ g, save }: { g: GambleStore; save: (p: Partial<GambleStore>) => void }) {
  const owned = Object.entries(g.items).filter(([, n]) => n > 0);

  const sell = (id: string) => {
    const it = itemById(id);
    if (!it) return;
    const items = { ...g.items };
    items[id] = (items[id] || 1) - 1;
    if (items[id] <= 0) delete items[id];
    const eq = { ...g.equipped };
    if (eq[it.kind] === id && !items[id]) delete eq[it.kind];
    save({ items, equipped: eq, chips: g.chips + Math.floor(it.value * 0.6) });
    sfx.coin?.();
    haptic("light");
  };

  const equip = (it: ItemDef) => {
    const eq = { ...g.equipped };
    if (eq[it.kind] === it.id) delete eq[it.kind];
    else eq[it.kind] = it.id;
    save({ equipped: eq });
    sfx.click();
    haptic("light");
  };

  if (!owned.length) {
    return (
      <Panel r="lg" style={{ padding: 22, textAlign: "center" }}>
        <Icon name="case" size={30} />
        <div className="t-title-sm" style={{ marginTop: 10 }}>{tr("Пусто")}</div>
        <div className="t-caption" style={{ marginTop: 6 }}>{tr("Открывай кейсы и собирай украшения.")}</div>
      </Panel>
    );
  }

  return (
    <>
      {owned.map(([id, n]) => {
        const it = itemById(id);
        if (!it) return null;
        const on = g.equipped[it.kind] === id;
        return (
          <Panel
            key={id}
            r="lg"
            style={{
              padding: 12, marginBottom: 8,
              border: on ? `1.5px solid ${RARITY_COLOR[it.rarity]}` : undefined,
            }}
          >
            <div className="flex items-center" style={{ gap: 11 }}>
              <span
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: 42, height: 42, borderRadius: "var(--r-sm)",
                  background: "var(--surface-2)",
                  border: `1px solid ${RARITY_COLOR[it.rarity]}`,
                  color: RARITY_COLOR[it.rarity],
                }}
              >
                <ItemIcon id={id} size={21} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="t-title-sm clip1 block">{it.name}</span>
                <span
                  className="t-label block"
                  style={{ marginTop: 2, fontSize: 9, color: RARITY_COLOR[it.rarity] }}
                >
                  {RARITY_LABEL[it.rarity]} · {n} шт
                </span>
              </span>
              <button
                type="button"
                onClick={() => equip(it)}
                className="t-label shrink-0"
                style={{
                  padding: "8px 11px", borderRadius: "var(--r-sm)", fontSize: 9,
                  background: on ? "var(--acc)" : "var(--btn-bg)",
                  color: on ? "var(--acc-ink)" : "var(--text)",
                  border: `1px solid ${on ? "var(--acc)" : "var(--btn-brd)"}`,
                }}
              >
                {on ? "СНЯТЬ" : tr("НАДЕТЬ")}
              </button>
              <button
                type="button"
                onClick={() => sell(id)}
                className="t-label shrink-0"
                style={{
                  padding: "8px 10px", borderRadius: "var(--r-sm)", fontSize: 9,
                  background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
                  color: "var(--text-mute)",
                }}
              >
                {Math.floor(it.value * 0.6)}
              </button>
            </div>
          </Panel>
        );
      })}
      <div className="t-caption" style={{ marginTop: 10, lineHeight: 1.5, textAlign: "center" }}>{tr("Продажа даёт 60% ценности.")}</div>
    </>
  );
}
