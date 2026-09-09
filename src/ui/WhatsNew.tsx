import { useEffect, useState } from "react";
import { tr } from "../core/i18n";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "./Glass";
import Icon from "./Icon";
import { sfx, haptic } from "../core/fx";
import { APP_VERSION } from "../core/version";
import { CHANGELOG, type ChangeItem } from "../core/changelog";
import { SAVE_KEY } from "../core/save";

const SEEN_KEY = "chubgames.seenVersion";

/**
 * Экран «что обновилось» — показывается ОДИН РАЗ после установки новой версии.
 *
 * Список берём из локального файла, а не из тела релиза: приложение офлайновое,
 * и после установки интернета может не быть, а знать, что изменилось, надо всё равно.
 */
export default function WhatsNew() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(SEEN_KEY);

    // Ключа ещё нет — это либо совсем новый игрок, либо тот, кто обновился
    // с версии, где этой отметки не существовало. Отличаем по наличию
    // сохранения: если человек уже играл, показать список изменений нужно.
    if (seen === null) {
      const played = localStorage.getItem(SAVE_KEY) !== null;
      if (!played) {
        localStorage.setItem(SEEN_KEY, APP_VERSION);
        return;
      }
    } else if (seen === APP_VERSION) {
      return;
    }
    const t = setTimeout(() => {
      setShow(true);
      sfx.levelUp?.();
      haptic("medium");
    }, 900);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    localStorage.setItem(SEEN_KEY, APP_VERSION);
    setShow(false);
  };

  const items: ChangeItem[] = CHANGELOG[APP_VERSION] || [];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[112] flex flex-col"
          style={{ background: "#08080B" }}
        >
          <motion.div
            className="absolute pointer-events-none"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 0.55, scale: 1 }}
            transition={{ duration: 1 }}
            style={{
              top: "-25%", left: "-30%", width: "160%", height: "72%",
              background: "radial-gradient(circle at 50% 50%, var(--acc-glow), transparent 62%)",
              filter: "blur(22px)",
            }}
          />

          <div
            className="relative flex flex-col flex-1 overflow-y-auto"
            style={{ padding: "calc(var(--sat) + 30px) 20px calc(var(--sab) + 18px)" }}
          >
            <motion.div
              className="flex flex-col items-center text-center"
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.08 }}
            >
              <motion.div
                className="flex items-center justify-center"
                initial={{ scale: 0.5, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.12 }}
                style={{
                  width: 66, height: 66, borderRadius: "var(--r-lg)",
                  background: "var(--acc)", color: "var(--acc-ink)",
                  boxShadow: "0 14px 38px var(--acc-glow)",
                }}
              >
                <Icon name="sparkle" size={32} />
              </motion.div>
              <div className="t-label" style={{ marginTop: 16, fontSize: 9.5 }}>{tr("ОБНОВЛЕНИЕ УСТАНОВЛЕНО")}</div>
              <div className="t-display" style={{ fontSize: 42, lineHeight: 1.05, marginTop: 6 }}>
                {APP_VERSION}
              </div>
              <div className="t-caption" style={{ marginTop: 7, maxWidth: 300 }}>{tr("Вот что изменилось с прошлой версии")}</div>
            </motion.div>

            <div className="flex flex-col" style={{ gap: 10, marginTop: 26, flex: 1 }}>
              {items.map((it, i) => (
                <motion.div
                  key={i}
                  initial={{ y: 18, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.22 + i * 0.07, type: "spring", stiffness: 260, damping: 24 }}
                  className="flex items-start"
                  style={{
                    gap: 12,
                    padding: "13px 15px",
                    borderRadius: "var(--r-lg)",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid var(--surface-brd)",
                  }}
                >
                  <span
                    className="shrink-0 flex items-center justify-center"
                    style={{
                      width: 34, height: 34, borderRadius: "var(--r-sm)",
                      background: it.fix ? "rgba(89,255,158,0.14)" : "var(--btn-bg)",
                      color: it.fix ? "#59FF9E" : "var(--acc)",
                    }}
                  >
                    <Icon name={it.icon} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="t-title-sm" style={{ fontSize: 13.5 }}>{it.title}</div>
                    <div className="t-caption" style={{ marginTop: 3 }}>{it.text}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 + items.length * 0.05 }}
              style={{ marginTop: 22 }}
            >
              <Button variant="primary" full size="lg" sound="power" onClick={close}>{tr("Погнали играть")}</Button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
