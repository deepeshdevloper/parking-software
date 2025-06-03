import React, { useState, useRef, useEffect } from 'react';
import { Copy, Clipboard, Undo, Redo, Trash } from 'lucide-react';
import { create } from 'zustand';

interface Point {
  x: number;
  y: number;
}

interface Region {
  id: string;
  points: Point[];
  type: 'rectangle' | 'quadrilateral';
}

interface HistoryState {
  past: Region[][];
  present: Region[];
  future: Region[][];
  addToHistory: (regions: Region[]) => void;
  undo: () => void;
  redo: () => void;
}

const useHistory = create<HistoryState>((set) => ({
  past: [],
  present: [],
  future: [],
  addToHistory: (regions) =>
    set((state) => ({
      past: [...state.past, state.present],
      present: regions,
      future: [],
    })),
  undo: () =>
    set((state) => {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }),
  redo: () =>
    set((state) => {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    }),
}));

interface RegionSelectorProps {
  imageUrl: string;
  onRegionsChange: (regions: Region[]) => void;
}

const RegionSelector: React.FC<RegionSelectorProps> = ({ imageUrl, onRegionsChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [activeRegion, setActiveRegion] = useState<Region | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<{regionId: string, pointIndex: number} | null>(null);
  const [mode, setMode] = useState<'draw' | 'edit'>('draw');
  const [drawType, setDrawType] = useState<'rectangle' | 'quadrilateral'>('rectangle');
  const [copiedRegion, setCopiedRegion] = useState<Region | null>(null);
  const history = useHistory();
  const [scale, setScale] = useState(1);
  const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!imageUrl) return;

    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      if (canvasRef.current && containerRef.current) {
        // Store original image dimensions
        setOriginalSize({ width: img.width, height: img.height });

        // Calculate scale to fit container while maintaining aspect ratio
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        const scaleX = containerWidth / img.width;
        const scaleY = containerHeight / img.height;
        const newScale = Math.min(scaleX, scaleY);
        setScale(newScale);

        // Set canvas dimensions to original image size
        canvasRef.current.width = img.width;
        canvasRef.current.height = img.height;

        // Set display size
        canvasRef.current.style.width = `${img.width * newScale}px`;
        canvasRef.current.style.height = `${img.height * newScale}px`;

        redrawCanvas();
      }
    };
  }, [imageUrl]);

  useEffect(() => {
    onRegionsChange(regions);
    redrawCanvas();
  }, [regions]);

  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedRegion) {
        setCopiedRegion(selectedRegion);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v' && copiedRegion) {
        pasteRegion();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        history.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        history.redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedRegion) {
          deleteRegion(selectedRegion.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [selectedRegion, copiedRegion]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    const img = new Image();
    img.src = imageUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw regions
    regions.forEach((region) => {
      ctx.beginPath();
      ctx.strokeStyle = region === selectedRegion ? '#00ff00' : 
                       region === activeRegion ? '#0088ff' : '#ff0000';
      ctx.lineWidth = 2;

      if (region.points.length > 0) {
        ctx.moveTo(region.points[0].x, region.points[0].y);
        region.points.forEach((point) => {
          ctx.lineTo(point.x, point.y);
        });
        if (region.type === 'rectangle' || region.points.length === 4) {
          ctx.closePath();
        }
      }
      ctx.stroke();

      // Draw points
      region.points.forEach((point, pointIndex) => {
        ctx.beginPath();
        ctx.fillStyle = selectedPoint?.regionId === region.id && selectedPoint?.pointIndex === pointIndex
          ? '#00ff00'
          : region === selectedRegion ? '#00ff00' : '#ff0000';
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  };

  const getMousePos = (e: React.MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e);

    if (mode === 'edit') {
      // Check if clicking on a point
      for (const region of regions) {
        const pointIndex = region.points.findIndex(point => 
          Math.hypot(point.x - pos.x, point.y - pos.y) < 10
        );
        if (pointIndex !== -1) {
          setSelectedPoint({ regionId: region.id, pointIndex });
          setActiveRegion(region);
          setSelectedRegion(region);
          return;
        }
      }

      // Check if clicking inside a region
      for (const region of regions) {
        if (isPointInRegion(pos, region)) {
          setSelectedRegion(region);
          return;
        }
      }

      setSelectedRegion(null);
    } else {
      // Start drawing new region
      const newRegion: Region = {
        id: Date.now().toString(),
        points: [pos],
        type: drawType
      };
      const newRegions = [...regions, newRegion];
      setRegions(newRegions);
      setActiveRegion(newRegion);
      setIsDrawing(true);
      history.addToHistory(newRegions);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getMousePos(e);

    if (selectedPoint) {
      // Update point position
      const newRegions = regions.map(region => 
        region.id === selectedPoint.regionId
          ? {
              ...region,
              points: region.points.map((point, index) =>
                index === selectedPoint.pointIndex ? pos : point
              )
            }
          : region
      );
      setRegions(newRegions);
    } else if (isDrawing && activeRegion) {
      // Update region while drawing
      if (drawType === 'rectangle') {
        const startPoint = activeRegion.points[0];
        const newRegions = regions.map(region =>
          region.id === activeRegion.id
            ? {
                ...region,
                points: [
                  startPoint,
                  { x: pos.x, y: startPoint.y },
                  pos,
                  { x: startPoint.x, y: pos.y }
                ]
              }
            : region
        );
        setRegions(newRegions);
      } else {
        // For quadrilateral, just update the last point
        const newRegions = regions.map(region =>
          region.id === activeRegion.id
            ? {
                ...region,
                points: [...region.points.slice(0, -1), pos]
              }
            : region
        );
        setRegions(newRegions);
      }
    }
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      history.addToHistory(regions);
    }
    setIsDrawing(false);
    setSelectedPoint(null);

    if (activeRegion && drawType === 'quadrilateral') {
      if (activeRegion.points.length < 4) {
        const pos = activeRegion.points[activeRegion.points.length - 1];
        const newRegions = regions.map(region =>
          region.id === activeRegion.id
            ? {
                ...region,
                points: [...region.points, pos]
              }
            : region
        );
        setRegions(newRegions);
      } else {
        setActiveRegion(null);
      }
    } else {
      setActiveRegion(null);
    }
  };

  const isPointInRegion = (point: Point, region: Region): boolean => {
    const points = region.points;
    if (points.length < 3) return false;

    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y;
      const xj = points[j].x, yj = points[j].y;
      
      const intersect = ((yi > point.y) !== (yj > point.y))
          && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const copyRegion = () => {
    if (selectedRegion) {
      setCopiedRegion(selectedRegion);
    }
  };

  const pasteRegion = () => {
    if (copiedRegion) {
      const offset = 20; // Offset for pasted region
      const newRegion: Region = {
        ...copiedRegion,
        id: Date.now().toString(),
        points: copiedRegion.points.map(point => ({
          x: point.x + offset,
          y: point.y + offset
        }))
      };
      const newRegions = [...regions, newRegion];
      setRegions(newRegions);
      history.addToHistory(newRegions);
    }
  };

  const deleteRegion = (regionId: string) => {
    const newRegions = regions.filter(region => region.id !== regionId);
    setRegions(newRegions);
    setSelectedRegion(null);
    setActiveRegion(null);
    history.addToHistory(newRegions);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => setMode('draw')}
              className={`px-3 py-1 rounded ${
                mode === 'draw' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              Draw
            </button>
            <button
              onClick={() => setMode('edit')}
              className={`px-3 py-1 rounded ${
                mode === 'edit' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              Edit
            </button>
          </div>
        </div>

        {mode === 'draw' && (
          <div>
            <label className="block text-sm font-medium mb-1">Shape</label>
            <div className="flex gap-2">
              <button
                onClick={() => setDrawType('rectangle')}
                className={`px-3 py-1 rounded ${
                  drawType === 'rectangle' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                Rectangle
              </button>
              <button
                onClick={() => setDrawType('quadrilateral')}
                className={`px-3 py-1 rounded ${
                  drawType === 'quadrilateral' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                Quadrilateral
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 items-end">
          <button
            onClick={copyRegion}
            disabled={!selectedRegion}
            className={`p-2 rounded ${
              selectedRegion 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title="Copy (Ctrl+C)"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={pasteRegion}
            disabled={!copiedRegion}
            className={`p-2 rounded ${
              copiedRegion 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title="Paste (Ctrl+V)"
          >
            <Clipboard size={16} />
          </button>
          <button
            onClick={history.undo}
            disabled={history.past.length === 0}
            className={`p-2 rounded ${
              history.past.length > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo size={16} />
          </button>
          <button
            onClick={history.redo}
            disabled={history.future.length === 0}
            className={`p-2 rounded ${
              history.future.length > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title="Redo (Ctrl+Y)"
          >
            <Redo size={16} />
          </button>
        </div>
      </div>

      <div className="relative" ref={containerRef} style={{ height: '400px' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="border border-gray-300 dark:border-gray-600 rounded-lg cursor-crosshair"
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      </div>

      <div className="space-y-2">
        <h3 className="font-medium">Regions ({regions.length})</h3>
        <div className="space-y-1">
          {regions.map((region) => (
            <div 
              key={region.id}
              className={`flex items-center justify-between p-2 rounded transition-colors ${
                region === selectedRegion
                  ? 'bg-blue-100 dark:bg-blue-900'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}
              onClick={() => setSelectedRegion(region)}
            >
              <span>
                {region.type} - {region.points.length} points
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteRegion(region.id);
                }}
                className="text-red-500 hover:text-red-600"
              >
                <Trash size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RegionSelector;

