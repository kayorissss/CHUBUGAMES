/**
 * Минимальный Canvas2D → SVG рекордер.
 * Нужен, чтобы в песочнице без node-canvas посмотреть, как реально
 * выглядят процедурные головы, и не гадать по коду.
 */

const M = {
  mul: (a, b) => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ],
  translate: (x, y) => [1, 0, 0, 1, x, y],
  scale: (x, y) => [x, 0, 0, y, 0, 0],
  rotate: (r) => [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0],
};

class Grad {
  constructor(id, x0, y0, x1, y1) {
    this.id = id; this.x0 = x0; this.y0 = y0; this.x1 = x1; this.y1 = y1; this.stops = [];
  }
  addColorStop(o, c) { this.stops.push([o, c]); }
}

export class SVGCanvas {
  constructor(w, h) {
    this.W = w; this.H = h;
    this.out = [];
    this.defs = [];
    this.uid = 0;
    this.ctm = [1, 0, 0, 1, 0, 0];
    this.stack = [];
    this.path = [];
    this.start = null;
    this.cur = null;
    this.clipId = null;
    this.fillStyle = "#000";
    this.strokeStyle = "#000";
    this.lineWidth = 1;
    this.lineCap = "butt";
    this.globalAlpha = 1;
    this.shadowBlur = 0;
    this.shadowColor = "";
    this.font = "";
    this.textAlign = "start";
  }
  get _m() { return `matrix(${this.ctm.map((v) => +v.toFixed(4)).join(",")})`; }
  save() {
    this.stack.push({ ctm: [...this.ctm], clipId: this.clipId, fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle, lineWidth: this.lineWidth, globalAlpha: this.globalAlpha });
  }
  restore() {
    const s = this.stack.pop();
    if (!s) return;
    this.ctm = s.ctm; this.clipId = s.clipId; this.fillStyle = s.fillStyle;
    this.strokeStyle = s.strokeStyle; this.lineWidth = s.lineWidth; this.globalAlpha = s.globalAlpha;
  }
  translate(x, y) { this.ctm = M.mul(this.ctm, M.translate(x, y)); }
  scale(x, y) { this.ctm = M.mul(this.ctm, M.scale(x, y)); }
  rotate(r) { this.ctm = M.mul(this.ctm, M.rotate(r)); }
  setTransform(a, b, c, d, e, f) { this.ctm = [a, b, c, d, e, f]; }

  beginPath() { this.path = []; this.start = null; this.cur = null; }
  moveTo(x, y) { this.path.push(`M${+x.toFixed(2)},${+y.toFixed(2)}`); this.start = [x, y]; this.cur = [x, y]; }
  lineTo(x, y) { this.path.push(`L${+x.toFixed(2)},${+y.toFixed(2)}`); this.cur = [x, y]; }
  quadraticCurveTo(cx, cy, x, y) {
    this.path.push(`Q${+cx.toFixed(2)},${+cy.toFixed(2)} ${+x.toFixed(2)},${+y.toFixed(2)}`);
    this.cur = [x, y];
  }
  bezierCurveTo(a, b, c, d, x, y) {
    this.path.push(`C${a},${b} ${c},${d} ${x},${y}`); this.cur = [x, y];
  }
  closePath() { this.path.push("Z"); if (this.start) this.cur = [...this.start]; }

