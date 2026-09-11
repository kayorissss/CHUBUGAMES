/**
 * Проверка собранного пакета ПК-версии.
 *
 * Первая сборка «успешно» выпускала .exe, который показывал пустое окно:
 * внутрь архива не попадала оболочка, и понять это можно было только
 * запустив программу. Теперь распаковываем app.asar и проверяем состав.
 *
 * Пути внутри asar печатаются с разделителем текущей ОС (на Windows —
 * обратный слэш), поэтому сравниваем нормализованно, а не строкой.
 */
import asar from "@electron/asar";
import fs from "node:fs";

const archive = process.argv[2];
if (!archive || !fs.existsSync(archive)) {
  console.error(`ОШИБКА: не найден архив ${archive}`);
  process.exit(1);
}

const norm = (p) => p.replace(/\\/g, "/").replace(/^\//, "");
const list = asar.listPackage(archive).map(norm);

console.log(`Файлов внутри пакета: ${list.length}`);
console.log("Первые записи:");
list.slice(0, 12).forEach((f) => console.log("   " + f));

let bad = false;
const need = ["desktop/main.cjs", "desktop/preload.cjs", "dist/index.html", "package.json"];
for (const f of need) {
  const ok = list.includes(f);
  console.log(`${ok ? "есть" : "НЕТ "}: ${f}`);
  if (!ok) bad = true;
}

// index.html должен быть настоящей игрой, а не заглушкой
if (list.includes("dist/index.html")) {
  const buf = asar.extractFile(archive, "dist/index.html");
  console.log(`dist/index.html: ${buf.length} Б`);
  if (buf.length < 500000) {
    console.error("ОШИБКА: index.html подозрительно маленький");
    bad = true;
  }
  if (!buf.subarray(0, 200).toString("utf8").toLowerCase().includes("<!doctype html")) {
    console.error("ОШИБКА: index.html не похож на HTML");
    bad = true;
  }
}

// точка входа должна указывать на оболочку
if (list.includes("package.json")) {
  const pkg = JSON.parse(asar.extractFile(archive, "package.json").toString("utf8"));
  console.log(`package.json main: ${pkg.main}`);
  if (norm(pkg.main || "") !== "desktop/main.cjs") {
    console.error("ОШИБКА: точка входа не ведёт на оболочку");
    bad = true;
  }
}

if (bad) {
  console.error("\nПАКЕТ СОБРАН НЕПРАВИЛЬНО — приложение показало бы пустое окно");
  process.exit(1);
}
console.log("\nПакет собран правильно.");
