# Промпт для генерации иконки ЧУБУГЕЙМ

Сгенерируй в любом ИИ (Midjourney, DALL·E, Flux, Recraft), скачай PNG **1024×1024**
и пришли мне файл — я вкручу его в сборку как launcher-иконку.

---

## Основной промпт (английский — модели понимают его лучше)

```
Mobile game app icon, 1024x1024, square with rounded corners, flat vector style.

Subject: a bold minimal geometric burger seen from the side — three stacked
shapes: top bun, a thick amber patty layer, bottom bun — reduced to clean
rounded rectangles, no realistic texture, no sesame seeds detail beyond three
tiny dots.

Background: deep near-black charcoal (#0A0A0C) with a very subtle radial
graphite glow behind the subject, slightly lighter at the center (#1A1A20),
no gradient banding.

Accent colour: warm amber-orange (#FFB020) used only for the patty layer and a
thin rim-light along the top bun. Everything else in soft off-white (#F2F2F5)
and mid grey (#8F8F9C).

Style: premium 2026 dark-mode UI, liquid glass aesthetic, soft inner glow,
crisp 3px geometric strokes, high contrast, no outlines around the whole icon,
no drop shadow outside the canvas.

Composition: subject centered, occupying about 62% of the canvas, generous
even padding so nothing is cut when Android masks it into a circle or squircle.

Negative: no text, no letters, no numbers, no watermark, no photorealism,
no 3D render, no gradient mesh, no clutter, no faces, no hands, no cheese
drips, no busy background.
```

## Русский вариант (если модель отвечает на русском)

```
Иконка мобильной игры, 1024×1024, квадрат со скруглёнными углами, плоский
векторный стиль.

Объект: минималистичный геометрический бургер сбоку — три уложенных друг на
друга формы: верхняя булка, толстая янтарная котлета, нижняя булка. Всё сведено
к чистым скруглённым прямоугольникам, без реалистичной текстуры, максимум три
точки-кунжутинки.

Фон: глубокий почти чёрный графит (#0A0A0C) с еле заметным радиальным
свечением за объектом, к центру чуть светлее (#1A1A20), без полос градиента.

Акцент: тёплый янтарно-оранжевый (#FFB020) только на котлете и тонкой световой
кромке верхней булки. Остальное — мягкий белый (#F2F2F5) и средний серый (#8F8F9C).

Стиль: премиальный тёмный интерфейс 2026 года, жидкое стекло, мягкое внутреннее
свечение, чёткие геометрические линии 3 px, высокий контраст.

Композиция: объект по центру, занимает около 62% холста, равномерные отступы —
чтобы ничего не срезалось, когда Android обрежет иконку в круг.

Не надо: текста, букв, цифр, водяных знаков, фотореализма, 3D-рендера, лишних
деталей, лиц, рук, стекающего сыра, пёстрого фона.
```

---

## Вариант со шрифтом (если хочешь буквы на иконке)

Буквы на иконке приложения обычно съедаются маской и выглядят мелко, поэтому
рекомендую **без текста**. Но если хочется — вот промпт с монограммой:

```
Same dark premium icon, but the subject is a single bold letter "Ч" in
Unbounded / heavy geometric sans-serif, off-white (#F2F2F5), centered,
with a thin amber (#FFB020) underline bar beneath it and a subtle amber glow.
Deep charcoal (#0A0A0C) background. No other elements, no extra text.
```

Шрифт приложения — **Unbounded** (заголовки) и **Inter** (текст), оба уже
лежат в сборке.

---

## Что прислать мне

- **PNG 1024×1024**, без прозрачности (фон должен быть залит тёмным)
- квадрат, без заранее скруглённых углов — Android скруглит сам
- имя файла любое, просто закинь в чат

Дальше я сам нарежу `mipmap-mdpi … mipmap-xxxhdpi`, соберу adaptive icon
(foreground + фоновый слой `#0A0A0C`) и пересоберу APK.
