import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { IoClose, IoCheckmarkCircle, IoAlertCircle, IoCloudUpload } from 'react-icons/io5';

export interface QueuedUpload {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  speed?: number; // bytes per second
  timeRemaining?: number; // seconds
}

interface UploadQueueProps {
  uploads: QueuedUpload[];
  onCancel: (id: string) => void;
  onDismiss: (id: string) => void;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

const formatSpeed = (bytesPerSecond: number): string => {
  return formatBytes(bytesPerSecond) + '/s';
};

const formatTime = (seconds: number): string => {
  if (seconds < 60) return Math.round(seconds) + 's';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
};

export const UploadQueue: React.FC<UploadQueueProps> = ({ uploads, onCancel, onDismiss }) => {
  if (uploads.length === 0) return null;

  const activeUploads = uploads.filter(u => u.status === 'uploading' || u.status === 'pending');
  const completedUploads = uploads.filter(u => u.status === 'completed');
  const errorUploads = uploads.filter(u => u.status === 'error');

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md w-full space-y-2">
      <AnimatePresence>
        {/* Active uploads */}
        {activeUploads.map((upload) => (
          <motion.div
            key={upload.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg p-4 shadow-lg"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                <IoCloudUpload className="w-5 h-5 text-[#b85a3a]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-white text-sm font-medium truncate">{upload.file.name}</p>
                  <button
                    onClick={() => onCancel(upload.id)}
                    className="flex-shrink-0 p-1 hover:bg-[#3a3a3a] rounded transition-colors text-[#9ca3af]"
                    title="Cancel upload"
                  >
                    <IoClose className="w-4 h-4" />
                  </button>
                </div>
                
                {upload.status === 'uploading' && (
                  <>
                    <div className="w-full bg-[#1a1a1a] rounded-full h-2 mb-2">
                      <div
                        className="bg-[#b85a3a] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#9ca3af]">
                      <span>{upload.progress.toFixed(1)}%</span>
                      {upload.speed !== undefined && (
                        <span className="flex items-center gap-3">
                          <span>{formatSpeed(upload.speed)}</span>
                          {upload.timeRemaining !== undefined && upload.timeRemaining > 0 && (
                            <span>{formatTime(upload.timeRemaining)} remaining</span>
                          )}
                        </span>
                      )}
                    </div>
                  </>
                )}
                
                {upload.status === 'pending' && (
                  <p className="text-xs text-[#9ca3af]">Queued...</p>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {/* Completed uploads */}
        {completedUploads.map((upload) => (
          <motion.div
            key={upload.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#2a2a2a] border border-[#10b981] rounded-lg p-4 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <IoCheckmarkCircle className="w-5 h-5 text-[#10b981] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{upload.file.name}</p>
                <p className="text-xs text-[#10b981] mt-1">Upload completed</p>
              </div>
              <button
                onClick={() => onDismiss(upload.id)}
                className="flex-shrink-0 p-1 hover:bg-[#3a3a3a] rounded transition-colors text-[#9ca3af]"
                title="Dismiss"
              >
                <IoClose className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}

        {/* Error uploads */}
        {errorUploads.map((upload) => (
          <motion.div
            key={upload.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#2a2a2a] border border-red-500 rounded-lg p-4 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <IoAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{upload.file.name}</p>
                <p className="text-xs text-red-400 mt-1">
                  {upload.error || 'Upload failed'}
                </p>
              </div>
              <button
                onClick={() => onDismiss(upload.id)}
                className="flex-shrink-0 p-1 hover:bg-[#3a3a3a] rounded transition-colors text-[#9ca3af]"
                title="Dismiss"
              >
                <IoClose className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};



