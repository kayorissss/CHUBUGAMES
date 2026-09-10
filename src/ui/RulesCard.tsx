import { AnimatePresence, motion } from "framer-motion";
import { tr } from "../core/i18n";
import Icon from "../ui/Icon";
import { rulesFor } from "../core/rules";
import { modalBackdrop, modalCard } from "../core/motion";
import type { GameId } from "../core/types";
import { sfx } from "../core/fx";

/**
 * Карточка правил игры.
 *
 * Показывается перед стартом и по кнопке «?» в углу. Пользователь
 * жаловался, что непонятно, что делать — поэтому здесь всегда три
 * блока: цель, управление и важные мелочи, а не одна строка подсказки.
 */
export default function RulesCard({
  id, open, onClose, onStart,
}: {
  id: GameId;
  open: boolean;
  onClose: () => void;
  /** если передан — внизу кнопка «Играть» вместо «Понятно» */
  onStart?: () => void;
}) {
  const r = rulesFor(id);
  if (!r) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={modalBackdrop}
          initial="initial" animate="animate" exit="exit"
          className="absolute inset-0 z-[70] flex items-center justify-center"
          style={{ background: "rgba(6,6,9,0.88)", padding: 20 }}
          onClick={onClose}
        >
          <motion.div
            variants={modalCard}
            initial="initial" animate="animate" exit="exit"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 340, maxHeight: "82%", overflowY: "auto",
              background: "var(--surface)",
              border: "1px solid var(--surface-brd)",
              borderRadius: "var(--r-lg)",
              padding: 18,
            }}
          >
            <div className="flex items-center" style={{ gap: 9, marginBottom: 14 }}>
              <span style={{ color: "var(--acc)", lineHeight: 0 }}>
                <Icon name="info" size={20} />
              </span>
              <span className="t-title" style={{ fontSize: 15 }}>{tr("КАК ИГРАТЬ")}</span>
            </div>

            <Block label={tr("ЦЕЛЬ")} text={tr(r.goal)} />
            <Block label={tr("УПРАВЛЕНИЕ")} text={tr(r.control)} />

            <div className="t-label" style={{ fontSize: 9, marginBottom: 6 }}>
              {tr("ВАЖНО")}
            </div>
            <div style={{ marginBottom: 16 }}>
              {r.tips.map((t) => (
                <div
                  key={t}
                  className="t-body"
                  style={{ fontSize: 11.5, lineHeight: 1.62, marginBottom: 3 }}
                >
                  — {tr(t)}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => { sfx.click(); (onStart ?? onClose)(); }}
              className="btn-acc"
              style={{ width: "100%", minHeight: 46, fontSize: 13 }}
            >
              {onStart ? tr("ИГРАТЬ") : tr("ПОНЯТНО")}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div className="t-label" style={{ fontSize: 9, marginBottom: 4 }}>{label}</div>
      <div className="t-body" style={{ fontSize: 12.5, lineHeight: 1.55 }}>{text}</div>
    </div>
  );
}

/** Кнопка «?» для HUD игры */
export function RulesButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => { sfx.click(); onClick(); }}
      className="shrink-0 flex items-center justify-center"
      style={{
        width: 38, height: 38, borderRadius: "var(--r-md)",
        background: "var(--surface-2)", border: "1px solid var(--btn-brd)",
        color: "var(--text)",
      }}
      aria-label={tr("Правила")}
    >
      <Icon name="info" size={17} />
    </button>
  );
}
