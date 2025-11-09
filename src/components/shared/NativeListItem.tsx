import React, { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ContextMenu, ContextMenuAction } from './ContextMenu';

interface NativeListItemProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  contextMenuActions?: ContextMenuAction[];
  className?: string;
  isSelected?: boolean;
}

const LONG_PRESS_DURATION = 500; // ms

export const NativeListItem: React.FC<NativeListItemProps> = ({
  children,
  onPress,
  onLongPress,
  contextMenuActions = [],
  className = '',
  isSelected = false,
}) => {
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const [isPressed, setIsPressed] = useState(false);
  const longPressOccurredRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsPressed(true);
    longPressOccurredRef.current = false;
    
    // Start long press timer
    longPressTimerRef.current = setTimeout(() => {
      if (itemRef.current) {
        const rect = itemRef.current.getBoundingClientRect();
        setContextMenuPosition({
          x: e.clientX,
          y: e.clientY,
        });
        setContextMenuOpen(true);
        longPressOccurredRef.current = true;
        if (onLongPress) {
          onLongPress();
        }
      }
      setIsPressed(false);
    }, LONG_PRESS_DURATION);
  }, [onLongPress]);

  const handlePointerUp = useCallback(() => {
    setIsPressed(false);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // Reset after a short delay to allow click handler to check
    setTimeout(() => {
      longPressOccurredRef.current = false;
    }, 100);
  }, []);

  const handlePointerCancel = useCallback(() => {
    setIsPressed(false);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Only trigger onPress if we didn't just open a context menu and it wasn't a long press
    if (!contextMenuOpen && onPress && !longPressOccurredRef.current) {
      onPress();
    }
  }, [onPress, contextMenuOpen]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <motion.div
        ref={itemRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleClick}
        whileTap={{ scale: isPressed ? 0.98 : 1 }}
        className={`
          relative
          ${isSelected 
            ? 'bg-[#3a3a3a]' 
            : 'bg-[#2a2a2a] active:bg-[#3a3a3a]'
          }
          transition-colors duration-150
          ${className}
        `}
      >
        {children}
      </motion.div>

      {contextMenuActions.length > 0 && (
        <ContextMenu
          actions={contextMenuActions}
          isOpen={contextMenuOpen}
          onClose={() => setContextMenuOpen(false)}
          position={contextMenuPosition}
        />
      )}
    </>
  );
};

