import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiTrash, HiArrowsUpDown } from 'react-icons/hi2';

export interface ContextMenuAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  action: () => void;
  destructive?: boolean;
}

interface ContextMenuProps {
  actions: ContextMenuAction[];
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  actions,
  isOpen,
  onClose,
  position,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          onClose();
        }
      };

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen || actions.length === 0) return null;

  // Calculate position to keep menu in viewport
  const [adjustedPosition, setAdjustedPosition] = React.useState(position);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y;

      // Adjust horizontal position
      if (x + rect.width > viewportWidth) {
        x = viewportWidth - rect.width - 16;
      }
      if (x < 16) {
        x = 16;
      }

      // Adjust vertical position
      if (y + rect.height > viewportHeight) {
        y = viewportHeight - rect.height - 16;
      }
      if (y < 16) {
        y = 16;
      }

      setAdjustedPosition({ x, y });
    }
  }, [position]);

  return (
    <AnimatePresence>
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[199] bg-transparent"
        />
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="fixed z-[200] bg-[#2a2a2a] rounded-xl shadow-2xl border border-[#3a3a3a] overflow-hidden min-w-[200px]"
          style={{
            left: `${adjustedPosition.x}px`,
            top: `${adjustedPosition.y}px`,
          }}
        >
        <div className="py-1">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={() => {
                  action.action();
                  onClose();
                }}
                className={`
                  w-full px-4 py-3 flex items-center gap-3 text-left
                  transition-colors duration-150
                  ${action.destructive 
                    ? 'text-red-500 hover:bg-red-500/10 active:bg-red-500/20' 
                    : 'text-white hover:bg-[#3a3a3a] active:bg-[#4a4a4a]'
                  }
                `}
              >
                {Icon && <Icon className="w-5 h-5" />}
                <span className="text-[15px] font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>
      </>
    </AnimatePresence>
  );
};

