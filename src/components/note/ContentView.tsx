import React, { Suspense, lazy } from 'react';
import { HiDocument } from 'react-icons/hi2';
import { useAppData } from '../../context/AppDataContext';
import { useStudySession } from '../../hooks/useStudySession';

// Lazy load all study mode components for consistency
const SummaryView = lazy(() => 
  import('./study-modes/SummaryView').then(module => ({ default: module.SummaryView }))
);
const TranscriptView = lazy(() => 
  import('./study-modes/TranscriptView').then(module => ({ default: module.TranscriptView }))
);
const FeynmanView = lazy(() => 
  import('./study-modes/FeynmanView').then(module => ({ default: module.FeynmanView }))
);
const FlashcardsView = lazy(() => 
  import('./study-modes/FlashcardsView').then(module => ({ default: module.FlashcardsView }))
);
const QuizView = lazy(() => 
  import('./study-modes/QuizView').then(module => ({ default: module.QuizView }))
);
const ExercisesView = lazy(() => 
  import('./study-modes/ExercisesView').then(module => ({ default: module.ExercisesView }))
);
const AIChatView = lazy(() => 
  import('./study-modes/AIChatView').then(module => ({ default: module.AIChatView }))
);
const DocumentManagement = lazy(() => 
  import('./DocumentManagement').then(module => ({ default: module.DocumentManagement }))
);

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
      <p className="text-[#9ca3af]">Loading study mode...</p>
    </div>
  </div>
);

export const ContentView: React.FC = () => {
  const { currentStudyMode, selectedNoteId, notes } = useAppData();
  
  // Track study session for analytics
  useStudySession(currentStudyMode);
  
  const currentNote = notes.find(n => n.id === selectedNoteId);

  const renderMode = () => {
    switch (currentStudyMode) {
      case 'summary':
        return <SummaryView />;
      case 'transcript':
        return <TranscriptView />;
      case 'feynman':
        return <FeynmanView noteContent={currentNote?.content || ''} />;
      case 'flashcards':
        return <FlashcardsView noteContent={currentNote?.content || ''} />;
      case 'quiz':
        return <QuizView noteContent={currentNote?.content || ''} />;
      case 'exercises':
        return <ExercisesView noteContent={currentNote?.content || ''} />;
      case 'documents':
        return <DocumentManagement />;
      case 'ai-chat':
        return <AIChatView />;
      default:
        return <SummaryView />;
    }
  };

  return (
    <div className="flex-1 bg-[#3a3a3a] overflow-hidden flex flex-col">
      {/* Title Bar - Hidden on mobile (shown in header) */}
      <div className="hidden lg:flex px-8 py-4 border-b border-[#4a4a4a] items-center gap-3">
        <HiDocument className="w-6 h-6 text-white" />
        <h2 className="text-xl font-semibold text-white">
          {currentNote?.title || 'Note View'}
        </h2>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-hidden ${currentStudyMode === 'ai-chat' ? 'p-0' : 'overflow-auto lg:p-8 lg:pb-12 p-4 pb-8'}`}>
        <Suspense fallback={<LoadingFallback />}>
          {renderMode()}
        </Suspense>
      </div>
    </div>
  );
};

