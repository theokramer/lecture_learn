import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HiFolder, HiChevronRight, HiMagnifyingGlass } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import { format } from 'date-fns';
import type { Note, Folder } from '../../types';

// Note: createFolder logic moved to HomePage top bar

export const FolderNoteList: React.FC = () => {
  const { folders, notes, setSelectedNoteId, currentFolderId } = useAppData();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['folder-1']));

  const filteredFolders = folders.filter(f => f.parentId === currentFolderId);
  const filteredNotes = notes.filter(n => n.folderId === currentFolderId);

  const filteredItems = [
    ...filteredFolders.map(f => ({ type: 'folder' as const, data: f as Folder })),
    ...filteredNotes.map(n => ({ type: 'note' as const, data: n as Note })),
  ].filter(item => {
    if (searchQuery === '') return true;
    const name = (item.data as Note).title || (item.data as Folder).name;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  return (
    <div className="flex-1 p-8 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">My notes</h2>
        
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9ca3af]" />
            <input
              type="text"
              placeholder="Search any note"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-white placeholder:text-[#9ca3af] focus:outline-none focus:border-[#b85a3a]"
            />
          </div>
          <button className="px-4 py-2 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-white hover:bg-[#3a3a3a] transition-colors">
            All notes
          </button>
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-2">

        {filteredItems.map((item) => {
          const isFolder = item.type === 'folder';
          const Icon = isFolder ? HiFolder : HiChevronRight;
          
          return (
            <motion.button
              key={item.data.id}
              whileHover={{ scale: 1.01, x: 4 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                if (isFolder) {
                  toggleFolder(item.data.id);
                } else {
                  setSelectedNoteId(item.data.id);
                  navigate('/note');
                }
              }}
              className="w-full p-4 bg-[#2a2a2a] rounded-lg hover:bg-[#3a3a3a] transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center">
                  {isFolder ? (
                    <HiFolder className="w-6 h-6 text-[#b85a3a]" />
                  ) : (
                    <Icon className="w-5 h-5 text-[#9ca3af]" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">
                    {(item.data as Note).title || (item.data as Folder).name}
                  </p>
                  {!isFolder && 'createdAt' in item.data && (
                    <p className="text-sm text-[#9ca3af]">
                      {format((item.data as Note).createdAt, 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
