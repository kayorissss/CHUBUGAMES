import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { tr } from "../core/i18n";
import { useGame } from "../core/store";
import { useModes, MARATHON_ROUNDS } from "../core/modes";
import { GAME_META } from "../core/content";
import { fmt } from "../core/format";
import { Panel, Tap } from "../ui/Glass";
import GameIcon from "./GameIcon";
import Icon from "./Icon";
import type { IconName } from "./Icon";

/**
 * РЕЖИМЫ: марафон, выживание, спринт и испытание дня.
 *
 * Прошлая версия была перегружена: четыре длинных плашки во всю ширину,
 * каждая с иконкой, описанием и рекордом — экран превращался в стену
 * текста, и было непонятно, что вообще выбирать.
 *
 * Здесь режимы сжаты в сетку 3 в ряд: название, рекорд и одна короткая
 * подпись. Подробности открываются по тапу на «?» — кто хочет, прочтёт,
 * остальным они не мешают.
 */

interface ModeDef {
  id: "marathon" | "survival" | "sprint";
  name: string;
  short: string;
  full: string;
  icon: IconName;
  color: string;
  soft: string;
}

const MODES: ModeDef[] = [
  {
    id: "marathon",
    name: "Марафон",
    short: `${MARATHON_ROUNDS} игр подряд`,
    full: `Пять случайных игр одна за другой. Очки складываются, выход в меню засчитывается как сдался.`,
    icon: "run",
    color: "var(--acc)",
    soft: "var(--acc-soft)",
  },
  {
    id: "survival",
    name: "Выживание",
    short: "До первого провала",
    full: "Игры идут подряд, но любой провал заканчивает забег. Чем дальше зашёл, тем жирнее множитель награды. Забрать можно в любой момент.",
    icon: "shield",
    color: "var(--danger)",
    soft: "var(--danger-soft)",
  },
  {
    id: "sprint",
    name: "Спринт",
    short: "2 минуты, одна игра",
    full: "Две минуты в случайной игре. Задача простая: выбить максимум очков за отведённое время.",
    icon: "bolt",
    color: "var(--info)",
    soft: "var(--info-soft)",
  },
];

