import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';

interface ParkingSpace {
  id: number;
  region: {
    id: string;
    points: { x: number; y: number; }[];
    type: 'rectangle' | 'quadrilateral';
  };
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

interface ParkingSpaceCanvasProps {
  spaces: ParkingSpace[];
  width?: number;
  height?: number;
  showLabels?: boolean;
  showConfidence?: boolean;
  animateChanges?: boolean;
  className?: string;
}

const ParkingSpaceCanvas: React.FC<ParkingSpaceCanvasProps> = ({
  spaces,
  width = 400,
  height = 300,
  showLabels = true,
  showConfidence = true,
  animateChanges = true,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();
  const [animatingSpaces, setAnimatingSpaces] = useState<Set<number>>(new Set());
  const [canvasSize, setCanvasSize] = useState({ width, height });
  const previousSpacesRef = useRef<ParkingSpace[]>([]);

  // Responsive canvas sizing
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        const containerWidth = container.clientWidth;
        const containerHeight = Math.min(container.clientHeight || 400, window.innerHeight * 0.6);
        
        // Maintain aspect ratio while fitting container
        const aspectRatio = width / height;
        let newWidth = containerWidth;
        let newHeight = containerWidth / aspectRatio;
        
        if (newHeight > containerHeight) {
          newHeight = containerHeight;
          newWidth = containerHeight * aspectRatio;
        }
        
        setCanvasSize({ 
          width: Math.floor(newWidth), 
          height: Math.floor(newHeight) 
        });
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [width, height]);

  // Calculate grid layout
  const calculateGridLayout = useCallback((spaceCount: number) => {
    if (spaceCount === 0) return { cols: 0, rows: 0, cellWidth: 0, cellHeight: 0, padding: 0 };
    
    const aspectRatio = canvasSize.width / canvasSize.height;
    let cols = Math.ceil(Math.sqrt(spaceCount * aspectRatio));
    let rows = Math.ceil(spaceCount / cols);
    
    while (rows > cols && cols < spaceCount) {
      cols++;
      rows = Math.ceil(spaceCount / cols);
    }
    
    const padding = Math.max(8, Math.min(16, canvasSize.width * 0.02));
    const cellWidth = (canvasSize.width - padding * 2) / cols;
    const cellHeight = (canvasSize.height - padding * 2 - 60) / rows; // Reserve space for legend
    
    return { cols, rows, cellWidth, cellHeight, padding };
  }, [canvasSize]);

  // Draw legend
  const drawLegend = useCallback((ctx: CanvasRenderingContext2D) => {
    const legendY = canvasSize.height - 60;
    const legendHeight = 50;
    const fontSize = Math.max(10, Math.min(14, canvasSize.width * 0.025));
    
    // Legend background with rounded corners
    ctx.fillStyle = settings.enableDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(0, legendY, canvasSize.width, legendHeight);
    
    // Legend border
    ctx.strokeStyle = settings.enableDarkMode ? '#374151' : '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, legendY, canvasSize.width, legendHeight);
    
    const textColor = settings.enableDarkMode ? '#ffffff' : '#000000';
    ctx.fillStyle = textColor;
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    ctx.textAlign = 'left';
    
    const legendItems = [
      { color: 'rgba(34, 197, 94, 0.8)', label: 'Available', x: 10 },
      { color: 'rgba(239, 68, 68, 0.8)', label: 'Occupied', x: canvasSize.width * 0.25 },
      { color: '#10b981', label: 'High Stability', x: canvasSize.width * 0.5, isCircle: true }
    ];
    
    legendItems.forEach(item => {
      if (item.isCircle) {
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(item.x + 8, legendY + 17, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = textColor;
        ctx.fillText(item.label, item.x + 20, legendY + 22);
      } else {
        ctx.fillStyle = item.color;
        ctx.fillRect(item.x, legendY + 10, 15, 15);
        ctx.fillStyle = textColor;
        ctx.fillText(item.label, item.x + 20, legendY + 22);
      }
    });
    
    // Stats
    const availableCount = spaces.filter(s => !s.isOccupied).length;
    const occupiedCount = spaces.filter(s => s.isOccupied).length;
    const occupancyRate = spaces.length > 0 ? Math.round((occupiedCount / spaces.length) * 100) : 0;
    
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(
      `${availableCount} Available | ${occupiedCount} Occupied | ${occupancyRate}% Full`, 
      canvasSize.width - 10, 
      legendY + 22
    );
  }, [canvasSize, settings.enableDarkMode, spaces]);

  // Draw the parking spaces grid
  const drawParkingGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    
    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvasSize.height);
    if (settings.enableDarkMode) {
      gradient.addColorStop(0, '#1f2937');
      gradient.addColorStop(1, '#111827');
    } else {
      gradient.addColorStop(0, '#f9fafb');
      gradient.addColorStop(1, '#f3f4f6');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
    
    if (spaces.length === 0) {
      // Show empty state
      ctx.fillStyle = settings.enableDarkMode ? '#6b7280' : '#9ca3af';
      ctx.font = `${Math.max(14, canvasSize.width * 0.03)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('No parking spaces defined', canvasSize.width / 2, canvasSize.height / 2);
      return;
    }
    
    const { cols, rows, cellWidth, cellHeight, padding } = calculateGridLayout(spaces.length);
    const fontSize = Math.max(10, Math.min(16, Math.min(cellWidth, cellHeight) * 0.15));
    
    spaces.forEach((space, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      
      const x = padding + col * cellWidth;
      const y = padding + row * cellHeight;
      const spaceWidth = cellWidth - 8;
      const spaceHeight = cellHeight - 8;
      
      // Skip if space is too small
      if (spaceWidth < 40 || spaceHeight < 30) return;
      
      // Determine colors based on occupancy
      let fillColor: string;
      let borderColor: string;
      let textColor: string;
      
      if (space.isOccupied) {
        const alpha = Math.max(0.7, space.confidence);
        fillColor = `rgba(239, 68, 68, ${alpha})`;
        borderColor = '#dc2626';
        textColor = '#ffffff';
      } else {
        const alpha = Math.max(0.7, space.confidence);
        fillColor = `rgba(34, 197, 94, ${alpha})`;
        borderColor = '#16a34a';
        textColor = '#ffffff';
      }
      
      // Add animation effect for recently changed spaces
      const isAnimating = animatingSpaces.has(space.id);
      if (isAnimating) {
        const time = Date.now() / 200;
        const pulse = 0.8 + 0.2 * Math.sin(time);
        fillColor = fillColor.replace(/[\d\.]+\)$/, `${pulse})`);
      }
      
      // Draw space with rounded corners and shadow
      const cornerRadius = Math.min(8, spaceWidth * 0.1, spaceHeight * 0.1);
      
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.roundRect(x + 6, y + 6, spaceWidth, spaceHeight, cornerRadius);
      ctx.fill();
      
      // Main space
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 4, spaceWidth, spaceHeight, cornerRadius);
      ctx.fill();
      
      // Border
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw space number
      if (showLabels && spaceWidth > 50) {
        ctx.fillStyle = textColor;
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(
          `P${space.id + 1}`,
          x + 4 + spaceWidth / 2,
          y + 4 + spaceHeight / 2 - fontSize / 4
        );
      }
      
      // Draw confidence percentage
      if (showConfidence && spaceWidth > 60 && spaceHeight > 40) {
        ctx.fillStyle = textColor;
        ctx.font = `${Math.max(8, fontSize * 0.7)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(
          `${Math.round(space.confidence * 100)}%`,
          x + 4 + spaceWidth / 2,
          y + 4 + spaceHeight / 2 + fontSize / 2
        );
      }
      
      // Draw vehicle type if available
      if (space.vehicleType && space.isOccupied && spaceWidth > 80 && spaceHeight > 50) {
        ctx.fillStyle = textColor;
        ctx.font = `${Math.max(6, fontSize * 0.5)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        ctx.textAlign = 'center';
        const vehicleText = space.vehicleType.length > 8 
          ? space.vehicleType.substring(0, 8) + '...' 
          : space.vehicleType;
        ctx.fillText(
          vehicleText,
          x + 4 + spaceWidth / 2,
          y + 4 + spaceHeight - 8
        );
      }
      
      // Draw stability indicator (small dot in corner)
      if (spaceWidth > 40) {
        const stabilityColor = space.features.stabilityScore > 0.7 
          ? '#10b981' 
          : space.features.stabilityScore > 0.4 
          ? '#f59e0b' 
          : '#ef4444';
        
        ctx.fillStyle = stabilityColor;
        ctx.beginPath();
        ctx.arc(x + spaceWidth - 2, y + 10, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    // Draw legend
    drawLegend(ctx);
  }, [spaces, canvasSize, settings.enableDarkMode, animatingSpaces, showLabels, showConfidence, calculateGridLayout, drawLegend]);
  
  // Detect changes and trigger animations
  useEffect(() => {
    if (animateChanges && previousSpacesRef.current.length > 0) {
      const changedSpaces = new Set<number>();
      
      spaces.forEach(space => {
        const prevSpace = previousSpacesRef.current.find(p => p.id === space.id);
        if (prevSpace && prevSpace.isOccupied !== space.isOccupied) {
          changedSpaces.add(space.id);
        }
      });
      
      if (changedSpaces.size > 0) {
        setAnimatingSpaces(changedSpaces);
        
        setTimeout(() => {
          setAnimatingSpaces(new Set());
        }, 2000);
      }
    }
    
    previousSpacesRef.current = [...spaces];
  }, [spaces, animateChanges]);
  
  // Redraw when dependencies change
  useEffect(() => {
    drawParkingGrid();
  }, [drawParkingGrid]);
  
  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <canvas
        ref={canvasRef}
        className={`w-full h-auto border rounded-xl shadow-lg transition-all duration-300 ${
          settings.enableDarkMode ? 'border-gray-600' : 'border-gray-300'
        }`}
        style={{ 
          maxWidth: '100%', 
          height: 'auto',
          aspectRatio: `${canvasSize.width} / ${canvasSize.height}`
        }}
      />
      
      {/* Real-time update indicator */}
      <div className={`absolute top-3 right-3 flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm backdrop-blur-sm ${
        settings.enableDarkMode ? 'bg-gray-800/90 text-green-400' : 'bg-white/90 text-green-600'
      } shadow-lg`}>
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="font-medium">Live</span>
      </div>
    </div>
  );
};

export default ParkingSpaceCanvas;