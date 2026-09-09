import { motion } from "framer-motion";
import { sfx, haptic } from "../core/fx";

export type Tab = "home" | "progress" | "shop" | "friends" | "settings";

const TABS: { id: Tab; label: string; icon: (a: boolean) => React.ReactNode }[] = [
  {
    id: "home", label: "Игры",
    icon: (a) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="5" />
        <path d="M7 12h2M8 11v2M16 11.5h.01M14 13.5h.01" stroke={a ? "var(--acc-ink)" : "currentColor"} strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "progress", label: "Прогресс",
    icon: (a) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M6 3h12v5a6 6 0 01-12 0z" />
        <path d="M6 5H3v2a4 4 0 004 4M18 5h3v2a4 4 0 01-4 4M9 21h6M12 14v7" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  {
    id: "shop", label: "Магазин",
    icon: (a) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M3 8h18l-1.5 12H4.5z" />
        <path d="M8 8V6a4 4 0 018 0v2" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "friends", label: "Друзья",
    icon: (a) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <circle cx="9" cy="8" r="4" />
        <path d="M2 20a7 7 0 0114 0" />
        <path d="M16 4.5a4 4 0 010 7M18 20a7 7 0 00-2-4.9" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "settings", label: "Ещё",
    icon: (a) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill={a ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.6 1.6 0 007 19.4a1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H1a2 2 0 110-4h.1A1.6 1.6 0 002.6 9a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H7a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" fill="none" />
      </svg>
    ),
  },
];

export default function Nav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <div
      className="fixed left-0 right-0 z-50 px-3"
      style={{ bottom: "calc(var(--sab) + 10px)" }}
    >
      <div
        className="glass glass-strong flex items-center justify-around relative"
        style={{ borderRadius: 26, padding: "7px 5px" }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                if (active) return;
                sfx.click();
                haptic("light");
                onTab(t.id);
              }}
              className="relative flex flex-col items-center justify-center flex-1 py-1.5"
              style={{ color: active ? "var(--acc-ink)" : "var(--text-mute)", zIndex: 2 }}
            >
              {active && (
                <motion.div
                  layoutId="navpill"
                  transition={{ type: "spring", stiffness: 520, damping: 36 }}
                  className="absolute"
                  style={{
                    inset: "-1px 4px", borderRadius: 20, background: "var(--acc)",
                    boxShadow: "0 6px 20px -6px var(--acc-glow)", zIndex: -1,
                  }}
                />
              )}
              <motion.div animate={{ scale: active ? 1.06 : 1, y: active ? -1 : 0 }}>
                {t.icon(active)}
              </motion.div>
              <span
                style={{
                  fontSize: 8.5, fontWeight: 800, letterSpacing: "0.06em",
                  marginTop: 2.5, textTransform: "uppercase",
                }}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
