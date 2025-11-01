import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { HiBars3, HiChatBubbleLeftRight } from 'react-icons/hi2';
import { NoteSidebar } from '../components/note/NoteSidebar';
import { ContentView } from '../components/note/ContentView';
import { AIChatPanel } from '../components/note/AIChatPanel';
import { useAppData } from '../context/AppDataContext';
import { useSettings } from '../context/SettingsContext';
import { studyContentService } from '../services/supabase';
import type { StudyMode } from '../types';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { KeyboardShortcutsModal } from '../components/shared/KeyboardShortcutsModal';
import { useIsMobile } from '../hooks/useIsMobile';

export const NoteViewPage: React.FC = () => {
  const appData = useAppData();
  const { preferences } = useSettings();
  const [searchParams] = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [chatWidth, setChatWidth] = useState(450);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const hasCheckedSummaryRef = useRef<string | null>(null);
  const hasSetDefaultModeRef = useRef<string | null>(null);
  const hasGeneratedStudyContentRef = useRef<string | null>(null);
  const saveHandlerRef = useRef<(() => void) | null>(null);
  const isMobile = useIsMobile(1024);

  // Close mobile drawers when resizing to desktop
  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false);
      setMobileChatOpen(false);
    }
  }, [isMobile]);

  // Set the selected note from URL parameter
  useEffect(() => {
    const noteId = searchParams.get('id');
    if (noteId && noteId !== appData.selectedNoteId) {
      appData.setSelectedNoteId(noteId);
      hasCheckedSummaryRef.current = null; // Reset check for new note
      hasSetDefaultModeRef.current = null; // Reset default mode for new note
      hasGeneratedStudyContentRef.current = null; // Reset generation check for new note
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

  // Auto-generate study content (including summary) when opening a note that doesn't have it
  useEffect(() => {
    const autoGenerateStudyContent = async () => {
      const noteId = appData.selectedNoteId;
      if (!noteId || hasGeneratedStudyContentRef.current === noteId) return;

      const currentNote = appData.notes?.find(n => n.id === noteId);
      if (!currentNote) return;

      const content = currentNote.content || '';
      if (content.trim().length < 50) return; // Not enough content

      try {
        // Check if study content already exists
        const studyContent = await studyContentService.getStudyContent(noteId);
        
        // Only generate if there's no summary (this means no study content was generated yet)
        if (!studyContent.summary || studyContent.summary.trim() === '') {
          // Generate all study content in background (including summary)
          // This will automatically preserve any existing content
          hasGeneratedStudyContentRef.current = noteId;
          studyContentService.generateAndSaveAllStudyContent(noteId, content).catch(err => {
            console.error('Background study content generation failed:', err);
            // Reset on error so we can try again
            hasGeneratedStudyContentRef.current = null;
          });
        } else {
          // Summary exists, mark as generated
          hasGeneratedStudyContentRef.current = noteId;
        }
      } catch (error) {
        console.error('Error checking/generating study content:', error);
      }
    };

    autoGenerateStudyContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appData.selectedNoteId, appData.notes]);

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

  const handleModeChange = (mode: StudyMode) => {
    appData.setCurrentStudyMode(mode);
    // Close mobile sidebar when mode changes on mobile
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  // Safety check: ensure appData is available
  if (!appData) {
    return (
      <div className="flex h-screen bg-bg-primary items-center justify-center">
        <div className="text-text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      {/* Mobile Header Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-bg-secondary border-b border-border-primary px-4 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-bg-hover transition-all duration-200"
          aria-label="Open menu"
        >
          <HiBars3 className="w-6 h-6 text-text-primary" />
        </button>
        <h1 className="text-text-primary font-semibold text-lg truncate flex-1 mx-4">
          {appData.notes.find(n => n.id === appData.selectedNoteId)?.title || 'Note'}
        </h1>
        <button
          onClick={() => setMobileChatOpen(true)}
          className="p-2 rounded-lg hover:bg-bg-hover transition-all duration-200"
          aria-label="Open AI chat"
        >
          <HiChatBubbleLeftRight className="w-6 h-6 text-accent" />
        </button>
      </div>

      {/* Desktop Left Sidebar */}
      <div className="hidden lg:block h-full">
        <NoteSidebar
          currentMode={appData.currentStudyMode}
          onModeChange={handleModeChange}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          isMobile={false}
        />
      </div>

      {/* Mobile Sidebar Drawer - Always render but use CSS to hide on desktop */}
      <div className="lg:hidden">
        <NoteSidebar
          currentMode={appData.currentStudyMode}
          onModeChange={handleModeChange}
          isCollapsed={false}
          onToggleCollapse={() => setMobileSidebarOpen(false)}
          isMobile={true}
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />
      </div>

      {/* Center Content */}
      <div className="flex-1 flex flex-col lg:pt-0 pt-14 overflow-hidden">
        <ContentView />
      </div>

      {/* Desktop Right AI Chat */}
      <div className="hidden lg:block h-full">
        <AnimatePresence mode="wait">
          <AIChatPanel
            key="ai-chat"
            width={chatWidth}
            isCollapsed={chatCollapsed}
            onToggleCollapse={() => setChatCollapsed(!chatCollapsed)}
            onResize={setChatWidth}
            isMobile={false}
          />
        </AnimatePresence>
      </div>

      {/* Mobile AI Chat Modal - Always render but use CSS to hide on desktop */}
      <div className="lg:hidden">
        <AIChatPanel
          width={0}
          isCollapsed={!mobileChatOpen}
          onToggleCollapse={() => setMobileChatOpen(!mobileChatOpen)}
          onResize={() => {}}
          isMobile={true}
          isOpen={mobileChatOpen}
          onClose={() => setMobileChatOpen(false)}
        />
      </div>

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
};
