import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "./Icon";
import { tr } from "../core/i18n";
import { sfx, haptic } from "../core/fx";
import {
  readFriendship, friendProgress, friendBonus, FR_MAX,
  STORY_TIERS, storyFor, unlockedStories,
} from "../core/friendship";

/**
 * ДРУЖБА С ГЛАВНЫМ ДРУГОМ.
 *
 * Показывает уровень, прибавку к монетам и истории, которые друг
 * открывает на 3, 5 и 10 уровне. Раньше выбор главного друга влиял
 * только на картинку — теперь за ним стоит прогресс.
 */
export default function FriendshipCard({
  friendId, name,
}: {
  friendId: string;
  name: string;
}) {
  const st = readFriendship();
  const fp = st.fp[friendId] || 0;
  const p = friendProgress(fp);
  const opened = unlockedStories(p.lvl);
  const [show, setShow] = useState<number | null>(null);

  return (
    <div
      style={{
        marginTop: 14, padding: 12, borderRadius: "var(--r-md)",
        background: "var(--surface-2)",
        border: "1px solid var(--surface-brd)",
      }}
    >
      <div className="flex items-center" style={{ gap: 8, marginBottom: 9 }}>
        <span style={{ color: "var(--danger)", lineHeight: 0 }}>
          <Icon name="heart" size={14} />
        </span>
        <span className="t-label flex-1" style={{ fontSize: 9 }}>
          {tr("ДРУЖБА")}
        </span>
        <span
          className="t-num"
          style={{ fontSize: 12, color: p.lvl > 0 ? "var(--gold)" : "var(--text-mute)" }}
        >
          {p.lvl} / {FR_MAX}
        </span>
      </div>

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
            background: p.lvl >= FR_MAX ? "var(--gold)" : "var(--danger)",
          }}
        />
      </div>

      <div className="t-caption" style={{ marginTop: 6, fontSize: 9.5 }}>
        {p.lvl >= FR_MAX
          ? tr("Лучшие друзья навсегда")
          : `${p.have} / ${p.need} ${tr("до следующего уровня")}`}
        {p.lvl > 0 && (
          <span style={{ color: "var(--gold)" }}>
            {" · "}+{Math.round((friendBonus(fp) - 1) * 100)}% {tr("монет")}
          </span>
        )}
      </div>

      {/* Истории: открываются на 3, 5 и 10 уровне */}
      <div className="flex items-center" style={{ gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        <span className="t-label" style={{ fontSize: 7.5, color: "var(--text-mute)" }}>
          {tr("ИСТОРИИ")}
        </span>
        {STORY_TIERS.map((tier, i) => {
          const open = i < opened;
          return (
            <button
              key={tier}
              type="button"
              onClick={() => {
                if (!open) return;
                sfx.click();
                haptic("light");
                setShow(show === i ? null : i);
              }}
              className="t-label"
              style={{
                padding: "4px 9px", fontSize: 8.5, borderRadius: 999,
                background: open ? "var(--btn-bg)" : "var(--surface-3)",
                border: `1px solid ${open ? "var(--btn-brd)" : "var(--surface-brd)"}`,
                color: open ? "var(--text)" : "var(--text-mute)",
                opacity: open ? 1 : 0.6,
                cursor: open ? "pointer" : "default",
              }}
            >
              {open ? `${tr("ИСТОРИЯ")} ${i + 1}` : `${tr("УР")} ${tier}`}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {show !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="t-body"
              style={{
                marginTop: 10, padding: "11px 13px", borderRadius: "var(--r-md)",
                background: "var(--surface)",
                border: "1px solid var(--surface-brd)",
                fontStyle: "italic", lineHeight: 1.5, fontSize: 12.5,
              }}
            >
              «{storyFor(friendId, show)}»
              <div
                className="t-caption"
                style={{ marginTop: 7, fontStyle: "normal", fontSize: 9.5 }}
              >
                — {name}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
