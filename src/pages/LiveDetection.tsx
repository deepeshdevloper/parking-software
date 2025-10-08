import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { useSettings } from '../context/SettingsContext';
import {
  Play,
  Pause,
  CameraOff,
  AlertCircle,
  Upload,
  Video,
  RotateCcw,
  FastForward,
  Rewind,
  Volume2,
  VolumeX,
  Download,
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
  StopCircle,
  MapPin,
  Layers,
  Zap,
  Users,
  Car,
  ArrowRight,
  ArrowLeft,
  CheckSquare,
  Info,
  TrendingUp,
  BarChart3
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

interface VehicleMovement {
  spaceId: number;
  timestamp: number;
  action: 'entered' | 'exited';
  confidence: number;
  vehicleType?: string;
  duration?: number;
}

interface SpaceOccupancyHistory {
  spaceId: number;
  enterTime?: number;
  exitTime?: number;
  totalOccupiedTime: number;
  occupancyCount: number;
}

const DETECTION_INTERVAL = 1000;
const VIDEO_HEALTH_CHECK_INTERVAL = 2000;
const VIDEO_LOAD_TIMEOUT = 20000;

const LiveDetection: React.FC = () => {
  const { settings, isMobile } = useSettings();

  const [isStreaming, setIsStreaming] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [hasCamera, setHasCamera] = useState(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [videoLoadingProgress, setVideoLoadingProgress] = useState(0);
  const [videoLoadingState, setVideoLoadingState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const [regions, setRegions] = useState<Region[]>([]);
  const [detectionResults, setDetectionResults] = useState<DetectionResult | null>(null);
  const [detectionHistory, setDetectionHistory] = useState<Array<{
    timestamp: number;
    occupied: number;
    available: number;
    hasChanges: boolean;
  }>>([]);

  const [vehicleMovements, setVehicleMovements] = useState<VehicleMovement[]>([]);
  const [recentMovements, setRecentMovements] = useState<VehicleMovement[]>([]);
  const [spaceOccupancyHistory, setSpaceOccupancyHistory] = useState<Map<number, SpaceOccupancyHistory>>(new Map());

  const [showSettings, setShowSettings] = useState(false);
  const [showRegionSelector, setShowRegionSelector] = useState(false);
  const [showOverlays, setShowOverlays] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageDimensions, setReferenceImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [regionsApplied, setRegionsApplied] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(true);

  const [showCanvas, setShowCanvas] = useState(true);
  const [canvasSettings, setCanvasSettings] = useState({
    showLabels: true,
    showConfidence: true,
    animateChanges: true,
  });

  const [totalDetections, setTotalDetections] = useState(0);
  const [changesDetected, setChangesDetected] = useState(0);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    fps: 0,
    processingTime: 0,
    accuracy: 0,
  });

  const webcamRef = useRef<Webcam>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const performanceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(Date.now());
  const processingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const videoElementReadyRef = useRef(false);
  const previousSpacesRef = useRef<ParkingSpace[]>([]);

  const isStreamingRef = useRef(isStreaming);
  const regionsRef = useRef(regions);
  const isVideoModeRef = useRef(isVideoMode);
  const regionsAppliedRef = useRef(regionsApplied);

  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);
  useEffect(() => { regionsRef.current = regions; }, [regions]);
  useEffect(() => { isVideoModeRef.current = isVideoMode; }, [isVideoMode]);
  useEffect(() => { regionsAppliedRef.current = regionsApplied; }, [regionsApplied]);

  const createInitialSpaces = useCallback((regions: Region[]): ParkingSpace[] => {
    return regions.map((region, index) => ({
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
  }, []);

  const trackVehicleMovements = useCallback((newSpaces: ParkingSpace[], previousSpaces: ParkingSpace[]) => {
    const movements: VehicleMovement[] = [];
    const timestamp = Date.now();

    newSpaces.forEach(space => {
      const previousSpace = previousSpaces.find(p => p.id === space.id);
      if (previousSpace && previousSpace.isOccupied !== space.isOccupied) {
        let duration: number | undefined;
        if (!space.isOccupied && previousSpace.isOccupied) {
          const occupancyRecord = spaceOccupancyHistory.get(space.id);
          if (occupancyRecord?.enterTime) {
            duration = timestamp - occupancyRecord.enterTime;
          }
        }

        const movement: VehicleMovement = {
          spaceId: space.id,
          timestamp,
          action: space.isOccupied ? 'entered' : 'exited',
          confidence: space.confidence,
          vehicleType: space.vehicleType,
          duration
        };
        movements.push(movement);

        setSpaceOccupancyHistory(prev => {
          const newHistory = new Map(prev);
          const existing = newHistory.get(space.id) || {
            spaceId: space.id,
            totalOccupiedTime: 0,
            occupancyCount: 0
          };

          if (space.isOccupied) {
            existing.enterTime = timestamp;
            existing.occupancyCount += 1;
          } else {
            if (existing.enterTime) {
              const occupiedDuration = timestamp - existing.enterTime;
              existing.totalOccupiedTime += occupiedDuration;
              existing.exitTime = timestamp;
              delete existing.enterTime;
            }
          }

          newHistory.set(space.id, existing);
          return newHistory;
        });
      }
    });

    if (movements.length > 0) {
      setVehicleMovements(prev => [...prev, ...movements].slice(-100));
      setRecentMovements(movements);

      setTimeout(() => {
        setRecentMovements([]);
      }, 5000);
    }
  }, [spaceOccupancyHistory]);

  const drawParkingOverlays = useCallback((spaces: ParkingSpace[], videoElement: HTMLVideoElement | HTMLImageElement) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !videoElement || !showOverlays) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get container dimensions (actual displayed size)
    const rect = videoElement.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    if (containerWidth === 0 || containerHeight === 0) return;

    // Get natural dimensions
    const naturalWidth = videoElement instanceof HTMLVideoElement
      ? videoElement.videoWidth
      : videoElement.naturalWidth;
    const naturalHeight = videoElement instanceof HTMLVideoElement
      ? videoElement.videoHeight
      : videoElement.naturalHeight;

    if (naturalWidth === 0 || naturalHeight === 0) return;

    // Additional video readiness check
    if (videoElement instanceof HTMLVideoElement && videoElement.readyState < 2) {
      return;
    }

    // Calculate object-contain dimensions and offsets
    const videoAspect = naturalWidth / naturalHeight;
    const containerAspect = containerWidth / containerHeight;

    let displayWidth, displayHeight, offsetX, offsetY;

    if (videoAspect > containerAspect) {
      // Video is wider - fit to width, letterbox top/bottom
      displayWidth = containerWidth;
      displayHeight = containerWidth / videoAspect;
      offsetX = 0;
      offsetY = (containerHeight - displayHeight) / 2;
    } else {
      // Video is taller - fit to height, pillarbox left/right
      displayHeight = containerHeight;
      displayWidth = containerHeight * videoAspect;
      offsetX = (containerWidth - displayWidth) / 2;
      offsetY = 0;
    }

    // Set canvas size to match container exactly
    canvas.width = containerWidth;
    canvas.height = containerHeight;
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;

    // Clear canvas
    ctx.clearRect(0, 0, containerWidth, containerHeight);

    // Transform function to convert normalized coordinates to display coordinates
    const transformPoint = (point: { x: number; y: number }) => {
      // Normalized coordinates (0-1) -> actual displayed video coordinates
      return {
        x: point.x * displayWidth + offsetX,
        y: point.y * displayHeight + offsetY
      };
    };

    spaces.forEach((space, index) => {
      const { region, isOccupied, confidence } = space;

      const hasRecentMovement = recentMovements.some(m => m.spaceId === space.id);

      const baseAlpha = Math.max(0.7, confidence);
      const strokeAlpha = Math.max(0.9, confidence);

      let fillColor = isOccupied
        ? `rgba(239, 68, 68, ${baseAlpha * 0.3})`
        : `rgba(34, 197, 94, ${baseAlpha * 0.3})`;

      let strokeColor = isOccupied
        ? `rgba(239, 68, 68, ${strokeAlpha})`
        : `rgba(34, 197, 94, ${strokeAlpha})`;

      if (hasRecentMovement) {
        fillColor = `rgba(255, 165, 0, ${baseAlpha * 0.5})`;
        strokeColor = `rgba(255, 165, 0, ${strokeAlpha})`;
      }

      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = fillColor;
      ctx.lineWidth = hasRecentMovement ? 5 : (isOccupied ? 4 : 3);
      ctx.setLineDash(hasRecentMovement ? [10, 5] : []);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Draw the parking space polygon with proper coordinate transformation
      if (region.points.length > 0) {
        ctx.beginPath();

        const firstPoint = transformPoint(region.points[0]);
        ctx.moveTo(firstPoint.x, firstPoint.y);

        region.points.forEach(point => {
          const transformedPoint = transformPoint(point);
          ctx.lineTo(transformedPoint.x, transformedPoint.y);
        });

        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Calculate bounding box for labels
      const transformedPoints = region.points.map(p => transformPoint(p));
      const xs = transformedPoints.map(p => p.x);
      const ys = transformedPoints.map(p => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      const width = maxX - minX;
      const height = maxY - minY;

      // Check if region is within video display bounds
      const isWithinBounds = minX >= offsetX && maxX <= (offsetX + displayWidth) &&
                            minY >= offsetY && maxY <= (offsetY + displayHeight);

      // Draw labels only if region is large enough and within bounds
      if (width > 50 && height > 35 && isWithinBounds) {
        if (canvasSettings.showLabels) {
          const labelWidth = Math.min(80, width - 10);
          const labelHeight = 24;

          ctx.fillStyle = hasRecentMovement ? 'rgba(255, 165, 0, 0.95)' : 'rgba(0, 0, 0, 0.85)';
          ctx.fillRect(minX + 4, minY + 4, labelWidth, labelHeight);

          ctx.fillStyle = 'white';
          ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`P${index + 1}`, minX + 8, minY + 16);
        }

        if (canvasSettings.showConfidence && width > 75) {
          const confWidth = Math.min(58, width - 10);
          const confHeight = 20;
          const confY = canvasSettings.showLabels ? minY + 32 : minY + 4;

          ctx.fillStyle = hasRecentMovement ? 'rgba(255, 165, 0, 0.95)' : 'rgba(0, 0, 0, 0.85)';
          ctx.fillRect(minX + 4, confY, confWidth, confHeight);

          ctx.fillStyle = 'white';
          ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${Math.round(confidence * 100)}%`, minX + 8, confY + 10);
        }

        // Draw corner indicators for better visibility
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        const cornerSize = 8;
        transformedPoints.forEach(point => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, cornerSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = strokeColor;
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        });
      }

      ctx.setLineDash([]);
    });

    // Draw status overlay within video bounds
    if (isStreaming && spaces.length > 0) {
      const occupied = spaces.filter(s => s.isOccupied).length;
      const available = spaces.filter(s => !s.isOccupied).length;

      const overlayX = offsetX + 10;
      const overlayY = offsetY + displayHeight - 75;
      const overlayWidth = Math.min(260, displayWidth - 20);
      const overlayHeight = 65;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(overlayX, overlayY, overlayWidth, overlayHeight);

      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`🟢 Available: ${available}  🔴 Occupied: ${occupied}`, overlayX + 12, overlayY + 12);

      const occupancyRate = Math.round((occupied / spaces.length) * 100);
      ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`Occupancy Rate: ${occupancyRate}%`, overlayX + 12, overlayY + 38);
    }
  }, [canvasSettings.showLabels, canvasSettings.showConfidence, showOverlays, isStreaming, recentMovements]);

  const loadVideo = useCallback(async (file: File): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      setVideoLoadingState('loading');
      setVideoLoadingProgress(0);
      setIsVideoReady(false);
      setError(null);
      videoElementReadyRef.current = false;

      if (videoLoadTimeoutRef.current) {
        clearTimeout(videoLoadTimeoutRef.current);
      }

      videoLoadTimeoutRef.current = setTimeout(() => {
        setVideoLoadingState('error');
        setError('Video loading timeout. Please try a smaller video file.');
        reject(new Error('Video loading timeout'));
      }, VIDEO_LOAD_TIMEOUT);

      const video = videoRef.current;
      if (!video) {
        setError('Video player not available');
        reject(new Error('Video element not available'));
        return;
      }

      let objectUrl: string;
      try {
        objectUrl = URL.createObjectURL(file);
      } catch (urlError) {
        setError('Failed to process video file');
        reject(new Error('Failed to create object URL'));
        return;
      }

      const updateProgress = () => {
        if (video.buffered.length > 0 && video.duration > 0) {
          const bufferedEnd = video.buffered.end(video.buffered.length - 1);
          const progress = Math.min(100, (bufferedEnd / video.duration) * 100);
          setVideoLoadingProgress(progress);

          if (progress < 100) {
            setTimeout(updateProgress, 200);
          }
        }
      };

      const onCanPlayThrough = () => {
        if (videoLoadTimeoutRef.current) {
          clearTimeout(videoLoadTimeoutRef.current);
          videoLoadTimeoutRef.current = null;
        }

        setVideoLoadingState('ready');
        setIsVideoReady(true);
        setVideoLoadingProgress(100);
        videoElementReadyRef.current = true;

        video.muted = isMuted;
        video.loop = isLooping;
        video.playbackRate = playbackRate;

        cleanup();
        resolve(true);
      };

      const onError = () => {
        setVideoLoadingState('error');
        setIsVideoReady(false);
        setError('Failed to load video. Please check the file format.');
        cleanup();
        reject(new Error('Video loading failed'));
      };

      const cleanup = () => {
        video.removeEventListener('canplaythrough', onCanPlayThrough);
        video.removeEventListener('error', onError);
        video.removeEventListener('progress', updateProgress);

        if (videoLoadTimeoutRef.current) {
          clearTimeout(videoLoadTimeoutRef.current);
          videoLoadTimeoutRef.current = null;
        }
      };

      video.addEventListener('canplaythrough', onCanPlayThrough);
      video.addEventListener('error', onError);
      video.addEventListener('progress', updateProgress);

      try {
        video.pause();
        video.currentTime = 0;
        video.src = objectUrl;
        video.load();
        setVideoUrl(objectUrl);
      } catch (loadError) {
        setError('Failed to start video loading');
        cleanup();
        reject(new Error('Failed to initiate video load'));
      }
    });
  }, [isMuted, isLooping, playbackRate]);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      if (file.size > 50 * 1024 * 1024) {
        setError('Video file size must be less than 50MB for optimal performance');
        return;
      }

      if (!file.type.startsWith('video/')) {
        setError('Please upload a valid video file');
        return;
      }

      try {
        if (videoUrl) {
          URL.revokeObjectURL(videoUrl);
          setVideoUrl(null);
        }

        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        setIsVideoReady(false);
        setVideoLoadingProgress(0);
        setVideoLoadingState('idle');
        setIsStreaming(false);
        setError(null);
        videoElementReadyRef.current = false;
        previousSpacesRef.current = [];

        setVideoFile(file);
        setIsVideoMode(true);

        setTimeout(async () => {
          try {
            await loadVideo(file);
          } catch (error) {
            console.error('Video loading failed:', error);
          }
        }, 100);

      } catch (error) {
        setError('Failed to process video file. Please try again.');
      }
    }
  };

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
          const imageUrl = event.target.result as string;

          // Load image to get dimensions
          const img = new Image();
          img.onload = () => {
            setReferenceImageDimensions({ width: img.width, height: img.height });
            setReferenceImage(imageUrl);
            setShowRegionSelector(true);
            setRegionsApplied(false);
          };
          img.onerror = () => {
            setError('Failed to load reference image');
          };
          img.src = imageUrl;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const applyRegions = useCallback(async () => {
    setShowRegionSelector(false);
    setRegionsApplied(true);

    if (regions.length > 0) {
      const initialSpaces = createInitialSpaces(regions);
      setDetectionResults({
        total: initialSpaces.length,
        occupied: 0,
        available: initialSpaces.length,
        spaces: initialSpaces,
        timestamp: Date.now() / 1000
      });

      if (autoStartEnabled && ((isVideoMode && videoElementReadyRef.current) || (!isVideoMode && hasCamera))) {
        setTimeout(() => {
          startDetection();
        }, 500);
      }
    }
  }, [regions, createInitialSpaces, isVideoMode, hasCamera, autoStartEnabled]);

  const startCamera = async () => {
    try {
      setError(null);

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
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: isMobile ? 'environment' : undefined
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(false);

        if (autoStartEnabled && regionsApplied && regions.length > 0) {
          setTimeout(() => {
            startDetection();
          }, 1000);
        }
      }
    } catch (err) {
      setError('Unable to access camera. Please check permissions.');
      setHasCamera(false);
    }
  };

  const stopStream = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (performanceIntervalRef.current) {
      clearInterval(performanceIntervalRef.current);
      performanceIntervalRef.current = null;
    }
    if (videoLoadTimeoutRef.current) {
      clearTimeout(videoLoadTimeoutRef.current);
      videoLoadTimeoutRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      if (isVideoMode) {
        videoRef.current.pause();
      } else {
        videoRef.current.srcObject = null;
      }
    }

    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
    }

    setIsStreaming(false);
    setIsPaused(false);
    setRecentMovements([]);
    processingRef.current = false;
    videoElementReadyRef.current = false;
    previousSpacesRef.current = [];
  };

  const runDetection = useCallback(async () => {
    if (!isStreamingRef.current || processingRef.current) return;
    if (regionsRef.current.length === 0 || !regionsAppliedRef.current) return;

    processingRef.current = true;
    setIsProcessing(true);

    try {
      let imageSource: string | HTMLVideoElement;

      if (isVideoModeRef.current && videoRef.current) {
        if (!videoElementReadyRef.current || videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          return;
        }
        imageSource = videoRef.current;
      } else if (!isVideoModeRef.current && webcamRef.current?.video) {
        const video = webcamRef.current.video;
        if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          return;
        }
        imageSource = video;
      } else {
        return;
      }

      const startTime = performance.now();
      const previousSpaces = previousSpacesRef.current;
      const results = await detectParkingSpaces(imageSource, regionsRef.current, previousSpaces);
      const processingTime = performance.now() - startTime;

      trackVehicleMovements(results.spaces, previousSpaces);

      const newResults = {
        ...results,
        timestamp: Date.now() / 1000,
        processingTime
      };

      setDetectionResults(newResults);
      previousSpacesRef.current = results.spaces;

      const videoElement = isVideoModeRef.current ? videoRef.current : webcamRef.current?.video;
      if (videoElement && results.spaces.length > 0) {
        requestAnimationFrame(() => {
          drawParkingOverlays(results.spaces, videoElement);
        });
      }

      setDetectionHistory(prev => [
        ...prev.slice(-50),
        {
          timestamp: Date.now() / 1000,
          occupied: results.occupied,
          available: results.available,
          hasChanges: true,
        },
      ]);

      setTotalDetections(prev => prev + 1);

      frameCountRef.current++;
      const now = Date.now();
      const timeDiff = now - lastFrameTimeRef.current;

      if (timeDiff >= 1000) {
        const fps = (frameCountRef.current * 1000) / timeDiff;
        setPerformanceMetrics(prev => ({
          ...prev,
          fps: Math.round(fps * 10) / 10,
          processingTime,
          accuracy: results.spaces.length > 0 ?
            (results.spaces.reduce((sum, space) => sum + space.confidence, 0) / results.spaces.length) * 100 : 0
        }));

        frameCountRef.current = 0;
        lastFrameTimeRef.current = now;
      }

    } catch (err) {
      setError(`Error processing feed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [drawParkingOverlays, trackVehicleMovements]);

  const startDetection = useCallback(async () => {
    if (regions.length === 0 || !regionsApplied) {
      setError('Please define and apply parking regions before starting detection');
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
    setTotalDetections(0);
    setChangesDetected(0);
    setVehicleMovements([]);
    setRecentMovements([]);
    setSpaceOccupancyHistory(new Map());
    previousSpacesRef.current = [];

    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    if (isVideoMode && videoRef.current) {
      try {
        if (videoRef.current.ended || videoRef.current.currentTime >= videoRef.current.duration) {
          videoRef.current.currentTime = 0;
        }
        await videoRef.current.play();
      } catch (e) {
        setError('Failed to play video. Please try again or check the video format.');
        setIsStreaming(false);
        return;
      }
    }

    if (regions.length > 0) {
      const videoElement = isVideoMode ? videoRef.current : webcamRef.current?.video;
      if (videoElement) {
        const initialSpaces = createInitialSpaces(regions);
        requestAnimationFrame(() => {
          drawParkingOverlays(initialSpaces, videoElement);
        });
      }
    }

    setTimeout(runDetection, 500);

    detectionIntervalRef.current = setInterval(runDetection, DETECTION_INTERVAL);

    if (performanceIntervalRef.current) {
      clearInterval(performanceIntervalRef.current);
    }

  }, [isVideoMode, regions, regionsApplied, runDetection, drawParkingOverlays, createInitialSpaces]);

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

  const captureScreenshot = useCallback(() => {
    let canvas: HTMLCanvasElement;
    if (isVideoMode && videoRef.current) {
      const video = videoRef.current;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

      canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
    } else if (!isVideoMode && webcamRef.current) {
      const screenshot = webcamRef.current.getScreenshot();
      if (!screenshot) return;

      const link = document.createElement('a');
      link.href = screenshot;
      link.download = `parking-detection-${new Date().toISOString()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    } else {
      return;
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `parking-detection-${new Date().toISOString()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [isVideoMode]);

  const exportDetectionData = useCallback(() => {
    const data = {
      timestamp: new Date().toISOString(),
      videoName: videoFile?.name,
      detectionHistory,
      vehicleMovements,
      spaceOccupancyHistory: Array.from(spaceOccupancyHistory.entries()),
      detectionInterval: `${DETECTION_INTERVAL / 1000} seconds`,
      totalDetections,
      changesDetected,
      currentResults: detectionResults,
      performanceMetrics,
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
  }, [videoFile, detectionHistory, vehicleMovements, spaceOccupancyHistory, totalDetections, changesDetected, detectionResults, performanceMetrics]);

  useEffect(() => {
    if (detectionResults && detectionResults.spaces.length > 0) {
      const videoElement = isVideoMode ? videoRef.current : webcamRef.current?.video;
      if (videoElement) {
        requestAnimationFrame(() => {
          drawParkingOverlays(detectionResults.spaces, videoElement);
        });
      }
    }
  }, [detectionResults, isVideoMode, drawParkingOverlays, showOverlays]);

  useEffect(() => {
    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
      if (performanceIntervalRef.current) clearInterval(performanceIntervalRef.current);
      if (videoLoadTimeoutRef.current) clearTimeout(videoLoadTimeoutRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    const videoElement = isVideoMode ? videoRef.current : webcamRef.current?.video;
    if (!videoElement || !showOverlays) return;

    const resizeObserver = new ResizeObserver(() => {
      if (detectionResults?.spaces && detectionResults.spaces.length > 0) {
        requestAnimationFrame(() => {
          drawParkingOverlays(detectionResults.spaces, videoElement);
        });
      }
    });

    resizeObserver.observe(videoElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isVideoMode, showOverlays, detectionResults, drawParkingOverlays]);

  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
    facingMode: isMobile ? 'environment' : undefined
  };

  return (
    <div className={`min-h-screen ${settings.enableDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Modern Header */}
      <div className={`sticky top-0 z-50 backdrop-blur-xl ${settings.enableDarkMode ? 'bg-gray-900/80 border-gray-800' : 'bg-white/80 border-gray-200'} border-b`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${settings.enableDarkMode ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-blue-400 to-blue-500'}`}>
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Live Detection</h1>
                  <div className="flex items-center gap-2 text-xs">
                    {isStreaming && (
                      <>
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-red-500 font-medium">LIVE</span>
                        <span className={settings.enableDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                          {performanceMetrics.fps.toFixed(1)} FPS
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!referenceImage && (
                <label className={`px-4 py-2 rounded-lg font-medium transition-all cursor-pointer ${
                  settings.enableDarkMode
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                } flex items-center gap-2`}>
                  <input
                    ref={referenceInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleReferenceImageUpload}
                    className="hidden"
                  />
                  <ImageIcon size={16} />
                  <span>Reference</span>
                </label>
              )}

              <button
                onClick={startCamera}
                disabled={isStreaming && !isVideoMode}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  (!isVideoMode && isStreaming)
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : settings.enableDarkMode
                    ? 'bg-gray-800 hover:bg-gray-700 text-white'
                    : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-300'
                }`}
              >
                <Camera size={16} />
                <span>Camera</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  isVideoMode
                    ? settings.enableDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                    : settings.enableDarkMode
                    ? 'bg-gray-800 hover:bg-gray-700 text-white'
                    : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-300'
                }`}
              >
                <Upload size={16} />
                <span>Video</span>
              </button>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-lg transition-all ${
                  settings.enableDarkMode
                    ? 'bg-gray-800 hover:bg-gray-700 text-white'
                    : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-300'
                }`}
              >
                <SettingsIcon size={20} />
              </button>

              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className={`p-2 rounded-lg transition-all ${
                  settings.enableDarkMode
                    ? 'bg-gray-800 hover:bg-gray-700 text-white'
                    : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-300'
                }`}
              >
                {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-200">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Status Banner */}
      {regionsApplied && regions.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className={`rounded-lg p-4 flex items-center justify-between ${
            settings.enableDarkMode
              ? 'bg-green-900/20 border border-green-800'
              : 'bg-green-50 border border-green-200'
          }`}>
            <div className="flex items-center gap-3">
              <CheckSquare className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-green-900 dark:text-green-200">
                {regions.length} parking regions defined and ready
              </span>
            </div>
            {isStreaming && (
              <span className="text-xs text-green-700 dark:text-green-300">
                Detection active - {DETECTION_INTERVAL / 1000}s interval
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className={`grid ${isFullscreen ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'} gap-6`}>
          {/* Video Feed */}
          <div className={`${isFullscreen ? 'col-span-1' : 'lg:col-span-2'}`}>
            <div className={`rounded-xl overflow-hidden ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-xl`}>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="hidden"
              />

              {showRegionSelector && referenceImage ? (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Define Parking Spaces</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowRegionSelector(false);
                          setReferenceImage(null);
                          setRegions([]);
                          setRegionsApplied(false);
                        }}
                        className={`px-4 py-2 rounded-lg font-medium ${
                          settings.enableDarkMode
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                        }`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={applyRegions}
                        disabled={regions.length === 0}
                        className={`px-4 py-2 rounded-lg font-medium ${
                          regions.length > 0
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        }`}
                      >
                        Apply ({regions.length})
                      </button>
                    </div>
                  </div>
                  <RegionSelector
                    imageUrl={referenceImage}
                    onRegionsChange={setRegions}
                  />
                </div>
              ) : (
                <div className="relative aspect-video bg-black">
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

                        <canvas
                          ref={overlayCanvasRef}
                          className="absolute inset-0 pointer-events-none w-full h-full"
                          style={{
                            mixBlendMode: 'normal',
                            opacity: showOverlays ? 1 : 0,
                            transition: 'opacity 0.3s ease'
                          }}
                        />

                        {videoLoadingState === 'loading' && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 text-white">
                            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                            <div className="text-lg font-medium mb-2">Loading Video...</div>
                            {videoLoadingProgress > 0 && (
                              <div className="w-64 bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${videoLoadingProgress}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                          <div className="flex items-center justify-between text-white">
                            <div className="flex items-center gap-2">
                              <button onClick={toggleMute} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                              </button>
                              <button onClick={() => handleSeek('backward')} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                                <Rewind size={20} />
                              </button>
                              <button onClick={() => handleSeek('forward')} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                                <FastForward size={20} />
                              </button>
                              <button onClick={toggleLoop} className={`p-2 hover:bg-white/20 rounded-lg transition-colors ${isLooping ? 'text-blue-400' : ''}`}>
                                <RotateCcw size={20} />
                              </button>
                            </div>
                            <select
                              value={playbackRate}
                              onChange={(e) => handlePlaybackRateChange(Number(e.target.value))}
                              className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm"
                            >
                              <option value="0.5" className="text-black">0.5x</option>
                              <option value="1" className="text-black">1x</option>
                              <option value="1.5" className="text-black">1.5x</option>
                              <option value="2" className="text-black">2x</option>
                            </select>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                        <Video size={48} className="mb-4 text-gray-400" />
                        <p className="text-lg font-medium mb-4">No video loaded</p>
                        <label className="px-6 py-3 bg-blue-600 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors font-medium">
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
                        onUserMediaError={() => setHasCamera(false)}
                        className="w-full h-full object-contain"
                      />

                      <canvas
                        ref={overlayCanvasRef}
                        className="absolute inset-0 pointer-events-none w-full h-full"
                        style={{
                          mixBlendMode: 'normal',
                          opacity: showOverlays ? 1 : 0,
                          transition: 'opacity 0.3s ease'
                        }}
                      />
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                      <CameraOff size={48} className="mb-4 text-gray-400" />
                      <p className="text-lg font-medium">Camera not available</p>
                      <p className="text-sm text-gray-400 mt-2">Please check permissions or upload a video</p>
                    </div>
                  )}

                  {showOverlays && showGrid && (
                    <div className="absolute inset-0 pointer-events-none">
                      <svg className="w-full h-full">
                        <defs>
                          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                      </svg>
                    </div>
                  )}

                  {isStreaming && (
                    <div className="absolute top-4 left-4 flex items-center gap-3 px-4 py-2 bg-black/70 backdrop-blur-sm rounded-lg text-white">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="font-medium text-sm">LIVE</span>
                      {isPaused && <span className="text-yellow-400 text-sm">| Paused</span>}
                    </div>
                  )}
                </div>
              )}

              {/* Controls */}
              <div className={`p-4 border-t ${settings.enableDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  {isStreaming ? (
                    <>
                      <button
                        onClick={togglePause}
                        className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg flex items-center gap-2 font-medium transition-colors"
                      >
                        {isPaused ? <><Play size={16} /> Resume</> : <><Pause size={16} /> Pause</>}
                      </button>
                      <button
                        onClick={stopStream}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2 font-medium transition-colors"
                      >
                        <StopCircle size={16} />
                        Stop
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={startDetection}
                      disabled={(!hasCamera && !videoFile) || regions.length === 0 || !regionsApplied || (isVideoMode && !videoElementReadyRef.current)}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors ${
                        (hasCamera || (videoFile && videoElementReadyRef.current)) && regions.length > 0 && regionsApplied
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      }`}
                    >
                      <Play size={16} />
                      Start Detection
                    </button>
                  )}

                  <div className="flex-1"></div>

                  <button
                    onClick={() => setShowOverlays(!showOverlays)}
                    className={`p-2 rounded-lg transition-colors ${
                      showOverlays
                        ? 'bg-blue-500 text-white'
                        : settings.enableDarkMode
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                    title="Toggle Overlays"
                  >
                    {showOverlays ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>

                  <button
                    onClick={() => setShowGrid(!showGrid)}
                    className={`p-2 rounded-lg transition-colors ${
                      showGrid
                        ? 'bg-blue-500 text-white'
                        : settings.enableDarkMode
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                    title="Toggle Grid"
                  >
                    <Grid size={18} />
                  </button>

                  <button
                    onClick={captureScreenshot}
                    disabled={!isStreaming}
                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Capture Screenshot"
                  >
                    <Camera size={18} />
                  </button>

                  {detectionHistory.length > 0 && (
                    <button
                      onClick={exportDetectionData}
                      className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg flex items-center gap-2 font-medium transition-colors"
                    >
                      <Download size={16} />
                      Export
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          {!isFullscreen && (
            <div className="lg:col-span-1 space-y-6">
              {/* Live Status Card */}
              <div className={`rounded-xl p-6 ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-xl`}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold">Live Status</h2>
                  <button
                    onClick={() => setShowCanvas(!showCanvas)}
                    className={`p-2 rounded-lg transition-colors ${
                      showCanvas
                        ? 'bg-blue-500 text-white'
                        : settings.enableDarkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}
                  >
                    {showCanvas ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>

                {showCanvas && regionsApplied && regions.length > 0 && (
                  <div className="mb-6">
                    <ParkingSpaceCanvas
                      spaces={detectionResults?.spaces || createInitialSpaces(regions)}
                      width={320}
                      height={240}
                      showLabels={canvasSettings.showLabels}
                      showConfidence={canvasSettings.showConfidence}
                      animateChanges={canvasSettings.animateChanges}
                    />
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className={`p-4 rounded-lg ${settings.enableDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Spaces</div>
                    <div className="text-2xl font-bold">{detectionResults?.total || 0}</div>
                  </div>
                  <div className={`p-4 rounded-lg ${settings.enableDarkMode ? 'bg-red-900/20 border border-red-800' : 'bg-red-50 border border-red-200'}`}>
                    <div className="text-sm text-red-600 dark:text-red-400 mb-1">Occupied</div>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{detectionResults?.occupied || 0}</div>
                  </div>
                  <div className={`p-4 rounded-lg ${settings.enableDarkMode ? 'bg-green-900/20 border border-green-800' : 'bg-green-50 border border-green-200'}`}>
                    <div className="text-sm text-green-600 dark:text-green-400 mb-1">Available</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{detectionResults?.available || 0}</div>
                  </div>
                  <div className={`p-4 rounded-lg ${settings.enableDarkMode ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
                    <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Occupancy</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {Math.round(((detectionResults?.occupied || 0) / (detectionResults?.total || 1)) * 100)}%
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                {isStreaming && (
                  <div className={`p-4 rounded-lg ${settings.enableDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="w-4 h-4 text-blue-500" />
                      <h3 className="font-semibold text-sm">Performance</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className={settings.enableDarkMode ? 'text-gray-400' : 'text-gray-600'}>FPS:</span>
                        <span className="font-medium">{performanceMetrics.fps.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={settings.enableDarkMode ? 'text-gray-400' : 'text-gray-600'}>Processing:</span>
                        <span className="font-medium">{performanceMetrics.processingTime.toFixed(0)}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={settings.enableDarkMode ? 'text-gray-400' : 'text-gray-600'}>Accuracy:</span>
                        <span className="font-medium">{performanceMetrics.accuracy.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={settings.enableDarkMode ? 'text-gray-400' : 'text-gray-600'}>Detections:</span>
                        <span className="font-medium">{totalDetections}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Movements */}
              {vehicleMovements.length > 0 && (
                <div className={`rounded-xl p-6 ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-xl`}>
                  <div className="flex items-center gap-2 mb-4">
                    <Car className="w-5 h-5 text-orange-500" />
                    <h2 className="text-lg font-bold">Recent Movements</h2>
                  </div>
                  <div className="space-y-2">
                    {vehicleMovements.slice(-5).map((movement, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg text-sm ${
                          movement.action === 'entered'
                            ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                            : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 font-medium">
                            {movement.action === 'entered' ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
                            <span>P{movement.spaceId + 1}</span>
                            <span>{movement.action === 'entered' ? 'ENTERED' : 'EXITED'}</span>
                          </div>
                          <span className="text-xs opacity-75">
                            {new Date(movement.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-xs opacity-75">
                          {movement.vehicleType && <span>{movement.vehicleType} • </span>}
                          <span>{Math.round(movement.confidence * 100)}% confidence</span>
                          {movement.duration && <span> • {Math.round(movement.duration / 60000)}min</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* History */}
              {detectionHistory.length > 0 && (
                <div className={`rounded-xl p-6 ${settings.enableDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-xl`}>
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    <h2 className="text-lg font-bold">Detection History</h2>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {detectionHistory.slice(-10).reverse().map((record, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg text-sm ${settings.enableDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(record.timestamp * 1000).toLocaleTimeString()}
                          </span>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-red-500">Occ: {record.occupied}</span>
                            <span className="text-green-500">Avail: {record.available}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveDetection;
