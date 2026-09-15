/**
 * Пересборка всех растровых иконок и логотипа интерфейса.
 *
 * Источники ищет в `branding/` (родная папка арти) и в `public/` (сюда удобно
 * кидать файлы веб-загрузкой — генератор примёт и так). Приоритет ролей:
 *
 *   BRAND — «иконка»: готовая плашка 1:1 со своим фоном. Из неё делаются
 *           legacy-иконка Android, круглая, PWA-растры, favicon, .ico для
 *           Windows, adaptive-foreground (вписан в безопасную зону 66 %)
 *           и крупные витринные 1024/512.
 *           Имена: chubugamesmaxlogo.png → logo.png → photo.jpg/png (старый
 *           фото-режим остался запасным вариантом).
 *
 *   MARK  — «знак»: плоский монохромный глиф. Из него делаются monochrome-слой
 *           Android (яркость → альфа: Android перекрашивает сам) и прозрачный
 *           силуэт public/brand/logo-glyph.png. В интерфейс он попадает только
 *           если цветной плашки нет: тогда BrandMark красит силуэт акцентом
 *           темы через CSS-маску. Имена: chubulogo.png → mark.png.
 *
 *   Нет растров — всё рисуется из вектора branding/*.svg, как раньше. Убрал
 *   присланные файлы — и снова вектор, ничего не ломается.
 *
 *   npm run icons
 *
 * Нужен sharp (уже в devDependencies). ICO собирается вручную: контейнер ICO —
 * это список PNG-картинок, его пишет функция writeIco ниже.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** branding/ — родная папка, public/ — «закинул сюда»; что раньше нашли, то и берём */
function findSource(names) {
  for (const dir of ["branding", "public"]) {
    for (const n of names) {
      const p = path.join(ROOT, dir, n);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

const BRAND = findSource([
  "chubugamesmaxlogo.png", "chubugamesmaxlogo.jpg", "chubugamesmaxlogo.jpeg",
  "app-icon-source.png", "logo.png", "logo.jpg", "photo.jpg", "photo.png",
]);
const MARK = findSource(["chubulogo.png", "chubulogo.jpg", "mark.png"]);

/** Векторные исходники — роли те же, путь для них общий */
const SRC = {
  badge: path.join(ROOT, "branding/logo.svg"),
  mark: path.join(ROOT, "branding/mark.svg"),
  mono: path.join(ROOT, "branding/mark-mono.svg"),
};

/** Фирменный фон плашки — тот же, что у adaptive-иконки в CI */
const BRAND_BG = { r: 8, g: 8, b: 10, alpha: 1 };

/**
 * Растровые иконки без палитры весят мегабайты, а иконка ездит ещё и внутри
 * APK. 256-цветный PNG: на 32–1024 px глаз разницы не видит, вес втрое меньше.
 */
const PH_PNG = { palette: true, quality: 96, effort: 8 };

/** Плотности Android: базовая иконка 48dp, adaptive-слой 108dp */
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const out = (p) => path.join(ROOT, p);
const ensure = (p) => mkdirSync(path.dirname(p), { recursive: true });

/** Плашка на весь квадрат: кроп по центру, без полей */
async function badgeFrom(source, size) {
  return sharp(source)
    .resize(size, size, { fit: "cover", position: "centre" })
    .png(PH_PNG)
    .toBuffer();
}

/**
 * Яркость → альфа. Монохромный глиф (белый знак на чёрном) становится
 * прозрачным силуэтом: альфа = яркость, цвет = белый. Этим живёт и monochrome
 * слой Android, и маска логотипа в интерфейсе — цвет ей задаёт CSS, поэтому
 * знак читаем и на тёмной, и на светлой теме.
 */
async function glyphFrom(source, size, color = "#ffffff") {
  const lum = await sharp(source).greyscale().resize(size, size, { fit: "inside" }).toBuffer();
  const solid = await sharp({
    create: { width: size, height: size, channels: 3, background: color },
  }).png().toBuffer();
  return sharp(solid).joinChannel(lum).png(PH_PNG).toBuffer();
}

/** Клиент ложится в центр холста `size` (safe zone adaptive-иконки — 66 %) */
async function layer(body, size, inset = 1, background = "#00000000") {
  const side = Math.max(4, Math.round(size * inset));
  if (side === size) {
    return sharp({ create: { width: size, height: size, channels: 4, background } })
      .composite([{ input: body, left: 0, top: 0 }])
      .png(PH_PNG)
      .toBuffer();
  }
  const pad = Math.round((size - side) / 2);
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: body, left: pad, top: pad }])
    .png(PH_PNG)
    .toBuffer();
}

