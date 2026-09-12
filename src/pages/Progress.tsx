import { useState } from "react";
import { dailyState } from "../core/rewards";
import type { GameId } from "../core/types";
import { tr } from "../core/i18n";
import MasteryView from "../ui/MasteryView";
import { motion } from "framer-motion";
import { useGame } from "../core/store";
import {
  ACHIEVEMENTS, QUEST_POOL, DAILY_LADDER, SKILLS, RARITY_COLOR, RARITY_LABEL,
  SEASON_TIERS, SEASON_XP_PER_TIER, seasonReward, GAME_META,
} from "../core/content";
import { fmt, fmtTime, today } from "../core/format";
import { spentSkillPoints, xpForLevel } from "../core/save";
import { Card, Button, Bar, Chip, SectionTitle, Screen, Divider } from "../ui/Glass";
import ModesPanel from "../ui/ModesPanel";
import GameIcon from "../ui/GameIcon";
import Icon, { type IconName } from "../ui/Icon";
import { sfx, haptic } from "../core/fx";
import { freshSave } from "../core/save";

type Tab = "daily" | "season" | "mastery" | "skills" | "ach" | "stats";

export default function ProgressPage({ onPlay }: { onPlay?: (g: GameId) => void }) {
  const { s } = useGame();
  const [tab, setTab] = useState<Tab>("daily");
  const loot = dailyState(s).canClaim;
  return (
    <Screen title={tr("ПРОГРЕСС")}>
      {/* Уровень — первым и крупным. Просьба была буквальная: «уровень
          спрятан где-то внизу и кривой — должен быть выше всех и красивый».
          Раньше это был «Ур. N» внутри карточки третьей секции. */}
      <LevelHero />

      {/* Вкладки — те же, что в Магазине: сегменты на всю ширину, с иконкой
          и подписью, а не горстка Chip-ов, которые хотелось тыкать. */}
      <div className="pc-seg" role="tablist">
        {([
          { id: "daily", label: "Ежедневки", icon: "calendar", dot: loot },
          { id: "season", label: "Сезон", icon: "trophy" },
          { id: "mastery", label: "Мастерство", icon: "medal" },
          { id: "skills", label: "Навыки", icon: "brain" },
          { id: "ach", label: "Достижения", icon: "star" },
          { id: "stats", label: "Статистика", icon: "chart" },
        ] as const).map((it) => (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={tab === it.id}
            className={`pc-seg-item ${tab === it.id ? "on" : ""}`}
            onClick={() => { sfx.click(); haptic("light"); setTab(it.id as Tab); }}
          >
            <Icon name={it.icon} size={14} />
            <span className="t-label clip1">{tr(it.label)}</span>
            {"dot" in it && it.dot && <span className="pc-seg-dot" aria-label={tr("есть награда")} />}
          </button>
        ))}
      </div>
      {tab === "daily" && <Daily />}
      {tab === "season" && <Season />}
      {tab === "mastery" && <MasteryView />}
      {tab === "skills" && <Skills />}
      {tab === "ach" && <Achievements onPlay={onPlay} />}
      {tab === "stats" && <Stats />}
    </Screen>
  );
}

/* ============ УРОВЕНЬ ============ */

/**
 * ПЛИТКА УРОВНЯ.
 *
 * Уровень и опыт раньше жили только в шапке главной («Ур. N» + тонкая
 * полоска), а на странице прогресса — в карточке третьей секции. Просили
 * «выше всех и красивый»: это первая вещь на странице, с рангом, полосой
 * опыта, сколько осталось до следующего уровня и что за это будет.
 */
