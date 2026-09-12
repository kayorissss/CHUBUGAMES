import { useCallback, useEffect, useRef, useState } from "react";
import { tr } from "../core/i18n";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { bossStats } from "../core/save";
import { RARITY_COLOR, RARITY_LABEL } from "../core/content";
import { Card, Tap, Button, Bar, SectionTitle, Screen } from "../ui/Glass";
import HeadView from "../ui/HeadView";
import FriendshipCard from "../ui/FriendshipCard";
import Icon from "../ui/Icon";
import { sfx, haptic } from "../core/fx";
import type { Friend, FriendLook, Rarity } from "../core/types";

const SKINS = ["#f6d3b0", "#eec9a8", "#e8b48c", "#d9a074", "#c98a5e", "#a9714a", "#7d5233", "#5a3a24"];
const HAIRS = ["#1a1a1e", "#2b2118", "#4a3520", "#7a4a22", "#a8672c", "#c0392b", "#d8c48a", "#e8e8f0", "#5a5a68", "#3b6ea5", "#7a3ba5", "#2fa86b"];
const EYES = ["#3a2c1e", "#2f5d3a", "#3b6ea5", "#4a4a55", "#6b3f1d", "#2a1c12"];
const SHIRT_COLORS = ["#2a3140", "#3d4756", "#c86a9a", "#c0392b", "#2f6f4f", "#6b5230", "#1f1f26", "#8f63bd"];
const HAIR_NAMES = ["Лысый", "Короткие", "Шапка", "Ирокез", "Кудри", "Кепка", "Ёжик", "Длинные", "Штрихкод", "Под машинку"];
const BROW_NAMES = ["Обычные", "Злые", "Домиком"];
const FACIAL_NAMES = ["Гладко", "Щетина", "Борода", "Усы", "Козья"];
const GLASS_NAMES = ["Нет", "Круглые", "Прямые"];
const SHIRT_NAMES = ["Обычная", "Сетка", "Костюм", "Худи"];
const PROP_NAMES = ["Нет", "Пиво", "Планшет"];
const SHIRT_KEYS = ["plain", "mesh", "suit", "hoodie"] as const;
const PROP_KEYS = ["none", "beer", "clipboard"] as const;

