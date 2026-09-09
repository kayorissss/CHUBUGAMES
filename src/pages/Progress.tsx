import { useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "../core/store";
import {
  ACHIEVEMENTS, QUEST_POOL, DAILY_LADDER, SKILLS, RARITY_COLOR, RARITY_LABEL,
  SEASON_TIERS, SEASON_XP_PER_TIER, seasonReward, GAME_META,
} from "../core/content";
import { fmt, fmtTime, today, daysBetween } from "../core/format";
import { spentSkillPoints, xpForLevel } from "../core/save";
import { Panel, Tap, Bar, Chip, SectionTitle } from "../ui/Glass";
import { sfx, haptic } from "../core/fx";
import { freshSave } from "../core/save";

type Tab = "daily" | "season" | "skills" | "ach" | "stats";

export default function ProgressPage() {
  const [tab, setTab] = useState<Tab>("daily");
  return (
    <div className="h-full flex flex-col" style={{ paddingTop: "calc(var(--sat) + 14px)" }}>
      <div className="px-4 mb-3">
        <div className="t-display" style={{ fontSize: 25 }}>ПРОГРЕСС</div>
      </div>
      <div className="mb-3 flex gap-2 overflow-x-auto scroll px-4" style={{ paddingBottom: 2 }}>
        <Chip active={tab === "daily"} onClick={() => setTab("daily")}>Ежедневки</Chip>
        <Chip active={tab === "season"} onClick={() => setTab("season")}>Сезон</Chip>
        <Chip active={tab === "skills"} onClick={() => setTab("skills")}>Навыки</Chip>
        <Chip active={tab === "ach"} onClick={() => setTab("ach")}>Ачивки</Chip>
        <Chip active={tab === "stats"} onClick={() => setTab("stats")}>Статистика</Chip>
      </div>
      <div className="flex-1 scroll px-4" style={{ paddingBottom: "calc(var(--sab) + 116px)" }}>
        {tab === "daily" && <Daily />}
        {tab === "season" && <Season />}
        {tab === "skills" && <Skills />}
        {tab === "ach" && <Achievements />}
        {tab === "stats" && <Stats />}
      </div>
    </div>
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
      <Panel r="lg" className="p-3.5 mb-4">
        <div className="grid grid-cols-7 gap-1.5 mb-3">
          {DAILY_LADDER.map((r, i) => {
            const claimed = i < streakIdx || (!canClaim && i <= streakIdx);
            const isNext = canClaim && i === streakIdx;
            return (
              <div
                key={i}
                className="flex flex-col items-center justify-center py-2 relative"
                style={{
                  borderRadius: 12,
                  background: isNext ? "var(--acc)" : claimed ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isNext ? "transparent" : "var(--glass-brd)"}`,
                  opacity: claimed ? 0.55 : 1,
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 800, color: isNext ? "var(--acc-ink)" : "var(--text-mute)" }}>
                  Д{i + 1}
                </div>
                <div style={{ fontSize: 13, marginTop: 1 }}>{r.gems ? "💎" : "🪙"}</div>
                {claimed && <div className="absolute" style={{ fontSize: 12 }}>✓</div>}
              </div>
            );
          })}
        </div>
        <Tap
          onClick={claim} disabled={!canClaim} accent={canClaim} r="md"
          className="w-full py-3 t-title" style={{ fontSize: 13 }} sound="none"
        >
          {canClaim ? `ЗАБРАТЬ ${DAILY_LADDER[streakIdx].coins.toLocaleString("ru-RU")} 🪙` : "УЖЕ ЗАБРАЛ · ЗАХОДИ ЗАВТРА"}
        </Tap>
      </Panel>

      <SectionTitle>Задания дня</SectionTitle>
      {s.daily.quests.map((q) => {
        const def = QUEST_POOL.find((x) => x.id === q.id);
        if (!def) return null;
        const pct = Math.min(1, q.progress / def.target);
        return (
          <Panel key={q.id} r="lg" className="p-3.5 mb-2.5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="t-title clip2" style={{ fontSize: 13, flex: 1, minWidth: 0 }}>
                {def.name.replace("{n}", def.target.toLocaleString("ru-RU"))}
              </div>
              <div className="t-num acc-text shrink-0" style={{ fontSize: 12 }}>+{fmt(def.reward)}</div>
            </div>
            <Bar pct={pct} h={6} />
            <div className="flex items-center justify-between gap-2 mt-2" style={{ minHeight: 26 }}>
              <span className="t-mono clip1" style={{ fontSize: 10, color: "var(--text-mute)" }}>
                {Math.floor(q.progress).toLocaleString("ru-RU")} / {def.target.toLocaleString("ru-RU")}
              </span>
              {q.done && !q.claimed && (
                <Tap onClick={() => claimQuest(q.id)} accent r="sm" className="px-3 py-1.5 t-title" style={{ fontSize: 11 }} sound="none">
                  ЗАБРАТЬ
                </Tap>
              )}
              {q.claimed && <span className="t-label" style={{ fontSize: 9 }}>✓ получено</span>}
            </div>
          </Panel>
        );
      })}
      <div className="t-label text-center mt-4">Задания обновляются каждый день</div>
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
      <Panel r="lg" className="p-4 mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <div className="t-label">СЕЗОН {s.season.id}</div>
            <div className="t-display" style={{ fontSize: 26 }}>УРОВЕНЬ {tier}</div>
          </div>
          <div className="text-right">
            <div className="t-num acc-text" style={{ fontSize: 16 }}>{fmt(s.season.xp)}</div>
            <div className="t-label" style={{ fontSize: 8 }}>сезонный XP</div>
          </div>
        </div>
        <Bar pct={inTier} h={8} />
        {tier >= SEASON_TIERS && (
          <Tap onClick={restart} accent r="md" className="w-full py-3 mt-3 t-title" style={{ fontSize: 13 }} sound="none">
            ЗАВЕРШИТЬ СЕЗОН · +15 💎
          </Tap>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-2">
        {Array.from({ length: SEASON_TIERS }).map((_, i) => {
          const rw = seasonReward(i);
          const unlocked = i < tier;
          const claimed = s.season.claimed.includes(i);
          return (
            <Panel
              key={i} r="md"
              className="px-3.5 py-2.5 flex items-center gap-3"
              style={{ opacity: unlocked ? 1 : 0.44 }}
            >
              <div
                className="t-num shrink-0 flex items-center justify-center"
                style={{
                  width: 32, height: 32, borderRadius: 10, fontSize: 12,
                  background: rw.label ? "var(--acc)" : "rgba(255,255,255,0.08)",
                  color: rw.label ? "var(--acc-ink)" : "var(--text-dim)",
                }}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="t-num" style={{ fontSize: 13 }}>
                  {fmt(rw.coins)} 🪙 {rw.gems > 0 && `· ${rw.gems} 💎`}
                </div>
                {rw.label && <div className="t-label acc-text" style={{ fontSize: 8 }}>{rw.label} НАГРАДА</div>}
              </div>
              {claimed ? (
                <span className="t-label" style={{ fontSize: 9 }}>✓</span>
              ) : unlocked ? (
                <Tap onClick={() => claim(i)} accent r="sm" className="px-3 py-1.5 t-title" style={{ fontSize: 10 }} sound="none">
                  ВЗЯТЬ
                </Tap>
              ) : (
                <span style={{ fontSize: 12, opacity: 0.5 }}>🔒</span>
              )}
            </Panel>
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
      <Panel r="lg" className="p-4 mb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <div className="t-label">ПЕРЕРОЖДЕНИЕ</div>
            <div className="t-display" style={{ fontSize: 25 }}>★ {s.prestige}</div>
          </div>
          <div className="text-right">
            <div className="t-num acc-text" style={{ fontSize: 22 }}>{freePoints}</div>
            <div className="t-label" style={{ fontSize: 8 }}>свободных очков</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-mute)", lineHeight: 1.5, margin: "8px 0 10px" }}>
          Сбрасывает монеты и апгрейды кликера, но даёт очки навыков навсегда и
          <span className="acc-text"> +12% ко всем монетам</span> за каждое перерождение.
          Уровень, ачивки, друзья и скины сохраняются.
        </div>
        {!confirm ? (
          <Tap
            onClick={() => (prestigeAvailable > 0 ? setConfirm(true) : sfx.error())}
            disabled={prestigeAvailable <= 0}
            accent={prestigeAvailable > 0}
            r="md" className="w-full py-3 t-title" style={{ fontSize: 13 }} sound="none"
          >
            {prestigeAvailable > 0
              ? `ПЕРЕРОДИТЬСЯ · +${prestigeAvailable} ОЧКОВ`
              : `Нужно ${fmt(2.5e6)} монет всего (${fmt(s.totalCoinsEver)})`}
          </Tap>
        ) : (
          <div className="flex gap-2">
            <Tap onClick={() => setConfirm(false)} r="md" className="flex-1 py-3 t-title" style={{ fontSize: 12 }}>
              Отмена
            </Tap>
            <Tap onClick={doPrestige} accent r="md" className="flex-1 py-3 t-title" style={{ fontSize: 12 }} sound="none">
              ТОЧНО!
            </Tap>
          </div>
        )}
      </Panel>

      {branches.map((b) => (
        <div key={b.k} className="mb-4">
          <SectionTitle>{b.icon} {b.name}</SectionTitle>
          {SKILLS.filter((n) => n.branch === b.k).map((node) => {
            const lvl = s.skills[node.id] || 0;
            const maxed = lvl >= node.max;
            const cost = maxed ? 0 : node.cost(lvl);
            const locked = node.req ? (s.skills[node.req] || 0) < 1 : false;
            const can = !maxed && !locked && freePoints >= cost;
            return (
              <Panel key={node.id} r="md" className="p-3 mb-2 flex items-center gap-3" style={{ opacity: locked ? 0.45 : 1 }}>
                <div style={{ fontSize: 22 }}>{locked ? "🔒" : node.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="t-title" style={{ fontSize: 13 }}>{node.name}</span>
                    <span className="t-num" style={{ fontSize: 10, color: "var(--text-mute)" }}>{lvl}/{node.max}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-mute)" }}>{node.desc}</div>
                  <div className="mt-1.5"><Bar pct={lvl / node.max} h={4} /></div>
                </div>
                <Tap
                  onClick={() => upgrade(node.id)} disabled={!can} accent={can} r="sm"
                  className="px-3 py-2 t-num shrink-0" style={{ fontSize: 11 }} sound="none"
                >
                  {maxed ? "MAX" : `★${cost}`}
                </Tap>
              </Panel>
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
      <Panel r="lg" className="p-3.5 mb-3">
        <div className="flex items-baseline justify-between mb-2">
          <div className="t-title" style={{ fontSize: 14 }}>Достижения</div>
          <div className="t-num acc-text" style={{ fontSize: 15 }}>{doneCount} / {ACHIEVEMENTS.length}</div>
        </div>
        <Bar pct={doneCount / ACHIEVEMENTS.length} h={7} />
      </Panel>
      <div className="flex gap-2 mb-3">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>Все</Chip>
        <Chip active={filter === "todo"} onClick={() => setFilter("todo")}>Не получены</Chip>
        <Chip active={filter === "done"} onClick={() => setFilter("done")}>Получены</Chip>
      </div>
      {list.map((a, i) => {
        const done = !!s.achievements[a.id];
        return (
          <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(0.3, i * 0.02) }}>
            <Panel r="md" className="p-3 mb-2 flex items-center gap-3" style={{ opacity: done ? 1 : 0.62 }}>
              <div
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: 40, height: 40, borderRadius: 12, fontSize: 19,
                  background: done ? `${RARITY_COLOR[a.rarity]}22` : "rgba(255,255,255,0.05)",
                  border: `1px solid ${done ? RARITY_COLOR[a.rarity] : "var(--glass-brd)"}`,
                }}
              >
                {done ? "🏆" : "🔒"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="t-title" style={{ fontSize: 13 }}>{a.name}</span>
                  <span className="t-label" style={{ fontSize: 7, color: RARITY_COLOR[a.rarity] }}>
                    {RARITY_LABEL[a.rarity]}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-mute)" }}>{a.desc}</div>
              </div>
              <div className="t-num shrink-0" style={{ fontSize: 11, color: done ? "var(--acc)" : "var(--text-mute)" }}>
                {fmt(a.reward)}🪙
              </div>
            </Panel>
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
          <Panel key={g.id} r="md" className="p-3 mb-2">
            <div className="flex items-center gap-2.5 mb-2">
              <span style={{ fontSize: 18 }}>{g.icon}</span>
              <span className="t-title" style={{ fontSize: 13 }}>{g.name}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <Mini v={fmt(st.best)} l="рекорд" acc />
              <Mini v={String(st.plays)} l="игр" />
              <Mini v={fmt(st.totalScore)} l="всего" />
              <Mini v={fmtTime(st.timeMs)} l="время" />
            </div>
          </Panel>
        );
      })}
      <SectionTitle>Общее</SectionTitle>
      <Panel r="lg" className="p-1">
        {rows.map(([k, v], i) => (
          <div key={k}>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{k}</span>
              <span className="t-num" style={{ fontSize: 12 }}>{v}</span>
            </div>
            {i < rows.length - 1 && <div className="divider" />}
          </div>
        ))}
      </Panel>
    </>
  );
}

function Mini({ v, l, acc }: { v: string; l: string; acc?: boolean }) {
  return (
    <div>
      <div className="t-num" style={{ fontSize: 13, color: acc ? "var(--acc)" : "var(--text)" }}>{v}</div>
      <div className="t-label" style={{ fontSize: 7 }}>{l}</div>
    </div>
  );
}
