import React, { useState, useRef, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';
import { Upload, X, Search, Download, Image as ImageIcon, AlertCircle } from 'lucide-react';
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
  const { settings } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [previousResults, setPreviousResults] = useState<DetectionResult | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

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

  return (
    <div className={`${settings.enableDarkMode ? 'text-white' : 'text-gray-800'}`}>
      <h1 className="text-2xl font-bold mb-6">Image Upload</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`p-4 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <h2 className="text-xl font-semibold mb-4">Upload Image</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-500 bg-opacity-20 border border-red-500 text-red-500 rounded-lg flex items-center">
              <AlertCircle size={20} className="mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          {!selectedImage ? (
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20' : 
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
              
              <Upload size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-lg mb-2">Drag and drop an image here</p>
              <p className={`text-sm ${settings.enableDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Or click to browse
              </p>
              <p className={`mt-2 text-xs ${settings.enableDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Maximum size: 10MB • Recommended: 1920x1080 or smaller
              </p>
            </div>
          ) : (
            <>
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
                <img 
                  src={selectedImage} 
                  alt="Selected" 
                  className="w-full h-full object-contain"
                />
                {imageSize && (
                  <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                    {imageSize.width} × {imageSize.height}
                  </div>
                )}
              </div>

              <RegionSelector
                imageUrl={selectedImage}
                onRegionsChange={setRegions}
              />
              
              <div className="mt-4 flex justify-between">
                <button
                  onClick={clearImage}
                  className={`px-4 py-2 border rounded-lg flex items-center transition-colors ${
                    settings.enableDarkMode 
                      ? 'border-gray-600 hover:bg-gray-700' 
                      : 'border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <X size={18} className="mr-2" />
                  Clear
                </button>
                
                <button
                  onClick={handleProcess}
                  disabled={!selectedImage || isProcessing || regions.length === 0}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center hover:bg-blue-700 transition-colors ${
                    (!selectedImage || isProcessing || regions.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Search size={18} className="mr-2" />
                  {isProcessing ? 'Processing...' : 'Detect Parking Spaces'}
                </button>
              </div>
            </>
          )}
        </div>
        
        <div className={`p-4 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <h2 className="text-xl font-semibold mb-4">Detection Results</h2>
          
          {!previousResults && !isProcessing ? (
            <div className="py-8 text-center">
              <ImageIcon size={48} className="mx-auto mb-4 text-gray-400" />
              <p className={`text-lg ${settings.enableDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Draw regions and process the image to see detection results
              </p>
            </div>
          ) : isProcessing ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className={`text-lg ${settings.enableDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Processing image...
              </p>
            </div>
          ) : previousResults ? (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <ResultCard 
                  label="Total Spaces" 
                  value={previousResults.total.toString()} 
                  darkMode={settings.enableDarkMode} 
                />
                <ResultCard 
                  label="Occupied" 
                  value={previousResults.occupied.toString()} 
                  darkMode={settings.enableDarkMode}
                  color="red" 
                />
                <ResultCard 
                  label="Available" 
                  value={previousResults.available.toString()} 
                  darkMode={settings.enableDarkMode}
                  color="green" 
                />
                <ResultCard 
                  label="Occupancy Rate" 
                  value={`${Math.round((previousResults.occupied / previousResults.total) * 100)}%`} 
                  darkMode={settings.enableDarkMode}
                  color="amber" 
                />
              </div>
              
              {processedImage && (
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Detection Visualization</h3>
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <img 
                      src={processedImage} 
                      alt="Detection results" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <button
                    onClick={downloadResults}
                    className="mt-2 px-4 py-2 border border-blue-500 text-blue-500 rounded-lg flex items-center hover:bg-blue-50 dark:hover:bg-blue-900 dark:hover:bg-opacity-20 transition-colors"
                  >
                    <Download size={18} className="mr-2" />
                    Download Results
                  </button>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

interface ResultCardProps {
  label: string;
  value: string;
  darkMode: boolean;
  color?: 'blue' | 'red' | 'green' | 'amber';
}

const ResultCard: React.FC<ResultCardProps> = ({ 
  label, 
  value, 
  darkMode,
  color = 'blue' 
}) => {
  const getColorClasses = () => {
    const baseClasses = 'text-2xl font-bold';
    
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
    <div className={`p-3 rounded-lg border ${
      darkMode 
        ? 'bg-gray-700 border-gray-600' 
        : 'bg-gray-50 border-gray-200'
    }`}>
      <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
        {label}
      </div>
      <div className={getColorClasses()}>
        {value}
      </div>
    </div>
  );
};

export default ImageUpload;