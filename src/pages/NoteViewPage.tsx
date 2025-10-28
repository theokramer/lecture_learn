import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { NoteSidebar } from '../components/note/NoteSidebar';
import { ContentView } from '../components/note/ContentView';
import { AIChatPanel } from '../components/note/AIChatPanel';
import { useAppData } from '../context/AppDataContext';
import type { StudyMode } from '../types';

export const NoteViewPage: React.FC = () => {
  const appData = useAppData();
  const [searchParams] = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [chatWidth, setChatWidth] = useState(450);

  // Set the selected note from URL parameter
  useEffect(() => {
    const noteId = searchParams.get('id');
    if (noteId && noteId !== appData.selectedNoteId) {
      appData.setSelectedNoteId(noteId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
