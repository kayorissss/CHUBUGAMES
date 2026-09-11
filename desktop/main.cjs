/**
 * CHUBUGAMES — оболочка для ПК (Windows .exe).
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
const crypto = require("node:crypto");
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

/* ───────────────────────  СОСТОЯНИЕ ОКНА  ─────────────────────── */

/**
 * Запомнить, как пользователь закрыл окно: во весь экран или в обычном
 * размере. Первая версия всегда открывала окно «как окно», и каждый запуск
 * приходилось жать F11 — а просили как раз обратное: игра на компьютере
 * должна сразу занимать весь экран, а F11 — ВЫХОДИТЬ из этого режима.
 */
const WIN_STATE_FILE = () => path.join(app.getPath("userData"), "window.json");

function readWinState() {
  try {
    return { fullscreen: true, w: 0, h: 0, x: 0, y: 0, ...JSON.parse(fs.readFileSync(WIN_STATE_FILE(), "utf8")) };
  } catch {
    // Первый запуск: полный экран — так и договорились.
    return { fullscreen: true, w: 0, h: 0, x: 0, y: 0 };
  }
}

function writeWinState(patch) {
  try {
    const next = { ...readWinState(), ...patch };
    fs.mkdirSync(path.dirname(WIN_STATE_FILE()), { recursive: true });
    fs.writeFileSync(WIN_STATE_FILE(), JSON.stringify(next));
  } catch {
    /* настройки окна не критичны — не из-за них падать */
  }
}

