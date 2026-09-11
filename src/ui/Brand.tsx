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
 *  • цвета берутся из дизайн-системы (var(--acc)), то есть знак MENЯЕТСЯ
 *    вместе с акцентной темой — как и всё остальное;
 *  • не тянет в сборку лишних килобайт растровой картинки.
 *
 * Если правишь форму — правь одновременно branding/*.svg и запускай
 * `npm run icons`, иначе иконка приложения и знак внутри
 * приложения начнут жить разными формами.
 */

const BUN_TOP_D =
  "M116 222v-16c0-56 63-96 140-96s140 40 140 96v16c0 10-8 18-18 18H134c-10 0-18-8-18-18Z";
const CHEESE_BAR_D =
  "M108 248h296c10 0 18 8 18 18v8H90v-8c0-10 8-18 18-18Z";
const CHEESE_DRIP_D =
  "M90 274h332l-40 46-44-32-46 46-44-46-46 32-40-46Z";
const BUN_BOTTOM_D =
  "M108 380h296c10 0 18 8 18 18v4c0 32-26 58-58 58H148c-32 0-58-26-58-58v-4c0-10 8-18 18-18Z";

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
      </defs>

      <g transform="translate(0 -26)">
        {glow && <ellipse cx="256" cy="300" rx="212" ry="150" fill="var(--acc)" opacity="0.14" />}
        <path d={BUN_TOP_D} fill="url(#cbTop)" />
        <path
          d="M148 152c22-24 56-36 92-36-30 12-54 30-70 52Z"
          fill="#ffffff"
          opacity="0.16"
        />
        <g fill="#FFF4E2" opacity="0.9">
          <ellipse cx="192" cy="176" rx="15" ry="9" transform="rotate(-13 192 176)" />
          <ellipse cx="258" cy="156" rx="15" ry="9" />
          <ellipse cx="324" cy="178" rx="15" ry="9" transform="rotate(12 324 178)" />
        </g>
        <path d={CHEESE_BAR_D} fill="url(#cbCheese)" />
        <path d={CHEESE_DRIP_D} fill="url(#cbCheese)" />
        <rect {...BURGER_PATHS.patty} fill="url(#cbPatty)" />
        <rect x="98" y="318" width="316" height="14" rx="7" fill="#A9663C" opacity="0.75" />
        <path d={BUN_BOTTOM_D} fill="url(#cbBottom)" />
        <path
          d="M126 392h260"
          stroke="#ffffff"
          strokeOpacity="0.14"
          strokeWidth="6"
          strokeLinecap="round"
        />
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
  cheeseBar: CHEESE_BAR_D,
  cheeseDrip: CHEESE_DRIP_D,
  /** котлета — это <rect>, поэтому отдаём атрибуты как есть: их распыляют
      и статичный знак, и анимированный в заставке ({...BURGER_PATHS.patty}) */
  patty: { x: 98, y: 318, width: 316, height: 44, rx: 22 },
  bunBottom: BUN_BOTTOM_D,
  shine: "M148 152c22-24 56-36 92-36-30 12-54 30-70 52Z",
  seeds: [
    { cx: 192, cy: 176, rot: -13 },
    { cx: 258, cy: 156, rot: 0 },
    { cx: 324, cy: 178, rot: 12 },
  ],
};

export default BrandMark;
