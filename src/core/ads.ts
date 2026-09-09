/**
 * Рекламные ролики.
 *
 * Видео лежит в public/ads/ и попадает в APK как обычный файл, поэтому
 * реклама работает офлайн — никаких сетевых запросов и трекеров.
 *
 * Правила показа (как договорились):
 *  - ролик идёт 10 секунд;
 *  - кнопка «Пропустить» появляется на 6-й секунде;
 *  - награда выдаётся и за досмотр до конца, и после пропуска;
 *  - тап по самому видео открывает ссылку рекламодателя.
 */

export interface AdClip {
  id: string;
  /** Путь к файлу внутри приложения */
  src: string;
  /** Куда ведёт тап по ролику. Пусто — тап ничего не делает. */
  link?: string;
  /** Подпись рекламодателя в углу */
  label?: string;
}

/** Через сколько секунд можно пропустить */
export const AD_SKIP_AFTER = 6;
/** Ожидаемая длина ролика, если метаданные не подгрузились */
export const AD_FALLBACK_LEN = 10;

/**
 * Список роликов. Чтобы добавить свой — положи файл в public/ads/
 * и допиши сюда строку. Больше ничего менять не нужно.
 */
export const AD_CLIPS: AdClip[] = [
  {
    id: "promo1",
    src: "ads/promo1.mp4",
    link: "https://t.me/kayorisan",
    label: "РЕКЛАМА",
  },
];

/** Есть ли вообще что показывать */
export function hasAds(): boolean {
  return AD_CLIPS.length > 0;
}

/** Случайный ролик из доступных */
export function pickClip(): AdClip | null {
  if (!AD_CLIPS.length) return null;
  return AD_CLIPS[Math.floor(Math.random() * AD_CLIPS.length)];
}

/* ================= ЛИМИТЫ ПОКАЗА ================= */

const KEY = "chubgames.ads";

interface AdState {
  /** День в формате YYYY-MM-DD */
  day: string;
  /** Сколько раз воскресали за сегодня */
  revives: number;
  /** Сколько бонусов за монеты взяли сегодня */
  bonuses: number;
  /** Время последнего показа, чтобы не спамить */
  lastAt: number;
}

const today = () => new Date().toISOString().slice(0, 10);

function read(): AdState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (raw.day === today()) return { revives: 0, bonuses: 0, lastAt: 0, ...raw };
  } catch {
    /* битые данные — начинаем заново */
  }
  return { day: today(), revives: 0, bonuses: 0, lastAt: 0 };
}

function write(s: AdState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* переполнено — не критично */
  }
}

/** Сколько раз за игру можно воскреснуть */
export const MAX_REVIVES_PER_RUN = 1;
/** Сколько бонусов за монеты в день */
export const MAX_BONUS_PER_DAY = 5;

export function bonusesLeft(): number {
  return Math.max(0, MAX_BONUS_PER_DAY - read().bonuses);
}

export function noteRevive() {
  const s = read();
  s.revives += 1;
  s.lastAt = Date.now();
  write(s);
}

export function noteBonus() {
  const s = read();
  s.bonuses += 1;
  s.lastAt = Date.now();
  write(s);
}
