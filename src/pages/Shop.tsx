import { useEffect, useState } from "react";
import { tr } from "../core/i18n";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import {
  HERO_SKINS, ACCENTS, CASES, RARITY_COLOR, RARITY_LABEL, type CaseDef,
} from "../core/content";
import { fmt } from "../core/format";
import { isDesktop } from "../core/desktop";
import { Card, Tap, Button, SectionTitle, Screen } from "../ui/Glass";
import HeadView from "../ui/HeadView";
import { sfx, haptic } from "../core/fx";
import Icon from "../ui/Icon";
import type { Friend, Rarity } from "../core/types";
import type { IconName } from "../ui/Icon";

type Tab = "cases" | "skins" | "themes";

/** Вкладки магазина: иконка и подпись, чтобы раздел читался с одного взгляда */
const SHOP_TABS: {
  id: Tab; label: string; icon: IconName; title: string; hint: string;
}[] = [
  {
    id: "cases", label: "Кейсы", icon: "case",
    title: "Кейсы с друзьями",
    hint: "Открывай и собирай карточки — каждая даёт прибавку к монетам",
  },
  {
    id: "skins", label: "Скины", icon: "user",
    title: "Скины героя",
    hint: "Как выглядит твой персонаж в играх",
  },
  {
    id: "themes", label: "Темы", icon: "sparkle",
    title: "Цвет интерфейса",
    hint: "Цвет кнопок, полосок и подсветки во всём приложении",
  },
];

export default function Shop() {
  const [tab, setTab] = useState<Tab>("cases");
  const { s } = useGame();
  const activeTab = SHOP_TABS.find((t) => t.id === tab)!;
  return (
    <Screen title={tr("МАГАЗИН")}>
      {/* Кошелёк из шапки магазина убран: на компьютере он уже в верхней
          панели — «CHUBUGAMES | Ур. 3 | 💰 26к | 💎 310». На телефоне
          панели нет, поэтому там счётчик валют остаётся на месте. */}
      {!isDesktop() && (
        <Card r="md" className="shrink-0" style={{ padding: "8px 12px", marginBottom: 12 }}>
          <div className="flex items-center" style={{ gap: 10 }}>
            <span className="t-num acc-text inline-flex items-center" style={{ fontSize: 14, gap: 5 }}>
              <Icon name="coin" size={14} /> {fmt(s.coins)}
            </span>
            <span className="t-num inline-flex items-center" style={{ fontSize: 14, gap: 5 }}>
              <Icon name="gem" size={14} /> {s.gems}
            </span>
          </div>
        </Card>
      )}

      <div className="pc-shop">
        {/* Выбор раздела. На компьютере это вертикальный список слева:
            три плитки на всю ширину сверху читались как баннеры, а не как
            навигация, и каждый переход уезжал за край. */}
        <nav className="pc-shop-nav" aria-label={tr("Разделы магазина")}>
          {SHOP_TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-current={on ? "true" : undefined}
                onClick={() => { sfx.click(); haptic("light"); setTab(t.id); }}
                className={`pc-shop-tab ${on ? "on" : ""}`}
              >
                <span className="pc-shop-tab-ico"><Icon name={t.icon} size={16} /></span>
                <span className="t-label pc-shop-tab-label">{tr(t.label)}</span>
              </button>
            );
          })}
        </nav>

        <div className="pc-shop-body">
          {/* Где я сейчас: заголовок раздела с пояснением */}
          <div style={{ marginBottom: 16 }}>
            <div className="t-display-sm" style={{ fontSize: 19 }}>{tr(activeTab.title)}</div>
            <div className="t-caption" style={{ marginTop: 3 }}>{tr(activeTab.hint)}</div>
          </div>

      {tab === "cases" && <Cases />}
      {tab === "skins" && <Skins />}      {tab === "themes" && <Themes />}
        </div>
      </div>
    </Screen>
  );
}

