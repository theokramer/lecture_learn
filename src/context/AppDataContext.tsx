import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Folder, Note, StudyMode } from '../types';
import { folderService, noteService, storageService, documentService } from '../services/supabase';
import { useAuth } from './AuthContext';

interface AppDataContextType {
  folders: Folder[];
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
  deleteFolder: (id: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export const AppDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [currentStudyMode, setCurrentStudyMode] = useState<StudyMode>('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [foldersData, notesData] = await Promise.all([
        folderService.getFolders(user.id, currentFolderId),
        noteService.getNotes(user.id, currentFolderId),
      ]);

      setFolders(foldersData);
      setNotes(notesData);
      setError(null);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, currentFolderId]);

  const createFolder = async (name: string, parentId: string | null = null) => {
    if (!user) return;

    try {
      await folderService.createFolder(user.id, name, parentId);
      await loadData();
    } catch (err) {
      console.error('Error creating folder:', err);
      setError('Failed to create folder');
    }
  };

  const createNote = async (title: string, content: string = ''): Promise<string> => {
    if (!user) throw new Error('User not authenticated');

    try {
      const newNote = await noteService.createNote(user.id, title, currentFolderId, content);
      await loadData();
      return newNote.id;
    } catch (err) {
      console.error('Error creating note:', err);
      setError('Failed to create note');
      throw err;
    }
  };

  const uploadDocumentToNote = async (noteId: string, file: File): Promise<void> => {
    if (!user) throw new Error('User not authenticated');

    try {
      // Upload file to storage first
      const storagePath = await storageService.uploadFile(user.id, file);
      
      // Create document record
      await documentService.createDocument(noteId, file, storagePath);
      
      // Extract content from document and append to note
      try {
        const { documentProcessor } = await import('../services/documentProcessor');
        const { openaiService } = await import('../services/openai');
        
        let extractedContent = '';
        
        // Re-read the file as a fresh File object for processing
        const fileForProcessing = file;
        
        if (documentProcessor.isAudioFile(fileForProcessing.type)) {
          // Transcribe audio
          const blob = new Blob([fileForProcessing], { type: fileForProcessing.type });
          const transcription = await openaiService.transcribeAudio(blob);
          extractedContent = `\n\n--- Document: ${fileForProcessing.name} ---\n${transcription}`;
        } else if (documentProcessor.isVideoFile(fileForProcessing.type)) {
          // Extract audio from video and transcribe
          const audioBlob = await documentProcessor.extractAudioFromVideo(fileForProcessing);
          const transcription = await openaiService.transcribeAudio(audioBlob);
          extractedContent = `\n\n--- Document: ${fileForProcessing.name} ---\n${transcription}`;
        } else {
          // Extract text from document (PDF, DOC, TXT, etc.)
          const { text } = await documentProcessor.processDocument(fileForProcessing);
          extractedContent = `\n\n--- Document: ${fileForProcessing.name} ---\n${text}`;
        }
        
        // Update note with extracted content
        const currentNote = notes.find(n => n.id === noteId);
        if (currentNote) {
          const updatedContent = currentNote.content + extractedContent;
          await noteService.updateNote(noteId, { content: updatedContent });
        }
      } catch (contentError) {
        console.error('Error extracting document content:', contentError);
        // Don't fail the upload if content extraction fails
      }
      
      // Refresh data to update documents list
      await loadData();
    } catch (err) {
      console.error('Error uploading document:', err);
      setError('Failed to upload document');
      throw err;
    }
  };

  const updateNote = async (id: string, updates: Partial<Note>) => {
    try {
      await noteService.updateNote(id, updates);
      await loadData();
    } catch (err) {
      console.error('Error updating note:', err);
      setError('Failed to update note');
    }
  };

  const deleteFolder = async (id: string) => {
    try {
      await folderService.deleteFolder(id);
      await loadData();
    } catch (err) {
      console.error('Error deleting folder:', err);
      setError('Failed to delete folder');
    }
  };

  const deleteNote = async (id: string) => {
    try {
      await noteService.deleteNote(id);
      await loadData();
      if (selectedNoteId === id) {
        setSelectedNoteId(null);
      }
    } catch (err) {
      console.error('Error deleting note:', err);
      setError('Failed to delete note');
    }
  };

  const refreshData = async () => {
    await loadData();
  };

  return (
    <AppDataContext.Provider
      value={{
        folders,
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
        deleteFolder,
        deleteNote,
        refreshData,
      }}
    >
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
