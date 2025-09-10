import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as mobilenet from '@tensorflow-models/mobilenet';
import '@tensorflow/tfjs-backend-webgl';

const CONFIG = {
  MIN_CONSECUTIVE_FRAMES: 5,              // Increased for more stable detection
  SHADOW_THRESHOLD: 0.35,                 // Increased to better handle shadows
  OCCUPANCY_THRESHOLD: 0.55,              // Increased for more accurate vehicle detection
  MODEL_VERIFICATION_INTERVAL: 2,         // More frequent model verification
  EDGE_DENSITY_THRESHOLD: 0.2,            // Increased for better edge detection
  TEXTURE_COMPLEXITY_THRESHOLD: 0.3,      // Increased for better texture analysis
  COLOR_VARIANCE_THRESHOLD: 0.3,          // Increased for better color differentiation
  MIN_VEHICLE_CONFIDENCE: 0.65,           // Slightly reduced for better sensitivity
  PARKING_SPACE_MIN_SIZE: 50,             // Minimum size unchanged
  MODEL_LOAD_TIMEOUT: 60000,              // Increased timeout to 60 seconds
  MAX_FRAME_SKIP: 1,                      // Frame skip unchanged
  MOTION_INFLUENCE: 0.4,                  // Increased motion influence
  UNCERTAINTY_THRESHOLD: 0.4,             // Increased uncertainty threshold
  TARGET_SIZE: [720, 1280],              // Resolution unchanged
  STABILIZATION_FACTOR: 0.8,             // Increased temporal stabilization
  CONFIDENCE_BOOST: 1.3,                 // Increased confidence boost
  MIN_AREA_COVERAGE: 0.3                 // Increased minimum area coverage
};

interface Point {
  x: number;
  y: number;
}

interface Region {
  id: string;
  points: Point[];
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

let objectDetector: cocoSsd.ObjectDetection | null = null;
let featureExtractor: mobilenet.MobileNet | null = null;
let isModelLoading = false;
let modelLoadingPromise: Promise<void> | null = null;
let modelLoadAttempts = 0;
const MAX_MODEL_LOAD_ATTEMPTS = 3;

let frameCount = 0;
let lastFrameTime = Date.now();
let previousFrame: tf.Tensor3D | null = null;
let previousSpaces: ParkingSpace[] = [];

const settings = {
  showDebugInfo: false,
  useMotionDetection: true,
  useAdvancedFeatures: true,
  useModelVerification: true,
  useTemporalSmoothing: true,
  useAdaptiveVerification: true
};

async function initializeTensorFlow(): Promise<boolean> {
  try {
    console.log('Initializing TensorFlow.js...');
    
    // Try WebGL first
    try {
      await tf.setBackend('webgl');
      await tf.ready();
      console.log('TensorFlow.js initialized with WebGL backend');
      return true;
    } catch (webglError) {
      console.warn('WebGL backend failed, trying CPU backend:', webglError);
      
      // Fallback to CPU
      try {
        await tf.setBackend('cpu');
        await tf.ready();
        console.log('TensorFlow.js initialized with CPU backend');
        return true;
      } catch (cpuError) {
        console.error('Both WebGL and CPU backends failed:', cpuError);
        return false;
      }
    }
  } catch (error) {
    console.error('TensorFlow.js initialization failed:', error);
    return false;
  }
}

async function loadModels(): Promise<boolean> {
  if (isModelLoading && modelLoadingPromise) {
    try {
      await modelLoadingPromise;
      return objectDetector !== null && featureExtractor !== null;
    } catch {
      return false;
    }
  }

  if (objectDetector && featureExtractor) {
    console.log('Models already loaded');
    return true;
  }

  if (modelLoadAttempts >= MAX_MODEL_LOAD_ATTEMPTS) {
    console.error('Maximum model loading attempts reached');
    return false;
  }

  isModelLoading = true;
  modelLoadAttempts++;
  
  modelLoadingPromise = new Promise(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.error('Model loading timeout after', CONFIG.MODEL_LOAD_TIMEOUT, 'ms');
      reject(new Error('Model loading timeout'));
    }, CONFIG.MODEL_LOAD_TIMEOUT);

    try {
      console.log(`Model loading attempt ${modelLoadAttempts}/${MAX_MODEL_LOAD_ATTEMPTS}`);
      
      // Initialize TensorFlow first
      if (!await initializeTensorFlow()) {
        throw new Error('TensorFlow initialization failed');
      }

      console.log('Loading COCO-SSD and MobileNet models...');
      
      // Load models with retry logic
      const loadWithRetry = async (modelLoader: () => Promise<any>, modelName: string, retries = 2) => {
        for (let i = 0; i <= retries; i++) {
          try {
            console.log(`Loading ${modelName} (attempt ${i + 1}/${retries + 1})`);
            const model = await modelLoader();
            console.log(`${modelName} loaded successfully`);
            return model;
          } catch (error) {
            console.warn(`${modelName} loading attempt ${i + 1} failed:`, error);
            if (i === retries) throw error;
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          }
        }
      };

      const [detector, extractor] = await Promise.all([
        loadWithRetry(() => cocoSsd.load(), 'COCO-SSD'),
        loadWithRetry(() => mobilenet.load(), 'MobileNet')
      ]);

      objectDetector = detector;
      featureExtractor = extractor;

      clearTimeout(timeoutId);
      isModelLoading = false;
      console.log('All models loaded successfully');
      resolve();
    } catch (error) {
      clearTimeout(timeoutId);
      isModelLoading = false;
      objectDetector = null;
      featureExtractor = null;
      console.error('Model loading failed:', error);
      reject(error);
    }
  });

  try {
    await modelLoadingPromise;
    return true;
  } catch (error) {
    console.error('Model loading promise rejected:', error);
    return false;
  }
}

