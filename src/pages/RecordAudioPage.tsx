import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IoStop, IoMic, IoArrowBack } from 'react-icons/io5';
import { useAppData } from '../context/AppDataContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const MAX_RECORDING_DURATION = 7200; // 2 hours in seconds

export const RecordAudioPage: React.FC = () => {
  const navigate = useNavigate();
  const { /* createNote */ } = useAppData();
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isRecording) {
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          const next = prev + 1;
          // Auto-stop at max duration
          if (next >= MAX_RECORDING_DURATION) {
            if (stopHandlerRef.current) {
              stopHandlerRef.current();
            }
            toast.success('Maximum recording duration reached (2 hours)');
          }
          return next;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.error('Error stopping recorder on unmount:', e);
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    try {
      // Clean up any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      streamRef.current = stream;

      // Find the best supported MIME type for long recordings
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      
      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      const options: MediaRecorderOptions = {
        mimeType: selectedMimeType || undefined,
        audioBitsPerSecond: 128000, // Good quality for speech
      };

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Handle data availability - collect chunks periodically
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle recording errors
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        toast.error('Recording error occurred. Please try again.');
        setIsRecording(false);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        try {
          // Ensure we have all chunks
          if (chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { 
              type: selectedMimeType || 'audio/webm' 
            });
            setAudioBlob(blob);
            console.log('Recording stopped. Blob size:', blob.size, 'bytes');
          } else {
            console.warn('No audio chunks collected');
            toast.error('No audio data was recorded. Please try again.');
          }
        } catch (error) {
          console.error('Error creating blob:', error);
          toast.error('Failed to process recording. Please try again.');
        } finally {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
        }
      };

      // Handle stream errors - track ended events
      // MediaStreamTrack doesn't have onerror, so we monitor onended and readyState
      stream.getTracks().forEach(track => {
        // Monitor track state changes periodically
        const stateCheckInterval = setInterval(() => {
          if (isRecording && track.readyState === 'ended') {
            console.error('Track ended unexpectedly');
            clearInterval(stateCheckInterval);
            toast.error('Audio input error. Recording stopped.');
            if (stopHandlerRef.current) {
              stopHandlerRef.current();
            }
          } else if (!isRecording) {
            clearInterval(stateCheckInterval);
          }
        }, 1000);
        
        // Handle track ended event
        track.onended = () => {
          console.warn('Audio track ended unexpectedly');
          clearInterval(stateCheckInterval);
          if (isRecording) {
            toast.error('Audio input was interrupted. Recording stopped.');
            if (stopHandlerRef.current) {
              stopHandlerRef.current();
            }
          }
        };
      });

      setSeconds(0);
      setIsRecording(true);
      
      // Start recording with timeslice to get periodic data chunks
      // This ensures chunks are delivered every second, preventing memory issues
      // and allowing the recorder to handle long recordings better
      mediaRecorder.start(1000); // Get chunks every 1 second
      
      console.log('Recording started with mimeType:', selectedMimeType || 'default');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Could not access microphone. Please check permissions.');
      setIsRecording(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  };

  const handleStop = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        // Request any remaining data
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData();
        }
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      } catch (error) {
        console.error('Error stopping recorder:', error);
        toast.error('Error stopping recording. Please try again.');
        setIsRecording(false);
      }
    }
  }, [isRecording]);

  // Keep the stop handler ref updated
  useEffect(() => {
    stopHandlerRef.current = handleStop;
  }, [handleStop]);

  const handleDone = async () => {
    if (!audioBlob || !user) return;

    navigate('/note-creation/processing', { state: { audioBlob, title: 'Voice Recording' } });
  };

  const handleCancel = () => {
    navigate('/note-creation');
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center px-8 py-12 pb-20">
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
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleCancel}
              className="flex-1 px-6 py-4 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white rounded-xl transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleDone}
              disabled={!audioBlob}
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

