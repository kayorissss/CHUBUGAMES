/**
 * НАПОМИНАНИЯ НА КОМПЬЮТЕРЕ.
 *
 * На Android за это отвечает фоновый раннер и точные будильники: система сама
 * будит приложение раз в час. На ПК такого нет — Electron не держит фоновый
 * процесс, и врать человеку кнопкой «включено» нельзя. Поэтому на компьютере
 * напоминания шлёт само приложение, пока оно открыто (или свёрнуто в трей):
 * тик раз в минуту, события считаем по часам, а не по таймеру, — значит
 * подписка не «протухает», если ноутбук спал.
 *
 * Все три флага читаются через функцию-геттер: состояние настроек живёт в
 * сторе, а замыкать его в setInterval — значит весь день слать по старым
 * настройкам.
 */

import { sendWebNotification, canWebNotify } from "./notify";
import { bossActive, bossOfHour, windowLeft } from "./bosses";
import { checkQuietly } from "./updater";

export type DesktopFlags = { boss: boolean; news: boolean; updates: boolean };

const TICK_MS = 60_000;

/** Сколько минут ещё открыто окно босса, по-человечески */
function windowMin(): number {
  return Math.max(1, Math.round(windowLeft() / 60_000));
}

/**
 * Запуск. Возвращает функцию остановки (её зовёт эффект React).
 *
 * dailyReady — «есть что забрать сегодня»: это знает только стор, поэтому
 * прокидывается снаружи, а не вычисляется тут.
 */
export function startDesktopNotify(opts: {
  flags: () => DesktopFlags;
  dailyReady?: () => boolean;
}): () => void {
  if (!canWebNotify()) return () => {};

  let lastHour = Math.floor(Date.now() / 3_600_000);
  let lastDay = new Date().toDateString();
  let notifiedDay = "";
  let inFlight = false;

  const tick = async () => {
    const now = new Date();
    const hour = Math.floor(now.getTime() / 3_600_000);
    const day = now.toDateString();
    const f = opts.flags();

    // раз в день — про ежедневку, но не в 3 ночи молотить: после 10:00
    if (f.news && day !== notifiedDay && hour >= 10 && opts.dailyReady?.()) {
      notifiedDay = day;
      void sendWebNotification("CHUBUGAMES", "Ежедневная награда ждёт — зайди и забери");
    }

    if (hour === lastHour && day === lastDay) return;
    lastHour = hour;
    lastDay = day;

    if (inFlight) return;
    inFlight = true;
    try {
      if (f.boss && bossActive()) {
        const b = bossOfHour();
        void sendWebNotification(
          "CHUBUGAMES · БОСС",
          `${b?.name ?? "Воспитатель"} заступил на смену — окно ${windowMin()} мин`,
        );
      }
      if (f.updates) {
        const info = await checkQuietly();
        if (info) {
          void sendWebNotification("CHUBUGAMES · ОБНОВЛЕНИЕ", `Вышла версия ${info.version}`);
        }
      }
    } finally {
      inFlight = false;
    }
  };

  const id = window.setInterval(() => void tick(), TICK_MS);
  return () => window.clearInterval(id);
}
