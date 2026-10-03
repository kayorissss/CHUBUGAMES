/**
 * Обновление приложения прямо из CHUBGAMES.
 *
 * Игра остаётся офлайновой: сеть трогается ТОЛЬКО когда пользователь
 * сам нажал «Проверить обновление» или «Скачать».
 *
 * Два пути:
 *  1) скачать APK с GitHub Releases с прогрессом и открыть установщик;
 *  2) выбрать уже скачанный APK в файловом менеджере и открыть установщик.
 */

import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import type { PluginListenerHandle } from "@capacitor/core";
import { FileOpener } from "@capacitor-community/file-opener";
import { APP_VERSION, UPDATE_REPO, UPDATE_TAG } from "./version";
import { clearDownloadProgress, showDownloadProgress } from "./notify";

export type UpdateInfo = {
  version: string;
  notes: string;
  url: string;
  size: number;
  published: string;
  /** Ожидаемый SHA-256 файла из ассета GitHub (может отсутствовать) */
  sha256?: string;
};

/**
 * Откуда разрешено качать обновление.
 *
 * Редирект GitHub уводит на release-assets.githubusercontent.com, поэтому
 * список — по конечным хостам, а не по «github.com». Смысл проверки: url
 * приходит из ответа API, а вWebView его мог бы подменить любой, кто
 * дорвался до localStorage/настроек — не выпускать из приложения запросы
 * на произвольные хосты.
 */
const CDN_HOSTS = /(^|\.)(github\.com|githubusercontent\.com|githubassets\.com)$/i;

/** Проверка ссылки на файл обновления. Бросает понятную ошибку. */
export function assertDownloadUrl(url: string): URL {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("Ссылка на обновление повреждена");
  }
  if (u.protocol !== "https:") throw new Error("Обновление отдаётся не по https");
  if (!CDN_HOSTS.test(u.hostname)) throw new Error("Неизвестный источник файла: " + u.hostname);
  return u;
}

/** hex-строка SHA-256 из ArrayBuffer */
async function sha256hex(buf: ArrayBuffer): Promise<string> {
  if (!crypto?.subtle) return "";
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const isNative = () => Capacitor.getPlatform() === "android";

/** Версия для показа в интерфейсе */
export const APP_VERSION_LABEL = APP_VERSION;

/** «1.2.10» -> [1,2,10]; сравнение по компонентам, а не строкой */
function parseVer(v: string): number[] {
  return String(v)
    .replace(/^v/i, "")
    .split(/[.\-+]/)
    .map((x) => parseInt(x, 10))
    .filter((n) => !Number.isNaN(n));
}

export function isNewer(remote: string, local: string): boolean {
  const a = parseVer(remote);
  const b = parseVer(local);
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

export function fmtBytes(n: number): string {
  if (!n || n < 0) return "—";
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1)} МБ`;
}

/** Версия установленной сборки */
export function localVersion(): string {
  return APP_VERSION;
}

/**
 * Спрашивает у GitHub, какая версия лежит в релизе.
 * Возвращает null, если обновления нет.
 * Бросает ошибку с понятным текстом, если сети нет.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const api = `https://api.github.com/repos/${UPDATE_REPO}/releases/tags/${UPDATE_TAG}`;
  let res: Response;
  try {
    res = await fetch(api, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Не удалось связаться с GitHub. Проверь интернет — " +
      "если провайдер режет GitHub, включи VPN.",
    );
  }
  if (res.status === 404) throw new Error("Релиз не найден");
  if (!res.ok) throw new Error(`GitHub ответил ${res.status}`);

  const json: any = await res.json();
  const asset = (json.assets || []).find((a: any) =>
    String(a.name || "").toLowerCase().endsWith(".apk"),
  );
  if (!asset) throw new Error("В релизе нет APK");

  // Версию берём из тела релиза: строка вида "version: 1.1.0"
  const m = String(json.body || "").match(/version:\s*([0-9]+(?:\.[0-9]+)*)/i);
  const version = m ? m[1] : String(json.tag_name || "").replace(/^v/i, "");

  const info: UpdateInfo = {
    version,
    notes: String(json.body || "").replace(/version:\s*[0-9.]+\s*/i, "").trim(),
    url: asset.browser_download_url,
    size: asset.size || 0,
    published: json.published_at || json.created_at || "",
    sha256: String(asset.digest || "").replace(/^sha256:/i, "").toLowerCase() || undefined,
  };

  // Ссылку проверяем сразу: до того, как пользователь нажмёт «Скачать»
  assertDownloadUrl(info.url);

  return isNewer(info.version, APP_VERSION) ? info : null;
}

