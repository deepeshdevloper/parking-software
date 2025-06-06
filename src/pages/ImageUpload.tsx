import React, { useState, useRef, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import { Upload, X, Search, Download, Image as ImageIcon, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import { detectParkingSpaces } from '../utils/parkingDetection';
import RegionSelector from '../components/RegionSelector';

interface Region {
  id: string;
  points: { x: number; y: number; }[];
  type: 'rectangle' | 'quadrilateral';
}

interface DetectionResult {
  total: number;
  occupied: number;
  available: number;
  spaces: ParkingSpace[];
  image?: string;
}

interface ParkingSpace {
  id: number;
  region: Region;
  isOccupied: boolean;
  confidence: number;
  lastStateChange: number;
  stateHistory: boolean[];
  vehicleType?: string;
}

const ImageUpload: React.FC = () => {
  const { settings, isMobile, isTablet } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [previousResults, setPreviousResults] = useState<DetectionResult | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Reset states
    setPreviousResults(null);
    setProcessedImage(null);
    setError(null);
    setRegions([]);
    setImageSize(null);
    
    // Validate file type
    if (!file.type.match('image.*')) {
      setError('Please upload an image file (JPEG, PNG, etc.)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size should be less than 10MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const img = new Image();
        img.onload = () => {
          setImageSize({ width: img.width, height: img.height });
          // Check image dimensions
          if (img.width * img.height > 4096 * 4096) {
            setError('Image dimensions are too large. Please use a smaller image.');
            setSelectedImage(null);
            return;
          }
          setSelectedImage(e.target!.result as string);
        };
        img.src = e.target.result as string;
      }
    };
    reader.onerror = () => {
      setError('Failed to read the image file');
    };
    reader.readAsDataURL(file);
  };

  const handleProcess = async () => {
    try {
      if (!selectedImage) {
        setError('Please select an image first');
        return;
      }

      if (regions.length === 0) {
        setError('Please draw at least one region to detect parking spaces');
        return;
      }

      setIsProcessing(true);
      setError(null);

      const result = await detectParkingSpaces(
        selectedImage,
        regions,
        previousResults?.spaces || []
      );

      setPreviousResults(result);
      setProcessedImage(result.image || null);
    } catch (error) {
      console.error('Processing error:', error);
      setError('Error processing the image. Please try another image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setProcessedImage(null);
    setPreviousResults(null);
    setError(null);
    setRegions([]);
    setImageSize(null);
    setIsFullscreen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadResults = () => {
    if (!processedImage) return;
    
    const link = document.createElement('a');
    link.href = processedImage;
    link.download = 'parking-detection-results.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={`${settings.enableDarkMode ? 'text-white' : 'text-gray-800'} space-y-4 sm:space-y-6`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Image Upload</h1>
        {selectedImage && (
          <button
            onClick={toggleFullscreen}
            className={`self-start sm:self-auto px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${
              settings.enableDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        )}
      </div>
      
      <div className={`grid grid-cols-1 ${isFullscreen ? '' : 'lg:grid-cols-2'} gap-4 sm:gap-6`}>
        <div className={`${isFullscreen ? 'col-span-full' : ''} ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} p-3 sm:p-4 lg:p-6 rounded-lg shadow-sm sm:shadow-md`}>
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Upload Image</h2>
          
          {error && (
            <div className="mb-3 sm:mb-4 p-3 bg-red-500 bg-opacity-20 border border-red-500 text-red-500 rounded-lg flex items-start gap-2">
              <AlertCircle size={isMobile ? 18 : 20} className="flex-shrink-0 mt-0.5" />
              <span className="text-sm sm:text-base">{error}</span>
            </div>
          )}
          
          {!selectedImage ? (
            <div
              className={`
                border-2 border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer transition-all duration-200
                ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 scale-[1.02]' : 
                  settings.enableDarkMode ? 'border-gray-600 hover:border-gray-500' : 
                  'border-gray-300 hover:border-gray-400'}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileInputChange}
                accept="image/*"
                className="hidden"
              />
              
              <Upload size={isMobile ? 40 : 48} className="mx-auto mb-3 sm:mb-4 text-gray-400" />
              <p className="text-base sm:text-lg mb-2 font-medium">Drag and drop an image here</p>
              <p className={`text-sm ${settings.enableDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Or click to browse
              </p>
              <p className={`mt-2 text-xs ${settings.enableDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Maximum size: 10MB • Recommended: 1920x1080 or smaller
              </p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              <div className={`relative ${isFullscreen ? 'aspect-auto' : 'aspect-video'} bg-black rounded-lg overflow-hidden`}>
                <img 
                  src={selectedImage} 
                  alt="Selected" 
                  className={`w-full h-full ${isFullscreen ? 'max-h-[70vh]' : ''} object-contain`}
                />
                {imageSize && (
                  <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                    {imageSize.width} × {imageSize.height}
                  </div>
                )}
              </div>

              {!isFullscreen && (
                <RegionSelector
                  imageUrl={selectedImage}
                  onRegionsChange={setRegions}
                />
              )}
              
              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <button
                  onClick={clearImage}
                  className={`px-4 py-2 border rounded-lg flex items-center justify-center gap-2 transition-colors text-sm sm:text-base ${
                    settings.enableDarkMode 
                      ? 'border-gray-600 hover:bg-gray-700' 
                      : 'border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <X size={isMobile ? 16 : 18} />
                  Clear
                </button>
                
                <button
                  onClick={handleProcess}
                  disabled={!selectedImage || isProcessing || regions.length === 0}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors text-sm sm:text-base ${
                    (!selectedImage || isProcessing || regions.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Search size={isMobile ? 16 : 18} />
                  {isProcessing ? 'Processing...' : 'Detect Parking Spaces'}
                </button>
              </div>
            </div>
          )}
        </div>
        
        {!isFullscreen && (
          <div className={`${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} p-3 sm:p-4 lg:p-6 rounded-lg shadow-sm sm:shadow-md`}>
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Detection Results</h2>
            
            {!previousResults && !isProcessing ? (
              <div className="py-6 sm:py-8 text-center">
                <ImageIcon size={isMobile ? 40 : 48} className="mx-auto mb-3 sm:mb-4 text-gray-400" />
                <p className={`text-base sm:text-lg ${settings.enableDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Draw regions and process the image to see detection results
                </p>
              </div>
            ) : isProcessing ? (
              <div className="py-6 sm:py-8 text-center">
                <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3 sm:mb-4`}></div>
                <p className={`text-base sm:text-lg ${settings.enableDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Processing image...
                </p>
              </div>
            ) : previousResults ? (
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <ResultCard 
                    label="Total Spaces" 
                    value={previousResults.total.toString()} 
                    darkMode={settings.enableDarkMode}
                    isMobile={isMobile}
                  />
                  <ResultCard 
                    label="Occupied" 
                    value={previousResults.occupied.toString()} 
                    darkMode={settings.enableDarkMode}
                    color="red"
                    isMobile={isMobile}
                  />
                  <ResultCard 
                    label="Available" 
                    value={previousResults.available.toString()} 
                    darkMode={settings.enableDarkMode}
                    color="green"
                    isMobile={isMobile}
                  />
                  <ResultCard 
                    label="Occupancy Rate" 
                    value={`${Math.round((previousResults.occupied / previousResults.total) * 100)}%`} 
                    darkMode={settings.enableDarkMode}
                    color="amber"
                    isMobile={isMobile}
                  />
                </div>
                
                {processedImage && (
                  <div className="space-y-2 sm:space-y-3">
                    <h3 className="font-medium text-sm sm:text-base">Detection Visualization</h3>
                    <div className="aspect-video bg-black rounded-lg overflow-hidden">
                      <img 
                        src={processedImage} 
                        alt="Detection results" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <button
                      onClick={downloadResults}
                      className={`w-full sm:w-auto px-4 py-2 border border-blue-500 text-blue-500 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900 dark:hover:bg-opacity-20 transition-colors text-sm sm:text-base`}
                    >
                      <Download size={isMobile ? 16 : 18} />
                      Download Results
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

interface ResultCardProps {
  label: string;
  value: string;
  darkMode: boolean;
  color?: 'blue' | 'red' | 'green' | 'amber';
  isMobile?: boolean;
}

const ResultCard: React.FC<ResultCardProps> = ({ 
  label, 
  value, 
  darkMode,
  color = 'blue',
  isMobile = false
}) => {
  const getColorClasses = () => {
    const baseClasses = `${isMobile ? 'text-lg' : 'text-xl sm:text-2xl'} font-bold`;
    
    switch(color) {
      case 'red':
        return `${baseClasses} text-red-500`;
      case 'green':
        return `${baseClasses} text-green-500`;
      case 'amber':
        return `${baseClasses} text-amber-500`;
      default:
        return `${baseClasses} text-blue-500`;
    }
  };
  
  return (
    <div className={`p-2 sm:p-3 rounded-lg border transition-all duration-200 hover:shadow-sm ${
      darkMode 
        ? 'bg-gray-700 border-gray-600 hover:border-gray-500' 
        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
    }`}>
      <div className={`text-xs sm:text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-1`}>
        {label}
      </div>
      <div className={getColorClasses()}>
        {value}
      </div>
    </div>
  );
};

export default ImageUpload;