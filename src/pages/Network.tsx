import { useRef, useState } from "react";
import { tr } from "../core/i18n";
import { AnimatePresence, motion } from "framer-motion";
import { Card, Screen, Divider } from "../ui/Glass";
import Icon from "../ui/Icon";
import { sfx, haptic } from "../core/fx";
import {
  measureSpeed, runNetCheck, fmtBytesShort,
  type NetVerdict, type SpeedResult,
} from "../core/netcheck";

type Tab = "block" | "speed";

const COLOR: Record<NetVerdict["status"], string> = {
  ok: "var(--ok)",
  throttled: "#ffb020",
  blocked: "#ff5a3c",
  offline: "#8f8f9c",
};

export default function Network({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("block");

  return (
    <Screen
      title={tr("ИНТЕРНЕТ")}
      sub={tr("Глушилки и скорость")}
      right={
        <button
          type="button"
          onClick={() => { sfx.click(); onBack(); }}
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 34, height: 34, borderRadius: "var(--r-sm)",
            background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
          }}
        >
          <Icon name="cross" size={15} />
        </button>
      }
    >
      {/* Вкладки */}
      <div
        className="flex"
        style={{
          gap: 4, padding: 4, marginBottom: 16,
          background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
          borderRadius: "var(--r-md)",
        }}
      >
        {([["block", tr("ГЛУШИЛКИ"), "shield"], ["speed", tr("СКОРОСТЬ"), "speed"]] as const).map(
          ([id, label, icon]) => {
            const on = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => { sfx.click(); haptic("light"); setTab(id); }}
                className="flex-1 t-title-sm flex items-center justify-center"
                style={{
                  gap: 7, padding: "10px 8px", borderRadius: "var(--r-sm)",
                  background: on ? "var(--acc)" : "transparent",
                  color: on ? "var(--acc-ink)" : "var(--text-mute)",
                  fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
                  transition: "background 0.16s, color 0.16s",
                }}
              >
                <Icon name={icon} size={14} /> {label}
              </button>
            );
          },
        )}
      </div>

      <AnimatePresence mode="wait">
        {tab === "block" ? (
          <motion.div
            key="block"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
          >
            <BlockCheck />
          </motion.div>
        ) : (
          <motion.div
            key="speed"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.18 }}
          >
            <SpeedTest />
          </motion.div>
        )}
      </AnimatePresence>
    </Screen>
  );
}

/* ================= ВКЛАДКА: ГЛУШИЛКИ ================= */

