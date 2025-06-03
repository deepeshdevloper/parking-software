import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { Save, RefreshCw } from 'lucide-react';

const Settings: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  
  // Create local state to track form values
  const [formValues, setFormValues] = useState({
    detectionThreshold: settings.detectionThreshold,
    enableWeatherResistance: settings.enableWeatherResistance,
    ignoreHumans: settings.ignoreHumans,
    ignoreAnimals: settings.ignoreAnimals,
    enableDarkMode: settings.enableDarkMode,
  });
  
  const [saved, setSaved] = useState(false);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    setFormValues((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) : value,
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formValues);
    
    // Show saved indicator
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  
  const resetToDefaults = () => {
    const defaultSettings = {
      detectionThreshold: 0.7,
      enableWeatherResistance: true,
      ignoreHumans: true,
      ignoreAnimals: true,
      enableDarkMode: false,
    };
    
    setFormValues(defaultSettings);
    updateSettings(defaultSettings);
    
    // Show saved indicator
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  
  return (
    <div className={`${settings.enableDarkMode ? 'text-white' : 'text-gray-800'}`}>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className={`p-6 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
        <form onSubmit={handleSubmit}>
          {/* Detection Settings */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Detection Settings</h2>
            
            <div className="mb-4">
              <label htmlFor="detectionThreshold" className="block font-medium mb-1">
                Detection Threshold ({formValues.detectionThreshold})
              </label>
              <input
                type="range"
                id="detectionThreshold"
                name="detectionThreshold"
                min="0.1"
                max="0.9"
                step="0.05"
                value={formValues.detectionThreshold}
                onChange={handleInputChange}
                className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs mt-1">
                <span>Low Sensitivity</span>
                <span>High Sensitivity</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enableWeatherResistance"
                  name="enableWeatherResistance"
                  checked={formValues.enableWeatherResistance}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label htmlFor="enableWeatherResistance" className="ml-2 font-medium">
                  Enable Weather Resistance
                </label>
              </div>
              <p className={`text-sm pl-6 ${settings.enableDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Improves detection accuracy in rain, snow, and varying light conditions
              </p>
              
              <div className="flex items-center pt-2">
                <input
                  type="checkbox"
                  id="ignoreHumans"
                  name="ignoreHumans"
                  checked={formValues.ignoreHumans}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label htmlFor="ignoreHumans" className="ml-2 font-medium">
                  Ignore Humans
                </label>
              </div>
              <p className={`text-sm pl-6 ${settings.enableDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Filters out pedestrians from being counted as parked vehicles
              </p>
              
              <div className="flex items-center pt-2">
                <input
                  type="checkbox"
                  id="ignoreAnimals"
                  name="ignoreAnimals"
                  checked={formValues.ignoreAnimals}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label htmlFor="ignoreAnimals" className="ml-2 font-medium">
                  Ignore Animals
                </label>
              </div>
              <p className={`text-sm pl-6 ${settings.enableDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Prevents animals from being detected as vehicles
              </p>
            </div>
          </div>
          
          {/* Interface Settings */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Interface Settings</h2>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="enableDarkMode"
                name="enableDarkMode"
                checked={formValues.enableDarkMode}
                onChange={handleInputChange}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <label htmlFor="enableDarkMode" className="ml-2 font-medium">
                Dark Mode
              </label>
            </div>
            <p className={`text-sm pl-6 ${settings.enableDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Switch between light and dark interface theme
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center hover:bg-blue-700 transition-colors"
            >
              <Save size={18} className="mr-2" />
              Save Settings
            </button>
            
            <button
              type="button"
              onClick={resetToDefaults}
              className={`px-4 py-2 rounded-lg flex items-center transition-colors ${
                settings.enableDarkMode 
                  ? 'bg-gray-700 text-white hover:bg-gray-600' 
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              <RefreshCw size={18} className="mr-2" />
              Reset to Defaults
            </button>
            
            {saved && (
              <span className="px-4 py-2 bg-green-100 text-green-800 dark:bg-green-800 dark:bg-opacity-30 dark:text-green-200 rounded-lg ml-auto">
                Settings saved successfully
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;