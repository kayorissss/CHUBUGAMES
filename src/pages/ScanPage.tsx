import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, CheckCircle2, XCircle, Clock, Tag,
  Hash, Layers, RefreshCw, Wifi, WifiOff, ShieldAlert,
} from 'lucide-react';
import Card from '../components/Card';
import { useSettings } from '../context/SettingsContext';

type Phase = 'idle' | 'requesting' | 'scanning' | 'success' | 'not_found' | 'no_nfc' | 'error';

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
  const [retryCount, setRetryCount] = useState(0);
  const [history, setHistory] = useState<TagInfo[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('nfc-history') || '[]');
    } catch { return []; }
  });

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem('nfc-history', JSON.stringify(history.slice(0, 20)));
  }, [history]);

  useEffect(() => {
    if (phase === 'scanning') {
      timerRef.current = window.setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const stopScan = useCallback(() => {
    abortRef.current?.abort();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('idle');
    setTimer(0);
  }, []);

  const requestAndScan = useCallback(async () => {
    // 1. Check if Web NFC exists
    if (!('NDEFReader' in window)) {
      setPhase('no_nfc');
      vibrate(100);
      return;
    }

    // 2. Show requesting state
    setPhase('requesting');
    vibrate(20);

    try {
      const ndef = new (window as any).NDEFReader();
      abortRef.current = new AbortController();

      // This line triggers the browser permission prompt automatically
      await ndef.scan({ signal: abortRef.current.signal });

      // Permission granted! Start scanning
      setPhase('scanning');
      setTimer(0);

      // 30 second timeout
      timeoutRef.current = window.setTimeout(() => {
        abortRef.current?.abort();
        setErrorMsg('Карта не обнаружена за 30 секунд.\nПопробуйте поднести карту ближе к задней панели телефона.');
        setPhase('not_found');
        vibrate(150);
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
        setErrorMsg('Не удалось прочитать данные карты.\nПоднесите карту снова.');
        setPhase('error');
        vibrate(150);
      }, { signal: abortRef.current.signal });

    } catch (err: any) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (err.name === 'AbortError') {
        setPhase('idle');
        return;
      }

      if (err.name === 'NotAllowedError') {
        // User denied permission — retry will show the prompt again
        setRetryCount(c => c + 1);
        setErrorMsg('Разрешение на NFC не получено.\nНажмите кнопку ниже — браузер запросит доступ снова.');
        setPhase('error');
      } else if (err.name === 'NotSupportedError') {
        setPhase('no_nfc');
      } else {
        setErrorMsg(err.message || 'Неизвестная ошибка');
        setPhase('error');
      }
      vibrate(150);
    }
  }, [vibrate, playSound]);

  const startScan = useCallback(() => {
    if (phase === 'scanning') { stopScan(); return; }
    setTagInfo(null);
    setErrorMsg('');
    requestAndScan();
  }, [phase, stopScan, requestAndScan]);

  useEffect(() => {
    if (settings.autoScan && phase === 'idle') {
      requestAndScan();
    }
  }, [settings.autoScan]);

  const reset = () => {
    vibrate(20);
    setPhase('idle');
    setTagInfo(null);
    setTimer(0);
    setErrorMsg('');
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="h-full flex flex-col overflow-y-auto pb-20">
      <header className="text-center px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>NFC Сканер</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Чтение NFC карт и меток</p>
      </header>

      <div className="flex-1 flex flex-col items-center px-6">
        <AnimatePresence mode="wait">

          {/* ── IDLE / REQUESTING / SCANNING ── */}
          {(phase === 'idle' || phase === 'requesting' || phase === 'scanning') && (
            <motion.div
              key="main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5 w-full max-w-xs"
            >
              {/* Visual */}
              <div className="relative w-48 h-48 flex items-center justify-center mt-2">
                {[180, 140, 100].map((s, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      width: s, height: s,
                      border: `1px solid ${phase === 'scanning' ? 'var(--accent)' : 'var(--border-color)'}`,
                      opacity: phase === 'scanning' ? 0.35 - i * 0.08 : 0.25,
                    }}
                    animate={phase === 'scanning' ? { scale: [1, 1.08, 1], opacity: [0.35, 0.15, 0.35] } : {}}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
                  />
                ))}

                {phase === 'scanning' && (
                  <>
                    <div className="absolute w-44 h-44 rounded-full animate-radar"
                      style={{ background: 'conic-gradient(from 0deg, transparent, rgba(220,38,38,0.15), transparent 25%)' }} />
                    <div className="absolute w-2 h-2 rounded-full animate-orbit"
                      style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
                  </>
                )}

                {phase === 'requesting' && (
                  <motion.div
                    className="absolute w-44 h-44 rounded-full"
                    style={{ border: '2px dashed var(--accent)', opacity: 0.3 }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                  />
                )}

                <motion.div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center z-10"
                  style={{
                    background: phase !== 'idle' ? 'rgba(220,38,38,0.1)' : 'var(--bg-card)',
                    border: `1px solid ${phase !== 'idle' ? 'var(--accent)' : 'var(--border-color)'}`,
                  }}
                  animate={phase === 'scanning' ? { scale: [1, 1.04, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <CreditCard size={34} style={{ color: phase !== 'idle' ? 'var(--accent)' : 'var(--text-muted)' }} />
                </motion.div>
              </div>

              {/* Status text */}
              {phase === 'requesting' && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-sm font-medium text-center" style={{ color: 'var(--accent)' }}>
                  Запрос разрешения на NFC...
                </motion.p>
              )}

              {phase === 'scanning' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                  <Clock size={16} style={{ color: 'var(--text-muted)' }} />
                  <span className="font-mono text-lg" style={{ color: 'var(--text-secondary)' }}>{fmt(timer)}</span>
                </motion.div>
              )}

              {/* Button */}
              <motion.button
                onClick={startScan}
                whileTap={{ scale: 0.97 }}
                disabled={phase === 'requesting'}
                className="w-full py-4 rounded-2xl font-semibold cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                style={{
                  background: phase === 'scanning' ? 'transparent' : 'var(--accent)',
                  border: phase === 'scanning' ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                  color: phase === 'scanning' ? 'var(--accent)' : 'white',
                }}
              >
                {phase === 'scanning' ? (
                  <><WifiOff size={20} /> Остановить</>
                ) : phase === 'requesting' ? (
                  <><Wifi size={20} className="animate-pulse" /> Ожидание разрешения...</>
                ) : (
                  <><Wifi size={20} /> Сканировать</>
                )}
              </motion.button>

              <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {phase === 'scanning'
                  ? 'Поднесите банковскую карту или NFC метку к задней панели телефона'
                  : phase === 'requesting'
                  ? 'Разрешите доступ к NFC в появившемся окне'
                  : 'Нажмите для сканирования. Приложение запросит доступ к NFC'}
              </p>
            </motion.div>
          )}

          {/* ── SUCCESS ── */}
          {phase === 'success' && tagInfo && (
            <motion.div key="ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }} className="w-full max-w-sm space-y-3 mt-2">
              <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="flex flex-col items-center gap-2 mb-4">
                <CheckCircle2 size={52} style={{ color: 'var(--success)' }} />
                <p className="text-xl font-bold" style={{ color: 'var(--success)' }}>Карта прочитана!</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>NFC метка успешно распознана</p>
              </motion.div>

              <Card>
                {[
                  { icon: Hash, label: 'Серийный номер', value: tagInfo.serialNumber, mono: true, accent: 'var(--success)' },
                  { icon: Tag, label: 'Тип', value: tagInfo.type, accent: 'var(--text-secondary)' },
                  { icon: Layers, label: 'Записей', value: String(tagInfo.records), accent: 'var(--text-secondary)' },
                  { icon: Clock, label: 'Время', value: tagInfo.timestamp, accent: 'var(--text-secondary)' },
                ].map((r, i) => (
                  <div key={i}>
                    {i > 0 && <div style={{ height: 1, background: 'var(--border-color)' }} />}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${r.accent}15` }}>
                        <r.icon size={20} style={{ color: r.accent }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.label}</p>
                        <p className={`text-sm font-semibold truncate ${r.mono ? 'font-mono' : ''}`}
                          style={{ color: 'var(--text-primary)' }}>{r.value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </Card>

              <button onClick={reset}
                className="w-full py-3.5 rounded-2xl font-medium flex items-center justify-center gap-2 cursor-pointer active:opacity-80"
                style={{ background: 'var(--accent)', color: 'white' }}>
                <RefreshCw size={18} /> Сканировать ещё
              </button>
            </motion.div>
          )}

          {/* ── NO NFC ── */}
          {phase === 'no_nfc' && (
            <motion.div key="no_nfc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5 w-full max-w-xs mt-8">
              <ShieldAlert size={52} style={{ color: 'var(--warning)' }} />
              <div className="text-center">
                <p className="text-lg font-bold" style={{ color: 'var(--warning)' }}>NFC недоступен</p>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Ваш браузер не поддерживает Web NFC.
                </p>
              </div>
              <Card className="w-full">
                <div className="px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Что делать:</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    1. Откройте <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Google Chrome</span> на Android{'\n'}
                    2. Включите NFC в настройках телефона{'\n'}
                    3. Откройте это приложение в Chrome
                  </p>
                </div>
              </Card>
              <button onClick={reset}
                className="w-full py-3.5 rounded-2xl font-medium cursor-pointer active:opacity-80"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                Назад
              </button>
            </motion.div>
          )}

          {/* ── NOT FOUND / ERROR ── */}
          {(phase === 'not_found' || phase === 'error') && (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5 w-full max-w-xs mt-8">
              {phase === 'not_found' ? (
                <WifiOff size={52} style={{ color: 'var(--warning)' }} />
              ) : (
                <XCircle size={52} style={{ color: 'var(--accent)' }} />
              )}
              <div className="text-center">
                <p className="text-lg font-bold"
                  style={{ color: phase === 'not_found' ? 'var(--warning)' : 'var(--accent)' }}>
                  {phase === 'not_found' ? 'Карта не обнаружена' : 'Ошибка'}
                </p>
              </div>
              <Card className="w-full">
                <p className="text-sm text-center px-4 py-4 whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
                  {errorMsg}
                </p>
              </Card>

              {/* Retry — will show permission prompt again if needed */}
              <button onClick={() => { reset(); setTimeout(requestAndScan, 100); }}
                className="w-full py-3.5 rounded-2xl font-medium flex items-center justify-center gap-2 cursor-pointer active:opacity-80"
                style={{ background: 'var(--accent)', color: 'white' }}>
                <RefreshCw size={18} />
                {retryCount > 0 && phase === 'error' ? 'Запросить разрешение снова' : 'Попробовать снова'}
              </button>

              <button onClick={reset}
                className="w-full py-3 rounded-2xl font-medium cursor-pointer active:opacity-80"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                Назад
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History */}
        {history.length > 0 && phase === 'idle' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm mt-6 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1"
              style={{ color: 'var(--text-muted)' }}>История</p>
            <Card>
              {history.slice(0, 5).map((h, i) => (
                <div key={i}>
                  {i > 0 && <div style={{ height: 1, background: 'var(--border-color)' }} />}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <CreditCard size={16} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                      <div className="min-w-0">
                        <p className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
                          {h.serialNumber}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{h.type}</p>
                      </div>
                    </div>
                    <span className="text-[11px] shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>{h.timestamp}</span>
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
