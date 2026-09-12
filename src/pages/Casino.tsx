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
  FREE_CHIPS, GAMBLE_CASES, SLOT_SYMBOLS, freeChipsIn, freeChipsReady, symbolName,
  ITEMS, itemById, readGamble, rollItem, runBattle, shiftItem, slotPayout, spinReel,
  updateGamble,
  type GambleCase, type GambleSave, type GambleStore, type ItemDef, type SkinKind, type SlotSymbol,
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
          {tab === "farm"    && <ChipFarm save={save} onTab={setTab} />}
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
 * СЛОТЫ.
 *
 * Просьба: «Слоты должны выглядеть как реальное казино: шик, чтобы видно
 * было, что лента листается, и чтобы символам были подписи».
 *
 * Что было: три плашки, в которых каждые 60 мс менялась одна иконка. Это не
 * «листается» — это мигающие картинки; и подписи отсутствовали, поэтому
 * таблица выплат читалась как набор цифр без языка.
 *
 * Что стало:
 *   1. Настоящая лента: у каждого барабана свой столбец символов, он едет
 *      сверху вниз и тормозит на своём символе (у барабанов разная длина —
 *      30/34/38 позиций, поэтому они останавливаются по очереди, как в
 *      живом автомате, а не все разом).
 *   2. Видно три строки: целевая по центру в светлом «окне», соседние —
 *      затемнённые. Линия выплат поперёк окна.
 *   3. Под каждым символом — его имя; те же имена в таблице выплат, рядом с
 *      множителями.
 *   4. «Шик»: тёмное сукно, золотая рамка с внутренним бликом, подсветка
 *      сверху, вспышка на выигрышных барабанах, счётчик последних исходов
 *      (чтобы полоса результата не была единственной подсказкой).
 *   5. Честный итог: считаем ЧИСТЫЙ результат (выплата минус ставка) —
 *      игрок видел зелёный плюс и терял жетоны; теперь плюс зелёным, частичный
 *      возврат — жёлтым «вернулось», мимо — серым «−ставка».
 */
