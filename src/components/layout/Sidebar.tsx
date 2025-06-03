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
          className="fixed inset-0 z-20 bg-black bg-opacity-50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
          ${settings.enableDarkMode ? 'bg-gray-800 text-white' : 'bg-white'} 
          fixed inset-y-0 left-0 z-30 w-64 transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:z-0
        `}
      >
        <div className="flex h-full flex-col">
          {/* Mobile close button */}
          <div className="flex items-center justify-between p-4 md:hidden">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-blue-600 rounded-md flex items-center justify-center">
                <span className="text-white font-bold">PS</span>
              </div>
              <span className="text-xl font-bold">ParkSense AI</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none"
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {routes.map((route) => (
              <NavLink
                key={route.path}
                to={route.path}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) => `
                  flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                  ${isActive 
                    ? 'bg-blue-600 text-white' 
                    : `${settings.enableDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`
                  }
                `}
              >
                {icons[route.name]}
                <span>{route.name}</span>
              </NavLink>
            ))}
          </nav>

          {/* Footer */}
          <div className={`p-4 text-sm ${settings.enableDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <p>ParkSense AI v1.0.0</p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;