/**
 * Локализация интерфейса: русский и английский.
 * Строки берутся по ключу, при отсутствии перевода — русский вариант.
 */

export type Lang = "ru" | "en";

type Dict = Record<string, string>;

const RU: Dict = {
  "nav.games": "Игры",
  "nav.progress": "Прогресс",
  "nav.shop": "Магазин",
  "nav.friends": "Друзья",
  "nav.more": "Ещё",

  "home.continue": "Продолжить",
  "home.play": "Играть",
  "home.record": "рекорд",
  "home.allGames": "Все игры",
  "home.summary": "Сводка",
  "home.dodges": "уклонов",
  "home.taps": "тапов",
  "home.totalCoins": "монет всего",
  "home.plays": "игр",

  "settings.title": "НАСТРОЙКИ",
  "settings.appearance": "Оформление",
  "settings.theme": "Тема",
  "settings.dark": "Тёмная",
  "settings.light": "Светлая",
  "settings.language": "Язык",
  "settings.glass": "Жидкое стекло и свечения",
  "settings.glassHint": "Выключи, если телефон греется",
  "settings.accentHint": "Акцентный цвет меняется ниже",
  "settings.accent": "Акцентный цвет",
  "settings.game": "Игра",
  "settings.difficulty": "Сложность",
  "settings.chill": "Чилл",
  "settings.normal": "Норма",
  "settings.insane": "Ад",
  "settings.sound": "Звук",
  "settings.haptics": "Вибрация",
  "settings.update": "Обновление",
  "settings.internet": "Интернет",
  "settings.save": "Сохранение",
  "settings.saveHint":
    "Прогресс хранится только на этом телефоне и не требует интернета. Перед сменой устройства выгрузи файл сохранения.",
  "settings.export": "Выгрузить",
  "settings.import": "Загрузить",
  "settings.danger": "Опасная зона",
  "settings.reset": "Сбросить весь прогресс",
  "settings.no": "Нет",
  "settings.deleteAll": "Удалить всё",
  "settings.about": "Об игре",
  "settings.author": "автор и разработчик ЧУБУГЕЙМ",
  "settings.offline": "работает офлайн",
  "settings.forOurs": "сделано для своих",

  "common.version": "версия",
  "common.later": "Позже",
  "common.cancel": "Отмена",
  "common.retry": "Ещё раз",
  "common.exit": "Выйти",
};

const EN: Dict = {
  "nav.games": "Games",
  "nav.progress": "Progress",
  "nav.shop": "Shop",
  "nav.friends": "Friends",
  "nav.more": "More",

  "home.continue": "Continue",
  "home.play": "Play",
  "home.record": "best",
  "home.allGames": "All games",
  "home.summary": "Summary",
  "home.dodges": "dodges",
  "home.taps": "taps",
  "home.totalCoins": "coins total",
  "home.plays": "plays",

  "settings.title": "SETTINGS",
  "settings.appearance": "Appearance",
  "settings.theme": "Theme",
  "settings.dark": "Dark",
  "settings.light": "Light",
  "settings.language": "Language",
  "settings.glass": "Liquid glass and glow",
  "settings.glassHint": "Turn off if the phone heats up",
  "settings.accentHint": "Accent colour is set below",
  "settings.accent": "Accent colour",
  "settings.game": "Game",
  "settings.difficulty": "Difficulty",
  "settings.chill": "Chill",
  "settings.normal": "Normal",
  "settings.insane": "Insane",
  "settings.sound": "Sound",
  "settings.haptics": "Vibration",
  "settings.update": "Update",
  "settings.internet": "Internet",
  "settings.save": "Save data",
  "settings.saveHint":
    "Progress is stored only on this phone and needs no internet. Export your save before switching devices.",
  "settings.export": "Export",
  "settings.import": "Import",
  "settings.danger": "Danger zone",
  "settings.reset": "Reset all progress",
  "settings.no": "No",
  "settings.deleteAll": "Delete everything",
  "settings.about": "About",
  "settings.author": "author and developer of CHUBUGAMES",
  "settings.offline": "works offline",
  "settings.forOurs": "made for the boys",

  "common.version": "version",
  "common.later": "Later",
  "common.cancel": "Cancel",
  "common.retry": "Again",
  "common.exit": "Exit",
};

const DICTS: Record<Lang, Dict> = { ru: RU, en: EN };

/** Возвращает функцию перевода для выбранного языка */
export function makeT(lang: Lang) {
  const d = DICTS[lang] || RU;
  return (key: string): string => d[key] ?? RU[key] ?? key;
}

export const LANGS: { id: Lang; label: string }[] = [
  { id: "ru", label: "Русский" },
  { id: "en", label: "English" },
];
