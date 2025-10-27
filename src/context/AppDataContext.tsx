import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { Folder, Note, StudyMode } from '../types';

interface AppDataContextType {
  folders: Folder[];
  notes: Note[];
  currentFolderId: string | null;
  selectedNoteId: string | null;
  currentStudyMode: StudyMode;
  setCurrentFolderId: (id: string | null) => void;
  setSelectedNoteId: (id: string | null) => void;
  setCurrentStudyMode: (mode: StudyMode) => void;
  createFolder: (name: string, parentId?: string | null) => void;
  createNote: (title: string) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteFolder: (id: string) => void;
  deleteNote: (id: string) => void;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export const AppDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [folders, setFolders] = useState<Folder[]>([
    {
      id: 'folder-1',
      name: 'My Notes',
      parentId: null,
      createdAt: new Date('2024-10-01'),
    },
  ]);
  
  const [notes, setNotes] = useState<Note[]>([
    {
      id: 'note-1',
      title: 'Vorlesungsübersicht und Ziele',
      createdAt: new Date('2024-10-14'),
      documents: [],
      folderId: 'folder-1',
    },
    {
      id: 'note-2',
      title: "Welcome! Here's how to get the most out of this app",
      createdAt: new Date('2024-10-14'),
      documents: [],
      folderId: null,
    },
  ]);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [currentStudyMode, setCurrentStudyMode] = useState<StudyMode>('summary');

  const createFolder = (name: string, parentId: string | null = null) => {
    const newFolder: Folder = {
      id: `folder-${Date.now()}`,
      name,
      parentId,
      createdAt: new Date(),
    };
    setFolders([...folders, newFolder]);
  };

  const createNote = (title: string) => {
    const newNote: Note = {
      id: `note-${Date.now()}`,
      title,
      createdAt: new Date(),
      documents: [],
      folderId: currentFolderId,
    };
    setNotes([...notes, newNote]);
  };

  const updateNote = (id: string, updates: Partial<Note>) => {
    setNotes(notes.map(note => (note.id === id ? { ...note, ...updates } : note)));
  };

  const deleteFolder = (id: string) => {
    // Delete folder and move child folders to parent
    setFolders(folders.filter(f => f.id !== id).map(f => 
      f.parentId === id ? { ...f, parentId: null } : f
    ));
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
    if (selectedNoteId === id) {
      setSelectedNoteId(null);
    }
  };

  return (
    <AppDataContext.Provider
      value={{
        folders,
        notes,
        currentFolderId,
        selectedNoteId,
        currentStudyMode,
        setCurrentFolderId,
        setSelectedNoteId,
        setCurrentStudyMode,
        createFolder,
        createNote,
        updateNote,
        deleteFolder,
        deleteNote,
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
