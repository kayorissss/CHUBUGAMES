import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import {
  HERO_SKINS, ACCENTS, CASES, RARITY_COLOR, RARITY_LABEL,
} from "../core/content";
import { fmt } from "../core/format";
import { Panel, Tap, Chip, SectionTitle } from "../ui/Glass";
import HeadView from "../ui/HeadView";
import { sfx, haptic } from "../core/fx";
import type { Friend, Rarity } from "../core/types";

type Tab = "cases" | "skins" | "themes";

export default function Shop() {
  const [tab, setTab] = useState<Tab>("cases");
  const { s } = useGame();
  return (
    <div className="h-full flex flex-col" style={{ paddingTop: "calc(var(--sat) + 14px)" }}>
      <div className="px-4 mb-3 flex items-center justify-between gap-3">
        <div className="t-display shrink-0" style={{ fontSize: 25 }}>МАГАЗИН</div>
        <Panel r="md" className="px-3 py-1.5 flex items-center gap-2.5 shrink-0">
          <span className="t-num acc-text" style={{ fontSize: 13 }}>🪙 {fmt(s.coins)}</span>
          <span className="t-num" style={{ fontSize: 13 }}>💎 {s.gems}</span>
        </Panel>
      </div>
      <div className="px-4 mb-3 flex gap-2">
        <Chip active={tab === "cases"} onClick={() => setTab("cases")}>Кейсы</Chip>
        <Chip active={tab === "skins"} onClick={() => setTab("skins")}>Скины</Chip>
        <Chip active={tab === "themes"} onClick={() => setTab("themes")}>Темы</Chip>
      </div>
      <div className="flex-1 scroll px-4" style={{ paddingBottom: "calc(var(--sab) + 116px)" }}>
        {tab === "cases" && <Cases />}
        {tab === "skins" && <Skins />}
        {tab === "themes" && <Themes />}
      </div>
    </div>
  );
}

