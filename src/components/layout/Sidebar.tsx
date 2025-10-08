import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Video, 
  Upload, 
  Settings as SettingsIcon, 
  Info, 
  X 
} from 'lucide-react';
import { routes } from '../../routes';
import { useSettings } from '../../context/SettingsContext';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { settings } = useSettings();
  
  const icons: Record<string, React.ReactNode> = {
    'Dashboard': <LayoutDashboard size={20} />,
    'Live Detection': <Video size={20} />,
    'Image Upload': <Upload size={20} />,
    'Settings': <SettingsIcon size={20} />,
    'About': <Info size={20} />
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black bg-opacity-50 transition-opacity duration-300 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
          ${settings.enableDarkMode ? 'bg-gray-800 text-white border-r border-gray-700' : 'bg-white text-gray-800 border-r border-gray-200'} 
          fixed inset-y-0 left-0 z-40 w-64 sm:w-72 transition-transform duration-300 ease-in-out 
          lg:translate-x-0 lg:static lg:z-0 shadow-xl lg:shadow-none
          flex flex-col
        `}
      >
        {/* Mobile header */}
        <div className="flex items-center justify-between p-4 sm:p-6 lg:hidden border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">DD</span>
            </div>
            <div>
              <span className="text-lg font-bold">Divya Drishti (दिव्य  दृष्टि)</span>
              <p className={`text-xs ${settings.enableDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Smart Parking Detection
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className={`p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              settings.enableDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Desktop header */}
        <div className="hidden lg:flex items-center space-x-3 p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="h-10 w-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-md">
            <span className="text-white font-bold">DD</span>
          </div>
          <div>
            <span className="text-xl font-bold">Divya Drishti </span>
            <p className={`text-sm ${settings.enableDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Smart Parking Detection
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 sm:p-6 space-y-2 overflow-y-auto">
          {routes.map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) => `
                flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group
                ${isActive 
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg transform scale-[1.02]' 
                  : `${settings.enableDarkMode 
                      ? 'hover:bg-gray-700 text-gray-300 hover:text-white' 
                      : 'hover:bg-gray-100 text-gray-700 hover:text-gray-900'
                    } hover:transform hover:scale-[1.01]`
                }
              `}
            >
              <span className={`transition-transform duration-200 ${
                'group-hover:scale-110'
              }`}>
                {icons[route.name]}
              </span>
              <span className="font-medium">{route.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className={`p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 ${
          settings.enableDarkMode ? 'text-gray-400' : 'text-gray-500'
        }`}>
          <div className="text-center">
            <p className="text-sm font-medium">Divya Drishti (दिव्य  दृष्टि)</p>
            <p className="text-xs mt-1">Version 1.0.0</p>
            <div className="mt-3 flex justify-center">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="ml-2 text-xs">System Online</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;