// Enhanced video readiness check
async function ensureVideoReady(videoElement: HTMLVideoElement): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Video readiness timeout'));
    }, 10000); // 10 second timeout

    const checkReadiness = () => {
      // Check if video has sufficient data for processing
      if (videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        clearTimeout(timeout);
        console.log(`Video ready: readyState=${videoElement.readyState}, duration=${videoElement.duration}`);
        resolve(videoElement);
        return;
      }

      // If video is loading, wait a bit more
      if (videoElement.readyState === HTMLMediaElement.HAVE_NOTHING || 
          videoElement.readyState === HTMLMediaElement.HAVE_METADATA) {
        setTimeout(checkReadiness, 100);
        return;
      }

      // For other states, try to proceed
      clearTimeout(timeout);
      resolve(videoElement);
    };

    // Start checking
    checkReadiness();

    // Also listen for events
    const onCanPlay = () => {
      clearTimeout(timeout);
      videoElement.removeEventListener('canplay', onCanPlay);
      videoElement.removeEventListener('error', onError);
      resolve(videoElement);
    };

    const onError = (event: Event) => {
      clearTimeout(timeout);
      videoElement.removeEventListener('canplay', onCanPlay);
      videoElement.removeEventListener('error', onError);
      reject(new Error('Video loading error'));
    };

    videoElement.addEventListener('canplay', onCanPlay);
    videoElement.addEventListener('error', onError);
  });
}

function adaptiveThreshold(tensor: tf.Tensor3D, blockSize = 15, C = 10): tf.Tensor3D {
  return tf.tidy(() => {
    const grayscale = tensor.shape[2] === 1 ? tensor : tf.image.rgbToGrayscale(tensor);
    const blurred = tf.avgPool(grayscale, [3, 3], 1, 'same');
    const localMean = tf.avgPool(blurred, [blockSize, blockSize], 1, 'same');
    const diff = tf.sub(blurred, localMean);
    const threshold = tf.scalar(C / 255);
    const binary = tf.greater(diff, threshold);
    return tf.cast(binary, 'float32');
  });
}

function medianBlur(tensor: tf.Tensor3D, kernelSize = 3): tf.Tensor3D {
  return tf.tidy(() => {
    const [height, width, channels] = tensor.shape;
    const pad = Math.floor(kernelSize / 2);
    const padded = tf.pad(tensor, [
      [pad, pad],
      [pad, pad],
      [0, 0]
    ], 'reflect');

    const patches = [];
    for (let dy = 0; dy < kernelSize; dy++) {
      for (let dx = 0; dx < kernelSize; dx++) {
        const shifted = tf.slice(padded, [dy, dx, 0], [height, width, channels]);
        patches.push(shifted);
      }
    }

    const stacked = tf.stack(patches);
    const transposed = tf.transpose(stacked, [1, 2, 3, 0]);
    const sorted = tf.topk(transposed, kernelSize * kernelSize, true).values;
    const medianIndex = Math.floor((kernelSize * kernelSize) / 2);
    const median = tf.slice(sorted, [0, 0, 0, medianIndex], [-1, -1, -1, 1]);
    return median.squeeze([3]);
  });
}

function dilate(tensor: tf.Tensor3D, kernelSize = 3): tf.Tensor3D {
  return tf.tidy(() => {
    const batched = tensor.expandDims(0);
    const dilated = tf.maxPool(batched, [kernelSize, kernelSize], [1, 1], 'same');
    return dilated.squeeze();
  });
}

function enhanceContrast(tensor: tf.Tensor3D): tf.Tensor3D {
  return tf.tidy(() => {
    const grayscale = tensor.shape[2] === 1 ? tensor : tf.image.rgbToGrayscale(tensor);
    const { mean, variance } = tf.moments(grayscale);
    const std = tf.sqrt(variance);
    const minVal = tf.sub(mean, tf.mul(std, tf.scalar(2)));
    const maxVal = tf.add(mean, tf.mul(std, tf.scalar(2)));
    const normalized = tf.div(
      tf.sub(grayscale, minVal),
      tf.maximum(tf.sub(maxVal, minVal), tf.scalar(1e-7))
    );
    return tf.clipByValue(normalized, 0, 1);
  });
}

function calculateMotionScore(currentFrame: tf.Tensor3D, previousFrame: tf.Tensor3D | null): number {
  if (!previousFrame) return 0;
  return tf.tidy(() => {
    const diff = tf.abs(tf.sub(currentFrame, previousFrame));
    return tf.mean(diff).dataSync()[0];
  });
}

