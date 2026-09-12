import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useGame } from "../core/store";
import { Card, Button, SectionTitle, Screen, Divider } from "../ui/Glass";
import DesktopSettings from "../ui/DesktopSettings";
import { isDesktop } from "../core/desktop";
import UpdateCheckRow from "../ui/UpdateCheckRow";
import {
  askNotifyPermission,
  cancelBossNotifications,
  disableBackgroundCheck,
  enableBackgroundCheck,
  ensureChannels,
  isNativeApp,
  notifyGranted,
  openSystemNotificationSettings,
  scheduleBossNotifications,
  scheduleNewsNotifications,
  cancelNewsNotifications,
} from "../core/notify";
import { upcomingBosses } from "../core/bosses";
import { saveFileNative } from "../core/exportSave";

import { tr } from "../core/i18n";
import Icon, { type IconName } from "../ui/Icon";
import { ACCENTS } from "../core/content";
import { SAVE_KEY, migrate, persistNow } from "../core/save";
import { sfx, haptic, unlockAudio } from "../core/fx";
import { fmt } from "../core/format";
import { APP_VERSION } from "../core/version";
import type { SubPage } from "../App";

export default function Settings({
  onOpen,
  onTab,
}: {
  onOpen?: (page: SubPage) => void;
  /** Перейти на вкладку нижнего меню — нужно ссылке «Магазин → Темы» */
  onTab?: (tab: "home" | "progress" | "shop" | "friends" | "settings") => void;
}) {
  const { s, set, hardReset, toast, t } = useGame();
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportSave = async () => {
    const data = localStorage.getItem(SAVE_KEY) || "{}";
    const name = `chubgames-save-${new Date().toISOString().slice(0, 10)}.json`;

    // 0) На телефоне пишем файл нативно и открываем системное «Поделиться».
    //    В WebView Android нет ни showSaveFilePicker, ни скачивания по ссылке
    //    blob:, поэтому раньше кнопка просто молчала.
    if (isNativeApp()) {
      const res = await saveFileNative(name, data);
      if (res.ok) {
        sfx.buy();
        haptic("success");
        toast({
          title: tr("Сохранение выгружено"),
          sub: res.where,
          icon: "download",
          tone: "gold",
        });
      } else if (res.reason !== "cancelled") {
        sfx.error();
        toast({ title: tr("Не удалось выгрузить"), sub: res.reason, tone: "bad" });
      }
      return;
    }

    // 1) Системный «Сохранить как» — пользователь сам выбирает папку
    const picker = (window as any).showSaveFilePicker;
    if (typeof picker === "function") {
      try {
        const handle = await picker({
          suggestedName: name,
          types: [{ description: "Сохранение CHUBUGAMES", accept: { "application/json": [".json"] } }],
        });
        const w = await handle.createWritable();
        await w.write(data);
        await w.close();
        sfx.buy();
        toast({ title: "Файл сохранён", sub: handle.name, icon: "download" });
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return; // сам отменил
      }
    }

    // 2) Поделиться файлом — на Android откроется системное меню,
    //    оттуда можно сохранить куда угодно или отправить себе
    try {
      const file = new File([data], name, { type: "application/json" });
      const nav = navigator as any;
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "Сохранение CHUBUGAMES" });
        sfx.buy();
        toast({ title: "Файл отправлен", sub: "Выбери, куда положить", icon: "download" });
        return;
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    }

    // 3) Обычное скачивание в папку загрузок
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    sfx.buy();
    toast({ title: "Сохранено в Загрузки", sub: name, icon: "download" });
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
        toast({ title: "Загружено", sub: "Перезапуск...", icon: "upload", tone: "gold" });
        setTimeout(() => window.location.reload(), 900);
      } catch {
        sfx.error();
        toast({ title: "Файл повреждён", tone: "bad" });
      }
    };
    r.readAsText(file);
  };

  return (
    <Screen title={t("settings.title")}>
      {/* НАСТРОЙКИ НА ПК — сетка по зонам, а не два независимых списка.
          Порядок в разметке остаётся телефонным; классы pc-a / pc-b
          (колонка) и pc-rN (строка) решают, куда блок встанет на мониторе,
          поэтому «Экран» и «Обновление» идут на одной высоте и ничего не
          сползает, когда один из блоков вырастает. */}
      <div className="pc-cols">

      {isDesktop() && (
      <div className="pc-blk pc-a pc-r1">
      <SectionTitle>{tr("Экран")}</SectionTitle>
      <DesktopSettings part="screen" />
      </div>
      )}

      <div className="pc-blk pc-b pc-r1">
      <SectionTitle>{t("settings.update")}</SectionTitle>
      {isDesktop() ? (
        <DesktopSettings part="update" />
      ) : (
        <Card r="lg" style={{ padding: 0, overflow: "hidden" }}>
          <UpdateCheckRow />
        </Card>
      )}
      </div>

      <div className="pc-blk pc-a pc-r2">
      <SectionTitle>{t("settings.save")}</SectionTitle>
      <Card r="lg" style={{ padding: 14, marginBottom: 22 }}>
        <div className="t-body" style={{ marginBottom: 14 }}>
          Прогресс хранится только на этом телефоне и не требует интернета.
          Перед сменой устройства выгрузи файл сохранения.
        </div>
        <div className="flex" style={{ gap: 8 }}>
          <Button variant="secondary" full onClick={exportSave} sound="none">
            <span className="inline-flex items-center" style={{ gap: 7 }}><Icon name="download" size={14} />{tr("Выгрузить")}</span>
          </Button>
          <Button variant="secondary" full onClick={() => fileRef.current?.click()} sound="none">
            <span className="inline-flex items-center" style={{ gap: 7 }}><Icon name="upload" size={14} />{tr("Загрузить")}</span>
          </Button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={importSave} />
        </div>
      </Card>
      </div>

      <div className="pc-blk pc-b pc-r2">
      <SectionTitle>{tr("Уведомления")}</SectionTitle>
      <Card r="lg" style={{ marginBottom: 22, overflow: "hidden" }}>
        <NotifyBlock />
      </Card>
      </div>

      <div className="pc-blk pc-a pc-r3">
      <SectionTitle>{t("settings.appearance")}</SectionTitle>
      <Card r="lg" style={{ marginBottom: 22, overflow: "hidden" }}>
        {/* Базовых темы три: чёрный, тёмно-серый и белый. Акцентный цвет
            подбирается отдельно ниже — так «шикарное игровое» оформление
            не превращается в один сплошной оранжевый экран. */}
        <Seg
          label={t("settings.theme")}
          value={s.settings.theme}
          opts={[
            ["dark", t("settings.dark")],
            ["graphite", tr("Графит")],
            ["light", t("settings.light")],
          ]}
          onPick={(v) => set((d) => { d.settings.theme = v as any; })}
        />
        <Divider inset={14} />
        <Toggle
          label={t("settings.glass")}
          hint={t("settings.glassHint")}
          on={s.settings.fx}
          onToggle={() => set((d) => { d.settings.fx = !d.settings.fx; })}
        />
        <Divider inset={14} />
        {/* Блок «Производительность» убран по просьбе пользователя:
            режим и так определяется автозамером FPS при запуске. */}
        <Divider inset={14} />
        <Seg
          label={t("settings.language")}
          value={s.settings.lang || "ru"}
          opts={[["ru", "Русский"], ["en", "English"]]}
          onPick={(v) => set((d) => { d.settings.lang = v as any; })}
        />
        <Divider inset={14} />
        <div style={{ padding: "13px 14px" }}>
          <div className="t-title-sm" style={{ fontWeight: 600, marginBottom: 10 }}>
            {tr("Темы")}
          </div>
          <div className="flex flex-wrap" style={{ gap: 9 }}>
            {ACCENTS.filter((a) => s.ownedThemes.includes(a.id)).map((a) => {
              const on = s.settings.accent === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    sfx.click(); haptic("light");
                    set((d) => { d.settings.accent = a.id; });
                  }}
                  title={a.name}
                  style={{
                    width: 34, height: 34, borderRadius: "var(--r-sm)",
                    background: a.hex,
                    border: on ? "2.5px solid var(--text)" : "1px solid var(--btn-brd)",
                    boxShadow: on ? `0 0 14px -3px ${a.hex}` : "none",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                />
              );
            })}
          </div>
          {/* Была слитная строка «Ещё цвета — вМагазине → Темы» без пробела
              и без перехода. Теперь это настоящая кнопка в магазин. */}
          <button
            type="button"
            onClick={() => { sfx.click(); haptic("light"); onTab?.("shop"); }}
            className="t-caption"
            style={{
              marginTop: 11, display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 12px", borderRadius: "var(--r-sm)",
              background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
              color: "var(--text)", textAlign: "left",
            }}
          >
            {tr("Ещё цвета")}
            {" — "}
            <span className="acc-text" style={{ fontWeight: 700 }}>{tr("Магазин · Темы")}</span>
            <Icon name="chevron" size={12} />
          </button>
        </div>
      </Card>
      </div>

      <div className="pc-blk pc-b pc-r3">
      <SectionTitle>{t("settings.danger")}</SectionTitle>
      <Card r="lg" style={{ padding: 14, marginBottom: 22 }}>
        {!confirmReset ? (
          <Button
            variant="danger"
            full
            onClick={() => { setConfirmReset(true); sfx.error(); }}
            sound="none"
          >{tr("Сбросить весь прогресс")}</Button>
        ) : (
          <>
            <div
              className="t-body"
              style={{ color: "var(--danger)", marginBottom: 12 }}
            >
              Удалятся уровень {s.level}, {fmt(s.coins)} монет, все ачивки и друзья. Точно?
            </div>
            <div className="flex" style={{ gap: 8 }}>
              <Button variant="secondary" full onClick={() => setConfirmReset(false)}>{tr("Нет")}</Button>
              <Button
                variant="primary"
                full
                sound="none"
                onClick={() => { hardReset(); setConfirmReset(false); }}
                style={{ background: "var(--danger)", color: "var(--danger-ink)" }}
              >{tr("Удалить всё")}</Button>
            </div>
          </>
        )}
      </Card>
      </div>

      <div className="pc-blk pc-a pc-r4">
      <SectionTitle>{tr("Инструменты")}</SectionTitle>
      <Card r="lg" style={{ padding: 0, marginBottom: 22, overflow: "hidden" }}>
        <NavRow
          icon="wifi"
          title="Проверка глушилок"
          sub="Пинг российских и зарубежных сервисов, скорость"
          onClick={() => onOpen?.("network")}
        />
      </Card>
      </div>

      <div className="pc-blk pc-b pc-r4">
      <SectionTitle>{t("settings.game")}</SectionTitle>
      <Card r="lg" style={{ marginBottom: 22, overflow: "hidden" }}>
        <DiffPicker
          value={s.settings.difficulty}
          onPick={(v) => set((d) => { d.settings.difficulty = v; })}
        />
        <Divider inset={14} />
        <Toggle
          label={t("settings.sound")}
          on={s.settings.sound}
          onToggle={() => {
            unlockAudio();
            set((d) => { d.settings.sound = !d.settings.sound; });
          }}
        />
        <Divider inset={14} />
        <Toggle
          label={t("settings.haptics")}
          on={s.settings.haptics}
          onToggle={() => set((d) => { d.settings.haptics = !d.settings.haptics; })}
        />
      </Card>
      </div>

      <div className="pc-blk pc-span pc-r5">
      <Card r="lg" style={{ padding: 14, marginBottom: 22 }}>
        <div className="flex items-center" style={{ gap: 13 }}>
          <div
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 44, height: 44, borderRadius: "var(--r-md)",
              background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
              color: "var(--acc)",
            }}
          >
            <Icon name="burger" size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="t-title-sm">KAYORISAN</div>
            <div className="t-caption" style={{ marginTop: 2 }}>
              {t("settings.author")}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <Button
            variant="primary"
            full
            sound="power"
            onClick={() => {
              try {
                window.open("https://t.me/kayorisan", "_blank", "noopener,noreferrer");
              } catch {
                location.href = "https://t.me/kayorisan";
              }
            }}
          >
            Telegram: @kayorisan
          </Button>
        </div>
        <div className="t-caption" style={{ marginTop: 10, lineHeight: 1.5 }}>{tr("Все друзья, шутки и головы — реальные. Претензии тоже принимаются в телеграм.")}</div>
      </Card>
      </div>
      </div>

      {/* Низ страницы: здесь же и «CHUBUGAMES», и номер версии. Раньше версия
          висела в правом углу верхней панели — место, куда её никто не
          смотрит; теперь она там, где о ней спрашивают. */}
      <div className="pc-foot">
        <div className="pc-foot-brand">
          <div className="t-display-sm" style={{ color: "var(--n-400)" }}>CHUBUGAMES</div>
          <div className="t-caption" style={{ marginTop: 5 }}>
            {t("settings.forOurs")}
          </div>
        </div>
        <div className="t-caption pc-foot-ver">
          {t("common.version")} {APP_VERSION} · {t("settings.offline")}
        </div>
      </div>
    </Screen>
  );
}

