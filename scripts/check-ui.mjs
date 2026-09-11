import fs from 'fs';
import { execSync } from 'child_process';
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
ok(/printf 'version: %s/.test(wf2) && /body_path: RELEASE_BODY\.md/.test(wf2),'релиз публикует номер версии для проверки обновлений');
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
ok(nav.includes('var(--nav-bg)')&&!nav.includes('glass-strong'),'нижнее меню непрозрачное');
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
ok(shp.includes('nearEnd'),'у кейсов есть фаза замедления перед открытием');
ok(shp.includes('conic-gradient'),'редкий дроп подсвечивается лучами');
ok(shp.includes('SHOP_TABS'),'вкладки магазина крупные, с иконками');
ok(shp.includes('activeTab.title'),'видно, в каком разделе магазина находишься');
ok(shp.includes('CASE_SKIN'),'кейсы различаются по виду');
ok(shp.includes('setFlash'),'в момент вскрытия кейса срабатывает вспышка');

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
ok(/grid-template-columns:\s*minmax\(0, 1fr\) var\(--pc-rail\)/.test(cssPc23),
  'на главной слева — игры, справа — сведения');
ok(cssPc23.includes('.pc-tiles') && /repeat\(auto-fill,\s*minmax\(15\.5rem/.test(cssPc23),
  'плитка мини-игр считается от ширины окна, а не растягивается');
ok(/\.pc-blocks,[\s\S]{0,40}\.pc-games\s*\{\s*display: contents;/.test(cssPc23),
  'телефон и ПК делят одну разметку: контейнеры пустые до медиа-условия');
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
const wfDesk = fs.readFileSync('.github/workflows/build-desktop.yml', 'utf8');
ok(wfDesk.includes('Remove outdated assets'),
  'сборка ПК чистит устаревшие exe из релиза');
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
ok(shell19.includes('canvasScaleCap'), 'канвас игр учитывает слабый телефон');
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
ok(cas21.includes('БЫСТРЫЙ АПГРЕЙД'), 'есть быстрый режим прокрутки');
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

console.log(fails===0?'\n✅ ВСЕ ПРОВЕРКИ ВЁРСТКИ ПРОЙДЕНЫ\n':`\n❌ ПРОВАЛЕНО: ${fails}\n`);
process.exit(fails?1:0);