function countNonZeroPixels(imageData: ImageData): number {
  const data = imageData.data;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 25 || data[i + 1] > 25 || data[i + 2] > 25) count++;
  }
  return count;
}

function calculateColorVariance(imageData: ImageData): number {
  const data = imageData.data;
  let sumR = 0, sumG = 0, sumB = 0;
  let sumR2 = 0, sumG2 = 0, sumB2 = 0;
  const pixelCount = imageData.width * imageData.height;

  for (let i = 0; i < data.length; i += 4) {
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];
    sumR2 += data[i] * data[i];
    sumG2 += data[i + 1] * data[i + 1];
    sumB2 += data[i + 2] * data[i + 2];
  }

  const varianceR = (sumR2 - (sumR * sumR) / pixelCount) / pixelCount;
  const varianceG = (sumG2 - (sumG * sumG) / pixelCount) / pixelCount;
  const varianceB = (sumB2 - (sumB * sumB) / pixelCount) / pixelCount;

  return (varianceR + varianceG + varianceB) / (3 * 255 * 255);
}

function calculateShadowScore(imageData: ImageData): number {
  const edgeDensity = calculateEdgeDensity(imageData);
  const textureComplexity = calculateTextureComplexity(imageData);
  const colorVariance = calculateColorVariance(imageData);

  const edgeScore = Math.max(0, 1 - (edgeDensity / CONFIG.EDGE_DENSITY_THRESHOLD));
  const textureScore = Math.max(0, 1 - (textureComplexity / CONFIG.TEXTURE_COMPLEXITY_THRESHOLD));
  const colorScore = Math.max(0, 1 - (colorVariance / CONFIG.COLOR_VARIANCE_THRESHOLD));

  return (edgeScore + textureScore + colorScore) / 3;
}

function calculateDynamicThreshold(imageData: ImageData): number {
  const brightness = calculateBrightness(imageData);
  const colorVariance = calculateColorVariance(imageData);
  return CONFIG.OCCUPANCY_THRESHOLD * (1 + (0.5 - brightness)) * (1 + colorVariance);
}

function getRegionBounds(region: Region) {
  const xs = region.points.map(p => p.x);
  const ys = region.points.map(p => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}

function calculateBrightness(imageData: ImageData): number {
  const data = imageData.data;
  let brightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    brightness += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return brightness / (imageData.width * imageData.height * 255);
}

function calculateEdgeDensity(imageData: ImageData): number {
  const edges = detectEdges(imageData);
  let strength = 0;
  edges.forEach(row => row.forEach(v => strength += v));
  return strength / (imageData.width * imageData.height * 255);
}

function detectEdges(imageData: ImageData): number[][] {
  const { width, height, data } = imageData;
  const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
  const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
  const edges = Array.from({ length: height }, () => Array(width).fill(0));

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const idx = ((y + i) * width + (x + j)) * 4;
          const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          gx += gray * sobelX[i + 1][j + 1];
          gy += gray * sobelY[i + 1][j + 1];
        }
      }
      edges[y][x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return edges;
}

function calculateTextureComplexity(imageData: ImageData): number {
  const data = imageData.data;
  const width = imageData.width;
  let complexity = 0;
  let total = 0;

  for (let y = 1; y < imageData.height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const centerIdx = (y * width + x) * 4;
      const centerValue = (data[centerIdx] + data[centerIdx + 1] + data[centerIdx + 2]) / 3;
      let pattern = 0;
      const neighbors = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
      for (let i = 0; i < neighbors.length; i++) {
        const [dy, dx] = neighbors[i];
        const idx = ((y + dy) * width + (x + dx)) * 4;
        const val = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        if (val > centerValue) pattern |= (1 << i);
      }
      let transitions = 0;
      for (let i = 0; i < 8; i++) {
        const bit1 = (pattern >> i) & 1;
        const bit2 = (pattern >> ((i + 1) % 8)) & 1;
        if (bit1 !== bit2) transitions++;
      }
      if (transitions <= 2) complexity++;
      total++;
    }
  }
  return complexity / total;
}

