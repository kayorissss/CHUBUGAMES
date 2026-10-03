/**
 * Проверка «глушат ли интернет».
 *
 * Идея: при шейпинге мобильного интернета в РФ обычно остаются доступны
 * «белые» сервисы (Яндекс, ВК, Госуслуги, Mail.ru), а международные
 * (Google, Cloudflare, GitHub) отваливаются или дико тормозят. Сравниваем
 * две группы и делаем вывод.
 *
 * ЧТО ЗДЕСЬ ПЕРЕПИСАНО ПОСЛЕ ЖАЛОБ. Пользователь писал: «пишет везде
 * высокий пинг и что яндекс не доступен, а он у меня работает» и «в скорости
 * какой-то бред, нажимаю — и по рофлу меняется». Причина была в методике:
 *
 *   1) хосты пинговались ЗАГРУЗКОЙ КАРТИНКИ по захардкоженному URL с хешем
 *      в пути — ссылка протухла, и сервис числился «недоступным»;
 *   2) замер включал DNS + TLS + декод_png, восемь запросов шли ОДНОВРЕМЕННО
 *      по мобильному радио и мешали друг другу — отсюда «всегда высокий пинг»;
 *   3) замер был ОДИН, без повторов: цифра прыгала от нажатия к нажатию.
 *
 * Теперь: запрос маленького файла по `no-cors` (важен сам факт ответа, а не
 * содержимое — так не мешают ни CORS, ни декодирование), один разогревочный
 * запрос в счёт не идёт, дальше ТРИ замера и МЕДИАНА; хосты проверяются
 * по очереди и сразу отрисовываются в интерфейсе (для этого есть onStage).
 * Скорость — три прогона по одному потоку, тоже медиана: цифра остаётся
 * той же при повторной проверке, а не «как повезёт».
 */

export type ProbeResult = {
  id: string;
  name: string;
  group: "ru" | "world";
  ok: boolean;
  ms: number | null;
};

export type NetVerdict = {
  status: "ok" | "throttled" | "blocked" | "offline";
  title: string;
  detail: string;
  ruOk: number;
  ruTotal: number;
  worldOk: number;
  worldTotal: number;
  ruAvg: number | null;
  worldAvg: number | null;
  probes: ProbeResult[];
};

type Target = { id: string; name: string; group: "ru" | "world"; url: string };

/**
 * Проверяемые хосты. Только корневые `/favicon.ico`: они не зависят от
 * версий и не протухают, в отличие от длинных путей с хешем. Нам важен сам
 * факт «сервер ответил», а не содержимое файла.
 */
const TARGETS: Target[] = [
  // Российские — обычно не глушат
  { id: "yandex", name: "Яндекс", group: "ru", url: "https://yandex.ru/favicon.ico" },
  { id: "vk", name: "ВКонтакте", group: "ru", url: "https://vk.com/favicon.ico" },
  { id: "gosuslugi", name: "Госуслуги", group: "ru", url: "https://www.gosuslugi.ru/favicon.ico" },
  { id: "mailru", name: "Mail.ru", group: "ru", url: "https://mail.ru/favicon.ico" },
  // Международные — отваливаются первыми при шейпинге
  { id: "google", name: "Google", group: "world", url: "https://www.google.com/favicon.ico" },
  { id: "gstatic", name: "Google 204", group: "world", url: "https://www.gstatic.com/generate_204" },
  { id: "cloudflare", name: "Cloudflare", group: "world", url: "https://www.cloudflare.com/favicon.ico" },
  { id: "github", name: "GitHub", group: "world", url: "https://github.com/favicon.ico" },
];

const TIMEOUT = 4500;
const SAMPLES = 3;

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

