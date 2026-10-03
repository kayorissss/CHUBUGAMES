import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Screen } from "../ui/Glass";
import Icon from "../ui/Icon";
import { tr } from "../core/i18n";
import { sfx, haptic } from "../core/fx";
import { isDesktop } from "../core/desktop";
import { APP_VERSION } from "../core/version";
import { CHANGELOG } from "../core/changelog";
import { cmpVer } from "../ui/ChangelogView";
import { checkForUpdate, downloadAndInstall, fmtBytes, type UpdateInfo } from "../core/updater";
import { clearDeferredUpdate } from "../core/updateState";
import { useSystemBack } from "../core/android";

/**
 * ЭКРАН ОБНОВЛЕНИЯ (ПК).
 *
 * Просьба: «нажимаешь на плашку „вышло обновление“ и переходишь на страницу
 * в приложении с этапом загрузки и красивым лобби ожидания».
 *
 * Что было: полоса сверху, в ней же кнопка, в ней же прогресс — 10 МБ качаются
 * в строчке под панелью, и непонятно, жив ли процесс. Теперь это отдельная
 * страница с тремя ступенями (проверка → загрузка → установка), крупным
 * кольцом прогресса, честными цифрами (сколько скачано, скорость, сколько
 * осталось) и «лобби»: пока файл качается или установщик стартует, по экрану
 * крутятся подсказки, и видно, что приложение не зависло.
 *
 * Пути две, и обе настоящие:
 *  • в Electron-сборке работает мост chubDesktop — он качает сам, сверяет
 *    SHA-256 и запускает установщик (для portable — показывает файл);
 *  • в браузере и на телефоне — core/updater.ts (fetch + прогресс, на Android
 *    нативная загрузка с уведомлением).
 */

type Phase =
  | "check"        /* спрашиваем GitHub */
  | "latest"       /* обновлений нет */
  | "found"        /* есть что ставить */
  | "download"     /* летит файл */
  | "verify"       /* сверка контрольной суммы */
  | "install"      /* установщик запущен / игра сейчас закроется */
  | "ready"        /* portable: файл скачан, надо положить на место */
  | "error";

const STEPS = [
  { id: "check", label: "Проверка", hint: "спрашиваем GitHub" },
  { id: "download", label: "Загрузка", hint: "файл сборки" },
  { id: "install", label: "Установка", hint: "запускаем установщик" },
] as const;

const TIPS = [
  "Обновление не трогает прогресс: сохранения лежат в папке профиля, а не в файле сборки.",
  "Скорость считается по факту скачанных байтов, а не по таймеру — поэтому цифра может подпрыгивать.",
  "Контрольная сумма SHA-256 сверяется до запуска установщика: битый файл не запустится никогда.",
  "Если антивирус ругается — это SmartScreen и отсутствие подписи сертификата, а не вирус: хеш файла виден в релизе.",
  "Можно закрыть окно и скачать позже: знак «!» на настройках останется, пока версия не станет свежей.",
];

