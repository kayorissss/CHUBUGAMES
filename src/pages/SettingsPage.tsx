import { motion } from 'framer-motion';
import { Bell, Vibrate, Volume2, Moon, Sun, Smartphone, Shield, Info, Trash2 } from 'lucide-react';
import Card from '../components/Card';
import { useSettings } from '../context/SettingsContext';

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="relative w-12 h-7 rounded-full cursor-pointer shrink-0 transition-colors duration-200"
      style={{ background: on ? 'var(--accent)' : 'var(--border-color)' }}
    >
      <motion.div
        className="absolute top-0.5 w-6 h-6 rounded-full shadow-md"
        style={{ background: on ? 'white' : 'var(--text-muted)' }}
        animate={{ left: on ? 22 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

function SettingRow({
  icon: Icon,
  title,
  subtitle,
  right,
  onClick,
}: {
  icon: typeof Bell;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 ${onClick ? 'cursor-pointer active:opacity-70' : ''}`}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(220,38,38,0.1)' }}
      >
        <Icon size={18} style={{ color: 'var(--accent)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</p>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border-color)', marginLeft: 56 }} />;
}

export default function SettingsPage() {
  const { settings, updateSetting, vibrate } = useSettings();

  const toggle = (key: keyof typeof settings) => {
    vibrate(20);
    updateSetting(key, !settings[key]);
  };

  const clearHistory = () => {
    vibrate(30);
    localStorage.removeItem('nfc-history');
    alert('История очищена');
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto pb-20">
      {/* Header */}
      <header className="text-center px-6 pt-8 pb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Настройки
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Параметры приложения
        </p>
      </header>

      <div className="px-4 space-y-6">
        {/* Feedback */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
            Обратная связь
          </p>
          <Card>
            <SettingRow
              icon={Vibrate}
              title="Вибрация"
              subtitle="Вибрировать при событиях"
              right={<Toggle on={settings.vibration} onChange={() => toggle('vibration')} />}
            />
            <Divider />
            <SettingRow
              icon={Volume2}
              title="Звук"
              subtitle="Звуковые уведомления"
              right={<Toggle on={settings.sound} onChange={() => toggle('sound')} />}
            />
            <Divider />
            <SettingRow
              icon={Bell}
              title="Уведомления"
              subtitle="Push-уведомления"
              right={<Toggle on={settings.notifications} onChange={() => toggle('notifications')} />}
            />
          </Card>
        </section>

        {/* Appearance */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
            Внешний вид
          </p>
          <Card>
            <SettingRow
              icon={settings.darkMode ? Moon : Sun}
              title="Тема"
              subtitle={settings.darkMode ? 'Тёмная тема' : 'Светлая тема'}
              right={<Toggle on={settings.darkMode} onChange={() => toggle('darkMode')} />}
            />
          </Card>
        </section>

        {/* NFC */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
            NFC
          </p>
          <Card>
            <SettingRow
              icon={Smartphone}
              title="Авто-сканирование"
              subtitle="Автоматически начинать сканирование"
              right={<Toggle on={settings.autoScan} onChange={() => toggle('autoScan')} />}
            />
            <Divider />
            <SettingRow
              icon={Shield}
              title="Безопасность"
              subtitle="Данные хранятся локально"
              right={
                <span className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success)' }}>
                  Защищено
                </span>
              }
            />
          </Card>
        </section>

        {/* Data */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
            Данные
          </p>
          <Card>
            <SettingRow
              icon={Trash2}
              title="Очистить историю"
              subtitle="Удалить все записи сканирований"
              onClick={clearHistory}
              right={<span style={{ color: 'var(--accent)' }}>→</span>}
            />
          </Card>
        </section>

        {/* About */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
            О приложении
          </p>
          <Card>
            <SettingRow
              icon={Info}
              title="NFC Tester"
              subtitle="Версия 1.0.0"
            />
          </Card>
        </section>

        {/* Info box */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-4"
          style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.1)' }}
        >
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Совет:</span> Для работы NFC сканера
            откройте приложение в Chrome на Android. Web NFC API работает только через HTTPS и требует
            разрешения на доступ к NFC.
          </p>
        </motion.div>

        <div className="h-4" />
      </div>
    </div>
  );
}
