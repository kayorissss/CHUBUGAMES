import { motion } from "framer-motion";
import type { ReactNode, CSSProperties } from "react";
import { sfx, haptic } from "../core/fx";

type R = "xs" | "sm" | "md" | "lg" | "xl" | "pill";
const rad = (r: R) => `var(--r-${r})`;

/* ---------- Поверхности ---------- */

/** Стеклянная панель — для «геройских» блоков поверх фона */
export function Panel({
  children, className = "", style, r = "lg", strong,
}: {
  children?: ReactNode; className?: string; style?: CSSProperties;
  r?: R; strong?: boolean;
}) {
  return (
    <div
      className={`glass ${strong ? "glass-strong" : ""} ${className}`}
      style={{ borderRadius: rad(r), ...style }}
    >
      {children}
    </div>
  );
}

/** Сплошная карточка — для списков и плотного контента (читается лучше стекла) */
export function Card({
  children, className = "", style, r = "lg", tone = 1, active,
}: {
  children?: ReactNode; className?: string; style?: CSSProperties;
  r?: R; tone?: 1 | 2; active?: boolean;
}) {
  return (
    <div
      className={`solid ${tone === 2 ? "solid-2" : ""} ${className}`}
      style={{
        borderRadius: rad(r),
        ...(active
          ? {
              borderColor: "var(--acc)",
              boxShadow: "0 0 0 1px var(--acc) inset, 0 8px 24px -14px var(--acc-glow)",
            }
          : null),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ---------- Кнопки ---------- */

export type BtnVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  children, onClick, variant = "secondary", size = "md", r = "md",
  disabled, className = "", style, sound = "click", full, icon,
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  r?: R;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  sound?: keyof typeof sfx | "none";
  full?: boolean;
  icon?: ReactNode;
}) {
  const pad =
    size === "lg" ? "15px 26px" : size === "sm" ? "9px 16px" : "12px 20px";
  const fs = size === "lg" ? 14 : size === "sm" ? 11.5 : 13;
  const minH = size === "lg" ? 50 : size === "sm" ? 34 : 42;

  const skin: Record<BtnVariant, CSSProperties> = {
    primary: {
      background: "var(--acc)",
      color: "var(--acc-ink)",
      border: "1px solid transparent",
      boxShadow: "0 6px 18px -10px var(--acc-glow)",
    },
    secondary: {
      background: "var(--btn-bg)",
      color: "var(--text)",
      border: "1px solid var(--btn-brd)",
    },
    ghost: {
      background: "transparent",
      color: "var(--text-dim)",
      border: "1px solid transparent",
    },
    danger: {
      background: "transparent",
      color: "var(--danger)",
      border: "1px solid var(--danger-brd)",
    },
  };

  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 700, damping: 30 }}
      onClick={() => {
        if (disabled) return;
        if (sound !== "none") (sfx as any)[sound]?.();
        haptic("light");
        onClick?.();
      }}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: full ? "100%" : undefined,
        minHeight: minH,
        padding: pad,
        boxSizing: "border-box",
        borderRadius: rad(r),
        fontFamily: '"Unbounded", "Inter Variable", system-ui, sans-serif',
        fontSize: fs,
        fontWeight: 600,
        letterSpacing: "0.005em",
        lineHeight: 1.15,
        textAlign: "center",
        whiteSpace: "nowrap",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "background 0.16s, border-color 0.16s, opacity 0.16s",
        ...skin[variant],
        ...style,
      }}
    >
      {icon}
      {children}
    </motion.button>
  );
}

