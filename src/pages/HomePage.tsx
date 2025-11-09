import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/home/Sidebar';
import { FolderNoteList } from '../components/home/FolderNoteList';
import { Button } from '../components/shared/Button';
import { TokenMeter } from '../components/shared/TokenMeter';
import { HiPlus, HiFolder, HiBars3 } from 'react-icons/hi2';
import { useAppData } from '../context/AppDataContext';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { KeyboardShortcutsModal } from '../components/shared/KeyboardShortcutsModal';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { createFolder, currentFolderId } = useAppData();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleCreateFolder = async () => {
    if (newFolderName.trim()) {
      await createFolder(newFolderName, currentFolderId);
      setNewFolderName('');
      setShowCreateFolder(false);
    }
  };

  const handleNewNote = () => {
    navigate('/note-creation');
  };

  const handleFocusSearch = () => {
    searchInputRef.current?.focus();
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewNote: handleNewNote,
    onSearch: handleFocusSearch,
    onHelp: () => setShowShortcuts(true),
    onClose: () => {
      if (showCreateFolder) setShowCreateFolder(false);
      if (showShortcuts) setShowShortcuts(false);
    },
  });

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      {/* Desktop Left Sidebar */}
      <div className="hidden lg:block">
        <Sidebar activePage="home" isMobile={false} />
      </div>

      {/* Mobile Sidebar Drawer */}
      <div className="lg:hidden">
        <Sidebar 
          activePage="home" 
          isMobile={true}
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-bg-secondary px-4 lg:px-8 py-3 lg:py-4 border-b border-[#3a3a3a]/50 flex items-center justify-between">
          <div className="flex items-center gap-3 lg:gap-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl active:bg-[#3a3a3a] transition-colors duration-150"
              aria-label="Open menu"
            >
              <HiBars3 className="w-6 h-6 text-text-primary" />
            </button>
            {/* Token Meter */}
            <div className="hidden sm:block">
              <TokenMeter />
            </div>
          </div>
          <div className="flex gap-2 lg:gap-3">
            <Button
              onClick={() => setShowCreateFolder(true)}
              className="flex items-center gap-2 text-[15px] font-medium px-4 py-2 rounded-xl active:scale-95 transition-all duration-150"
              variant="secondary"
            >
              <HiFolder className="w-5 h-5" />
              <span className="hidden sm:inline">Create Folder</span>
              <span className="sm:hidden">Folder</span>
            </Button>
            <Button
              onClick={handleNewNote}
              className="flex items-center gap-2 text-[15px] font-medium px-4 py-2 rounded-xl active:scale-95 transition-all duration-150"
            >
              <HiPlus className="w-5 h-5" />
              <span className="hidden sm:inline">New Note</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <FolderNoteList searchInputRef={searchInputRef} />
        </div>
      </div>

      {/* Create Folder Modal - iOS Style */}
      {showCreateFolder && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center sm:items-center z-50">
          <div className="bg-bg-secondary rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-2xl">
            {/* Handle bar (mobile) */}
            <div className="sm:hidden flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-[#9ca3af]/50 rounded-full" />
            </div>
            
            <div className="px-6 py-5 sm:py-6">
              <h2 className="text-[20px] font-semibold text-text-primary mb-4 text-center sm:text-left">Create Folder</h2>
              <input
                type="text"
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') setShowCreateFolder(false);
                }}
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#3a3a3a] rounded-xl text-text-primary text-[17px] focus:outline-none focus:border-accent transition-all"
                autoFocus
              />
            </div>
            
            <div className="px-4 pb-4 sm:pb-6 space-y-2">
              <Button
                onClick={handleCreateFolder}
                variant="primary"
                className="w-full py-3.5 rounded-xl font-semibold text-[17px] active:scale-[0.98] transition-all duration-150"
              >
                Create
              </Button>
              <Button
                onClick={() => setShowCreateFolder(false)}
                variant="secondary"
                className="w-full py-3.5 rounded-xl font-semibold text-[17px] bg-[#3a3a3a] active:bg-[#4a4a4a] active:scale-[0.98] transition-all duration-150"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
};
