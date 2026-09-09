/**
 * Готовит android/app/build.gradle к выпуску подписанного релиза.
 *
 * Зачем: без постоянного ключа Gradle подписывает каждую сборку новым
 * debug-ключом. Android считает такие APK разными приложениями и при
 * установке поверх выдаёт «Конфликт пакетов». Один и тот же keystore
 * из репозитория решает проблему — обновления ставятся поверх.
 *
 * Запускается в CI: node scripts/setup-android-signing.mjs <versionName> <versionCode>
 */
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";

const [, , versionName, versionCode] = process.argv;
if (!versionName || !versionCode) {
  console.error("usage: setup-android-signing.mjs <versionName> <versionCode>");
  process.exit(1);
}

const GRADLE = "android/app/build.gradle";
const KEYSTORE_SRC = "android-signing/chubgames.p12";
const KEYSTORE_DST = "android/app/chubgames.p12";

copyFileSync(KEYSTORE_SRC, KEYSTORE_DST);

let g = readFileSync(GRADLE, "utf8");

// 1) версия
g = g.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
g = g.replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

// 2) конфиг подписи
if (!g.includes("signingConfigs")) {
  const block = `
    signingConfigs {
        release {
            storeFile file('chubgames.p12')
            storePassword 'chubgames'
            keyAlias 'chubgames'
            keyPassword 'chubgames'
            storeType 'PKCS12'
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

writeFileSync(GRADLE, g);

const ok =
  g.includes("signingConfig signingConfigs.release") &&
  g.includes(`versionName "${versionName}"`) &&
  g.includes(`versionCode ${versionCode}`);

console.log(g.slice(g.indexOf("android {"), g.indexOf("dependencies")));
if (!ok) {
  console.error("Не удалось применить подпись или версию к build.gradle");
  process.exit(1);
}
console.log(`✓ версия ${versionName} (${versionCode}), подпись настроена`);
