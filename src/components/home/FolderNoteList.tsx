import React, { useEffect, useMemo, useState } from 'react';
import { HiFolder, HiChevronRight, HiMagnifyingGlass, HiChevronLeft, HiAcademicCap, HiDocumentPlus } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import { useSettings } from '../../context/SettingsContext';
import { format } from 'date-fns';
import type { Note, Folder } from '../../types';
import { studyContentService } from '../../services/supabase';
import { NoteListSkeleton } from '../shared/SkeletonLoader';
import { EmptyState } from '../shared/EmptyState';
import { ConfirmModal } from '../shared/ConfirmModal';
import { NativeListItem } from '../shared/NativeListItem';
import { FolderSelectorModal } from '../shared/FolderSelectorModal';
import { HiTrash, HiArrowsUpDown } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { useDebounce } from '../../hooks/useDebounce';

// Note: createFolder logic moved to HomePage top bar

interface FolderNoteListProps {
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export const FolderNoteList: React.FC<FolderNoteListProps> = React.memo(({ searchInputRef }) => {
  const { folders, allFolders, notes, setSelectedNoteId, setCurrentFolderId, currentFolderId, selectedNoteId, loading, createFolder, deleteNote, deleteFolder, moveNote, moveFolder } = useAppData();
  const { preferences } = useSettings();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [summariesByNoteId, setSummariesByNoteId] = useState<Record<string, string>>({});
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'note' | 'folder'; id: string; name: string } | null>(null);
  const [itemToMove, setItemToMove] = useState<{ type: 'note' | 'folder'; id: string; name: string; currentParentId: string | null } | null>(null);
  
  const isCompact = preferences.noteListDensity === 'compact';

  useEffect(() => {
    if (notes.length === 0) return;
    const load = async () => {
      const ids = notes.map(n => n.id);
      const map = await studyContentService.getSummariesForNotes(ids);
      setSummariesByNoteId(map);
    };
    load();
  }, [notes]);

  const normalize = (s: string) => s.toLowerCase();

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  const getSnippet = (text: string, query: string) => {
    const lower = text.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) return null;
    const context = 60;
    const start = Math.max(0, idx - context);
    const end = Math.min(text.length, idx + query.length + context);
    let snippet = text.slice(start, end).trim();
    const firstNewline = snippet.indexOf('\n');
    if (firstNewline !== -1) snippet = snippet.slice(0, firstNewline);
    return { snippet, index: idx };
  };

