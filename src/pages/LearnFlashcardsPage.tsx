import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sidebar } from '../components/home/Sidebar';
import { flashcardsService } from '../services/flashcardsService';
import { 
  spacedRepetitionService,
  type SpacedRepetitionCard 
} from '../services/spacedRepetitionService';
import { HiArrowLeft, HiClock, HiFire, HiCheckCircle, HiArrowDownTray } from 'react-icons/hi2';
import { exportService } from '../services/exportService';

type FilterType = 'all' | 'due' | 'hard' | 'new';

export const LearnFlashcardsPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const folderId = searchParams.get('folder');
  const [flashcards, setFlashcards] = useState<SpacedRepetitionCard[]>([]);
  const [filteredCards, setFilteredCards] = useState<SpacedRepetitionCard[]>([]);
  const [filter, setFilter] = useState<FilterType>('due');
  const [loading, setLoading] = useState(true);
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [view, setView] = useState<'selection' | 'learning' | 'results'>('selection');
  const [answers, setAnswers] = useState<{ cardId: string; correct: boolean }[]>([]);
  const [results, setResults] = useState<{ correct: number; incorrect: number; total: number } | null>(null);

  useEffect(() => {
    if (user) {
      loadFlashcards();
    }
  }, [user, folderId]);

  useEffect(() => {
    applyFilter();
  }, [flashcards, filter]);

  const loadFlashcards = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const allCards = folderId
        ? await flashcardsService.getFlashcardsByFolder(user.id, folderId)
        : await flashcardsService.getAllFlashcards(user.id);
      setFlashcards(allCards);
    } catch (error) {
      console.error('Error loading flashcards:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    let filtered: SpacedRepetitionCard[] = [];

    switch (filter) {
      case 'all':
        filtered = [...flashcards];
        break;
      case 'due':
        filtered = spacedRepetitionService.getCardsDueForReview(flashcards);
        break;
      case 'hard':
        filtered = spacedRepetitionService.getHardCards(flashcards);
        break;
      case 'new':
        filtered = flashcards.filter(card => 
          card.repetitions === 0 && !card.lastReviewed
        );
        break;
    }

    // Sort by priority (due soonest first)
    filtered = spacedRepetitionService.sortCardsByPriority(filtered);
    setFilteredCards(filtered);
  };

  const handleStartLearning = () => {
    if (filteredCards.length === 0) return;
    setCurrentCard(0);
    setFlipped(false);
    setAnswers([]);
    setView('learning');
  };

  const handleAnswer = async (isCorrect: boolean, difficulty: 'easy' | 'normal' | 'hard' = 'normal') => {
    const card = filteredCards[currentCard];
    const quality = spacedRepetitionService.qualityFromResponse(isCorrect, difficulty);
    
    // Calculate next review using SM-2 algorithm
    const nextReview = spacedRepetitionService.calculateNextReview(card, quality);
    
    // Update the card
    const updatedCard: SpacedRepetitionCard = {
      ...card,
      ...nextReview,
      lastReviewed: new Date().toISOString(),
      quality,
    };
    
    // Update local state
    const updatedCards = flashcards.map(c => 
      c.id === card.id ? updatedCard : c
    );
    const updatedFiltered = filteredCards.map(c =>
      c.id === card.id ? updatedCard : c
    );
    
    setFlashcards(updatedCards);
    setFilteredCards(updatedFiltered);
    setAnswers([...answers, { cardId: card.id, correct: isCorrect }]);
    
    // Save updated card to database
    if (card.noteId) {
      try {
        await flashcardsService.saveFlashcard(updatedCard);
      } catch (error) {
        console.error('Error saving flashcard:', error);
      }
    }
    
    if (currentCard < filteredCards.length - 1) {
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

  if (loading) {
    return (
      <div className="flex h-screen bg-[#1a1a1a]">
        <Sidebar activePage="learn-flashcards" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white text-lg">Loading flashcards...</p>
        </div>
      </div>
    );
  }

  if (view === 'selection') {
    const stats = {
      total: flashcards.length,
      due: spacedRepetitionService.getCardsDueForReview(flashcards).length,
      hard: spacedRepetitionService.getHardCards(flashcards).length,
      new: flashcards.filter(c => c.repetitions === 0 && !c.lastReviewed).length,
    };

    return (
      <div className="flex h-screen bg-[#1a1a1a]">
        <Sidebar activePage="learn-flashcards" />
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="bg-[#2a2a2a] px-8 py-4 border-b border-[#3a3a3a] sticky top-0 z-10">
            <h1 className="text-2xl font-bold text-white">
              Learn Flashcards
              {folderId && <span className="text-lg text-[#9ca3af] font-normal"> (Folder)</span>}
            </h1>
            <p className="text-[#9ca3af] mt-1">
              {folderId ? 'Study flashcards from this folder' : 'Study flashcards from all your notes'}
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 p-8">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
                  <div className="text-[#9ca3af] text-sm mb-2">Total Cards</div>
                  <div className="text-3xl font-bold text-white">{stats.total}</div>
                </div>
                <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
                  <div className="text-[#9ca3af] text-sm mb-2">Due Now</div>
                  <div className="text-3xl font-bold text-[#10b981]">{stats.due}</div>
                </div>
                <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
                  <div className="text-[#9ca3af] text-sm mb-2">Hard Cards</div>
                  <div className="text-3xl font-bold text-[#f59e0b]">{stats.hard}</div>
                </div>
                <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
                  <div className="text-[#9ca3af] text-sm mb-2">New Cards</div>
                  <div className="text-3xl font-bold text-[#3b82f6]">{stats.new}</div>
                </div>
              </div>

              {/* Filter Buttons */}
              <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
                <h2 className="text-xl font-bold text-white mb-4">Filter Cards</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(['due', 'hard', 'new', 'all'] as FilterType[]).map((f) => (
                    <motion.button
                      key={f}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setFilter(f)}
                      className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                        filter === f
                          ? 'bg-[#b85a3a] text-white'
                          : 'bg-[#1a1a1a] text-[#9ca3af] hover:bg-[#3a3a3a]'
                      }`}
                    >
                      {f === 'due' && <HiClock className="inline w-5 h-5 mr-2" />}
                      {f === 'hard' && <HiFire className="inline w-5 h-5 mr-2" />}
                      {f === 'new' && <HiCheckCircle className="inline w-5 h-5 mr-2" />}
                      {f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'due' ? stats.due : f === 'hard' ? stats.hard : f === 'new' ? stats.new : stats.total})
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Start Learning Button & Export */}
              {filteredCards.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-4"
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleStartLearning}
                    className="px-8 py-4 bg-gradient-to-r from-[#b85a3a] to-[#d4a944] rounded-lg text-white font-bold text-lg hover:shadow-lg transition-all"
                  >
                    Start Learning ({filteredCards.length} cards)
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => exportService.exportToAnki(filteredCards, 'csv')}
                    className="px-6 py-3 bg-[#3a3a3a] rounded-lg text-white font-medium hover:bg-[#4a4a4a] transition-colors flex items-center gap-2"
                    title="Export filtered cards to Anki"
                  >
                    <HiArrowDownTray className="w-5 h-5" />
                    Export to Anki ({filteredCards.length} cards)
                  </motion.button>
                </motion.div>
              )}

              {filteredCards.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-[#9ca3af] text-lg">No flashcards match your filter.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'learning') {
    if (filteredCards.length === 0) {
      return (
        <div className="flex h-screen bg-[#1a1a1a]">
          <Sidebar activePage="learn-flashcards" />
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white text-lg">No cards to study</p>
          </div>
        </div>
      );
    }

    const card = filteredCards[currentCard];
    
    return (
      <div className="flex h-screen bg-[#1a1a1a]">
        <Sidebar activePage="learn-flashcards" />
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-2xl">
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between text-sm text-[#9ca3af] mb-2">
                <span>Card {currentCard + 1} of {filteredCards.length}</span>
                <span>{Math.round(((currentCard + 1) / filteredCards.length) * 100)}%</span>
              </div>
              <div className="w-full bg-[#2a2a2a] rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentCard + 1) / filteredCards.length) * 100}%` }}
                  className="h-2 bg-gradient-to-r from-[#b85a3a] to-[#d4a944] rounded-full transition-all"
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
                  className={`absolute inset-0 ${flipped ? 'hidden' : 'block'}`}
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <div className="w-full h-full bg-[#2a2a2a] rounded-lg p-8 flex items-center justify-center border border-[#3a3a3a]">
                    <p className="text-white text-2xl font-medium text-center">
                      {card.front}
                    </p>
                  </div>
                </div>

                <div
                  className={`absolute inset-0 ${flipped ? 'block' : 'hidden'}`}
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

            {/* Answer Buttons */}
            {flipped && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAnswer(false)}
                    className="flex-1 px-6 py-4 bg-[#ef4444] rounded-lg text-white font-medium hover:bg-[#dc2626] transition-colors"
                  >
                    ❌ Wrong
                  </motion.button>
                </div>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAnswer(true, 'hard')}
                    className="flex-1 px-6 py-4 bg-[#f59e0b] rounded-lg text-white font-medium hover:bg-[#d97706] transition-colors"
                  >
                    🔶 Hard
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAnswer(true, 'normal')}
                    className="flex-1 px-6 py-4 bg-[#10b981] rounded-lg text-white font-medium hover:bg-[#059669] transition-colors"
                  >
                    ✅ Good
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAnswer(true, 'easy')}
                    className="flex-1 px-6 py-4 bg-[#3b82f6] rounded-lg text-white font-medium hover:bg-[#2563eb] transition-colors"
                  >
                    ⭐ Easy
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Exit Button */}
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setView('selection')}
                className="px-6 py-2 text-[#9ca3af] hover:text-white transition-colors flex items-center gap-2"
              >
                <HiArrowLeft className="w-4 h-4" />
                Exit Learning
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Results View
  return (
    <div className="flex h-screen bg-[#1a1a1a]">
      <Sidebar activePage="learn-flashcards" />
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[#2a2a2a] rounded-lg p-8 border border-[#3a3a3a]"
        >
          <h3 className="text-3xl font-bold text-white mb-6 text-center">Study Complete!</h3>
          
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
            onClick={() => {
              setView('selection');
              setResults(null);
              setCurrentCard(0);
              setAnswers([]);
              loadFlashcards();
            }}
            className="w-full px-6 py-3 bg-[#b85a3a] rounded-lg text-white font-medium hover:bg-[#a04a2a] transition-colors"
          >
            Back to Selection
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

