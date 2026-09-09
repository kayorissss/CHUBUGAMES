import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, Bar } from "./Glass";
import Icon from "./Icon";
import { useGame } from "../core/store";
import { haptic, sfx } from "../core/fx";
import {
  checkQuietly,
  downloadAndInstall,
  fmtBytes,
  isNative,
  type UpdateInfo,
} from "../core/updater";

const SKIP_KEY = "chubgames.skipVersion";

/**
 * Плашка «вышло обновление».
 * Проверка запускается один раз при старте приложения и молча ничего
 * не делает, если сети нет или версия уже последняя.
 */
export default function UpdateBanner() {
  const { toast } = useGame();
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    // небольшая задержка, чтобы не мешать сплэшу
    const t = setTimeout(async () => {
      const found = await checkQuietly();
      if (!alive || !found) return;
      if (localStorage.getItem(SKIP_KEY) === found.version) return;
      setInfo(found);
      sfx.achieve?.();
      haptic("light");
    }, 2600);
    return () => { alive = false; clearTimeout(t); };
  }, []);

  const install = async () => {
    if (!info) return;
    setErr(null);
    setBusy(true);
    setLoaded(0);
    setTotal(info.size || 0);
    const ac = new AbortController();
    abort.current = ac;
    try {
      await downloadAndInstall(
        info,
        (l, t2) => { setLoaded(l); if (t2) setTotal(t2); },
        ac.signal,
      );
      toast({ title: "Открываю установщик", sub: "Разреши установку", icon: "case", tone: "gold" });
      setInfo(null);
    } catch (e: any) {
      if (e?.name !== "AbortError") setErr(e?.message || "Не удалось скачать");
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  const later = () => {
    if (busy) { abort.current?.abort(); setBusy(false); return; }
    if (info) localStorage.setItem(SKIP_KEY, info.version);
    setInfo(null);
  };

  const pct = total > 0 ? loaded / total : 0;

  return (
    <AnimatePresence>
      {info && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-end justify-center"
          style={{ background: "rgba(4,4,6,0.72)", backdropFilter: "blur(14px)", padding: 16 }}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="w-full"
            style={{
              maxWidth: 420,
              background: "var(--surface)",
              border: "1px solid var(--surface-brd)",
              borderRadius: "var(--r-xl)",
              padding: 18,
              marginBottom: "calc(var(--sab) + 8px)",
            }}
          >
            <div className="flex items-center" style={{ gap: 12 }}>
              <div
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: 42, height: 42, borderRadius: "var(--r-md)",
                  background: "var(--acc)", color: "var(--acc-ink)",
                }}
              >
                <Icon name="download" size={21} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="t-title-sm">Вышло обновление</div>
                <div className="t-caption" style={{ marginTop: 2 }}>
                  версия {info.version} · {fmtBytes(info.size)}
                </div>
              </div>
            </div>

            {info.notes && !busy && (
              <div
                className="t-body"
                style={{
                  marginTop: 14, padding: "11px 13px", borderRadius: "var(--r-md)",
                  background: "var(--btn-bg)", whiteSpace: "pre-line",
                  maxHeight: 120, overflowY: "auto",
                }}
              >
                {info.notes}
              </div>
            )}

            {busy && (
              <div style={{ marginTop: 16 }}>
                <div className="flex items-baseline justify-between" style={{ marginBottom: 7 }}>
                  <span className="t-label">Загрузка</span>
                  <span className="t-num" style={{ fontSize: 12 }}>
                    {total ? `${Math.round(pct * 100)}%` : fmtBytes(loaded)}
                  </span>
                </div>
                <Bar pct={total ? pct : 0.06} h={7} />
                <div className="t-caption" style={{ marginTop: 7 }}>
                  {fmtBytes(loaded)}{total ? ` из ${fmtBytes(total)}` : ""}
                </div>
              </div>
            )}

            {err && (
              <div
                className="t-body"
                style={{ marginTop: 12, color: "var(--danger)" }}
              >
                {err}
              </div>
            )}

            <div className="flex" style={{ gap: 8, marginTop: 16 }}>
              <Button variant="secondary" onClick={later} sound="none">
                {busy ? "Отмена" : "Позже"}
              </Button>
              {!busy && (
                <Button
                  variant="primary"
                  full
                  sound="power"
                  onClick={install}
                  disabled={!isNative()}
                >
                  {isNative() ? "Обновить" : "Только в приложении"}
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
