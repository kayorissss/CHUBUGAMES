import { useState } from "react";
import { tr } from "../core/i18n";
import { Button } from "./Glass";
import Icon from "./Icon";
import { useGame } from "../core/store";
import { sfx, haptic } from "../core/fx";
import UpdateBanner from "./UpdateBanner";
import {
  APP_VERSION_LABEL,
  checkForUpdate,
  isNative,
  type UpdateInfo,
} from "../core/updater";

/**
 * Проверка обновления в настройках.
 *
 * Раньше здесь жила своя маленькая карточка со своим оформлением, и найденное
 * обновление выглядело совсем не так, как то же самое обновление при запуске
 * приложения. Теперь кнопка просто ищет версию и отдаёт её тому же
 * полноэкранному окну — экран один на оба случая.
 */
export default function UpdateCheckRow() {
  const { toast } = useGame();
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<UpdateInfo | null>(null);

  const check = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const info = await checkForUpdate();
      if (info) {
        setFound(info);
        sfx.legend?.();
        haptic("success");
      } else {
        sfx.click();
        toast({ title: tr("У тебя последняя версия"), icon: "check" });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : tr("Не получилось проверить");
      sfx.error?.();
      toast({ title: tr("Не получилось проверить"), sub: msg, tone: "bad" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{ padding: 14 }}>
        <div className="flex items-center" style={{ gap: 12, marginBottom: 12 }}>
          <span
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 40, height: 40, borderRadius: "var(--r-sm)",
              background: "var(--btn-bg)", color: "var(--acc)",
            }}
          >
            <Icon name="download" size={19} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="t-title-sm block">{tr("Обновление")}</span>
            <span className="t-caption block clip1" style={{ marginTop: 2 }}>
              {tr("Установлена")} {APP_VERSION_LABEL}
            </span>
          </span>
        </div>
        <Button
          variant="primary"
          full
          onClick={() => { void check(); }}
          disabled={busy}
          sound="click"
        >
          {busy ? tr("Проверяю…") : tr("Проверить обновление")}
        </Button>
        {!isNative() && (
          <div className="t-caption" style={{ marginTop: 9 }}>
            {tr("Установка доступна только в приложении на телефоне")}
          </div>
        )}
      </div>

      {/* тот же полноэкранный экран, что и при запуске */}
      <UpdateBanner external={found} onClose={() => setFound(null)} />
    </>
  );
}
