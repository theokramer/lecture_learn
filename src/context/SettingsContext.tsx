import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { UserPreferences, StudyMode } from '../types';
import { applyAccentColor, applyFontSize, applyEditorFont } from '../utils/themeUtils';

interface SettingsContextType {
  preferences: UserPreferences;
  updatePreferences: (newPreferences: Partial<UserPreferences>) => void;
  getPreference: (key: 'flashcardsCount' | 'quizCount' | 'exercisesCount') => number;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_PREFERENCES: UserPreferences = {
  flashcardsCount: 20,
  quizCount: 15,
  exercisesCount: 10,
  summaryDetailLevel: 'comprehensive',
  theme: 'dark',
  accentColor: '#b85a3a',
  fontSize: 1.0,
  editorFont: 'default',
  noteListDensity: 'detailed',
  defaultStudyMode: 'summary',
  autoSaveInterval: 2000,
  notificationsEnabled: false,
  language: 'en',
  aiModel: '',
};

const MIN_VALUES = {
  flashcardsCount: 3,
  quizCount: 3,
  exercisesCount: 3,
};

const MAX_VALUES = {
  flashcardsCount: 30,
  quizCount: 30,
  exercisesCount: 30,
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('user-preferences');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as UserPreferences;
        const loadedPreferences = { ...DEFAULT_PREFERENCES, ...parsed };
        setPreferences(loadedPreferences);
        
        // Apply theme immediately on load
        const theme = loadedPreferences.theme || 'dark';
        if (theme === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          document.documentElement.classList.add('dark');
        }
      } catch (error) {
        console.error('Error parsing stored preferences:', error);
        // Apply default theme on error
        document.documentElement.classList.add('dark');
      }
    } else {
      // No stored preferences, apply default dark theme
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Apply theme to document when preferences change
  useEffect(() => {
    const theme = preferences.theme || 'dark';
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [preferences.theme]);

  // Apply accent color
  useEffect(() => {
    const accentColor = preferences.accentColor || DEFAULT_PREFERENCES.accentColor;
    if (accentColor) {
      applyAccentColor(accentColor);
    }
  }, [preferences.accentColor]);

  // Apply font size
  useEffect(() => {
    const fontSize = preferences.fontSize ?? DEFAULT_PREFERENCES.fontSize ?? 1.0;
    applyFontSize(fontSize);
  }, [preferences.fontSize]);

  // Apply editor font
  useEffect(() => {
    const editorFont = preferences.editorFont || DEFAULT_PREFERENCES.editorFont || 'default';
    applyEditorFont(editorFont);
  }, [preferences.editorFont]);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('user-preferences', JSON.stringify(preferences));
  }, [preferences]);

  const updatePreferences = (newPreferences: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev };
      
      // Validate and update each preference
      if (newPreferences.flashcardsCount !== undefined) {
        updated.flashcardsCount = Math.min(
          MAX_VALUES.flashcardsCount,
          Math.max(MIN_VALUES.flashcardsCount, newPreferences.flashcardsCount)
        );
      }
      
      if (newPreferences.quizCount !== undefined) {
        updated.quizCount = Math.min(
          MAX_VALUES.quizCount,
          Math.max(MIN_VALUES.quizCount, newPreferences.quizCount)
        );
      }
      
      if (newPreferences.exercisesCount !== undefined) {
        updated.exercisesCount = Math.min(
          MAX_VALUES.exercisesCount,
          Math.max(MIN_VALUES.exercisesCount, newPreferences.exercisesCount)
        );
      }

      if (newPreferences.summaryDetailLevel !== undefined) {
        const allowed = ['concise', 'standard', 'comprehensive'] as const;
        updated.summaryDetailLevel = allowed.includes(newPreferences.summaryDetailLevel as any)
          ? newPreferences.summaryDetailLevel
          : prev.summaryDetailLevel || 'standard';
      }

      if (newPreferences.theme !== undefined) {
        const allowed = ['light', 'dark'] as const;
        updated.theme = allowed.includes(newPreferences.theme as any)
          ? newPreferences.theme
          : prev.theme || 'dark';
      }

      if (newPreferences.accentColor !== undefined) {
        // Validate hex color format
        const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (hexPattern.test(newPreferences.accentColor)) {
          updated.accentColor = newPreferences.accentColor;
        }
      }

      if (newPreferences.fontSize !== undefined) {
        updated.fontSize = Math.min(2.0, Math.max(0.75, newPreferences.fontSize));
      }

      if (newPreferences.editorFont !== undefined) {
        const allowed = ['default', 'monospace'] as const;
        updated.editorFont = allowed.includes(newPreferences.editorFont as any)
          ? newPreferences.editorFont
          : prev.editorFont || 'default';
      }

      if (newPreferences.noteListDensity !== undefined) {
        const allowed = ['compact', 'detailed'] as const;
        updated.noteListDensity = allowed.includes(newPreferences.noteListDensity as any)
          ? newPreferences.noteListDensity
          : prev.noteListDensity || 'detailed';
      }

      if (newPreferences.defaultStudyMode !== undefined) {
        const allowed: StudyMode[] = ['summary', 'transcript', 'feynman', 'flashcards', 'quiz', 'exercises', 'documents', 'ai-chat'];
        updated.defaultStudyMode = allowed.includes(newPreferences.defaultStudyMode)
          ? newPreferences.defaultStudyMode
          : prev.defaultStudyMode || 'summary';
      }

      if (newPreferences.autoSaveInterval !== undefined) {
        updated.autoSaveInterval = Math.min(60000, Math.max(1000, newPreferences.autoSaveInterval));
      }

      if (newPreferences.notificationsEnabled !== undefined) {
        updated.notificationsEnabled = Boolean(newPreferences.notificationsEnabled);
      }

      if (newPreferences.language !== undefined) {
        updated.language = newPreferences.language || 'en';
      }

      if (newPreferences.aiModel !== undefined) {
        updated.aiModel = newPreferences.aiModel || '';
      }
      
      return updated;
    });
  };

  const getPreference = (key: 'flashcardsCount' | 'quizCount' | 'exercisesCount'): number => {
    return preferences[key];
  };

  return (
    <SettingsContext.Provider value={{ preferences, updatePreferences, getPreference }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