export default function ModesPanel() {
  const { s, set, addCoins, toast } = useGame();
  const modes = useModes();
  const [info, setInfo] = useState<string | null>(null);

  if (!modes) return null;

  const { challenge, challengeDone, challengeClaimed, challengeStreak, store } = modes;
  const meta = GAME_META.find((g) => g.id === challenge.game);
  const bestNow = s.games[challenge.game]?.best ?? 0;
  const pct = Math.min(1, bestNow / challenge.target);

  const bestOf = (id: ModeDef["id"]) =>
    id === "marathon" ? store.marathonBest
      : id === "survival" ? store.survivalBest
        : store.sprintBest;

  const start = (id: ModeDef["id"]) => {
    if (id === "marathon") modes.startMarathon();
    else if (id === "survival") modes.startSurvival();
    else {
      const pool = GAME_META.filter((g) => s.unlockedGames.includes(g.id));
      const pick = pool[Math.floor(Math.random() * pool.length)];
      modes.startSprint(pick.id);
    }
  };

  return (
    <>
      {/* ИСПЫТАНИЕ ДНЯ — главное, что стоит сделать сегодня, поэтому сверху */}
      <Panel
        r="lg"
        style={{
          padding: 13, marginBottom: 10,
          border: challengeDone ? "1.5px solid var(--ok-brd)" : "1px solid var(--surface-brd)",
          background: challengeDone ? "var(--ok-soft)" : undefined,
        }}
      >
        <div className="flex items-center" style={{ gap: 10, marginBottom: 10 }}>
          <span
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 36, height: 36, borderRadius: "var(--r-sm)",
              background: "var(--surface-2)",
              border: "1px solid var(--surface-brd)",
            }}
          >
            {meta ? <GameIcon id={challenge.game} size={19} /> : <Icon name="target" size={17} />}
          </span>

          <span className="flex-1 min-w-0">
            <span className="t-title-sm clip1 block">{tr("Испытание дня")}</span>
            <span className="t-caption clip1 block" style={{ marginTop: 2, fontSize: 10 }}>
              {tr(meta?.name ?? challenge.game)} · {fmt(challenge.target)} {tr("очков")}
            </span>
          </span>

          {challengeStreak > 0 && (
            <span
              className="t-num shrink-0 inline-flex items-center"
              style={{ fontSize: 11, gap: 3, color: "var(--gold)" }}
            >
              <Icon name="fire" size={12} />{challengeStreak}
            </span>
          )}
        </div>

        <div
          style={{
            height: 5, borderRadius: 99, background: "var(--surface-3)",
            overflow: "hidden", marginBottom: 9,
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{ height: "100%", background: challengeDone ? "var(--ok)" : "var(--acc)" }}
          />
        </div>

        <div className="flex items-center" style={{ gap: 9 }}>
          <span
            className="t-num flex-1 inline-flex items-center"
            style={{ fontSize: 11, gap: 5, color: "var(--text-mute)" }}
          >
            <Icon name="coin" size={12} /> {fmt(challenge.reward)}
            <Icon name="gem" size={12} /> {challenge.gems}
          </span>

          {challengeClaimed ? (
            <span
              className="t-label inline-flex items-center shrink-0"
              style={{ gap: 5, fontSize: 9.5, color: "var(--ok)" }}
            >
              <Icon name="check" size={12} />{tr("ЗАБРАНО")}
            </span>
          ) : challengeDone ? (
            <Tap
              onClick={() => {
                modes.claimChallenge();
                addCoins(challenge.reward);
                set((d) => { d.gems += challenge.gems; });
                toast({
                  title: tr("Испытание пройдено"),
                  sub: `+${fmt(challenge.reward)}`,
                  icon: "trophy",
                  tone: "gold",
                });
              }}
              accent r="sm" center
              className="shrink-0 t-title"
              style={{ fontSize: 11, padding: "8px 16px" }}
              sound="coin"
            >{tr("ЗАБРАТЬ")}</Tap>
          ) : (
            <span className="t-label shrink-0" style={{ fontSize: 9.5, color: "var(--text-mute)" }}>
              {Math.round(pct * 100)}%
            </span>
          )}
        </div>
      </Panel>

      {/* Три режима компактной сеткой вместо четырёх плашек во всю ширину */}
      <div className="grid grid-cols-3" style={{ gap: 8, marginBottom: 8 }}>
        {MODES.map((m) => {
          const rec = bestOf(m.id);
          return (
            <Tap
              key={m.id}
              onClick={() => start(m.id)}
              r="lg"
              className="w-full h-full"
              style={{ padding: 0, display: "block", border: `1px solid ${m.color}` }}
              sound="power"
            >
              <span className="flex flex-col items-center" style={{ padding: "13px 7px", gap: 6 }}>
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: 34, height: 34, borderRadius: "var(--r-sm)",
                    background: m.soft, color: m.color,
                  }}
                >
                  <Icon name={m.icon} size={17} />
                </span>
                <span className="t-title-sm block text-center" style={{ fontSize: 11.5 }}>
                  {tr(m.name)}
                </span>
                <span
                  className="t-caption block text-center clip2"
                  style={{ fontSize: 8.5, lineHeight: 1.3, minHeight: 22 }}
                >
                  {tr(m.short)}
                </span>
                {rec > 0 && (
                  <span
                    className="t-num block"
                    style={{ fontSize: 10, color: "var(--gold)" }}
                  >
                    {fmt(rec)}
                  </span>
                )}
              </span>
            </Tap>
          );
        })}
      </div>

      {/* Что это за режимы — по запросу, чтобы не занимать экран постоянно */}
      <button
        type="button"
        onClick={() => setInfo(info ? null : "all")}
        className="t-caption flex items-center w-full"
        style={{
          gap: 6, padding: "8px 11px", marginBottom: 18,
          borderRadius: "var(--r-sm)",
          background: "var(--surface-2)",
          border: "1px solid var(--surface-brd)",
          fontSize: 10,
        }}
      >
        <Icon name="info" size={12} />
        <span className="flex-1 text-left">{tr("Чем отличаются режимы")}</span>
        <span style={{ transform: info ? "rotate(90deg)" : "none", lineHeight: 0 }}>
          <Icon name="chevron" size={12} />
        </span>
      </button>

      <AnimatePresence>
        {info && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden", marginTop: -12, marginBottom: 18 }}
          >
            {MODES.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: "10px 12px", marginBottom: 6,
                  borderRadius: "var(--r-sm)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--surface-brd)",
                }}
              >
                <div className="flex items-center" style={{ gap: 7, marginBottom: 4 }}>
                  <span style={{ color: m.color, lineHeight: 0 }}>
                    <Icon name={m.icon} size={13} />
                  </span>
                  <span className="t-title-sm" style={{ fontSize: 11.5 }}>{tr(m.name)}</span>
                </div>
                <div className="t-caption" style={{ fontSize: 10, lineHeight: 1.45 }}>
                  {tr(m.full)}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
