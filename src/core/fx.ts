/* Звук синтезируется на лету через WebAudio — ни одного mp3, APK остаётся лёгким. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let hapticsOn = true;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.28;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function setSound(on: boolean) {
  enabled = on;
  if (master) master.gain.value = on ? 0.28 : 0;
}
export function setHaptics(on: boolean) {
  hapticsOn = on;
}
export function unlockAudio() {
  ac();
}

interface ToneOpts {
  freq: number;
  to?: number;
  dur?: number;
  type?: OscillatorType;
  vol?: number;
  delay?: number;
  sweep?: "exp" | "lin";
}

function tone(o: ToneOpts) {
  if (!enabled) return;
  const a = ac();
  if (!a || !master) return;
  const t0 = a.currentTime + (o.delay || 0);
  const dur = o.dur ?? 0.12;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = o.type || "sine";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) {
    if (o.sweep === "lin") osc.frequency.linearRampToValueAtTime(o.to, t0 + dur);
    else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + dur);
  }
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(o.vol ?? 0.5, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise(dur = 0.16, vol = 0.4, hp = 600, delay = 0) {
  if (!enabled) return;
  const a = ac();
  if (!a || !master) return;
  const t0 = a.currentTime + delay;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = hp;
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t0);
}

export const sfx = {
  tap: () => tone({ freq: 520, to: 760, dur: 0.06, type: "triangle", vol: 0.32 }),
  crit: () => {
    tone({ freq: 700, to: 1500, dur: 0.1, type: "square", vol: 0.3 });
    tone({ freq: 1100, to: 2200, dur: 0.14, type: "triangle", vol: 0.22, delay: 0.04 });
  },
  coin: () => {
    tone({ freq: 980, dur: 0.05, type: "square", vol: 0.22 });
    tone({ freq: 1460, dur: 0.09, type: "square", vol: 0.18, delay: 0.05 });
  },
  spit: () => {
    noise(0.1, 0.32, 900);
    tone({ freq: 300, to: 90, dur: 0.16, type: "sawtooth", vol: 0.2 });
  },
  hit: () => {
    noise(0.22, 0.5, 200);
    tone({ freq: 180, to: 50, dur: 0.28, type: "square", vol: 0.35 });
  },
  dodge: () => tone({ freq: 1200, to: 1700, dur: 0.045, type: "sine", vol: 0.12 }),
  power: () => {
    tone({ freq: 520, to: 1040, dur: 0.14, type: "triangle", vol: 0.3 });
    tone({ freq: 780, to: 1560, dur: 0.18, type: "sine", vol: 0.22, delay: 0.08 });
  },
  merge: () => tone({ freq: 420, to: 880, dur: 0.12, type: "sine", vol: 0.28 }),
  whack: () => {
    noise(0.1, 0.42, 400);
    tone({ freq: 220, to: 70, dur: 0.14, type: "square", vol: 0.3 });
  },
  buy: () => {
    tone({ freq: 620, dur: 0.07, type: "triangle", vol: 0.28 });
    tone({ freq: 930, dur: 0.12, type: "triangle", vol: 0.24, delay: 0.07 });
  },
  error: () => tone({ freq: 200, to: 120, dur: 0.16, type: "sawtooth", vol: 0.24 }),
  levelUp: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone({ freq: f, dur: 0.2, type: "triangle", vol: 0.28, delay: i * 0.085 }),
    );
  },
  achieve: () => {
    [660, 880, 1320].forEach((f, i) =>
      tone({ freq: f, dur: 0.26, type: "sine", vol: 0.26, delay: i * 0.1 }),
    );
  },
  gameOver: () => {
    [440, 350, 262, 175].forEach((f, i) =>
      tone({ freq: f, dur: 0.3, type: "sawtooth", vol: 0.24, delay: i * 0.13 }),
    );
  },
  caseOpen: () => {
    for (let i = 0; i < 14; i++)
      tone({ freq: 400 + i * 40, dur: 0.05, type: "square", vol: 0.12, delay: i * 0.075 });
  },
  legend: () => {
    [523, 784, 1047, 1319, 1568].forEach((f, i) =>
      tone({ freq: f, dur: 0.4, type: "triangle", vol: 0.3, delay: i * 0.11 }),
    );
  },
  swoosh: () => noise(0.13, 0.16, 1400),
  click: () => tone({ freq: 380, dur: 0.035, type: "square", vol: 0.16 }),
};

export function haptic(kind: "light" | "medium" | "heavy" | "success" | "error" = "light") {
  if (!hapticsOn) return;
  const v = (navigator as any).vibrate?.bind(navigator);
  if (!v) return;
  const map: Record<string, number | number[]> = {
    light: 8,
    medium: 18,
    heavy: 34,
    success: [12, 40, 22],
    error: [30, 50, 30],
  };
  try {
    v(map[kind]);
  } catch {
    /* noop */
  }
}
