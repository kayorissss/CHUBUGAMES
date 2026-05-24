import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone, Wifi, CheckCircle2, XCircle,
  Cpu, Signal, Shield, Zap, RotateCcw,
} from 'lucide-react';

/* ─── types ─────────────────────────────────── */
type Phase = 'idle' | 'checking' | 'done';

interface Result {
  nfcSupported: boolean;
  nfcEnabled: boolean;
  deviceModel: string;
  osVersion: string;
  secureElement: boolean;
  hce: boolean;
}

/* ─── step config for the checking phase ───── */
const STEPS = [
  'Инициализация NFC-адаптера…',
  'Сканирование модуля…',
  'Проверка драйверов…',
  'Анализ API доступности…',
  'Финализация…',
];

/* ─── small reusable card ──────────────────── */
function InfoRow({
  icon: Icon, label, value, accent, delay,
}: {
  icon: typeof Smartphone; label: string; value: string;
  accent: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="flex items-center gap-3 rounded-2xl px-4 py-3"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${accent}18`, border: `1px solid ${accent}28` }}
      >
        <Icon size={17} color={accent} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-zinc-500 leading-none mb-0.5">{label}</p>
        <p className="text-[13px] font-semibold truncate" style={{ color: accent }}>
          {value}
        </p>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════ */
export default function CheckPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<Result | null>(null);
  const [step, setStep] = useState(0);           // checking step index
  const [progress, setProgress] = useState(0);    // 0-100
  const rafRef = useRef(0);

  /* --- animate progress smoothly ---------- */
  useEffect(() => {
    if (phase !== 'checking') return;
    setStep(0);
    setProgress(0);

    let start: number | null = null;
    const DURATION = 2800;            // total ms
    const stepInterval = DURATION / STEPS.length;

    const tick = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const pct = Math.min(elapsed / DURATION * 100, 100);
      setProgress(pct);
      setStep(Math.min(Math.floor(elapsed / stepInterval), STEPS.length - 1));
      if (elapsed < DURATION) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    const timeout = setTimeout(() => finalize(), DURATION + 200);
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(timeout); };
  }, [phase]);

  const finalize = () => {
    const hasNDEF = 'NDEFReader' in window;
    const ua = navigator.userAgent;
    const isAndroid = /Android/i.test(ua);
    const isMobile = /Mobile|Tablet/i.test(ua);

    let deviceModel = 'Неизвестно';
    let osVersion = 'N/A';

    if (isAndroid) {
      const m = ua.match(/;\s*([^;]+)\s+Build/);
      if (m) deviceModel = m[1].trim();
      const v = ua.match(/Android\s+([\d.]+)/);
      if (v) osVersion = 'Android ' + v[1];
    } else if (/iPhone/.test(ua)) {
      deviceModel = 'iPhone';
      const v = ua.match(/OS\s+([\d_]+)/);
      if (v) osVersion = 'iOS ' + v[1].replace(/_/g, '.');
    } else {
      deviceModel = isMobile ? 'Mobile Device' : 'Desktop';
      osVersion = navigator.platform || 'Unknown';
    }

    const nfcSupported = hasNDEF || isAndroid;
    setResult({ nfcSupported, nfcEnabled: hasNDEF, deviceModel, osVersion, secureElement: nfcSupported, hce: isAndroid });
    setPhase('done');
  };

  const start = useCallback(() => {
    if (phase === 'checking') return;
    setResult(null);
    setPhase('checking');
  }, [phase]);

  const reset = () => { setPhase('idle'); setResult(null); };

  /* ─── render ─────────────────────────────── */
  return (
    <div className="h-full flex flex-col overflow-y-auto pb-20 scrollbar-none">
      {/* header */}
      <header className="px-5 pt-5 pb-3">
        <h1 className="text-[22px] font-bold tracking-tight">Проверка NFC</h1>
        <p className="text-[13px] text-zinc-500 mt-0.5">Диагностика аппаратного модуля</p>
      </header>

      {/* body */}
      <div className="flex-1 flex flex-col items-center justify-center px-5">
        <AnimatePresence mode="wait">

          {/* ──────── IDLE ──────── */}
          {phase === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="flex flex-col items-center gap-10"
            >
              {/* decorative rings */}
              <div className="relative w-44 h-44 flex items-center justify-center">
                {[110, 140, 170].map((d, i) => (
                  <span
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      width: d, height: d,
                      border: `1px solid rgba(239,68,68,${0.08 - i * 0.02})`,
                    }}
                  />
                ))}
                {/* NFC icon centre */}
                <div
                  className="w-20 h-20 rounded-[22px] flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(220,38,38,0.15), rgba(220,38,38,0.05))',
                    border: '1px solid rgba(239,68,68,0.12)',
                    boxShadow: '0 0 40px rgba(220,38,38,0.08)',
                  }}
                >
                  <svg width="36" height="36" viewBox="0 0 100 100" fill="none">
                    {[1,2,3].map(i=>(
                      <path key={i}
                        d={`M${50-i*11} ${50+i*11} A${i*16} ${i*16} 0 0 1 ${50-i*11} ${50-i*11}`}
                        stroke="#ef4444" strokeWidth="4" strokeLinecap="round"
                        opacity={1-i*0.2}/>
                    ))}
                    <circle cx="39" cy="50" r="5" fill="#ef4444"/>
                  </svg>
                </div>
              </div>

              {/* button */}
              <motion.button
                onClick={start}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                className="relative w-[140px] h-[140px] rounded-full flex items-center justify-center cursor-pointer"
                style={{
                  background: 'linear-gradient(145deg, rgba(30,30,32,0.95), rgba(18,18,20,0.98))',
                  border: '1.5px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              >
                <span className="text-xs font-semibold tracking-widest uppercase text-zinc-400">
                  Начать
                </span>
              </motion.button>

              <p className="text-xs text-zinc-600 text-center max-w-[220px] leading-relaxed">
                Нажмите для полной диагностики NFC&nbsp;модуля
              </p>
            </motion.div>
          )}

          {/* ──────── CHECKING — radar animation ──────── */}
          {phase === 'checking' && (
            <motion.div
              key="checking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-8"
            >
              {/* radar + orbiting dots */}
              <div className="relative w-56 h-56 flex items-center justify-center">
                {/* static rings */}
                {[108, 156, 200].map((d, i) => (
                  <span key={i} className="absolute rounded-full"
                    style={{ width: d, height: d, border: `1px solid rgba(239,68,68,${0.07 - i*0.015})` }}
                  />
                ))}

                {/* conic radar sweep */}
                <span
                  className="absolute w-[200px] h-[200px] rounded-full animate-radar"
                  style={{
                    background: 'conic-gradient(from 0deg, transparent 0%, rgba(220,38,38,0.12) 15%, transparent 30%)',
                  }}
                />

                {/* orbiting dots */}
                <span className="absolute w-2 h-2 rounded-full bg-red-500/70 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-orbit" />
                <span className="absolute w-1.5 h-1.5 rounded-full bg-red-400/50 animate-orbit2" />
                <span className="absolute w-1 h-1 rounded-full bg-red-300/40 animate-orbit3" />

                {/* centre pulsing core */}
                <motion.div
                  className="w-16 h-16 rounded-full flex items-center justify-center z-10"
                  style={{
                    background: 'radial-gradient(circle, rgba(220,38,38,0.18) 0%, rgba(220,38,38,0.04) 70%)',
                    border: '1px solid rgba(239,68,68,0.15)',
                  }}
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <motion.div
                    className="w-6 h-6 rounded-full bg-red-600"
                    animate={{ opacity: [0.6, 1, 0.6], scale: [0.9, 1.1, 0.9] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                    style={{ boxShadow: '0 0 20px rgba(220,38,38,0.5)' }}
                  />
                </motion.div>
              </div>

              {/* progress bar */}
              <div className="w-56">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-zinc-500 font-medium">{STEPS[step]}</span>
                  <span className="text-[11px] text-zinc-600 font-mono tabular-nums">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="h-[3px] rounded-full bg-zinc-800/80 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg, #991b1b, #ef4444)',
                    }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ──────── DONE ──────── */}
          {phase === 'done' && result && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full space-y-3"
            >
              {/* verdict */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="flex flex-col items-center gap-2 mb-5"
              >
                {result.nfcSupported ? (
                  <CheckCircle2 size={44} className="text-emerald-500" strokeWidth={1.8} />
                ) : (
                  <XCircle size={44} className="text-red-500" strokeWidth={1.8} />
                )}
                <p className={`text-lg font-bold ${result.nfcSupported ? 'text-emerald-500' : 'text-red-500'}`}>
                  {result.nfcSupported ? 'NFC поддерживается' : 'NFC не обнаружен'}
                </p>
                <p className="text-[11px] text-zinc-500">
                  {result.nfcSupported ? 'Ваше устройство совместимо' : 'Модуль NFC не найден'}
                </p>
              </motion.div>

              {/* cards */}
              <InfoRow icon={Smartphone} label="Устройство" value={result.deviceModel} accent="#a1a1aa" delay={0.12} />
              <InfoRow icon={Cpu} label="Система" value={result.osVersion} accent="#a1a1aa" delay={0.18} />
              <InfoRow icon={Wifi} label="NFC модуль" value={result.nfcSupported ? 'Обнаружен' : 'Не найден'} accent={result.nfcSupported ? '#22c55e' : '#ef4444'} delay={0.24} />
              <InfoRow icon={Signal} label="Web NFC API" value={result.nfcEnabled ? 'Доступен' : 'Недоступен'} accent={result.nfcEnabled ? '#22c55e' : '#f59e0b'} delay={0.30} />
              <InfoRow icon={Shield} label="Secure Element" value={result.secureElement ? 'Есть' : 'Нет'} accent={result.secureElement ? '#22c55e' : '#a1a1aa'} delay={0.36} />
              <InfoRow icon={Zap} label="HCE" value={result.hce ? 'Поддерживается' : 'Нет'} accent={result.hce ? '#22c55e' : '#a1a1aa'} delay={0.42} />

              {/* reset */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={reset}
                className="w-full mt-3 rounded-2xl py-3 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97] transition-transform"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <RotateCcw size={15} className="text-red-500" />
                <span className="text-[13px] font-medium text-zinc-400">Повторить</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
