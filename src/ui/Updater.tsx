import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, Button, Bar } from "./Glass";
import { useGame } from "../core/store";
import Icon from "./Icon";
import { sfx, haptic } from "../core/fx";
import {
  APP_VERSION_LABEL,
  checkForUpdate,
  downloadAndInstall,
  fmtBytes,
  installFromFile,
  isNative,
  type UpdateInfo,
} from "../core/updater";

type Phase = "idle" | "checking" | "found" | "fresh" | "downloading" | "installing";

export default function Updater() {
  const { toast } = useGame();
  const [phase, setPhase] = useState<Phase>("idle");
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pct = total > 0 ? loaded / total : 0;

  const check = async () => {
    setErr(null);
    setPhase("checking");
    try {
      const found = await checkForUpdate();
      if (found) {
        setInfo(found);
        setPhase("found");
        sfx.legend?.();
        haptic("success");
      } else {
        setPhase("fresh");
        sfx.click();
        toast({ title: "У тебя последняя версия", icon: "check" });
      }
    } catch (e: any) {
      setPhase("idle");
      setErr(e?.message || "Не получилось проверить");
      sfx.error?.();
    }
  };

  const download = async () => {
    if (!info) return;
    setErr(null);
    setLoaded(0);
    setTotal(info.size || 0);
    setPhase("downloading");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await downloadAndInstall(
        info,
        (l, t) => { setLoaded(l); if (t) setTotal(t); },
        ac.signal,
      );
      setPhase("installing");
      haptic("success");
      toast({ title: "Открываю установщик", sub: "Разреши установку", icon: "case", tone: "gold" });
    } catch (e: any) {
      if (e?.name === "AbortError") { setPhase("found"); return; }
      setPhase("found");
      setErr(e?.message || "Загрузка не удалась");
      sfx.error?.();
    } finally {
      abortRef.current = null;
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setPhase("found");
  };

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr(null);
    try {
      setPhase("installing");
      await installFromFile(f);
      toast({ title: "Открываю установщик", sub: f.name, icon: "case", tone: "gold" });
    } catch (e2: any) {
      setPhase("idle");
      setErr(e2?.message || "Не удалось открыть файл");
      sfx.error?.();
    }
  };

  const busy = phase === "checking" || phase === "downloading";

  return (
    <Card r="lg" style={{ padding: 14 }}>
      <div className="flex items-center justify-between" style={{ gap: 12 }}>
        <span
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 36, height: 36, borderRadius: "var(--r-sm)",
            background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
            color: phase === "found" ? "var(--acc)" : phase === "fresh" ? "#59ff9e" : "var(--text-mute)",
          }}
        >
          <Icon
            name={phase === "found" ? "download" : phase === "fresh" ? "check" : "refresh"}
            size={17}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="t-title-sm">Версия {APP_VERSION_LABEL}</div>
          <div className="t-caption" style={{ marginTop: 2 }}>
            {phase === "found" && info
              ? `Доступна ${info.version}`
              : phase === "fresh"
                ? "Обновлений нет"
                : "Проверь наличие новой сборки"}
          </div>
        </div>
        {phase === "found" ? (
          <span
            className="t-label shrink-0"
            style={{
              padding: "5px 10px", borderRadius: 999,
              background: "var(--acc)", color: "var(--acc-ink)", fontSize: 9,
            }}
          >
            Новое
          </span>
        ) : null}
      </div>

      {/* Что нового */}
      <AnimatePresence initial={false}>
        {phase === "found" && info && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="t-body"
              style={{
                marginTop: 12, padding: "11px 13px",
                borderRadius: "var(--r-md)", background: "var(--btn-bg)",
                whiteSpace: "pre-line", maxHeight: 132, overflowY: "auto",
              }}
            >
              {info.notes || "Улучшения и исправления."}
            </div>
            <div className="t-caption" style={{ marginTop: 8 }}>
              Размер загрузки — {fmtBytes(info.size)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Прогресс */}
      <AnimatePresence initial={false}>
        {phase === "downloading" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ marginTop: 14 }}>
              <div
                className="flex items-baseline justify-between"
                style={{ gap: 8, marginBottom: 7 }}
              >
                <span className="t-label">Скачивание</span>
                <span className="t-num" style={{ fontSize: 12 }}>
                  {total ? `${Math.round(pct * 100)}%` : fmtBytes(loaded)}
                </span>
              </div>
              <Bar pct={total ? pct : 0.06} h={7} />
              <div className="t-caption" style={{ marginTop: 7 }}>
                {fmtBytes(loaded)}{total ? ` из ${fmtBytes(total)}` : ""}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {err && (
        <div
          className="t-body"
          style={{
            marginTop: 12, padding: "10px 12px", borderRadius: "var(--r-md)",
            background: "var(--btn-bg)", color: "var(--danger)",
          }}
        >
          {err}
        </div>
      )}

      {/* Кнопки */}
      <div className="flex" style={{ gap: 8, marginTop: 14 }}>
        {phase === "downloading" ? (
          <Button variant="secondary" full onClick={cancel} sound="none">
            Отменить
          </Button>
        ) : phase === "found" ? (
          <Button variant="primary" full onClick={download} sound="power">
            <span className="inline-flex items-center" style={{ gap: 8 }}><Icon name="download" size={15} /> Скачать и установить</span>
          </Button>
        ) : (
          <Button
            variant="primary"
            full
            disabled={busy}
            onClick={check}
            sound="click"
          >
            {phase === "checking" ? "Проверяю…" : "Проверить обновление"}
          </Button>
        )}
      </div>

      <div className="flex" style={{ gap: 8, marginTop: 8 }}>
        <Button
          variant="secondary"
          full
          disabled={busy}
          sound="none"
          onClick={() => fileRef.current?.click()}
        >
          <span className="inline-flex items-center" style={{ gap: 8 }}><Icon name="case" size={15} /> Обновить из файла</span>
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".apk,application/vnd.android.package-archive"
          hidden
          onChange={pickFile}
        />
      </div>

      <div className="t-caption" style={{ marginTop: 10, lineHeight: 1.5 }}>
        {isNative()
          ? "Интернет нужен только на время загрузки обновления. Сами игры работают офлайн."
          : "Установка APK доступна только в приложении на Android."}
      </div>
    </Card>
  );
}