/**
 * Единая точка «какой источник для какой роли»: badge / mark / mono.
 * Растровые исходники имеют приоритет над вектором — человек принёс.art,
 * и именно он должен попасть в launcher, а не «наш бургер».
 */
async function png(from, size, withAlpha = true) {
  const role = from === SRC.badge ? "badge" : from === SRC.mono ? "mono" : "mark";

  if (BRAND || MARK) {
    /* monochrome всегда берётся из плоского знака: у объёмной плашки силуэта
       нет, и на themed-иконках Android вышла бы каша */
    const src = role === "mono" ? (MARK || BRAND) : (BRAND || MARK);
    if (role === "badge") return badgeFrom(src, size);
    /* monochrome — тот же холст 108dp, что и foreground: Android ждёт слои
       одного размера, силуэт лежит в централизованных 66 % */
    if (role === "mono") {
      return layer(await glyphFrom(src, Math.max(4, Math.round(size * 0.66))), size);
    }
    return layer(await badgeFrom(src, Math.max(4, Math.round(size * 0.66))), size);
  }

  return sharp(from, { density: 192 })
    .resize(size, size, {
      fit: role === "badge" ? "contain" : "contain",
      background: withAlpha ? { r: 0, g: 0, b: 0, alpha: 0 } : BRAND_BG,
    })
    .png()
    .toBuffer();
}

