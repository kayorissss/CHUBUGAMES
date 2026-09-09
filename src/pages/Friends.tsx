import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { RARITY_COLOR, RARITY_LABEL } from "../core/content";
import { Panel, Tap, Bar, SectionTitle } from "../ui/Glass";
import HeadView from "../ui/HeadView";
import { sfx, haptic } from "../core/fx";
import type { Friend, FriendLook, Rarity } from "../core/types";

const SKINS = ["#f6d3b0", "#eec9a8", "#e8b48c", "#d9a074", "#c98a5e", "#a9714a", "#7d5233", "#5a3a24"];
const HAIRS = ["#1a1a1e", "#2b2118", "#4a3520", "#7a4a22", "#a8672c", "#c0392b", "#d8c48a", "#e8e8f0", "#5a5a68", "#3b6ea5", "#7a3ba5", "#2fa86b"];
const EYES = ["#3a2c1e", "#2f5d3a", "#3b6ea5", "#4a4a55", "#6b3f1d", "#2a1c12"];
const HAIR_NAMES = ["Лысый", "Короткие", "Шапка", "Ирокез", "Кудри", "Кепка"];
const BROW_NAMES = ["Обычные", "Злые", "Домиком"];
const FACIAL_NAMES = ["Гладко", "Щетина", "Борода", "Усы"];
const GLASS_NAMES = ["Нет", "Круглые", "Прямые"];

