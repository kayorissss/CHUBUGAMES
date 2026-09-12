/* Временный харнесс: собрать <Burger> в статический SVG, подставить в него
   реальные цвета темы (librsvg не понимает color-mix) и отрендерить в PNG,
   чтобы знак можно было посмотреть глазами. Не часть проверки — .gitignore. */
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as esbuild from "esbuild";
import sharp from "sharp";

const ROOT = path.resolve(".");
fs.writeFileSync(
  ".tmp-brand/entry.tsx",
  `export { Burger, BrandMark } from ${JSON.stringify(ROOT + "/src/ui/Brand")};\n`,
);
await esbuild.build({
  entryPoints: [".tmp-brand/entry.tsx"],
  bundle: true,
  format: "cjs",
  platform: "node",
  jsx: "automatic",
  outfile: ".tmp-brand/out.cjs",
  external: ["react", "react-dom", "react-dom/server", "framer-motion"],
  loader: { ".css": "empty" },
  logLevel: "silent",
});

const mod = await import("./out.cjs");
let svg = renderToStaticMarkup(React.createElement(mod.Burger, { size: 512, glow: true }));
svg = svg
  .replace(/color-mix\(in srgb, #ffffff 42%, var\(--acc\)\)/g, "#FFC48A")
  .replace(/color-mix\(in srgb, var\(--acc\) 88%, #fff\)/g, "#FFB472")
  .replace(/color-mix\(in srgb, var\(--acc\) 62%, #000\)/g, "#B4560A")
  .replace(/color-mix\(in srgb, var\(--acc\) 72%, #000\)/g, "#C25E0B")
  .replace(/color-mix\(in srgb, var\(--ok\) 70%, #7FD35A\)/g, "#7FD35A")
  .replace(/var\(--acc\)/g, "#FF7A18");
svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
fs.writeFileSync(".tmp-brand/burger.svg", svg);

const plate = await sharp(".tmp-brand/burger.svg", { density: 192 })
  .resize(420, 420, { fit: "contain", background: { r: 19, g: 19, b: 24, alpha: 0 } })
  .flatten({ background: { r: 19, g: 19, b: 24, alpha: 1 } })
  .png()
  .toBuffer();
const small = await sharp(".tmp-brand/burger.svg", { density: 192 })
  .resize(40, 40, { fit: "contain" })
  .flatten({ background: { r: 19, g: 19, b: 24, alpha: 1 } })
  .png()
  .toBuffer();
const strip = await sharp({ create: { width: 470, height: 430, channels: 4, background: { r: 12, g: 12, b: 15, alpha: 1 } } })
  .composite([
    { input: plate, left: 10, top: 10 },
    { input: small, left: 430, top: 10 },
  ])
  .png()
  .toBuffer();
await sharp(strip).toFile(".tmp-brand/brand.png");
console.log("цвет-mix осталось:", /color-mix/.test(svg) ? "ДА" : "нет", "| файл: .tmp-brand/brand.png");