async function verifyWithModel(space: ParkingSpace, imageTensor: tf.Tensor3D): Promise<ParkingSpace> {
  if (!objectDetector || !featureExtractor) {
    console.warn('Models not available for verification');
    return space;
  }

  let cropped: tf.Tensor3D | null = null;
  let cocoInput: tf.Tensor3D | null = null;
  let mobilenetInput: tf.Tensor3D | null = null;

  try {
    const bounds = getRegionBounds(space.region);
    const [height, width] = imageTensor.shape.slice(0, 2);

    // Normalize coordinates to [0, 1]
    const y1 = Math.max(0, bounds.minY) / height;
    const x1 = Math.max(0, bounds.minX) / width;
    const y2 = Math.min(bounds.maxY, height) / height;
    const x2 = Math.min(bounds.maxX, width) / width;

    // Crop the region of interest
    cropped = tf.tidy(() => {
      // Calculate pixel coordinates
      const startY = Math.floor(y1 * height);
      const startX = Math.floor(x1 * width);
      const cropHeight = Math.floor((y2 - y1) * height);
      const cropWidth = Math.floor((x2 - x1) * width);

      // Directly crop the tensor
      return tf.slice3d(
        imageTensor,
        [startY, startX, 0],
        [cropHeight, cropWidth, 3]
      );
    });

    // Prepare COCO-SSD input: expects minimum 300x300, values in 0–255, dtype int32
    cocoInput = tf.tidy(() => {
      const minSize = 300;
      const [h, w] = cropped!.shape.slice(0, 2);
      const resizeNeeded = h < minSize || w < minSize;

      const resized = resizeNeeded
        ? tf.image.resizeBilinear(cropped!, [
          Math.max(minSize, h),
          Math.max(minSize, w),
        ])
        : cropped!;

      // Convert to 0–255 and cast to int32
      const scaled = tf.mul(resized, 255);
      return tf.cast(scaled, 'int32'); // required for coco-ssd
    });

    // Prepare MobileNet input: expects [224, 224, 3], values in [0, 1], dtype float32 (default)
    mobilenetInput = tf.tidy(() => {
      return tf.image.resizeBilinear(cropped!, [224, 224]); // cropped! should already be float32 [0–1]
    });

    // Run detection and classification in parallel
    const [predictions, features] = await Promise.all([
      objectDetector.detect(cocoInput as tf.Tensor3D),
      featureExtractor.classify(mobilenetInput as tf.Tensor3D),
    ]);

    const vehicleClasses = ['car', 'truck', 'bus', 'motorcycle', 'vehicle', 'van', 'suv', 'pickup'];
    const vehiclePredictions = predictions.filter(p =>
      vehicleClasses.some(vc => p.class.toLowerCase().includes(vc)) &&
      p.score > CONFIG.MIN_VEHICLE_CONFIDENCE
    );

    if (vehiclePredictions.length > 0) {
      const bestPrediction = vehiclePredictions.reduce((best, current) =>
        current.score > best.score ? current : best
      );

      return {
        ...space,
        isOccupied: true,
        confidence: bestPrediction.score * CONFIG.CONFIDENCE_BOOST,
        vehicleType: bestPrediction.class,
        features: {
          ...space.features,
          heatmapScore: 1,
          stabilityScore: Math.min(1, space.features.stabilityScore + 0.2)
        }
      };
    }

    if (features && features.length > 0) {
      const vehicleKeywords = ['car', 'truck', 'bus', 'motorcycle', 'vehicle', 'van'];
      const vehicleFeatures = features.some(f =>
        vehicleKeywords.some(vk => f.className.toLowerCase().includes(vk)) &&
        f.probability > 0.5
      );

      if (vehicleFeatures) {
        const bestFeature = features.reduce((best, current) =>
          current.probability > best.probability ? current : best
        );

        return {
          ...space,
          isOccupied: true,
          confidence: bestFeature.probability * CONFIG.CONFIDENCE_BOOST,
          vehicleType: bestFeature.className.split(',')[0],
          features: {
            ...space.features,
            heatmapScore: 1,
            stabilityScore: Math.min(1, space.features.stabilityScore + 0.1)
          }
        };
      }
    }

    return {
      ...space,
      features: {
        ...space.features,
        stabilityScore: Math.max(0, space.features.stabilityScore - 0.1)
      }
    };
  } catch (e) {
    console.warn('Model verification failed:', e);
    return space;
  } finally {
    // Clean up tensors
    if (cropped) cropped.dispose();
    if (cocoInput) cocoInput.dispose();
    if (mobilenetInput) mobilenetInput.dispose();
  }
}

function applyTemporalSmoothing(currentSpaces: ParkingSpace[], previousSpaces: ParkingSpace[]): ParkingSpace[] {
  if (!previousSpaces || previousSpaces.length === 0 || !settings.useTemporalSmoothing) {
    return currentSpaces;
  }

  return currentSpaces.map(space => {
    const previousSpace = previousSpaces.find(s => s.id === space.id);
    if (!previousSpace) return space;

    const stateHistory = [...(previousSpace.stateHistory || []), space.isOccupied];
    if (stateHistory.length > CONFIG.MIN_CONSECUTIVE_FRAMES) {
      stateHistory.shift();
    }

    const weights = stateHistory.map((_, i) => 0.7 + (i / stateHistory.length) * 0.3);
    const weightedSum = stateHistory.reduce((sum, val, i) => sum + (val ? weights[i] : 0), 0);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const weightedAverage = weightedSum / totalWeight;

    const stabilityFactor = space.features.stabilityScore * 0.5 + 0.5;
    const newState = weightedAverage > (0.6 * stabilityFactor);

    return {
      ...space,
      isOccupied: newState,
      stateHistory,
      lastStateChange: newState === previousSpace.isOccupied ?
        previousSpace.lastStateChange :
        Date.now(),
      confidence: Math.min(1, weightedAverage * stabilityFactor),
      features: {
        ...space.features,
        stabilityScore: newState === previousSpace.isOccupied ?
          Math.min(1, space.features.stabilityScore + 0.05) :
          Math.max(0, space.features.stabilityScore - 0.1)
      }
    };
  });
}

