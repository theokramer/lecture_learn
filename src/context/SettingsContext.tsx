import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { UserPreferences } from '../types';

interface SettingsContextType {
  preferences: UserPreferences;
  updatePreferences: (newPreferences: Partial<UserPreferences>) => void;
  getPreference: (key: keyof UserPreferences) => number;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_PREFERENCES: UserPreferences = {
  flashcardsCount: 20,
  quizCount: 15,
  exercisesCount: 10,
  summaryDetailLevel: 'comprehensive',
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
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      } catch (error) {
        console.error('Error parsing stored preferences:', error);
      }
    }
  }, []);

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
      
      return updated;
    });
  };

  const getPreference = (key: keyof UserPreferences): number => {
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

