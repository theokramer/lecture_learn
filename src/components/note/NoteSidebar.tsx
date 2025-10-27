import React from 'react';
import { motion } from 'framer-motion';
import { HiHome, HiDocument, HiMicrophone, HiRectangleStack, HiQuestionMarkCircle, HiBookOpen, HiBars3, HiFolder } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import type { StudyMode } from '../../types';

interface NoteSidebarProps {
  currentMode: StudyMode;
  onModeChange: (mode: StudyMode) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const NoteSidebar: React.FC<NoteSidebarProps> = ({
  currentMode,
  onModeChange,
  isCollapsed,
  onToggleCollapse,
}) => {
  const navigate = useNavigate();

  const menuItems = [
    { icon: HiDocument, label: 'Summary', mode: 'summary' as StudyMode },
    { icon: HiMicrophone, label: 'Feynman', mode: 'feynman' as StudyMode },
    { icon: HiRectangleStack, label: 'Flashcards', mode: 'flashcards' as StudyMode },
    { icon: HiQuestionMarkCircle, label: 'Quiz', mode: 'quiz' as StudyMode },
    { icon: HiBookOpen, label: 'Exercises', mode: 'exercises' as StudyMode },
  ];

  if (isCollapsed) {
    return (
      <div className="w-16 bg-[#2a2a2a] border-r border-[#3a3a3a] flex flex-col py-4">
        {/* Hamburger Menu */}
        <div className="px-4 mb-6">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onToggleCollapse}
            className="w-full p-2 rounded-lg hover:bg-[#3a3a3a] transition-colors"
          >
            <HiBars3 className="w-6 h-6 text-white mx-auto" />
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
                  w-full p-2 rounded-lg transition-colors
                  ${isActive ? 'bg-[#3a3a3a]' : 'hover:bg-[#3a3a3a]'}
                `}
                title={item.label}
              >
                <Icon className="w-6 h-6 text-white mx-auto" />
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ width: 250 }}
      animate={{ width: 250 }}
      transition={{ duration: 0.3 }}
      className="bg-[#2a2a2a] border-r border-[#3a3a3a] flex flex-col"
    >
      {/* Header with Hamburger */}
      <div className="p-4 border-b border-[#3a3a3a] flex items-center justify-end">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onToggleCollapse}
          className="p-2 hover:bg-[#3a3a3a] rounded-lg transition-colors"
        >
          <HiBars3 className="w-5 h-5 text-[#9ca3af]" />
        </motion.button>
      </div>

      {/* Home Button with Spacing */}
      <div className="px-4 pt-4 pb-2">
        <motion.button
          whileHover={{ scale: 1.02, x: 4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/home')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-[#9ca3af] hover:bg-[#3a3a3a] hover:text-white"
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
                w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                ${isActive 
                  ? 'bg-[#3a3a3a] text-white' 
                  : 'text-[#9ca3af] hover:bg-[#3a3a3a] hover:text-white'
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
      <div className="p-4 border-t border-[#3a3a3a]">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[#9ca3af] hover:bg-[#3a3a3a] hover:text-white transition-colors">
          <HiFolder className="w-5 h-5" />
          <span className="font-medium">Dokumente verwalten</span>
        </button>
      </div>
    </motion.div>
  );
};
