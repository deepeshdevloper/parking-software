import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useSettings } from '../context/SettingsContext';
import { 
  Play, 
  Pause, 
  CameraOff, 
  AlertCircle, 
  Sliders, 
  Upload, 
  Video,
  RotateCcw,
  FastForward,
  Rewind,
  Volume2,
  VolumeX,
  Download,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { detectParkingSpaces } from '../utils/parkingDetection';
import RegionSelector from '../components/RegionSelector';

interface Region {
  id: string;
  points: { x: number; y: number; }[];
  type: 'rectangle' | 'quadrilateral';
}

const LiveDetection: React.FC = () => {
  const { settings } = useSettings();
  const webcamRef = useRef<Webcam>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState<string | null>(null);
  const frameRequestRef = useRef<number>();
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [showRegionSelector, setShowRegionSelector] = useState(false);
  const [detectionResults, setDetectionResults] = useState<{
    total: number;
    occupied: number;
    available: number;
    image?: string;
    timestamp?: number;
  }>({
    total: 0,
    occupied: 0,
    available: 0
  });
  
  const [error, setError] = useState<string | null>(null);
  const detectionInterval = useRef<number | null>(null);
  const [detectionHistory, setDetectionHistory] = useState<Array<{
    timestamp: number;
    occupied: number;
    available: number;
  }>>([]);

  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setReferenceImage(event.target.result as string);
          setShowRegionSelector(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Function to capture current frame
  const captureFrame = useCallback(() => {
    if (isVideoMode && videoRef.current && isVideoReady) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        setCurrentFrame(canvas.toDataURL('image/jpeg'));
      }
    } else if (!isVideoMode && webcamRef.current) {
      const frame = webcamRef.current.getScreenshot();
      if (frame) {
        setCurrentFrame(frame);
      }
    }
    frameRequestRef.current = requestAnimationFrame(captureFrame);
  }, [isVideoMode, isVideoReady]);

  // Start frame capture
  const startFrameCapture = useCallback(() => {
    if (frameRequestRef.current) {
      cancelAnimationFrame(frameRequestRef.current);
    }
    frameRequestRef.current = requestAnimationFrame(captureFrame);
  }, [captureFrame]);

  // Stop frame capture
  const stopFrameCapture = useCallback(() => {
    if (frameRequestRef.current) {
      cancelAnimationFrame(frameRequestRef.current);
    }
  }, []);

  const handleCameraError = useCallback(() => {
    setHasCamera(false);
    setError('Unable to access camera. Please check permissions or try uploading a video instead.');
    setIsDetecting(false);
  }, []);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (file.size > 100 * 1024 * 1024) {
        setError('Video file size must be less than 100MB');
        return;
      }
      
      if (!file.type.startsWith('video/')) {
        setError('Please upload a valid video file');
        return;
      }

      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }

      setIsVideoReady(false);
      const newVideoUrl = URL.createObjectURL(file);
      setVideoUrl(newVideoUrl);
      setVideoFile(file);
      setIsVideoMode(true);
      setError(null);
      setDetectionHistory([]);
      setCurrentFrame(null);

      setIsDetecting(false);
      setIsMuted(true);
      setPlaybackRate(1);
      setIsLooping(false);
    }
  };

  const startDetection = useCallback(async () => {
    if (isVideoMode && !isVideoReady) {
      setError('Please wait for the video to load');
      return;
    }

    const element = isVideoMode ? videoRef.current : webcamRef.current?.video;
    if (!element) return;
    
    setIsDetecting(true);
    setError(null);
    
    if (detectionInterval.current) {
      window.clearInterval(detectionInterval.current);
    }
    
    if (isVideoMode && videoRef.current) {
      try {
        await videoRef.current.play();
        startFrameCapture();
      } catch (e) {
        console.error('Video playback failed:', e);
        setError('Failed to play video. Please try again.');
        setIsDetecting(false);
        return;
      }
    } else {
      startFrameCapture();
    }
    
    detectionInterval.current = window.setInterval(async () => {
      try {
        if (element instanceof HTMLVideoElement && element.paused) {
          return;
        }

        const results = await detectParkingSpaces(
          element,
          regions
        );

        const timestamp = isVideoMode ? videoRef.current?.currentTime || 0 : Date.now() / 1000;
        
        setDetectionResults({
          ...results,
          timestamp
        });

        setDetectionHistory(prev => [...prev, {
          timestamp,
          occupied: results.occupied,
          available: results.available
        }]);

      } catch (err) {
        console.error('Detection error:', err);
        setError('Error processing video feed. Please try again.');
        stopDetection();
      }
    }, 1000);
  }, [isVideoMode, regions, startFrameCapture, isVideoReady]);

  const stopDetection = useCallback(() => {
    if (detectionInterval.current) {
      window.clearInterval(detectionInterval.current);
      detectionInterval.current = null;
    }
    if (isVideoMode && videoRef.current) {
      videoRef.current.pause();
    }
    stopFrameCapture();
    setIsDetecting(false);
  }, [isVideoMode, stopFrameCapture]);

  // Handle video loading
  useEffect(() => {
    if (videoRef.current) {
      const handleLoadedMetadata = () => {
        if (canvasRef.current && videoRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
          setIsVideoReady(true);
        }
      };

      const handleError = (e: ErrorEvent) => {
        console.error('Video loading error:', e);
        setError('Error loading video file. Please try another file.');
        setVideoFile(null);
        setVideoUrl(null);
        setIsVideoReady(false);
      };

      videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      videoRef.current.addEventListener('error', handleError);

      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
          videoRef.current.removeEventListener('error', handleError);
        }
      };
    }
  }, [videoUrl]);

  const handlePlaybackRateChange = (newRate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = newRate;
      setPlaybackRate(newRate);
    }
  };

  const handleSeek = (direction: 'forward' | 'backward') => {
    if (videoRef.current) {
      const seekAmount = 10;
      const newTime = videoRef.current.currentTime + (direction === 'forward' ? seekAmount : -seekAmount);
      videoRef.current.currentTime = Math.max(0, Math.min(newTime, videoRef.current.duration));
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleLoop = () => {
    if (videoRef.current) {
      videoRef.current.loop = !isLooping;
      setIsLooping(!isLooping);
    }
  };

  const downloadResults = () => {
    const data = {
      videoName: videoFile?.name,
      detectionHistory,
      settings: {
        detectionThreshold: settings.detectionThreshold,
        enableWeatherResistance: settings.enableWeatherResistance,
        ignoreHumans: settings.ignoreHumans,
        ignoreAnimals: settings.ignoreAnimals
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'detection-results.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Update video element handlers
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.onplay = startFrameCapture;
      videoRef.current.onpause = stopFrameCapture;
      videoRef.current.onended = stopFrameCapture;
    }
  }, [startFrameCapture, stopFrameCapture]);

  // Handle webcam mode
  useEffect(() => {
    if (!isVideoMode && hasCamera) {
      startFrameCapture();
    }
    return () => {
      stopFrameCapture();
    };
  }, [isVideoMode, hasCamera, startFrameCapture, stopFrameCapture]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopFrameCapture();
      if (detectionInterval.current) {
        window.clearInterval(detectionInterval.current);
      }
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [stopFrameCapture, videoUrl]);

  return (
    <div className={`${settings.enableDarkMode ? 'text-white' : 'text-gray-800'}`}>
      <h1 className="text-2xl font-bold mb-6">Live Parking Detection</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className={`p-4 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Video Feed</h2>
              <div className="flex gap-2">
                {!referenceImage && (
                  <label className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReferenceImageUpload}
                      className="hidden"
                    />
                    Upload Reference Image
                  </label>
                )}
                <button
                  onClick={() => setIsVideoMode(false)}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    !isVideoMode 
                      ? 'bg-blue-600 text-white' 
                      : settings.enableDarkMode 
                        ? 'bg-gray-700' 
                        : 'bg-gray-200'
                  }`}
                >
                  Camera
                </button>
                <button
                  onClick={() => setIsVideoMode(true)}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    isVideoMode 
                      ? 'bg-blue-600 text-white' 
                      : settings.enableDarkMode 
                        ? 'bg-gray-700' 
                        : 'bg-gray-200'
                  }`}
                >
                  Video
                </button>
              </div>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500 bg-opacity-20 border border-red-500 text-red-500 rounded-lg flex items-center">
                <AlertCircle size={20} className="mr-2" />
                <span>{error}</span>
              </div>
            )}
            
            {showRegionSelector && referenceImage ? (
              <div className="mb-4">
                <h3 className="font-medium mb-2">Define Parking Spaces</h3>
                <RegionSelector
                  imageUrl={referenceImage}
                  onRegionsChange={setRegions}
                />
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setShowRegionSelector(false)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                  >
                    Apply Regions
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                {isVideoMode ? (
                  videoUrl ? (
                    <>
                      <video
                        ref={videoRef}
                        className="w-full h-full object-contain"
                        playsInline
                        loop={isLooping}
                        muted={isMuted}
                        src={videoUrl}
                        crossOrigin="anonymous"
                        preload="auto"
                      />
                      <canvas
                        ref={canvasRef}
                        className="absolute inset-0 pointer-events-none"
                        style={{ width: '100%', height: '100%' }}
                      />
                      
                      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
                        <div className="flex items-center justify-between text-white">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={toggleMute}
                              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full"
                            >
                              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                            </button>
                            <button
                              onClick={() => handleSeek('backward')}
                              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full"
                            >
                              <Rewind size={20} />
                            </button>
                            {isDetecting ? (
                              <button
                                onClick={stopDetection}
                                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full"
                              >
                                <Pause size={20} />
                              </button>
                            ) : (
                              <button
                                onClick={startDetection}
                                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full"
                                disabled={!isVideoReady}
                              >
                                <Play size={20} />
                              </button>
                            )}
                            <button
                              onClick={() => handleSeek('forward')}
                              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full"
                            >
                              <FastForward size={20} />
                            </button>
                            <button
                              onClick={toggleLoop}
                              className={`p-2 hover:bg-white hover:bg-opacity-20 rounded-full ${
                                isLooping ? 'text-blue-400' : ''
                              }`}
                            >
                              <RotateCcw size={20} />
                            </button>
                          </div>
                          <div className="flex items-center space-x-2">
                            <select
                              value={playbackRate}
                              onChange={(e) => handlePlaybackRateChange(Number(e.target.value))}
                              className="bg-transparent border border-white border-opacity-20 rounded px-2 py-1 text-white"
                            >
                              <option value="0.5" className="text-black">0.5x</option>
                              <option value="1" className="text-black">1x</option>
                              <option value="1.5" className="text-black">1.5x</option>
                              <option value="2" className="text-black">2x</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                      <Video size={48} className="mb-4" />
                      <label className="px-4 py-2 bg-blue-600 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                        <input
                          type="file"
                          accept="video/*"
                          onChange={handleVideoUpload}
                          className="hidden"
                        />
                        Upload Video
                      </label>
                    </div>
                  )
                ) : (
                  hasCamera ? (
                    <Webcam
                      ref={webcamRef}
                      audio={false}
                      screenshotFormat="image/jpeg"
                      videoConstraints={{
                        width: 1280,
                        height: 720,
                        facingMode: "environment"
                      }}
                      onUserMediaError={handleCameraError}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                      <CameraOff size={48} className="mb-4" />
                      <p>Camera not available</p>
                    </div>
                  )
                )}
                
                {isDetecting && detectionResults.image && (
                  <div className="absolute inset-0 pointer-events-none">
                    <img 
                      src={detectionResults.image} 
                      alt="Detection results" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-4 flex flex-wrap gap-2">
              {isDetecting ? (
                <button
                  onClick={stopDetection}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center hover:bg-red-700 transition-colors"
                >
                  <Pause size={18} className="mr-2" />
                  Stop Detection
                </button>
              ) : (
                <button
                  onClick={startDetection}
                  disabled={(!hasCamera && !videoFile) || regions.length === 0 || (isVideoMode && !isVideoReady)}
                  className={`px-4 py-2 text-white rounded-lg flex items-center transition-colors ${
                    (hasCamera || (videoFile && isVideoReady)) && regions.length > 0
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Play size={18} className="mr-2" />
                  Start Detection
                </button>
              )}
              
              <button
                onClick={() => document.location.href = '/settings'}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg flex items-center hover:bg-gray-600 transition-colors"
              >
                <Sliders size={18} className="mr-2" />
                Detection Settings
              </button>

              {detectionHistory.length > 0 && (
                <button
                  onClick={downloadResults}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center hover:bg-green-700 transition-colors"
                >
                  <Download size={18} className="mr-2" />
                  Export Results
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className={`p-4 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
          <h2 className="text-xl font-semibold mb-4">Detection Results</h2>
          
          <div className="space-y-4">
            <ResultCard 
              label="Total Parking Spaces" 
              value={detectionResults.total.toString()} 
              darkMode={settings.enableDarkMode} 
            />
            <ResultCard 
              label="Occupied Spaces" 
              value={detectionResults.occupied.toString()} 
              darkMode={settings.enableDarkMode}
              color="red" 
            />
            <ResultCard 
              label="Available Spaces" 
              value={detectionResults.available.toString()} 
              darkMode={settings.enableDarkMode}
              color="green" 
            />
            <ResultCard 
              label="Occupancy Rate" 
              value={`${Math.round((detectionResults.occupied / (detectionResults.total || 1)) * 100)}%`} 
              darkMode={settings.enableDarkMode}
              color="amber" 
            />
          </div>
          
          {isVideoMode && detectionResults.timestamp !== undefined && (
            <div className="mt-4">
              <h3 className="font-medium mb-2">Current Time</h3>
              <div className={`p-3 rounded-lg border ${
                settings.enableDarkMode 
                  ? 'bg-gray-700 border-gray-600' 
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="text-lg">
                  {new Date(detectionResults.timestamp * 1000).toISOString().substr(11, 8)}
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-6">
            <h3 className="font-medium mb-2">Detection Parameters</h3>
            <ul className={`text-sm ${settings.enableDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              <li className="flex justify-between py-1">
                <span>Detection Threshold:</span>
                <span>{settings.detectionThreshold}</span>
              </li>
              <li className="flex justify-between py-1">
                <span>Weather Resistance:</span>
                <span>{settings.enableWeatherResistance ? 'Enabled' : 'Disabled'}</span>
              </li>
              <li className="flex justify-between py-1">
                <span>Human Filtering:</span>
                <span>{settings.ignoreHumans ? 'Enabled' : 'Disabled'}</span>
              </li>
              <li className="flex justify-between py-1">
                <span>Animal Filtering:</span>
                <span>{settings.ignoreAnimals ? 'Enabled' : 'Disabled'}</span>
              </li>
            </ul>
          </div>

          {detectionHistory.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium mb-2">Detection History</h3>
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm">
                      <th className="pb-2">Time</th>
                      <th className="pb-2">Occupied</th>
                      <th className="pb-2">Available</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {detectionHistory.slice(-10).map((record, index) => (
                      <tr key={index} className={`border-t ${
                        settings.enableDarkMode ? 'border-gray-700' : 'border-gray-200'
                      }`}>
                        <td className="py-2">
                          {new Date(record.timestamp * 1000).toISOString().substr(11, 8)}
                        </td>
                        <td className="py-2 text-red-500">{record.occupied}</td>
                        <td className="py-2 text-green-500">{record.available}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
    const baseClasses = 'text-lg font-bold';
    
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
      <div className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
        {label}
      </div>
      <div className={getColorClasses()}>
        {value}
      </div>
    </div>
  );
};

export default LiveDetection;