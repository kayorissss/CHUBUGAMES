"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// .tmp-brand/entry.tsx
var entry_exports = {};
__export(entry_exports, {
  BrandMark: () => BrandMark,
  Burger: () => Burger
});
module.exports = __toCommonJS(entry_exports);

// src/ui/Brand.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var BUN_TOP_D = "M104 214v-10c0-62 68-104 152-104s152 42 152 104v10c0 11-9 20-20 20H124c-11 0-20-9-20-20Z";
var LEAF_D = "M106 236h300c0 15-13 26-29 26H135c-16 0-29-11-29-26Z";
var CHEESE_BAR_D = "M112 262h288c9 0 16 7 16 16v6H96v-6c0-9 7-16 16-16Z";
var CHEESE_DRIP_D = "M96 286h320l-32 24-32-24h-192l-32 24-32-24Z";
var BUN_BOTTOM_D = "M126 362h260c11 0 20 9 20 20 0 24-22 40-52 40H158c-30 0-52-16-52-40 0-11 9-20 20-20Z";
function Burger({
  size = 32,
  accent,
  glow = false,
  style
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 512 512",
      "aria-hidden": "true",
      style: {
        display: "block",
        overflow: "visible",
        ...accent ? { ["--acc"]: accent } : null,
        ...style
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("defs", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", { id: "cbTop", x1: "0", y1: "0", x2: "0.2", y2: "1", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: "0", stopColor: "color-mix(in srgb, #ffffff 42%, var(--acc))" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: "0.55", stopColor: "var(--acc)" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: "1", stopColor: "color-mix(in srgb, var(--acc) 72%, #000)" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", { id: "cbBottom", x1: "0", y1: "0", x2: "0.2", y2: "1", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: "0", stopColor: "color-mix(in srgb, var(--acc) 88%, #fff)" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: "1", stopColor: "color-mix(in srgb, var(--acc) 62%, #000)" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", { id: "cbCheese", x1: "0", y1: "0", x2: "0", y2: "1", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: "0", stopColor: "#FFE27A" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: "1", stopColor: "#FFC93C" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", { id: "cbPatty", x1: "0", y1: "0", x2: "0", y2: "1", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: "0", stopColor: "#8B5130" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: "1", stopColor: "#5A2F18" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", { id: "cbLeaf", x1: "0", y1: "0", x2: "0", y2: "1", children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: "0", stopColor: "color-mix(in srgb, var(--ok) 70%, #7FD35A)" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: "1", stopColor: "#3F7C2A" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
          glow && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ellipse", { cx: "256", cy: "286", rx: "212", ry: "150", fill: "var(--acc)", opacity: "0.14" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: BUN_TOP_D, fill: "url(#cbTop)" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "path",
            {
              d: BURGER_PATHS.shine,
              fill: "#ffffff",
              opacity: "0.18"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { fill: "#FFF6E6", opacity: "0.92", children: BURGER_PATHS.seeds.map((sd, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "ellipse",
            {
              cx: sd.cx,
              cy: sd.cy,
              rx: "15.5",
              ry: "8.6",
              transform: `rotate(${sd.rot} ${sd.cx} ${sd.cy})`
            },
            i
          )) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: LEAF_D, fill: "url(#cbLeaf)" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: CHEESE_BAR_D, fill: "url(#cbCheese)" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: CHEESE_DRIP_D, fill: "url(#cbCheese)" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { ...BURGER_PATHS.patty, fill: "url(#cbPatty)" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: "136", y: "316", width: "240", height: "9", rx: "4.5", fill: "#ffffff", opacity: "0.14" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: BUN_BOTTOM_D, fill: "url(#cbBottom)" })
        ] })
      ]
    }
  );
}
function BrandMark({
  size = 40,
  radius,
  border = true,
  glow = false,
  style
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "span",
    {
      style: {
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: radius ?? Math.round(size * 0.26),
        background: "linear-gradient(140deg, color-mix(in srgb, var(--surface-3) 70%, #fff 4%), var(--n-050) 55%, var(--n-000))",
        boxShadow: border ? "inset 0 0 0 1px color-mix(in srgb, var(--acc) 30%, transparent), 0 10px 26px -14px rgba(0,0,0,0.9)" : void 0,
        overflow: "hidden",
        flexShrink: 0,
        ...style
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            "aria-hidden": true,
            style: {
              position: "absolute",
              inset: 0,
              background: "radial-gradient(120% 90% at 50% 42%, color-mix(in srgb, var(--acc) 26%, transparent), transparent 62%)"
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Burger, { size: Math.round(size * 0.72), glow, style: { position: "relative" } })
      ]
    }
  );
}
var BURGER_PATHS = {
  bunTop: BUN_TOP_D,
  leaf: LEAF_D,
  cheeseBar: CHEESE_BAR_D,
  cheeseDrip: CHEESE_DRIP_D,
  /** котлета — это <rect>, поэтому отдаём атрибуты как есть: их распыляют
      и статичный знак, и анимированный в заставке ({...BURGER_PATHS.patty}) */
  patty: { x: 122, y: 310, width: 268, height: 46, rx: 23 },
  bunBottom: BUN_BOTTOM_D,
  shine: "M138 154c24-26 60-40 98-40-34 14-60 34-78 58-10 14-24 12-26-4-1-6 1-11 6-14Z",
  seeds: [
    { cx: 176, cy: 180, rot: -16 },
    { cx: 240, cy: 156, rot: -5 },
    { cx: 270, cy: 196, rot: 3 },
    { cx: 306, cy: 164, rot: 9 },
    { cx: 352, cy: 192, rot: 17 }
  ]
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BrandMark,
  Burger
});
