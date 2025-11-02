import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiFolder, HiXMark, HiChevronRight } from 'react-icons/hi2';
import type { Folder } from '../../types';

interface FolderSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (folderId: string | null) => void;
  folders: Folder[];
  currentFolderId: string | null;
  excludeFolderId?: string; // Folder to exclude from selection (e.g., the folder being moved)
  itemName: string;
  itemType: 'note' | 'folder';
}

export const FolderSelectorModal: React.FC<FolderSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  folders,
  currentFolderId,
  excludeFolderId,
  itemName,
  itemType,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId);

  // Build folder tree structure
  const folderTree = useMemo(() => {
    const rootFolders = folders.filter(f => f.parentId === null && f.id !== excludeFolderId);
    const buildPath = (folderId: string | null, path: Folder[] = []): Folder[] => {
      if (folderId === null) return path;
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return path;
      return buildPath(folder.parentId, [folder, ...path]);
    };

    const getChildren = (parentId: string | null): Folder[] => {
      return folders
        .filter(f => f.parentId === parentId && f.id !== excludeFolderId)
        .sort((a, b) => a.name.localeCompare(b.name));
    };

    return {
      rootFolders: rootFolders.sort((a, b) => a.name.localeCompare(b.name)),
      getChildren,
      buildPath,
    };
  }, [folders, excludeFolderId]);

  const handleSelect = (folderId: string | null) => {
    setSelectedFolderId(folderId);
    onSelect(folderId);
    onClose();
  };

  const FolderItem: React.FC<{ folder: Folder; level: number; path: Folder[] }> = ({ folder, level, path }) => {
    const children = folderTree.getChildren(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const isExpanded = children.length > 0;

    return (
      <div>
        <button
          onClick={() => handleSelect(folder.id)}
          className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
            isSelected
              ? 'bg-[#b85a3a] text-white'
              : 'bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white'
          }`}
          style={{ paddingLeft: `${12 + level * 20}px` }}
        >
          <HiFolder className="w-5 h-5 flex-shrink-0" />
          <span className="flex-1 text-left truncate">{folder.name}</span>
          {isExpanded && (
            <HiChevronRight className="w-4 h-4 flex-shrink-0" />
          )}
        </button>
        {children.length > 0 && (
          <div className="ml-6">
            {children.map(child => (
              <FolderItem
                key={child.id}
                folder={child}
                level={level + 1}
                path={[...path, child]}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-h-[80vh] bg-[#1a1a1a] border border-[#3a3a3a] rounded-xl z-50 flex flex-col"
            initial={{ opacity: 0, scale: 0.95, y: -50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -50 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#3a3a3a]">
              <h2 className="text-xl font-bold text-white">
                Move {itemType === 'folder' ? 'Folder' : 'Note'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[#3a3a3a] text-[#9ca3af] hover:text-white transition-colors"
              >
                <HiXMark className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <p className="text-sm text-[#9ca3af] mb-4">
                Select destination for &quot;{itemName}&quot;
              </p>

              {/* Root option */}
              <button
                onClick={() => handleSelect(null)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors mb-4 ${
                  selectedFolderId === null
                    ? 'bg-[#b85a3a] text-white'
                    : 'bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white'
                }`}
              >
                <HiFolder className="w-5 h-5" />
                <span className="flex-1 text-left">Home (Root)</span>
              </button>

              {/* Folder tree */}
              <div className="space-y-1">
                {folderTree.rootFolders.map(folder => (
                  <FolderItem
                    key={folder.id}
                    folder={folder}
                    level={0}
                    path={[folder]}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

