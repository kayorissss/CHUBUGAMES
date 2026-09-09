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

export type UpdateInfo = {
  version: string;
  notes: string;
  url: string;
  size: number;
  published: string;
};

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
  };

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
): Promise<string> {
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
    const uri = await downloadApkNative(info.url, name, onProgress);
    await installApk(uri);
    return uri;
  }

  const blob = await downloadApk(info.url, onProgress, signal);
  const uri = await saveApk(blob, name);
  await installApk(uri);
  return uri;
}

/** Установка из файла, выбранного пользователем в проводнике */
export async function installFromFile(file: File) {
  if (!/\.apk$/i.test(file.name)) throw new Error("Это не APK-файл");
  const uri = await saveApk(file, file.name);
  await installApk(uri);
  return uri;
}
