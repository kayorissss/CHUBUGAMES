import { useCallback, useEffect, useRef, useState } from "react";
import { tr } from "../core/i18n";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "./Icon";
import { sfx, haptic } from "../core/fx";
import { AD_FALLBACK_LEN, AD_SKIP_AFTER, pickClip } from "../core/ads";
import { useGame } from "../core/store";

/**
 * Показ рекламного ролика — полноэкранный, как в обычных мобильных играх.
 *
 * Пользователь просил:
 *  • ролик на весь экран, без интерфейса приложения вокруг;
 *  • кнопки «Пропустить», метка «Реклама» и звук — ПОВЕРХ видео;
 *  • при повторном входе ролик начинается сначала, а не с того же места;
 *  • после просмотра — плашка по центру «ЗА ПРОСМОТР РЕКЛАМЫ» с наградой.
 *
 * Награда не выдаётся только если закрыть до появления кнопки пропуска.
 */
export default function AdModal({
  reason,
  onReward,
  onClose,
}: {
  /** Что игрок получит — показываем в плашке награды */
  reason: string;
  onReward: () => void;
  onClose: () => void;
}) {
  const { s: save } = useGame();
  const [clip] = useState(() => pickClip());
  const videoRef = useRef<HTMLVideoElement>(null);
  /**
   * Со звуком, если он не выключен в настройках. Окно открывается по нажатию
   * игрока, поэтому автозапуск со звуком браузер разрешает. Если всё же
   * заблокирует — молча падаем в беззвучный режим.
   */
  const [muted, setMuted] = useState(() => !save.settings.sound);
  const [t, setT] = useState(0);
  const [len, setLen] = useState(AD_FALLBACK_LEN);
  /** Награда получена — показываем итоговую плашку вместо ролика */
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const rewarded = useRef(false);

  const canSkip = t >= AD_SKIP_AFTER || failed;
  const left = Math.max(0, Math.ceil(AD_SKIP_AFTER - t));

  const giveReward = useCallback(() => {
    if (rewarded.current) return;
    rewarded.current = true;
    onReward();
  }, [onReward]);

  /** Награда + переход на плашку итога */
  const finish = useCallback(() => {
    giveReward();
    videoRef.current?.pause();
    sfx.coin();
    haptic("success");
    setDone(true);
  }, [giveReward]);

  // Пытаемся стартовать со звуком; если браузер против — без него.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !clip) return;
    // Всегда с нуля: браузер может помнить позицию закешированного файла,
    // а игрок жаловался, что ролик «продолжается с того же момента».
    try { v.currentTime = 0; } catch { /* не критично */ }
    v.muted = muted;
    v.play().catch(() => {
      if (!v.muted) {
        v.muted = true;
        setMuted(true);
        v.play().catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip]);

  /** Переключатель звука на самом ролике */
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation(); // не открывать ссылку рекламодателя
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    v.muted = next;
    setMuted(next);
    if (!next) v.play().catch(() => {});
    haptic("light");
  };

  // Ролик не загрузился — не наказываем игрока, просто отдаём награду
  useEffect(() => {
    if (!clip) {
      setFailed(true);
      giveReward();
      setDone(true);
    }
  }, [clip, giveReward]);

  /** «Пропустить» — доступно с шестой секунды, награда засчитывается */
  const skip = () => {
    if (!canSkip) return;
    sfx.click();
    finish();
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
      className="fixed inset-0 z-[95]"
      style={{ background: "#000" }}
    >
      {/* ===== Ролик на весь экран ===== */}
      {!done && !failed && (
        <video
          ref={videoRef}
          src={clip?.src}
          autoPlay
          playsInline
          onClick={openLink}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setLen(d);
          }}
          onEnded={finish}
          onError={() => { setFailed(true); giveReward(); setDone(true); }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            background: "#000",
            cursor: clip?.link ? "pointer" : "default",
          }}
        />
      )}

      {/* ===== Элементы поверх видео ===== */}
      {!done && (
        <>
          {/* тонкая полоса прогресса у самого верха — не «интерфейс», а как в AdMob */}
          <div
            style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2.5,
              background: "rgba(255,255,255,0.18)", pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: `${pct * 100}%`, height: "100%",
                background: "#fff", transition: "width .2s linear",
              }}
            />
          </div>

          {/* метка «Реклама» */}
          <div
            className="t-label"
            style={{
              position: "absolute",
              top: "calc(var(--sat) + 14px)", left: 14,
              padding: "5px 9px", borderRadius: 5,
              background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.92)",
              fontSize: 9, letterSpacing: "0.1em", pointerEvents: "none",
            }}
          >
            {clip?.label || tr("РЕКЛАМА")}
          </div>

          {/* звук */}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? tr("Включить звук") : tr("Выключить звук")}
            className="flex items-center justify-center"
            style={{
              position: "absolute",
              top: "calc(var(--sat) + 10px)", right: 14,
              width: 38, height: 38, borderRadius: 999,
              background: "rgba(0,0,0,0.55)", border: "none", color: "#fff",
            }}
          >
            <Icon name={muted ? "soundOff" : "sound"} size={17} />
          </button>

          {/* пропустить */}
          <button
            type="button"
            onClick={skip}
            disabled={!canSkip}
            className="t-title-sm flex items-center"
            style={{
              position: "absolute",
              bottom: "calc(var(--sab) + 26px)", right: 14,
              gap: 7, padding: "11px 16px", borderRadius: 999,
              background: canSkip ? "rgba(255,255,255,0.94)" : "rgba(0,0,0,0.55)",
              color: canSkip ? "#0a0a0d" : "rgba(255,255,255,0.75)",
              border: "none", fontSize: 12.5,
              transition: "background .2s, color .2s",
            }}
          >
            {canSkip ? (
              <>{tr("ПРОПУСТИТЬ")}<Icon name="chevron" size={13} /></>
            ) : (
              <>{tr("ПРОПУСК ЧЕРЕЗ")} {left}</>
            )}
          </button>
        </>
      )}

      {/* ===== Плашка награды по центру ===== */}
      <AnimatePresence>
        {done && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ background: "rgba(4,4,6,0.94)", padding: 26 }}
          >
            <motion.div
              initial={{ scale: 0.88, y: 14, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="w-full text-center"
              style={{
                maxWidth: 320, padding: "26px 22px 22px",
                borderRadius: "var(--r-lg)",
                background: "var(--surface)",
                border: "1px solid var(--surface-brd)",
                boxShadow: "0 24px 70px -24px rgba(0,0,0,0.9)",
              }}
            >
              <motion.span
                className="inline-flex items-center justify-center"
                initial={{ scale: 0.6, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.08 }}
                style={{
                  width: 62, height: 62, borderRadius: "var(--r-md)",
                  background: "var(--acc)", color: "var(--acc-ink)",
                }}
              >
                <Icon name={failed ? "warn" : "gift"} size={30} />
              </motion.span>

              <div
                className="t-label"
                style={{ marginTop: 16, fontSize: 9.5, letterSpacing: "0.12em" }}
              >
                {tr("ЗА ПРОСМОТР РЕКЛАМЫ")}
              </div>
              <div
                className="t-display-sm acc-text"
                style={{ marginTop: 8, fontSize: 26, lineHeight: 1.15, overflowWrap: "anywhere" }}
              >
                {reason}
              </div>
              {failed && (
                <div className="t-caption" style={{ marginTop: 9, lineHeight: 1.5 }}>
                  {tr("Ролик не загрузился — награду всё равно засчитали.")}
                </div>
              )}

              <button
                type="button"
                onClick={() => { sfx.click(); onClose(); }}
                className="btn-acc w-full"
                style={{ marginTop: 20, minHeight: 50, fontSize: 13 }}
              >
                {tr("ЗАБРАТЬ")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
