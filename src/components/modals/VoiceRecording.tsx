import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../shared/Modal';
import { LoadingBar } from '../shared/LoadingBar';
import { Button } from '../shared/Button';
import { IoStop, IoMic } from 'react-icons/io5';

interface VoiceRecordingProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const VoiceRecording: React.FC<VoiceRecordingProps> = ({ isOpen, onClose, onComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      interval = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStop = async () => {
    setIsRecording(false);
    setProcessing(true);
    
    // Close the modal when processing starts
    onClose();

    // Simulate processing
    for (let p = 0; p <= 100; p += 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      setProgress(p);
    }

    setTimeout(() => {
      setProcessing(false);
      onComplete();
    }, 500);
  };

  const handleStart = () => {
    setSeconds(0);
    setIsRecording(true);
  };

  const handleCancel = () => {
    setIsRecording(false);
    setSeconds(0);
    onClose();
  };

  return (
    <>
      <AnimatePresence>
        {processing && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg px-8"
            >
              <div className="bg-[#1a1a1a] rounded-3xl p-12 border border-[#3a3a3a]">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-white mb-2">Creating new notes</h2>
                  <p className="text-[#9ca3af]">Processing your audio...</p>
                </div>
                <LoadingBar 
                  progress={progress} 
                  currentTask="Processing audio..." 
                  estimatedTime="This should take a few seconds..."
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Modal isOpen={isOpen && !processing} onClose={onClose} size="lg" title="Voice Recording">
        <div className="space-y-6">
          {/* Timer Display */}
          <div className="text-center">
            <p className="text-4xl font-bold text-white mb-2">{formatTime(seconds)}</p>
            <p className="text-[#9ca3af]">Recording time</p>
          </div>

          {/* Waveform Visualization */}
          <div className="flex items-center justify-center gap-1 h-24">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                animate={isRecording ? {
                  height: [20, Math.random() * 80 + 20, 20],
                  transition: {
                    duration: 0.5,
                    repeat: Infinity,
                    delay: i * 0.05,
                  }
                } : {}}
                className="bg-[#b85a3a] rounded-full"
                style={{
                  width: '4px',
                  height: isRecording ? '20px' : '40px',
                }}
              />
            ))}
          </div>

          {/* Record Button */}
          <div className="flex justify-center">
            {!isRecording ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStart}
                className="w-20 h-20 rounded-full bg-[#ef4444] flex items-center justify-center shadow-lg hover:bg-[#dc2626] transition-colors"
              >
                <IoMic className="w-10 h-10 text-white" />
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStop}
                className="w-20 h-20 rounded-full bg-[#ef4444] flex items-center justify-center shadow-lg hover:bg-[#dc2626] transition-colors animate-pulse"
              >
                <IoStop className="w-10 h-10 text-white" />
              </motion.button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={handleCancel}>
              Cancel
            </Button>
            <Button 
              fullWidth 
              onClick={handleStop}
              disabled={!isRecording}
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