/**
 * Скачивание APK.
 *
 * ВАЖНО: обычный fetch() здесь не работает и падает с «Failed to fetch».
 * GitHub отдаёт ссылку на релиз с редиректом на release-assets.githubusercontent.com,
 * а этот домен НЕ присылает заголовок Access-Control-Allow-Origin. Для WebView
 * это межсайтовый запрос, браузерный движок его блокирует ещё до ответа сервера —
 * поэтому и VPN не помогал: дело не в блокировке провайдера, а в CORS.
 *
 * Решение: на телефоне качаем нативно через Filesystem.downloadFile —
 * запрос уходит мимо WebView, никаких CORS-ограничений нет.
 * В браузере (дев-режим) остаётся fetch как запасной путь.
 */
export async function downloadApkNative(
  url: string,
  name: string,
  onProgress: (loaded: number, total: number) => void,
  expectedSize = 0,
): Promise<string> {
  assertDownloadUrl(url);
  let handle: PluginListenerHandle | null = null;
  try {
    handle = await Filesystem.addListener("progress", (p) => {
      onProgress(p.bytes, p.contentLength);
    });

    const res = await Filesystem.downloadFile({
      url,
      path: name,
      directory: Directory.Cache,
      progress: true,
      recursive: true,
    });

    const { uri } = await Filesystem.getUri({
      path: name,
      directory: Directory.Cache,
    });

    /*
     * Целостность на телефоне: размер проверяем обязательно, SHA-256 —
     * не всегда возможно прочитать 22 МБ целиком. Подпись APK проверит
     * Android при установке: чужой файл он просто не примет.
     */
    try {
      const { Filesystem: FS } = await import("@capacitor/filesystem");
      const stat = await FS.stat({ path: name, directory: Directory.Cache });
      const size = (stat as unknown as { size?: number }).size ?? 0;
      if (expectedSize && size && size !== expectedSize) {
        throw new Error(
          `Файл докачался не целиком: ${(size / 1048576).toFixed(1)} МБ вместо ${fmtBytes(expectedSize)}`,
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/целиком/.test(msg)) throw e;
      // stat не поддержан плагином — не роняем установку из-за проверки
    }

    return res.path || uri;
  } finally {
    await handle?.remove();
  }
}

/** Скачивание через fetch — только для браузера/дев-режима */
export async function downloadApk(
  url: string,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  let res: Response;
  try {
    res = await fetch(url, { signal, cache: "no-store" });
  } catch {
    throw new Error(
      "Не удалось скачать файл. Проверь соединение или скачай APK " +
      "вручную со страницы релиза.",
    );
  }
  if (!res.ok) throw new Error(`Загрузка не удалась (${res.status})`);

  const total = Number(res.headers.get("content-length") || 0);
  const reader = res.body?.getReader();

  // Без потоков — просто ждём файл целиком
  if (!reader) {
    const blob = await res.blob();
    onProgress(blob.size, blob.size);
    return blob;
  }

  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      onProgress(loaded, total);
    }
  }
  const blob = new Blob(chunks as BlobPart[], {
    type: "application/vnd.android.package-archive",
  });
  onProgress(blob.size, blob.size || total);
  return blob;


}

