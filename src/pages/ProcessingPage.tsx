import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LoadingBar } from '../components/shared/LoadingBar';
import { useAppData } from '../context/AppDataContext';
import { useAuth } from '../context/AuthContext';
import { openaiService } from '../services/openai';
import { storageService, documentService, studyContentService } from '../services/supabase';
import { summaryService } from '../services/summaryService';

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
        // Get state from location
        const { audioBlob, title, text, fileMetadata } = location.state || {};

        if (audioBlob) {
          // Process audio recording
          setCurrentTask('Transcribing audio...');
          setProgress(25);
          
          const transcription = await openaiService.transcribeAudio(audioBlob);
          setProgress(50);

          // Upload audio to storage
          const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
          const storagePath = await storageService.uploadFile(user.id, audioFile);
          setProgress(70);

          // Create note title from transcription
          setCurrentTask('Generating title...');
          const aiTitleFromAudio = await summaryService.generatePerfectTitle(transcription);
          
          // Create note with AI title and transcription
          const noteId = await createNote(aiTitleFromAudio || title || 'Voice Recording', transcription);
          setProgress(85);

          // Save audio file as document
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
          const aiTitle = await summaryService.generatePerfectTitle(text);

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
      } catch (err) {
        console.error('Processing error:', err);
        setError('Failed to process content. Please try again.');
      }
    };

    processContent();
  }, [user, location, createNote, refreshData, navigate]);

  if (error) {
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
            <button
              onClick={() => navigate('/home')}
              className="px-6 py-3 bg-[#b85a3a] hover:bg-[#a04a2a] text-white rounded-lg font-medium transition-colors"
            >
              Back to Home
            </button>
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

