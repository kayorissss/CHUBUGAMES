import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Panel, Tap } from "./Glass";
import Icon from "./Icon";
import { tr } from "../core/i18n";
import { fmt } from "../core/format";
import { sfx, haptic } from "../core/fx";
import { isDesktop } from "../core/desktop";
import {
  applyStage, readStage, writeStage,
  type UiScaleMode, type StageSettings,
} from "../core/stage";

/**
 * НАСТРОЙКИ ПК-ВЕРСИИ: размер картинки, режим экрана и обновление.
 *
 * Показывается только в десктопной сборке — на телефоне этот блок
 * не имеет смысла и не рендерится.
 */

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

export default function DesktopSettings() {
  const [st, setSt] = useState<StageSettings>(() => readStage());
  const [scale, setScale] = useState(1);
  const [full, setFull] = useState(false);
  const [upd, setUpd] = useState<Upd>({ state: "idle" });
  const [screenInfo, setScreenInfo] = useState<{ width: number; height: number } | null>(null);

  const api = (window as any).chubDesktop;

  useEffect(() => {
    setScale(applyStage(st));
  }, [st]);

  useEffect(() => {
    api?.screenInfo?.().then(setScreenInfo).catch(() => {});
    api?.isFullscreen?.().then(setFull).catch(() => {});
  }, [api]);

  if (!isDesktop()) return null;

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

      {/* ─── Обновление ─── */}
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
    </>
  );
}