function BlockCheck() {
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState<NetVerdict | null>(null);

  const check = async () => {
    setBusy(true);
    setV(null);
    sfx.click();
    const res = await runNetCheck();
    setV(res);
    setBusy(false);
    haptic(res.status === "ok" ? "success" : "error");
    if (res.status === "ok") sfx.achieve?.();
    else sfx.error?.();
  };

  const ru = v?.probes.filter((p) => p.group === "ru") || [];
  const world = v?.probes.filter((p) => p.group === "world") || [];

  return (
    <>
      <Card r="lg" style={{ padding: 14, marginBottom: 14 }}>
        <div className="t-body" style={{ lineHeight: 1.55 }}>
          Проверка сравнивает российские сервисы с зарубежными. Если работают
          только «белые» — интернет режут.
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={check}
          className="w-full t-title-sm"
          style={{
            marginTop: 13, padding: "13px 0", borderRadius: "var(--r-md)",
            background: "var(--acc)", color: "var(--acc-ink)",
            fontWeight: 700, opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "ПРОВЕРЯЮ…" : v ? "ПРОВЕРИТЬ ЕЩЁ РАЗ" : tr("ПРОВЕРИТЬ")}
        </button>
      </Card>

      {busy && <Pinging />}

      <AnimatePresence>
        {v && !busy && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {/* Вердикт */}
            <motion.div
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 340, damping: 22 }}
              style={{
                padding: "16px 15px", marginBottom: 14,
                borderRadius: "var(--r-lg)",
                background: `${COLOR[v.status]}14`,
                border: `1.5px solid ${COLOR[v.status]}66`,
              }}
            >
              <div className="flex items-center" style={{ gap: 10 }}>
                <span style={{ color: COLOR[v.status], lineHeight: 0 }}>
                  <Icon name={v.status === "ok" ? "check" : v.status === "offline" ? "cross" : "warn"} size={22} />
                </span>
                <div
                  className="t-title"
                  style={{ color: COLOR[v.status], fontSize: 19, letterSpacing: "0.02em" }}
                >
                  {v.title}
                </div>
              </div>
              <div className="t-body" style={{ marginTop: 8, lineHeight: 1.55 }}>
                {v.detail}
              </div>
            </motion.div>

            {/* Группы */}
            <GroupCard
              title={tr("РОССИЙСКИЕ СЕРВИСЫ")}
              hint={tr("Обычно доступны всегда")}
              probes={ru}
              ok={v.ruOk}
              total={v.ruTotal}
              avg={v.ruAvg}
            />
            <GroupCard
              title={tr("ЗАРУБЕЖНЫЕ СЕРВИСЫ")}
              hint={tr("Первыми отваливаются при шейпинге")}
              probes={world}
              ok={v.worldOk}
              total={v.worldTotal}
              avg={v.worldAvg}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Pinging() {
  return (
    <Card r="lg" style={{ padding: 22 }}>
      <div className="flex flex-col items-center">
        <motion.div
          animate={{ scale: [1, 1.14, 1], opacity: [0.55, 1, 0.55] }}
          transition={{ repeat: Infinity, duration: 1.3, ease: "easeInOut" }}
          style={{ color: "var(--acc)" }}
        >
          <Icon name="wifi" size={38} />
        </motion.div>
        <div className="t-title-sm" style={{ marginTop: 12 }}>{tr("Пингую хосты")}</div>
        <div className="t-caption" style={{ marginTop: 4 }}>{tr("это займёт пару секунд")}</div>
      </div>
    </Card>
  );
}

function GroupCard({
  title, hint, probes, ok, total, avg,
}: {
  title: string; hint: string;
  probes: NetVerdict["probes"]; ok: number; total: number; avg: number | null;
}) {
  const c = ok === 0 ? "#ff5a3c" : ok === total ? "var(--ok)" : "#ffb020";
  return (
    <Card r="lg" style={{ padding: 0, marginBottom: 14, overflow: "hidden" }}>
      <div style={{ padding: "13px 14px" }}>
        <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
          <div className="t-label" style={{ fontSize: 9.5 }}>{title}</div>
          <div className="t-num shrink-0" style={{ fontSize: 15, color: c }}>
            {ok}/{total}
          </div>
        </div>
        <div className="flex items-baseline justify-between" style={{ marginTop: 3, gap: 10 }}>
          <div className="t-caption">{hint}</div>
          <div className="t-caption shrink-0">
            {avg !== null ? `в среднем ${avg} мс` : tr("нет ответа")}
          </div>
        </div>
      </div>
      <Divider />
      {probes.map((p, i) => (
        <div key={p.id}>
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between"
            style={{ padding: "10px 14px", gap: 10 }}
          >
            <span className="t-body clip1">{p.name}</span>
            <span className="flex items-center shrink-0" style={{ gap: 7 }}>
              {p.ok ? (
                <>
                  <PingBars ms={p.ms || 0} />
                  <span className="t-num" style={{ fontSize: 11.5, color: "var(--ok)", minWidth: 44, textAlign: "right" }}>
                    {p.ms} мс
                  </span>
                </>
              ) : (
                <span className="t-num" style={{ fontSize: 11.5, color: "#ff5a3c" }}>{tr("нет связи")}</span>
              )}
            </span>
          </motion.div>
          {i < probes.length - 1 && <Divider inset={14} />}
        </div>
      ))}
    </Card>
  );
}

/** Полоски качества связи по пингу */
function PingBars({ ms }: { ms: number }) {
  const level = ms < 120 ? 3 : ms < 400 ? 2 : 1;
  const c = level === 3 ? "var(--ok)" : level === 2 ? "#ffb020" : "#ff5a3c";
  return (
    <span className="flex items-end" style={{ gap: 2, height: 12 }}>
      {[6, 9, 12].map((h, i) => (
        <span
          key={h}
          style={{
            width: 3, height: h, borderRadius: 1,
            background: i < level ? c : "var(--btn-brd)",
          }}
        />
      ))}
    </span>
  );
}

/* ================= ВКЛАДКА: СКОРОСТЬ ================= */

function SpeedTest() {
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [res, setRes] = useState<SpeedResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ac = useRef<AbortController | null>(null);

  const run = async () => {
    setBusy(true);
    setRes(null);
    setErr(null);
    setLive(0);
    setLoaded(0);
    sfx.click();
    ac.current = new AbortController();
    const r = await measureSpeed((b, mbps) => {
      setLoaded(b);
      setLive(mbps);
    }, ac.current.signal);
    setBusy(false);
    if (r) {
      setRes(r);
      haptic("success");
      sfx.achieve?.();
    } else {
      setErr(tr("Не удалось замерить. Проверь, есть ли вообще интернет."));
      haptic("error");
    }
  };

  // стрелка спидометра: 0..100 Мбит/с на 240 градусов
  const shown = res ? res.mbps : live;
  const angle = -120 + Math.min(1, Math.log10(1 + shown) / Math.log10(101)) * 240;

  return (
    <>
      <Card r="lg" style={{ padding: 18, marginBottom: 14 }}>
        <div className="flex flex-col items-center">
          {/* Спидометр */}
          <div style={{ position: "relative", width: 200, height: 122 }}>
            <svg width="200" height="122" viewBox="0 0 200 122">
              <path
                d="M18 112 A 82 82 0 0 1 182 112"
                fill="none" stroke="var(--btn-brd)" strokeWidth="11" strokeLinecap="round"
              />
              <motion.path
                d="M18 112 A 82 82 0 0 1 182 112"
                fill="none" stroke="var(--acc)" strokeWidth="11" strokeLinecap="round"
                strokeDasharray="258"
                animate={{
                  strokeDashoffset: 258 - (Math.min(1, Math.log10(1 + shown) / Math.log10(101))) * 258,
                }}
                transition={{ type: "spring", stiffness: 90, damping: 18 }}
              />
              <motion.line
                x1="100" y1="112" x2="100" y2="44"
                stroke="var(--text)" strokeWidth="3" strokeLinecap="round"
                style={{ originX: "100px", originY: "112px" }}
                animate={{ rotate: angle }}
                transition={{ type: "spring", stiffness: 90, damping: 16 }}
              />
              <circle cx="100" cy="112" r="6" fill="var(--text)" />
            </svg>
            {busy && (
              <motion.div
                className="absolute inset-0"
                animate={{ opacity: [0.3, 0.9, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.1 }}
                style={{ pointerEvents: "none" }}
              />
            )}
          </div>

          <div className="t-num" style={{ fontSize: 34, marginTop: 2, lineHeight: 1 }}>
            {shown > 0 ? shown.toFixed(1) : "—"}
          </div>
          <div className="t-label" style={{ marginTop: 5 }}>{tr("МБИТ/С")}</div>

          {busy && (
            <div className="t-caption" style={{ marginTop: 9 }}>
              скачано {fmtBytesShort(loaded)}
            </div>
          )}

          {res && !busy && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="t-body text-center"
              style={{ marginTop: 11, lineHeight: 1.5 }}
            >
              {res.verdict}
            </motion.div>
          )}

          {err && (
            <div className="t-caption text-center" style={{ marginTop: 11, color: "var(--danger)" }}>
              {err}
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={run}
            className="w-full t-title-sm"
            style={{
              marginTop: 16, padding: "13px 0", borderRadius: "var(--r-md)",
              background: "var(--acc)", color: "var(--acc-ink)",
              fontWeight: 700, opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "ИЗМЕРЯЮ…" : res ? "ЗАМЕРИТЬ СНОВА" : tr("ЗАМЕРИТЬ СКОРОСТЬ")}
          </button>
        </div>
      </Card>

      {res && !busy && (
        <Card r="lg" style={{ padding: 0, overflow: "hidden" }}>
          {([
            [tr("Скорость"), `${res.mbps} Мбит/с`],
            [tr("Скачано"), fmtBytesShort(res.bytes)],
            [tr("Время замера"), `${(res.ms / 1000).toFixed(1)} с`],
            [tr("Хватит на"), res.mbps >= 20 ? "видео 1080p" : res.mbps >= 8 ? "видео 720p" : res.mbps >= 3 ? "музыку и соцсети" : tr("только текст")],
          ] as const).map(([k, val], i, arr) => (
            <div key={k}>
              <div className="flex items-center justify-between" style={{ padding: "12px 14px", gap: 10 }}>
                <span className="t-body">{k}</span>
                <span className="t-num" style={{ fontSize: 13 }}>{val}</span>
              </div>
              {i < arr.length - 1 && <Divider inset={14} />}
            </div>
          ))}
        </Card>
      )}

      <div className="t-caption" style={{ marginTop: 12, lineHeight: 1.5, padding: "0 2px" }}>
        Замер качает файлы с российских CDN в несколько потоков и отбрасывает
        первые доли секунды, пока соединение разгоняется. Цифра близка к
        Спидтесту, но может отличаться на нестабильной мобильной сети.
      </div>
    </>
  );
}
