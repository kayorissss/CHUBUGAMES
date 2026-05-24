import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Vibrate, Volume2, Moon, Sun, Smartphone,
  Trash2, Download, RefreshCw, ChevronRight, Radio,
} from 'lucide-react';
import Card from '../components/Card';
import { useSettings, APP_VERSION } from '../context/SettingsContext';

/* ── Toggle ── */
function Toggle({ on, onTap }: { on: boolean; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      className="relative w-[50px] h-[28px] rounded-full cursor-pointer shrink-0 transition-colors duration-200"
      style={{ background: on ? 'var(--accent)' : 'var(--border-color)' }}
    >
      <motion.div
        className="absolute top-[3px] w-[22px] h-[22px] rounded-full"
        style={{
          background: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }}
        animate={{ left: on ? 24 : 3 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

/* ── Row ── */
function Row({ icon: Icon, title, sub, right, onClick, danger }: {
  icon: typeof Vibrate; title: string; sub?: string;
  right?: React.ReactNode; onClick?: () => void; danger?: boolean;
}) {
  const iconColor = danger ? 'var(--accent)' : 'var(--text-secondary)';
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3.5 px-4 py-3.5 ${onClick ? 'cursor-pointer active:opacity-60 transition-opacity' : ''}`}
    >
      <Icon size={20} style={{ color: iconColor }} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[14px]" style={{ color: danger ? 'var(--accent)' : 'var(--text-primary)' }}>{title}</p>
        {sub && <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function Separator() {
  return <div className="mx-4" style={{ height: 1, background: 'var(--border-color)' }} />;
}

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-[12px] font-semibold uppercase tracking-wider mb-2 px-1"
      style={{ color: 'var(--text-muted)' }}>
      {text}
    </p>
  );
}

/* ══════════════════════════════════════ */
export default function SettingsPage() {
  const { settings, toggle, vibrate } = useSettings();
  const [cleared, setCleared] = useState(false);

  const handleToggle = (key: keyof typeof settings) => {
    vibrate(15);
    toggle(key);
  };

  const clearHistory = () => {
    vibrate(30);
    localStorage.removeItem('nfc-history');
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto pb-20">
      {/* Header */}
      <header className="text-center px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Настройки</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Параметры приложения</p>
      </header>

      <div className="px-4 space-y-6 mt-2">

        {/* ── Сканер ── */}
        <section>
          <SectionLabel text="Сканер" />
          <Card>
            <Row
              icon={Smartphone}
              title="Авто-сканирование"
              sub="Сканировать сразу при открытии"
              right={<Toggle on={settings.autoScan} onTap={() => handleToggle('autoScan')} />}
            />
          </Card>
        </section>

        {/* ── Звук и вибрация ── */}
        <section>
          <SectionLabel text="Отклик" />
          <Card>
            <Row
              icon={Vibrate}
              title="Вибрация"
              sub="При нажатиях и событиях"
              right={<Toggle on={settings.vibration} onTap={() => handleToggle('vibration')} />}
            />
            <Separator />
            <Row
              icon={Volume2}
              title="Звук"
              sub="При успешном сканировании"
              right={<Toggle on={settings.sound} onTap={() => handleToggle('sound')} />}
            />
          </Card>
        </section>

        {/* ── Тема ── */}
        <section>
          <SectionLabel text="Оформление" />
          <Card>
            <Row
              icon={settings.darkMode ? Moon : Sun}
              title={settings.darkMode ? 'Тёмная тема' : 'Светлая тема'}
              sub="Переключить оформление"
              right={<Toggle on={settings.darkMode} onTap={() => handleToggle('darkMode')} />}
            />
          </Card>
        </section>

        {/* ── Данные ── */}
        <section>
          <SectionLabel text="Данные" />
          <Card>
            <Row
              icon={Trash2}
              title="Очистить историю"
              sub={cleared ? 'Очищено ✓' : 'Удалить все записи сканирований'}
              onClick={clearHistory}
              danger
              right={<ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />}
            />
          </Card>
        </section>

        {/* ── Обновление ── */}
        <section>
          <SectionLabel text="Обновление" />
          <Card>
            <Row
              icon={Download}
              title="Загрузить обновление"
              sub="Установить новую версию APK"
              onClick={() => {
                vibrate(20);
                // Opens file picker to install APK manually
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.apk';
                input.onchange = () => {
                  if (input.files?.[0]) {
                    const url = URL.createObjectURL(input.files[0]);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = input.files[0].name;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                };
                input.click();
              }}
              right={<ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />}
            />
            <Separator />
            <Row
              icon={RefreshCw}
              title="Проверить обновления"
              sub="Открыть страницу загрузки"
              onClick={() => {
                vibrate(20);
                // Try to open GitHub releases — user puts their repo URL here
                const repoUrl = localStorage.getItem('update-url');
                if (repoUrl) {
                  window.open(repoUrl, '_blank');
                } else {
                  const url = prompt('Вставьте ссылку на страницу с обновлениями\n(например, ссылку на ваш GitHub репозиторий):');
                  if (url) {
                    localStorage.setItem('update-url', url);
                    window.open(url, '_blank');
                  }
                }
              }}
              right={<ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />}
            />
          </Card>
        </section>

        {/* ── Версия ── */}
        <section>
          <Card>
            <div className="flex items-center gap-3.5 px-4 py-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--accent)' }}>
                <Radio size={20} color="white" />
              </div>
              <div>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>NFC Tester</p>
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Версия {APP_VERSION}</p>
              </div>
            </div>
          </Card>
        </section>

        <div className="h-2" />
      </div>
    </div>
  );
}
