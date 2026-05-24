import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export const APP_VERSION = '1.0.0';

interface Settings {
  vibration: boolean;
  sound: boolean;
  darkMode: boolean;
  autoScan: boolean;
}

interface SettingsContextType {
  settings: Settings;
  toggle: (key: keyof Settings) => void;
  vibrate: (pattern?: number | number[]) => void;
  playSound: () => void;
}

const defaults: Settings = {
  vibration: true,
  sound: true,
  darkMode: true,
  autoScan: false,
};

const Ctx = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const s = localStorage.getItem('nfc-settings');
      return s ? { ...defaults, ...JSON.parse(s) } : defaults;
    } catch { return defaults; }
  });

  useEffect(() => {
    localStorage.setItem('nfc-settings', JSON.stringify(settings));
  }, [settings]);

  // Theme
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('light', !settings.darkMode);
    root.classList.toggle('dark', settings.darkMode);
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', settings.darkMode ? '#09090b' : '#f4f4f5');
  }, [settings.darkMode]);

  const toggle = (key: keyof Settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const vibrate = (pattern: number | number[] = 40) => {
    if (settings.vibration && navigator.vibrate) navigator.vibrate(pattern);
  };

  const playSound = () => {
    if (!settings.sound) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  };

  return (
    <Ctx.Provider value={{ settings, toggle, vibrate, playSound }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() {
  const c = useContext(Ctx);
  if (!c) throw new Error('wrap in SettingsProvider');
  return c;
}
