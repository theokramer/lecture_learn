import React from 'react';
import { motion } from 'framer-motion';

interface LoadingBarProps {
  progress: number;
  currentTask: string;
  estimatedTime?: string;
}

export const LoadingBar: React.FC<LoadingBarProps> = ({ 
  progress, 
  currentTask,
  estimatedTime,
}) => {
  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-white mb-4">Creating Your Notes</h3>
      
      {/* Progress Bar */}
      <div className="relative h-12 rounded-full overflow-hidden bg-[#1a1a1a]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
          className="h-full flex items-center justify-center relative"
          style={{
            background: 'linear-gradient(to right, #b85a3a, #d4a944)',
          }}
        >
          <span className="text-white font-semibold text-sm absolute">{Math.round(progress)}%</span>
        </motion.div>
      </div>
      
      {/* Task Description */}
      <p className="text-white mt-4 text-lg">{currentTask}</p>
      
      {/* Estimated Time */}
      {estimatedTime && (
        <p className="text-[#9ca3af] mt-2 text-sm text-center">
          {estimatedTime}
        </p>
      )}
    </div>
  );
};
