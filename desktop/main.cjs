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
 * ПОЧЕМУ НЕ net.fetch('file://...')
 * Первая версия отдавала файлы через net.fetch по file://-ссылке. Это
 * работает при запуске из папки, но НЕ работает в собранном .exe: там
 * игра лежит внутри архива app.asar, а net.fetch идёт через сетевой стек
 * Chromium, который про asar ничего не знает — окно оставалось пустым.
 * Читаем файлы через fs: в Electron модуль fs пропатчен и умеет читать
 * внутрь asar как из обычной папки.
 */

const { app, BrowserWindow, protocol, shell, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

/** Где лежит собранная игра: в разработке — dist/, в сборке — внутри app.asar */
const ROOT = path.join(__dirname, "..", "dist");

/** Предельная ширина окна: дальше портретная вёрстка начинает расползаться */
const MAX_W = 620;

/**
 * Одна копия игры на компьютер: второй запуск просто показывает окно.
 * Если блокировку взять не удалось — выходим СРАЗУ, иначе второй процесс
 * успеет создать своё окно до закрытия.
 */
if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
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

/**
 * MIME-типы.
 *
 * Их обязательно проставлять вручную: своя реализация протокола ничего
 * не угадывает, а без Content-Type браузер покажет index.html как текст
 * и игра не запустится.
 */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

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
    icon: path.join(__dirname, "res", "icon.png"),
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
  win.once("ready-to-show", () => win.show());

  /*
   * Если страница почему-то не загрузилась, окно не должно остаться
   * невидимым — иначе процесс висит без единого признака жизни, и со
   * стороны это выглядит как «exe не запускается».
   */
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error(`Не удалось загрузить ${url}: ${desc} (${code})`);
    win.show();
  });
  setTimeout(() => {
    if (win && !win.isVisible()) win.show();
  }, 6000);

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
   * Читаем через fs (он умеет asar), проставляем MIME и поддерживаем
   * заголовок Range — без него <audio>/<video> в Chromium не могут
   * перематывать трек, а трек Радомира как раз перематывается.
   */
  protocol.handle("app", async (request) => {
    try {
      const url = new URL(request.url);
      let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      if (rel === "") rel = "index.html";

      // Защита от выхода за пределы папки игры
      let full = path.normalize(path.join(ROOT, rel));
      if (!full.startsWith(path.normalize(ROOT))) {
        return new Response("forbidden", { status: 403 });
      }
      // SPA-фолбэк: всё неизвестное отдаём как index.html
      if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        full = path.join(ROOT, "index.html");
      }

      const type = MIME[path.extname(full).toLowerCase()] || "application/octet-stream";
      const size = fs.statSync(full).size;
      const range = request.headers.get("range");

      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        if (m) {
          const start = m[1] ? parseInt(m[1], 10) : 0;
          const end = m[2] ? parseInt(m[2], 10) : size - 1;
          const fd = fs.openSync(full, "r");
          const len = Math.max(0, Math.min(end, size - 1) - start + 1);
          const buf = Buffer.alloc(len);
          fs.readSync(fd, buf, 0, len, start);
          fs.closeSync(fd);
          return new Response(buf, {
            status: 206,
            headers: {
              "Content-Type": type,
              "Content-Length": String(len),
              "Content-Range": `bytes ${start}-${start + len - 1}/${size}`,
              "Accept-Ranges": "bytes",
            },
          });
        }
      }

      return new Response(fs.readFileSync(full), {
        status: 200,
        headers: {
          "Content-Type": type,
          "Content-Length": String(size),
          "Accept-Ranges": "bytes",
        },
      });
    } catch (err) {
      console.error("Ошибка отдачи файла:", err);
      return new Response(String(err && err.message), { status: 500 });
    }
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
