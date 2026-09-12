import type { CSSProperties } from "react";

/**
 * ЗНАК ПРИЛОЖЕНИЯ.
 *
 * Раньше «логотипом» были две жёлтые плашки и буквы ЧГ, нарисованные
 * шрифтом: на телефоне это выглядело терпимо, на мониторе — как заставка
 * мессенджера. Теперь знак один на всё приложение и рисуется вектором из
 * тех же путей, что и файлы в branding/ (logo.svg, mark.svg): бургер из
 * трёх слоёв — булка, сыр, котлета — в плашке с тёплой обводкой.
 *
 * Вектор, а не PNG, по трём причинам:
 *  • не размывается на 4K и при масштабировании интерфейса;
 *  • цвета берутся из дизайн-системы (var(--acc)), то есть знак меняется
 *    вместе с акцентной темой — как и всё остальное;
 *  • не тянет в сборку лишних килобайт растровой картинки.
 *
 * Если правишь форму — правь одновременно branding/*.svg и запускай
 * `npm run icons`, иначе иконка приложения и знак внутри
 * приложения начнут жить разными формами.
 */

/* Пути совпадают с branding/logo.svg: знак внутри приложения и иконка
   приложения обязаны быть одной формой (пересборка — `npm run icons`). */
const BUN_TOP_D =
  "M104 214v-10c0-62 68-104 152-104s152 42 152 104v10c0 11-9 20-20 20H124c-11 0-20-9-20-20Z";
const LEAF_D =
  "M106 236h300c0 15-13 26-29 26H135c-16 0-29-11-29-26Z";
const CHEESE_BAR_D =
  "M112 262h288c9 0 16 7 16 16v6H96v-6c0-9 7-16 16-16Z";
/* потёки сыра: два симметричных зуба по краям — асимметрия в 40 px читалась
   как «криво нарисовано» */
const CHEESE_DRIP_D =
  "M96 286h320l-32 24-32-24h-192l-32 24-32-24Z";
const BUN_BOTTOM_D =
  "M126 362h260c11 0 20 9 20 20 0 24-22 40-52 40H158c-30 0-52-16-52-40 0-11 9-20 20-20Z";

export function Burger({
  size = 32,
  accent,
  glow = false,
  style,
}: {
  size?: number;
  /** Переопределить цвет булок (по умолчанию — акцент темы) */
  accent?: string;
  /** Тёплое свечение под знаком */
  glow?: boolean;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      style={
        {
          display: "block",
          overflow: "visible",
          ...(accent ? { ["--acc" as string]: accent } : null),
          ...style,
        } as CSSProperties
      }
    >
      <defs>
        <linearGradient id="cbTop" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="color-mix(in srgb, #ffffff 42%, var(--acc))" />
          <stop offset="0.55" stopColor="var(--acc)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--acc) 72%, #000)" />
        </linearGradient>
        <linearGradient id="cbBottom" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="color-mix(in srgb, var(--acc) 88%, #fff)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--acc) 62%, #000)" />
        </linearGradient>
        <linearGradient id="cbCheese" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE27A" />
          <stop offset="1" stopColor="#FFC93C" />
        </linearGradient>
        <linearGradient id="cbPatty" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8B5130" />
          <stop offset="1" stopColor="#5A2F18" />
        </linearGradient>
        <linearGradient id="cbLeaf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="color-mix(in srgb, var(--ok) 70%, #7FD35A)" />
          <stop offset="1" stopColor="#3F7C2A" />
        </linearGradient>
      </defs>

      <g>
        {glow && <ellipse cx="256" cy="286" rx="212" ry="150" fill="var(--acc)" opacity="0.14" />}
        <path d={BUN_TOP_D} fill="url(#cbTop)" />
        <path
          d={BURGER_PATHS.shine}
          fill="#ffffff"
          opacity="0.18"
        />
        <g fill="#FFF6E6" opacity="0.92">
          {BURGER_PATHS.seeds.map((sd, i) => (
            <ellipse
              key={i}
              cx={sd.cx}
              cy={sd.cy}
              rx="15.5"
              ry="8.6"
              transform={`rotate(${sd.rot} ${sd.cx} ${sd.cy})`}
            />
          ))}
        </g>
        <path d={LEAF_D} fill="url(#cbLeaf)" />
        <path d={CHEESE_BAR_D} fill="url(#cbCheese)" />
        <path d={CHEESE_DRIP_D} fill="url(#cbCheese)" />
        <rect {...BURGER_PATHS.patty} fill="url(#cbPatty)" />
        <rect x="136" y="316" width="240" height="9" rx="4.5" fill="#ffffff" opacity="0.14" />
        <path d={BUN_BOTTOM_D} fill="url(#cbBottom)" />
      </g>
    </svg>
  );
}

/**
 * Плашка со знаком — то, что стоит в шапке, в заставке и в иконке.
 * `tile` меняет форму под задачи: скруглённый квадрат для шапки,
 * большой квадрат с обводкой для заставки.
 */
export function BrandMark({
  size = 40,
  radius,
  border = true,
  glow = false,
  style,
}: {
  size?: number;
  radius?: number;
  border?: boolean;
  glow?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: radius ?? Math.round(size * 0.26),
        background:
          "linear-gradient(140deg, color-mix(in srgb, var(--surface-3) 70%, #fff 4%), var(--n-050) 55%, var(--n-000))",
        boxShadow: border
          ? "inset 0 0 0 1px color-mix(in srgb, var(--acc) 30%, transparent), 0 10px 26px -14px rgba(0,0,0,0.9)"
          : undefined,
        overflow: "hidden",
        flexShrink: 0,
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(120% 90% at 50% 42%, color-mix(in srgb, var(--acc) 26%, transparent), transparent 62%)",
        }}
      />
      <Burger size={Math.round(size * 0.72)} glow={glow} style={{ position: "relative" }} />
    </span>
  );
}

/**
 * Пути знака наружу — из них же собирается анимированный логотип
 * заставки (src/ui/BootScreen.tsx), чтобы заставка и иконка приложения
 * не разъехались по формам.
 */
export const BURGER_PATHS = {
  bunTop: BUN_TOP_D,
  leaf: LEAF_D,
  cheeseBar: CHEESE_BAR_D,
  cheeseDrip: CHEESE_DRIP_D,
  /** котлета — это <rect>, поэтому отдаём атрибуты как есть: их распыляют
      и статичный знак, и анимированный в заставке ({...BURGER_PATHS.patty}) */
  patty: { x: 122, y: 310, width: 268, height: 46, rx: 23 },
  bunBottom: BUN_BOTTOM_D,
  shine: "M138 154c24-26 60-40 98-40-34 14-60 34-78 58-10 14-24 12-26-4-1-6 1-11 6-14Z",
  seeds: [
    { cx: 176, cy: 180, rot: -16 },
    { cx: 240, cy: 156, rot: -5 },
    { cx: 270, cy: 196, rot: 3 },
    { cx: 306, cy: 164, rot: 9 },
    { cx: 352, cy: 192, rot: 17 },
  ],
};

export default BrandMark;