function LevelHero() {
  const { s, levelPct } = useGame();
  const need = xpForLevel(s.level);
  const left = Math.max(0, need - s.xp);
  const tiers = SEASON_TIERS;
  const tier = Math.min(tiers, Math.max(1, Math.floor(s.season.xp / SEASON_XP_PER_TIER) + 1));
  return (
    <div className="pc-lvlhero">
      <span className="pc-lvlhero-n">
        <span className="t-label pc-lvlhero-cap">{tr("УРОВЕНЬ")}</span>
        <span className="t-display pc-lvlhero-num">{s.level}</span>
      </span>
      <span className="pc-lvlhero-mid">
        <span className="pc-lvlhero-row">
          <span className="t-title-sm">{tr("Опыт до уровня")} {s.level + 1}</span>
          <span className="t-num pc-lvlhero-xp">{fmt(s.xp)} / {fmt(need)}</span>
        </span>
        <span className="pc-lvlhero-bar"><i style={{ width: `${Math.min(100, levelPct)}%` }} /></span>
        <span className="pc-lvlhero-foot">
          <span>
            <Icon name="bolt" size={11} />
            {tr("осталось")} <b className="t-num">{fmt(left)}</b> XP
          </span>
          <span>
            <Icon name="trophy" size={11} />
            {tr("сезон")}: <b>{tier}/{tiers}</b>
          </span>
          {s.prestige > 0 && (
            <span>
              <Icon name="star" size={11} />
              {tr("перерождений")}: <b>{s.prestige}</b> · +{Math.round(s.prestige * 12)}% {tr("монет")}
            </span>
          )}
        </span>
      </span>
    </div>
  );
}

