import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNav, { TabType } from './components/BottomNav';
import CheckPage from './pages/CheckPage';
import ScanPage from './pages/ScanPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const [tab, setTab] = useState<TabType>('check');
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="h-full w-full bg-[#09090b] text-zinc-50 overflow-hidden relative select-none">

      {/* ── ambient glow ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #991b1b 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute -bottom-56 -left-40 w-96 h-96 rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #7f1d1d 0%, transparent 70%)', filter: 'blur(100px)' }} />
      </div>

      {/* ── splash ── */}
      <AnimatePresence>
        {splash && (
          <motion.div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#09090b]"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -60 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.15 }}
              className="relative"
            >
              {/* pulse behind logo */}
              <motion.div className="absolute -inset-6 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(153,27,27,0.25), transparent 70%)' }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }} />

              <div className="w-20 h-20 rounded-[20px] flex items-center justify-center relative z-10"
                style={{
                  background: 'linear-gradient(135deg, #991b1b, #7f1d1d)',
                  boxShadow: '0 0 48px rgba(153,27,27,0.35)',
                }}>
                <svg width="38" height="38" viewBox="0 0 100 100" fill="none">
                  {[1,2,3].map(i => (
                    <motion.path key={i}
                      d={`M${50-i*11} ${50+i*11} A${i*16} ${i*16} 0 0 1 ${50-i*11} ${50-i*11}`}
                      stroke="white" strokeWidth="4.5" strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 - i * 0.15 }}
                      transition={{ duration: 0.6, delay: 0.4 + i * 0.12 }} />
                  ))}
                  <motion.circle cx="39" cy="50" r="5" fill="white"
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ delay: 0.7, type: 'spring' }} />
                </svg>
              </div>
            </motion.div>

            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-6 text-[18px] font-bold tracking-tight">
              NFC Tester
            </motion.p>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="mt-1 text-[11px] text-zinc-600 tracking-widest uppercase">
              Диагностика · Сканер
            </motion.p>

            {/* progress */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-8 w-28 h-[2px] rounded-full bg-zinc-800 overflow-hidden">
              <motion.div className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #991b1b, #dc2626)' }}
                initial={{ width: '0%' }} animate={{ width: '100%' }}
                transition={{ delay: 1.1, duration: 0.7 }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── pages ── */}
      <div className="relative h-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {tab === 'check' && <CheckPage />}
            {tab === 'scan' && <ScanPage />}
            {tab === 'settings' && <SettingsPage />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── nav ── */}
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
