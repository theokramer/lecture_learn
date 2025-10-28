import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/home/Sidebar';
import { FolderNoteList } from '../components/home/FolderNoteList';
import { Button } from '../components/shared/Button';
import { HiPlus, HiFolder } from 'react-icons/hi2';
import { useAppData } from '../context/AppDataContext';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const { createFolder, currentFolderId } = useAppData();

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

  return (
    <div className="flex h-screen bg-[#1a1a1a]">
      {/* Left Sidebar */}
      <Sidebar activePage="home" />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-[#2a2a2a] px-8 py-4 border-b border-[#3a3a3a] flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Home</h1>
          <div className="flex gap-3">
            <Button
              onClick={() => setShowCreateFolder(true)}
              className="flex items-center gap-2"
              variant="secondary"
            >
              <HiFolder className="w-5 h-5" />
              Create Folder
            </Button>
            <Button
              onClick={handleNewNote}
              className="flex items-center gap-2"
            >
              <HiPlus className="w-5 h-5" />
              New Note
            </Button>
          </div>
        </div>

        {/* Content */}
        <FolderNoteList />
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
                onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
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
    </div>
  );
};
