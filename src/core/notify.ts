/**
 * Уведомления ЧУБУГЕЙМ.
 *
 * Три отдельных КАНАЛА Android — так человек может отключить лишнее прямо
 * в системных настройках телефона («Настройки → Приложения → ЧУБУГЕЙМ →
 * Уведомления»), не заходя в игру:
 *
 *   chub-updates  ОБНОВЛЕНИЯ  вышла новая версия
 *   chub-boss     БОССЫ       заступил новый воспитатель
 *   chub-news     НОВИНКИ     напоминания и события в игре
 *
 * Каналы создаются при первом запуске. Android показывает их списком с
 * человеческими названиями, и каждый переключается отдельно — это ровно
 * то, о чём просил пользователь.
 *
 * Как работает напоминание, когда игра ЗАКРЫТА:
 *  1) при запуске приложение кладёт свою версию в CapacitorKV — общее
 *     хранилище с фоновым скриптом (public/runners/update-check.js);
 *  2) Android примерно раз в час будит скрипт, он спрашивает у GitHub
 *     последний релиз и шлёт уведомление, если версия новее;
 *  3) боссы не требуют сети: расписание детерминированное, поэтому
 *     уведомления о них планируются заранее локально.
 *
 * В браузере плагинов нет, поэтому каждая функция тихо ничего не делает.
 */

import { Capacitor } from "@capacitor/core";
import { APP_VERSION } from "./version";

const isNative = () => Capacitor.getPlatform() === "android";

/** Мы в настоящем приложении на телефоне, а не в браузере? */
export const isNativeApp = isNative;

/** Должен совпадать с label в capacitor.config.json */
const RUNNER_LABEL = "com.chubgames.update";

/* ────────────────────────── Каналы ────────────────────────── */

export type NotifyChannel = "updates" | "boss" | "news";

export const CHANNELS: {
  key: NotifyChannel;
  id: string;
  name: string;
  description: string;
}[] = [
  {
    key: "updates",
    id: "chub-updates",
    name: "ОБНОВЛЕНИЯ",
    description: "Вышла новая версия игры",
  },
  {
    key: "boss",
    id: "chub-boss",
    name: "БОССЫ",
    description: "Заступил новый воспитатель — можно драться",
  },
  {
    key: "news",
    id: "chub-news",
    name: "НОВИНКИ",
    description: "События, ежедневки и напоминания",
  },
];

export const channelId = (k: NotifyChannel): string =>
  CHANNELS.find((c) => c.key === k)?.id ?? "chub-news";

/** Диапазоны id, чтобы уведомления разных типов не затирали друг друга */
const ID = {
  update: 7001,
  /** боссам выделено 7100..7199: планируем несколько вперёд */
  bossBase: 7100,
};

/* ───────────────────────── Плагины ───────────────────────── */

/** Плагины грузим лениво: в браузере их просто нет, и статический импорт всё уронит */
async function notifications() {
  if (!isNative()) return null;
  try {
    const m = await import("@capacitor/local-notifications");
    return m.LocalNotifications;
  } catch {
    return null;
  }
}

async function runner() {
  if (!isNative()) return null;
  try {
    const m = await import("@capacitor/background-runner");
    return m.BackgroundRunner;
  } catch {
    return null;
  }
}

/** Уведомления разрешены? */
export async function notifyGranted(): Promise<boolean> {
  const n = await notifications();
  if (!n) return false;
  try {
    const r = await n.checkPermissions();
    return r.display === "granted";
  } catch {
    return false;
  }
}

/**
 * Просит разрешение на уведомления.
 * Возвращает true, если человек согласился.
 */
export async function askNotifyPermission(): Promise<boolean> {
  const n = await notifications();
  if (!n) return false;
  try {
    const cur = await n.checkPermissions();
    if (cur.display === "granted") return true;
    if (cur.display === "denied") return false;
    const r = await n.requestPermissions();
    return r.display === "granted";
  } catch {
    return false;
  }
}

/**
 * Создаёт каналы уведомлений.
 *
 * Важно: канал нельзя изменить после создания — Android запоминает его
 * настройки навсегда (пока приложение не удалят). Поэтому имена и
 * важность задаём сразу правильные.
 */
export async function ensureChannels(): Promise<void> {
  const n = await notifications();
  if (!n?.createChannel) return;
  for (const c of CHANNELS) {
    try {
      await n.createChannel({
        id: c.id,
        name: c.name,
        description: c.description,
        // 4 — со звуком и всплытием; человек сам приглушит, если захочет
        importance: c.key === "news" ? 3 : 4,
        visibility: 1,
        vibration: c.key !== "news",
      });
    } catch {
      /* канал уже есть или плагин недоступен */
    }
  }
}

/** Package id приложения — совпадает с appId в capacitor.config.json */
const PACKAGE_ID = "com.chubgames.app";

/**
 * Открывает системные настройки уведомлений приложения.
 *
 * Одна кнопка — и человек сразу в списке каналов НОВИНКИ / ОБНОВЛЕНИЯ /
 * БОССЫ, где каждый выключается отдельно.
 *
 * В @capacitor/local-notifications метода для этого нет (есть только
 * changeExactNotificationSetting — он про точное время будильников).
 * Поэтому переходим системным intent-адресом: Capacitor отдаёт ссылки с
 * нестандартной схемой Android, и тот открывает нужный экран настроек.
 * Если не сработало — возвращаем false, и экран настроек показывает путь
 * словами, чтобы человек дошёл руками.
 */
