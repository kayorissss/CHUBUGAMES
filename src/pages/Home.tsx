import { Fragment, useEffect, useMemo, useState } from "react";
import { tr } from "../core/i18n";
import { isDesktop } from "../core/desktop";
import GameFilter, { CATEGORIES, type SortKey } from "../ui/GameFilter";
import { motion } from "framer-motion";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import { GAME_META } from "../core/content";
import { EASE } from "../core/motion";
import { fmt } from "../core/format";
import { Bar, Screen } from "../ui/Glass";
import HeadView from "../ui/HeadView";
import GameTile from "../ui/GameTile";
import Icon from "../ui/Icon";
import ChestCard from "../ui/ChestCard";
import type { GameId } from "../core/types";
import type { SubPage } from "../App";
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

/**
 * ГЛАВНАЯ.
 *
 * Что здесь изменилось и почему (претензия: «главная стрёмная, справа ужас
 * полнейший, казино в верхнюю полоску, ежечасный сундук стрёмный»):
 *
 *  • Правая колонка-«сведения» удалена целиком. В ней жили уровень, монеты,
 *    «уклонов/тапов/монет всего», казино, реклама и фанфики. Уровень, опыт и
 *    все валюты уже есть в верхней панели — дублировать их на странице
 *    нечего; счётчики «уклонов/тапов/монет всего» — статистика, которой тут
 *    место не было (она есть в Прогрессе → Статистика); казино и «Поддержать»
 *    переехали в верхнюю панель; бонус за ролик — в плашку в правом нижнем
 *    углу (она на всех экранах, см. pc-boost в App).
 *  • Казино и фанфики больше не карточки-конкуренты играм: казино — раздел
 *    сверху, фанфики живут в «Персонажах» (там же, где и авторы).
 *  • Осталось ровно два ряда внимания: БОСС + СУНДУК, потом библиотека.
 *  • Босс — широкий тонкий баннер, а не квадратная плашка: слева «постер»
 *    дежурного, в центре имя и что с ним, справа таймер и вход в бой.
 *  • Библиотека игр растянута на всю ширину: плитка сама подбирает число
 *    колонок (minmax 15.5rem), поэтому на 27\" это 6–7 колонок, а не две
 *    растянутые простыни с пустотой справа.
 */
