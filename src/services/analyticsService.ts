import { supabase } from './supabase';

export type StudySession = {
  id: string;
  userId: string;
  noteId: string | null;
  folderId: string | null;
  studyMode: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
  createdAt: Date;
};

export type QuizResult = {
  id: string;
  userId: string;
  noteId: string | null;
  quizSessionId: string | null;
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage: number;
  timeTakenSeconds: number | null;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
};

export type StudyAnalytics = {
  totalStudyTime: number; // in minutes
  studyTimeByMode: Record<string, number>;
  studyTimeByFolder: Record<string, { name: string; time: number }>;
  quizPerformance: {
    averageScore: number;
    totalQuizzes: number;
    scoresOverTime: Array<{ date: string; score: number }>;
  };
  flashcardMastery: {
    totalCards: number;
    masteredCards: number;
    masteryRate: number;
  };
  mostStudiedTopics: Array<{ noteId: string; title: string; studyCount: number }>;
  weeklyHeatmap: Array<{ date: string; minutes: number }>;
};

export const analyticsService = {
  // Start a study session
  async startStudySession(
    userId: string,
    noteId: string | null,
    folderId: string | null,
    studyMode: string
  ): Promise<StudySession> {
    const { data, error } = await supabase
      .from('study_sessions')
      .insert({
        user_id: userId,
        note_id: noteId,
        folder_id: folderId,
        study_mode: studyMode,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      noteId: data.note_id,
      folderId: data.folder_id,
      studyMode: data.study_mode,
      startedAt: new Date(data.started_at),
      endedAt: data.ended_at ? new Date(data.ended_at) : null,
      durationSeconds: data.duration_seconds,
      createdAt: new Date(data.created_at),
    };
  },

  // End a study session
  async endStudySession(sessionId: string): Promise<void> {
    const session = await this.getStudySession(sessionId);
    if (!session) throw new Error('Session not found');

    const startedAt = new Date(session.startedAt);
    const endedAt = new Date();
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

    const { error } = await supabase
      .from('study_sessions')
      .update({
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq('id', sessionId);

    if (error) throw error;
  },

  // Get a specific study session
  async getStudySession(sessionId: string): Promise<StudySession | null> {
    const { data, error } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return {
      id: data.id,
      userId: data.user_id,
      noteId: data.note_id,
      folderId: data.folder_id,
      studyMode: data.study_mode,
      startedAt: new Date(data.started_at),
      endedAt: data.ended_at ? new Date(data.ended_at) : null,
      durationSeconds: data.duration_seconds,
      createdAt: new Date(data.created_at),
    };
  },

  // Save quiz result
  async saveQuizResult(
    userId: string,
    noteId: string | null,
    totalQuestions: number,
    correctAnswers: number,
    timeTakenSeconds?: number
  ): Promise<QuizResult> {
    const scorePercentage = (correctAnswers / totalQuestions) * 100;

    const { data, error } = await supabase
      .from('quiz_results')
      .insert({
        user_id: userId,
        note_id: noteId,
        total_questions: totalQuestions,
        correct_answers: correctAnswers,
        score_percentage: scorePercentage,
        time_taken_seconds: timeTakenSeconds || null,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      noteId: data.note_id,
      quizSessionId: data.quiz_session_id,
      totalQuestions: data.total_questions,
      correctAnswers: data.correct_answers,
      scorePercentage: data.score_percentage,
      timeTakenSeconds: data.time_taken_seconds,
      startedAt: new Date(data.started_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : null,
      createdAt: new Date(data.created_at),
    };
  },

  // Get comprehensive analytics
  async getStudyAnalytics(userId: string, days: number = 30): Promise<StudyAnalytics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all study sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', startDate.toISOString())
      .not('duration_seconds', 'is', null);

    if (sessionsError) throw sessionsError;

    // Get all quiz results
    const { data: quizResults, error: quizError } = await supabase
      .from('quiz_results')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', startDate.toISOString());

    if (quizError) throw quizError;

    // Calculate total study time
    const totalStudyTimeMinutes = (sessions || []).reduce((sum, session) => {
      return sum + (session.duration_seconds || 0) / 60;
    }, 0);

    // Study time by mode
    const studyTimeByMode: Record<string, number> = {};
    (sessions || []).forEach((session) => {
      const minutes = (session.duration_seconds || 0) / 60;
      studyTimeByMode[session.study_mode] = (studyTimeByMode[session.study_mode] || 0) + minutes;
    });

    // Study time by folder
    const studyTimeByFolder: Record<string, { name: string; time: number }> = {};
    const { data: folders } = await supabase
      .from('folders')
      .select('id, name')
      .eq('user_id', userId);

    const folderMap = new Map((folders || []).map((f) => [f.id, f.name]));

    (sessions || []).forEach((session) => {
      if (session.folder_id) {
        const folderName = folderMap.get(session.folder_id) || 'Unknown';
        const minutes = (session.duration_seconds || 0) / 60;
        studyTimeByFolder[session.folder_id] = {
          name: folderName,
          time: (studyTimeByFolder[session.folder_id]?.time || 0) + minutes,
        };
      }
    });

    // Quiz performance
    const quizResultsData = (quizResults || []) as any[];
    const averageScore =
      quizResultsData.length > 0
        ? quizResultsData.reduce((sum, r) => sum + r.score_percentage, 0) / quizResultsData.length
        : 0;

    // Quiz scores over time (grouped by date)
    const scoresByDate = new Map<string, number[]>();
    quizResultsData.forEach((result) => {
      const date = new Date(result.started_at).toISOString().split('T')[0];
      if (!scoresByDate.has(date)) {
        scoresByDate.set(date, []);
      }
      scoresByDate.get(date)!.push(result.score_percentage);
    });

    const scoresOverTime = Array.from(scoresByDate.entries())
      .map(([date, scores]) => ({
        date,
        score: scores.reduce((sum, s) => sum + s, 0) / scores.length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Most studied topics
    const noteStudyCount = new Map<string, number>();
    (sessions || []).forEach((session) => {
      if (session.note_id) {
        noteStudyCount.set(
          session.note_id,
          (noteStudyCount.get(session.note_id) || 0) + 1
        );
      }
    });

    const { data: notes } = await supabase
      .from('notes')
      .select('id, title')
      .eq('user_id', userId)
      .in('id', Array.from(noteStudyCount.keys()));

    const noteMap = new Map((notes || []).map((n) => [n.id, n.title]));
    const mostStudiedTopics = Array.from(noteStudyCount.entries())
      .map(([noteId, count]) => ({
        noteId,
        title: noteMap.get(noteId) || 'Unknown',
        studyCount: count,
      }))
      .sort((a, b) => b.studyCount - a.studyCount)
      .slice(0, 10);

    // Weekly heatmap data
    const weeklyHeatmap = new Map<string, number>();
    (sessions || []).forEach((session) => {
      const date = new Date(session.started_at).toISOString().split('T')[0];
      const minutes = (session.duration_seconds || 0) / 60;
      weeklyHeatmap.set(date, (weeklyHeatmap.get(date) || 0) + minutes);
    });

    const heatmapArray = Array.from(weeklyHeatmap.entries()).map(([date, minutes]) => ({
      date,
      minutes,
    }));

    return {
      totalStudyTime: totalStudyTimeMinutes,
      studyTimeByMode,
      studyTimeByFolder,
      quizPerformance: {
        averageScore,
        totalQuizzes: quizResultsData.length,
        scoresOverTime,
      },
      flashcardMastery: {
        totalCards: 0, // Will be calculated from study_content
        masteredCards: 0, // Will be calculated from spaced repetition data
        masteryRate: 0,
      },
      mostStudiedTopics,
      weeklyHeatmap: heatmapArray,
    };
  },
};