async function drawResults(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLVideoElement,
  spaces: ParkingSpace[]
): Promise<string> {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(img, 0, 0);

  spaces.forEach(space => {
    const { region, isOccupied, confidence, vehicleType, features } = space;
    const color = isOccupied ?
      `rgba(239, 68, 68, ${Math.max(0.5, confidence)})` :
      `rgba(34, 197, 94, ${Math.max(0.5, confidence)})`;

    ctx.strokeStyle = color;
    ctx.fillStyle = color.replace(/[\d\.]+\)$/, '0.2)');
    ctx.lineWidth = isOccupied ? 3 : 2;

    ctx.beginPath();
    ctx.moveTo(region.points[0].x, region.points[0].y);
    region.points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const bounds = getRegionBounds(region);
    const centerX = bounds.minX + bounds.width / 2;
    const centerY = bounds.minY + bounds.height / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(bounds.minX + 5, bounds.minY + 5, 100, 20);
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText(`${Math.round(confidence * 100)}%${vehicleType ? ` (${vehicleType})` : ''}`,
      bounds.minX + 10, bounds.minY + 19);

    const stabilityWidth = 30 * features.stabilityScore;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(bounds.minX + 5, bounds.minY + 30, 30, 5);
    ctx.fillStyle = features.stabilityScore > 0.7 ? 'rgba(34, 197, 94, 0.8)' :
      features.stabilityScore > 0.4 ? 'rgba(234, 179, 8, 0.8)' : 'rgba(239, 68, 68, 0.8)';
    ctx.fillRect(bounds.minX + 5, bounds.minY + 30, stabilityWidth, 5);

    if (settings.showDebugInfo) {
      ctx.font = '10px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText(
        `NZ:${features.nonZeroCount} ED:${features.edgeDensity.toFixed(2)}`,
        centerX - 30, centerY - 10
      );
      ctx.fillText(
        `TC:${features.textureComplexity.toFixed(2)} CV:${features.colorVariance.toFixed(2)}`,
        centerX - 30, centerY + 5
      );
      ctx.fillText(
        `SS:${features.stabilityScore.toFixed(2)} MS:${features.motionScore.toFixed(2)}`,
        centerX - 30, centerY + 20
      );
    }
  });

  return ctx.canvas.toDataURL('image/jpeg');
}

// Enhanced parking space detection functions

