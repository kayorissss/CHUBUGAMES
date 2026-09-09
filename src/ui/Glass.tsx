import { motion } from "framer-motion";
import type { ReactNode, CSSProperties } from "react";
import { sfx, haptic } from "../core/fx";

export function Panel({
  children, className = "", style, r = "lg", strong,
}: {
  children?: ReactNode; className?: string; style?: CSSProperties;
  r?: "sm" | "md" | "lg" | "xl"; strong?: boolean;
}) {
  return (
    <div
      className={`glass ${strong ? "glass-strong" : ""} ${className}`}
      style={{ borderRadius: `var(--r-${r})`, ...style }}
    >
      {children}
    </div>
  );
}

export function Tap({
  children, onClick, className = "", style, disabled, r = "md", accent, sound = "click", strong,
}: {
  children?: ReactNode; onClick?: () => void; className?: string; style?: CSSProperties;
  disabled?: boolean; r?: "sm" | "md" | "lg" | "xl"; accent?: boolean; strong?: boolean;
  sound?: keyof typeof sfx | "none";
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.955 }}
      transition={{ type: "spring", stiffness: 620, damping: 26 }}
      onClick={() => {
        if (disabled) return;
        if (sound !== "none") (sfx as any)[sound]?.();
        haptic("light");
        onClick?.();
      }}
      className={`glass ${accent ? "glass-acc" : ""} ${strong ? "glass-strong" : ""} ${className}`}
      style={{
        borderRadius: `var(--r-${r})`,
        opacity: disabled ? 0.42 : 1,
        cursor: disabled ? "default" : "pointer",
        ...style,
      }}
    >
      {children}
    </motion.button>
  );
}

export function Bar({ pct, h = 8, color }: { pct: number; h?: number; color?: string }) {
  return (
    <div
      style={{
        height: h, borderRadius: 99, background: "rgba(255,255,255,0.09)",
        overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <motion.div
        initial={false}
        animate={{ width: `${Math.max(0, Math.min(100, pct * 100))}%` }}
        transition={{ type: "spring", stiffness: 180, damping: 26 }}
        style={{
          height: "100%",
          background: color || "linear-gradient(90deg, color-mix(in srgb, var(--acc) 70%, white), var(--acc))",
          boxShadow: "0 0 12px var(--acc-glow)",
          borderRadius: 99,
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
      className={`press ${className}`}
      style={{
        padding: "8px 14px", borderRadius: 99, fontSize: 12, fontWeight: 700,
        letterSpacing: "0.02em", whiteSpace: "nowrap",
        background: active ? "var(--acc)" : "rgba(255,255,255,0.06)",
        color: active ? "var(--acc-ink)" : "var(--text-dim)",
        border: `1px solid ${active ? "transparent" : "var(--glass-brd)"}`,
        boxShadow: active ? "0 6px 18px -8px var(--acc-glow)" : "none",
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

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-3 px-1">
      <div className="t-label">{children}</div>
      {right}
    </div>
  );
}
