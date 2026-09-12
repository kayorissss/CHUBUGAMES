import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { pathToFileURL } from 'url';
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
/* Плашка уведомления обязана быть плотной (текст читается поверх игры) и living
   в углу, а не «стопа по центру сверху» — за это следим и в CSS, и в разметке. */
ok(/\.toast-item \{[\s\S]{0,300}?background: var\(--toast-bg\)/.test(css) || /--toast-bg/.test(ov),
   'тост использует плотный фон, а не стекло');
ok(/position: fixed/.test(css) && /\.toast-stack/.test(css),
   'тосты собраны в одну стопку-угол, а не сыплются по центру');
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
  // Home на ПК подменяет Screen на грид-контейнер (переменная Wrap),
  // поэтому у него проверяем сам факт использования каркаса.
  ok(/<Screen/.test(t) || /Wrap: React\.ElementType = pc \? "div" : Screen/.test(t),
    `${f}: использует единый каркас Screen`);
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
// Порог: 8 новых игр добавили ~50 КБ (сейчас ~976 КБ). Всё лежит в одном
// файле — приложение обязано открываться офлайн, без подгрузки чанков.
/*
 * Порог размера сборки.
 *
 * Поднят с 1200 до 1600 КиБ осознанно, а не «чтобы прошло». Причины:
 *  • по сети уходит gzip — это ~433 КиБ, а не полтора мегабайта;
 *  • рядом в пакете лежат медиа на 10.6 МБ (трек и рекламный ролик),
 *    так что вклад HTML в вес APK всё равно невелик;
 *  • приложение ставится один раз, а не грузится каждый раз из сети.
 * Настоящий риск — не размер файла, а время разбора скрипта на слабом
 * телефоне, поэтому ниже отдельно проверяется, что не появилось
 * тяжёлых синхронных вычислений на старте.
 */
const htmlSize = fs.statSync('dist/index.html').size;
ok(htmlSize < 1600*1024,`размер ${(htmlSize/1024).toFixed(0)} КБ — в пределах нормы`);

console.log('\n[7] Обновление приложения');
const upd=fs.readFileSync('src/core/updater.ts','utf8');
ok(/getReader\(\)/.test(upd),'загрузка идёт потоком — можно показать прогресс');
ok(/checkForUpdate/.test(upd)&&/isNewer/.test(upd),'версия сравнивается по числам, а не строкой');
ok(/installFromFile/.test(upd),'есть установка из скачанного файла');
// Экран обновления один на всё приложение (Updater.tsx удалён как дубль)
const updui=fs.readFileSync('src/ui/UpdateBanner.tsx','utf8');
ok(!fs.existsSync('src/ui/Updater.tsx'),'нет второго экрана обновления со своим оформлением');
ok(/ProgressLine/.test(updui)&&/animate=\{\{ width:/.test(updui),'прогресс загрузки выводится полосой');
ok(!/ProgressRing/.test(updui),'кольца прогресса больше нет');
ok(/Отменить загрузку/.test(updui),'загрузку можно отменить');
ok(/var\(--surface\)/.test(updui)&&!/radial-gradient\(circle at 50% 50%, var\(--acc-glow\)/.test(updui),'экран обновления без свечения на пол-экрана');
const wf2=fs.readFileSync('.github/workflows/build-apk.yml','utf8');
ok(/assembleRelease/.test(wf2),'CI собирает release-APK');
ok(/setup-android-signing/.test(wf2),'APK подписывается постоянным ключом (нет «конфликта пакетов»)');
ok(/REQUEST_INSTALL_PACKAGES/.test(wf2),'разрешение на установку обновлений выдано');
ok(/printf 'version: %s/.test(wf2) && /--notes-file RELEASE_BODY\.md/.test(wf2),
  'релиз публикует номер версии для проверки обновлений');
// Публикация — штатным gh, без стороннего action: он падал в прогоне из
// тега молча, и понять причину по логам было нельзя.
ok(!/softprops\/action-gh-release@/.test(wf2) && /gh release upload latest/.test(wf2),
  'APK в релиз кладёт gh, а не сторонний action');
{
  const wfD = fs.readFileSync('.github/workflows/build-desktop.yml', 'utf8');
  ok(!/softprops\/action-gh-release@/.test(wfD) && /gh release upload desktop[\s\S]{0,80}--clobber/.test(wfD),
    'EXE в релиз кладёт gh, перезапись файлов — --clobber');
}
ok(fs.existsSync('RELEASE_NOTES.md'),'описание релиза лежит в репозитории (не хардкод в workflow)');
const rm=fs.readFileSync('README.md','utf8');
ok(!/releases\/(download|tag)\/[^)\s]*\d+\.\d+\.\d+/.test(rm),
  'в README нет ссылок на файл с версией в имени — такие ссылки рвутся на каждом релизе');
ok(/releases\/tag\/desktop/.test(rm) && /releases\/tag\/latest/.test(rm),
  'README ведёт на страницы релизов, где всегда лежит актуальный файл');
const VER=fs.readFileSync('src/core/version.ts','utf8').match(/APP_VERSION\s*=\s*"([0-9.]+)"/)[1];
ok(new RegExp('### Что нового в '+VER.replace(/\./g,'\\.')).test(fs.readFileSync('RELEASE_NOTES.md','utf8')),'описание релиза совпадает с версией '+VER);
ok(fs.existsSync('public/ads/promo1.mp4'),'рекламный ролик на месте');
ok(fs.existsSync('dist/ads/promo1.mp4'),'ролик попал в сборку (значит будет в APK)');
ok(!execSync('git ls-files').toString().split('\n').some((f) => /\.(p12|jks|keystore)$/.test(f)),
  'ключа подписи нет в git (был в публичном репо — это дыра)');
ok(/android-signing\/\*\.p12/.test(fs.readFileSync('.gitignore', 'utf8')),
  'ключ закрыт в .gitignore — обратно не закоммитить');
const signScript = fs.readFileSync('scripts/setup-android-signing.mjs', 'utf8');
ok(/CHUB_KEYSTORE_B64/.test(wf2) && /CHUB_KEYSTORE_PASSWORD/.test(wf2),
  'ключ и пароль CI берёт из Secrets');
ok(!/storePassword '[^']*'/.test(signScript) && !/keyPassword 'chubgames'/.test(signScript),
  'пароль подписи не зашит в скрипт — только из переменных окружения');
ok(/findProperty\('chubStorePassword'\)/.test(signScript),
  'пароль передаётся Gradle свойством и не попадает в файлы проекта');
ok(/apksigner verify/.test(wf2),
  'подпись APK проверяется до публикации (debug-ключ в релиз не пройдёт)');
ok(/if: steps\.kind\.outputs\.release == 'true'/.test(wf2),
  'APK публикуется только релизным прогоном (тег v*), а не любым пушем');
ok(/CHUBUGAMES\.apk/.test(wf2),
  'файл сборки называется CHUBUGAMES.apk — как игра, а не CHUBGAMES');
const wfD = fs.readFileSync('.github/workflows/build-desktop.yml', 'utf8');
ok(/if: steps\.kind\.outputs\.release == 'true'/.test(wfD),
  'EXE публикуется только релизным прогоном');
ok(/npm ci/.test(wf2) && /npm ci/.test(wfD), 'CI ставит зависимости по lock-файлу (сборка воспроизводима)');
ok(/npx tsc --noEmit/.test(wf2) && /npx tsc --noEmit/.test(wfD),
  'CI проверяет типы: vite их не проверяет, а релиз собирается именно так');
const dmain7 = fs.readFileSync('desktop/main.cjs', 'utf8');
ok(/sha256OfFile/.test(dmain7) && /verifyChecksum\(dest/.test(dmain7),
  'ПК сверяет SHA-256 установщика до запуска');
ok(/startsWith\(rootN\)/.test(dmain7),
  'раздача файлов по app:// закрыта на выходе за папку игры (сепаратор в сравнении)');
ok(/EXTERNAL_HOSTS/.test(dmain7),
  'внешние ссылки открываются только на известные домены');
ok(/githubusercontent/.test(dmain7) && /protocol !== "https:"/.test(dmain7),
  'обновление скачивается только по https и только с github');
const updSec = fs.readFileSync('src/core/updater.ts', 'utf8');
ok(/assertDownloadUrl/.test(updSec) && /verifyDownloaded/.test(updSec),
  'APK-обновление проверяет источник, размер и контрольную сумму');
ok(JSON.parse(fs.readFileSync('package.json', 'utf8')).version === VER,
  'версия в package.json совпадает с APP_VERSION (иначе ПК-сборка вечно «видит» обновление)');

console.log('\n[8] Контент про друзей');
const cnt=fs.readFileSync('src/core/content.ts','utf8');
for(const id of ['lyoha','vanya','maks','seryoga','artyom','radomir','kudrya','shitov'])
  ok(cnt.includes(`id: "${id}"`),`друг ${id} есть в игре`);
/*
 * Число игр больше не зашито: оно считается из GameId и растёт с каждой
 * новой игрой. Раньше здесь стояло «27», и добавление игры валило три
 * проверки подряд, хотя код был верным.
 */
const GAME_COUNT = (fs.readFileSync('src/core/types.ts','utf8')
  .match(/export type GameId =([\s\S]*?);/)[1].match(/"/g).length) / 2;
ok((cnt.match(/unlockLvl: 0/g)||[]).length===GAME_COUNT,
  `все ${GAME_COUNT} мини-игр открыты сразу`);
const sav=fs.readFileSync('src/core/save.ts','utf8');
ok(/unlockedGames = ALL_GAMES\.slice\(\)/.test(sav)&&/ALL_GAMES: GameId\[\]/.test(sav),'старые сохранения тоже получают все игры');
ok(sav.includes('if (!have.has(f.id))'),'новые друзья досыпаются в старые сохранения');
ok(fs.existsSync('src/games/ArtyomBite.tsx'),'мини-игра «Зубы Артёма» есть');
ok(fs.existsSync('src/games/ShitovRun.tsx'),'мини-игра «Побег от Шитова» есть');
const app=fs.readFileSync('src/App.tsx','utf8');
ok(app.includes('<ArtyomBite')&&app.includes('<ShitovRun'),'новые игры подключены');
const brn=fs.readFileSync('src/games/BurgerRain.tsx','utf8');
// Темп задан временем полёта, а не множителем скорости: снаряд обязан
// лететь дольше порога человеческой реакции (250+120+220 = 590 мс).
ok(/fallMin/.test(brn)&&/fallMax/.test(brn),'темп еды задан временем полёта, а не «скоростью»');
ok(/fallMin: 820/.test(brn),'даже на «аду» остаётся запас на реакцию');
ok(/speedForTime/.test(brn)&&/gravForTime/.test(brn),'скорость и ускорение выводятся из времени полёта');
ok(/HERO_OMEGA/.test(brn)&&/heroStep/.test(brn),'герой ведётся пружиной — не трясётся');
ok(/PARA_FALL/.test(brn)&&/Купол/.test(brn),'бонус спускается на парашюте');
ok(brn.includes('drawHead(ctx, look'),'человечек меняется вместе с героем');
const stg=fs.readFileSync('src/pages/Settings.tsx','utf8');
ok(stg.includes('t.me/kayorisan'),'есть ссылка на автора');
const wfl=fs.readFileSync('.github/workflows/build-apk.yml','utf8');
// Файл должен быть именно в индексе git: он был в .gitignore, из-за чего
// сборка падала на «capacitor.config.json not found».
ok(execSync('git ls-files capacitor.config.json').toString().trim()!=='','capacitor.config.json закоммичен, а не игнорируется');
const cap=JSON.parse(fs.readFileSync('capacitor.config.json','utf8'));
ok(cap.appId==='com.chubgames.app','package id прежний — обновление встанет поверх');
ok(cap.plugins?.BackgroundRunner?.src==='runners/update-check.js','фоновая проверка обновлений настроена');
ok(fs.existsSync('public/runners/update-check.js'),'скрипт фоновой проверки на месте');
ok(fs.existsSync('dist/runners/update-check.js'),'скрипт фоновой проверки попал в сборку');
ok(wfl.includes('POST_NOTIFICATIONS'),'разрешение на уведомления прописано');
ok(wfl.includes('background-runner/android/src/main/libs'),'нативная библиотека фонового движка подключена к Gradle');
ok(!wfl.includes('npx cap init'),'cap init убран — конфиг лежит в репозитории');
const wn=fs.readFileSync('src/ui/WhatsNew.tsx','utf8');
ok(wn.includes('seenVersion'),'экран «что обновилось» помнит показанную версию');
const chg=fs.readFileSync('src/core/changelog.ts','utf8');
ok(chg.includes(`"${VER}"`),'в списке изменений есть текущая версия');
const upb=fs.readFileSync('src/ui/UpdateBanner.tsx','utf8');
ok(upb.includes('ProgressLine')&&!upb.includes('ProgressRing'),'загрузка обновления — полноэкранная, с полосой прогресса');
const dd=fs.readFileSync('src/games/DormDefense.tsx','utf8');
ok(dd.includes('SPEED_BASE')&&dd.includes('0.000167'),'оборона: враги ускорены');
ok(dd.includes('bestCombo'),'оборона: серия ударов множит очки');


console.log('\n[9] Пакет доработок');
const nav=fs.readFileSync('src/components/Nav.tsx','utf8');
/*
 * Раньше тут было «нижнее меню непрозрачное». Теперь на телефоне меню —
 * стекло с преломлением (просьба игрока: жидкое стекло, как в iOS), и требование
 * переформулировано так, чтобы защита не пропала: плотная подложка обязана
 * оставаться в лёгком режиме и на WebView без backdrop-filter, иначе надписи
 * начнут тонуть в фоне — ровно та причина, по которой меню делали глухим.
 */
const css9pre=fs.readFileSync('src/index.css','utf8');
ok(nav.includes('m-nav-bar') && /\.m-nav-bar \{[^}]*backdrop-filter/.test(css9pre),
  'нижнее меню — стекло с преломлением');
ok(/\.m-nav-bar \{[^}]*background: color-mix\(in srgb, var\(--nav-bg\) 6\d%/.test(css9pre),
  'подложка меню полупрозрачная, но плотная: 60+ % цвета фона');
ok(/html\.low-fx:not\(\.is-desktop\) \.m-nav-bar \{[\s\S]{0,160}background: var\(--surface-2\)/.test(css9pre),
  'в лёгком режиме меню снова глухое');
ok(/@supports not \(\(backdrop-filter/.test(css9pre) && /\.glass \{\s*background: var\(--surface\)/.test(css9pre),
  'в WebView без backdrop-filter стекло становится плотным, а не прозрачным');
ok(!nav.includes('glass-strong'),'меню не плодит второй слой стекла поверх своего');
const css9=fs.readFileSync('src/index.css','utf8');
ok((css9.match(/--nav-bg:/g)||[]).length>=2,'цвет меню задан для обеих тем');
const mrg=fs.readFileSync('src/games/MergeHeads.tsx','utf8');
ok(mrg.includes('var(--surface-2)'),'тайлы MergeHeads видимые');
ok((cnt.match(/price: 0/g)||[]).length>=5,'бесплатных тем минимум 5');
ok(/radomir/.test(cnt)&&/FF9FD6/i.test(cnt),'розовая тема Радомира есть');
ok(fs.existsSync('src/games/RadomirBeat.tsx'),'игра про Радомира есть');
ok(fs.existsSync('src/core/music.ts'),'трек для ритм-игры синтезируется офлайн');
ok(app.includes('<RadomirBeat'),'игра Радомира подключена в App');
const clk=fs.readFileSync('src/games/Clicker.tsx','utf8');
ok(clk.includes('clickerStage')&&clk.includes('wings'),'внешность в кликере растёт с тапами');
ok(fs.existsSync('src/core/nav.ts')&&app.includes('pushBack'),'системный свайп «назад» поддержан');
ok(fs.existsSync('src/core/netcheck.ts')&&fs.existsSync('src/pages/Network.tsx'),'проверка глушилок — отдельная страница');
const nc=fs.readFileSync('src/core/netcheck.ts','utf8');
ok(nc.includes('measureSpeed')&&/gosuslugi|yandex/.test(nc),'глушилки: есть российские хосты и спидтест');
ok(fs.existsSync('src/core/i18n.ts'),'локализация RU/EN есть');
const st=fs.readFileSync('src/core/store.tsx','utf8');
ok(st.includes('makeT'),'перевод подключён в стор');
ok(fs.existsSync('src/ui/UpdateBanner.tsx')&&app.includes('<UpdateBanner'),'автопроверка обновлений при запуске');
ok(fs.existsSync('src/ui/GameIcon.tsx'),'иконки игр векторные, без эмодзи');
const home=fs.readFileSync('src/pages/Home.tsx','utf8');
ok(home.includes('GameTile')&&home.includes('onOpenProfile'),'плитки игр вынесены в GameTile, уровень ведёт в статистику');
ok(!fs.existsSync('src/pages/AiPage.tsx')&&!fs.existsSync('src/core/ai.ts'),'режим ИИ удалён по просьбе пользователя');
const bite=fs.readFileSync('src/games/ArtyomBite.tsx','utf8');
ok(bite.includes('"rules"'),'у «Зубов Артёма» есть экран правил');
const run=fs.readFileSync('src/games/ShitovRun.tsx','utf8');
ok(run.includes('gap')&&!/chase\b(?!X)/.test(run.split('gap')[0]),'в побеге показывается реальный отрыв от Шитова');
const head=fs.readFileSync('src/core/head.ts','utf8');
ok(head.includes('clip()'),'борода не вылезает за лицо');

// --- пакет из 22 требований ---
const net=fs.readFileSync('src/pages/Network.tsx','utf8');
ok(net.includes('ГЛУШИЛКИ')&&net.includes('СКОРОСТЬ'),'в сетевом экране две вкладки');
ok(net.includes('РОССИЙСКИЕ СЕРВИСЫ')&&net.includes('ЗАРУБЕЖНЫЕ СЕРВИСЫ'),'сервисы разделены на РУ и иностранные');
const setg=fs.readFileSync('src/pages/Settings.tsx','utf8');
ok(setg.includes('showSaveFilePicker'),'экспорт сохранения через «Сохранить как»');
// Цвета сложности переехали на токены дизайн-системы (--ok/--warn/--danger),
// хексы в компонентах больше не держим.
ok(setg.includes('DiffPicker') && /color:\s*"(var\(--|#)/.test(setg), 'сложность с цветным свечением');
ok(!setg.includes('<NetCheck')&&!setg.includes('<AiChat'),'тяжёлые режимы вынесены из настроек');
const frn=fs.readFileSync('src/pages/Friends.tsx','utf8');
ok(frn.includes('!f.builtin')&&frn.includes('bossStats'),'редактор только для своих, статы работают');
const sv=fs.readFileSync('src/core/save.ts','utf8');
ok(sv.includes('bossStats')&&sv.includes('offlineBonus'),'статы босса влияют на экономику');
ok(fs.readFileSync('src/core/head.ts','utf8').includes('look.braces'),'у Артёма есть брекеты');
const gl=fs.readFileSync('src/ui/Glass.tsx','utf8');
ok(gl.includes('minHeight: minH')&&gl.includes('Unbounded'),'кнопки с отступами и фирменным шрифтом');

// --- пять новых мини-игр ---
for (const [f,n] of [['BurgerStack','Башня Лёхи'],['Canteen','Столовка'],['WhoWasIt','Кто это был'],['RadomirFlight','Полёт Радомира'],['DormDefense','Оборона общаги']])
  ok(fs.existsSync(`src/games/${f}.tsx`)&&app.includes(`<${f}`),`новая игра «${n}» подключена`);
ok(fs.readFileSync('src/core/types.ts','utf8').includes('"stack"'),'новые игры есть в GameId');


console.log('\n[16] Язык, боссы, режимы, кейсы');
const i18n=fs.readFileSync('src/core/i18n.ts','utf8');
ok(i18n.includes('export function tr('),'есть глобальная функция перевода');
const enTxt=fs.readFileSync('src/core/i18n-en.ts','utf8');
const enKeys=(enTxt.match(/^\s{2}"(?:[^"\\]|\\.)+":/gm)||[]).length;
ok(enKeys>300,`английский словарь заполнен (${enKeys} строк)`);
const uiFiles=['src/pages/Home.tsx','src/pages/Progress.tsx','src/pages/Shop.tsx','src/pages/Friends.tsx','src/pages/Casino.tsx','src/pages/Settings.tsx','src/games/shell.tsx'];
let wrapped=0;
for(const f of uiFiles) wrapped+=(fs.readFileSync(f,'utf8').match(/tr\("/g)||[]).length;
ok(wrapped>200,`интерфейс обёрнут в перевод (${wrapped} строк)`);
const hm=fs.readFileSync('src/pages/Home.tsx','utf8');
ok(hm.includes('СЛЕДУЮЩИЙ БОСС'),'карточка боссов видна всегда, с таймером до следующего');
ok(!hm.includes('▶'),'эмодзи-стрелка заменена на SVG');
const md=fs.readFileSync('src/core/modes.tsx','utf8');
ok(md.includes('survivalMult')&&md.includes('SPRINT_MS'),'добавлены режимы «Выживание» и «Спринт»');
ok(md.includes('Math.min(cleared, 12)'),'множитель выживания ограничен сверху');
const mp=fs.readFileSync('src/ui/ModesPanel.tsx','utf8');
ok(mp.includes('startSurvival')&&mp.includes('startSprint'),'новые режимы выведены на главную');
const shp=fs.readFileSync('src/pages/Shop.tsx','utf8');
ok(/transition: transform 2\.[0-9]s cubic-bezier/.test(fs.readFileSync('src/index.css','utf8')) && !/nearEnd/.test(shp),
  'у кейса длинное честное торможение ленты, без «мелкой тряски экрана»');
ok(!/conic-gradient/.test(shp) && !/Искры вокруг легендарки/.test(shp),
  'вращающихся лучей и искр в вскрытии больше нет — «мультяшность» убрана');
ok(shp.includes('SHOP_TABS'),'вкладки магазина крупные, с иконками');
ok(shp.includes('activeTab.title'),'видно, в каком разделе магазина находишься');
ok(shp.includes('CASE_SKIN'),'кейсы различаются по виду');
ok(!/setFlash/.test(shp) && /pc-pack-sweep/.test(shp),
  'полноэкранной вспышки нет: один спокойный проход света по ленте');

/* ── [17] Спорт-игры ── */
console.log('\n[17] Спорт-игры');
for (const [file, label] of [
  ['src/games/Basket.tsx', 'баскетбол'],
  ['src/games/Volley.tsx', 'волейбол'],
  ['src/games/Penalty.tsx', 'пенальти'],
  ['src/games/Pool.tsx', 'бильярд'],
]) {
  const src = fs.readFileSync(file,'utf8');
  ok(src.length > 2000, `${label}: игра написана`);
  ok(src.includes('onPointerMove'), `${label}: управление ведением пальца`);
  ok(src.includes('GameOver'), `${label}: есть экран итогов`);
}
const sv17 = fs.readFileSync('src/core/save.ts','utf8');
for (const g of ['basket', 'volley', 'penalty', 'pool']) {
  ok(sv17.includes(`"${g}"`), `${g} попал в ALL_GAMES — откроется и в старых сохранениях`);
}
const bsk = fs.readFileSync('src/games/Basket.tsx','utf8');
ok(bsk.includes('0.28 + power * 1.67'), 'сила броска совпадает с линией прицела');
ok(!/[\u{1F300}-\u{1FAFF}]/u.test(bsk + fs.readFileSync('src/games/Pool.tsx','utf8')), 'в спорт-играх нет эмодзи');

/* ── [18] Главный экран, босс, обновления ── */
console.log('\n[18] Главный экран и обновления');
const home18 = fs.readFileSync('src/pages/Home.tsx', 'utf8');
ok(!home18.includes('Продолжить'), 'огромная плашка «Продолжить» убрана');
ok(home18.includes('БОСС ПОЯВИЛСЯ'), 'на главной большая карточка босса');
ok(home18.includes('nextBoss'), 'видно, кто заступит следующим');
ok(!home18.includes('ModesPanel'), 'режимы и испытание убраны с главной');
ok(fs.readFileSync('src/pages/Progress.tsx', 'utf8').includes('ModesPanel'),
  'режимы и испытание переехали в «Прогресс»');
// Сетка игр рисуется из sortedGames (закреплённые сверху + сортировка),
// раньше это был прямой GAME_META.map.
ok(home18.indexOf('Сводка') === -1 || home18.indexOf('Stat icon') < home18.indexOf('sortedGames.map'),
  'сводка поднята над сеткой игр');
ok(home18.includes('sortedGames') && home18.includes('favGames'),
  'игры можно закрепить и отсортировать');
ok(fs.readFileSync('src/ui/Glass.tsx', 'utf8').includes('onLongPress'),
  'у кнопок есть долгое нажатие');
ok(fs.readFileSync('src/pages/Home.tsx', 'utf8').includes('ChestCard'),
  'ежечасный сундук на главном экране');
ok(fs.readFileSync('src/core/mastery.ts', 'utf8').includes('masteryBonus'),
  'мастерство игр влияет на награду');
ok(fs.readFileSync('src/core/friendship.ts', 'utf8').includes('STORY_TIERS'),
  'у друзей есть истории по уровням дружбы');

/*
 * Поиск и фильтр игр. Раньше на главной висел ряд из четырёх чипов
 * сортировки, поиска не было вовсе, а фильтровать предлагалось по два
 * десятка разрозненных тегов.
 */
const gfSrc = fs.readFileSync('src/ui/GameFilter.tsx', 'utf8');
ok(gfSrc.includes('placeholder={tr("Найти игру")}'), 'есть поиск по играм');
ok(gfSrc.includes('CATEGORIES'), 'игры сгруппированы в категории');
ok(fs.readFileSync('src/pages/Home.tsx', 'utf8').includes('GameFilter'),
  'панель поиска подключена на главной');
// каждая игра должна попадать хотя бы в одну категорию, иначе её не найти
{
  const cats = [...gfSrc.slice(gfSrc.indexOf('CATEGORIES'), gfSrc.indexOf('const SORTS'))
    .matchAll(/tags: \[([\s\S]*?)\]/g)]
    .flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
  const tags = [...fs.readFileSync('src/core/content.ts', 'utf8')
    .matchAll(/tag: "([^"]+)"/g)].map((m) => m[1]);
  const orphan = [...new Set(tags)].filter((t) => !cats.includes(t));
  ok(orphan.length === 0, `все теги игр попадают в категории${orphan.length ? ': нет ' + orphan.join(', ') : ''}`);
}
// Режимы должны быть компактными: не четыре плашки во всю ширину
const mpSrc = fs.readFileSync('src/ui/ModesPanel.tsx', 'utf8');
ok(mpSrc.includes('grid-cols-3'), 'режимы показаны компактной сеткой');
ok(mpSrc.includes('Чем отличаются режимы'), 'у режимов есть пояснение по запросу');

/*
 * Режимы: пять багов из жалобы «режимы багованые».
 */
const md23 = fs.readFileSync('src/core/modes.tsx', 'utf8');
ok(md23.includes('MODE_BLOCKLIST') && md23.includes('"clicker"'),
  'бесконечный кликер исключён из режимов — иначе марафон виснет');
ok(md23.includes('MODE_POOL'), 'режимы берут игры из отфильтрованного пула');
ok(/if \(best <= 0\)/.test(md23),
  'цель выживания в неигранной игре не вырождается в 1 очко');
ok(md23.includes('setInterval') && md23.includes('sprintBest'),
  'у спринта есть собственный таймер завершения');
ok(fs.readFileSync('src/games/shell.tsx', 'utf8').includes('ModeBadge'),
  'во время игры видно активный режим');

/*
 * ПК-ВЕРСИЯ: масштаб, верхняя панель, две зоны на главной, заставка.
 *
 * Проверки здесь — это закрепленный договор, а не формальность:
 * пользователь прямо просил (1) не «жидкое стекло с цветами», а игровую
 * тему чёрный/оранжевый/белый/серый + акценты, (2) слева плитку мини-игр,
 * идущую вниз, справа — сведения, (3) открытие на весь экран с F11-переключателем,
 * (4) нормальную заставку вместо «сжатого бургера».
 * Если это снова уедет в сторону — сборка красная.
 */
const dmain = fs.readFileSync('desktop/main.cjs', 'utf8');
ok(!/maxWidth:/.test(dmain), 'ширина окна ПК больше не ограничена');
ok(dmain.includes('preload.cjs'), 'preload подключен к окну');
ok(dmain.includes('update:check') && dmain.includes('update:download'),
  'ПК умеет проверять и ставить обновление сам');
ok(dmain.includes('win:toggleFullscreen') && dmain.includes('win:resize'),
  'окном можно управлять из игры');
ok(/setFullScreen\(/.test(dmain) && dmain.includes('window.json'),
  'ПК стартует полноэкранным и помнит выбор окна');
const pre = fs.readFileSync('desktop/preload.cjs', 'utf8');
ok(!/require\("(?!electron)/.test(pre),
  'preload не тянет модули, недоступные в песочнице');
ok(pre.includes('toggleFullscreen'), 'из игры полный экран переключается через мост');
const stg23 = fs.readFileSync('src/core/stage.ts', 'utf8');
ok(stg23.includes('autoScale') && stg23.includes('computeScale'),
  'крупность интерфейса на ПК подстраивается под окно');

// ПК-версия больше не «телефон по центру монитора» и не боковая панель:
// интерфейс альбомный, разделы — в верхней панели.
const cssPc23 = fs.readFileSync('src/index.css', 'utf8');
ok(cssPc23.includes('.pc-home') && cssPc23.includes('grid-template-columns'),
  'на ПК главный экран раскладывается альбомно');
ok(!cssPc23.includes('--stage-scale'),
  'телефонная сцена по центру монитора убрана');
ok(!fs.existsSync('src/ui/PcSidebar.tsx') && fs.existsSync('src/ui/pc/PcTopBar.tsx'),
  'боковая панель убрана, разделы переехали в верхнюю');
const topbar = fs.readFileSync('src/ui/pc/PcTopBar.tsx', 'utf8');
ok(topbar.includes('CHUBUGAMES') && topbar.includes('F11'),
  'в панели есть знак, кошелёк и подсказка по клавишам');
ok(topbar.includes('"progress"') && topbar.includes('"settings"'),
  'панель переключает все пять разделов');
ok(/html\.is-desktop \.pc-home \{[\s\S]{0,320}?grid-template-columns:\s*minmax\(0, 1fr\);/.test(cssPc23),
  'главная на ПК — одна колонка во всю ширину (правая «колонка сведений» убрана)');
ok(/\.pc-hero[\s\S]{0,220}?minmax\(0, 1fr\) 15\.5rem/.test(cssPc23),
  'баннер босса и сундук — одна линия: баннер тянется, сундук в своей узкой колонке');
ok(cssPc23.includes('.pc-tiles') && /repeat\(auto-fill,\s*minmax\(15\.5rem/.test(cssPc23),
  'плитка мини-игр считается от ширины окна, а не растягивается');
ok(/\.pc-games \{\s*display: contents;/.test(cssPc23) && /html\.is-desktop \.pc-games \{\s*display: block;/.test(cssPc23),
  'телефон и ПК делят одну разметку: контейнер пустой до медиа-условия');
ok(cssPc23.includes('.pc-play-wrap') && cssPc23.includes('.pc-play'),
  'игра на ПК оформлена как экран устройства по центру');
ok(home.includes('GameTile') && home.includes('onOpenProfile'),
  'уровень кликабельный, ведёт в статистику');

// заставка: одна на оба интерфейса, размер — от окна
const boot = fs.readFileSync('src/ui/BootScreen.tsx', 'utf8');
ok(!fs.existsSync('src/ui/PcBoot.tsx'),
  'двух разных заставок (телефонной и ПК) больше нет');
ok(boot.includes('BURGER_PATHS') && boot.includes('SplashMark'),
  'заставка собирает знак из тех же путей, что и иконка');
ok(boot.includes('Sparks') && boot.includes('isLowFx'),
  'на слабом железе заставка без частиц');
ok(/font-size:\s*clamp\(1\.85rem,\s*4\.6vw/.test(cssPc23),
  'название на заставке масштабируется от окна, а не вписано в 340 px');
ok(boot.includes('STAGES') && boot.includes('maxMs'),
  'у заставки есть реальные стадии и потолок длительности');

// бренд и темы
ok(fs.existsSync('branding/logo.svg') && fs.existsSync('branding/mark.svg')
  && fs.existsSync('branding/mark-mono.svg'),
  'векторный знак лежит в репозитории');
const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
ok(pkgJson.scripts && pkgJson.scripts.icons && fs.existsSync('scripts/build-icons.mjs'),
  'все иконки перегенерируются одной командой (npm run icons)');
const brand = fs.readFileSync('src/ui/Brand.tsx', 'utf8');
ok(brand.includes('var(--acc)') && !brand.includes('.png'),
  'знак в интерфейсе — вектор, он красится акцентом темы');
const types23 = fs.readFileSync('src/core/types.ts', 'utf8');
ok(types23.includes('"dark" | "graphite" | "light"'),
  'базовых темы три: чёрный, графит, белый');
const content23 = fs.readFileSync('src/core/content.ts', 'utf8');
ok(content23.includes('#FF7A18') && content23.indexOf('"ember"') < content23.indexOf('"amber"'),
  'акцент по умолчанию — оранжевый «уголёк», он первый в списке');
ok(fs.readFileSync('src/core/save.ts', 'utf8').includes('accent: "ember"'),
  'новый профиль стартует с бесплатного акцента');
ok(cssPc23.includes('html.graphite'),
  'тема «графит» описана в палитре, а не только в настройке');
ok(fs.readFileSync('src/App.tsx', 'utf8').includes('chub:nav'),
  'разделы переключаются с клавиатуры');
// Страницы разделов на ПК: не один длинный столбец, а две колонки,
// вкладки — компактной панелью, читалка — с нормальной длиной строки.
const pagesCss = fs.readFileSync('src/index.css', 'utf8');
ok(/\.pc-cols,[\s\S]{0,30}\.pc-col\s*\{\s*display: contents;/.test(pagesCss),
  'две колонки не трогают телефонную вёрстку (контейнеры display:contents)');
ok(fs.readFileSync('src/pages/Settings.tsx', 'utf8').includes('pc-cols'),
  'настройки на ПК раскладываются в две колонки');
ok(fs.readFileSync('src/pages/Friends.tsx', 'utf8').includes('pc-pal-grid'),
  'персонажи: плитка по три карточки вместо списка');
{
  /* ---------- ПК-интерфейс после разбора придирок (1.25.1) ---------- */
  const bar = fs.readFileSync('src/ui/pc/PcTopBar.tsx', 'utf8');
  ok(!/pc-bar-hint/.test(bar) && !/pc-bar-ver/.test(bar),
    'в панели нет подсказки F11/Esc и номера версии');
  ok(!/id: "boss"|id: "fanfic"|id: "network"/.test(bar),
    'в панели нет кнопок-дублей: босс, фанфики и сеть — на своих местах');
  ok(/onClick=\{\(\) => go\("home"\)\}/.test(bar), 'клик по CHUBUGAMES ведёт на главную');
  ok(/Персонажи/.test(bar) && !/"Друзья"/.test(bar), 'вкладка «Персонажи» вместо «Друзья»');
  ok(/pc-bar-tail/.test(bar), 'Настройки — в правом углу панели');
  ok(/pc-bar-level/.test(bar) && /pc-bar-wallet/.test(bar),
    'уровень с опытом и валюты живут в панели одной строкой');
  ok(/"nav.friends": "Персонажи"/.test(fs.readFileSync('src/core/i18n.ts', 'utf8')),
    'на телефоне вкладка тоже называется «Персонажи»');

  const home = fs.readFileSync('src/pages/Home.tsx', 'utf8');
  ok(/className="pc-hero"/.test(home) && home.indexOf('pc-hero') < home.indexOf('pc-games'),
    'босс и сундук — отдельная линия над библиотекой, а не карточка в колонке');
  ok(/\bboss2\b/.test(home) && /boss2-name/.test(css),
    'баннер босса — тонкая полоса с постером, именем, таймером и входом в бой');
  ok(/ChestCard/.test(home) && /\.chest2-cells/.test(css),
    'ежечасный сундук — карточка с ячейками накопления, а не полоска');
  /* всё, что дублировало верхнюю панель или уехало в неё, не должно вернуться */
  /* Всё, что дублировало верхнюю панель или уехало в неё, не должно
     вернуться на главную. Сморим на классы и вызовы, а не на слова: в
     комментариях как раз объяснено, что именно убрали. */
  for (const [re, what] of [
    [/\bStat\b|pc-head-stats/, 'строка «уклонов, тапов и монет всего»'],
    [/readGamble\(\)/, 'кошелёк казино на главной'],
    [/AdModal/, 'карточка рекламы в колонке'],
    [/FanficCard|fanfic-feed/, 'плашка фанфиков'],
  ]) {
    ok(!re.test(home), `на главной нет лишнего: ${what}`);
  }
  const boost = fs.readFileSync('src/ui/pc/PcBoost.tsx', 'utf8');
  ok(/className="pc-boost"/.test(boost) && /\.pc-boost \{[\s\S]{0,220}?position: fixed/.test(css),
    'бонус за ролик — плашка в углу поверх библиотеки, а не карточка на главной');
  ok(/pc && !game && <PcBoost \/>/.test(fs.readFileSync('src/App.tsx', 'utf8')),
    'плашка буста монтируется один раз на уровне приложения и прячется в игре');
  ok(/id: "casino",\s*label: "Казино",[\s\S]{0,80}?id: "progress"/.test(bar),
    'Казино — в верхней панели перед «Прогрессом»');
  ok(!/className="pc-head"/.test(home) || /html\.is-desktop \.pc-head \{/s.test(css),
    'шапка уровня и монет на ПК скрыта (уровень и кошелёк — в панели)');

  ok(!/^\s*width: min\(34rem/m.test(css) && /html\.is-desktop \.pc-play \{[^}]*width: 100%/s.test(css),
    'игра на ПК занимает всё окно, а не колонку 34rem');
  ok(/html\.is-desktop \.pc-play \{[^}]*transform: translateZ\(0\)/s.test(css),
    'у игрового блока остаётся containing block — оверлеи не разлипаются по окну');

  const set = fs.readFileSync('src/pages/Settings.tsx', 'utf8');
  ok(/className="pc-seg" role="tablist"/.test(set) && /pc-set-item/.test(set),
    'настройки разбиты на вкладки-сегменты (как в Магазине), блоки — ячейки сетки');
  ok(!/pc-blk pc-[ab] pc-r\d/.test(set),
    'в настройках больше нет жёстких строк pc-rN: блоки не наползают, когда один вырастает');
  ok(/sec === "system" && \(/.test(set) && /sec === "screen" && \(/.test(set),
    'каждая группа настроек режется активной вкладкой');
  ok(/pc-foot-ver/.test(set) && /pc-foot-brand/.test(set),
    'внизу настроек: знак по центру, версия в углу');
  ok(!/<div className="pc-col">/.test(set), 'старых колонок pc-col в настройках больше нет');

  const shop = fs.readFileSync('src/pages/Shop.tsx', 'utf8');
  ok(/pc-shop-packs/.test(shop) && /pc-shop-coll/.test(shop),
    'магазин: кейсы плиткой, коллекция списком');
  ok(/pc-skin-fig/.test(shop) && /setReveal/.test(shop),
    'магазин: после покупки скин проявляется на сцене справа');
  ok(/\.pc-pal-grid \{[^}]*repeat\(3, minmax\(0, 1fr\)\)/s.test(css)
    || /html\.is-desktop \.pc-pal-grid \{[^}]*repeat\(3/s.test(css),
    'плитка персонажей на ПК — по три в ряд');
}
ok(['Progress', 'Casino', 'Network'].every((pg) => {
    const t = fs.readFileSync(`src/pages/${pg}.tsx`, 'utf8');
    return t.includes('pc-tabs-row') || t.includes('pc-seg');
  }),
  'ряды вкладок на ПК — панель, а не тянущаяся на всю ширину полоска');

console.log('\n[37] 1.27: общие вкладки, уровень первым, точка награды, казино');
{
  const css37 = fs.readFileSync('src/index.css', 'utf8');
  const prog = fs.readFileSync('src/pages/Progress.tsx', 'utf8');
  const cas37 = fs.readFileSync('src/pages/Casino.tsx', 'utf8');
  const rew = fs.readFileSync('src/core/rewards.ts', 'utf8');
  const bar37 = fs.readFileSync('src/ui/pc/PcTopBar.tsx', 'utf8');

  ok(/\.pc-seg-item\.on \{[\s\S]{0,240}?--acc-hi/.test(css37),
    'сегменты вкладок залиты акцентом так же, как вкладки Магазина');
  ok(prog.includes('className="pc-seg"') && /Достижения/.test(prog) && !/tr\("Ачивки"\)/.test(prog),
    'в Прогрессе вкладки — pc-seg, раздел называется «Достижения», а не «Ачивки»');
  ok(/<LevelHero \/>/.test(prog) && prog.indexOf('<LevelHero />') < prog.indexOf('className="pc-seg"'),
    'уровень — ПЕРВЫЙ блок страницы прогресса, над вкладками');
  ok(/pc-lvlhero-num/.test(css37) && /pc-lvlhero-bar i \{/.test(css37),
    'плитка уровня свёрстана классами: число, полоса опыта, остаток XP');
  ok(/hasLoot/.test(bar37) && /pc-tab-dot/.test(bar37),
    'на вкладке «Прогресс» в верхней панели есть красная точка «есть награда»');
  ok(/export function hasLoot/.test(rew) && /export function dailyState/.test(rew),
    '«есть что забрать» считается в одном месте (core/rewards.ts)');
  ok(/onClick=\{to && !done \?/.test(prog) && /pc-ach-go/.test(prog),
    'незакрытое достижение кликабельно и подписано, в какой режим оно ведёт');
  ok(/function achTarget/.test(prog) && /solid-hit/.test(css37),
    'клик по карточке — с классом-курсором и поддержкой клавиатуры (Card onClick)');

  const tabList = cas37.slice(cas37.indexOf('const TABS'), cas37.indexOf('];', cas37.indexOf('const TABS')));
  ok(/\{ id: "slots",   name: "СЛОТЫ"/.test(tabList) && tabList.indexOf('"slots"') < tabList.indexOf('"farm"'),
    'СЛОТЫ — первая вкладка казино, ферма в конце');
  ok(/className="pc-seg" role="tablist"/.test(cas37),
    'вкладки казино — те же сегменты, что у магазина и прогресса');
  ok(/html\.is-desktop \.pc-chips-bar \{[\s\S]{0,120}?display: flex/.test(css37),
    'шапка «жетоны казино» на ПК — компактная полоса, а не жирная плита');
}
// Магазин: вкладки уехали в левый вертикальный список — ряд чипов сверху
// там выглядел тремя баннерами, а не навигацией.
ok(fs.readFileSync('src/pages/Shop.tsx', 'utf8').includes('pc-shop-nav'),
  'магазин: выбор раздела — вертикальный список слева');
{
  const shop = fs.readFileSync('src/pages/Shop.tsx', 'utf8');
  ok(!/title=\{tr\("МАГАЗИН"\)}\s*right=/.test(shop),
    'магазин: валюта из шапки убрана (она в верхней панели)');
  ok(/pc-skin-stage/.test(shop) && /pc-skin-list/.test(shop),
    'скины: список слева, превью персонажа справа');
}
ok(fs.readFileSync('src/pages/Fanfic.tsx', 'utf8').includes('pc-reader'),
  'читалка фанфиков ограничена по ширине строки');
const glass23 = fs.readFileSync('src/ui/Glass.tsx', 'utf8');
ok(glass23.includes('className = ""') && glass23.includes('pc-page'),
  'Screen умеет свой класс — страницы просят особый режим раскладки');
const wfDesk = fs.readFileSync('.github/workflows/build-desktop.yml', 'utf8');
ok(wfDesk.includes('Remove outdated assets'),
  'сборка ПК чистит устаревшие exe из релиза');
// Публикация и чистка ассетов: порядок важен. Если удалять старые файлы
// ДО загрузки новых, упавшая публикация оставит релиз пустым — и ссылка
// скачивания превратится в 404 для всех.
{
  const order = (txt) => {
    const st = (txt.match(/^      - name: (.+)$/gm) || []).map((l) => l.replace(/^      - name: /, ''));
    return [st.findIndex((n) => /Publish/.test(n)), st.findIndex((n) => /Remove/.test(n))];
  };
  const [a, b] = order(wfDesk);
  ok(a > -1 && b > -1 && a < b, 'на ПК сначала выкладываем exe, потом чистим старые');
  const wfApk = fs.readFileSync('.github/workflows/build-apk.yml', 'utf8');
  const [c, d] = order(wfApk);
  ok(c > -1 && d > -1 && c < d, 'на Android сначала выкладываем APK, потом убираем старое имя');
}
// Плавающие теги latest/desktop обязаны указывать на коммит, из которого
// реально собран файл: иначе страница релиза показывает майский коммит, а
// «Source code (zip/tar.gz)» не соответствует выложенному exe/apk.
{
  const d = fs.readFileSync('.github/workflows/build-desktop.yml', 'utf8');
  const a = fs.readFileSync('.github/workflows/build-apk.yml', 'utf8');
  ok(/Point the floating tag at the built commit/.test(d) && /git\/refs\/tags\/desktop/.test(d),
    'на ПК релизный тег передвигается на собранный коммит');
  ok(/Point the floating tag at the built commit/.test(a) && /git\/refs\/tags\/latest/.test(a),
    'на Android релизный тег передвигается на собранный коммит');
  ok(/--title "PC-сборка \$APP_VER"/.test(d) && /--title "Android-сборка \$APP_VER"/.test(a),
    'оба релиза называются вместе с версией, а не «просто сборка»');
  ok(/gh release edit latest[^\n]*--latest/.test(a),
    'бейдж «Latest» закреплён за Android-сборкой явно');
  ok(!/--draft/.test(d) && !/--draft/.test(a),
    'дата публикации не подделывается проходом через draft: есть риск оставить релиз неопубликованным');
  ok(/Собрано:/.test(d) && /Собрано:/.test(a),
    'в теле обоих релизов есть метка сборки — дата, коммит и номер прогона');
}
ok(wfDesk.includes('sha256sum'),
  'в описании релиза публикуются хеши файлов');
ok(dmain.includes('IS_PORTABLE'),
  'обновление ПК различает portable и установленную версию');

const bf18 = fs.readFileSync('src/pages/BossFight.tsx', 'utf8');
ok(bf18.includes('setWindup'), 'босс замахивается перед ударом');
ok(bf18.includes('blockReady'), 'у блока есть перезарядка');
ok(bf18.includes('rageRef'), 'босс звереет на низком здоровье');
const bs18 = fs.readFileSync('src/core/bosses.ts', 'utf8');
ok(/hp: 6240/.test(bs18) && /hp: 7680/.test(bs18),
  'здоровья боссам добавлено — бой не кончается за 4 секунды');
// Бой перестал быть долблением одной кнопки: зоны удара, парирование,
// оглушение и добивающий приём должны существовать в коде.
const bf19 = fs.readFileSync('src/pages/BossFight.tsx', 'utf8');
ok(bf19.includes('WEAK_MULT') && bf19.includes('weakRef'),
  'у босса открываются слабые места');
ok(bf19.includes('PARRY_WINDOW') && bf19.includes('stunRef'),
  'парирование оглушает босса');
ok(bf19.includes('const special') && bf19.includes('SPEC_PCT'),
  'есть добивающий приём за ярость');
ok(bf19.includes('TAP_CD') && bf19.includes('lastTapRef'),
  'между ударами есть пауза — автокликер не решает');
ok(bf19.includes('BossArena'), 'бой рисуется на арене, а не одной головой');
const ar19 = fs.readFileSync('src/ui/BossArena.tsx', 'utf8');
ok(ar19.includes('drawFighter') && ar19.includes('groundY'),
  'бойцы рисуются целиком и стоят на полу');

const st18 = fs.readFileSync('src/pages/Settings.tsx', 'utf8');
ok(st18.indexOf('settings.update') < st18.indexOf('settings.appearance'),
  'раздел обновления в самом верху настроек');
ok(st18.includes('KAYORISAN'), 'автор указан как KAYORISAN');
ok(st18.includes('saveFileNative'), 'выгрузка сохранения работает на телефоне');
ok(fs.readFileSync('src/core/notify.ts', 'utf8').includes('initNotificationsOnFirstRun'),
  'разрешение на уведомления спрашивается при первом запуске');
ok(fs.readFileSync('src/ui/UpdateBanner.tsx', 'utf8').includes('external'),
  'проверка из настроек открывает тот же полноэкранный экран');
ok(/FRICTION = 0\.9985/.test(fs.readFileSync('src/games/Pool.tsx', 'utf8')),
  'в бильярде шары долетают до пирамиды');

const stg2=fs.readFileSync('src/pages/Settings.tsx','utf8');
ok(stg2.includes('notifyUpdates'),'тумблер уведомлений хранит своё состояние');
const ty=fs.readFileSync('src/core/types.ts','utf8');
ok(ty.includes('notifyUpdates'),'настройка уведомлений есть в типах сохранения');

/* ─────────── [19] Восемь новых игр и оптимизация ─────────── */
console.log('\n[19] Новые игры и производительность');

const sv19 = {
  crossword: 'src/games/Crossword.tsx',
  bus: 'src/games/Bus12.tsx',
  pet: 'src/games/ChubPet.tsx',
  beard: 'src/games/MaksBeard.tsx',
  moto: 'src/games/MotoArtyom.tsx',
  fuel: 'src/games/FuelHunt.tsx',
  hands: 'src/games/KirillHands.tsx',
  europa: 'src/games/Europa.tsx',
};
for (const [id, path] of Object.entries(sv19)) {
  ok(fs.existsSync(path), `игра ${id}: файл на месте`);
}

// Каждая игра обязана быть прописана во всех шести местах, иначе она
// не появится в списке или сломает миграцию сохранения.
const ty19 = fs.readFileSync('src/core/types.ts', 'utf8');
const sav19 = fs.readFileSync('src/core/save.ts', 'utf8');
const cnt19 = fs.readFileSync('src/core/content.ts', 'utf8');
const mod19 = fs.readFileSync('src/core/modes.tsx', 'utf8');
const app19 = fs.readFileSync('src/App.tsx', 'utf8');
for (const id of Object.keys(sv19)) {
  ok(ty19.includes(`"${id}"`), `${id}: есть в GameId`);
  ok(sav19.includes(`${id}: emptyGame()`), `${id}: есть в новом сохранении`);
  ok(new RegExp(`"${id}",`).test(sav19), `${id}: есть в ALL_GAMES (миграция)`);
  ok(cnt19.includes(`id: "${id}" as const`), `${id}: есть в списке игр`);
  ok(new RegExp(`${id}: \\d+`).test(mod19), `${id}: есть цель для испытания`);
  ok(app19.includes(`game === "${id}"`), `${id}: открывается из меню`);
}

// Ни одна игра не должна быть заперта за уровнем.
ok((cnt19.match(/unlockLvl: 0/g) || []).length === GAME_COUNT, `все ${GAME_COUNT} игр открыты сразу`);

// Эмодзи запрещены во всём приложении.
const emo19 = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
for (const [id, path] of Object.entries(sv19)) {
  ok(!emo19.test(fs.readFileSync(path, 'utf8')), `${id}: без эмодзи`);
}

// Оптимизация под слабые телефоны.
const perf19 = fs.readFileSync('src/core/perf.ts', 'utf8');
ok(perf19.includes('canvasScaleCap'), 'есть ограничение плотности пикселей');
ok(perf19.includes('detectWeak'), 'слабый телефон определяется автоматически');
ok(perf19.includes('low-fx'), 'есть облегчённый режим оформления');
const css19 = fs.readFileSync('src/index.css', 'utf8');
ok(css19.includes('html.low-fx'), 'в стилях есть блок облегчённого режима');
ok(/html\.low-fx[\s\S]{0,900}backdrop-filter:\s*none/.test(css19), 'размытие отключается на слабых');
const shell19 = fs.readFileSync('src/games/shell.tsx', 'utf8');
// кап dpr заменён бюджетом пикселей (см. [28]): он учитывает и слабый
// телефон, и огромное окно на слабом компьютере
ok(/renderScale\(/.test(shell19) && !/min\(canvasScaleCap\(\), *dpr\)/.test(shell19),
  'канвас игр учитывает слабое устройство');
const app19b = fs.readFileSync('src/App.tsx', 'utf8');
ok(app19b.includes('applyPerfMode'), 'режим производительности применяется при запуске');
const set19 = fs.readFileSync('src/pages/Settings.tsx', 'utf8');
// Блок «Производительность» убран по просьбе пользователя: режим
// определяется автозамером FPS. Проверяем, что замер остался в App.
const appPerf19 = fs.readFileSync('src/App.tsx', 'utf8');
ok(!set19.includes('writePerfMode') && appPerf19.includes('measurePerfOnce'),
  'производительность определяется автоматически, ручной плашки нет');


console.log('\n[20] Настольные игры: шахматы, шашки, нарды');
const bd20 = {
  chess: 'src/games/Chess.tsx',
  checkers: 'src/games/Checkers.tsx',
  nards: 'src/games/Backgammon.tsx',
};
const ty20 = fs.readFileSync('src/core/types.ts', 'utf8');
const sv20 = fs.readFileSync('src/core/save.ts', 'utf8');
const cn20 = fs.readFileSync('src/core/content.ts', 'utf8');
const md20 = fs.readFileSync('src/core/modes.tsx', 'utf8');
const ap20 = fs.readFileSync('src/App.tsx', 'utf8');
const gi20 = fs.readFileSync('src/ui/GameIcon.tsx', 'utf8');

for (const [id, path] of Object.entries(bd20)) {
  ok(fs.existsSync(path), `${id}: экран игры есть`);
  ok(ty20.includes(`"${id}"`), `${id}: объявлен в GameId`);
  ok(new RegExp(`"${id}"`).test(sv20), `${id}: попадает в старые сохранения`);
  ok(cn20.includes(`id: "${id}"`), `${id}: есть в списке игр`);
  ok(new RegExp(`${id}: \\d+`).test(md20), `${id}: есть цель для испытания`);
  ok(ap20.includes(`game === "${id}"`), `${id}: открывается из меню`);
  ok(gi20.includes(`case "${id}"`), `${id}: своя иконка`);
  const src = fs.readFileSync(path, 'utf8');
  ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src), `${id}: без эмодзи`);
  ok(src.includes('var(--sab)'), `${id}: управление не упирается в нижний край`);
  ok(src.includes('finishGame'), `${id}: результат идёт в общий прогресс`);
}

// Движки правил — отдельные модули, чтобы их можно было тестировать.
for (const f of ['src/core/chess.ts', 'src/core/checkers.ts', 'src/core/backgammon.ts']) {
  ok(fs.existsSync(f), `движок ${f.split('/').pop()} на месте`);
}
const ch20 = fs.readFileSync('src/core/chess.ts', 'utf8');
ok(ch20.includes('castle'), 'шахматы: рокировка реализована');
ok(ch20.includes('ep?'), 'шахматы: взятие на проходе реализовано');
ok(ch20.includes('promo'), 'шахматы: превращение пешки реализовано');
ok(/halfmove >= 100/.test(ch20), 'шахматы: правило 50 ходов');
const ck20 = fs.readFileSync('src/core/checkers.ts', 'utf8');
ok(ck20.includes('hasCapture'), 'шашки: взятие обязательно');
ok(ck20.includes('captureChains'), 'шашки: цепочки взятий');
const bg20 = fs.readFileSync('src/core/backgammon.ts', 'utf8');
ok(bg20.includes('violatesSix'), 'нарды: правило шести');
ok(bg20.includes('headLimit'), 'нарды: ограничение на голову');
ok(bg20.includes('return out.length ? out : raw'), 'нарды: партия не может заклиниться');

// Управление пальцем — пользователь просил вести, а не только тапать.
for (const id of ['chess', 'checkers']) {
  const src = fs.readFileSync(bd20[id], 'utf8');
  ok(src.includes('onPointerMove'), `${id}: фигуру можно вести пальцем`);
  ok(src.includes('touchAction'), `${id}: жесты браузера не мешают`);
}

// Переводы новых строк.
const en20 = fs.readFileSync('src/core/i18n-en.ts', 'utf8');
for (const key of ['ШАХМАТЫ С ШИТОВЫМ', 'ШАШКИ У СТАСА', 'НАРДЫ С АРТУРОМ', 'ВЫВЕСТИ', 'Настольные']) {
  ok(en20.includes(`"${key}":`), `перевод есть: ${key}`);
}


console.log('\n[21] Бильярд по правилам, казино и фриз уведомлений');
const pool21 = fs.readFileSync('src/games/Pool.tsx', 'utf8');
const prul21 = fs.readFileSync('src/core/pool.ts', 'utf8');
ok(fs.existsSync('src/core/pool.ts'), 'правила бильярда вынесены в отдельный модуль');
for (const m of ['solo', 'bot', 'duo']) ok(pool21.includes(`"${m}"`), `бильярд: режим ${m}`);
ok(prul21.includes('lowestOnTable'), 'американка: удар по младшему шару');
ok(prul21.includes('BLACK'), 'восьмёрка: чёрный шар');
ok(prul21.includes('groupCleared'), 'восьмёрка: группы шаров');
ok(prul21.includes('pickShot'), 'бот умеет выбирать удар');
ok(pool21.includes('traceShot'), 'показывается траектория удара');
ok(pool21.includes('IntroRules'), 'бильярд: правила доступны игроку');

// Колесо апгрейда
const wheel21 = fs.readFileSync('src/core/wheel.ts', 'utf8');
ok(fs.existsSync('src/ui/Wheel.tsx'), 'колесо апгрейда есть');
ok(wheel21.includes('WHEEL_RTP'), 'возврат колеса задан явно');
ok(/burn/.test(wheel21) && /win/.test(wheel21), 'у колеса есть выигрышные и сгорающие секторы');
const cas21 = fs.readFileSync('src/pages/Casino.tsx', 'utf8');
ok(cas21.includes('ChipFarm'), 'в казино есть заработок жетонов');
ok(/pc-up-mode[\s\S]{0,400}?ОБЫЧНЫЙ/.test(cas21) && /УСКОРЕННЫЙ/.test(cas21),
  'у апгрейда два явных режима с объяснением (обычный и ускоренный)');
const fx21 = fs.readFileSync('src/core/fx.ts', 'utf8');
ok(fx21.includes('wheelTick'), 'у колеса есть звук вращения');

// Фриз от уведомлений
const st21 = fs.readFileSync('src/core/store.tsx', 'utf8');
ok(st21.includes('const value: Ctx = useMemo'), 'контекст игры мемоизирован');
ok(st21.includes('useToasts'), 'тосты живут в отдельном контексте');
ok(!/toasts, toast, mainFriend/.test(st21), 'список тостов убран из общего контекста');

// Кнопки не съезжают
const shell21 = fs.readFileSync('src/games/shell.tsx', 'utf8');
ok(/onRetry[\s\S]{0,120}center/.test(shell21), 'кнопка «Ещё раз» центрирована');

// Волейбол и вратарь
const vol21 = fs.readFileSync('src/games/Volley.tsx', 'utf8');
ok(vol21.includes('NET_CLEAR'), 'волейбол: удар считается через баллистику');
// Соперник больше не тянется к мячу каждый кадр (так розыгрыш был вечным):
// он получает цель в момент удара игрока и бежит туда с задержкой и ошибкой.
ok(vol21.includes('aiErr') && vol21.includes('aiReact') && vol21.includes('aiTarget'),
  'волейбол: у соперника есть ошибка прицела и задержка реакции');
ok(vol21.includes('flightOk'), 'волейбол: траектория удара проверяется прогоном');
const pen21 = fs.readFileSync('src/games/Penalty.tsx', 'utf8');
ok(pen21.includes('SHOULDER_Y'), 'вратарь: руки крепятся к плечам');


console.log('\n[22] Правила есть в каждой игре');
const rul22 = fs.readFileSync('src/core/rules.ts', 'utf8');
const meta22 = fs.readFileSync('src/core/content.ts', 'utf8');
const ids22 = [...meta22.matchAll(/id: "(\w+)" as const/g)].map((m) => m[1]);
ok(ids22.length === GAME_COUNT, `в игре ${GAME_COUNT} мини-игр (нашли ${ids22.length})`);
for (const id of ids22) ok(new RegExp(`^  ${id}: \\{`, 'm').test(rul22), `${id}: правила описаны`);
ok(fs.existsSync('src/ui/RulesCard.tsx'), 'карточка правил есть');
const shell22 = fs.readFileSync('src/games/shell.tsx', 'utf8');
// Кнопка правил живёт прямо в GameHUD и открывает RulesCard через портал.
ok(shell22.includes('RulesCard') && shell22.includes('setRulesOpen'),
  'кнопка правил встроена в HUD всех игр');
ok(rul22.includes('goal') && rul22.includes('control') && rul22.includes('tips'),
  'у правил есть цель, управление и подсказки');
// правила должны переводиться
const en22 = fs.readFileSync('src/core/i18n-en.ts', 'utf8');
for (const key of ['КАК ИГРАТЬ', 'ЦЕЛЬ', 'УПРАВЛЕНИЕ', 'ВАЖНО']) {
  ok(en22.includes(`"${key}":`), `переведено: ${key}`);
}

console.log('\n[23] Цвета, контраст и читаемость');
const css23 = fs.readFileSync('src/index.css', 'utf8');
// --- честный расчёт контраста, как при подборе палитры ---
const hex23 = (h) => { h = h.replace('#',''); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)); };
const lin23 = (c) => { c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); };
const Y23 = (h) => { const [r,g,b]=hex23(h); return 0.2126*lin23(r)+0.7152*lin23(g)+0.0722*lin23(b); };
const R23 = (a,b) => { const l1=Math.max(Y23(a),Y23(b)), l2=Math.min(Y23(a),Y23(b)); return (l1+0.05)/(l2+0.05); };
// L* — им меряем различимость соседних тёмных поверхностей
const Lstar23 = (h) => { const y=Y23(h); return y<=216/24389 ? y*24389/27 : Math.cbrt(y)*116-16; };
const dL23 = (a,b) => Math.abs(Lstar23(a)-Lstar23(b));
const varOf = (name) => (css23.match(new RegExp('\\'+name+':\\s*(#[0-9a-fA-F]{6})'))||[])[1];
const N = {};
for (const step of ['000','100','200','300','400','600','700','900'])
  N[step] = varOf('--n-'+step);
ok(Object.values(N).every(Boolean), 'нейтральная шкала объявлена целиком');
if (Object.values(N).every(Boolean)) {
  ok(dL23(N['000'],N['100']) >= 3.5, `карточка видна на фоне (dL* ${dL23(N['000'],N['100']).toFixed(1)})`);
  ok(dL23(N['100'],N['200']) >= 3.5, `вложенный блок виден в карточке (dL* ${dL23(N['100'],N['200']).toFixed(1)})`);
  ok(dL23(N['200'],N['300']) >= 3.5, `третья ступень отличается (dL* ${dL23(N['200'],N['300']).toFixed(1)})`);
  ok(R23(N['400'],N['000']) >= 1.5, 'граница кнопки видна на фоне экрана');
  for (const [name, bg] of [['фоне',N['000']],['карточке',N['100']],['блоке',N['200']]]) {
    ok(R23(N['900'], bg) >= 4.5, `основной текст читается на ${name} (${R23(N['900'],bg).toFixed(1)})`);
    ok(R23(N['700'], bg) >= 4.5, `вторичный текст читается на ${name} (${R23(N['700'],bg).toFixed(1)})`);
    ok(R23(N['600'], bg) >= 3.0, `подписи читаются на ${name} (${R23(N['600'],bg).toFixed(1)})`);
  }
}
// Класс кнопки обязан существовать: он уже терялся один раз
for (const cls of ['btn-acc','btn-flat','tag','ico-box'])
  ok(new RegExp('\\.'+cls+'[ ,{:]').test(css23), `класс .${cls} описан в стилях`);
const usedCls = [];
for (const dir of ['src/ui','src/pages','src/games','src/components']) {
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.tsx')) continue;
    const t = fs.readFileSync(dir+'/'+f,'utf8');
    for (const m of t.matchAll(/className="([^"]*)"/g)) usedCls.push(...m[1].split(/\s+/));
  }
}
for (const cls of ['btn-acc','btn-flat'])
  if (usedCls.includes(cls)) ok(new RegExp('\\.'+cls+'[ ,{:]').test(css23), `используемый .${cls} не потерян`);
// Ни одна переменная не должна быть использована без объявления
const declared = new Set([...css23.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(m=>m[1]).concat(['--acc','--acc-soft','--acc-glow','--acc-ink']));
const usedVars = new Set();
const walk23 = (dir) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = dir+'/'+f.name;
    if (f.isDirectory()) walk23(full);
    else if (/\.(tsx|ts)$/.test(f.name))
      for (const m of fs.readFileSync(full,'utf8').matchAll(/var\((--[a-z0-9-]{2,})/gi)) usedVars.add(m[1]);
  }
};
walk23('src');
// `var(--r-${r})` в Glass.tsx — шаблонная строка, а не имя переменной
const undef23 = [...usedVars].filter(v => !declared.has(v) && v !== '--r-');
ok(undef23.length === 0, `нет ссылок на несуществующие цвета${undef23.length?': '+undef23.join(', '):''}`);

console.log('\n[24] Босс дежурит целый час');
const bos24 = fs.readFileSync('src/core/bosses.ts', 'utf8');
ok(/BOSS_WINDOW_MS = BOSS_EVERY_MS/.test(bos24), 'окно боя равно целому часу');
ok(/upcomingBosses/.test(bos24), 'расписание боссов считается наперёд — для уведомлений');

console.log('\n[25] Уведомления по каналам Android');
const nt25 = fs.readFileSync('src/core/notify.ts', 'utf8');
for (const id of ['chub-updates','chub-boss','chub-news'])
  ok(nt25.includes(id), `канал ${id} объявлен`);
ok(/createChannel/.test(nt25), 'каналы реально создаются в Android');
ok(/openSystemNotificationSettings/.test(nt25), 'есть переход в системные настройки уведомлений');
ok(/scheduleBossNotifications/.test(nt25), 'напоминания о боссах планируются локально (без интернета)');
const run25 = fs.readFileSync('public/runners/update-check.js', 'utf8');
ok(/channelId: 'chub-updates'/.test(run25), 'фоновая проверка шлёт уведомление в свой канал');
const set25 = fs.readFileSync('src/pages/Settings.tsx', 'utf8');
ok(/NotifyBlock/.test(set25), 'в настройках отдельные тумблеры уведомлений');

console.log('\n[26] Список изменений внутри приложения');
ok(fs.existsSync('src/ui/ChangelogView.tsx'), 'экран истории версий есть');
const ucr26 = fs.readFileSync('src/ui/UpdateCheckRow.tsx', 'utf8');
ok(/ChangelogView/.test(ucr26), 'история открывается из настроек');
const chg26 = fs.readFileSync('src/core/changelog.ts', 'utf8');
ok(chg26.includes(`"${VER}"`), 'в истории есть текущая версия');

console.log('\n[27] Отсчёт и плашка итогов');
const sh27 = fs.readFileSync('src/games/shell.tsx', 'utf8');
const cd27 = sh27.slice(sh27.indexOf('export function Countdown'));
ok(!/borderRadius: "50%"/.test(cd27) && !/border: "2px solid var\(--acc\)"/.test(cd27),
  'вокруг цифр отсчёта нет колец');
ok(/var\(--surface\)/.test(sh27), 'плашка итогов непрозрачная');
ok(/var\(--surface-2\)/.test(sh27), 'шапка игры непрозрачная');

console.log('\n[28] Производительность на слабом ПК');
const pf28 = fs.readFileSync('src/core/perf.ts', 'utf8');
ok(/export function renderScale/.test(pf28) && /pixelBudget/.test(pf28),
  'разрешение рисования считается из бюджета пикселей, а не из devicePixelRatio');
ok(/renderScale\(r\.width, r\.height\)/.test(sh27) && /setTransform\(scale, 0, 0, scale/.test(sh27),
  'useCanvas берёт буфер из бюджета и рисует в CSS-пикселях');
ok(!/min\(canvasScaleCap\(\), *dpr\)/.test(sh27),
  'канвас больше не разгоняется до dpr на всё окно (главная причина 2–7 FPS)');
ok(/fpsFeed\(now\)/.test(sh27), 'кадры считает цикл игры, отдельного rAF на индикатор нет');
ok(/export function fpsWatch/.test(pf28), 'для игр без канваса есть резервный счётчик кадров');
const app28 = fs.readFileSync('src/App.tsx', 'utf8');
const st28 = fs.readFileSync('src/core/store.tsx', 'utf8');
ok(/pc && game \? null/.test(app28), 'главный экран размонтирован, пока открыта игра');
ok(/!lowFx && !game && <Aurora/.test(app28), 'фоновая аура не рисуется под игрой');
ok(/isPlaying\(\)/.test(st28) && /n >= 5/.test(st28),
  'автодоход во время игры капает, но дёргает React раз в 5 секунд');
ok(/\.page-dormant/.test(css), 'экран под игрой выключен из отрисовки (телефон)');
ok(/html\.is-playing .*animation: none/s.test(css), 'анимации под оверлеем игры остановлены');
ok(/softShadows/.test(sh27) && /defineProperty\(ctx, "shadowBlur"/.test(sh27),
  'в лёгком режиме канвас не платит кадрами за размытые тени');
ok(/export function adaptStep|adaptStep\(fCur/.test(pf28) && /adaptValue/.test(pf28),
  'разрешение подстраивается по кадрам самой игры, а не по догадке при старте');
ok(sh27.indexOf('fpsFeed(now)') < sh27.indexOf('const ctx = c.getContext'),
  'счёт кадров идёт до рисования: смена разрешения не даёт чёрной вспышки');
const hud28 = fs.readFileSync('src/ui/PcHud.tsx', 'utf8');
ok(/<div className={`fps-hud \$\{tone\}`}/.test(hud28) && /fps-hud-worst/.test(hud28),
  'счётчик FPS показывает кадры, миллисекунды и просадки');
ok(/\.fps-hud \{[^}]*pointer-events: none/s.test(css), 'счётчик не перехватывает клики игры');
ok(/fpsHud !== false && <FpsHud/.test(app28) && /fpsHud/.test(set25),
  'FPS включён по умолчанию и выключается в настройках');
ok(/writeQuality/.test(pf28) && /part="perf"/.test(set25),
  'качество картинки — одна ручка в настройках, с замером железа');

console.log('\n[29] Клавиатура и мышь в играх');
const km29 = fs.readFileSync('src/core/keymouse.ts', 'utf8');
// клавиши живут в keymap.ts (их можно переназначить), а слой keymouse.ts
// только спрашивает у него «какое это действие»
const kp29 = fs.readFileSync('src/core/keymap.ts', 'utf8');
for (const [k, n] of [['KeyW','W'],['KeyA','A'],['KeyS','S'],['KeyD','D'],
                      ['ArrowUp','↑'],['ArrowDown','↓'],['ArrowLeft','←'],['ArrowRight','→'],
                      ['Space','пробел'],['Enter','Enter'],['ShiftLeft','SHIFT']])
  ok(km29.includes(k) || kp29.includes(k), `клавиша ${n} работает в играх`);
ok(/export function bind/.test(kp29) && /export function actionFor/.test(kp29),
  'клавишу можно назначить самому, и слой ввода это учитывает');
ok(!/KeyW/.test(km29), 'слой больше не держит хардкод клавиш — иначе настройка игнорировалась бы');
ok(/pointerdown/.test(km29) && /pointerup/.test(km29) && /"click"/.test(km29),
  'пробел шлёт pointerdown/pointerup и click — нажимаются и канвас, и DOM-кнопки');
ok(/!== "CANVAS"/.test(km29), 'на канвасе лишнего клика нет: прицел-перетаскивание не ломается');
ok(/inField\(e\.target\)/.test(km29), 'в полях ввода клавиши остаются вводу');
ok(/window\.addEventListener\("blur"/.test(km29), 'при потере фокуса кнопки сбрасываются (герой не бежит вечно)');
ok(/Math\.min\(64, t - last\)/.test(km29), 'шаг движения не зависит от лагов: дельта клампится');
ok(/s\.settings\.keys === false/.test(app28) && /settings\.keys/.test(set25),
  'управление с клавиатуры отключается тумблером');
ok(/onKeysPtr/.test(pf28 + km29) && /el\.style\.transform/.test(hud28),
  'кольцо курсора ходит без перерисовок React');
ok(/NATIVE_KEY_GAMES/.test(km29) && /handlesKeysNatively\(game\)/.test(app28),
  'игры, которые читают клавиши сами, не получают двойное нажатие');
ok(/translate3d\(\$\{k\.x\}px/.test(hud28),
  'кольцо появляется сразу в точке указателя, а не в углу поля');
ok(/state\.usingKeys = false;/.test(km29),
  'движение мыши снимает клавиатурное кольцо: можно целиться мышью');
ok(/top: calc\(var\(--sat, 0px\) \+ 58px\)/.test(css),
  'счётчик FPS стоит под шапкой игры, а не поверх «рекорда»');

console.log('\n[30] ЧУБУПА УНИВЕРСАЛИС 5: кампания, общий удар, панель, консоль');
{
  const md = fs.readFileSync('src/games/europa/model.ts', 'utf8');
  const eu = fs.readFileSync('src/games/Europa.tsx', 'utf8');
  const css30 = fs.readFileSync('src/index.css', 'utf8');

  ok(fs.existsSync('src/games/europa/model.ts'), 'правила режима вынесены из React в модель');
  ok(/export const LEVELS/.test(md) && (md.match(/^    id: \d+,$/gm) || []).length >= 5,
    'уровней не меньше пяти (1)…');
  ok(!/const LEVELS =/.test(eu), 'UI не держит свою копию карты — уровни в модели');
  ok(/prog \|\| 1/.test(eu) && /prog = Math\.min/.test(eu),
    'прогресс кампании открыт в сохранении: победил — открылся следующий уровень');

  // общий удар несколькими зданиями
  ok(/setStrike\(\)/.test(eu) === false && /useState<number\[\]>\(\[\]\)/.test(eu),
    'удар — список зданий, а не одно «выбранное»');
  ok(/shiftKey.*setStrike|setStrike[\s\S]{0,400}shiftKey/.test(eu) || /e\.shiftKey/.test(eu),
    'Shift+клик добавляет здание в общий удар');
  ok(/strikePower\(provs\.filter\(\(p\) => strike\.includes\(p\.id\)\)\)/.test(eu) && /verdictFor\(srcs/.test(eu),
    'сила удара считается по всем собранным зданиям, а не по последнему клику');
  ok(/froms.length > 1|many: best\.froms\.length/.test(eu + md),
    'множественный удар есть и у игрока, и у ИИ');
  ok(/applyBattleResult/.test(eu) && /applyBattleResult/.test(md),
    'итог боя исполняет модель — у игрока и ИИ один и тот же закон потерь');

  // панель прокачки СПРАВА, консоль СЛЕВА СВЕРХУ, подсказки СЛЕВА снизу
  const side30 = css30.slice(css30.indexOf('.eu-side {'), css30.indexOf('.eu-side::-webkit-scrollbar'));
  /* Панель — наложение, а не колонка flex: именно из-за колонки она «дёргала
     вёрстку», сужая карту на 306 px при каждом выборе здания. */
  ok(/position: absolute/.test(side30) && /right: 10px/.test(side30) && !/flex: 0 0/.test(side30),
    'панель здания — наложение справа: карта не сдвигается при её открытии');
  ok(/\.eu-map \{\s*position: absolute;\s*inset: 0/.test(css30) && !/max-width: min\(100%, 74vh\)/.test(css30),
    'карта растянута на всё свободное место, а не собрана в квадрат по высоте');
  ok(/eu-map[\s\S]{0,7000}<SidePanel/.test(eu), 'в разметке карта идёт до панели: панель справа');
  const con30 = css30.slice(css30.indexOf('.eu-console {'), css30.indexOf('.eu-line {'));
  ok(/left: 8px/.test(con30) && /top: 8px/.test(con30), 'консоль событий — слева сверху');
  ok(/max-width: 5\d%|max-width: 6\d%/.test(con30), 'консоль не перекрывает карту целиком');
  ok(/pointer-events: none/.test(con30), 'консоль не перехватывает клики по карте');
  /* Легенду «твоё/чужое/в ударе» и плашку «КАК ИГРАТЬ» убрали по просьбе:
     они объясняли то, что и так видно в бою, и ели место под картой. */
  ok(!/eu-hints/.test(css30) && !/eu-hints/.test(eu), 'легенды значков снизу больше нет');
  ok(!/eu-how/.test(css30) && !/tr\("КАК ИГРАТЬ"\)/.test(eu), 'плашки «КАК ИГРАТЬ» в выборе уровня больше нет');

  /* Приказ об ударе: собранное войско → клик по цели → плашка у точки нажатия */
  ok(/className="eu-order"/.test(eu) && /setOrder\(\{ \.\.\.at, to: p\.id \}\)/.test(eu),
    'клик по чужому зданию поднимает приказ ровно у точки нажатия');
  ok(/className="eu-order-go"/.test(eu) && /onClick=\{\(\) => attack\(t\.id\)\}/.test(eu),
    'в приказе есть большая кнопка «АТАКОВАТЬ», бьющая по выбранной цели');
  ok(/pickGround/.test(eu) && /mapRef/.test(eu),
    'клик по свободному месту карты тоже отдаёт приказ (ближайшая доступная цель)');
  ok(/className="eu-log/.test(eu) && /\.eu-log \{[\s\S]{0,200}?overflow-y: auto/.test(css30) &&
     /overscroll-behavior: contain/.test(css30),
    'внизу — журнал событий с колёсиком, а не загадочная строка «в ударе»');

  /* Залипание интерфейса после удара — то, из-за чего «дальше ничего не нажимается» */
  ok(/const attack = \(to\?: number\) =>/.test(eu) && /if \(phase !== "play" \|\| battle\) return;/.test(eu),
    'удар принимает цель и не принимает второй удар, пока бой анимируется');
  ok(/\} finally \{[\s\S]{0,160}?setBattle\(null\)/.test(eu),
    'итоги боя исполняются в try/finally: фаза возвращается всегда');
  ok(/if \(phase === "battle" && !battle\) setPhase\("play"\)/.test(eu),
    'есть самовосстановление: "battle" без самого боя больше не вешает интерфейс');

  /* Прокачка: человекочитаемо, а не четыре числа подряд */
  ok(/eu-row-now/.test(eu) && /прокачать до/.test(eu) && /\.eu-row-dots i\.on/.test(css30),
    'в прокачке видно текущий уровень и «прокачать до N» с делениями-потолком');
  ok(/eu-cap-btn/.test(eu), 'панель подписывает, где информация, а где кнопки');
  ok(/onClose=\{\(\) => \{ setSel\(null\); setOrder\(null\); \}\}/.test(eu) &&
     /setSel\(null\);\n      return;/.test(eu),
    'панель здания закрывается: крестик и тап по пустому месту');

  /* FPS в этом режиме — слева: справа стоит панель здания */
  ok(/\.is-europa \.fps-hud \{[\s\S]{0,80}?left:/.test(css30),
    'счётчик кадров в стратегии прижат к левому краю');
  ok(/is-europa/.test(fs.readFileSync('src/App.tsx', 'utf8')),
    'режим стратегии помечен классом на обёртке игры');

  /* Выбор уровня */
  ok(/className="eu-levels2"/.test(eu) && /eu-lvl2-why/.test(eu) && /eu-lvl2-map/.test(eu),
    'уровни — карточки с мини-картой и внятной причиной блокировки');

  /* Плашка итога на ПК — альбомная (претензия «больше и не квадратная») */
  ok(/html\.is-desktop \.go-plate \{[\s\S]{0,120}?grid-template-columns/.test(css),
    'плашка итога на компьютере альбомная: итог слева, награда и кнопки справа');
  ok(/className="go-plate-wrap"/.test(fs.readFileSync('src/games/shell.tsx', 'utf8')),
    'обёртка плашки итога переведена на класс, а не на max-w-sm');

  // производительность режима: никаких размытий иBackdrop-стёкол на карте
  const euCss = (css30.match(/\.eu-[a-z-]+ \{[^}]*\}/g) || []).join('\n');
  ok(!/backdrop-filter|filter:\s*blur/.test(euCss),
    'в стиле режима нет blur и backdrop-filter — карта не должна жечь кадры');
  ok(/will-change: transform/.test(euCss), 'узлы карты анимируются transform-ом');
  ok(/html\.low-fx \.eu-/.test(css30), 'в лёгком режиме декор карты выключается');
  ok(/isLowFx\(\)/.test(eu) && /lowFx \? /.test(eu),
    'анимации боя слушают лёгкий режим: на слабом железе они мгновенные');

  // анимация боя: марш → столкновение → итог
  ok(/motion\.circle/.test(eu) && /eu-dot/.test(eu), 'войска идут точками по полю (SVG, без перерасчёта layout)');
  ok(/eu-clash/.test(eu) && /eu-result/.test(eu), 'есть вспышка столкновения и плашка итога');
  ok(/strike\.includes\(p\.id\)/.test(eu) && /\.eu-road\.queued/.test(css30),
    'дорога заявленного в общий удар здания подсвечивается — очередь удара видно на карте');
  ok(/: 620\)/.test(eu) && /: 980\)/.test(eu) && /: 2300\)/.test(eu),
    'бой разложен по времени: марш, удар, итог');
  ok(/ВЗЯТО|ОТБИЛИСЬ/.test(eu), 'итог назван словами: взято или отбились');

  // оценка опасности чужого здания
  ok(/ПЕРЕВЕС|ОПАСНО|САМОУБИЙСТВО/.test(md), 'вердикт называется словами, а не только числом');
  ok(/eu-warn/.test(eu), 'предупреждение об опасности вынесено в отдельный блок');
  ok(/КТО СМОТРИТ НА ТЕБЯ/.test(eu), 'показано, кто в этот момент может ударить по тебе');

  // у каждого здания своё войско и своя роль
  ok((md.match(/name: "/g) || []).length > 40, 'зданий и уровней много, а не три копии');
  ok((md.match(/ \{ name: "[^"]+", at: \d+, icon:/g) || []).length >= 6, 'рангов не меньше шести');
  ok(/troop:/.test(md) && (md.match(/troop: "/g) || []).length >= 10,
    'у каждого типа здания своё войско и название его «банды»');
  ok(/action: "(reinforce|siege|agitate|sabotage)"/.test(md), 'у зданий есть спецдействия');

  // раунды и сколько получил
  ok(/РАУНД/.test(eu) && /banner/.test(eu), 'сверху показан номер раунда и сколько казны пришло');
  ok(/раундов/.test(eu) && /turns/.test(md), 'остаток раундов виден в панели');

  // ранг
  ok(/rankOf\(glory\)/.test(eu) && /gloryFor\(/.test(md),
    'ранг считается по сумме славы за все партии');
  // клавиши режима
  ok(/for \(const code of codesFor\(act\)\)/.test(eu),
    'ходьба по дорогам берёт клавиши из настроек, а не из хардкода');
  ok(/code === "Space"/.test(eu) && /e\.key === "Enter"/.test(eu),
    'пробел закрывает раунд, Enter бьёт — с клавиатуры играть можно целиком');
  ok(/handlesKeysNatively|europa/.test(fs.readFileSync('src/core/keymouse.ts', 'utf8')),
    'слой клавиш не дублирует ввод в стратегию');
  ok(/n >= 1 && n <= 4/.test(eu) && /recruit\(3\)/.test(eu) && /recruit\(0\)/.test(eu),
    'цифры 1…4 качают здания, 5 и 6 нанимают с клавиатуры');

  // тексты и подписи
  const rules30 = fs.readFileSync('src/core/rules.ts', 'utf8');
  const ru = rules30.slice(rules30.indexOf('europa: {'), rules30.indexOf('europa: {') + 1600);
  ok(/5 уровней|от первого этажа/.test(ru), 'правила описывают кампанию, а не одну карту');
  ok(/Shift\+клик/.test(ru), 'в правилах сказано про общий удар');
  const en30 = fs.readFileSync('src/core/i18n-en.ts', 'utf8');
  for (const k of ['ОТПРАВИТЬ В УДАР', 'КТО СМОТРИТ НА ТЕБЯ', 'СЛЕДУЮЩИЙ РАУНД', 'КАК ИГРАТЬ']) {
    ok(en30.includes(`"${k}":`), `переведено: ${k}`);
  }
}
{
  // переassignирование клавиш: настройка есть, работает через общий слой
  const kmap = fs.readFileSync('src/core/keymap.ts', 'utf8');
  const km30 = fs.readFileSync('src/core/keymouse.ts', 'utf8');
  const st30 = fs.readFileSync('src/pages/Settings.tsx', 'utf8');
  const card = fs.readFileSync('src/ui/KeymapCard.tsx', 'utf8');
  ok(fs.existsSync('src/core/keymap.ts'), 'назначение клавиш вынесено в общий модуль');
  ok(/export function bind/.test(kmap) && /export function unbind/.test(kmap) && /export function resetKeymap/.test(kmap),
    'клавишу можно назначить, снять и всё вернуть');
  ok(/ALWAYS: Record<KeyAction/.test(kmap), 'стрелки, пробел и Shift остаются всегда — потерять управление нельзя');
  ok(/actionFor\(e\.code\)|keyAction\(e\.code\)/.test(km30), 'слой ввода читает настройки, а не хардкод');
  ok(st30.includes('<KeymapCard />'), 'карточка клавиш стоит в настройках');
  ok(/жми любую клавишу/.test(card), 'режим назначения объясняет, что делать');
  ok(/"F12"/.test(card) && /MetaLeft/.test(card),
    'служебные клавиши (Alt, Win, F1…F12) назначать запрещено — можно заклинить систему');
}

console.log('\n[31] Экраны режима собраны по-настоящему (renderToStaticMarkup)');
{
  // Проверка не «поиск подстрок в исходнике», а реальная сборка разметки:
  // esbuild packует Europa.tsx, React рисует его на Node, и мы смотрим, что
  // получилось. Так видно пустой панель, отсутствующий шанс боя и цену,
  // уехавшую в NaN.
  // черновик держим в репозитории (в .tmp-ui-render и под .gitignore-подобным
  // именем): esbuild должен видеть node_modules, а на delete мы не надеемся
  const outDir = path.join(process.cwd(), '.tmp-ui-render');
  fs.mkdirSync(outDir, { recursive: true });
  const entry = path.join(outDir, 'entry.tsx');
  fs.writeFileSync(entry, [
    'import { renderToStaticMarkup } from "react-dom/server";',
    'import React from "react";',
    'import { MapNode, SidePanel, BattleMark, LevelPick } from "../src/games/Europa";',
    'import { freshProvs, LEVELS, fight, verdictFor, rankOf } from "../src/games/europa/model";',
    'const P = (id, over) => Object.assign(JSON.parse(JSON.stringify(freshProvs(LEVELS[id])[0])), over);',
    'export function render() {',
    '  const out = {};',
    '  const ps = freshProvs(LEVELS[1]);',
    '  const me = ps[0], foe = ps.find((x) => x.owner !== "me");',
    '  const res = fight([me], foe, false);',
    '  out.map = renderToStaticMarkup(React.createElement(MapNode, {',
    '    p: me, active: true, queued: true, siegeReady: false, target: false,',
    '    onPick() {}, onQueue() {},',
    '  }));',
    '  out.mine = renderToStaticMarkup(React.createElement(SidePanel, {',
    '    p: me, provs: ps, gold: 120, onBuy() {}, onRecruit() {}, onSpecial() {},',
    '    onToggleStrike() {}, queued: false, onAttack() {}, froms: [], vw: null,',
    '    threats: [], siegeReady: false, play: true,',
    '  }));',
    '  out.foe = renderToStaticMarkup(React.createElement(SidePanel, {',
    '    p: foe, provs: ps, gold: 120, onBuy() {}, onRecruit() {}, onSpecial() {},',
    '    onToggleStrike() {}, queued: false, onAttack() {}, froms: [me],',
    '    vw: verdictFor([me], foe, false), threats: [], siegeReady: false, play: true,',
    '  }));',
    '  out.battle = renderToStaticMarkup(React.createElement(BattleMark, {',
    '    battle: { to: foe.id, froms: [me.id], res, step: 2 }, provs: ps, step: 2, lowFx: false,',
    '  }));',
    '  out.pick = renderToStaticMarkup(React.createElement(LevelPick, {',
    '    unlocked: 2, rank: rankOf(900), glory: 900, onStart() {}, onExit() {},',
    '  }));',
    '  return out;',
    '}',
  ].join('\n'));
  let r31 = null;
  try {
    const esbuild = await import('esbuild');
    await esbuild.build({
      entryPoints: [entry],
      outfile: path.join(outDir, 'out.mjs'),
      bundle: true, format: 'esm', platform: 'node', jsx: 'automatic',
      external: ['react', 'react-dom'], logLevel: 'error',
    });
    const g = globalThis;
    g.localStorage = { store: new Map(), getItem(k) { return this.store.get(k) ?? null; }, setItem(k, v) { this.store.set(k, String(v)); }, removeItem(k) { this.store.delete(k); } };
    g.matchMedia = g.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    g.ResizeObserver = g.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
    r31 = (await import(pathToFileURL(path.join(outDir, 'out.mjs')).href)).render();
  } catch (e) {
    ok(false, `экраны режима собраны: ${String(e.message).slice(0, 120)}`);
  }
  if (r31) {
    ok(/eu-node/.test(r31.map) && />8</.test(r31.map) && /eu-node-army/.test(r31.map),
      'узел карты показывает название здания и его войско');
    ok(/queued/.test(r31.map) && /active/.test(r31.map), 'узел умеет выглядеть «выбранным» и «в ударе»');
    ok(/eu-row/.test(r31.mine) && (r31.mine.match(/eu-row /g) || []).length >= 4,
      'панель своего здания даёт все четыре ветки прокачки');
    ok(/НАНЯТЬ|RECRUIT/.test(r31.mine), 'в панели есть наём войска');
    ok(!/NaN|undefined%/.test(r31.mine + r31.foe + r31.map), 'в панели нет NaN и «undefined» — цены и проценты живые');
    ok(/ШАНС|ОDDS|odds/i.test(r31.foe) && /%/.test(r31.foe), 'по чужому зданию показан шанс взятия в процентах');
    ok(/УДАРИТЬ|STRIKE/.test(r31.foe), 'по чужому зданию есть кнопка удара');
    ok(/eu-dot/.test(r31.battle), 'бой рисует точки-отряды');
    ok(/ВЗЯТО|ОТБИЛИСЬ/.test(r31.battle), 'бой показывает итог словами');
    ok((r31.battle.match(/eu-dot/g) || []).length >= 2, 'в удар идёт несколько точек, а не одна');
    ok((r31.pick.match(/eu-lvl/g) || []).length >= 10, `экран выбора уровня показывает все пять уровней`);
    ok(/locked/.test(r31.pick), 'закрытые уровни помечены как закрытые');
  }
  fs.rmSync(outDir, { recursive: true, force: true });
}

console.log('\n[32] Жидкое стекло на телефоне (только мобильная оболочка)');
{
  const css32 = fs.readFileSync('src/index.css', 'utf8');
  const mob = css32.slice(css32.indexOf('ЖИДКОЕ СТЕКЛО НА ТЕЛЕФОНЕ'));
  ok(/html:not\(\.is-desktop\)/.test(mob), 'стеклянная ветка ограничена телефоном: ПК не затронут');
  const blur32 = (mob.match(/--glass-blur:\s*(\d+)px/) || [])[1];
  ok(+blur32 >= 16 && +blur32 <= 32, `радиус преломления в потолке: ${blur32}px (больше — уже минус кадры)`);
  ok(/--glass-sat:\s*1[5-9]\d%/.test(mob), 'стекло насыщает фон (saturate), иначе оно молочное, а не цветное');
  ok(/backdrop-filter: blur\(var\(--glass-blur\)\) saturate\(var\(--glass-sat\)\)/.test(mob),
    'преломление собирается из переменных, а не захардкожено');
  ok(/--r-lg:\s*2\dpx/.test(mob) && /--r-xl:\s*2\dpx/.test(mob),
    'на телефоне скругления крупнее — край под пальцем');
  ok(/::before \{[\s\S]{0,400}linear-gradient\(\s*168deg/.test(mob), 'верхний блик стекла усилен на мобильной ветке');
  ok(/::after \{[\s\S]{0,300}rgba\(0, 0, 0, 0\.1\d\)/.test(mob), 'объём: нижняя тень внутри стекла');
  ok(/--glass-shadow:[^;]*rgba\(0, 0, 0/.test(mob) && /--glass-inset:[^;]*inset 0 1px 0/.test(mob),
    'тень в два слоя + внутренний свет — то, что делает панель объёмной');
  ok(/html\.light:not\(\.is-desktop\)/.test(mob), 'для светлой темы есть свой набор стеклянных переменных');
  ok(/\.pc-page-head h1/.test(mob) && /clamp\(\d+px, \d+\.\d+vw/.test(mob),
    'заголовок страницы на телефоне крупный (big title)');
  ok(/-webkit-overflow-scrolling: touch/.test(mob) && /overscroll-behavior: contain/.test(mob),
    'скролл с инерцией и без «тянучки» за край экрана');
  ok(/body::before \{[\s\S]{0,320}pointer-events: none/.test(mob),
    'верхний свет не перехватывает касания');
  ok(/html\.low-fx:not\(\.is-desktop\)[\s\S]{0,120}--glass-blur: 0px/.test(mob),
    'в лёгком режиме преломление выключается, а радиусы и грани остаются');

  const fr = fs.readFileSync('src/pages/Friends.tsx', 'utf8');
  ok(fr.includes('m-sheet') && fr.includes('m-handle'), 'редактор друга — стеклянный лист снизу с ручкой');
  ok(/spring|stiffness/.test(fr.slice(fr.indexOf('m-sheet') - 700, fr.indexOf('m-sheet'))),
    'лист выезжает пружиной, а не телепортируется');
  const gp = fs.readFileSync('src/ui/Glass.tsx', 'utf8');
  ok(/isDesktop\(\) \? 0\.98 : 0\.955/.test(gp), 'нажатие на телефоне продавливает стекло сильнее');

  const eu32 = fs.readFileSync('src/games/Europa.tsx', 'utf8');
  ok(!/\bPanel\b|glass/.test(eu32), 'стратегия стекло не использует — ей и так тяжело на слабом телефоне');

  const cap32 = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8'));
  ok(cap32.android && /#0D0D10/i.test(cap32.android.backgroundColor),
    'WebView стартует тёмным: вспышка белого при запуске убрана');
  ok(cap32.android.zoomingEnabled === false, 'пинч-зум выключен: он ломает игры на канвасе');

  const patch = fs.readFileSync('scripts/patch-android-glass.mjs', 'utf8');
  ok(fs.existsSync('scripts/patch-android-glass.mjs'), 'правка системных полосок вынесена в скрипт, а не в sed внутри YAML');
  ok(/navigationBarColor/.test(patch) && !/<item name="android:windowBackground"/.test(patch),
    'скрипт красит полоски, но не лезет в тему сплэша (там живёт заставка Capacitor)');
  ok(/идемпотентен|уже наши|уже прозрачные/.test(patch), 'скрипт можно запускать дважды — он не удваивает правки');
  const wf32 = fs.readFileSync('.github/workflows/build-apk.yml', 'utf8');
  ok(/node scripts\/patch-android-glass\.mjs android\/app\/src\/main\/res/.test(wf32),
    'сборка APK вызывает правку полосок');
  ok(wf32.indexOf('patch-android-glass') < wf32.indexOf('gradlew'),
    'полоски красятся до gradle-сборки, иначе правка бы не попала в APK');

  const ver32 = fs.readFileSync('src/core/version.ts', 'utf8');
  const v32 = ver32.match(/APP_VERSION\s*=\s*"([0-9.]+)"/)[1];
  ok(fs.readFileSync('src/core/changelog.ts', 'utf8').includes(`"${v32}"`), `в changelog есть версия ${v32}`);
  ok(fs.readFileSync('RELEASE_NOTES.md', 'utf8').includes('жидкое стекло') ||
     fs.readFileSync('RELEASE_NOTES.md', 'utf8').includes('ЖИДКОЕ СТЕКЛО'), 'в описании релиза есть про жидкое стекло');
  ok(/жидкое\s+стекл/i.test(fs.readFileSync('README.md', 'utf8')), 'README описывает мобильное стекло');
}

console.log('\n[33] Android без ключа подписи: preview вместо сломанного релиза');
{
  const wf = fs.readFileSync('.github/workflows/build-apk.yml', 'utf8');
  ok(/id: signs/.test(wf) && /signed=(true|false)/.test(wf),
    'прогон отдельно определяет, заданы ли секреты подписи');
  ok(/CHUB_ALLOW_UNSIGNED: \$\{\{ steps\.signs\.outputs\.signed == 'true' && '0' \|\| '1' \}\}/.test(wf),
    '«можно ли без ключа» выводится из наличия секретов, а не из «это релиз»');
  ok(/TASK=assembleRelease\n.*signed.*'true'|if \[ "\$\{\{ steps\.kind\.outputs\.release \}\}" = "true" \] && \[ "\$\{\{ steps\.signs\.outputs\.signed \}\}" = "true" \]/.test(wf),
    'assembleRelease только когда ключ есть: без него release-APK всё равно не установить');
  const latestIf = (wf.match(/name: Publish APK to Releases\n\s+if: (.+)/) || [])[1] || '';
  ok(/release == 'true'/.test(latestIf) && /signed == 'true'/.test(latestIf),
    'в канал обновлений latest файл попадает ТОЛЬКО подписанный — иначе у людей ломаются обновления');
  const pv = wf.match(/name: Publish preview APK[\s\S]*?\n      # /);
  ok(pv, 'есть отдельная публикация preview, когда ключа нет');
  ok(pv && /--prerelease/.test(pv[0]) && /-preview\.apk/.test(pv[0]),
    'preview помечен pre-release и называется иначе, чем боевой файл');
  ok(pv && /signed != 'true'/.test(pv[0]),
    'preview публикуется только когда секреты правда не заданы');
  ok(pv && /прогресс сотрётся/.test(pv[0]) && /latest/.test(pv[0]),
    'в тексте preview сказано про потерю прогресса и про то, что latest не тронут');
  ok(/Remove the misspelled legacy asset\n\s+if: .*signed == 'true'/.test(wf),
    'чистка старых файлов тоже только на подписанном релизе');
  ok(/node scripts\/patch-android-glass\.mjs/.test(wf),
    'правка системных полосок стоит в сборке');  {
    // Дубликаты ищем только внутри job `build`: у verify свои шаги, и одинаковые
    // имена в разных джобах — норма. А два upload-artifact с одним именем в
    // одной джобе дают 409 «artifact already exists» и роняют сборку.
    const bi = wf.search(/^ {2}build:$/m);
    const rest = bi >= 0 ? wf.slice(bi) : '';
    const nx = rest.slice(1).match(/^ {2}[A-Za-z][\w-]*:$/m);
    const body = nx ? rest.slice(0, rest.indexOf(nx[0])) : rest;
    const names = (body.match(/^      - name: (.+)$/gm) || []).map((x) => x.replace(/^      - name: /, '').trim());
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    ok(names.length > 20 && dup.length === 0,
      `шаги джобы build не повторяются (шагов ${names.length}${dup.length ? ', дубли: ' + [...new Set(dup)].join(', ') : ''})`);
  }
  const rm = fs.readFileSync('README.md', 'utf8');
  ok(/preview/i.test(rm) && /PASTE-INTO-SECRETS/.test(rm),
    'README объясняет, что делать без ключа и где взять значения');
}

console.log('\n[34] 1.27: цвета, уведомления, пауза, защита от падений, издатель');
{
  const css = fs.readFileSync('src/index.css', 'utf8');
  const store = fs.readFileSync('src/core/store.tsx', 'utf8');
  const theme = fs.readFileSync('src/core/theme.ts', 'utf8');
  const shell = fs.readFileSync('src/games/shell.tsx', 'utf8');
  const desk = fs.readFileSync('src/core/desktop.ts', 'utf8');
  const ov = fs.readFileSync('src/components/Overlays.tsx', 'utf8');
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const mainf = fs.readFileSync('src/main.tsx', 'utf8');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const builder = fs.readFileSync('desktop/builder.yml', 'utf8');

  /* цвет: акцентная кнопка на ПК не должна терять заливку — это и был баг
     «текст не видно»: правило плотности стекла перебивало .glass-acc */
  ok(/html\.is-desktop \.glass\.glass-acc \{[^}]*background:/.test(css),
    'акцентная кнопка на ПК получает свою заливку явно (иначе --acc-ink тонет)');
  ok(/\.glass-acc \{[\s\S]{0,400}?--acc-hi/.test(css),
    'заливка акцента собрана из --acc-hi/--acc-lo, а не захардкоженным миксом');
  ok(!/color: "var\(--n-[45]00\)"/.test(fs.readFileSync('src/pages/Settings.tsx', 'utf8')),
    'ни один текст не закрашен нейтральной ступенью --n-400/--n-500 (контраст < 3)');

  /* тема: чернила и текст считаются из яркости, а не зашиты */
  ok(/export function inkOn/.test(theme) && /export function accentText/.test(theme),
    'core/theme.ts умеет подбирать чернила и читаемый акцентный текст');
  ok(/accentTokens\(acc\.hex/.test(store),
    'store выставляет --acc-* из accentTokens(), а не константами');
  ok(/const MAX_TOASTS = 3;/.test(store) && /\.slice\(-MAX_TOASTS\)/.test(store),
    'уведомления идут очередью: на экране не больше трёх');
  ok(/chub:toastrule/.test(store) && /chub:toastrule/.test(ov),
    'наведение мыши на уведомление откладывает авто-скрытие');
  ok(/toast-stack\.pc/.test(css) && /\.toast-x \{/.test(css),
    'стопка уведомлений живёт в углу и закрывается крестиком');

  /* пауза */
  ok(/isPaused\(\)/.test(shell), 'цикл useCanvas пропускает кадры на паузе');
  ok(/last = now;/.test(shell), 'dt не накапливается: после паузы нет прыжка на полэкрана');
  ok(/Icon name="pause"/.test(shell), 'в шапке игры есть кнопка паузы (на телефоне клавиатуры нет)');
  ok(/toggleEscape/.test(desk) && /isPlaying\(\) && toggleEscape\(\)/.test(desk),
    'Esc внутри игры = пауза, а не мгновенный выход');
  ok(/html\.is-paused \.game-stage/.test(css) && /game-stage/.test(app),
    'на паузе CSS-анимации сцены тоже замирают');
  ok(/<PauseOverlay/.test(app) && /resumeWithCountdown/.test(fs.readFileSync('src/core/pause.ts', 'utf8')),
    'пауза показывает меню с отсчётом 3-2-1');
  ok(/setPauseExitHandler\(game \? \(\) => setGame\(null\) : null\)/.test(app),
    'выход из паузы возвращает в библиотеку и снимает паузу');

  /* защита от падений */
  const bug = fs.readFileSync('src/ui/BugGuard.tsx', 'utf8');
  ok(/getDerivedStateFromError/.test(bug) && /static getDerivedStateFromError/.test(bug),
    'есть ErrorBoundary с экраном падения и двумя действиями');
  ok(/<BugGuard kind="app"/.test(mainf), 'всё приложение под границей — белого экрана не будет');
  ok(/<BugGuard kind="page">/.test(app), 'каждая страница под своей границей');
  ok(/installCrashWatch/.test(app), 'невыловленные reject/error не молчат, а сообщают о себе');
  ok(/\.bug-card \{/.test(css), 'экран падения свёрстан классами, а не инлайн-костылем');

  /* издатель */
  ok(pkg.author && pkg.author.name === 'KAYORISAN',
    'package.json → author.name = KAYORISAN: из него electron-builder берёт Publisher/CompanyName');
  ok(/KAYORISAN/.test(builder) && /uninstallDisplayName/.test(builder),
    'builder.yml подписывает и удаление установки тем же издателем');
  ok(!('"win"' in pkg), 'в package.json нет мёртвого блока win (electron-builder читает desktop/builder.yml)');
}

console.log('\n[35] 1.27: клавиши, светлая тема, лёгкость');
{
  const css = fs.readFileSync('src/index.css', 'utf8');
  /* Мышь + стрелки + WASD одновременно. Игры со «своим» клавиатурным кодом
     обязаны брать клавиши из карты (core/keymap): там стрелки всегда, а
     сравнение по e.key ломается на русской раскладке (KeyA — это «ф»). */
  for (const f of ['src/games/BurgerRain.tsx', 'src/games/MergeHeads.tsx', 'src/games/ShitovRun.tsx']) {
    const t = fs.readFileSync(f, 'utf8');
    ok(/actionFor\(e\.code\)/.test(t) && /core\/keymap/.test(t),
      `${f.split('/').pop()}: клавиши читаются из keymap (стрелки + WASD + свои)`);
    ok(!/e\.key === "Arrow/.test(t),
      `${f.split('/').pop()}: больше нет сверки по e.key (ломалось на не-латинице)`);
  }
  ok(/up: \["KeyW"\], down: \["KeyS"\], left: \["KeyA"\], right: \["KeyD"\]/.test(
    fs.readFileSync('src/core/keymap.ts', 'utf8')),
    'WASD — назначение по умолчанию, а не «если игрок сам проставит»');

  /* Светлая тема: не белое по чёрному */
  ok(/html\.light \{\n[\s\S]{0,600}?--n-100: #fbfbfd/.test(css),
    'светлая тема: фон карточек приглушён, а не чистый #ffffff');
  ok(/--n-900: #23232c;/.test(css),
    'светлая тема: текст #23232c — гало от чистого чёрного убрано');
  ok(/html\.light \.aurora \{[\s\S]{0,60}?opacity: 0\.42/.test(css),
    'светлая тема: декоративный ореол приглушён');

  /* Шрифтовые роли существовали как var(), но не были определены */
  ok(/--font-display: "Unbounded"/.test(css) && /--font-num: "Inter Variable"/.test(css),
    '--font-display и --font-num определены (раньше var() в пустоту)');

  /* Библиотека не должна рисовать то, чего не видно */
  ok(/html\.is-desktop \.pc-tile \{[\s\S]{0,140}?content-visibility: auto/.test(css) &&
     /contain-intrinsic-size/.test(css),
    'плитка библиотеки: content-visibility + contain-intrinsic-size (скролл без лишних отрисовок)');
}

console.log('\n[36] 1.27: кошелёк казино нельзя потерять');
{
  const gm = fs.readFileSync('src/core/gamble.ts', 'utf8');
  const casino = fs.readFileSync('src/pages/Casino.tsx', 'utf8');
  ok(/const KEY_BAK = `\$\{KEY\}\.bak`;/.test(gm),
    'хранилище казино пишется в два ключа: основной + зеркало');
  ok(/function sane\(/.test(gm) && /function parse\(/.test(gm),
    'прочитанное состояние проверяется на пригодность, а не принимается на веру');
  ok(/if \(bak\) \{[\s\S]{0,200}?localStorage\.setItem\(KEY, JSON\.stringify\(bak\)\)/.test(gm),
    'битый основной ключ восстанавливается из зеркала сразу, а не обнуляется');
  ok(/export function updateGamble/.test(gm) && /export type GamblePatch =[\s\S]{0,80}=> Partial<GambleStore>/.test(gm),
    'запись — одна функция read-modify-write по актуальному состоянию');
  ok(/next\.chips = Math\.max\(0, Math\.floor\(next\.chips \|\| 0\)\);/.test(gm) &&
     /if \(typeof n === "number" && n > 0\)/.test(gm),
    'перед записью вычищаются отрицательные жетоны и обнулённые позиции');
  ok(/export function shiftItem/.test(gm),
    'изменение позиции инвентаря — общая функция, а не ручной перебор ключей');
  ok(/const save = useCallback<GambleSave>/.test(casino) && /updateGamble\(patch\)/.test(casino),
    'казино пишет через save() → updateGamble, минуя свой снимок состояния');
  ok(!/writeGamble\(/.test(casino) && !/writeGamble\(/.test(fs.readFileSync('src/ui/ChestCard.tsx', 'utf8')) &&
     !/writeGamble\(/.test(fs.readFileSync('src/pages/BossFight.tsx', 'utf8')),
    'ни один экран не дёргает writeGamble напрямую — иначе записи затирают друг друга');
  /* сам баг: патч, собранный из g внутри таймаута, — это и есть потерянные вещи */
  const stale = casino.match(/save\(\{[^}]*\bg\.(chips|items|battles|won|lost)\b[^}]*\}\)/g) || [];
  ok(stale.length === 0,
    'в save() не передаётся объект, собранный из снимка рендера (stale closure = потерянные вещи)');
  ok(/save\(\(x\) => \(\{[\s\S]{0,220}?items: shiftItem\(x,/.test(casino),
    'приз кейса кладётся в актуальный инвентарь, а не в «g.items двухсекундной давности»');
  ok(/save\(x => \(\{ items: shiftItem\(x, p\.itemId, -1\)/.test(casino) ||
     /items: shiftItem\(x, p\.itemId, -1\)/.test(casino),
    'ставка апгрейда снимается с актуального инвентаря');
}

console.log('\n[38] 1.27: слоты — автомат, а не мигающие плашки');
{
  const css = fs.readFileSync('src/index.css', 'utf8');
  const gm = fs.readFileSync('src/core/gamble.ts', 'utf8');
  const cas = fs.readFileSync('src/pages/Casino.tsx', 'utf8');
  const slots = cas.slice(cas.indexOf('function Slots('), cas.indexOf('/* ═══════════════════════════ КЕЙСЫ'));

  ok(/name: "БУРГЕР"/.test(gm) && /export function symbolName/.test(gm),
    'у каждого символа барабана есть имя, и оно доступно отовсюду (подписи)');
  ok(/const LEN = \[30, 34, 38\]/.test(slots),
    'у барабанов разная длина ленты — они останавливаются по очереди, как в живом автомате');
  ok(/className="pc-slot-strip"/.test(slots) && /translateY\(calc\(var\(--cell\)/.test(slots),
    'лента реально едет (translate по cell), а не мигает сменой иконки');
  ok(/\.pc-slot-reel \{[\s\S]{0,200}?height: calc\(var\(--cell\) \* 3\)/.test(css) &&
     /\.pc-slot-window \{[\s\S]{0,300}?grid-template-columns: repeat\(3/.test(css),
    'в окне видно три строки ленты — «прокрутка» читается глазом');
  ok(/className="pc-slot-cap">\{tr\(symbolName\(sym\)\)\}/.test(slots),
    'под символом в ленте подпись его имени');
  ok(/tr\(sy\.name\)/.test(slots), 'в таблице выплат символы названы, а не только иконки');
  ok(/\.pc-slot-payline \{/.test(css), 'есть линия выплат поперёк окна');
  ok(/setHist\(\(h\) => \[\{ net, sym \}, \.\.\.h\]\.slice\(0, 6\)\)/.test(slots) &&
     /className="pc-slot-hist"/.test(slots),
    'ряд последних исходов виден — полоса результата не единственная подсказка');
  ok(/const net = pay - bet;/.test(slots) && /tone === "win"/.test(slots),
    'окрашивается ЧИСТЫЙ итог (выплата минус ставка), а не «красивый плюс»');
  ok(/save\(\(x\) => \(\{\s*chips: x\.chips - bet \+ pay,/.test(slots),
    'баланс слотов правится от актуального состояния');
  ok(/\.pc-slot\.win \{[\s\S]{0,140}?animation: pcslotwin/.test(css) &&
     /html\.low-fx \.pc-slot\.win \{ animation: none; \}/.test(css),
    'золотая вспышка выигрыша есть, и она выключается в лёгком режиме');
  ok(!/setInterval\(\(\) => \{[\s\S]{0,80}?spinReel\(\)\)\);/.test(slots),
    'нет интервала, который просто подменял иконки каждые 60 мс');
}

console.log('\n[39] 1.27: кейсы как кейсы, вещи можно осмотреть');
{
  const css = fs.readFileSync('src/index.css', 'utf8');
  const cas = fs.readFileSync('src/pages/Casino.tsx', 'utf8');
  ok(/className="pc-case-art"/.test(cas) && /\.pc-case-body \{/.test(css) &&
     /\.pc-case-handle \{/.test(css) && /\.pc-case-lock \{/.test(css),
    'у кейса нарисован чемодан (корпус, ручка, замок, уголки), а не серая иконка');
  ok(/className="pc-cases"/.test(cas) && /\.pc-cases \{[^}]*auto-fill/.test(css),
    'кейсы — сетка карточек на всю ширину, а не три строки друг под другом');
  ok(/\.pc-case-modal \{[^}]*min\(60rem/.test(css) && /\.pc-case-mbody \{[^}]*grid-template-columns/.test(css),
    'модалка кейса широкая и в две колонки (лента + шансы), а не max-w-sm');
  ok(/pc-case-row-pct/.test(cas) && /opening\.odds\[r\] \* 100/.test(cas),
    'шансы показаны числом процентов на каждую редкость, а не только полоской');
  ok(/pc-case-row-names/.test(cas), 'в модалке видно, какие именно вещи могут выпасть');
  /* клик по карточке не должен тратить жетоны */
  ok(/const look = \(c: GambleCase\)/.test(cas) && /const buy = \(c: GambleCase\)/.test(cas),
    'просмотр кейса и покупка — два разных действия');
  ok(!/onClick=\{\(\) => open\(c\)\}/.test(cas) && /onClick=\{\(\) => look\(c\)\}/.test(cas),
    'клик по карточке кейса только смотрит: жетоны снимает кнопка «ОТКРЫТЬ ЗА»');
  ok(/chips: Math\.max\(0, x\.chips - c\.price\)/.test(cas),
    'цена кейса снимается от актуального баланса, ровно один раз');
  ok(/if \(e\.key !== "Escape"\) return;/.test(cas), 'Esc закрывает просмотр кейса');
  ok(/pc-case-cell-name clip1">\{it\.name\}/.test(cas), 'у ячеек ленты есть подписи предметов');
  ok(/className="pc-stuff-hit/.test(cas) && /pc-stuff-modal/.test(cas),
    'вещь можно осмотреть: карточка ведёт в модалку с подробностями');
  ok(/ITEM_KIND_LABEL/.test(cas) && /на голову/.test(cas) && /рядом с героем/.test(cas),
    'у каждого украшения подписано, куда оно надевается');
  ok(/tr\("в наличии"\)/.test(cas), 'в осмотре видно, сколько таких предметов');
  ok(/тот же шанс, быстрее серия/.test(cas) && /\.pc-up-mode\.on/.test(css),
    'обычный и ускоренный режимы подписаны одинаковостью шансов: режим не меняет математику');
  ok(/className="pc-stuff-actions"/.test(cas) && /ПРОДАТЬ/.test(cas) && /НАДЕТЬ/.test(cas),
    'из осмотра можно надеть и продать, не возвращаясь в список');
}

console.log('\n[40] 1.27: кейс-батл понятен, у фермы есть срок и награда');
{
  const css = fs.readFileSync('src/index.css', 'utf8');
  const cas = fs.readFileSync('src/pages/Casino.tsx', 'utf8');
  ok(/className="pc-battle-rule"/.test(cas) && /Вы и соперник по очереди открываете/.test(cas),
    'правила батла объяснены одной строкой прямо на экране настройки');
  ok(/className=\{`pc-battle-case /.test(cas) && /\{x\.name\}/.test(cas),
    'выбор кейса в батле — с названием и ценой, а не голыми числами');
  ok(/className=\{`pc-battle-round \$\{rounds === r \? "on"/.test(cas) && /одна дуэль — всё или ничего/.test(cas),
    'выбор числа раундов подписан: чем отличается 1, 3 и 5');
  ok(/className="pc-battle-sum"/.test(cas) && /на кону/.test(cas) && /средняя ценность/.test(cas),
    'перед боем видно: сколько стоит, что на кону и средняя ценность');
  ok(/className="pc-battle-tug"/.test(cas) && /\.pc-battle-tug \{/.test(css),
    'на табло есть полоса перевеса — кто ведёт, видно без счёта в уме');
  ok(/pc-battle-lead/.test(cas) && /ведёшь ты/.test(cas), 'под табло подписано, кто ведёт');
  ok(/r\.mine\.name/.test(cas) && /r\.foe\.name/.test(cas),
    'в раундах показаны имена предметов, а не только иконки с цифрами');
  ok(/className="pc-battle-record"/.test(cas), 'статистика побед осталась и подписана');

  ok(/pc-farm-rule/.test(cas) && /на один забег, между забегами перерыва нет/.test(cas),
    'у фермы указан срок забега и то, что перерыва между забегами нет');
  ok(/награда — жетоны: они тратятся на кейсы/.test(cas),
    'ферма объясняет, ЧТО за награда и куда она тратится');
  ok(/className="pc-farm-worth"/.test(cas) && /GAMBLE_CASES\[0\]\.price/.test(cas),
    'итог фермы переведён в понятные вещи: сколько кейсов и спинов это');
  ok(/setMaxCombo\(\(v\) => Math\.max\(v, comboRef\.current\)\)/.test(cas) && /макс\. комбо/.test(cas),
    'в итоге фермы виден лучший комбо-множитель забега');
  ok(/onTab\?: \(t: Tab\) => void/.test(cas) && /onTab\("slots"\)/.test(cas),
    'с фермы можно уйти тратить жетоны — ссылка на слоты');
  /* имена классов не должны пересекаться: иначе стиль одной секации лез в другую */
  ok(!/\.pc-battle-side\.me \.pc-battle-sum \{/.test(css) && /\.pc-battle-total \{/.test(css),
    'табло батла использует свои классы и не наследует стиль строки «стоит/на кону»');
}

console.log('\n[41] 1.27: вкладки настроек и полный перевод названий игр');
{
  const css = fs.readFileSync('src/index.css', 'utf8');
  const set = fs.readFileSync('src/pages/Settings.tsx', 'utf8');
  const content = fs.readFileSync('src/core/content.ts', 'utf8');
  const en = fs.readFileSync('src/core/i18n-en.ts', 'utf8');

  ok(/html\.is-desktop \.pc-cols\.pc-set-cols \{[^}]*grid-auto-rows: min-content/.test(css),
    'сетка настроек: auto-строки и align-items: start — плашки не наезжают друг на друга');
  ok(/\.pc-set-item \{[^}]*min-width: 0/.test(css),
    'блоки настроек умеют сжиматься (min-width: 0) — длинные подписки не распирают колонку');
  ok(/html\.is-desktop \.pc-cols > \.pc-set-span \{[^}]*grid-column: 1 \/ -1/.test(css),
    'плашка «Об игре» на всю ширину и по центру');
  ok(/chubgames\.settingsTab/.test(set), 'выбранная вкладка настроек запоминается');
  for (const [id, label] of [['screen', 'Экран'], ['game', 'Игра'], ['profile', 'Профиль'], ['system', 'Система']]) {
    ok(set.includes(`{ id: "${id}", label: "${label}"`), `вкладка настроек «${label}» есть`);
  }

  /* Язык менял «почти всё, кроме названий режимов от Лёхи бургера до Башни
     Лёхи» — проверим это машиной: у КАЖДОЙ строки GAME_META должен быть
     английский вариант в словаре. */
  const i = content.indexOf('export const GAME_META');
  const body = content.slice(i, content.indexOf('\n];', i));
  const missing = [];
  for (const m of body.matchAll(/(?:name|tag|desc): "([^"]+)"/g)) {
    if (!en.includes('"' + m[1] + '":')) missing.push(m[1]);
  }
  ok(missing.length === 0,
    missing.length ? `нет перевода у ${missing.length} строк списка игр: ${missing.slice(0, 3).join(' / ')}`
      : 'названия, теги и описания ВСЕХ мини-игр переведены на английский');
  ok(/Имена друзей и прозвища НЕ переводятся/.test(en),
    'правило перевода задокументировано в шапке словаря (имена собственные — нет, режимы — да)');
}

console.log('\n[42] 1.27: версия, список изменений и перевод идут в одном месте');
{
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const ver = fs.readFileSync('src/core/version.ts', 'utf8');
  const chlog = fs.readFileSync('src/core/changelog.ts', 'utf8');
  const notes = fs.readFileSync('RELEASE_NOTES.md', 'utf8');
  const readme = fs.readFileSync('README.md', 'utf8');
  const m = ver.match(/APP_VERSION = "([^"]+)"/);
  ok(m && m[1] === pkg.version, `APP_VERSION (${m && m[1]}) = версия package.json (${pkg.version})`);
  ok(chlog.includes('"' + pkg.version + '": ['),
    'в CHANGELOG есть запись текущей версии — экран «что нового» покажется сам');
  ok(notes.includes('### Что нового в ' + pkg.version),
    'RELEASE_NOTES начинается с описания текущей версии');
  ok(/1\.27/.test(readme), 'README рассказывает про текущий релиз (дизайн и починки)');
  ok(pkg.author && pkg.author.name === 'KAYORISAN', 'издатель в package.json не потерялся');
  /* телефонная ветка стекла не должна была пострадать от редизайна ПК */
  const css = fs.readFileSync('src/index.css', 'utf8');
  ok(/html\.light:not\(\.is-desktop\)/.test(css),
    'мобильная светлая тема стекла осталась отдельным правилом');
  ok(/html\.is-desktop \.glass \{/.test(css) && /html\.is-desktop \.glass\.glass-acc \{/.test(css),
    'плотность стекла на ПК и возврат залипки акценту живут рядом — правило не перебивает себя');
}

console.log('\n[43] 1.27: магазин — кейсы без свечения, взрослое вскрытие, понятные скины');
{
  const css = fs.readFileSync('src/index.css', 'utf8');
  const shp = fs.readFileSync('src/pages/Shop.tsx', 'utf8');
  const content = fs.readFileSync('src/core/content.ts', 'utf8');
  const cases = shp.slice(shp.indexOf('function Cases()'), shp.indexOf('function Skins()'));
  const skins = shp.slice(shp.indexOf('function Skins()'));

  /* ── свечения за иконками убраны ── */
  ok(!/boxShadow: `0 10px 26px -12px \$\{skin\.ink\}`/.test(cases),
    'за иконкой кейса нет цветного ореола (просили убрать: «выглядит мерзко»)');
  ok(!/linear-gradient\(135deg, \$\{skin\.glow\}/.test(cases),
    'цветная светящаяся подложка под всей карточкой кейса убрана');
  ok(/className="pc-pack-ico/.test(cases) && /\.pc-pack-ico \{[^}]*inset 0 1px 0/.test(css),
    'иконка кейса — плоская металлическая плашка с внутренней кромкой');
  ok(/className="pc-pack-edge"/.test(cases) && /\.pc-pack-edge \{[^}]*height: 2px/.test(css),
    'кейсы различаются узкой цветной линией сверху вместо свечения');
  ok(!/animate=\{\{ y: \[0, -4, 0\] \}\}/.test(cases),
    'иконка кейса не «дышит» вечно — бесконечные петли на витрине убраны');

  /* ── модалка вскрытия ── */
  ok(/className="pc-case-modal"/.test(cases) && /\.pc-case-modal \{[^}]*min\(60rem/.test(css),
    'модалка кейса в магазине — та же широкая оболочка, что в казино');
  ok(/className="pc-case-mhead"/.test(cases) && /pc-case-mx/.test(cases),
    'у модалки есть шапка с названием и крестиком (закрыть можно)');
  ok(/pc-case-row-pct/.test(cases) && /СОДЕРЖИМОЕ/.test(cases),
    'в модалке видно содержимое и шансы числом — пока лента ещё идёт');
  ok(/s\.friends\.filter\(\(f\) => f\.rarity === r\)/.test(cases),
    'список содержимого строится из реального пула карточек, а не на глаз');
  ok(/className="pc-shop-cell/.test(cases) && /pc-shop-cell-name clip1">\{f\.name\}/.test(cases),
    'в ленте у каждой головы есть подпись — лента читается, а не мельтешит');
  ok(!/rotateY: 90/.test(cases) && !/scale: 0\.6/.test(cases),
    'итог не «выпрыгивает» через rotateY/scale — появление мягкое');
  ok(!/repeat: Infinity/.test(cases.slice(cases.indexOf('pc-case-mbody'))),
    'внутри модалки вскрытия нет ни одной бесконечной анимации');
  ok(/requestAnimationFrame\(\(\) => setArmed\(true\)\)/.test(cases),
    'лента трогается на следующем кадре — переход считается от нулевой точки');
  ok(/className="pc-case-ghost"[\s\S]{0,400}?ЕЩЁ РАЗ/.test(cases) && /open\(pack\.id\)/.test(cases),
    'из итога можно открыть тот же кейс ещё раз, не закрывая модалку');
  ok(/html\.low-fx \.pc-pack-sweep \{ display: none; \}/.test(css),
    'в лёгком режиме проход света выключен');

  /* ── скины ── */
  ok(/onClick=\{\(\) => \{ sfx\.tap\(\); haptic\("light"\); setLook\(sk\.id\); \}\}/.test(skins),
    'клик по строке скина только разглядывает: не надевает и не покупает');
  ok(!/disabled=\{!owned && s\.coins < sk\.price\}/.test(skins) && /\.pc-skin-row\.poor \{/.test(css),
    'недоступный скин можно посмотреть — он приглушён, но не выключен');
  ok(/className="pc-skin-facts"/.test(skins) && /SKIN_EFFECT/.test(skins),
    'в витрине подписано, что скин меняет в цифрах и где его видно');
  // карта эффектов объявлена над компонентом — берём из всего файла, а не из среза Skins()
  const eff = shp.slice(shp.indexOf('const SKIN_EFFECT'), shp.indexOf('};', shp.indexOf('const SKIN_EFFECT')));
  for (const id of ['king', 'gold', 'ghost']) {
    ok(new RegExp(id + ': "\\+').test(eff), `эффект скина ${id} описан так же, как он посчитан в коде`);
  }
  ok(/\+8% монет в Burger Rain/.test(content) && !/шанс уклона в Burger Rain/.test(content),
    'описание «Призрака» совпадает с кодом: у него +8% монет, а не «шанс уклона»');
  ok(/autoRate/.test(fs.readFileSync('src/core/save.ts', 'utf8')) && /1\.05/.test(fs.readFileSync('src/core/save.ts', 'utf8')),
    'скины king/gold действительно умножают монеты (подпись не врёт)');
}

console.log('\n[44] 1.27: поддержка — спокойно, на токенах, по-человечески в двух колонках');
{
  const css = fs.readFileSync('src/index.css', 'utf8');
  const don = fs.readFileSync('src/pages/Donate.tsx', 'utf8');
  const donCode = don.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*\/\/[^\n]*/g, '');
  ok(!/rgba\(\s*255,\s*176,\s*32/.test(donCode) && !/255,\s*107,\s*90/.test(donCode) &&
     !/#[0-9a-fA-F]{3,6}/.test(donCode),
    'в поддержке нет вбитых цветов хексами: плашка перекрашивается токенами темы');
  ok(/\.pc-don-hero \{[\s\S]{0,600}?--gold-brd/.test(css) &&
     /\.pc-don-ico \{[\s\S]{0,400}?--gold-soft/.test(css),
    'золото поддержки живёт в CSS переменными, а не строками в разметке');
  ok(!/repeat: Infinity/.test(don),
    'бесконечных «дышащих» циклов на странице нет — экран не жужжит и не ест кадры');
  /* два абзаца раньше были написаны мимо tr() → при английском язык страницы ломался */
  const raw = don.match(/>\s*[А-ЯЁа-яё][^<{]*[а-яё]{3,}[^<>{}]*<\/(div|span)>/g) || [];
  const untranslated = raw.filter((x) => !/\{tr\(/.test(x));
  ok(untranslated.length === 0,
    untranslated.length ? `текст поддержки без tr(): ${untranslated[0].slice(0, 60)}` : 'весь текст поддержки проходит через tr()');
  const en = fs.readFileSync('src/core/i18n-en.ts', 'utf8');
  for (const key of [
    'CHUBUGAMES бесплатный и без обязательной рекламы',
    'Поддержка добровольная и ни на что не влияет в игре',
    'идеи, баги, предложения',
  ]) {
    ok(en.includes(key), `в переводе есть строка поддержки «${key.slice(0, 32)}…»`);
  }
  ok(/className={`pc-don \$\{pc \? "pc-don-wide" : ""\}`}/.test(don) &&
     /\.pc-don\.pc-don-wide \{[\s\S]{0,80}?grid-template-columns/.test(css),
    'на мониторе поддержка — две колонки, а не узкая полоса под левым краем');
  ok(/aria-label=\{tr\("Закрыть"\)\}/.test(don), 'кнопка закрытия поддержки доступна с клавиатуры/скринридера');
}

console.log(fails===0?'\n✅ ВСЕ ПРОВЕРКИ ВЁРСТКИ ПРОЙДЕНЫ\n':`\n❌ ПРОВАЛЕНО: ${fails}\n`);
process.exit(fails?1:0);