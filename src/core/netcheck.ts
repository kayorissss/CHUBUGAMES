/**
 * Проверка «глушат ли интернет».
 *
 * Идея: при шейпинге мобильного интернета в РФ обычно остаются доступны
 * «белые» сервисы (Яндекс, ВК, Госуслуги, Mail.ru), а международные
 * (Google, Cloudflare, GitHub) отваливаются или дико тормозят.
 * Сравниваем две группы и делаем вывод.
 *
 * Технически: грузим маленькую картинку/фавиконку с каждого хоста через
 * <img> с уникальным query. Это обходит CORS — нам важен сам факт
 * загрузки и время, а не содержимое.
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

const TARGETS: Target[] = [
  // Российские — обычно не глушат
  { id: "yandex", name: "Яндекс", group: "ru", url: "https://yastatic.net/s3/home-static/_/dd/ddc9e4c5d7d70b1eca5c4dbbb43b0a1e.png" },
  { id: "vk", name: "ВКонтакте", group: "ru", url: "https://vk.com/images/icons/favicons/fav_logo.ico" },
  { id: "gosuslugi", name: "Госуслуги", group: "ru", url: "https://www.gosuslugi.ru/favicon.ico" },
  { id: "mailru", name: "Mail.ru", group: "ru", url: "https://img.imgsmail.ru/r/default/favicon.ico" },
  // Международные — отваливаются при шейпинге
  { id: "google", name: "Google", group: "world", url: "https://www.google.com/favicon.ico" },
  { id: "gstatic", name: "Gstatic", group: "world", url: "https://www.gstatic.com/generate_204" },
  { id: "cloudflare", name: "Cloudflare", group: "world", url: "https://cloudflare.com/favicon.ico" },
  { id: "github", name: "GitHub", group: "world", url: "https://github.githubassets.com/favicons/favicon.svg" },
];

const TIMEOUT = 5000;

/** Пингует один хост загрузкой картинки. Возвращает время в мс или null. */
function probe(t: Target): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const started = performance.now();
    const img = new Image();
    let done = false;

    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve({
        id: t.id,
        name: t.name,
        group: t.group,
        ok,
        ms: ok ? Math.round(performance.now() - started) : null,
      });
    };

    const timer = setTimeout(() => finish(false), TIMEOUT);
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    // уникальный параметр, чтобы не попасть в кэш
    img.src = `${t.url}${t.url.includes("?") ? "&" : "?"}_=${Date.now()}${Math.random()}`;
  });
}

const avg = (xs: number[]) =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;

/** Полная проверка. Все хосты пингуются параллельно. */
export async function runNetCheck(): Promise<NetVerdict> {
  const probes = await Promise.all(TARGETS.map(probe));

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
      `а зарубежные не отвечают вообще. Классическая картина шейпинга мобильного интернета.`;
  } else if (worldOk.length < world.length / 2) {
    status = "blocked";
    title = "ПОХОЖЕ, ГЛУШАТ";
    detail =
      `Из зарубежных сервисов отвечает только ${worldOk.length} из ${world.length}, ` +
      `российские при этом живы. Скорее всего, ограничение по «белым спискам».`;
  } else if (worldAvg && ruAvg && worldAvg > ruAvg * 3 && worldAvg > 900) {
    status = "throttled";
    title = "СИЛЬНО РЕЖУТ СКОРОСТЬ";
    detail =
      `Зарубежные отвечают за ${worldAvg} мс против ${ruAvg} мс у российских — ` +
      `разница больше чем втрое. Интернет работает, но душат.`;
  } else {
    status = "ok";
    title = "ВСЁ НОРМАЛЬНО";
    detail =
      `Отвечают и российские, и зарубежные сервисы` +
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

/**
 * Грубый замер скорости: качаем известный файл и делим размер на время.
 * Точность так себе (мешает TCP slow start), поэтому показываем «примерно».
 */
export async function measureSpeed(
  onProgress?: (loaded: number) => void,
): Promise<{ mbps: number; bytes: number; ms: number } | null> {
  // ~1.5 МБ статики с российского CDN — доступен даже при шейпинге
  const url = `https://yastatic.net/s3/frontend/yandex-lego/1.0.0/lego.css?_=${Date.now()}`;
  const started = performance.now();
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const reader = res.body?.getReader();
    let bytes = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value?.byteLength || 0;
        onProgress?.(bytes);
      }
    } else {
      bytes = (await res.blob()).size;
    }
    const ms = performance.now() - started;
    if (bytes < 1000 || ms < 1) return null;
    const mbps = (bytes * 8) / (ms / 1000) / 1e6;
    return { mbps: Math.round(mbps * 10) / 10, bytes, ms: Math.round(ms) };
  } catch {
    return null;
  }
}
