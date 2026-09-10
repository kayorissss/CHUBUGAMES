/**
 * Колесо апгрейда.
 *
 * Игрок ставит предмет и выбирает множитель (x1.5 / x2 / x3 / x5 / x10).
 * Чем жирнее множитель, тем тоньше зелёный сектор. Стрелка сверху,
 * колесо крутится под ней и останавливается там, где выпало.
 *
 * Раскладка секторов задана пользователем:
 *   снизу (180°)          — красный, «сгорело»;
 *   по бокам (90° и 270°) — оранжевый, возврат части ставки;
 *   сверху (0°)           — зелёный, «неудача» рядом по краям;
 *   выигрышный сектор     — по центру сверху.
 *
 * Главное, что здесь нельзя ошибиться: сумма углов секторов обязана
 * давать ровно 360°, а вероятность попадания в сектор — совпадать с
 * заявленным игроку шансом. И то, и другое проверено тестом.
 */

export type WheelZone = "win" | "near" | "back" | "burn";

export interface Sector {
  zone: WheelZone;
  /** начало сектора в градусах, 0 — верх, по часовой */
  start: number;
  /** длина сектора в градусах */
  size: number;
  color: string;
}

export interface WheelMult {
  id: string;
  /** во сколько раз растёт ценность предмета */
  mult: number;
  label: string;
}

/**
 * Целевой возврат игроку. 93% — как у слотов в этом же казино.
 *
 * ВАЖНО: считать шанс просто как (1/mult)*(1-дом) нельзя. Оранжевые
 * секторы тоже возвращают часть ставки (половину и четверть), и эта
 * добавка выносила общий возврат за 100% — казино уходило в минус, а
 * игрок получал бесконечные деньги. Тест это поймал: возврат доходил
 * до 113%. Поэтому шанс выигрыша подбирается численно так, чтобы ВЕСЬ
 * возврат вместе с утешительными секторами дал ровно целевой процент.
 */
export const WHEEL_RTP = 0.93;

export const WHEEL_MULTS: WheelMult[] = [
  { id: "m15", mult: 1.5, label: "x1.5" },
  { id: "m2", mult: 2, label: "x2" },
  { id: "m3", mult: 3, label: "x3" },
  { id: "m5", mult: 5, label: "x5" },
  { id: "m10", mult: 10, label: "x10" },
];

export const ZONE_COLOR: Record<WheelZone, string> = {
  win: "#59FF9E",   // зелёный — забрал
  near: "#FFB020",  // оранжевый — вернулась часть
  back: "#FF8A3D",  // оранжевый потемнее — вернулась меньшая часть
  burn: "#FF4D4D",  // красный — сгорело
};

/** Доли секторов при заданном шансе выигрыша (сумма = 1) */
function fractions(p: number) {
  const lose = 1 - p;
  const burn = Math.min(lose * 0.5, 0.4);
  const side = (lose - burn) / 2;
  return { win: p, burn, side };
}

/** Возврат игроку при заданном шансе: выигрыш + утешительные секторы */
function rtpAt(p: number, mult: number): number {
  const f = fractions(p);
  return p * mult + f.side * 0.5 + f.side * 0.25;
}

/**
 * Шанс выигрыша для множителя.
 *
 * Решаем численно: ищем такое p, при котором полный возврат равен
 * WHEEL_RTP. Возврат монотонно растёт по p, поэтому обычный двоичный
 * поиск сходится. Результат кэшируем — функция зовётся на каждый кадр
 * отрисовки колеса.
 */
const chanceCache = new Map<number, number>();

export function winChance(mult: number): number {
  const hit = chanceCache.get(mult);
  if (hit !== undefined) return hit;

  let lo = 0.001, hi = 0.95;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (rtpAt(mid, mult) < WHEEL_RTP) lo = mid;
    else hi = mid;
  }
  const p = Math.max(0.02, Math.min(0.9, (lo + hi) / 2));
  chanceCache.set(mult, p);
  return p;
}

