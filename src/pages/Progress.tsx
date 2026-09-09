import { useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "../core/store";
import {
  ACHIEVEMENTS, QUEST_POOL, DAILY_LADDER, SKILLS, RARITY_COLOR, RARITY_LABEL,
  SEASON_TIERS, SEASON_XP_PER_TIER, seasonReward, GAME_META,
} from "../core/content";
import { fmt, fmtTime, today, daysBetween } from "../core/format";
import { spentSkillPoints, xpForLevel } from "../core/save";
import { Card, Button, Bar, Chip, SectionTitle, Screen, Divider } from "../ui/Glass";
import GameIcon from "../ui/GameIcon";
import { sfx, haptic } from "../core/fx";
import { freshSave } from "../core/save";

type Tab = "daily" | "season" | "skills" | "ach" | "stats";

export default function ProgressPage() {
  const [tab, setTab] = useState<Tab>("daily");
  return (
    <Screen title="ПРОГРЕСС">
      <div
        className="flex overflow-x-auto scroll"
        style={{ gap: 8, marginBottom: 18, paddingBottom: 2 }}
      >
        <Chip active={tab === "daily"} onClick={() => setTab("daily")}>Ежедневки</Chip>
        <Chip active={tab === "season"} onClick={() => setTab("season")}>Сезон</Chip>
        <Chip active={tab === "skills"} onClick={() => setTab("skills")}>Навыки</Chip>
        <Chip active={tab === "ach"} onClick={() => setTab("ach")}>Ачивки</Chip>
        <Chip active={tab === "stats"} onClick={() => setTab("stats")}>Статистика</Chip>
      </div>
      {tab === "daily" && <Daily />}
      {tab === "season" && <Season />}
      {tab === "skills" && <Skills />}
      {tab === "ach" && <Achievements />}
      {tab === "stats" && <Stats />}
    </Screen>
  );
}

/* ============ ЕЖЕДНЕВКИ ============ */
function Daily() {
  const { s, set, toast } = useGame();
  const t = today();
  const gap = s.daily.lastClaim ? daysBetween(s.daily.lastClaim, t) : 999;
  const canClaim = gap >= 1;
  const streakIdx = Math.min(6, canClaim ? (gap === 1 ? s.daily.streak : 0) : Math.max(0, s.daily.streak - 1));

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
      title: `День ${newStreak}`,
      sub: `+${rw.coins.toLocaleString("ru-RU")} 🪙${rw.gems ? ` +${rw.gems} 💎` : ""}`,
      icon: "🎁", tone: "gold",
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
    toast({ title: "Награда получена", sub: `+${def.reward.toLocaleString("ru-RU")} 🪙`, icon: "✅" });
  };

  return (
    <>
      <SectionTitle right={<span className="t-label acc-text">🔥 {s.daily.streak} дней</span>}>
        Ежедневный вход
      </SectionTitle>
      <Card r="lg" style={{ padding: 14, marginBottom: 22 }}>
        <div className="grid grid-cols-7" style={{ gap: 6, marginBottom: 14 }}>
          {DAILY_LADDER.map((r, i) => {
            const claimed = i < streakIdx || (!canClaim && i <= streakIdx);
            const isNext = canClaim && i === streakIdx;
            return (
              <div
                key={i}
                className="flex flex-col items-center justify-center relative"
                style={{
                  padding: "8px 2px",
                  borderRadius: "var(--r-sm)",
                  background: isNext ? "var(--acc)" : "var(--btn-bg)",
                  border: `1px solid ${isNext ? "transparent" : "var(--btn-brd)"}`,
                  opacity: claimed ? 0.5 : 1,
                }}
              >
                <div
                  className="t-label"
                  style={{ fontSize: 8, color: isNext ? "var(--acc-ink)" : "var(--text-mute)" }}
                >
                  Д{i + 1}
                </div>
                <div style={{ fontSize: 13, marginTop: 3 }}>{claimed ? "✓" : r.gems ? "💎" : "🪙"}</div>
              </div>
            );
          })}
        </div>
        <Button
          variant="primary" size="lg" full sound="none"
          onClick={claim} disabled={!canClaim}
        >
          {canClaim
            ? `Забрать ${DAILY_LADDER[streakIdx].coins.toLocaleString("ru-RU")} 🪙`
            : "Уже забрал · заходи завтра"}
        </Button>
      </Card>

      <SectionTitle>Задания дня</SectionTitle>
      {s.daily.quests.map((q) => {
        const def = QUEST_POOL.find((x) => x.id === q.id);
        if (!def) return null;
        const pct = Math.min(1, q.progress / def.target);
        return (
          <Card key={q.id} r="lg" style={{ padding: 14, marginBottom: 10 }}>
            <div className="flex items-start justify-between" style={{ gap: 12, marginBottom: 11 }}>
              <div className="t-title-sm clip2" style={{ flex: 1, minWidth: 0 }}>
                {def.name.replace("{n}", def.target.toLocaleString("ru-RU"))}
              </div>
              <div className="t-num acc-text shrink-0" style={{ fontSize: 12.5 }}>+{fmt(def.reward)}</div>
            </div>
            <Bar pct={pct} h={6} />
            <div
              className="flex items-center justify-between"
              style={{ gap: 10, marginTop: 11, minHeight: 30 }}
            >
              <span className="t-num clip1" style={{ fontSize: 11, color: "var(--text-mute)" }}>
                {Math.floor(q.progress).toLocaleString("ru-RU")} / {def.target.toLocaleString("ru-RU")}
              </span>
              {q.done && !q.claimed && (
                <Button variant="primary" size="sm" sound="none" onClick={() => claimQuest(q.id)}>
                  Забрать
                </Button>
              )}
              {q.claimed && <span className="t-label" style={{ fontSize: 9 }}>✓ получено</span>}
            </div>
          </Card>
        );
      })}
      <div className="t-caption text-center" style={{ marginTop: 18 }}>Задания обновляются каждый день</div>
    </>
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
    toast({ title: `Уровень сезона ${i + 1}`, sub: `+${fmt(rw.coins)} 🪙`, icon: "🎖", tone: "gold" });
  };

  const restart = () => {
    if (tier < SEASON_TIERS) return;
    sfx.legend();
    set((d) => {
      d.season = { id: d.season.id + 1, xp: 0, claimed: [], startedAt: Date.now() };
      d.gems += 15;
    });
    toast({ title: "НОВЫЙ СЕЗОН", sub: "+15 💎 за завершение", icon: "🏁", tone: "gold" });
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
            <div className="t-label" style={{ fontSize: 8.5, marginTop: 2 }}>сезонный XP</div>
          </div>
        </div>
        <Bar pct={inTier} h={8} />
        {tier >= SEASON_TIERS && (
          <div style={{ marginTop: 14 }}>
            <Button variant="primary" size="lg" full sound="none" onClick={restart}>
              Завершить сезон · +15 💎
            </Button>
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
                  {fmt(rw.coins)} 🪙 {rw.gems > 0 && `· ${rw.gems} 💎`}
                </div>
                {rw.label && (
                  <div className="t-label acc-text" style={{ fontSize: 8.5, marginTop: 2 }}>
                    {rw.label} награда
                  </div>
                )}
              </div>
              {claimed ? (
                <span className="t-label shrink-0" style={{ fontSize: 10 }}>✓</span>
              ) : unlocked ? (
                <Button variant="primary" size="sm" sound="none" onClick={() => claim(i)}>
                  Взять
                </Button>
              ) : (
                <span className="shrink-0" style={{ fontSize: 12, opacity: 0.5 }}>🔒</span>
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
    toast({ title: `ПЕРЕРОЖДЕНИЕ ★${s.prestige + 1}`, sub: `+${gain} очков навыков`, icon: "🌀", tone: "gold" });
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

  const branches: { k: "coin" | "power" | "luck"; name: string; icon: string }[] = [
    { k: "coin", name: "ЖАДНОСТЬ", icon: "🪙" },
    { k: "power", name: "СИЛА", icon: "✊" },
    { k: "luck", name: "УДАЧА", icon: "🍀" },
  ];

  return (
    <>
      <Card r="lg" style={{ padding: 15, marginBottom: 22 }}>
        <div className="flex items-start justify-between" style={{ gap: 12 }}>
          <div className="min-w-0">
            <div className="t-label">Перерождение</div>
            <div className="t-display-sm" style={{ marginTop: 4 }}>★ {s.prestige}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="t-num acc-text" style={{ fontSize: 22 }}>{freePoints}</div>
            <div className="t-label" style={{ fontSize: 8.5, marginTop: 2 }}>свободных очков</div>
          </div>
        </div>
        <div className="t-body" style={{ margin: "14px 0" }}>
          Сбрасывает монеты и апгрейды кликера, но даёт очки навыков навсегда и
          <span className="acc-text"> +12% ко всем монетам</span> за каждое перерождение.
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
            <Button variant="secondary" full onClick={() => setConfirm(false)}>Отмена</Button>
            <Button variant="primary" full sound="none" onClick={doPrestige}>Точно!</Button>
          </div>
        )}
      </Card>

      {branches.map((b) => (
        <div key={b.k} style={{ marginBottom: 22 }}>
          <SectionTitle>{b.icon} {b.name}</SectionTitle>
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
                <div className="shrink-0" style={{ fontSize: 22 }}>{locked ? "🔒" : node.icon}</div>
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
                  {maxed ? "MAX" : `★${cost}`}
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
function Achievements() {
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
          <div className="t-title-sm">Достижения</div>
          <div className="t-num acc-text" style={{ fontSize: 15 }}>{doneCount} / {ACHIEVEMENTS.length}</div>
        </div>
        <Bar pct={doneCount / ACHIEVEMENTS.length} h={7} />
      </Card>
      <div className="flex" style={{ gap: 8, marginBottom: 14 }}>
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>Все</Chip>
        <Chip active={filter === "todo"} onClick={() => setFilter("todo")}>Не получены</Chip>
        <Chip active={filter === "done"} onClick={() => setFilter("done")}>Получены</Chip>
      </div>
      {list.map((a, i) => {
        const done = !!s.achievements[a.id];
        return (
          <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(0.3, i * 0.02) }}>
            <Card
              r="md" tone={2} className="flex items-center"
              style={{ padding: 12, gap: 12, marginBottom: 8, opacity: done ? 1 : 0.58 }}
            >
              <div
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: 40, height: 40, borderRadius: "var(--r-sm)", fontSize: 19,
                  background: done ? `${RARITY_COLOR[a.rarity]}1f` : "var(--btn-bg)",
                  border: `1px solid ${done ? `${RARITY_COLOR[a.rarity]}66` : "var(--btn-brd)"}`,
                }}
              >
                {done ? "🏆" : "🔒"}
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
              <div
                className="t-num shrink-0"
                style={{ fontSize: 11.5, color: done ? "var(--acc)" : "var(--text-mute)" }}
              >
                {fmt(a.reward)}🪙
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
    ["Уровень", `${s.level} (${fmt(s.xp)}/${fmt(xpForLevel(s.level))} XP)`],
    ["Перерождений", `★ ${s.prestige}`],
    ["Очков навыков", `${s.prestigePoints} (потрачено ${spentSkillPoints(s)})`],
    ["Монет сейчас", fmt(s.coins)],
    ["Монет за всё время", fmt(s.totalCoinsEver)],
    ["Алмазов", String(s.gems)],
    ["Тапов", fmt(s.stats.tapsTotal)],
    ["Уклонов от снарядов", fmt(s.stats.burgersDodged)],
    ["Слияний", fmt(s.stats.merges)],
    ["Прибито голов", fmt(s.stats.whacks)],
    ["Кейсов открыто", String(s.stats.casesOpened)],
    ["Друзей", String(s.friends.length)],
    ["Запусков приложения", String(s.stats.sessions)],
    ["Играешь с", new Date(s.createdAt).toLocaleDateString("ru-RU")],
  ];
  return (
    <>
      <SectionTitle>По играм</SectionTitle>
      {GAME_META.map((g) => {
        const st = s.games[g.id];
        return (
          <Card key={g.id} r="md" tone={2} style={{ padding: 13, marginBottom: 8 }}>
            <div className="flex items-center" style={{ gap: 9, marginBottom: 12 }}>
              <span style={{ lineHeight: 0 }}><GameIcon id={g.id} size={19} /></span>
              <span className="t-title-sm clip1">{g.name}</span>
            </div>
            <div className="grid grid-cols-4 text-center" style={{ gap: 8 }}>
              <Mini v={fmt(st.best)} l="рекорд" acc />
              <Mini v={String(st.plays)} l="игр" />
              <Mini v={fmt(st.totalScore)} l="всего" />
              <Mini v={fmtTime(st.timeMs)} l="время" />
            </div>
          </Card>
        );
      })}
      <div style={{ marginTop: 22 }}>
        <SectionTitle>Общее</SectionTitle>
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
