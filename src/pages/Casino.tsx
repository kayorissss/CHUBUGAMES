import { useCallback, useEffect, useRef, useState } from "react";
import { tr } from "../core/i18n";
import { AnimatePresence, motion } from "framer-motion";
import { Panel, Screen, Tap } from "../ui/Glass";
import Icon, { type IconName } from "../ui/Icon";
import ItemIcon from "../ui/ItemIcon";
import { sfx, haptic } from "../core/fx";
import { fmt } from "../core/format";
import { useGame } from "../core/store";
import { bossStats } from "../core/save";
import { RARITY_COLOR, RARITY_LABEL } from "../core/content";
import {
  FREE_CHIPS, GAMBLE_CASES, SLOT_SYMBOLS, freeChipsIn, freeChipsReady,
  itemById, readGamble, rollItem, runBattle, shiftItem, slotPayout, spinReel,
  updateGamble,
  type GambleCase, type GambleSave, type GambleStore, type ItemDef, type SlotSymbol,
} from "../core/gamble";
import Wheel, { wheelStopFeedback } from "../ui/Wheel";
import {
  WHEEL_MULTS, ZONE_LABEL, buildWheel, spinTo, winChance, zonePayout,
  type WheelZone,
} from "../core/wheel";

type Tab = "farm" | "slots" | "cases" | "battle" | "upgrade" | "stuff";

/*
 * Названия вкладок храним русскими оригиналами, а tr() вызываем в render.
 * На уровне модуля перевод работать не может: словарь языка ещё не выбран.
 */
/*
 * Названия вкладок храним русскими оригиналами, а tr() вызываем в render:
 * на уровне модуля перевод всегда возвращал русский, потому что язык в
 * этот момент ещё не выбран стором.
 */
/* Порядок вкладок — по значимости, а не по алфавиту кода: СЛОТЫ первыми
   (просьба буквальная), ферма — в конец, как второстепенный фарм. */
const TABS: { id: Tab; name: string; icon: IconName }[] = [
  { id: "slots",   name: "СЛОТЫ",   icon: "dice" },
  { id: "cases",   name: "КЕЙСЫ",   icon: "case" },
  { id: "upgrade", name: "АПГРЕЙД", icon: "bolt" },
  { id: "battle",  name: "БАТЛ",    icon: "skull" },
  { id: "stuff",   name: "ВЕЩИ",    icon: "gift" },
  { id: "farm",    name: "ФЕРМА",   icon: "leaf" },
];

