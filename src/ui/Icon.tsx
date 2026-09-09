/**
 * Единый набор векторных иконок.
 *
 * Эмодзи выглядят по-разному на каждом Android и ломают стиль,
 * поэтому весь интерфейс рисуется этими SVG. Цвет наследуется
 * через currentColor, акцентные детали — var(--acc).
 */

export type IconName =
  | "coin" | "gem" | "trophy" | "crown" | "star" | "fire" | "bolt" | "heart"
  | "target" | "clock" | "calendar" | "gift" | "case" | "lock" | "check"
  | "cross" | "plus" | "minus" | "chevron" | "arrowDown" | "arrowUp"
  | "download" | "refresh" | "settings" | "user" | "users" | "shop"
  | "chart" | "music" | "sound" | "soundOff" | "vibrate" | "moon" | "sun" | "globe"
  | "wifi" | "speed" | "shield" | "skull" | "burger" | "tooth" | "hammer"
  | "brain" | "sparkle" | "flag" | "medal" | "ticket" | "rocket" | "leaf"
  | "snow" | "magnet" | "clover" | "fist" | "gear" | "bank" | "dice"
  | "trash" | "upload" | "info" | "warn" | "play" | "pause" | "home"
  | "level" | "tap" | "eye" | "run" | "note";

export default function Icon({
  name,
  size = 18,
  accent = false,
  className = "",
  style,
}: {
  name: IconName;
  size?: number;
  /** залить основным акцентом вместо currentColor */
  accent?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const c = accent ? "var(--acc)" : "currentColor";
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: c,
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    style,
  };

  switch (name) {
    case "coin":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5v9M14.6 9.6c-.6-.7-1.6-1.1-2.6-1.1-1.5 0-2.6.8-2.6 1.9 0 2.6 5.2 1.1 5.2 3.7 0 1.1-1.1 1.9-2.6 1.9-1.1 0-2.1-.4-2.7-1.2" />
        </svg>
      );
    case "gem":
      return (
        <svg {...p}>
          <path d="M6 3h12l3.5 6L12 21 2.5 9z" />
          <path d="M2.5 9h19M9 3l-2 6 5 12 5-12-2-6" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...p}>
          <path d="M7 4h10v6a5 5 0 01-10 0z" />
          <path d="M7 5.5H4.5A2.5 2.5 0 007 10M17 5.5h2.5A2.5 2.5 0 0117 10" />
          <path d="M12 15v3M8.5 21h7M9.5 21c0-1.7 1-3 2.5-3s2.5 1.3 2.5 3" />
        </svg>
      );
    case "crown":
      return (
        <svg {...p}>
          <path d="M3 8l3.5 3L12 5l5.5 6L21 8l-1.8 10H4.8z" />
          <path d="M4.8 18h14.4" />
        </svg>
      );
    case "star":
      return (
        <svg {...p}>
          <path d="M12 3.5l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9z" />
        </svg>
      );
    case "fire":
      return (
        <svg {...p}>
          <path d="M12 3s5.5 4.2 5.5 9.3A5.5 5.5 0 0112 18a5.5 5.5 0 01-5.5-5.7C6.5 9 9 7.4 9 7.4s.3 2.4 1.7 2.4c1.6 0 1.3-3.9 1.3-6.8z" />
          <path d="M12 18c-1.4 0-2.5-1.1-2.5-2.5S12 12 12 12s2.5 2.1 2.5 3.5S13.4 18 12 18z" fill={c} stroke="none" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...p}>
          <path d="M13.5 2.5L5 13.5h5.5L10 21.5l8.5-11H13z" />
        </svg>
      );
    case "heart":
      return (
        <svg {...p}>
          <path d="M12 20s-7.5-4.6-7.5-9.5A4.2 4.2 0 0112 8.2a4.2 4.2 0 017.5 2.3C19.5 15.4 12 20 12 20z" fill={c} stroke="none" />
        </svg>
      );
    case "target":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="1" fill={c} />
        </svg>
      );
    case "clock":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5.2l3.3 2" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...p}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      );
    case "gift":
      return (
        <svg {...p}>
          <rect x="3" y="9" width="18" height="11.5" rx="2" />
          <path d="M2.5 9h19M12 9v11.5" />
          <path d="M12 9S9.6 3.5 7.4 4.6C5.8 5.4 6.6 9 12 9zM12 9s2.4-5.5 4.6-4.4C18.2 5.4 17.4 9 12 9z" />
        </svg>
      );
    case "case":
      return (
        <svg {...p}>
          <rect x="2.5" y="7" width="19" height="13" rx="2.5" />
          <path d="M8.5 7V5.2A2 2 0 0110.4 3h3.2a2 2 0 011.9 2.2V7M2.5 12.5h19M11 12v2.6h2V12" />
        </svg>
      );
    case "lock":
      return (
        <svg {...p}>
          <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
          <path d="M8 10.5V7.4a4 4 0 018 0v3.1" />
        </svg>
      );
    case "check":
      return (
        <svg {...p}>
          <path d="M4.5 12.8l4.7 4.6L19.5 6.8" />
        </svg>
      );
    case "cross":
      return (
        <svg {...p}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case "plus":
      return (
        <svg {...p}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "minus":
      return (
        <svg {...p}>
          <path d="M5 12h14" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...p}>
          <path d="M9 5.5l7 6.5-7 6.5" />
        </svg>
      );
    case "arrowDown":
      return (
        <svg {...p}>
          <path d="M12 4.5v14M6 13l6 6 6-6" />
        </svg>
      );
    case "arrowUp":
      return (
        <svg {...p}>
          <path d="M12 19.5v-14M6 11l6-6 6 6" />
        </svg>
      );
    case "download":
      return (
        <svg {...p}>
          <path d="M12 3.5v11M7.5 10.5l4.5 4.5 4.5-4.5" />
          <path d="M4 17v1.8A2.2 2.2 0 006.2 21h11.6A2.2 2.2 0 0020 18.8V17" />
        </svg>
      );
    case "upload":
      return (
        <svg {...p}>
          <path d="M12 15.5v-11M7.5 8.5L12 4l4.5 4.5" />
          <path d="M4 17v1.8A2.2 2.2 0 006.2 21h11.6A2.2 2.2 0 0020 18.8V17" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...p}>
          <path d="M20 12a8 8 0 11-2.6-5.9" />
          <path d="M20.5 3.5V9h-5.4" />
        </svg>
      );
    case "settings":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 14.6a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.9 2.9l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6v.2a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.9-2.9l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.6-1H2.5a2 2 0 110-4h.1a1.7 1.7 0 001.6-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.9-2.9l.1.1a1.7 1.7 0 001.9.3h.1a1.7 1.7 0 001-1.6V2.5a2 2 0 114 0v.1a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.9 2.9l-.1.1a1.7 1.7 0 00-.3 1.9v.1a1.7 1.7 0 001.6 1h.2a2 2 0 110 4h-.1a1.7 1.7 0 00-1.6 1z" />
        </svg>
      );
    case "user":
      return (
        <svg {...p}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 20.5a7.5 7.5 0 0115 0" />
        </svg>
      );
    case "users":
      return (
        <svg {...p}>
          <circle cx="9" cy="8" r="3.6" />
          <path d="M2.8 20.4a6.4 6.4 0 0112.4 0" />
          <path d="M16.5 4.8a3.6 3.6 0 010 6.7M18 14.4a6.4 6.4 0 013.3 5.9" />
        </svg>
      );
    case "shop":
      return (
        <svg {...p}>
          <path d="M3.5 8.5h17l-1.3 11a2 2 0 01-2 1.8H6.8a2 2 0 01-2-1.8z" />
          <path d="M8.5 8.5V6a3.5 3.5 0 017 0v2.5" />
        </svg>
      );
    case "chart":
      return (
        <svg {...p}>
          <path d="M4 20V4M4 20h16" />
          <path d="M8 16v-4M12.5 16V8M17 16v-6" />
        </svg>
      );
    case "music":
    case "note":
      return (
        <svg {...p}>
          <path d="M9 18V6l11-2v12" />
          <ellipse cx="6.5" cy="18" rx="2.5" ry="2.2" fill={c} stroke="none" />
          <ellipse cx="17.5" cy="16" rx="2.5" ry="2.2" fill={c} stroke="none" />
        </svg>
      );
    case "sound":
      return (
        <svg {...p}>
          <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
          <path d="M15.5 9a4.2 4.2 0 010 6M18.2 6.4a8 8 0 010 11.2" />
        </svg>
      );
    case "soundOff":
      return (
        <svg {...p}>
          <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
          <path d="M16.5 9.8l4.5 4.4M21 9.8l-4.5 4.4" />
        </svg>
      );
    case "vibrate":
      return (
        <svg {...p}>
          <rect x="8" y="4" width="8" height="16" rx="2" />
          <path d="M4.5 9v6M2 10.5v3M19.5 9v6M22 10.5v3" />
        </svg>
      );
    case "moon":
      return (
        <svg {...p}>
          <path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" />
        </svg>
      );
    case "sun":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
        </svg>
      );
    case "globe":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M3.5 12h17M12 3.5c2.2 2.4 3.4 5.4 3.4 8.5s-1.2 6.1-3.4 8.5c-2.2-2.4-3.4-5.4-3.4-8.5S9.8 5.9 12 3.5z" />
        </svg>
      );
    case "wifi":
      return (
        <svg {...p}>
          <path d="M2.5 9.5a13.5 13.5 0 0119 0M6 13a8.5 8.5 0 0112 0M9.5 16.5a3.6 3.6 0 015 0" />
          <circle cx="12" cy="20" r="1.1" fill={c} stroke="none" />
        </svg>
      );
    case "speed":
      return (
        <svg {...p}>
          <path d="M4 18a8.5 8.5 0 1116 0" />
          <path d="M12 14.5l4-4.5" />
          <circle cx="12" cy="15.5" r="1.4" fill={c} stroke="none" />
        </svg>
      );
    case "shield":
      return (
        <svg {...p}>
          <path d="M12 3l7.5 3v5.5c0 4.6-3.1 8.2-7.5 9.5-4.4-1.3-7.5-4.9-7.5-9.5V6z" />
        </svg>
      );
    case "skull":
      return (
        <svg {...p}>
          <path d="M12 3a8 8 0 00-8 8c0 2.6 1.2 4.5 3 5.6V19a2 2 0 002 2h6a2 2 0 002-2v-2.4c1.8-1.1 3-3 3-5.6a8 8 0 00-8-8z" />
          <circle cx="9" cy="11" r="1.7" fill={c} stroke="none" />
          <circle cx="15" cy="11" r="1.7" fill={c} stroke="none" />
          <path d="M11 21v-2.5M13 21v-2.5" />
        </svg>
      );
    case "burger":
      return (
        <svg {...p}>
          <path d="M4 10c0-3.3 3.6-5.5 8-5.5s8 2.2 8 5.5" />
          <path d="M4 13.5h16M4.5 17h15" />
          <path d="M4 19.5c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5" />
        </svg>
      );
    case "tooth":
      return (
        <svg {...p}>
          <path d="M5 6.5h14v4.5c0 4.5-2.2 9.5-4 9.5s-2-3.5-3-3.5-1.2 3.5-3 3.5-4-5-4-9.5z" />
        </svg>
      );
    case "hammer":
      return (
        <svg {...p}>
          <path d="M5 9l4-4 3 3-4 4z" />
          <path d="M10.5 4.5l3.5 3.5" />
          <path d="M9 13l7.5 7.5a2 2 0 002.8-2.8L11.8 10" />
        </svg>
      );
    case "brain":
      return (
        <svg {...p}>
          <path d="M9.5 4.5A2.8 2.8 0 006.7 7 2.6 2.6 0 005 9.5a2.6 2.6 0 001 2 2.6 2.6 0 00-.4 3.4A2.8 2.8 0 008 19.5h1.5z" />
          <path d="M14.5 4.5A2.8 2.8 0 0117.3 7 2.6 2.6 0 0119 9.5a2.6 2.6 0 01-1 2 2.6 2.6 0 01.4 3.4 2.8 2.8 0 01-2.4 4.6h-1.5z" />
          <path d="M12 4v16" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...p}>
          <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
          <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
        </svg>
      );
    case "flag":
      return (
        <svg {...p}>
          <path d="M5.5 21V3.5M5.5 4.5h11l-2 3.5 2 3.5h-11" />
        </svg>
      );
    case "medal":
      return (
        <svg {...p}>
          <circle cx="12" cy="15" r="5.5" />
          <path d="M8.5 10L6 3h12l-2.5 7" />
          <path d="M12 12.8l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9.1 15l2-.3z" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...p}>
          <path d="M3 8.5V6.5A1.5 1.5 0 014.5 5h15A1.5 1.5 0 0121 6.5v2a3.5 3.5 0 000 7v2a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5v-2a3.5 3.5 0 000-7z" />
          <path d="M14 5v14" strokeDasharray="2 2.5" />
        </svg>
      );
    case "rocket":
      return (
        <svg {...p}>
          <path d="M12 2.5s4.5 3 4.5 8.5c0 2.5-1 4.8-2 6.2h-5c-1-1.4-2-3.7-2-6.2C7.5 5.5 12 2.5 12 2.5z" />
          <circle cx="12" cy="9.5" r="1.8" />
          <path d="M9.5 17.2L7 20l2.5-.5M14.5 17.2L17 20l-2.5-.5" />
        </svg>
      );
    case "leaf":
      return (
        <svg {...p}>
          <path d="M20 4C10 4 4.5 8 4.5 14A5.5 5.5 0 0010 19.5C16 19.5 20 14 20 4z" />
          <path d="M4.5 20C7 15 11 11.5 16 9.5" />
        </svg>
      );
    case "snow":
      return (
        <svg {...p}>
          <path d="M12 2.5v19M3.7 7.2l16.6 9.6M20.3 7.2L3.7 16.8" />
          <path d="M9.5 4.5L12 6.8l2.5-2.3M9.5 19.5L12 17.2l2.5 2.3" />
        </svg>
      );
    case "magnet":
      return (
        <svg {...p}>
          <path d="M6 4v8a6 6 0 0012 0V4" />
          <path d="M6 10h4M14 10h4" />
        </svg>
      );
    case "clover":
      return (
        <svg {...p}>
          <path d="M12 12c0-3 1-5 3-5s3 1.5 3 3.5S16 14 12 12zM12 12c-3 0-5-1-5-3s1.5-3 3.5-3S14 8 12 12zM12 12c0 3-1 5-3 5s-3-1.5-3-3.5S8 10 12 12zM12 12c3 0 5 1 5 3s-1.5 3-3.5 3S10 16 12 12z" />
        </svg>
      );
    case "fist":
      return (
        <svg {...p}>
          <path d="M6 11V8.5a2 2 0 014 0V11m0-1.5a2 2 0 014 0V11m0-1a2 2 0 014 0v4.5a6 6 0 01-6 6H10a6 6 0 01-6-6V12a2 2 0 014 0" />
        </svg>
      );
    case "gear":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3" />
        </svg>
      );
    case "bank":
      return (
        <svg {...p}>
          <path d="M3 9.5L12 4l9 5.5" />
          <path d="M5 9.5v9M9.5 9.5v9M14.5 9.5v9M19 9.5v9M3 20.5h18" />
        </svg>
      );
    case "dice":
      return (
        <svg {...p}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
          <circle cx="8.5" cy="8.5" r="1.3" fill={c} stroke="none" />
          <circle cx="15.5" cy="15.5" r="1.3" fill={c} stroke="none" />
          <circle cx="12" cy="12" r="1.3" fill={c} stroke="none" />
        </svg>
      );
    case "trash":
      return (
        <svg {...p}>
          <path d="M4 6.5h16M9.5 6.5V4.8A1.3 1.3 0 0110.8 3.5h2.4a1.3 1.3 0 011.3 1.3v1.7" />
          <path d="M6 6.5l1 13a1.6 1.6 0 001.6 1.5h6.8a1.6 1.6 0 001.6-1.5l1-13" />
          <path d="M10 10.5v6.5M14 10.5v6.5" />
        </svg>
      );
    case "info":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 11v5.5" />
          <circle cx="12" cy="7.8" r="1" fill={c} stroke="none" />
        </svg>
      );
    case "warn":
      return (
        <svg {...p}>
          <path d="M12 3.5l9.5 16.5H2.5z" />
          <path d="M12 9.5v4.5" />
          <circle cx="12" cy="17" r="1" fill={c} stroke="none" />
        </svg>
      );
    case "play":
      return (
        <svg {...p}>
          <path d="M7 4.5l12 7.5-12 7.5z" fill={c} />
        </svg>
      );
    case "pause":
      return (
        <svg {...p}>
          <path d="M8.5 4.5v15M15.5 4.5v15" strokeWidth="3" />
        </svg>
      );
    case "home":
      return (
        <svg {...p}>
          <path d="M3.5 10.5L12 3.5l8.5 7" />
          <path d="M5.5 9.5v10h13v-10" />
        </svg>
      );
    case "level":
      return (
        <svg {...p}>
          <path d="M12 2.5l2.8 6 6.7.6-5 4.4 1.5 6.5-6-3.4-6 3.4L7.5 13.5l-5-4.4 6.7-.6z" />
        </svg>
      );
    case "tap":
      return (
        <svg {...p}>
          <path d="M10 11V6.5a2 2 0 014 0V13" />
          <path d="M14 12v-1a1.8 1.8 0 013.5 0v2m0-1.5a1.8 1.8 0 013.5 0v5c0 3.1-2.2 5.5-5.6 5.5-2.6 0-4.2-.9-5.4-2.6l-3-4.4a1.8 1.8 0 012.8-2.2L10 15" />
        </svg>
      );
    case "eye":
      return (
        <svg {...p}>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="3.2" />
        </svg>
      );
    case "run":
      return (
        <svg {...p}>
          <circle cx="14.5" cy="4.5" r="2" />
          <path d="M13 21l1.6-5.5-3.1-2.8L10 17" />
          <path d="M11.5 12.7l1.7-4.7 3.3 2 3 .8" />
          <path d="M8.5 9.5l3.5-1.2" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
        </svg>
      );
  }
}
