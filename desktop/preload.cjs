/**
 * Мост между игрой и оболочкой ПК-версии.
 *
 * Окно работает в песочнице с contextIsolation, поэтому страница не имеет
 * доступа к Node. Всё, что ей нужно от системы (обновление, полный экран,
 * размер окна), пробрасываем сюда точечно и только на чтение/вызов.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chubDesktop", {
  /** Версия оболочки (совпадает с версией игры) */
  version: () => ipcRenderer.invoke("app:version"),

  /* ─── Обновление ─── */

  /** Спросить у GitHub, есть ли новая версия для ПК */
  checkUpdate: () => ipcRenderer.invoke("update:check"),

  /**
   * Скачать и запустить установщик.
   * Прогресс приходит колбэком: { received, total, percent }.
   */
  downloadUpdate(onProgress) {
    const ch = "update:progress";
    const handler = (_e, p) => onProgress?.(p);
    ipcRenderer.on(ch, handler);
    return ipcRenderer.invoke("update:download").finally(() => {
      ipcRenderer.removeListener(ch, handler);
    });
  },

  /* ─── Окно ─── */

  isFullscreen: () => ipcRenderer.invoke("win:isFullscreen"),
  toggleFullscreen: () => ipcRenderer.invoke("win:toggleFullscreen"),
  /** Подогнать размер окна под логическое разрешение сцены */
  resizeTo: (w, h) => ipcRenderer.invoke("win:resize", { w, h }),
  /** Список доступных размеров рабочей области монитора */
  screenInfo: () => ipcRenderer.invoke("win:screen"),
});