/* ============ ЕЖЕДНЕВКИ ============ */
function Daily() {
  const { s, set, toast } = useGame();
  const { canClaim, gap, idx: streakIdx } = dailyState(s);
  const t = today();

  const claim = () => {
    if (!canClaim) return;
    const newStreak = gap === 1 ? Math.min(7, s.daily.streak + 1) : 1;
    const rw = DAILY_LADDER[newStreak - 1];
    sfx.legend();
    haptic("success");
    set((d) => {
      d.daily.lastClaim = t;
      d.daily.streak = newStreak >= 7 ? 0 : newStreak;
      d.coins += rw.coins;
      d.totalCoinsEver += rw.coins;
      d.gems += rw.gems;
    });
    toast({
      title: tr("День") + ` ${newStreak}`,
      sub: `+${fmt(rw.coins)} ${tr("монет")}${rw.gems ? ` · +${rw.gems} ${tr("кристаллов")}` : ""}`,
      icon: "gift", tone: "gold",
    });
  };

  const claimQuest = (qid: string) => {
    const def = QUEST_POOL.find((x) => x.id === qid)!;
    sfx.buy();
    haptic("success");
    set((d) => {
      const q = d.daily.quests.find((x) => x.id === qid);
      if (!q || !q.done || q.claimed) return;
      q.claimed = true;
      d.coins += def.reward;
      d.totalCoinsEver += def.reward;
      d.xp += 80;
      d.season.xp += 80;
    });
    toast({ title: tr("Награда получена"), sub: `+${def.reward.toLocaleString("ru-RU")} монет`, icon: "check" });
  };

  return (
    <div className="pc-cols">
      {/* ЗОНА 1 — «забрать награду». По смыслу это первое действие на
          странице, поэтому оно стоит первым и слева, а не в хвосте
          списка после режимов. */}
      <div className="pc-blk pc-a pc-r1">
      <SectionTitle right={<span className="t-label acc-text flex items-center" style={{ gap: 5 }}>
            <Icon name="fire" size={13} /> {s.daily.streak} дней
          </span>}>{tr("Ежедневный вход")}</SectionTitle>
      {/*
        Ежедневный вход — страница, а не полоска: плитка дней, на каждом дне
        РЕАЛЬНАЯ награда (были «Д1…Д7» и одна иконка — непонятно, за что ты
        вообще заходишь), состояние дня и подпись, что делает пропуск.
      */}
      <Card r="lg" style={{ padding: 14, marginBottom: 22 }}>
        <div className="pc-daily-grid">
          {DAILY_LADDER.map((r, i) => {
            const claimed = i < streakIdx || (!canClaim && i <= streakIdx);
            const isNext = canClaim && i === streakIdx;
            return (
              <div key={i} className={`pc-daily-day ${isNext ? "on" : ""} ${claimed ? "done" : ""}`}>
                <span className="t-label pc-daily-n">{tr("День")} {i + 1}</span>
                <span className="pc-daily-rew t-num">
                  <Icon name="coin" size={11} />
                  {fmt(r.coins)}
                </span>
                {r.gems > 0 && (
                  <span className="pc-daily-gem t-num">
                    <Icon name="gem" size={10} />
                    {r.gems}
                  </span>
                )}
                {claimed && (
                  <span className="pc-daily-check" aria-hidden>
                    <Icon name="check" size={12} />
                  </span>
                )}
                {isNext && <span className="pc-daily-today">{tr("сегодня")}</span>}
              </div>
            );
          })}
        </div>

        <div className="pc-daily-foot">
          <span className="t-caption">
            <Icon name="info" size={11} />
            {tr("Серия продолжается, только если заходить каждый день; пропуск обнуляет счёт, награда 7-го дня — самая крупная.")}
          </span>
          <Button
            variant="primary" size="lg" sound="none"
            onClick={claim} disabled={!canClaim}
            className="pc-daily-claim"
          >
            {canClaim
              ? `${tr("Забрать")} ${fmt(DAILY_LADDER[streakIdx].coins)}${DAILY_LADDER[streakIdx].gems ? ` + ${DAILY_LADDER[streakIdx].gems} ◆` : ""}`
              : tr("Уже забрал · заходи завтра")}
          </Button>
        </div>
      </Card>
      </div>

      {/* ЗОНА 2 — испытание дня справа сверху, над заданиями. */}
      <div className="pc-blk pc-b pc-r1">
        <ModesPanel />
      </div>

      {/* ЗОНА 3 — сам прогресс: уровень, полоса опыта и сколько XP осталось
          до следующего уровня. До этого «Ур. N» был только в шапке главной,
          а на странице прогресса смотреть было нечего. */}
      <div className="pc-blk pc-a pc-r2">
        <SectionTitle>{tr("Прогресс")}</SectionTitle>
        <Card r="lg" style={{ padding: 14, marginBottom: 0 }}>
          <div className="pc-prog-row">
            <div className="min-w-0">
              <div className="t-label" style={{ fontSize: 8.5, letterSpacing: "0.08em" }}>{tr("УРОВЕНЬ")}</div>
              <div className="t-display" style={{ fontSize: 34, lineHeight: 1 }}>{s.level}</div>
            </div>
            <div style={{ flex: "1 1 auto", minWidth: "6rem" }}>
              <Bar pct={Math.min(1, s.xp / xpForLevel(s.level))} h={8} />
              <div className="t-caption" style={{ marginTop: 7 }}>
                {fmt(xpForLevel(s.level) - s.xp)} XP {tr("до")} {s.level + 1}
              </div>
            </div>
            <div className="pc-prog-side">
              <div>
                <div className="t-label" style={{ fontSize: 8.5 }}>{tr("СЕЗОННЫЙ XP")}</div>
                <div className="t-num" style={{ fontSize: 15 }}>{fmt(s.season.xp)}</div>
              </div>
              <div>
                <div className="t-label" style={{ fontSize: 8.5 }}>{tr("ЗАДАНИЙ ГОТОВО")}</div>
                <div className="t-num" style={{ fontSize: 15 }}>
                  {s.daily.quests.filter((q) => q.done).length}/{s.daily.quests.length}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ЗОНА 4 — задания дня. Полосами, как плашка босса на главной:
          слева название и прогресс, справа награда и кнопка. */}
      <div className="pc-blk pc-b pc-r2">
      <SectionTitle>{tr("Задания дня")}</SectionTitle>
      {s.daily.quests.map((q) => {
        const def = QUEST_POOL.find((x) => x.id === q.id);
        if (!def) return null;
        const pct = Math.min(1, q.progress / def.target);
        return (
          <Card key={q.id} r="lg" className="pc-quest" style={{ padding: 12, marginBottom: 9 }}>
            <div className="pc-quest-main">
              <div className="t-title-sm clip2">{def.name.replace("{n}", def.target.toLocaleString("ru-RU"))}</div>
              <Bar pct={pct} h={6} />
              <span className="t-num" style={{ fontSize: 11, color: "var(--text-mute)" }}>
                {Math.floor(q.progress).toLocaleString("ru-RU")} / {def.target.toLocaleString("ru-RU")}
              </span>
            </div>
            <div className="pc-quest-side">
              <span className="t-num acc-text" style={{ fontSize: 13 }}>+{fmt(def.reward)}</span>
              {q.done && !q.claimed && (
                <Button variant="primary" size="sm" sound="none" onClick={() => claimQuest(q.id)}>{tr("Забрать")}</Button>
              )}
              {q.claimed && (
                <span className="t-label flex items-center" style={{ fontSize: 9, gap: 4 }}>
                  <Icon name="check" size={10} />{tr("получено")}
                </span>
              )}
            </div>
          </Card>
        );
      })}
      <div className="t-caption" style={{ marginTop: 12 }}>{tr("Задания обновляются каждый день")}</div>
      </div>
    </div>
  );
}

