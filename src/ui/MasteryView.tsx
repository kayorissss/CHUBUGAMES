import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Panel, Chip } from "./Glass";
import Icon from "./Icon";
import GameIcon from "./GameIcon";
import { useGame } from "../core/store";
import { GAME_META } from "../core/content";
import { tr } from "../core/i18n";
import { fmt } from "../core/format";
import {
  MX_MAX, masteryLevel, masteryProgress, masteryBonus, weekSummary,
} from "../core/mastery";
import type { GameId } from "../core/types";

/**
 * МАСТЕРСТВО И РЕКОРДЫ.
 *
 * Раньше о своих результатах можно было узнать только цифрой «рекорд»
 * в карточке игры. Здесь всё вместе: уровень мастерства по каждой игре,
 * когда поставлен рекорд, последние результаты и итоги недели.
 */

function when(ts?: number) {
  if (!ts) return "—";
  const d = new Date(ts);
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days === 0) return tr("сегодня");
  if (days === 1) return tr("вчера");
  if (days < 7) return `${days} ${tr("дн. назад")}`;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** Полоска прогресса мастерства */
function MxBar({ mx }: { mx: number }) {
  const p = masteryProgress(mx);
  const full = p.lvl >= MX_MAX;
  return (
    <div>
      <div
        style={{
          height: 6, borderRadius: 99, overflow: "hidden",
          background: "var(--surface-3)",
        }}
      >
        <motion.div
          animate={{ width: `${Math.round(p.frac * 100)}%` }}
          transition={{ duration: 0.35 }}
          style={{
            height: "100%",
            background: full ? "var(--gold)" : "var(--acc)",
          }}
        />
      </div>
      <div className="t-caption" style={{ marginTop: 4, fontSize: 9.5 }}>
        {full
          ? tr("Максимальное мастерство")
          : `${p.have} / ${p.need} ${tr("до следующего уровня")}`}
      </div>
    </div>
  );
}

