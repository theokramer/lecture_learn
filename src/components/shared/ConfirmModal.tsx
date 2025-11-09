import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        {/* iOS-style Action Sheet */}
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative bg-[#2a2a2a] w-full max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle bar (mobile) */}
          <div className="sm:hidden flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 bg-[#9ca3af]/50 rounded-full" />
          </div>

          {/* Content */}
          <div className="px-6 py-5 sm:py-6">
            <h2 className="text-[20px] font-semibold text-white mb-2 text-center sm:text-left">
              {title}
            </h2>
            <p className="text-[15px] text-[#9ca3af] leading-relaxed text-center sm:text-left">
              {message}
            </p>
          </div>

          {/* Actions - iOS style */}
          <div className="px-4 pb-4 sm:pb-6 space-y-2">
            {/* Confirm Button */}
            <button
              onClick={handleConfirm}
              className={`
                w-full py-3.5 rounded-xl font-semibold text-[17px]
                transition-all duration-150 active:scale-[0.98]
                ${
                  variant === 'danger'
                    ? 'bg-red-500 text-white active:bg-red-600'
                    : variant === 'warning'
                    ? 'bg-yellow-500 text-white active:bg-yellow-600'
                    : 'bg-blue-500 text-white active:bg-blue-600'
                }
              `}
            >
              {confirmLabel}
            </button>

            {/* Cancel Button */}
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl font-semibold text-[17px] bg-[#3a3a3a] text-white active:bg-[#4a4a4a] active:scale-[0.98] transition-all duration-150"
            >
              {cancelLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
