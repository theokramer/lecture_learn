import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LoadingBar } from '../components/shared/LoadingBar';

export const ProcessingPage: React.FC = () => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState('Initializing...');

  useEffect(() => {
    const tasks = [
      'Analyzing audio...',
      'Extracting content...',
      'Processing text...',
      'Creating notes...',
    ];

    let taskIndex = 0;
    let currentProgress = 0;

    const processTasks = async () => {
      for (const task of tasks) {
        setCurrentTask(task);
        currentProgress = 0;
        
        // Simulate progress for each task
        while (currentProgress < 100) {
          currentProgress += 10;
          setProgress(Math.min(currentProgress, 100));
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Navigate to note view after processing
      setTimeout(() => {
        navigate('/note');
      }, 500);
    };

    processTasks();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center px-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-2xl"
      >
        <div className="bg-[#1a1a1a] rounded-3xl p-12 border border-[#3a3a3a]">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-bold text-white mb-4">Creating new notes</h2>
            <p className="text-[#9ca3af] text-lg">Processing your audio...</p>
          </div>
          <LoadingBar
            progress={progress}
            currentTask={currentTask}
            estimatedTime="This should take a few seconds..."
          />
        </div>
      </motion.div>
    </div>
  );
};