export default function MasteryView() {
  const { s } = useGame();
  const [sort, setSort] = useState<"mx" | "plays" | "recent">("mx");

  const rows = useMemo(() => {
    const list = GAME_META.map((m) => {
      const st = s.games[m.id as GameId] || ({} as any);
      return {
        id: m.id as GameId,
        name: m.name,
        best: st.best || 0,
        bestAt: st.bestAt,
        plays: st.plays || 0,
        mx: st.mx || 0,
        lvl: masteryLevel(st.mx || 0),
        recent: st.recent || [],
        last: st.recent?.[0]?.t || 0,
      };
    });
    if (sort === "mx") list.sort((a, b) => b.mx - a.mx || b.plays - a.plays);
    if (sort === "plays") list.sort((a, b) => b.plays - a.plays);
    if (sort === "recent") list.sort((a, b) => b.last - a.last);
    return list;
  }, [s.games, sort]);

  const week = useMemo(() => weekSummary(s), [s]);

  const totalLvl = rows.reduce((a, b) => a + b.lvl, 0);
  const maxLvl = rows.length * MX_MAX;

  return (
    <>
      {/* ИТОГИ НЕДЕЛИ — повод возвращаться, «как итоги года, только чаще» */}
      <Panel r="xl" strong style={{ padding: 15, marginBottom: 10 }}>
        <div className="flex items-center" style={{ gap: 9, marginBottom: 11 }}>
          <span style={{ color: "var(--acc)", lineHeight: 0 }}>
            <Icon name="chart" size={16} />
          </span>
          <span className="t-title-sm flex-1">{tr("Твоя неделя")}</span>
        </div>

        {week.runs === 0 ? (
          <div className="t-caption">{tr("На этой неделе ты ещё не играл. Самое время.")}</div>
        ) : (
          <>
            <div className="flex" style={{ gap: 8 }}>
              {[
                { k: tr("ЗАБЕГОВ"), v: fmt(week.runs) },
                { k: tr("ОЧКОВ"), v: fmt(week.scoreSum) },
                { k: tr("РЕКОРДОВ"), v: String(week.records) },
                { k: tr("ИГР"), v: String(week.games) },
              ].map((c) => (
                <span
                  key={c.k}
                  className="flex-1 text-center"
                  style={{
                    padding: "9px 4px", borderRadius: "var(--r-md)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--surface-brd)",
                  }}
                >
                  <span className="t-num block" style={{ fontSize: 15 }}>{c.v}</span>
                  <span className="t-label block" style={{ fontSize: 7.5, marginTop: 2 }}>{c.k}</span>
                </span>
              ))}
            </div>

            {week.top.length > 0 && (
              <div className="t-caption" style={{ marginTop: 10, lineHeight: 1.5 }}>
                {tr("Больше всего гонял")}:{" "}
                {week.top.map((t, i) => (
                  <span key={t.id}>
                    {i > 0 && ", "}
                    <b style={{ color: "var(--text)" }}>
                      {GAME_META.find((m) => m.id === t.id)?.name || t.id}
                    </b>{" "}
                    ({t.runs})
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </Panel>

      {/* Общий прогресс мастерства */}
      <Panel r="lg" style={{ padding: 13, marginBottom: 10 }}>
        <div className="flex items-center" style={{ gap: 9, marginBottom: 8 }}>
          <span className="t-title-sm flex-1">{tr("Общее мастерство")}</span>
          <span className="t-num" style={{ fontSize: 13, color: "var(--gold)" }}>
            {totalLvl} / {maxLvl}
          </span>
        </div>
        <div
          style={{
            height: 6, borderRadius: 99, overflow: "hidden",
            background: "var(--surface-3)",
          }}
        >
          <motion.div
            animate={{ width: `${(totalLvl / maxLvl) * 100}%` }}
            transition={{ duration: 0.4 }}
            style={{ height: "100%", background: "var(--gold)" }}
          />
        </div>
      </Panel>

      {/* Сортировка */}
      <div className="flex" style={{ gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
        <Chip active={sort === "mx"} onClick={() => setSort("mx")}>{tr("По мастерству")}</Chip>
        <Chip active={sort === "plays"} onClick={() => setSort("plays")}>{tr("По забегам")}</Chip>
        <Chip active={sort === "recent"} onClick={() => setSort("recent")}>{tr("Недавние")}</Chip>
      </div>

      {/* Таблица по играм */}
      {rows.map((r) => (
        <Panel key={r.id} r="lg" style={{ padding: 12, marginBottom: 8 }}>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 9 }}>
            <span
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 34, height: 34, borderRadius: "var(--r-sm)",
                background: "var(--surface-2)",
                border: "1px solid var(--surface-brd)",
              }}
            >
              <GameIcon id={r.id} size={18} />
            </span>

            <span className="flex-1 min-w-0">
              <span className="t-title-sm clip1 block">{r.name}</span>
              <span className="t-caption clip1 block" style={{ marginTop: 2, fontSize: 9.5 }}>
                {r.plays > 0
                  ? `${tr("рекорд")} ${fmt(r.best)} · ${when(r.bestAt)}`
                  : tr("ещё не играл")}
              </span>
            </span>

            {/* Уровень мастерства */}
            <span
              className="shrink-0 text-center"
              style={{
                minWidth: 42, padding: "5px 7px", borderRadius: "var(--r-sm)",
                background: r.lvl > 0 ? "var(--gold-soft)" : "var(--surface-2)",
                border: `1px solid ${r.lvl > 0 ? "var(--gold-brd)" : "var(--surface-brd)"}`,
              }}
            >
              <span
                className="t-num block"
                style={{ fontSize: 14, color: r.lvl > 0 ? "var(--gold)" : "var(--text-mute)" }}
              >
                {r.lvl}
              </span>
              <span className="t-label block" style={{ fontSize: 6.5, marginTop: 1 }}>
                {tr("МАСТ")}
              </span>
            </span>
          </div>

          {r.plays > 0 && (
            <>
              <MxBar mx={r.mx} />

              {/* Последние результаты */}
              {r.recent.length > 0 && (
                <div className="flex items-center" style={{ gap: 5, marginTop: 9, flexWrap: "wrap" }}>
                  <span className="t-label" style={{ fontSize: 7.5, color: "var(--text-mute)" }}>
                    {tr("ПОСЛЕДНИЕ")}
                  </span>
                  {r.recent.map((x: { s: number; t: number }, i: number) => (
                    <span
                      key={i}
                      className="t-num"
                      style={{
                        fontSize: 10, padding: "2px 6px", borderRadius: 99,
                        background: x.s >= r.best && r.best > 0 ? "var(--gold-soft)" : "var(--surface-2)",
                        color: x.s >= r.best && r.best > 0 ? "var(--gold)" : "var(--text-dim)",
                        border: "1px solid var(--surface-brd)",
                      }}
                    >
                      {fmt(x.s)}
                    </span>
                  ))}
                </div>
              )}

              {r.lvl > 0 && (
                <div className="t-caption" style={{ marginTop: 7, fontSize: 9.5, color: "var(--gold)" }}>
                  +{Math.round((masteryBonus(r.mx) - 1) * 100)}% {tr("монет в этой игре")}
                </div>
              )}
            </>
          )}
        </Panel>
      ))}
    </>
  );
}
