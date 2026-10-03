/**
 * Узкий мост между веб-игрой и Electron.
 *
 * Никакого прямого доступа к Node или ipcRenderer страница не получает —
 * только перечисленные здесь вызовы: кастомная шапка окна, проверка и
 * установка обновлений, а также прямая загрузка программ @kayorissss
 * в папку «Загрузки» пользователя.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("chubDesktop", {
  isDesktop: true,
  platform: process.platform,

  /** Версия установленного .exe (из package.json на момент сборки) */
  version: () => ipcRenderer.invoke("app:version"),

  /** Проверить, есть ли на GitHub более свежая сборка */
  checkUpdate: () => ipcRenderer.invoke("update:check"),

  /**
   * Скачать и запустить установщик новой версии.
   * onProgress получает { received, total, percent }.
   */
  downloadUpdate: (onProgress) => {
    const listener = (_e, p) => {
      try { onProgress?.(p); } catch { /* noop */ }
    };
    ipcRenderer.on("update:progress", listener);
    return ipcRenderer.invoke("update:download").finally(() => {
      ipcRenderer.removeListener("update:progress", listener);
    });
  },
  installUpdate: (info) => ipcRenderer.invoke("update:download", info),
  onUpdateProgress: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("update:progress", handler);
    return () => ipcRenderer.removeListener("update:progress", handler);
  },

  /** Полный экран (F11) и размер окна */
  isFullscreen: () => ipcRenderer.invoke("win:isFullscreen"),
  toggleFullscreen: () => ipcRenderer.invoke("win:toggleFullscreen"),
  resizeTo: (w, h) => ipcRenderer.invoke("win:resize", { w, h }),
  setWindowSize: (w, h) => ipcRenderer.invoke("win:resize", { w, h }),
  screenInfo: () => ipcRenderer.invoke("win:screen"),

  /** Управление кастомной оболочкой окна (без системной рамки Windows) */
  minimize: () => ipcRenderer.invoke("win:minimize"),
  maximize: () => ipcRenderer.invoke("win:maximize"),
  close: () => ipcRenderer.invoke("win:close"),
  getWinState: () => ipcRenderer.invoke("win:state"),
  onWinState: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("win:state", handler);
    return () => ipcRenderer.removeListener("win:state", handler);
  },

  /** Загрузка релизов @kayorissss прямо в папку «Загрузки» на ПК */
  downloadToDownloads: (url, fileName) =>
    ipcRenderer.invoke("ext:download", { url, fileName }),
  onDownloadProgress: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("ext:progress", handler);
    return () => ipcRenderer.removeListener("ext:progress", handler);
  },
  showInFolder: (filePath) => ipcRenderer.invoke("ext:showInFolder", filePath),
  openExternal: (url) => ipcRenderer.invoke("ext:openExternal", url),
});
