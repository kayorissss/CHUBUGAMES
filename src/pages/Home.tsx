import { Fragment, useEffect, useMemo, useState } from "react";
import { tr } from "../core/i18n";
import ChestCard from "../ui/ChestCard";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { GAME_META } from "../core/content";
import { EASE } from "../core/motion";
import { fmt } from "../core/format";
import { autoRate } from "../core/save";
import { Card, Tap, Bar, Chip, SectionTitle, Screen } from "../ui/Glass";
import HeadView from "../ui/HeadView";
import GameIcon from "../ui/GameIcon";
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
    const list = GAME_META.map((g, i) => ({ g, i }));
    list.sort((a, b) => {
      const fa = fav.includes(a.g.id) ? 0 : 1;
      const fb = fav.includes(b.g.id) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      const sa = s.games[a.g.id], sb = s.games[b.g.id];
      if (mode === "best") return (sb?.best || 0) - (sa?.best || 0);
      if (mode === "plays") return (sb?.plays || 0) - (sa?.plays || 0);
      if (mode === "recent") return (sb?.recent?.[0]?.t || 0) - (sa?.recent?.[0]?.t || 0);
      return a.i - b.i;
    });
    return list.map((x) => x.g);
  }, [s.settings.favGames, s.settings.gameSort, s.games]);
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
  useEffect(() => {
    const iv = setInterval(() => setBossTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  void bossTick;
  const bossLive = bossActive();
  // награда — как 3 минуты автодохода, но не меньше осмысленной суммы
  const adReward = Math.max(500, Math.floor(rate * 180) + s.level * 250);

  return (
    <Screen>
      {/* Шапка: название, уровень, монеты.
          Иконку персонажа слева убрали по просьбе пользователя — вход в
          профиль остался на плашке уровня. */}
      <div
        className="flex items-center gap-3"
        style={{ paddingTop: "calc(var(--sat) + 14px)", marginBottom: 16 }}
      >
        <div className="flex-1 min-w-0">
          <h1
            className="t-display"
            style={{
              fontSize: 23,
              backgroundImage: "linear-gradient(94deg, var(--text) 30%, var(--acc))",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            ЧУБУГЕЙМ
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
      <div className="grid grid-cols-3" style={{ gap: 10, marginBottom: 18 }}>
        <Stat icon="run" v={fmt(s.stats.burgersDodged)} l={tr("уклонов")} />
        <Stat icon="tap" v={fmt(s.stats.tapsTotal)} l={tr("тапов")} />
        <Stat icon="coin" v={fmt(s.totalCoinsEver)} l={tr("монет всего")} accent />
      </div>

      {/* Ежечасный сундук — повод заглянуть между парами */}
      <ChestCard />

      {/* Босс — главная плашка экрана */}
      {onOpen && (
        <Tap
          onClick={() => onOpen("boss")}
          r="xl"
          className="w-full overflow-hidden relative"
          style={{
            padding: 0, marginBottom: 18, display: "block",
            border: bossOn
              ? "1.5px solid var(--danger-brd)"
              : "1px solid var(--surface-brd)",
            background: bossOn ? "var(--danger-soft)" : "var(--surface)",
            boxShadow: bossOn ? "0 14px 40px -18px rgba(255,90,60,0.75)" : undefined,
          }}
          sound={bossOn ? "power" : "click"}
        >
          {/* пульс за головой, только когда босс реально доступен */}
          {bossOn && (
            <motion.div
              className="absolute pointer-events-none"
              animate={{ opacity: [0.2, 0.42, 0.2] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              style={{
                inset: 0,
                background:
                  "radial-gradient(circle at 22% 42%, var(--danger-brd), transparent 60%)",
              }}
            />
          )}

          <div className="relative" style={{ padding: 18 }}>
            <div className="flex items-center" style={{ gap: 14 }}>
              <motion.span
                className="shrink-0 relative"
                style={{ lineHeight: 0, opacity: bossOn ? 1 : 0.55 }}
                animate={bossOn ? { y: [0, -5, 0] } : {}}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <HeadView friend={{ look: boss.look } as never} size={72} />
              </motion.span>

              <span className="flex-1 min-w-0">
                <span
                  className="t-label block"
                  style={{ fontSize: 9, color: bossOn ? "var(--danger)" : undefined }}
                >
                  {bossOn
                    ? tr("БОСС ПОЯВИЛСЯ")
                    : bossLive ? tr("СМЕНА ЗАКРЫТА") : tr("СЛЕДУЮЩИЙ БОСС")}
                </span>
                <span
                  className="t-display-sm block clip1"
                  style={{ fontSize: 22, marginTop: 4 }}
                >
                  {boss.name}
                </span>
                <span className="t-caption block clip2" style={{ marginTop: 3 }}>
                  {boss.nick}
                </span>
              </span>
            </div>

            {/* таймер и следующий по расписанию */}
            <div
              className="flex items-center"
              style={{
                gap: 10, marginTop: 14, paddingTop: 13,
                borderTop: "1px solid var(--surface-brd)",
              }}
            >
              <span className="flex-1 min-w-0">
                <span className="t-label block" style={{ fontSize: 8.5 }}>
                  {bossOn ? tr("УСПЕТЬ ДО СМЕНЫ") : tr("ПРИДЁТ ЧЕРЕЗ")}
                </span>
                <span
                  className="t-num block"
                  style={{ fontSize: 20, marginTop: 2, color: bossOn ? "var(--danger)" : undefined }}
                >
                  {fmtLeft(bossOn ? windowLeft() : nextBossIn())}
                </span>
              </span>

              {/* кто заступит следующим */}
              <span className="flex items-center shrink-0" style={{ gap: 7 }}>
                <span className="text-right">
                  <span className="t-label block" style={{ fontSize: 8.5 }}>{tr("ДАЛЬШЕ")}</span>
                  <span className="t-caption block clip1" style={{ marginTop: 2, maxWidth: 92 }}>
                    {nextBoss.name}
                  </span>
                </span>
                <span style={{ lineHeight: 0, opacity: 0.72 }}>
                  <HeadView friend={{ look: nextBoss.look } as never} size={30} />
                </span>
              </span>
            </div>

            <div style={{ marginTop: 11 }}>
              <Bar
                pct={bossOn ? windowLeft() / BOSS_WINDOW_MS : 1 - nextBossIn() / BOSS_EVERY_MS}
                h={5}
              />
            </div>

            <div
              className="flex items-center justify-center"
              style={{
                gap: 7, marginTop: 14, padding: "11px 16px",
                borderRadius: 999,
                background: bossOn ? "var(--danger)" : "var(--btn-bg)",
                color: bossOn ? "var(--danger-ink)" : "var(--text-dim)",
                border: bossOn ? "1px solid var(--danger)" : "1px solid var(--btn-brd)",
                fontSize: 13, fontWeight: 800, lineHeight: 1,
              }}
            >
              <Icon name={bossOn ? "skull" : "clock"} size={14} />
              {/* Событие идёт весь час: после победы кнопка не гаснет,
                  а предлагает добить ещё раз. */}
              {bossOn
                ? bossKills > 0 ? `${tr("ДОБИТЬ")} · ${tr("завалил")} ×${bossKills}` : tr("В БОЙ")
                : tr("ЖДЁМ СМЕНУ")}
            </div>
          </div>
        </Tap>
      )}

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

      {/*
        СОРТИРОВКА И ИЗБРАННОЕ.
        Игр 27, и мотать до нужной каждый раз было долго. Закреплённые
        (долгий тап по карточке) всегда идут первыми.
      */}
      <div className="flex items-center" style={{ gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
        {([
          { k: "default" as const, l: tr("По порядку") },
          { k: "best" as const, l: tr("По рекорду") },
          { k: "plays" as const, l: tr("По забегам") },
          { k: "recent" as const, l: tr("Недавние") },
        ]).map((o) => (
          <Chip
            key={o.k}
            active={(s.settings.gameSort || "default") === o.k}
            onClick={() => {
              sfx.click();
              set((d) => { d.settings.gameSort = o.k; });
            }}
          >
            {o.l}
          </Chip>
        ))}
      </div>

      {/* Сетка игр */}
      <SectionTitle right={<span className="t-num" style={{ fontSize: 11, color: "var(--text-mute)" }}>{s.unlockedGames.length}/{GAME_META.length}</span>}>{tr("Все игры")}</SectionTitle>

      <div className="grid grid-cols-2" style={{ gap: 12, marginBottom: 22 }}>
        {sortedGames.map((g, i) => {
          const unlocked = s.unlockedGames.includes(g.id);
          const st = s.games[g.id];
          // Поддержку показываем ровно после «Башни Лёхи»: это конец
          // четвёртого ряда, дальше идут остальные игры.
          const donateHere = g.id === "stack";
          return (
            <Fragment key={g.id}>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              /* Каскад ограничен: игр уже 27, и при 0.04 c на карточку
                 последняя выезжала бы через секунду с лишним — сетка
                 успевала надоесть раньше, чем достраивалась. */
              transition={{ delay: Math.min(i, 8) * 0.035, duration: 0.3, ease: EASE }}
            >
              <Tap
                onClick={() => unlocked && onPlay(g.id)}
                onLongPress={() => {
                  if (!unlocked) return;
                  haptic("medium");
                  sfx.tap?.();
                  set((d) => {
                    const cur = d.settings.favGames || [];
                    d.settings.favGames = cur.includes(g.id)
                      ? cur.filter((x) => x !== g.id)
                      : [...cur, g.id];
                  });
                }}
                disabled={!unlocked}
                solid
                r="lg"
                className="w-full h-full"
                sound="power"
                style={{ display: "block" }}
              >
                <div
                  className="flex flex-col h-full"
                  style={{ padding: 13, minHeight: 152 }}
                >
                  <div className="flex items-start justify-between" style={{ marginBottom: 10 }}>
                    <span style={{ lineHeight: 0, color: "var(--text)" }}>
                      {unlocked ? (
                        <GameIcon id={g.id} size={27} />
                      ) : (
                        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="5" y="11" width="14" height="10" rx="2" />
                          <path d="M8 11V8a4 4 0 018 0v3" />
                        </svg>
                      )}
                    </span>
                    <span className="flex items-center" style={{ gap: 5 }}>
                      {(s.settings.favGames || []).includes(g.id) && (
                        <span style={{ color: "var(--gold)", lineHeight: 0 }}>
                          <Icon name="star" size={12} />
                        </span>
                      )}
                      <span
                        className="t-label"
                        style={{
                          fontSize: 8.5, padding: "3px 7px", borderRadius: 999,
                          background: "var(--btn-bg)", letterSpacing: "0.07em",
                        }}
                      >
                        {tr(g.tag)}
                      </span>
                    </span>
                  </div>
                  <div className="t-title-sm clip1">{unlocked ? tr(g.name) : "?????"}</div>
                  <div
                    className="t-caption clip2"
                    style={{ marginTop: 4, flex: 1 }}
                  >
                    {unlocked ? tr(g.desc) : `${tr("Уровень")} ${g.unlockLvl}`}
                  </div>
                  {unlocked && (
                    <div
                      className="flex items-center justify-between"
                      style={{
                        marginTop: 10, paddingTop: 9,
                        borderTop: "1px solid var(--surface-brd)",
                      }}
                    >
                      <span className="t-num acc-text" style={{ fontSize: 12.5 }}>{fmt(st.best)}</span>
                      <span className="t-caption" style={{ fontSize: 10 }}>{st.plays} игр</span>
                    </div>
                  )}
                </div>
              </Tap>
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

    </Screen>
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