function Slots({ g, save }: { g: GambleStore; save: GambleSave }) {
  const [bet, setBet] = useState(25);
  /** длина ленты каждого барабана: разная — поэтому остановка по очереди */
  const LEN = [30, 34, 38];
  const [pos, setPos] = useState<number[]>([0, 0, 0]);
  const [strips, setStrips] = useState<SlotSymbol[][]>([[], [], []]);
  const [reels, setReels] = useState<SlotSymbol[]>(["burger", "tooth", "bolt"]);
  /** null — ещё не крутили; иначе итог последнего спина */
  const [res, setRes] = useState<{ pay: number; net: number; kind: "trip" | "pair" | "miss"; sym: SlotSymbol | null } | null>(null);
  const [spinning, setSpinning] = useState(false);
  /** чем кончались последние спины — маленькая бегущая строка казино */
  const [hist, setHist] = useState<{ net: number; sym: SlotSymbol | null }[]>([]);
  const timers = useRef<number[]>([]);
  const posRef = useRef(pos);
  posRef.current = pos;
  const endedRef = useRef(0);

  useEffect(() => () => { timers.current.forEach((t) => { clearTimeout(t); clearInterval(t); }); }, []);

  /** один барабан: едет, пока не дойдёт до своего символа */
  const runReel = (i: number, onEnd: () => void) => {
    const tick = () => {
      const left = LEN[i] - 1 - posRef.current[i];
      if (left <= 0) {
        sfx.tap?.();
        haptic("light");
        onEnd();
        return;
      }
      setPos((prev) => {
        const n = [...prev];
        // последние три позиции — торможение: лента «оседает» на символе
        n[i] = Math.min(LEN[i] - 1, n[i] + 1);
        return n;
      });
      const speed = left <= 3 ? 120 + (4 - left) * 90 : 40;
      timers.current.push(window.setTimeout(tick, speed));
    };
    tick();
  };

  const spin = () => {
    if (spinning || g.chips < bet) return;
    timers.current.forEach((t) => { clearTimeout(t); clearInterval(t); });
    timers.current = [];

    const final: SlotSymbol[] = [spinReel(), spinReel(), spinReel()];
    // лента: случайные символы, последний — итоговый
    setStrips(final.map((f, i) => {
      const arr = Array.from({ length: LEN[i] - 1 }, () => spinReel());
      arr.push(f);
      return arr;
    }));
    setPos([0, 0, 0]);
    posRef.current = [0, 0, 0];
    setReels(final);
    setSpinning(true);
    setRes(null);
    sfx.click();
    haptic("light");

    endedRef.current = 0;
    for (let i = 0; i < 3; i++) runReel(i, finish);

    function finish() {
      endedRef.current += 1;
      if (endedRef.current < 3) return;
      const pay = slotPayout(final, bet);
      const net = pay - bet;
      const trip = final[0] === final[1] && final[1] === final[2];
      const pairSym = final[0] === final[1] ? final[0]
        : final[1] === final[2] ? final[1]
        : final[0] === final[2] ? final[0] : null;
      const kind = trip ? "trip" : pairSym ? "pair" : "miss";
      const sym = trip ? final[0] : pairSym;

      setRes({ pay, net, kind, sym });
      setSpinning(false);
      setHist((h) => [{ net, sym }, ...h].slice(0, 6));
      save((x) => ({
        chips: x.chips - bet + pay,
        spins: x.spins + 1,
        won: pay > 0 ? x.won + pay : x.won,
        lost: x.lost + bet,
      }));

      if (net > 0) { sfx.crit?.(); haptic("success"); }
      else { haptic("light"); }
    }
  };

  /** какие барабаны входят в комбинацию — их подсвечиваем */
  const litReel = (i: number) => {
    if (!res || res.kind === "miss" || !res.sym) return false;
    return reels[i] === res.sym;
  };

  const tone = !res ? null
    : res.net > 0 ? "win"
    : res.pay > 0 ? "part"
    : "miss";

  return (
    <>
      {/* ── автомат ── */}
      <div className={`pc-slot ${tone === "win" ? "win" : ""}`}>
        <div className="pc-slot-top">
          <span className="t-label">{tr("СЛОТЫ «ЧУБКОЙ»")}</span>
          <span className="pc-slot-chips">
            <Icon name="ticket" size={12} />
            <b className="t-num">{fmt(g.chips)}</b>
          </span>
        </div>

        <div className="pc-slot-window">
          <span className="pc-slot-payline" aria-hidden />
          {[0, 1, 2].map((i) => (
            <div key={i} className={`pc-slot-reel ${litReel(i) ? "lit" : ""}`}>
              <div
                className="pc-slot-strip"
                style={{ transform: `translateY(calc(var(--cell) * ${-pos[i] + 1}))` }}
              >
                {strips[i].map((sym, k) => (
                  <div key={k} className="pc-slot-cell">
                    <SlotGlyph id={sym} size={34} />
                    <span className="pc-slot-cap">{tr(symbolName(sym))}</span>
                  </div>
                ))}
              </div>
              {litReel(i) && <span className="pc-slot-flash" aria-hidden />}
            </div>
          ))}
        </div>

        {/* исход спина — по чистому результату, а не по «красивому плюсу» */}
        <div className="pc-slot-out">
          <AnimatePresence mode="wait">
            {res ? (
              <motion.div
                key={`${res.pay}-${res.net}`}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className={`pc-slot-res ${tone}`}
              >
                <span className="t-title-sm clip1">
                  {res.net > 0
                    ? `${tr("ВЫИГРЫШ")} +${fmt(res.net)}`
                    : res.pay > 0
                      ? `${tr("Вернулось")} ${fmt(res.pay)} ${tr("из")} ${fmt(bet)}`
                      : `${tr("Мимо")} −${fmt(bet)}`}
                </span>
                {res.kind !== "miss" && (
                  <span className="t-caption">
                    {res.kind === "trip" ? tr("ТРОЙКА") : tr("ПАРА")} · {tr(symbolName(res.sym!))}
                  </span>
                )}
              </motion.div>
            ) : (
              <span className="pc-slot-idle t-label">
                {spinning ? tr("ЛЕНТА ИДЁТ…") : tr("СТАВКА ВЫБРАНА — КРУТИ")}
              </span>
            )}
          </AnimatePresence>

          {hist.length > 0 && (
            <span className="pc-slot-hist" title={tr("последние спины")}>
              {hist.map((h, i) => (
                <b key={i} className={`t-num ${h.net > 0 ? "up" : h.net < 0 ? "down" : "flat"}`}>
                  {h.net > 0 ? "+" : ""}{fmt(h.net)}
                </b>
              ))}
            </span>
          )}
        </div>

        {/* ставка */}
        <div className="pc-slot-bets">
          <span className="t-label">{tr("СТАВКА")}</span>
          <div className="pc-slot-betrow">
            {BETS.map((b) => (
              <button
                key={b}
                type="button"
                disabled={spinning}
                onClick={() => { sfx.click(); setBet(b); }}
                className={`pc-slot-bet t-num ${bet === b ? "on" : ""}`}
                style={{ opacity: g.chips < b ? 0.45 : 1 }}
                title={`${tr("поставить")} ${b}`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="pc-slot-go"
          onClick={spin}
          disabled={spinning || g.chips < bet}
        >
          <Icon name="dice" size={15} />
          {spinning ? tr("КРУТИТСЯ…") : g.chips < bet ? tr("НЕ ХВАТАЕТ ЖЕТОНОВ") : `${tr("КРУТИТЬ ЗА")} ${bet}`}
        </button>
      </div>

      {/* ── таблица выплат: символы с именами ── */}
      <Panel r="lg" style={{ padding: 14 }}>
        <div className="t-label" style={{ marginBottom: 10 }}>{tr("Выплаты")}</div>
        <div className="flex items-center" style={{ gap: 10, paddingBottom: 6 }}>
          <span style={{ width: 18 }} />
          <span className="t-caption flex-1" style={{ fontSize: 9.5 }}>{tr("символ")}</span>
          <span className="t-caption shrink-0" style={{ fontSize: 9.5, width: 54, textAlign: "right" }}>{tr("три подряд")}</span>
          <span className="t-caption shrink-0" style={{ fontSize: 9.5, width: 46, textAlign: "right" }}>{tr("пара")}</span>
        </div>
        {SLOT_SYMBOLS.map((sy) => (
          <div
            key={sy.id}
            className="flex items-center"
            style={{ gap: 10, padding: "6px 0", borderTop: "1px solid var(--surface-brd)" }}
          >
            <SlotGlyph id={sy.id} size={18} />
            <span className="t-body flex-1 clip1" style={{ fontSize: 11 }}>{tr(sy.name)}</span>
            <span className="t-num shrink-0" style={{ fontSize: 12, width: 54, textAlign: "right", color: "var(--ok)" }}>
              ×{sy.pay3}
            </span>
            <span
              className="t-num shrink-0"
              style={{
                fontSize: 12, width: 46, textAlign: "right",
                color: sy.pay2 >= 1 ? "var(--ok)" : "var(--warn)",
              }}
            >
              ×{sy.pay2}
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

/** куда надевается украшение — общий справочник (нужен и в кейсах, и в «Вещах») */
const ITEM_KIND_LABEL: Record<SkinKind, string> = {
  hat: tr("на голову"),
  glasses: tr("на лицо"),
  chain: tr("на шею"),
  aura: tr("вокруг героя"),
  pet: tr("рядом с героем"),
};



function Cases({ g, save }: { g: GambleStore; save: GambleSave }) {
  /*
   * Удача главного друга реально влияет на дроп. В карточке друга давно
   * написано «+N% к редким дропам», но число никуда не передавалось —
   * теперь оно идёт в rollItem и двигает шансы rare/epic/legend.
   *
   * Что переделано и почему (претензии: «кейсы не выглядят как кейсы»,
   * «модалка мелкая и неудобная, шансы нечитаемы», «вещи непонятны»):
   *
   *   1. Кейс теперь ВЫГЛЯД как кейс: алюминиевый корпус с бликом, ручка,
   *      замок-защёлка, уголки и цветная подсветка «начинки» по редкости.
   *      Раньше это была строка: серая иконка 44 px, название и цена.
   *   2. Клик по кейсу больше НЕ СПИСЫВАЕТ жетоны. Он открывает просмотр
   *      содержимого, и только кнопка «ОТКРЫТЬ ЗА N» покупает. Попадание
   *      курсором мимо «ОТКРЫТЬ» стоило 200–800 жетонов, и это выглядело
   *      как обман.
   *   3. Модалка — широкая (до 60rem), в две колонки: слева лента/итог,
   *      справа полный список содержимого с крупными процентами и именами
   *      вещей. Мелкий квадрат max-w-sm с одной полоской-прокруткой был
   *      ровно тем «неудобным и нечитаемым».
   *   4. Проценты — числом, а не только полоской, и с пометкой, куда
   *      влияет удача друга.
   */
  const { s: save0 } = useGame();
  const luck = bossStats(save0).luckBonus;
  const [opening, setOpening] = useState<GambleCase | null>(null);
  const [got, setGot] = useState<ItemDef | null>(null);
  const [roll, setRoll] = useState<ItemDef[]>([]);
  /**
   * Лента в покое — просто витрина: она генерируется ОДИН раз при открытии
   * просмотра. Генерировать её прямо в render было бы дёрганьем (новое
   * случайное содержимое на каждое наведение курсора).
   */
  const [armed, setArmed] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); }, []);

  /** просмотр кейса: никаких списаний, только содержимое и шанс */
  const look = (c: GambleCase) => {
    sfx.click();
    haptic("light");
    setOpening(c);
    setGot(null);
    setRoll(Array.from({ length: 26 }, () => rollItem(c, luck)));
    setArmed(false);
    setSpinning(false);
  };

  const close = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setSpinning(false);
    setOpening(null);
    setGot(null);
  };

  /** покупка и прокрутка */
  const buy = (c: GambleCase) => {
    if (g.chips < c.price || spinning) return;
    const prize = rollItem(c, luck);
    // в уже показанной витрине меняем только призовую ячейку — лента
    // продолжается туда, куда игрок уже смотрит
    setRoll((prev) => {
      const strip = prev.length === 26 ? [...prev] : Array.from({ length: 26 }, () => rollItem(c, luck));
      strip[22] = prize;
      return strip;
    });
    setGot(null);
    setSpinning(true);
    setArmed(true);
    save((x) => ({ chips: Math.max(0, x.chips - c.price) }));
    sfx.click();
    haptic("light");

    timers.current.push(window.setTimeout(() => {
      setSpinning(false);
      setGot(prize);
      // приз кладём в АКТУАЛЬНЫЙ инвентарь (см. core/gamble.ts)
      save((x) => ({ items: shiftItem(x, prize.id, 1) }));
      sfx.legend?.();
      haptic("success");
    }, 2600));
  };

  // Esc закрывает просмотр — как и везде в приложении
  useEffect(() => {
    if (!opening) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      setSpinning(false);
      setOpening(null);
      setGot(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [opening]);

  return (
    <>
      <div className="pc-cases">
        {GAMBLE_CASES.map((c) => (
          <button key={c.id} type="button" className="pc-case" onClick={() => look(c)}>
            {/* сам чемодан: корпус, блик, ручка, замок, уголки, подсветка
                начинки — всё на CSS, без растровой картинки */}
            <span className="pc-case-art" aria-hidden>
              <span className="pc-case-glow" />
              <span className="pc-case-handle" />
              <span className="pc-case-body">
                <span className="pc-case-seam" />
                <span className="pc-case-lock" />
                <span className="pc-case-plate t-display">{GAMBLE_CASES.indexOf(c) + 1}</span>
              </span>
              <span className="pc-case-corner c1" />
              <span className="pc-case-corner c2" />
              <span className="pc-case-corner c3" />
              <span className="pc-case-corner c4" />
            </span>

            <span className="pc-case-info">
              <span className="t-label pc-case-kicker">{tr("КЕЙС")}</span>
              <span className="t-title-sm pc-case-name clip1">{c.name}</span>
              <span className="pc-case-odds">
                {(["legend", "epic", "rare"] as const).map((r) => (
                  <span key={r} className="pc-case-odd" style={{ color: RARITY_COLOR[r] }}>
                    <i style={{ background: RARITY_COLOR[r] }} />
                    {RARITY_LABEL[r]}
                    <b className="t-num">{(c.odds[r] * 100).toFixed(c.odds[r] < 0.1 ? 2 : 1)}%</b>
                  </span>
                ))}
              </span>
              <span className="pc-case-bar">
                {(["common", "rare", "epic", "legend"] as const).map((r) => (
                  <i key={r} style={{ width: `${c.odds[r] * 100}%`, background: RARITY_COLOR[r] }} />
                ))}
              </span>
            </span>

            <span className="pc-case-foot">
              <span className={`pc-case-price t-num ${g.chips < c.price ? "poor" : ""}`}>
                <Icon name="ticket" size={12} />
                {fmt(c.price)}
              </span>
              <span className="pc-case-cta">
                {g.chips < c.price ? tr("МАЛО ЖЕТОНОВ") : tr("СМОТРЕТЬ")}
                <Icon name="chevron" size={11} />
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="t-caption pc-case-note">
        <Icon name="info" size={11} />
        {tr("Клик по кейсу — только просмотр: жетоны тратятся кнопкой «ОТКРЫТЬ ЗА».")}
        {luck > 0 && ` · ${tr("удача друга")} +${Math.round(luck * 100)}% ${tr("к редким")}`}
      </div>

      {/* ── просмотр и вскрытие ── */}
      <AnimatePresence>
        {opening && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pc-case-scrim"
            onClick={close}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              className="pc-case-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pc-case-mhead">
                <span className="t-label pc-case-mkicker">{tr("КЕЙС")}</span>
                <span className="t-display pc-case-mname">{opening.name}</span>
                <button type="button" className="pc-case-mx" onClick={close} aria-label={tr("Закрыть")}>
                  <Icon name="cross" size={14} />
                </button>
              </div>

              <div className="pc-case-mbody">
                {/* левая колонка: лента или итог */}
                <div className="pc-case-mleft">
                  {got ? (
                    <motion.div
                      initial={{ scale: 0.84, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 320, damping: 22 }}
                      className="pc-case-prize"
                      style={{ ["--rc" as never]: RARITY_COLOR[got.rarity] }}
                    >
                      <span className="t-label" style={{ color: RARITY_COLOR[got.rarity] }}>
                        {RARITY_LABEL[got.rarity]}
                      </span>
                      <span className="pc-case-prize-art">
                        <ItemIcon id={got.id} size={58} />
                      </span>
                      <span className="t-display pc-case-prize-name">{got.name}</span>
                      <span className="t-caption">
                        {tr("ценность")} <b className="t-num">{fmt(got.value)}</b> {tr("жетонов")} ·{" "}
                        {ITEM_KIND_LABEL[got.kind]}
                      </span>
                    </motion.div>
                  ) : (
                    <div className="pc-case-strip">
                      {/* лента: приз на 23-й позиции, окно центрировано на нём */}
                      <div
                        className="pc-case-strip-tape"
                        style={{ transform: armed ? "translateX(calc(var(--step) * -22))" : "translateX(0)" }}
                      >
                        {roll.map((it, i) => (
                          <span
                            key={i}
                            className={`pc-case-cell ${armed && i === 22 ? "prize" : ""}`}
                            style={{ borderColor: RARITY_COLOR[it.rarity] }}
                            title={it.name}
                          >
                            <ItemIcon id={it.id} size={28} />
                            <span className="pc-case-cell-name clip1">{it.name}</span>
                          </span>
                        ))}
                      </div>
                      <span className="pc-case-needle" aria-hidden />
                      {spinning && <span className="pc-case-hood" aria-hidden />}
                    </div>
                  )}

                  <div className="t-caption pc-case-hint">
                    {got
                      ? tr("Предмет уже в разделе «Вещи»: там его можно надеть, осмотреть или продать.")
                      : spinning
                        ? tr("ЛЕНТА ИДЁТ…")
                        : tr("Жми «ОТКРЫТЬ» — лента прокрутится и покажет, что выпало.")}
                  </div>
                </div>

                {/* правая колонка: читаемые шансы и что внутри */}
                <div className="pc-case-mright">
                  <div className="t-label pc-case-rcap">{tr("ЧТО МОЖЕТ ВЫПАСТЬ")}</div>
                  {(["legend", "epic", "rare", "common"] as const).map((r) => {
                    const items = ITEMS.filter((i) => i.rarity === r);
                    return (
                      <div key={r} className="pc-case-row" style={{ ["--rc" as never]: RARITY_COLOR[r] }}>
                        <span className="pc-case-row-pct t-num">{(opening.odds[r] * 100).toFixed(opening.odds[r] < 0.1 ? 2 : 1)}%</span>
                        <span className="min-w-0">
                          <span className="t-label pc-case-row-r">{RARITY_LABEL[r]} · {items.length}</span>
                          <span className="pc-case-row-names">
                            {items.slice(0, 4).map((i) => i.name).join(" · ")}
                            {items.length > 4 ? ` · +${items.length - 4}` : ""}
                          </span>
                        </span>
                      </div>
                    );
                  })}

                  <div className="pc-case-mid">
                    <span className="t-caption">
                      {tr("шанс редких растёт с удачей друга")}
                      {luck > 0 ? ` (+${Math.round(luck * 100)}%)` : ` (${tr("нет активного друга")})`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pc-case-mfoot">
                {got ? (
                  <>
                    <button type="button" className="pc-case-ghost" onClick={close}>
                      {tr("ЗАКРЫТЬ")}
                    </button>
                    <button
                      type="button"
                      className="pc-case-open"
                      disabled={g.chips < opening.price}
                      onClick={() => buy(opening)}
                    >
                      <Icon name="refresh" size={14} />
                      {tr("ЕЩЁ РАЗ")} · {fmt(opening.price)}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="pc-case-ghost" onClick={close} disabled={spinning}>
                      {tr("ОТМЕНА")}
                    </button>
                    <button
                      type="button"
                      className="pc-case-open"
                      disabled={spinning || g.chips < opening.price}
                      onClick={() => buy(opening)}
                    >
                      <Icon name="case" size={14} />
                      {spinning
                        ? tr("КРУТИТСЯ…")
                        : g.chips < opening.price
                          ? tr("НЕ ХВАТАЕТ ЖЕТОНОВ")
                          : `${tr("ОТКРЫТЬ ЗА")} ${fmt(opening.price)}`}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
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
        <div className="pc-battle">
          <div className="pc-battle-rule">
            <span className="pc-battle-rule-ico"><Icon name="skull" size={15} /></span>
            <span className="min-w-0">
              <span className="t-title-sm">{tr("Что это")}</span>
              <span className="t-caption">
                {tr("Вы и соперник по очереди открываете ОДИН И ТОТ ЖЕ кейс. Раунд берёт тот, у кого выпавшая вещь дороже. Кто выиграл больше раундов — забирает ВСЕ предметы, и свои, и чужие.")}
              </span>
            </span>
          </div>

          <div className="pc-battle-picks">
            <div className="t-label pc-battle-cap">{tr("1 · КЕЙС — что вскрываем")}</div>
            <div className="pc-battle-cases">
              {GAMBLE_CASES.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => { sfx.click(); haptic("light"); setCaseId(x.id); }}
                  className={`pc-battle-case ${caseId === x.id ? "on" : ""}`}
                  title={x.name}
                >
                  <span className="t-body clip1">{x.name}</span>
                  <span className="pc-battle-case-price t-num">
                    <Icon name="ticket" size={10} />{fmt(x.price)}
                  </span>
                  <span className="pc-battle-case-legend">
                    {tr("легенда")} {(x.odds.legend * 100).toFixed(1)}%
                  </span>
                </button>
              ))}
            </div>

            <div className="t-label pc-battle-cap">{tr("2 · РАУНДОВ — сколько дуэлей")}</div>
            <div className="pc-battle-rounds">
              {[1, 3, 5].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { sfx.click(); setRounds(r); }}
                  className={`pc-battle-round ${rounds === r ? "on" : ""}`}
                >
                  <b className="t-num">{r}</b>
                  <span className="t-caption">
                    {r === 1 ? tr("одна дуэль — всё или ничего") : r === 3 ? tr("обычная — спокойнее") : tr("длинная — дешевле в среднем")}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="pc-battle-sum">
            <span>
              <span className="t-label">{tr("стоит")}</span>
              <b className={`t-num ${g.chips < cost ? "poor" : ""}`}>{fmt(cost)}</b>
            </span>
            <Icon name="chevron" size={12} />
            <span>
              <span className="t-label">{tr("на кону")}</span>
              <b className="t-num gold">{rounds * 2} ×</b>
              <span className="t-caption">{tr("предметов")}</span>
            </span>
            <span>
              <span className="t-label">{tr("средняя ценность")}</span>
              <b className="t-num">≈{fmt(Math.round(c.price * 1.05))}</b>
            </span>
          </div>

          <button
            type="button"
            className="pc-battle-go"
            onClick={start}
            disabled={g.chips < cost}
          >
            <Icon name="fist" size={14} />
            {g.chips < cost ? tr("НЕ ХВАТАЕТ ЖЕТОНОВ") : `${tr("В БОЙ ЗА")} ${fmt(cost)}`}
          </button>

          {g.battles > 0 && (
            <div className="pc-battle-record">
              <Icon name="medal" size={12} />
              {tr("побед")} <b className="t-num">{g.battleWins}</b> {tr("из")} <b className="t-num">{g.battles}</b>
              <span className="t-caption">
                ({Math.round((g.battleWins / Math.max(1, g.battles)) * 100)}%)
              </span>
            </div>
          )}
        </div>
      ) : (
        <Panel r="lg" style={{ padding: 15 }}>
          {(() => {
            const mineSum = live.list.slice(0, step).reduce((a, b) => a + b.mine.value, 0);
            const foeSum = live.list.slice(0, step).reduce((a, b) => a + b.foe.value, 0);
            const tot = mineSum + foeSum || 1;
            const lead = mineSum === foeSum ? 0 : mineSum > foeSum ? 1 : -1;
            return (
              <div className="pc-battle-board">
                <div className="pc-battle-side me">
                  <span className="t-label">{tr("ТЫ")}</span>
                  <span className="t-num pc-battle-total">{fmt(mineSum)}</span>
                </div>
                {/* полоса перевеса — сразу видно, кто впереди, без счёта в уме */}
                <div className="pc-battle-tug" aria-hidden>
                  <i className="me" style={{ width: `${(mineSum / tot) * 100}%` }} />
                  <i className="foe" style={{ width: `${(foeSum / tot) * 100}%` }} />
                  <span className="pc-battle-tug-mark" />
                </div>
                <div className="pc-battle-side foe">
                  <span className="t-label">{foe.toUpperCase()}</span>
                  <span className="t-num pc-battle-total">{fmt(foeSum)}</span>
                </div>
                <div className="pc-battle-status">
                  <span className="t-label">
                    {tr("раунд")} {Math.min(step, live.list.length)}/{live.list.length}
                  </span>
                  <span className={`pc-battle-lead ${lead > 0 ? "up" : lead < 0 ? "down" : ""}`}>
                    {lead > 0 ? tr("ведёшь ты") : lead < 0 ? tr("ведёт соперник") : tr("равно")}
                  </span>
                </div>
              </div>
            );
          })()}

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
                <span className="t-caption clip1 flex-1">{r.mine.name}</span>
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
                <span className="t-caption clip1 flex-1" style={{ textAlign: "right" }}>{r.foe.name}</span>
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
                <span className="t-body clip1" style={{ fontSize: 10.5 }}>{it.name}</span>
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

          {/* Режимы — ДВА явных переключателя, как просили («нужен обычный
              апгрейд и отдельно ускоренный»). Раньше это была одна кнопка,
              которая молча меняла надпись: невозможно было догадаться, что
              она вообще делает. Шансы в обоих режимах ОДИНАКОВЫЕ — режим
              меняет только прокрутку, а не математику. */}
          <div className="pc-up-modes">
            <button
              type="button"
              className={`pc-up-mode ${!fast ? "on" : ""}`}
              aria-pressed={!fast}
              onClick={() => { setFast(false); sfx.click(); }}
            >
              <Icon name="refresh" size={13} />
              <span className="t-label">{tr("ОБЫЧНЫЙ")}</span>
              <span className="t-caption">{tr("колесо крутится 4.2 с — видно, как падает")}</span>
            </button>
            <button
              type="button"
              className={`pc-up-mode ${fast ? "on" : ""}`}
              aria-pressed={fast}
              onClick={() => { setFast(true); sfx.click(); }}
            >
              <Icon name="speed" size={13} />
              <span className="t-label">{tr("УСКОРЕННЫЙ")}</span>
              <span className="t-caption">{tr("1.2 с — тот же шанс, быстрее серия")}</span>
            </button>
          </div>

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
function ChipFarm({ save, onTab }: { save: GambleSave; onTab?: (t: Tab) => void }) {
  const [phase, setPhase] = useState<"idle" | "play" | "over">("idle");
  const [chips, setChips] = useState<FarmChip[]>([]);
  const [earned, setEarned] = useState(0);
  const [left, setLeft] = useState(FARM_MS);
  const [combo, setCombo] = useState(0);
  /** лучший комбо-множитель за забег — нужен для итога, а не для игры */
  const [maxCombo, setMaxCombo] = useState(0);
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
    setChips([]); setEarned(0); setCombo(0); setMaxCombo(0); comboRef.current = 0;
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
    setMaxCombo((v) => Math.max(v, comboRef.current));
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
      {/* Правила, СРОК и НАГРАДА — три вещи, о которых спрашивали: «нет
          таймера, нет срока, не объяснено, за что это и что даёт». */}
      <Panel r="lg" style={{ padding: 13, marginBottom: 12 }}>
        <div className="pc-farm-rule">
          <span>
            <Icon name="clock" size={13} />
            <b className="t-num">{(FARM_MS / 1000).toFixed(0)} c</b>
            <span className="t-caption">{tr("на один забег, между забегами перерыва нет")}</span>
          </span>
          <span>
            <Icon name="ticket" size={13} />
            <span className="t-caption">{tr("награда — жетоны: они тратятся на кейсы, апгрейд и слоты")}</span>
          </span>
          <span>
            <Icon name="fire" size={13} />
            <span className="t-caption">{tr("ловишь без промаха — растёт комбо: до +50% к фишкам")}</span>
          </span>
        </div>
        {onTab && (
          <button type="button" className="pc-farm-go" onClick={() => { sfx.click(); onTab("slots"); }}>
            <Icon name="dice" size={12} />
            {tr("КУДА ПОТРАТИТЬ ЖЕТОНЫ")}
          </button>
        )}
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
                  {/* «что мне это даёт» — награда обязана быть переводима в
                      понятные вещи, а не оставаться просто числом */}
                  <div className="pc-farm-worth">
                    <span>
                      <Icon name="case" size={12} />
                      ≈ {Math.max(0, Math.floor(earned / GAMBLE_CASES[0].price))} × {GAMBLE_CASES[0].name}
                    </span>
                    <span>
                      <Icon name="dice" size={12} />
                      ≈ {Math.max(0, Math.floor(earned / 25))} {tr("спинов по 25")}
                    </span>
                  </div>
                  {missed > 0 && (
                    <div className="t-caption" style={{ marginTop: 6, color: "var(--text-mute)" }}>
                      {tr("Упустил")} <b className="t-num">{missed}</b> · {tr("макс. комбо")} ×{(1 + Math.min(maxCombo, 10) * 0.05).toFixed(2)}
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
  /**
   * Осмотр вещи. Просьба: «вещи непонятны, их же никак не осмотреть» —
   * в списке были иконка, имя и две кнопки, и всё: чем предмет, куда
   * надевается, что даёт и сколько стоит — узнать было негде.
   */
  const [look, setLook] = useState<string | null>(null);

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
              {/* имя — кнопка «осмотреть»: карточка вещи без подробностей
                  была просто списком иконок */}
              <button
                type="button"
                className="pc-stuff-hit flex-1 min-w-0"
                onClick={() => { sfx.click(); setLook(id); }}
                title={tr("Осмотреть")}
              >
                <span className="t-title-sm clip1 block">{it.name}</span>
                <span
                  className="t-label block"
                  style={{ marginTop: 2, color: RARITY_COLOR[it.rarity] }}
                >
                  {RARITY_LABEL[it.rarity]} · {n} {tr("шт")} · {ITEM_KIND_LABEL[it.kind]}
                </span>
              </button>
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
                {on ? tr("СНЯТЬ") : tr("НАДЕТЬ")}
              </button>
              <button
                type="button"
                onClick={() => sell(id)}
                className="t-label shrink-0"
                title={tr("Продать за 60% ценности")}
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

      {/* ── ОСМОТР ВЕЩИ ── */}
      <AnimatePresence>
        {look && (() => {
          const it = itemById(look);
          if (!it) return null;
          const n = g.items[look] || 0;
          const on = g.equipped[it.kind] === look;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pc-case-scrim"
              onClick={() => setLook(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                className="pc-stuff-modal"
                style={{ ["--rc" as never]: RARITY_COLOR[it.rarity] }}
                onClick={(e) => e.stopPropagation()}
              >
                <button type="button" className="pc-case-mx" onClick={() => setLook(null)} aria-label={tr("Закрыть")}>
                  <Icon name="cross" size={14} />
                </button>
                <div className="pc-stuff-art"><ItemIcon id={it.id} size={72} /></div>
                <div className="t-label" style={{ color: RARITY_COLOR[it.rarity] }}>
                  {RARITY_LABEL[it.rarity]}
                </div>
                <div className="t-display pc-stuff-name">{it.name}</div>
                <div className="pc-stuff-rows">
                  <span><Icon name="ticket" size={12} />{tr("ценность")} <b className="t-num">{fmt(it.value)}</b> {tr("жетонов")}</span>
                  <span><Icon name="user" size={12} />{ITEM_KIND_LABEL[it.kind]}</span>
                  <span><Icon name="case" size={12} />{tr("в наличии")} <b className="t-num">{n}</b></span>
                  <span>
                    <Icon name={on ? "check" : "eye"} size={12} />
                    {on ? tr("надето на главного героя") : tr("не надето")}
                  </span>
                </div>
                <div className="t-caption pc-stuff-note">
                  {tr("Украшение видно на герое во вкладке «Персонажи» и в играх, где герой участвует. Продажа возвращает 60% ценности, надеть и снять можно в любой момент.")}
                </div>
                <div className="pc-stuff-actions">
                  <button type="button" className="pc-case-ghost" onClick={() => sell(it.id)}>
                    <Icon name="coin" size={13} />
                    {tr("ПРОДАТЬ")} · {Math.floor(it.value * 0.6)}
                  </button>
                  <button type="button" className="pc-case-open" onClick={() => { equip(it); }}>
                    <Icon name={on ? "cross" : "check"} size={13} />
                    {on ? tr("СНЯТЬ") : tr("НАДЕТЬ")}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </>
  );
}
