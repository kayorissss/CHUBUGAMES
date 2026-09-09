import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "./Glass";
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

/** Разбирает тело релиза в список пунктов: заголовки жирные, строки с «-» — пункты */
function parseNotes(raw: string): { head: string; items: string[] }[] {
  const out: { head: string; items: string[] }[] = [];
  let cur: { head: string; items: string[] } | null = null;
  let seenVersionHead = false;
  for (const lineRaw of String(raw || "").split("\n")) {
    const line = lineRaw.trim();
    if (!line) continue;
    // подвал с веткой и коммитом человеку не нужен
    if (line.startsWith("---")) break;
    if (/^#{1,6}\s/.test(line)) {
      const head = line.replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "");
      // В файле лежит история всех версий. Показываем только свежую:
      // как дошли до заголовка следующей «Что нового» — останавливаемся.
      if (/Что нового/i.test(head)) {
        if (seenVersionHead) break;
        seenVersionHead = true;
        cur = null;
        continue;
      }
      // название приложения в шапке — не раздел
      if (/^ЧУБУГЕЙМ$/i.test(head)) { cur = null; continue; }
      cur = { head, items: [] };
      out.push(cur);
      continue;
    }
    const bold = line.match(/^\*\*(.+?)\*\*$/);
    if (bold) {
      cur = { head: bold[1], items: [] };
      out.push(cur);
      continue;
    }
    if (/^[-*·]\s/.test(line)) {
      const txt = line.replace(/^[-*·]\s*/, "").replace(/\*\*/g, "").replace(/`/g, "");
      if (!cur) { cur = { head: "", items: [] }; out.push(cur); }
      cur.items.push(txt);
    }
  }
  // разделы без пунктов только занимают место
  return out.filter((s) => s.items.length > 0);
}

/** Кольцо прогресса — крупное, по центру, вместо тонкой полоски внизу */
function ProgressRing({ pct, size = 148 }: { pct: number; size?: number }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="var(--acc)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - Math.max(0.015, pct)) }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
          style={{ filter: "drop-shadow(0 0 10px var(--acc-glow))" }}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ gap: 2 }}
      >
        <span className="t-num" style={{ fontSize: 34, lineHeight: 1 }}>
          {Math.round(pct * 100)}
        </span>
        <span className="t-label" style={{ fontSize: 9 }}>ПРОЦЕНТОВ</span>
      </div>
    </div>
  );
}

/**
 * Полноэкранный установщик обновления.
 * Проверка запускается один раз при старте и молча ничего не делает,
 * если сети нет или версия уже последняя.
 */
export default function UpdateBanner() {
  const { toast } = useGame();
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const speedRef = useRef({ t: 0, b: 0, v: 0 });
  const [speed, setSpeed] = useState(0);

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
    speedRef.current = { t: Date.now(), b: 0, v: 0 };
    const ac = new AbortController();
    abort.current = ac;
    try {
      await downloadAndInstall(
        info,
        (l, t2) => {
          setLoaded(l);
          if (t2) setTotal(t2);
          // скорость считаем раз в 400 мс, иначе цифра дёргается
          const now = Date.now();
          const sp = speedRef.current;
          if (now - sp.t > 400) {
            sp.v = ((l - sp.b) / (now - sp.t)) * 1000;
            sp.t = now; sp.b = l;
            setSpeed(sp.v);
          }
        },
        ac.signal,
      );
      toast({ title: "Открываю установщик", sub: "Разреши установку", icon: "download", tone: "gold" });
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

  const pct = total > 0 ? Math.min(1, loaded / total) : 0;
  const sections = info ? parseNotes(info.notes) : [];
  const eta = speed > 0 && total > loaded ? Math.ceil((total - loaded) / speed) : 0;

  return (
    <AnimatePresence>
      {info && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="fixed inset-0 z-[110] flex flex-col"
          style={{ background: "#08080B" }}
        >
          {/* фоновое свечение */}
          <motion.div
            className="absolute pointer-events-none"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9 }}
            style={{
              top: "-22%", left: "-30%", width: "160%", height: "70%",
              background: "radial-gradient(circle at 50% 50%, var(--acc-glow), transparent 62%)",
              opacity: 0.5, filter: "blur(20px)",
            }}
          />

          <div
            className="relative flex flex-col flex-1 overflow-y-auto"
            style={{
              padding: "calc(var(--sat) + 26px) 20px calc(var(--sab) + 18px)",
            }}
          >
            {/* шапка */}
            <motion.div
              className="flex flex-col items-center text-center"
              initial={{ y: -14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.06 }}
            >
              <motion.div
                className="flex items-center justify-center"
                animate={busy ? {} : { y: [0, -7, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  width: 62, height: 62, borderRadius: "var(--r-lg)",
                  background: "var(--acc)", color: "var(--acc-ink)",
                  boxShadow: "0 12px 34px var(--acc-glow)",
                }}
              >
                <Icon name="download" size={30} />
              </motion.div>
              <div className="t-label" style={{ marginTop: 16, fontSize: 9.5 }}>
                ДОСТУПНО ОБНОВЛЕНИЕ
              </div>
              <div className="t-display" style={{ fontSize: 40, lineHeight: 1.05, marginTop: 6 }}>
                {info.version}
              </div>
              <div className="t-caption" style={{ marginTop: 6 }}>
                {fmtBytes(info.size)} · сейчас у тебя старая версия
              </div>
            </motion.div>

            {/* прогресс загрузки */}
            {busy ? (
              <motion.div
                className="flex flex-col items-center"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ marginTop: 30 }}
              >
                <ProgressRing pct={pct} />
                <div className="t-body" style={{ marginTop: 18, textAlign: "center" }}>
                  {fmtBytes(loaded)}{total ? ` из ${fmtBytes(total)}` : ""}
                </div>
                <div className="t-caption" style={{ marginTop: 5, textAlign: "center" }}>
                  {speed > 0 ? `${fmtBytes(speed)}/с` : "соединяюсь"}
                  {eta > 0 ? ` · осталось ${eta < 60 ? `${eta} с` : `${Math.ceil(eta / 60)} мин`}` : ""}
                </div>
                <div className="t-caption" style={{ marginTop: 14, textAlign: "center", maxWidth: 280 }}>
                  Не закрывай приложение. Когда файл скачается, Android
                  спросит разрешение на установку.
                </div>
              </motion.div>
            ) : (
              /* список изменений */
              <motion.div
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.16 }}
                style={{ marginTop: 26, flex: 1 }}
              >
                {sections.length > 0 && (
                  <div className="t-label" style={{ fontSize: 9.5, marginBottom: 12 }}>
                    ЧТО НОВОГО
                  </div>
                )}
                <div className="flex flex-col" style={{ gap: 14 }}>
                  {sections.map((sec, i) => (
                    <motion.div
                      key={i}
                      initial={{ y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 + i * 0.06 }}
                      style={{
                        padding: "13px 15px",
                        borderRadius: "var(--r-lg)",
                        background: "rgba(255,255,255,0.045)",
                        border: "1px solid var(--surface-brd)",
                      }}
                    >
                      {sec.head && (
                        <div className="t-title-sm" style={{ fontSize: 14 }}>{sec.head}</div>
                      )}
                      {sec.items.map((it, j) => (
                        <div
                          key={j}
                          className="flex"
                          style={{ gap: 9, marginTop: j === 0 && sec.head ? 9 : 7 }}
                        >
                          <span
                            className="shrink-0"
                            style={{ color: "var(--acc)", lineHeight: 0, marginTop: 4 }}
                          >
                            <Icon name="check" size={12} />
                          </span>
                          <span className="t-body" style={{ flex: 1, minWidth: 0 }}>{it}</span>
                        </div>
                      ))}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {err && (
              <div
                className="t-body"
                style={{
                  marginTop: 16, padding: "12px 14px",
                  borderRadius: "var(--r-md)",
                  background: "rgba(255,77,77,0.12)",
                  border: "1px solid rgba(255,77,77,0.3)",
                  color: "#FF8080",
                }}
              >
                {err}
              </div>
            )}

            {/* кнопки */}
            <div
              className="flex flex-col"
              style={{ gap: 9, marginTop: 24 }}
            >
              {!busy && (
                <Button
                  variant="primary"
                  full
                  size="lg"
                  sound="power"
                  onClick={install}
                  disabled={!isNative()}
                >
                  {isNative() ? "Обновить сейчас" : "Только в приложении"}
                </Button>
              )}
              <Button variant="secondary" full onClick={later} sound="none">
                {busy ? "Отменить загрузку" : "Позже"}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