/* ============ КЕЙСЫ ============ */
function Cases() {
  const { s, set, spendCoins, toast, addXp } = useGame();
  const [rolling, setRolling] = useState<null | { friend: Friend; rarity: Rarity; dupe: boolean }>(null);
  const [spinning, setSpinning] = useState(false);
  const [reel, setReel] = useState<Friend[]>([]);

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
      if (dupe) toast({ title: "Дубликат", sub: `+${fmt(comp)} 🪙 компенсация`, icon: "♻️" });
    }, 2600);
  };

  return (
    <>
      <SectionTitle>Кейсы с карточками друзей</SectionTitle>
      <div style={{ fontSize: 11, color: "var(--text-mute)", lineHeight: 1.5, marginBottom: 12, padding: "0 4px" }}>
        Каждая карточка навсегда даёт <span className="acc-text">+0.4% ко всем монетам</span>.
        Дубликаты возвращают 35% стоимости кейса.
      </div>

      {CASES.map((c) => (
        <Panel key={c.id} r="lg" className="p-4 mb-3 relative overflow-hidden">
          <div className="absolute pointer-events-none" style={{ right: -10, top: -12, fontSize: 68, opacity: 0.09, lineHeight: 1 }}>📦</div>
          <div className="t-title clip1" style={{ fontSize: 16, maxWidth: "80%" }}>{c.name}</div>
          <div className="clip1" style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 2, maxWidth: "80%" }}>
            {c.desc}
          </div>
          <div className="flex gap-1.5 my-3 flex-wrap">
            {(Object.keys(c.odds) as Rarity[]).map((r) => (
              <div
                key={r}
                className="t-label px-2 py-1"
                style={{
                  fontSize: 7, borderRadius: 6, whiteSpace: "nowrap",
                  background: `${RARITY_COLOR[r]}1e`, color: RARITY_COLOR[r],
                }}
              >
                {RARITY_LABEL[r]} {(c.odds[r] * 100).toFixed(c.odds[r] < 0.02 ? 1 : 0)}%
              </div>
            ))}
          </div>
          <Tap
            onClick={() => open(c.id)}
            disabled={s.coins < c.price || spinning}
            accent={s.coins >= c.price}
            r="md" className="w-full py-3 t-num" style={{ fontSize: 14 }} sound="none"
          >
            ОТКРЫТЬ · 🪙 {fmt(c.price)}
          </Tap>
        </Panel>
      ))}

      <SectionTitle right={<span className="t-label">{Object.keys(s.cards).length}/{s.friends.length}</span>}>
        Коллекция
      </SectionTitle>
      <div className="grid grid-cols-4 gap-2.5">
        {s.friends.map((f) => {
          const n = s.cards[f.id] || 0;
          return (
            <Panel key={f.id} r="md" className="p-2 text-center relative" style={{ opacity: n ? 1 : 0.32 }}>
              <div style={{ filter: n ? "none" : "grayscale(1) brightness(0.5)" }}>
                <HeadView friend={f} size={44} style={{ margin: "0 auto" }} />
              </div>
              <div className="t-label mt-1" style={{ fontSize: 7, color: RARITY_COLOR[f.rarity] }}>{f.name}</div>
              {n > 1 && (
                <div
                  className="absolute t-num"
                  style={{
                    top: 3, right: 4, fontSize: 9, padding: "1px 5px", borderRadius: 99,
                    background: "var(--acc)", color: "var(--acc-ink)",
                  }}
                >
                  ×{n}
                </div>
              )}
            </Panel>
          );
        })}
      </div>

      {/* Анимация вскрытия */}
      <AnimatePresence>
        {(spinning || rolling) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center px-5"
            style={{ background: "rgba(3,3,5,0.86)", backdropFilter: "blur(20px)" }}
            onClick={() => !spinning && setRolling(null)}
          >
            {spinning ? (
              <div className="w-full max-w-sm">
                <div className="t-label text-center mb-3">ОТКРЫВАЕМ...</div>
                <Panel r="lg" className="relative overflow-hidden" style={{ height: 120 }}>
                  <motion.div
                    className="flex items-center gap-3 absolute"
                    style={{ top: 22, left: 0, padding: "0 40%" }}
                    initial={{ x: 0 }}
                    animate={{ x: -22 * 86 + 40 }}
                    transition={{ duration: 2.5, ease: [0.16, 0.9, 0.25, 1] }}
                  >
                    {reel.map((f, i) => (
                      <div key={i} style={{ width: 74, flexShrink: 0 }}>
                        <HeadView friend={f} size={74} />
                      </div>
                    ))}
                  </motion.div>
                  <div
                    className="absolute"
                    style={{
                      left: "50%", top: 0, bottom: 0, width: 3, marginLeft: -1.5,
                      background: "var(--acc)", boxShadow: "0 0 18px var(--acc-glow)",
                    }}
                  />
                </Panel>
              </div>
            ) : rolling ? (
              <motion.div
                initial={{ scale: 0.6, opacity: 0, rotateY: 90 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 20 }}
                className="w-full max-w-xs"
              >
                <Panel
                  r="xl" strong className="p-6 text-center"
                  style={{ boxShadow: `0 0 60px -10px ${RARITY_COLOR[rolling.rarity]}` }}
                >
                  <div className="t-label" style={{ fontSize: 10, color: RARITY_COLOR[rolling.rarity] }}>
                    {RARITY_LABEL[rolling.rarity]}
                  </div>
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ repeat: Infinity, duration: 2.4 }}
                    className="my-4"
                  >
                    <HeadView friend={rolling.friend} size={132} style={{ margin: "0 auto" }} />
                  </motion.div>
                  <div className="t-display" style={{ fontSize: 26 }}>{rolling.friend.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 3 }}>{rolling.friend.nick}</div>
                  {rolling.dupe && <div className="t-label mt-2">ДУБЛИКАТ · КОМПЕНСАЦИЯ ВЫДАНА</div>}
                  <Tap
                    onClick={() => setRolling(null)} accent r="md"
                    className="w-full py-3 mt-5 t-title" style={{ fontSize: 13 }}
                  >
                    ЗАБРАТЬ
                  </Tap>
                </Panel>
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
    toast({ title: "Скин куплен", sub: name, icon: "👕", tone: "gold" });
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {HERO_SKINS.map((sk) => {
        const owned = s.ownedSkins.includes(sk.id);
        const active = s.heroSkin === sk.id;
        return (
          <Tap
            key={sk.id}
            onClick={() => buy(sk.id, sk.price, sk.name)}
            disabled={!owned && s.coins < sk.price}
            r="lg" className="p-3 text-left" sound="none"
            style={{
              border: active ? "1.5px solid var(--acc)" : undefined,
              boxShadow: active ? "0 0 24px -8px var(--acc-glow)" : undefined,
            }}
          >
            <div className="flex justify-center mb-2" style={{ height: 62 }}>
              <HeroPreview skin={sk} />
            </div>
            <div className="t-title" style={{ fontSize: 12 }}>{sk.name}</div>
            <div style={{ fontSize: 9, color: "var(--text-mute)", lineHeight: 1.3, minHeight: 24, marginTop: 2 }}>
              {sk.desc}
            </div>
            <div
              className="t-num mt-2 py-1.5 text-center"
              style={{
                fontSize: 11, borderRadius: 8,
                background: active ? "var(--acc)" : owned ? "rgba(255,255,255,0.09)" : `${RARITY_COLOR[sk.rarity]}1e`,
                color: active ? "var(--acc-ink)" : owned ? "var(--text-dim)" : RARITY_COLOR[sk.rarity],
              }}
            >
              {active ? "НАДЕТ" : owned ? "НАДЕТЬ" : `🪙 ${fmt(sk.price)}`}
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
    toast({ title: "Акцент куплен", sub: name, icon: "🎨", tone: "gold" });
  };
  return (
    <>
      <SectionTitle>Акцентный цвет</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {ACCENTS.map((a) => {
          const owned = s.ownedThemes.includes(a.id);
          const active = s.settings.accent === a.id;
          return (
            <Tap
              key={a.id} onClick={() => pick(a.id, a.price, a.name)}
              disabled={!owned && s.coins < a.price} r="lg" className="p-3.5" sound="none"
              style={{ border: active ? `1.5px solid ${a.hex}` : undefined }}
            >
              <div
                style={{
                  height: 42, borderRadius: 12, marginBottom: 9,
                  background: `linear-gradient(135deg, ${a.hex}, ${a.hex}44)`,
                  boxShadow: `0 6px 22px -8px ${a.hex}`,
                }}
              />
              <div className="t-title" style={{ fontSize: 12 }}>{a.name}</div>
              <div className="t-num" style={{ fontSize: 10, color: active ? a.hex : "var(--text-mute)", marginTop: 2 }}>
                {active ? "АКТИВЕН" : owned ? "ВЫБРАТЬ" : `🪙 ${fmt(a.price)}`}
              </div>
            </Tap>
          );
        })}
      </div>
    </>
  );
}
