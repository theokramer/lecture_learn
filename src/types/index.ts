export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  documents: Document[];
  folderId: string | null;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: Date;
}

export type DocumentType = 'audio' | 'video' | 'pdf' | 'doc' | 'text';

export interface Document {
  id: string;
  name: string;
  type: DocumentType;
  url: string;
  size: number;
  uploadedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface UserPreferences {
  flashcardsCount: number;
  quizCount: number;
  exercisesCount: number;
  summaryDetailLevel?: 'concise' | 'standard' | 'comprehensive';
  theme?: 'light' | 'dark';
  accentColor?: string;
  fontSize?: number;
  editorFont?: 'default' | 'monospace';
  noteListDensity?: 'compact' | 'detailed';
  defaultStudyMode?: StudyMode;
  autoSaveInterval?: number;
  notificationsEnabled?: boolean;
  language?: string;
  aiModel?: string;
}

export type StudyMode = 'summary' | 'transcript' | 'feynman' | 'flashcards' | 'quiz' | 'exercises' | 'documents' | 'ai-chat';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  userAnswer?: number;
}

export interface Exercise {
  id: string;
  question: string;
  answer?: string;
  userAnswer?: string;
  solution?: string;
}