/** Круглая иконка launcher-а: та же плашка, но вырезанная кругом */
async function round(size) {
  const buf = await png(SRC.badge, size);
  const d = size / 2;
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<circle cx="${d}" cy="${d}" r="${d}" fill="#fff"/></svg>`,
  );
  return sharp(buf).composite([{ input: mask, secondary: "in" }]).png().toBuffer();
}

/**
 * ICO = заголовок + записи + PNG-тела.
 * Размер 256 в заголовке пишется нулём (историческое соглашение MS-PNG-ico).
 */
function writeIco(file, pairs) {
  const count = pairs.length;
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); // резерв
  head.writeUInt16LE(1, 2); // тип 1 = иконка
  head.writeUInt16LE(count, 4);

  let offset = 6 + count * 16;
  const dir = Buffer.alloc(count * 16);
  pairs.forEach(([size, buf], i) => {
    const o = i * 16;
    dir[o] = size >= 256 ? 0 : size;
    dir[o + 1] = size >= 256 ? 0 : size;
    dir[o + 2] = 0; // палитра
    dir[o + 3] = 0; // резерв
    dir.writeUInt16LE(1, o + 4); // плоскости
    dir.writeUInt16LE(32, o + 6); // бит на пиксель
    dir.writeUInt32LE(buf.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += buf.length;
  });

  const body = Buffer.concat(pairs.map(([, buf]) => buf));
  writeFileSync(file, Buffer.concat([head, dir, body]));
}

async function main() {
  for (const f of Object.values(SRC)) {
    if (!existsSync(f)) throw new Error("нет векторного исходника (запасной вариант): " + f);
  }

  /* ── логотип для интерфейса ──
     public/brand/logo.png — как прислали (квадратная плашка); logo-glyph.png —
     прозрачный силуэт, который BrandMark красит акцентом темы. Флаг и режим
     пишутся в src/core/brandAsset.ts, чтобы <img> не грузился там, где файла
     нет: 404 в консоли игрок читает как «сломалось». */
  {
    /* В шапке и на заставке человек должен увидеть ровно ту картинку, что
       лежит у него на рабочем столе, — поэтому приоритет у цветной плашки.
       Силами одного генератора: есть chubugamesmaxlogo.png → цвет; остался
       только chubulogo.png → силуэт, который красит тема. */
    const ui = BRAND || MARK;
    const isGlyph = !BRAND && !!MARK;
    const glyphSrc = MARK || BRAND;
    const flagPath = path.join(ROOT, "src/core/brandAsset.ts");
    writeFileSync(
      flagPath,
      ui
        ? `// ФАЙЛ ГЕНЕРИРУЕТСЯ: npm run icons. Руками не править — перезапишется.\n` +
          `// Исходник знака: ${path.relative(ROOT, ui)}\n\n` +
          `/** Прислан растровый логотип — интерфейс показывает его вместо вектора. */\n` +
          `export const HAS_BRAND_LOGO = true;\n\n` +
          `/** true — это монохромный силуэт: его красят акцентом темы через mask. */\n` +
          `export const BRAND_LOGO_IS_GLYPH = ${isGlyph ? "true" : "false"};\n\n` +
          `/** Путь внутри собранного приложения (public/ лежит в корне dist). */\n` +
          `export const BRAND_LOGO_URL = "/brand/logo.png";\n\n` +
          `export const BRAND_LOGO_GLYPH_URL = "/brand/logo-glyph.png";\n`
        : `// ФАЙЛ ГЕНЕРИРУЕТСЯ: npm run icons. Руками не править — перезапишется.\n` +
          `// Растрового логотипа нет — интерфейс рисует векторный знак (branding/mark.svg).\n\n` +
          `export const HAS_BRAND_LOGO = false;\n\n` +
          `export const BRAND_LOGO_IS_GLYPH = false;\n\n` +
          `export const BRAND_LOGO_URL = "/brand/logo.png";\n\n` +
          `export const BRAND_LOGO_GLYPH_URL = "/brand/logo-glyph.png";\n`,
    );

    if (ui) {
      ensure(out("public/brand/logo.png"));
      const meta = await sharp(ui).metadata();
      const side = Math.min(meta.width || 512, meta.height || 512, 512);
      writeFileSync(out("public/brand/logo.png"), await badgeFrom(ui, side));
      writeFileSync(out("public/brand/logo-glyph.png"), await glyphFrom(glyphSrc, side));
      console.log(
        `интерфейсный логотип: ${path.relative(ROOT, ui)} → public/brand/logo.png + logo-glyph.png` +
          ` (${side} px, ${isGlyph ? "силуэт под акцент темы" : "цветной растр"})`,
      );
    } else {
      console.log("растрового логотипа нет — интерфейс остаётся на векторе");
    }
    console.log("флаг логотипа: src/core/brandAsset.ts → HAS_BRAND_LOGO = " + (ui ? "true" : "false"));
  }

  const report = [];

  /* ── Android: пять плотностей × четыре варианта ── */
  for (const [name, k] of Object.entries(DENSITIES)) {
    const dir = out(`android-icons/mipmap-${name}`);
    ensure(dir);
    const base = Math.round(48 * k);
    const fg = Math.round(108 * k);

    writeFileSync(path.join(dir, "ic_launcher.png"), await png(SRC.badge, base));
    writeFileSync(path.join(dir, "ic_launcher_round.png"), await round(base));
    // foreground adaptive-слоя живёт на холсте 108dp: значимое — внутри
    // безопасных 66 %, всё остальное launcher обрежет маской
    writeFileSync(path.join(dir, "ic_launcher_foreground.png"), await png(SRC.mark, fg));
    writeFileSync(path.join(dir, "ic_launcher_monochrome.png"), await png(SRC.mono, fg));
    report.push(`mipmap-${name}: ${base}px + ${fg}px слои`);
  }

  /* ── PWA и сайт ── */
  ensure(out("public"));
  writeFileSync(out("public/icon-192.png"), await png(SRC.badge, 192));
  writeFileSync(out("public/icon-512.png"), await png(SRC.badge, 512));
  // maskable: знаку нужен запас по краям под маску запуска
  const m512 = await sharp(await png(SRC.badge, 372))
    .extend({ top: 70, bottom: 70, left: 70, right: 70, background: BRAND_BG })
    .png(PH_PNG)
    .toBuffer();
  writeFileSync(out("public/icon-maskable-512.png"), m512);
  writeFileSync(out("public/favicon.png"), await png(SRC.badge, 64));
  writeFileSync(out("public/favicon-32.png"), await png(SRC.badge, 32));
  report.push("public: icon-192, icon-512, icon-maskable-512, favicon");

  /* ── Крупные варианты для витрин и документов ── */
  writeFileSync(out("branding/app-icon.png"), await png(SRC.badge, 1024));
  writeFileSync(out("branding/app-icon-512.png"), await png(SRC.badge, 512));
  writeFileSync(
    out("branding/mark-1024.png"),
    MARK ? await badgeFrom(MARK, 1024) : await png(SRC.mark, 1024),
  );
  writeFileSync(out("assets/icon.png"), await png(SRC.badge, 1024));
  report.push("branding + assets: 1024/512");

  /* ── Windows ── */
  ensure(out("desktop/res"));
  writeFileSync(out("desktop/res/icon.png"), await png(SRC.badge, 512));
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pairs = [];
  for (const s of sizes) pairs.push([s, await png(SRC.badge, s)]);
  writeIco(out("desktop/res/icon.ico"), pairs);
  report.push(`desktop/res: icon.png + icon.ico (${sizes.join("/")})`);

  console.log(report.map((r) => "  ✓ " + r).join("\n"));
  console.log(
    "\nисточники: " +
      (BRAND ? "иконка ← " + path.relative(ROOT, BRAND) : "иконка ← вектор branding/logo.svg") +
      ", " +
      (MARK ? "знак ← " + path.relative(ROOT, MARK) : "знак ← вектор branding/mark.svg"),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
