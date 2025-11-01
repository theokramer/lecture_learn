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
        <div className="bg-bg-secondary rounded-3xl p-12 border border-border-primary shadow-lg">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Icon className="w-20 h-20 text-accent mx-auto mb-6" />
          </motion.div>
          <h2 className="text-3xl font-bold text-text-primary mb-4">{title}</h2>
          <p className="text-text-secondary text-lg mb-8 leading-relaxed">{description}</p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {action && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={action.onClick}
                className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                  action.variant === 'secondary'
                    ? 'bg-bg-tertiary hover:bg-bg-hover text-text-primary'
                    : 'bg-accent hover:bg-[var(--accent-hover)] text-white shadow-glow'
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
                className="px-6 py-3 rounded-lg font-semibold bg-bg-tertiary hover:bg-bg-hover text-text-primary transition-all duration-200"
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