export async function detectParkingSpaces(
  imageSource: string | HTMLVideoElement,
  regions: Region[] | null | undefined = [],
  previousSpaces: ParkingSpace[] = []
): Promise<{
  total: number;
  occupied: number;
  available: number;
  spaces: ParkingSpace[];
  image?: string;
  processingTime?: number;
}> {
  const startTime = performance.now();

  try {
    if (!imageSource) {
      throw new Error('Invalid image source');
    }

    const validRegions: Region[] = Array.isArray(regions) ?
      regions.filter(region => {
        const isValid = region &&
          typeof region.id === 'string' &&
          Array.isArray(region.points) &&
          region.points.length >= 3 &&
          region.points.every(p =>
            p && typeof p.x === 'number' && typeof p.y === 'number'
          );
        return isValid;
      }) : [];

    const currentTime = Date.now();
    const timeDiff = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    if (timeDiff < 1000 / 30 && frameCount > 0 && frameCount % CONFIG.MAX_FRAME_SKIP !== 0) {
      frameCount++;
      return {
        total: previousSpaces.length,
        occupied: previousSpaces.filter(s => s.isOccupied).length,
        available: previousSpaces.filter(s => !s.isOccupied).length,
        spaces: previousSpaces,
        processingTime: 0
      };
    }

    // Load models with better error handling
    const modelsLoaded = await loadModels();
    if (!modelsLoaded) {
      console.warn('Models not loaded, proceeding with basic detection');
      // Continue with basic detection even if models fail to load
    }

    frameCount++;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('willReadFrequently', 'true');
    const ctx = canvas.getContext('2d', {
      willReadFrequently: true
    });
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    let img: HTMLImageElement | HTMLVideoElement;
    if (typeof imageSource === 'string') {
      img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageSource;
      });
    } else {
      img = imageSource;

      // Enhanced video readiness check with comprehensive state handling
      if (img instanceof HTMLVideoElement) {
        const stateMap = {
          0: 'HAVE_NOTHING',
          1: 'HAVE_METADATA',
          2: 'HAVE_CURRENT_DATA',
          3: 'HAVE_FUTURE_DATA',
          4: 'HAVE_ENOUGH_DATA'
        };

        console.log(`Video readyState: ${img.readyState} (${stateMap[img.readyState]})`);

        // Check if video has ended - stop processing to prevent infinite loop
        if (img.ended) {
          console.log('Video has ended, stopping detection');
          return {
            total: previousSpaces.length,
            occupied: previousSpaces.filter(s => s.isOccupied).length,
            available: previousSpaces.filter(s => !s.isOccupied).length,
            spaces: previousSpaces,
            processingTime: performance.now() - startTime
          };
        }

        // Check if video has sufficient data for frame extraction
        if (img.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          console.log('Video not ready for processing, attempting to ensure readiness...');
          
          try {
            // Try to ensure video is ready
            await ensureVideoReady(img);
          } catch (error) {
            console.warn('Video readiness check failed:', error);
            // Continue with processing anyway - sometimes videos work even with low readyState
          }
        }

        // Additional checks for video validity
        if (img.videoWidth === 0 || img.videoHeight === 0) {
          throw new Error('Video has invalid dimensions');
        }

        // Check if video is paused but has data
        if (img.paused && img.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          console.log('Video is paused but has current data, proceeding with processing');
        }

        console.log(`Video processing: width=${img.videoWidth}, height=${img.videoHeight}, currentTime=${img.currentTime}, duration=${img.duration}, ended=${img.ended}, paused=${img.paused}`);

      } else if (img instanceof HTMLImageElement) {
        // Image validation
        if (!img.complete || img.naturalWidth === 0) {
          throw new Error('Image is not fully loaded or has invalid dimensions');
        }
        console.log(`Image processing: width=${img.naturalWidth}, height=${img.naturalHeight}`);
      } else {
        throw new Error('Unsupported media type');
      }
    }

    // Resize to target size for consistent processing
    canvas.width = CONFIG.TARGET_SIZE[1];
    canvas.height = CONFIG.TARGET_SIZE[0];
    
    try {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } catch (drawError) {
      console.error('Failed to draw image to canvas:', drawError);
      throw new Error('Failed to process image/video frame');
    }

    let tensor: tf.Tensor3D | null = null;
    let enhanced: tf.Tensor3D | null = null;
    let processed: tf.Tensor3D | null = null;

    try {
      // Convert image to tensor with consistent size
      tensor = tf.tidy(() => {
        const t = tf.browser.fromPixels(canvas);
        return tf.cast(t, 'float32').div(255);
      });

      // Enhanced preprocessing pipeline
      enhanced = tf.tidy(() => {
        // Apply CLAHE-like contrast enhancement
        const lab = tf.image.rgbToGrayscale(tensor);
        const blurred = tf.tidy(() => {
          const kernel = generateGaussianKernel(3, 1.5);
          return tf.depthwiseConv2d(lab, kernel, 1, 'same');
        });
        const detail = tf.sub(lab, blurred);
        const enhancedDetail = tf.mul(detail, tf.scalar(2.0));
        return tf.add(blurred, enhancedDetail);
      });

      processed = tf.tidy(() => {
        // Multi-stage adaptive thresholding
        const binary1 = adaptiveThreshold(enhanced, 15, 5);
        const binary2 = adaptiveThreshold(enhanced, 25, 10);

        // Convert to boolean before logical operation
        const bool1 = tf.greater(binary1, tf.scalar(0.5));
        const bool2 = tf.greater(binary2, tf.scalar(0.5));

        const combined = tf.logicalOr(bool1, bool2);
        const cleaned = medianBlur(tf.cast(combined, 'float32'), 3);
        return dilate(cleaned, 2);
      });

      const motionScore = settings.useMotionDetection ?
        calculateEnhancedMotionScore(tensor, previousFrame) : 0;

      if (previousFrame) previousFrame.dispose();
      previousFrame = tensor.clone();

      let spaces: ParkingSpace[] = await Promise.all(validRegions.map(async (region, index) => {
        try {
          const bounds = getRegionBounds(region);
          if (bounds.width < CONFIG.PARKING_SPACE_MIN_SIZE || bounds.height < CONFIG.PARKING_SPACE_MIN_SIZE) {
            return createEmptySpace(index, region);
          }

          const regionImageData = ctx.getImageData(
            Math.max(0, bounds.minX),
            Math.max(0, bounds.minY),
            Math.min(canvas.width - bounds.minX, bounds.width),
            Math.min(canvas.height - bounds.minY, bounds.height)
          );

          // Enhanced feature extraction
          const nonZeroCount = countNonZeroPixels(regionImageData);
          const normalizedCount = nonZeroCount / (regionImageData.width * regionImageData.height);
          const shadowScore = calculateEnhancedShadowScore(regionImageData);
          const dynamicThreshold = calculateDynamicThreshold(regionImageData);
          const colorVariance = calculateColorVariance(regionImageData);
          const textureFeatures = calculateEnhancedTextureFeatures(regionImageData);
          const edgeFeatures = calculateEnhancedEdgeFeatures(regionImageData);

          const previousSpace = previousSpaces.find(s => s.id === index);
          const stabilityScore = previousSpace?.features.stabilityScore || 0.5;

          // Enhanced decision logic
          const isShadow = shadowScore < CONFIG.SHADOW_THRESHOLD;
          const hasMotion = motionScore > CONFIG.MOTION_INFLUENCE * stabilityScore;
          const hasTexture = textureFeatures.complexity > CONFIG.TEXTURE_COMPLEXITY_THRESHOLD;
          const hasEdges = edgeFeatures.density > CONFIG.EDGE_DENSITY_THRESHOLD;
          const hasColorVariation = colorVariance > CONFIG.COLOR_VARIANCE_THRESHOLD;

          const occupancyScore =
            (normalizedCount * 0.4) +
            (hasTexture ? 0.2 : 0) +
            (hasEdges ? 0.2 : 0) +
            (hasColorVariation ? 0.1 : 0) +
            (hasMotion ? 0.1 : 0);

          const isOccupied = isShadow && occupancyScore > dynamicThreshold;

          const confidence = Math.min(1,
            (isShadow ? (1 - Math.abs(occupancyScore - dynamicThreshold)) : 0.5) *
            (1 + 0.3 * motionScore) *
            stabilityScore
          );

          const space: ParkingSpace = {
            id: index,
            region,
            isOccupied,
            confidence,
            lastStateChange: Date.now(),
            stateHistory: previousSpace?.stateHistory || [],
            features: {
              nonZeroCount,
              brightness: calculateBrightness(regionImageData),
              edgeDensity: edgeFeatures.density,
              textureComplexity: textureFeatures.complexity,
              perspectiveScore: 1 - ((bounds.minY + bounds.maxY) / 2) / canvas.height,
              heatmapScore: normalizedCount,
              colorVariance,
              motionScore,
              shadowScore,
              stabilityScore
            }
          };

          // Enhanced verification triggering - only if models are loaded
          const shouldVerify = modelsLoaded && settings.useAdaptiveVerification && (
            frameCount % CONFIG.MODEL_VERIFICATION_INTERVAL === 0 ||
            (space.isOccupied && space.confidence < 0.85) ||
            (!space.isOccupied && space.confidence > CONFIG.UNCERTAINTY_THRESHOLD * 0.8) ||
            (motionScore > 0.25 && Math.abs(occupancyScore - dynamicThreshold) < 0.1)
          );

          if (shouldVerify) {
            return await verifyWithModel(space, tensor!);
          }
          return space;
        } catch (error) {
          console.error(`Error processing region ${index}:`, error);
          return createEmptySpace(index, region);
        }
      }));

      spaces = applyEnhancedTemporalSmoothing(spaces, previousSpaces);

      const resultImage = settings.showDebugInfo ?
        await drawResults(ctx, img, spaces) :
        undefined;

      const processingTime = performance.now() - startTime;

      return {
        total: spaces.length,
        occupied: spaces.filter(s => s.isOccupied).length,
        available: spaces.filter(s => !s.isOccupied).length,
        spaces,
        image: resultImage,
        processingTime
      };
    } finally {
      tensor?.dispose();
      enhanced?.dispose();
      processed?.dispose();
    }
  } catch (error) {
    console.error('Detection failed:', error);
    throw error;
  }
}