export default function Home({
  onPlay, onOpenProfile, onOpen,
}: {
  onPlay: (g: GameId) => void;
  onOpenProfile?: () => void;
  onOpen?: (page: SubPage) => void;
}) {
  const { s, set, levelPct } = useGame();

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

  // босс-воспитатель этого часа
  const [bossTick, setBossTick] = useState(0);
  const boss = bossOfHour();
  const bossStore = readBosses();
  const bossOn = canFight(bossStore);
  /** сколько раз уже завалили дежурного за эту смену */
  const bossKills = killsThisHour(bossStore);
  // кто заступит в следующий час — чтобы было видно расписание наперёд
  const nextBoss = bossOfHour(Date.now() + BOSS_EVERY_MS);
  const pc = isDesktop();
  useEffect(() => {
    const iv = setInterval(() => setBossTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  void bossTick;
  const bossLive = bossActive();

  /*
   * ДВЕ РАСКЛАДКИ ОДНИМ КОДОМ. Содержимое одинаковое, отличается только
   * раскладка: на телефоне — одна колонка (Screen), на компьютере — сетка
   * .pc-home (баннер сверху, библиотека во всю ширину). Резать разметку на
   * два дерева нельзя: любая правка карточки пришла бы в двух местах.
   */
  const Wrap: React.ElementType = pc ? "div" : Screen;
  const wrapProps = pc ? { className: "pc-home" } : {};

  return (
    <Wrap {...wrapProps}>
      {/* Телефон: верх страницы — уровень и монеты (верхней панели там нет) */}
      {!pc && (
        <div
          className="flex items-center gap-3"
          style={{ paddingTop: "calc(var(--sat) + 14px)", marginBottom: 14 }}
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
          <div
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 12px", borderRadius: "var(--r-md)",
              background: "var(--surface)", border: "1px solid var(--surface-brd)",
            }}
          >
            <Icon name="coin" size={14} accent />
            <span className="t-num acc-text" style={{ fontSize: 15 }}>{fmt(s.coins)}</span>
          </div>
        </div>
      )}

      {/* БОСС + СУНДУК — одна линия внимания. На ПК это тонкий баннер и
          карточка сундука рядом, на телефоне — два блока друг под другом. */}
      <section className="pc-hero">
        <BossBanner
          onOpen={() => onOpen?.("boss")}
          open={!!onOpen}
          boss={boss}
          nextBoss={nextBoss}
          bossOn={bossOn}
          bossLive={bossLive}
          bossKills={bossKills}
        />
        <ChestCard />
      </section>

      {/* ИГРЫ — основная зона: во всю ширину, плитка сама подбирает колонки */}
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

        <div className="grid grid-cols-2 pc-tiles" style={{ gap: 12, marginBottom: 22 }}>
          {sortedGames.map((g, i) => {
            const unlocked = s.unlockedGames.includes(g.id);
            return (
              <Fragment key={g.id}>
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  /* Каскад ограничен: на 0.04 c карточка за карточкой последняя
                     игра выезжала бы секунду — сетка надоедала раньше, чем
                     достраивалась. */
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
              </Fragment>
            );
          })}
        </div>
      </div>
    </Wrap>
  );
}

/**
 * БАННЕР БОССА.
 *
 * «Плашка была квадратной и невнятной» → широкий тонкий баннер поперёк
 * страницы: постер дежурного, имя и характер, чем он опасен, сколько осталось
 * до конца смены и вход в бой. Пока смена закрыта — баннер спокойный и
 * показывает, кто придёт следующим; когда босс вышел — появляется тёплая
 * подсветка, пульс и полоса, уходящая в ноль.
 */
function BossBanner({
  boss, nextBoss, bossOn, bossLive, bossKills, onOpen, open,
}: {
  boss: ReturnType<typeof bossOfHour>;
  nextBoss: ReturnType<typeof bossOfHour>;
  bossOn: boolean;
  bossLive: boolean;
  bossKills: number;
  onOpen: () => void;
  open: boolean;
}) {
  return (
    <div className={`boss2 ${bossOn ? "live" : ""}`}>
      {bossOn && <span className="boss2-glow" aria-hidden />}

      <span className="boss2-poster">
        <motion.span
          animate={bossOn ? { y: [0, -4, 0] } : {}}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <HeadView friend={{ look: boss.look } as never} size={bossOn ? 64 : 56} />
        </motion.span>
      </span>

      <span className="boss2-mid">
        <span className="boss2-kicker">
          {bossOn && <span className="boss2-pulse" aria-hidden />}
          {bossOn ? tr("БОСС ПОЯВИЛСЯ") : bossLive ? tr("СМЕНА ЗАКРЫТА") : tr("СЛЕДУЮЩИЙ БОСС")}
        </span>
        <span className="boss2-name clip1">{boss.name}</span>
        <span className="boss2-tags">
          <span className="boss2-tag">{boss.nick}</span>
          {bossOn && bossKills > 0 && (
            <span className="boss2-tag ok">
              <Icon name="skull" size={11} />
              {tr("добито")} ×{bossKills}
            </span>
          )}
          <span className="boss2-tag">
            <Icon name={bossOn ? "clock" : "user"} size={11} />
            {bossOn
              ? `${tr("до конца смены")} ${fmtLeft(windowLeft())}`
              : `${tr("придёт через")} ${fmtLeft(nextBossIn())}`}
          </span>
        </span>
      </span>

      <span className="boss2-right">
        <span className="boss2-when">
          <span className="t-label" style={{ fontSize: 8 }}>
            {bossOn ? tr("УСПЕТЬ") : tr("ДАЛЬШЕ")}
          </span>
          <span className="boss2-time">
            {bossOn ? fmtLeft(windowLeft()) : nextBoss.name}
          </span>
        </span>
        {open && (
          <button
            type="button"
            className={`boss2-cta ${bossOn ? "on" : ""}`}
            onClick={() => { sfx.click(); haptic("light"); onOpen(); }}
          >
            <Icon name={bossOn ? "skull" : "eye"} size={14} />
            {bossOn ? tr("В БОЙ") : tr("ПОСМОТРЕТЬ")}
          </button>
        )}
      </span>

      {/* полоса смены: по ней видно, сколько осталось, не отрывая глаз от текста */}
      <span className="boss2-bar" aria-hidden>
        <span
          style={{
            width: `${Math.round(
              (bossOn
                ? windowLeft() / BOSS_WINDOW_MS
                : 1 - nextBossIn() / BOSS_EVERY_MS) * 100,
            )}%`,
          }}
        />
      </span>
    </div>
  );
}