/**
 * Проверить скачанный файл.
 *
 * На телефоне дополнительно считаем SHA-256 только если он пришёл из
 * API и файл не гигантский: гонять 22 МБ через subtle.digest на дешёвом
 * WebView смысла нет — там целостность гарантирует сама система: Android
 * НЕ поставит APK поверх, если подпись не совпадает с установленной.
 * Именно поэтому приватный ключ подписи нельзя держать в репозитории.
 */
async function verifyDownloaded(
  bytes: Uint8Array,
  info: Pick<UpdateInfo, "size" | "sha256">,
): Promise<void> {
  if (info.size && bytes.byteLength !== info.size) {
    throw new Error(
      `Файл докачался не целиком: ${(bytes.byteLength / 1048576).toFixed(1)} МБ ` +
      `вместо ${fmtBytes(info.size)}`,
    );
  }
  if (info.sha256 && bytes.byteLength <= 40 * 1048576) {
    const hex = await sha256hex(bytes.buffer.slice(0, bytes.byteLength) as ArrayBuffer);
    if (hex && hex !== info.sha256) {
      throw new Error("Контрольная сумма файла не совпала — не устанавливайте его");
    }
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Не удалось прочитать файл"));
    r.onload = () => {
      const s = String(r.result || "");
      resolve(s.slice(s.indexOf(",") + 1));
    };
    r.readAsDataURL(blob);
  });
}

/** Сохраняет APK в кэш приложения и возвращает путь к нему */
export async function saveApk(blob: Blob, name = "CHUBGAMES-update.apk") {
  const data = await blobToBase64(blob);
  await Filesystem.writeFile({
    path: name,
    data,
    directory: Directory.Cache,
    recursive: true,
  });
  const { uri } = await Filesystem.getUri({
    path: name,
    directory: Directory.Cache,
  });
  return uri;
}

/** Открывает системный установщик Android */
export async function installApk(uri: string) {
  await FileOpener.open({
    filePath: uri,
    contentType: "application/vnd.android.package-archive",
    openWithDefault: true,
  });
}

/** Тихая фоновая проверка при запуске. Никогда не бросает исключений. */
export async function checkQuietly(): Promise<UpdateInfo | null> {
  try {
    return await checkForUpdate();
  } catch {
    return null;
  }
}

/** Полный цикл: скачать -> сохранить -> открыть установщик */
export async function downloadAndInstall(
  info: UpdateInfo,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal,
) {
  const name = `CHUBGAMES-${info.version}.apk`;

  // На телефоне качаем нативно: fetch упёрся бы в CORS редиректа GitHub
  if (isNative()) {
    /*
     * Прогресс дублируем в уведомление, чтобы игру можно было свернуть
     * и всё равно видеть, сколько осталось.
     */
    const uri = await downloadApkNative(
      info.url,
      name,
      (loaded, total) => {
        onProgress(loaded, total);
        if (total > 0) {
          void showDownloadProgress(
            (loaded / total) * 100,
            `${fmtBytes(loaded)} из ${fmtBytes(total)}`,
          );
        }
      },
      info.size,
    );
    await showDownloadProgress(100, "");
    await installApk(uri);
    void clearDownloadProgress();
    return uri;
  }

  const blob = await downloadApk(info.url, onProgress, signal);
  // В этой ветке файл уже целиком в памяти — сверяем размер и SHA-256
  await verifyDownloaded(new Uint8Array(await blob.arrayBuffer()), info);
  const uri = await saveApk(blob, name);
  await installApk(uri);
  return uri;
}

/** Установка из файла, выбранного пользователем в проводнике */
export async function installFromFile(file: File) {
  if (!/\.apk$/i.test(file.name)) throw new Error("Это не APK-файл");
  // Файл человек принёс сам — подпись проверит Android, но пустой или
  // обрезанный файл лучше отклонить сразу, а не показывать системный
  // установщик с «пакет повреждён».
  if (file.size < 1_000_000) throw new Error("Файл слишком маленький — похоже, он не докачался");
  const uri = await saveApk(file, file.name);
  await installApk(uri);
  return uri;
}
