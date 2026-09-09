/**
 * Синтезированный трек для «Ритма Радомира».
 *
 * Никаких mp3: всё генерируется в WebAudio прямо на телефоне, поэтому
 * приложение остаётся офлайновым и не толстеет. Стиль — лёгкий синти-поп
 * («фембойчик»-вайб): мягкий бас, арпеджио, воздушная мелодия.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: number | null = null;
let step = 0;
let playing = false;

const BPM = 124;
const STEP_MS = 60000 / BPM / 2; // 8-е ноты

/** ноты гаммы (фа-диез минор — мягко и «нежно») */
const N = (semi: number) => 440 * Math.pow(2, (semi - 9) / 12);
const BASS = [N(-8), N(-8), N(-3), N(-3), N(-6), N(-6), N(-1), N(-1)];
const ARP = [N(6), N(9), N(13), N(16), N(13), N(9), N(11), N(6)];
const LEAD = [
  N(18), 0, N(21), 0, N(20), 0, N(18), 0,
  N(16), 0, N(18), 0, N(21), 0, 0, 0,
  N(23), 0, N(21), 0, N(18), 0, N(16), 0,
  N(18), 0, 0, 0, N(13), 0, 0, 0,
];

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx!;
}

function blip(
  freq: number,
  dur: number,
  type: OscillatorType,
  vol: number,
  detune = 0,
) {
  if (!ctx || !master || !freq) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function kick() {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + 0.2);
}

function hat() {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * 0.03);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7200;
  const g = ctx.createGain();
  g.gain.value = 0.1;
  src.connect(hp);
  hp.connect(g);
  g.connect(master);
  src.start(t);
}

function tick() {
  const bar = Math.floor(step / 8);
  const i = step % 8;

  // ударные
  if (i === 0 || i === 4) kick();
  if (i % 2 === 1) hat();

  // бас
  blip(BASS[i], 0.28, "triangle", 0.24);

  // арпеджио вступает со второго такта
  if (bar >= 1) blip(ARP[i], 0.16, "square", 0.055, 4);

  // мелодия — с четвёртого
  if (bar >= 3) {
    const lead = LEAD[step % LEAD.length];
    if (lead) {
      blip(lead, 0.34, "sine", 0.13);
      blip(lead * 2, 0.2, "sine", 0.04, -6);
    }
  }

  step += 1;
}

export function startBeat() {
  if (playing) return;
  ensure();
  playing = true;
  step = 0;
  tick();
  timer = window.setInterval(tick, STEP_MS);
}

export function stopBeat() {
  playing = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (master && ctx) {
    // мягко гасим, чтобы не щёлкало
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    setTimeout(() => {
      if (master && !playing) master.gain.value = 0.22;
    }, 320);
  }
}

export const isBeatPlaying = () => playing;
