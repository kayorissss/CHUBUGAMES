import { Fragment, useEffect, useMemo, useState } from "react";
import { tr } from "../core/i18n";
import ChestCard from "../ui/ChestCard";
import { isDesktop } from "../core/desktop";
import GameFilter, { CATEGORIES, type SortKey } from "../ui/GameFilter";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { GAME_META } from "../core/content";
import { EASE } from "../core/motion";
import { fmt } from "../core/format";
import { autoRate } from "../core/save";
import { Card, Tap, Bar, Screen } from "../ui/Glass";
import HeadView from "../ui/HeadView";
import GameTile from "../ui/GameTile";
import Icon, { type IconName } from "../ui/Icon";
import type { GameId } from "../core/types";
import AdModal from "../ui/AdModal";
import { bonusesLeft, hasAds, noteBonus } from "../core/ads";
import type { SubPage } from "../App";
import { readGamble } from "../core/gamble";
import {
  BOSS_EVERY_MS, BOSS_WINDOW_MS,
  bossActive, bossOfHour, canFight, killsThisHour, nextBossIn, readBosses, windowLeft,
} from "../core/bosses";

/** «5 мин» / «42 сек» — коротко, чтобы влезало в строку */
function fmtLeft(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  if (sec < 60) return `${sec} ${tr("сек")}`;
  return `${Math.ceil(sec / 60)} ${tr("мин")}`;
}