export async function openSystemNotificationSettings(): Promise<boolean> {
  if (!isNative()) return false;
  const intent =
    "intent://settings#Intent;" +
    "action=android.settings.APP_NOTIFICATION_SETTINGS;" +
    `S.android.provider.extra.APP_PACKAGE=${PACKAGE_ID};` +
    "end";
  try {
    window.location.href = intent;
    return true;
  } catch {
    return false;
  }
}

/* ───────────────────── Боссы: локальные напоминания ───────────────────── */

/**
 * Планирует уведомления о ближайших боссах.
 *
 * Сеть не нужна: кто и когда заступает, считается формулой. Планируем
 * несколько часов вперёд, потому что приложение может долго не
 * открываться. При каждом запуске старые снимаем и ставим заново —
 * так расписание не расползается.
 */
export async function scheduleBossNotifications(
  bosses: { at: number; name: string }[],
): Promise<void> {
  const n = await notifications();
  if (!n) return;
  try {
    // снимаем прошлые, чтобы не копились дубли
    const ids = Array.from({ length: 12 }, (_, i) => ({ id: ID.bossBase + i }));
    await n.cancel({ notifications: ids });
  } catch {
    /* нечего снимать */
  }
  if (!bosses.length) return;
  try {
    await n.schedule({
      notifications: bosses.slice(0, 12).map((b, i) => ({
        id: ID.bossBase + i,
        channelId: channelId("boss"),
        title: `Заступил ${b.name}`,
        body: "Дежурит весь час. Зайди и разберись.",
        schedule: { at: new Date(b.at), allowWhileIdle: true },
      })),
    });
  } catch {
    /* нет разрешения — молча пропускаем */
  }
}

/** Снять все запланированные напоминания о боссах */
export async function cancelBossNotifications(): Promise<void> {
  const n = await notifications();
  if (!n) return;
  try {
    await n.cancel({
      notifications: Array.from({ length: 12 }, (_, i) => ({ id: ID.bossBase + i })),
    });
  } catch {
    /* нечего снимать */
  }
}

/* ───────────────────── Обновления: фоновая проверка ───────────────────── */

/**
 * Сообщает фоновому скрипту, какая версия установлена сейчас.
 * Без этого он не с чем сравнивать и молчит.
 */
export async function syncInstalledVersion(): Promise<void> {
  const r = await runner();
  if (!r) return;
  try {
    // Записать в хранилище фонового движка можно только изнутри него самого,
    // поэтому передаём версию событием, а скрипт кладёт её в CapacitorKV.
    await r.dispatchEvent({
      label: RUNNER_LABEL,
      event: "setVersion",
      details: { version: APP_VERSION },
    });
  } catch {
    /* фоновый движок недоступен — не критично */
  }
}

/**
 * Выключает напоминания об обновлениях: гасим уже показанное уведомление
 * и просим фоновый скрипт молчать. Системное разрешение не трогаем —
 * отозвать его из приложения всё равно нельзя.
 */
export async function disableBackgroundCheck(): Promise<void> {
  const n = await notifications();
  try { await n?.cancel({ notifications: [{ id: ID.update }] }); } catch { /* нечего гасить */ }
  const r = await runner();
  if (!r) return;
  try {
    await r.dispatchEvent({
      label: RUNNER_LABEL,
      event: "setEnabled",
      details: { enabled: false },
    });
  } catch { /* движок недоступен */ }
}

/** Включает периодическую фоновую проверку. Вызывать после выдачи разрешения. */
export async function enableBackgroundCheck(): Promise<boolean> {
  const r = await runner();
  if (!r) return false;
  try {
    await r.requestPermissions({ apis: ["notifications"] });
    await syncInstalledVersion();
    await r.dispatchEvent({
      label: RUNNER_LABEL,
      event: "setEnabled",
      details: { enabled: true },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Разовая проверка «прямо сейчас» силами фонового движка.
 * Полезна как кнопка в настройках: покажет уведомление, если обновление есть.
 */
export async function checkNow(): Promise<void> {
  const r = await runner();
  if (!r) return;
  try {
    await r.dispatchEvent({
      label: RUNNER_LABEL,
      event: "checkUpdate",
      details: {},
    });
  } catch {
    /* нет сети или движок занят */
  }
}

/**
 * Первый запуск: создаём каналы, просим разрешение системным окном и
 * включаем фоновую проверку. Спрашиваем ровно один раз — повторно Android
 * окно всё равно не покажет.
 */
const ASKED_KEY = "chubgames.notifyAsked";

export async function initNotificationsOnFirstRun(): Promise<void> {
  if (!isNative()) return;
  try {
    // Каналы создаём всегда: если приложение обновилось со старой версии,
    // их ещё нет, а без них уведомления уйдут в канал «по умолчанию».
    await ensureChannels();

    if (localStorage.getItem(ASKED_KEY) === "1") {
      // уже спрашивали — просто поддерживаем фоновую проверку живой
      if (await notifyGranted()) await enableBackgroundCheck();
      return;
    }
    localStorage.setItem(ASKED_KEY, "1");
    const ok = await askNotifyPermission();
    if (ok) await enableBackgroundCheck();
  } catch {
    /* плагин недоступен — молча пропускаем */
  }
}