function generateGaussianKernel(size: number, sigma: number): tf.Tensor2D {
  const kernel = Array(size * size).fill(0);
  const center = Math.floor(size / 2);
  let sum = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const value = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      kernel[y * size + x] = value;
      sum += value;
    }
  }

  // Normalize the kernel
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= sum;
  }

  return tf.tensor2d(kernel, [size, size]).expandDims(2).expandDims(3);
}

function calculateEnhancedMotionScore(currentFrame: tf.Tensor3D, previousFrame: tf.Tensor3D | null): number {
  if (!previousFrame) return 0;
  return tf.tidy(() => {
    // Convert to grayscale first
    const currentGray = tf.image.rgbToGrayscale(currentFrame);
    const previousGray = tf.image.rgbToGrayscale(previousFrame);

    // Calculate absolute difference
    const diff = tf.abs(tf.sub(currentGray, previousGray));

    // Apply threshold to ignore small changes
    const thresholded = tf.greater(diff, tf.scalar(0.05));

    // Calculate percentage of changed pixels
    const changedPixels = tf.sum(tf.cast(thresholded, 'float32'));
    const totalPixels = currentGray.shape[0] * currentGray.shape[1];

    return changedPixels.dataSync()[0] / totalPixels;
  });
}

function calculateEnhancedShadowScore(imageData: ImageData): number {
  const edgeFeatures = calculateEnhancedEdgeFeatures(imageData);
  const textureFeatures = calculateEnhancedTextureFeatures(imageData);
  const colorVariance = calculateColorVariance(imageData);
  const brightness = calculateBrightness(imageData);

  // Enhanced shadow detection using multiple features
  const edgeScore = Math.max(0, 1 - (edgeFeatures.density / (CONFIG.EDGE_DENSITY_THRESHOLD * 1.5)));
  const textureScore = Math.max(0, 1 - (textureFeatures.complexity / (CONFIG.TEXTURE_COMPLEXITY_THRESHOLD * 1.5)));
  const colorScore = Math.max(0, 1 - (colorVariance / (CONFIG.COLOR_VARIANCE_THRESHOLD * 1.5)));
  const brightnessScore = Math.max(0, 1 - (brightness / 0.5));

  // Weighted combination of features
  return (edgeScore * 0.4 + textureScore * 0.3 + colorScore * 0.2 + brightnessScore * 0.1);
}

function calculateEnhancedEdgeFeatures(imageData: ImageData): { density: number, orientation: number } {
  const edges = detectEdges(imageData);
  let strength = 0;
  let orientationSum = 0;
  let count = 0;

  edges.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value > 25) { // Threshold for significant edges
        strength += value;
        // Calculate local orientation (simplified)
        if (x > 0 && y > 0 && x < imageData.width - 1 && y < imageData.height - 1) {
          const dx = edges[y][x + 1] - edges[y][x - 1];
          const dy = edges[y + 1][x] - edges[y - 1][x];
          if (dx !== 0 || dy !== 0) {
            orientationSum += Math.atan2(dy, dx);
            count++;
          }
        }
      }
    });
  });

  const density = strength / (imageData.width * imageData.height * 255);
  const orientation = count > 0 ? orientationSum / count : 0;

  return { density, orientation };
}