/**
 * Уведомления.
 *
 * Два переключателя — что именно присылать, — и переход в системные
 * настройки телефона, где каналы НОВИНКИ / ОБНОВЛЕНИЯ / БОССЫ
 * выключаются по отдельности средствами Android.
 */
function NotifyBlock() {
  const { s, set, toast } = useGame();
  const [busy, setBusy] = useState(false);

  /** Общая часть: убедиться, что разрешение есть */
  const ensurePerm = async () => (await notifyGranted()) || (await askNotifyPermission());

  const toggleUpdates = async () => {
    if (busy) return;
    if (s.settings.notifyUpdates) {
      set((d) => { d.settings.notifyUpdates = false; });
      void disableBackgroundCheck();
      toast({ title: tr("Больше не напоминаю об обновлениях"), icon: "check" });
      return;
    }
    setBusy(true);
    try {
      const ok = await ensurePerm();
      await enableBackgroundCheck();
      set((d) => { d.settings.notifyUpdates = true; });
      toast(
        ok
          ? { title: tr("Напомню о новой версии"), sub: tr("Проверяю примерно раз в час"), icon: "check", tone: "gold" }
          : { title: tr("Включил напоминания"), sub: tr("Разреши уведомления в настройках телефона, чтобы они приходили"), icon: "warn" },
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleBoss = async () => {
    if (busy) return;
    if (s.settings.notifyBoss) {
      set((d) => { d.settings.notifyBoss = false; });
      void cancelBossNotifications();
      toast({ title: tr("Больше не напоминаю о боссах"), icon: "check" });
      return;
    }
    setBusy(true);
    try {
      const ok = await ensurePerm();
      await ensureChannels();
      await scheduleBossNotifications(upcomingBosses());
      set((d) => { d.settings.notifyBoss = true; });
      toast(
        ok
          ? { title: tr("Скажу, когда заступит босс"), sub: tr("Каждый час, пока не выключишь"), icon: "skull", tone: "gold" }
          : { title: tr("Включил напоминания"), sub: tr("Разреши уведомления в настройках телефона, чтобы они приходили"), icon: "warn" },
      );
    } finally {
      setBusy(false);
    }
  };

  const toggleNews = async () => {
    if (busy) return;
    if (s.settings.notifyNews) {
      set((d) => { d.settings.notifyNews = false; });
      void cancelNewsNotifications();
      toast({ title: tr("Больше не напоминаю про ежедневки"), icon: "check" });
      return;
    }
    setBusy(true);
    try {
      const ok = await ensurePerm();
      await ensureChannels();
      await scheduleNewsNotifications();
      set((d) => { d.settings.notifyNews = true; });
      toast(
        ok
          ? { title: tr("Напомню про ежедневки"), sub: tr("Каждый день в 19:00"), icon: "check", tone: "gold" }
          : { title: tr("Включил напоминания"), sub: tr("Разреши уведомления в настройках телефона, чтобы они приходили"), icon: "warn" },
      );
    } finally {
      setBusy(false);
    }
  };

  /*
   * Где уведомления вообще работают.
   *
   * На Android — через системные каналы, на ПК — средствами Electron.
   * Раньше проверялось только isNativeApp(), поэтому в десктопной сборке
   * все тумблеры были серыми и нажать их было нельзя.
   */
  const desktop = isDesktop();
  const native = isNativeApp() || desktop;

  return (
    <>
      <Toggle
        label={tr("Обновления")}
        hint={
          desktop
            ? tr("Скажу, когда выйдет новая версия для компьютера")
            : native
              ? tr("Напомню о новой версии, даже когда игра закрыта")
              : tr("Работает только в приложении на телефоне")
        }
        on={s.settings.notifyUpdates}
        disabled={busy || !native}
        onToggle={() => { void toggleUpdates(); }}
      />
      <Divider inset={14} />
      <Toggle
        label={tr("Боссы")}
        hint={tr("Скажу, когда заступит новый воспитатель")}
        on={s.settings.notifyBoss}
        disabled={busy || !native}
        onToggle={() => { void toggleBoss(); }}
      />
      <Divider inset={14} />
      <Toggle
        label={tr("Новинки")}
        hint={tr("Раз в день напомню про ежедневки и стрик")}
        on={s.settings.notifyNews}
        disabled={busy || !native}
        onToggle={() => { void toggleNews(); }}
      />
      <Divider inset={14} />
      <div style={{ padding: "13px 14px" }}>
        <div className="t-caption" style={{ marginBottom: 10, lineHeight: 1.55 }}>
          {desktop
            ? tr("На компьютере уведомления включены сразу — выключить можно здесь же.")
            : tr("Каждый вид уведомлений можно выключить прямо в телефоне: НОВИНКИ, ОБНОВЛЕНИЯ и БОССЫ — это отдельные каналы Android.")}
        </div>
        {!desktop && (
        <Button
          variant="secondary"
          full
          sound="click"
          disabled={!native}
          onClick={() => {
            void (async () => {
              const ok = await openSystemNotificationSettings();
              if (!ok) {
                toast({
                  title: tr("Открой настройки телефона"),
                  sub: tr("Приложения → CHUBUGAMES → Уведомления"),
                  icon: "info",
                });
              }
            })();
          }}
        >
          <span className="inline-flex items-center" style={{ gap: 8 }}>
            <Icon name="settings" size={14} />
            {tr("Настроить в телефоне")}
          </span>
        </Button>
        )}
      </div>
    </>
  );
}

function Toggle({
  label, hint, on, onToggle, disabled,
}: {
  label: string; hint?: string; on: boolean; onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => { sfx.click(); haptic("light"); onToggle(); }}
      className="w-full flex items-center justify-between"
      style={{ padding: "13px 14px", gap: 14, opacity: disabled ? 0.5 : 1 }}
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
            width: 21, height: 21, borderRadius: 999, background: "var(--n-900)",
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

/** Строка-переход на отдельный экран */
function NavRow({
  icon, title, sub, onClick,
}: {
  icon: IconName; title: string; sub: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => { sfx.click(); haptic("light"); onClick(); }}
      className="w-full flex items-center text-left"
      style={{ gap: 12, padding: "14px 14px" }}
    >
      <span
        className="shrink-0 flex items-center justify-center"
        style={{
          width: 36, height: 36, borderRadius: "var(--r-sm)",
          background: "var(--btn-bg)", border: "1px solid var(--btn-brd)",
          color: "var(--acc)",
        }}
      >
        <Icon name={icon} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="t-title-sm block">{title}</span>
        <span className="t-caption block clip1" style={{ marginTop: 2 }}>{sub}</span>
      </span>
      <span className="shrink-0" style={{ color: "var(--text-mute)" }}>
        <Icon name="chevron" size={15} />
      </span>
    </button>
  );
}

/* ============ ВЫБОР СЛОЖНОСТИ ============ */

type Diff = "chill" | "normal" | "insane";

const DIFFS: {
  id: Diff; name: string; desc: string; color: string; icon: IconName;
}[] = [
  /* Тут нужны именно хексы: ниже к цвету дописывается альфа («…1a»),
     а к var(--…) так дописать нельзя — получилась бы битая строка. */
  { id: "chill",  name: "ЧИЛЛ",   desc: "Медленно, для расслабона", color: "var(--ok)", icon: "clover" },
  { id: "normal", name: "НОРМАС", desc: "Как задумано",             color: "var(--gold)", icon: "bolt" },
  { id: "insane", name: "АДСКИЙ", desc: "Быстро и злобно",          color: "#FF6B5A", icon: "fire" },
];

function DiffPicker({ value, onPick }: { value: Diff; onPick: (v: Diff) => void }) {
  return (
    <div style={{ padding: "13px 14px" }}>
      <div className="t-label" style={{ fontSize: 9.5, marginBottom: 11 }}>{tr("СЛОЖНОСТЬ")}</div>
      <div className="flex" style={{ gap: 9 }}>
        {DIFFS.map((d) => {
          const on = value === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => { sfx.click(); haptic(on ? "light" : "medium"); onPick(d.id); }}
              className="flex-1 min-w-0 flex flex-col items-center"
              style={{
                position: "relative",
                gap: 7, padding: "14px 6px",
                borderRadius: "var(--r-md)",
                background: on ? `${d.color}1a` : "var(--btn-bg)",
                border: `1.5px solid ${on ? d.color : "var(--btn-brd)"}`,
                boxShadow: on
                  ? `0 0 0 3px ${d.color}22, 0 6px 22px -4px ${d.color}88, inset 0 0 22px -8px ${d.color}`
                  : "none",
                transition: "background .18s, border-color .18s, box-shadow .28s",
              }}
            >
              {on && (
                <motion.span
                  layoutId="diffglow"
                  className="absolute inset-0"
                  style={{
                    borderRadius: "var(--r-md)",
                    background: `radial-gradient(120% 80% at 50% 0%, ${d.color}30, transparent 70%)`,
                    pointerEvents: "none",
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                />
              )}
              <motion.span
                animate={on ? { scale: [1, 1.14, 1] } : { scale: 1 }}
                transition={on ? { repeat: Infinity, duration: 2.1, ease: "easeInOut" } : {}}
                style={{ color: on ? d.color : "var(--text-mute)", lineHeight: 0, zIndex: 1 }}
              >
                <Icon name={d.icon} size={21} />
              </motion.span>
              <span
                className="t-title-sm"
                style={{
                  fontSize: 11.5, letterSpacing: "0.05em", zIndex: 1,
                  color: on ? d.color : "var(--text)",
                }}
              >
                {d.name}
              </span>
              <span
                className="t-caption text-center"
                style={{ fontSize: 9, lineHeight: 1.35, zIndex: 1, paddingInline: 2 }}
              >
                {d.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
