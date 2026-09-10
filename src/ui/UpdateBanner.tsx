import { useEffect, useRef, useState } from "react";
import { tr } from "../core/i18n";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "./Icon";
import { useGame } from "../core/store";
import { haptic, sfx } from "../core/fx";
import { EASE } from "../core/motion";
import {
  checkQuietly,
  downloadAndInstall,
  fmtBytes,
  isNative,
  type UpdateInfo,
} from "../core/updater";
import { APP_VERSION } from "../core/version";

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

/**
 * Полоса загрузки.
 *
 * Раньше здесь было большое кольцо с процентом в центре — пользователь
 * сказал, что «глаза болят» и выглядит криво. Прямая полоса читается
 * спокойнее и занимает меньше места, а цифры вынесены в строку над ней.
 */
function ProgressLine({ pct }: { pct: number }) {
  return (
    <div
      style={{
        height: 8,
        borderRadius: 999,
        background: "var(--surface-3)",
        overflow: "hidden",
      }}
    >
      <motion.div
        initial={false}
        animate={{ width: `${Math.max(2, Math.min(100, pct * 100))}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 24 }}
        style={{
          height: "100%",
          borderRadius: 999,
          background: "var(--acc)",
        }}
      />
    </div>
  );
}

/**
 * Экран обновления.
 *
 * Собран заново: спокойная тёмная страница со ступенями поверхностей,
 * без радиального свечения на пол-экрана, без прыгающей иконки и без
 * кольца прогресса. Структура сверху вниз — что за версия, что в ней
 * поменялось, кнопка. Кнопки прижаты к низу, но выше жестовой полосы,
 * чтобы до них дотягивался палец.
 */
export default function UpdateBanner({
  external = null,
  onClose,
}: {
  /** Обновление, найденное снаружи (кнопка «Проверить» в настройках). */
  external?: UpdateInfo | null;
  onClose?: () => void;
} = {}) {
  const { toast } = useGame();
  const [found, setFound] = useState<UpdateInfo | null>(null);
  const info = external ?? found;
  const setInfo = (v: UpdateInfo | null) => {
    if (external) { if (!v) onClose?.(); }
    else setFound(v);
  };
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const speedRef = useRef({ t: 0, b: 0, v: 0 });
  const [speed, setSpeed] = useState(0);

  useEffect(() => {
    // Когда обновление пришло снаружи, своя проверка не нужна.
    if (external) return;
    let alive = true;
    // небольшая задержка, чтобы не мешать сплэшу
    const t = setTimeout(async () => {
      const got = await checkQuietly();
      if (!alive || !got) return;
      if (localStorage.getItem(SKIP_KEY) === got.version) return;
      setFound(got);
      sfx.achieve?.();
      haptic("light");
    }, 2600);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [external]);

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
      toast({ title: tr("Открываю установщик"), sub: tr("Разреши установку"), icon: "download", tone: "gold" });
      setInfo(null);
    } catch (e: any) {
      if (e?.name !== "AbortError") setErr(e?.message || tr("Не удалось скачать"));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  const later = () => {
    if (busy) { abort.current?.abort(); setBusy(false); return; }
    if (info && !external) localStorage.setItem(SKIP_KEY, info.version);
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
          transition={{ duration: 0.24 }}
          className="fixed inset-0 z-[110] flex flex-col"
          style={{ background: "var(--bg)" }}
        >
          {/* ─── Шапка ─── */}
          <div
            className="shrink-0"
            style={{
              padding: "calc(var(--sat) + 18px) 18px 18px",
              background: "var(--surface)",
              borderBottom: "1px solid var(--surface-brd)",
            }}
          >
            <div className="flex items-center" style={{ gap: 13 }}>
              <span
                className="ico-box ico-box-acc"
                style={{ width: 46, height: 46, borderRadius: "var(--r-md)" }}
              >
                <Icon name="download" size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="t-label" style={{ fontSize: 9 }}>
                  {busy ? tr("ЗАГРУЗКА") : tr("ДОСТУПНО ОБНОВЛЕНИЕ")}
                </div>
                <div className="t-display-sm clip1" style={{ fontSize: 20, marginTop: 3 }}>
                  {tr("Версия")} {info.version}
                </div>
              </div>
            </div>

            {/* Что меняется: было → стало. Коротко и без лишних слов. */}
            <div
              className="flex items-center"
              style={{
                gap: 10, marginTop: 14, padding: "10px 12px",
                borderRadius: "var(--r-md)",
                background: "var(--surface-2)",
                border: "1px solid var(--surface-brd)",
              }}
            >
              <span className="min-w-0">
                <span className="t-label block" style={{ fontSize: 8.5 }}>{tr("СЕЙЧАС")}</span>
                <span className="t-num block clip1" style={{ fontSize: 14, marginTop: 2 }}>
                  {APP_VERSION}
                </span>
              </span>
              <span style={{ color: "var(--text-mute)", lineHeight: 0 }}>
                <Icon name="chevron" size={14} />
              </span>
              <span className="min-w-0">
                <span className="t-label block" style={{ fontSize: 8.5 }}>{tr("СТАНЕТ")}</span>
                <span className="t-num acc-text block clip1" style={{ fontSize: 14, marginTop: 2 }}>
                  {info.version}
                </span>
              </span>
              <span className="flex-1" />
              <span className="t-caption shrink-0">{fmtBytes(info.size)}</span>
            </div>
          </div>

          {/* ─── Содержимое ─── */}
          {/* КНОПКА УХОДИЛА ЗА ЭКРАН.
              У flex-элемента с `flex:1` минимальная высота по умолчанию —
              это высота содержимого (min-height:auto). Длинный список
              изменений раздувал середину, колонка становилась выше экрана,
              и нижний блок с кнопкой «Обновить сейчас» уезжал за границу.
              `minHeight: 0` разрешает середине сжиматься и скроллиться,
              кнопки остаются на месте. */}
          <div
            className="flex-1 scroll"
            style={{ padding: "16px 18px 8px", minHeight: 0, overflowY: "auto" }}
          >
            {busy ? (
              <div>
                <div
                  className="flex items-baseline justify-between"
                  style={{ gap: 10, marginBottom: 9 }}
                >
                  <span className="t-num" style={{ fontSize: 30, lineHeight: 1 }}>
                    {Math.round(pct * 100)}
                    <span className="t-label" style={{ fontSize: 12, marginLeft: 3 }}>%</span>
                  </span>
                  <span className="t-caption">
                    {fmtBytes(loaded)}{total ? ` / ${fmtBytes(total)}` : ""}
                  </span>
                </div>
                <ProgressLine pct={pct} />
                <div className="flex items-center justify-between" style={{ gap: 10, marginTop: 9 }}>
                  <span className="t-caption">
                    {speed > 0 ? `${fmtBytes(speed)}/${tr("с")}` : tr("соединяюсь")}
                  </span>
                  {eta > 0 && (
                    <span className="t-caption">
                      {tr("осталось")} {eta < 60 ? `${eta} ${tr("с")}` : `${Math.ceil(eta / 60)} ${tr("мин")}`}
                    </span>
                  )}
                </div>
                <div
                  className="t-body"
                  style={{
                    marginTop: 16, padding: "12px 13px",
                    borderRadius: "var(--r-md)",
                    background: "var(--surface)",
                    border: "1px solid var(--surface-brd)",
                    lineHeight: 1.55,
                  }}
                >
                  {tr("Не закрывай приложение. Когда файл скачается, Android спросит разрешение на установку.")}
                </div>
              </div>
            ) : (
              <>
                {sections.length > 0 && (
                  <div className="t-label" style={{ fontSize: 9, marginBottom: 10 }}>
                    {tr("ЧТО НОВОГО")}
                  </div>
                )}
                <div className="flex flex-col" style={{ gap: 10 }}>
                  {sections.map((sec, i) => (
                    <motion.div
                      key={i}
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: Math.min(i, 6) * 0.05, duration: 0.26, ease: EASE }}
                      style={{
                        padding: "13px 14px",
                        borderRadius: "var(--r-lg)",
                        background: "var(--surface)",
                        border: "1px solid var(--surface-brd)",
                      }}
                    >
                      {sec.head && (
                        <div className="t-title-sm" style={{ fontSize: 13.5, marginBottom: 8 }}>
                          {sec.head}
                        </div>
                      )}
                      {sec.items.map((it, j) => (
                        <div
                          key={j}
                          className="flex"
                          style={{ gap: 9, marginTop: j === 0 ? 0 : 7 }}
                        >
                          <span
                            className="shrink-0"
                            style={{ color: "var(--acc-text)", lineHeight: 0, marginTop: 4 }}
                          >
                            <Icon name="check" size={12} />
                          </span>
                          <span className="t-body" style={{ flex: 1, minWidth: 0 }}>{it}</span>
                        </div>
                      ))}
                    </motion.div>
                  ))}
                </div>
              </>
            )}

            {err && (
              <div
                className="t-body"
                style={{
                  marginTop: 14, padding: "12px 13px",
                  borderRadius: "var(--r-md)",
                  background: "var(--danger-soft)",
                  border: "1px solid var(--danger-brd)",
                  color: "var(--danger)",
                  lineHeight: 1.5,
                }}
              >
                {err}
              </div>
            )}
          </div>

          {/* ─── Кнопки: у нижнего края, но выше жестовой полосы ─── */}
          <div
            className="shrink-0 flex flex-col"
            style={{
              gap: 9,
              padding: "14px 18px calc(var(--sab) + 20px)",
              background: "var(--surface)",
              borderTop: "1px solid var(--surface-brd)",
            }}
          >
            {!busy && (
              <button
                type="button"
                className="btn-acc"
                style={{ width: "100%", minHeight: 50, fontSize: 14 }}
                disabled={!isNative()}
                onClick={() => { sfx.power?.(); haptic("light"); void install(); }}
              >
                {isNative() ? tr("Обновить сейчас") : tr("Только в приложении")}
              </button>
            )}
            <button
              type="button"
              className="btn-flat"
              style={{ width: "100%", minHeight: 46, fontSize: 13 }}
              onClick={later}
            >
              {busy ? tr("Отменить загрузку") : external ? tr("Закрыть") : tr("Позже")}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