export default function UpdateFlow({ onBack }: { onBack: () => void }) {
  const api = (window as any).chubDesktop;
  const pc = isDesktop();

  const [phase, setPhase] = useState<Phase>("check");
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [ver, setVer] = useState<string>("");
  const [size, setSize] = useState(0);
  const [portable, setPortable] = useState(false);
  const [got, setGot] = useState(0);
  const [total, setTotal] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [error, setError] = useState("");
  const [tip, setTip] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const rate = useRef({ t: 0, b: 0 });

  /** Что нового между установленной версией и новой — из локального changelog */
  const news = (() => {
    const from = (ver && ver !== APP_VERSION ? ver : info?.version) || "";
    if (!from) return [] as { v: string; items: string[] }[];
    return Object.keys(CHANGELOG)
      .sort(cmpVer)
      .reverse()
      .filter((v) => cmpVer(v, APP_VERSION) > 0 && cmpVer(v, from) <= 0 && (CHANGELOG[v] || []).length)
      .slice(0, 3)
      .map((v) => ({ v, items: (CHANGELOG[v] || []).slice(0, 4).map((i) => i.title) }));
  })();

  /* ───────── ступень 1: проверка ───────── */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (pc && api?.checkUpdate) {
          const r = await api.checkUpdate();
          if (!alive) return;
          if (!r?.ok) { setError(r?.error || tr("не удалось проверить")); setPhase("error"); return; }
          if (!r.hasUpdate) { setPhase("latest"); clearDeferredUpdate(); return; }
          setVer(r.version);
          setSize(r.size || 0);
          setPortable(!!r.portable);
          setInfo({ version: r.version, notes: r.notes || "", url: r.url, size: r.size || 0, published: "" });
          setPhase("found");
          return;
        }
        const got = await checkForUpdate();
        if (!alive) return;
        if (!got) { setPhase("latest"); clearDeferredUpdate(); return; }
        setInfo(got);
        setVer(got.version);
        setSize(got.size);
        setPhase("found");
      } catch (e: any) {
        if (!alive) return;
        setError(String(e?.message || e).slice(0, 240));
        setPhase("error");
      }
    })();
    return () => { alive = false; abort.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───────── подсказки в лобби ───────── */
  useEffect(() => {
    if (phase !== "download" && phase !== "verify" && phase !== "install") return;
    const t = setInterval(() => setTip((n) => (n + 1) % TIPS.length), 4200);
    return () => clearInterval(t);
  }, [phase]);

  /* ───────── ступень 2: загрузка ───────── */
  const start = async () => {
    setError("");
    setGot(0);
    setTotal(size || 0);
    rate.current = { t: Date.now(), b: 0 };
    setPhase("download");
    sfx.power?.();
    haptic("medium");
    try {
      if (pc && api?.downloadUpdate) {
        const r = await api.downloadUpdate((p: any) => {
          setGot(p.received || 0);
          setTotal(p.total || size || 0);
          const now = Date.now();
          const rr = rate.current;
          if (now - rr.t > 350) {
            setSpeed(((p.received - rr.b) / (now - rr.t)) * 1000);
            rr.t = now; rr.b = p.received;
          }
        });
        if (!r?.ok) { setError(r?.error || tr("не скачалось")); setPhase("error"); return; }
        setPhase(r.portable ? "ready" : "install");
        clearDeferredUpdate();
        return;
      }
      if (!info) throw new Error(tr("нет данных об обновлении"));
      const ac = new AbortController();
      abort.current = ac;
      setPhase("verify");
      await downloadAndInstall(
        info,
        (loaded, t2) => {
          setGot(loaded);
          if (t2) setTotal(t2);
          const now = Date.now();
          const rr = rate.current;
          if (now - rr.t > 350) {
            setSpeed(((loaded - rr.b) / (now - rr.t)) * 1000);
            rr.t = now; rr.b = loaded;
          }
        },
        ac.signal,
      );
      setPhase("install");
      clearDeferredUpdate();
    } catch (e: any) {
      if (e?.name === "AbortError") { setPhase(info || ver ? "found" : "latest"); return; }
      setError(String(e?.message || e).slice(0, 240));
      setPhase("error");
    } finally {
      abort.current = null;
    }
  };

  const busy = phase === "check" || phase === "download" || phase === "verify";
  const pct = total > 0 ? Math.min(1, got / total) : 0;
  const eta = speed > 0 && total > got ? Math.ceil((total - got) / speed) : 0;
  const stepIdx = phase === "check" ? 0 : phase === "download" || phase === "verify" ? 1 : 2;

  /* Esc и жест «назад» закрывают экран, как любую подстраницу */
  useSystemBack(true, onBack);

  return (
    <Screen
      title={tr("Обновление")}
      sub={tr("CHUBUGAMES проверяет релизы сама — вот что нашлось")}
      right={
        <button
          type="button"
          onClick={() => { sfx.click(); onBack(); }}
          className="pc-icon-btn"
          aria-label={tr("Закрыть")}
        >
          <Icon name="cross" size={15} />
        </button>
      }
    >
      <div className="pc-upd">
        {/* ─── левая колонка: ступени ─── */}
        <div className="pc-upd-steps" aria-hidden>
          {STEPS.map((s2, i) => {
            const state = i < stepIdx || phase === "install" || phase === "ready"
              ? "done" : i === stepIdx ? "now" : "next";
            return (
              <div key={s2.id} className={`pc-upd-step ${state}`}>
                <span className="pc-upd-step-dot">
                  {state === "done" ? <Icon name="check" size={12} /> : <span className="pc-upd-step-num">{i + 1}</span>}
                </span>
                <span className="pc-upd-step-txt">
                  <span className="t-title-sm">{tr(s2.label)}</span>
                  <span className="t-caption">{tr(s2.hint)}</span>
                </span>
              </div>
            );
          })}
          <div className="pc-upd-ver">
            <span className="t-caption">{tr("сейчас")}</span>
            <span className="t-num">{APP_VERSION}</span>
            {(ver || info?.version) && (
              <>
                <span className="t-caption">{tr("доступно")}</span>
                <span className="t-num acc-text">{ver || info?.version}</span>
              </>
            )}
          </div>
        </div>

        {/* ─── правая колонка: сцена ожидания ─── */}
        <div className="pc-upd-stage glass-card">
          {busy || phase === "install" || phase === "ready" ? (
            <>
              <div className="pc-upd-orbit" aria-hidden>
                <span className="pc-upd-ring" style={{ ["--p" as any]: String(pct) }} />
                <span className="pc-upd-dots"><i /><i /><i /><i /></span>
                <span className="pc-upd-pct t-num">{Math.round(pct * 100)}%</span>
              </div>
              <div className="pc-upd-nums">
                <span className="t-title">{
                  phase === "check" ? tr("Проверяем релизы…")
                  : phase === "verify" ? tr("Сверяем контрольную сумму…")
                  : phase === "install" ? tr("Устанавливается…")
                  : phase === "ready" ? tr("Файл скачан")
                  : tr("Загружаем сборку")
                }</span>
                {phase === "download" && (
                  <span className="t-caption pc-upd-meta">
                    {fmtBytes(got)} / {fmtBytes(total || size)}
                    {speed > 0 && <> · {fmtBytes(speed)}/с</>}
                    {eta > 0 && <> · {tr("осталось")} {eta} {tr("с")}</>}
                  </span>
                )}
                <span className="pc-upd-line" aria-hidden><i style={{ transform: `scaleX(${Math.max(0.02, pct)})` }} /></span>
              </div>
              <motion.p
                key={tip}
                className="t-caption pc-upd-tip"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Icon name="info" size={12} /> {tr(TIPS[tip])}
              </motion.p>
            </>
          ) : phase === "latest" ? (
            <div className="pc-upd-empty">
              <span className="pc-upd-badge ok"><Icon name="check" size={20} /></span>
              <div className="t-title">{tr("У вас свежая версия")}</div>
              <div className="t-caption">{tr("Новее ") + APP_VERSION + " на GitHub нет"}</div>
            </div>
          ) : phase === "error" ? (
            <div className="pc-upd-empty">
              <span className="pc-upd-badge bad"><Icon name="warn" size={20} /></span>
              <div className="t-title">{tr("Не вышло")}</div>
              <div className="t-caption">{error}</div>
              <div className="flex" style={{ gap: 8, marginTop: 14 }}>
                <button type="button" className="pc-upd-btn ghost" onClick={() => { setPhase("check"); (async () => { const r = pc && api?.checkUpdate ? await api.checkUpdate() : null; if (r?.hasUpdate) { setVer(r.version); setSize(r.size || 0); setPhase("found"); } else if (r && !r.hasUpdate) setPhase("latest"); else setPhase("error"); })(); }}>
                  <Icon name="refresh" size={13} /> {tr("Ещё раз")}
                </button>
                <a className="pc-upd-btn ghost" href="https://github.com/kayorissss/CHUBUGAMES/releases" target="_blank" rel="noreferrer">
                  <Icon name="download" size={13} /> {tr("Открыть релизы") }
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="pc-upd-found">
                <span className="pc-upd-badge acc"><Icon name="arrowUp" size={20} /></span>
                <div>
                  <div className="t-display-sm">{tr("Доступна версия")} {ver || info?.version}</div>
                  <div className="t-caption">{tr("версия")} {APP_VERSION} → {ver || info?.version}{size > 0 ? ` · ${fmtBytes(size)}` : ""}</div>
                </div>
              </div>
              {news.length > 0 && (
                <ul className="pc-upd-news">
                  {news.map((n) => (
                    <li key={n.v}>
                      <span className="t-title-sm acc-text">{n.v}</span>
                      <ul>{n.items.map((it) => <li key={it}>{it}</li>)}</ul>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex" style={{ gap: 8, marginTop: 16 }}>
                <button type="button" className="pc-upd-btn primary" onClick={start} disabled={busy}>
                  <Icon name="download" size={13} /> {tr("Скачать и установить")}
                </button>
                <button type="button" className="pc-upd-btn ghost" onClick={() => { sfx.click(); onBack(); }}>
                  {tr("Попозже")}
                </button>
              </div>
            </>
          )}
          {phase === "install" && pc && !portable && (
            <div className="t-caption pc-upd-note">{tr("Игра сейчас закроется, установщик откроется сам.")}</div>
          )}
          {phase === "ready" && (
            <div className="t-caption pc-upd-note">
              {tr("Portable сам себя заменить не может: файл открыт в папке загрузок — положи его туда, где лежал старый, и запусти.")}
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}
