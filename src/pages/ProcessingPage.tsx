import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LoadingBar } from '../components/shared/LoadingBar';
import { useAppData } from '../context/AppDataContext';
import { useAuth } from '../context/AuthContext';
import { openaiService } from '../services/openai';
import { storageService, documentService, studyContentService } from '../services/supabase';
import { summaryService } from '../services/summaryService';
import { RateLimitError, checkRateLimit } from '../services/aiGateway';
import toast from 'react-hot-toast';

export const ProcessingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { createNote, refreshData } = useAppData();
  const { user } = useAuth();
  const [progress, setProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    const processContent = async () => {
      if (!user) {
        setError('User not authenticated');
        return;
      }

      if (hasProcessedRef.current) return;
      hasProcessedRef.current = true;

      try {
        // ⚠️ CHECK RATE LIMIT FIRST - BEFORE ANY OPERATIONS
        // This prevents wasting time on uploads/processing if user is at limit
        setCurrentTask('Checking rate limit...');
        setProgress(5);
        try {
          await checkRateLimit(user.id);
        } catch (rateLimitError) {
          // Rate limit reached - show error and navigate home immediately
          if (rateLimitError instanceof RateLimitError) {
            const rateLimitMessage = rateLimitError.code === 'ACCOUNT_LIMIT_REACHED'
              ? '🚫 You have already used your one-time AI generation quota. No additional AI generations are available.'
              : `🚫 Daily AI limit reached. You have used your daily quota (${rateLimitError.limit} generations). Please try again tomorrow.`;
            
            toast.error(rateLimitMessage, {
              duration: 5000,
            });
            
            setError(rateLimitMessage);
            
            // Automatically navigate home after a short delay
            setTimeout(() => {
              navigate('/home');
            }, 2000);
            
            return; // Stop processing - no note should be created
          }
          // If it's not a RateLimitError but was thrown from checkRateLimit, re-throw
          throw rateLimitError;
        }

        // Get state from location
        const { audioBlob, title, text, fileMetadata } = location.state || {};

        if (audioBlob) {
          // Validate audio blob
          if (!audioBlob || audioBlob.size === 0) {
            throw new Error('Audio recording is empty or invalid. Please try recording again.');
          }
          
          console.log('Processing audio:', {
            size: audioBlob.size,
            type: audioBlob.type,
            userId: user.id
          });
          
          // Process audio recording
          setCurrentTask('Uploading audio...');
          setProgress(15);
          
          // Upload audio to storage first (required for large files)
          const audioFile = new File([audioBlob], 'recording.webm', { type: audioBlob.type || 'audio/webm' });
          
          let storagePath: string;
          try {
            storagePath = await storageService.uploadFile(user.id, audioFile);
            console.log('Audio uploaded to storage:', storagePath);
            
            // Validate storagePath was returned correctly
            if (!storagePath || typeof storagePath !== 'string' || storagePath.trim().length === 0) {
              console.error('Invalid storage path returned:', storagePath);
              throw new Error('Failed to upload audio file: Invalid storage path returned.');
            }
          } catch (uploadError) {
            console.error('Failed to upload audio:', uploadError);
            throw new Error('Failed to upload audio file. Please check your connection and try again.');
          }
          
          setProgress(30);
          
          // Transcribe audio (will use storage path for large files)
          setCurrentTask('Transcribing audio...');
          setProgress(35);
          console.log(`Starting transcription. Blob size: ${audioBlob.size} bytes, Storage path: ${storagePath}, Path type: ${typeof storagePath}, Path length: ${storagePath.length}`);
          
          let transcription: string;
          try {
            transcription = await openaiService.transcribeAudio(audioBlob, storagePath, user.id);
            console.log(`Transcription completed. Length: ${transcription.length} characters, ${transcription.split(/\s+/).length} words`);
          } catch (transcribeError) {
            console.error('Transcription failed:', transcribeError);
            // Re-throw to be caught by outer catch
            throw transcribeError;
          }
          
          setProgress(60);

          // Create note title from transcription (non-blocking - if it fails due to rate limit, abort)
          setCurrentTask('Generating title...');
          let aiTitleFromAudio: string | null = null;
          try {
            aiTitleFromAudio = await summaryService.generatePerfectTitle(transcription);
          } catch (titleError: any) {
            // If title generation fails due to rate limit, abort note creation
            if (titleError instanceof RateLimitError || titleError?.code === 'DAILY_LIMIT_REACHED' || titleError?.code === 'ACCOUNT_LIMIT_REACHED') {
              throw titleError; // Re-throw to be caught by outer catch
            }
            // For other errors, just use default title - title generation is optional
            console.log('Title generation skipped (error):', titleError?.code || titleError?.message);
            aiTitleFromAudio = null;
          }
          
          // Create note with AI title (if generated) or fallback title
          const noteId = await createNote(aiTitleFromAudio || title || 'Voice Recording', transcription);
          setProgress(75);

          // Save audio file as document (already uploaded, just create document record)
          await documentService.createDocument(noteId, audioFile, storagePath);
          setProgress(85);

          // Refresh data to ensure the note is loaded
          await refreshData();
          setProgress(90);

          // Generate study materials in the background (non-blocking)
          setCurrentTask('Generating study materials...');
          studyContentService.generateAndSaveAllStudyContent(noteId, transcription).catch(err => {
            console.error('Background study content generation failed:', err);
          });
          
          setProgress(100);

          // Wait a moment for state to update, then navigate to note view
          setTimeout(() => {
            navigate(`/note?id=${noteId}`);
          }, 100);
        } else if (text) {
          // Process text content
          setCurrentTask('Generating title...');
          setProgress(45);
          let aiTitle: string | null = null;
          try {
            aiTitle = await summaryService.generatePerfectTitle(text);
          } catch (titleError: any) {
            // If title generation fails due to rate limit, abort note creation
            if (titleError instanceof RateLimitError || titleError?.code === 'DAILY_LIMIT_REACHED' || titleError?.code === 'ACCOUNT_LIMIT_REACHED') {
              throw titleError; // Re-throw to be caught by outer catch
            }
            // For other errors, just use default title - title generation is optional
            console.log('Title generation skipped (error):', titleError?.code || titleError?.message);
            aiTitle = null;
          }

          setCurrentTask('Creating note...');
          setProgress(55);
          const noteId = await createNote(aiTitle || title || 'New Note', text);
          setProgress(60);

          // Create document records if file metadata exists
          if (fileMetadata && Array.isArray(fileMetadata)) {
            setCurrentTask('Saving documents...');
            for (const { file, storagePath } of fileMetadata) {
              try {
                await documentService.createDocument(noteId, file, storagePath);
              } catch (docError) {
                console.error('Error creating document record:', docError);
                // Continue with other documents even if one fails
              }
            }
          }
          setProgress(80);

          // Refresh data to ensure the note is loaded
          await refreshData();
          setProgress(90);

          // Generate study materials in the background (non-blocking)
          setCurrentTask('Generating study materials...');
          studyContentService.generateAndSaveAllStudyContent(noteId, text).catch(err => {
            console.error('Background study content generation failed:', err);
          });

          setProgress(100);

          // Wait a moment for state to update, then navigate to note view
          setTimeout(() => {
            navigate(`/note?id=${noteId}`);
          }, 100);
        } else {
          // Default: create empty note
          setCurrentTask('Creating note...');
          setProgress(50);

          const noteId = await createNote(title || 'New Note');
          
          // Refresh data to ensure the note is loaded
          await refreshData();

          // Don't generate study materials for empty notes
          setProgress(100);

          // Wait a moment for state to update, then navigate to note view
          setTimeout(() => {
            navigate(`/note?id=${noteId}`);
          }, 100);
        }
      } catch (err: any) {
        console.error('Processing error:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        
        // Check if this is a rate limit error
        const isRateLimitError = err instanceof RateLimitError || 
                                 err?.code === 'DAILY_LIMIT_REACHED' || 
                                 err?.code === 'ACCOUNT_LIMIT_REACHED';
        
        if (isRateLimitError) {
          // Show toast notification
          const rateLimitMessage = err?.code === 'ACCOUNT_LIMIT_REACHED'
            ? '🚫 You have already used your one-time AI generation quota. No additional AI generations are available.'
            : '🚫 Daily AI limit reached. You have used your daily quota for AI-powered features. Please try again tomorrow.';
          
          toast.error(rateLimitMessage, {
            duration: 5000,
          });
          
          // Set error state to show error UI
          setError(rateLimitMessage);
          
          // Automatically navigate home after a short delay to show the error
          setTimeout(() => {
            navigate('/home');
          }, 2000); // Show error for 2 seconds, then navigate
          
          return; // Don't process any further - no note should be created
        }
        
        // Handle other error types
        if (errorMessage.includes('too large') || errorMessage.includes('size')) {
          setError(
            'The audio recording is too large to process. ' +
            'For long recordings (over 2 minutes), please try recording in shorter segments, ' +
            'or the system will automatically reduce quality for longer recordings.'
          );
        } else if (errorMessage.includes('timeout')) {
          setError(
            'The transcription request timed out. This usually happens with very long recordings. ' +
            'Please try recording in shorter segments (under 2 minutes each).'
          );
        } else {
          // Only add "Please try again" if it's not already in the message
          const displayMessage = errorMessage.includes('Please try again') 
            ? `Failed to process content: ${errorMessage}` 
            : `Failed to process content: ${errorMessage}. Please try again.`;
          setError(displayMessage);
        }
      }
    };

    processContent();
  }, [user, location, createNote, refreshData, navigate]);

  if (error) {
    // Check if this is a rate limit error - if so, auto-navigate is already scheduled
    const isRateLimitError = error.includes('Daily AI limit reached') || error.includes('one-time AI generation quota');
    
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center px-8 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-2xl bg-[#2a2a2a] rounded-3xl p-12 pb-16 border border-[#3a3a3a]"
        >
          <div className="text-center">
            <h2 className="text-4xl font-bold text-white mb-4">Error</h2>
            <p className="text-[#9ca3af] text-lg mb-8">{error}</p>
            {isRateLimitError ? (
              <p className="text-[#9ca3af] text-sm">Redirecting to home...</p>
            ) : (
              <button
                onClick={() => navigate('/home')}
                className="px-6 py-3 bg-[#b85a3a] hover:bg-[#a04a2a] text-white rounded-lg font-medium transition-colors"
              >
                Back to Home
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center px-8 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-2xl"
      >
        <div className="bg-[#1a1a1a] rounded-3xl p-12 pb-16 border border-[#3a3a3a]">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-bold text-white mb-4">Creating new notes</h2>
            <p className="text-[#9ca3af] text-lg">{currentTask}</p>
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

