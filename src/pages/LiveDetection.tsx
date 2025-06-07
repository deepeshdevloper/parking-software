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
  TrendingUp,
  Square,
  StopCircle
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

interface VideoHealth {
  isHealthy: boolean;
  lastProgressTime: number;
  stallCount: number;
  recoveryAttempts: number;
  lastCurrentTime: number;
  bufferHealth: number;
}

const STREAM_QUALITIES: StreamQuality[] = [
  { width: 320, height: 240, frameRate: 15, label: 'Low (320p)' },
  { width: 640, height: 480, frameRate: 24, label: 'Medium (480p)' },
  { width: 1280, height: 720, frameRate: 30, label: 'High (720p)' },
  { width: 1920, height: 1080, frameRate: 30, label: 'Ultra (1080p)' }
];

const DETECTION_INTERVAL = 3000; // Reduced to 3 seconds for better responsiveness
const VIDEO_HEALTH_CHECK_INTERVAL = 500; // More frequent health checks
const STALL_DETECTION_TIMEOUT = 2000; // Reduced timeout
const MAX_RECOVERY_ATTEMPTS = 3;
const VIDEO_LOAD_TIMEOUT = 20000; // Reduced timeout
const BUFFER_HEALTH_THRESHOLD = 0.05; // Lower threshold

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
  const [videoLoadingProgress, setVideoLoadingProgress] = useState(0);
  const [videoLoadingState, setVideoLoadingState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [videoHealth, setVideoHealth] = useState<VideoHealth>({
    isHealthy: true,
    lastProgressTime: Date.now(),
    stallCount: 0,
    recoveryAttempts: 0,
    lastCurrentTime: -1,
    bufferHealth: 1
  });
  
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
  const [videoStatus, setVideoStatus] = useState<string>('Ready');
  
  // Refs
  const webcamRef = useRef<Webcam>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const performanceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoHealthCheckRef = useRef<NodeJS.Timeout | null>(null);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(Date.now());
  const audioContextRef = useRef<AudioContext | null>(null);
  const processingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const videoLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recoveryInProgressRef = useRef(false);
  const videoElementReadyRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);
  
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

  // Draw parking space overlays on canvas
  const drawParkingOverlays = useCallback((spaces: ParkingSpace[], videoElement: HTMLVideoElement | HTMLImageElement) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !videoElement) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video
    const rect = videoElement.getBoundingClientRect();
    canvas.width = videoElement.videoWidth || videoElement.naturalWidth || rect.width;
    canvas.height = videoElement.videoHeight || videoElement.naturalHeight || rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw each parking space
    spaces.forEach((space, index) => {
      const { region, isOccupied, confidence, vehicleType, features } = space;
      
      // Calculate color based on occupancy and confidence
      const alpha = Math.max(0.6, confidence);
      const color = isOccupied 
        ? `rgba(239, 68, 68, ${alpha})` 
        : `rgba(34, 197, 94, ${alpha})`;
      
      // Draw region outline
      ctx.strokeStyle = color;
      ctx.fillStyle = color.replace(/[\d\.]+\)$/, '0.2)');
      ctx.lineWidth = isOccupied ? 4 : 3;
      ctx.setLineDash([]);

      // Draw the parking space polygon
      if (region.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(region.points[0].x, region.points[0].y);
        region.points.forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Calculate bounds for text placement
      const xs = region.points.map(p => p.x);
      const ys = region.points.map(p => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);

      // Draw space label
      if (canvasSettings.showLabels) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(minX + 5, minY + 5, 80, 25);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`P${index + 1}`, minX + 10, minY + 22);
      }

      // Draw confidence percentage
      if (canvasSettings.showConfidence) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(minX + 5, minY + 35, 60, 20);
        
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(`${Math.round(confidence * 100)}%`, minX + 10, minY + 48);
      }

      // Draw vehicle type if available
      if (vehicleType && isOccupied) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(minX + 5, minY + 60, 100, 20);
        
        ctx.fillStyle = 'white';
        ctx.font = '11px Arial';
        const vehicleText = vehicleType.length > 12 ? vehicleType.substring(0, 12) + '...' : vehicleType;
        ctx.fillText(vehicleText, minX + 10, minY + 73);
      }

      // Draw stability indicator
      const stabilityColor = features.stabilityScore > 0.7 
        ? '#10b981' 
        : features.stabilityScore > 0.4 
        ? '#f59e0b' 
        : '#ef4444';
      
      ctx.fillStyle = stabilityColor;
      ctx.beginPath();
      ctx.arc(maxX - 10, minY + 15, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [canvasSettings.showLabels, canvasSettings.showConfidence]);

  // Enhanced video loading with better error handling
  const loadVideo = useCallback(async (file: File): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      console.log(`Starting video load process for: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      
      // Reset all video-related state
      setVideoLoadingState('loading');
      setVideoLoadingProgress(0);
      setIsVideoReady(false);
      setVideoCompleted(false);
      setError(null);
      videoElementReadyRef.current = false;
      lastVideoTimeRef.current = -1;

      // Clear any existing timeout
      if (videoLoadTimeoutRef.current) {
        clearTimeout(videoLoadTimeoutRef.current);
      }

      // Set up timeout
      videoLoadTimeoutRef.current = setTimeout(() => {
        console.error('Video loading timeout');
        setVideoLoadingState('error');
        setError('Video loading timeout. Please try a smaller video file.');
        cleanup();
        reject(new Error('Video loading timeout'));
      }, VIDEO_LOAD_TIMEOUT);

      const video = videoRef.current;
      if (!video) {
        console.error('Video element not available');
        setError('Video player not available');
        cleanup();
        reject(new Error('Video element not available'));
        return;
      }

      // Create object URL
      let objectUrl: string;
      try {
        objectUrl = URL.createObjectURL(file);
        console.log('Created object URL:', objectUrl);
      } catch (urlError) {
        console.error('Failed to create object URL:', urlError);
        setError('Failed to process video file');
        cleanup();
        reject(new Error('Failed to create object URL'));
        return;
      }

      // Enhanced progress tracking
      const updateProgress = () => {
        if (video.buffered.length > 0 && video.duration > 0) {
          const bufferedEnd = video.buffered.end(video.buffered.length - 1);
          const progress = Math.min(100, (bufferedEnd / video.duration) * 100);
          setVideoLoadingProgress(progress);
          
          if (progress < 100) {
            setTimeout(updateProgress, 200);
          }
        } else if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          setVideoLoadingProgress(50);
          setTimeout(updateProgress, 500);
        }
      };

      const onLoadStart = () => {
        console.log('Video load started');
        setVideoStatus('Loading...');
        setVideoLoadingProgress(10);
      };

      const onLoadedMetadata = () => {
        console.log(`Video metadata loaded: ${video.videoWidth}x${video.videoHeight}, duration: ${video.duration}s`);
        
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          console.error('Invalid video dimensions');
          setError('Invalid video file - no video track found');
          cleanup();
          reject(new Error('Invalid video dimensions'));
          return;
        }
        
        if (overlayCanvasRef.current) {
          overlayCanvasRef.current.width = video.videoWidth;
          overlayCanvasRef.current.height = video.videoHeight;
        }
        
        setVideoStatus('Metadata Loaded');
        setVideoLoadingProgress(30);
        updateProgress();
      };

      const onLoadedData = () => {
        console.log('Video data loaded');
        setVideoStatus('Data Loaded');
        setVideoLoadingProgress(60);
      };

      const onCanPlay = () => {
        console.log('Video can play');
        setVideoStatus('Can Play');
        setVideoLoadingProgress(80);
      };

      const onCanPlayThrough = () => {
        console.log('Video can play through - loading complete');
        
        if (videoLoadTimeoutRef.current) {
          clearTimeout(videoLoadTimeoutRef.current);
          videoLoadTimeoutRef.current = null;
        }
        
        setVideoLoadingState('ready');
        setIsVideoReady(true);
        setVideoLoadingProgress(100);
        setVideoStatus('Ready');
        videoElementReadyRef.current = true;
        
        // Reset video health
        setVideoHealth({
          isHealthy: true,
          lastProgressTime: Date.now(),
          stallCount: 0,
          recoveryAttempts: 0,
          lastCurrentTime: -1,
          bufferHealth: 1
        });
        
        // Set video properties
        video.muted = isMuted;
        video.loop = isLooping;
        video.playbackRate = playbackRate;
        
        cleanup();
        resolve(true);
      };

      const onError = (e: Event) => {
        console.error('Video loading error:', e);
        
        let errorMessage = 'Failed to load video. ';
        
        if (video.error) {
          switch (video.error.code) {
            case MediaError.MEDIA_ERR_ABORTED:
              errorMessage += 'Video loading was aborted.';
              break;
            case MediaError.MEDIA_ERR_NETWORK:
              errorMessage += 'Network error occurred.';
              break;
            case MediaError.MEDIA_ERR_DECODE:
              errorMessage += 'Video format not supported or corrupted.';
              break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
              errorMessage += 'Video format not supported by browser.';
              break;
            default:
              errorMessage += 'Unknown error occurred.';
          }
        } else {
          errorMessage += 'Please check the file format and try again.';
        }
        
        setVideoLoadingState('error');
        setIsVideoReady(false);
        setError(errorMessage);
        
        cleanup();
        reject(new Error('Video loading failed'));
      };

      const onProgress = () => {
        updateProgress();
      };

      const cleanup = () => {
        video.removeEventListener('loadstart', onLoadStart);
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('loadeddata', onLoadedData);
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('canplaythrough', onCanPlayThrough);
        video.removeEventListener('error', onError);
        video.removeEventListener('progress', onProgress);
        
        if (videoLoadTimeoutRef.current) {
          clearTimeout(videoLoadTimeoutRef.current);
          videoLoadTimeoutRef.current = null;
        }
      };

      // Add event listeners
      video.addEventListener('loadstart', onLoadStart);
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('loadeddata', onLoadedData);
      video.addEventListener('canplay', onCanPlay);
      video.addEventListener('canplaythrough', onCanPlayThrough);
      video.addEventListener('error', onError);
      video.addEventListener('progress', onProgress);

      // Start loading
      try {
        video.pause();
        video.currentTime = 0;
        video.src = objectUrl;
        video.load();
        
        console.log('Video load initiated with URL:', objectUrl);
        setVideoUrl(objectUrl);
        
      } catch (loadError) {
        console.error('Failed to initiate video load:', loadError);
        setError('Failed to start video loading');
        cleanup();
        reject(new Error('Failed to initiate video load'));
      }
    });
  }, [isMuted, isLooping, playbackRate]);

  // Enhanced video health monitoring with better stall detection
  const checkVideoHealth = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isVideoModeRef.current || !isStreamingRef.current || recoveryInProgressRef.current) {
      return;
    }

    const currentTime = video.currentTime;
    const now = Date.now();
    
    setVideoHealth(prev => {
      // Check if video time has progressed
      const hasProgressed = currentTime !== lastVideoTimeRef.current && currentTime !== prev.lastCurrentTime;
      const timeSinceProgress = now - prev.lastProgressTime;
      
      // Update last video time
      if (hasProgressed) {
        lastVideoTimeRef.current = currentTime;
      }
      
      // Calculate buffer health
      let bufferHealth = 1;
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const bufferAhead = bufferedEnd - currentTime;
        bufferHealth = Math.min(1, Math.max(0, bufferAhead / 2)); // 2 seconds ideal buffer
      }
      
      // Check if video is stalled (more aggressive detection)
      const isStalled = !video.paused && 
                      !video.ended && 
                      !hasProgressed && 
                      timeSinceProgress > STALL_DETECTION_TIMEOUT &&
                      video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;
      
      if (isStalled && prev.isHealthy) {
        console.warn(`Video stall detected - Time: ${currentTime}, ReadyState: ${video.readyState}, Buffer: ${(bufferHealth * 100).toFixed(1)}%`);
        
        // Attempt immediate recovery
        setTimeout(() => {
          if (video && !recoveryInProgressRef.current) {
            recoverVideo();
          }
        }, 100);
        
        return {
          ...prev,
          isHealthy: false,
          stallCount: prev.stallCount + 1,
          bufferHealth
        };
      } else if (hasProgressed) {
        // Video is healthy
        if (!prev.isHealthy) {
          console.log('Video health restored');
          setError(null);
        }
        
        return {
          isHealthy: true,
          lastProgressTime: now,
          stallCount: prev.stallCount,
          recoveryAttempts: 0,
          lastCurrentTime: currentTime,
          bufferHealth
        };
      }
      
      return {
        ...prev,
        lastCurrentTime: currentTime,
        bufferHealth
      };
    });
  }, []);

  // Improved video recovery with faster strategies
  const recoverVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video || recoveryInProgressRef.current) return;

    recoveryInProgressRef.current = true;
    console.log('Starting video recovery...');

    try {
      setVideoHealth(prev => ({
        ...prev,
        recoveryAttempts: prev.recoveryAttempts + 1
      }));

      // Strategy 1: Quick seek forward
      if (videoHealth.recoveryAttempts === 0) {
        console.log('Recovery strategy 1: Quick seek');
        const newTime = Math.min(video.currentTime + 0.05, video.duration - 0.1);
        video.currentTime = newTime;
        await new Promise(resolve => setTimeout(resolve, 100));
        if (video.paused) await video.play();
      }
      // Strategy 2: Pause/play cycle
      else if (videoHealth.recoveryAttempts === 1) {
        console.log('Recovery strategy 2: Pause/Play cycle');
        video.pause();
        await new Promise(resolve => setTimeout(resolve, 200));
        await video.play();
      }
      // Strategy 3: Reload current position
      else if (videoHealth.recoveryAttempts === 2) {
        console.log('Recovery strategy 3: Reload');
        const currentTime = video.currentTime;
        const currentSrc = video.src;
        video.load();
        await new Promise(resolve => {
          const onCanPlay = () => {
            video.removeEventListener('canplay', onCanPlay);
            video.currentTime = currentTime;
            resolve(void 0);
          };
          video.addEventListener('canplay', onCanPlay);
        });
        await video.play();
      }
      // Strategy 4: Give up
      else {
        console.log('Recovery failed - stopping detection');
        setError('Video recovery failed. Please reload the video.');
        setIsStreaming(false);
        return;
      }

      // Wait briefly to see if recovery worked
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Video recovery completed');
      setError(null);
      
    } catch (err) {
      console.error('Video recovery failed:', err);
      setError(`Video recovery failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      recoveryInProgressRef.current = false;
    }
  }, [videoHealth.recoveryAttempts]);

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

  // Enhanced video event handlers
  const setupVideoEventHandlers = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateStatus = () => {
      const readyStateMap = {
        0: 'No Data',
        1: 'Metadata',
        2: 'Current Data',
        3: 'Future Data',
        4: 'Enough Data'
      };
      
      const status = `${readyStateMap[video.readyState as keyof typeof readyStateMap]} | ${video.paused ? 'Paused' : 'Playing'}`;
      setVideoStatus(status);
    };

    const onTimeUpdate = () => {
      updateStatus();
      // Update overlay when video time changes
      if (detectionResults && detectionResults.spaces.length > 0) {
        drawParkingOverlays(detectionResults.spaces, video);
      }
    };

    const onStalled = () => {
      console.warn('Video stalled event fired');
      setError('Video playback stalled. Attempting recovery...');
    };

    const onWaiting = () => {
      console.log('Video waiting for data');
      setVideoStatus('Buffering...');
    };

    const onPlaying = () => {
      setVideoStatus('Playing');
      setError(null);
    };

    const onPause = () => {
      setVideoStatus('Paused');
    };

    const onEnded = () => {
      console.log('Video ended');
      setVideoCompleted(true);
      setVideoStatus('Ended');
    };

    const onSeeked = () => {
      console.log('Video seeked to:', video.currentTime);
      if (detectionResults && detectionResults.spaces.length > 0) {
        drawParkingOverlays(detectionResults.spaces, video);
      }
    };

    const onSeeking = () => {
      setVideoStatus('Seeking...');
    };

    // Add event listeners
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('stalled', onStalled);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('seeking', onSeeking);

    updateStatus();

    // Cleanup function
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('stalled', onStalled);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('seeking', onSeeking);
    };
  }, [detectionResults, drawParkingOverlays]);
  
  // Handle video upload with improved error handling
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Validate file size (50MB limit for better performance)
      if (file.size > 50 * 1024 * 1024) {
        setError('Video file size must be less than 50MB for optimal performance');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('video/')) {
        setError('Please upload a valid video file');
        return;
      }

      console.log(`Processing video upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

      try {
        // Cleanup previous video
        if (videoUrl) {
          URL.revokeObjectURL(videoUrl);
          setVideoUrl(null);
        }

        // Stop camera if active
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Reset all video-related state
        setIsVideoReady(false);
        setVideoLoadingProgress(0);
        setVideoLoadingState('idle');
        setVideoCompleted(false);
        setLastDetectionResult(null);
        setDetectionHistory([]);
        setTotalDetections(0);
        setChangesDetected(0);
        setIsStreaming(false);
        setIsMuted(true);
        setPlaybackRate(1);
        setIsLooping(false);
        setError(null);
        videoElementReadyRef.current = false;
        lastVideoTimeRef.current = -1;

        // Reset video health
        setVideoHealth({
          isHealthy: true,
          lastProgressTime: Date.now(),
          stallCount: 0,
          recoveryAttempts: 0,
          lastCurrentTime: -1,
          bufferHealth: 1
        });

        // Set video mode
        setVideoFile(file);
        setIsVideoMode(true);

        // Wait for next tick to ensure video element is ready
        setTimeout(async () => {
          try {
            await loadVideo(file);
            console.log('Video loaded successfully');
          } catch (error) {
            console.error('Video loading failed:', error);
          }
        }, 100);

      } catch (error) {
        console.error('Video upload processing failed:', error);
        setError('Failed to process video file. Please try again.');
      }
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

  // Start camera stream
  const startCamera = async () => {
    try {
      setError(null);
      
      // Stop any existing video
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        setVideoUrl(null);
      }
      setVideoFile(null);
      setIsVideoMode(false);
      setIsVideoReady(true);
      videoElementReadyRef.current = true;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: streamQuality.width },
          height: { ideal: streamQuality.height },
          frameRate: { ideal: streamQuality.frameRate },
          facingMode: isMobile ? 'environment' : undefined
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
        setVideoStatus('Camera Active');
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Unable to access camera. Please check permissions.');
      setHasCamera(false);
    }
  };

  // Stop camera/video
  const stopStream = () => {
    // Clear all intervals
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
    if (videoHealthCheckRef.current) {
      clearInterval(videoHealthCheckRef.current);
      videoHealthCheckRef.current = null;
    }
    if (videoLoadTimeoutRef.current) {
      clearTimeout(videoLoadTimeoutRef.current);
      videoLoadTimeoutRef.current = null;
    }

    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Stop video
    if (videoRef.current) {
      if (isVideoMode) {
        videoRef.current.pause();
      } else {
        videoRef.current.srcObject = null;
      }
    }

    // Clear overlay canvas
    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
    }

    setIsStreaming(false);
    setIsPaused(false);
    setNextDetectionTime(null);
    setDetectionCountdown(0);
    setVideoStatus('Stopped');
    processingRef.current = false;
    recoveryInProgressRef.current = false;
    videoElementReadyRef.current = false;
    lastVideoTimeRef.current = -1;
  };
  
  // Capture frame for processing
  const captureFrame = useCallback((): string | null => {
    try {
      if (isVideoModeRef.current && videoRef.current && videoElementReadyRef.current) {
        const video = videoRef.current;
        
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          console.log('Video not ready for frame capture');
          return null;
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        try {
          ctx.drawImage(video, 0, 0);
          return canvas.toDataURL('image/jpeg', 0.8);
        } catch (drawError) {
          console.error('Failed to draw video frame:', drawError);
          return null;
        }
      } else if (!isVideoModeRef.current && webcamRef.current) {
        return webcamRef.current.getScreenshot();
      }
      return null;
    } catch (error) {
      console.error('Failed to capture frame:', error);
      return null;
    }
  }, []);
  
  // Enhanced detection function with better error handling
  const runDetection = useCallback(async () => {
    const currentIsStreaming = isStreamingRef.current;
    const currentIsPaused = isPausedRef.current;
    const currentRegions = regionsRef.current;
    const currentIsVideoMode = isVideoModeRef.current;
    const currentVideoCompleted = videoCompletedRef.current;
    const currentLastDetectionResult = lastDetectionResultRef.current;

    if (!currentIsStreaming || currentIsPaused || processingRef.current) return;
    if (currentRegions.length === 0) return;

    // Skip detection if video is unhealthy
    if (currentIsVideoMode && !videoHealth.isHealthy) {
      console.log('Skipping detection due to unhealthy video');
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);

    try {
      let imageSource: string | HTMLVideoElement;

      if (currentIsVideoMode && videoRef.current) {
        if (!videoElementReadyRef.current || videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          console.log('Video not ready for detection, skipping frame');
          return;
        }

        const isVideoEnded = videoRef.current.ended || 
          (videoRef.current.duration > 0 && videoRef.current.currentTime >= videoRef.current.duration);

        if (isVideoEnded && !currentVideoCompleted) {
          setVideoCompleted(true);
        }

        imageSource = videoRef.current;
      } else if (!currentIsVideoMode && webcamRef.current?.video) {
        const video = webcamRef.current.video;
        if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          console.log('Camera not ready for detection, skipping frame');
          return;
        }
        imageSource = video;
      } else {
        return;
      }

      const startTime = performance.now();
      const results = await detectParkingSpaces(imageSource, currentRegions, []);
      const processingTime = performance.now() - startTime;

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
        processingTime
      });

      // Draw overlays immediately after detection
      const videoElement = currentIsVideoMode ? videoRef.current : webcamRef.current?.video;
      if (videoElement && results.spaces.length > 0) {
        drawParkingOverlays(results.spaces, videoElement);
      }

      setDetectionHistory(prev => [
        ...prev.slice(-50), // Keep last 50 records
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
          processingTime,
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
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [audioEnabled, videoHealth.isHealthy, drawParkingOverlays]);
  
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
        setNextDetectionTime(Date.now() + DETECTION_INTERVAL);
      }
    }
  }, [nextDetectionTime]);
  
  // Start detection
  const startDetection = useCallback(async () => {
    if (regions.length === 0) {
      setError('Please define at least one parking region before starting detection');
      return;
    }

    if (isVideoMode && !videoElementReadyRef.current) {
      setError('Please wait for the video to load completely');
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
    if (videoHealthCheckRef.current) {
      clearInterval(videoHealthCheckRef.current);
    }

    if (isVideoMode && videoRef.current) {
      try {
        if (videoRef.current.ended || videoRef.current.currentTime >= videoRef.current.duration) {
          videoRef.current.currentTime = 0;
        }

        await videoRef.current.play();
        
        // Start video health monitoring
        videoHealthCheckRef.current = setInterval(checkVideoHealth, VIDEO_HEALTH_CHECK_INTERVAL);
      } catch (e) {
        console.error('Video playback failed:', e);
        setError('Failed to play video. Please try again or check the video format.');
        setIsStreaming(false);
        return;
      }
    }

    // Draw initial regions if they exist
    if (regions.length > 0) {
      const videoElement = isVideoMode ? videoRef.current : webcamRef.current?.video;
      if (videoElement) {
        const initialSpaces: ParkingSpace[] = regions.map((region, index) => ({
          id: index,
          region,
          isOccupied: false,
          confidence: 0,
          lastStateChange: Date.now(),
          stateHistory: [],
          features: {
            nonZeroCount: 0,
            brightness: 0,
            edgeDensity: 0,
            textureComplexity: 0,
            perspectiveScore: 0,
            heatmapScore: 0,
            colorVariance: 0,
            motionScore: 0,
            shadowScore: 0,
            stabilityScore: 0.5
          }
        }));
        
        drawParkingOverlays(initialSpaces, videoElement);
      }
    }

    // Run initial detection after 1 second
    setTimeout(runDetection, 1000);

    // Set up detection interval
    setNextDetectionTime(Date.now() + DETECTION_INTERVAL);
    detectionIntervalRef.current = setInterval(runDetection, DETECTION_INTERVAL);
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);

    // Start performance monitoring
    if (performanceIntervalRef.current) {
      clearInterval(performanceIntervalRef.current);
    }
    performanceIntervalRef.current = setInterval(updatePerformanceMetrics, 1000);

  }, [isVideoMode, regions, runDetection, updateCountdown, checkVideoHealth, drawParkingOverlays]);
  
  // Toggle pause
  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
    
    if (isVideoMode && videoRef.current) {
      if (isPaused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPaused, isVideoMode]);
  
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
      detectionInterval: `${DETECTION_INTERVAL / 1000} seconds`,
      totalDetections,
      changesDetected,
      videoCompleted,
      currentResults: detectionResults,
      performanceMetrics,
      videoHealth,
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
  }, [videoFile, detectionHistory, totalDetections, changesDetected, videoCompleted, detectionResults, performanceMetrics, videoHealth, settings]);
  
  // Setup video event handlers
  useEffect(() => {
    const cleanupEvents = setupVideoEventHandlers();
    return cleanupEvents;
  }, [setupVideoEventHandlers]);

  // Update overlays when detection results change
  useEffect(() => {
    if (detectionResults && detectionResults.spaces.length > 0) {
      const videoElement = isVideoMode ? videoRef.current : webcamRef.current?.video;
      if (videoElement) {
        drawParkingOverlays(detectionResults.spaces, videoElement);
      }
    }
  }, [detectionResults, isVideoMode, drawParkingOverlays]);

  // Initialize on mount
  useEffect(() => {
    checkCameraPermission();
    initializeCameras();
    
    return () => {
      // Cleanup on unmount
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (performanceIntervalRef.current) {
        clearInterval(performanceIntervalRef.current);
      }
      if (videoHealthCheckRef.current) {
        clearInterval(videoHealthCheckRef.current);
      }
      if (videoLoadTimeoutRef.current) {
        clearTimeout(videoLoadTimeoutRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [checkCameraPermission, initializeCameras, videoUrl]);
  
  // Video constraints
  const videoConstraints = {
    deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
    width: { ideal: streamQuality.width },
    height: { ideal: streamQuality.height },
    frameRate: { ideal: streamQuality.frameRate },
    facingMode: isMobile ? 'environment' : undefined
  };

  return (
    <div className={`${settings.enableDarkMode ? 'text-white' : 'text-gray-800'} space-y-3 sm:space-y-4 lg:space-y-6`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold">Live Detection</h1>
          <div className="flex items-center gap-1 sm:gap-2">
            {isMobile && <Smartphone size={14} className="text-blue-500" />}
            {isTablet && <Tablet size={14} className="text-blue-500" />}
            {!isMobile && !isTablet && <Monitor size={14} className="text-blue-500" />}
            <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
              isStreaming ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`} />
            <span className="text-xs sm:text-sm">
              {videoStatus}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
              settings.enableDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <SettingsIcon size={16} />
          </button>
          
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
              settings.enableDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 sm:p-4 bg-red-500 bg-opacity-20 border border-red-500 text-red-500 rounded-lg flex items-start gap-2 sm:gap-3">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm sm:text-base">Error</p>
            <p className="text-xs sm:text-sm break-words">{error}</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setError(null)}
                className="text-xs sm:text-sm underline hover:no-underline"
              >
                Dismiss
              </button>
              {error.includes('stalled') && (
                <button
                  onClick={recoverVideo}
                  className="text-xs sm:text-sm underline hover:no-underline"
                >
                  Try Recovery
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video Health Status */}
      {isVideoMode && isStreaming && (
        <div className={`p-2 sm:p-3 rounded-lg flex items-center justify-between text-xs sm:text-sm ${
          videoHealth.isHealthy
            ? 'bg-green-500 bg-opacity-20 border border-green-500 text-green-500'
            : 'bg-yellow-500 bg-opacity-20 border border-yellow-500 text-yellow-600'
        }`}>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${videoHealth.isHealthy ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span>
              Video Health: {videoHealth.isHealthy ? 'Good' : 'Poor'} | 
              Buffer: {(videoHealth.bufferHealth * 100).toFixed(1)}% | 
              Stalls: {videoHealth.stallCount}
            </span>
          </div>
          {!videoHealth.isHealthy && videoHealth.recoveryAttempts < MAX_RECOVERY_ATTEMPTS && (
            <button
              onClick={recoverVideo}
              className="px-2 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
            >
              Recover ({videoHealth.recoveryAttempts}/{MAX_RECOVERY_ATTEMPTS})
            </button>
          )}
        </div>
      )}

      {/* Video Loading Status */}
      {videoLoadingState === 'loading' && (
        <div className="p-3 sm:p-4 bg-blue-500 bg-opacity-20 border border-blue-500 text-blue-500 rounded-lg">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm sm:text-base">Loading Video...</p>
              <p className="text-xs sm:text-sm">
                {videoLoadingProgress > 0 ? `${Math.round(videoLoadingProgress)}% loaded` : 'Initializing...'}
              </p>
              {videoLoadingProgress > 0 && (
                <div className="mt-2 w-full bg-blue-200 rounded-full h-1.5 sm:h-2">
                  <div 
                    className="bg-blue-500 h-1.5 sm:h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${videoLoadingProgress}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detection Status Banner */}
      {isStreaming && (
        <div className={`p-2 sm:p-3 rounded-lg flex items-center justify-between text-xs sm:text-sm ${
          videoCompleted
            ? 'bg-blue-500 bg-opacity-20 border border-blue-500 text-blue-500'
            : 'bg-green-500 bg-opacity-20 border border-green-500 text-green-500'
        }`}>
          <div className="flex items-center gap-1 sm:gap-2">
            {videoCompleted ? (
              <CheckCircle size={16} />
            ) : (
              <Clock size={16} />
            )}
            <span>
              {videoCompleted
                ? `Video Completed - Monitoring Last Frame (${DETECTION_INTERVAL / 1000}s interval)`
                : `Detection Active - Running every ${DETECTION_INTERVAL / 1000} seconds`}
            </span>
          </div>
          {detectionCountdown > 0 && (
            <span className="text-xs sm:text-sm">
              Next: {detectionCountdown}s
            </span>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className={`grid grid-cols-1 ${isFullscreen ? '' : 'xl:grid-cols-5'} gap-3 sm:gap-4 lg:gap-6`}>
        {/* Video Feed Section */}
        <div className={`${isFullscreen ? 'col-span-full' : 'xl:col-span-3'} space-y-3 sm:space-y-4`}>
          <div className={`p-3 sm:p-4 lg:p-6 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm sm:shadow-md`}>
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-semibold">Video Feed</h2>
              <div className="flex gap-1 sm:gap-2">
                {!referenceImage && (
                  <label className="px-2 sm:px-3 py-1 sm:py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors text-xs sm:text-sm">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReferenceImageUpload}
                      className="hidden"
                    />
                    Reference Image
                  </label>
                )}
                <button
                  onClick={startCamera}
                  disabled={isStreaming && !isVideoMode}
                  className={`px-2 sm:px-3 py-1 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm ${
                    (!isVideoMode && isStreaming)
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : !isVideoMode
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : settings.enableDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <Camera size={14} className="inline mr-1" />
                  Camera
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`px-2 sm:px-3 py-1 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm ${
                    isVideoMode
                      ? 'bg-blue-600 text-white'
                      : settings.enableDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <Upload size={14} className="inline mr-1" />
                  Video
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
            />

            {/* Region Selector */}
            {showRegionSelector && referenceImage ? (
              <div className="mb-4">
                <h3 className="font-medium mb-2 text-sm sm:text-base">Define Parking Spaces</h3>
                <RegionSelector
                  imageUrl={referenceImage}
                  onRegionsChange={setRegions}
                />
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setShowRegionSelector(false)}
                    className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg text-sm sm:text-base"
                  >
                    Apply Regions ({regions.length} defined)
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                {isVideoMode ? (
                  videoFile ? (
                    <>
                      <video
                        ref={videoRef}
                        className="w-full h-full object-contain"
                        playsInline
                        loop={isLooping}
                        muted={isMuted}
                        crossOrigin="anonymous"
                        preload="metadata"
                      />
                      
                      {/* Overlay Canvas for Parking Spaces */}
                      <canvas
                        ref={overlayCanvasRef}
                        className="absolute inset-0 pointer-events-none w-full h-full object-contain"
                        style={{ 
                          mixBlendMode: 'normal',
                          opacity: showOverlays ? 1 : 0,
                          transition: 'opacity 0.3s ease'
                        }}
                      />

                      {/* Video completion indicator */}
                      {videoCompleted && (
                        <div className="absolute top-2 sm:top-4 right-2 sm:right-4 bg-blue-600 text-white px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm flex items-center">
                          <CheckCircle size={14} className="mr-1" />
                          Complete
                        </div>
                      )}

                      {/* Video loading indicator */}
                      {videoLoadingState === 'loading' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75 text-white">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3 sm:mb-4"></div>
                          <div className="text-sm sm:text-lg font-medium mb-2">Loading Video...</div>
                          <div className="text-xs sm:text-sm text-gray-300 mb-3 sm:mb-4">
                            {videoLoadingProgress > 0 ? `${Math.round(videoLoadingProgress)}% loaded` : 'Initializing...'}
                          </div>
                          {videoLoadingProgress > 0 && (
                            <div className="w-48 sm:w-64 bg-gray-700 rounded-full h-1.5 sm:h-2">
                              <div 
                                className="bg-blue-500 h-1.5 sm:h-2 rounded-full transition-all duration-300" 
                                style={{ width: `${videoLoadingProgress}%` }}
                              ></div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Video Controls */}
                      <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-4 bg-gradient-to-t from-black to-transparent">
                        <div className="flex items-center justify-between text-white">
                          <div className="flex items-center space-x-1 sm:space-x-2">
                            <button onClick={toggleMute} className="p-1 sm:p-2 hover:bg-white hover:bg-opacity-20 rounded-full">
                              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                            </button>
                            <button onClick={() => handleSeek('backward')} className="p-1 sm:p-2 hover:bg-white hover:bg-opacity-20 rounded-full">
                              <Rewind size={16} />
                            </button>
                            <button onClick={() => handleSeek('forward')} className="p-1 sm:p-2 hover:bg-white hover:bg-opacity-20 rounded-full">
                              <FastForward size={16} />
                            </button>
                            <button onClick={toggleLoop} className={`p-1 sm:p-2 hover:bg-white hover:bg-opacity-20 rounded-full ${isLooping ? 'text-blue-400' : ''}`}>
                              <RotateCcw size={16} />
                            </button>
                          </div>
                          <div className="flex items-center space-x-1 sm:space-x-2">
                            <select
                              value={playbackRate}
                              onChange={(e) => handlePlaybackRateChange(Number(e.target.value))}
                              className="bg-transparent border border-white border-opacity-20 rounded px-1 sm:px-2 py-1 text-white text-xs sm:text-sm"
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
                      <Video size={32} className="mb-4" />
                      <label className="px-3 sm:px-4 py-2 bg-blue-600 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors text-sm sm:text-base">
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
                  <>
                    <Webcam
                      ref={webcamRef}
                      audio={false}
                      screenshotFormat="image/jpeg"
                      videoConstraints={videoConstraints}
                      onUserMediaError={handleCameraError}
                      className="w-full h-full object-contain"
                    />
                    
                    {/* Overlay Canvas for Camera */}
                    <canvas
                      ref={overlayCanvasRef}
                      className="absolute inset-0 pointer-events-none w-full h-full object-contain"
                      style={{ 
                        mixBlendMode: 'normal',
                        opacity: showOverlays ? 1 : 0,
                        transition: 'opacity 0.3s ease'
                      }}
                    />
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <CameraOff size={32} className="mb-4" />
                    <p className="text-sm sm:text-base">Camera not available</p>
                    {cameraPermission === 'denied' && (
                      <button
                        onClick={requestCameraPermission}
                        className="mt-4 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
                      >
                        Request Permission
                      </button>
                    )}
                  </div>
                )}

                {/* Additional Overlays */}
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
                          <div className="absolute w-6 h-0.5 bg-white opacity-70 -translate-x-3 -translate-y-0.25"></div>
                          <div className="absolute w-0.5 h-6 bg-white opacity-70 -translate-x-0.25 -translate-y-3"></div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Status Indicators */}
                {isStreaming && (
                  <>
                    <div className="absolute top-2 sm:top-4 left-2 sm:left-4 flex flex-col gap-1 sm:gap-2">
                      <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 bg-black bg-opacity-70 rounded-lg text-white text-xs sm:text-sm">
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span>LIVE</span>
                      </div>
                      
                      {isPaused && (
                        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 bg-black bg-opacity-70 rounded-lg text-yellow-400 text-xs sm:text-sm">
                          <Pause size={14} />
                          <span>Paused</span>
                        </div>
                      )}

                      {isProcessing && (
                        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 bg-black bg-opacity-70 rounded-lg text-blue-400 text-xs sm:text-sm">
                          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                          <span>Processing</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="absolute top-2 sm:top-4 right-2 sm:right-4 px-2 sm:px-3 py-1 sm:py-2 bg-black bg-opacity-70 rounded-lg text-white text-xs sm:text-sm">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Activity size={12} />
                        <span>{performanceMetrics.fps.toFixed(1)} FPS</span>
                      </div>
                    </div>
                    
                    {detectionResults && (
                      <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 px-2 sm:px-3 py-1 sm:py-2 bg-black bg-opacity-70 rounded-lg text-white text-xs sm:text-sm">
                        <div className="flex items-center gap-2 sm:gap-4">
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></div>
                            <span>{detectionResults.available} Available</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full"></div>
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
            <div className="mt-3 sm:mt-4 flex flex-wrap gap-1 sm:gap-2">
              {isStreaming ? (
                <>
                  <button
                    onClick={togglePause}
                    className="px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 bg-yellow-600 text-white rounded-lg flex items-center hover:bg-yellow-700 transition-colors text-xs sm:text-sm"
                  >
                    {isPaused ? <Play size={14} className="mr-1" /> : <Pause size={14} className="mr-1" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={stopStream}
                    className="px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 bg-red-600 text-white rounded-lg flex items-center hover:bg-red-700 transition-colors text-xs sm:text-sm"
                  >
                    <StopCircle size={14} className="mr-1" />
                    Stop
                  </button>
                </>
              ) : (
                <button
                  onClick={startDetection}
                  disabled={(!hasCamera && !videoFile) || regions.length === 0 || (isVideoMode && !videoElementReadyRef.current)}
                  className={`px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 text-white rounded-lg flex items-center transition-colors text-xs sm:text-sm ${
                    (hasCamera || (videoFile && videoElementReadyRef.current)) && regions.length > 0
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Play size={14} className="mr-1" />
                  Start ({DETECTION_INTERVAL / 1000}s)
                </button>
              )}

              <button
                onClick={() => setShowOverlays(!showOverlays)}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                  showOverlays 
                    ? 'bg-blue-600 text-white' 
                    : settings.enableDarkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="Toggle Overlays"
              >
                {showOverlays ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                  showGrid 
                    ? 'bg-blue-600 text-white' 
                    : settings.enableDarkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="Toggle Grid"
              >
                <Grid size={14} />
              </button>
              
              <button
                onClick={() => setShowCrosshair(!showCrosshair)}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                  showCrosshair 
                    ? 'bg-blue-600 text-white' 
                    : settings.enableDarkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="Toggle Crosshair"
              >
                <Crosshair size={14} />
              </button>
              
              <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                  audioEnabled 
                    ? 'bg-blue-600 text-white' 
                    : settings.enableDarkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="Toggle Audio Notifications"
              >
                {audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
              
              <button
                onClick={captureScreenshot}
                disabled={!isStreaming}
                className="p-1.5 sm:p-2 rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Capture Screenshot"
              >
                <Camera size={14} />
              </button>
              
              <button
                onClick={() => setShowRegionSelector(!showRegionSelector)}
                className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                  showRegionSelector 
                    ? 'bg-blue-600 text-white' 
                    : settings.enableDarkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="Define Regions"
              >
                <Target size={14} />
              </button>

              {detectionHistory.length > 0 && (
                <button
                  onClick={exportDetectionData}
                  className="px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg flex items-center hover:bg-green-700 transition-colors text-xs sm:text-sm"
                >
                  <Download size={14} className="mr-1" />
                  Export
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        {!isFullscreen && (
          <div className="xl:col-span-2 space-y-3 sm:space-y-4 lg:space-y-6">
            {/* Live Parking Canvas */}
            <div className={`p-3 sm:p-4 lg:p-6 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm sm:shadow-md`}>
              <div className="flex justify-between items-center mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-semibold">Live Parking Status</h2>
                <button
                  onClick={() => setShowCanvas(!showCanvas)}
                  className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                    showCanvas
                      ? 'bg-blue-600 text-white'
                      : settings.enableDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {showCanvas ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>

              {showCanvas ? (
                <>
                  <ParkingSpaceCanvas
                    spaces={detectionResults?.spaces || []}
                    width={isMobile ? 280 : isTablet ? 320 : 350}
                    height={isMobile ? 200 : isTablet ? 240 : 280}
                    showLabels={canvasSettings.showLabels}
                    showConfidence={canvasSettings.showConfidence}
                    animateChanges={canvasSettings.animateChanges}
                  />

                  {/* Canvas Controls */}
                  <div className="mt-3 sm:mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span>Show Labels</span>
                      <input
                        type="checkbox"
                        checked={canvasSettings.showLabels}
                        onChange={(e) => setCanvasSettings(prev => ({ ...prev, showLabels: e.target.checked }))}
                        className="w-3 h-3 sm:w-4 sm:h-4"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span>Show Confidence</span>
                      <input
                        type="checkbox"
                        checked={canvasSettings.showConfidence}
                        onChange={(e) => setCanvasSettings(prev => ({ ...prev, showConfidence: e.target.checked }))}
                        className="w-3 h-3 sm:w-4 sm:h-4"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span>Animate Changes</span>
                      <input
                        type="checkbox"
                        checked={canvasSettings.animateChanges}
                        onChange={(e) => setCanvasSettings(prev => ({ ...prev, animateChanges: e.target.checked }))}
                        className="w-3 h-3 sm:w-4 sm:h-4"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-6 sm:py-8 text-center">
                  <Grid size={32} className="mx-auto mb-4 text-gray-400" />
                  <p className={`text-sm sm:text-base ${settings.enableDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Canvas view hidden
                  </p>
                </div>
              )}
            </div>

            {/* Detection Results */}
            <div className={`p-3 sm:p-4 lg:p-6 rounded-lg ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm sm:shadow-md`}>
              <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Detection Results</h2>

              {/* Responsive Grid for Result Cards */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
                <ResultCard
                  label="Total Spaces"
                  value={(detectionResults?.total || 0).toString()}
                  darkMode={settings.enableDarkMode}
                  isMobile={isMobile}
                />
                <ResultCard
                  label="Occupied"
                  value={(detectionResults?.occupied || 0).toString()}
                  darkMode={settings.enableDarkMode}
                  color="red"
                  isMobile={isMobile}
                />
                <ResultCard
                  label="Available"
                  value={(detectionResults?.available || 0).toString()}
                  darkMode={settings.enableDarkMode}
                  color="green"
                  isMobile={isMobile}
                />
                <ResultCard
                  label="Occupancy"
                  value={`${Math.round(((detectionResults?.occupied || 0) / (detectionResults?.total || 1)) * 100)}%`}
                  darkMode={settings.enableDarkMode}
                  color="amber"
                  isMobile={isMobile}
                />
              </div>

              {/* Detection Status */}
              <div className="mt-4 sm:mt-6">
                <h3 className="font-medium mb-2 text-sm sm:text-base">Detection Status</h3>
                <div className={`p-2 sm:p-3 rounded-lg border ${
                  settings.enableDarkMode 
                    ? 'border-gray-600 bg-gray-700' 
                    : 'border-gray-300 bg-gray-50'
                }`}>
                  <div className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={isStreaming ? 'text-green-500' : 'text-gray-500'}>
                        {isStreaming ? (videoCompleted ? 'Monitoring' : 'Active') : 'Stopped'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Interval:</span>
                      <span>{DETECTION_INTERVAL / 1000}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Regions:</span>
                      <span className={regions.length > 0 ? 'text-green-500' : 'text-red-500'}>
                        {regions.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Detections:</span>
                      <span>{totalDetections}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Changes:</span>
                      <span className={changesDetected > 0 ? 'text-orange-500' : 'text-gray-500'}>
                        {changesDetected}
                      </span>
                    </div>
                    {isVideoMode && (
                      <>
                        <div className="flex justify-between">
                          <span>Video Ready:</span>
                          <span className={videoElementReadyRef.current ? 'text-green-500' : 'text-red-500'}>
                            {videoElementReadyRef.current ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Health:</span>
                          <span className={videoHealth.isHealthy ? 'text-green-500' : 'text-yellow-500'}>
                            {videoHealth.isHealthy ? 'Good' : 'Poor'}
                          </span>
                        </div>
                      </>
                    )}
                    {videoCompleted && (
                      <div className="flex justify-between">
                        <span>Video:</span>
                        <span className="text-blue-500">Completed</span>
                      </div>
                    )}
                    {isStreaming && detectionCountdown > 0 && (
                      <div className="flex justify-between">
                        <span>Next:</span>
                        <span className="text-blue-500">{detectionCountdown}s</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              {showSettings && (
                <div className="mt-4 sm:mt-6">
                  <h3 className="font-medium mb-2 text-sm sm:text-base">Performance</h3>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {[
                      { label: 'FPS', value: performanceMetrics.fps.toFixed(1), icon: Activity, color: 'text-blue-500' },
                      { label: 'Process', value: `${performanceMetrics.processingTime.toFixed(0)}ms`, icon: Clock, color: 'text-green-500' },
                      { label: 'Accuracy', value: `${performanceMetrics.accuracy.toFixed(1)}%`, icon: Target, color: 'text-purple-500' },
                      { label: 'CPU', value: `${performanceMetrics.cpuUsage.toFixed(1)}%`, icon: Cpu, color: 'text-orange-500' },
                      { label: 'Memory', value: `${performanceMetrics.memoryUsage.toFixed(1)}%`, icon: HardDrive, color: 'text-red-500' },
                      { label: 'Battery', value: `${performanceMetrics.batteryLevel.toFixed(1)}%`, icon: Battery, color: 'text-green-500' }
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div
                        key={label}
                        className={`p-2 sm:p-3 rounded-lg border transition-colors ${
                          settings.enableDarkMode 
                            ? 'border-gray-600 bg-gray-700' 
                            : 'border-gray-300 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-1 sm:gap-2 mb-1">
                          <Icon size={12} className={color} />
                          <span className="text-xs font-medium">{label}</span>
                        </div>
                        <p className="text-xs sm:text-sm font-bold">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detection History */}
              {detectionHistory.length > 0 && (
                <div className="mt-4 sm:mt-6">
                  <h3 className="font-medium mb-2 text-sm sm:text-base">
                    History ({detectionHistory.length})
                  </h3>
                  <div className="max-h-40 sm:max-h-60 overflow-y-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="text-left">
                          <th className="pb-2">Time</th>
                          <th className="pb-2">Occ</th>
                          <th className="pb-2">Avail</th>
                          <th className="pb-2">Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detectionHistory.slice(-10).map((record, index) => (
                          <tr
                            key={index}
                            className={`border-t ${
                              settings.enableDarkMode
                                ? 'border-gray-700'
                                : 'border-gray-200'
                            }`}
                          >
                            <td className="py-1 sm:py-2">
                              {new Date(record.timestamp * 1000)
                                .toISOString()
                                .substr(11, 8)}
                            </td>
                            <td className="py-1 sm:py-2 text-red-500">{record.occupied}</td>
                            <td className="py-1 sm:py-2 text-green-500">{record.available}</td>
                            <td className="py-1 sm:py-2">
                              {record.hasChanges ? (
                                <Activity size={12} className="text-orange-500" />
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
  isMobile?: boolean;
}

const ResultCard: React.FC<ResultCardProps> = ({
  label,
  value,
  darkMode,
  color = 'blue',
  isMobile = false,
}) => {
  const getColorClasses = () => {
    const baseClasses = isMobile ? 'text-sm sm:text-base font-bold' : 'text-base sm:text-lg font-bold';

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
    <div className={`p-2 sm:p-3 rounded-lg border transition-all duration-200 hover:shadow-sm ${
      darkMode ? 'bg-gray-700 border-gray-600 hover:border-gray-500' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
    }`}>
      <div className={`text-xs sm:text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'} mb-1`}>
        {label}
      </div>
      <div className={getColorClasses()}>{value}</div>
    </div>
  );
};

export default LiveDetection;