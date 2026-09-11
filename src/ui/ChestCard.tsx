import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Panel, Tap } from "./Glass";
import Icon from "./Icon";
import { useGame } from "../core/store";
import { tr } from "../core/i18n";
import { fmt } from "../core/format";
import { sfx, haptic } from "../core/fx";
import { readGamble, writeGamble } from "../core/gamble";
import {
  readFriendship, writeFriendship, chestLeft, chestReady, chestReward, CHEST_MS,
} from "../core/friendship";

/**
 * ЕЖЕЧАСНЫЙ СУНДУК.
 *
 * Повод заглянуть между парами: раз в час копится небольшая награда.
 * Специально сделан слабее одного забега — он дополняет игру, а не
 * заменяет её (расчёт в friendship.ts).
 */

function mmss(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ChestCard() {
  const { s, addCoins, toast } = useGame();
  const [st, setSt] = useState(() => readFriendship());
  const [, tick] = useState(0);
  const [burst, setBurst] = useState(false);

  // ежесекундно пересчитываем таймер
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const ready = chestReady(st);
  const left = chestLeft(st);
  const rw = chestReward(s.level, st.chestCount);

  const take = () => {
    if (!ready) return;
    const next = { ...st, chestAt: Date.now(), chestCount: st.chestCount + 1 };
    writeFriendship(next);
    setSt(next);

    addCoins(rw.coins);
    const g = readGamble();
    writeGamble({ ...g, chips: g.chips + rw.chips });

    setBurst(true);
    setTimeout(() => setBurst(false), 900);
    sfx.coin?.();
    haptic("success");
    toast({
      title: tr("СУНДУК ОТКРЫТ"),
      sub: `+${fmt(rw.coins)} ${tr("и")} ${rw.chips} ${tr("жетонов")}`,
      icon: "case",
      tone: "gold",
    });
  };

  const frac = 1 - left / CHEST_MS;

  return (
    <Panel
      r="lg"
      style={{
        padding: 13,
        marginBottom: 10,
        position: "relative",
        overflow: "hidden",
        border: ready ? "1px solid var(--gold-brd)" : undefined,
        background: ready ? "var(--gold-soft)" : undefined,
      }}
    >
      {/* вспышка при открытии */}
      <AnimatePresence>
        {burst && (
          <motion.div
            initial={{ opacity: 0.85, scale: 0.6 }}
            animate={{ opacity: 0, scale: 2.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            className="absolute pointer-events-none"
            style={{
              inset: 0,
              background: "radial-gradient(circle at 22% 50%, var(--gold), transparent 62%)",
            }}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center" style={{ gap: 11, position: "relative" }}>
        <motion.span
          animate={ready ? { rotate: [0, -7, 7, -4, 0], scale: [1, 1.06, 1] } : {}}
          transition={{ duration: 1.1, repeat: ready ? Infinity : 0, repeatDelay: 1.6 }}
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 40, height: 40, borderRadius: "var(--r-sm)",
            background: ready ? "var(--gold)" : "var(--surface-2)",
            border: `1px solid ${ready ? "var(--gold)" : "var(--surface-brd)"}`,
            color: ready ? "var(--acc-ink)" : "var(--text-mute)",
          }}
        >
          <Icon name="case" size={20} />
        </motion.span>

        <span className="flex-1 min-w-0">
          <span className="t-title-sm clip1 block">{tr("Ежечасный сундук")}</span>
          <span className="t-caption clip1 block" style={{ marginTop: 2, fontSize: 9.5 }}>
            {ready
              ? `+${fmt(rw.coins)} ${tr("и")} ${rw.chips} ${tr("жетонов")}`
              : `${tr("будет через")} ${mmss(left)}`}
          </span>

          {!ready && (
            <span
              className="block"
              style={{
                height: 4, borderRadius: 99, marginTop: 6,
                background: "var(--surface-3)", overflow: "hidden",
              }}
            >
              <span
                className="block"
                style={{
                  height: "100%",
                  width: `${Math.round(frac * 100)}%`,
                  background: "var(--acc)",
                }}
              />
            </span>
          )}
        </span>

        <Tap
          onClick={take}
          disabled={!ready}
          accent={ready}
          r="sm"
          center
          className="t-label shrink-0"
          style={{
            padding: "11px 15px", fontSize: 9.5,
            opacity: ready ? 1 : 0.45,
          }}
          sound="none"
        >
          {ready ? tr("ЗАБРАТЬ") : tr("ЖДЁМ")}
        </Tap>
      </div>
    </Panel>
  );
}
