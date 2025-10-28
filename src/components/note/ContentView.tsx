import React from 'react';
import { HiDocument } from 'react-icons/hi2';
import { useAppData } from '../../context/AppDataContext';
import { SummaryView } from './study-modes/SummaryView';
import { TranscriptView } from './study-modes/TranscriptView';
import { FeynmanView } from './study-modes/FeynmanView';
import { FlashcardsView } from './study-modes/FlashcardsView';
import { QuizView } from './study-modes/QuizView';
import { ExercisesView } from './study-modes/ExercisesView';
import { DocumentManagement } from './DocumentManagement';

export const ContentView: React.FC = () => {
  const { currentStudyMode, selectedNoteId, notes } = useAppData();
  
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
      <div className="flex-1 overflow-auto p-8 pb-12">
        {renderMode()}
      </div>
    </div>
  );
};