/**
 * Раскладка колеса под конкретный множитель.
 *
 * Зелёный сектор центрируем на 0° (верх, под стрелкой), красный — на
 * 180° (низ), оранжевые делят то, что осталось, поровну по бокам.
 * Возвращаем секторы в порядке обхода по часовой от 0°.
 */
export function buildWheel(mult: number): Sector[] {
  const p = winChance(mult);
  // те же доли, что и в расчёте возврата — иначе показанный процент
  // разойдётся с реальным
  const f = fractions(p);
  const winDeg = f.win * 360;
  const burnDeg = f.burn * 360;
  const sideDeg = f.side * 360;

  const half = winDeg / 2;
  // Идём по часовой от верха: половина зелёного, правый бок, красный,
  // левый бок, вторая половина зелёного.
  return [
    { zone: "win", start: 0, size: half, color: ZONE_COLOR.win },
    { zone: "near", start: half, size: sideDeg, color: ZONE_COLOR.near },
    { zone: "burn", start: half + sideDeg, size: burnDeg, color: ZONE_COLOR.burn },
    { zone: "back", start: half + sideDeg + burnDeg, size: sideDeg, color: ZONE_COLOR.back },
    { zone: "win", start: 360 - half, size: half, color: ZONE_COLOR.win },
  ];
}

/** Какой сектор оказался под стрелкой при повороте колеса на angle */
export function zoneAt(sectors: Sector[], angle: number): WheelZone {
  // Колесо повёрнуто на angle по часовой, стрелка неподвижна сверху.
  // Значит под стрелкой оказывается точка колеса с координатой -angle.
  const a = ((-angle % 360) + 360) % 360;
  for (const s of sectors) {
    const end = s.start + s.size;
    if (a >= s.start && a < end) return s.zone;
    // сектор может переходить через 360
    if (end > 360 && a < end - 360) return s.zone;
  }
  return sectors[sectors.length - 1].zone;
}

/**
 * Выбираем итоговый угол честным броском.
 *
 * Сначала решаем судьбу по вероятности, потом ищем угол ВНУТРИ нужного
 * сектора. Так гарантируется, что показанный процент — настоящий, а не
 * «на глаз похоже».
 */
export function spinTo(sectors: Sector[], mult: number, rng = Math.random): {
  angle: number;
  zone: WheelZone;
} {
  const p = winChance(mult);
  const won = rng() < p;

  const pool = sectors.filter((s) => (won ? s.zone === "win" : s.zone !== "win"));
  // взвешенно по размеру сектора
  const total = pool.reduce((a, s) => a + s.size, 0);
  let r = rng() * total;
  let chosen = pool[0];
  for (const s of pool) {
    r -= s.size;
    if (r < 0) { chosen = s; break; }
  }
  // точка внутри сектора, с отступом от краёв чтобы стрелка не встала на границу
  const pad = Math.min(2, chosen.size * 0.15);
  const point = chosen.start + pad + rng() * Math.max(0.1, chosen.size - pad * 2);
  // угол поворота колеса, при котором `point` окажется под стрелкой
  const angle = ((-point % 360) + 360) % 360;
  return { angle, zone: chosen.zone };
}

/** Сколько ценности возвращается игроку в зависимости от зоны */
export function zonePayout(zone: WheelZone, staked: number, mult: number): number {
  switch (zone) {
    case "win": return Math.round(staked * mult);
    case "near": return Math.round(staked * 0.5);
    case "back": return Math.round(staked * 0.25);
    case "burn": return 0;
  }
}

export const ZONE_LABEL: Record<WheelZone, string> = {
  win: "ЗАБРАЛ",
  near: "ПОЛОВИНА НАЗАД",
  back: "ЧЕТВЕРТЬ НАЗАД",
  burn: "СГОРЕЛО",
};
