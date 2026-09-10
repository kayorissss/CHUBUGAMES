import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { tr } from "../core/i18n";
import Icon from "../ui/Icon";
import type { IconName } from "../ui/Icon";
import { sfx, haptic } from "../core/fx";
import { modalBackdrop, modalCard } from "../core/motion";

/**
 * Стартовый экран режима: название, правила, настройки и кнопка «Начать».
 *
 * До этого каждая игра рисовала свой: у Артёма кнопка «Выйти» была
 * подписью 11-м кеглем без рамки, у бильярда «НАЧАТЬ ПАРТИЮ» уезжала под
 * список правил, у шахмат и нард выбор сложности сливался с фоном.
 * Пользователь по каждой из них написал одно и то же — «не видно, где
 * начать» и «выйти незаметно». Поэтому экран один на всех:
 *
 *   • главное действие — крупная акцентная кнопка, всегда закреплена
 *     внизу над безопасной зоной и не уезжает вместе со скроллом;
 *   • «Выйти» — рядом, полноценной кнопкой с контуром, а не текстом;
 *   • содержимое между ними прокручивается, если не влезло.
 */
export default function GameIntro({
  title, subtitle, icon = "play", children,
  startLabel = tr("НАЧАТЬ"), onStart, onExit, startDisabled,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Настройки режима, правила и прочее содержимое */
  children?: ReactNode;
  startLabel?: string;
  onStart: () => void;
  onExit: () => void;
  startDisabled?: boolean;
}) {
  return (
    <motion.div
      variants={modalBackdrop}
      initial="initial"
      animate="animate"
      className="absolute inset-0 z-30 flex flex-col"
      style={{ background: "var(--bg)" }}
    >
      {/* Шапка */}
      <div
        className="shrink-0 flex items-center"
        style={{ gap: 11, padding: "calc(var(--sat) + 16px) 18px 14px" }}
      >
        <span className="ico-box ico-box-acc shrink-0" style={{ width: 40, height: 40 }}>
          <Icon name={icon} size={19} />
        </span>
        <span className="min-w-0">
          <span className="t-display block clip1" style={{ fontSize: 20, lineHeight: 1.15 }}>
            {title}
          </span>
          {subtitle && (
            <span className="t-caption block clip1" style={{ marginTop: 2 }}>
              {subtitle}
            </span>
          )}
        </span>
      </div>

      {/* Содержимое */}
      <motion.div
        variants={modalCard}
        initial="initial"
        animate="animate"
        className="flex-1 scroll"
        style={{ padding: "0 18px 18px" }}
      >
        {children}
      </motion.div>

      {/* Действия. Закреплены внизу: пользователь искал кнопку старта
          глазами по всему экрану, потому что она пряталась в потоке. */}
      <div
        className="shrink-0 flex"
        style={{
          gap: 10,
          padding: "12px 18px calc(var(--sab) + 16px)",
          background: "var(--surface)",
          borderTop: "1px solid var(--surface-brd)",
        }}
      >
        <button
          type="button"
          onClick={() => { sfx.swoosh(); haptic("light"); onExit(); }}
          className="btn-flat t-title"
          style={{ flex: "0 0 34%", minHeight: 50, fontSize: 13 }}
        >
          {tr("ВЫЙТИ")}
        </button>
        <button
          type="button"
          disabled={startDisabled}
          onClick={() => { sfx.power?.(); haptic("medium"); onStart(); }}
          className="btn-acc t-title"
          style={{ flex: 1, minHeight: 50, fontSize: 14 }}
        >
          {startLabel}
        </button>
      </div>
    </motion.div>
  );
}

/** Блок настройки внутри GameIntro: подпись + варианты */
export function IntroGroup({
  label, children,
}: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="t-label" style={{ fontSize: 9.5, marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

/**
 * Вариант выбора: заметно выделяется, когда активен.
 *
 * Раньше выбранный пункт отличался от невыбранного только полупрозрачной
 * рамкой — на телефоне разницы не видно вообще.
 */
export function IntroOption({
  label, desc, active, onClick, wide,
}: {
  label: string; desc?: string; active?: boolean; onClick: () => void;
  /** во всю ширину (список) вместо доли строки */
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => { sfx.click(); haptic("light"); onClick(); }}
      className={wide ? "w-full" : "flex-1"}
      style={{
        display: "block",
        textAlign: wide ? "left" : "center",
        marginBottom: wide ? 8 : 0,
        padding: desc ? "12px 14px" : "12px 10px",
        borderRadius: "var(--r-md)",
        background: active ? "var(--acc)" : "var(--surface-2)",
        border: `1px solid ${active ? "var(--acc)" : "var(--btn-brd)"}`,
        color: active ? "var(--acc-ink)" : "var(--text)",
        transition: "background .16s, border-color .16s, color .16s",
      }}
    >
      <span
        className="t-title-sm block clip1"
        style={{ fontSize: 12.5, letterSpacing: "0.01em" }}
      >
        {label}
      </span>
      {desc && (
        <span
          className="block clip1"
          style={{
            fontSize: 10.5, marginTop: 3, lineHeight: 1.4,
            color: active ? "color-mix(in srgb, var(--acc-ink) 72%, transparent)" : "var(--text-mute)",
          }}
        >
          {desc}
        </span>
      )}
    </button>
  );
}

/** Пронумерованный список правил */
export function IntroRules({ lines }: { lines: string[] }) {
  return (
    <div
      style={{
        borderRadius: "var(--r-md)",
        background: "var(--surface)",
        border: "1px solid var(--surface-brd)",
        padding: "14px 15px",
      }}
    >
      {lines.map((txt, i) => (
        <div key={txt} className="flex" style={{ gap: 11, marginBottom: i === lines.length - 1 ? 0 : 10 }}>
          <span
            className="t-num shrink-0 flex items-center justify-center"
            style={{
              width: 21, height: 21, borderRadius: "var(--r-xs)",
              background: "var(--acc)", color: "var(--acc-ink)", fontSize: 10.5,
            }}
          >
            {i + 1}
          </span>
          <span className="t-body" style={{ lineHeight: 1.5, fontSize: 12 }}>{tr(txt)}</span>
        </div>
      ))}
    </div>
  );
}
