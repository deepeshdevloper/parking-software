import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { Car, CarIcon, AlertTriangle, Gauge } from 'lucide-react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement 
} from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Dashboard: React.FC = () => {
  const { settings } = useSettings();
  
  // Mock data for the dashboard
  const occupancyData = {
    labels: ['8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'],
    datasets: [
      {
        label: 'Occupancy Rate (%)',
        data: [25, 40, 65, 80, 75, 80, 85, 70, 55],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.3,
      },
    ],
  };

  const pieData = {
    labels: ['Occupied', 'Available'],
    datasets: [
      {
        data: [65, 35],
        backgroundColor: [
          'rgba(239, 68, 68, 0.7)',
          'rgba(34, 197, 94, 0.7)',
        ],
        borderColor: [
          'rgb(239, 68, 68)',
          'rgb(34, 197, 94)',
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className={`${settings.enableDarkMode ? 'text-white' : 'text-gray-800'}`}>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      {/* Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard 
          title="Total Spaces" 
          value="120" 
          icon={<CarIcon className="text-blue-500" size={24} />} 
          darkMode={settings.enableDarkMode}
        />
        <StatCard 
          title="Available Spaces" 
          value="42" 
          icon={<Car className="text-green-500" size={24} />} 
          darkMode={settings.enableDarkMode}
        />
        <StatCard 
          title="Occupancy Rate" 
          value="65%" 
          icon={<Gauge className="text-amber-500" size={24} />} 
          darkMode={settings.enableDarkMode}
        />
        <StatCard 
          title="Alert Conditions" 
          value="0" 
          icon={<AlertTriangle className="text-red-500" size={24} />} 
          darkMode={settings.enableDarkMode}
        />
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`col-span-2 p-4 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <h2 className="text-xl font-semibold mb-4">Occupancy Trend</h2>
          <Line 
            data={occupancyData} 
            options={{
              responsive: true,
              plugins: {
                legend: {
                  position: 'top' as const,
                  labels: {
                    color: settings.enableDarkMode ? 'white' : 'black',
                  }
                },
                title: {
                  display: false,
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                  ticks: {
                    color: settings.enableDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                  },
                  grid: {
                    color: settings.enableDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }
                },
                x: {
                  ticks: {
                    color: settings.enableDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
                  },
                  grid: {
                    color: settings.enableDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }
                }
              }
            }} 
          />
        </div>
        
        <div className={`p-4 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <h2 className="text-xl font-semibold mb-4">Current Occupancy</h2>
          <div className="aspect-square flex items-center justify-center">
            <Pie 
              data={pieData} 
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'bottom' as const,
                    labels: {
                      color: settings.enableDarkMode ? 'white' : 'black',
                    }
                  },
                }
              }} 
            />
          </div>
        </div>
      </div>
      
      {/* Recent activity */}
      <div className={`mt-6 p-4 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Event</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${settings.enableDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              <ActivityRow time="16:45" event="Zone A scan completed" status="Success" darkMode={settings.enableDarkMode} />
              <ActivityRow time="16:30" event="Weather compensation activated" status="Info" darkMode={settings.enableDarkMode} />
              <ActivityRow time="16:15" event="Non-vehicle object filtered" status="Info" darkMode={settings.enableDarkMode} />
              <ActivityRow time="16:00" event="Zone B scan completed" status="Success" darkMode={settings.enableDarkMode} />
              <ActivityRow time="15:45" event="Low light condition detected" status="Warning" darkMode={settings.enableDarkMode} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  darkMode: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, darkMode }) => {
  return (
    <div className={`p-4 rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className="p-3 rounded-full bg-opacity-10 bg-blue-500">{icon}</div>
      </div>
    </div>
  );
};

interface ActivityRowProps {
  time: string;
  event: string;
  status: 'Success' | 'Warning' | 'Info';
  darkMode: boolean;
}

const ActivityRow: React.FC<ActivityRowProps> = ({ time, event, status, darkMode }) => {
  const statusColors = {
    Success: 'text-green-500',
    Warning: 'text-amber-500',
    Info: 'text-blue-500'
  };
  
  return (
    <tr className={`${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
      <td className="px-6 py-4 whitespace-nowrap text-sm">{time}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">{event}</td>
      <td className={`px-6 py-4 whitespace-nowrap text-sm ${statusColors[status]}`}>{status}</td>
    </tr>
  );
};

export default Dashboard;