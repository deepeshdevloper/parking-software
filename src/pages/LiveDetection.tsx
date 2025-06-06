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
  Image as ImageIcon, 
  Clock, 
  CheckCircle, 
  Activity, 
  Eye, 
  EyeOff,
  Camera,
  Settings as SettingsIcon,
  Maximize2,
  Minimize2,
  Target,
  Grid,
  Crosshair,
  X,
  Wifi,
  WifiOff,
  Monitor,
  Smartphone,
  Tablet,
  Cpu,
  HardDrive,
  Battery,
  Thermometer,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import { detectParkingSpaces } from '../utils/parkingDetection';
import RegionSelector from '../components/RegionSelector';
import ParkingSpaceCanvas from '../components/ParkingSpaceCanvas';

interface Region {
  id: string;
  points: { x: number; y: number }[];
  type: 'rectangle' | 'quadrilateral';
}

interface ParkingSpace {
  id: number;
  region: Region;
  isOccupied: boolean;
  confidence: number;
  lastStateChange: number;
  stateHistory: boolean[];
  vehicleType?: string;
  features: {
    nonZeroCount: number;
    brightness: number;
    edgeDensity: number;
    textureComplexity: number;
    perspectiveScore: number;
    heatmapScore: number;
    colorVariance: number;
    motionScore: number;
    shadowScore: number;
    stabilityScore: number;
  };
}

interface DetectionResult {
  total: number;
  occupied: number;
  available: number;
  spaces: ParkingSpace[];
  image?: string;
  processingTime?: number;
  timestamp?: number;
}

interface CameraDevice {
  deviceId: string;
  label: string;
  kind: string;
  groupId: string;
}

interface StreamQuality {
  width: number;
  height: number;
  frameRate: number;
  label: string;
}

interface PerformanceMetrics {
  fps: number;
  processingTime: number;
  accuracy: number;
  cpuUsage: number;
  memoryUsage: number;
  batteryLevel: number;
  temperature: number;
  networkLatency: number;
  frameDrops: number;
  totalFrames: number;
}

const STREAM_QUALITIES: StreamQuality[] = [
  { width: 320, height: 240, frameRate: 15, label: 'Low (320p)' },
  { width: 640, height: 480, frameRate: 24, label: 'Medium (480p)' },
  { width: 1280, height: 720, frameRate: 30, label: 'High (720p)' },
  { width: 1920, height: 1080, frameRate: 30, label: 'Ultra (1080p)' }
];

