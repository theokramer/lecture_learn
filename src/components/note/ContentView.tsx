import React from 'react';
import { HiDocument } from 'react-icons/hi2';
import { useAppData } from '../../context/AppDataContext';
import { SummaryView } from './study-modes/SummaryView';
import { FeynmanView } from './study-modes/FeynmanView';
import { FlashcardsView } from './study-modes/FlashcardsView';
import { QuizView } from './study-modes/QuizView';
import { ExercisesView } from './study-modes/ExercisesView';

export const ContentView: React.FC = () => {
  const { currentStudyMode, selectedNoteId, notes } = useAppData();
  
  const currentNote = notes.find(n => n.id === selectedNoteId);

  const renderMode = () => {
    switch (currentStudyMode) {
      case 'summary':
        return <SummaryView />;
      case 'feynman':
        return <FeynmanView />;
      case 'flashcards':
        return <FlashcardsView />;
      case 'quiz':
        return <QuizView />;
      case 'exercises':
        return <ExercisesView />;
      default:
        return <SummaryView />;
    }
  };

  return (
    <div className="flex-1 bg-[#3a3a3a] overflow-hidden flex flex-col">
      {/* Title Bar */}
      <div className="px-8 py-4 border-b border-[#4a4a4a] flex items-center gap-3">
        <HiDocument className="w-6 h-6 text-white" />
        <h2 className="text-xl font-semibold text-white">
          {currentNote?.title || 'Note View'}
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {renderMode()}
      </div>
    </div>
  );
};
