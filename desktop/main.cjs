/**
 * ЧУБУГЕЙМ — оболочка для ПК (Windows .exe).
 *
 * Игра целиком собирается в один самодостаточный dist/index.html
 * (vite-plugin-singlefile), поэтому десктопной версии не нужен ни сервер,
 * ни интернет — окно просто показывает этот файл.
 *
 * ПОЧЕМУ НЕ file://
 * Под file:// у страницы «непрозрачное» происхождение: localStorage в
 * ряде случаев не сохраняется между запусками, а именно в нём лежит весь
 * прогресс (chubgames.save, chubgames.bosses, chubgames.gamble). Поэтому
 * регистрируем собственный протокол app://, отдаём файлы из ресурсов и
 * получаем стабильный origin — сохранения переживают перезапуск.
 *
 * Формат окна: игра нарисована под вертикальный телефон, поэтому окно
 * тоже портретное и по умолчанию 480x900. Растягивать можно, содержимое
 * центрируется (см. desktop/desktop.css, который вшивается в страницу).
 */

const { app, BrowserWindow, protocol, net, shell, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

/** Где лежит собранная игра: в разработке — dist/, в сборке — resources/app.asar/dist */
const ROOT = path.join(__dirname, "..", "dist");

/** Одна копия игры на компьютер: второй запуск просто показывает окно */
const primary = app.requestSingleInstanceLock();
if (!primary) {
  app.quit();
}

/**
 * Протокол app:// надо объявить ДО app.ready, иначе Electron не выдаст
 * ему привилегии (без них не работают ни localStorage, ни fetch).
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,          // нужен для <video> и перемотки звука
      corsEnabled: true,
    },
  },
]);

/** Предельная ширина окна: дальше портретная вёрстка начинает расползаться */
const MAX_W = 620;

let win = null;

function createWindow() {
  /*
   * Размер окна.
   *
   * Игра свёрстана под вертикальный телефон, и часть эффектов считает
   * координаты прямо от window.innerWidth (например, вылетающие цифры
   * урона в бою с боссом). Если растянуть окно на весь широкий монитор,
   * интерфейс расползётся, а эффекты уедут в сторону.
   *
   * Поэтому ширину ограничиваем сверху: MAX_W. Высота свободная.
   * «Рамку телефона» через CSS-трансформ делать нельзя — в игре много
   * элементов с position:fixed (модалки, перетаскиваемые фигуры в
   * шахматах и шашках), а они позиционируются от окна, а не от рамки.
   */
  win = new BrowserWindow({
    width: 480,
    height: 900,
    minWidth: 360,
    minHeight: 620,
    maxWidth: MAX_W,
    backgroundColor: "#08080A",
    autoHideMenuBar: true,
    show: false,
    title: "ЧУБУГЕЙМ",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      // Игре не нужен доступ к Node — держим песочницу закрытой
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  // Меню Electron игре не нужно — оно только мешает
  Menu.setApplicationMenu(null);

  // Показываем окно, когда страница отрисована: без белой вспышки
  win.once("ready-to-show", () => {
    win.show();
  });

  win.loadURL("app://chubgames/index.html");

  // Внешние ссылки (Telegram автора, донат) открываем в браузере,
  // а не внутри игрового окна
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("app://")) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });

  win.on("closed", () => {
    win = null;
  });
}

app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  /**
   * Отдаём файлы игры по app://chubgames/<путь>.
   *
   * Защита от выхода за пределы папки: нормализуем путь и проверяем, что
   * он остался внутри ROOT.
   */
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (rel === "") rel = "index.html";

    const full = path.normalize(path.join(ROOT, rel));
    if (!full.startsWith(path.normalize(ROOT))) {
      return new Response("forbidden", { status: 403 });
    }
    if (!fs.existsSync(full)) {
      // SPA-фолбэк: всё неизвестное отдаём как index.html
      return net.fetch(pathToFileURL(path.join(ROOT, "index.html")).toString());
    }
    return net.fetch(pathToFileURL(full).toString());
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
