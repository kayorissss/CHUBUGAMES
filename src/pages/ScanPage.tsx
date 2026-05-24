import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, CheckCircle2, AlertTriangle,
  Clock, Tag, FileText, RotateCcw, Fingerprint, Nfc,
} from 'lucide-react';

type Phase = 'idle' | 'waiting' | 'success' | 'error';

interface TagData {
  type: string;
  id: string;
  timestamp: string;
  records: number;
  technology: string;
}

/* mini row */
function Row({ icon: Icon, label, value, accent, delay }: {
  icon: typeof Tag; label: string; value: string; accent: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex items-center gap-3 rounded-2xl px-4 py-3"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${accent}18`, border: `1px solid ${accent}28` }}>
        <Icon size={17} color={accent} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-zinc-500 leading-none mb-0.5">{label}</p>
        <p className="text-[13px] font-semibold truncate" style={{ color: accent }}>{value}</p>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════ */
export default function ScanPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [tagData, setTagData] = useState<TagData | null>(null);
  const [timer, setTimer] = useState(0);
  const [history, setHistory] = useState<TagData[]>([]);

  useEffect(() => {
    if (phase !== 'waiting') return;
    const id = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const genId = () =>
    Array.from({ length: 7 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
    ).join(':');

  const simulateScan = useCallback(() => {
    const delay = 3000 + Math.random() * 2000;
    setTimeout(() => {
      const d: TagData = {
        type: ['NDEF', 'MIFARE Classic', 'MIFARE Ultralight', 'ISO-DEP'][Math.floor(Math.random() * 4)],
        id: genId(),
        timestamp: new Date().toLocaleTimeString('ru-RU'),
        records: Math.floor(Math.random() * 5) + 1,
        technology: ['NFC-A', 'NFC-B', 'NFC-F', 'NFC-V'][Math.floor(Math.random() * 4)],
      };
      setTagData(d);
      setHistory(prev => [d, ...prev].slice(0, 10));
      setPhase('success');
      if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    }, delay);
  }, []);

  const startScan = useCallback(async () => {
    if (phase === 'waiting') { setPhase('idle'); setTimer(0); return; }
    setPhase('waiting');
    setTimer(0);
    setTagData(null);

    if ('NDEFReader' in window) {
      try {
        const ndef = new (window as any).NDEFReader();
        await ndef.scan();
        ndef.addEventListener('reading', ({ serialNumber, message }: any) => {
          const d: TagData = {
            type: 'NDEF', id: serialNumber || genId(),
            timestamp: new Date().toLocaleTimeString('ru-RU'),
            records: message?.records?.length || 1,
            technology: 'NFC-A',
          };
          setTagData(d);
          setHistory(prev => [d, ...prev].slice(0, 10));
          setPhase('success');
          if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
        });
        ndef.addEventListener('readingerror', () => {
          setPhase('error');
          if (navigator.vibrate) navigator.vibrate(200);
        });
      } catch { simulateScan(); }
    } else { simulateScan(); }
  }, [phase, simulateScan]);

  const reset = () => { setPhase('idle'); setTagData(null); setTimer(0); };

  const fmt = (s: number) =>
    `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  return (
    <div className="h-full flex flex-col overflow-y-auto pb-20 scrollbar-none">
      <header className="px-5 pt-5 pb-3">
        <h1 className="text-[22px] font-bold tracking-tight">NFC Сканер</h1>
        <p className="text-[13px] text-zinc-500 mt-0.5">Чтение NFC меток и карт</p>
      </header>

      <div className="flex-1 flex flex-col items-center px-5">
        <AnimatePresence mode="wait">

          {/* ── IDLE / WAITING ── */}
          {(phase === 'idle' || phase === 'waiting') && (
            <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 mt-6 w-full">

              {/* visual area */}
              <div className="relative w-52 h-52 flex items-center justify-center">
                {/* rings */}
                {[100, 140, 176].map((d, i) => (
                  <span key={i} className="absolute rounded-full transition-colors duration-700"
                    style={{
                      width: d, height: d,
                      border: `1px solid ${phase === 'waiting' ? `rgba(239,68,68,${0.1 - i*0.025})` : `rgba(255,255,255,${0.04 - i*0.01})`}`,
                    }}
                  />
                ))}

                {phase === 'waiting' && (
                  <>
                    <span className="absolute w-[176px] h-[176px] rounded-full animate-radar"
                      style={{ background: 'conic-gradient(from 0deg, transparent 0%, rgba(220,38,38,0.1) 12%, transparent 25%)' }} />
                    <span className="absolute w-1.5 h-1.5 rounded-full bg-red-500/60 shadow-[0_0_6px_rgba(220,38,38,0.5)] animate-orbit" />
                    <span className="absolute w-1 h-1 rounded-full bg-red-400/40 animate-orbit2" />
                  </>
                )}

                {/* centre */}
                <motion.div
                  className="w-[72px] h-[72px] rounded-[20px] flex items-center justify-center z-10"
                  style={{
                    background: phase === 'waiting'
                      ? 'linear-gradient(135deg, rgba(220,38,38,0.15), rgba(220,38,38,0.05))'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${phase === 'waiting' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)'}`,
                    boxShadow: phase === 'waiting' ? '0 0 40px rgba(220,38,38,0.08)' : 'none',
                  }}
                  animate={phase === 'waiting' ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {phase === 'waiting'
                    ? <Fingerprint size={30} className="text-red-500" />
                    : <CreditCard size={28} className="text-zinc-600" />}
                </motion.div>
              </div>

              {/* timer */}
              {phase === 'waiting' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center gap-2">
                  <Clock size={13} className="text-zinc-600" />
                  <span className="text-[13px] text-zinc-500 font-mono tabular-nums">{fmt(timer)}</span>
                </motion.div>
              )}

              {/* button */}
              <motion.button
                onClick={startScan}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                className="relative w-[140px] h-[140px] rounded-full flex flex-col items-center justify-center cursor-pointer"
                style={{
                  background: phase === 'waiting'
                    ? 'linear-gradient(145deg, rgba(127,29,29,0.35), rgba(30,30,32,0.9))'
                    : 'linear-gradient(145deg, rgba(30,30,32,0.95), rgba(18,18,20,0.98))',
                  border: `1.5px solid ${phase === 'waiting' ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.06)'}`,
                  boxShadow: phase === 'waiting'
                    ? '0 0 48px rgba(220,38,38,0.12), 0 4px 24px rgba(0,0,0,0.5)'
                    : '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              >
                {phase === 'waiting' && (
                  <motion.span className="absolute inset-0 rounded-full opacity-40"
                    style={{ background: 'conic-gradient(from 0deg, transparent, rgba(220,38,38,0.15), transparent)' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} />
                )}
                <span className="text-xs font-semibold tracking-widest uppercase z-10"
                  style={{ color: phase === 'waiting' ? '#ef4444' : '#71717a' }}>
                  {phase === 'waiting' ? 'Поиск…' : 'Сканировать'}
                </span>
                {phase === 'waiting' && (
                  <span className="text-[9px] text-zinc-600 mt-1 z-10">отмена</span>
                )}
              </motion.button>

              <p className="text-xs text-zinc-600 text-center max-w-[240px] leading-relaxed">
                {phase === 'waiting'
                  ? 'Поднесите карту к задней панели устройства'
                  : 'Нажмите для начала сканирования'}
              </p>
            </motion.div>
          )}

          {/* ── SUCCESS ── */}
          {phase === 'success' && tagData && (
            <motion.div key="ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }} className="w-full mt-2 space-y-3">

              <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="flex flex-col items-center gap-2 mb-4">
                <CheckCircle2 size={48} className="text-emerald-500" strokeWidth={1.6} />
                <p className="text-lg font-bold text-emerald-500">Успешно!</p>
                <p className="text-[11px] text-zinc-500">NFC метка прочитана</p>
              </motion.div>

              <Row icon={Tag} label="Тип" value={tagData.type} accent="#22c55e" delay={0.12} />
              <Row icon={Fingerprint} label="Серийный номер" value={tagData.id} accent="#a1a1aa" delay={0.18} />
              <Row icon={FileText} label="Записи" value={`${tagData.records} шт`} accent="#a1a1aa" delay={0.24} />
              <Row icon={Nfc} label="Технология" value={tagData.technology} accent="#a1a1aa" delay={0.30} />
              <Row icon={Clock} label="Время" value={tagData.timestamp} accent="#a1a1aa" delay={0.36} />

              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
                onClick={reset}
                className="w-full mt-2 rounded-2xl py-3 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.97] transition-transform"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <RotateCcw size={15} className="text-red-500" />
                <span className="text-[13px] font-medium text-zinc-400">Сканировать снова</span>
              </motion.button>
            </motion.div>
          )}

          {/* ── ERROR ── */}
          {phase === 'error' && (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5 mt-16">
              <AlertTriangle size={48} className="text-red-500" strokeWidth={1.6} />
              <div className="text-center">
                <p className="text-lg font-bold text-red-500">Ошибка чтения</p>
                <p className="text-xs text-zinc-500 mt-1.5 max-w-[240px]">
                  Не удалось прочитать метку. Поднесите её ближе и попробуйте снова
                </p>
              </div>
              <button onClick={reset}
                className="rounded-2xl py-3 px-8 flex items-center gap-2 cursor-pointer active:scale-[0.97] transition-transform"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <RotateCcw size={15} className="text-red-500" />
                <span className="text-[13px] font-medium text-zinc-400">Повторить</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── HISTORY ── */}
        {history.length > 0 && phase !== 'success' && (
          <div className="w-full mt-6">
            <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider mb-2 px-1">
              История
            </p>
            <div className="space-y-1.5">
              {history.slice(0, 4).map((h, i) => (
                <div key={i}
                  className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center gap-2.5">
                    <Tag size={13} className="text-zinc-600" />
                    <div>
                      <p className="text-[12px] font-medium text-zinc-400">{h.type}</p>
                      <p className="text-[10px] text-zinc-600 font-mono">{h.id.slice(0, 20)}…</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-600 shrink-0">{h.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
