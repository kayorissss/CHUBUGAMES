import type { GameId } from "../core/types";

/**
 * Векторные иконки мини-игр вместо системных эмодзи.
 * Эмодзи выглядят по-разному на каждом телефоне и ломают стиль —
 * здесь всё рисуется в один цвет (currentColor) и акцент.
 */
export default function GameIcon({
  id,
  size = 26,
  className = "",
}: {
  id: GameId | string;
  size?: number;
  className?: string;
}) {
  const p = { width: size, height: size, viewBox: "0 0 32 32", className };
  const acc = "var(--acc)";

  switch (id) {
    // Бургер
    case "burger":
      return (
        <svg {...p} fill="none">
          <path
            d="M5 12c0-4 5-7 11-7s11 3 11 7"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
          />
          <circle cx="12" cy="9" r="1" fill="currentColor" />
          <circle cx="17" cy="8" r="1" fill="currentColor" />
          <circle cx="21" cy="10" r="1" fill="currentColor" />
          <path d="M5 15h22" stroke={acc} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M6 19h20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path
            d="M5 22c0 3 5 5 11 5s11-2 11-5"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
          />
        </svg>
      );

    // Кликер — палец
    case "clicker":
      return (
        <svg {...p} fill="none">
          <path
            d="M13 16V7.5a2.5 2.5 0 015 0V15"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
          />
          <path
            d="M18 15v-1.5a2 2 0 014 0V16m0-1a2 2 0 014 0v6c0 3.5-2.5 6-6.5 6-3 0-4.8-1-6.2-3l-3.6-5.2a2 2 0 013.2-2.4L13 18"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          />
          <path d="M7 6l-1.6-1.6M7 11H4.6M11 6l1.4-1.4" stroke={acc} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    // Зубы Артёма
    case "bite":
      return (
        <svg {...p} fill="none">
          <path
            d="M5 8h22v6c0 6-3 13-5.5 13S18 22 16 22s-3 5-5.5 5S5 20 5 14z"
            stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"
          />
          <path d="M5 13h22" stroke={acc} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    // Побег от Шитова — монитор
    case "dino":
      return (
        <svg {...p} fill="none">
          <rect x="4" y="5" width="24" height="16" rx="2.5" stroke="currentColor" strokeWidth="2.2" />
          <path d="M12 27h8M16 21v6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M9 15l3.5-4 3 3.5L19 9l4 6" stroke={acc} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    // Ритм Радомира — нота
    case "radomir":
      return (
        <svg {...p} fill="none">
          <path
            d="M12 22V7l14-3v15"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          />
          <ellipse cx="8.5" cy="23" rx="4.5" ry="3.6" fill={acc} />
          <ellipse cx="22.5" cy="20" rx="4.5" ry="3.6" fill={acc} />
        </svg>
      );

    // Слияние голов
    case "merge":
      return (
        <svg {...p} fill="none">
          <circle cx="10" cy="10" r="5.5" stroke="currentColor" strokeWidth="2.2" />
          <circle cx="22" cy="10" r="5.5" stroke="currentColor" strokeWidth="2.2" />
          <circle cx="16" cy="21" r="7" stroke={acc} strokeWidth="2.4" />
          <path d="M14 21h4M16 19v4" stroke={acc} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    // Прибей друга — молоток
    case "whack":
      return (
        <svg {...p} fill="none">
          <path
            d="M6 11l6-6 4 4-6 6z"
            stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"
          />
          <path d="M14 5l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path
            d="M12 17l9 9a2.5 2.5 0 003.5-3.5l-9-9"
            stroke={acc} strokeWidth="2.4" strokeLinejoin="round"
          />
        </svg>
      );


    // Башня из бургеров
    case "stack":
      return (
        <svg {...p} fill="none">
          <rect x="7" y="22" width="18" height="5" rx="2" stroke="currentColor" strokeWidth="2.2" />
          <rect x="9" y="15" width="14" height="5" rx="2" stroke={acc} strokeWidth="2.4" />
          <rect x="11" y="8" width="10" height="5" rx="2" stroke="currentColor" strokeWidth="2.2" />
          <path d="M16 4v2" stroke={acc} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    // Подносы по цветам
    case "sort":
      return (
        <svg {...p} fill="none">
          <rect x="4" y="6" width="10" height="8" rx="2.5" stroke="currentColor" strokeWidth="2.2" />
          <rect x="18" y="6" width="10" height="8" rx="2.5" stroke={acc} strokeWidth="2.4" />
          <rect x="4" y="18" width="10" height="8" rx="2.5" stroke={acc} strokeWidth="2.4" />
          <rect x="18" y="18" width="10" height="8" rx="2.5" stroke="currentColor" strokeWidth="2.2" />
        </svg>
      );

    // Память
    case "memory":
      return (
        <svg {...p} fill="none">
          <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="2.2" />
          <circle cx="22" cy="10" r="4" stroke={acc} strokeWidth="2.4" />
          <circle cx="10" cy="22" r="4" stroke={acc} strokeWidth="2.4" />
          <circle cx="22" cy="22" r="4" stroke="currentColor" strokeWidth="2.2" />
          <path d="M14 10h4M10 14v4" stroke={acc} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    // Полёт
    case "flap":
      return (
        <svg {...p} fill="none">
          <path d="M6 16c4-6 9-9 15-9-1 7-5 12-11 14l-4-5z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M10 21l-4 5" stroke={acc} strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="19" cy="11" r="1.5" fill={acc} />
        </svg>
      );

    // Оборона
    case "defend":
      return (
        <svg {...p} fill="none">
          <path d="M16 4l10 4v8c0 6-4 10-10 12C10 26 6 22 6 16V8l10-4z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M11 16l3.5 3.5L21 13" stroke={acc} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    default:
      return (
        <svg {...p} fill="none">
          <rect x="5" y="8" width="22" height="16" rx="4" stroke="currentColor" strokeWidth="2.2" />
          <circle cx="21" cy="16" r="1.6" fill={acc} />
        </svg>
      );
  }
}