function calculateEnhancedTextureFeatures(imageData: ImageData): { complexity: number, uniformity: number } {
  const data = imageData.data;
  const width = imageData.width;
  let complexity = 0;
  let uniformity = 0;
  let total = 0;
  const hist: number[] = Array(256).fill(0);

  for (let y = 1; y < imageData.height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const centerIdx = (y * width + x) * 4;
      const centerValue = (data[centerIdx] + data[centerIdx + 1] + data[centerIdx + 2]) / 3;
      hist[Math.floor(centerValue)]++;

      let pattern = 0;
      const neighbors = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
      for (let i = 0; i < neighbors.length; i++) {
        const [dy, dx] = neighbors[i];
        const idx = ((y + dy) * width + (x + dx)) * 4;
        const val = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        if (val > centerValue) pattern |= (1 << i);
      }

      let transitions = 0;
      for (let i = 0; i < 8; i++) {
        const bit1 = (pattern >> i) & 1;
        const bit2 = (pattern >> ((i + 1) % 8)) & 1;
        if (bit1 !== bit2) transitions++;
      }

      if (transitions <= 2) complexity++;
      total++;
    }
  }

  // Calculate uniformity from histogram
  let sumSquares = 0;
  for (let i = 0; i < hist.length; i++) {
    sumSquares += Math.pow(hist[i] / total, 2);
  }
  uniformity = sumSquares;

  return {
    complexity: complexity / total,
    uniformity
  };
}

function applyEnhancedTemporalSmoothing(currentSpaces: ParkingSpace[], previousSpaces: ParkingSpace[]): ParkingSpace[] {
  if (!previousSpaces || previousSpaces.length === 0 || !settings.useTemporalSmoothing) {
    return currentSpaces;
  }

  return currentSpaces.map(space => {
    const previousSpace = previousSpaces.find(s => s.id === space.id);
    if (!previousSpace) return space;

    const stateHistory = [...(previousSpace.stateHistory || []), space.isOccupied];
    if (stateHistory.length > CONFIG.MIN_CONSECUTIVE_FRAMES * 1.5) {
      stateHistory.shift();
    }

    // Calculate weighted state history with exponential decay
    const weights = stateHistory.map((_, i) => Math.pow(0.85, stateHistory.length - 1 - i));
    const weightedSum = stateHistory.reduce((sum, val, i) => sum + (val ? weights[i] : 0), 0);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const weightedAverage = weightedSum / totalWeight;

    // Enhanced stability calculation considering feature consistency
    const featureConsistency = Math.min(1,
      0.3 * (1 - Math.abs(space.features.edgeDensity - previousSpace.features.edgeDensity)) +
      0.3 * (1 - Math.abs(space.features.textureComplexity - previousSpace.features.textureComplexity)) +
      0.2 * (1 - Math.abs(space.features.colorVariance - previousSpace.features.colorVariance)) +
      0.2 * (1 - Math.abs(space.features.brightness - previousSpace.features.brightness))
    );

    const stabilityFactor = 0.7 * space.features.stabilityScore + 0.3 * featureConsistency;
    const newState = weightedAverage > (0.65 * stabilityFactor);

    // Calculate confidence with feature consistency
    const featureConfidence = Math.min(1,
      (space.features.edgeDensity > CONFIG.EDGE_DENSITY_THRESHOLD ? 1.2 : 0.8) *
      (space.features.textureComplexity > CONFIG.TEXTURE_COMPLEXITY_THRESHOLD ? 1.2 : 0.8) *
      (space.features.colorVariance > CONFIG.COLOR_VARIANCE_THRESHOLD ? 1.1 : 0.9)
    );

    return {
      ...space,
      isOccupied: newState,
      stateHistory,
      lastStateChange: newState === previousSpace.isOccupied ?
        previousSpace.lastStateChange :
        Date.now(),
      confidence: Math.min(1, weightedAverage * stabilityFactor * featureConfidence),
      features: {
        ...space.features,
        stabilityScore: newState === previousSpace.isOccupied ?
          Math.min(1, space.features.stabilityScore + 0.08) :
          Math.max(0, space.features.stabilityScore - 0.15)
      }
    };
  });
}

function createEmptySpace(index: number, region: Region): ParkingSpace {
  return {
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
  };
}

export function cleanup() {
  if (previousFrame) {
    previousFrame.dispose();
    previousFrame = null;
  }
  if (objectDetector) {
    objectDetector.dispose();
    objectDetector = null;
  }
  if (featureExtractor) {
    featureExtractor.dispose();
    featureExtractor = null;
  }
  // Reset model loading state
  isModelLoading = false;
  modelLoadingPromise = null;
  modelLoadAttempts = 0;
}

export function updateSettings(newSettings: Partial<typeof settings>) {
  Object.assign(settings, newSettings);
}

// Initialize models on module load with better error handling
loadModels().then(success => {
  if (success) {
    console.log('Models loaded successfully on initialization');
  } else {
    console.warn('Initial model loading failed, will retry on first detection');
  }
}).catch(error => {
  console.error('Initial model loading failed:', error);
});

export default {
  detectParkingSpaces,
  cleanup,
  updateSettings
};