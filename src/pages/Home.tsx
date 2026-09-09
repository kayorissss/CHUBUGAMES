import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { GAME_META } from "../core/content";
import { fmt } from "../core/format";
import { xpForLevel, autoRate } from "../core/save";
import { Card, Tap, Bar, SectionTitle, Screen } from "../ui/Glass";
import HeadView from "../ui/HeadView";
import GameIcon from "../ui/GameIcon";
import Icon from "../ui/Icon";
import type { GameId } from "../core/types";
import AdModal from "../ui/AdModal";
import { bonusesLeft, hasAds, noteBonus } from "../core/ads";
import ModesPanel from "../ui/ModesPanel";
import type { SubPage } from "../App";

export default function Home({
  onPlay, onOpenProfile, onOpen,
}: {
  onPlay: (g: GameId) => void;
  onOpenProfile?: () => void;
  onOpen?: (page: SubPage) => void;
}) {
  const { s, mainFriend, levelPct, addCoins, toast } = useGame();
  const rate = autoRate(s);
  const [showAd, setShowAd] = useState(false);
  const [adLeft, setAdLeft] = useState(() => bonusesLeft());
  // награда — как 3 минуты автодохода, но не меньше осмысленной суммы
  const adReward = Math.max(500, Math.floor(rate * 180) + s.level * 250);
  const featured = GAME_META.filter((g) => s.unlockedGames.includes(g.id)).sort(
    (a, b) => s.games[b.id].plays - s.games[a.id].plays,
  )[0];

  return (
    <Screen>
      {/* Шапка */}
      <div
        className="flex items-center justify-between gap-3"
        style={{ paddingTop: "calc(var(--sat) + 14px)", marginBottom: 16 }}
      >
        <div className="min-w-0">
          <h1
            className="t-display"
            style={{
              backgroundImage: "linear-gradient(94deg, var(--text) 30%, var(--acc))",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            ЧУБУГЕЙМ
          </h1>
        </div>
        <Card r="md" className="shrink-0" style={{ padding: "8px 12px" }}>
          <div className="flex items-center gap-1.5">
            <Icon name="coin" size={14} accent />
            <span className="t-num acc-text" style={{ fontSize: 15 }}>{fmt(s.coins)}</span>
          </div>
          {rate > 0 && (
            <div className="t-caption" style={{ fontSize: 10, marginTop: 1 }}>
              +{fmt(rate)}/сек
            </div>
          )}
        </Card>
      </div>

      {/* Профиль — тап открывает статистику */}
      <Tap
        solid
        r="lg"
        onClick={() => onOpenProfile?.()}
        sound="click"
        className="w-full"
        style={{ padding: 14, marginBottom: 18, display: "block" }}
      >
        <div className="flex items-center" style={{ gap: 13 }}>
          <div className="relative shrink-0">
            <HeadView friend={mainFriend} size={46} />
            <div
              className="t-num absolute flex items-center justify-center"
              style={{
                bottom: -4, right: -6, minWidth: 21, height: 21, padding: "0 5px",
                borderRadius: 999, background: "var(--acc)", color: "var(--acc-ink)",
                fontSize: 10.5, border: "2.5px solid var(--surface)",
              }}
            >
              {s.level}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2" style={{ marginBottom: 7 }}>
              <span className="t-title-sm clip1">{mainFriend.name}</span>
              <span className="t-num shrink-0" style={{ fontSize: 11, color: "var(--text-mute)" }}>
                {fmt(s.xp)}/{fmt(xpForLevel(s.level))}
              </span>
            </div>
            <Bar pct={levelPct} h={6} />
          </div>
          <svg
            className="shrink-0" width="15" height="15" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2.4"
            strokeLinecap="round" style={{ color: "var(--text-mute)" }}
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </div>
      </Tap>

      {/* Продолжить */}
      {featured && (
        <div style={{ marginBottom: 22 }}>
          <Tap
            onClick={() => onPlay(featured.id)}
            r="xl"
            className="w-full overflow-hidden relative"
            sound="power"
          >
            <div
              className="absolute pointer-events-none"
              style={{ right: 6, bottom: -6, opacity: 0.14, lineHeight: 0 }}
            >
              <GameIcon id={featured.id} size={104} />
            </div>
            <div style={{ padding: 18, position: "relative" }}>
              <div className="t-label acc-text">Продолжить</div>
              <div
                className="t-display-sm"
                style={{ fontSize: 24, marginTop: 6, maxWidth: "72%" }}
              >
                {featured.name}
              </div>
              <div className="t-body clip2" style={{ marginTop: 7, maxWidth: "70%" }}>
                {featured.desc}
              </div>
              <div className="flex items-center" style={{ gap: 12, marginTop: 16 }}>
                <span
                  className="inline-flex items-center"
                  style={{
                    gap: 6, padding: "10px 18px", borderRadius: 999,
                    background: "var(--acc)", color: "var(--acc-ink)",
                    fontSize: 13, fontWeight: 800, lineHeight: 1,
                  }}
                >
                  ▶ Играть
                </span>
                <span className="t-caption">
                  рекорд <span className="t-num" style={{ color: "var(--text-dim)" }}>{fmt(s.games[featured.id].best)}</span>
                </span>
              </div>
            </div>
          </Tap>
        </div>
      )}

      {/* Режимы: марафон и испытание дня */}
      <ModesPanel />

      {/* Казино */}
      {onOpen && (
        <Tap
          onClick={() => onOpen("casino")}
          r="lg"
          className="w-full"
          style={{
            padding: 14, marginBottom: 10,
            border: "1.5px solid rgba(200,155,255,0.42)",
            background: "rgba(200,155,255,0.07)",
          }}
          sound="power"
        >
          <div className="flex items-center" style={{ gap: 12 }}>
            <span
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 40, height: 40, borderRadius: "var(--r-sm)",
                background: "rgba(200,155,255,0.15)", color: "#C89BFF",
              }}
            >
              <Icon name="dice" size={19} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="t-title-sm block">Казино</span>
              <span className="t-caption block" style={{ marginTop: 2 }}>
                Слоты, кейсы, батлы и апгрейд — на жетоны
              </span>
            </span>
            <Icon name="chevron" size={16} />
          </div>
        </Tap>
      )}

      {/* Бонус за рекламу */}
      {hasAds() && adLeft > 0 && (
        <Tap
          onClick={() => setShowAd(true)}
          r="lg"
          className="w-full"
          style={{
            padding: 14, marginBottom: 18,
            border: "1.5px solid rgba(89,255,158,0.45)",
            background: "rgba(89,255,158,0.07)",
          }}
          sound="power"
        >
          <div className="flex items-center" style={{ gap: 12 }}>
            <span
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 40, height: 40, borderRadius: "var(--r-sm)",
                background: "rgba(89,255,158,0.14)", color: "#59FF9E",
              }}
            >
              <Icon name="play" size={19} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="t-title-sm block">Бонус за ролик</span>
              <span className="t-caption block" style={{ marginTop: 2 }}>
                10 секунд — и {fmt(adReward)} монет
              </span>
            </span>
            <span className="t-num shrink-0" style={{ fontSize: 11, color: "var(--text-mute)" }}>
              {adLeft}/5
            </span>
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
              toast({ title: "Награда получена", sub: `+${fmt(adReward)}`, icon: "coin", tone: "gold" });
            }}
            onClose={() => setShowAd(false)}
          />
        )}
      </AnimatePresence>

      {/* Сетка игр */}
      <SectionTitle right={<span className="t-num" style={{ fontSize: 11, color: "var(--text-mute)" }}>{s.unlockedGames.length}/{GAME_META.length}</span>}>
        Все игры
      </SectionTitle>

      <div className="grid grid-cols-2" style={{ gap: 12, marginBottom: 22 }}>
        {GAME_META.map((g, i) => {
          const unlocked = s.unlockedGames.includes(g.id);
          const st = s.games[g.id];
          return (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.26 }}
            >
              <Tap
                onClick={() => unlocked && onPlay(g.id)}
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
                    <span
                      className="t-label"
                      style={{
                        fontSize: 8.5, padding: "3px 7px", borderRadius: 999,
                        background: "var(--btn-bg)", letterSpacing: "0.07em",
                      }}
                    >
                      {g.tag}
                    </span>
                  </div>
                  <div className="t-title-sm clip1">{unlocked ? g.name : "?????"}</div>
                  <div
                    className="t-caption clip2"
                    style={{ marginTop: 4, flex: 1 }}
                  >
                    {unlocked ? g.desc : `Уровень ${g.unlockLvl}`}
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
          );
        })}
      </div>

      {/* Сводка */}
      <SectionTitle>Сводка</SectionTitle>
      <div className="grid grid-cols-3" style={{ gap: 10 }}>
        <Stat v={fmt(s.stats.burgersDodged)} l="уклонов" />
        <Stat v={fmt(s.stats.tapsTotal)} l="тапов" />
        <Stat v={fmt(s.totalCoinsEver)} l="монет всего" />
      </div>

      {/* Поддержать проект */}
      {onOpen && (
        <Tap
          onClick={() => onOpen("donate")}
          r="lg"
          className="w-full"
          style={{
            padding: 14, marginTop: 14,
            border: "1.5px solid rgba(255,176,32,0.4)",
            background: "rgba(255,176,32,0.06)",
          }}
          sound="coin"
        >
          <div className="flex items-center" style={{ gap: 12 }}>
            <span
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 40, height: 40, borderRadius: "var(--r-sm)",
                background: "rgba(255,176,32,0.15)", color: "#FFB020",
              }}
            >
              <Icon name="heart" size={19} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="t-title-sm block">Поддержите проект</span>
              <span className="t-caption block" style={{ marginTop: 2 }}>
                Игра бесплатная — развивается на энтузиазме
              </span>
            </span>
            <Icon name="chevron" size={16} />
          </div>
        </Tap>
      )}
    </Screen>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <Card r="md" className="text-center" style={{ padding: "13px 8px" }}>
      <div className="t-num" style={{ fontSize: 16 }}>{v}</div>
      <div className="t-label" style={{ fontSize: 8.5, marginTop: 3 }}>{l}</div>
    </Card>
  );
}
