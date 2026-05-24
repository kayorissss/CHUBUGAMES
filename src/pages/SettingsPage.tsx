import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Vibrate, Moon, Volume2, Info,
  ChevronRight, Shield, Smartphone, Heart, Code2,
} from 'lucide-react';

/* ── Toggle ──────────────────────────────── */
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="relative w-[46px] h-[26px] rounded-full transition-colors duration-300 cursor-pointer shrink-0"
      style={{
        background: on
          ? 'linear-gradient(135deg,#b91c1c,#991b1b)'
          : 'rgba(39,39,42,0.9)',
        boxShadow: on ? '0 0 10px rgba(185,28,28,0.25)' : 'none',
      }}
    >
      <motion.div
        className="absolute top-[3px] w-5 h-5 rounded-full"
        style={{
          background: on ? '#fafafa' : '#52525b',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }}
        animate={{ left: on ? 22 : 3 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

/* ── Row ─────────────────────────────────── */
function Row({ icon, title, sub, right, onClick }: {
  icon: React.ReactNode; title: string; sub?: string;
  right?: React.ReactNode; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 py-3 px-4 ${onClick ? 'cursor-pointer active:bg-white/[0.02]' : ''}`}
    >
      <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.1)' }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-zinc-200">{title}</p>
        {sub && <p className="text-[11px] text-zinc-600 mt-px leading-tight">{sub}</p>}
      </div>
      {right || (onClick && <ChevronRight size={15} className="text-zinc-600 shrink-0" />)}
    </div>
  );
}

/* ── Section label ───────────────────────── */
function Label({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider px-4 mb-1.5">
      {children}
    </p>
  );
}

/* ── Glass card ──────────────────────────── */
function Card({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="rounded-2xl overflow-hidden divide-y divide-white/[0.03]"
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.045)',
      }}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════ */
export default function SettingsPage() {
  const [vibration, setVibration] = useState(true);
  const [sound, setSound] = useState(false);
  const [notif, setNotif] = useState(true);
  const [dark, setDark] = useState(true);
  const [autoScan, setAutoScan] = useState(false);
  const [about, setAbout] = useState(false);

  const ic = (I: typeof Bell) => <I size={15} className="text-red-500" strokeWidth={1.8} />;

  return (
    <div className="h-full flex flex-col overflow-y-auto pb-20 scrollbar-none">
      <header className="px-5 pt-5 pb-3">
        <h1 className="text-[22px] font-bold tracking-tight">Настройки</h1>
        <p className="text-[13px] text-zinc-500 mt-0.5">Конфигурация приложения</p>
      </header>

      <div className="px-4 mt-2 space-y-5">
        {/* General */}
        <div>
          <Label>Основные</Label>
          <Card delay={0.05}>
            <Row icon={ic(Vibrate)} title="Вибрация" sub="При обнаружении NFC"
              right={<Toggle on={vibration} onChange={() => setVibration(!vibration)} />} />
            <Row icon={ic(Volume2)} title="Звук" sub="Звуковое уведомление"
              right={<Toggle on={sound} onChange={() => setSound(!sound)} />} />
            <Row icon={ic(Bell)} title="Уведомления" sub="Push-уведомления"
              right={<Toggle on={notif} onChange={() => setNotif(!notif)} />} />
          </Card>
        </div>

        {/* Appearance */}
        <div>
          <Label>Внешний вид</Label>
          <Card delay={0.1}>
            <Row icon={ic(Moon)} title="Тёмная тема" sub="Всегда"
              right={<Toggle on={dark} onChange={() => setDark(!dark)} />} />
          </Card>
        </div>

        {/* NFC */}
        <div>
          <Label>NFC</Label>
          <Card delay={0.15}>
            <Row icon={ic(Smartphone)} title="Авто-сканирование" sub="Автоматическое чтение"
              right={<Toggle on={autoScan} onChange={() => setAutoScan(!autoScan)} />} />
            <Row icon={ic(Shield)} title="Безопасность" sub="Шифрование данных"
              right={
                <span className="text-[11px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-lg font-medium">
                  Активно
                </span>
              } />
          </Card>
        </div>

        {/* About */}
        <div>
          <Label>Информация</Label>
          <Card delay={0.2}>
            <Row icon={ic(Info)} title="О приложении" sub="NFC Tester v1.0"
              onClick={() => setAbout(!about)} />
            <Row icon={ic(Code2)} title="Исходный код" sub="Open Source" onClick={() => {}} />
          </Card>
        </div>

        {/* About panel */}
        <AnimatePresence>
          {about && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.045)' }}>
                <div className="flex flex-col items-center gap-3 text-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #991b1b, #7f1d1d)',
                      boxShadow: '0 0 24px rgba(153,27,27,0.3)',
                    }}
                  >
                    <svg width="26" height="26" viewBox="0 0 100 100" fill="none">
                      {[1,2,3].map(i => (
                        <path key={i}
                          d={`M${50-i*11} ${50+i*11} A${i*16} ${i*16} 0 0 1 ${50-i*11} ${50-i*11}`}
                          stroke="white" strokeWidth="4.5" strokeLinecap="round" opacity={1-i*0.2} />
                      ))}
                      <circle cx="39" cy="50" r="5" fill="white" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-zinc-200">NFC Tester</p>
                  <p className="text-[11px] text-zinc-500">Версия 1.0.0 · 2026</p>
                  <p className="text-[11px] text-zinc-500 leading-relaxed max-w-[260px]">
                    Диагностика NFC модуля и сканирование меток.
                    Поддерживает Web NFC API.
                  </p>
                  <div className="flex items-center gap-1 text-[11px] text-zinc-600 mt-1">
                    <span>Made with</span>
                    <Heart size={11} className="text-red-500 fill-red-500" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl p-4"
          style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.08)' }}
        >
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            <span className="text-red-500 font-semibold">Совет</span> · Для работы NFC сканера на Android
            откройте в Chrome и убедитесь что NFC включён. Web NFC API доступен только через HTTPS.
          </p>
        </motion.div>

        <div className="h-2" />
      </div>
    </div>
  );
}
