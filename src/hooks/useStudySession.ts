import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { analyticsService } from '../services/analyticsService';
import { useAppData } from '../context/AppDataContext';

export const useStudySession = (studyMode: string) => {
  const { user } = useAuth();
  const { selectedNoteId, notes } = useAppData();
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // Start tracking session
  useEffect(() => {
    if (!user || !studyMode) return;

    // Get folder ID from current note
    const getFolderId = (): string | null => {
      if (!selectedNoteId) return null;
      const note = notes.find((n) => n.id === selectedNoteId);
      return note?.folderId || null;
    };

    const startSession = async () => {
      try {
        const session = await analyticsService.startStudySession(
          user.id,
          selectedNoteId || null,
          getFolderId(),
          studyMode
        );
        sessionIdRef.current = session.id;
        startTimeRef.current = new Date();
      } catch (error) {
        console.error('Error starting study session:', error);
      }
    };

    startSession();

    // Cleanup: end session when component unmounts or mode changes
    return () => {
      if (sessionIdRef.current) {
        analyticsService.endStudySession(sessionIdRef.current).catch((error) => {
          console.error('Error ending study session:', error);
        });
        sessionIdRef.current = null;
      }
    };
  }, [user, studyMode, selectedNoteId, notes]); // Re-start when mode or note changes

  return {
    sessionId: sessionIdRef.current,
    startTime: startTimeRef.current,
  };
};

