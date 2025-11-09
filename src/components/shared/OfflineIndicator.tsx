import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiWifi, HiSignal } from 'react-icons/hi2';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { syncQueuedActions } from '../../services/offlineSyncService';
import { useEffect } from 'react';

export const OfflineIndicator: React.FC = () => {
  const { isOnline, wasOffline } = useNetworkStatus();

  // Sync queued actions when coming back online
  useEffect(() => {
    if (isOnline && wasOffline) {
      syncQueuedActions().catch((error) => {
        console.error('Failed to sync queued actions:', error);
      });
    }
  }, [isOnline, wasOffline]);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black px-4 py-2 flex items-center justify-center gap-2"
        >
          <HiSignal className="w-5 h-5" />
          <span className="text-sm font-medium">You're offline. Changes will be synced when you're back online.</span>
        </motion.div>
      )}
      {isOnline && wasOffline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-50 bg-green-500 text-white px-4 py-2 flex items-center justify-center gap-2"
        >
          <HiWifi className="w-5 h-5" />
          <span className="text-sm font-medium">Back online. Syncing changes...</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};



