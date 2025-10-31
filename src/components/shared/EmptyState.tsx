import React from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-center h-full min-h-[400px]"
    >
      <div className="text-center max-w-md px-8">
        <div className="bg-[#2a2a2a] rounded-3xl p-12 border border-[#3a3a3a]">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Icon className="w-20 h-20 text-[#b85a3a] mx-auto mb-6" />
          </motion.div>
          <h2 className="text-3xl font-bold text-white mb-4">{title}</h2>
          <p className="text-[#9ca3af] text-lg mb-8 leading-relaxed">{description}</p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {action && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={action.onClick}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                  action.variant === 'secondary'
                    ? 'bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white'
                    : 'bg-[#b85a3a] hover:bg-[#a04a2a] text-white'
                }`}
              >
                {action.label}
              </motion.button>
            )}
            {secondaryAction && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={secondaryAction.onClick}
                className="px-6 py-3 rounded-lg font-semibold bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white transition-colors"
              >
                {secondaryAction.label}
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

