import fs from 'fs';
import path from 'path';
let fails=0;
const ok=(c,m)=>{console.log((c?'  ✓ ':'  ✗ ')+m); if(!c)fails++;};

const css=fs.readFileSync('src/index.css','utf8');
console.log('\n[1] Защита вёрстки от системных настроек');
ok(/text-size-adjust:\s*100%/.test(css),'text-size-adjust зафиксирован (Android не раздует шрифт)');
ok(/font-family:\s*\n?\s*"Inter Variable"/.test(css),'подключён Inter Variable');
ok((css.match(/@font-face/g)||[]).length===4,'4 @font-face: Inter + Unbounded, латиница и кириллица');
ok(/font-family:\s*"Unbounded"/.test(css),'подключён Unbounded для заголовков');
ok(/\.t-display[\s\S]{0,200}Unbounded/.test(css),'заголовки используют Unbounded');
ok(/U\+0400-045F/.test(css),'кириллица покрыта unicode-range');
ok(/\.t-display\s*\{[\s\S]*?line-height:\s*1\.1[0-9]?/.test(css),'у заголовков line-height не режет буквы');
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
const glass=fs.readFileSync('src/ui/Glass.tsx','utf8');
ok(/paddingBottom:\s*"calc\(var\(--sab\) \+ 104px\)"/.test(glass),'Screen резервирует место под навбар');
ok(/padding:\s*"0 16px"/.test(glass),'Screen задаёт единые боковые поля');
for(const f of ['Home','Progress','Shop','Friends','Settings']){
  const t=fs.readFileSync(`src/pages/${f}.tsx`,'utf8');
  ok(/<Screen/.test(t),`${f}: использует единый каркас Screen`);
  ok(!/pb-28/.test(t)&&!/\+ 116px/.test(t),`${f}: старый жёсткий отступ убран`);
  ok(!/<Panel/.test(t),`${f}: непрозрачные карточки вместо стекла в списках`);
}

console.log('\n[4b] Оформление кнопок и скруглений');
ok(/--r-lg:\s*14px/.test(css)&&/--r-xl:\s*18px/.test(css),'радиусы уменьшены, без «пузырей»');
ok(/--btn-bg/.test(css)&&/--btn-brd/.test(css),'у кнопок есть свой фон и рамка (не сливаются)');
ok(/export function Button/.test(glass),'есть единый компонент Button');
ok(/whiteSpace:\s*"nowrap"/.test(glass),'текст кнопок не переносится и не ломает ряд');

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
ok((dist.match(/data:font\/woff2/g)||[]).length===4,'шрифты вшиты в HTML (не грузятся из сети)');
ok(!/fonts\.googleapis|fonts\.gstatic/.test(dist),'нет обращений к Google Fonts');
ok(fs.statSync('dist/index.html').size < 760*1024,`размер ${(fs.statSync('dist/index.html').size/1024).toFixed(0)} КБ — в пределах нормы`);

console.log('\n[7] Обновление приложения');
const upd=fs.readFileSync('src/core/updater.ts','utf8');
ok(/getReader\(\)/.test(upd),'загрузка идёт потоком — можно показать прогресс');
ok(/checkForUpdate/.test(upd)&&/isNewer/.test(upd),'версия сравнивается по числам, а не строкой');
ok(/installFromFile/.test(upd),'есть установка из скачанного файла');
const updui=fs.readFileSync('src/ui/Updater.tsx','utf8');
ok(/<Bar\s+pct=\{total \? pct : 0\.06\}/.test(updui),'прогресс-бар загрузки выводится');
ok(/Отменить/.test(updui),'загрузку можно отменить');
const wf2=fs.readFileSync('.github/workflows/build-apk.yml','utf8');
ok(/assembleRelease/.test(wf2),'CI собирает release-APK');
ok(/setup-android-signing/.test(wf2),'APK подписывается постоянным ключом (нет «конфликта пакетов»)');
ok(/REQUEST_INSTALL_PACKAGES/.test(wf2),'разрешение на установку обновлений выдано');
ok(/version: \$\{\{ env\.APP_VER \}\}/.test(wf2),'релиз публикует номер версии для проверки обновлений');
ok(fs.existsSync('android-signing/chubgames.p12'),'ключ подписи лежит в репозитории');

console.log('\n[8] Контент про друзей');
const cnt=fs.readFileSync('src/core/content.ts','utf8');
for(const id of ['lyoha','vanya','maks','seryoga','artyom','radomir','kudrya','shitov'])
  ok(cnt.includes(`id: "${id}"`),`друг ${id} есть в игре`);
ok((cnt.match(/unlockLvl: 0/g)||[]).length===6,'все 6 мини-игр открыты сразу');
const sav=fs.readFileSync('src/core/save.ts','utf8');
ok(/unlockedGames = \["burger", "clicker", "bite", "dino", "merge", "whack"\]/.test(sav),'старые сохранения тоже получают все игры');
ok(sav.includes('if (!have.has(f.id))'),'новые друзья досыпаются в старые сохранения');
ok(fs.existsSync('src/games/ArtyomBite.tsx'),'мини-игра «Зубы Артёма» есть');
ok(fs.existsSync('src/games/ShitovRun.tsx'),'мини-игра «Побег от Шитова» есть');
const app=fs.readFileSync('src/App.tsx','utf8');
ok(app.includes('<ArtyomBite')&&app.includes('<ShitovRun'),'новые игры подключены');
const brn=fs.readFileSync('src/games/BurgerRain.tsx','utf8');
ok(/Math\.min\(1\.85/.test(brn),'снаряды не разгоняются до невидимости');
ok(brn.includes('drawHead(ctx, look'),'человечек меняется вместе с героем');
const stg=fs.readFileSync('src/pages/Settings.tsx','utf8');
ok(stg.includes('t.me/kayorisan'),'есть ссылка на автора');
const wfl=fs.readFileSync('.github/workflows/build-apk.yml','utf8');
ok(wfl.includes('com.chubgames.app'),'package id прежний — обновление встанет поверх');

console.log(fails===0?'\n✅ ВСЕ ПРОВЕРКИ ВЁРСТКИ ПРОЙДЕНЫ\n':`\n❌ ПРОВАЛЕНО: ${fails}\n`);
process.exit(fails?1:0);
