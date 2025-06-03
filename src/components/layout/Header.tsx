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
    <header className={`z-10 py-4 px-6 shadow-md ${settings.enableDarkMode ? 'bg-gray-800 text-white' : 'bg-white'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mr-4 md:hidden focus:outline-none"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-blue-600 rounded-md flex items-center justify-center">
              <span className="text-white font-bold">PS</span>
            </div>
            <span className="text-xl font-bold">ParkSense AI</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none"
            aria-label="Toggle dark mode"
          >
            {settings.enableDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none"
            aria-label="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;