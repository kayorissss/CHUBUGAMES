/**
 * Пересборка всех растровых иконок из вектора.
 *
 * Единственный источник правды — branding/logo.svg (плашка),
 * branding/mark.svg (бургер без фона) и branding/mark-mono.svg (белый силуэт).
 * Всё остальное — PNG и ICO, которые генерятся отсюда, чтобы ни одна
 * плотность не жила своей жизнью.
 *
 *   npm run icons
 *
 * Нужен sharp (уже в devDependencies). Он отдаёт PNG с альфой, а ICO
 * собирается вручную: контейнер ICO — это просто список PNG-картинок,
 * его пишет функция writeIco ниже, никаких внешних зависимостей.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = {
  badge: path.join(ROOT, "branding/logo.svg"),
  mark: path.join(ROOT, "branding/mark.svg"),
  mono: path.join(ROOT, "branding/mark-mono.svg"),
};

/** Плотности Android: базовая иконка 48dp, adaptive-слой 108dp */
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const out = (p) => path.join(ROOT, p);
const ensure = (p) => mkdirSync(path.dirname(p), { recursive: true });

/** SVG → PNG нужного размера (contain — чтобы не сплющить) */
async function png(from, size, withAlpha = true) {
  let s = sharp(from, { density: 192 }).resize(size, size, {
    fit: "contain",
    background: withAlpha ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 8, g: 8, b: 10 },
  });
  return s.png().toBuffer();
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
    const w = size >= 256 ? 0 : size;
    const h = size >= 256 ? 0 : size;
    const o = i * 16;
    dir[o] = w;
    dir[o + 1] = h;
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
    if (!existsSync(f)) throw new Error("нет исходника: " + f);
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
    // foreground-слой рисуется на холсте 108dp: сам знак занимает ~66%,
    // как требует безопасная зона adaptive-иконки
    writeFileSync(path.join(dir, "ic_launcher_foreground.png"), await png(SRC.mark, fg));
    writeFileSync(path.join(dir, "ic_launcher_monochrome.png"), await png(SRC.mono, fg));
    report.push(`mipmap-${name}: ${base}px + ${fg}px слои`);
  }

  /* ── PWA и сайт ── */
  ensure(out("public"));
  writeFileSync(out("public/icon-192.png"), await png(SRC.badge, 192));
  writeFileSync(out("public/icon-512.png"), await png(SRC.badge, 512));
  // maskable: знак должен иметь запас по краям под маску запуска
  const m512 = await sharp(await png(SRC.badge, 372)).extend({
    top: 70, bottom: 70, left: 70, right: 70,
    background: { r: 8, g: 8, b: 10, alpha: 1 },
  }).png().toBuffer();
  writeFileSync(out("public/icon-maskable-512.png"), m512);
  writeFileSync(out("public/favicon.png"), await png(SRC.badge, 64));
  writeFileSync(out("public/favicon-32.png"), await png(SRC.badge, 32));
  report.push("public: icon-192, icon-512, icon-maskable-512, favicon");

  /* ── Крупные варианты для витрин и документов ── */
  writeFileSync(out("branding/app-icon.png"), await png(SRC.badge, 1024));
  writeFileSync(out("branding/app-icon-512.png"), await png(SRC.badge, 512));
  writeFileSync(out("branding/mark-1024.png"), await png(SRC.mark, 1024));
  writeFileSync(out("assets/icon.png"), await png(SRC.badge, 1024));
  report.push("branding + assets: 1024/512");

  /* ── Windows ─ */
  ensure(out("desktop/res"));
  writeFileSync(out("desktop/res/icon.png"), await png(SRC.badge, 512));
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pairs = [];
  for (const s of sizes) pairs.push([s, await png(SRC.badge, s)]);
  writeIco(out("desktop/res/icon.ico"), pairs);
  report.push(`desktop/res: icon.png + icon.ico (${sizes.join("/")})`);

  console.log(report.map((r) => "  ✓ " + r).join("\n"));
  console.log("\nиконки пересобраны из branding/*.svg");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
