/**
 * Готовит android/app/build.gradle к выпуску ПОДПИСАННОГО релиза.
 *
 * Зачем: без постоянного ключа Gradle подписывает каждую сборку новым
 * debug-ключом. Android считает такие APK разными приложениями и при
 * установке поверх выдаёт «Конфликт пакетов». Постоянный ключ решает
 * проблему — обновления ставятся поверх.
 *
 * ГДЕ КЛЮЧ. Раньше keystore лежал в репозитории, а пароль — прямо в этом
 * файле. Репозиторий публичный, значит ключ был доступен всем: им можно было
 * подписать чужой APK и выдать его за обновление CHUBUGAMES. Теперь ключ
 * приходит в сборку из GitHub Secrets и на диск репозитория не попадает:
 *
 *   CHUB_KEYSTORE_B64       — chubgames.p12, base64 одной строкой (обязательно)
 *   CHUB_KEYSTORE_PASSWORD  — пароль хранилища (обязательно)
 *   CHUB_KEY_ALIAS          — алиас ключа, по умолчанию "chubgames"
 *   CHUB_KEY_PASSWORD       — пароль ключа, по умолчанию = пароль хранилища
 *   CHUB_ALLOW_UNSIGNED=1   — разрешить сборку БЕЗ подписи (для веток и PR)
 *
 * Запускается в CI:  node scripts/setup-android-signing.mjs <versionName> <versionCode>
 * Локальный ключ из android-signing/ подхватывается, если он там есть.
 */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [, , versionName, versionCode] = process.argv;
if (!versionName || !versionCode) {
  console.error("usage: setup-android-signing.mjs <versionName> <versionCode>");
  process.exit(1);
}

const GRADLE = "android/app/build.gradle";
const LOCAL_KEY = "android-signing/chubgames.p12";

const env = process.env;
const b64 = (env.CHUB_KEYSTORE_B64 || "").replace(/\s+/g, "");
const storePassword = env.CHUB_KEYSTORE_PASSWORD || "";
const keyAlias = env.CHUB_KEY_ALIAS || "chubgames";
const keyPassword = env.CHUB_KEY_PASSWORD || storePassword;
const allowUnsigned = env.CHUB_ALLOW_UNSIGNED === "1" || env.CHUB_ALLOW_UNSIGNED === "true";

/**
 * Куда положить keystore на время сборки.
 *
 * Специально в temp, а не в android/app/: файлы Gradle-проекта в CI
 * ничем не защищены от случайного коммита, а секрет, записанный в репозиторий,
 * остаётся в истории git навсегда. В temp-папке он живёт до конца job'а,
 * после чего его удаляет сам раннер вместе с рабочим каталогом.
 */
function placeKeystore() {
  if (b64) {
    const dir = mkdtempSync(path.join(tmpdir(), "chub-sign-"));
    const file = path.join(dir, "chubgames.p12");
    writeFileSync(file, Buffer.from(b64, "base64"), { mode: 0o600 });
    return { file, from: "секрет CHUB_KEYSTORE_B64" };
  }
  if (existsSync(LOCAL_KEY)) {
    return { file: path.resolve(LOCAL_KEY), from: `локальный ${LOCAL_KEY}` };
  }
  return null;
}

/* ── 1. подпись ── */

let placed = null;

if (storePassword && (b64 || existsSync(LOCAL_KEY))) {
  placed = placeKeystore();
  if (!placed) {
    console.error("Ключ не найден ни в секрете, ни в android-signing/.");
    process.exit(1);
  }
} else if (allowUnsigned) {
  console.warn(
    "⚠ Подписи нет (CHUB_KEYSTORE_PASSWORD не задан). Сборка будет debug--signed:\n" +
    "  её нельзя публиковать в Releases как обновление — Android не поставит\n" +
    "  её поверх релизной. Годится только для проверки, что проект собирается.",
  );
} else if (!b64 && !existsSync(LOCAL_KEY)) {
  console.error(
    "ОШИБКА: нет ни секрета CHUB_KEYSTORE_B64, ни пароля CHUB_KEYSTORE_PASSWORD.\n" +
    "Публиковать неподписанный (или debug-)APK в релизы нельзя — пользователи\n" +
    "получат «Конфликт пакетов» и потеряют прогресс.\n" +
    "Как завести ключ и секреты: android-signing/README.md\n" +
    "Собрать без подписи (не для релиза): CHUB_ALLOW_UNSIGNED=1",
  );
  process.exit(1);
}

let g = readFileSync(GRADLE, "utf8");

if (placed) {
  // 2) конфиг подписи. Пароль в файл НЕ пишется — Gradle получает его
  //    через свойство проекта (-PchubStorePassword), его печатает только
  //    сам CI в закрытом шаге.
  if (!g.includes("signingConfigs")) {
    const block = `
    signingConfigs {
        release {
            storeFile file("${placed.file.replace(/\\/g, "/")}")
            storePassword = project.findProperty('chubStorePassword') ?: ''
            keyAlias = project.findProperty('chubKeyAlias') ?: '${keyAlias}'
            keyPassword = project.findProperty('chubKeyPassword') ?: ''
            storeType = 'PKCS12'
        }
    }
`;
    g = g.replace(/android\s*\{/, (m) => m + block);
  }

  // 3) привязать подпись к release-сборке
  if (!g.includes("signingConfig signingConfigs.release")) {
    g = g.replace(
      /(buildTypes\s*\{\s*release\s*\{)/,
      "$1\n            signingConfig signingConfigs.release",
    );
  }
}

// 4) версия
g = g.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
g = g.replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

writeFileSync(GRADLE, g);

const okVer =
  g.includes(`versionName "${versionName}"`) &&
  g.includes(`versionCode ${versionCode}`);
const okSign = !placed || (
  g.includes("signingConfig signingConfigs.release") &&
  g.includes("chubStorePassword")
);

if (!okVer || !okSign) {
  console.error("Не удалось применить подпись или версию к build.gradle");
  process.exit(1);
}

console.log(
  `✓ версия ${versionName} (${versionCode}), ` +
  (placed ? `подпись: ${placed.from}, алиас ${keyAlias}` : "СБОРКА БЕЗ ПОДПИСИ"),
);
