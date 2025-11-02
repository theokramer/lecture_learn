import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiHome, HiDocument, HiMicrophone, HiRectangleStack, HiQuestionMarkCircle, HiBookOpen, HiBars3, HiFolder, HiDocumentText, HiSparkles, HiXMark } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import type { StudyMode } from '../../types';
import { useAppData } from '../../context/AppDataContext';

interface NoteSidebarProps {
  currentMode: StudyMode;
  onModeChange: (mode: StudyMode) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export const NoteSidebar: React.FC<NoteSidebarProps> = ({
  currentMode,
  onModeChange,
  isCollapsed,
  onToggleCollapse,
  isMobile = false,
  isOpen = false,
  onClose,
}) => {
  const navigate = useNavigate();
  const { selectedNoteId, notes } = useAppData();
  
  // Get current note to check if it has content
  const currentNote = useMemo(() => {
    return notes?.find(n => n.id === selectedNoteId) || null;
  }, [notes, selectedNoteId]);
  
  // Check if note has content (transcript should only show if there's content to transcribe)
  const hasContent = currentNote?.content && currentNote.content.trim().length > 0;

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, isOpen]);

  // Filter menu items based on note content
  const menuItems = useMemo(() => {
    const allItems = [
      { icon: HiDocument, label: 'Summary', mode: 'summary' as StudyMode },
      { icon: HiMicrophone, label: 'Feynman', mode: 'feynman' as StudyMode },
      { icon: HiRectangleStack, label: 'Flashcards', mode: 'flashcards' as StudyMode },
      { icon: HiQuestionMarkCircle, label: 'Quiz', mode: 'quiz' as StudyMode },
      { icon: HiBookOpen, label: 'Exercises', mode: 'exercises' as StudyMode },
      { icon: HiDocumentText, label: 'Transcript', mode: 'transcript' as StudyMode },
      { icon: HiSparkles, label: 'AI Chat', mode: 'ai-chat' as StudyMode },
    ];
    
    // Hide transcript if note has no content
    return allItems.filter(item => {
      if (item.mode === 'transcript' && !hasContent) {
        return false;
      }
      return true;
    });
  }, [hasContent]);

  // Mobile drawer version
  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm lg:hidden"
            />
            
            {/* Drawer */}
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-[280px] bg-bg-secondary border-r border-border-primary z-[101] flex flex-col overflow-y-auto lg:hidden shadow-xl"
            >
              {/* Header with Close Button */}
              <div className="p-4 border-b border-border-primary flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-primary">Menu</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-bg-hover rounded-lg transition-all duration-200"
                  aria-label="Close menu"
                >
                  <HiXMark className="w-6 h-6 text-text-secondary" />
                </button>
              </div>

              {/* Home Button */}
              <div className="px-4 pt-4 pb-2">
                <motion.button
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    navigate('/home');
                    onClose?.();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                >
                  <HiHome className="w-5 h-5" />
                  <span className="font-medium">Home</span>
                </motion.button>
              </div>

              {/* Menu Items */}
              <div className="flex-1 py-4 px-2 space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentMode === item.mode;
                  
                  return (
                    <motion.button
                      key={item.mode}
                      whileHover={{ scale: 1.02, x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        onModeChange(item.mode);
                        onClose?.();
                      }}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                        ${isActive 
                          ? 'bg-accent text-white shadow-glow' 
                          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Bottom - Manage Documents */}
              <div className="p-4 border-t border-border-primary">
                <motion.button
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onModeChange('documents' as StudyMode);
                    onClose?.();
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                    ${currentMode === 'documents'
                      ? 'bg-accent text-white shadow-glow'
                      : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                    }
                  `}
                >
                  <HiFolder className="w-5 h-5" />
                  <span className="font-medium">Documents</span>
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  if (isCollapsed) {
    return (
      <div className="w-16 bg-bg-secondary border-r border-border-primary flex flex-col py-4 h-full">
        {/* Hamburger Menu */}
        <div className="px-4 mb-6">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onToggleCollapse}
            className="w-full p-2 rounded-lg hover:bg-bg-hover transition-all duration-200"
          >
            <HiBars3 className="w-6 h-6 text-text-primary mx-auto" />
          </motion.button>
        </div>

        {/* Study Mode Items */}
        <div className="flex-1 flex flex-col space-y-3 px-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentMode === item.mode;
            
            return (
              <motion.button
                key={item.mode}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onModeChange(item.mode)}
                className={`
                  w-full p-2 rounded-lg transition-all duration-200
                  ${isActive ? 'bg-accent shadow-glow' : 'hover:bg-bg-hover'}
                `}
                title={item.label}
              >
                <Icon className={`w-6 h-6 mx-auto ${isActive ? 'text-white' : 'text-text-primary'}`} />
              </motion.button>
            );
          })}
        </div>

        {/* Bottom - Documents Button */}
        <div className="px-4 pt-4 border-t border-border-primary">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onModeChange('documents' as StudyMode)}
            className={`
              w-full p-2 rounded-lg transition-all duration-200
              ${currentMode === 'documents' ? 'bg-accent shadow-glow' : 'hover:bg-bg-hover'}
            `}
            title="Documents"
          >
            <HiFolder className={`w-6 h-6 mx-auto ${currentMode === 'documents' ? 'text-white' : 'text-text-primary'}`} />
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ width: 250 }}
      animate={{ width: 250 }}
      transition={{ duration: 0.3 }}
      className="bg-bg-secondary border-r border-border-primary flex flex-col h-full"
    >
      {/* Header with Hamburger */}
      <div className="p-4 border-b border-border-primary flex items-center justify-end">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onToggleCollapse}
          className="p-2 hover:bg-bg-hover rounded-lg transition-all duration-200"
        >
          <HiBars3 className="w-5 h-5 text-text-secondary" />
        </motion.button>
      </div>

      {/* Home Button with Spacing */}
      <div className="px-4 pt-4 pb-2">
        <motion.button
          whileHover={{ scale: 1.02, x: 4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/home')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        >
          <HiHome className="w-5 h-5" />
          <span className="font-medium">Home</span>
        </motion.button>
      </div>

      {/* Menu Items */}
      <div className="flex-1 py-4 px-2 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentMode === item.mode;
          
          return (
            <motion.button
              key={item.mode}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onModeChange(item.mode)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                ${isActive 
                  ? 'bg-accent text-white shadow-glow' 
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Bottom - Manage Documents */}
      <div className="p-4 border-t border-border-primary">
        <motion.button
          whileHover={{ scale: 1.02, x: 4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onModeChange('documents' as StudyMode)}
          className={`
            w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
            ${currentMode === 'documents'
              ? 'bg-accent text-white shadow-glow'
              : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
            }
          `}
        >
          <HiFolder className="w-5 h-5" />
          <span className="font-medium">Documents</span>
        </motion.button>
      </div>
    </motion.div>
  );
};
