import { useEffect, useMemo, useState } from "react";
import { tr } from "../core/i18n";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "./Icon";
import { sfx, haptic } from "../core/fx";
import { EASE } from "../core/motion";
import { APP_VERSION } from "../core/version";
import { CHANGELOG } from "../core/changelog";
import { cmpVer } from "./ChangelogView";
import { SAVE_KEY } from "../core/save";

const SEEN_KEY = "chubgames.seenVersion";

/**
 * Экран «что обновилось» — показывается ОДИН РАЗ после установки новой версии.
 *
 * Список берём из локального файла, а не из тела релиза: приложение
 * офлайновое, и после установки интернета может не быть, а знать, что
 * изменилось, надо всё равно.
 *
 * Оформление то же, что у экрана обновления: спокойная страница со
 * ступенями поверхностей, кнопка внизу, без свечений на пол-экрана.
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

  /**
   * НАКОПИТЕЛЬНЫЙ СПИСОК.
   *
   * Раньше показывались изменения только текущей версии. Если человек
   * сидел на 1.14.0, а поставил 1.20.0, он видел один экран про 1.20.0 и
   * не узнавал, что было в 1.15…1.19. Пользователь просил именно это:
   * «я вижу что добавлено было в 1.15, 1.16, 1.17 и т.д.».
   *
   * Теперь берём ВСЕ версии, которые новее той, что человек видел в
   * прошлый раз, и показываем их по группам, начиная со свежей.
   */
  const groups = useMemo(() => {
    const seen = localStorage.getItem(SEEN_KEY);
    const all = Object.keys(CHANGELOG).sort(cmpVer);   // от новых к старым
    // Не знаем прошлую версию — показываем только текущую, чтобы не
    // вываливать на человека всю историю проекта.
    if (!seen) {
      return [{ v: APP_VERSION, items: CHANGELOG[APP_VERSION] || [] }];
    }
    const list = all
      .filter((v) => cmpVer(v, seen) < 0)   // строго новее виденной
      .map((v) => ({ v, items: CHANGELOG[v] || [] }))
      .filter((g) => g.items.length > 0);
    return list.length
      ? list
      : [{ v: APP_VERSION, items: CHANGELOG[APP_VERSION] || [] }];
  }, []);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.26 }}
          className="fixed inset-0 z-[112] flex flex-col"
          style={{ background: "var(--bg)" }}
        >
          {/* Шапка */}
          <div
            className="shrink-0"
            style={{
              padding: "calc(var(--sat) + 22px) 18px 18px",
              background: "var(--surface)",
              borderBottom: "1px solid var(--surface-brd)",
            }}
          >
            <div className="flex items-center" style={{ gap: 13 }}>
              <motion.span
                className="ico-box ico-box-acc"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                style={{ width: 46, height: 46, borderRadius: "var(--r-md)" }}
              >
                <Icon name="sparkle" size={22} />
              </motion.span>
              <div className="min-w-0 flex-1">
                <div className="t-label" style={{ fontSize: 9 }}>
                  {tr("ОБНОВЛЕНИЕ УСТАНОВЛЕНО")}
                </div>
                <div className="t-display-sm clip1" style={{ fontSize: 20, marginTop: 3 }}>
                  {tr("Версия")} {APP_VERSION}
                </div>
              </div>
            </div>
            <div className="t-caption" style={{ marginTop: 12, lineHeight: 1.5 }}>
              {groups.length > 1
                ? `${tr("Пропущено версий")}: ${groups.length} · ${total} ${tr("изменений")}`
                : tr("Вот что изменилось с прошлой версии")}
            </div>
          </div>

          {/* Список изменений */}
          <div className="flex-1 scroll" style={{ padding: "14px 18px 8px", minHeight: 0, overflowY: "auto" }}>
            <div className="flex flex-col" style={{ gap: 9 }}>
              {groups.map((grp, gi) => (
                <div key={grp.v} className="flex flex-col" style={{ gap: 9 }}>
                  {/* Заголовок версии нужен только когда версий несколько */}
                  {groups.length > 1 && (
                    <div
                      className="flex items-center"
                      style={{ gap: 9, marginTop: gi === 0 ? 0 : 8 }}
                    >
                      <span
                        className="t-num"
                        style={{
                          padding: "4px 10px", borderRadius: 999, fontSize: 11.5,
                          background: gi === 0 ? "var(--acc)" : "var(--surface-2)",
                          color: gi === 0 ? "var(--acc-ink)" : "var(--text-dim)",
                          border: `1px solid ${gi === 0 ? "var(--acc)" : "var(--surface-brd)"}`,
                        }}
                      >
                        {grp.v}
                      </span>
                      <span style={{ flex: 1, height: 1, background: "var(--surface-brd)" }} />
                    </div>
                  )}

                  {grp.items.map((it, i) => (
                    <motion.div
                      key={`${grp.v}-${i}`}
                      initial={{ y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: Math.min(i + gi * 2, 8) * 0.045, duration: 0.28, ease: EASE }}
                      className="flex items-start"
                      style={{
                        gap: 11,
                        padding: "12px 13px",
                        borderRadius: "var(--r-lg)",
                        background: "var(--surface)",
                        border: "1px solid var(--surface-brd)",
                      }}
                    >
                      <span
                        className={`ico-box ${it.fix ? "" : "ico-box-acc"}`}
                        style={{
                          width: 32,
                          height: 32,
                          ...(it.fix
                            ? {
                                background: "var(--ok-soft)",
                                borderColor: "var(--ok-brd)",
                                color: "var(--ok)",
                              }
                            : null),
                        }}
                      >
                        <Icon name={it.icon} size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="t-title-sm" style={{ fontSize: 13.5 }}>{it.title}</div>
                        <div className="t-caption" style={{ marginTop: 3, lineHeight: 1.5 }}>
                          {it.text}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Кнопка */}
          <div
            className="shrink-0"
            style={{
              padding: "14px 18px calc(var(--sab) + 20px)",
              background: "var(--surface)",
              borderTop: "1px solid var(--surface-brd)",
            }}
          >
            <button
              type="button"
              className="btn-acc"
              style={{ width: "100%", minHeight: 50, fontSize: 14 }}
              onClick={() => { sfx.power?.(); haptic("light"); close(); }}
            >
              {tr("Погнали играть")}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
