import React from 'react';
import { useSettings } from '../context/SettingsContext';
import { Github, Mail, Globe, Camera, Users, Cloud, Shield, Cpu, Smartphone, Monitor, Tablet } from 'lucide-react';

const About: React.FC = () => {
  const { settings, isMobile, isTablet } = useSettings();
  
  return (
    <div className={`${settings.enableDarkMode ? 'text-white' : 'text-gray-800'} space-y-4 sm:space-y-6`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">About Divya Drishti (दिव्य  दृष्टि)</h1>
        <div className="flex items-center gap-2 text-sm">
          {isMobile && <Smartphone size={16} className="text-blue-500" />}
          {isTablet && <Tablet size={16} className="text-blue-500" />}
          {!isMobile && !isTablet && <Monitor size={16} className="text-blue-500" />}
          <span className={settings.enableDarkMode ? 'text-gray-400' : 'text-gray-600'}>
            Optimized for {isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}
          </span>
        </div>
      </div>
      
      <div className={`p-4 sm:p-6 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm sm:shadow-md`}>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Overview</h2>
        <div className="space-y-3 sm:space-y-4">
          <p className="text-sm sm:text-base leading-relaxed">
          Divya Drishti (दिव्य  दृष्टि) is an advanced parking space detection system designed to identify empty and occupied parking spaces 
            using computer vision and machine learning technologies. The system works with both static images and live video 
            feeds from cameras installed in parking areas.
          </p>
          <p className="text-sm sm:text-base leading-relaxed">
            Our robust algorithms are designed to work in various environmental conditions, including different 
            weather conditions, varying lighting, and can filter out non-vehicle objects such as humans and animals 
            for accurate detection results.
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className={`p-4 sm:p-6 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm sm:shadow-md`}>
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Key Features</h2>
          <div className="space-y-3 sm:space-y-4">
            <FeatureItem 
              icon={<Camera size={isMobile ? 18 : 20} />}
              title="Multi-source Input"
              description="Process both static images and live video feeds from cameras"
              isMobile={isMobile}
            />
            <FeatureItem 
              icon={<Cloud size={isMobile ? 18 : 20} />}
              title="Weather Resistant"
              description="Accurate detection in rain, snow, and varying light conditions"
              isMobile={isMobile}
            />
            <FeatureItem 
              icon={<Users size={isMobile ? 18 : 20} />}
              title="Object Filtering"
              description="Ignore humans, animals, and other non-vehicle objects"
              isMobile={isMobile}
            />
            <FeatureItem 
              icon={<Cpu size={isMobile ? 18 : 20} />}
              title="Real-time Processing"
              description="Fast detection and analysis for immediate results"
              isMobile={isMobile}
            />
          </div>
        </div>
        
        <div className={`p-4 sm:p-6 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm sm:shadow-md`}>
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Technology</h2>
          <div className="space-y-3 sm:space-y-4">
            <p className="text-sm sm:text-base leading-relaxed">
            Divya Drishti (दिव्य  दृष्टि) leverages state-of-the-art technologies:
            </p>
            <ul className="list-disc pl-4 sm:pl-5 space-y-1 sm:space-y-2 text-sm sm:text-base">
              <li>TensorFlow.js for in-browser machine learning</li>
              <li>React for the user interface</li>
              <li>Computer vision algorithms for object detection</li>
              <li>Weather-resistant image processing techniques</li>
              <li>Real-time data analytics and visualization</li>
            </ul>
            <p className="text-sm sm:text-base leading-relaxed">
              All processing happens locally in your browser, ensuring privacy and reducing the need for server infrastructure.
            </p>
          </div>
        </div>
      </div>
      
      <div className={`p-4 sm:p-6 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm sm:shadow-md`}>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <StepCard 
            number="1"
            title="Input Source"
            description="Upload an image or connect to a live camera feed from your parking area"
            darkMode={settings.enableDarkMode}
            isMobile={isMobile}
          />
          <StepCard 
            number="2"
            title="AI Processing"
            description="Our algorithms analyze the image to identify parking spaces and detect vehicles"
            darkMode={settings.enableDarkMode}
            isMobile={isMobile}
          />
          <StepCard 
            number="3"
            title="Results & Analysis"
            description="View detection results with visual indicators and occupancy statistics"
            darkMode={settings.enableDarkMode}
            isMobile={isMobile}
          />
        </div>
      </div>
      
      <div className={`p-4 sm:p-6 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm sm:shadow-md`}>
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Contact & Support</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-3 sm:space-y-4">
            <p className="text-sm sm:text-base leading-relaxed">
              Have questions or feedback about Divya Drishti (दिव्य  दृष्टि)? We'd love to hear from you!
            </p>
            <div className="space-y-2 sm:space-y-3">
              <ContactItem 
                icon={<Mail size={isMobile ? 18 : 20} />}
                label="Email"
                value="support@Divya Drishti (दिव्य  दृष्टि)"
                isMobile={isMobile}
              />
              <ContactItem 
                icon={<Globe size={isMobile ? 18 : 20} />}
                label="Website"
                value="www.Divya Drishti (दिव्य  दृष्टि)"
                isMobile={isMobile}
              />
              <ContactItem 
                icon={<Github size={isMobile ? 18 : 20} />}
                label="GitHub"
                value="github.com/Divya Drishti (दिव्य  दृष्टि)"
                isMobile={isMobile}
              />
            </div>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <h3 className="font-semibold mb-2 text-sm sm:text-base">Privacy & Security</h3>
              <div className="flex items-start gap-2 sm:gap-3">
                <Shield size={isMobile ? 18 : 20} className="mt-0.5 flex-shrink-0 text-green-500" />
                <p className={`text-xs sm:text-sm leading-relaxed ${settings.enableDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Divya Drishti (दिव्य  दृष्टि) processes all data locally in your browser. No images or video feeds are sent 
                  to external servers, ensuring your data remains private and secure.
                </p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-sm sm:text-base">Version</h3>
              <p className={`text-xs sm:text-sm ${settings.enableDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Divya Drishti (दिव्य  दृष्टि) v1.0.0
              </p>
            </div>
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
  isMobile: boolean;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title, description, isMobile }) => {
  return (
    <div className="flex items-start gap-2 sm:gap-3">
      <div className="mt-0.5 text-blue-500 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <h3 className="font-medium text-sm sm:text-base">{title}</h3>
        <p className={`text-xs sm:text-sm leading-relaxed text-gray-500 dark:text-gray-400 ${isMobile ? 'mt-1' : 'mt-0.5'}`}>
          {description}
        </p>
      </div>
    </div>
  );
};

interface StepCardProps {
  number: string;
  title: string;
  description: string;
  darkMode: boolean;
  isMobile: boolean;
}

const StepCard: React.FC<StepCardProps> = ({ number, title, description, darkMode, isMobile }) => {
  return (
    <div className={`p-3 sm:p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${
      darkMode ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'
    }`}>
      <div className={`${isMobile ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm'} rounded-full bg-blue-500 text-white flex items-center justify-center font-bold mb-2 sm:mb-3`}>
        {number}
      </div>
      <h3 className="font-semibold mb-1 sm:mb-2 text-sm sm:text-base">{title}</h3>
      <p className={`text-xs sm:text-sm leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        {description}
      </p>
    </div>
  );
};

interface ContactItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  isMobile: boolean;
}

const ContactItem: React.FC<ContactItemProps> = ({ icon, label, value, isMobile }) => {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="text-blue-500 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <span className={`font-medium ${isMobile ? 'text-sm' : 'text-base'}`}>{label}:</span>
        <span className={`ml-1 sm:ml-2 text-gray-500 dark:text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'} break-all`}>
          {value}
        </span>
      </div>
    </div>
  );
};

export default About;