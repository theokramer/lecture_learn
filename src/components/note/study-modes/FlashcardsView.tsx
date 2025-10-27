import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HiPlus, HiPencil, HiTrash, HiCheck } from 'react-icons/hi2';

interface Flashcard {
  id: string;
  front: string;
  back: string;
}

type View = 'management' | 'learning' | 'results';

interface StudyResult {
  correct: number;
  incorrect: number;
  total: number;
}

export const FlashcardsView: React.FC = () => {
  const [view, setView] = useState<View>('management');
  const [flashcards, setFlashcards] = useState<Flashcard[]>([
    { id: '1', front: 'What is React?', back: 'A JavaScript library for building user interfaces, especially web applications.' },
    { id: '2', front: 'What is JSX?', back: 'JavaScript XML - a syntax extension that allows writing HTML-like code in JavaScript.' },
    { id: '3', front: 'What are hooks?', back: 'Functions that let you "hook into" React state and lifecycle features from functional components.' },
  ]);
  
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answers, setAnswers] = useState<{ cardId: string; correct: boolean }[]>([]);
  const [results, setResults] = useState<StudyResult | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState({ front: '', back: '' });
  const [editingCard, setEditingCard] = useState<string | null>(null);

  const handleStartLearning = () => {
    if (flashcards.length === 0) return;
    setCurrentCard(0);
    setFlipped(false);
    setAnswers([]);
    setView('learning');
  };

  const handleSwipe = (direction: 'left' | 'right') => {
    const isCorrect = direction === 'right';
    const cardId = flashcards[currentCard].id;
    setAnswers([...answers, { cardId, correct: isCorrect }]);
    
    if (currentCard < flashcards.length - 1) {
      setFlipped(false);
      setCurrentCard(currentCard + 1);
    } else {
      // Finished - show results
      const correct = answers.filter(a => a.correct).length + (isCorrect ? 1 : 0);
      const total = answers.length + 1;
      setResults({
        correct,
        incorrect: total - correct,
        total,
      });
      setView('results');
    }
  };

  const handleAddCard = () => {
    if (newCard.front.trim() && newCard.back.trim()) {
      const card: Flashcard = {
        id: Date.now().toString(),
        front: newCard.front,
        back: newCard.back,
      };
      setFlashcards([...flashcards, card]);
      setNewCard({ front: '', back: '' });
      setShowAddCard(false);
    }
  };

  const handleDeleteCard = (id: string) => {
    setFlashcards(flashcards.filter(c => c.id !== id));
  };

  if (view === 'management') {
    return (
      <div className="h-full overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Flashcards</h2>
              <p className="text-[#9ca3af]">Manage your flashcards and start learning</p>
            </div>
            {flashcards.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartLearning}
                className="px-6 py-3 bg-[#b85a3a] rounded-lg text-white font-medium hover:bg-[#a04a2a] transition-colors flex items-center gap-2"
              >
                <HiCheck className="w-5 h-5" />
                Start Learning
              </motion.button>
            )}
          </div>

          {/* Add Card Form */}
          {showAddCard && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-6 bg-[#2a2a2a] rounded-lg border border-[#3a3a3a]"
            >
              <h3 className="text-xl font-semibold text-white mb-4">Add New Flashcard</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#9ca3af] mb-2">Front</label>
                  <textarea
                    value={newCard.front}
                    onChange={(e) => setNewCard({ ...newCard, front: e.target.value })}
                    placeholder="Question or term..."
                    className="w-full p-3 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white placeholder:text-[#6b7280] focus:outline-none focus:border-[#b85a3a] resize-none"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#9ca3af] mb-2">Back</label>
                  <textarea
                    value={newCard.back}
                    onChange={(e) => setNewCard({ ...newCard, back: e.target.value })}
                    placeholder="Answer or definition..."
                    className="w-full p-3 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white placeholder:text-[#6b7280] focus:outline-none focus:border-[#b85a3a] resize-none"
                    rows={3}
                  />
                </div>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAddCard}
                    className="px-6 py-3 bg-[#b85a3a] rounded-lg text-white font-medium hover:bg-[#a04a2a] transition-colors"
                  >
                    Add Card
                  </motion.button>
                  <button
                    onClick={() => setShowAddCard(false)}
                    className="px-6 py-3 bg-[#3a3a3a] rounded-lg text-white font-medium hover:bg-[#4a4a4a] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Cards List */}
          <div className="space-y-3">
            {!showAddCard && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAddCard(true)}
                className="w-full p-4 bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] border-dashed hover:border-[#b85a3a] transition-all flex items-center justify-center gap-2 text-[#9ca3af]"
              >
                <HiPlus className="w-5 h-5" />
                <span>Add Flashcard</span>
              </motion.button>
            )}

            {flashcards.map((card) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] hover:border-[#b85a3a] transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-white font-medium mb-2">Q: {card.front}</p>
                    <p className="text-[#9ca3af]">A: {card.back}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingCard(card.id)}
                      className="p-2 hover:bg-[#3a3a3a] rounded-lg transition-colors"
                    >
                      <HiPencil className="w-5 h-5 text-[#9ca3af]" />
                    </button>
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      className="p-2 hover:bg-[#3a3a3a] rounded-lg transition-colors"
                    >
                      <HiTrash className="w-5 h-5 text-[#ef4444]" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'learning') {
    const card = flashcards[currentCard];
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-2xl">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between text-sm text-[#9ca3af] mb-2">
              <span>Card {currentCard + 1} of {flashcards.length}</span>
              <span>{Math.round(((currentCard + 1) / flashcards.length) * 100)}%</span>
            </div>
            <div className="w-full bg-[#2a2a2a] rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((currentCard + 1) / flashcards.length) * 100}%` }}
                className="h-2 bg-[#b85a3a] rounded-full transition-all"
              />
            </div>
          </div>

          {/* Flashcard */}
          <motion.div
            onClick={() => setFlipped(!flipped)}
            style={{ perspective: '1000px' }}
            className="w-full h-96 mb-8 cursor-pointer"
          >
            <motion.div
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.6 }}
              style={{ transformStyle: 'preserve-3d' }}
              className="relative w-full h-full"
            >
              <div
                className={`absolute inset-0 ${
                  flipped ? 'hidden' : 'block'
                }`}
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div className="w-full h-full bg-[#2a2a2a] rounded-lg p-8 flex items-center justify-center border border-[#3a3a3a]">
                  <p className="text-white text-2xl font-medium text-center">
                    {card.front}
                  </p>
                </div>
              </div>

              <div
                className={`absolute inset-0 ${
                  flipped ? 'block' : 'hidden'
                }`}
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <div className="w-full h-full bg-[#1a1a1a] rounded-lg p-8 flex items-center justify-center border border-[#b85a3a]">
                  <p className="text-white text-xl leading-relaxed text-center">
                    {card.back}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Swipe Buttons */}
          {flipped && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSwipe('left')}
                className="flex-1 px-6 py-4 bg-[#ef4444] rounded-lg text-white font-medium hover:bg-[#dc2626] transition-colors"
              >
                ❌ Wrong
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSwipe('right')}
                className="flex-1 px-6 py-4 bg-[#10b981] rounded-lg text-white font-medium hover:bg-[#059669] transition-colors"
              >
                ✅ Correct
              </motion.button>
            </motion.div>
          )}

          {/* Exit Button */}
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => setView('management')}
              className="px-6 py-2 text-[#9ca3af] hover:text-white transition-colors"
            >
              Exit Learning
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Results View
  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-[#2a2a2a] rounded-lg p-8 border border-[#3a3a3a]"
      >
        <h3 className="text-3xl font-bold text-white mb-6 text-center">Results</h3>
        
        <div className="mb-6">
          <div className="text-center mb-4">
            <p className="text-6xl font-bold text-[#b85a3a] mb-2">
              {results ? Math.round((results.correct / results.total) * 100) : 0}%
            </p>
            <p className="text-[#9ca3af]">Accuracy</p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between p-3 bg-[#1a1a1a] rounded-lg">
              <span className="text-white">Correct</span>
              <span className="text-green-500 font-bold">{results?.correct}</span>
            </div>
            <div className="flex justify-between p-3 bg-[#1a1a1a] rounded-lg">
              <span className="text-white">Incorrect</span>
              <span className="text-red-500 font-bold">{results?.incorrect}</span>
            </div>
            <div className="flex justify-between p-3 bg-[#1a1a1a] rounded-lg">
              <span className="text-white">Total</span>
              <span className="text-white font-bold">{results?.total}</span>
            </div>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setView('management')}
          className="w-full px-6 py-3 bg-[#b85a3a] rounded-lg text-white font-medium hover:bg-[#a04a2a] transition-colors"
        >
          Back to Flashcards
        </motion.button>
      </motion.div>
    </div>
  );
};
