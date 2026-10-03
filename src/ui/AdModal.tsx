import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { pickClip, AD_SKIP_AFTER, AD_FALLBACK_LEN } from "../core/ads";
import { sfx, haptic } from "../core/fx";
import { tr } from "../core/i18n";
import { pcApi } from "../core/desktop";
import Icon from "./Icon";
import { useSystemBack } from "../core/android";

/**
 * МОДАЛЬНОЕ ОКНО СПОНСОРСКОГО ТРАНСЛЯТОРА (AdModal).
 *
 * Полностью переработано: вместо глухого чёрного экрана на весь монитор —
 * стильное кибер-окно трансляции с неоновой рамкой, статус-баром, плавной
 * шкалой прогресса, индикатором награды и аккуратным плеером по центру.
 */
export default function AdModal({
  open = true,
  reason,
  onReward,
  onClose,
}: {
  open?: boolean;
  reason: string;
  onReward: () => void;
  onClose: () => void;
}) {
  const ad = useMemo(
    () =>
      pickClip() || {
        id: "fallback",
        src: "ads/promo1.mp4",
        link: "https://t.me/kayorisan",
        label: "СПОНСОРСКИЙ КОНТРАКТ",
      },
    [open],
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [dur, setDur] = useState(AD_FALLBACK_LEN);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setElapsed(0);
    setDur(AD_FALLBACK_LEN);
    setDone(false);
    setFailed(false);
    setMuted(false);
  }, [open]);

  useEffect(() => {
    if (!open || !failed) return;
    const id = setInterval(() => {
      setElapsed((e) => {
        const next = e + 0.25;
        if (next >= AD_SKIP_AFTER) setDone(true);
        return next;
      });
    }, 250);
    return () => clearInterval(id);
  }, [open, failed]);

  const target = Math.min(dur, AD_SKIP_AFTER);
  const left = Math.max(0, Math.ceil(target - elapsed));
  const pct = Math.min(1, elapsed / Math.max(1, target));

  const claim = () => {
    if (!done) return;
    sfx.legend();
    haptic("success");
    onReward();
  };

  const openSponsor = () => {
    if (!ad.link) return;
    const api = pcApi();
    if (api?.openExternal) api.openExternal(ad.link);
    else window.open(ad.link, "_blank", "noopener,noreferrer");
  };

  useSystemBack(open, () => {
    if (done) claim();
    else onClose();
  });

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[140] flex items-center justify-center p-4 ad-theater-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => {
            if (done) claim();
          }}
        >
          <motion.div
            className="ad-theater-window"
            initial={{ opacity: 0, scale: 0.93, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Верхняя шапка трансляции */}
            <div className="ad-theater-bar">
              <div className="ad-theater-badge">
                <span className={`ad-theater-dot ${done ? "done" : ""}`} />
                <span>{tr(ad.label || "СПОНСОРСКИЙ ЭФИР")}</span>
              </div>

              <div className="flex items-center" style={{ gap: 8 }}>
                {!failed && (
                  <button
                    type="button"
                    className="pc-win-btn"
                    onClick={() => {
                      const v = videoRef.current;
                      if (v) {
                        v.muted = !v.muted;
                        setMuted(v.muted);
                      }
                    }}
                    title={muted ? tr("Включить звук") : tr("Выключить звук")}
                  >
                    <Icon name={muted ? "cross" : "sound"} size={14} />
                  </button>
                )}

                <div className={`ad-theater-progress-pill ${done ? "done" : ""}`}>
                  {done ? (
                    <Icon name="check" size={13} />
                  ) : (
                    <span className="t-num" style={{ fontSize: 11 }}>{left}c</span>
                  )}
                </div>

                <button
                  type="button"
                  className="pc-win-btn pc-win-close"
                  onClick={() => {
                    sfx.click();
                    if (done) claim();
                    else onClose();
                  }}
                  title={done ? tr("Забрать награду") : tr("Закрыть")}
                >
                  <Icon name="cross" size={13} />
                </button>
              </div>
            </div>

            {/* Сцена видеоролика / кибер-контракта */}
            <div className="ad-theater-stage">
              <div className="ad-theater-grid" aria-hidden />
              <div className="ad-theater-orb" aria-hidden />

              {!failed ? (
                <video
                  ref={videoRef}
                  src={ad.src}
                  autoPlay
                  playsInline
                  muted={muted}
                  onClick={openSponsor}
                  onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration;
                    if (isFinite(d) && d > 0) setDur(d);
                  }}
                  onTimeUpdate={(e) => {
                    const t = e.currentTarget.currentTime;
                    setElapsed(t);
                    if (t >= Math.min(dur, AD_SKIP_AFTER) - 0.15) setDone(true);
                  }}
                  onEnded={() => setDone(true)}
                  onError={() => setFailed(true)}
                  style={{
                    position: "relative",
                    zIndex: 2,
                    width: "100%",
                    maxHeight: 260,
                    borderRadius: 12,
                    background: "#050508",
                    objectFit: "cover",
                    cursor: ad.link ? "pointer" : "default",
                    border: "1px solid var(--surface-brd)",
                  }}
                />
              ) : (
                <div className="ad-theater-center">
                  <div className="ad-theater-emblem">
                    <span className="ad-theater-emblem-ring" />
                    <Icon name={done ? "gift" : "bolt"} size={28} accent />
                  </div>
                  <div className="t-display ad-theater-title">
                    {done ? tr("КОНТРАКТ ВЫПОЛНЕН") : tr("СИНХРОНИЗАЦИЯ КАНАЛА")}
                  </div>
                  <div className="ad-theater-sub">{reason}</div>
                  <div className="ad-theater-chips">
                    <span className={`ad-theater-chip ${done ? "ok" : ""}`}>
                      <Icon name={done ? "check" : "clock"} size={12} />
                      <span>{done ? tr("Награда разблокирована") : `${tr("Осталось")} ${left} ${tr("сек")}`}</span>
                    </span>
                    {ad.link && (
                      <button
                        type="button"
                        onClick={openSponsor}
                        className="ad-theater-chip"
                        style={{ cursor: "pointer" }}
                      >
                        <Icon name="globe" size={12} />
                        <span>@kayorisan</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="ad-theater-timeline">
                <span style={{ width: `${Math.round(pct * 100)}%` }} />
              </div>
            </div>

            {/* Нижняя панель */}
            <div className="ad-theater-footer">
              <div className="ad-theater-meta">
                <div className="t-title-sm clip1">{reason}</div>
                <div className="t-caption">
                  {done
                    ? tr("Награда готова к выдаче")
                    : `${tr("Подожди ещё")} ${left} ${tr("сек.")}`}
                </div>
              </div>

              <button
                type="button"
                disabled={!done}
                onClick={claim}
                className={`ad-theater-cta ${done ? "ready" : ""}`}
              >
                <Icon name={done ? "gift" : "clock"} size={14} />
                <span>
                  {done ? tr("ЗАБРАТЬ НАГРАДУ") : `${left} c`}
                </span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
