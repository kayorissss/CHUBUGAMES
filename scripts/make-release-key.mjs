/**
 * Генерирует ключ подписи релиза и подсказывает, что положить в Secrets.
 *
 *   node scripts/make-release-key.mjs [--alias chubgames] [--days 10950] [--force]
 *
 * Что получается:
 *  • android-signing/chubgames.p12 — хранилище (в git не попадёт, он в .gitignore);
 *  • пароль генерируется криптостойкий и НЕ сохраняется в репозиторий —
 *    его нужно вручную добавить в GitHub Secrets;
 *  • рядом кладётся android-signing/PASTE-INTO-SECRETS.txt с готовыми
 *    командами, чтобы ничего не потерять. Файл тоже в .gitignore.
 *
 * Нужен keytool из JDK 17+.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "android-signing");
const STORE = path.join(DIR, "chubgames.p12");
const SECRETS = path.join(DIR, "PASTE-INTO-SECRETS.txt");

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const alias = flag("alias", "chubgames");
const days = flag("days", "10950");
const force = args.includes("--force");

if (existsSync(STORE) && !force) {
  console.error(`Ключ уже есть: ${path.relative(ROOT, STORE)}\nПерезаписать — --force (старые обновления перестанут ставиться поверх!).`);
  process.exit(1);
}

let keytool = "keytool";
try {
  execFileSync(keytool, ["-help"], { stdio: "ignore" });
} catch {
  console.error("keytool не найден. Поставь JDK 17+ (temurin) и повтори.");
  process.exit(1);
}

/** Пароль без неоднозначных символов: их удобно вставлять в Secrets и shell */
const password = randomBytes(24)
  .toString("base64")
  .replace(/[^a-zA-Z0-9]/g, "")
  .slice(0, 24);

mkdirSync(DIR, { recursive: true });

// DName разбираем сами: keytool по-разному требует экранировать пробелы
// в зависимости от версии, а нам достаточно одного CN.
const cn = flag("cn", "CHUBUGAMES Release");
try {
  execFileSync(
    keytool,
    [
      "-genkeypair",
      "-keystore", STORE,
      "-storetype", "PKCS12",
      "-alias", alias,
      "-keyalg", "RSA",
      "-keysize", "4096",
      "-validity", String(days),
      "-storepass", password,
      "-keypass", password,
      "-dname", `CN=${cn}`,
    ],
    { stdio: "inherit" },
  );
} catch {
  console.error("keytool отказался генерировать ключ — см. вывод выше.");
  process.exit(1);
}

const b64 = readFileSync(STORE).toString("base64");
const oneLine = b64.replace(/\s+/g, "");

writeFileSync(
  SECRETS,
  [
    `# GitHub Secrets для подписи APK (репозиторий: kayorissss/CHUBUGAMES)`,
    `# Ничего из этого нельзя коммитить. Файл лежит рядом с ключом и тоже в .gitignore.`,
    ``,
    `# вариант 1 — через CLI (нужен gh):`,
    `printf '%s' '${oneLine}' | gh secret set CHUB_KEYSTORE_B64`,
    `gh secret set CHUB_KEYSTORE_PASSWORD  <<'P'`,
    password,
    `P`,
    `gh secret set CHUB_KEY_ALIAS  <<'P'`,
    alias,
    `P`,
    `gh secret set CHUB_KEY_PASSWORD <<'P'`,
    password,
    `P`,
    ``,
    `# вариант 2 — вставить руками в Settings → Secrets and variables → Actions:`,
    `CHUB_KEYSTORE_B64      = ${oneLine.slice(0, 48)}… (${oneLine.length} символов, полный файл рядом)`,
    `CHUB_KEYSTORE_PASSWORD = ${password}`,
    `CHUB_KEY_ALIAS         = ${alias}`,
    `CHUB_KEY_PASSWORD      = ${password}`,
    ``,
    `Локальный путь к ключу: android-signing/${path.basename(STORE)}`,
    `Срок действия: ${days} дн. Продлевать нельзя — только новый ключ + новый appId.`,
    ``,
  ].join("\n"),
  { mode: 0o600 },
);

console.log("\nготово:");
console.log(`  ключ     android-signing/${path.basename(STORE)}`);
console.log(`  секреты   android-signing/${path.basename(SECRETS)}`);
console.log(`\nпароль от хранилища (сохрани в менеджер паролей — восстановить нельзя):`);
console.log(`  ${password}`);
console.log(`\nпроверка:  keytool -list -keystore android-signing/${path.basename(STORE)} -storepass "${password}"`);
