/**
 * Выгрузка файла сохранения на телефоне.
 *
 * В Android WebView не работает ничего из привычного веба:
 *  - showSaveFilePicker в WebView отсутствует;
 *  - клик по ссылке с blob:-адресом молча игнорируется, файл никуда не падает;
 *  - navigator.share без файлового плагина отдаёт только текст.
 * Поэтому пишем файл нативно через Filesystem, а потом отдаём его системному
 * меню «Поделиться» — оттуда человек сам кладёт его в Диск, Телеграм и т.п.
 *
 * Возвращаем не throw, а результат: экран настроек сам решает, что показать.
 */

import { Capacitor } from "@capacitor/core";

export type SaveResult =
  | { ok: true; where: string }
  | { ok: false; reason: string };

export async function saveFileNative(name: string, data: string): Promise<SaveResult> {
  if (Capacitor.getPlatform() !== "android") {
    return { ok: false, reason: "not-native" };
  }

  let uri = "";
  try {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");

    // Documents виден пользователю в файловом менеджере; если производитель
    // прошивки его закрыл — падаем в приватную папку приложения, оттуда файл
    // всё равно можно отправить через «Поделиться».
    let dir = Directory.Documents;
    try {
      await Filesystem.writeFile({
        path: name,
        data,
        directory: dir,
        encoding: Encoding.UTF8,
        recursive: true,
      });
    } catch {
      dir = Directory.Data;
      await Filesystem.writeFile({
        path: name,
        data,
        directory: dir,
        encoding: Encoding.UTF8,
        recursive: true,
      });
    }

    const got = await Filesystem.getUri({ path: name, directory: dir });
    uri = got.uri;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: msg || "write failed" };
  }

  // Файл уже на диске — дальше только предлагаем поделиться.
  try {
    const { Share } = await import("@capacitor/share");
    await Share.share({
      title: "Сохранение ЧУБУГЕЙМ",
      text: name,
      url: uri,
      dialogTitle: "Куда положить сохранение",
    });
    return { ok: true, where: name };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    // Человек закрыл меню «Поделиться» — файл всё равно сохранён, это не ошибка.
    if (/cancel/i.test(msg)) return { ok: true, where: name };
    // Плагина Share нет — сообщаем, куда именно лёг файл.
    return { ok: true, where: uri.replace(/^file:\/\//, "") };
  }
}
