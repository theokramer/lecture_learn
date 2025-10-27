import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IoStop, IoMic, IoArrowBack } from 'react-icons/io5';

export const RecordAudioPage: React.FC = () => {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

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

  const handleStop = () => {
    setIsRecording(false);
    navigate('/note-creation/processing');
  };

  const handleStart = () => {
    setSeconds(0);
    setIsRecording(true);
  };

  const handleCancel = () => {
    navigate('/note-creation');
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center px-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <button
          onClick={handleCancel}
          className="text-[#9ca3af] hover:text-white mb-8 transition-colors inline-flex items-center gap-2"
        >
          <IoArrowBack className="w-5 h-5" />
          Back
        </button>

        {/* Content */}
        <div className="bg-[#2a2a2a] rounded-3xl p-12 border border-[#3a3a3a]">
          {/* Title */}
          <h1 className="text-3xl font-bold text-white mb-2 text-center">Voice Recording</h1>
          <p className="text-[#9ca3af] text-center mb-12">Record your voice note</p>

          {/* Timer Display */}
          <div className="text-center mb-12">
            <p className="text-7xl font-bold text-white mb-4">{formatTime(seconds)}</p>
            <p className="text-[#9ca3af] text-lg">Recording time</p>
          </div>

          {/* Waveform Visualization */}
          <div className="flex items-center justify-center gap-1 h-32 mb-12">
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
                  width: '6px',
                  height: isRecording ? '40px' : '60px',
                }}
              />
            ))}
          </div>

          {/* Record Button */}
          <div className="flex justify-center mb-8">
            {!isRecording ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStart}
                className="w-24 h-24 rounded-full bg-[#ef4444] flex items-center justify-center shadow-lg hover:bg-[#dc2626] transition-colors"
              >
                <IoMic className="w-12 h-12 text-white" />
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStop}
                className="w-24 h-24 rounded-full bg-[#ef4444] flex items-center justify-center shadow-lg hover:bg-[#dc2626] transition-colors animate-pulse"
              >
                <IoStop className="w-12 h-12 text-white" />
              </motion.button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 px-6 py-4 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white rounded-xl transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleStop}
              disabled={!isRecording}
              className="flex-1 px-6 py-4 bg-[#b85a3a] hover:bg-[#a04a2a] disabled:bg-[#3a3a3a] disabled:text-[#6b7280] text-white rounded-xl transition-colors font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

