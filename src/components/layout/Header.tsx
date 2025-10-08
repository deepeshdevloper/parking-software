import React from 'react';
import { Menu, Moon, Sun, Settings } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ sidebarOpen, setSidebarOpen }) => {
  const { settings, updateSettings } = useSettings();
  const navigate = useNavigate();

  const toggleDarkMode = () => {
    updateSettings({ enableDarkMode: !settings.enableDarkMode });
  };

  return (
    <header className={`sticky top-0 z-20 py-3 px-4 sm:py-4 sm:px-6 shadow-lg backdrop-blur-sm transition-all duration-300 ${
      settings.enableDarkMode 
        ? 'bg-gray-800/95 text-white border-b border-gray-700' 
        : 'bg-white/95 text-gray-800 border-b border-gray-200'
    }`}>
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`mr-3 sm:mr-4 p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 lg:hidden ${
              settings.enableDarkMode 
                ? 'hover:bg-gray-700 active:bg-gray-600' 
                : 'hover:bg-gray-100 active:bg-gray-200'
            }`}
            aria-label="Toggle sidebar"
          >
            <Menu size={20} className="sm:w-6 sm:h-6" />
          </button>
          
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-sm sm:text-base">DD</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold truncate">
              Divya Drishti (दिव्य  दृष्टि)
              </h1>
              <p className={`text-xs sm:text-sm hidden sm:block ${
                settings.enableDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Smart Parking Detection
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={toggleDarkMode}
            className={`p-2 sm:p-2.5 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              settings.enableDarkMode 
                ? 'hover:bg-gray-700 text-yellow-400 hover:text-yellow-300' 
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800'
            }`}
            aria-label="Toggle dark mode"
          >
            {settings.enableDarkMode ? <Sun size={18} className="sm:w-5 sm:h-5" /> : <Moon size={18} className="sm:w-5 sm:h-5" />}
          </button>
          
          <button
            onClick={() => navigate('/settings')}
            className={`p-2 sm:p-2.5 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              settings.enableDarkMode 
                ? 'hover:bg-gray-700 text-gray-300 hover:text-white' 
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800'
            }`}
            aria-label="Settings"
          >
            <Settings size={18} className="sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;