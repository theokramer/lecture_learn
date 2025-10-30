import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { HiFolder, HiChevronRight, HiMagnifyingGlass, HiChevronLeft } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import { format } from 'date-fns';
import type { Note, Folder } from '../../types';
import { studyContentService } from '../../services/supabase';

// Note: createFolder logic moved to HomePage top bar

export const FolderNoteList: React.FC = () => {
  const { folders, notes, setSelectedNoteId, setCurrentFolderId, currentFolderId } = useAppData();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [summariesByNoteId, setSummariesByNoteId] = useState<Record<string, string>>({});

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
    return text.replace(re, '<mark class="bg-[#b85a3a]/30 text-white rounded px-1">$1<\/mark>');
  };

  const filteredFolders = folders.filter(f => f.parentId === currentFolderId);
  const filteredNotes = searchQuery === '' 
    ? notes.filter(n => n.folderId === currentFolderId)
    : notes; // When searching, show all notes

  const searchResults = useMemo(() => {
    if (searchQuery.trim() === '') return [] as Array<{
      note: Note;
      matchField: 'title' | 'summary' | 'transcript';
      snippetHtml: string;
      priority: number;
    }>;

    const q = normalize(searchQuery);
    const results: Array<{ note: Note; matchField: 'title' | 'summary' | 'transcript'; snippetHtml: string; priority: number; }> = [];

    for (const n of filteredNotes) {
      // Title match has highest priority
      if (normalize(n.title).includes(q)) {
        const snip = getSnippet(n.title, searchQuery) || { snippet: n.title, index: 0 };
        results.push({ note: n, matchField: 'title', snippetHtml: highlight(snip.snippet, searchQuery), priority: 0 });
        continue;
      }

      // Summary (HTML)
      const rawSummary = summariesByNoteId[n.id] || '';
      const summaryText = rawSummary ? stripHtml(rawSummary) : '';
      if (summaryText && normalize(summaryText).includes(q)) {
        const snip = getSnippet(summaryText, searchQuery);
        if (snip) {
          results.push({ note: n, matchField: 'summary', snippetHtml: highlight(snip.snippet, searchQuery), priority: 1 });
          continue;
        }
      }

      // Transcript/content
      const transcript = n.content || '';
      if (transcript && normalize(transcript).includes(q)) {
        const snip = getSnippet(transcript, searchQuery);
        if (snip) {
          results.push({ note: n, matchField: 'transcript', snippetHtml: highlight(snip.snippet, searchQuery), priority: 2 });
          continue;
        }
      }
    }

    results.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.note.createdAt.getTime() - a.note.createdAt.getTime();
    });
    return results;
  }, [searchQuery, filteredNotes, summariesByNoteId]);

  const filteredItems = useMemo(() => {
    if (searchQuery.trim() !== '') {
      return searchResults.map(r => ({ type: 'note' as const, data: r.note, meta: r }));
    }
    return [
      ...filteredFolders.map(f => ({ type: 'folder' as const, data: f as Folder })),
      ...filteredNotes.map(n => ({ type: 'note' as const, data: n as Note })),
    ];
  }, [searchQuery, searchResults, filteredFolders, filteredNotes]);

  const handleBackToParent = () => {
    const currentFolder = currentFolderId 
      ? folders.find(f => f.id === currentFolderId)
      : null;
    
    if (currentFolder && currentFolder.parentId !== null) {
      // Go to parent folder
      setCurrentFolderId(currentFolder.parentId);
    } else {
      // Go to root (null means root level)
      setCurrentFolderId(null);
    }
  };

  return (
    <div className="flex-1 p-8 pb-20 space-y-4">
      {/* Header */}
      <div>
        {/* Breadcrumb */}
        {currentFolderId && (
          <button
            onClick={handleBackToParent}
            className="flex items-center gap-2 text-[#9ca3af] hover:text-white mb-4 transition-colors"
          >
            <HiChevronLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
        )}
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
                  // Navigate into folder instead of toggling
                  setCurrentFolderId(item.data.id);
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
                  {searchQuery.trim() !== '' && !isFolder && (item as any).meta && (
                    <div
                      className="mt-1 text-sm text-gray-300 line-clamp-1"
                      dangerouslySetInnerHTML={{ __html: (item as any).meta.snippetHtml }}
                    />
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
