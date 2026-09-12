import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Panel, Tap } from "./Glass";
import Icon from "./Icon";
import { tr } from "../core/i18n";
import { fmt } from "../core/format";
import { sfx, haptic } from "../core/fx";
import { isDesktop } from "../core/desktop";
import { useGame } from "../core/store";
import {
  applyStage, readStage, writeStage,
  type UiScaleMode, type StageSettings,
} from "../core/stage";
import {
  measuredVerdict, readQuality, remeasureNow, renderScaleInfo, writeQuality,
  type Quality,
} from "../core/perf";

/**
 * НАСТРОЙКИ ПК-ВЕРСИИ: размер картинки, режим экрана и обновление.
 *
 * Показывается только в десктопной сборке — на телефоне этот блок
 * не имеет смысла и не рендерится.
 */

/*
 * Качество картинки. Одна ручка вместо двух («эффекты» и «разрешение»):
 * «Авто» доверяет замеру, «Красиво» и «Эко» включают или выключают тяжёлые
 * фильтры руками.
 */
const QUALITY: { id: Quality; label: string; hint: string }[] = [
  { id: "auto", label: "Авто", hint: "Как решит замер: держит 45+ FPS" },
  { id: "full", label: "Красиво", hint: "Свечения, блики, полное разрешение" },
  { id: "eco", label: "Эко", hint: "Максимум кадров: без фильтров, картинка проще" },
];

type Upd =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "none"; current: string }
  | { state: "found"; version: string; size: number; notes: string; portable: boolean }
  | { state: "downloading"; percent: number; received: number; total: number }
  | { state: "ready"; portable: boolean }
  | { state: "error"; error: string };

const MODES: { id: UiScaleMode; label: string; hint: string }[] = [
  { id: "auto", label: "Авто", hint: "Крупность подбирается по размеру окна" },
  { id: "manual", label: "Вручную", hint: "Свой масштаб, Ctrl и +/−" },
];

/**
 * part: "all" — как раньше, оба блока подряд (для телефона и для списков);
 * "screen" / "update" — один из двух. Нужно для компьютерной раскладки:
 * там «Экран» живёт в левой колонке настроек, а «Обновление» — в правой
 * сверху, и держать их в одном <Panel> больше нельзя.
 */