/** Один запрос: true — сервер ответил (любым кодом), false — таймаут или тишина. */
async function hit(url: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  const bust = `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  try {
    /* no-cors: содержимое нам не нужно, а обычный cross-origin fetch без
       CORS-заголовков упал бы и показал «недоступно» там, где сеть цела. */
    await fetch(bust, { mode: "no-cors", cache: "no-store", signal: ctrl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Пинг одного хоста: разогрев + SAMPLES замеров, наружу — медиана.
 * Разогрев нужен потому, что первый запрос всегда платит за DNS и TLS:
 * без него «пинг» получался 600-1200 мс на идеальном Wi-Fi.
 */
export async function probeTarget(t: Target): Promise<ProbeResult> {
  const base = { id: t.id, name: t.name, group: t.group };
  if (!(await hit(t.url))) return { ...base, ok: false, ms: null };

  const samples: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const started = performance.now();
    const ok = await hit(t.url);
    if (!ok) continue;
    samples.push(performance.now() - started);
  }
  const ms = median(samples);
  return { ...base, ok: ms !== null, ms: ms === null ? null : Math.round(ms) };
}

const avg = (xs: number[]) =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;

/**
 * Полная проверка. Хосты идут ПО ОЧЕРЕДИ: восемь параллельных запросов на
 * мобильном радио мешают друг другу и врут о задержке. `onStage` вызывается
 * после каждого хоста — интерфейс показывает процесс, а не «крутится и
 * непонятно что происходит».
 */
export async function runNetCheck(
  onStage?: (probes: ProbeResult[], next: Target | null) => void,
): Promise<NetVerdict> {
  const probes: ProbeResult[] = [];
  for (const t of TARGETS) {
    onStage?.([...probes], t);
    probes.push(await probeTarget(t));
  }
  onStage?.([...probes], null);

  const ru = probes.filter((p) => p.group === "ru");
  const world = probes.filter((p) => p.group === "world");
  const ruOk = ru.filter((p) => p.ok);
  const worldOk = world.filter((p) => p.ok);
  const ruAvg = avg(ruOk.map((p) => p.ms!));
  const worldAvg = avg(worldOk.map((p) => p.ms!));

  let status: NetVerdict["status"];
  let title: string;
  let detail: string;

  if (ruOk.length === 0 && worldOk.length === 0) {
    status = "offline";
    title = "Интернета нет";
    detail = "Не отвечает вообще ничего. Проверь мобильные данные или Wi-Fi.";
  } else if (worldOk.length === 0 && ruOk.length > 0) {
    status = "blocked";
    title = "ГЛУШАТ";
    detail =
      `Российские сервисы работают (${ruOk.length} из ${ru.length}), ` +
      "а зарубежные не отвечают вообще. Классическая картина шейпинга мобильного интернета.";
  } else if (worldOk.length < world.length / 2) {
    status = "blocked";
    title = "ПОХОЖЕ, ГЛУШАТ";
    detail =
      `Из зарубежных сервисов отвечает только ${worldOk.length} из ${world.length}, ` +
      "российские при этом живы. Скорее всего, ограничение по «белым спискам».";
  } else if (worldAvg && ruAvg && worldAvg > ruAvg * 4 && worldAvg > 700) {
    status = "throttled";
    title = "РЕЖУТ СКОРОСТЬ";
    detail =
      `Зарубежные отвечают за ${worldAvg} мс против ${ruAvg} мс у российских — ` +
      "разница больше чем вчетверо. Интернет работает, но душат.";
  } else {
    status = "ok";
    title = "ВСЁ НОРМАЛЬНО";
    detail =
      "Отвечают и российские, и зарубежные сервисы" +
      (worldAvg ? ` (${worldAvg} мс против ${ruAvg} мс).` : ".") +
      " Ограничений не видно.";
  }

  return {
    status, title, detail,
    ruOk: ruOk.length, ruTotal: ru.length,
    worldOk: worldOk.length, worldTotal: world.length,
    ruAvg, worldAvg, probes,
  };
}

/** Все хосты — чтобы интерфейс мог нарисовать строчки ДО того, как они проверены. */
export const NET_TARGETS = TARGETS.map(({ id, name, group }) => ({ id, name, group }));

export interface SpeedResult {
  mbps: number;
  bytes: number;
  ms: number;
  /** сколько прогонов реально удалось: цифра — медиана по ним */
  rounds: number;
  /** субъективная оценка */
  verdict: string;
}

/**
 * Файлы для замера. Берутся с CDN, которые отдают CORS-заголовки (иначе
 * читатель потока не даст посчитать байты) и которые доступны без обхода:
 * yastatic — российский, jsDelivr — контрольный. Если один не отвечает,
 * замер идёт по второму, а не падает.
 */
const SPEED_SOURCES = [
  "https://yastatic.net/jquery/3.7.1/jquery.min.js",
  "https://yastatic.net/react/17.0.2/react-dom.production.min.js",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js",
];

/** Сколько максимум набирать за прогон: больше — только батарею жечь. */
const ROUND_CAP = 1.4e6;
/** меньше этого прогон не считается: статистика по 5 КБ — это шум */
const ROUND_MIN = 40_000;
const ROUNDS = 3;

function speedVerdict(mbps: number): string {
  if (mbps >= 50) return "Отличная скорость, можно всё";
  if (mbps >= 20) return "Хорошо: видео в HD тянет спокойно";
  if (mbps >= 8) return "Нормально для соцсетей и музыки";
  if (mbps >= 3) return "Медленно, видео будет подтормаживать";
  if (mbps >= 1) return "Очень медленно, похоже на ограничение";
  return "Почти не грузит — скорее всего режут";
}

/** Один прогон: качаем один поток, меряем время до(cap) байт. */
async function runRound(
  url: string,
  signal: AbortSignal | undefined,
  onBytes: (bytes: number, mbps: number) => void,
): Promise<{ bytes: number; ms: number } | null> {
  const ctrl = new AbortController();
  const kill = () => ctrl.abort();
  if (signal) signal.addEventListener("abort", kill);
  const timeout = setTimeout(kill, 8000);
  const started = performance.now();
  try {
    const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`, {
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value?.byteLength || 0;
      const ms = performance.now() - started;
      onBytes(bytes, (bytes * 8) / Math.max(0.15, ms / 1000) / 1e6);
      if (bytes >= ROUND_CAP) break;
    }
    const ms = performance.now() - started;
    if (bytes < ROUND_MIN) return null;
    // байты, добытые «в никуда» после cap, в зачёт не идут: останавливаемся
    void reader.cancel();
    return { bytes, ms };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener("abort", kill);
  }
}

