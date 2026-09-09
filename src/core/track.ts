/**
 * Пользовательский трек для ритм-игры.
 *
 * Файл (mp3/m4a/ogg/wav) выбирается с телефона, лежит в IndexedDB и
 * никуда не отправляется — офлайн-принцип приложения не нарушается.
 * Чарт строится анализом самой звуковой дорожки: считаем энергию по
 * низким/средним/высоким полосам и ставим ноты на пики (онсеты).
 */

const DB = "chubgames-audio";
const STORE = "tracks";
const KEY = "radomir";

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export interface StoredTrack {
  name: string;
  data: ArrayBuffer;
}

export async function saveTrack(name: string, data: ArrayBuffer): Promise<void> {
  const db = await idb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ name, data } as StoredTrack, KEY);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function loadTrack(): Promise<StoredTrack | null> {
  try {
    const db = await idb();
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readonly");
      const rq = tx.objectStore(STORE).get(KEY);
      rq.onsuccess = () => res((rq.result as StoredTrack) || null);
      rq.onerror = () => rej(rq.error);
    });
  } catch {
    return null;
  }
}

export async function clearTrack(): Promise<void> {
  try {
    const db = await idb();
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  } catch {
    /* пусто */
  }
}

/* ================= АНАЛИЗ ТРЕКА ================= */

export interface Onset {
  t: number; // мс
  band: 0 | 1 | 2; // низ / середина / верх → дорожка
  strength: number;
}

/**
 * Находит удары в треке. Работает на моно-миксе, окно ~11 мс.
 * Для каждой из трёх полос считаем поток энергии и берём локальные
 * максимумы, превышающие скользящее среднее.
 */
export function detectOnsets(buf: AudioBuffer): Onset[] {
  const sr = buf.sampleRate;
  const ch = buf.numberOfChannels > 1
    ? mixDown(buf)
    : buf.getChannelData(0);

  const hop = Math.floor(sr * 0.011); // ~11 мс
  const win = hop * 2;
  const frames = Math.floor((ch.length - win) / hop);
  if (frames < 8) return [];

  // три полосы через простые одно-полюсные фильтры
  const low = new Float32Array(frames);
  const mid = new Float32Array(frames);
  const high = new Float32Array(frames);

  let lpA = 0, lpB = 0;
  for (let f = 0; f < frames; f++) {
    let eL = 0, eM = 0, eH = 0;
    const off = f * hop;
    for (let i = 0; i < win; i++) {
      const x = ch[off + i];
      // low-pass ~200 Гц
      lpA += (x - lpA) * 0.028;
      // low-pass ~2 кГц
      lpB += (x - lpB) * 0.24;
      const l = lpA;
      const m = lpB - lpA;
      const h = x - lpB;
      eL += l * l; eM += m * m; eH += h * h;
    }
    low[f] = Math.sqrt(eL / win);
    mid[f] = Math.sqrt(eM / win);
    high[f] = Math.sqrt(eH / win);
  }

  const onsets: Onset[] = [];
  const bands: [Float32Array, 0 | 1 | 2, number][] = [
    [low, 0, 1.42],
    [mid, 1, 1.5],
    [high, 2, 1.55],
  ];

  for (const [arr, band, thr] of bands) {
    const avgWin = 22;
    let lastIdx = -99;
    for (let f = 2; f < frames - 1; f++) {
      // скользящее среднее вокруг кадра
      let sum = 0, n = 0;
      for (let k = Math.max(0, f - avgWin); k < Math.min(frames, f + avgWin); k++) {
        sum += arr[k]; n++;
      }
      const avg = sum / Math.max(1, n);
      const v = arr[f];
      const rising = v > arr[f - 1] && v >= arr[f + 1];
      if (rising && v > avg * thr && v > 0.006 && f - lastIdx > 7) {
        lastIdx = f;
        onsets.push({
          t: (f * hop / sr) * 1000,
          band,
          strength: Math.min(1, v / (avg * 2 + 1e-6)),
        });
      }
    }
  }

  onsets.sort((a, b) => a.t - b.t);

  // прореживаем: не больше одной ноты на 105 мс суммарно
  const out: Onset[] = [];
  let last = -999;
  for (const o of onsets) {
    if (o.t - last >= 105) { out.push(o); last = o.t; }
    else if (out.length && o.strength > out[out.length - 1].strength + 0.25) {
      out[out.length - 1] = o;
    }
  }
  return out;
}

function mixDown(buf: AudioBuffer): Float32Array {
  const n = buf.length;
  const out = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += d[i];
  }
  const k = 1 / buf.numberOfChannels;
  for (let i = 0; i < n; i++) out[i] *= k;
  return out;
}

/* ================= ВОСПРОИЗВЕДЕНИЕ ================= */

let actx: AudioContext | null = null;
let srcNode: AudioBufferSourceNode | null = null;
let gainNode: GainNode | null = null;
let startedAt = 0;

export function audioCtx(): AudioContext {
  if (!actx) actx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return actx;
}

export async function decode(data: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = audioCtx();
  // decodeAudioData съедает переданный буфер — отдаём копию
  return await ctx.decodeAudioData(data.slice(0));
}

/** Запускает трек. Возвращает функцию текущего времени в мс. */
export function playTrack(buf: AudioBuffer, offsetMs = 0): () => number {
  stopTrack();
  const ctx = audioCtx();
  if (ctx.state === "suspended") void ctx.resume();
  srcNode = ctx.createBufferSource();
  srcNode.buffer = buf;
  gainNode = ctx.createGain();
  gainNode.gain.value = 0.85;
  srcNode.connect(gainNode).connect(ctx.destination);
  startedAt = ctx.currentTime - offsetMs / 1000;
  srcNode.start(0, Math.max(0, offsetMs / 1000));
  return () => (audioCtx().currentTime - startedAt) * 1000;
}

export function stopTrack() {
  try { srcNode?.stop(); } catch { /* уже остановлен */ }
  try { srcNode?.disconnect(); gainNode?.disconnect(); } catch { /* пусто */ }
  srcNode = null;
  gainNode = null;
}

export function fmtDur(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
