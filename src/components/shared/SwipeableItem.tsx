import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useAnimation, useTransform } from 'framer-motion';
import { HiTrash, HiArrowsUpDown } from 'react-icons/hi2';

interface DragInfo {
  offset: { x: number; y: number };
  velocity: { x: number; y: number };
}

interface SwipeableItemProps {
  children: React.ReactNode;
  onDelete: () => void;
  onMove: () => void;
  isCompact?: boolean;
  className?: string;
}

const SWIPE_THRESHOLD = 80; // pixels to swipe before triggering action
const DELETE_ACTION_WIDTH = 80;
const MOVE_ACTION_WIDTH = 80;

export const SwipeableItem: React.FC<SwipeableItemProps> = ({
  children,
  onDelete,
  onMove,
  isCompact: _isCompact = false,
  className = '',
}) => {
  const x = useMotionValue(0);
  const controls = useAnimation();
  const [isPressed, setIsPressed] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  // Transform x position to opacity for action buttons
  const deleteOpacity = useTransform(x, [-DELETE_ACTION_WIDTH, 0], [1, 0]);
  const moveOpacity = useTransform(x, [0, MOVE_ACTION_WIDTH], [0, 1]);

  const handleDragStart = () => {
    setHasDragged(false);
  };

  const handleDrag = () => {
    setHasDragged(true);
  };

  const handleDragEnd = async (_event: MouseEvent | TouchEvent | PointerEvent, info: DragInfo) => {
    const offset = info.offset.x;
    
    // Only trigger swipe actions if user actually dragged
    if (hasDragged) {
      // Determine action based on swipe direction and distance
      if (offset < -SWIPE_THRESHOLD) {
        // Swiped left - reveal delete
        await controls.start({ x: -DELETE_ACTION_WIDTH });
      } else if (offset > SWIPE_THRESHOLD) {
        // Swiped right - reveal move
        await controls.start({ x: MOVE_ACTION_WIDTH });
      } else {
        // Spring back to center
        await controls.start({ x: 0 });
      }
    } else {
      // No drag happened, spring back to center
      await controls.start({ x: 0 });
    }
    
    setIsPressed(false);
    setHasDragged(false);
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handlePressStart = () => {
    setIsPressed(true);
    pressTimerRef.current = setTimeout(() => {
      // Long press - trigger move
      onMove();
      setIsPressed(false);
    }, 500); // 500ms long press
  };

  const handlePressEnd = () => {
    setIsPressed(false);
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleDeleteClick = () => {
    controls.start({ x: 0 }).then(() => {
      onDelete();
    });
  };

  const handleMoveClick = () => {
    controls.start({ x: 0 }).then(() => {
      onMove();
    });
  };

  // Reset position when component unmounts or children change
  useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-lg" ref={itemRef}>
      {/* Action buttons (background) */}
      <div className="absolute inset-0 flex">
        {/* Delete action (left side) */}
        <motion.div
          className="flex items-center justify-end pr-4 bg-red-600"
          style={{ width: DELETE_ACTION_WIDTH, opacity: deleteOpacity }}
        >
          <button
            onClick={handleDeleteClick}
            className="p-2 rounded-lg bg-red-700 hover:bg-red-800 text-white transition-colors"
            aria-label="Delete"
          >
            <HiTrash className="w-5 h-5" />
          </button>
        </motion.div>

        {/* Spacer in middle */}
        <div className="flex-1" />

        {/* Move action (right side) */}
        <motion.div
          className="flex items-center justify-start pl-4 bg-blue-600"
          style={{ width: MOVE_ACTION_WIDTH, opacity: moveOpacity }}
        >
          <button
            onClick={handleMoveClick}
            className="p-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white transition-colors"
            aria-label="Move"
          >
            <HiArrowsUpDown className="w-5 h-5" />
          </button>
        </motion.div>
      </div>

      {/* Content (foreground) */}
      <motion.div
        className={`relative ${className}`}
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -DELETE_ACTION_WIDTH, right: MOVE_ACTION_WIDTH }}
        dragElastic={0.2}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerCancel={handlePressEnd}
        animate={controls}
        whileTap={{ scale: isPressed ? 0.98 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {children}
      </motion.div>
    </div>
  );
};

