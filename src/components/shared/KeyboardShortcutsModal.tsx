import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoClose } from 'react-icons/io5';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  const shortcuts = [
    {
      category: 'Navigation',
      items: [
        { keys: [`${modKey}`, 'N'], description: 'Create new note' },
        { keys: [`${modKey}`, 'K'], description: 'Show keyboard shortcuts' },
        { keys: ['Esc'], description: 'Close modal/dialog' },
      ],
    },
    {
      category: 'Search & Actions',
      items: [
        { keys: [`${modKey}`, 'F'], description: 'Focus search (when on home page)' },
        { keys: [`${modKey}`, 'S'], description: 'Save note (when editing)' },
        { keys: [`${modKey}`, '?'], description: 'Show this help' },
      ],
    },
    {
      category: 'Navigation (Note Lists)',
      items: [
        { keys: ['↑', '↓'], description: 'Navigate up/down in note list' },
        { keys: ['Enter'], description: 'Open selected note' },
      ],
    },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#3a3a3a] flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Keyboard Shortcuts</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#3a3a3a] rounded-lg transition-colors text-[#9ca3af] hover:text-white"
            >
              <IoClose className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto flex-1">
            <div className="space-y-6">
              {shortcuts.map((category, idx) => (
                <div key={idx}>
                  <h3 className="text-sm font-semibold text-[#9ca3af] uppercase tracking-wide mb-3">
                    {category.category}
                  </h3>
                  <div className="space-y-2">
                    {category.items.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        className="flex items-center justify-between py-2 border-b border-[#3a3a3a] last:border-0"
                      >
                        <span className="text-white text-sm">{item.description}</span>
                        <div className="flex items-center gap-1">
                          {item.keys.map((key, keyIdx) => (
                            <React.Fragment key={keyIdx}>
                              <kbd className="px-2 py-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded text-xs font-mono text-white">
                                {key}
                              </kbd>
                              {keyIdx < item.keys.length - 1 && (
                                <span className="text-[#9ca3af] text-xs mx-1">+</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

