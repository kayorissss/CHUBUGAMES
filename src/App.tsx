import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SettingsProvider } from './context/SettingsContext';
import BottomNav, { TabType } from './components/BottomNav';
import CheckPage from './pages/CheckPage';
import ScanPage from './pages/ScanPage';
import SettingsPage from './pages/SettingsPage';

function AppContent() {
  const [tab, setTab] = useState<TabType>('check');
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="h-full w-full overflow-hidden relative select-none"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Splash */}
      <AnimatePresence>
        {splash && (
          <motion.div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
            style={{ background: 'var(--bg-primary)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--accent)' }}
            >
              <svg width="40" height="40" viewBox="0 0 100 100" fill="none">
                {[1, 2, 3].map(i => (
                  <motion.path
                    key={i}
                    d={`M${50 - i * 11} ${50 + i * 11} A${i * 16} ${i * 16} 0 0 1 ${50 - i * 11} ${50 - i * 11}`}
                    stroke="white"
                    strokeWidth="5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                  />
                ))}
                <motion.circle
                  cx="39" cy="50" r="5"
                  fill="white"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.6, type: 'spring' }}
                />
              </svg>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-5 text-lg font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              NFC Tester
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-6 w-24 h-1 rounded-full overflow-hidden"
              style={{ background: 'var(--border-color)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--accent)' }}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ delay: 0.9, duration: 0.7 }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pages */}
      <div className="h-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {tab === 'check' && <CheckPage />}
            {tab === 'scan' && <ScanPage />}
            {tab === 'settings' && <SettingsPage />}
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}
