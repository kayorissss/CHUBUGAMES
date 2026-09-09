import type { ItemDef } from "../core/gamble";

/**
 * Картинки украшений — чистый SVG, без эмодзи.
 * Один компонент и для витрины, и для превью на голове.
 */
export default function ItemIcon({
  id, size = 28, color,
}: {
  id: string;
  size?: number;
  color?: string;
}) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color || "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (id) {
    /* ── головные уборы ── */
    case "cap_black":
    case "cap_red":
      return (
        <svg {...p}>
          <path d="M4 14a8 8 0 0116 0z" />
          <path d="M20 14h2.5a1.5 1.5 0 010 3H20" />
        </svg>
      );
    case "beanie":
      return (
        <svg {...p}>
          <path d="M5 14a7 7 0 0114 0z" />
          <path d="M3.5 14h17M12 4v3" />
        </svg>
      );
    case "bucket":
      return (
        <svg {...p}>
          <path d="M6.5 13a5.5 5.5 0 0111 0z" />
          <path d="M4 13h16l-1.5 4h-13z" />
        </svg>
      );
    case "helmet":
      return (
        <svg {...p}>
          <path d="M5 15a7 7 0 0114 0z" />
          <path d="M3 15h18" />
          <path d="M12 8v-2" />
        </svg>
      );
    case "crown_plast":
    case "crown_gold":
      return (
        <svg {...p}>
          <path d="M4 17l-1-9 5 4 4-6 4 6 5-4-1 9z" />
          <path d="M4 17h16" />
        </svg>
      );

    /* ── очки ── */
    case "glass_round":
      return (
        <svg {...p}>
          <circle cx="7.5" cy="13" r="3.6" />
          <circle cx="16.5" cy="13" r="3.6" />
          <path d="M11.1 13h1.8M3.9 12L2 10.5M20.1 12L22 10.5" />
        </svg>
      );
    case "glass_deal":
      return (
        <svg {...p}>
          <rect x="3" y="9.5" width="7.5" height="5" />
          <rect x="13.5" y="9.5" width="7.5" height="5" />
          <path d="M10.5 12h3" />
        </svg>
      );
    case "glass_vr":
      return (
        <svg {...p}>
          <rect x="2.5" y="8.5" width="19" height="8" rx="2.5" />
          <path d="M12 10.5v4" />
        </svg>
      );

    /* ── цепи ── */
    case "chain_thin":
    case "chain_gold":
      return (
        <svg {...p}>
          <path d="M5 7c0 6 3 10 7 10s7-4 7-10" />
          <circle cx="12" cy="17.5" r="2.2" />
        </svg>
      );

    /* ── ауры ── */
    case "aura_smoke":
      return (
        <svg {...p}>
          <path d="M5 15c2-1 3.5 1 5.5 0s3.5-2 5.5-1 3 1 3 1" />
          <path d="M5 11c2-1 3.5 1 5.5 0s3.5-2 5.5-1 3 1 3 1" />
        </svg>
      );
    case "aura_fire":
      return (
        <svg {...p}>
          <path d="M12 3s5 4.5 5 9a5 5 0 01-10 0c0-2 1-3.5 2-4.5.3 1.5 1 2.5 2 2.5 0-3 1-6 1-7z" />
        </svg>
      );
    case "aura_ice":
      return (
        <svg {...p}>
          <path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10" />
        </svg>
      );
    case "aura_rgb":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
        </svg>
      );

    /* ── питомцы ── */
    case "pet_burger":
      return (
        <svg {...p}>
          <path d="M4.5 10a7.5 7.5 0 0115 0z" />
          <path d="M4 13h16M5 16h14" />
        </svg>
      );
    case "pet_chub":
      return (
        <svg {...p}>
          <circle cx="12" cy="10" r="5.5" />
          <path d="M8.5 19c1-1.5 2.2-2.2 3.5-2.2s2.5.7 3.5 2.2" />
        </svg>
      );

    default:
      return (
        <svg {...p}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
        </svg>
      );
  }
}

/** Иконка по описанию предмета — удобно в списках */
export function ItemGlyph({ item, size, color }: { item: ItemDef; size?: number; color?: string }) {
  return <ItemIcon id={item.id} size={size} color={color} />;
}
