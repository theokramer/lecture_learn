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

      // Request microphone with constraints optimized for long recordings
      // Note: Some browsers have autostop features, but these shouldn't trigger for active recordings
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Explicitly request sample rate and channel count for compatibility
          sampleRate: 48000,
          channelCount: 1, // Mono is fine for voice and reduces file size
        } 
      });
      
      // Log stream info for debugging
      stream.getAudioTracks().forEach(track => {
        console.log('Audio track initialized:', {
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          settings: track.getSettings()
        });
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

      // Use lower bitrate for longer recordings to reduce file size
      // 96kbps is still good quality for speech and reduces file size significantly
      const options: MediaRecorderOptions = {
        mimeType: selectedMimeType || undefined,
        audioBitsPerSecond: 96000, // Reduced from 128kbps to reduce file size for long recordings
      };

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      // Flag to track if we're waiting for final chunk
      let waitingForFinalChunk = false;
      let finalChunkResolve: (() => void) | null = null;

      // Handle data availability - collect chunks periodically
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log(`Chunk received: ${event.data.size} bytes, total chunks: ${chunksRef.current.length}`);
        }
        
        // If we're waiting for final chunk and received data, resolve
        if (waitingForFinalChunk && finalChunkResolve) {
          waitingForFinalChunk = false;
          const resolve = finalChunkResolve;
          finalChunkResolve = null;
          // Small delay to ensure chunk is fully processed
          setTimeout(() => resolve(), 100);
        }
      };
      
      // Store the resolve function so handleStop can use it
      (mediaRecorder as any)._finalChunkResolve = (resolve: () => void) => {
        waitingForFinalChunk = true;
        finalChunkResolve = resolve;
      };

      // Handle recording errors
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error event:', event);
        console.error('MediaRecorder error details:', (event as any).error);
        
        // Clear health check interval
        if ((mediaRecorder as any)._healthCheckInterval) {
          clearInterval((mediaRecorder as any)._healthCheckInterval);
        }
        
        const error = (event as any).error;
        const errorMessage = error?.message || 'Unknown recording error';
        console.error('Recording error:', errorMessage);
        
        toast.error(`Recording error: ${errorMessage}. Please try again.`);
        setIsRecording(false);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        // Clear health check interval
        if ((mediaRecorder as any)._healthCheckInterval) {
          clearInterval((mediaRecorder as any)._healthCheckInterval);
        }
        
        try {
          // Calculate expected blob size based on recording duration
          // At 96kbps, expected size = (bitrate * duration_in_seconds) / 8
          // Add 20% overhead for container format
          const expectedMinSize = (96000 * seconds) / 8 * 0.8; // 80% of expected as minimum
          const expectedMaxSize = (96000 * seconds) / 8 * 1.5; // 150% of expected as maximum
          
          // Log chunk collection info
          const totalChunkSize = chunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
          console.log(`Recording stopped after ${seconds} seconds`);
          console.log(`Chunks collected: ${chunksRef.current.length}, total size: ${totalChunkSize} bytes`);
          console.log(`Expected size range: ${Math.round(expectedMinSize)} - ${Math.round(expectedMaxSize)} bytes`);
          
          // Ensure we have all chunks
          if (chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { 
              type: selectedMimeType || 'audio/webm' 
            });
            
            // Validate blob size
            if (blob.size < expectedMinSize && seconds > 10) {
              console.warn(`Warning: Blob size (${blob.size} bytes) seems too small for ${seconds}s recording. Expected at least ${Math.round(expectedMinSize)} bytes.`);
              console.warn('Some audio data may be missing. Chunks may not have been fully collected.');
            }
            
            console.log('Final blob created. Size:', blob.size, 'bytes');
            console.log('Blob size validation:', {
              actual: blob.size,
              expectedMin: Math.round(expectedMinSize),
              expectedMax: Math.round(expectedMaxSize),
              isValid: blob.size >= expectedMinSize && blob.size <= expectedMaxSize
            });
            
            setAudioBlob(blob);
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
      // Note: We only stop recording if the track truly ends (user revokes permission, hardware issue)
      // Not due to browser autostop which shouldn't happen for active recordings
      stream.getTracks().forEach(track => {
        // Store the initial state to detect actual interruptions
        const initialReadyState = track.readyState;
        let lastCheckedState = initialReadyState;
        
        // Monitor track state changes periodically (less aggressive - every 5 seconds)
        const stateCheckInterval = setInterval(() => {
          // Only check if we're actually recording
          if (!isRecording) {
            clearInterval(stateCheckInterval);
            return;
          }
          
          const currentState = track.readyState;
          
          // Only trigger if track actually changed to ended (not just checking)
          if (currentState === 'ended' && lastCheckedState === 'live') {
            console.error('Track ended unexpectedly - state changed from live to ended');
            clearInterval(stateCheckInterval);
            toast.error('Audio input was interrupted. Recording stopped.');
            if (stopHandlerRef.current) {
              stopHandlerRef.current();
            }
          }
          
          lastCheckedState = currentState;
        }, 5000); // Check every 5 seconds instead of every second
        
        // Handle track ended event - but only if recording is actually active
        track.onended = () => {
          console.warn('Audio track onended event fired');
          clearInterval(stateCheckInterval);
          
          // Only stop if we're actually recording and this isn't during cleanup
          if (isRecording && mediaRecorderRef.current?.state === 'recording') {
            console.error('Audio track ended during active recording - likely permission revoked or hardware issue');
            toast.error('Audio input was interrupted. Recording stopped.');
            if (stopHandlerRef.current) {
              stopHandlerRef.current();
            }
          } else {
            console.log('Track ended event received but recording is not active (likely cleanup)');
          }
        };
      });

      setSeconds(0);
      setIsRecording(true);
      
      // Start recording with timeslice to get periodic data chunks
      // This ensures chunks are delivered every second, preventing memory issues
      // and allowing the recorder to handle long recordings better
      // Using timeslice of 1000ms (1 second) for efficient chunking
      mediaRecorder.start(1000); // Get chunks every 1 second
      
      console.log('Recording started with mimeType:', selectedMimeType || 'default');
      console.log('MediaRecorder state:', mediaRecorder.state);
      console.log('Max recording duration:', MAX_RECORDING_DURATION, 'seconds (2 hours)');
      
      // Verify recording started successfully
      if (mediaRecorder.state !== 'recording') {
        throw new Error('MediaRecorder failed to start. State: ' + mediaRecorder.state);
      }
      
      // Add periodic health check to ensure recording continues
      // Some browsers may stop recording due to inactivity or other reasons
      let healthCheckCount = 0;
      const healthCheckInterval = setInterval(() => {
        if (!isRecording || !mediaRecorderRef.current) {
          clearInterval(healthCheckInterval);
          return;
        }
        
        const recorder = mediaRecorderRef.current;
        const currentState = recorder.state;
        healthCheckCount++;
        
        // Log health check every 10 checks (every 20 seconds since we check every 2 seconds)
        if (healthCheckCount % 10 === 0) {
          console.log(`Recording health check #${healthCheckCount}: state=${currentState}, chunks=${chunksRef.current.length}, totalSize=${chunksRef.current.reduce((sum, c) => sum + c.size, 0)} bytes`);
        }
        
        // If recorder stopped unexpectedly, alert user
        if (currentState === 'inactive' && isRecording) {
          console.error('MediaRecorder stopped unexpectedly! State:', currentState);
          console.error('This may indicate a browser autostop, permission issue, or hardware problem');
          clearInterval(healthCheckInterval);
          toast.error('Recording stopped unexpectedly. Please check your microphone permissions and try again.');
          setIsRecording(false);
          if (stopHandlerRef.current) {
            stopHandlerRef.current();
          }
        }
      }, 2000); // Check every 2 seconds
      
      // Store interval for cleanup
      (mediaRecorder as any)._healthCheckInterval = healthCheckInterval;
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
        const recorder = mediaRecorderRef.current;
        
        if (recorder.state === 'recording') {
          // Request final chunk and wait for it
          const finalChunkPromise = new Promise<void>((resolve) => {
            // Set up the resolve function
            if ((recorder as any)._finalChunkResolve) {
              (recorder as any)._finalChunkResolve(resolve);
            } else {
              // Fallback if method doesn't exist
              resolve();
            }
            
            // Request final data chunk
            recorder.requestData();
            
            // Fallback timeout in case ondataavailable doesn't fire
            setTimeout(() => {
              resolve();
            }, 1000);
          });
          
          // Wait for final chunk, then stop
          await finalChunkPromise;
        }
        
        // Now safe to stop - all chunks should be collected
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        
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

