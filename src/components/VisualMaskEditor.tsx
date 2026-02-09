import { useState, useRef, useEffect, MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface MaskRegion {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 0-100
  height: number; // percentage 0-100
}

interface VisualMaskEditorProps {
  imageUrl: string;
  masks: MaskRegion[];
  onMasksChange: (masks: MaskRegion[]) => void;
  readOnly?: boolean;
}

export const VisualMaskEditor = ({
  imageUrl,
  masks,
  onMasksChange,
  readOnly = false,
}: VisualMaskEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentMask, setCurrentMask] = useState<MaskRegion | null>(null);
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null);

  const getRelativePosition = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (readOnly) return;
    const pos = getRelativePosition(e);
    setIsDrawing(true);
    setStartPoint(pos);
    setCurrentMask({
      id: `mask-${Date.now()}`,
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
    });
    setSelectedMaskId(null);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPoint || readOnly) return;
    const pos = getRelativePosition(e);
    const width = pos.x - startPoint.x;
    const height = pos.y - startPoint.y;
    
    setCurrentMask({
      id: currentMask?.id || `mask-${Date.now()}`,
      x: width >= 0 ? startPoint.x : pos.x,
      y: height >= 0 ? startPoint.y : pos.y,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentMask || readOnly) return;
    setIsDrawing(false);
    
    // Only add mask if it has a minimum size (at least 1% in both dimensions)
    if (currentMask.width >= 1 && currentMask.height >= 1) {
      onMasksChange([...masks, currentMask]);
    }
    
    setCurrentMask(null);
    setStartPoint(null);
  };

  const handleDeleteMask = (maskId: string) => {
    onMasksChange(masks.filter(m => m.id !== maskId));
    setSelectedMaskId(null);
  };

  const handleMaskClick = (e: MouseEvent, maskId: string) => {
    e.stopPropagation();
    if (!readOnly) {
      setSelectedMaskId(maskId === selectedMaskId ? null : maskId);
    }
  };

  const clearAllMasks = () => {
    onMasksChange([]);
    setSelectedMaskId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Square className="h-4 w-4" />
          Mask Regions ({masks.length})
        </Label>
        {!readOnly && masks.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllMasks}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        )}
      </div>
      
      {!readOnly && (
        <p className="text-xs text-muted-foreground">
          Click and drag to draw mask regions. Masked areas will be ignored during comparison.
        </p>
      )}

      <div
        ref={containerRef}
        className="relative border rounded-lg overflow-hidden cursor-crosshair select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={imageUrl}
          alt="Screenshot with masks"
          className="w-full pointer-events-none"
          draggable={false}
        />
        
        {/* Existing masks */}
        {masks.map((mask) => (
          <div
            key={mask.id}
            className={`absolute border-2 transition-colors ${
              selectedMaskId === mask.id
                ? "bg-red-500/40 border-red-600"
                : "bg-yellow-500/30 border-yellow-500"
            } ${!readOnly ? "cursor-pointer hover:bg-red-500/30" : ""}`}
            style={{
              left: `${mask.x}%`,
              top: `${mask.y}%`,
              width: `${mask.width}%`,
              height: `${mask.height}%`,
            }}
            onClick={(e) => handleMaskClick(e, mask.id)}
          >
            {selectedMaskId === mask.id && !readOnly && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-3 -right-3 h-6 w-6 rounded-full shadow-md"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteMask(mask.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
        
        {/* Current drawing mask */}
        {currentMask && isDrawing && (
          <div
            className="absolute bg-blue-500/30 border-2 border-blue-500 border-dashed"
            style={{
              left: `${currentMask.x}%`,
              top: `${currentMask.y}%`,
              width: `${currentMask.width}%`,
              height: `${currentMask.height}%`,
            }}
          />
        )}
      </div>

      {/* Mask list */}
      {masks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {masks.map((mask, index) => (
            <Badge
              key={mask.id}
              variant={selectedMaskId === mask.id ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() => setSelectedMaskId(mask.id === selectedMaskId ? null : mask.id)}
            >
              Mask {index + 1}
              {!readOnly && (
                <button
                  className="ml-1 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMask(mask.id);
                  }}
                >
                  ×
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