  _sample(fn, from, to, seg = 48) {
    const pts = [];
    for (let i = 0; i <= seg; i++) pts.push(fn(from + ((to - from) * i) / seg));
    return pts;
  }
  ellipse(cx, cy, rx, ry, rot, a0, a1, ccw = false) {
    // Canvas: при ccw=false угол ВОЗРАСТАЕТ, при ccw=true — убывает.
    if (!ccw && a1 < a0) a1 += Math.PI * 2;
    if (ccw && a1 > a0) a1 -= Math.PI * 2;
    const f = (a) => {
      const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)];
    };
    const pts = this._sample(f, a0, a1);
    pts.forEach((p, i) => {
      const cmd = i === 0 ? (this.cur ? "L" : "M") : "L";
      this.path.push(`${cmd}${p[0].toFixed(2)},${p[1].toFixed(2)}`);
    });
    this.cur = pts[pts.length - 1];
    if (!this.start) this.start = pts[0];
  }
  arc(cx, cy, r, a0, a1, ccw = false) { this.ellipse(cx, cy, r, r, 0, a0, a1, ccw); }
  rect(x, y, w, h) {
    this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath();
  }
  roundRect(x, y, w, h, r) {
    let rr = Array.isArray(r) ? r : [r, r, r, r];
    if (rr.length === 1) rr = [rr[0], rr[0], rr[0], rr[0]];
    const m = Math.min(Math.abs(w), Math.abs(h)) / 2;
    rr = rr.map((v) => Math.min(Math.abs(v || 0), m));
    const [a, b, c, d] = rr;
    this.moveTo(x + a, y);
    this.lineTo(x + w - b, y);
    this.quadraticCurveTo(x + w, y, x + w, y + b);
    this.lineTo(x + w, y + h - c);
    this.quadraticCurveTo(x + w, y + h, x + w - c, y + h);
    this.lineTo(x + d, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - d);
    this.lineTo(x, y + a);
    this.quadraticCurveTo(x, y, x + a, y);
    this.closePath();
  }
  fillRect(x, y, w, h) { this.beginPath(); this.rect(x, y, w, h); this.fill(); }
  clearRect() {}

  createLinearGradient(x0, y0, x1, y1) {
    return new Grad(`g${this.uid++}`, x0, y0, x1, y1);
  }
  _paint(style) {
    if (style instanceof Grad) {
      this.defs.push(
        `<linearGradient id="${style.id}" gradientUnits="userSpaceOnUse" x1="${style.x0}" y1="${style.y0}" x2="${style.x1}" y2="${style.y1}">` +
        style.stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("") +
        `</linearGradient>`,
      );
      return `url(#${style.id})`;
    }
    return style;
  }
  _alphaOf(style) {
    const m = /rgba?\([^)]*,\s*([0-9.]+)\s*\)/.exec(String(style));
    return m ? parseFloat(m[1]) : 1;
  }
  _clipAttr() { return this.clipId ? ` clip-path="url(#${this.clipId})"` : ""; }

  fill() {
    if (!this.path.length) return;
    const p = this._paint(this.fillStyle);
    const a = this.globalAlpha * this._alphaOf(this.fillStyle);
    this.out.push(
      `<path d="${this.path.join(" ")}" fill="${p}" fill-opacity="${a.toFixed(3)}" transform="${this._m}"${this._clipAttr()}/>`,
    );
  }
  stroke() {
    if (!this.path.length) return;
    const p = this._paint(this.strokeStyle);
    const a = this.globalAlpha * this._alphaOf(this.strokeStyle);
    this.out.push(
      `<path d="${this.path.join(" ")}" fill="none" stroke="${p}" stroke-opacity="${a.toFixed(3)}" stroke-width="${this.lineWidth}" stroke-linecap="${this.lineCap}" stroke-linejoin="round" transform="${this._m}"${this._clipAttr()}/>`,
    );
  }
  clip() {
    const id = `c${this.uid++}`;
    this.defs.push(`<clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path d="${this.path.join(" ")}"/></clipPath>`);
    this.clipId = id;
  }
  fillText(t, x, y) {
    this.out.push(`<text x="${x}" y="${y}" fill="${this._paint(this.fillStyle)}" font-size="14" font-family="sans-serif" text-anchor="${this.textAlign === "center" ? "middle" : "start"}" transform="${this._m}">${String(t).replace(/[<&]/g, "")}</text>`);
  }
  measureText(t) { return { width: String(t).length * 7 }; }
  drawImage() {}

  toSVG(bg = "#0d0d10") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.W}" height="${this.H}" viewBox="0 0 ${this.W} ${this.H}">` +
      `<defs>${this.defs.join("")}</defs>` +
      `<rect width="${this.W}" height="${this.H}" fill="${bg}"/>` +
      this.out.join("") + `</svg>`;
  }
}
