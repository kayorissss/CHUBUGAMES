import { useRef, useState } from "react";
import { useGame } from "../core/store";
import { Card, Button, SectionTitle, Screen, Divider } from "../ui/Glass";
import Updater from "../ui/Updater";
import { SAVE_KEY, migrate, persistNow } from "../core/save";
import { sfx, haptic, unlockAudio } from "../core/fx";
import { fmt } from "../core/format";
import { APP_VERSION } from "../core/version";

export default function Settings() {
  const { s, set, hardReset, toast } = useGame();
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportSave = () => {
    const data = localStorage.getItem(SAVE_KEY) || "{}";
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chubgames-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    sfx.buy();
    toast({ title: "Сохранение выгружено", icon: "💾" });
  };

  const importSave = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(r.result as string);
        const mig = migrate(parsed);
        persistNow(mig);
        sfx.legend();
        haptic("success");
        toast({ title: "Загружено", sub: "Перезапуск...", icon: "📥", tone: "gold" });
        setTimeout(() => window.location.reload(), 900);
      } catch {
        sfx.error();
        toast({ title: "Файл повреждён", tone: "bad" });
      }
    };
    r.readAsText(file);
  };

  return (
    <Screen title="НАСТРОЙКИ">
      <SectionTitle>Оформление</SectionTitle>
      <Card r="lg" style={{ marginBottom: 22, overflow: "hidden" }}>
        <Seg
          label="Тема"
          value={s.settings.theme}
          opts={[["dark", "Тёмная"], ["light", "Светлая"]]}
          onPick={(v) => set((d) => { d.settings.theme = v as any; })}
        />
        <Divider inset={14} />
        <Toggle
          label="Жидкое стекло и свечения"
          hint="Выключи, если телефон греется"
          on={s.settings.fx}
          onToggle={() => set((d) => { d.settings.fx = !d.settings.fx; })}
        />
        <Divider inset={14} />
        <div className="t-caption" style={{ padding: "12px 14px", lineHeight: 1.5 }}>
          Акцентный цвет меняется в <span className="acc-text">Магазине → Темы</span>
        </div>
      </Card>

      <SectionTitle>Игра</SectionTitle>
      <Card r="lg" style={{ marginBottom: 22, overflow: "hidden" }}>
        <Seg
          label="Сложность"
          value={s.settings.difficulty}
          opts={[["chill", "Чилл"], ["normal", "Норма"], ["insane", "Ад"]]}
          onPick={(v) => set((d) => { d.settings.difficulty = v as any; })}
        />
        <Divider inset={14} />
        <Toggle
          label="Звук"
          on={s.settings.sound}
          onToggle={() => {
            unlockAudio();
            set((d) => { d.settings.sound = !d.settings.sound; });
          }}
        />
        <Divider inset={14} />
        <Toggle
          label="Вибрация"
          on={s.settings.haptics}
          onToggle={() => set((d) => { d.settings.haptics = !d.settings.haptics; })}
        />
      </Card>

      <SectionTitle>Обновление</SectionTitle>
      <div style={{ marginBottom: 22 }}>
        <Updater />
      </div>

      <SectionTitle>Сохранение</SectionTitle>
      <Card r="lg" style={{ padding: 14, marginBottom: 22 }}>
        <div className="t-body" style={{ marginBottom: 14 }}>
          Прогресс хранится только на этом телефоне и не требует интернета.
          Перед сменой устройства выгрузи файл сохранения.
        </div>
        <div className="flex" style={{ gap: 8 }}>
          <Button variant="secondary" full onClick={exportSave} sound="none">
            💾 Выгрузить
          </Button>
          <Button variant="secondary" full onClick={() => fileRef.current?.click()} sound="none">
            📥 Загрузить
          </Button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={importSave} />
        </div>
      </Card>

      <SectionTitle>Опасная зона</SectionTitle>
      <Card r="lg" style={{ padding: 14, marginBottom: 22 }}>
        {!confirmReset ? (
          <Button
            variant="danger"
            full
            onClick={() => { setConfirmReset(true); sfx.error(); }}
            sound="none"
          >
            Сбросить весь прогресс
          </Button>
        ) : (
          <>
            <div
              className="t-body"
              style={{ color: "var(--danger)", marginBottom: 12 }}
            >
              Удалятся уровень {s.level}, {fmt(s.coins)} монет, все ачивки и друзья. Точно?
            </div>
            <div className="flex" style={{ gap: 8 }}>
              <Button variant="secondary" full onClick={() => setConfirmReset(false)}>
                Нет
              </Button>
              <Button
                variant="primary"
                full
                sound="none"
                onClick={() => { hardReset(); setConfirmReset(false); }}
                style={{ background: "var(--danger)", color: "#fff" }}
              >
                Удалить всё
              </Button>
            </div>
          </>
        )}
      </Card>

      <div className="text-center" style={{ paddingBlock: 18 }}>
        <div className="t-display-sm" style={{ opacity: 0.22 }}>CHUBGAMES</div>
        <div className="t-caption" style={{ marginTop: 5 }}>
          версия {APP_VERSION} · работает офлайн
        </div>
        <div className="t-caption" style={{ marginTop: 2, opacity: 0.6 }}>
          сделано для своих
        </div>
      </div>
    </Screen>
  );
}

function Toggle({
  label, hint, on, onToggle,
}: { label: string; hint?: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={() => { sfx.click(); haptic("light"); onToggle(); }}
      className="w-full flex items-center justify-between"
      style={{ padding: "13px 14px", gap: 14 }}
    >
      <div className="text-left min-w-0">
        <div className="t-title-sm" style={{ fontWeight: 600 }}>{label}</div>
        {hint && <div className="t-caption" style={{ marginTop: 2 }}>{hint}</div>}
      </div>
      <div
        className="shrink-0"
        style={{
          width: 46, height: 27, borderRadius: 999, padding: 3,
          background: on ? "var(--acc)" : "var(--track)",
          transition: "background 0.22s",
        }}
      >
        <div
          style={{
            width: 21, height: 21, borderRadius: 999, background: "#fff",
            transform: `translateX(${on ? 19 : 0}px)`,
            transition: "transform 0.22s cubic-bezier(0.34,1.4,0.64,1)",
            boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
          }}
        />
      </div>
    </button>
  );
}

function Seg({
  label, value, opts, onPick,
}: {
  label: string; value: string; opts: [string, string][]; onPick: (v: string) => void;
}) {
  return (
    <div style={{ padding: "13px 14px" }}>
      <div className="t-title-sm" style={{ fontWeight: 600, marginBottom: 10 }}>{label}</div>
      <div
        className="flex"
        style={{
          gap: 4, padding: 4, borderRadius: "var(--r-md)",
          background: "var(--track)",
        }}
      >
        {opts.map(([v, l]) => {
          const on = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => { sfx.click(); haptic("light"); onPick(v); }}
              className="flex-1 press"
              style={{
                padding: "9px 4px",
                borderRadius: "var(--r-sm)",
                fontSize: 12,
                fontWeight: 700,
                lineHeight: 1,
                background: on ? "var(--acc)" : "transparent",
                color: on ? "var(--acc-ink)" : "var(--text-dim)",
                transition: "background 0.18s, color 0.18s",
              }}
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}
