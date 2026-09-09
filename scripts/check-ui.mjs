import fs from 'fs';
import path from 'path';
let fails=0;
const ok=(c,m)=>{console.log((c?'  ✓ ':'  ✗ ')+m); if(!c)fails++;};

const css=fs.readFileSync('src/index.css','utf8');
console.log('\n[1] Защита вёрстки от системных настроек');
ok(/text-size-adjust:\s*100%/.test(css),'text-size-adjust зафиксирован (Android не раздует шрифт)');
ok(/font-family:\s*\n?\s*"Inter Variable"/.test(css),'подключён Inter Variable');
ok((css.match(/@font-face/g)||[]).length===2,'ровно 2 @font-face (латиница+кириллица)');
ok(/U\+0400-045F/.test(css),'кириллица покрыта unicode-range');
ok(/\.t-display[\s\S]*?line-height:\s*1\.08/.test(css),'у заголовков line-height не режет буквы');
ok(/\.clip1/.test(css)&&/\.clip2/.test(css),'есть утилиты обрезки текста');

console.log('\n[2] Тосты читаемы (непрозрачный фон)');
const ov=fs.readFileSync('src/components/Overlays.tsx','utf8');
ok(/--toast-bg/.test(ov),'тост использует плотный фон, а не стекло');
ok(!/<Panel[^>]*strong[\s\S]{0,200}t\.icon/.test(ov),'тост больше не полупрозрачная Panel');
ok(/--toast-bg/.test(css)&&(css.match(/--toast-bg/g)||[]).length>=2,'toast-bg задан для тёмной и светлой темы');

console.log('\n[3] Управление в Burger Rain');
const br=fs.readFileSync('src/games/BurgerRain.tsx','utf8');
ok(/setPointerCapture/.test(br),'палец захватывается (можно вести, а не только тапать)');
ok(/releasePointerCapture/.test(br),'указатель корректно отпускается');
ok(/touchAction:\s*"none"/.test(br),'браузер не перехватывает жест');
ok(/e\.preventDefault\(\)/.test(br),'скролл не мешает движению');
ok(/0\.055/.test(br),'отклик героя ускорен');

console.log('\n[4] Контент не уезжает под навбар');
for(const f of ['Home','Progress','Shop','Friends','Settings']){
  const t=fs.readFileSync(`src/pages/${f}.tsx`,'utf8');
  ok(/paddingBottom:\s*"calc\(var\(--sab\) \+ 116px\)"/.test(t),`${f}: нижний отступ учитывает навбар`);
  ok(!/pb-28/.test(t),`${f}: старый жёсткий отступ убран`);
}

console.log('\n[5] Иконки приложения');
ok(fs.existsSync('assets/icon.png'),'assets/icon.png существует');
ok(fs.statSync('assets/icon.png').size>10000,'иконка не пустая');
const wf=fs.readFileSync('.github/workflows/build-apk.yml','utf8');
ok(/cp -v android-icons\/mipmap-\$d/.test(wf),'воркфлоу копирует иконки в Android-проект');
ok(/ic_launcher_background/.test(wf)&&/#0D0D10/.test(wf),'фон adaptive-иконки тёмный, не белый');
const dens=['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi'];
ok(dens.every(d=>fs.existsSync(`android-icons/mipmap-${d}/ic_launcher.png`)),'иконки есть для всех 5 плотностей');
ok(dens.every(d=>fs.existsSync(`android-icons/mipmap-${d}/ic_launcher_foreground.png`)),'adaptive foreground есть для всех плотностей');
ok(dens.every(d=>fs.existsSync(`android-icons/mipmap-${d}/ic_launcher_round.png`)),'круглые иконки есть для всех плотностей');

console.log('\n[6] Сборка офлайн');
const dist=fs.readFileSync('dist/index.html','utf8');
ok((dist.match(/data:font\/woff2/g)||[]).length===2,'шрифты вшиты в HTML (не грузятся из сети)');
ok(!/fonts\.googleapis|fonts\.gstatic/.test(dist),'нет обращений к Google Fonts');
ok(fs.statSync('dist/index.html').size < 700*1024,`размер ${(fs.statSync('dist/index.html').size/1024).toFixed(0)} КБ — в пределах нормы`);

console.log(fails===0?'\n✅ ВСЕ ПРОВЕРКИ ВЁРСТКИ ПРОЙДЕНЫ\n':`\n❌ ПРОВАЛЕНО: ${fails}\n`);
process.exit(fails?1:0);