/* ============ СЕЗОН ============ */
function Season() {
  const { s, set, toast } = useGame();
  const tier = Math.min(SEASON_TIERS, Math.floor(s.season.xp / SEASON_XP_PER_TIER));
  const inTier = (s.season.xp % SEASON_XP_PER_TIER) / SEASON_XP_PER_TIER;

  const claim = (i: number) => {
    if (i >= tier || s.season.claimed.includes(i)) return;
    const rw = seasonReward(i);
    sfx.legend();
    haptic("success");
    set((d) => {
      d.season.claimed.push(i);
      d.coins += rw.coins;
      d.totalCoinsEver += rw.coins;
      d.gems += rw.gems;
    });
    toast({ title: `Уровень сезона ${i + 1}`, sub: `+${fmt(rw.coins)} монет`, icon: "medal", tone: "gold" });
  };

  const restart = () => {
    if (tier < SEASON_TIERS) return;
    sfx.legend();
    set((d) => {
      d.season = { id: d.season.id + 1, xp: 0, claimed: [], startedAt: Date.now() };
      d.gems += 15;
    });
    toast({ title: tr("НОВЫЙ СЕЗОН"), sub: tr("+15 кристаллов за завершение"), icon: "flag", tone: "gold" });
  };

  return (
    <>
      <Card r="lg" style={{ padding: 15, marginBottom: 20 }}>
        <div className="flex items-start justify-between" style={{ gap: 12, marginBottom: 14 }}>
          <div className="min-w-0">
            <div className="t-label">Сезон {s.season.id}</div>
            <div className="t-display-sm" style={{ marginTop: 4 }}>Уровень {tier}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="t-num acc-text" style={{ fontSize: 17 }}>{fmt(s.season.xp)}</div>
            <div className="t-label" style={{ fontSize: 8.5, marginTop: 2 }}>{tr("сезонный XP")}</div>
          </div>
        </div>
        <Bar pct={inTier} h={8} />
        {tier >= SEASON_TIERS && (
          <div style={{ marginTop: 14 }}>
            <Button variant="primary" size="lg" full sound="none" onClick={restart}>{tr("Завершить сезон · +15 кристаллов")}</Button>
          </div>
        )}
      </Card>

      <div className="flex flex-col" style={{ gap: 8 }}>
        {Array.from({ length: SEASON_TIERS }).map((_, i) => {
          const rw = seasonReward(i);
          const unlocked = i < tier;
          const claimed = s.season.claimed.includes(i);
          return (
            <Card
              key={i} r="md" tone={2}
              className="flex items-center"
              style={{ padding: "11px 13px", gap: 12, opacity: unlocked ? 1 : 0.42 }}
            >
              <div
                className="t-num shrink-0 flex items-center justify-center"
                style={{
                  width: 32, height: 32, borderRadius: "var(--r-sm)", fontSize: 12,
                  background: rw.label ? "var(--acc)" : "var(--btn-bg)",
                  color: rw.label ? "var(--acc-ink)" : "var(--text-dim)",
                }}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="t-num" style={{ fontSize: 13 }}>
                  {fmt(rw.coins)} монет {rw.gems > 0 && `· ${rw.gems} крист.`}
                </div>
                {rw.label && (
                  <div className="t-label acc-text" style={{ fontSize: 8.5, marginTop: 2 }}>
                    {rw.label} награда
                  </div>
                )}
              </div>
              {claimed ? (
                <span className="shrink-0"><Icon name="check" size={12} /></span>
              ) : unlocked ? (
                <Button variant="primary" size="sm" sound="none" onClick={() => claim(i)}>{tr("Взять")}</Button>
              ) : (
                <span className="shrink-0" style={{ color: "var(--text-mute)" }}><Icon name="lock" size={12} /></span>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}

/* ============ НАВЫКИ / ПРЕСТИЖ ============ */
function Skills() {
  const { s, set, toast, freePoints, prestigeAvailable } = useGame();
  const [confirm, setConfirm] = useState(false);

  const doPrestige = () => {
    const gain = prestigeAvailable;
    if (gain <= 0) { sfx.error(); return; }
    sfx.legend();
    haptic("success");
    const keep = {
      friends: s.friends, mainFriendId: s.mainFriendId, heroSkin: s.heroSkin,
      ownedSkins: s.ownedSkins, ownedThemes: s.ownedThemes, cards: s.cards,
      achievements: s.achievements, settings: s.settings, games: s.games,
      level: s.level, xp: s.xp, stats: s.stats, daily: s.daily, season: s.season,
      gems: s.gems, unlockedGames: s.unlockedGames,
      prestige: s.prestige + 1, prestigePoints: s.prestigePoints + gain,
      skills: s.skills, totalCoinsEver: s.totalCoinsEver, createdAt: s.createdAt,
    };
    set((d) => {
      Object.assign(d, freshSave(), keep);
      d.coins = 5000;
      d.lastSeen = Date.now();
    });
    setConfirm(false);
    toast({ title: `ПЕРЕРОЖДЕНИЕ ${s.prestige + 1}`, sub: `+${gain} очков навыков`, icon: "sparkle", tone: "gold" });
  };

  const upgrade = (id: string) => {
    const node = SKILLS.find((n) => n.id === id)!;
    const lvl = s.skills[id] || 0;
    if (lvl >= node.max) return;
    const cost = node.cost(lvl);
    if (freePoints < cost) { sfx.error(); haptic("error"); return; }
    if (node.req && (s.skills[node.req] || 0) < 1) { sfx.error(); return; }
    sfx.power();
    haptic("success");
    set((d) => { d.skills[id] = (d.skills[id] || 0) + 1; });
  };

  const branches: { k: "coin" | "power" | "luck"; name: string; icon: IconName }[] = [
    { k: "coin", name: tr("ЖАДНОСТЬ"), icon: "coin" as const },
    { k: "power", name: tr("СИЛА"), icon: "fist" as const },
    { k: "luck", name: tr("УДАЧА"), icon: "clover" as const },
  ];

  return (
    <>
      <Card r="lg" style={{ padding: 15, marginBottom: 22 }}>
        <div className="flex items-start justify-between" style={{ gap: 12 }}>
          <div className="min-w-0">
            <div className="t-label">{tr("Перерождение")}</div>
            <div className="t-display-sm flex items-center justify-center" style={{ marginTop: 4, gap: 6 }}>
              <Icon name="star" size={17} accent /> {s.prestige}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="t-num acc-text" style={{ fontSize: 22 }}>{freePoints}</div>
            <div className="t-label" style={{ fontSize: 8.5, marginTop: 2 }}>{tr("свободных очков")}</div>
          </div>
        </div>
        <div className="t-body" style={{ margin: "14px 0" }}>{tr("Сбрасывает монеты и апгрейды кликера, но даёт очки навыков навсегда и")}<span className="acc-text">{tr("+12% ко всем монетам")}</span> за каждое перерождение.
          Уровень, ачивки, друзья и скины сохраняются.
        </div>
        {!confirm ? (
          <Button
            variant="primary" size="lg" full sound="none"
            disabled={prestigeAvailable <= 0}
            onClick={() => (prestigeAvailable > 0 ? setConfirm(true) : sfx.error())}
          >
            {prestigeAvailable > 0
              ? `Переродиться · +${prestigeAvailable} очков`
              : `Нужно ${fmt(2.5e6)} монет всего`}
          </Button>
        ) : (
          <div className="flex" style={{ gap: 8 }}>
            <Button variant="secondary" full onClick={() => setConfirm(false)}>{tr("Отмена")}</Button>
            <Button variant="primary" full sound="none" onClick={doPrestige}>{tr("Точно!")}</Button>
          </div>
        )}
      </Card>

      {branches.map((b) => (
        <div key={b.k} style={{ marginBottom: 22 }}>
          <SectionTitle>
            <span className="inline-flex items-center" style={{ gap: 7 }}>
              <Icon name={b.icon} size={14} accent /> {b.name}
            </span>
          </SectionTitle>
          {SKILLS.filter((n) => n.branch === b.k).map((node) => {
            const lvl = s.skills[node.id] || 0;
            const maxed = lvl >= node.max;
            const cost = maxed ? 0 : node.cost(lvl);
            const locked = node.req ? (s.skills[node.req] || 0) < 1 : false;
            const can = !maxed && !locked && freePoints >= cost;
            return (
              <Card
                key={node.id} r="md" tone={2}
                className="flex items-center"
                style={{ padding: 12, gap: 12, marginBottom: 8, opacity: locked ? 0.42 : 1 }}
              >
                <div className="shrink-0" style={{ color: locked ? "var(--text-mute)" : "var(--acc)" }}>
                <Icon name={locked ? "lock" : node.icon} size={21} />
              </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline" style={{ gap: 7 }}>
                    <span className="t-title-sm clip1">{node.name}</span>
                    <span className="t-num shrink-0" style={{ fontSize: 10.5, color: "var(--text-mute)" }}>
                      {lvl}/{node.max}
                    </span>
                  </div>
                  <div className="t-caption clip1" style={{ marginTop: 3 }}>{node.desc}</div>
                  <div style={{ marginTop: 8 }}><Bar pct={lvl / node.max} h={4} /></div>
                </div>
                <Button
                  variant={can ? "primary" : "secondary"} size="sm" sound="none"
                  disabled={!can} onClick={() => upgrade(node.id)}
                  className="shrink-0"
                >
                  {maxed ? "MAX" : (
                    <span className="inline-flex items-center" style={{ gap: 4 }}>
                      <Icon name="star" size={10} /> {cost}
                    </span>
                  )}
                </Button>
              </Card>
            );
          })}
        </div>
      ))}
    </>
  );
}

/* ============ АЧИВКИ ============ */
/** куда вести игрока за закрытием достижения: по префиксу id, без новой
    руки данных в контенте — иначе ACHIEVEMENTS пришлось бы знать про игры */
function achTarget(id: string): { game: GameId; label: string } | null {
  if (id.startsWith("burger") || id.startsWith("dodge")) return { game: "burger", label: "Burger Rain" };
  if (id.startsWith("merge") || id.startsWith("tile")) return { game: "merge", label: "2048" };
  if (id.startsWith("chess")) return { game: "chess", label: "Шахматы" };
  if (id.startsWith("checkers")) return { game: "checkers", label: "Шашки" };
  if (id.startsWith("europa")) return { game: "europa", label: "ЧУБУПА УНИВЕРСАЛИС" };
  return null;
}

function Achievements({ onPlay }: { onPlay?: (g: GameId) => void }) {
  const { s } = useGame();
  const [filter, setFilter] = useState<"all" | "done" | "todo">("all");
  const list = ACHIEVEMENTS.filter((a) => {
    const done = !!s.achievements[a.id];
    return filter === "all" || (filter === "done" ? done : !done);
  });
  const doneCount = ACHIEVEMENTS.filter((a) => s.achievements[a.id]).length;

  return (
    <>
      <Card r="lg" style={{ padding: 14, marginBottom: 14 }}>
        <div className="flex items-baseline justify-between" style={{ gap: 10, marginBottom: 11 }}>
          <div className="t-title-sm">{tr("Достижения")}</div>
          <div className="t-num acc-text" style={{ fontSize: 15 }}>{doneCount} / {ACHIEVEMENTS.length}</div>
        </div>
        <Bar pct={doneCount / ACHIEVEMENTS.length} h={7} />
      </Card>
      <div className="flex" style={{ gap: 8, marginBottom: 14 }}>
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>{tr("Все")}</Chip>
        <Chip active={filter === "todo"} onClick={() => setFilter("todo")}>{tr("Не получены")}</Chip>
        <Chip active={filter === "done"} onClick={() => setFilter("done")}>{tr("Получены")}</Chip>
      </div>
      {list.map((a, i) => {
        const done = !!s.achievements[a.id];
        const to = onPlay ? achTarget(a.id) : null;
        return (
          <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(0.3, i * 0.02) }}>
            <Card
              r="md" tone={2} className="flex items-center"
              style={{ padding: 12, gap: 12, marginBottom: 8, opacity: done ? 1 : 0.58 }}
              onClick={to && !done ? () => { sfx.click(); onPlay?.(to.game); } : undefined}
            >
              <div
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: 40, height: 40, borderRadius: "var(--r-sm)", fontSize: 19,
                  background: done ? `${RARITY_COLOR[a.rarity]}1f` : "var(--btn-bg)",
                  border: `1px solid ${done ? `${RARITY_COLOR[a.rarity]}66` : "var(--btn-brd)"}`,
                }}
              >
                <Icon name={done ? "trophy" : "lock"} size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline" style={{ gap: 7 }}>
                  <span className="t-title-sm clip1">{a.name}</span>
                  <span
                    className="t-label shrink-0"
                    style={{ fontSize: 8, color: RARITY_COLOR[a.rarity] }}
                  >
                    {RARITY_LABEL[a.rarity]}
                  </span>
                </div>
                <div className="t-caption clip2" style={{ marginTop: 3 }}>{a.desc}</div>
              </div>
              <div className="shrink-0 flex flex-col items-end" style={{ gap: 3 }}>
                <span className="t-num" style={{ fontSize: 11.5, color: done ? "var(--acc)" : "var(--text-mute)" }}>
                  +{fmt(a.reward)}
                </span>
                {/* «незакрытые кликабельны и ведут в нужный режим» — просьба
                    дословная; куда вести — подписано, чтобы это не был
                    тычок вслепую */}
                {to && !done && (
                  <span className="pc-ach-go">
                    {to.label}
                    <Icon name="chevron" size={10} />
                  </span>
                )}
              </div>
            </Card>
          </motion.div>
        );
      })}
    </>
  );
}

/* ============ СТАТИСТИКА ============ */
function Stats() {
  const { s } = useGame();
  const rows: [string, string][] = [
    [tr("Уровень"), `${s.level} (${fmt(s.xp)}/${fmt(xpForLevel(s.level))} XP)`],
    [tr("Перерождений"), `${s.prestige}`],
    [tr("Очков навыков"), `${s.prestigePoints} (потрачено ${spentSkillPoints(s)})`],
    [tr("Монет сейчас"), fmt(s.coins)],
    [tr("Монет за всё время"), fmt(s.totalCoinsEver)],
    [tr("Алмазов"), String(s.gems)],
    [tr("Тапов"), fmt(s.stats.tapsTotal)],
    [tr("Уклонов от снарядов"), fmt(s.stats.burgersDodged)],
    [tr("Слияний"), fmt(s.stats.merges)],
    [tr("Прибито голов"), fmt(s.stats.whacks)],
    [tr("Кейсов открыто"), String(s.stats.casesOpened)],
    [tr("Друзей"), String(s.friends.length)],
    [tr("Запусков приложения"), String(s.stats.sessions)],
    [tr("Играешь с"), new Date(s.createdAt).toLocaleDateString("ru-RU")],
  ];
  return (
    <>
      <SectionTitle>{tr("По играм")}</SectionTitle>
      {GAME_META.map((g) => {
        const st = s.games[g.id];
        return (
          <Card key={g.id} r="md" tone={2} style={{ padding: 13, marginBottom: 8 }}>
            <div className="flex items-center" style={{ gap: 9, marginBottom: 12 }}>
              <span style={{ lineHeight: 0 }}><GameIcon id={g.id} size={19} /></span>
              <span className="t-title-sm clip1">{g.name}</span>
            </div>
            <div className="grid grid-cols-4 text-center" style={{ gap: 8 }}>
              <Mini v={fmt(st.best)} l={tr("рекорд")} acc />
              <Mini v={String(st.plays)} l={tr("игр")} />
              <Mini v={fmt(st.totalScore)} l={tr("всего")} />
              <Mini v={fmtTime(st.timeMs)} l={tr("время")} />
            </div>
          </Card>
        );
      })}
      <div style={{ marginTop: 22 }}>
        <SectionTitle>{tr("Общее")}</SectionTitle>
      </div>
      <Card r="lg" style={{ overflow: "hidden" }}>
        {rows.map(([k, v], i) => (
          <div key={k}>
            <div
              className="flex items-center justify-between"
              style={{ padding: "11px 14px", gap: 12 }}
            >
              <span className="t-body clip1">{k}</span>
              <span className="t-num shrink-0" style={{ fontSize: 12.5 }}>{v}</span>
            </div>
            {i < rows.length - 1 && <Divider inset={14} />}
          </div>
        ))}
      </Card>
    </>
  );
}

function Mini({ v, l, acc }: { v: string; l: string; acc?: boolean }) {
  return (
    <div>
      <div className="t-num" style={{ fontSize: 13, color: acc ? "var(--acc)" : "var(--text)" }}>{v}</div>
      <div className="t-label" style={{ fontSize: 8, marginTop: 3 }}>{l}</div>
    </div>
  );
}
