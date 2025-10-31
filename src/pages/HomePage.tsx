import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/home/Sidebar';
import { FolderNoteList } from '../components/home/FolderNoteList';
import { Button } from '../components/shared/Button';
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
    <div className="flex h-screen bg-[#1a1a1a] overflow-hidden">
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
        <div className="bg-[#2a2a2a] px-4 lg:px-8 py-3 lg:py-4 border-b border-[#3a3a3a] flex items-center justify-between">
          <div className="flex items-center gap-3 lg:gap-4">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-[#3a3a3a] transition-colors"
              aria-label="Open menu"
            >
              <HiBars3 className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-xl lg:text-2xl font-bold text-white">Home</h1>
          </div>
          <div className="flex gap-2 lg:gap-3">
            <Button
              onClick={() => setShowCreateFolder(true)}
              className="flex items-center gap-2 text-sm lg:text-base"
              variant="secondary"
            >
              <HiFolder className="w-4 h-4 lg:w-5 lg:h-5" />
              <span className="hidden sm:inline">Create Folder</span>
              <span className="sm:hidden">Folder</span>
            </Button>
            <Button
              onClick={handleNewNote}
              className="flex items-center gap-2 text-sm lg:text-base"
            >
              <HiPlus className="w-4 h-4 lg:w-5 lg:h-5" />
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

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#2a2a2a] rounded-lg p-6 w-full max-w-md border border-[#3a3a3a]">
            <h2 className="text-xl font-bold text-white mb-4">Create Folder</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') setShowCreateFolder(false);
                }}
                className="flex-1 px-4 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white focus:outline-none focus:border-[#b85a3a]"
                autoFocus
              />
              <Button
                onClick={handleCreateFolder}
                variant="primary"
              >
                Create
              </Button>
              <Button
                onClick={() => setShowCreateFolder(false)}
                variant="secondary"
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