export default function Friends() {
  const { s, set, mainFriend, toast } = useGame();
  const [editing, setEditing] = useState<Friend | null>(null);
  const [creating, setCreating] = useState(false);

  const newFriend = (): Friend => ({
    id: `f${Date.now().toString(36)}`,
    name: "НОВЫЙ",
    nick: "Прозвище",
    rarity: "common",
    quote: "Привет.",
    look: {
      skin: SKINS[Math.floor(Math.random() * SKINS.length)],
      hair: HAIRS[Math.floor(Math.random() * HAIRS.length)],
      hairStyle: Math.floor(Math.random() * 6) as any,
      eyes: EYES[Math.floor(Math.random() * EYES.length)],
      brow: Math.floor(Math.random() * 3) as any,
      facial: Math.floor(Math.random() * 4) as any,
      glasses: Math.floor(Math.random() * 3) as any,
      wide: 0.88 + Math.random() * 0.3,
    },
    stats: {
      spit: 20 + Math.floor(Math.random() * 70),
      chub: 20 + Math.floor(Math.random() * 70),
      chaos: 20 + Math.floor(Math.random() * 70),
      luck: 20 + Math.floor(Math.random() * 70),
    },
  });

  const setMain = (id: string) => {
    set((d) => { d.mainFriendId = id; });
    sfx.power();
    haptic("success");
    const f = s.friends.find((x) => x.id === id);
    toast({ title: "Главный босс сменён", sub: f?.name, icon: "👑" });
  };

  return (
    <div className="h-full flex flex-col" style={{ paddingTop: "calc(var(--sat) + 14px)" }}>
      <div className="px-4 mb-3 flex items-end justify-between">
        <div>
          <div className="t-display" style={{ fontSize: 25 }}>ДРУЗЬЯ</div>
          <div className="t-label">{s.friends.length} персонажей</div>
        </div>
        <Tap
          onClick={() => { setEditing(newFriend()); setCreating(true); }}
          accent r="md" className="px-4 py-2.5 t-title" style={{ fontSize: 12 }} sound="power"
        >
          + ДОБАВИТЬ
        </Tap>
      </div>

      <div className="flex-1 scroll px-4" style={{ paddingBottom: "calc(var(--sab) + 116px)" }}>
        <SectionTitle>Главный босс</SectionTitle>
        <Panel r="xl" className="p-4 mb-5 relative overflow-hidden">
          <div className="flex items-center gap-4">
            <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 3 }}>
              <HeadView friend={mainFriend} size={84} />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="t-display" style={{ fontSize: 22 }}>{mainFriend.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-mute)" }}>{mainFriend.nick}</div>
              <div
                className="t-label mt-1.5 inline-block px-2 py-0.5"
                style={{ fontSize: 7, borderRadius: 6, background: `${RARITY_COLOR[mainFriend.rarity]}22`, color: RARITY_COLOR[mainFriend.rarity] }}
              >
                {RARITY_LABEL[mainFriend.rarity]}
              </div>
            </div>
          </div>
          <div className="mt-3.5" style={{ fontSize: 12, fontStyle: "italic", color: "var(--text-dim)" }}>
            «{mainFriend.quote}»
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3.5">
            <StatBar l="СИЛА ПЛЕВКА" v={mainFriend.stats.spit} />
            <StatBar l="ЧАБНОСТЬ" v={mainFriend.stats.chub} />
            <StatBar l="ХАОС" v={mainFriend.stats.chaos} />
            <StatBar l="УДАЧА" v={mainFriend.stats.luck} />
          </div>
        </Panel>

        <SectionTitle>Все друзья</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {s.friends.map((f) => {
            const isMain = f.id === s.mainFriendId;
            return (
              <Panel
                key={f.id} r="lg" className="p-3 relative"
                style={{ border: isMain ? "1.5px solid var(--acc)" : undefined }}
              >
                <div className="flex justify-center mb-2">
                  <HeadView friend={f} size={62} />
                </div>
                <div className="t-title text-center" style={{ fontSize: 13 }}>{f.name}</div>
                <div className="text-center" style={{ fontSize: 9, color: "var(--text-mute)", minHeight: 22, lineHeight: 1.3, marginTop: 2 }}>
                  {f.nick}
                </div>
                <div className="flex gap-1.5 mt-2">
                  <Tap
                    onClick={() => setMain(f.id)} disabled={isMain} accent={!isMain} r="sm"
                    className="flex-1 py-1.5 t-title" style={{ fontSize: 9 }} sound="none"
                  >
                    {isMain ? "БОСС" : "СДЕЛАТЬ"}
                  </Tap>
                  <Tap
                    onClick={() => { setEditing({ ...f, look: { ...f.look }, stats: { ...f.stats } }); setCreating(false); }}
                    r="sm" className="px-2.5 py-1.5" style={{ fontSize: 11 }} sound="none"
                  >
                    ✏️
                  </Tap>
                </div>
                {(s.cards[f.id] || 0) > 0 && (
                  <div
                    className="absolute t-num"
                    style={{ top: 6, right: 8, fontSize: 9, color: RARITY_COLOR[f.rarity] }}
                  >
                    ×{s.cards[f.id]}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
        <div className="t-label text-center mt-5 px-6" style={{ lineHeight: 1.6 }}>
          Загрузи настоящее фото друга — оно станет головой-боссом в играх.
          Всё хранится только на твоём телефоне.
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <Editor
            key={editing.id}
            friend={editing}
            isNew={creating}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatBar({ l, v }: { l: string; v: number }) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="t-label" style={{ fontSize: 7 }}>{l}</span>
        <span className="t-num" style={{ fontSize: 10 }}>{v}</span>
      </div>
      <Bar pct={v / 100} h={4} />
    </div>
  );
}

/* ============ РЕДАКТОР ============ */
function Editor({ friend, isNew, onClose }: { friend: Friend; isNew: boolean; onClose: () => void }) {
  const { s, set, toast } = useGame();
  const [f, setF] = useState<Friend>(friend);
  const fileRef = useRef<HTMLInputElement>(null);

  const upd = (fn: (d: Friend) => void) => {
    setF((p) => {
      const n: Friend = JSON.parse(JSON.stringify(p));
      fn(n);
      return n;
    });
    sfx.click();
  };
  const updLook = (k: keyof FriendLook, v: any) => upd((d) => { (d.look as any)[k] = v; });

  const save = () => {
    if (!f.name.trim()) { sfx.error(); return; }
    set((d) => {
      const i = d.friends.findIndex((x) => x.id === f.id);
      if (i >= 0) d.friends[i] = f;
      else d.friends.push(f);
      if (isNew) d.cards[f.id] = d.cards[f.id] || 0;
    });
    sfx.legend();
    haptic("success");
    toast({ title: isNew ? "Друг добавлен" : "Сохранено", sub: f.name, icon: "👥" });
    onClose();
  };

  const del = () => {
    if (f.builtin) { sfx.error(); toast({ title: "Базового друга нельзя удалить", tone: "bad" }); return; }
    if (s.friends.length <= 2) { sfx.error(); toast({ title: "Должно остаться минимум 2", tone: "bad" }); return; }
    set((d) => {
      d.friends = d.friends.filter((x) => x.id !== f.id);
      if (d.mainFriendId === f.id) d.mainFriendId = d.friends[0].id;
      delete d.cards[f.id];
    });
    sfx.error();
    onClose();
  };

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // сжимаем в квадрат 320×320, чтобы не забить localStorage
        const S = 320;
        const c = document.createElement("canvas");
        c.width = S;
        c.height = S;
        const ctx = c.getContext("2d")!;
        const side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
        upd((d) => { d.photo = c.toDataURL("image/jpeg", 0.82); });
        sfx.power();
        haptic("success");
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const randomize = () => {
    upd((d) => {
      d.look = {
        skin: SKINS[Math.floor(Math.random() * SKINS.length)],
        hair: HAIRS[Math.floor(Math.random() * HAIRS.length)],
        hairStyle: Math.floor(Math.random() * 6) as any,
        eyes: EYES[Math.floor(Math.random() * EYES.length)],
        brow: Math.floor(Math.random() * 3) as any,
        facial: Math.floor(Math.random() * 4) as any,
        glasses: Math.floor(Math.random() * 3) as any,
        wide: 0.86 + Math.random() * 0.34,
      };
    });
    sfx.swoosh();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end"
      style={{ background: "rgba(3,3,5,0.72)", backdropFilter: "blur(14px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="w-full"
        style={{ maxHeight: "92%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <Panel r="xl" strong className="flex flex-col" style={{ borderRadius: "26px 26px 0 0", maxHeight: "92vh" }}>
          <div className="flex justify-center pt-2.5 pb-1">
            <div style={{ width: 38, height: 4, borderRadius: 99, background: "var(--glass-brd)" }} />
          </div>

          <div className="scroll px-4 pb-4" style={{ paddingBottom: "calc(var(--sab) + 16px)" }}>
            <div className="flex items-center gap-4 py-3">
              <div className="relative">
                <HeadView friend={f} size={80} />
                {f.photo && (
                  <button
                    onClick={() => upd((d) => { delete d.photo; })}
                    className="absolute press"
                    style={{
                      bottom: -2, right: -2, width: 24, height: 24, borderRadius: 99,
                      background: "#ff4a30", color: "#fff", fontSize: 12, border: "2px solid var(--bg)",
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <input
                  value={f.name}
                  onChange={(e) => setF({ ...f, name: e.target.value.slice(0, 14).toUpperCase() })}
                  placeholder="ИМЯ"
                  className="t-display"
                  style={{
                    background: "rgba(255,255,255,0.06)", border: "1px solid var(--glass-brd)",
                    borderRadius: 12, padding: "8px 12px", fontSize: 19, color: "var(--text)", width: "100%",
                  }}
                />
                <input
                  value={f.nick}
                  onChange={(e) => setF({ ...f, nick: e.target.value.slice(0, 26) })}
                  placeholder="Прозвище"
                  style={{
                    background: "rgba(255,255,255,0.06)", border: "1px solid var(--glass-brd)",
                    borderRadius: 10, padding: "7px 12px", fontSize: 12, color: "var(--text-dim)", width: "100%",
                  }}
                />
              </div>
            </div>

            <input
              value={f.quote}
              onChange={(e) => setF({ ...f, quote: e.target.value.slice(0, 60) })}
              placeholder="Коронная фраза"
              style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid var(--glass-brd)",
                borderRadius: 10, padding: "9px 12px", fontSize: 12, color: "var(--text)",
                width: "100%", fontStyle: "italic", marginBottom: 12,
              }}
            />

            <div className="flex gap-2 mb-4">
              <Tap onClick={() => fileRef.current?.click()} r="md" className="flex-1 py-2.5 t-title" style={{ fontSize: 11 }} sound="none">
                📷 ФОТО
              </Tap>
              <Tap onClick={randomize} r="md" className="flex-1 py-2.5 t-title" style={{ fontSize: 11 }} sound="none">
                🎲 СЛУЧАЙНО
              </Tap>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
            </div>

            {!f.photo && (
              <>
                <Row label="Кожа">
                  <Swatches list={SKINS} val={f.look.skin} onPick={(v) => updLook("skin", v)} />
                </Row>
                <Row label="Волосы">
                  <Swatches list={HAIRS} val={f.look.hair} onPick={(v) => updLook("hair", v)} />
                </Row>
                <Row label="Причёска">
                  <Opts list={HAIR_NAMES} val={f.look.hairStyle} onPick={(i) => updLook("hairStyle", i)} />
                </Row>
                <Row label="Глаза">
                  <Swatches list={EYES} val={f.look.eyes} onPick={(v) => updLook("eyes", v)} />
                </Row>
                <Row label="Брови">
                  <Opts list={BROW_NAMES} val={f.look.brow} onPick={(i) => updLook("brow", i)} />
                </Row>
                <Row label="Борода">
                  <Opts list={FACIAL_NAMES} val={f.look.facial} onPick={(i) => updLook("facial", i)} />
                </Row>
                <Row label="Очки">
                  <Opts list={GLASS_NAMES} val={f.look.glasses} onPick={(i) => updLook("glasses", i)} />
                </Row>
                <Row label={`Ширина лица · ${(f.look.wide * 100).toFixed(0)}%`}>
                  <input
                    type="range" min={85} max={125} value={f.look.wide * 100}
                    onChange={(e) => updLook("wide", Number(e.target.value) / 100)}
                    style={{ width: "100%", accentColor: "var(--acc)" }}
                  />
                </Row>
              </>
            )}

            <Row label="Редкость">
              <div className="flex gap-1.5">
                {(["common", "rare", "epic", "legend"] as Rarity[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => { setF({ ...f, rarity: r }); sfx.click(); }}
                    className="press flex-1 py-1.5"
                    style={{
                      borderRadius: 8, fontSize: 8, fontWeight: 800, letterSpacing: "0.08em",
                      background: f.rarity === r ? RARITY_COLOR[r] : "rgba(255,255,255,0.06)",
                      color: f.rarity === r ? "#0b0b0e" : "var(--text-mute)",
                      border: "1px solid var(--glass-brd)",
                    }}
                  >
                    {RARITY_LABEL[r]}
                  </button>
                ))}
              </div>
            </Row>

            <Row label="Характеристики">
              {([["spit", "СИЛА ПЛЕВКА"], ["chub", "ЧАБНОСТЬ"], ["chaos", "ХАОС"], ["luck", "УДАЧА"]] as const).map(([k, l]) => (
                <div key={k} className="mb-2">
                  <div className="flex justify-between">
                    <span className="t-label" style={{ fontSize: 7 }}>{l}</span>
                    <span className="t-num" style={{ fontSize: 10 }}>{f.stats[k]}</span>
                  </div>
                  <input
                    type="range" min={1} max={100} value={f.stats[k]}
                    onChange={(e) => setF({ ...f, stats: { ...f.stats, [k]: Number(e.target.value) } })}
                    style={{ width: "100%", accentColor: "var(--acc)" }}
                  />
                </div>
              ))}
            </Row>

            <div className="flex gap-2 mt-4">
              {!isNew && !f.builtin && (
                <Tap onClick={del} r="md" className="px-4 py-3.5" style={{ fontSize: 13 }} sound="none">
                  🗑
                </Tap>
              )}
              <Tap onClick={onClose} r="md" className="px-5 py-3.5 t-title" style={{ fontSize: 12 }}>
                Отмена
              </Tap>
              <Tap onClick={save} accent r="md" className="flex-1 py-3.5 t-title" style={{ fontSize: 13 }} sound="none">
                СОХРАНИТЬ
              </Tap>
            </div>
          </div>
        </Panel>
      </motion.div>
    </motion.div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <div className="t-label mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function Swatches({ list, val, onPick }: { list: string[]; val: string; onPick: (v: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {list.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          className="press"
          style={{
            width: 30, height: 30, borderRadius: 10, background: c,
            border: val === c ? "2.5px solid var(--acc)" : "1px solid rgba(255,255,255,0.16)",
            boxShadow: val === c ? "0 0 14px var(--acc-glow)" : "none",
          }}
        />
      ))}
    </div>
  );
}

function Opts({ list, val, onPick }: { list: string[]; val: number; onPick: (i: number) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {list.map((n, i) => (
        <button
          key={n}
          onClick={() => onPick(i)}
          className="press px-3 py-1.5"
          style={{
            borderRadius: 9, fontSize: 10, fontWeight: 700,
            background: val === i ? "var(--acc)" : "rgba(255,255,255,0.06)",
            color: val === i ? "var(--acc-ink)" : "var(--text-dim)",
            border: "1px solid var(--glass-brd)",
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
