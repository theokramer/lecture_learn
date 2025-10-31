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
      // IMPORTANT: No silence detection - record continuously regardless of speech pauses
      const options: MediaRecorderOptions = {
        mimeType: selectedMimeType || undefined,
        audioBitsPerSecond: 96000, // Reduced from 128kbps to reduce file size for long recordings
        // Explicitly ensure no auto-stop on silence
        // MediaRecorder doesn't have silence detection built-in, but we ensure continuous recording
      };
      
      console.log('MediaRecorder options:', {
        mimeType: options.mimeType,
        audioBitsPerSecond: options.audioBitsPerSecond,
        note: 'Recording will continue through silence and pauses'
      });

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      // CRITICAL: Always start with empty chunks array
      // Never clear chunks during recording
      chunksRef.current = [];
      console.log('Initialized chunks array, starting with', chunksRef.current.length, 'chunks');
      
      // Flag to track if we're waiting for final chunk
      let waitingForFinalChunk = false;
      let finalChunkResolve: (() => void) | null = null;

      // Track chunk collection statistics
      let lastChunkTime = Date.now();
      let chunkCountAtStart = 0;
      
      // Handle data availability - collect chunks periodically
      // CRITICAL: This handler must never be removed or overwritten during recording
      const chunkHandler = (event: BlobEvent) => {
        const now = Date.now();
        const timeSinceLastChunk = now - lastChunkTime;
        lastChunkTime = now;
        
        // Verify chunksRef is accessible
        if (!chunksRef.current) {
          console.error('CRITICAL: chunksRef.current is null! Cannot collect chunks.');
          return;
        }
        
        const chunkCountBefore = chunksRef.current.length;
        
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
          const totalSize = chunksRef.current.reduce((sum, c) => sum + c.size, 0);
          
          // Verify chunk was actually added
          if (chunksRef.current.length !== chunkCountBefore + 1) {
            console.error(`CRITICAL: Chunk not added! Expected length ${chunkCountBefore + 1}, got ${chunksRef.current.length}`);
          }
          
          // Comprehensive logging for every chunk
          console.log(`[Chunk #${chunksRef.current.length}] Received: ${event.data.size} bytes, Total: ${totalSize} bytes, Time since last: ${timeSinceLastChunk}ms`);
          
          // Warning if chunks stop coming for too long while recording
          if (timeSinceLastChunk > 3000 && chunksRef.current.length > chunkCountAtStart) {
            console.warn(`WARNING: No chunks received for ${timeSinceLastChunk}ms. Recording may have stopped.`);
          }
          
          // Validate chunks array is growing
          if (chunksRef.current.length < chunkCountBefore + 1) {
            console.error('CRITICAL: Chunk count decreased! Something is wrong with chunk collection.');
          }
        } else {
          console.warn(`Received empty chunk data at ${now}`);
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
      
      // Set handler and verify it's set
      mediaRecorder.ondataavailable = chunkHandler;
      
      // Verify handler wasn't overwritten (defensive check)
      if (mediaRecorder.ondataavailable !== chunkHandler) {
        console.error('CRITICAL: ondataavailable handler was overwritten!');
        mediaRecorder.ondataavailable = chunkHandler;
      }
      
      chunkCountAtStart = chunksRef.current.length;
      console.log('ondataavailable handler installed. Starting chunk count:', chunkCountAtStart);
      
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
        // Clear all intervals
        if ((mediaRecorder as any)._healthCheckInterval) {
          clearInterval((mediaRecorder as any)._healthCheckInterval);
        }
        if ((mediaRecorder as any)._diagnosticInterval) {
          clearInterval((mediaRecorder as any)._diagnosticInterval);
        }
        
        try {
          // Calculate expected blob size based on recording duration
          // At 96kbps, expected size = (bitrate * duration_in_seconds) / 8
          // Add 20% overhead for container format
          const expectedMinSize = (96000 * seconds) / 8 * 0.8; // 80% of expected as minimum
          const expectedMaxSize = (96000 * seconds) / 8 * 1.5; // 150% of expected as maximum
          
          // Log chunk collection info
          const totalChunkSize = chunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
          console.log(`=== RECORDING STOPPED ===`);
          console.log(`Duration: ${seconds} seconds`);
          console.log(`Chunks collected: ${chunksRef.current.length}`);
          console.log(`Total chunk size: ${totalChunkSize} bytes`);
          console.log(`Expected size range: ${Math.round(expectedMinSize)} - ${Math.round(expectedMaxSize)} bytes`);
          
          // Calculate expected chunk count (1 chunk per second with 1000ms timeslice)
          const expectedMinChunks = Math.floor(seconds * 0.8); // At least 80% of seconds
          const expectedMaxChunks = Math.ceil(seconds * 1.2); // Up to 120% of seconds (some chunks might span)
          
          console.log(`Expected chunk count range: ${expectedMinChunks} - ${expectedMaxChunks}`);
          console.log(`Actual chunk count: ${chunksRef.current.length}`);
          
          // Validate chunk count first
          if (chunksRef.current.length < expectedMinChunks && seconds > 5) {
            console.error(`CRITICAL: Missing chunks! Expected at least ${expectedMinChunks} chunks, got ${chunksRef.current.length}`);
            console.error('This indicates chunks stopped being collected during recording.');
            toast.error(`Warning: Recording may be incomplete. Expected ${expectedMinChunks}+ chunks, got ${chunksRef.current.length}`);
          }
          
          // Ensure we have all chunks
          if (chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { 
              type: selectedMimeType || 'audio/webm' 
            });
            
            // Validate blob size
            if (blob.size < expectedMinSize && seconds > 10) {
              console.error(`CRITICAL: Blob size (${blob.size} bytes) is too small for ${seconds}s recording.`);
              console.error(`Expected at least ${Math.round(expectedMinSize)} bytes, got ${blob.size} bytes`);
              console.error('This indicates significant audio data is missing!');
              toast.error(`Warning: Recording may be incomplete. Expected ${Math.round(expectedMinSize / 1024)}KB, got ${Math.round(blob.size / 1024)}KB`);
            }
            
            // Log chunk size distribution for debugging
            const chunkSizes = chunksRef.current.map((c, i) => ({ index: i, size: c.size }));
            console.log('Chunk size distribution:', chunkSizes.slice(0, 10)); // First 10 chunks
            if (chunksRef.current.length > 10) {
              console.log('... (showing first 10 chunks)');
              console.log('Last chunk sizes:', chunkSizes.slice(-5)); // Last 5 chunks
            }
            
            console.log('=== BLOB VALIDATION ===');
            console.log('Final blob created. Size:', blob.size, 'bytes (', (blob.size / 1024).toFixed(2), 'KB)');
            console.log('Validation:', {
              actualSize: blob.size,
              expectedMin: Math.round(expectedMinSize),
              expectedMax: Math.round(expectedMaxSize),
              isValid: blob.size >= expectedMinSize && blob.size <= expectedMaxSize,
              chunkCount: chunksRef.current.length,
              expectedChunks: `${expectedMinChunks}-${expectedMaxChunks}`,
              chunksValid: chunksRef.current.length >= expectedMinChunks
            });
            
            setAudioBlob(blob);
          } else {
            console.error('CRITICAL: No audio chunks collected at all!');
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
      
      console.log('=== RECORDING STARTED ===');
      console.log('MIME Type:', selectedMimeType || 'default');
      console.log('MediaRecorder state:', mediaRecorder.state);
      console.log('Max recording duration:', MAX_RECORDING_DURATION, 'seconds (2 hours)');
      console.log('Timeslice: 1000ms (chunks every 1 second)');
      console.log('Initial chunks array length:', chunksRef.current.length);
      console.log('ondataavailable handler:', typeof mediaRecorder.ondataavailable);
      
      // Verify recording started successfully
      if (mediaRecorder.state !== 'recording') {
        throw new Error('MediaRecorder failed to start. State: ' + mediaRecorder.state);
      }
      
      // Start real-time diagnostic logging
      const diagnosticInterval = setInterval(() => {
        if (!isRecording || !mediaRecorderRef.current) {
          clearInterval(diagnosticInterval);
          return;
        }
        
        const recorder = mediaRecorderRef.current;
        const currentChunks = chunksRef.current.length;
        const currentSize = chunksRef.current.reduce((sum, c) => sum + c.size, 0);
        const expectedChunks = seconds;
        const expectedSize = (96000 * seconds) / 8;
        
        // Log diagnostic info every 10 seconds
        if (seconds > 0 && seconds % 10 === 0) {
          console.log(`=== DIAGNOSTIC @ ${seconds}s ===`);
          console.log(`State: ${recorder.state}`);
          console.log(`Chunks: ${currentChunks} (expected: ~${expectedChunks})`);
          console.log(`Size: ${currentSize} bytes (expected: ~${Math.round(expectedSize)} bytes)`);
          console.log(`Chunk ratio: ${(currentChunks / expectedChunks * 100).toFixed(1)}%`);
          console.log(`Size ratio: ${(currentSize / expectedSize * 100).toFixed(1)}%`);
          
          // Alert if significantly behind
          if (currentChunks < expectedChunks * 0.7) {
            console.error(`ALERT: Chunk collection is ${((1 - currentChunks / expectedChunks) * 100).toFixed(1)}% behind!`);
          }
        }
      }, 1000); // Check every second
      
      // Store diagnostic interval for cleanup
      (mediaRecorder as any)._diagnosticInterval = diagnosticInterval;
      
      // Track previous state to detect changes immediately
      // Use ref to avoid closure issues with event listeners
      const previousStateRef = { value: mediaRecorder.state as RecordingState };
      let stateChangeCount = 0;
      
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
        
        // Detect state changes immediately and log
        if (currentState !== previousStateRef.value) {
          console.error(`STATE CHANGE DETECTED: ${previousStateRef.value} -> ${currentState} at check #${healthCheckCount}`);
          stateChangeCount++;
          
          if (currentState === 'inactive' && isRecording) {
            console.error('CRITICAL: MediaRecorder stopped unexpectedly!');
            console.error(`Recording state changed from ${previousStateRef.value} to ${currentState}`);
            console.error(`Chunks collected so far: ${chunksRef.current.length}`);
            console.error(`Current seconds: ${seconds}`);
            console.error('This may indicate a browser autostop, permission issue, or hardware problem');
            clearInterval(healthCheckInterval);
            toast.error('Recording stopped unexpectedly. Please check your microphone permissions and try again.');
            setIsRecording(false);
            if (stopHandlerRef.current) {
              stopHandlerRef.current();
            }
            return;
          }
          
          previousStateRef.value = currentState;
        }
        
        // Log health check every 5 checks (every 10 seconds since we check every 2 seconds)
        if (healthCheckCount % 5 === 0) {
          const totalChunks = chunksRef.current.length;
          const totalSize = chunksRef.current.reduce((sum, c) => sum + c.size, 0);
          const expectedChunks = Math.floor(seconds);
          const expectedSize = (96000 * seconds) / 8;
          
          console.log(`[Health Check #${healthCheckCount}] State: ${currentState}, Seconds: ${seconds}, Chunks: ${totalChunks} (expected: ~${expectedChunks}), Size: ${totalSize} bytes (expected: ~${Math.round(expectedSize)} bytes)`);
          
          // Warning if chunk count is far behind
          if (totalChunks < expectedChunks * 0.5 && seconds > 10) {
            console.warn(`WARNING: Chunk collection lagging! Expected ~${expectedChunks} chunks, have ${totalChunks}`);
          }
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
      
      // Also listen to statechange event directly
      mediaRecorder.addEventListener('statechange', () => {
        const newState: RecordingState = mediaRecorder.state;
        console.log(`MediaRecorder statechange event: ${previousStateRef.value} -> ${newState}`);
        
        if (newState === 'inactive' && previousStateRef.value === 'recording' && isRecording) {
          console.error('CRITICAL: State change to inactive detected via event listener!');
          console.error(`Chunks collected: ${chunksRef.current.length}, Duration: ${seconds}s`);
        }
        
        previousStateRef.value = newState;
      });
      
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