/** Внешний вид кейсов: бумажный, фольга, золотой */
const CASE_SKIN: Record<string, { box: string; ink: string; line: string; glow: string }> = {
  bronze: {
    box: "rgba(190,140,90,0.18)", ink: "#c89b62",
    line: "rgba(200,155,98,0.32)", glow: "rgba(200,155,98,0.10)",
  },
  silver: {
    box: "rgba(190,200,215,0.18)", ink: "#c2ccd8",
    line: "rgba(194,204,216,0.34)", glow: "rgba(194,204,216,0.10)",
  },
  gold: {
    box: "rgba(255,176,32,0.20)", ink: "var(--gold)",
    line: "var(--gold-brd)", glow: "rgba(255,176,32,0.14)",
  },
};

/* ============ КЕЙСЫ ============ */
function Cases() {
  const { s, set, spendCoins, toast, addXp } = useGame();
  const [rolling, setRolling] = useState<null | { friend: Friend; rarity: Rarity; dupe: boolean }>(null);
  const [spinning, setSpinning] = useState(false);
  const [reel, setReel] = useState<Friend[]>([]);
  /** какой кейс открыт — нужен шапке модалки, кнопке «ещё раз» и содержимому */
  const [pack, setPack] = useState<CaseDef | null>(null);
  /**
   * С этого момента лента едет к призовой ячейке. Отдельный флаг, а не
   * `spinning`: CSS-переход считается от уже нарисованного положения, поэтому
   * сначала React обязан успеть показать ленту в нуле.
   */
  const [armed, setArmed] = useState(false);

  const open = (caseId: string) => {
    const c = CASES.find((x) => x.id === caseId)!;
    if (!spendCoins(c.price)) return;
    setSpinning(true);
    setPack(c);
    setArmed(false);
    sfx.caseOpen();
    haptic("medium");

    const fateBonus = (s.skills.fate || 0) * 0.08;
    const odds = { ...c.odds };
    odds.legend *= 1 + fateBonus;
    odds.epic *= 1 + fateBonus * 0.6;

    const total = Object.values(odds).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let rarity: Rarity = "common";
    for (const [k, v] of Object.entries(odds)) {
      r -= v;
      if (r <= 0) { rarity = k as Rarity; break; }
    }

    const pool = s.friends.filter((f) => f.rarity === rarity);
    const picked = (pool.length ? pool : s.friends)[
      Math.floor(Math.random() * (pool.length || s.friends.length))
    ];

    const strip: Friend[] = [];
    for (let i = 0; i < 26; i++) strip.push(s.friends[Math.floor(Math.random() * s.friends.length)]);
    strip[22] = picked;
    setReel(strip);
    // лента трогается на следующем кадре — переход от нулевой точки
    requestAnimationFrame(() => setArmed(true));

    setTimeout(() => {
      const dupe = (s.cards[picked.id] || 0) > 0;
      const comp = dupe ? Math.floor(c.price * 0.35) : 0;
      set((d) => {
        d.cards[picked.id] = (d.cards[picked.id] || 0) + 1;
        d.stats.casesOpened += 1;
        if (comp) { d.coins += comp; d.totalCoinsEver += comp; }
      });
      addXp(60);
      setSpinning(false);
      setRolling({ friend: picked, rarity, dupe });
      if (rarity === "legend") sfx.legend();
      else sfx.achieve();
      haptic("success");
      if (dupe) toast({ title: tr("Дубликат"), sub: `+${fmt(comp)} монет компенсации`, icon: "refresh" });
    }, 3000);
  };

  return (
    <div className="pc-cols">
      {/* Кейсы — плиткой в левой колонке: на мониторе три карточки столбиком
        оставляли пустую половину экрана, а коллекция уезжала за скролл. */}
      <div className="pc-blk pc-a pc-r1">
      <div className="t-body" style={{ marginBottom: 16 }}>
        {tr("Каждая карточка навсегда даёт")}{" "}
        <span className="acc-text">{tr("+0.4% ко всем монетам")}</span>.{" "}
        {tr("Дубликаты возвращают 35% стоимости.")}
      </div>

      <div className="pc-shop-packs">
      {CASES.map((c, ci) => {
        const skin = CASE_SKIN[c.id] ?? CASE_SKIN.bronze;
        const afford = s.coins >= c.price;
        // Лучший шанс показываем крупно: именно ради него кейс и открывают
        const topRarity: Rarity = c.odds.legend >= 0.1
          ? "legend" : c.odds.epic >= 0.3 ? "epic" : "rare";
        return (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ci * 0.07 }}
          >
            <Card
              r="lg"
              className="relative overflow-hidden pc-shop-pack"
              style={{
                padding: 0,
                marginBottom: 12,
                border: `1px solid ${skin.line}`,
              }}
            >
              {/* Свечения за иконками нет вовсе (просьба буквальная: «мерзко»).
                  Кейсы различаются металлической плашкой с тонкой кромкой
                  редкости и узкой цветной линией сверху — этого хватает,
                  ореол под иконкой только грязнил. */}
              <span className="pc-pack-edge" style={{ background: skin.ink }} aria-hidden />
              <div className="relative" style={{ padding: 15 }}>
                <div className="flex items-start" style={{ gap: 13 }}>
                  {/* сам «кейс» */}
                  <span
                    className="pc-pack-ico shrink-0 flex items-center justify-center"
                    style={{ background: skin.box, color: skin.ink, borderColor: skin.line }}
                  >
                    <Icon name="case" size={26} />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="t-title-sm clip1">{c.name}</div>
                    <div className="t-caption clip1" style={{ marginTop: 3 }}>{c.desc}</div>
                    <div
                      className="t-label"
                      style={{ marginTop: 7, fontSize: 9, color: RARITY_COLOR[topRarity] }}
                    >
                      {RARITY_LABEL[topRarity]} {(c.odds[topRarity] * 100).toFixed(
                        c.odds[topRarity] < 0.02 ? 1 : 0,
                      )}%
                    </div>
                  </div>
                </div>

                {/* Полоса шансов вместо россыпи бейджей: видно соотношение */}
                <div
                  className="flex overflow-hidden"
                  style={{ height: 7, borderRadius: 999, marginTop: 13, gap: 2 }}
                >
                  {(Object.keys(c.odds) as Rarity[]).map((r) => (
                    <span
                      key={r}
                      style={{
                        width: `${c.odds[r] * 100}%`,
                        background: RARITY_COLOR[r],
                        opacity: 0.9,
                      }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap" style={{ gap: 10, marginTop: 8, marginBottom: 14 }}>
                  {(Object.keys(c.odds) as Rarity[]).map((r) => (
                    <span
                      key={r}
                      className="t-label inline-flex items-center"
                      style={{ fontSize: 8.5, gap: 4, color: RARITY_COLOR[r] }}
                    >
                      <span
                        style={{
                          width: 6, height: 6, borderRadius: 999,
                          background: RARITY_COLOR[r], display: "inline-block",
                        }}
                      />
                      {(c.odds[r] * 100).toFixed(c.odds[r] < 0.02 ? 1 : 0)}%
                    </span>
                  ))}
                </div>

                <Button
                  variant="primary"
                  full
                  size="lg"
                  sound="none"
                  disabled={!afford || spinning}
                  onClick={() => open(c.id)}
                >
                  <span className="inline-flex items-center" style={{ gap: 6 }}>
                    {afford ? tr("Открыть") : tr("Не хватает")}
                    <Icon name="coin" size={13} /> {fmt(c.price)}
                  </span>
                </Button>
              </div>
            </Card>
          </motion.div>
        );
      })}
      </div>
      </div>

      {/* Коллекция — список справа: имена с числом карточек, а не сетка
          из сорока одинаковых квадратов. */}
      <div className="pc-blk pc-b pc-r1">
      <div style={{ marginTop: 0 }}>
        <SectionTitle
          right={<span className="t-num" style={{ fontSize: 11, color: "var(--text-mute)" }}>{Object.keys(s.cards).length}/{s.friends.length}</span>}
        >{tr("Коллекция")}</SectionTitle>
      </div>
      <div className="pc-shop-coll">
        {s.friends.map((f) => {
          const n = s.cards[f.id] || 0;
          return (
            <div key={f.id} className="pc-coll-row" style={{ opacity: n ? 1 : 0.45 }}>
              <span style={{ filter: n ? "none" : "grayscale(1) brightness(0.55)", lineHeight: 0 }}>
                <HeadView friend={f} size={30} />
              </span>
              <span className="pc-coll-name t-title-sm clip1" style={{ fontSize: 12 }}>{f.name}</span>
              <span
                className="t-label clip1"
                style={{ fontSize: 8, color: RARITY_COLOR[f.rarity], flex: "0 0 auto" }}
              >
                {tr(RARITY_LABEL[f.rarity])}
              </span>
              <span className="t-num pc-coll-n" style={{ color: n ? "var(--acc)" : "var(--text-mute)" }}>
                {n ? `×${n}` : "—"}
              </span>
            </div>
          );
        })}
      </div>
      </div>

      {/* ── ВСКРЫТИЕ ──
          Что убрано и почему (просьба: «анимация слишком мультяшная, нужна
          взрослая и красивая», «модалка меньше чем нужно и кривая»):
            • мелкое дрожание всего экрана на финале и мигающая подпись
              «Почти…» — это мультфильм, а не казино;
            • бесконечный пульс выигрышной головы (scale 1 → 1.14), вращающиеся
              26-секундные лучи и 14 искр по кругу — шум без информации;
            • полноэкранная цветная вспышка и «выпрыгивание» карточки через
              rotateY 90° + scale 0.6.
          Что осталось: длинное честное торможение ленты, одна световая
          колонна по центру, мягкое появление итога и спокойная рамка цветом
          редкости — без искр и тряски.
          Оболочка модалки — та же, что у кейсов казино (.pc-case-*), чтобы
          приложение не распадалось на два стиля: широкая, с шапкой, двумя
          колонками (лента/итог и разбор содержимого) и рядом кнопок снизу. */}
      <AnimatePresence>
        {(spinning || rolling) && pack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pc-case-scrim"
            onClick={() => { if (!spinning) { setRolling(null); setPack(null); } }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
              className="pc-case-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pc-case-mhead">
                <span className="t-label pc-case-mkicker">{tr("КЕЙС")}</span>
                <span className="t-display pc-case-mname">{pack.name}</span>
                <span
                  className="pc-case-state"
                  style={{ color: rolling ? RARITY_COLOR[rolling.rarity] : "var(--text-mute)" }}
                >
                  {rolling ? RARITY_LABEL[rolling.rarity] : tr("КРУТИТСЯ")}
                </span>
                <button
                  type="button"
                  className="pc-case-mx"
                  onClick={() => { if (!spinning) { setRolling(null); setPack(null); } }}
                  aria-label={tr("Закрыть")}
                  disabled={spinning}
                >
                  <Icon name="cross" size={14} />
                </button>
              </div>

              <div className="pc-case-mbody">
                <div className="pc-case-mleft">
                  {rolling ? (
                    <div
                      className="pc-pack-result"
                      style={{ ["--rc" as never]: RARITY_COLOR[rolling.rarity] }}
                    >
                      <HeadView friend={rolling.friend} size={124} style={{ margin: "0 auto" }} />
                      <div className="t-display pc-pack-result-name">{rolling.friend.name}</div>
                      <div className="t-caption">{rolling.friend.nick}</div>
                      <div className={`pc-pack-dupe ${rolling.dupe ? "" : "ok"}`}>
                        <Icon name={rolling.dupe ? "refresh" : "check"} size={12} />
                        {rolling.dupe
                          ? tr("Дубликат · компенсация выдана")
                          : tr("Новый друг в коллекции")}
                      </div>
                    </div>
                  ) : (
                    <div className="pc-case-strip pc-shop-reel">
                      <div
                        className="pc-case-strip-tape"
                        style={{ transform: armed ? "translateX(calc(var(--step) * -22))" : "translateX(0)" }}
                      >
                        {reel.map((f, i) => (
                          <span
                            key={i}
                            className={`pc-shop-cell ${armed && i === 22 ? "prize" : ""}`}
                            style={{ borderColor: `${RARITY_COLOR[f.rarity]}88` }}
                            title={f.name}
                          >
                            <HeadView friend={f} size={52} />
                            <span className="pc-shop-cell-name clip1">{f.name}</span>
                          </span>
                        ))}
                      </div>
                      <span className="pc-case-needle" aria-hidden />
                      {spinning && <span className="pc-case-hood" aria-hidden />}
                      {/* один спокойный проход света вместо вспышки на весь экран */}
                      <span className="pc-pack-sweep" aria-hidden />
                    </div>
                  )}

                  <div className="t-caption pc-case-hint">
                    {rolling
                      ? tr("Карточка уже в коллекции: каждая новая даёт +0.4% ко всем монетам.")
                      : tr("Лента тормозит сама — никаких трясок и искр, только свет на призовой ячейке.")}
                  </div>
                </div>

                {/* правая колонка: что внутри и какие шансы — читаются, пока
                    лента ещё идёт, а не после */}
                <div className="pc-case-mright">
                  <div className="t-label pc-case-rcap">{tr("СОДЕРЖИМОЕ")}</div>
                  {(["legend", "epic", "rare", "common"] as Rarity[]).map((r) => {
                    const pool = s.friends.filter((f) => f.rarity === r);
                    return (
                      <div key={r} className="pc-case-row" style={{ ["--rc" as never]: RARITY_COLOR[r] }}>
                        <span className="pc-case-row-pct t-num">
                          {(pack.odds[r] * 100).toFixed(pack.odds[r] < 0.02 ? 1 : 0)}%
                        </span>
                        <span className="min-w-0">
                          <span className="t-label pc-case-row-r">{RARITY_LABEL[r]} · {pool.length}</span>
                          <span className="pc-case-row-names">
                            {pool.length === 0
                              ? tr("нет в этом кейсе")
                              : `${pool.slice(0, 4).map((f) => f.name).join(" · ")}${pool.length > 4 ? ` · +${pool.length - 4}` : ""}`}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                  <div className="pc-case-mid">
                    <span className="t-caption">
                      {tr("цена")} <b className="t-num">{fmt(pack.price)}</b> · {tr("дубликат возвращает")} 35%
                    </span>
                  </div>
                </div>
              </div>

              <div className="pc-case-mfoot">
                {rolling ? (
                  <>
                    <button
                      type="button"
                      className="pc-case-ghost"
                      onClick={() => { sfx.click(); open(pack.id); }}
                      disabled={s.coins < pack.price}
                    >
                      <Icon name="refresh" size={13} />
                      {tr("ЕЩЁ РАЗ")} · {fmt(pack.price)}
                    </button>
                    <button
                      type="button"
                      className="pc-case-open"
                      onClick={() => { sfx.coin?.(); setRolling(null); setPack(null); }}
                    >
                      {tr("ЗАБРАТЬ")}
                    </button>
                  </>
                ) : (
                  <button type="button" className="pc-case-ghost" disabled>
                    <Icon name="clock" size={13} />
                    {tr("КРУТИТСЯ…")}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============ СКИНЫ ============ */

/**
 * Что скин меняет в цифрах — один список, сверенный с кодом:
 * `autoRate` в core/save.ts умножает монеты для king/gold, Burger Rain —
 * для ghost. Всё остальное только выглядит, и игрок должен читать именно
 * это, а не догадываться.
 */
const SKIN_EFFECT: Record<string, string> = {
  king: "+5% ко всем монетам",
  gold: "+15% ко всем монетам",
  ghost: "+8% монет в Burger Rain",
};

function Skins() {
  const { s, set, spendCoins, toast } = useGame();
  /**
   * Скин, который смотрим справа. Отдельно от надетого — чтобы можно было
   * разглядеть то, чего ещё нет.
   */
  const [look, setLook] = useState(s.heroSkin);
  /** Момент после покупки: фигура «проявляется», и видно, что появилось */
  const [reveal, setReveal] = useState<string | null>(null);

  useEffect(() => {
    if (!reveal) return;
    const t = setTimeout(() => setReveal(null), 2200);
    return () => clearTimeout(t);
  }, [reveal]);

  const shown = HERO_SKINS.find((x) => x.id === look) ?? HERO_SKINS[0];
  const worn = s.heroSkin === shown.id;
  const owned0 = s.ownedSkins.includes(shown.id);

  const buy = (sk: (typeof HERO_SKINS)[number]) => {
    setLook(sk.id);
    if (s.ownedSkins.includes(sk.id)) {
      set((d) => { d.heroSkin = sk.id; });
      sfx.buy();
      haptic("light");
      return;
    }
    if (!spendCoins(sk.price)) return;
    set((d) => { d.ownedSkins.push(sk.id); d.heroSkin = sk.id; });
    sfx.legend();
    haptic("success");
    setReveal(sk.id);
    toast({ title: tr("Скин куплен"), sub: sk.name, icon: "user", tone: "gold" });
  };

  return (
    <div className="pc-shop-skins">
      {/* Список — слева: восемь карточек сеткой 2×4 заставляли искать,
          что же ты сейчас надел. */}
      <div className="pc-skin-list">
        {HERO_SKINS.map((sk) => {
          const owned = s.ownedSkins.includes(sk.id);
          const active = s.heroSkin === sk.id;
          const on = sk.id === look;
          return (
            <button
              key={sk.id}
              type="button"
              /* Ряд — ТОЛЬКО просмотр. Раньше клик по строке мгновенно
                 надевал скин, а если он не куплен — ещё и списывал монеты:
                 «непонятно с ними» ровно из-за этого (хотелось разглядеть,
                 получилось — купить). Теперь выбирают кнопкой в витрине. */
              onClick={() => { sfx.tap(); haptic("light"); setLook(sk.id); }}
              className={`pc-skin-row ${on ? "look" : ""} ${active ? "worn" : ""} ${!owned && s.coins < sk.price ? "poor" : ""}`}
            >
              <span className="pc-skin-row-fig"><HeroPreview w={30} skin={sk} /></span>
              <span className="pc-skin-row-id">
                <span className="t-title-sm clip1">{sk.name}</span>
                <span className="t-caption clip1" style={{ fontSize: 9 }}>{sk.desc}</span>
              </span>
              <span className="t-num pc-skin-row-price">
                {active ? tr("Надет") : owned ? tr("Надеть") : (
                  <span className="inline-flex items-center" style={{ gap: 4 }}>
                    <Icon name="coin" size={11} /> {fmt(sk.price)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Сцена справа: как выглядит персонаж сейчас и что появилось после
          покупки. Пока покупает — видит результат, а не угадывает. */}
      <div className="pc-skin-stage">
        <div className="pc-skin-stage-top">
          <span className="t-label">{worn ? tr("НАДЕТ СЕЙЧАС") : tr("СМОТРИШЬ")}</span>
          <span
            className="t-label"
            style={{ fontSize: 8, color: RARITY_COLOR[shown.rarity] }}
          >
            {tr(RARITY_LABEL[shown.rarity])}
          </span>
        </div>

        <div className="pc-skin-fig">
          {reveal === shown.id && (
            <motion.span
              className="pc-skin-flash"
              initial={{ opacity: 0.85, scale: 0.6 }}
              animate={{ opacity: 0, scale: 2.1 }}
              transition={{ duration: 0.85, ease: "easeOut" }}
              aria-hidden
            />
          )}
          <motion.div
            key={shown.id}
            initial={{ opacity: 0, y: 14, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            style={{ lineHeight: 0 }}
          >
            <HeroPreview w={132} skin={shown} />
          </motion.div>
        </div>

        <div className="t-display-sm" style={{ fontSize: 20, textAlign: "center" }}>{shown.name}</div>
        <div className="t-caption" style={{ marginTop: 4, textAlign: "center" }}>{shown.desc}</div>

        {/* «где применяются и что меняется» — подписано прямо в витрине */}
        <div className="pc-skin-facts">
          <span>
            <Icon name={shown.id === "default" || shown.id === "shadow" || shown.id === "cap" || shown.id === "steel" || shown.id === "gent" ? "eye" : "coin"} size={12} />
            {SKIN_EFFECT[shown.id] ? tr(SKIN_EFFECT[shown.id]) : tr("только внешний вид, на игру не влияет")}
          </span>
          <span>
            <Icon name="user" size={12} />
            {tr("видно: в Burger Rain, на плитке уровня в Прогрессе и здесь, в витрине")}
          </span>
          <span>
            <Icon name="check" size={12} />
            {owned0
              ? tr("куплен — можно надевать и снимать когда угодно")
              : tr("не куплен — кнопка снизу купит и наденет")}
          </span>
        </div>

        {reveal === shown.id && (
          <motion.div
            className="t-label pc-skin-new"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            {tr("НОВЫЙ СКИН НАДЕТ")}
          </motion.div>
        )}

        <div className="pc-skin-actions">
          {!worn && (
            <Button variant={s.ownedSkins.includes(shown.id) ? "secondary" : "primary"} full sound="none"
              onClick={() => buy(shown)}
              disabled={!s.ownedSkins.includes(shown.id) && s.coins < shown.price}
            >
              {owned0
                ? tr("Надеть")
                : (
                  <span className="inline-flex items-center" style={{ gap: 6 }}>
                    <Icon name="coin" size={13} /> {tr("Купить за")} {fmt(shown.price)} {tr("и надеть")}
                  </span>
                )}
            </Button>
          )}
          {worn && (
            <div className="pc-skin-worn">
              <Icon name="check" size={13} />
              {tr("Этот скин уже на тебе — сменить можно любой другой строкой")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Превью скина.
 *
 * Было: палочный человечек — кружок-голова, прямоугольник-тело и
 * линии-конечности strokeWidth 4.4. Ровно то, что пользователь называл
 * «как рисовал ребёнок»: руки той же толщины, что ноги, шеи нет,
 * плечи отсутствуют. Стало: фигура с плечами, сужающимся торсом,
 * настоящими кистями и стопами, тенью под ногами и бликом на теле,
 * чтобы «Сталь» и «Золотой» читались как металл.
 */
function HeroPreview({ skin, w = 52 }: { skin: (typeof HERO_SKINS)[number]; w?: number }) {
  const id = skin.id;
  return (
    <svg width={w} height={Math.round((w * 62) / 52)} viewBox="0 0 52 62">
      <defs>
        <linearGradient id={`sk-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={skin.body} />
          <stop offset="55%" stopColor={skin.body} />
          <stop offset="100%" stopColor="var(--n-000)" stopOpacity="0.34" />
        </linearGradient>
      </defs>

      {/* тень — фигура перестаёт «висеть в воздухе» */}
      <ellipse cx="26" cy="60" rx="12" ry="2.2" fill="var(--n-000)" opacity="0.34" />

      {/* ноги: бедро шире голени */}
      <path d="M22 47 L20.4 58" stroke={skin.accentPart} strokeWidth="6" strokeLinecap="round" />
      <path d="M30 47 L31.6 58" stroke={skin.accentPart} strokeWidth="6" strokeLinecap="round" />
      {/* стопы */}
      <ellipse cx="19.6" cy="59" rx="3.6" ry="1.8" fill="var(--n-200)" />
      <ellipse cx="32.4" cy="59" rx="3.6" ry="1.8" fill="var(--n-200)" />

      {/* торс с плечами */}
      <path
        d="M18.5 34 Q26 30.6 33.5 34 L35 45.6 Q26 48.6 17 45.6 Z"
        fill={`url(#sk-${id})`}
        stroke="var(--n-000)"
        strokeOpacity="0.24"
        strokeWidth="0.8"
      />

      {/* руки с кистями — тоньше ног, как у человека */}
      <path d="M18.6 35.4 Q13 39 11.4 44.4" stroke={skin.body} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M33.4 35.4 Q39 39 40.6 44.4" stroke={skin.body} strokeWidth="4" strokeLinecap="round" fill="none" />
      <circle cx="10.9" cy="45.8" r="2.5" fill={skin.body} />
      <circle cx="41.1" cy="45.8" r="2.5" fill={skin.body} />

      {/* шея */}
      <rect x="23.6" y="28.4" width="4.8" height="4.2" rx="1.8" fill={skin.body} opacity="0.85" />

      {/* голова */}
      <circle cx="26" cy="21" r="9.4" fill={skin.body} />
      <path d="M17.6 18 Q26 10.6 34.4 18" fill="var(--n-900)" opacity="0.09" />
      <ellipse cx="22.6" cy="20.6" rx="1.5" ry="1.8" fill="#0d0d12" />
      <ellipse cx="29.4" cy="20.6" rx="1.5" ry="1.8" fill="#0d0d12" />
      <path d="M23.4 25 Q26 26.6 28.6 25" stroke="#0d0d12" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.6" />

      {/* головные уборы поверх головы */}
      {skin.hat === 2 && (
        <path d="M14.5 12.6 L18.4 3.4 L22.2 9.6 L26 1.4 L29.8 9.6 L33.6 3.4 L37.5 12.6 Z" fill={skin.accentPart} stroke="var(--n-000)" strokeOpacity="0.2" strokeWidth="0.7" />
      )}
      {skin.hat === 1 && (
        <>
          <path d="M15.4 13.4 Q26 4.6 36.6 13.4 Z" fill={skin.accentPart} />
          <ellipse cx="19.5" cy="14.2" rx="15" ry="2.3" fill={skin.accentPart} />
        </>
      )}
      {skin.hat === 3 && (
        <>
          <rect x="18.6" y="1.4" width="14.8" height="12" rx="1.6" fill={skin.accentPart} />
          <ellipse cx="26" cy="13.6" rx="16" ry="2.4" fill={skin.accentPart} />
        </>
      )}
      {skin.hat === 4 && (
        <ellipse cx="26" cy="7" rx="9.4" ry="2.8" fill="none" stroke={skin.accentPart} strokeWidth="2.4" />
      )}
    </svg>
  );
}

/* ============ ТЕМЫ ============ */
function Themes() {
  const { s, set, spendCoins, toast } = useGame();
  const pick = (id: string, price: number, name: string) => {
    if (s.ownedThemes.includes(id)) {
      set((d) => { d.settings.accent = id; });
      sfx.buy();
      return;
    }
    if (!spendCoins(price)) return;
    set((d) => { d.ownedThemes.push(id); d.settings.accent = id; });
    sfx.legend();
    haptic("success");
    toast({ title: tr("Тема куплена"), sub: name, icon: "sparkle", tone: "gold" });
  };
  return (
    <>
      <SectionTitle>{tr("Темы")}</SectionTitle>
      <div className="grid grid-cols-2" style={{ gap: 12 }}>
        {ACCENTS.map((a) => {
          const owned = s.ownedThemes.includes(a.id);
          const active = s.settings.accent === a.id;
          return (
            <Tap
              key={a.id} onClick={() => pick(a.id, a.price, a.name)}
              disabled={!owned && s.coins < a.price}
              solid r="lg" className="w-full" sound="none"
              style={{
                padding: 13,
                ...(active ? { borderColor: a.hex, boxShadow: `0 0 0 1px ${a.hex} inset` } : null),
              }}
            >
              <div
                style={{
                  height: 44, borderRadius: "var(--r-sm)", marginBottom: 11,
                  background: `linear-gradient(135deg, ${a.hex}, ${a.hex}3d)`,
                }}
              />
              <div className="t-title-sm clip1">{a.name}</div>
              <div
                className="t-num"
                style={{ fontSize: 11, marginTop: 4, color: active ? a.hex : "var(--text-mute)" }}
              >
                {active ? "Активен" : owned ? "Выбрать" : (
                    <span className="inline-flex items-center" style={{ gap: 5 }}>
                      <Icon name="coin" size={12} /> {fmt(a.price)}
                    </span>
                  )}
              </div>
            </Tap>
          );
        })}
      </div>
    </>
  );
}
