/**
 * ПРОВЕРКА ЛОГИКИ: разрешение рисования, автоподстройка под кадры и клавиши.
 *
 * `check:ui` читает исходники текстом — он сторожит вёрстку. Здесь
 * проверяется поведение: ровно тех двух механизмов, которые чинят «2–7 FPS
 * на слабом ПК» и «в игры нельзя играть с клавиатуры». Глазами их не видно,
 * а сломать — раз плюнуть, поэтому они под тестом.
 *
 * Модули собираются esbuild в временный бандл и запускаются в Node с
 * подставленными заглушками DOM: без браузера, без железа, за секунду.
 *
 *   node scripts/check-perf.mjs        (или npm run check:perf)
 */
/*
 * esbuild нужен, чтобы собрать TypeScript-модули в исполняемый бандл.
 * Он уже пришёл вместе с vite; если вдруг его нет — проверка пропускается,
 * а не роняет CI: сборка приложения без него всё равно невозможна.
 */
let esbuild = null;
try {
  ({ default: esbuild } = await import('esbuild'));
} catch {
  console.log('esbuild не найден — проверка логики пропущена');
  process.exit(0);
}
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'chub-perf-'));
try {
  await esbuild.build({
    entryPoints: ['src/core/perf.ts', 'src/core/keymouse.ts'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    outdir: out,
    logLevel: 'error',
  });

  /* ── заглушки окружения (их надо поставить до импорта модулей) ── */
  const mkEl = (tag) => {
    const got = [];
    return { tagName: tag, dispatchEvent: (e) => { got.push(e); return true; }, _got: got };
  };
  const listeners = {};
  let cur = mkEl('CANVAS');
  const ROOT = {
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
  };
  globalThis.window = {
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
    addEventListener: (t, f) => { (listeners[t] ||= []).push(f); },
    removeEventListener: (t, f) => { listeners[t] = (listeners[t] || []).filter((x) => x !== f); },
  };
  globalThis.document = {
    documentElement: { classList: { toggle() {}, contains: () => false } },
    elementFromPoint: () => cur,
  };
  const LS = {
    s: {},
    getItem(k) { return k in this.s ? this.s[k] : null; },
    setItem(k, v) { this.s[k] = String(v); },
    removeItem(k) { delete this.s[k]; },
  };
  // в Node 22 своё localStorage уже есть — присвоить нельзя, только переопределить
  Object.defineProperty(globalThis, 'localStorage', { value: LS, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'navigator', {
    value: { hardwareConcurrency: 16, deviceMemory: 8, userAgent: 'node' },
    configurable: true, writable: true,
  });

  let now = 0;
  globalThis.performance = { now: () => now };
  let rafQ = [];
  globalThis.requestAnimationFrame = (f) => { rafQ.push(f); return rafQ.length; };
  globalThis.cancelAnimationFrame = () => {};
  class Ev { constructor(type, o = {}) { this.type = type; Object.assign(this, o); } preventDefault() { this._pd = true; } }
  globalThis.PointerEvent = Ev;
  globalThis.MouseEvent = Ev;
  globalThis.HTMLElement = class {};

  const step = (t) => { now = t; const q = rafQ; rafQ = []; q.forEach((f) => f(t)); };
  const fire = (t, e) => { (listeners[t] || []).forEach((f) => f(e)); };
  const key = (code, target = { tagName: 'BODY' }) => ({ code, key: code, repeat: false, target, preventDefault() {} });

  const perf = await import(pathToFileURL(path.join(out, 'perf.js')).href);
  const km = await import(pathToFileURL(path.join(out, 'keymouse.js')).href);

  console.log('\n[1] Разрешение рисования считается из бюджета пикселей');
  perf.writeQuality('auto');
  const full = perf.renderScale(1920, 1080);
  ok(Math.abs(full - 1) < 0.02, `обычный экран 1080p не режется вообще (×${full.toFixed(2)})`);
  ok(perf.renderScale(3840, 2160) < 0.75, '4K-окно ужимается: кадры важнее миллионов пикселей');
  perf.writeQuality('eco');
  ok(perf.renderScale(1920, 1080) < full - 0.02, `«Эко» режет буфер (×${perf.renderScale(1920, 1080).toFixed(2)})`);
  perf.writeQuality('full');
  ok(perf.renderScale(1920, 1080) > 0.99, '«Красиво» слушается человека, а не автозамер');
  perf.writeQuality('auto');

  console.log('\n[2] Автоподстройка по кадрам самой игры');
  perf.resetAdapt(); perf.resetFps();
  let t = now;
  for (let i = 0; i < 12; i++) { t += 500; now = t; perf.fpsFeed(t); }   // 2 FPS ≈ то, что описал игрок
  ok(perf.adaptValue() < 0.9, `на 2 FPS разрешение уехало вниз: ${(perf.adaptValue() * 100) | 0}%`);
  ok(perf.renderScale(1920, 1080) < 0.75, `буфер 1080p стал ${(perf.renderScale(1920, 1080) * 100) | 0}% — пикселей вдвое меньше`);
  const low = perf.adaptValue();
  for (let i = 0; i < 900; i++) { t += 16.7; now = t; perf.fpsFeed(t); }  // пошло ровно 60
  ok(perf.adaptValue() > low, `когда кадров хватило, разрешение вернулось: ${(perf.adaptValue() * 100) | 0}%`);
  perf.writeQuality('full');
  let t2 = t;
  for (let i = 0; i < 20; i++) { t2 += 500; now = t2; perf.fpsFeed(t2); }
  ok(perf.adaptValue() === 1, 'в ручном «Красиво» автоподстройка не спорит с выбором');
  perf.writeQuality('auto'); perf.resetAdapt();
  let t3 = t2;
  for (let i = 0; i < 60; i++) { t3 += 16.7; now = t3; perf.fpsFeed(t3); }
  ok(perf.adaptValue() === 1, 'при стабильных 60 FPS разрешение не трогается');

  console.log('\n[3] FPS считается без второго цикла');
  ok(perf.readFps().fps > 0, 'после кадров счётчик показывает число');
  const s0 = perf.readFps();
  ok(s0.ms >= 0 && s0.worst >= 0, 'есть и средняя длительность кадра, и просадка');

  console.log('\n[4] WASD и стрелки превращаются в указатель игры');
  const off = km.initGameKeys(ROOT);
  ok(km.readKeys().x === 400 && km.readKeys().y === 300, 'палец стартует из центра поля, а не из угла');
  const y0 = km.readKeys().y;
  fire('keydown', key('KeyW'));
  step(now + 16.7); step(now + 33.4);
  ok(km.readKeys().y < y0, 'W ведёт палец вверх');
  ok(cur._got.some((e) => e.type === 'pointermove'), 'игра получает pointermove — как от мыши');
  fire('keyup', key('KeyW'));
  cur._got.length = 0;
  fire('keydown', key('Space'));
  ok(cur._got.some((e) => e.type === 'pointerdown'), 'ПРОБЕЛ = pointerdown (прицел, прыжок, удержание)');
  fire('keyup', key('Space'));
  ok(cur._got.some((e) => e.type === 'pointerup'), 'отпустил = pointerup');
  ok(!cur._got.some((e) => e.type === 'click'), 'на канвасе click не летит: прицел-перетаскивание не ломается');
  const btn = mkEl('DIV'); cur = btn;
  fire('keydown', key('Enter')); fire('keyup', key('Enter'));
  ok(btn._got.some((e) => e.type === 'click'), 'а по DOM-кнопке Enter её нажимает (меню игры доступно)');
  cur = mkEl('CANVAS');
  fire('keydown', key('KeyA', { tagName: 'INPUT' }));
  ok(!km.readKeys().left, 'в поле ввода A остаётся буквой, а не движением');
  fire('keydown', key('Space'));
  step(now + 16.7);
  ok(cur._got.some((e) => e.type === 'pointerdown' && e.buttons === 1), 'пока клавишу держат, движение идёт с зажатой кнопкой');
  fire('keyup', key('Space'));
  fire('pointermove', new Ev('pointermove', { clientX: 111, clientY: 222 }));
  ok(km.readKeys().x === 111 && km.readKeys().y === 222, 'мышь берёт указатель на себя в любой момент');
  fire('keydown', key('ShiftLeft')); fire('keydown', key('KeyD'));
  const xa = km.readKeys().x; step(now + 16.7);
  const withShift = km.readKeys().x - xa;
  fire('keyup', key('KeyD')); fire('keyup', key('ShiftLeft'));
  fire('keydown', key('KeyD'));
  const xb = km.readKeys().x; step(now + 16.7);
  const plain = km.readKeys().x - xb;
  fire('keyup', key('KeyD'));
  ok(withShift > plain * 1.7, `SHIFT ускоряет палец вдвое (${withShift.toFixed(0)} против ${plain.toFixed(0)} px)`);
  km.readKeys().x = 798; km.readKeys().right = true;
  step(now + 16.7); step(now + 33.4);
  ok(km.readKeys().x <= 800, 'за край поля палец не уходит — в настройки не залезет');
  fire('blur', new Ev('blur'));
  ok(!km.readKeys().right && !km.readKeys().up, 'окно потеряло фокус — клавиши отпущены (герой не бежит вечно)');
  off();
  fire('keydown', key('KeyD'));
  ok(!km.readKeys().right, 'после закрытия игры клавиши снова обычные');

  console.log('\n[5] Игры со своими клавишами не получают двойное нажатие');
  for (const id of ['burger', 'merge', 'dino', 'radomir'])
    ok(km.handlesKeysNatively(id), `${id}: слой не ставится, клавиши читает сама игра`);
  ok(!km.handlesKeysNatively('pool'), 'а в бильярде слой нужен: там раньше была только мышь');
} finally {
  fs.rmSync(out, { recursive: true, force: true });
}

console.log(fails === 0 ? '\n✅ ЛОГИКА ПРОИЗВОДИТЕЛЬНОСТИ И ВВОДА ЦЕЛА\n' : `\n❌ ПРОВАЛЕНО: ${fails}\n`);
process.exit(fails ? 1 : 0);