/** Значок символа слота */
function SlotGlyph({ id, size = 34 }: { id: SlotSymbol; size?: number }) {
  const map: Record<SlotSymbol, string> = {
    burger: "burger", tooth: "tooth", bolt: "bolt",
    gem: "gem", crown: "crown", skull: "skull",
  };
  const col: Record<SlotSymbol, string> = {
    burger: "#e8b06a", tooth: "#ffffff", bolt: "var(--gold)",
    gem: "#8FD3FF", crown: "#FFD84D", skull: "var(--danger)",
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

  /*
   * Единственная точка записи казино.
   *
   * Раньше сюда прилетал объект, собранный из `g` — состояния, снятого на
   * ПОСЛЕДНЕМ РЕНДЕРЕ. Между нажатием и записью у нас таймауты: прокрутка
   * слотов, 2.6 секунды открытия кейса, раунды батла. За это время
   * хранилище успевает измениться (вторая кнопка, босс, сундук, автосейв),
   * и запись «поверх своего снимка» затирает чужое — именно так и пропадают
   * собранные вещи. Теперь патч — функция от актуального состояния:
   * read-modify-write происходит в момент записи, а не в момент клика.
   */
  const save = useCallback<GambleSave>((patch) => {
    setG(updateGamble(patch));
  }, []);

  /* ── бесплатные жетоны ── */
  const [, tickFree] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tickFree((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const takeFree = () => {
    if (!freeChipsReady(g)) return;
    save((x) => ({ chips: x.chips + FREE_CHIPS, lastFree: Date.now() }));
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
      {/* Баланс жетонов.
          Было: голая цифра, кнопка «+60» без пояснения и таймер «3:12»
          без подписи — пользователь не понимал, что это вообще такое.
          Стало: явные подписи «ЖЕТОНЫ КАЗИНО», «БЕСПЛАТНЫЕ ЖЕТОНЫ»
          и текст «через 3:12». */}
      <Panel
        r="lg"
        className="pc-chips-bar"
        style={{
          padding: 15, marginBottom: 12,
          border: "1.5px solid var(--gold-brd)",
          background: "var(--gold-soft)",
        }}
      >
        <div className="flex items-center" style={{ gap: 12 }}>
          <span
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 44, height: 44, borderRadius: "var(--r-sm)",
              background: "var(--gold-soft)", color: "var(--gold)",
            }}
          >
            <Icon name="ticket" size={21} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="t-label block" style={{ fontSize: 9 }}>{tr("ЖЕТОНЫ КАЗИНО")}</span>
            <span className="t-num block" style={{ fontSize: 27, lineHeight: 1.1, color: "var(--gold)" }}>
              {fmt(g.chips)}
            </span>
          </span>
        </div>

        <div
          className="flex items-center"
          style={{
            gap: 10, marginTop: 13, paddingTop: 12,
            borderTop: "1px solid var(--gold-brd)",
          }}
        >
          <span className="flex-1 min-w-0">
            <span className="t-label block" style={{ fontSize: 9 }}>{tr("БЕСПЛАТНЫЕ ЖЕТОНЫ")}</span>
            <span className="t-caption block clip1" style={{ marginTop: 3 }}>
              {freeChipsReady(g)
                ? tr("Готовы — забирай")
                : `${tr("через")} ${mm}:${String(ss).padStart(2, "0")}`}
            </span>
          </span>
          <button
            type="button"
            onClick={takeFree}
            disabled={!freeChipsReady(g)}
            className="t-title shrink-0 flex items-center"
            style={{
              gap: 6, padding: "11px 16px", borderRadius: "var(--r-sm)", fontSize: 12.5,
              background: freeChipsReady(g) ? "var(--gold)" : "var(--surface-2)",
              color: freeChipsReady(g) ? "#100c02" : "var(--text-mute)",
              border: `1px solid ${freeChipsReady(g) ? "var(--gold)" : "var(--btn-brd)"}`,
            }}
          >
            <Icon name="ticket" size={14} />
            {tr("ЗАБРАТЬ")} +{FREE_CHIPS}
          </button>
        </div>
      </Panel>

      {/* Вкладки — общие сегменты (.pc-seg), тот же стиль, что в Магазине и
          Прогрессе: иконка + подпись, активная залита акцентом. Раньше это
          была вереница кнопок-таблеток, из-за чего казино выглядело
          «не вписанным» в остальное приложение. */}
      <div className="pc-seg" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`pc-seg-item ${tab === t.id ? "on" : ""}`}
            onClick={() => { sfx.click(); setTab(t.id); }}
          >
            <Icon name={t.icon} size={14} />
            <span className="t-label clip1">{tr(t.name)}</span>
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
          {tab === "farm"    && <ChipFarm save={save} />}
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

/**
 * Слоты.
 *
 * Что было не так (жалоба «скудная анимация, непонятно выиграл или нет»):
 *   1. РЕАЛЬНЫЙ БАГ, а не оформление. Пара младших символов платит меньше
 *      ставки (бургер ×0.5, зуб ×0.7, болт ×0.9), но экран всё равно
 *      писал зелёное «+N жетонов». Расчётом: 42.3 % всех спинов
 *      показывали «выигрыш», после которого жетонов становилось МЕНЬШЕ.
 *      Игрок видел зелёный плюс и терял баланс — отсюда «непонятно».
 *      Теперь считаем ЧИСТЫЙ результат (выплата минус ставка) и красим
 *      по нему: плюс зелёным, возврат части ставки — жёлтым «вернулось»,
 *      ноль — серым. В плюс реально уходит 11.9 % спинов.
 *   2. Барабаны просто меняли иконку каждые 70 мс. Теперь лента символов
 *      едет вертикально и тормозит на своём барабане, а выигрышные
 *      подсвечиваются рамкой и вспышкой.
 */
function Slots({ g, save }: { g: GambleStore; save: GambleSave }) {
  const [bet, setBet] = useState(25);
  const [reels, setReels] = useState<SlotSymbol[]>(["burger", "tooth", "bolt"]);
  /** null — ещё не крутили; иначе итог последнего спина */
  const [res, setRes] = useState<{ pay: number; net: number; kind: "trip" | "pair" | "miss"; sym: SlotSymbol | null } | null>(null);
  const [spinning, setSpinning] = useState(false);
  /** какие барабаны уже встали — для поочерёдной остановки */
  const [stopped, setStopped] = useState([true, true, true]);
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach((t) => { clearTimeout(t); clearInterval(t); }); }, []);

  const spin = () => {
    if (spinning || g.chips < bet) return;
    timers.current.forEach((t) => { clearTimeout(t); clearInterval(t); });
    timers.current = [];

    setSpinning(true);
    setRes(null);
    setStopped([false, false, false]);
    sfx.click();
    haptic("light");

    const final: SlotSymbol[] = [spinReel(), spinReel(), spinReel()];

    // Лента крутится, пока барабан не остановлен
    const iv = window.setInterval(() => {
      setReels((prev) => prev.map((cur, i) => (stoppedRef.current[i] ? cur : spinReel())));
    }, 60);
    timers.current.push(iv);

    [560, 900, 1260].forEach((ms, i) => {
      const t = window.setTimeout(() => {
        stoppedRef.current[i] = true;
        setStopped((prev) => { const n = [...prev]; n[i] = true; return n; });
        setReels((prev) => { const n = [...prev]; n[i] = final[i]; return n; });
        sfx.tap?.();
        haptic("light");

        if (i === 2) {
          clearInterval(iv);
          const pay = slotPayout(final, bet);
          const net = pay - bet;
          const trip = final[0] === final[1] && final[1] === final[2];
          const pairSym = final[0] === final[1] ? final[0]
            : final[1] === final[2] ? final[1]
            : final[0] === final[2] ? final[0] : null;

          setRes({
            pay,
            net,
            kind: trip ? "trip" : pairSym ? "pair" : "miss",
            sym: trip ? final[0] : pairSym,
          });
          setSpinning(false);

          save((x) => ({
            chips: x.chips - bet + pay,
            spins: x.spins + 1,
            won: pay > 0 ? x.won + pay : x.won,
            lost: x.lost + bet,
          }));

          if (net > 0) { sfx.crit?.(); haptic("success"); }
          else { haptic("light"); }
        }
      }, ms);
      timers.current.push(t);
    });
  };

  // ref, чтобы интервал видел актуальные остановки без пересоздания
  const stoppedRef = useRef([true, true, true]);
  useEffect(() => { stoppedRef.current = stopped; }, [stopped]);

  /** какие барабаны входят в комбинацию — их подсвечиваем */
  const litReel = (i: number) => {
    if (!res || res.kind === "miss" || !res.sym) return false;
    return reels[i] === res.sym;
  };

  const tone = !res ? null
    : res.net > 0 ? "win"
    : res.pay > 0 ? "part"
    : "miss";

  const toneColor = tone === "win" ? "var(--ok)"
    : tone === "part" ? "var(--warn)"
    : "var(--text-mute)";

  return (
    <>
      <Panel r="lg" style={{ padding: 16, marginBottom: 12 }}>
        {/* Барабаны */}
        <div className="flex" style={{ gap: 8, marginBottom: 14 }}>
          {reels.map((r, i) => (
            <div
              key={i}
              className="flex-1 relative overflow-hidden"
              style={{
                height: 92,
                borderRadius: "var(--r-md)",
                background: "var(--surface-2)",
                border: `1.5px solid ${litReel(i) ? toneColor : "var(--btn-brd)"}`,
                boxShadow: litReel(i) ? `0 0 0 2px color-mix(in srgb, ${toneColor} 26%, transparent)` : "none",
                transition: "border-color .18s, box-shadow .18s",
              }}
            >
              {/* вспышка на выигрышном барабане */}
              <AnimatePresence>
                {litReel(i) && (
                  <motion.div
                    className="absolute inset-0"
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    style={{ background: toneColor, pointerEvents: "none" }}
                  />
                )}
              </AnimatePresence>

              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  key={`${i}-${r}-${stopped[i]}`}
                  initial={stopped[i] ? { y: -34, opacity: 0.25 } : { y: -30, opacity: 0.35 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={stopped[i]
                    ? { type: "spring", stiffness: 420, damping: 24 }
                    : { duration: 0.06, ease: "linear" }}
                >
                  <SlotGlyph id={r} />
                </motion.div>
              </div>
            </div>
          ))}
        </div>

        {/* Результат: честный, по чистому итогу */}
        <div style={{ minHeight: 46, marginBottom: 12 }}>
          <AnimatePresence mode="wait">
            {res && (
              <motion.div
                key={`${res.pay}-${res.net}`}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="flex items-center justify-center"
                style={{
                  gap: 9, padding: "9px 12px", borderRadius: "var(--r-sm)",
                  background: tone === "miss" ? "var(--surface-2)"
                    : `color-mix(in srgb, ${toneColor} 15%, var(--surface-2))`,
                  border: `1px solid ${tone === "miss" ? "var(--btn-brd)" : toneColor}`,
                }}
              >
                <span className="t-title-sm clip1" style={{ color: toneColor, fontSize: 14 }}>
                  {res.net > 0
                    ? `${tr("ВЫИГРЫШ")} +${fmt(res.net)}`
                    : res.pay > 0
                      ? `${tr("Вернулось")} ${fmt(res.pay)} ${tr("из")} ${fmt(bet)}`
                      : `${tr("Мимо")} −${fmt(bet)}`}
                </span>
                {res.kind !== "miss" && (
                  <span className="t-caption shrink-0" style={{ fontSize: 10 }}>
                    {res.kind === "trip" ? tr("ТРОЙКА") : tr("ПАРА")}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Ставка */}
        <div className="t-label" style={{ fontSize: 9, marginBottom: 6 }}>{tr("СТАВКА")}</div>
        <div className="flex" style={{ gap: 6, marginBottom: 12 }}>
          {BETS.map((b) => (
            <button
              key={b}
              type="button"
              disabled={spinning}
              onClick={() => { sfx.click(); setBet(b); }}
              className="t-num flex-1"
              style={{
                padding: "9px 0", borderRadius: "var(--r-sm)", fontSize: 12,
                background: bet === b ? "var(--acc)" : "var(--btn-bg)",
                color: bet === b ? "var(--acc-ink)" : "var(--text-mute)",
                border: `1px solid ${bet === b ? "var(--acc)" : "var(--btn-brd)"}`,
                opacity: g.chips < b ? 0.45 : 1,
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
          {spinning ? tr("КРУТИТСЯ…") : g.chips < bet ? tr("НЕ ХВАТАЕТ ЖЕТОНОВ") : `${tr("КРУТИТЬ ЗА")} ${bet}`}
        </Tap>
      </Panel>

      {/* Таблица выплат: с честной пометкой, что младшая пара — это возврат части ставки */}
      <Panel r="lg" style={{ padding: 14 }}>
        <div className="t-label" style={{ marginBottom: 10 }}>{tr("Выплаты")}</div>
        <div className="flex items-center" style={{ gap: 10, paddingBottom: 6 }}>
          <span style={{ width: 18 }} />
          <span className="t-caption flex-1" style={{ fontSize: 9.5 }}>{tr("три подряд")}</span>
          <span className="t-caption shrink-0" style={{ fontSize: 9.5, width: 62, textAlign: "right" }}>{tr("пара")}</span>
        </div>
        {SLOT_SYMBOLS.map((s) => (
          <div
            key={s.id}
            className="flex items-center"
            style={{ gap: 10, padding: "6px 0", borderTop: "1px solid var(--surface-brd)" }}
          >
            <SlotGlyph id={s.id} size={18} />
            <span className="t-num flex-1" style={{ fontSize: 12, color: "var(--ok)" }}>×{s.pay3}</span>
            <span
              className="t-num shrink-0"
              style={{
                fontSize: 12, width: 62, textAlign: "right",
                color: s.pay2 >= 1 ? "var(--ok)" : "var(--warn)",
              }}
            >
              ×{s.pay2}
            </span>
          </div>
        ))}
        <div className="t-caption" style={{ marginTop: 9, lineHeight: 1.5 }}>
          {tr("Жёлтая пара платит меньше ставки — часть жетонов возвращается, но спин всё равно в минус.")}
        </div>
      </Panel>
    </>
  );
}

/* ═══════════════════════════ КЕЙСЫ ═══════════════════════════ */

function Cases({ g, save }: { g: GambleStore; save: GambleSave }) {
  /*
   * Удача главного друга реально влияет на дроп. В карточке друга давно
   * написано «+N% к редким дропам», но число никуда не передавалось —
   * теперь оно идёт в rollItem и двигает шансы rare/epic/legend.
   */
  const { s: save0 } = useGame();
  const luck = bossStats(save0).luckBonus;
  const [opening, setOpening] = useState<GambleCase | null>(null);
  const [got, setGot] = useState<ItemDef | null>(null);
  const [roll, setRoll] = useState<ItemDef[]>([]);

  const open = (c: GambleCase) => {
    if (g.chips < c.price || opening) return;
    const prize = rollItem(c, luck);
    // лента прокрутки: случайные предметы, приз — предпоследний
    const strip = Array.from({ length: 26 }, () => rollItem(c, luck));
    strip[22] = prize;
    setRoll(strip);
    setOpening(c);
    setGot(null);
    save((x) => ({ chips: Math.max(0, x.chips - c.price) }));
    sfx.click();
    haptic("light");

    window.setTimeout(() => {
      setGot(prize);
      save((x) => ({
        // chips не пересчитываем: ставку сняли сразу, приз только кладём
        items: shiftItem(x, prize.id, 1),
      }));
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
            style={{ background: "var(--scrim-strong)", backdropFilter: "blur(16px)" }}
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

function Battle({ g, save }: { g: GambleStore; save: GambleSave }) {
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
    save((x) => ({ chips: Math.max(0, x.chips - cost) }));
    sfx.click();

    // раунды открываются по одному
    for (let i = 1; i <= rounds; i++) {
      const t = window.setTimeout(() => {
        setStep(i);
        sfx.click();
        haptic("light");
        if (i === rounds) {
          save((x) => {
            // победитель забирает всё; проигравший остаётся при своём
            let items = x.items;
            if (res.win) {
              for (const r of res.list) {
                items = shiftItem({ ...x, items }, r.mine.id, 1);
                items = shiftItem({ ...x, items }, r.foe.id, 1);
              }
            }
            return {
              items,
              battles: x.battles + 1,
              battleWins: x.battleWins + (res.win ? 1 : 0),
            };
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
                  color: live.win ? "var(--ok)" : "var(--danger)",
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

function Upgrade({ g, save }: { g: GambleStore; save: GambleSave }) {
  const owned = Object.entries(g.items).filter(([, n]) => n > 0);
  const [fromId, setFromId] = useState<string | null>(owned[0]?.[0] ?? null);
  const [multId, setMultId] = useState(WHEEL_MULTS[1].id);
  const [fast, setFast] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [res, setRes] = useState<null | { zone: WheelZone; gained: number }>(null);
  const [help, setHelp] = useState(false);

  const from = fromId ? itemById(fromId) : null;
  const mult = WHEEL_MULTS.find((m) => m.id === multId) ?? WHEEL_MULTS[1];
  const sectors = buildWheel(mult.mult);
  const chance = winChance(mult.mult);

  // Если предмет кончился, переключаемся на любой оставшийся
  useEffect(() => {
    if (fromId && !g.items[fromId]) setFromId(Object.keys(g.items)[0] ?? null);
  }, [g.items, fromId]);

  /**
   * ЗАВИСАНИЕ КОЛЕСА — что было сломано.
   *
   * Раньше результат прокрутки лежал в `finishRef`, куда клали ЗНАЧЕНИЕ,
   * ВОЗВРАЩЁННОЕ функцией `go()`. Если `go()` уходила в ранний `return`
   * (нет предмета, повторный тап по «КРУТИТЬ» до того, как React применил
   * `setSpinning(true)`), в реф попадал `null`. Колесо при этом уже
   * стартовало, доезжало, дёргало `onDone` — а там `null?.()`, то есть
   * ничего. `spinning` навсегда оставался `true`: кнопка «КРУТИТСЯ…»
   * заблокирована, предметы не выбираются, выйти можно только сменой
   * вкладки. Ровно жалоба «колесо зависло».
   *
   * Теперь итог прокрутки — обычный ref с данными (не с функцией),
   * повторный запуск отсекается тем же рефом, а на случай, если кадры
   * RAF вообще не пойдут (вкладка ушла в фон, слабый телефон), стоит
   * страховочный таймер: он доведёт спин до конца в любом случае.
   */
  const pendingRef = useRef<null | { zone: WheelZone; itemId: string; staked: number; mult: number }>(null);
  const guardRef = useRef(0);

  const settle = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    window.clearTimeout(guardRef.current);

    const gained = zonePayout(p.zone, p.staked, p.mult);
    // Выигрыш и утешительные выплаты приходят жетонами: подбирать
    // предмет ровно нужной цены не всегда возможно.
    save((x) => ({ items: shiftItem(x, p.itemId, -1), chips: x.chips + gained }));
    setRes({ zone: p.zone, gained });
    setSpinning(false);
    wheelStopFeedback(p.zone === "win");
  }, [save]);

  const start = () => {
    if (!from || spinning || pendingRef.current) return;
    setRes(null);
    const r = spinTo(sectors, mult.mult);
    pendingRef.current = { zone: r.zone, itemId: from.id, staked: from.value, mult: mult.mult };
    setAngle(r.angle);
    setSpinning(true);
    sfx.click();
    // страховка: колесо обязано остановиться, даже если кадры не пришли
    window.clearTimeout(guardRef.current);
    guardRef.current = window.setTimeout(settle, (fast ? 1200 : 4200) + 1500);
  };

  // если компонент размонтировали в середине спина — не оставляем таймер
  useEffect(() => () => window.clearTimeout(guardRef.current), []);

  if (!owned.length) {
    return (
      <Panel r="lg" style={{ padding: 22, textAlign: "center" }}>
        <Icon name="case" size={30} />
        <div className="t-title-sm" style={{ marginTop: 10 }}>{tr("Нечего апгрейдить")}</div>
        <div className="t-caption" style={{ marginTop: 6 }}>{tr("Открой кейс — появятся предметы.")}</div>
      </Panel>
    );
  }

  const zoneColor = (z: WheelZone) =>
    z === "win" ? "var(--ok)" : z === "burn" ? "var(--danger)" : "var(--gold)";

  return (
    <>
      {/* Объяснение было простынёй на пол-экрана и оттесняло само колесо
          вниз. Свернули в одну строку с раскрытием по тапу. */}
      <button
        type="button"
        onClick={() => { sfx.click(); setHelp((v) => !v); }}
        className="w-full flex items-center"
        style={{
          gap: 9, padding: "10px 13px", marginBottom: 10,
          borderRadius: "var(--r-md)",
          background: "var(--surface)", border: "1px solid var(--surface-brd)",
          textAlign: "left",
        }}
      >
        <Icon name="info" size={14} />
        <span className="t-label flex-1" style={{ fontSize: 9.5 }}>{tr("КАК ЭТО РАБОТАЕТ")}</span>
        <span style={{ transform: help ? "rotate(90deg)" : "none", transition: "transform .18s", lineHeight: 0 }}>
          <Icon name="chevron" size={13} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {help && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
          >
            <Panel r="lg" style={{ padding: 13, marginBottom: 12 }}>
              <div className="t-caption" style={{ lineHeight: 1.65, fontSize: 11.5 }}>
                {tr("Ставишь предмет и выбираешь множитель. Зелёный сектор — забрал, оранжевый — вернулась часть жетонами, красный — сгорело. Чем жирнее множитель, тем тоньше зелёный сектор.")}
              </div>
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>

      <Panel r="lg" style={{ padding: 15, marginBottom: 12 }}>
        <div className="t-label" style={{ marginBottom: 9 }}>{tr("1 · ЧТО СТАВИМ")}</div>
        <div className="flex flex-wrap" style={{ gap: 6, marginBottom: 16 }}>
          {owned.map(([id, n]) => {
            const it = itemById(id);
            if (!it) return null;
            const on = fromId === id;
            return (
              <button
                key={id}
                type="button"
                disabled={spinning}
                onClick={() => { sfx.click(); setFromId(id); setRes(null); }}
                className="flex items-center"
                style={{
                  gap: 7, padding: "9px 12px", borderRadius: "var(--r-sm)",
                  // выбранный предмет заливаем его же цветом редкости,
                  // а не «чуть светлее серого» — раньше выбор был не виден
                  background: on
                    ? `color-mix(in srgb, ${RARITY_COLOR[it.rarity]} 24%, var(--surface))`
                    : "var(--btn-bg)",
                  border: `1.5px solid ${on ? RARITY_COLOR[it.rarity] : "var(--btn-brd)"}`,
                  boxShadow: on ? `0 0 0 3px color-mix(in srgb, ${RARITY_COLOR[it.rarity]} 22%, transparent)` : "none",
                  color: on ? "var(--text)" : RARITY_COLOR[it.rarity],
                  opacity: spinning ? 0.45 : 1,
                }}
              >
                <ItemIcon id={id} size={18} />
                <span className="t-num" style={{ fontSize: 11.5 }}>×{n}</span>
              </button>
            );
          })}
        </div>

        <div className="t-label" style={{ marginBottom: 9 }}>{tr("2 · МНОЖИТЕЛЬ")}</div>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {WHEEL_MULTS.map((m) => {
            const on = multId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={spinning}
                onClick={() => { sfx.click(); setMultId(m.id); setRes(null); }}
                style={{
                  padding: "9px 14px", borderRadius: "var(--r-sm)",
                  background: on ? "var(--acc)" : "var(--btn-bg)",
                  color: on ? "var(--acc-ink)" : "var(--text)",
                  border: `1.5px solid ${on ? "var(--acc)" : "var(--btn-brd)"}`,
                  opacity: spinning ? 0.45 : 1,
                }}
              >
                <span className="t-num" style={{ fontSize: 12.5 }}>{m.label}</span>
                <span className="t-label" style={{ fontSize: 8, display: "block", marginTop: 2, opacity: 0.8 }}>
                  {(winChance(m.mult) * 100).toFixed(0)}%
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      {from && (
        <Panel r="lg" style={{ padding: 15 }}>
          <Wheel
            sectors={sectors}
            angle={angle}
            spinning={spinning}
            duration={fast ? 1200 : 4200}
            onDone={settle}
            centerLabel={`${(chance * 100).toFixed(0)}%`}
            centerSub={tr("ШАНС")}
          />

          <div
            className="flex items-center justify-center"
            style={{ gap: 8, marginTop: 12, marginBottom: 12 }}
          >
            <span style={{ color: RARITY_COLOR[from.rarity], lineHeight: 0 }}>
              <ItemIcon id={from.id} size={26} />
            </span>
            <Icon name="chevron" size={14} />
            <span className="t-num acc-text" style={{ fontSize: 16 }}>{mult.label}</span>
          </div>

          <AnimatePresence mode="wait">
            {res && (
              <motion.div
                key={`${res.zone}-${res.gained}`}
                initial={{ opacity: 0, y: 8, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
                style={{
                  marginBottom: 12, padding: "11px 12px",
                  borderRadius: "var(--r-md)",
                  // цвет не только в анимации, но и в самом итоге —
                  // сразу видно, выиграл ты или сгорело
                  background: `color-mix(in srgb, ${zoneColor(res.zone)} 16%, var(--surface))`,
                  border: `1.5px solid ${zoneColor(res.zone)}`,
                }}
              >
                <div className="t-title" style={{ fontSize: 15, color: zoneColor(res.zone) }}>
                  {tr(ZONE_LABEL[res.zone])}
                </div>
                {res.gained > 0 && (
                  <div className="t-num" style={{ fontSize: 21, marginTop: 3, color: "var(--gold)" }}>
                    +{fmt(res.gained)} <span className="t-label" style={{ fontSize: 9 }}>{tr("ЖЕТОНОВ")}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Быстрый режим — отдельным переключателем, как просили */}
          <button
            type="button"
            onClick={() => { setFast((v) => !v); sfx.click(); }}
            className="flex items-center justify-center w-full"
            style={{
              gap: 8, padding: "9px 0", marginBottom: 9,
              borderRadius: "var(--r-sm)",
              background: fast ? "var(--acc-soft)" : "var(--btn-bg)",
              border: `1px solid ${fast ? "var(--acc)" : "var(--btn-brd)"}`,
              color: fast ? "var(--acc)" : "var(--text-mute)",
            }}
          >
            <Icon name="speed" size={14} />
            <span className="t-label" style={{ fontSize: 10 }}>
              {fast ? tr("БЫСТРЫЙ АПГРЕЙД") : tr("ОБЫЧНЫЙ АПГРЕЙД")}
            </span>
          </button>

          {/* Главная кнопка: раньше она была такой же серой, как всё
              вокруг, и было «непонятно куда жать». */}
          <button
            type="button"
            onClick={start}
            disabled={spinning}
            className="btn-acc w-full"
            style={{ minHeight: 54, fontSize: 14.5, opacity: spinning ? 0.55 : 1 }}
          >
            {spinning ? tr("КРУТИТСЯ…") : `${tr("КРУТИТЬ")} · ${mult.label}`}
          </button>
        </Panel>
      )}
    </>
  );
}

/* ═══════════════════════════ ФЕРМА ЖЕТОНОВ ═══════════════════════════ */

/**
 * Мини-игра на жетоны: по столу разлетаются фишки, надо успевать
 * ловить их пальцем, пока не вышло время.
 *
 * Зачем: раньше жетоны капали только по 60 штук раз в 20 минут, и
 * проиграв их, оставалось только ждать. Теперь казино можно фармить.
 *
 * Заработок ограничен временем раунда, а не количеством нажатий, так
 * что «настучать» бесконечно не выйдет: за 20 секунд физически
 * успеваешь поймать ограниченное число фишек.
 */

const FARM_MS = 20000;
const FARM_SPAWN_MS = 620;

interface FarmChip {
  id: number;
  x: number;
  y: number;
  born: number;
  life: number;
  val: number;
  gold: boolean;
  /** уже собрана — проигрываем вылет и убираем */
  taken?: boolean;
}

/**
 * ФЕРМА ЖЕТОНОВ.
 *
 * Жалоба «ферма неудобная». Что чинили:
 *   1. Собирать можно было ТОЛЬКО тапом по каждой фишке. Это противоречит
 *      общему правилу «вести пальцем, а не только тапать»: за 20 секунд
 *      появляется 32 фишки, и попасть по каждой отдельным тапом физически
 *      неуспеваемо. Теперь палец можно вести — фишка собирается при
 *      касании траекторией (pointermove + проверка радиуса).
 *   2. Промах сбрасывал комбо в ноль молча. Теперь комбо видно всегда,
 *      а не только со второй фишки, и рядом написано, что оно даёт.
 *   3. Не было видно, сколько времени осталось, кроме мелкой цифры —
 *      добавлена полоса.
 *
 * Экономика (проверено расчётом /tmp/farm.mjs): 32 фишки за раунд,
 * при 70 % точности ≈ 280 жетонов = 11 спинов по 25. Ферма остаётся
 * основным бесплатным источником, поэтому награда не режется.
 */
function ChipFarm({ save }: { save: GambleSave }) {
  const [phase, setPhase] = useState<"idle" | "play" | "over">("idle");
  const [chips, setChips] = useState<FarmChip[]>([]);
  const [earned, setEarned] = useState(0);
  const [left, setLeft] = useState(FARM_MS);
  const [combo, setCombo] = useState(0);
  const [missed, setMissed] = useState(0);
  const areaRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const endAt = useRef(0);
  const lastSpawn = useRef(0);
  const rafRef = useRef(0);
  const comboRef = useRef(0);
  const chipsRef = useRef<FarmChip[]>([]);
  useEffect(() => { chipsRef.current = chips; }, [chips]);

  const start = () => {
    setChips([]); setEarned(0); setCombo(0); comboRef.current = 0;
    setMissed(0);
    setLeft(FARM_MS);
    endAt.current = performance.now() + FARM_MS;
    lastSpawn.current = 0;
    setPhase("play");
    sfx.power?.();
    haptic("medium");
  };

  // Цикл игры: спавн фишек и их старение
  useEffect(() => {
    if (phase !== "play") return;
    const loop = (now: number) => {
      const remain = endAt.current - now;
      setLeft(Math.max(0, remain));
      if (remain <= 0) {
        setPhase("over");
        sfx.gameOver?.();
        return;
      }
      if (now - lastSpawn.current > FARM_SPAWN_MS) {
        lastSpawn.current = now;
        const gold = Math.random() < 0.16;
        setChips((cs) => {
          // просроченные считаем промахом и рвём комбо
          const expired = cs.filter((c) => !c.taken && now - c.born >= c.life).length;
          if (expired > 0) {
            comboRef.current = 0;
            setCombo(0);
            setMissed((m) => m + expired);
          }
          return [
            ...cs.filter((c) => now - c.born < c.life),
            {
              id: nextId.current++,
              x: 10 + Math.random() * 80,
              y: 12 + Math.random() * 72,
              born: now,
              life: gold ? 1150 : 1700,
              val: gold ? 25 : 8,
              gold,
            },
          ];
        });
      } else {
        setChips((cs) => {
          const expired = cs.filter((c) => !c.taken && now - c.born >= c.life).length;
          if (expired > 0) {
            comboRef.current = 0;
            setCombo(0);
            setMissed((m) => m + expired);
          }
          const alive = cs.filter((c) => now - c.born < c.life);
          return alive.length === cs.length ? cs : alive;
        });
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  // Награда начисляется один раз в конце раунда
  const paid = useRef(false);
  useEffect(() => {
    if (phase !== "over" || paid.current) return;
    paid.current = true;
    if (earned > 0) {
      save((x) => ({ chips: x.chips + earned }));
      sfx.coin?.();
      haptic("success");
    }
  }, [phase, earned, save]);

  useEffect(() => { if (phase === "play") paid.current = false; }, [phase]);

  const grab = useCallback((c: FarmChip) => {
    if (c.taken) return;
    comboRef.current += 1;
    setCombo(comboRef.current);
    const bonus = 1 + Math.min(comboRef.current, 10) * 0.05;
    setEarned((e) => e + Math.round(c.val * bonus));
    // помечаем собранной — анимация вылета, затем удаление
    setChips((cs) => cs.map((x) => (x.id === c.id ? { ...x, taken: true } : x)));
    window.setTimeout(() => {
      setChips((cs) => cs.filter((x) => x.id !== c.id));
    }, 220);
    if (c.gold) { sfx.crit?.(); haptic("medium"); }
    else { sfx.coin?.(); haptic("light"); }
  }, []);

  /**
   * Сбор пальцем: на каждое движение проверяем, не задели ли фишку.
   * Радиус берём щедрый (половина размера + 6 px), иначе на быстром
   * ведении палец «перепрыгивает» фишку между кадрами.
   */
  const sweep = useCallback((e: React.PointerEvent) => {
    if (phase !== "play") return;
    const box = areaRef.current?.getBoundingClientRect();
    if (!box) return;
    const px = e.clientX - box.left;
    const py = e.clientY - box.top;
    for (const c of chipsRef.current) {
      if (c.taken) continue;
      const cx = (c.x / 100) * box.width;
      const cy = (c.y / 100) * box.height;
      const r = (c.gold ? 52 : 44) / 2 + 6;
      if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r) { grab(c); break; }
    }
  }, [phase, grab]);

  const secs = (left / 1000).toFixed(1);
  const mult = 1 + Math.min(combo, 10) * 0.05;
  const progress = Math.max(0, Math.min(1, left / FARM_MS));

  return (
    <>
      <Panel r="lg" style={{ padding: 13, marginBottom: 12 }}>
        <div className="t-label" style={{ marginBottom: 7, fontSize: 9.5 }}>{tr("КАК ЭТО РАБОТАЕТ")}</div>
        <div className="t-caption" style={{ lineHeight: 1.6, fontSize: 11 }}>
          {tr("Двадцать секунд на то, чтобы собирать фишки. Веди пальцем по экрану — фишки собираются касанием, тапать по каждой не нужно. Золотая дороже, но живёт меньше. Ловишь без промаха — растёт комбо и надбавка.")}
        </div>
      </Panel>

      <Panel r="lg" style={{ padding: 14 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <div className="min-w-0">
            <div className="t-label" style={{ fontSize: 9 }}>{tr("НАЛОВИЛ")}</div>
            <div className="t-num acc-text" style={{ fontSize: 22, lineHeight: 1.1 }}>{fmt(earned)}</div>
          </div>
          <div className="text-center shrink-0" style={{ minWidth: 66 }}>
            <div className="t-label" style={{ fontSize: 9 }}>{tr("КОМБО")}</div>
            <div
              className="t-num"
              style={{ fontSize: 22, lineHeight: 1.1, color: combo > 0 ? "var(--ok)" : "var(--text-mute)" }}
            >
              ×{mult.toFixed(2)}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="t-label" style={{ fontSize: 9 }}>{tr("ВРЕМЯ")}</div>
            <div
              className="t-num"
              style={{ fontSize: 22, lineHeight: 1.1, color: left < 5000 ? "var(--danger)" : undefined }}
            >
              {phase === "play" ? secs : (FARM_MS / 1000).toFixed(1)}
            </div>
          </div>
        </div>

        {/* Полоса времени — цифру в углу на бегу не читают */}
        <div
          style={{
            height: 5, borderRadius: 999, background: "var(--surface-2)",
            overflow: "hidden", marginBottom: 10,
          }}
        >
          <div
            style={{
              height: "100%", width: `${progress * 100}%`,
              background: left < 5000 ? "var(--danger)" : "var(--acc)",
              transition: "width .1s linear",
            }}
          />
        </div>

        <div
          ref={areaRef}
          onPointerDown={(e) => { e.preventDefault(); sweep(e); }}
          onPointerMove={sweep}
          style={{
            position: "relative", width: "100%", height: 280,
            borderRadius: "var(--r-md)",
            background: "var(--surface-2)",
            border: "1px solid var(--surface-brd)",
            overflow: "hidden", touchAction: "none",
            cursor: phase === "play" ? "pointer" : "default",
          }}
        >
          {phase === "play" && chips.map((c) => (
            <motion.div
              key={c.id}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={c.taken
                ? { scale: 1.5, opacity: 0, y: -22 }
                : { scale: 1, opacity: 1, y: 0 }}
              transition={c.taken
                ? { duration: 0.22, ease: "easeOut" }
                : { type: "spring", stiffness: 520, damping: 22 }}
              style={{
                position: "absolute",
                left: `${c.x}%`, top: `${c.y}%`,
                transform: "translate(-50%, -50%)",
                width: c.gold ? 52 : 44, height: c.gold ? 52 : 44,
                marginLeft: c.gold ? -26 : -22,
                marginTop: c.gold ? -26 : -22,
                borderRadius: "50%",
                background: c.gold ? "var(--acc)" : "var(--surface)",
                border: `2.5px solid ${c.gold ? "var(--gold-brd)" : "var(--btn-brd)"}`,
                color: c.gold ? "var(--acc-ink)" : "var(--text)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: c.gold ? "0 4px 16px -4px var(--acc-glow)" : "none",
                pointerEvents: "none",
              }}
            >
              <span className="t-num" style={{ fontSize: c.gold ? 13 : 11 }}>{c.val}</span>
            </motion.div>
          ))}

          {phase !== "play" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{ padding: 20, textAlign: "center" }}
            >
              {phase === "over" ? (
                <>
                  <div className="t-display" style={{ fontSize: 24 }}>{tr("ВРЕМЯ ВЫШЛО")}</div>
                  <div className="t-num acc-text" style={{ fontSize: 34, marginTop: 6 }}>
                    +{fmt(earned)}
                  </div>
                  <div className="t-caption" style={{ marginTop: 4 }}>{tr("жетонов на счёт")}</div>
                  {missed > 0 && (
                    <div className="t-caption" style={{ marginTop: 6, color: "var(--text-mute)" }}>
                      {tr("Упустил")}: {missed}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Icon name="coin" size={34} />
                  <div className="t-title-sm" style={{ marginTop: 10 }}>{tr("ФЕРМА ЖЕТОНОВ")}</div>
                  <div className="t-caption" style={{ marginTop: 6, lineHeight: 1.55 }}>
                    {tr("Веди пальцем по полю — фишки собираются сами. Бесплатно, играй сколько хочешь.")}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <Tap
          onClick={start}
          accent r="md" center
          className="w-full py-3.5 t-title"
          style={{ fontSize: 14, marginTop: 12, opacity: phase === "play" ? 0.5 : 1 }}
          sound="power"
        >
          {phase === "play" ? tr("ЛОВИ!") : phase === "over" ? tr("ЕЩЁ РАЗ") : tr("НАЧАТЬ")}
        </Tap>
      </Panel>
    </>
  );
}

/* ═══════════════════════════ ВЕЩИ ═══════════════════════════ */

function Stuff({ g, save }: { g: GambleStore; save: GambleSave }) {
  const owned = Object.entries(g.items).filter(([, n]) => n > 0);

  const sell = (id: string) => {
    const it = itemById(id);
    if (!it) return;
    save((x) => {
      const items = shiftItem(x, id, -1);
      const eq = { ...x.equipped };
      if (eq[it.kind] === id && !items[id]) delete eq[it.kind];
      return { items, equipped: eq, chips: x.chips + Math.floor(it.value * 0.6) };
    });
    sfx.coin?.();
    haptic("light");
  };

  const equip = (it: ItemDef) => {
    const eq = { ...g.equipped };
    if (eq[it.kind] === it.id) delete eq[it.kind];
    else eq[it.kind] = it.id;
    save(() => ({ equipped: eq }));
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
      {/*
        Подсказка, что надетое реально видно на герое. Раньше «надеть»
        ничего не меняло: предмет помечался, но на голове не появлялся.
      */}
      <Panel r="lg" style={{ padding: "10px 12px", marginBottom: 8 }}>
        <div className="t-caption" style={{ fontSize: 10.5, lineHeight: 1.4 }}>
          {tr("Надетые украшения видно на главном друге во вкладке «Персонажи».")}
        </div>
      </Panel>

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