/**
 * Замер скорости.
 *
 * Раньше восемь потоков качались одновременно, а результат показывали по
 * первому попавшемуся числу: на мобильном радио это лотерея — отсюда «нажимаю
 * и по рофлу меняется». Теперь один поток, до трёх прогонов, наружу — медиана:
 * повторная проверка даёт то же число в пределах разумного.
 */
export async function measureSpeed(
  onProgress?: (loaded: number, mbps: number) => void,
  signal?: AbortSignal,
): Promise<SpeedResult | null> {
  const rates: number[] = [];
  let bytes = 0;
  let ms = 0;

  for (const url of SPEED_SOURCES) {
    if (signal?.aborted) break;
    for (let i = 0; i < ROUNDS; i++) {
      const r = await runRound(url, signal, (loaded, live) => onProgress?.(bytes + loaded, live));
      if (!r) break;                       // источник не тянется — пробуем следующий
      rates.push((r.bytes * 8) / (r.ms / 1000) / 1e6);
      bytes += r.bytes;
      ms += r.ms;
      onProgress?.(bytes, median(rates) || 0);
      if (rates.length >= ROUNDS) break;
    }
    if (rates.length >= ROUNDS) break;
  }

  const m = median(rates);
  if (m === null) return null;
  return {
    mbps: Math.round(m * 10) / 10,
    bytes,
    ms: Math.round(ms),
    rounds: rates.length,
    verdict: speedVerdict(m),
  };
}

export function fmtBytesShort(b: number) {
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} МБ`;
  if (b >= 1e3) return `${Math.round(b / 1e3)} КБ`;
  return `${b} Б`;
}