function createWindow() {
  /*
   * РАЗМЕР И РЕЖИМ ОКНА.
   *
   * Раньше окно открывалось вертикальным (480x900) — телефон на рабочем
   * столе. Теперь интерфейс альбомный и сам раскладывает содержимое по
   * ширине окна (колонки игр + правая панель сведений), поэтому окну не
   * нужны ни фиксированная ширина, ни «сцена» с transform: масштабом
   * управляет только крупность шрифта (src/core/stage.ts).
   *
   * Полный экран — режим по умолчанию: попросили, чтобы игра сразу
   * занимала весь монитор, а F11 из него выходил. Как закрыли окно, так
   * следующий запуск и откроется (см. readWinState/writeWinState).
   */
  const area = screen.getPrimaryDisplay().workAreaSize;
  const st = readWinState();
  const winW = st.w >= 900 ? st.w : Math.min(1600, Math.round(area.width * 0.9));
  const winH = st.h >= 560 ? st.h : Math.min(980, Math.round(area.height * 0.9));

  win = new BrowserWindow({
    width: winW,
    height: winH,
    // координаты помним только вместе с размером: при первом запуске
    // и x, и y нулевые, а это «в левый верхний угол экрана» вместо
    // обычного центрирования окна
    x: st.w >= 900 && st.x > 0 ? st.x : undefined,
    y: st.w >= 900 && st.y > 0 ? st.y : undefined,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: "#08080A",
    autoHideMenuBar: true,
    show: false,
    title: "CHUBUGAMES",
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

  // Полный экран включаем ДО показа: иначе видно, как окно «разъезжается»
  if (st.fullscreen) win.setFullScreen(true);
  else if (st.maximized) win.maximize();

  /*
   * F11 — переключает режим и запоминает выбор.
   *
   * Вешаем на главный процесс, а не на страницу: в полноэкранном режиме
   * Electron по умолчанию перехватывает F11 сам, и обработчик в WebView до
   * него не доживает. Заодно так одна и та же клавиша работает и на
   * телефонной раскладке окна, и в полном экране.
   */
  win.webContents.on("before-input-event", (e, input) => {
    if (input.type === "keyDown" && input.key === "F11") {
      e.preventDefault();
      const next = !win.isFullScreen();
      win.setFullScreen(next);
      writeWinState({ fullscreen: next });
    }
  });

  win.on("enter-full-screen", () => writeWinState({ fullscreen: true }));
  win.on("leave-full-screen", () => writeWinState({ fullscreen: false }));

  // Помним обычный размер окна, чтобы следующий запуск был таким же
  win.on("resized", () => {
    if (!win.isFullScreen() && !win.isMaximized()) {
      const [w, h] = win.getSize();
      const [x, y] = win.getPosition();
      writeWinState({ w, h, x, y });
    }
  });
  win.on("maximize", () => writeWinState({ maximized: true }));
  win.on("unmaximize", () => writeWinState({ maximized: false }));

  // Показываем окно, когда страница отрисована: без белой вспышки
  win.once("ready-to-show", () => {
    // На небольшом мониторе разворачиваем сразу — иначе поля съедают экран
    if (!st.fullscreen && area.width <= 1440) win.maximize();
    win.show();
  });

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

  /*
   * Внешние ссылки (Telegram автора, донат, GitHub) открываем в браузере,
   * а не внутри игрового окна.
   *
   * Показываем только известные домены. Формально страница у нас своя и
   * ссылок из ненадёжного места быть не должно, но в игре есть рекламный
   * ролик со ссылкой и импорт файла сохранения — а значит ссылка всё-таки
   * может прийти из данных пользователя. Отдать произвольный url системе
   * (= «открой что угодно, в том числе file:// или exe-протокол») было бы
   * избыточным доверием.
   */
  const EXTERNAL_HOSTS = /^(www\.)?(github\.com|objects\.githubusercontent\.com|api\.github\.com|t\.me|pay\.cloudtips\.ru|boosty\.to|boosty\.ru)$/i;
  const openExternalSafe = (url) => {
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" && u.protocol !== "http:") return false;
      if (!EXTERNAL_HOSTS.test(u.hostname)) {
        console.warn("ссылка вне списка разрешённых, не открываю:", u.hostname);
        return false;
      }
      void shell.openExternal(u.href);
      return true;
    } catch {
      return false;
    }
  };

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("app://")) {
      e.preventDefault();
      openExternalSafe(url);
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

      // Защита от выхода за пределы папки игры.
      //
      // Раньше было `full.startsWith(ROOT)`, и это пропускало соседа:
      // app://x/../dist-extra/y нормализуется в «…/dist-extra/y», что
      // «начинается» с ROOT как со строкой. Сравнение с хвостовым
      // разделителем такого не допускает.
      const rootN = path.normalize(ROOT) + path.sep;
      let full = path.normalize(path.join(ROOT, rel));
      if (full !== path.normalize(ROOT) && !full.startsWith(rootN)) {
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
    /*
     * Качаем только по https и только с GitHub: редирект может увести на
     * чужой хост, а скачанный файл мы потом запускаем как установщик.
     */
    let where;
    try {
      where = new URL(url);
    } catch {
      return reject(new Error("некорректная ссылка на файл"));
    }
    if (where.protocol !== "https:") return reject(new Error("обновление отдаётся не по https"));
    if (!/(^|\.)(github\.com|githubusercontent\.com|githubassets\.com)$/i.test(where.hostname)) {
      return reject(new Error("скачивание не с github: " + where.hostname));
    }
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

/**
 * Portable или установленная версия?
 *
 * Portable-сборка electron-builder выставляет переменную окружения
 * PORTABLE_EXECUTABLE_FILE с путём к самому exe. У установленной версии
 * её нет. Это важно для обновления: установщику нужен setup.exe, а
 * portable-версии — новый portable.exe, иначе пользователь получит не
 * тот файл и вторую копию игры.
 */
const IS_PORTABLE = !!process.env.PORTABLE_EXECUTABLE_FILE;

/** SHA-256 файла целиком. 100 МБ читаются кусками, в память не кладём */
function sha256OfFile(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    const stream = fs.createReadStream(file);
    stream.on("data", (b) => h.update(b));
    stream.on("end", () => resolve(h.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Сравнить файл с ожидаемым хешем.
 * Пустой expected (например, релиз опубликован без checksums) — не провал,
 * а «проверить нечем»: тогда сверяем хотя бы размер и идём дальше.
 */
async function verifyChecksum(file, expected) {
  if (!expected) {
    console.warn("в релизе нет контрольной суммы — проверяю только размер");
    return true;
  }
  try {
    const got = await sha256OfFile(file);
    const same = got.toLowerCase() === String(expected).toLowerCase();
    if (!same) console.error("SHA-256 не совпал:", got, "!=", expected);
    return same;
  } catch (e) {
    console.error("не удалось посчитать хеш:", e);
    return false;
  }
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

    /*
     * Берём файл того же типа, что запущен сейчас: установленной версии —
     * setup.exe (ставится поверх), portable — portable.exe. Раньше всегда
     * качался setup, и обновление portable-версии молча ставило вторую
     * копию игры в систему.
     */
    const want = IS_PORTABLE ? /portable\.exe$/i : /setup\.exe$/i;
    const asset = (json.assets || []).find((a) => want.test(a.name))
      || (json.assets || []).find((a) => /\.exe$/i.test(a.name));
    if (!asset) return { ok: false, error: "в релизе нет .exe" };

    /*
     * Ожидаемый SHA-256: сначала из API (asset.digest), потом из
     * приложенного файла checksums.sha256 в описании релиза.
     */
    const shaFromBody = (() => {
      const line = String(json.body || "")
        .split("\n")
        .find((l) => l.includes(asset.name));
      const hex = line && line.match(/\b[0-9a-f]{64}\b/i);
      return hex ? hex[0].toLowerCase() : "";
    })();
    const sha256 = String(asset.digest || "").replace(/^sha256:/i, "").toLowerCase() || shaFromBody;

    const m = String(json.body || "").match(/version:\s*([0-9]+(?:\.[0-9]+)*)/i);
    const version = m ? m[1] : String(json.tag_name || "");
    const cur = app.getVersion();

    pendingUpdate = {
      url: asset.browser_download_url,
      name: asset.name,
      size: asset.size,
      sha256,
    };

    return {
      ok: true,
      hasUpdate: isNewer(version, cur),
      version,
      current: cur,
      size: asset.size || 0,
      portable: IS_PORTABLE,
      asset: asset.name,
      sha256,
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

    const got = fs.statSync(dest).size;
    if (pendingUpdate.size && got !== pendingUpdate.size) {
      try { fs.rmSync(dest); } catch { /* занят — не страшно */ }
      return { ok: false, error: `файл докачался не целиком: ${got} Б вместо ${pendingUpdate.size} Б` };
    }

    /*
     * Проверка целостности.
     *
     * В описании релиза лежит SHA-256 каждого файла — раньше он был нужен
     * только человеку, который решит проверить файл руками. Теперь его
     * сверяет сама программа ПЕРЕД запуском установщика: скачанный .exe
     * иначе запускается ANY, какой отдаст сервер/прокси/зеркало.
     *
     * Источник истины — digest ассета из GitHub API (форма "sha256:<hex>"),
     * запасной — строка из checksums.sha256 в описании релиза.
     */
    const okSum = await verifyChecksum(dest, pendingUpdate.sha256);
    if (!okSum) {
      try { fs.rmSync(dest); } catch { /* файл мог быть занят — пусть лежит */ }
      return {
        ok: false,
        error:
          "Контрольная сумма не совпала — файл удалён. " +
          "Скачайте обновление вручную со страницы релиза и сверьте SHA-256.",
      };
    }

    if (IS_PORTABLE) {
      /*
       * Portable нельзя «установить»: файл запущен и заменить сам себя
       * не может. Показываем скачанный exe в проводнике — пользователь
       * сам положит его на место старого.
       */
      shell.showItemInFolder(dest);
      return { ok: true, path: dest, portable: true };
    }

    // Установщик ставится поверх; игру закрываем, чтобы файлы не были заняты
    await shell.openPath(dest);
    setTimeout(() => app.quit(), 1200);
    return { ok: true, path: dest, portable: false };
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
  // событие enter/leave-full-screen тоже пишет состояние, но не всегда
  // успевает до закрытия окна — пишем сразу
  writeWinState({ fullscreen: next });
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
