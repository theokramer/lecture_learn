import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiHome, HiQuestionMarkCircle, HiCog6Tooth, HiChartBar, HiAcademicCap, HiXMark } from 'react-icons/hi2';
import { HiLightBulb } from 'react-icons/hi2';
import { Link } from 'react-router-dom';

interface SidebarProps {
  activePage: string;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activePage, 
  isMobile = false, 
  isOpen = false, 
  onClose 
}) => {
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

  const navItems = [
    { icon: HiHome, label: 'Home', page: 'home', path: '/home' },
    { icon: HiAcademicCap, label: 'Learn Flashcards', page: 'learn-flashcards', path: '/learn-flashcards' },
    { icon: HiChartBar, label: 'Analytics', page: 'analytics', path: '/analytics' },
    { icon: HiLightBulb, label: 'How to use', page: 'how-to-use', path: '/how-to-use' },
    { icon: HiQuestionMarkCircle, label: 'Support', page: 'support', path: '/support' },
    { icon: HiCog6Tooth, label: 'Settings', page: 'settings', path: '/settings' },
  ];

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
              className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm"
            />
            
            {/* Drawer */}
            <motion.div
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-64 bg-[#2a2a2a] z-[101] flex flex-col overflow-y-auto p-6"
            >
              {/* Header with Close Button */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">Menu</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-[#3a3a3a] rounded-lg transition-colors"
                  aria-label="Close menu"
                >
                  <HiXMark className="w-6 h-6 text-[#9ca3af]" />
                </button>
              </div>

              {/* Navigation Items */}
              <div className="space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.page;
                  
                  const content = (
                    <div
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                        ${isActive 
                          ? 'bg-[#3a3a3a] text-white' 
                          : 'text-[#9ca3af] hover:bg-[#3a3a3a] hover:text-white'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                  );

                  if (item.path) {
                    return (
                      <Link key={item.page} to={item.path} onClick={onClose}>
                        {content}
                      </Link>
                    );
                  }

                  return <div key={item.page}>{content}</div>;
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Desktop sidebar version
  return (
    <div className="w-64 bg-[#2a2a2a] h-screen p-6 flex flex-col overflow-y-auto">
      <div className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.page;
          
          const content = (
            <div
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                ${isActive 
                  ? 'bg-[#3a3a3a] text-white' 
                  : 'text-[#9ca3af] hover:bg-[#3a3a3a] hover:text-white'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </div>
          );

          if (item.path) {
            return (
              <Link key={item.page} to={item.path}>
                {content}
              </Link>
            );
          }

          return <div key={item.page}>{content}</div>;
        })}
      </div>
    </div>
  );
};
