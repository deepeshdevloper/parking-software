import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { Github, Mail, Globe, Camera, Users, Cloud, Shield, Cpu } from 'lucide-react';

const About: React.FC = () => {
  const { settings } = useSettings();
  
  return (
    <div className={`${settings.enableDarkMode ? 'text-white' : 'text-gray-800'}`}>
      <h1 className="text-2xl font-bold mb-6">About ParkSense AI</h1>
      
      <div className={`p-6 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow mb-6`}>
        <h2 className="text-xl font-semibold mb-4">Overview</h2>
        <p className="mb-4">
          ParkSense AI is an advanced parking space detection system designed to identify empty and occupied parking spaces 
          using computer vision and machine learning technologies. The system works with both static images and live video 
          feeds from cameras installed in parking areas.
        </p>
        <p>
          Our robust algorithms are designed to work in various environmental conditions, including different 
          weather conditions, varying lighting, and can filter out non-vehicle objects such as humans and animals 
          for accurate detection results.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className={`p-6 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <h2 className="text-xl font-semibold mb-4">Key Features</h2>
          <ul className="space-y-3">
            <FeatureItem 
              icon={<Camera size={20} />}
              title="Multi-source Input"
              description="Process both static images and live video feeds from cameras"
            />
            <FeatureItem 
              icon={<Cloud size={20} />}
              title="Weather Resistant"
              description="Accurate detection in rain, snow, and varying light conditions"
            />
            <FeatureItem 
              icon={<Users size={20} />}
              title="Object Filtering"
              description="Ignore humans, animals, and other non-vehicle objects"
            />
            <FeatureItem 
              icon={<Cpu size={20} />}
              title="Real-time Processing"
              description="Fast detection and analysis for immediate results"
            />
          </ul>
        </div>
        
        <div className={`p-6 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <h2 className="text-xl font-semibold mb-4">Technology</h2>
          <p className="mb-4">
            ParkSense AI leverages state-of-the-art technologies:
          </p>
          <ul className="list-disc pl-5 space-y-2 mb-4">
            <li>TensorFlow.js for in-browser machine learning</li>
            <li>React for the user interface</li>
            <li>Computer vision algorithms for object detection</li>
            <li>Weather-resistant image processing techniques</li>
            <li>Real-time data analytics and visualization</li>
          </ul>
          <p>
            All processing happens locally in your browser, ensuring privacy and reducing the need for server infrastructure.
          </p>
        </div>
      </div>
      
      <div className={`p-6 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow mb-6`}>
        <h2 className="text-xl font-semibold mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StepCard 
            number="1"
            title="Input Source"
            description="Upload an image or connect to a live camera feed from your parking area"
            darkMode={settings.enableDarkMode}
          />
          <StepCard 
            number="2"
            title="AI Processing"
            description="Our algorithms analyze the image to identify parking spaces and detect vehicles"
            darkMode={settings.enableDarkMode}
          />
          <StepCard 
            number="3"
            title="Results & Analysis"
            description="View detection results with visual indicators and occupancy statistics"
            darkMode={settings.enableDarkMode}
          />
        </div>
      </div>
      
      <div className={`p-6 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
        <h2 className="text-xl font-semibold mb-4">Contact & Support</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="mb-4">
              Have questions or feedback about ParkSense AI? We'd love to hear from you!
            </p>
            <div className="space-y-3">
              <ContactItem 
                icon={<Mail size={20} />}
                label="Email"
                value="support@parksense.ai"
              />
              <ContactItem 
                icon={<Globe size={20} />}
                label="Website"
                value="www.parksense.ai"
              />
              <ContactItem 
                icon={<Github size={20} />}
                label="GitHub"
                value="github.com/parksense-ai"
              />
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Privacy & Security</h3>
            <div className="flex mb-4">
              <Shield size={20} className="mr-2 flex-shrink-0 text-green-500" />
              <p className={settings.enableDarkMode ? 'text-gray-300' : 'text-gray-600'}>
                ParkSense AI processes all data locally in your browser. No images or video feeds are sent 
                to external servers, ensuring your data remains private and secure.
              </p>
            </div>
            <h3 className="font-semibold mb-2">Version</h3>
            <p className={settings.enableDarkMode ? 'text-gray-300' : 'text-gray-600'}>
              ParkSense AI v1.0.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FeatureItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title, description }) => {
  return (
    <li className="flex">
      <div className="mr-3 text-blue-500">{icon}</div>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </li>
  );
};

interface StepCardProps {
  number: string;
  title: string;
  description: string;
  darkMode: boolean;
}

const StepCard: React.FC<StepCardProps> = ({ number, title, description, darkMode }) => {
  return (
    <div className={`p-4 rounded-lg border ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold mb-3">
        {number}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{description}</p>
    </div>
  );
};

interface ContactItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const ContactItem: React.FC<ContactItemProps> = ({ icon, label, value }) => {
  return (
    <div className="flex items-center">
      <div className="mr-2 text-blue-500">{icon}</div>
      <div>
        <span className="font-medium mr-2">{label}:</span>
        <span className="text-gray-500 dark:text-gray-400">{value}</span>
      </div>
    </div>
  );
};

export default About;