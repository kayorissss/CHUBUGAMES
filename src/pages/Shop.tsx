import { useState } from "react";
import { tr } from "../core/i18n";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import {
  HERO_SKINS, ACCENTS, CASES, RARITY_COLOR, RARITY_LABEL,
} from "../core/content";
import { fmt } from "../core/format";
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
    hint: "Акцентный цвет кнопок, полосок и подсветки",
  },
];

export default function Shop() {
  const [tab, setTab] = useState<Tab>("cases");
  const { s } = useGame();
  const activeTab = SHOP_TABS.find((t) => t.id === tab)!;
  return (
    <Screen
      title={tr("МАГАЗИН")}
      right={
        <Card r="md" className="shrink-0" style={{ padding: "8px 12px" }}>
          <div className="flex items-center" style={{ gap: 10 }}>
            <span className="t-num acc-text inline-flex items-center" style={{ fontSize: 14, gap: 5 }}>
            <Icon name="coin" size={14} /> {fmt(s.coins)}
          </span>
            <span className="t-num inline-flex items-center" style={{ fontSize: 14, gap: 5 }}>
            <Icon name="gem" size={14} /> {s.gems}
          </span>
          </div>
        </Card>
      }
    >
      {/* Вкладки: крупные, с иконкой и подписью — сразу видно, где находишься */}
      <div className="flex" style={{ gap: 8, marginBottom: 16 }}>
        {SHOP_TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => { sfx.click(); haptic("light"); setTab(t.id); }}
              className="flex-1 relative overflow-hidden"
              style={{
                padding: "11px 6px 10px",
                borderRadius: "var(--r-md)",
                background: on ? "var(--acc)" : "var(--btn-bg)",
                color: on ? "var(--acc-ink)" : "var(--text-dim)",
                border: `1px solid ${on ? "transparent" : "var(--btn-brd)"}`,
                boxShadow: on ? "0 8px 22px -10px var(--acc-glow)" : undefined,
                transition: "background 0.18s, color 0.18s",
              }}
            >
              <span className="flex flex-col items-center" style={{ gap: 5 }}>
                <Icon name={t.icon} size={17} />
                <span
                  className="t-label"
                  style={{ fontSize: 9.5, color: "inherit", letterSpacing: "0.02em" }}
                >
                  {tr(t.label)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Где я сейчас: заголовок раздела с пояснением */}
      <div style={{ marginBottom: 16 }}>
        <div className="t-display-sm" style={{ fontSize: 19 }}>{tr(activeTab.title)}</div>
        <div className="t-caption" style={{ marginTop: 3 }}>{tr(activeTab.hint)}</div>
      </div>

      {tab === "cases" && <Cases />}
      {tab === "skins" && <Skins />}
      {tab === "themes" && <Themes />}
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
  /** Что выпадет — знаем заранее, чтобы подсветить финал и добавить напряжения */
  const [pending, setPending] = useState<Rarity>("common");
  /** «почти доехали» — на этой фазе лента ползёт и экран дрожит */
  const [nearEnd, setNearEnd] = useState(false);
  /** Короткая вспышка в момент, когда барабан встал */
  const [flash, setFlash] = useState(false);

  const open = (caseId: string) => {
    const c = CASES.find((x) => x.id === caseId)!;
    if (!spendCoins(c.price)) return;
    setSpinning(true);
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
    setPending(rarity);
    setNearEnd(false);
    // За 900 мс до остановки включаем «замедление»: барабан почти встал,
    // экран мелко дрожит — именно здесь и рождается ожидание.
    const nearT = setTimeout(() => {
      setNearEnd(true);
      haptic("light");
    }, 2100);
    void nearT;

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
      setNearEnd(false);
      setRolling({ friend: picked, rarity, dupe });
      // вспышка цветом редкости — момент вскрытия читается физически
      setFlash(true);
      setTimeout(() => setFlash(false), 420);
      if (rarity === "legend") sfx.legend();
      else sfx.achieve();
      haptic("success");
      if (dupe) toast({ title: tr("Дубликат"), sub: `+${fmt(comp)} монет компенсации`, icon: "refresh" });
    }, 3000);
  };

  return (
    <>
      <div className="t-body" style={{ marginBottom: 16 }}>
        {tr("Каждая карточка навсегда даёт")}{" "}
        <span className="acc-text">{tr("+0.4% ко всем монетам")}</span>.{" "}
        {tr("Дубликаты возвращают 35% стоимости.")}
      </div>

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
              className="relative overflow-hidden"
              style={{
                padding: 0,
                marginBottom: 12,
                border: `1px solid ${skin.line}`,
              }}
            >
              {/* цветная подложка — кейсы отличаются с одного взгляда */}
              <div
                className="absolute pointer-events-none"
                style={{
                  inset: 0,
                  background: `linear-gradient(135deg, ${skin.glow}, transparent 58%)`,
                }}
              />
              <div className="relative" style={{ padding: 15 }}>
                <div className="flex items-start" style={{ gap: 13 }}>
                  {/* сам «кейс» */}
                  <motion.span
                    className="shrink-0 flex items-center justify-center"
                    animate={{ y: [0, -4, 0] }}
                    transition={{
                      duration: 3.2, repeat: Infinity,
                      ease: "easeInOut", delay: ci * 0.4,
                    }}
                    style={{
                      width: 58, height: 58,
                      borderRadius: "var(--r-md)",
                      background: skin.box,
                      color: skin.ink,
                      boxShadow: `0 10px 26px -12px ${skin.ink}`,
                    }}
                  >
                    <Icon name="case" size={28} />
                  </motion.span>

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

      <div style={{ marginTop: 22 }}>
        <SectionTitle
          right={<span className="t-num" style={{ fontSize: 11, color: "var(--text-mute)" }}>{Object.keys(s.cards).length}/{s.friends.length}</span>}
        >{tr("Коллекция")}</SectionTitle>
      </div>
      <div className="grid grid-cols-4" style={{ gap: 9 }}>
        {s.friends.map((f) => {
          const n = s.cards[f.id] || 0;
          return (
            <Card
              key={f.id} r="md" tone={2} className="text-center relative"
              style={{ padding: "9px 5px", opacity: n ? 1 : 0.3 }}
            >
              <div style={{ filter: n ? "none" : "grayscale(1) brightness(0.5)" }}>
                <HeadView friend={f} size={42} style={{ margin: "0 auto" }} />
              </div>
              <div
                className="t-label clip1"
                style={{ marginTop: 6, fontSize: 8, color: RARITY_COLOR[f.rarity] }}
              >
                {f.name}
              </div>
              {n > 1 && (
                <div
                  className="absolute t-num"
                  style={{
                    top: 4, right: 5, fontSize: 9, padding: "1px 5px", borderRadius: 999,
                    background: "var(--acc)", color: "var(--acc-ink)",
                  }}
                >
                  ×{n}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Анимация вскрытия */}
      <AnimatePresence>
        {(spinning || rolling) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center px-5"
            style={{ background: "var(--scrim-strong)", backdropFilter: "blur(20px)" }}
            onClick={() => !spinning && setRolling(null)}
          >
            {flash && (
              <motion.div
                className="fixed inset-0 pointer-events-none"
                initial={{ opacity: 0.85 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.42 }}
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${RARITY_COLOR[pending]}, transparent 70%)`,
                  zIndex: 90,
                }}
              />
            )}
            {spinning ? (
              <motion.div
                className="w-full max-w-sm"
                // на финише экран мелко дрожит — «вот-вот встанет»
                animate={nearEnd ? { x: [0, -2.5, 2.5, -1.5, 1.5, 0] } : {}}
                transition={nearEnd ? { duration: 0.28, repeat: Infinity } : {}}
              >
                <motion.div
                  className="t-label text-center"
                  style={{ marginBottom: 14 }}
                  animate={nearEnd ? { opacity: [1, 0.45, 1] } : {}}
                  transition={{ duration: 0.7, repeat: Infinity }}
                >
                  {nearEnd ? tr("Почти…") : tr("Открываем…")}
                </motion.div>
                <Card
                  r="lg"
                  className="relative overflow-hidden"
                  style={{
                    height: 120,
                    // к концу рамка окрашивается в цвет выпавшей редкости
                    borderColor: nearEnd ? `${RARITY_COLOR[pending]}88` : undefined,
                    boxShadow: nearEnd ? `0 0 44px -10px ${RARITY_COLOR[pending]}` : undefined,
                    transition: "border-color 0.5s, box-shadow 0.5s",
                  }}
                >
                  {/* световой столб по центру — за ним и «останавливается» приз */}
                  <motion.div
                    className="absolute pointer-events-none"
                    animate={{ opacity: nearEnd ? [0.25, 0.55, 0.25] : 0.18 }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                    style={{
                      left: "50%", top: 0, bottom: 0, width: 92, marginLeft: -46,
                      background: `linear-gradient(90deg, transparent, ${RARITY_COLOR[pending]}, transparent)`,
                    }}
                  />
                  <motion.div
                    className="flex items-center gap-3 absolute"
                    style={{ top: 22, left: 0, padding: "0 40%" }}
                    initial={{ x: 0 }}
                    animate={{ x: -22 * 86 + 40 }}
                    // Резкое торможение в самом конце: почти вся дистанция
                    // пролетает быстро, последние головы ползут — так ожидание
                    // приходится на момент, когда уже видно соседние карточки.
                    transition={{ duration: 2.95, ease: [0.07, 0.85, 0.12, 1] }}
                  >
                    {reel.map((f, i) => (
                      <motion.div
                        key={i}
                        style={{ width: 74, flexShrink: 0 }}
                        animate={
                          nearEnd && i === 22
                            ? { scale: [1, 1.14, 1], filter: "saturate(1.35)" }
                            : {}
                        }
                        transition={{ duration: 0.8, repeat: Infinity }}
                      >
                        <HeadView friend={f} size={74} />
                      </motion.div>
                    ))}
                  </motion.div>
                  <div
                    className="absolute"
                    style={{
                      left: "50%", top: 0, bottom: 0, width: 3, marginLeft: -1.5,
                      background: nearEnd ? RARITY_COLOR[pending] : "var(--acc)",
                      boxShadow: `0 0 18px ${nearEnd ? RARITY_COLOR[pending] : "var(--acc-glow)"}`,
                      transition: "background 0.4s",
                    }}
                  />
                </Card>
              </motion.div>
            ) : rolling ? (
              <motion.div
                initial={{ scale: 0.6, opacity: 0, rotateY: 90 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 20 }}
                className="w-full max-w-xs relative"
              >
                {/* Расходящиеся лучи — только для редкого и выше, чтобы
                    обычная карточка не выглядела как джекпот. */}
                {rolling.rarity !== "common" && (
                  <motion.div
                    className="absolute pointer-events-none"
                    initial={{ opacity: 0, scale: 0.4, rotate: 0 }}
                    animate={{ opacity: 0.5, scale: 1, rotate: 360 }}
                    transition={{
                      opacity: { duration: 0.5 },
                      scale: { duration: 0.6, ease: "backOut" },
                      rotate: { duration: 26, repeat: Infinity, ease: "linear" },
                    }}
                    style={{
                      // Круг, а не квадрат: у прямоугольного блока при вращении
                      // видно углы — «крутится квадрат». Плюс край растворяем
                      // маской, чтобы лучи гасли, а не обрывались границей.
                      left: "50%",
                      top: "50%",
                      width: "190%",
                      aspectRatio: "1",
                      marginLeft: "-95%",
                      marginTop: "-95%",
                      borderRadius: "50%",
                      WebkitMaskImage:
                        "radial-gradient(closest-side, #000 34%, rgba(0,0,0,0.55) 62%, transparent 80%)",
                      maskImage:
                        "radial-gradient(closest-side, #000 34%, rgba(0,0,0,0.55) 62%, transparent 80%)",
                      background: `conic-gradient(from 0deg, transparent 0deg, ${RARITY_COLOR[rolling.rarity]}55 12deg, transparent 24deg, transparent 45deg, ${RARITY_COLOR[rolling.rarity]}55 57deg, transparent 69deg, transparent 90deg, ${RARITY_COLOR[rolling.rarity]}55 102deg, transparent 114deg, transparent 135deg, ${RARITY_COLOR[rolling.rarity]}55 147deg, transparent 159deg, transparent 180deg, ${RARITY_COLOR[rolling.rarity]}55 192deg, transparent 204deg, transparent 225deg, ${RARITY_COLOR[rolling.rarity]}55 237deg, transparent 249deg, transparent 270deg, ${RARITY_COLOR[rolling.rarity]}55 282deg, transparent 294deg, transparent 315deg, ${RARITY_COLOR[rolling.rarity]}55 327deg, transparent 339deg)`,
                      filter: "blur(2px)",
                    }}
                  />
                )}
                {/* Искры вокруг легендарки */}
                {rolling.rarity === "legend" &&
                  Array.from({ length: 14 }).map((_, i) => {
                    const a = (i / 14) * Math.PI * 2;
                    return (
                      <motion.span
                        key={i}
                        className="absolute pointer-events-none"
                        initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                        animate={{
                          opacity: [0, 1, 0],
                          x: Math.cos(a) * 150,
                          y: Math.sin(a) * 150,
                          scale: [0.4, 1, 0.3],
                        }}
                        transition={{
                          duration: 1.5,
                          delay: 0.15 + (i % 5) * 0.07,
                          repeat: Infinity,
                          repeatDelay: 1.1,
                        }}
                        style={{
                          left: "50%", top: "50%",
                          width: 7, height: 7, borderRadius: 999,
                          background: RARITY_COLOR.legend,
                          boxShadow: `0 0 12px ${RARITY_COLOR.legend}`,
                        }}
                      />
                    );
                  })}
                <Card
                  r="xl" className="text-center relative"
                  style={{
                    padding: 24,
                    boxShadow: `0 0 60px -14px ${RARITY_COLOR[rolling.rarity]}`,
                    borderColor: `${RARITY_COLOR[rolling.rarity]}66`,
                  }}
                >
                  <motion.div
                    className="t-label"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    style={{ fontSize: 9.5, color: RARITY_COLOR[rolling.rarity] }}
                  >
                    {RARITY_LABEL[rolling.rarity]}
                  </motion.div>
                  <motion.div
                    className="my-4"
                    initial={{ scale: 0.55, y: 18 }}
                    animate={{ scale: 1, y: [0, -8, 0] }}
                    transition={{
                      scale: { type: "spring", stiffness: 300, damping: 13, delay: 0.1 },
                      y: { repeat: Infinity, duration: 2.4, delay: 0.5 },
                    }}
                  >
                    <HeadView friend={rolling.friend} size={132} style={{ margin: "0 auto" }} />
                  </motion.div>
                  <div className="t-display-sm" style={{ marginTop: 4 }}>{rolling.friend.name}</div>
                  <div className="t-caption" style={{ marginTop: 4 }}>{rolling.friend.nick}</div>
                  {rolling.dupe && (
                    <div className="t-label" style={{ marginTop: 10 }}>{tr("Дубликат · компенсация выдана")}</div>
                  )}
                  <div style={{ marginTop: 20 }}>
                    <Button variant="primary" size="lg" full onClick={() => setRolling(null)}>{tr("Забрать")}</Button>
                  </div>
                </Card>
              </motion.div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ============ СКИНЫ ============ */
function Skins() {
  const { s, set, spendCoins, toast } = useGame();
  const buy = (id: string, price: number, name: string) => {
    if (s.ownedSkins.includes(id)) {
      set((d) => { d.heroSkin = id; });
      sfx.buy();
      haptic("light");
      return;
    }
    if (!spendCoins(price)) return;
    set((d) => { d.ownedSkins.push(id); d.heroSkin = id; });
    sfx.legend();
    haptic("success");
    toast({ title: tr("Скин куплен"), sub: name, icon: "user", tone: "gold" });
  };

  return (
    <div className="grid grid-cols-2" style={{ gap: 12 }}>
      {HERO_SKINS.map((sk) => {
        const owned = s.ownedSkins.includes(sk.id);
        const active = s.heroSkin === sk.id;
        return (
          <Tap
            key={sk.id}
            onClick={() => buy(sk.id, sk.price, sk.name)}
            disabled={!owned && s.coins < sk.price}
            solid r="lg" className="text-left w-full" sound="none"
            style={{
              padding: 13,
              ...(active
                ? { borderColor: "var(--acc)", boxShadow: "0 0 0 1px var(--acc) inset" }
                : null),
            }}
          >
            <div className="flex justify-center" style={{ height: 62, marginBottom: 10 }}>
              <HeroPreview skin={sk} />
            </div>
            <div className="t-title-sm clip1">{sk.name}</div>
            <div className="t-caption clip2" style={{ marginTop: 3, minHeight: 28 }}>
              {sk.desc}
            </div>
            <div
              className="t-num text-center"
              style={{
                marginTop: 11, padding: "8px 4px", fontSize: 11.5,
                borderRadius: "var(--r-sm)",
                background: active ? "var(--acc)" : owned ? "var(--btn-bg)" : `${RARITY_COLOR[sk.rarity]}1e`,
                color: active ? "var(--acc-ink)" : owned ? "var(--text-dim)" : RARITY_COLOR[sk.rarity],
              }}
            >
              {active ? "Надет" : owned ? "Надеть" : (
                    <span className="inline-flex items-center" style={{ gap: 5 }}>
                      <Icon name="coin" size={12} /> {fmt(sk.price)}
                    </span>
                  )}
            </div>
          </Tap>
        );
      })}
    </div>
  );
}

function HeroPreview({ skin }: { skin: (typeof HERO_SKINS)[number] }) {
  return (
    <svg width="52" height="62" viewBox="0 0 52 62">
      {skin.hat === 2 && <path d="M14 12 L18 2 L22 9 L26 0 L30 9 L34 2 L38 12 Z" fill={skin.accentPart} />}
      {skin.hat === 1 && <><ellipse cx="26" cy="13" rx="13" ry="8" fill={skin.accentPart} /><ellipse cx="19" cy="15" rx="16" ry="2.4" fill={skin.accentPart} /></>}
      {skin.hat === 3 && <><rect x="18" y="0" width="16" height="14" fill={skin.accentPart} /><ellipse cx="26" cy="14" rx="17" ry="2.6" fill={skin.accentPart} /></>}
      {skin.hat === 4 && <ellipse cx="26" cy="6" rx="10" ry="3" fill="none" stroke={skin.accentPart} strokeWidth="2.6" />}
      <circle cx="26" cy="21" r="10" fill={skin.body} />
      <circle cx="22.5" cy="20" r="1.7" fill="#0d0d12" />
      <circle cx="29.5" cy="20" r="1.7" fill="#0d0d12" />
      <rect x="16" y="31" width="20" height="19" rx="7" fill={skin.body} />
      <line x1="16" y1="35" x2="8" y2="43" stroke={skin.body} strokeWidth="4.4" strokeLinecap="round" />
      <line x1="36" y1="35" x2="44" y2="43" stroke={skin.body} strokeWidth="4.4" strokeLinecap="round" />
      <line x1="21" y1="50" x2="19" y2="60" stroke={skin.accentPart} strokeWidth="5" strokeLinecap="round" />
      <line x1="31" y1="50" x2="33" y2="60" stroke={skin.accentPart} strokeWidth="5" strokeLinecap="round" />
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
    toast({ title: tr("Акцент куплен"), sub: name, icon: "sparkle", tone: "gold" });
  };
  return (
    <>
      <SectionTitle>{tr("Акцентный цвет")}</SectionTitle>
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