  const highlight = (text: string, query: string) => {
    if (!query) return text;
    const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${q})`, 'ig');
    return text.replace(re, `<mark class="bg-accent/30 text-text-primary rounded px-1">$1</mark>`);
  };

  const filteredFolders = folders.filter(f => f.parentId === currentFolderId);
  const filteredNotes = debouncedSearchQuery === '' 
    ? notes.filter(n => n.folderId === currentFolderId)
    : notes; // When searching, show all notes

  const searchResults = useMemo(() => {
    if (debouncedSearchQuery.trim() === '') return [] as Array<{
      note: Note;
      matchField: 'title' | 'summary' | 'transcript';
      snippetHtml: string;
      priority: number;
    }>;

    const q = normalize(debouncedSearchQuery);
    const results: Array<{ note: Note; matchField: 'title' | 'summary' | 'transcript'; snippetHtml: string; priority: number; }> = [];

    for (const n of filteredNotes) {
      // Title match has highest priority
      if (normalize(n.title).includes(q)) {
        const snip = getSnippet(n.title, debouncedSearchQuery) || { snippet: n.title, index: 0 };
        results.push({ note: n, matchField: 'title', snippetHtml: highlight(snip.snippet, debouncedSearchQuery), priority: 0 });
        continue;
      }

      // Summary (HTML)
      const rawSummary = summariesByNoteId[n.id] || '';
      const summaryText = rawSummary ? stripHtml(rawSummary) : '';
      if (summaryText && normalize(summaryText).includes(q)) {
        const snip = getSnippet(summaryText, debouncedSearchQuery);
        if (snip) {
          results.push({ note: n, matchField: 'summary', snippetHtml: highlight(snip.snippet, debouncedSearchQuery), priority: 1 });
          continue;
        }
      }

      // Transcript/content
      const transcript = n.content || '';
      if (transcript && normalize(transcript).includes(q)) {
        const snip = getSnippet(transcript, debouncedSearchQuery);
        if (snip) {
          results.push({ note: n, matchField: 'transcript', snippetHtml: highlight(snip.snippet, debouncedSearchQuery), priority: 2 });
          continue;
        }
      }
    }

    results.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.note.createdAt.getTime() - a.note.createdAt.getTime();
    });
    return results;
  }, [debouncedSearchQuery, filteredNotes, summariesByNoteId]);

  const filteredItems = useMemo(() => {
    if (debouncedSearchQuery.trim() !== '') {
      return searchResults.map(r => ({ type: 'note' as const, data: r.note, meta: r }));
    }
    return [
      ...filteredFolders.map(f => ({ type: 'folder' as const, data: f as Folder })),
      ...filteredNotes.map(n => ({ type: 'note' as const, data: n as Note })),
    ];
  }, [debouncedSearchQuery, searchResults, filteredFolders, filteredNotes]);

  // Get current folder for display and navigation
  const currentFolder = useMemo(() => {
    return currentFolderId ? allFolders.find(f => f.id === currentFolderId) : null;
  }, [currentFolderId, allFolders]);

  // Build breadcrumb path for navigation
  const breadcrumbPath = useMemo(() => {
    if (!currentFolderId) return [];
    
    const path: Folder[] = [];
    let folder = currentFolder;
    
    // Build path by traversing up the parent chain
    while (folder) {
      path.unshift(folder); // Add to beginning
      if (folder.parentId) {
        folder = allFolders.find(f => f.id === folder!.parentId) || null;
      } else {
        folder = null;
      }
    }
    
    return path;
  }, [currentFolder, allFolders, currentFolderId]);

  const handleBackToParent = () => {
    if (!currentFolder) {
      // Already at root, nothing to do
      return;
    }
    
    if (currentFolder.parentId !== null) {
      // Go to parent folder
      setCurrentFolderId(currentFolder.parentId);
    } else {
      // Go to root (null means root level)
      setCurrentFolderId(null);
    }
  };

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = (folderId: string | null) => {
    setCurrentFolderId(folderId);
  };

  return (
    <div className="min-h-full px-4 sm:px-6 lg:px-8 py-6 pb-20">
      {/* Header */}
      <div>
        {/* Breadcrumb Navigation */}
        {currentFolderId && (
          <div className="mb-4">
            {/* Back Button */}
            <button
              onClick={handleBackToParent}
              className="flex items-center gap-2 text-[#9ca3af] hover:text-white active:text-white transition-colors mb-3 px-2 py-1 -ml-2 rounded-lg active:bg-[#2a2a2a]"
            >
              <HiChevronLeft className="w-5 h-5" />
              <span className="text-[15px] font-medium">Back</span>
            </button>
            
            {/* Breadcrumb Path */}
            {breadcrumbPath.length > 0 && (
              <div className="flex items-center gap-2 text-[15px] text-[#9ca3af] flex-wrap mb-3">
                <button
                  onClick={() => handleBreadcrumbClick(null)}
                  className="hover:text-white active:text-white transition-colors px-2 py-1 -ml-2 rounded-lg active:bg-[#2a2a2a]"
                >
                  Home
                </button>
                {breadcrumbPath.map((folder, index) => (
                  <React.Fragment key={folder.id}>
                    <HiChevronRight className="w-4 h-4" />
                    <button
                      onClick={() => handleBreadcrumbClick(folder.id)}
                      className={`hover:text-white active:text-white transition-colors px-2 py-1 -ml-2 rounded-lg active:bg-[#2a2a2a] ${
                        index === breadcrumbPath.length - 1 ? 'text-white font-semibold' : ''
                      }`}
                    >
                      {folder.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Page Title */}
        <h2 className="text-[34px] font-bold text-white mb-6 leading-tight">
          {currentFolder ? currentFolder.name : 'Home'}
        </h2>
        
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9ca3af]" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search any note"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedIndex(-1); // Reset selection when searching
              }}
              onKeyDown={(e) => {
                const items = filteredItems;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : prev));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
                } else if (e.key === 'Enter' && selectedIndex >= 0 && items[selectedIndex]) {
                  e.preventDefault();
                  const item = items[selectedIndex];
                  if (item.type === 'note') {
                    const noteId = item.data.id;
                    const navigationPath = `/note?id=${noteId}`;
                    console.log('[FolderNoteList] Keyboard navigation to note view:', {
                      noteId,
                      noteTitle: item.data.title,
                      navigationPath,
                      hasIdParam: true,
                      timestamp: new Date().toISOString(),
                    });
                    navigate(navigationPath);
                  } else if (item.type === 'folder') {
                    setCurrentFolderId(item.data.id);
                  }
                }
              }}
              className="w-full pl-10 pr-4 py-3 bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl text-white placeholder:text-[#9ca3af] focus:outline-none focus:border-[#b85a3a] text-[17px]"
            />
          </div>
          <button className="px-4 py-3 bg-[#2a2a2a] border border-[#3a3a3a] rounded-xl text-white hover:bg-[#3a3a3a] active:bg-[#3a3a3a] active:scale-95 transition-all duration-150 text-[15px] font-medium">
            All notes
          </button>
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-0">
        {loading ? (
          <NoteListSkeleton />
        ) : filteredItems.length === 0 ? (
          debouncedSearchQuery.trim() ? (
            <EmptyState
              icon={HiMagnifyingGlass}
              title="No Results Found"
              description={`No notes or folders match "${debouncedSearchQuery}". Try adjusting your search terms or create a new note.`}
              action={{
                label: 'Create New Note',
                onClick: () => navigate('/note-creation'),
                variant: 'primary',
              }}
            />
          ) : (
            <EmptyState
              icon={HiDocumentPlus}
              title="Get Started"
              description="Create your first note or folder to organize your learning materials. You can record audio, upload documents, or add text directly."
              action={{
                label: 'Create New Note',
                onClick: () => navigate('/note-creation'),
                variant: 'primary',
              }}
              secondaryAction={{
                label: 'Create Folder',
                onClick: async () => {
                  const folderName = prompt('Folder name:');
                  if (folderName && folderName.trim()) {
                    await createFolder(folderName.trim(), currentFolderId);
                  }
                },
              }}
            />
          )
        ) : (
          filteredItems.map((item, index) => {
          const isFolder = item.type === 'folder';
          const Icon = isFolder ? HiFolder : HiChevronRight;
          const isSelected = selectedIndex === index;
          const itemName = (item.data as Note).title || (item.data as Folder).name;
          const currentParentId = isFolder ? (item.data as Folder).parentId : (item.data as Note).folderId;
          
          const contextMenuActions = [
            {
              label: 'Move',
              icon: HiArrowsUpDown,
              action: () => {
                setItemToMove({
                  type: isFolder ? 'folder' : 'note',
                  id: item.data.id,
                  name: itemName,
                  currentParentId,
                });
              },
            },
            {
              label: `Delete ${isFolder ? 'Folder' : 'Note'}`,
              icon: HiTrash,
              action: () => {
                setItemToDelete({
                  type: isFolder ? 'folder' : 'note',
                  id: item.data.id,
                  name: itemName,
                });
              },
              destructive: true,
            },
          ];

          return (
            <NativeListItem
              key={item.data.id}
              onPress={() => {
                if (isFolder) {
                  setCurrentFolderId(item.data.id);
                } else {
                  const noteId = item.data.id;
                  const navigationPath = `/note?id=${noteId}`;
                  console.log('[FolderNoteList] Navigating to note view:', {
                    noteId,
                    noteTitle: item.data.title,
                    navigationPath,
                    hasIdParam: true,
                    timestamp: new Date().toISOString(),
                  });
                  setSelectedNoteId(noteId);
                  navigate(navigationPath);
                }
              }}
              contextMenuActions={contextMenuActions}
              isSelected={isSelected}
              className={`w-full ${isCompact ? 'px-4 py-3' : 'px-5 py-4'} rounded-xl mb-2`}
            >
              <div className={`flex items-center ${isCompact ? 'gap-3' : 'gap-4'}`}>
                <div className={`${isCompact ? 'w-8 h-8' : 'w-10 h-10'} flex items-center justify-center flex-shrink-0`}>
                  {isFolder ? (
                    <HiFolder className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} text-[#b85a3a]`} />
                  ) : (
                    <Icon className={`${isCompact ? 'w-4 h-4' : 'w-5 h-5'} text-[#9ca3af]`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-white ${isCompact ? 'text-[15px]' : 'text-[17px]'} truncate leading-tight`}>
                    {itemName}
                  </p>
                  {!isFolder && 'createdAt' in item.data && (
                    <p className={`${isCompact ? 'text-xs mt-0.5' : 'text-sm mt-1'} text-[#9ca3af]`}>
                      {isCompact 
                        ? format((item.data as Note).createdAt, 'MMM d')
                        : format((item.data as Note).createdAt, 'MMM d, yyyy')
                      }
                    </p>
                  )}
                  {!isCompact && debouncedSearchQuery.trim() !== '' && !isFolder && (item as any).meta && (
                    <div
                      className="mt-1.5 text-sm text-[#9ca3af] line-clamp-1"
                      dangerouslySetInnerHTML={{ __html: (item as any).meta.snippetHtml }}
                    />
                  )}
                </div>
                {isFolder && (
                  <div className="flex-shrink-0 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/learn-flashcards?folder=${item.data.id}`);
                      }}
                      className="px-3 py-1.5 bg-[#10b981] hover:bg-[#059669] rounded-lg text-white text-sm font-medium flex items-center gap-2 transition-colors active:scale-95"
                    >
                      <HiAcademicCap className="w-4 h-4" />
                      <span className="hidden sm:inline">Learn</span>
                    </button>
                  </div>
                )}
              </div>
            </NativeListItem>
          );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={async () => {
          if (!itemToDelete) return;
          
          try {
            if (itemToDelete.type === 'folder') {
              await deleteFolder(itemToDelete.id);
              toast.success('Folder deleted successfully');
            } else {
              await deleteNote(itemToDelete.id);
              toast.success('Note deleted successfully');
              // Navigate away if we deleted the currently selected note
              if (itemToDelete.id === selectedNoteId) {
                navigate('/home');
              }
            }
          } catch (error) {
            console.error(`Error deleting ${itemToDelete.type}:`, error);
            toast.error(`Failed to delete ${itemToDelete.type}`);
          } finally {
            setItemToDelete(null);
          }
        }}
        title={`Delete ${itemToDelete?.type === 'folder' ? 'Folder' : 'Note'}`}
        message={
          itemToDelete?.type === 'folder'
            ? `Are you sure you want to delete the folder "${itemToDelete.name}"? This will also delete all notes inside it. This action cannot be undone.`
            : `Are you sure you want to delete the note "${itemToDelete?.name}"? This action cannot be undone.`
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />

      {/* Move Folder/Note Modal */}
      <FolderSelectorModal
        isOpen={!!itemToMove}
        onClose={() => setItemToMove(null)}
        onSelect={async (newParentId) => {
          if (!itemToMove) return;
          
          try {
            // Prevent moving folder into itself or into its own children
            if (itemToMove.type === 'folder' && newParentId === itemToMove.id) {
              toast.error('Cannot move folder into itself');
              return;
            }
            
            // Check if moving into a child folder (would create circular reference)
            if (itemToMove.type === 'folder' && newParentId) {
              const checkCircular = (folderId: string, targetParentId: string | null): boolean => {
                if (folderId === targetParentId) return true;
                if (!targetParentId) return false;
                const targetFolder = allFolders.find(f => f.id === targetParentId);
                if (!targetFolder) return false;
                return checkCircular(folderId, targetFolder.parentId);
              };
              
              if (checkCircular(itemToMove.id, newParentId)) {
                toast.error('Cannot move folder into its own subfolder');
                return;
              }
            }
            
            if (itemToMove.type === 'folder') {
              await moveFolder(itemToMove.id, newParentId);
              toast.success('Folder moved successfully');
            } else {
              await moveNote(itemToMove.id, newParentId);
              toast.success('Note moved successfully');
            }
          } catch (error) {
            console.error(`Error moving ${itemToMove.type}:`, error);
            toast.error(`Failed to move ${itemToMove.type}`);
          } finally {
            setItemToMove(null);
          }
        }}
        folders={allFolders}
        currentFolderId={itemToMove?.currentParentId || null}
        excludeFolderId={itemToMove?.type === 'folder' ? itemToMove.id : undefined}
        itemName={itemToMove?.name || ''}
        itemType={itemToMove?.type || 'note'}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if searchInputRef changes
  return prevProps.searchInputRef === nextProps.searchInputRef;
});
FolderNoteList.displayName = 'FolderNoteList';
