import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Icon from "./Icon";
import { sfx, haptic } from "../core/fx";
import { AD_FALLBACK_LEN, AD_SKIP_AFTER, pickClip } from "../core/ads";

/**
 * Показ рекламного ролика.
 *
 * Логика по договорённости:
 *  1. Ролик 10 секунд, кнопка «Пропустить» появляется на 6-й секунде.
 *  2. Досмотрел до конца — награда.
 *  3. Нажал «Пропустить», потом крестик — награда всё равно выдаётся.
 *  4. Тап по видео — открывается ссылка рекламодателя.
 *
 * Награда не выдаётся только если закрыть до появления кнопки пропуска.
 */
export default function AdModal({
  reason,
  onReward,
  onClose,
}: {
  /** Что игрок получит — показываем в шапке */
  reason: string;
  onReward: () => void;
  onClose: () => void;
}) {
  const [clip] = useState(() => pickClip());
  const videoRef = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0);
  const [len, setLen] = useState(AD_FALLBACK_LEN);
  const [ended, setEnded] = useState(false);
  /** true — пропустил, но награда уже засчитана, ждём крестик */
  const [skipped, setSkipped] = useState(false);
  const [failed, setFailed] = useState(false);
  const rewarded = useRef(false);

  const canSkip = t >= AD_SKIP_AFTER || ended || failed;
  const left = Math.max(0, Math.ceil(AD_SKIP_AFTER - t));

  const giveReward = useCallback(() => {
    if (rewarded.current) return;
    rewarded.current = true;
    onReward();
  }, [onReward]);

  // Ролик не загрузился — не наказываем игрока, просто отдаём награду
  useEffect(() => {
    if (!clip) {
      setFailed(true);
      giveReward();
    }
  }, [clip, giveReward]);

  // Досмотрел до конца
  useEffect(() => {
    if (ended) giveReward();
  }, [ended, giveReward]);

  /** «Пропустить» — награду засчитываем сразу, окно остаётся */
  const skip = () => {
    if (!canSkip) return;
    sfx.click();
    haptic("light");
    videoRef.current?.pause();
    setSkipped(true);
    giveReward();
  };

  /** Крестик */
  const close = () => {
    sfx.click();
    onClose();
  };

  /** Тап по видео — переход по ссылке рекламодателя */
  const openLink = () => {
    if (!clip?.link) return;
    haptic("light");
    window.open(clip.link, "_blank", "noopener,noreferrer");
  };

  const pct = Math.min(1, len ? t / len : 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex flex-col"
      style={{ background: "rgba(4,4,6,0.96)" }}
    >
      {/* Шапка */}
      <div
        className="flex items-center"
        style={{
          gap: 10,
          padding: "calc(var(--sat) + 12px) 14px 12px",
        }}
      >
        <span className="t-label" style={{ fontSize: 9, opacity: 0.7 }}>
          {clip?.label || "РЕКЛАМА"}
        </span>
        <span className="t-caption flex-1 clip1">{reason}</span>

        {/* Пропустить / крестик */}
        {!skipped ? (
          <button
            type="button"
            onClick={skip}
            disabled={!canSkip}
            className="t-title-sm shrink-0 flex items-center"
            style={{
              gap: 7,
              padding: "9px 14px",
              borderRadius: "var(--r-md)",
              background: canSkip ? "var(--acc)" : "var(--btn-bg)",
              color: canSkip ? "var(--acc-ink)" : "var(--text-mute)",
              border: canSkip ? "none" : "1px solid var(--btn-brd)",
              fontSize: 12,
              transition: "background .2s, color .2s",
            }}
          >
            {canSkip ? (
              <>ПРОПУСТИТЬ <Icon name="chevron" size={13} /></>
            ) : (
              <>ПРОПУСК ЧЕРЕЗ {left}</>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={close}
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 38,
              height: 38,
              borderRadius: "var(--r-md)",
              background: "var(--btn-bg)",
              border: "1px solid var(--btn-brd)",
            }}
          >
            <Icon name="cross" size={16} />
          </button>
        )}
      </div>

      {/* Само видео */}
      <div className="flex-1 flex items-center justify-center" style={{ padding: "0 12px" }}>
        {failed ? (
          <div className="text-center" style={{ padding: 24 }}>
            <Icon name="warn" size={34} />
            <div className="t-title-sm" style={{ marginTop: 12 }}>
              Ролик не загрузился
            </div>
            <div className="t-caption" style={{ marginTop: 6, lineHeight: 1.5 }}>
              Награду всё равно засчитали — это не твоя вина.
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={clip?.src}
            autoPlay
            playsInline
            // без звука — иначе Android не даст автозапуск
            muted
            onClick={openLink}
            onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d) && d > 0) setLen(d);
            }}
            onEnded={() => setEnded(true)}
            onError={() => { setFailed(true); giveReward(); }}
            style={{
              width: "100%",
              maxHeight: "100%",
              borderRadius: "var(--r-lg)",
              background: "#000",
              cursor: clip?.link ? "pointer" : "default",
            }}
          />
        )}
      </div>

      {/* Низ: прогресс и статус */}
      <div style={{ padding: "14px 16px calc(var(--sab) + 16px)" }}>
        <div
          style={{
            height: 3,
            borderRadius: 999,
            background: "var(--track)",
            overflow: "hidden",
          }}
        >
          <motion.div
            animate={{ width: `${pct * 100}%` }}
            transition={{ duration: 0.2 }}
            style={{ height: "100%", background: "var(--acc)" }}
          />
        </div>

        {skipped ? (
          <div
            className="t-body flex items-center justify-center"
            style={{ gap: 8, marginTop: 12, color: "#59FF9E" }}
          >
            <Icon name="check" size={15} /> Награда засчитана — закрой крестиком
          </div>
        ) : (
          <div
            className="t-caption text-center"
            style={{ marginTop: 12, lineHeight: 1.5 }}
          >
            {clip?.link
              ? "Нажми на ролик, чтобы перейти к рекламодателю"
              : "Досмотри до конца, чтобы получить награду"}
          </div>
        )}
      </div>
    </motion.div>
  );
}
