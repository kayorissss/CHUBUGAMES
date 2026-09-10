import type { PieceKind } from "../core/chess";

/**
 * Фигуры для настольных игр — только SVG, никаких эмодзи.
 *
 * Силуэты нарисованы так, чтобы читаться на маленькой клетке телефона:
 * крупные заливки, минимум тонких линий. Белые — светлая заливка с
 * тёмной обводкой, чёрные — наоборот, чтобы обе стороны были одинаково
 * различимы и на тёмной, и на светлой теме.
 */

const PATHS: Record<PieceKind, string> = {
  // пешка
  p: "M24 9c-3.2 0-5.8 2.6-5.8 5.8 0 1.9.9 3.6 2.3 4.7-2.4 1.2-4 3.6-4.4 6.6h-.6c-.9 0-1.6.7-1.6 1.6 0 .9.7 1.6 1.6 1.6h1.1c-.3 3.2-1.6 5.9-3.4 7.9h33.6c-1.8-2-3.1-4.7-3.4-7.9h1.1c.9 0 1.6-.7 1.6-1.6 0-.9-.7-1.6-1.6-1.6h-.6c-.4-3-2-5.4-4.4-6.6 1.4-1.1 2.3-2.8 2.3-4.7C41.8 11.6 39.2 9 36 9",
  // конь
  n: "M17 39h20c.4-4.2-.4-8-2.2-11.3-1.7-3.1-3.7-5.2-5.3-6.6l1.9-3.3c.5-.9.2-2-.7-2.5l-2.6-1.5-1.3 2.2-2.2-1.3.9-1.6c.5-.9.2-2-.7-2.5-.9-.5-2-.2-2.5.7l-1.3 2.2c-3.6.6-6.6 2.7-8.5 5.9-1 1.7-1.6 3.5-1.9 5.2-.2 1.1.6 2.1 1.7 2.2.6.1 1.2-.1 1.6-.5l3.3-3.1 2 1.8-4.3 4.5c-1.9 2-2.4 5.1-2.4 9.5z",
  // слон
  b: "M24 8c-1.6 0-2.9 1.3-2.9 2.9 0 .9.4 1.7 1.1 2.3-3.4 2.4-5.6 6.3-5.6 10.8 0 2.9.9 5.5 2.5 7.6-.9.6-1.5 1.6-1.5 2.8v.7h12.8v-.7c0-1.2-.6-2.2-1.5-2.8 1.6-2.1 2.5-4.7 2.5-7.6 0-4.5-2.2-8.4-5.6-10.8.7-.6 1.1-1.4 1.1-2.3C26.9 9.3 25.6 8 24 8z M13 39h22c0-1.7-1.3-3-3-3H16c-1.7 0-3 1.3-3 3z",
  // ладья
  r: "M13 39h22v-3H13v3z M15 36h18l-1.5-14h-15L15 36z M13 8v7h4v-3h4v3h6v-3h4v3h4V8H13z M17 15h14l.8 7h-15.6l.8-7z",
  // ферзь
  q: "M11 39h26v-3.5H11V39z M13 35h22l2-15-6 5-4-11-4 11-4-11-4 11-6-5 4 15z M11 17a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z M19 14a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z M29 14a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z M37 17a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z",
  // король
  k: "M22.4 8h3.2v3.4H29v3.2h-3.4V18h-3.2v-3.4H19v-3.2h3.4V8z M13 39h22v-3.5H13V39z M15 35.5h18c1.5-4.5 2.5-8.3 2.5-11 0-3.6-2.6-6.2-5.8-6.2-2.4 0-4.4 1.3-5.7 3.4-1.3-2.1-3.3-3.4-5.7-3.4-3.2 0-5.8 2.6-5.8 6.2 0 2.7 1 6.5 2.5 11z",
};

export function ChessPiece({
  kind, color, size = 34,
}: { kind: PieceKind; color: "w" | "b"; size?: number }) {
  const fill = color === "w" ? "#f4f4f6" : "#1b1b20";
  const stroke = color === "w" ? "#26262c" : "#eaeaef";
  return (
    <svg
      width={size} height={size} viewBox="0 0 48 48"
      style={{ display: "block", pointerEvents: "none" }}
      aria-hidden
    >
      <path
        d={PATHS[kind]}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Шашка: круг с насечкой, дамка — с короной-звёздочкой */
export function CheckerPiece({
  color, king, size = 34,
}: { color: "w" | "b"; king: boolean; size?: number }) {
  const fill = color === "w" ? "#f2f2f5" : "#1d1d23";
  const edge = color === "w" ? "#b9b9c4" : "#000";
  const stroke = color === "w" ? "#2a2a31" : "#e8e8ee";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "block", pointerEvents: "none" }} aria-hidden>
      <circle cx="24" cy="26" r="17" fill={edge} opacity="0.85" />
      <circle cx="24" cy="24" r="17" fill={fill} stroke={stroke} strokeWidth="1.8" />
      <circle cx="24" cy="24" r="12" fill="none" stroke={stroke} strokeWidth="1.1" opacity="0.55" />
      {king && (
        <path
          d="M16 27l-1.6-8 5.2 3.6L24 15l4.4 7.6 5.2-3.6L32 27H16z"
          fill="var(--gold)" stroke="#7a5200" strokeWidth="1.1" strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/** Фишка для нард — плоская шайба */
export function Checker2D({
  color, size = 26,
}: { color: "w" | "b"; size?: number }) {
  const fill = color === "w" ? "#f2f2f5" : "#1d1d23";
  const stroke = color === "w" ? "#2a2a31" : "#e8e8ee";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "block", pointerEvents: "none" }} aria-hidden>
      <circle cx="24" cy="24" r="20" fill={fill} stroke={stroke} strokeWidth="2.4" />
      <circle cx="24" cy="24" r="12" fill="none" stroke={stroke} strokeWidth="1.6" opacity="0.5" />
    </svg>
  );
}

/** Игральная кость с точками */
export function Die({ n, size = 34, used }: { n: number; size?: number; used?: boolean }) {
  const dots: Record<number, [number, number][]> = {
    1: [[24, 24]],
    2: [[15, 15], [33, 33]],
    3: [[15, 15], [24, 24], [33, 33]],
    4: [[15, 15], [33, 15], [15, 33], [33, 33]],
    5: [[15, 15], [33, 15], [24, 24], [15, 33], [33, 33]],
    6: [[15, 14], [33, 14], [15, 24], [33, 24], [15, 34], [33, 34]],
  };
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "block", opacity: used ? 0.28 : 1 }} aria-hidden>
      <rect x="4" y="4" width="40" height="40" rx="8" fill="#f2f2f5" stroke="#2a2a31" strokeWidth="2" />
      {(dots[n] || []).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4.2" fill="#1b1b20" />
      ))}
    </svg>
  );
}
