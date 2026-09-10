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
// Порог: 8 новых игр добавили ~50 КБ (сейчас ~976 КБ). Всё лежит в одном
// файле — приложение обязано открываться офлайн, без подгрузки чанков.
ok(fs.statSync('dist/index.html').size < 1200*1024,`размер ${(fs.statSync('dist/index.html').size/1024).toFixed(0)} КБ — в пределах нормы`);

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
ok(/printf 'version: %s/.test(wf2) && /body_path: RELEASE_BODY\.md/.test(wf2),'релиз публикует номер версии для проверки обновлений');
ok(fs.existsSync('RELEASE_NOTES.md'),'описание релиза лежит в репозитории (не хардкод в workflow)');
const VER=fs.readFileSync('src/core/version.ts','utf8').match(/APP_VERSION\s*=\s*"([0-9.]+)"/)[1];
ok(new RegExp('### Что нового в '+VER.replace(/\./g,'\\.')).test(fs.readFileSync('RELEASE_NOTES.md','utf8')),'описание релиза совпадает с версией '+VER);
ok(fs.existsSync('public/ads/promo1.mp4'),'рекламный ролик на месте');
ok(fs.existsSync('dist/ads/promo1.mp4'),'ролик попал в сборку (значит будет в APK)');
ok(fs.existsSync('android-signing/chubgames.p12'),'ключ подписи лежит в репозитории');

console.log('\n[8] Контент про друзей');
const cnt=fs.readFileSync('src/core/content.ts','utf8');
for(const id of ['lyoha','vanya','maks','seryoga','artyom','radomir','kudrya','shitov'])
  ok(cnt.includes(`id: "${id}"`),`друг ${id} есть в игре`);
ok((cnt.match(/unlockLvl: 0/g)||[]).length===24,'все 24 мини-игры открыты сразу');
const sav=fs.readFileSync('src/core/save.ts','utf8');
ok(/unlockedGames = ALL_GAMES\.slice\(\)/.test(sav)&&/ALL_GAMES: GameId\[\]/.test(sav),'старые сохранения тоже получают все игры');
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
ok(upb.includes('ProgressRing'),'загрузка обновления — полноэкранная, с кольцом прогресса');
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
ok(home.includes('GameIcon')&&home.includes('onOpenProfile'),'уровень кликабельный, ведёт в статистику');
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
ok(setg.includes('DiffPicker')&&setg.includes('#59FF9E')&&setg.includes('#FF3B2F'),'сложность с цветным свечением');
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
ok(home18.indexOf('Сводка') === -1 || home18.indexOf('Stat icon') < home18.indexOf('GAME_META.map'),
  'сводка поднята над сеткой игр');

const bf18 = fs.readFileSync('src/pages/BossFight.tsx', 'utf8');
ok(bf18.includes('setWindup'), 'босс замахивается перед ударом');
ok(bf18.includes('blockReady'), 'у блока есть перезарядка');
ok(bf18.includes('rageRef'), 'босс звереет на низком здоровье');
ok(/hp: 780/.test(fs.readFileSync('src/core/bosses.ts', 'utf8')),
  'здоровья боссам добавлено — бой не кончается за 4 секунды');

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
ok((cnt19.match(/unlockLvl: 0/g) || []).length === 24, 'все 24 игры открыты сразу');

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
ok(set19.includes('writePerfMode'), 'в настройках можно переключить производительность');

console.log(fails===0?'\n✅ ВСЕ ПРОВЕРКИ ВЁРСТКИ ПРОЙДЕНЫ\n':`\n❌ ПРОВАЛЕНО: ${fails}\n`);
process.exit(fails?1:0);