export default function Home({
  onPlay, onOpenProfile, onOpen,
}: {
  onPlay: (g: GameId) => void;
  onOpenProfile?: () => void;
  onOpen?: (page: SubPage) => void;
}) {
  const { s, set, levelPct, addCoins, toast } = useGame();

  /** Поиск по названию и выбранная категория */
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  /**
   * Порядок игр в сетке.
   *
   * Закреплённые (долгий тап по карточке) всегда идут первыми, дальше —
   * выбранная сортировка. Игр 27, и мотать до любимой каждый раз было
   * утомительно.
   */
  const sortedGames = useMemo(() => {
    const fav = s.settings.favGames || [];
    const mode = s.settings.gameSort || "default";
    const needle = q.trim().toLowerCase();
    const catDef = CATEGORIES.find((c) => c.id === cat);

    let list = GAME_META.map((g, i) => ({ g, i }));

    // поиск идёт и по названию, и по описанию, и по тегу — на обоих языках
    if (needle) {
      list = list.filter(({ g }) =>
        [g.name, g.desc, g.tag, tr(g.name), tr(g.desc), tr(g.tag)]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      );
    }
    if (cat === "fav") list = list.filter(({ g }) => fav.includes(g.id));
    else if (catDef && catDef.tags.length) {
      list = list.filter(({ g }) => catDef.tags.includes(g.tag));
    }

    list.sort((a, b) => {
      const fa = fav.includes(a.g.id) ? 0 : 1;
      const fb = fav.includes(b.g.id) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      const sa = s.games[a.g.id], sb = s.games[b.g.id];
      if (mode === "best") return (sb?.best || 0) - (sa?.best || 0);
      if (mode === "plays") return (sb?.plays || 0) - (sa?.plays || 0);
      if (mode === "recent") return (sb?.recent?.[0]?.t || 0) - (sa?.recent?.[0]?.t || 0);
      if (mode === "name") return tr(a.g.name).localeCompare(tr(b.g.name));
      return a.i - b.i;
    });
    return list.map((x) => x.g);
  }, [s.settings.favGames, s.settings.gameSort, s.games, q, cat]);
  const rate = autoRate(s);
  const [showAd, setShowAd] = useState(false);
  const [adLeft, setAdLeft] = useState(() => bonusesLeft());
  // босс-воспитатель этого часа
  const [bossTick, setBossTick] = useState(0);
  const boss = bossOfHour();
  const bossStore = readBosses();
  const bossOn = canFight(bossStore);
  /** Сколько раз уже завалили дежурного за эту смену */
  const bossKills = killsThisHour(bossStore);
  // кто заступит в следующий час — чтобы было видно расписание наперёд
  const nextBoss = bossOfHour(Date.now() + BOSS_EVERY_MS);
  // жетоны показываем прямо на плашке казино — видно, есть ли на что играть
  const chips = readGamble().chips;
  /** ПК: альбомная раскладка вместо телефонной колонки */
  const pc = isDesktop();
  useEffect(() => {
    const iv = setInterval(() => setBossTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  void bossTick;
  const bossLive = bossActive();
  // награда — как 3 минуты автодохода, но не меньше осмысленной суммы
  const adReward = Math.max(500, Math.floor(rate * 180) + s.level * 250);

  /*
   * ДВЕ РАСКЛАДКИ ОДНИМ КОДОМ.
   *
   * Содержимое главного экрана одинаковое, отличается только раскладка:
   * на телефоне — одна колонка (Screen), на компьютере — CSS-грид
   * .pc-home, который расставляет те же блоки по зонам (см. index.css).
   * Разрезать разметку на два дерева нельзя: тогда любая правка карточки
   * игры пришлась бы в двух местах и они бы разъехались.
   */
  const Wrap: React.ElementType = pc ? "div" : Screen;
  const wrapProps = pc ? { className: "pc-home" } : {};

  return (
    <Wrap {...wrapProps}>
            {/* Правая колонка на ПК и верх списка на телефоне. Контейнер

          display:contents в мобильной вёрстке, поэтому порядок и отступы
          остались ровно теми же, что были до разбиения на зоны. */}
      <div className="pc-blocks">
      {/* Шапка: название, уровень, монеты.
          Иконку персонажа слева убрали по просьбе пользователя — вход в
          профиль остался на плашке уровня. */}
      <div
        className="flex items-center gap-3 pc-head"
        style={{ paddingTop: "calc(var(--sat) + 14px)", marginBottom: 16 }}
      >
        <div className="flex-1 min-w-0">
          <h1
            className="t-display only-mobile"
            style={{
              fontSize: 23,
              backgroundImage: "linear-gradient(94deg, var(--text) 30%, var(--acc))",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            CHUBUGAMES
          </h1>
          <div className="flex items-center" style={{ gap: 8, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => { sfx.click(); haptic("light"); onOpenProfile?.(); }}
              className="t-num shrink-0"
              style={{
                padding: "2px 8px", borderRadius: 999,
                background: "var(--acc)", color: "var(--acc-ink)", fontSize: 10.5,
              }}
            >
              {tr("УР")} {s.level}
            </button>
            <span className="flex-1 min-w-0"><Bar pct={levelPct} h={4} /></span>
          </div>
        </div>

        {/* Тап по валюте — показывает её название (просьба пользователя) */}
        <Tap
          onClick={() => {
            haptic("light");
            toast({
              title: tr("ЧУБКОИНЫ"),
              sub: tr("Основная валюта: игры, магазин, кейсы"),
              icon: "coin",
              tone: "gold",
            });
          }}
          r="md"
          sound="click"
          className="shrink-0"
          style={{ padding: "8px 12px" }}
        >
          <div className="flex items-center gap-1.5">
            <Icon name="coin" size={14} accent />
            <span className="t-num acc-text" style={{ fontSize: 15 }}>{fmt(s.coins)}</span>
          </div>
          {rate > 0 && (
            <div className="t-caption" style={{ fontSize: 10, marginTop: 1 }}>
              +{fmt(rate)}/{tr("сек")}
            </div>
          )}
        </Tap>
      </div>

      {/* Сводка — сразу под шапкой */}
      <div className="grid grid-cols-3 pc-head-stats" style={{ gap: 10, marginBottom: 18 }}>
        <Stat icon="run" v={fmt(s.stats.burgersDodged)} l={tr("уклонов")} />
        <Stat icon="tap" v={fmt(s.stats.tapsTotal)} l={tr("тапов")} />
        <Stat icon="coin" v={fmt(s.totalCoinsEver)} l={tr("монет всего")} accent />
      </div>

      {/* Ежечасный сундук — повод заглянуть между парами */}
      <ChestCard />

      {/* Казино — крупная плашка, сразу понятно, что это казино */}
      {onOpen && (
        <Tap
          onClick={() => onOpen("casino")}
          r="xl"
          className="w-full overflow-hidden relative"
          style={{
            padding: 0, marginBottom: 12, display: "block",
            border: "1.5px solid var(--violet-brd)",
            background: "var(--violet-soft)",
            boxShadow: "0 14px 38px -20px var(--violet-brd)",
          }}
          sound="power"
        >
          <motion.div
            className="absolute pointer-events-none"
            animate={{ opacity: [0.18, 0.4, 0.18] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            style={{
              inset: 0,
              background:
                "radial-gradient(circle at 82% 30%, rgba(200,155,255,0.5), transparent 62%)",
            }}
          />
          <div className="relative" style={{ padding: 18 }}>
            <div className="flex items-center" style={{ gap: 13 }}>
              <motion.span
                className="shrink-0 flex items-center justify-center"
                animate={{ rotate: [0, -9, 9, 0] }}
                transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  width: 54, height: 54, borderRadius: "var(--r-md)",
                  background: "var(--violet-soft)", color: "var(--violet)",
                  border: "1px solid rgba(200,155,255,0.45)",
                }}
              >
                <Icon name="dice" size={27} />
              </motion.span>
              <span className="flex-1 min-w-0">
                <span className="t-label block" style={{ fontSize: 9, color: "var(--violet)" }}>
                  {tr("НА ЖЕТОНЫ")}
                </span>
                <span className="t-display-sm block" style={{ fontSize: 22, marginTop: 3 }}>
                  {tr("КАЗИНО")}
                </span>
              </span>
              <span
                className="t-num shrink-0 flex items-center"
                style={{
                  gap: 5, padding: "7px 11px", borderRadius: 999,
                  background: "var(--violet-soft)",
                  border: "1px solid rgba(200,155,255,0.4)",
                  color: "var(--violet)", fontSize: 13,
                }}
              >
                <Icon name="ticket" size={13} />
                {fmt(chips)}
              </span>
            </div>

            {/* что внутри — иначе непонятно, куда ведёт кнопка */}
            <div className="flex" style={{ gap: 7, marginTop: 14 }}>
              {([
                ["Слоты", "gem"],
                ["Кейсы", "case"],
                ["Батлы", "skull"],
                ["Апгрейд", "bolt"],
              ] as [string, IconName][]).map(([label, icon]) => (
                <span
                  key={label}
                  className="flex-1 flex flex-col items-center justify-center"
                  style={{
                    gap: 5, padding: "9px 4px", borderRadius: "var(--r-sm)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--surface-brd)",
                  }}
                >
                  <Icon name={icon} size={15} />
                  <span className="t-label clip1" style={{ fontSize: 8 }}>{tr(label)}</span>
                </span>
              ))}
            </div>
          </div>
        </Tap>
      )}

      {/* Бонус за ролик */}
      {hasAds() && adLeft > 0 && (
        <Tap
          onClick={() => setShowAd(true)}
          r="xl"
          className="w-full overflow-hidden relative"
          style={{
            padding: 0, marginBottom: 18, display: "block",
            border: "1.5px solid var(--ok-brd)",
            background: "var(--ok-soft)",
          }}
          sound="power"
        >
          <div className="relative" style={{ padding: 16 }}>
            <div className="flex items-center" style={{ gap: 13 }}>
              <motion.span
                className="shrink-0 flex items-center justify-center relative"
                animate={{ scale: [1, 1.07, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  width: 50, height: 50, borderRadius: "var(--r-md)",
                  background: "var(--ok-soft)", color: "var(--ok)",
                  border: "1px solid var(--ok-brd)",
                }}
              >
                <Icon name="play" size={22} />
              </motion.span>

              <span className="flex-1 min-w-0">
                <span className="t-label block" style={{ fontSize: 9, color: "var(--ok)" }}>
                  {tr("10 СЕКУНД РЕКЛАМЫ")}
                </span>
                <span
                  className="t-num block clip1"
                  style={{ fontSize: 23, marginTop: 3, color: "var(--ok)" }}
                >
                  +{fmt(adReward)}
                </span>
                <span className="t-caption block clip1" style={{ marginTop: 2 }}>
                  {tr("монет за просмотр")}
                </span>
              </span>

              {/* сколько попыток осталось — точками, а не дробью */}
              <span className="shrink-0 flex flex-col items-end" style={{ gap: 6 }}>
                <span className="t-label" style={{ fontSize: 8 }}>{tr("ОСТАЛОСЬ")}</span>
                <span className="flex items-center" style={{ gap: 4 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      style={{
                        width: 7, height: 7, borderRadius: 999, display: "block",
                        background: i < adLeft ? "var(--ok)" : "var(--btn-brd)",
                      }}
                    />
                  ))}
                </span>
              </span>
            </div>
          </div>
        </Tap>
      )}

      {/* Сборник фанфиков — читалка с озвучкой */}
      {onOpen && (
        <Tap
          onClick={() => onOpen("fanfic")}
          r="lg"
          className="w-full"
          style={{ padding: 12, marginBottom: 10, display: "block" }}
          sound="click"
        >
          <span className="flex items-center" style={{ gap: 11 }}>
            <span
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 36, height: 36, borderRadius: "var(--r-sm)",
                background: "var(--violet-soft)", color: "var(--violet)",
              }}
            >
              <Icon name="note" size={17} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="t-title-sm block clip1">{tr("Фанфики")}</span>
              <span className="t-caption block clip1" style={{ marginTop: 2, fontSize: 9.5 }}>
                {tr("Читалка с озвучкой и подсветкой строки")}
              </span>
            </span>
            <Icon name="chevron" size={14} />
          </span>
        </Tap>
      )}

      </div>

      {/* БОСС — над библиотекой, в левой колонке. Это главное событие часа,
          и держать его в правой колонке между сундуком и казино было
          нечестно по отношению к играм: плашка уезжала за скролл. */}
      <div className="pc-boss">
        {onOpen && (
          <Tap
            onClick={() => onOpen("boss")}
            r="xl"
            className="w-full overflow-hidden relative pc-boss-card"
            style={{
              padding: 0, marginBottom: 4, display: "block",
              border: bossOn
                ? "1.5px solid var(--danger-brd)"
                : "1px solid var(--surface-brd)",
              background: bossOn ? "var(--danger-soft)" : "var(--surface)",
              boxShadow: bossOn ? "0 14px 40px -18px rgba(255,90,60,0.75)" : undefined,
            }}
            sound={bossOn ? "power" : "click"}
          >
            {bossOn && (
              <motion.span
                className="absolute pointer-events-none"
                animate={{ opacity: [0.2, 0.42, 0.2] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                style={{ inset: 0, background: "radial-gradient(circle at 12% 45%, var(--danger-brd), transparent 62%)" }}
              />
            )}

            <span className="pc-boss-row relative">
              <motion.span
                className="pc-boss-face"
                animate={bossOn ? { y: [0, -4, 0] } : {}}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                style={{ opacity: bossOn ? 1 : 0.6 }}
              >
                <HeadView friend={{ look: boss.look } as never} size={bossOn ? 54 : 46} />
              </motion.span>

              <span className="pc-boss-id">
                <span className="t-label" style={{ fontSize: 8.5, color: bossOn ? "var(--danger)" : undefined }}>
                  {bossOn ? tr("БОСС ПОЯВИЛСЯ") : bossLive ? tr("СМЕНА ЗАКРЫТА") : tr("СЛЕДУЮЩИЙ БОСС")}
                </span>
                <span className="t-display-sm clip1" style={{ fontSize: 20, marginTop: 3 }}>{boss.name}</span>
                <span className="t-caption clip1" style={{ marginTop: 2 }}>{boss.nick}</span>
              </span>

              <span className="pc-boss-when">
                <span className="t-label" style={{ fontSize: 8 }}>{bossOn ? tr("УСПЕТЬ ДО СМЕНЫ") : tr("ПРИДЁТ ЧЕРЕЗ")}</span>
                <span className="t-num" style={{ fontSize: 18, marginTop: 2, color: bossOn ? "var(--danger)" : undefined }}>
                  {fmtLeft(bossOn ? windowLeft() : nextBossIn())}
                </span>
                <span className="pc-boss-bar">
                  <Bar pct={bossOn ? windowLeft() / BOSS_WINDOW_MS : 1 - nextBossIn() / BOSS_EVERY_MS} h={4} />
                </span>
              </span>

              <span className="pc-boss-next">
                <span className="t-label" style={{ fontSize: 8 }}>{tr("ДАЛЬШЕ")}</span>
                <span className="t-caption clip1" style={{ maxWidth: 84 }}>{nextBoss.name}</span>
                <span style={{ opacity: 0.7, lineHeight: 0 }}>
                  <HeadView friend={{ look: nextBoss.look } as never} size={26} />
                </span>
              </span>

              <span className={`pc-boss-cta ${bossOn ? "on" : ""}`}>
                <Icon name={bossOn ? "skull" : "clock"} size={14} />
                {bossOn
                  ? bossKills > 0 ? `${tr("ДОБИТЬ")} ×${bossKills}` : tr("В БОЙ")
                  : tr("ЖДЁМ СМЕНУ")}
              </span>
            </span>
          </Tap>
        )}
      </div>

      <AnimatePresence>
        {showAd && (
          <AdModal
            reason={`+${fmt(adReward)} монет`}
            onReward={() => {
              addCoins(adReward);
              noteBonus();
              setAdLeft(bonusesLeft());
              toast({ title: tr("Награда получена"), sub: `+${fmt(adReward)}`, icon: "coin", tone: "gold" });
            }}
            onClose={() => setShowAd(false)}
          />
        )}
      </AnimatePresence>

      {/* ИГРЫ — основная зона. На ПК это левая колонка во всю ширину
          окна: плитка сама подбирает число колонок, поэтому на 27"
          это плотный кадрированный список, а не две растянутые простыни. */}
      <div className="pc-games">
      <div className="pc-games-head">
        <div className="min-w-0">
          <div className="t-display pc-games-title">{tr("БИБЛИОТЕКА ИГР")}</div>
          <div className="t-label pc-games-sub">
            {s.unlockedGames.length}/{GAME_META.length} {tr("открыто")}
            <span className="only-pc"> · {tr("долгий тап или правый клик — закрепить")}</span>
          </div>
        </div>
        <span className="t-label pc-games-count">
          {sortedGames.length} {tr("из")} {GAME_META.length}
        </span>
      </div>

      {/* Поиск, категории и сортировка — вместо ряда чипов */}
      <GameFilter
        query={q}
        onQuery={setQ}
        cat={cat}
        onCat={setCat}
        sort={(s.settings.gameSort as SortKey) || "default"}
        onSort={(k) => set((d) => { d.settings.gameSort = k; })}
        found={sortedGames.length}
        total={GAME_META.length}
      />

      {/* Сетка игр. Заголовок SectionTitle убран: он дублировал шапку
          библиотеки над фильтром и на ПК давал два одинаковых счёта. */}
      <div className="grid grid-cols-2 pc-tiles" style={{ gap: 12, marginBottom: 22 }}>
        {sortedGames.map((g, i) => {
          const unlocked = s.unlockedGames.includes(g.id);
          // Поддержку показываем ровно после «Башни Лёхи»: это конец
          // четвёртого ряда, дальше идут остальные игры.
          const donateHere = g.id === "stack";
          return (
            <Fragment key={g.id}>
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                /* Каскад ограничен: игр уже 29, и при 0.04 c на карточку
                   последняя выезжала бы через секунду с лишним — сетка
                   успевала надоесть раньше, чем достраивалась. */
                transition={{ delay: Math.min(i, 8) * 0.035, duration: 0.3, ease: EASE }}
                className="h-full"
              >
                <GameTile
                  g={g}
                  unlocked={unlocked}
                  lockedLevel={g.unlockLvl}
                  onPlay={onPlay}
                  compact={!pc}
                />
              </motion.div>
              {donateHere && onOpen && (
              <div style={{ gridColumn: "1 / -1" }}>
                <Tap
                  onClick={() => onOpen("donate")}
                  r="lg"
                  className="w-full"
                  style={{
                    padding: 14,
                    border: "1.5px solid var(--gold-brd)",
                    background: "var(--gold-soft)",
                  }}
                  sound="coin"
                >
                  <div className="flex items-center" style={{ gap: 12 }}>
                    <span
                      className="shrink-0 flex items-center justify-center"
                      style={{
                        width: 40, height: 40, borderRadius: "var(--r-sm)",
                        background: "var(--gold-soft)", color: "var(--gold)",
                      }}
                    >
                      <Icon name="heart" size={19} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="t-title-sm block">{tr("Поддержите проект")}</span>
                      <span className="t-caption block clip1" style={{ marginTop: 2 }}>
                        {tr("Игра бесплатная — развивается на энтузиазме")}
                      </span>
                    </span>
                    <Icon name="chevron" size={16} />
                  </div>
                </Tap>
              </div>
            )}
            </Fragment>
          );
        })}
      </div>
      </div>

    </Wrap>
  );
}

function Stat({
  v, l, icon, accent,
}: {
  v: string; l: string; icon: IconName; accent?: boolean;
}) {
  return (
    <Card r="md" style={{ padding: "11px 9px" }}>
      <div
        className="flex items-center"
        style={{ gap: 5, marginBottom: 6, color: accent ? "var(--acc)" : "var(--text-mute)" }}
      >
        <Icon name={icon} size={12} />
        <span className="t-label clip1" style={{ fontSize: 8, letterSpacing: "0.06em" }}>{l}</span>
      </div>
      <div
        className="t-num clip1"
        style={{ fontSize: 17, lineHeight: 1, color: accent ? "var(--acc)" : undefined }}
      >
        {v}
      </div>
    </Card>
  );
}
