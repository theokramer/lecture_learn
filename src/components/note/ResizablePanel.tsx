import React, { useState, useRef, useEffect } from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
  minWidth?: number;
  initialWidth?: number;
  onResize?: (width: number) => void;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  minWidth = 200,
  initialWidth,
  onResize,
}) => {
  const [width, setWidth] = useState(initialWidth || 300);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      const clampedWidth = Math.max(minWidth, Math.min(newWidth, window.innerWidth - 400));
      
      setWidth(clampedWidth);
      onResize?.(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minWidth, onResize]);

  return (
    <div
      ref={panelRef}
      className="relative flex"
      style={{ width: `${width}px`, minWidth: `${minWidth}px` }}
    >
      {children}
      
      {/* Resize Handle */}
      <div
        onMouseDown={() => setIsResizing(true)}
        className="absolute right-0 top-0 bottom-0 w-1 hover:w-2 hover:bg-[#b85a3a] cursor-col-resize transition-all z-10"
      />
    </div>
  );
};
