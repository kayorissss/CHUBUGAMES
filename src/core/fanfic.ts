/**
 * СБОРНИК ФАНФИКОВ.
 *
 * Читалка с озвучкой: пока играет аудио, подсвечивается тот абзац,
 * который сейчас читают. Синхронизация делается по таймкодам — у
 * каждого фрагмента есть время начала и конца в секундах.
 *
 * Тексты, картинки и озвучка кладутся автором в public/fanfic/ и
 * описываются в FANFICS. Формат намеренно простой: добавить главу —
 * значит дописать объект, никакой сборки не требуется.
 */

export interface FanficBlock {
  /** Абзац текста */
  text: string;
  /** Картинка к абзацу (путь относительно public), необязательно */
  image?: string;
  /** Время начала озвучки этого абзаца, секунды */
  at?: number;
  /** Время конца, секунды. Если не задано — до начала следующего */
  to?: number;
}

export interface FanficChapter {
  id: string;
  title: string;
  /** Файл озвучки, относительно public. Может отсутствовать */
  audio?: string;
  blocks: FanficBlock[];
}

export interface Fanfic {
  id: string;
  title: string;
  author: string;
  /** Короткое описание для карточки */
  about: string;
  /** Обложка, путь относительно public */
  cover?: string;
  chapters: FanficChapter[];
}

/**
 * Список фанфиков.
 *
 * Сейчас здесь пример-заглушка, показывающая формат: как только автор
 * пришлёт текст, главы просто дописываются сюда, а аудио и картинки
 * кладутся в public/fanfic/.
 */
export const FANFICS: Fanfic[] = [
  {
    id: "demo",
    title: "Место для твоего фанфика",
    author: "KAYORISAN",
    about:
      "Раздел готов: текст, картинки и озвучка с подсветкой строки. " +
      "Пришли файлы — и здесь появится настоящая история.",
    chapters: [
      {
        id: "demo-1",
        title: "Как это будет выглядеть",
        blocks: [
          {
            text:
              "Здесь идёт текст главы. Пока играет озвучка, читаемый абзац " +
              "подсвечивается, а страница сама прокручивается к нему.",
            at: 0,
            to: 6,
          },
          {
            text:
              "К любому абзацу можно приложить картинку — она встанет прямо " +
              "в текст, по центру, без обрезки.",
            at: 6,
            to: 12,
          },
          {
            text:
              "Если озвучки нет, глава просто читается как обычная книга: " +
              "размер шрифта настраивается, прогресс запоминается.",
            at: 12,
            to: 20,
          },
        ],
      },
    ],
  },
];

/* ─────────────────────── Прогресс чтения ─────────────────────── */

const KEY = "chubgames.fanfic";

export interface FanficProgress {
  /** ficId -> id последней открытой главы */
  last: Record<string, string>;
  /** "ficId:chapterId" -> индекс последнего прочитанного блока */
  pos: Record<string, number>;
  /** Размер шрифта читалки */
  fontSize: number;
}

const empty = (): FanficProgress => ({ last: {}, pos: {}, fontSize: 16 });

export function readFanfic(): FanficProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return { ...empty(), ...JSON.parse(raw) };
  } catch {
    return empty();
  }
}

export function writeFanfic(p: FanficProgress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* не критично */
  }
}

/**
 * Какой блок озвучивается в данный момент.
 *
 * Возвращает индекс блока или -1. Если у блоков нет таймкодов, вернёт -1
 * и подсветки не будет — это нормально для глав без озвучки.
 */
export function blockAt(blocks: FanficBlock[], seconds: number): number {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.at == null) continue;
    const end = b.to ?? blocks[i + 1]?.at ?? Infinity;
    if (seconds >= b.at && seconds < end) return i;
  }
  return -1;
}

/** Есть ли у главы озвучка с разметкой */
export const hasVoice = (ch: FanficChapter) =>
  !!ch.audio && ch.blocks.some((b) => b.at != null);
