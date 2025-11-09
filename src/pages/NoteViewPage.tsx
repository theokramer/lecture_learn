import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { HiBars3, HiChatBubbleLeftRight, HiChevronLeft } from 'react-icons/hi2';
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

const DEBUG_PREFIX = '[NoteViewPage]';

export const NoteViewPage: React.FC = () => {
  const appData = useAppData();
  const { preferences } = useSettings();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
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
  const mountTimeRef = useRef<number>(Date.now());

  // Debug: Component mount/unmount tracking
  useEffect(() => {
    const mountTime = mountTimeRef.current;
    console.log(`${DEBUG_PREFIX} Component MOUNTED at ${new Date(mountTime).toISOString()}`);
    console.log(`${DEBUG_PREFIX} Initial location:`, {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      state: location.state,
      key: location.key,
    });
    console.log(`${DEBUG_PREFIX} Initial searchParams:`, {
      id: searchParams.get('id'),
      mode: searchParams.get('mode'),
      allParams: Object.fromEntries(searchParams.entries()),
    });
    console.log(`${DEBUG_PREFIX} Initial appData state:`, {
      selectedNoteId: appData.selectedNoteId,
      currentStudyMode: appData.currentStudyMode,
      notesCount: appData.notes.length,
      noteExists: appData.notes.find(n => n.id === searchParams.get('id')) ? 'YES' : 'NO',
    });

    return () => {
      const unmountTime = Date.now();
      const lifetime = unmountTime - mountTime;
      console.log(`${DEBUG_PREFIX} Component UNMOUNTED after ${lifetime}ms`);
    };
  }, []); // Only run on mount/unmount

  // Debug: Track location changes
  useEffect(() => {
    console.log(`${DEBUG_PREFIX} Location changed:`, {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      state: location.state,
      key: location.key,
      timestamp: new Date().toISOString(),
    });
  }, [location]);

  // Debug: Track searchParams changes
  useEffect(() => {
    const noteId = searchParams.get('id');
    const mode = searchParams.get('mode');
    console.log(`${DEBUG_PREFIX} SearchParams changed:`, {
      noteId,
      mode,
      allParams: Object.fromEntries(searchParams.entries()),
      timestamp: new Date().toISOString(),
    });
  }, [searchParams]);

  // Debug: Track selectedNoteId changes
  useEffect(() => {
    console.log(`${DEBUG_PREFIX} SelectedNoteId changed:`, {
      previous: undefined, // We don't track previous in this simple version
      current: appData.selectedNoteId,
      noteExists: appData.notes.find(n => n.id === appData.selectedNoteId) ? 'YES' : 'NO',
      noteTitle: appData.notes.find(n => n.id === appData.selectedNoteId)?.title || 'N/A',
      timestamp: new Date().toISOString(),
    });
  }, [appData.selectedNoteId, appData.notes]);

  // Close mobile drawers when resizing to desktop
  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false);
      setMobileChatOpen(false);
    }
  }, [isMobile]);

  // Set the selected note from URL parameter and ensure it's loaded
  useEffect(() => {
    const noteId = searchParams.get('id');
    console.log(`${DEBUG_PREFIX} Processing note selection:`, {
      noteIdFromUrl: noteId,
      currentSelectedNoteId: appData.selectedNoteId,
      notesInContext: appData.notes.length,
      timestamp: new Date().toISOString(),
    });

    if (noteId) {
      // Always set the selected note ID, even if note isn't loaded yet
      if (noteId !== appData.selectedNoteId) {
        console.log(`${DEBUG_PREFIX} Setting selected note ID:`, {
          from: appData.selectedNoteId,
          to: noteId,
        });
        appData.setSelectedNoteId(noteId);
        hasCheckedSummaryRef.current = null; // Reset check for new note
        hasSetDefaultModeRef.current = null; // Reset default mode for new note
        hasGeneratedStudyContentRef.current = null; // Reset generation check for new note
      } else {
        console.log(`${DEBUG_PREFIX} Note ID already selected, skipping setSelectedNoteId`);
      }
      
      // Ensure the note is loaded if it's not in the current filtered list
      const noteExists = appData.notes.find(n => n.id === noteId);
      console.log(`${DEBUG_PREFIX} Note existence check:`, {
        noteId,
        exists: noteExists ? 'YES' : 'NO',
        noteTitle: noteExists?.title || 'N/A',
      });

      if (!noteExists) {
        console.log(`${DEBUG_PREFIX} Note not found in context, loading...`);
        // Load the note and wait for it to be available
        appData.ensureNoteLoaded(noteId)
          .then((note) => {
            if (note) {
              // Note is now loaded, component will re-render
              console.log(`${DEBUG_PREFIX} Note loaded successfully:`, {
                id: note.id,
                title: note.title,
                contentLength: note.content?.length || 0,
              });
            } else {
              console.warn(`${DEBUG_PREFIX} ensureNoteLoaded returned null/undefined`);
            }
          })
          .catch(err => {
            console.error(`${DEBUG_PREFIX} Error loading note:`, {
              noteId,
              error: err,
              errorMessage: err instanceof Error ? err.message : String(err),
              stack: err instanceof Error ? err.stack : undefined,
            });
          });
      } else {
        console.log(`${DEBUG_PREFIX} Note already in context, no loading needed`);
      }
    } else {
      console.warn(`${DEBUG_PREFIX} No note ID in URL parameters!`, {
        searchParams: location.search,
        allParams: Object.fromEntries(searchParams.entries()),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, appData.notes]);

  // Set study mode when opening a note (from URL param or default)
  useEffect(() => {
    const noteId = appData.selectedNoteId;
    const modeParam = searchParams.get('mode') as StudyMode | null;
    
    console.log(`${DEBUG_PREFIX} Setting study mode:`, {
      noteId,
      modeParam,
      currentStudyMode: appData.currentStudyMode,
      defaultStudyMode: preferences.defaultStudyMode,
      hasSetDefaultForNote: hasSetDefaultModeRef.current === noteId,
    });
    
    if (!noteId) {
      console.log(`${DEBUG_PREFIX} No noteId, skipping study mode setup`);
      return;
    }
    
    // If explicit mode is in URL, use it
    if (modeParam && hasSetDefaultModeRef.current !== noteId) {
      console.log(`${DEBUG_PREFIX} Setting mode from URL param:`, {
        mode: modeParam,
        currentMode: appData.currentStudyMode,
        willChange: appData.currentStudyMode !== modeParam,
      });
      if (appData.currentStudyMode !== modeParam) {
        appData.setCurrentStudyMode(modeParam);
        console.log(`${DEBUG_PREFIX} Study mode changed to:`, modeParam);
      }
      hasSetDefaultModeRef.current = noteId;
    } 
    // Otherwise, set default mode if we haven't set it for this note yet
    else if (!modeParam && hasSetDefaultModeRef.current !== noteId) {
      const defaultMode = preferences.defaultStudyMode || 'summary';
      console.log(`${DEBUG_PREFIX} Setting default mode:`, {
        defaultMode,
        currentMode: appData.currentStudyMode,
        willChange: appData.currentStudyMode !== defaultMode,
      });
      if (appData.currentStudyMode !== defaultMode) {
        appData.setCurrentStudyMode(defaultMode);
        console.log(`${DEBUG_PREFIX} Study mode changed to default:`, defaultMode);
      }
      hasSetDefaultModeRef.current = noteId;
    } else {
      console.log(`${DEBUG_PREFIX} Study mode already set for this note, skipping`);
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

  // Mark note as loaded to prevent unnecessary generation attempts
  // We don't auto-generate when opening existing notes - only load what exists
  // Generation should only happen when explicitly requested or when note is first created
  useEffect(() => {
    const noteId = appData.selectedNoteId;
    if (!noteId) return;
    
    // Mark as processed to prevent any auto-generation
    // Users can still manually trigger generation if needed
    hasGeneratedStudyContentRef.current = noteId;
  }, [appData.selectedNoteId]);

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
    console.error(`${DEBUG_PREFIX} appData is not available!`);
    return (
      <div className="flex h-screen bg-bg-primary items-center justify-center">
        <div className="text-text-primary">Loading...</div>
      </div>
    );
  }

  // Debug: Log render state
  const currentNote = appData.notes.find(n => n.id === appData.selectedNoteId);
  console.log(`${DEBUG_PREFIX} Render state:`, {
    selectedNoteId: appData.selectedNoteId,
    currentStudyMode: appData.currentStudyMode,
    currentNote: currentNote ? {
      id: currentNote.id,
      title: currentNote.title,
      hasContent: !!currentNote.content,
    } : 'NOT FOUND',
    location: {
      pathname: location.pathname,
      search: location.search,
    },
    timestamp: new Date().toISOString(),
  });

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      {/* Mobile Header Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-bg-secondary border-b border-border-primary px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/home')}
            className="p-2 rounded-lg hover:bg-bg-hover transition-all duration-200"
            aria-label="Back to home"
          >
            <HiChevronLeft className="w-6 h-6 text-text-primary" />
          </button>
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-bg-hover transition-all duration-200"
            aria-label="Open menu"
          >
            <HiBars3 className="w-5 h-5 text-text-primary" />
          </button>
        </div>
        <h1 className="text-text-primary font-semibold text-lg truncate flex-1 mx-4 text-center">
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
