import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Settings {
  vibration: boolean;
  sound: boolean;
  notifications: boolean;
  darkMode: boolean;
  autoScan: boolean;
}

interface SettingsContextType {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  vibrate: (pattern?: number | number[]) => void;
  playSound: () => void;
}

const defaultSettings: Settings = {
  vibration: true,
  sound: true,
  notifications: true,
  darkMode: true,
  autoScan: false,
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem('nfc-settings');
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('nfc-settings', JSON.stringify(settings));
  }, [settings]);

  // Apply theme
  useEffect(() => {
    document.documentElement.classList.toggle('light', !settings.darkMode);
    document.documentElement.classList.toggle('dark', settings.darkMode);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', settings.darkMode ? '#09090b' : '#ffffff');
    }
  }, [settings.darkMode]);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const vibrate = (pattern: number | number[] = 50) => {
    if (settings.vibration && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const playSound = () => {
    if (settings.sound) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.1;
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, vibrate, playSound }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
