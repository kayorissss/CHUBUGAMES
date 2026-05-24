import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Smartphone, Cpu, Wifi, Shield, Zap, Radio, RefreshCw } from 'lucide-react';
import Card from '../components/Card';
import { useSettings } from '../context/SettingsContext';

type Phase = 'idle' | 'checking' | 'done';

interface Result {
  nfcSupported: boolean;
  nfcEnabled: boolean;
  device: string;
  os: string;
  secureElement: boolean;
  hce: boolean;
}

const STEPS = ['Поиск NFC модуля', 'Проверка драйверов', 'Анализ API', 'Завершение'];

export default function CheckPage() {
  const { vibrate, playSound } = useSettings();
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<Result | null>(null);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  const animRef = useRef(0);

  useEffect(() => {
    if (phase !== 'checking') return;
    
    setProgress(0);
    setStep(0);
    let start: number | null = null;
    const duration = 2500;

    const animate = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);
      setStep(Math.min(Math.floor((elapsed / duration) * STEPS.length), STEPS.length - 1));
      
      if (elapsed < duration) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        finalize();
      }
    };
    
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [phase]);

  const finalize = () => {
    const hasNDEF = 'NDEFReader' in window;
    const ua = navigator.userAgent;
    const isAndroid = /Android/i.test(ua);

    let device = 'Неизвестно';
    let os = 'N/A';

    if (isAndroid) {
      const m = ua.match(/;\s*([^;]+)\s+Build/);
      if (m) device = m[1].trim();
      const v = ua.match(/Android\s+([\d.]+)/);
      if (v) os = 'Android ' + v[1];
    } else if (/iPhone|iPad/.test(ua)) {
      device = /iPad/.test(ua) ? 'iPad' : 'iPhone';
      const v = ua.match(/OS\s+([\d_]+)/);
      if (v) os = 'iOS ' + v[1].replace(/_/g, '.');
    } else {
      device = /Mobile/.test(ua) ? 'Mobile' : 'Desktop';
      os = navigator.platform;
    }

    const nfcSupported = hasNDEF || isAndroid;
    
    setResult({
      nfcSupported,
      nfcEnabled: hasNDEF,
      device,
      os,
      secureElement: nfcSupported,
      hce: isAndroid,
    });
    setPhase('done');
    vibrate([50, 30, 50]);
    playSound();
  };

  const startCheck = () => {
    if (phase === 'checking') return;
    vibrate(30);
    setResult(null);
    setPhase('checking');
  };

  const reset = () => {
    vibrate(30);
    setPhase('idle');
    setResult(null);
  };

  const InfoRow = ({ icon: Icon, label, value, status }: {
    icon: typeof Smartphone; label: string; value: string;
    status?: 'success' | 'error' | 'warning' | 'neutral';
  }) => {
    const colors = {
      success: 'var(--success)',
      error: 'var(--accent)',
      warning: 'var(--warning)',
      neutral: 'var(--text-secondary)',
    };
    const color = colors[status || 'neutral'];
    
    return (
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}15` }}
        >
          <Icon size={20} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="text-sm font-semibold truncate" style={{ color }}>{value}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto pb-20">
      {/* Header */}
      <header className="text-center px-6 pt-8 pb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Проверка NFC
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Диагностика аппаратного модуля
        </p>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <AnimatePresence mode="wait">
          
          {/* IDLE */}
          {phase === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-8 w-full max-w-xs"
            >
              {/* Visual */}
              <div className="relative w-40 h-40 flex items-center justify-center">
                {[120, 100, 80].map((size, i) => (
                  <div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      width: size,
                      height: size,
                      border: `1px solid var(--border-color)`,
                      opacity: 1 - i * 0.2,
                    }}
                  />
                ))}
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                >
                  <Radio size={28} style={{ color: 'var(--accent)' }} />
                </div>
              </div>

              {/* Button */}
              <motion.button
                onClick={startCheck}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 rounded-2xl font-semibold text-white cursor-pointer"
                style={{ background: 'var(--accent)' }}
              >
                Начать проверку
              </motion.button>

              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Проверка займёт несколько секунд
              </p>
            </motion.div>
          )}

          {/* CHECKING */}
          {phase === 'checking' && (
            <motion.div
              key="checking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-8 w-full max-w-xs"
            >
              {/* Radar animation */}
              <div className="relative w-48 h-48 flex items-center justify-center">
                {[180, 140, 100].map((size, i) => (
                  <div
                    key={i}
                    className="absolute rounded-full animate-pulse-ring"
                    style={{
                      width: size,
                      height: size,
                      border: `1px solid var(--accent)`,
                      opacity: 0.3 - i * 0.08,
                      animationDelay: `${i * 0.3}s`,
                    }}
                  />
                ))}
                
                {/* Radar sweep */}
                <div
                  className="absolute w-44 h-44 rounded-full animate-radar"
                  style={{
                    background: 'conic-gradient(from 0deg, transparent, rgba(220,38,38,0.2), transparent 30%)',
                  }}
                />
                
                {/* Orbiting dot */}
                <div className="absolute w-2 h-2 rounded-full animate-orbit"
                  style={{ background: 'var(--accent)', boxShadow: '0 0 10px var(--accent)' }} />
                
                {/* Center */}
                <motion.div
                  className="w-14 h-14 rounded-full flex items-center justify-center z-10"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--accent)' }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Radio size={24} style={{ color: 'var(--accent)' }} />
                </motion.div>
              </div>

              {/* Progress */}
              <div className="w-full">
                <div className="flex justify-between mb-2">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{STEPS[step]}</span>
                  <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-color)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ width: `${progress}%`, background: 'var(--accent)' }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* DONE */}
          {phase === 'done' && result && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-sm space-y-4"
            >
              {/* Result header */}
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="flex flex-col items-center gap-2 mb-6"
              >
                {result.nfcSupported ? (
                  <CheckCircle2 size={52} style={{ color: 'var(--success)' }} />
                ) : (
                  <XCircle size={52} style={{ color: 'var(--accent)' }} />
                )}
                <p className="text-xl font-bold" style={{ color: result.nfcSupported ? 'var(--success)' : 'var(--accent)' }}>
                  {result.nfcSupported ? 'NFC поддерживается' : 'NFC не найден'}
                </p>
              </motion.div>

              {/* Info cards */}
              <Card>
                <InfoRow icon={Smartphone} label="Устройство" value={result.device} />
                <div style={{ height: 1, background: 'var(--border-color)' }} />
                <InfoRow icon={Cpu} label="Система" value={result.os} />
              </Card>

              <Card delay={0.1}>
                <InfoRow icon={Wifi} label="NFC модуль" value={result.nfcSupported ? 'Обнаружен' : 'Не найден'} status={result.nfcSupported ? 'success' : 'error'} />
                <div style={{ height: 1, background: 'var(--border-color)' }} />
                <InfoRow icon={Radio} label="Web NFC API" value={result.nfcEnabled ? 'Доступен' : 'Недоступен'} status={result.nfcEnabled ? 'success' : 'warning'} />
              </Card>

              <Card delay={0.2}>
                <InfoRow icon={Shield} label="Secure Element" value={result.secureElement ? 'Есть' : 'Нет'} status={result.secureElement ? 'success' : 'neutral'} />
                <div style={{ height: 1, background: 'var(--border-color)' }} />
                <InfoRow icon={Zap} label="HCE" value={result.hce ? 'Поддерживается' : 'Нет'} status={result.hce ? 'success' : 'neutral'} />
              </Card>

              {/* Reset button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                onClick={reset}
                className="w-full py-3.5 rounded-2xl font-medium flex items-center justify-center gap-2 cursor-pointer"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
              >
                <RefreshCw size={18} />
                Повторить проверку
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
