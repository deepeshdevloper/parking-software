import React, { createContext, useState, useContext, ReactNode } from 'react';

interface Settings {
  detectionThreshold: number;
  enableWeatherResistance: boolean;
  ignoreHumans: boolean;
  ignoreAnimals: boolean;
  enableDarkMode: boolean;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

const defaultSettings: Settings = {
  detectionThreshold: 0.7,
  enableWeatherResistance: true,
  ignoreHumans: true,
  ignoreAnimals: true,
  enableDarkMode: false,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};