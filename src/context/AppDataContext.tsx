import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Folder, Note, StudyMode } from '../types';
import { folderService, noteService, storageService, documentService } from '../services/supabase';
import { useAuth } from './AuthContext';
import { handleError } from '../utils/errorHandler';
import toast from 'react-hot-toast';

interface AppDataContextType {
  folders: Folder[];
  allFolders: Folder[];
  notes: Note[];
  currentFolderId: string | null;
  selectedNoteId: string | null;
  currentStudyMode: StudyMode;
  loading: boolean;
  error: string | null;
  setCurrentFolderId: (id: string | null) => void;
  setSelectedNoteId: (id: string | null) => void;
  setCurrentStudyMode: (mode: StudyMode) => void;
  createFolder: (name: string, parentId?: string | null) => Promise<void>;
  createNote: (title: string, content?: string) => Promise<string>;
  uploadDocumentToNote: (noteId: string, file: File) => Promise<void>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  moveFolder: (id: string, newParentId: string | null) => Promise<void>;
  moveNote: (id: string, newFolderId: string | null) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
  ensureNoteLoaded: (noteId: string) => Promise<Note | null>;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export const AppDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [currentStudyMode, setCurrentStudyMode] = useState<StudyMode>('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [foldersData, allFoldersData, notesData] = await Promise.all([
        folderService.getFolders(user.id, currentFolderId),
        folderService.getAllFolders(user.id),
        noteService.getNotes(user.id, currentFolderId),
      ]);

      setFolders(foldersData);
      setAllFolders(allFoldersData);
      setNotes(notesData);
      setError(null);
    } catch (err) {
      handleError(err, 'AppDataContext: Loading data', toast.error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [user, currentFolderId]);

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user, currentFolderId, loadData]);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Memoize functions to prevent unnecessary re-renders
  const createFolder = useCallback(async (name: string, parentId: string | null = null) => {
    if (!user) return;
    try {
      await folderService.createFolder(user.id, name, parentId);
      await loadData();
    } catch (err) {
      handleError(err, 'AppDataContext: Creating folder', toast.error);
      setError('Failed to create folder');
      throw err;
    }
  }, [user, loadData]);

  const createNote = useCallback(async (title: string, content: string = ''): Promise<string> => {
    if (!user) throw new Error('User not authenticated');
    try {
      const newNote = await noteService.createNote(user.id, title, currentFolderId, content);
      // Add the note to the list immediately if it's in the current folder context
      // This handles the case where the note is created but loadData hasn't finished yet
      const isInCurrentFolder = (newNote.folderId === null && currentFolderId === null) || 
                                 (newNote.folderId === currentFolderId);
      if (isInCurrentFolder) {
        setNotes(prev => [newNote, ...prev]);
      }
      await loadData();
      return newNote.id;
    } catch (err) {
      handleError(err, 'AppDataContext: Creating note', toast.error);
      setError('Failed to create note');
      throw err;
    }
  }, [user, currentFolderId, loadData]);

  // Fetch a note by ID and add it to the notes list if not already present
  const ensureNoteLoaded = useCallback(async (noteId: string): Promise<Note | null> => {
    if (!user) return null;
    
    // Check if note is already in the list
    const existingNote = notes.find(n => n.id === noteId);
    if (existingNote) {
      return existingNote;
    }
    
    // Fetch the note from the database
    try {
      const note = await noteService.getNoteById(noteId, user.id);
      if (note) {
        // Add to notes list so it's available for rendering
        setNotes(prev => {
          // Check if it's already there (race condition)
          if (prev.find(n => n.id === noteId)) return prev;
          return [note, ...prev];
        });
      }
      return note;
    } catch (err) {
      handleError(err, 'AppDataContext: Fetching note', toast.error);
      return null;
    }
  }, [user, notes]);

  const uploadDocumentToNote = useCallback(async (noteId: string, file: File): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    try {
      const storagePath = await storageService.uploadFile(user.id, file);
      await documentService.createDocument(noteId, file, storagePath);
      try {
        const { documentProcessor } = await import('../services/documentProcessor');
        const { openaiService } = await import('../services/openai');
        let extractedContent = '';
        const fileForProcessing = file;
        if (documentProcessor.isAudioFile(fileForProcessing.type)) {
          const blob = new Blob([fileForProcessing], { type: fileForProcessing.type });
          const transcription = await openaiService.transcribeAudio(blob);
          extractedContent = `\n\n--- Document: ${fileForProcessing.name} ---\n${transcription}`;
        } else if (documentProcessor.isVideoFile(fileForProcessing.type)) {
          const audioBlob = await documentProcessor.extractAudioFromVideo(fileForProcessing);
          const transcription = await openaiService.transcribeAudio(audioBlob);
          extractedContent = `\n\n--- Document: ${fileForProcessing.name} ---\n${transcription}`;
        } else {
          const { text } = await documentProcessor.processDocument(fileForProcessing);
          extractedContent = `\n\n--- Document: ${fileForProcessing.name} ---\n${text}`;
        }
        const currentNote = notes.find(n => n.id === noteId);
        if (currentNote) {
          const updatedContent = currentNote.content + extractedContent;
          await noteService.updateNote(noteId, { content: updatedContent });
        }
      } catch (contentError) {
        handleError(contentError, 'AppDataContext: Extracting document content', toast.error);
      }
      await loadData();
    } catch (err) {
      handleError(err, 'AppDataContext: Uploading document', toast.error);
      setError('Failed to upload document');
      throw err;
    }
  }, [user, notes, loadData]);

  const updateNote = useCallback(async (id: string, updates: Partial<Note>) => {
    try {
      await noteService.updateNote(id, updates);
      await loadData();
    } catch (err) {
      handleError(err, 'AppDataContext: Updating note', toast.error);
      setError('Failed to update note');
    }
  }, [loadData]);

  const moveFolder = useCallback(async (id: string, newParentId: string | null) => {
    try {
      await folderService.moveFolder(id, newParentId);
      await loadData();
    } catch (err) {
      handleError(err, 'AppDataContext: Moving folder', toast.error);
      setError('Failed to move folder');
      throw err;
    }
  }, [loadData]);

  const moveNote = useCallback(async (id: string, newFolderId: string | null) => {
    try {
      await noteService.updateNote(id, { folderId: newFolderId });
      await loadData();
    } catch (err) {
      handleError(err, 'AppDataContext: Moving note', toast.error);
      setError('Failed to move note');
      throw err;
    }
  }, [loadData]);

  const deleteFolder = useCallback(async (id: string) => {
    try {
      await folderService.deleteFolder(id);
      if (currentFolderId === id) {
        const folder = allFolders.find(f => f.id === id);
        setCurrentFolderId(folder?.parentId || null);
      }
      await loadData();
    } catch (err) {
      handleError(err, 'AppDataContext: Deleting folder', toast.error);
      setError('Failed to delete folder');
      throw err;
    }
  }, [currentFolderId, allFolders, loadData]);

  const deleteNote = useCallback(async (id: string) => {
    try {
      await noteService.deleteNote(id);
      await loadData();
      if (selectedNoteId === id) {
        setSelectedNoteId(null);
      }
    } catch (err) {
      handleError(err, 'AppDataContext: Deleting note', toast.error);
      setError('Failed to delete note');
      throw err;
    }
  }, [selectedNoteId, loadData]);

  const contextValue = useMemo(
    () => ({
      folders,
      allFolders,
      notes,
      currentFolderId,
      selectedNoteId,
      currentStudyMode,
      loading,
      error,
      setCurrentFolderId,
      setSelectedNoteId,
      setCurrentStudyMode,
      createFolder,
      createNote,
      uploadDocumentToNote,
      updateNote,
      moveFolder,
      moveNote,
      deleteFolder,
      deleteNote,
      refreshData,
      ensureNoteLoaded,
    }),
    [
      folders,
      allFolders,
      notes,
      currentFolderId,
      selectedNoteId,
      currentStudyMode,
      loading,
      error,
      createFolder,
      createNote,
      uploadDocumentToNote,
      updateNote,
      moveFolder,
      moveNote,
      deleteFolder,
      deleteNote,
      refreshData,
      ensureNoteLoaded,
    ]
  );

  return (
    <AppDataContext.Provider value={contextValue}>
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return context;
};
