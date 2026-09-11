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

    // Кроссворд: сетка с заполненной клеткой
    case "crossword":
      return (
        <svg {...p} fill="none">
          <rect x="5" y="5" width="22" height="22" rx="3" stroke="currentColor" strokeWidth="2.2" />
          <path d="M12.3 5v22M19.7 5v22M5 12.3h22M5 19.7h22" stroke="currentColor" strokeWidth="1.6" opacity="0.5" />
          <rect x="12.3" y="12.3" width="7.4" height="7.4" fill={acc} />
        </svg>
      );

    // Автобус
    case "bus":
      return (
        <svg {...p} fill="none">
          <rect x="5" y="6" width="22" height="16" rx="3" stroke="currentColor" strokeWidth="2.2" />
          <path d="M5 13h22" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="10" cy="25" r="2.3" fill={acc} />
          <circle cx="22" cy="25" r="2.3" fill={acc} />
          <path d="M9 17h3M20 17h3" stroke={acc} strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    // Тамагочи: сердце в корпусе
    case "pet":
      return (
        <svg {...p} fill="none">
          <rect x="6" y="4" width="20" height="24" rx="6" stroke="currentColor" strokeWidth="2.2" />
          <path d="M16 21c-3-2.4-5-4.3-5-6.5A2.6 2.6 0 0116 13a2.6 2.6 0 015 1.5c0 2.2-2 4.1-5 6.5z" fill={acc} />
        </svg>
      );

    // Пинцет и волосок
    case "beard":
      return (
        <svg {...p} fill="none">
          <path d="M10 4l4 13M22 4l-4 13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M14 17h4v4a2 2 0 01-4 0v-4z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M16 25c-2 1.5-3 2.5-3 4" stroke={acc} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    // Мотоцикл
    case "moto":
      return (
        <svg {...p} fill="none">
          <circle cx="8" cy="21" r="5" stroke="currentColor" strokeWidth="2.2" />
          <circle cx="24" cy="21" r="5" stroke="currentColor" strokeWidth="2.2" />
          <path d="M8 21l5-7h7l4 7" stroke={acc} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M19 10h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    // Канистра-колонка
    case "fuel":
      return (
        <svg {...p} fill="none">
          <rect x="6" y="6" width="13" height="21" rx="2.5" stroke="currentColor" strokeWidth="2.2" />
          <path d="M9 12h7" stroke={acc} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M19 11h4a2 2 0 012 2v7a2 2 0 01-2 2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    // Кулак по руке
    case "hands":
      return (
        <svg {...p} fill="none">
          <path d="M6 17v-3a2 2 0 014 0v-1a2 2 0 014 0v1a2 2 0 014 0v5a7 7 0 01-7 7 7 7 0 01-7-7v-2z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M22 6l4 4M26 6l-4 4" stroke={acc} strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );

    // Флаг на карте
    case "europa":
      return (
        <svg {...p} fill="none">
          <path d="M9 27V6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M9 6h13l-3 4.5L22 15H9z" fill={acc} />
          <path d="M14 27h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.5" />
        </svg>
      );

    // Шахматный конь
    case "chess":
      return (
        <svg {...p} fill="none">
          <path
            d="M11 26h13c.3-3-.3-5.6-1.6-7.9-1.1-2-2.4-3.5-3.4-4.4l1.2-2.2c.3-.6.1-1.3-.5-1.6l-1.7-1-.9 1.5-1.4-.9.6-1c.3-.6.1-1.3-.5-1.6-.6-.3-1.3-.1-1.6.5l-.9 1.5c-2.4.4-4.4 1.8-5.6 3.9-.7 1.2-1.1 2.4-1.3 3.5-.1.7.4 1.4 1.1 1.5.4 0 .8-.1 1.1-.4l2.2-2 1.3 1.2-2.8 3c-1.2 1.3-1.5 3.4-1.5 6.4z"
            fill={acc}
          />
          <path d="M8 28h18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );

    // Две шашки стопкой
    case "checkers":
      return (
        <svg {...p} fill="none">
          <ellipse cx="16" cy="21" rx="10" ry="5" fill={acc} />
          <ellipse cx="16" cy="15" rx="10" ry="5" stroke="currentColor" strokeWidth="2.2" />
          <path d="M6 15v6M26 15v6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    // Треугольники нард и кубик
    case "cheat":
      // листок-шпаргалка с ручкой (viewBox 32x32, как у остальных)
      return (
        <svg {...p} fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="4" width="15" height="24" rx="2.5" />
          <path d="M9 11h7M9 16h7M9 21h4" strokeLinecap="round" />
          <path d="M24 15l4 4-6.5 6.5-4.5 1 1-4.5z" fill={acc} stroke="none" />
        </svg>
      );
    case "nards":
      return (
        <svg {...p} fill="none">
          <path d="M5 6l3.5 10L12 6z" fill={acc} />
          <path d="M13 6l3.5 10L20 6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <rect x="18" y="17" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
          <circle cx="22.5" cy="21.5" r="1.4" fill={acc} />
          <path d="M5 26h9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
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
