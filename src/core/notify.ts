/**
 * Уведомления об обновлении, когда игра закрыта.
 *
 * Как это работает:
 *  1) при запуске приложение кладёт свою версию в CapacitorKV — общее хранилище
 *     с фоновым скриптом (public/runners/update-check.js);
 *  2) Android примерно раз в час будит этот скрипт, он спрашивает GitHub про
 *     последний релиз и, если версия новее, шлёт уведомление в шторку;
 *  3) про одну и ту же версию скрипт напоминает один раз.
 *
 * Всё это работает только на телефоне. В браузере плагинов нет, поэтому
 * каждая функция тихо ничего не делает — дев-режим не ломается.
 *
 * Разрешение на уведомления НЕ спрашиваем при первом запуске: человек только
 * открыл игру и не поймёт, о чём его просят. Спрашиваем позже — из настроек
 * или после того, как приложение само нашло обновление.
 */

import { Capacitor } from "@capacitor/core";
import { APP_VERSION } from "./version";

const isNative = () => Capacitor.getPlatform() === "android";

/** Должен совпадать с label в capacitor.config.ts */
const RUNNER_LABEL = "com.chubgames.update";

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

/** Включает периодическую фоновую проверку. Вызывать после выдачи разрешения. */
export async function enableBackgroundCheck(): Promise<boolean> {
  const r = await runner();
  if (!r) return false;
  try {
    await r.requestPermissions({ apis: ["notifications"] });
    await syncInstalledVersion();
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
