import React from 'react';
import { useAppData } from '../../../context/AppDataContext';

export const TranscriptView: React.FC = () => {
  const { selectedNoteId, notes } = useAppData();
  const currentNote = notes.find(n => n.id === selectedNoteId);

  if (!currentNote || !currentNote.content) {
    return (
      <div className="space-y-6">
        <div className="prose prose-invert max-w-none">
          <p className="text-white text-base leading-relaxed">
            This note is empty. Start by recording a voice note or uploading a document.
          </p>
        </div>
      </div>
    );
  }

  // Split content by paragraphs
  const paragraphs = currentNote.content.split('\n').filter(p => p.trim());

  return (
    <div className="space-y-6 pb-12">
      <div className="prose prose-invert max-w-none">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="text-white text-base leading-relaxed mb-4">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
};

