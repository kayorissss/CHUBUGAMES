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

const {
  app, BrowserWindow, protocol, shell, Menu, ipcMain, screen, dialog, net,
} = require("electron");
const os = require("node:os");
const https = require("node:https");
const path = require("node:path");
const fs = require("node:fs");

/** Где лежит собранная игра: в разработке — dist/, в сборке — внутри app.asar */
const ROOT = path.join(__dirname, "..", "dist");

/** Репозиторий и метка релиза с ПК-сборками */
const REPO = "kayorissss/CHUBUGAMES";
const DESKTOP_TAG = "desktop";

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
   * Раньше ширина была жёстко ограничена 620 px, и на большом мониторе
   * игра выглядела узкой полоской — растянуть её было нельзя.
   *
   * Теперь ограничения нет: страница сама масштабирует себя как «сцену»
   * через CSS transform (см. src/core/stage.ts). Это безопасно для
   * модалок — элемент с transform создаёт containing block, поэтому
   * потомки с position:fixed позиционируются относительно сцены, а не
   * окна. Именно из-за неверного предположения об обратном в прошлой
   * версии пришлось ограничивать ширину.
   */
  win = new BrowserWindow({
    width: 480,
    height: 900,
    minWidth: 320,
    minHeight: 480,
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
      preload: path.join(__dirname, "preload.cjs"),
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

/* ─────────────────────────  ОБНОВЛЕНИЕ  ───────────────────────── */

/**
 * Скачивание файла по https с прогрессом.
 *
 * Делается в главном процессе, а не на странице: GitHub редиректит на
 * release-assets.githubusercontent.com, который не присылает CORS-заголовки,
 * и из окна такой запрос заблокировался бы браузерным движком. В главном
 * процессе браузерных ограничений нет.
 */
function download(url, dest, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 6) return reject(new Error("слишком много перенаправлений"));
    https.get(url, { headers: { "User-Agent": "CHUBGAMES-Desktop" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(download(res.headers.location, dest, onProgress, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`сервер ответил ${res.statusCode}`));
      }
      const total = parseInt(res.headers["content-length"] || "0", 10);
      let received = 0;
      const file = fs.createWriteStream(dest);
      res.on("data", (chunk) => {
        received += chunk.length;
        onProgress?.({
          received,
          total,
          percent: total ? Math.round((received / total) * 100) : 0,
        });
      });
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve(dest)));
      file.on("error", reject);
    }).on("error", reject);
  });
}

/** Сравнение версий вида 1.22.0 */
function isNewer(remote, local) {
  const a = String(remote).split(".").map(Number);
  const b = String(local).split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

let pendingUpdate = null;

ipcMain.handle("app:version", () => app.getVersion());

ipcMain.handle("update:check", async () => {
  try {
    const res = await net.fetch(
      `https://api.github.com/repos/${REPO}/releases/tags/${DESKTOP_TAG}`,
      { headers: { Accept: "application/vnd.github+json", "User-Agent": "CHUBGAMES-Desktop" } },
    );
    if (!res.ok) return { ok: false, error: `GitHub ответил ${res.status}` };
    const json = await res.json();

    // Для ПК берём установщик, а не portable: он умеет ставить поверх
    const asset = (json.assets || []).find((a) => /setup\.exe$/i.test(a.name))
      || (json.assets || []).find((a) => /\.exe$/i.test(a.name));
    if (!asset) return { ok: false, error: "в релизе нет .exe" };

    const m = String(json.body || "").match(/version:\s*([0-9]+(?:\.[0-9]+)*)/i);
    const version = m ? m[1] : String(json.tag_name || "");
    const cur = app.getVersion();

    pendingUpdate = { url: asset.browser_download_url, name: asset.name, size: asset.size };

    return {
      ok: true,
      hasUpdate: isNewer(version, cur),
      version,
      current: cur,
      size: asset.size || 0,
      notes: String(json.body || "").replace(/version:\s*[0-9.]+\s*/i, "").trim(),
    };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle("update:download", async (e) => {
  if (!pendingUpdate) return { ok: false, error: "сначала проверь обновление" };
  try {
    const dest = path.join(os.tmpdir(), pendingUpdate.name);
    await download(pendingUpdate.url, dest, (p) => {
      e.sender.send("update:progress", p);
    });

    // Запускаем установщик и закрываем игру, чтобы файлы не были заняты
    await shell.openPath(dest);
    setTimeout(() => app.quit(), 1200);
    return { ok: true, path: dest };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
});

/* ─────────────────────────  ОКНО  ───────────────────────── */

ipcMain.handle("win:isFullscreen", () => !!win && win.isFullScreen());

ipcMain.handle("win:toggleFullscreen", () => {
  if (!win) return false;
  const next = !win.isFullScreen();
  win.setFullScreen(next);
  return next;
});

ipcMain.handle("win:resize", (_e, { w, h }) => {
  if (!win || win.isFullScreen()) return false;
  const area = screen.getPrimaryDisplay().workAreaSize;
  // не даём окну вылезти за пределы рабочей области монитора
  const width = Math.max(320, Math.min(Math.round(w), area.width));
  const height = Math.max(480, Math.min(Math.round(h), area.height));
  win.setSize(width, height, true);
  win.center();
  return true;
});

ipcMain.handle("win:screen", () => {
  const d = screen.getPrimaryDisplay();
  return {
    width: d.workAreaSize.width,
    height: d.workAreaSize.height,
    scaleFactor: d.scaleFactor,
  };
});

app.on("window-all-closed", () => {
  app.quit();
});
