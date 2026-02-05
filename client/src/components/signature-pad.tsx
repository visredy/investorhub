import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Check } from 'lucide-react';

interface SignaturePadProps {
  onSign: (signatureData: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function SignaturePad({ onSign, onCancel, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSign = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    
    const signatureData = canvas.toDataURL('image/png');
    onSign(signatureData);
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-4 bg-muted/50">
        <p className="text-sm text-muted-foreground mb-3">
          Please sign in the box below using your mouse or finger:
        </p>
        <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            width={500}
            height={200}
            className="w-full touch-none cursor-crosshair"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            data-testid="canvas-signature"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Sign above
        </p>
      </div>
      
      <div className="flex flex-wrap gap-3 justify-end">
        <Button 
          type="button" 
          variant="outline" 
          onClick={clearSignature}
          disabled={!hasSignature || disabled}
          data-testid="button-clear-signature"
        >
          <Eraser className="w-4 h-4 mr-2" />
          Clear
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          disabled={disabled}
          data-testid="button-cancel-signature"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSign}
          disabled={!hasSignature || disabled}
          data-testid="button-confirm-signature"
        >
          <Check className="w-4 h-4 mr-2" />
          Sign Agreement
        </Button>
      </div>
    </div>
  );
}
