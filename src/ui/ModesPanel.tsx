import { motion } from "framer-motion";
import { tr } from "../core/i18n";
import { useGame } from "../core/store";
import { useModes, MARATHON_ROUNDS } from "../core/modes";
import { GAME_META } from "../core/content";
import { fmt } from "../core/format";
import { Panel, Tap, SectionTitle } from "../ui/Glass";
import GameIcon from "./GameIcon";
import Icon from "./Icon";

/**
 * Блок «Режимы» на главной: марафон и испытание дня.
 * Обычные заходы в игры остаются как были — это надстройка.
 */
export default function ModesPanel() {
  const { s, set, addCoins, toast } = useGame();
  const modes = useModes();
  if (!modes) return null;

  const { challenge, challengeDone, challengeClaimed, challengeStreak, store } = modes;
  const meta = GAME_META.find((g) => g.id === challenge.game);
  const bestNow = s.games[challenge.game]?.best ?? 0;
  const pct = Math.min(1, bestNow / challenge.target);

  return (
    <>
      <SectionTitle
        right={
          store.marathonBest > 0 ? (
            <span className="t-num" style={{ fontSize: 11, color: "var(--text-mute)" }}>
              рекорд {fmt(store.marathonBest)}
            </span>
          ) : undefined
        }
      >{tr("Режимы")}</SectionTitle>

      <div style={{ marginBottom: 22 }}>
        {/* ── Марафон ── */}
        <Tap
          onClick={() => modes.startMarathon()}
          r="lg"
          className="w-full"
          style={{
            padding: 14,
            marginBottom: 10,
            border: "1.5px solid var(--btn-brd)",
          }}
          sound="power"
        >
          <div className="flex items-center" style={{ gap: 12 }}>
            <span
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 42,
                height: 42,
                borderRadius: "var(--r-sm)",
                background: "var(--acc)",
                color: "var(--acc-ink)",
              }}
            >
              <Icon name="run" size={20} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="t-title-sm block">{tr("Марафон")}</span>
              <span className="t-caption block" style={{ marginTop: 2 }}>
                {MARATHON_ROUNDS} случайных игр подряд, очки суммируются
              </span>
            </span>
            <Icon name="chevron" size={16} />
          </div>
        </Tap>

        {/* ── Выживание ── */}
        <Tap
          onClick={() => modes.startSurvival()}
          r="lg"
          className="w-full"
          style={{
            padding: 14,
            marginBottom: 10,
            border: "1.5px solid var(--danger-brd)",
          }}
          sound="power"
        >
          <div className="flex items-center" style={{ gap: 12 }}>
            <span
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 42, height: 42, borderRadius: "var(--r-sm)",
                background: "var(--danger-soft)", color: "var(--danger)",
              }}
            >
              <Icon name="shield" size={20} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="t-title-sm block">{tr("Выживание")}</span>
              <span className="t-caption block" style={{ marginTop: 2 }}>
                {tr("Игры подряд без провала. Забрать можно в любой момент")}
              </span>
            </span>
            {store.survivalBest > 0 && (
              <span className="t-num shrink-0" style={{ fontSize: 11, color: "var(--text-mute)" }}>
                {store.survivalBest}
              </span>
            )}
            <Icon name="chevron" size={16} />
          </div>
        </Tap>

        {/* ── Спринт ── */}
        <Tap
          onClick={() => {
            const pool = GAME_META.filter((g) => s.unlockedGames.includes(g.id));
            const pick = pool[Math.floor(Math.random() * pool.length)];
            modes.startSprint(pick.id);
          }}
          r="lg"
          className="w-full"
          style={{
            padding: 14,
            marginBottom: 10,
            border: "1.5px solid rgba(95,168,255,0.35)",
          }}
          sound="power"
        >
          <div className="flex items-center" style={{ gap: 12 }}>
            <span
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 42, height: 42, borderRadius: "var(--r-sm)",
                background: "var(--info-soft)", color: "var(--info)",
              }}
            >
              <Icon name="bolt" size={20} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="t-title-sm block">{tr("Спринт")}</span>
              <span className="t-caption block" style={{ marginTop: 2 }}>
                {tr("Две минуты в одной игре — выбей максимум")}
              </span>
            </span>
            {store.sprintBest > 0 && (
              <span className="t-num shrink-0" style={{ fontSize: 11, color: "var(--text-mute)" }}>
                {fmt(store.sprintBest)}
              </span>
            )}
            <Icon name="chevron" size={16} />
          </div>
        </Tap>

        {/* ── Испытание дня ── */}
        <Panel
          r="lg"
          style={{
            padding: 14,
            border: challengeDone
              ? "1.5px solid var(--ok-brd)"
              : "1.5px solid var(--btn-brd)",
            background: challengeDone ? "var(--ok-soft)" : undefined,
          }}
        >
          <div className="flex items-center" style={{ gap: 12, marginBottom: 12 }}>
            <span
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 42,
                height: 42,
                borderRadius: "var(--r-sm)",
                background: "var(--surface-2)",
              }}
            >
              {meta ? <GameIcon id={challenge.game} size={22} /> : <Icon name="target" size={20} />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="t-title-sm block">{tr("Испытание дня")}</span>
              <span className="t-caption block" style={{ marginTop: 2 }}>
                {meta?.name ?? challenge.game} — {fmt(challenge.target)} очков
              </span>
            </span>
            {challengeStreak > 0 && (
              <span
                className="t-num shrink-0 inline-flex items-center"
                style={{ fontSize: 11, gap: 4, color: "var(--text-mute)" }}
              >
                <Icon name="fire" size={13} />
                {challengeStreak}
              </span>
            )}
          </div>

          {/* Прогресс по личному рекорду в этой игре */}
          <div
            style={{
              height: 6,
              borderRadius: 99,
              background: "var(--surface-3)",
              overflow: "hidden",
              marginBottom: 10,
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{
                height: "100%",
                background: challengeDone ? "var(--ok)" : "var(--acc)",
              }}
            />
          </div>

          <div className="flex items-center" style={{ gap: 10 }}>
            <span
              className="t-num flex-1 inline-flex items-center"
              style={{ fontSize: 12, gap: 6, color: "var(--text-mute)" }}
            >
              <Icon name="coin" size={13} /> {fmt(challenge.reward)}
              <Icon name="gem" size={13} /> {challenge.gems}
            </span>

            {challengeClaimed ? (
              <span
                className="t-label inline-flex items-center shrink-0"
                style={{ gap: 6, fontSize: 10, color: "var(--ok)" }}
              >
                <Icon name="check" size={13} />{tr("ЗАБРАНО")}</span>
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
                accent
                r="sm"
                center
                className="shrink-0 t-title"
                style={{ fontSize: 12, padding: "9px 18px" }}
                sound="coin"
              >{tr("ЗАБРАТЬ")}</Tap>
            ) : (
              <span
                className="t-label shrink-0"
                style={{ fontSize: 10, color: "var(--text-mute)" }}
              >
                {Math.round(pct * 100)}%
              </span>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
