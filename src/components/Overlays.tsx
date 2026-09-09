import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "../core/store";
import { Panel, Tap } from "../ui/Glass";
import { fmt, fmtTime } from "../core/format";

export function Toasts() {
  const { toasts } = useGame();
  return (
    <div
      className="fixed left-0 right-0 z-[90] flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{ top: "calc(var(--sat) + 10px)" }}
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: -60, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -30, opacity: 0, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="w-full max-w-xs"
          >
            <Panel
              r="lg" strong
              className="px-3.5 py-2.5 flex items-center gap-3"
              style={{
                border: t.tone === "gold" ? "1px solid var(--acc)" : undefined,
                boxShadow: t.tone === "gold" ? "0 10px 34px -12px var(--acc-glow)" : undefined,
              }}
            >
              {t.icon && <span style={{ fontSize: 20 }}>{t.icon}</span>}
              <div className="flex-1 min-w-0">
                <div className="t-title" style={{ fontSize: 13, color: t.tone === "bad" ? "#ff6a4d" : "var(--text)" }}>
                  {t.title}
                </div>
                {t.sub && <div style={{ fontSize: 10.5, color: "var(--text-mute)" }}>{t.sub}</div>}
              </div>
            </Panel>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function OfflineModal() {
  const { offlineReport, clearOffline, mainFriend } = useGame();
  return (
    <AnimatePresence>
      {offlineReport && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] flex items-center justify-center px-6"
          style={{ background: "rgba(3,3,5,0.8)", backdropFilter: "blur(18px)" }}
          onClick={clearOffline}
        >
          <motion.div
            initial={{ scale: 0.8, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="w-full max-w-xs"
          >
            <Panel r="xl" strong className="p-6 text-center">
              <div style={{ fontSize: 44 }}>🧊</div>
              <div className="t-display mt-2" style={{ fontSize: 22 }}>ПОКА ТЕБЯ НЕ БЫЛО</div>
              <div style={{ fontSize: 11.5, color: "var(--text-mute)", marginTop: 6, lineHeight: 1.5 }}>
                {mainFriend.name} жрал {fmtTime(offlineReport.hours * 3600000)} и накопил
              </div>
              <div className="t-num acc-text my-4" style={{ fontSize: 40, textShadow: "0 0 30px var(--acc-glow)" }}>
                +{fmt(offlineReport.coins)}
              </div>
              <div className="t-label" style={{ marginTop: -8, marginBottom: 16 }}>CHUBCOINS</div>
              <Tap onClick={clearOffline} accent r="md" className="w-full py-3.5 t-title" style={{ fontSize: 14 }} sound="coin">
                ЗАБРАТЬ
              </Tap>
              <div className="t-label mt-3" style={{ fontSize: 8, lineHeight: 1.5 }}>
                Качай «Холодильник» в CHUBCLICKER, чтобы копить дольше
              </div>
            </Panel>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
