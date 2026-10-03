/**
 * АНДРОИД: ПОЛОСКИ СИСТЕМЫ — В ТОН СТЕКЛУ.
 *
 * «Жидкое стекло» в CSS заканчивается там, где начинается системная панель:
 * если статус-бар и нижняя полоска жеста серо-белые (шаблон Capacitor красит
 * их цветом colorPrimaryDark), стеклянное нижнее меню выглядит приклеенным
 * поверх чужого приложения. Поэтому перед сборкой правим цвета шаблона.
 *
 * Что ПРАВИМ:
 *   · values/colors.xml — colorPrimary/colorPrimaryDark → цвет приложения,
 *     colorAccent → текущий базовый акцент (рукоятки выделения, прогресс);
 *   · values/styles.xml — в AppTheme.NoActionBar добавляем прозрачные
 *     statusBarColor/navigationBarColor, чтобы край экрана не резал панель.
 *
 * Чего НЕ ТРОГАЕМ: сами темы, windowBackground и splash. В шаблоне Capacitor
 * сплэш живёт в windowBackground запускающей темы, и правка темы — это способ
 * молча получить белый квадрат вместо заставки на части устройств. Пусть лучше
 * останется штатная загрузка, чем «красиво, но у половины людей сломано».
 *
 * Скрипт идемпотентен и никогда не роняет сборку: нет файла — предупреждение.
 * Запуск: node scripts/patch-android-glass.mjs android/app/src/main/res
 */
import fs from "node:fs";
import path from "node:path";

const RES = process.argv[2] || "android/app/src/main/res";
const APP_BG = "#0D0D10";
const ACCENT = "#FF7A18";

function note(msg) { console.log("[glass] " + msg); }

const colorsFile = path.join(RES, "values", "colors.xml");
if (fs.existsSync(colorsFile)) {
  let s = fs.readFileSync(colorsFile, "utf8");
  const before = s;
  const set = (name, value) => {
    const re = new RegExp(`<color name="${name}">[^<]*</color>`);
    if (re.test(s)) { s = s.replace(re, `<color name="${name}">${value}</color>`); return true; }
    return false;
  };
  const done = [
    set("colorPrimary", APP_BG),
    set("colorPrimaryDark", APP_BG),
    set("colorAccent", ACCENT),
  ].filter(Boolean).length;
  if (s !== before) {
    fs.writeFileSync(colorsFile, s);
    note(`colors.xml: подкрашено полосок и акцентов — ${done}`);
  } else {
    note("colors.xml: менять нечего (значения уже наши или названы иначе)");
  }
} else {
  note(`нет ${colorsFile} — полоски останутся шаблонными, это не ошибка сборки`);
}

const stylesFile = path.join(RES, "values", "styles.xml");
if (fs.existsSync(stylesFile)) {
  let s = fs.readFileSync(stylesFile, "utf8");
  if (/android:navigationBarColor/.test(s)) {
    note("styles.xml: полоски уже прозрачные");
  } else {
    // вставляем ровно в тот стиль, который реально видит WebView-активность
    const m = s.match(/<style name="AppTheme\.NoActionBar"[^>]*>[\s\S]*?<\/style>/);
    const items =
      "        <item name=\"android:statusBarColor\">@android:color/transparent</item>\n" +
      "        <item name=\"android:navigationBarColor\">@android:color/transparent</item>\n" +
      "        <item name=\"android:windowLightStatusBar\">false</item>\n";
    if (m) {
      const block = m[0];
      const patched = block.replace(/\s*<\/style>\s*$/, "\n" + items + "    </style>");
      s = s.slice(0, m.index) + patched + s.slice(m.index + block.length);
      fs.writeFileSync(stylesFile, s);
      note("styles.xml: статус-бар и нижняя полоска стали прозрачными");
    } else {
      note("styles.xml: стиль AppTheme.NoActionBar не найден — шаблон изменился, правку пропускаем");
    }
  }
} else {
  note(`нет ${stylesFile} — пропускаем`);
}
