import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { Save, RefreshCw, Smartphone, Monitor, Tablet } from 'lucide-react';

const Settings: React.FC = () => {
  const { settings, updateSettings, isMobile, isTablet } = useSettings();
  
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
    <div className={`${settings.enableDarkMode ? 'text-white' : 'text-gray-800'} space-y-4 sm:space-y-6`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Settings</h1>
        <div className="flex items-center gap-2 text-sm">
          {isMobile && <Smartphone size={16} className="text-blue-500" />}
          {isTablet && <Tablet size={16} className="text-blue-500" />}
          {!isMobile && !isTablet && <Monitor size={16} className="text-blue-500" />}
          <span className={settings.enableDarkMode ? 'text-gray-400' : 'text-gray-600'}>
            {isMobile ? 'Mobile View' : isTablet ? 'Tablet View' : 'Desktop View'}
          </span>
        </div>
      </div>
      
      <div className={`p-4 sm:p-6 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm sm:shadow-md`}>
        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
          {/* Detection Settings */}
          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Detection Settings</h2>
            
            <div className="space-y-4 sm:space-y-6">
              <div>
                <label htmlFor="detectionThreshold" className="block font-medium mb-2 text-sm sm:text-base">
                  Detection Threshold ({formValues.detectionThreshold.toFixed(2)})
                </label>
                <div className="space-y-2">
                  <input
                    type="range"
                    id="detectionThreshold"
                    name="detectionThreshold"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={formValues.detectionThreshold}
                    onChange={handleInputChange}
                    className={`w-full ${isMobile ? 'h-2' : 'h-3'} bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer slider`}
                  />
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className={settings.enableDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                      Low Sensitivity
                    </span>
                    <span className={settings.enableDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                      High Sensitivity
                    </span>
                  </div>
                </div>
                <p className={`text-xs sm:text-sm mt-2 ${settings.enableDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Higher values require more confidence to detect occupied spaces
                </p>
              </div>
              
              <div className="space-y-3 sm:space-y-4">
                <SettingToggle
                  id="enableWeatherResistance"
                  name="enableWeatherResistance"
                  checked={formValues.enableWeatherResistance}
                  onChange={handleInputChange}
                  title="Enable Weather Resistance"
                  description="Improves detection accuracy in rain, snow, and varying light conditions"
                  darkMode={settings.enableDarkMode}
                  isMobile={isMobile}
                />
                
                <SettingToggle
                  id="ignoreHumans"
                  name="ignoreHumans"
                  checked={formValues.ignoreHumans}
                  onChange={handleInputChange}
                  title="Ignore Humans"
                  description="Filters out pedestrians from being counted as parked vehicles"
                  darkMode={settings.enableDarkMode}
                  isMobile={isMobile}
                />
                
                <SettingToggle
                  id="ignoreAnimals"
                  name="ignoreAnimals"
                  checked={formValues.ignoreAnimals}
                  onChange={handleInputChange}
                  title="Ignore Animals"
                  description="Prevents animals from being detected as vehicles"
                  darkMode={settings.enableDarkMode}
                  isMobile={isMobile}
                />
              </div>
            </div>
          </div>
          
          {/* Interface Settings */}
          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Interface Settings</h2>
            
            <SettingToggle
              id="enableDarkMode"
              name="enableDarkMode"
              checked={formValues.enableDarkMode}
              onChange={handleInputChange}
              title="Dark Mode"
              description="Switch between light and dark interface theme"
              darkMode={settings.enableDarkMode}
              isMobile={isMobile}
            />
          </div>
          
          {/* Device Information */}
          <div className={`p-3 sm:p-4 rounded-lg border ${
            settings.enableDarkMode ? 'border-gray-700 bg-gray-700/50' : 'border-gray-200 bg-gray-50'
          }`}>
            <h3 className="font-medium mb-2 text-sm sm:text-base">Device Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isMobile ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span>Mobile: {isMobile ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isTablet ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span>Tablet: {isTablet ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${!isMobile && !isTablet ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span>Desktop: {!isMobile && !isTablet ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className={`flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 border-t ${
            settings.enableDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 sm:py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors text-sm sm:text-base font-medium"
            >
              <Save size={isMobile ? 16 : 18} />
              Save Settings
            </button>
            
            <button
              type="button"
              onClick={resetToDefaults}
              className={`w-full sm:w-auto px-4 py-2 sm:py-3 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm sm:text-base font-medium ${
                settings.enableDarkMode 
                  ? 'bg-gray-700 text-white hover:bg-gray-600' 
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              <RefreshCw size={isMobile ? 16 : 18} />
              Reset to Defaults
            </button>
            
            {saved && (
              <div className="w-full sm:w-auto sm:ml-auto px-4 py-2 sm:py-3 bg-green-100 text-green-800 dark:bg-green-800 dark:bg-opacity-30 dark:text-green-200 rounded-lg text-center text-sm sm:text-base font-medium">
                Settings saved successfully
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

interface SettingToggleProps {
  id: string;
  name: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  title: string;
  description: string;
  darkMode: boolean;
  isMobile: boolean;
}

const SettingToggle: React.FC<SettingToggleProps> = ({
  id,
  name,
  checked,
  onChange,
  title,
  description,
  darkMode,
  isMobile
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={id}
          name={name}
          checked={checked}
          onChange={onChange}
          className={`${isMobile ? 'w-4 h-4 mt-0.5' : 'w-5 h-5 mt-0.5'} text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 transition-all duration-200`}
        />
        <div className="flex-1 min-w-0">
          <label htmlFor={id} className={`font-medium cursor-pointer ${isMobile ? 'text-sm' : 'text-base'}`}>
            {title}
          </label>
          <p className={`${isMobile ? 'text-xs' : 'text-sm'} leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;