export default function DesktopSettings({
  part = "all",
}: {
  part?: "all" | "screen" | "update" | "perf";
}) {
  const [st, setSt] = useState<StageSettings>(() => readStage());
  const [scale, setScale] = useState(1);
  const [full, setFull] = useState(false);
  const [upd, setUpd] = useState<Upd>({ state: "idle" });
  const [screenInfo, setScreenInfo] = useState<{ width: number; height: number } | null>(null);
  const [q, setQ] = useState<Quality>(() => readQuality());
  const [weak, setWeak] = useState<boolean | null>(() => measuredVerdict());
  const [measuring, setMeasuring] = useState(false);

  const api = (window as any).chubDesktop;
  const { toast } = useGame();

  useEffect(() => {
    setScale(applyStage(st));
  }, [st]);

  useEffect(() => {
    api?.screenInfo?.().then(setScreenInfo).catch(() => {});
    api?.isFullscreen?.().then(setFull).catch(() => {});
  }, [api]);

  if (!isDesktop()) return null;

  /* размер окна → что реально рисует канвас (core/perf.ts) */
  const rs = renderScaleInfo(window.innerWidth, window.innerHeight);
  const mpix = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} млн` : `${Math.round(n / 1000)} тыс.`);

  const save = (patch: Partial<StageSettings>) => {
    const next = { ...st, ...patch };
    writeStage(next);
    setSt(next);
    sfx.click();
    haptic("light");
  };

  const check = async () => {
    if (!api?.checkUpdate) return;
    setUpd({ state: "checking" });
    const r = await api.checkUpdate();
    if (!r?.ok) return setUpd({ state: "error", error: r?.error || tr("не вышло") });
    if (!r.hasUpdate) return setUpd({ state: "none", current: r.current });
    setUpd({ state: "found", version: r.version, size: r.size, notes: r.notes, portable: !!r.portable });
  };

  const install = async () => {
    if (!api?.downloadUpdate) return;
    setUpd({ state: "downloading", percent: 0, received: 0, total: 0 });
    const r = await api.downloadUpdate((pr: any) => {
      setUpd({ state: "downloading", percent: pr.percent, received: pr.received, total: pr.total });
    });
    if (!r?.ok) setUpd({ state: "error", error: r?.error || tr("не вышло") });
    else if (r.portable) setUpd({ state: "ready", portable: true });
  };

  return (
    <>
      {/* ─── Экран ─── */}
      {(part === "all" || part === "screen") && (
      <Panel r="lg" style={{ padding: 14, marginBottom: 10 }}>
        <div className="flex items-center" style={{ gap: 9, marginBottom: 12 }}>
          <span style={{ color: "var(--acc)", lineHeight: 0 }}>
            <Icon name="speed" size={16} />
          </span>
          <span className="t-title-sm flex-1">{tr("Экран")}</span>
          <span className="t-num" style={{ fontSize: 11, color: "var(--text-mute)" }}>
            ×{scale.toFixed(2)}
          </span>
        </div>

        {/* Режим отображения */}
        <div className="t-label" style={{ fontSize: 8.5, marginBottom: 7 }}>
          {tr("РЕЖИМ")}
        </div>
        <div className="flex" style={{ gap: 6, marginBottom: 6 }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => save({ mode: m.id })}
              className="t-label flex-1"
              style={{
                padding: "9px 4px", fontSize: 9, borderRadius: "var(--r-sm)",
                background: st.mode === m.id ? "var(--acc)" : "var(--surface-2)",
                color: st.mode === m.id ? "var(--acc-ink)" : "var(--text-dim)",
                border: `1px solid ${st.mode === m.id ? "var(--acc)" : "var(--surface-brd)"}`,
              }}
            >
              {tr(m.label)}
            </button>
          ))}
        </div>
        <div className="t-caption" style={{ fontSize: 9.5, marginBottom: 12 }}>
          {tr(MODES.find((m) => m.id === st.mode)?.hint || "")}
        </div>

        {/* Ручной масштаб */}
        {st.mode === "manual" && (
          <div className="flex items-center" style={{ gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => save({ zoom: Math.max(0.8, +(st.zoom - 0.05).toFixed(2)) })}
              className="t-num"
              style={{
                width: 34, height: 34, borderRadius: "var(--r-sm)",
                background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
              }}
            >−</button>
            <span className="t-num flex-1 text-center" style={{ fontSize: 14 }}>
              {Math.round(st.zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => save({ zoom: Math.min(1.6, +(st.zoom + 0.05).toFixed(2)) })}
              className="t-num"
              style={{
                width: 34, height: 34, borderRadius: "var(--r-sm)",
                background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
              }}
            >+</button>
          </div>
        )}

        {/* Действия с окном */}
        <div className="flex" style={{ gap: 7, marginTop: 10 }}>
          <Tap
            onClick={async () => {
              const next = await api?.toggleFullscreen?.();
              setFull(!!next);
            }}
            r="sm" center className="t-label flex-1"
            style={{ padding: "10px 0", fontSize: 9.5 }}
            sound="click"
          >
            {full ? tr("ОКОННЫЙ РЕЖИМ") : tr("ПОЛНЫЙ ЭКРАН")}
          </Tap>
          <Tap
            onClick={() => api?.resizeTo?.(1440, 900)}
            r="sm" center className="t-label flex-1"
            style={{ padding: "10px 0", fontSize: 9.5 }}
            sound="click"
          >
            {tr("СБРОСИТЬ ОКНО")}
          </Tap>
        </div>

        {screenInfo && (
          <div className="t-caption" style={{ marginTop: 9, fontSize: 9.5 }}>
            {tr("Монитор")}: {screenInfo.width} × {screenInfo.height} · F11 — {tr("полный экран")}
          </div>
        )}
      </Panel>
      )}

      {/* ─── Производительность ─── */}
      {(part === "perf" || part === "all") && (
      <Panel r="lg" style={{ padding: 14, marginBottom: 10 }}>
        <div className="flex items-center" style={{ gap: 9, marginBottom: 11 }}>
          <span style={{ color: "var(--acc)", lineHeight: 0 }}>
            <Icon name="speed" size={16} />
          </span>
          <span className="t-title-sm flex-1">{tr("Производительность")}</span>
          <span
            className="t-label"
            style={{
              fontSize: 8.5, padding: "3px 7px", borderRadius: 999,
              background: q === "eco" || weak ? "var(--surface-3)" : "var(--acc)",
              color: q === "eco" || weak ? "var(--text-dim)" : "var(--acc-ink)",
            }}
          >
            {measuring ? tr("замер…")
              : q === "full" ? tr("КРАСОТА")
                : q === "eco" ? tr("ЭКО")
                  : weak === null ? tr("НЕТ ЗАМЕРА")
                    : weak ? tr("СЛАБОЕ ЖЕЛЕЗО") : tr("ТЯНЕТ")}
          </span>
        </div>

        <div className="flex" style={{ gap: 6, marginBottom: 8 }}>
          {QUALITY.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                writeQuality(o.id);
                setQ(o.id);
                sfx.click();
                haptic("light");
              }}
              className="t-label flex-1"
              style={{
                padding: "9px 4px", fontSize: 9, borderRadius: "var(--r-sm)",
                background: q === o.id ? "var(--acc)" : "var(--surface-2)",
                color: q === o.id ? "var(--acc-ink)" : "var(--text-dim)",
                border: `1px solid ${q === o.id ? "var(--acc)" : "var(--surface-brd)"}`,
              }}
            >
              {tr(o.label)}
            </button>
          ))}
        </div>
        <div className="t-caption" style={{ fontSize: 9.5, marginBottom: 10 }}>
          {tr(QUALITY.find((o) => o.id === q)?.hint || "")}
        </div>

        <div className="t-caption" style={{ fontSize: 9.5, lineHeight: 1.55 }}>
          {tr("Игра рисуется в")} {Math.round(window.innerWidth * rs.scale)} ×{" "}
          {Math.round(window.innerHeight * rs.scale)} — {mpix(rs.px)} {tr("пикселей на кадр")}{" "}
          <span style={{ opacity: 0.6 }}>({Math.round(rs.scale * 100)}%)</span>
          {rs.adapt < 0.99 && (
            <div className="t-caption" style={{ fontSize: 9, marginTop: 4, opacity: 0.8 }}>
              {tr("Кадров не хватало — разрешение убрано до")} {Math.round(rs.adapt * 100)}%. {tr("Это подстраивается само во время игры.")}
            </div>
          )}
        </div>

        <Tap
          onClick={() => {
            setMeasuring(true);
            sfx.click();
            remeasureNow((low) => {
              setWeak(low);
              setMeasuring(false);
              setQ("auto");
              toast({
              title: low ? tr("Железо не тянет — включён лёгкий режим") : tr("Тянет: полный режим"),
              sub: low
                ? tr("Убрали свечения и уменьшили разрешение канваса")
                : tr("Кадров хватает, ничего не отключаем"),
              icon: low ? "speed" : "check",
              tone: low ? "bad" : "gold",
            });
            });
          }}
          r="sm" center className="w-full t-label"
          style={{ padding: "10px 0", fontSize: 9.5, marginTop: 10 }}
          disabled={measuring}
          sound="click"
        >
          {measuring ? tr("ИДУТ ЗАМЕРЫ…") : tr("ЗАМЕРИТЬ ЗАНОВО")}
        </Tap>
        <div className="t-caption" style={{ fontSize: 9, marginTop: 7, opacity: 0.75 }}>
          {tr("Замер смотрит, сколько кадров держит это окно, и сам выбирает режим. 3 секунды.")}
        </div>
      </Panel>
      )}

      {/* ─── Обновление ─── */}
      {part !== "screen" && part !== "perf" && (
      <Panel r="lg" style={{ padding: 14, marginBottom: 10 }}>
        <div className="flex items-center" style={{ gap: 9, marginBottom: 11 }}>
          <span style={{ color: "var(--ok)", lineHeight: 0 }}>
            <Icon name="download" size={16} />
          </span>
          <span className="t-title-sm flex-1">{tr("Обновление")}</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={upd.state}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {upd.state === "downloading" ? (
              <>
                <div
                  style={{
                    height: 6, borderRadius: 99, overflow: "hidden",
                    background: "var(--surface-3)", marginBottom: 7,
                  }}
                >
                  <div
                    style={{
                      height: "100%", width: `${upd.percent}%`,
                      background: "var(--ok)", transition: "width .2s",
                    }}
                  />
                </div>
                <div className="t-caption" style={{ fontSize: 10 }}>
                  {tr("Скачивание")} {upd.percent}%
                  {upd.total > 0 && ` · ${fmt(Math.round(upd.received / 1048576))} / ${fmt(Math.round(upd.total / 1048576))} МБ`}
                </div>
                <div className="t-caption" style={{ fontSize: 9.5, marginTop: 5 }}>
                  {tr("После загрузки откроется установщик, игра закроется сама")}
                </div>
              </>
            ) : upd.state === "ready" ? (
              <div className="t-caption" style={{ fontSize: 10.5, lineHeight: 1.5 }}>
                {tr("Новый файл скачан и показан в проводнике. Portable-версия не может заменить сама себя — просто положи новый exe вместо старого.")}
              </div>
            ) : upd.state === "found" ? (
              <>
                <div className="t-body" style={{ fontSize: 12, marginBottom: 4 }}>
                  {tr("Есть новая версия")} {upd.version}
                </div>
                <div className="t-caption" style={{ fontSize: 9.5, marginBottom: 9 }}>
                  {Math.round(upd.size / 1048576)} МБ ·{" "}
                  {upd.portable ? tr("portable-сборка") : tr("установщик")}
                </div>
                <Tap
                  onClick={install}
                  accent r="sm" center className="w-full t-title"
                  style={{ padding: "11px 0", fontSize: 12 }}
                  sound="coin"
                >
                  {tr("СКАЧАТЬ И УСТАНОВИТЬ")}
                </Tap>
              </>
            ) : (
              <>
                <div className="t-caption" style={{ fontSize: 10, marginBottom: 9 }}>
                  {upd.state === "checking" ? tr("Проверяю…")
                    : upd.state === "none" ? `${tr("Установлена последняя версия")} ${upd.current}`
                      : upd.state === "error" ? `${tr("Ошибка")}: ${upd.error}`
                        : tr("Проверить, вышла ли новая версия для компьютера")}
                </div>
                <Tap
                  onClick={check}
                  r="sm" center className="w-full t-label"
                  style={{ padding: "11px 0", fontSize: 10 }}
                  disabled={upd.state === "checking"}
                  sound="click"
                >
                  {tr("ПРОВЕРИТЬ ОБНОВЛЕНИЕ")}
                </Tap>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </Panel>
      )}
    </>
  );
}
