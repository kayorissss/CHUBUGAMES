import { AnimatePresence, motion } from "framer-motion";
import { tr } from "../core/i18n";
import { useGame, useToasts } from "../core/store";
import { isDesktop } from "../core/desktop";
import { Panel, Tap } from "../ui/Glass";
import { fmt, fmtTime } from "../core/format";
import Icon from "../ui/Icon";

/**
 * УВЕДОМЛЕНИЯ.
 *
 * Как было: плашки сыпались стопкой по центру сверху, по три-семь
 * штук одновременно, не закрывались руками и залепляли шапку с очками.
 * Просьба: «уведомления стереть, и они по центру сверху, а не в углу».
 *
 * Как стало:
 *  • угол — справа сверху на ПК (не перекрывает счёт и HUD), слева сверху на
 *    телефоне (там справа живёт FPS и монеты);
 *  • максимум три плашки, остальные ждут в очереди (store: MAX_TOASTS) и
 *    выходят по одной — поток событий читается по порядку, а не кашей;
 *  • у каждой плашки крестик: убрать можно не дожидаясь 3.4 с;
 *  • наведение мышью на ПК откладывает авто-скрытие: читать с таймером
 *    неудобно;
 *  • клик по плашке тоже закрывает её.
 */
export function Toasts() {
  // подписан только на список тостов, а не на всё состояние игры
  const { toasts, dismiss } = useToasts();
  const pc = isDesktop();

  return (
    <div
      className={`toast-stack ${pc ? "pc" : ""}`}
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout={pc ? false : undefined}
            initial={{ y: -18, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -12, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 460, damping: 34 }}
            className={`toast-item ${t.tone === "gold" ? "gold" : ""} ${t.tone === "bad" ? "bad" : ""}`}
            onMouseEnter={() => holdToast(t.id, true)}
            onMouseLeave={() => holdToast(t.id, false)}
          >
            {t.icon && (
              <span className="toast-ico">
                <Icon name={t.icon} size={18} />
              </span>
            )}
            <span className="toast-text">
              <span className="toast-title">{t.title}</span>
              {t.sub && <span className="toast-sub">{t.sub}</span>}
            </span>
            <button
              type="button"
              className="toast-x"
              aria-label={tr("Закрыть")}
              onClick={() => dismiss(t.id)}
            >
              <Icon name="cross" size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Наведение мыши = «не убирай». Проще всего сказать это store-у через
 * собственное событие: компонент не имеет права лезть в таймеры провайдера,
 * а провайдер не знает про курсор.
 */
function holdToast(id: number, on: boolean): void {
  window.dispatchEvent(new CustomEvent("chub:toastrule", { detail: { id, on } }));
}

export function OfflineModal() {
  const { offlineReport, clearOffline, mainFriend } = useGame();
  const pc = isDesktop();
  return (
    <AnimatePresence>
      {offlineReport && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] flex items-center justify-center px-6"
          style={{ background: "var(--scrim)", backdropFilter: "blur(18px)" }}
          onClick={clearOffline}
        >
          <motion.div
            initial={{ scale: 0.8, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className={pc ? "pc-offline pc-modal-card" : "w-full max-w-xs"}
            onClick={(e) => e.stopPropagation()}
          >
            {pc ? (
              <>
                {/* На мониторе это окно лаунчера: шапка с пояснением, цифры
                    и кнопка — в одну строку, подсказка про «Холодильник»
                    внизу. Полноэкранная мобильная полоса на 27" выглядела
                    как несжатая страница сайта. */}
                <div className="pc-modal-head">
                  <div className="flex items-center" style={{ gap: 10 }}>
                    <span style={{ color: "var(--acc)", lineHeight: 0 }}><Icon name="snow" size={22} /></span>
                    <span className="t-display" style={{ fontSize: 19 }}>{tr("ПОКА ТЕБЯ НЕ БЫЛО")}</span>
                    <span className="flex-1" />
                    <span className="t-caption" style={{ color: "var(--text-mute)" }}>
                      {fmtTime(offlineReport.hours * 3600000)}
                    </span>
                  </div>
                </div>
                <div className="pc-modal-body flex items-center" style={{ gap: 20 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="t-body" style={{ color: "var(--text-dim)" }}>
                      {mainFriend.name} жрал и накопил
                    </div>
                    <div
                      className="t-num acc-text"
                      style={{ fontSize: 40, marginTop: 6, textShadow: "0 0 30px var(--acc-glow)" }}
                    >
                      +{fmt(offlineReport.coins)}
                    </div>
                    <div className="t-label" style={{ fontSize: 9, color: "var(--text-mute)" }}>CHUBCOINS</div>
                  </div>
                  <Tap
                    onClick={clearOffline}
                    accent
                    r="md"
                    sound="coin"
                    className="t-title"
                    style={{ padding: "0 22px", minHeight: 46, fontSize: 13, flex: "0 0 auto", marginLeft: "auto" }}
                  >
                    {tr("ЗАБРАТЬ")}
                  </Tap>
                </div>
                <div className="pc-modal-foot" style={{ justifyContent: "flex-start" }}>
                  <span className="t-caption" style={{ color: "var(--text-mute)" }}>
                    {tr("Качай «Холодильник» в CHUBCLICKER, чтобы копить дольше")}
                  </span>
                </div>
              </>
            ) : (
            <Panel r="xl" strong className="p-6 text-center">
              <div style={{ color: "var(--acc)" }}><Icon name="snow" size={42} /></div>
              <div className="t-display mt-2" style={{ fontSize: 22 }}>{tr("ПОКА ТЕБЯ НЕ БЫЛО")}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-mute)", marginTop: 6, lineHeight: 1.5 }}>
                {mainFriend.name} жрал {fmtTime(offlineReport.hours * 3600000)} и накопил
              </div>
              <div className="t-num acc-text my-4" style={{ fontSize: 40, textShadow: "0 0 30px var(--acc-glow)" }}>
                +{fmt(offlineReport.coins)}
              </div>
              <div className="t-label" style={{ marginTop: -8, marginBottom: 16 }}>CHUBCOINS</div>
              <Tap onClick={clearOffline} accent r="md" className="w-full py-3.5 t-title" style={{ fontSize: 14 }} sound="coin">{tr("ЗАБРАТЬ")}</Tap>
              <div className="t-label mt-3" style={{ fontSize: 8, lineHeight: 1.5 }}>{tr("Качай «Холодильник» в CHUBCLICKER, чтобы копить дольше")}</div>
            </Panel>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
