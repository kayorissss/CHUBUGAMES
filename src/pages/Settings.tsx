import { useRef, useState } from "react";
import { useGame } from "../core/store";
import { Panel, Tap, SectionTitle } from "../ui/Glass";
import { SAVE_KEY, migrate, persistNow } from "../core/save";
import { sfx, haptic, unlockAudio } from "../core/fx";
import { fmt } from "../core/format";

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
    <div className="h-full flex flex-col" style={{ paddingTop: "calc(var(--sat) + 14px)" }}>
      <div className="px-4 mb-3">
        <div className="t-display" style={{ fontSize: 25 }}>НАСТРОЙКИ</div>
      </div>
      <div className="flex-1 scroll px-4" style={{ paddingBottom: "calc(var(--sab) + 116px)" }}>
        <SectionTitle>Оформление</SectionTitle>
        <Panel r="lg" className="p-1 mb-4">
          <Seg
            label="Тема" value={s.settings.theme}
            opts={[["dark", "Тёмная"], ["light", "Светлая"]]}
            onPick={(v) => set((d) => { d.settings.theme = v as any; })}
          />
          <div className="divider" />
          <Toggle
            label="Жидкое стекло и свечения"
            hint="Выключи, если телефон греется"
            on={s.settings.fx}
            onToggle={() => set((d) => { d.settings.fx = !d.settings.fx; })}
          />
          <div className="divider" />
          <div className="px-3 py-2.5" style={{ fontSize: 11, color: "var(--text-mute)" }}>
            Акцентный цвет меняется в <span className="acc-text">Магазине → Темы</span>
          </div>
        </Panel>

        <SectionTitle>Игра</SectionTitle>
        <Panel r="lg" className="p-1 mb-4">
          <Seg
            label="Сложность" value={s.settings.difficulty}
            opts={[["chill", "Чилл"], ["normal", "Норма"], ["insane", "Ад"]]}
            onPick={(v) => set((d) => { d.settings.difficulty = v as any; })}
          />
          <div className="divider" />
          <Toggle
            label="Звук"
            on={s.settings.sound}
            onToggle={() => {
              unlockAudio();
              set((d) => { d.settings.sound = !d.settings.sound; });
            }}
          />
          <div className="divider" />
          <Toggle
            label="Вибрация"
            on={s.settings.haptics}
            onToggle={() => set((d) => { d.settings.haptics = !d.settings.haptics; })}
          />
        </Panel>

        <SectionTitle>Сохранение</SectionTitle>
        <Panel r="lg" className="p-3.5 mb-4">
          <div style={{ fontSize: 11, color: "var(--text-mute)", lineHeight: 1.5, marginBottom: 12 }}>
            Прогресс хранится только на этом телефоне и не требует интернета.
            Перед сменой устройства выгрузи файл сохранения.
          </div>
          <div className="flex gap-2">
            <Tap onClick={exportSave} r="md" className="flex-1 py-3 t-title" style={{ fontSize: 12 }} sound="none">
              💾 ВЫГРУЗИТЬ
            </Tap>
            <Tap onClick={() => fileRef.current?.click()} r="md" className="flex-1 py-3 t-title" style={{ fontSize: 12 }} sound="none">
              📥 ЗАГРУЗИТЬ
            </Tap>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={importSave} />
          </div>
        </Panel>

        <SectionTitle>Опасная зона</SectionTitle>
        <Panel r="lg" className="p-3.5 mb-4">
          {!confirmReset ? (
            <Tap
              onClick={() => { setConfirmReset(true); sfx.error(); }}
              r="md" className="w-full py-3 t-title"
              style={{ fontSize: 12, color: "#ff5a3c" }} sound="none"
            >
              СБРОСИТЬ ВЕСЬ ПРОГРЕСС
            </Tap>
          ) : (
            <>
              <div style={{ fontSize: 12, color: "#ff5a3c", marginBottom: 10, lineHeight: 1.5 }}>
                Удалятся уровень {s.level}, {fmt(s.coins)} монет, все ачивки и друзья. Точно?
              </div>
              <div className="flex gap-2">
                <Tap onClick={() => setConfirmReset(false)} r="md" className="flex-1 py-3 t-title" style={{ fontSize: 12 }}>
                  Нет
                </Tap>
                <Tap
                  onClick={() => { hardReset(); setConfirmReset(false); }}
                  r="md" className="flex-1 py-3 t-title"
                  style={{ fontSize: 12, background: "#ff4a30", color: "#fff" }} sound="none"
                >
                  УДАЛИТЬ ВСЁ
                </Tap>
              </div>
            </>
          )}
        </Panel>

        <div className="text-center py-4">
          <div className="t-display" style={{ fontSize: 22, opacity: 0.28 }}>CHUBGAMES</div>
          <div className="t-label mt-1">версия 1.0 · работает офлайн</div>
          <div className="t-label mt-0.5" style={{ fontSize: 8 }}>сделано для своих</div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, hint, on, onToggle }: { label: string; hint?: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={() => { sfx.click(); haptic("light"); onToggle(); }}
      className="w-full flex items-center justify-between px-3 py-3"
    >
      <div className="text-left">
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: "var(--text-mute)" }}>{hint}</div>}
      </div>
      <div
        style={{
          width: 46, height: 27, borderRadius: 99, padding: 3, flexShrink: 0,
          background: on ? "var(--acc)" : "rgba(255,255,255,0.12)",
          transition: "background 0.22s",
          boxShadow: on ? "0 0 16px -2px var(--acc-glow)" : "none",
        }}
      >
        <div
          style={{
            width: 21, height: 21, borderRadius: 99, background: "#fff",
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
    <div className="px-3 py-3">
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div className="flex gap-1.5">
        {opts.map(([v, l]) => (
          <button
            key={v}
            onClick={() => { sfx.click(); haptic("light"); onPick(v); }}
            className="press flex-1 py-2"
            style={{
              borderRadius: 10, fontSize: 11, fontWeight: 700,
              background: value === v ? "var(--acc)" : "rgba(255,255,255,0.06)",
              color: value === v ? "var(--acc-ink)" : "var(--text-dim)",
              border: "1px solid var(--glass-brd)",
            }}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
