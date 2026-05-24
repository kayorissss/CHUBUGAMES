import { motion } from 'framer-motion';
import { Cpu, Radio, Settings } from 'lucide-react';

export type TabType = 'check' | 'scan' | 'settings';

interface Props {
  active: TabType;
  onChange: (t: TabType) => void;
}

const tabs: { id: TabType; icon: typeof Cpu; label: string }[] = [
  { id: 'check', icon: Cpu, label: 'Проверка' },
  { id: 'scan', icon: Radio, label: 'Сканер' },
  { id: 'settings', icon: Settings, label: 'Настройки' },
];

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div
        className="mx-auto max-w-lg border-t"
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="grid grid-cols-3 h-16">
          {tabs.map((t) => {
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                className="relative flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-full"
                    style={{ background: 'var(--accent)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <t.icon
                  size={22}
                  strokeWidth={isActive ? 2 : 1.5}
                  style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
                />
                <span
                  className="text-[11px] font-medium"
                  style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
