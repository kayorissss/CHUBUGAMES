import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, Button, Divider } from "./Glass";
import { sfx, haptic } from "../core/fx";
import { measureSpeed, runNetCheck, type NetVerdict } from "../core/netcheck";

const COLOR: Record<NetVerdict["status"], string> = {
  ok: "#59ff9e",
  throttled: "#ffb020",
  blocked: "#ff5a3c",
  offline: "#8f8f9c",
};

export default function NetCheck() {
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState<NetVerdict | null>(null);
  const [speed, setSpeed] = useState<{ mbps: number } | null>(null);
  const [speedBusy, setSpeedBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    setV(null);
    setSpeed(null);
    sfx.click();
    const res = await runNetCheck();
    setV(res);
    setBusy(false);
    haptic(res.status === "ok" ? "success" : "error");
    if (res.status === "ok") sfx.achieve?.();
    else sfx.error?.();
  };

  const testSpeed = async () => {
    setSpeedBusy(true);
    setSpeed(null);
    const r = await measureSpeed();
    setSpeed(r ? { mbps: r.mbps } : null);
    setSpeedBusy(false);
    if (r) haptic("light");
  };

  return (
    <Card r="lg" style={{ padding: 14 }}>
      <div className="t-title-sm">Проверка глушилок</div>
      <div className="t-caption" style={{ marginTop: 3, lineHeight: 1.5 }}>
        Сравнивает доступность российских и зарубежных сервисов.
        Если работают только «белые» — интернет режут.
      </div>

      <AnimatePresence>
        {v && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            {/* Вердикт */}
            <div
              style={{
                marginTop: 14,
                padding: "13px 14px",
                borderRadius: "var(--r-md)",
                background: `${COLOR[v.status]}14`,
                border: `1px solid ${COLOR[v.status]}55`,
              }}
            >
              <div
                className="t-title-sm"
                style={{ color: COLOR[v.status], letterSpacing: "0.02em" }}
              >
                {v.title}
              </div>
              <div className="t-caption" style={{ marginTop: 5, lineHeight: 1.5 }}>
                {v.detail}
              </div>
            </div>

            {/* Сводка по группам */}
            <div className="grid grid-cols-2" style={{ gap: 10, marginTop: 12 }}>
              <GroupBox
                label="Российские"
                ok={v.ruOk}
                total={v.ruTotal}
                ms={v.ruAvg}
              />
              <GroupBox
                label="Зарубежные"
                ok={v.worldOk}
                total={v.worldTotal}
                ms={v.worldAvg}
              />
            </div>

            {/* Детализация */}
            <div
              style={{
                marginTop: 12,
                borderRadius: "var(--r-md)",
                background: "var(--btn-bg)",
                overflow: "hidden",
              }}
            >
              {v.probes.map((p, i) => (
                <div key={p.id}>
                  <div
                    className="flex items-center justify-between"
                    style={{ padding: "9px 12px", gap: 10 }}
                  >
                    <span className="t-body clip1">
                      {p.name}
                      <span className="t-caption" style={{ marginLeft: 6 }}>
                        {p.group === "ru" ? "РФ" : "мир"}
                      </span>
                    </span>
                    <span
                      className="t-num shrink-0"
                      style={{ fontSize: 11.5, color: p.ok ? "#59ff9e" : "#ff5a3c" }}
                    >
                      {p.ok ? `${p.ms} мс` : "нет"}
                    </span>
                  </div>
                  {i < v.probes.length - 1 && <Divider inset={12} />}
                </div>
              ))}
            </div>

            {/* Скорость */}
            <div className="flex items-center" style={{ gap: 10, marginTop: 12 }}>
              <Button
                variant="secondary"
                size="sm"
                sound="none"
                disabled={speedBusy}
                onClick={testSpeed}
              >
                {speedBusy ? "Измеряю…" : "Замерить скорость"}
              </Button>
              {speed && (
                <span className="t-num acc-text" style={{ fontSize: 15 }}>
                  ≈ {speed.mbps} Мбит/с
                </span>
              )}
              {!speed && !speedBusy && (
                <span className="t-caption">примерно, по загрузке файла</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ marginTop: 14 }}>
        <Button variant="primary" full sound="none" disabled={busy} onClick={check}>
          {busy ? "Проверяю…" : v ? "Проверить ещё раз" : "Проверить интернет"}
        </Button>
      </div>
    </Card>
  );
}

function GroupBox({
  label, ok, total, ms,
}: { label: string; ok: number; total: number; ms: number | null }) {
  const good = ok === total;
  const bad = ok === 0;
  const c = bad ? "#ff5a3c" : good ? "#59ff9e" : "#ffb020";
  return (
    <div
      style={{
        padding: "11px 12px",
        borderRadius: "var(--r-md)",
        background: "var(--btn-bg)",
        border: "1px solid var(--btn-brd)",
      }}
    >
      <div className="t-label" style={{ fontSize: 8.5 }}>{label}</div>
      <div className="t-num" style={{ fontSize: 17, marginTop: 4, color: c }}>
        {ok}/{total}
      </div>
      <div className="t-caption" style={{ marginTop: 2 }}>
        {ms !== null ? `${ms} мс` : "нет ответа"}
      </div>
    </div>
  );
}
