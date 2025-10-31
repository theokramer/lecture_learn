import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { NoteSidebar } from '../components/note/NoteSidebar';
import { ContentView } from '../components/note/ContentView';
import { AIChatPanel } from '../components/note/AIChatPanel';
import { useAppData } from '../context/AppDataContext';
import { useSettings } from '../context/SettingsContext';
import { studyContentService } from '../services/supabase';
import type { StudyMode } from '../types';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { KeyboardShortcutsModal } from '../components/shared/KeyboardShortcutsModal';

export const NoteViewPage: React.FC = () => {
  const appData = useAppData();
  const { preferences } = useSettings();
  const [searchParams] = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [chatWidth, setChatWidth] = useState(450);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const hasCheckedSummaryRef = useRef<string | null>(null);
  const hasSetDefaultModeRef = useRef<string | null>(null);
  const saveHandlerRef = useRef<(() => void) | null>(null);

  // Set the selected note from URL parameter
  useEffect(() => {
    const noteId = searchParams.get('id');
    if (noteId && noteId !== appData.selectedNoteId) {
      appData.setSelectedNoteId(noteId);
      hasCheckedSummaryRef.current = null; // Reset check for new note
      hasSetDefaultModeRef.current = null; // Reset default mode for new note
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Set default study mode when opening a note (if no explicit mode is set)
  useEffect(() => {
    const noteId = appData.selectedNoteId;
    const modeParam = searchParams.get('mode') as StudyMode | null;
    
    // Only set default if:
    // 1. We have a note selected
    // 2. No explicit mode in URL
    // 3. We haven't set default mode for this note yet
    if (noteId && !modeParam && hasSetDefaultModeRef.current !== noteId) {
      const defaultMode = preferences.defaultStudyMode || 'summary';
      if (appData.currentStudyMode !== defaultMode) {
        appData.setCurrentStudyMode(defaultMode);
      }
      hasSetDefaultModeRef.current = noteId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appData.selectedNoteId, searchParams, preferences.defaultStudyMode]);

  // Check if summary is available when note changes and auto-switch to summary view
  // (Only if default mode is summary or if we're already on summary)
  useEffect(() => {
    const checkAndSwitchToSummary = async () => {
      const noteId = appData.selectedNoteId;
      if (!noteId || hasCheckedSummaryRef.current === noteId) return;

      // Only auto-switch to summary if default mode is summary
      const defaultMode = preferences.defaultStudyMode || 'summary';
      if (defaultMode !== 'summary') return;

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
  }, [appData.selectedNoteId, appData.currentStudyMode, preferences.defaultStudyMode]);

  // Poll for newly generated summaries (when they finish generating in background)
  // Only if default mode is summary
  useEffect(() => {
    const noteId = appData.selectedNoteId;
    if (!noteId || hasCheckedSummaryRef.current === noteId) return;

    const defaultMode = preferences.defaultStudyMode || 'summary';
    if (defaultMode !== 'summary') return; // Don't auto-switch if default isn't summary

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
  }, [appData.selectedNoteId, preferences.defaultStudyMode]);

  const handleModeChange = (mode: StudyMode) => {
    appData.setCurrentStudyMode(mode);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSave: () => {
      // Trigger save if there's a save handler (e.g., from SummaryView)
      if (saveHandlerRef.current) {
        saveHandlerRef.current();
      }
    },
    onHelp: () => setShowShortcuts(true),
    onClose: () => {
      if (showShortcuts) setShowShortcuts(false);
    },
  });

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

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
};
