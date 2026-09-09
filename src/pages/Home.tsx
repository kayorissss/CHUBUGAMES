import { motion } from "framer-motion";
import { useGame } from "../core/store";
import { GAME_META } from "../core/content";
import { fmt } from "../core/format";
import { xpForLevel, autoRate } from "../core/save";
import { Panel, Tap, Bar, SectionTitle } from "../ui/Glass";
import HeadView from "../ui/HeadView";
import type { GameId } from "../core/types";

export default function Home({ onPlay }: { onPlay: (g: GameId) => void }) {
  const { s, mainFriend, levelPct } = useGame();
  const rate = autoRate(s);
  const lastPlayed = GAME_META.filter((g) => s.unlockedGames.includes(g.id)).sort(
    (a, b) => s.games[b.id].plays - s.games[a.id].plays,
  )[0];

  return (
    <div className="scroll h-full px-4" style={{ paddingTop: "calc(var(--sat) + 14px)", paddingBottom: "calc(var(--sab) + 116px)" }}>
      {/* Шапка */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <div
            className="t-display"
            style={{
              fontSize: 27,
              background: "linear-gradient(96deg, var(--text), var(--acc))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            CHUBGAMES
          </div>
          <div className="t-label clip1" style={{ marginTop: 3 }}>
            уровень {s.level} {s.prestige > 0 && `• ★${s.prestige}`}
          </div>
        </div>
        <Panel r="md" className="px-3 py-2 text-right shrink-0">
          <div className="t-num acc-text" style={{ fontSize: 16, lineHeight: 1.1 }}>{fmt(s.coins)}</div>
          <div className="t-label" style={{ fontSize: 8 }}>🪙 {rate > 0 ? `+${fmt(rate)}/с` : "монет"}</div>
        </Panel>
      </div>

      {/* Полоса уровня */}
      <Panel r="lg" className="p-3.5 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <HeadView friend={mainFriend} size={48} />
            <div
              className="absolute t-num flex items-center justify-center"
              style={{
                bottom: -3, right: -5, width: 22, height: 22, borderRadius: 99,
                background: "var(--acc)", color: "var(--acc-ink)", fontSize: 10,
                border: "2px solid var(--bg)",
              }}
            >
              {s.level}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline mb-1.5">
              <div className="t-title" style={{ fontSize: 13 }}>{mainFriend.name}</div>
              <div className="t-mono" style={{ fontSize: 10, color: "var(--text-mute)" }}>
                {fmt(s.xp)} / {fmt(xpForLevel(s.level))}
              </div>
            </div>
            <Bar pct={levelPct} h={7} />
          </div>
        </div>
      </Panel>

      {/* Продолжить */}
      {lastPlayed && (
        <motion.div whileTap={{ scale: 0.98 }} className="mb-5">
          <Tap onClick={() => onPlay(lastPlayed.id)} r="xl" className="w-full overflow-hidden" sound="power">
            <div className="relative p-5 text-left overflow-hidden">
              <div
                className="absolute pointer-events-none"
                style={{
                  right: -22, top: -10, fontSize: 104, opacity: 0.1,
                  transform: "rotate(-12deg)", lineHeight: 1,
                }}
              >
                {lastPlayed.icon}
              </div>
              <div className="t-label acc-text" style={{ fontSize: 9 }}>ПРОДОЛЖИТЬ</div>
              <div className="t-display mt-1" style={{ fontSize: 26, maxWidth: "76%" }}>
                {lastPlayed.name}
              </div>
              <div
                className="clip2"
                style={{ fontSize: 11, color: "var(--text-mute)", marginTop: 6, maxWidth: "74%", lineHeight: 1.4 }}
              >
                {lastPlayed.desc}
              </div>
              <div className="flex items-center gap-2 mt-3.5">
                <div
                  className="px-3.5 py-2 t-title flex items-center gap-1.5"
                  style={{ background: "var(--acc)", color: "var(--acc-ink)", borderRadius: 99, fontSize: 12 }}
                >
                  ▶ ИГРАТЬ
                </div>
                <div className="t-num" style={{ fontSize: 11, color: "var(--text-mute)" }}>
                  рекорд {fmt(s.games[lastPlayed.id].best)}
                </div>
              </div>
            </div>
          </Tap>
        </motion.div>
      )}

      <SectionTitle right={<span className="t-label">{s.unlockedGames.length}/{GAME_META.length}</span>}>
        Все игры
      </SectionTitle>

      <div className="grid grid-cols-2 gap-3">
        {GAME_META.map((g, i) => {
          const unlocked = s.unlockedGames.includes(g.id);
          const st = s.games[g.id];
          return (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Tap
                onClick={() => unlocked && onPlay(g.id)}
                disabled={!unlocked}
                r="lg"
                className="w-full text-left overflow-hidden relative"
                sound="power"
                style={{ minHeight: 148 }}
              >
                <div className="p-3.5 h-full flex flex-col">
                  <div className="flex items-start justify-between">
                    <div style={{ fontSize: 30, lineHeight: 1 }}>{unlocked ? g.icon : "🔒"}</div>
                    <div
                      className="t-label px-2 py-0.5"
                      style={{
                        fontSize: 8, borderRadius: 99,
                        background: "rgba(255,255,255,0.07)", color: "var(--text-mute)",
                      }}
                    >
                      {g.tag}
                    </div>
                  </div>
                  <div className="t-title mt-2.5" style={{ fontSize: 14, lineHeight: 1.15 }}>
                    {unlocked ? g.name : "?????"}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-mute)", marginTop: 4, lineHeight: 1.35, flex: 1 }}>
                    {unlocked ? g.desc : `Откроется на ${g.unlockLvl} уровне`}
                  </div>
                  {unlocked && (
                    <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid var(--glass-brd)" }}>
                      <span className="t-num acc-text" style={{ fontSize: 12 }}>{fmt(st.best)}</span>
                      <span className="t-label" style={{ fontSize: 8 }}>{st.plays} игр</span>
                    </div>
                  )}
                </div>
              </Tap>
            </motion.div>
          );
        })}
      </div>

      {/* Быстрая статистика */}
      <SectionTitle>Сводка</SectionTitle>
      <div className="grid grid-cols-3 gap-2.5">
        <StatMini v={fmt(s.stats.burgersDodged)} l="уклонов" />
        <StatMini v={fmt(s.stats.tapsTotal)} l="тапов" />
        <StatMini v={fmt(s.totalCoinsEver)} l="монет всего" />
      </div>
    </div>
  );
}

function StatMini({ v, l }: { v: string; l: string }) {
  return (
    <Panel r="md" className="py-3 text-center">
      <div className="t-num" style={{ fontSize: 16 }}>{v}</div>
      <div className="t-label" style={{ fontSize: 8, marginTop: 2 }}>{l}</div>
    </Panel>
  );
}