/** Кликабельная область произвольного вида (карточка-кнопка) */
export function Tap({
  children, onClick, className = "", style, disabled, r = "md",
  accent, sound = "click", strong, solid, center,
}: {
  children?: ReactNode; onClick?: () => void; className?: string;
  style?: CSSProperties; disabled?: boolean; r?: R; accent?: boolean;
  strong?: boolean; solid?: boolean; sound?: keyof typeof sfx | "none";
  /** выравнивать содержимое по центру (для кнопок-табов) */
  center?: boolean;
}) {
  const base = solid ? "solid" : "glass";
  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.975 }}
      transition={{ type: "spring", stiffness: 700, damping: 30 }}
      onClick={() => {
        if (disabled) return;
        if (sound !== "none") (sfx as any)[sound]?.();
        haptic("light");
        onClick?.();
      }}
      className={`${base} ${accent ? "glass-acc" : ""} ${strong ? "glass-strong" : ""} ${className}`}
      style={{
        borderRadius: rad(r),
        opacity: disabled ? 0.42 : 1,
        cursor: disabled ? "default" : "pointer",
        textAlign: center ? "center" : "left",
        ...style,
      }}
    >
      {children}
    </motion.button>
  );
}

/* ---------- Мелочи ---------- */

export function Bar({
  pct, h = 8, color, track,
}: {
  pct: number; h?: number; color?: string; track?: string;
}) {
  return (
    <div
      style={{
        height: h,
        borderRadius: 999,
        background: track || "var(--track)",
        overflow: "hidden",
      }}
    >
      <motion.div
        initial={false}
        animate={{ width: `${Math.max(0, Math.min(100, pct * 100)) }%` }}
        transition={{ type: "spring", stiffness: 200, damping: 28 }}
        style={{
          height: "100%",
          background: color || "var(--acc)",
          borderRadius: 999,
        }}
      />
    </div>
  );
}

export function Chip({
  children, active, onClick, className = "",
}: {
  children: ReactNode; active?: boolean; onClick?: () => void; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => { sfx.click(); haptic("light"); onClick?.(); }}
      className={className}
      style={{
        padding: "9px 15px",
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 700,
        letterSpacing: "-0.005em",
        whiteSpace: "nowrap",
        lineHeight: 1,
        background: active ? "var(--acc)" : "var(--btn-bg)",
        color: active ? "var(--acc-ink)" : "var(--text-dim)",
        border: `1px solid ${active ? "transparent" : "var(--btn-brd)"}`,
        transition: "background 0.16s, color 0.16s",
      }}
    >
      {children}
    </button>
  );
}

export function Aurora() {
  return (
    <div className="aurora" aria-hidden>
      <span className="b1" />
      <span className="b2" />
      <span className="b3" />
    </div>
  );
}

/** Заголовок секции с единым отступом */
export function SectionTitle({
  children, right, className = "",
}: {
  children: ReactNode; right?: ReactNode; className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`} style={{ marginBottom: 10 }}>
      <div className="t-label">{children}</div>
      {right}
    </div>
  );
}

/** Каркас экрана: единые поля, отступ сверху и запас под таб-бар */
export function Screen({
  title, right, children, scroll = true, sub,
}: {
  title?: string; right?: ReactNode; children: ReactNode;
  scroll?: boolean; sub?: string;
}) {
  return (
    <div className="h-full flex flex-col">
      {title && (
        <div
          className="flex items-center justify-between gap-3 shrink-0"
          style={{
            padding: "0 16px 12px",
            paddingTop: "calc(var(--sat) + 14px)",
          }}
        >
          <div className="min-w-0">
            <h1 className="t-display clip1">{title}</h1>
            {sub && <div className="t-caption clip1" style={{ marginTop: 3 }}>{sub}</div>}
          </div>
          {right}
        </div>
      )}
      <div
        className={scroll ? "flex-1 scroll" : "flex-1"}
        style={{
          padding: "0 16px",
          paddingBottom: "calc(var(--sab) + 104px)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Разделитель внутри списков */
export function Divider({ inset = 0 }: { inset?: number }) {
  return (
    <div
      style={{
        height: 1,
        background: "var(--surface-brd)",
        marginLeft: inset,
      }}
    />
  );
}