export default function Friends() {
  const { s, set, mainFriend, toast } = useGame();
  const bonus = bossStats(s);
  const [editing, setEditing] = useState<Friend | null>(null);
  const [creating, setCreating] = useState(false);

  const newFriend = (): Friend => ({
    id: `f${Date.now().toString(36)}`,
    name: tr("НОВЫЙ"),
    nick: tr("Прозвище"),
    rarity: "common",
    quote: tr("Привет."),
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
    toast({ title: tr("Главный босс сменён"), sub: f?.name, icon: "crown" });
  };

  return (
    <Screen
      title={tr("ДРУЗЬЯ")}
      sub={`${s.friends.length} персонажей`}
      right={
        <Button
          variant="primary"
          size="sm"
          onClick={() => { setEditing(newFriend()); setCreating(true); }}
          sound="power"
          icon={<Icon name="plus" size={13} />}
        >{tr("СВОЙ")}</Button>
      }
    >
      {/* ПК: карточка главного босса и список друзей стоят рядом, а не
          друг под другом — иначе на мониторе список уезжал за прокрутку */}
      <div className="pc-cols">
      <div className="pc-col">
        <SectionTitle>{tr("Главный босс")}</SectionTitle>
        <Card r="xl" className="relative overflow-hidden" style={{ padding: 16, marginBottom: 22 }}>
          <div className="flex items-center" style={{ gap: 15 }}>
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
              className="shrink-0"
            >
              {/* gear: на главном друге видно купленные в казино украшения */}
              <HeadView friend={mainFriend} size={76} gear />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="t-display-sm clip1">{mainFriend.name}</div>
              <div className="t-caption clip1" style={{ marginTop: 2 }}>{mainFriend.nick}</div>
              <div
                className="t-label"
                style={{
                  marginTop: 8, display: "inline-block", padding: "3px 8px",
                  fontSize: 8.5, borderRadius: 999,
                  background: `${RARITY_COLOR[mainFriend.rarity]}1f`,
                  color: RARITY_COLOR[mainFriend.rarity],
                }}
              >
                {tr(RARITY_LABEL[mainFriend.rarity])}
              </div>
            </div>
          </div>

          <div
            className="t-body"
            style={{
              marginTop: 15, padding: "10px 13px", borderRadius: "var(--r-md)",
              background: "var(--btn-bg)", fontStyle: "italic",
            }}
          >
            «{mainFriend.quote}»
          </div>

          {/* Дружба: уровень, прибавка к монетам и истории друга */}
          <FriendshipCard friendId={mainFriend.id} name={mainFriend.name} />

          <div
            className="grid grid-cols-2"
            style={{ columnGap: 18, rowGap: 12, marginTop: 16 }}
          >
            <StatBar
              l={tr("Меткость")}
              v={mainFriend.stats.spit}
              effect={`+${(bonus.critBonus * 100).toFixed(1)}% к криту в кликере`}
            />
            <StatBar
              l={tr("Выносливость")}
              v={mainFriend.stats.chub}
              effect={`+${Math.round(bonus.offlineBonus * 100)}% офлайн-дохода`}
            />
            <StatBar
              l={tr("Безбашенность")}
              v={mainFriend.stats.chaos}
              effect={`+${Math.round(bonus.coinBonus * 100)}% монет везде`}
            />
            <StatBar
              l={tr("Удача")}
              v={mainFriend.stats.luck}
              effect={`+${Math.round(bonus.luckBonus * 100)}% ${tr("к редким дропам")}`}
            />
          </div>

          <div
            className="t-caption"
            style={{ marginTop: 14, lineHeight: 1.5, opacity: 0.85 }}
          >
            {tr("Статы работают, пока друг стоит главным боссом. Меняешь босса — меняются бонусы.")}
          </div>
        </Card>

      </div>
      <div className="pc-col">
        <SectionTitle>{tr("Все персонажи")}</SectionTitle>
        {/* Плиткой по три: списком они выглядели как анкета, а на мониторе
            половины ширины не хватало, чтобы разглядеть лица. */}
        <div className="pc-pal-grid" style={{ gap: 12 }}>
          {s.friends.map((f) => {
            const isMain = f.id === s.mainFriendId;
            const cards = s.cards[f.id] || 0;
            return (
              <Card key={f.id} r="lg" active={isMain} className="relative" style={{ padding: 13 }}>
                {cards > 0 && (
                  <div
                    className="t-num absolute"
                    style={{
                      top: 9, right: 10, fontSize: 10,
                      color: RARITY_COLOR[f.rarity],
                    }}
                  >
                    ×{cards}
                  </div>
                )}
                <div className="flex justify-center" style={{ marginBottom: 10 }}>
                  <HeadView friend={f} size={58} />
                </div>
                <div className="t-title-sm text-center clip1">{f.name}</div>
                <div
                  className="t-caption text-center clip1"
                  style={{ marginTop: 3, marginBottom: 12 }}
                >
                  {f.nick}
                </div>
                <div className="flex" style={{ gap: 7 }}>
                  <Button
                    variant={isMain ? "secondary" : "primary"}
                    size="sm"
                    disabled={isMain}
                    onClick={() => setMain(f.id)}
                    sound="none"
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    {isMain ? "Босс" : tr("Выбрать")}
                  </Button>
                  {!f.builtin && (
                    <Button
                      variant="secondary"
                      size="sm"
                      sound="none"
                      onClick={() => { setEditing({ ...f, look: { ...f.look }, stats: { ...f.stats } }); setCreating(false); }}
                      style={{ padding: "8px 10px" }}
                    >
                      <Icon name="settings" size={14} />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
        <div
          className="t-caption text-center"
          style={{ marginTop: 20, paddingInline: 12, lineHeight: 1.55 }}
        >
          {tr("Создай своего персонажа кнопкой сверху — его можно сделать главным и боссом, загрузить настоящее фото. Всё хранится только на этом устройстве, никуда не уходит.")}
        </div>

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
    </Screen>
  );
}

function StatBar({ l, v, effect }: { l: string; v: number; effect?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="flex justify-between items-baseline" style={{ gap: 6, marginBottom: 6 }}>
        <span className="t-label clip1" style={{ fontSize: 8.5 }}>{l}</span>
        <span className="t-num shrink-0" style={{ fontSize: 11 }}>{v}</span>
      </div>
      <Bar pct={v / 100} h={5} />
      {effect && (
        <div className="t-caption clip1" style={{ marginTop: 4, fontSize: 9.5 }}>
          {effect}
        </div>
      )}
    </div>
  );
}

/* ============ РЕДАКТОР ============ */
/**
 * РЕДАКТОР ПЕРСОНАЖА.
 *
 * Просьба: «создание своего персонажа — непонятно и баги, особенно с Esc».
 *   • Esc в редакторе уходил в глобальный обработчик приложения и выходи́л из
 *     раздела «Персонажи» целиком — прямо посреди настройки лица;
 *   • клик по затемнению и «Отмена» молча выбрасывали все правки;
 *   • на мониторе это была мобильная шторка на 92% высоты: бесконечный список
 *     кнопок, а «СОХРАНИТЬ» — в самом низу, за скроллом;
 *   • загрузка фото прятала ВСЕ настройки внешности без единого слова —
 *     выглядело как «редактор сломался»;
 *   • пустое имя отвечало только писком, без подсказки.
 *
 * Теперь: Esc закрывает сам редактор (и не идёт в навигацию), закрытие с
 * несохранённым черновиком требует подтверждения, подвал с «СОХРАНИТЬ»
 * прилеплен к нижнему краю, на мониторе это центральное окно, а не шторка, и
 * каждая ловушка подписана на месте.
 */
function Editor({ friend, isNew, onClose }: { friend: Friend; isNew: boolean; onClose: () => void }) {
  const { s, set, toast } = useGame();
  const [f, setF] = useState<Friend>(friend);
  const fileRef = useRef<HTMLInputElement>(null);
  /** правки есть — просто так выбрасывать их нельзя */
  const dirty = JSON.stringify(f) !== JSON.stringify(friend);
  const [allowDiscard, setAllowDiscard] = useState(false);

  const upd = (fn: (d: Friend) => void) => {
    setF((p) => {
      const n: Friend = JSON.parse(JSON.stringify(p));
      fn(n);
      return n;
    });
    sfx.click();
  };
  const updLook = (k: keyof FriendLook, v: any) => upd((d) => { (d.look as any)[k] = v; });

  /** закрытие: сначала предупреждаем, если есть несохранённые правки */
  const close = useCallback(() => {
    if (dirty && !allowDiscard) {
      setAllowDiscard(true);
      sfx.error();
      haptic("error");
      toast({
        title: tr("Есть несохранённое"),
        sub: tr("нажмите ещё раз, чтобы закрыть без сохранения"),
        icon: "warn",
        tone: "bad",
      });
      return;
    }
    onClose();
  }, [dirty, allowDiscard, onClose, toast]);

  /* Esc закрывает РЕДАКТОР, а не раздел: слушаем на capture и гасим событие,
     иначе его перехватывает глобальный «Esc = назад». */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);

  const save = () => {
    if (!f.name.trim()) {
      sfx.error();
      haptic("error");
      toast({ title: tr("Нужно имя"), sub: tr("без имени персонаж не сохранится"), icon: "warn", tone: "bad" });
      return;
    }
    set((d) => {
      const i = d.friends.findIndex((x) => x.id === f.id);
      if (i >= 0) d.friends[i] = f;
      else d.friends.push(f);
      if (isNew) d.cards[f.id] = d.cards[f.id] || 0;
    });
    sfx.legend();
    haptic("success");
    toast({ title: isNew ? tr("Друг добавлен") : tr("Сохранено"), sub: f.name, icon: "users" });
    onClose();
  };

  const del = () => {
    if (f.builtin) { sfx.error(); toast({ title: tr("Базового друга нельзя удалить"), tone: "bad" }); return; }
    if (s.friends.length <= 2) { sfx.error(); toast({ title: tr("Должно остаться минимум 2"), tone: "bad" }); return; }
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
        hairStyle: Math.floor(Math.random() * 10) as any,
        eyes: EYES[Math.floor(Math.random() * EYES.length)],
        brow: Math.floor(Math.random() * 3) as any,
        facial: Math.floor(Math.random() * 5) as any,
        glasses: Math.floor(Math.random() * 3) as any,
        wide: 0.86 + Math.random() * 0.34,
      };
    });
    sfx.swoosh();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end fr-scrim"
      style={{ background: "var(--scrim)", backdropFilter: "blur(14px)" }}
      onClick={close}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="w-full fr-wrap"
        style={{ maxHeight: "92%" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* m-sheet: стекло с преломлением, край скруглён сверху, низ —
            до системной полоски; ручка (m-handle) говорит, что лист можно тянуть */}
        <div
          className="m-sheet glass glass-strong flex flex-col fr-sheet"
          style={{ maxHeight: "92vh" }}
        >
          <div className="flex justify-center" style={{ paddingTop: 10, paddingBottom: 4 }}>
            <div className="m-handle" />
          </div>

          {/* заголовок с крестиком: у шторки его не было вовсе, и «как отсюда
              выйти» приходилось угадывать */}
          <div className="fr-head">
            <span className="min-w-0">
              <span className="t-display fr-head-title">
                {isNew ? tr("Создать персонажа") : tr("Изменить персонажа")}
              </span>
              <span className="t-caption fr-head-sub">
                {tr("имя, внешность и характер сохраняются в этом профиле")}
                {dirty ? ` · ${tr("есть несохранённое")}` : ""}
              </span>
            </span>
            <button type="button" className="fr-x" onClick={close} aria-label={tr("Закрыть")}>
              <Icon name="cross" size={14} />
            </button>
          </div>

          <div className="scroll px-4 pb-4 fr-body" style={{ paddingBottom: "calc(var(--sab) + 16px)" }}>
            <div className="flex items-center gap-4 py-3">
              <div className="relative">
                <HeadView friend={f} size={80} />
                {f.photo && (
                  <button
                    onClick={() => upd((d) => { delete d.photo; })}
                    className="absolute press"
                    style={{
                      bottom: -2, right: -2, width: 24, height: 24, borderRadius: 99,
                      background: "var(--danger)", color: "var(--danger-ink)", fontSize: 12, border: "2px solid var(--bg)",
                    }}
                  >
                    <Icon name="cross" size={15} />
                  </button>
                )}
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <input
                  value={f.name}
                  onChange={(e) => setF({ ...f, name: e.target.value.slice(0, 14).toUpperCase() })}
                  placeholder={tr("ИМЯ")}
                  className="t-display"
                  style={{
                    background: "var(--surface-2)", border: "1px solid var(--glass-brd)",
                    borderRadius: 12, padding: "8px 12px", fontSize: 19, color: "var(--text)", width: "100%",
                  }}
                />
                {!f.name.trim() && (
                  <span className="fr-warn">{tr("имя обязательно — без него персонаж не сохранится")}</span>
                )}
                <input
                  value={f.nick}
                  onChange={(e) => setF({ ...f, nick: e.target.value.slice(0, 26) })}
                  placeholder={tr("Прозвище")}
                  style={{
                    background: "var(--surface-2)", border: "1px solid var(--glass-brd)",
                    borderRadius: 10, padding: "7px 12px", fontSize: 12, color: "var(--text-dim)", width: "100%",
                  }}
                />
              </div>
            </div>

            <input
              value={f.quote}
              onChange={(e) => setF({ ...f, quote: e.target.value.slice(0, 60) })}
              placeholder={tr("Коронная фраза")}
              style={{
                background: "var(--surface-2)", border: "1px solid var(--glass-brd)",
                borderRadius: 10, padding: "9px 12px", fontSize: 12, color: "var(--text)",
                width: "100%", fontStyle: "italic", marginBottom: 12,
              }}
            />

            <div className="flex gap-2 mb-4">
              <Tap onClick={() => fileRef.current?.click()} r="md" center className="flex-1 py-2.5 t-title" style={{ fontSize: 11 }} sound="none">
                <span className="inline-flex items-center justify-center" style={{ gap: 6 }}>
                  <Icon name="eye" size={13} />{tr("ФОТО")}</span>
              </Tap>
              <Tap onClick={randomize} r="md" center className="flex-1 py-2.5 t-title" style={{ fontSize: 11 }} sound="none">
                <span className="inline-flex items-center justify-center" style={{ gap: 6 }}>
                  <Icon name="dice" size={13} />{tr("СЛУЧАЙНО")}</span>
              </Tap>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
            </div>

            {!f.photo && (
              <>
                <Row label={tr("Кожа")}>
                  <Swatches list={SKINS} val={f.look.skin} onPick={(v) => updLook("skin", v)} />
                </Row>
                <Row label={tr("Волосы")}>
                  <Swatches list={HAIRS} val={f.look.hair} onPick={(v) => updLook("hair", v)} />
                </Row>
                <Row label={tr("Причёска")}>
                  <Opts list={HAIR_NAMES} val={f.look.hairStyle} onPick={(i) => updLook("hairStyle", i)} />
                </Row>
                <Row label={tr("Глаза")}>
                  <Swatches list={EYES} val={f.look.eyes} onPick={(v) => updLook("eyes", v)} />
                </Row>
                <Row label={tr("Брови")}>
                  <Opts list={BROW_NAMES} val={f.look.brow} onPick={(i) => updLook("brow", i)} />
                </Row>
                <Row label={tr("Борода")}>
                  <Opts list={FACIAL_NAMES} val={f.look.facial} onPick={(i) => updLook("facial", i)} />
                </Row>
                <Row label={tr("Очки")}>
                  <Opts list={GLASS_NAMES} val={f.look.glasses} onPick={(i) => updLook("glasses", i)} />
                </Row>
                <Row label={`${tr("Ширина лица")} · ${(f.look.wide * 100).toFixed(0)}%`}>
                  <input
                    type="range" min={80} max={125} value={f.look.wide * 100}
                    onChange={(e) => updLook("wide", Number(e.target.value) / 100)}
                    style={{ width: "100%", accentColor: "var(--acc)" }}
                  />
                </Row>
                <Row label={tr("Одежда")}>
                  <Opts
                    list={SHIRT_NAMES}
                    val={Math.max(0, SHIRT_KEYS.indexOf((f.look.shirt || "plain") as any))}
                    onPick={(i) => updLook("shirt", SHIRT_KEYS[i])}
                  />
                </Row>
                <Row label={tr("Цвет одежды")}>
                  <Swatches
                    list={SHIRT_COLORS}
                    val={f.look.shirtColor || SHIRT_COLORS[0]}
                    onPick={(v) => updLook("shirtColor", v)}
                  />
                </Row>
                <Row label={tr("В руках")}>
                  <Opts
                    list={PROP_NAMES}
                    val={Math.max(0, PROP_KEYS.indexOf((f.look.prop || "none") as any))}
                    onPick={(i) => updLook("prop", PROP_KEYS[i])}
                  />
                </Row>
                <Row label={tr("Зубы")}>
                  <Opts
                    list={[tr("Обычные"), tr("Брекеты")]}
                    val={f.look.braces ? 1 : 0}
                    onPick={(i) => updLook("braces", i === 1)}
                  />
                </Row>
              </>
            )}

            {f.photo && (
              <div className="fr-phototip">
                <Icon name="info" size={12} />
                {tr("С фото лицо не рисуется: настройки внешности вернутся, если убрать фото крестиком.")}
              </div>
            )}

            <Row label={tr("Редкость")}>
              <div className="flex gap-1.5">
                {(["common", "rare", "epic", "legend"] as Rarity[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => { setF({ ...f, rarity: r }); sfx.click(); }}
                    className="press flex-1 py-1.5"
                    style={{
                      borderRadius: 8, fontSize: 8, fontWeight: 800, letterSpacing: "0.08em",
                      background: f.rarity === r ? RARITY_COLOR[r] : "var(--surface-2)",
                      color: f.rarity === r ? "#0b0b0e" : "var(--text-mute)",
                      border: "1px solid var(--glass-brd)",
                    }}
                  >
                    {RARITY_LABEL[r]}
                  </button>
                ))}
              </div>
            </Row>

            <Row label={tr("Характеристики")}>
              {([["spit", tr("МЕТКОСТЬ")], ["chub", tr("ВЫНОСЛИВОСТЬ")], ["chaos", tr("БЕЗБАШЕННОСТЬ")], ["luck", tr("УДАЧА")]] as const).map(([k, l]) => (
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

            <div className="fr-foot flex gap-2">
              {!isNew && !f.builtin && (
                <Tap onClick={del} r="md" className="px-4 py-3.5" style={{ fontSize: 13 }} sound="none">
                  <Icon name="trash" size={15} />
                </Tap>
              )}
              <Tap onClick={close} r="md" center className="px-5 py-3.5 t-title" style={{ fontSize: 12 }}>
                {dirty ? tr("Не сохранять") : tr("Отмена")}
              </Tap>
              <Tap onClick={save} accent r="md" center className="flex-1 py-3.5 t-title" style={{ fontSize: 13 }} sound="none">{tr("СОХРАНИТЬ")}</Tap>
            </div>
          </div>
        </div>
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
            border: val === c ? "2.5px solid var(--acc)" : "1px solid var(--btn-brd)",
            boxShadow: val === c ? "0 0 14px var(--acc-glow)" : "none",
          }}
        />
      ))}
    </div>
  );
}

/**
 * Список вариантов внешности.
 *
 * Подписи переводятся ЗДЕСЬ, а не в модуле: ранее tr() вызывался на уровне
 * файла, то есть до того, как стор выставил язык, — и в английской версии
 * редактор друга оставался русским («Лысый», «Кепка» и проч.).
 */
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
            background: val === i ? "var(--acc)" : "var(--surface-2)",
            color: val === i ? "var(--acc-ink)" : "var(--text-dim)",
            border: "1px solid var(--glass-brd)",
          }}
        >
          {tr(n)}
        </button>
      ))}
    </div>
  );
}
