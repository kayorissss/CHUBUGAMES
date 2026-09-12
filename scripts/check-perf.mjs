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
  // каждый модуль — своим проходом: у них разные папки, и esbuild иначе
  // сохранит дерева выхода (core/perf.js, games/europa/model.js…), а нам
  // нужны предсказуемые имена
  for (const [entry, name] of [
    ['src/core/perf.ts', 'perf.js'],
    ['src/core/keymouse.ts', 'keymouse.js'],
    ['src/games/europa/model.ts', 'model.js'],
  ]) {
    await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      platform: 'browser',
      outfile: path.join(out, name),
      logLevel: 'error',
    });
  }

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
  const eu = await import(pathToFileURL(path.join(out, 'model.js')).href);

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
  for (const id of ['burger', 'merge', 'dino', 'radomir', 'europa'])
    ok(km.handlesKeysNatively(id), `${id}: слой не ставится, клавиши читает сама игра`);
  ok(!km.handlesKeysNatively('pool'), 'а в бильярде слой нужен: там раньше была только мышь');
console.log('\n[6] Чубупа Универсалис: карта, бой, баланс');
ok(eu.LEVELS.length >= 5, `уровней кампании: ${eu.LEVELS.length}`);
{
  // карта обязана быть двусторонней: «дорога туда есть, а обратно нет» —
  // это не стратегия, а обещание, которое игра не выполняет
  let asym = 0; let badLink = 0; let dupl = 0;
  for (const lv of eu.LEVELS) {
    const ps = eu.freshProvs(lv);
    const names = new Set();
    for (const p of ps) {
      if (names.has(p.name)) dupl++;
      names.add(p.name);
      for (const id of p.links) {
        const q = ps.find((x) => x.id === id);
        if (!q) { badLink++; continue; }
        if (!q.links.includes(p.id)) asym++;
      }
    }
    if (!ps.some((p) => p.owner === 'me')) badLink++;
  }
  ok(badLink === 0, 'ссылки ведут на существующие здания, у игрока есть стартовое');
  ok(asym === 0, 'дороги двусторонние');
  ok(dupl === 0, 'названия зданий внутри уровня не повторяются');
}
{
  const ps = eu.freshProvs(eu.LEVELS[1]);
  const a = ps[0], b = ps[1], c = ps[2];
  ok(eu.strikePower([a, b]) > eu.strikePower([a]),
    `два здания в ударе сильнее одного (${Math.round(eu.strikePower([a]))} → ${Math.round(eu.strikePower([a, b]))})`);
  const weak = { ...c, army: 10, dev: 1, wall: 0, intel: 0, barr: 0, owner: 'ai' };
  const tough = { ...c, army: 10, dev: 3, wall: 3 };
  const mine = [{ ...a, army: 11, dev: 1, barr: 0, intel: 0 }];
  const vEasy = eu.verdictFor(mine, weak, false);
  const vHard = eu.verdictFor(mine, tough, false);
  ok(vHard.chance < vEasy.chance, 'развитие и стены врага честно снижают шанс');
  ok(vHard.tone === 'bad' || vHard.tone === 'mad', `10 против 10 с развитием 3 — «${vHard.label}», а не «взять»`);
  ok(vEasy.loss > 0, 'прогноз называет и ожидаемые потери');
  ok(eu.verdictFor(mine, tough, true).chance > vHard.chance, 'осада бьёт по стенам: с телегами шанс выше');
}
{
  // бой: потери честные, никто не уходит в минус, захват оставляет гарнизон
  let win = 0; let neg = 0; let zeroGarrison = 0;
  for (let i = 0; i < 400; i++) {
    const ps = eu.freshProvs(eu.LEVELS[1]);
    const from = { ...ps[0], army: 18, dev: 2, barr: 1, intel: 1 };
    const to = { ...ps[1], army: 6, dev: 1, wall: 1, owner: 'ai' };
    const r = eu.fight([from], to, false);
    if (r.win) win++;
    if (r.lostMine < 0 || r.lostTheirs < 0 || r.keepBack < 0 || r.occupy < 0) neg++;
    if (r.win && r.keepBack < 1) zeroGarrison++;
  }
  let even = 0;
  for (let i = 0; i < 400; i++) {
    const ps = eu.freshProvs(eu.LEVELS[1]);
    const r = eu.fight([{ ...ps[0], army: 10, dev: 1, barr: 0, intel: 0 }], { ...ps[1], army: 9, dev: 1, wall: 0, owner: 'ai' }, false);
    if (r.win) even++;
  }
  ok(win >= 380, `перевес 18 на 6 выигрывает ${Math.round(win / 4)} % боёв — большой перевес должен быть предсказуем`);
  ok(even > 60 && even < 340, `равные силы — это азарт, а не арифметика: ${Math.round(even / 4)} %`);
  ok(neg === 0, 'потери никогда не уходят в минус');
  ok(zeroGarrison === 0, 'захватчик всегда оставляет гарнизон в тылу');
}
{
  const ps = eu.freshProvs(eu.LEVELS[2]);
  const mine = ps.filter((p) => p.owner === 'me');
  ok(mine.every((p) => eu.income(p) > 0), 'каждое своё здание приносит казну');
  ok(ps.filter((p) => p.owner !== 'me').every((p) => eu.income(p) === 0), 'чужие здания кормят не тебя');
  const p0 = mine[0];
  ok(eu.cap({ ...p0, barr: p0.barr + 1 }) > eu.cap(p0), 'казармы поднимают потолок войска');
  ok(eu.armyCost({ ...p0, army: p0.army + 10 }, ps) > eu.armyCost(p0, ps), 'чем больше войско, тем дороже боец');
}
{
  let neg = 0; let moved = 0;
  for (let i = 0; i < 300; i++) {
    const ps = eu.freshProvs(eu.LEVELS[4]);
    if (eu.aiTurn(ps, 1.5, 1.1)) moved++;
    if (ps.some((p) => p.army < 1)) neg++;
  }
  ok(neg === 0, 'после хода ИИ войско не становится нулём');
  ok(moved > 40, `ИИ на последнем уровне реально атакует (${moved} из 300)`);
}
{
  let prev = 0; let broken = 0;
  for (const r of eu.RANKS) { if (r.at <= prev && prev !== 0) broken++; prev = r.at; }
  ok(broken === 0, `рангов ${eu.RANKS.length}, пороги растут`);
  ok(eu.rankOf(0).rank.at === 0 && eu.rankOf(1e9).rank === eu.RANKS[eu.RANKS.length - 1], 'первый и последний ранг на месте');
  ok(eu.gloryFor(6, 4, true, 2) > eu.gloryFor(6, 4, false, 2), 'победа даёт больше славы, чем отсиживание');
}
{
  // полная партия вслепую: жадная стратегия обязана выигрывать первый
  // уровень и спотыкаться на последнем — иначе либо «игра в одни ворота»,
  // либо «зачем начинать»
  const simLevel = (idx, minChance) => {
    let wins = 0; let crash = 0; const runs = 40;
    for (let g = 0; g < runs; g++) {
      try {
        const lv = eu.LEVELS[idx];
        const ps = eu.freshProvs(lv);
        let gold = lv.gold;
        for (let t = 1; t <= lv.turns; t++) {
          gold += ps.reduce((a, p) => a + eu.income(p), 0);
          for (const p of ps) { p.moved = false; p.used = false; }
          // «хороший игрок»: сначала развитие там, где больше всего соседей-врагов,
          // потом живая сила; иначе бот играет глупее человека и баланс не проверить
          for (const p of ps.filter((x) => x.owner === 'me')) {
            const foes = p.links.filter((id) => ps[id] && ps[id].owner !== 'me').length;
            while (foes > 0 && p.dev < 6 && gold >= eu.devCost(p, ps) * 3) { gold -= eu.devCost(p, ps); p.dev += 1; }
            const c = eu.armyCost(p, ps);
            while (gold >= c && p.army < eu.cap(p)) { p.army += 1; gold -= c; }
          }
          for (const tgt of ps.filter((x) => x.owner !== 'me')) {
            const froms = tgt.links.map((id) => ps.find((x) => x.id === id))
              .filter((x) => x && x.owner === 'me' && x.army > 1 && !x.moved);
            if (!froms.length) continue;
            if (eu.verdictFor(froms, tgt, false).chance < minChance) continue;
            const r = eu.fight(froms, tgt, false);
            const back = r.men > 0 ? r.keepBack / r.men : 0;
            for (const f of froms) { f.army = Math.max(1, 1 + Math.round((f.army - 1) * back)); f.moved = true; }
            if (r.win) { tgt.owner = 'me'; tgt.army = Math.max(1, r.occupy); }
            else tgt.army = Math.max(1, tgt.army - r.lostTheirs);
          }
          eu.aiTurn(ps, lv.aiPower, lv.aiAggro);
          if (ps.every((p) => p.owner === 'me')) { wins++; break; }
          if (!ps.some((p) => p.owner === 'me')) break;
        }
      } catch { crash++; }
    }
    return { pct: Math.round((wins / runs) * 100), crash };
  };
  const e1 = simLevel(0, 0.55);
  const e5 = simLevel(4, 0.55);
  ok(e1.crash === 0 && e5.crash === 0, 'партии на голой модели не падают');
  ok(e1.pct >= 55, `обучающий уровень умная стратегия берёт в ${e1.pct} % случаев — игрок не должен тонуть в первом же раунде`);
  ok(e5.pct < e1.pct && e5.pct > 5, `последний уровень сложнее первого, но играбелен (${e5.pct} % против ${e1.pct} %)`);
}
} finally {
  fs.rmSync(out, { recursive: true, force: true });
}

console.log(fails === 0 ? '\n✅ ЛОГИКА ПРОИЗВОДИТЕЛЬНОСТИ И ВВОДА ЦЕЛА\n' : `\n❌ ПРОВАЛЕНО: ${fails}\n`);
process.exit(fails ? 1 : 0);
