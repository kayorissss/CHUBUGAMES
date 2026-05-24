import { motion } from 'framer-motion';
import { Nfc, Radar, Settings } from 'lucide-react';

export type TabType = 'check' | 'scan' | 'settings';

interface Props {
  active: TabType;
  onChange: (t: TabType) => void;
}

const tabs: { id: TabType; icon: typeof Nfc; label: string }[] = [
  { id: 'check', icon: Nfc, label: 'Проверка' },
  { id: 'scan', icon: Radar, label: 'Сканер' },
  { id: 'settings', icon: Settings, label: 'Настройки' },
];

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* frosted glass bar */}
      <div
        className="mx-auto max-w-md"
        style={{
          background: 'rgba(12,12,14,0.72)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="grid grid-cols-3 h-[60px]">
          {tabs.map((t) => {
            const on = active === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onChange(t.id)}
                className="relative flex flex-col items-center justify-center gap-[3px] cursor-pointer"
              >
                {on && (
                  <motion.span
                    layoutId="pill"
                    className="absolute -top-px left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full"
                    style={{ background: '#dc2626' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <t.icon
                  size={20}
                  strokeWidth={on ? 2.2 : 1.6}
                  className="transition-colors duration-200"
                  color={on ? '#ef4444' : '#52525b'}
                />
                <span
                  className="text-[10px] font-medium transition-colors duration-200"
                  style={{ color: on ? '#ef4444' : '#52525b' }}
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
