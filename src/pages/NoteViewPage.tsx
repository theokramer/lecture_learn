import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { NoteSidebar } from '../components/note/NoteSidebar';
import { ContentView } from '../components/note/ContentView';
import { AIChatPanel } from '../components/note/AIChatPanel';
import { useAppData } from '../context/AppDataContext';
import { studyContentService } from '../services/supabase';
import type { StudyMode } from '../types';

export const NoteViewPage: React.FC = () => {
  const appData = useAppData();
  const [searchParams] = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [chatWidth, setChatWidth] = useState(450);
  const hasCheckedSummaryRef = useRef<string | null>(null);

  // Set the selected note from URL parameter
  useEffect(() => {
    const noteId = searchParams.get('id');
    if (noteId && noteId !== appData.selectedNoteId) {
      appData.setSelectedNoteId(noteId);
      hasCheckedSummaryRef.current = null; // Reset check for new note
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Check if summary is available when note changes and auto-switch to summary view
  useEffect(() => {
    const checkAndSwitchToSummary = async () => {
      const noteId = appData.selectedNoteId;
      if (!noteId || hasCheckedSummaryRef.current === noteId) return;

      try {
        const studyContent = await studyContentService.getStudyContent(noteId);
        if (studyContent.summary && studyContent.summary.trim() !== '') {
          // Summary exists! Automatically switch to summary view
          if (appData.currentStudyMode !== 'summary') {
            appData.setCurrentStudyMode('summary');
          }
          hasCheckedSummaryRef.current = noteId;
        }
      } catch (error) {
        // Silently fail - we're just checking
        console.debug('Error checking for summary:', error);
      }
    };

    checkAndSwitchToSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appData.selectedNoteId, appData.currentStudyMode]);

  // Poll for newly generated summaries (when they finish generating in background)
  useEffect(() => {
    const noteId = appData.selectedNoteId;
    if (!noteId || hasCheckedSummaryRef.current === noteId) return;

    // Poll every 3 seconds to check if a summary was generated in the background
    const pollInterval = setInterval(async () => {
      try {
        const studyContent = await studyContentService.getStudyContent(noteId);
        if (studyContent.summary && studyContent.summary.trim() !== '') {
          // Summary was just generated! Switch to summary view automatically
          if (appData.currentStudyMode !== 'summary') {
            appData.setCurrentStudyMode('summary');
          }
          hasCheckedSummaryRef.current = noteId; // Stop polling once we found it
          clearInterval(pollInterval);
        }
      } catch (error) {
        // Silently fail - we're just polling
        console.debug('Polling for summary:', error);
      }
    }, 3000); // Check every 3 seconds

    // Stop polling after 2 minutes to avoid infinite polling
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      hasCheckedSummaryRef.current = noteId; // Mark as checked even if no summary found
    }, 120000); // 2 minutes

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appData.selectedNoteId]);

  const handleModeChange = (mode: StudyMode) => {
    appData.setCurrentStudyMode(mode);
  };

  return (
    <div className="flex h-screen bg-[#1a1a1a]">
      {/* Left Sidebar */}
      <NoteSidebar
        currentMode={appData.currentStudyMode}
        onModeChange={handleModeChange}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Center Content */}
      <ContentView />

      {/* Right AI Chat */}
      <AnimatePresence mode="wait">
        <AIChatPanel
          key="ai-chat"
          width={chatWidth}
          isCollapsed={chatCollapsed}
          onToggleCollapse={() => setChatCollapsed(!chatCollapsed)}
          onResize={setChatWidth}
        />
      </AnimatePresence>
    </div>
  );
};
