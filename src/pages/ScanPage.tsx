import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, CheckCircle2, XCircle, Clock, Tag, Hash, Layers, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import Card from '../components/Card';
import { useSettings } from '../context/SettingsContext';

type Phase = 'idle' | 'scanning' | 'success' | 'not_found' | 'error';

interface TagInfo {
  serialNumber: string;
  type: string;
  records: number;
  timestamp: string;
}

export default function ScanPage() {
  const { settings, vibrate, playSound } = useSettings();
  const [phase, setPhase] = useState<Phase>('idle');
  const [tagInfo, setTagInfo] = useState<TagInfo | null>(null);
  const [timer, setTimer] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [history, setHistory] = useState<TagInfo[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('nfc-history') || '[]');
    } catch { return []; }
  });
  
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Save history
  useEffect(() => {
    localStorage.setItem('nfc-history', JSON.stringify(history.slice(0, 20)));
  }, [history]);

  // Timer
  useEffect(() => {
    if (phase === 'scanning') {
      timerRef.current = window.setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  const stopScan = useCallback(() => {
    abortRef.current?.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('idle');
    setTimer(0);
  }, []);

  const startScan = useCallback(async () => {
    if (phase === 'scanning') {
      stopScan();
      return;
    }

    vibrate(30);
    setPhase('scanning');
    setTimer(0);
    setTagInfo(null);
    setErrorMsg('');

    // Check if Web NFC is available
    if (!('NDEFReader' in window)) {
      setErrorMsg('Web NFC не поддерживается в этом браузере. Используйте Chrome на Android.');
      setPhase('error');
      vibrate(200);
      return;
    }

    try {
      const ndef = new (window as any).NDEFReader();
      abortRef.current = new AbortController();

      await ndef.scan({ signal: abortRef.current.signal });

      // Timeout - if no card detected in 30 seconds
      timeoutRef.current = window.setTimeout(() => {
        abortRef.current?.abort();
        setErrorMsg('Карта не обнаружена. Попробуйте поднести карту ближе к телефону.');
        setPhase('not_found');
        vibrate(200);
      }, 30000);

      ndef.addEventListener('reading', ({ serialNumber, message }: any) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        abortRef.current?.abort();

        const info: TagInfo = {
          serialNumber: serialNumber || 'Не определён',
          type: message?.records?.[0]?.recordType || 'NDEF',
          records: message?.records?.length || 0,
          timestamp: new Date().toLocaleTimeString('ru-RU'),
        };

        setTagInfo(info);
        setHistory(prev => [info, ...prev.filter(h => h.serialNumber !== info.serialNumber)].slice(0, 20));
        setPhase('success');
        vibrate([50, 30, 50, 30, 50]);
        playSound();
      }, { signal: abortRef.current.signal });

      ndef.addEventListener('readingerror', () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setErrorMsg('Не удалось прочитать карту. Убедитесь, что это NFC карта.');
        setPhase('error');
        vibrate(200);
      }, { signal: abortRef.current.signal });

    } catch (err: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      if (err.name === 'AbortError') {
        setPhase('idle');
        return;
      }
      
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Доступ к NFC запрещён. Разрешите доступ в настройках браузера.');
      } else if (err.name === 'NotSupportedError') {
        setErrorMsg('NFC не поддерживается на этом устройстве.');
      } else {
        setErrorMsg(`Ошибка: ${err.message || 'Неизвестная ошибка'}`);
      }
      
      setPhase('error');
      vibrate(200);
    }
  }, [phase, vibrate, playSound, stopScan]);

  // Auto-scan
  useEffect(() => {
    if (settings.autoScan && phase === 'idle') {
      startScan();
    }
  }, [settings.autoScan]);

  const reset = () => {
    vibrate(30);
    setPhase('idle');
    setTagInfo(null);
    setTimer(0);
    setErrorMsg('');
  };

  const formatTime = (s: number) => 
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="h-full flex flex-col overflow-y-auto pb-20">
      {/* Header */}
      <header className="text-center px-6 pt-8 pb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          NFC Сканер
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Поднесите карту к телефону
        </p>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center px-6">
        <AnimatePresence mode="wait">

          {/* IDLE / SCANNING */}
          {(phase === 'idle' || phase === 'scanning') && (
            <motion.div
              key="scan-main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 w-full max-w-xs"
            >
              {/* Visual */}
              <div className="relative w-48 h-48 flex items-center justify-center">
                {/* Rings */}
                {[180, 140, 100].map((size, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      width: size,
                      height: size,
                      border: `1px solid ${phase === 'scanning' ? 'var(--accent)' : 'var(--border-color)'}`,
                      opacity: phase === 'scanning' ? 0.4 - i * 0.1 : 0.3,
                    }}
                    animate={phase === 'scanning' ? { scale: [1, 1.1, 1], opacity: [0.4, 0.2, 0.4] } : {}}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}

                {phase === 'scanning' && (
                  <>
                    <div
                      className="absolute w-44 h-44 rounded-full animate-radar"
                      style={{ background: 'conic-gradient(from 0deg, transparent, rgba(220,38,38,0.15), transparent 25%)' }}
                    />
                    <div className="absolute w-2 h-2 rounded-full animate-orbit"
                      style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
                  </>
                )}

                {/* Center card icon */}
                <motion.div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center z-10"
                  style={{
                    background: phase === 'scanning' ? 'rgba(220,38,38,0.1)' : 'var(--bg-card)',
                    border: `1px solid ${phase === 'scanning' ? 'var(--accent)' : 'var(--border-color)'}`,
                  }}
                  animate={phase === 'scanning' ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <CreditCard size={36} style={{ color: phase === 'scanning' ? 'var(--accent)' : 'var(--text-muted)' }} />
                </motion.div>
              </div>

              {/* Timer */}
              {phase === 'scanning' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2"
                >
                  <Clock size={16} style={{ color: 'var(--text-muted)' }} />
                  <span className="font-mono text-lg" style={{ color: 'var(--text-secondary)' }}>
                    {formatTime(timer)}
                  </span>
                </motion.div>
              )}

              {/* Scan button */}
              <motion.button
                onClick={startScan}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 rounded-2xl font-semibold cursor-pointer flex items-center justify-center gap-2"
                style={{
                  background: phase === 'scanning' ? 'var(--bg-card)' : 'var(--accent)',
                  border: phase === 'scanning' ? '1px solid var(--accent)' : 'none',
                  color: phase === 'scanning' ? 'var(--accent)' : 'white',
                }}
              >
                {phase === 'scanning' ? (
                  <>
                    <Wifi size={20} className="animate-pulse" />
                    Остановить
                  </>
                ) : (
                  <>
                    <Wifi size={20} />
                    Сканировать
                  </>
                )}
              </motion.button>

              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                {phase === 'scanning'
                  ? 'Ожидание... Поднесите банковскую карту или NFC метку'
                  : 'Нажмите для начала сканирования'}
              </p>
            </motion.div>
          )}

          {/* SUCCESS */}
          {phase === 'success' && tagInfo && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-sm space-y-4"
            >
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="flex flex-col items-center gap-2 mb-6"
              >
                <CheckCircle2 size={56} style={{ color: 'var(--success)' }} />
                <p className="text-xl font-bold" style={{ color: 'var(--success)' }}>Карта прочитана!</p>
              </motion.div>

              <Card>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)' }}>
                    <Hash size={20} style={{ color: 'var(--success)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Серийный номер</p>
                    <p className="text-sm font-mono font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {tagInfo.serialNumber}
                    </p>
                  </div>
                </div>
                <div style={{ height: 1, background: 'var(--border-color)' }} />
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-card-solid)' }}>
                    <Tag size={20} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Тип</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tagInfo.type}</p>
                  </div>
                </div>
                <div style={{ height: 1, background: 'var(--border-color)' }} />
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-card-solid)' }}>
                    <Layers size={20} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Записей</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tagInfo.records}</p>
                  </div>
                </div>
                <div style={{ height: 1, background: 'var(--border-color)' }} />
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-card-solid)' }}>
                    <Clock size={20} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Время</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tagInfo.timestamp}</p>
                  </div>
                </div>
              </Card>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                onClick={reset}
                className="w-full py-3.5 rounded-2xl font-medium flex items-center justify-center gap-2 cursor-pointer"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                <RefreshCw size={18} />
                Сканировать ещё
              </motion.button>
            </motion.div>
          )}

          {/* NOT FOUND / ERROR */}
          {(phase === 'not_found' || phase === 'error') && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 w-full max-w-xs"
            >
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className="flex flex-col items-center gap-3"
              >
                {phase === 'not_found' ? (
                  <WifiOff size={56} style={{ color: 'var(--warning)' }} />
                ) : (
                  <XCircle size={56} style={{ color: 'var(--accent)' }} />
                )}
                <p className="text-xl font-bold" style={{ color: phase === 'not_found' ? 'var(--warning)' : 'var(--accent)' }}>
                  {phase === 'not_found' ? 'Не обнаружено' : 'Ошибка'}
                </p>
              </motion.div>

              <Card className="w-full">
                <p className="text-sm text-center px-4 py-4" style={{ color: 'var(--text-secondary)' }}>
                  {errorMsg}
                </p>
              </Card>

              <motion.button
                onClick={reset}
                className="w-full py-3.5 rounded-2xl font-medium flex items-center justify-center gap-2 cursor-pointer"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                <RefreshCw size={18} />
                Попробовать снова
              </motion.button>
            </motion.div>
          )}

        </AnimatePresence>

        {/* History */}
        {history.length > 0 && phase === 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-sm mt-8"
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-3 px-1" style={{ color: 'var(--text-muted)' }}>
              История сканирований
            </p>
            <Card>
              {history.slice(0, 5).map((item, i) => (
                <div key={i}>
                  {i > 0 && <div style={{ height: 1, background: 'var(--border-color)' }} />}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CreditCard size={18} style={{ color: 'var(--text-muted)' }} />
                      <div>
                        <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {item.serialNumber.length > 20 ? item.serialNumber.slice(0, 20) + '...' : item.serialNumber}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{item.type}</p>
                      </div>
                    </div>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{item.timestamp}</span>
                  </div>
                </div>
              ))}
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