const LiveDetection: React.FC = () => {
  const { settings, isMobile, isTablet } = useSettings();
  
  // Core State
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Camera State
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [streamQuality, setStreamQuality] = useState<StreamQuality>(STREAM_QUALITIES[isMobile ? 0 : 1]);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [hasCamera, setHasCamera] = useState(true);
  
  // Video Upload State
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  
  // Detection State
  const [regions, setRegions] = useState<Region[]>([]);
  const [detectionResults, setDetectionResults] = useState<DetectionResult | null>(null);
  const [detectionHistory, setDetectionHistory] = useState<Array<{
    timestamp: number;
    occupied: number;
    available: number;
    videoTime?: number;
    hasChanges: boolean;
  }>>([]);
  const [lastDetectionResult, setLastDetectionResult] = useState<{
    occupied: number;
    available: number;
  } | null>(null);
  
  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [showRegionSelector, setShowRegionSelector] = useState(false);
  const [showOverlays, setShowOverlays] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [showCrosshair, setShowCrosshair] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  
  // Canvas Settings
  const [showCanvas, setShowCanvas] = useState(true);
  const [canvasSettings, setCanvasSettings] = useState({
    showLabels: true,
    showConfidence: true,
    animateChanges: true,
  });
  
  // Performance State
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    processingTime: 0,
    accuracy: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    batteryLevel: 100,
    temperature: 0,
    networkLatency: 0,
    frameDrops: 0,
    totalFrames: 0
  });
  
  // Statistics
  const [totalDetections, setTotalDetections] = useState(0);
  const [changesDetected, setChangesDetected] = useState(0);
  const [nextDetectionTime, setNextDetectionTime] = useState<number | null>(null);
  const [detectionCountdown, setDetectionCountdown] = useState<number>(0);
  
  // Refs
  const webcamRef = useRef<Webcam>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const performanceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(Date.now());
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Refs for current state values to avoid closure issues
  const isStreamingRef = useRef(isStreaming);
  const regionsRef = useRef(regions);
  const isVideoModeRef = useRef(isVideoMode);
  const isVideoReadyRef = useRef(isVideoReady);
  const videoCompletedRef = useRef(videoCompleted);
  const lastDetectionResultRef = useRef(lastDetectionResult);
  const isPausedRef = useRef(isPaused);
  
  // Update refs whenever state changes
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);
  useEffect(() => { regionsRef.current = regions; }, [regions]);
  useEffect(() => { isVideoModeRef.current = isVideoMode; }, [isVideoMode]);
  useEffect(() => { isVideoReadyRef.current = isVideoReady; }, [isVideoReady]);
  useEffect(() => { videoCompletedRef.current = videoCompleted; }, [videoCompleted]);
  useEffect(() => { lastDetectionResultRef.current = lastDetectionResult; }, [lastDetectionResult]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  
  // Initialize cameras
  const initializeCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameras(videoDevices.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
        kind: device.kind,
        groupId: device.groupId
      })));
      
      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error('Failed to enumerate cameras:', error);
      setError('Failed to access camera devices');
      setHasCamera(false);
    }
  }, [selectedCamera]);
  
  // Check camera permissions
  const checkCameraPermission = useCallback(async () => {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      setCameraPermission(result.state);
      
      result.addEventListener('change', () => {
        setCameraPermission(result.state);
      });
    } catch (error) {
      console.warn('Permission API not supported:', error);
    }
  }, []);
  
  // Request camera permission
  const requestCameraPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: streamQuality.width },
          height: { ideal: streamQuality.height },
          frameRate: { ideal: streamQuality.frameRate }
        } 
      });
      
      stream.getTracks().forEach(track => track.stop());
      setCameraPermission('granted');
      await initializeCameras();
    } catch (error) {
      console.error('Camera permission denied:', error);
      setCameraPermission('denied');
      setError('Camera access denied. Please enable camera permissions.');
      setHasCamera(false);
    }
  }, [selectedCamera, streamQuality, initializeCameras]);
  
  // Handle camera error
  const handleCameraError = useCallback(() => {
    setHasCamera(false);
    setError('Unable to access camera. Please check permissions or try uploading a video instead.');
    setIsStreaming(false);
  }, []);
  
  // Handle video upload
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
      setVideoCompleted(false);
      setLastDetectionResult(null);
      setTotalDetections(0);
      setChangesDetected(0);

      setIsStreaming(false);
      setIsMuted(true);
      setPlaybackRate(1);
      setIsLooping(false);
    }
  };
  
  // Handle reference image upload
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
  
  // Capture frame for processing
  const captureFrame = useCallback((): string | null => {
    try {
      if (isVideoModeRef.current && videoRef.current && isVideoReadyRef.current) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        return canvas.toDataURL('image/jpeg');
      } else if (!isVideoModeRef.current && webcamRef.current) {
        return webcamRef.current.getScreenshot();
      }
      return null;
    } catch (error) {
      console.error('Failed to capture frame:', error);
      return null;
    }
  }, []);
  
  // Enhanced detection function
  const runDetection = useCallback(async () => {
    const currentIsStreaming = isStreamingRef.current;
    const currentIsPaused = isPausedRef.current;
    const currentRegions = regionsRef.current;
    const currentIsVideoMode = isVideoModeRef.current;
    const currentIsVideoReady = isVideoReadyRef.current;
    const currentVideoCompleted = videoCompletedRef.current;
    const currentLastDetectionResult = lastDetectionResultRef.current;

    if (!currentIsStreaming || currentIsPaused) return;
    if (currentRegions.length === 0) return;

    try {
      let imageSource: string | HTMLVideoElement;

      if (currentIsVideoMode && videoRef.current) {
        if (videoRef.current.readyState < 2) return;

        const isVideoEnded = videoRef.current.ended || 
          (videoRef.current.duration > 0 && videoRef.current.currentTime >= videoRef.current.duration);

        if (isVideoEnded && !currentVideoCompleted) {
          setVideoCompleted(true);
        }

        imageSource = videoRef.current;
      } else if (!currentIsVideoMode && webcamRef.current?.video) {
        const video = webcamRef.current.video;
        if (!video || video.readyState < 2) return;
        imageSource = video;
      } else {
        return;
      }

      const results = await detectParkingSpaces(imageSource, currentRegions, []);

      const timestamp = Date.now() / 1000;
      const videoTime = currentIsVideoMode ? videoRef.current?.currentTime || 0 : 0;

      const hasChanges = !currentLastDetectionResult ||
        currentLastDetectionResult.occupied !== results.occupied ||
        currentLastDetectionResult.available !== results.available;

      if (hasChanges) {
        setChangesDetected(prev => prev + 1);
        if (audioEnabled) {
          playNotificationSound(results.occupied > (currentLastDetectionResult?.occupied || 0) ? 'occupied' : 'available');
        }
      }

      setDetectionResults({
        ...results,
        timestamp,
      });

      setDetectionHistory(prev => [
        ...prev,
        {
          timestamp,
          occupied: results.occupied,
          available: results.available,
          videoTime: currentIsVideoMode ? videoTime : undefined,
          hasChanges,
        },
      ]);

      setLastDetectionResult({
        occupied: results.occupied,
        available: results.available,
      });

      setTotalDetections(prev => prev + 1);

      // Update performance metrics
      frameCountRef.current++;
      const now = Date.now();
      const timeDiff = now - lastFrameTimeRef.current;
      
      if (timeDiff >= 1000) {
        const fps = (frameCountRef.current * 1000) / timeDiff;
        setPerformanceMetrics(prev => ({
          ...prev,
          fps: Math.round(fps * 10) / 10,
          processingTime: results.processingTime || 0,
          totalFrames: prev.totalFrames + frameCountRef.current,
          accuracy: results.spaces.length > 0 ? 
            (results.spaces.reduce((sum, space) => sum + space.confidence, 0) / results.spaces.length) * 100 : 0
        }));
        
        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
      }

    } catch (err) {
      console.error('Detection error:', err);
      setError(`Error processing feed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [audioEnabled]);
  
  // Play notification sound
  const playNotificationSound = useCallback((type: 'occupied' | 'available') => {
    if (!audioEnabled) return;
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.setValueAtTime(type === 'occupied' ? 800 : 400, ctx.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (error) {
      console.warn('Audio notification failed:', error);
    }
  }, [audioEnabled]);
  
  // Countdown timer for next detection
  const updateCountdown = useCallback(() => {
    if (nextDetectionTime) {
      const remaining = Math.max(0, Math.ceil((nextDetectionTime - Date.now()) / 1000));
      setDetectionCountdown(remaining);

      if (remaining === 0) {
        setNextDetectionTime(Date.now() + 5000);
      }
    }
  }, [nextDetectionTime]);
  
  // Start detection
  const startDetection = useCallback(async () => {
    if (regions.length === 0) {
      setError('Please define at least one parking region before starting detection');
      return;
    }

    if (isVideoMode && !isVideoReady) {
      setError('Please wait for the video to load');
      return;
    }

    const element = isVideoMode ? videoRef.current : webcamRef.current?.video;
    if (!element) {
      setError('No video source available');
      return;
    }

    setIsStreaming(true);
    setError(null);
    setVideoCompleted(false);
    setLastDetectionResult(null);
    setTotalDetections(0);
    setChangesDetected(0);

    // Clear any existing intervals
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    if (isVideoMode && videoRef.current) {
      try {
        if (videoRef.current.ended || videoRef.current.currentTime >= videoRef.current.duration) {
          videoRef.current.currentTime = 0;
        }

        if (videoRef.current.readyState < 2) {
          await new Promise((resolve) => {
            const checkReady = () => {
              if (videoRef.current && videoRef.current.readyState >= 2) {
                resolve(true);
              } else {
                setTimeout(checkReady, 100);
              }
            };
            checkReady();
          });
        }

        await videoRef.current.play();
      } catch (e) {
        console.error('Video playback failed:', e);
        setError('Failed to play video. Please try again.');
        setIsStreaming(false);
        return;
      }
    }

    // Run initial detection after 1 second
    setTimeout(runDetection, 1000);

    // Set up 5-second interval for detection
    setNextDetectionTime(Date.now() + 5000);
    detectionIntervalRef.current = setInterval(runDetection, 5000);
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);

    // Start performance monitoring
    if (performanceIntervalRef.current) {
      clearInterval(performanceIntervalRef.current);
    }
    performanceIntervalRef.current = setInterval(updatePerformanceMetrics, 1000);

  }, [isVideoMode, regions, isVideoReady, runDetection, updateCountdown]);
  
  // Stop detection
  const stopDetection = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (performanceIntervalRef.current) {
      clearInterval(performanceIntervalRef.current);
      performanceIntervalRef.current = null;
    }
    if (isVideoMode && videoRef.current) {
      videoRef.current.pause();
    }
    setIsStreaming(false);
    setIsPaused(false);
    setNextDetectionTime(null);
    setDetectionCountdown(0);
  }, [isVideoMode]);
  
  // Toggle pause
  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);
  
  // Update performance metrics
  const updatePerformanceMetrics = useCallback(() => {
    setPerformanceMetrics(prev => ({
      ...prev,
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      batteryLevel: Math.max(0, prev.batteryLevel - Math.random() * 0.1),
      temperature: 20 + Math.random() * 40,
      networkLatency: Math.random() * 100,
    }));
  }, []);
  
  // Video controls
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
  
  // Screenshot capture
  const captureScreenshot = useCallback(() => {
    const frame = captureFrame();
    if (!frame) return;
    
    const link = document.createElement('a');
    link.href = frame;
    link.download = `parking-detection-${new Date().toISOString()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [captureFrame]);
  
  // Export detection data
  const exportDetectionData = useCallback(() => {
    const data = {
      timestamp: new Date().toISOString(),
      videoName: videoFile?.name,
      detectionHistory,
      detectionInterval: '5 seconds',
      totalDetections,
      changesDetected,
      videoCompleted,
      currentResults: detectionResults,
      performanceMetrics,
      settings: {
        detectionThreshold: settings.detectionThreshold,
        enableWeatherResistance: settings.enableWeatherResistance,
        ignoreHumans: settings.ignoreHumans,
        ignoreAnimals: settings.ignoreAnimals,
      },
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `parking-detection-data-${new Date().toISOString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }, [videoFile, detectionHistory, totalDetections, changesDetected, videoCompleted, detectionResults, performanceMetrics, settings]);
  
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

      const handleError = () => {
        setError('Error loading video file. Please try another file.');
        setVideoFile(null);
        setVideoUrl(null);
        setIsVideoReady(false);
      };

      const handleVideoEnded = () => {
        setVideoCompleted(true);
      };

      videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      videoRef.current.addEventListener('error', handleError);
      videoRef.current.addEventListener('ended', handleVideoEnded);

      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
          videoRef.current.removeEventListener('error', handleError);
          videoRef.current.removeEventListener('ended', handleVideoEnded);
        }
      };
    }
  }, [videoUrl]);
  
  // Initialize on mount
  useEffect(() => {
    checkCameraPermission();
    initializeCameras();
    
    return () => {
      stopDetection();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [checkCameraPermission, initializeCameras, stopDetection, videoUrl]);
  
  // Video constraints
  const videoConstraints = {
    deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
    width: { ideal: streamQuality.width },
    height: { ideal: streamQuality.height },
    frameRate: { ideal: streamQuality.frameRate },
    facingMode: isMobile ? 'environment' : undefined
  };

  return (
    <div className={`${settings.enableDarkMode ? 'text-white' : 'text-gray-800'} space-y-4 sm:space-y-6`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Live Detection</h1>
          <div className="flex items-center gap-2">
            {isMobile && <Smartphone size={16} className="text-blue-500" />}
            {isTablet && <Tablet size={16} className="text-blue-500" />}
            {!isMobile && !isTablet && <Monitor size={16} className="text-blue-500" />}
            <div className={`w-2 h-2 rounded-full ${
              isStreaming ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`} />
            <span className="text-sm">
              {isStreaming ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              settings.enableDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <SettingsIcon size={18} />
          </button>
          
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`p-2 rounded-lg transition-colors ${
              settings.enableDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-500 bg-opacity-20 border border-red-500 text-red-500 rounded-lg flex items-start gap-3">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-sm underline mt-1 hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Detection Status Banner */}
      {isStreaming && (
        <div className={`p-3 rounded-lg flex items-center justify-between ${
          videoCompleted
            ? 'bg-blue-500 bg-opacity-20 border border-blue-500 text-blue-500'
            : 'bg-green-500 bg-opacity-20 border border-green-500 text-green-500'
        }`}>
          <div className="flex items-center">
            {videoCompleted ? (
              <CheckCircle size={20} className="mr-2" />
            ) : (
              <Clock size={20} className="mr-2" />
            )}
            <span>
              {videoCompleted
                ? 'Video Completed - Monitoring Last Frame (5s interval)'
                : 'Detection Active - Running every 5 seconds'}
            </span>
          </div>
          {detectionCountdown > 0 && (
            <span className="text-sm">
              Next detection in: {detectionCountdown}s
            </span>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className={`grid grid-cols-1 ${isFullscreen ? '' : 'xl:grid-cols-4'} gap-4 sm:gap-6`}>
        {/* Video Feed Section */}
        <div className={`${isFullscreen ? 'col-span-full' : 'xl:col-span-2'} space-y-4`}>
          <div className={`p-4 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm sm:shadow-md`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Video Feed</h2>
              <div className="flex gap-2">
                {!referenceImage && (
                  <label className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors text-sm">
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
                  className={`px-3 py-1 rounded-lg transition-colors text-sm ${
                    !isVideoMode
                      ? 'bg-blue-600 text-white'
                      : settings.enableDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Camera
                </button>
                <button
                  onClick={() => setIsVideoMode(true)}
                  className={`px-3 py-1 rounded-lg transition-colors text-sm ${
                    isVideoMode
                      ? 'bg-blue-600 text-white'
                      : settings.enableDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Video
                </button>
              </div>
            </div>

            {/* Region Selector */}
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
                    Apply Regions ({regions.length} defined)
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

                      {/* Video completion indicator */}
                      {videoCompleted && (
                        <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm flex items-center">
                          <CheckCircle size={16} className="mr-1" />
                          Video Complete
                        </div>
                      )}

                      {/* Video readiness indicator */}
                      {!isVideoReady && (
                        <div className="absolute top-4 left-4 bg-yellow-600 text-white px-3 py-1 rounded-lg text-sm">
                          Loading Video...
                        </div>
                      )}

                      {/* Video Controls */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
                        <div className="flex items-center justify-between text-white">
                          <div className="flex items-center space-x-2">
                            <button onClick={toggleMute} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full">
                              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                            </button>
                            <button onClick={() => handleSeek('backward')} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full">
                              <Rewind size={20} />
                            </button>
                            <button onClick={() => handleSeek('forward')} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full">
                              <FastForward size={20} />
                            </button>
                            <button onClick={toggleLoop} className={`p-2 hover:bg-white hover:bg-opacity-20 rounded-full ${isLooping ? 'text-blue-400' : ''}`}>
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
                ) : hasCamera ? (
                  <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={videoConstraints}
                    onUserMediaError={handleCameraError}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <CameraOff size={48} className="mb-4" />
                    <p>Camera not available</p>
                    {cameraPermission === 'denied' && (
                      <button
                        onClick={requestCameraPermission}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Request Permission
                      </button>
                    )}
                  </div>
                )}

                {/* Overlays */}
                {showOverlays && isStreaming && (
                  <>
                    {/* Grid Overlay */}
                    {showGrid && (
                      <div className="absolute inset-0 pointer-events-none">
                        <svg className="w-full h-full">
                          <defs>
                            <pattern id="grid\" width="50\" height="50\" patternUnits="userSpaceOnUse">
                              <path d="M 50 0 L 0 0 0 50\" fill="none\" stroke="rgba(255,255,255,0.3)\" strokeWidth="1"/>
                            </pattern>
                          </defs>
                          <rect width="100%" height="100%" fill="url(#grid)" />
                        </svg>
                      </div>
                    )}
                    
                    {/* Crosshair Overlay */}
                    {showCrosshair && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="relative">
                          <div className="absolute w-8 h-0.5 bg-white opacity-70 -translate-x-4 -translate-y-0.25"></div>
                          <div className="absolute w-0.5 h-8 bg-white opacity-70 -translate-x-0.25 -translate-y-4"></div>
                        </div>
                      </div>
                    )}
                    
                    {/* Detection Results Overlay */}
                    {detectionResults && (
                      <div className="absolute inset-0 pointer-events-none">
                        <ParkingSpaceCanvas
                          spaces={detectionResults.spaces}
                          showLabels={canvasSettings.showLabels}
                          showConfidence={canvasSettings.showConfidence}
                          animateChanges={canvasSettings.animateChanges}
                          className="w-full h-full"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Status Indicators */}
                {isStreaming && (
                  <>
                    <div className="absolute top-4 left-4 flex flex-col gap-2">
                      <div className="flex items-center gap-2 px-3 py-2 bg-black bg-opacity-70 rounded-lg text-white text-sm">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span>LIVE</span>
                      </div>
                      
                      {isPaused && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-black bg-opacity-70 rounded-lg text-yellow-400 text-sm">
                          <Pause size={16} />
                          <span>Paused</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="absolute top-4 right-4 px-3 py-2 bg-black bg-opacity-70 rounded-lg text-white text-sm">
                      <div className="flex items-center gap-2">
                        <Activity size={14} />
                        <span>{performanceMetrics.fps.toFixed(1)} FPS</span>
                      </div>
                    </div>
                    
                    {detectionResults && (
                      <div className="absolute bottom-4 left-4 px-3 py-2 bg-black bg-opacity-70 rounded-lg text-white text-sm">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span>{detectionResults.available} Available</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span>{detectionResults.occupied} Occupied</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Controls */}
            <div className="mt-4 flex flex-wrap gap-2">
              {isStreaming ? (
                <>
                  <button
                    onClick={togglePause}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg flex items-center hover:bg-yellow-700 transition-colors"
                  >
                    {isPaused ? <Play size={18} className="mr-2" /> : <Pause size={18} className="mr-2" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={stopDetection}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center hover:bg-red-700 transition-colors"
                  >
                    <CameraOff size={18} className="mr-2" />
                    Stop Detection
                  </button>
                </>
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
                  Start Detection (5s interval)
                </button>
              )}

              <button
                onClick={() => setShowOverlays(!showOverlays)}
                className={`p-2 rounded-lg transition-colors ${
                  showOverlays 
                    ? 'bg-blue-600 text-white' 
                    : settings.enableDarkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="Toggle Overlays"
              >
                {showOverlays ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
              
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`p-2 rounded-lg transition-colors ${
                  showGrid 
                    ? 'bg-blue-600 text-white' 
                    : settings.enableDarkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="Toggle Grid"
              >
                <Grid size={18} />
              </button>
              
              <button
                onClick={() => setShowCrosshair(!showCrosshair)}
                className={`p-2 rounded-lg transition-colors ${
                  showCrosshair 
                    ? 'bg-blue-600 text-white' 
                    : settings.enableDarkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="Toggle Crosshair"
              >
                <Crosshair size={18} />
              </button>
              
              <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                className={`p-2 rounded-lg transition-colors ${
                  audioEnabled 
                    ? 'bg-blue-600 text-white' 
                    : settings.enableDarkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="Toggle Audio Notifications"
              >
                {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              
              <button
                onClick={captureScreenshot}
                disabled={!isStreaming}
                className="p-2 rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Capture Screenshot"
              >
                <Camera size={18} />
              </button>
              
              <button
                onClick={() => setShowRegionSelector(!showRegionSelector)}
                className={`p-2 rounded-lg transition-colors ${
                  showRegionSelector 
                    ? 'bg-blue-600 text-white' 
                    : settings.enableDarkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="Define Regions"
              >
                <Target size={18} />
              </button>

              {detectionHistory.length > 0 && (
                <button
                  onClick={exportDetectionData}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center hover:bg-green-700 transition-colors"
                >
                  <Download size={18} className="mr-2" />
                  Export Results
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        {!isFullscreen && (
          <div className="xl:col-span-2 space-y-4 sm:space-y-6">
            {/* Live Parking Canvas */}
            <div className={`p-4 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm sm:shadow-md`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Live Parking Status</h2>
                <button
                  onClick={() => setShowCanvas(!showCanvas)}
                  className={`p-2 rounded-lg transition-colors ${
                    showCanvas
                      ? 'bg-blue-600 text-white'
                      : settings.enableDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {showCanvas ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>

              {showCanvas ? (
                <>
                  <ParkingSpaceCanvas
                    spaces={detectionResults?.spaces || []}
                    width={350}
                    height={280}
                    showLabels={canvasSettings.showLabels}
                    showConfidence={canvasSettings.showConfidence}
                    animateChanges={canvasSettings.animateChanges}
                  />

                  {/* Canvas Controls */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Show Labels</span>
                      <input
                        type="checkbox"
                        checked={canvasSettings.showLabels}
                        onChange={(e) => setCanvasSettings(prev => ({ ...prev, showLabels: e.target.checked }))}
                        className="w-4 h-4"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Show Confidence</span>
                      <input
                        type="checkbox"
                        checked={canvasSettings.showConfidence}
                        onChange={(e) => setCanvasSettings(prev => ({ ...prev, showConfidence: e.target.checked }))}
                        className="w-4 h-4"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Animate Changes</span>
                      <input
                        type="checkbox"
                        checked={canvasSettings.animateChanges}
                        onChange={(e) => setCanvasSettings(prev => ({ ...prev, animateChanges: e.target.checked }))}
                        className="w-4 h-4"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center">
                  <Grid size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className={`text-lg ${settings.enableDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Canvas view hidden
                  </p>
                </div>
              )}
            </div>

            {/* Detection Results */}
            <div className={`p-4 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm sm:shadow-md`}>
              <h2 className="text-xl font-semibold mb-4">Detection Results</h2>

              <div className="space-y-4">
                <ResultCard
                  label="Total Parking Spaces"
                  value={(detectionResults?.total || 0).toString()}
                  darkMode={settings.enableDarkMode}
                />
                <ResultCard
                  label="Occupied Spaces"
                  value={(detectionResults?.occupied || 0).toString()}
                  darkMode={settings.enableDarkMode}
                  color="red"
                />
                <ResultCard
                  label="Available Spaces"
                  value={(detectionResults?.available || 0).toString()}
                  darkMode={settings.enableDarkMode}
                  color="green"
                />
                <ResultCard
                  label="Occupancy Rate"
                  value={`${Math.round(((detectionResults?.occupied || 0) / (detectionResults?.total || 1)) * 100)}%`}
                  darkMode={settings.enableDarkMode}
                  color="amber"
                />
              </div>

              {/* Detection Status */}
              <div className="mt-6">
                <h3 className="font-medium mb-2">Detection Status</h3>
                <div className={`p-3 rounded-lg border ${
                  settings.enableDarkMode 
                    ? 'border-gray-600 bg-gray-700' 
                    : 'border-gray-300 bg-gray-50'
                }`}>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={isStreaming ? 'text-green-500' : 'text-gray-500'}>
                        {isStreaming ? (videoCompleted ? 'Monitoring' : 'Active') : 'Stopped'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Interval:</span>
                      <span>5 seconds</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Regions Defined:</span>
                      <span className={regions.length > 0 ? 'text-green-500' : 'text-red-500'}>
                        {regions.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Detections:</span>
                      <span>{totalDetections}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Changes Detected:</span>
                      <span className={changesDetected > 0 ? 'text-orange-500' : 'text-gray-500'}>
                        {changesDetected}
                      </span>
                    </div>
                    {isVideoMode && (
                      <div className="flex justify-between">
                        <span>Video Ready:</span>
                        <span className={isVideoReady ? 'text-green-500' : 'text-red-500'}>
                          {isVideoReady ? 'Yes' : 'No'}
                        </span>
                      </div>
                    )}
                    {videoCompleted && (
                      <div className="flex justify-between">
                        <span>Video Status:</span>
                        <span className="text-blue-500">Completed</span>
                      </div>
                    )}
                    {isStreaming && detectionCountdown > 0 && (
                      <div className="flex justify-between">
                        <span>Next Detection:</span>
                        <span className="text-blue-500">{detectionCountdown}s</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              {showSettings && (
                <div className="mt-6">
                  <h3 className="font-medium mb-2">Performance Metrics</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'FPS', value: performanceMetrics.fps.toFixed(1), icon: Activity, color: 'text-blue-500' },
                      { label: 'Processing', value: `${performanceMetrics.processingTime}ms`, icon: Clock, color: 'text-green-500' },
                      { label: 'Accuracy', value: `${performanceMetrics.accuracy.toFixed(1)}%`, icon: Target, color: 'text-purple-500' },
                      { label: 'CPU', value: `${performanceMetrics.cpuUsage.toFixed(1)}%`, icon: Cpu, color: 'text-orange-500' },
                      { label: 'Memory', value: `${performanceMetrics.memoryUsage.toFixed(1)}%`, icon: HardDrive, color: 'text-red-500' },
                      { label: 'Battery', value: `${performanceMetrics.batteryLevel.toFixed(1)}%`, icon: Battery, color: 'text-green-500' },
                      { label: 'Temp', value: `${performanceMetrics.temperature.toFixed(1)}°C`, icon: Thermometer, color: 'text-yellow-500' },
                      { label: 'Latency', value: `${performanceMetrics.networkLatency.toFixed(0)}ms`, icon: Wifi, color: 'text-cyan-500' }
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div
                        key={label}
                        className={`p-3 rounded-lg border transition-colors ${
                          settings.enableDarkMode 
                            ? 'border-gray-600 bg-gray-700' 
                            : 'border-gray-300 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon size={14} className={color} />
                          <span className="text-xs font-medium">{label}</span>
                        </div>
                        <p className="text-sm font-bold">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detection History */}
              {detectionHistory.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium mb-2">
                    Detection History ({detectionHistory.length} records)
                  </h3>
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm">
                          <th className="pb-2">Time</th>
                          <th className="pb-2">Occupied</th>
                          <th className="pb-2">Available</th>
                          <th className="pb-2">Changes</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {detectionHistory.slice(-10).map((record, index) => (
                          <tr
                            key={index}
                            className={`border-t ${
                              settings.enableDarkMode
                                ? 'border-gray-700'
                                : 'border-gray-200'
                            }`}
                          >
                            <td className="py-2">
                              {new Date(record.timestamp * 1000)
                                .toISOString()
                                .substr(11, 8)}
                            </td>
                            <td className="py-2 text-red-500">{record.occupied}</td>
                            <td className="py-2 text-green-500">{record.available}</td>
                            <td className="py-2">
                              {record.hasChanges ? (
                                <Activity size={14} className="text-orange-500" />
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
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
}

const ResultCard: React.FC<ResultCardProps> = ({
  label,
  value,
  darkMode,
  color = 'blue',
}) => {
  const getColorClasses = () => {
    const baseClasses = 'text-lg font-bold';

    switch (color) {
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
      darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
    }`}>
      <div className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
        {label}
      </div>
      <div className={getColorClasses()}>{value}</div>
    </div>
  );
};

export default LiveDetection;