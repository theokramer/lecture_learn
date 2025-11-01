import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { HiPlus, HiPencil, HiTrash, HiCheck } from 'react-icons/hi2';
import { openaiService } from '../../../services/openai';
import { studyContentService } from '../../../services/supabase';
import { analyticsService } from '../../../services/analyticsService';
import { useAppData } from '../../../context/AppDataContext';
import { useSettings } from '../../../context/SettingsContext';
import { useAuth } from '../../../context/AuthContext';

interface Question {
  id: string;
  question: string;
  options: string[];
  correct: number;
}

type View = 'management' | 'quiz' | 'results';

interface QuizResult {
  correct: number;
  incorrect: number;
  total: number;
  answers: { questionId: string; isCorrect: boolean }[];
}

interface QuizViewProps {
  noteContent: string;
}

export const QuizView: React.FC<QuizViewProps> = React.memo(function QuizView({ noteContent }) {
  const { selectedNoteId } = useAppData();
  const { getPreference } = useSettings();
  const { user } = useAuth();
  const [view, setView] = useState<View>('management');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialLoad = React.useRef(true);
  const quizStartTimeRef = useRef<Date | null>(null);

  // Load saved quiz questions from Supabase
  useEffect(() => {
    const loadSavedQuiz = async () => {
      if (!selectedNoteId) return;
      
      try {
        const studyContent = await studyContentService.getStudyContent(selectedNoteId);
        
        if (studyContent.quizQuestions && studyContent.quizQuestions.length > 0) {
          setQuestions(studyContent.quizQuestions);
        } else if (noteContent) {
          // Only generate if no saved questions and note content exists
          generateQuiz();
        }
      } catch (err) {
        console.error('Error loading saved quiz:', err);
        // Still try to generate if there's an error loading
        if (noteContent) {
          generateQuiz();
        }
      } finally {
        setIsLoading(false);
        isInitialLoad.current = false;
      }
    };

    loadSavedQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoteId]);

  // Save questions to Supabase whenever they change
  const saveQuestions = useCallback(async (questionsToSave: Question[]) => {
    if (!selectedNoteId) return;
    
    try {
      await studyContentService.saveStudyContent(selectedNoteId, {
        quizQuestions: questionsToSave,
      });
    } catch (err) {
      console.error('Error saving quiz questions:', err);
    }
  }, [selectedNoteId]);

  // Save whenever questions array changes (but not during initial load)
  // Note: We explicitly save after generation, so this mainly handles user edits
  useEffect(() => {
    if (!isInitialLoad.current && !isGenerating && questions.length > 0) {
      saveQuestions(questions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  const generateQuiz = async () => {
    if (!noteContent.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    try {
      const count = getPreference('quizCount');
      const generated = await openaiService.generateQuiz(noteContent, count);
      const newQuestions = generated.map((q, idx) => ({
        id: `gen-${idx}`,
        question: q.question,
        options: q.options,
        correct: q.correctAnswer,
      }));
      setQuestions(newQuestions);
      
      // Explicitly save after generation
      if (selectedNoteId) {
        await studyContentService.saveStudyContent(selectedNoteId, {
          quizQuestions: newQuestions,
        });
      }
    } catch (error: any) {
      console.error('Error generating quiz:', error);
      if (error?.code === 'ACCOUNT_LIMIT_REACHED') {
        setError('You have already used your one-time AI generation quota. No additional AI generations are available.');
      } else if (error?.code === 'DAILY_LIMIT_REACHED') {
        setError('Daily AI limit reached. Please try again tomorrow.');
      } else {
        setError(error instanceof Error ? error.message : 'Failed to generate quiz');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [answers, setAnswers] = useState<{ questionId: string; isCorrect: boolean }[]>([]);
  const [results, setResults] = useState<QuizResult | null>(null);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ question: '', options: ['', '', '', ''], correct: 0 });
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState({ question: '', options: ['', '', '', ''], correct: 0 });

  const handleStartQuiz = () => {
    if (questions.length === 0) return;
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setAnswers([]);
    quizStartTimeRef.current = new Date();
    setView('quiz');
  };

  const handleSubmit = () => {
    setShowResult(true);
    const isCorrect = selectedAnswer === questions[currentQuestion].correct;
    setAnswers([...answers, { questionId: questions[currentQuestion].id, isCorrect }]);
  };

  const handleNext = async () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      // Calculate final results
      const finalAnswer = selectedAnswer === questions[currentQuestion].correct;
      const allAnswers = [...answers, { questionId: questions[currentQuestion].id, isCorrect: finalAnswer }];
      const correctCount = allAnswers.filter(a => a.isCorrect).length;
      const totalCount = allAnswers.length;
      
      setResults({
        correct: correctCount,
        incorrect: totalCount - correctCount,
        total: totalCount,
        answers: allAnswers,
      });
      
      // Track quiz result in analytics
      if (user && quizStartTimeRef.current) {
        try {
          const timeTaken = Math.floor((new Date().getTime() - quizStartTimeRef.current.getTime()) / 1000);
          await analyticsService.saveQuizResult(
            user.id,
            selectedNoteId || null,
            totalCount,
            correctCount,
            timeTaken
          );
        } catch (error) {
          console.error('Error saving quiz result:', error);
        }
      }
      
      setView('results');
    }
  };

  const handleAddQuestion = () => {
    if (newQuestion.question.trim() && newQuestion.options.every(o => o.trim())) {
      const question: Question = {
        id: Date.now().toString(),
        question: newQuestion.question,
        options: newQuestion.options,
        correct: newQuestion.correct,
      };
      const updatedQuestions = [...questions, question];
      setQuestions(updatedQuestions);
      saveQuestions(updatedQuestions);
      setNewQuestion({ question: '', options: ['', '', '', ''], correct: 0 });
      setShowAddQuestion(false);
    }
  };

  const handleDeleteQuestion = (id: string) => {
    const updatedQuestions = questions.filter(q => q.id !== id);
    setQuestions(updatedQuestions);
    saveQuestions(updatedQuestions);
  };

  const handleEditQuestion = (id: string) => {
    const question = questions.find(q => q.id === id);
    if (question) {
      setEditingQuestion(id);
      setEditQuestion({
        question: question.question,
        options: question.options,
        correct: question.correct,
      });
    }
  };

  const handleSaveEdit = (id: string) => {
    if (editQuestion.question.trim() && editQuestion.options.every(o => o.trim())) {
      const updatedQuestions = questions.map(q =>
        q.id === id
          ? { ...q, question: editQuestion.question, options: editQuestion.options, correct: editQuestion.correct }
          : q
      );
      setQuestions(updatedQuestions);
      saveQuestions(updatedQuestions);
      setEditingQuestion(null);
      setEditQuestion({ question: '', options: ['', '', '', ''], correct: 0 });
    }
  };

  const handleCancelEdit = () => {
    setEditingQuestion(null);
    setEditQuestion({ question: '', options: ['', '', '', ''], correct: 0 });
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-white text-lg">Loading quiz...</p>
      </div>
    );
  }

  if (view === 'management') {
    return (
      <div className="h-full overflow-y-auto p-8 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">Quiz</h2>
              <p className="text-[#9ca3af]">Manage your quiz questions</p>
            </div>
            {isGenerating ? (
              <div className="px-6 py-3 bg-[#3a3a3a] rounded-lg text-[#9ca3af]">
                Generating quiz...
              </div>
            ) : error ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={generateQuiz}
                className="px-6 py-3 bg-[#ef4444] rounded-lg text-white font-medium hover:bg-[#dc2626] transition-colors flex items-center gap-2"
              >
                <HiCheck className="w-5 h-5" />
                Retry
              </motion.button>
            ) : questions.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartQuiz}
                className="px-6 py-3 bg-[#b85a3a] rounded-lg text-white font-medium hover:bg-[#a04a2a] transition-colors flex items-center gap-2"
              >
                <HiCheck className="w-5 h-5" />
                Start Quiz
              </motion.button>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Add Question Form */}
          {showAddQuestion && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-6 bg-[#2a2a2a] rounded-lg border border-[#3a3a3a]"
            >
              <h3 className="text-xl font-semibold text-white mb-4">Add New Question</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#9ca3af] mb-2">Question</label>
                  <textarea
                    value={newQuestion.question}
                    onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                    placeholder="Enter your question..."
                    className="w-full p-3 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white placeholder:text-[#6b7280] focus:outline-none focus:border-[#b85a3a] resize-none"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#9ca3af] mb-2">Options</label>
                  {newQuestion.options.map((option, idx) => (
                    <div key={idx} className="flex items-center gap-3 mb-2">
                      <input
                        type="radio"
                        checked={newQuestion.correct === idx}
                        onChange={() => setNewQuestion({ ...newQuestion, correct: idx })}
                        className="w-4 h-4"
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...newQuestion.options];
                          newOptions[idx] = e.target.value;
                          setNewQuestion({ ...newQuestion, options: newOptions });
                        }}
                        placeholder={`Option ${idx + 1}`}
                        className="flex-1 p-3 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white placeholder:text-[#6b7280] focus:outline-none focus:border-[#b85a3a]"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAddQuestion}
                    className="px-6 py-3 bg-[#b85a3a] rounded-lg text-white font-medium hover:bg-[#a04a2a] transition-colors"
                  >
                    Add Question
                  </motion.button>
                  <button
                    onClick={() => setShowAddQuestion(false)}
                    className="px-6 py-3 bg-[#3a3a3a] rounded-lg text-white font-medium hover:bg-[#4a4a4a] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Questions List */}
          <div className="space-y-3">
            {!showAddQuestion && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAddQuestion(true)}
                className="w-full p-4 bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] border-dashed hover:border-[#b85a3a] transition-all flex items-center justify-center gap-2 text-[#9ca3af]"
              >
                <HiPlus className="w-5 h-5" />
                <span>Add Question</span>
              </motion.button>
            )}

            {questions.map((q) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] hover:border-[#b85a3a] transition-all"
              >
                {editingQuestion === q.id ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#9ca3af] mb-2">Question</label>
                      <textarea
                        value={editQuestion.question}
                        onChange={(e) => setEditQuestion({ ...editQuestion, question: e.target.value })}
                        placeholder="Enter your question..."
                        className="w-full p-3 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white placeholder:text-[#6b7280] focus:outline-none focus:border-[#b85a3a] resize-none"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#9ca3af] mb-2">Options</label>
                      {editQuestion.options.map((option, idx) => (
                        <div key={idx} className="flex items-center gap-3 mb-2">
                          <input
                            type="radio"
                            checked={editQuestion.correct === idx}
                            onChange={() => setEditQuestion({ ...editQuestion, correct: idx })}
                            className="w-4 h-4"
                          />
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...editQuestion.options];
                              newOptions[idx] = e.target.value;
                              setEditQuestion({ ...editQuestion, options: newOptions });
                            }}
                            placeholder={`Option ${idx + 1}`}
                            className="flex-1 p-3 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white placeholder:text-[#6b7280] focus:outline-none focus:border-[#b85a3a]"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSaveEdit(q.id)}
                        className="px-4 py-2 bg-[#b85a3a] rounded-lg text-white font-medium hover:bg-[#a04a2a] transition-colors"
                      >
                        Save
                      </motion.button>
                      <button
                        onClick={handleCancelEdit}
                        className="px-4 py-2 bg-[#3a3a3a] rounded-lg text-white font-medium hover:bg-[#4a4a4a] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <p className="text-white font-medium mb-3">{q.question}</p>
                      <div className="space-y-2">
                        {q.options.map((option, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            {idx === q.correct && <HiCheck className="w-4 h-4 text-green-500" />}
                            <span className={`text-sm ${idx === q.correct ? 'text-green-500 font-medium' : 'text-[#9ca3af]'}`}>
                              {option}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditQuestion(q.id)}
                        className="p-2 hover:bg-[#3a3a3a] rounded-lg transition-colors"
                      >
                        <HiPencil className="w-5 h-5 text-[#9ca3af]" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-2 hover:bg-[#3a3a3a] rounded-lg transition-colors"
                      >
                        <HiTrash className="w-5 h-5 text-[#ef4444]" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'quiz') {
  return (
      <div className="h-full overflow-y-auto p-8 pb-12">
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Progress */}
      <div className="bg-[#2a2a2a] rounded-lg p-4">
        <div className="flex justify-between text-sm text-[#9ca3af] mb-2">
          <span>Question {currentQuestion + 1} of {questions.length}</span>
              <span>Correct: {answers.filter(a => a.isCorrect).length}</span>
        </div>
        <div className="w-full bg-[#1a1a1a] rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
                className="h-2 bg-gradient-to-r from-[#b85a3a] to-[#d4a944] rounded-full transition-all"
          />
        </div>
      </div>

      {/* Question */}
      <div className="bg-[#2a2a2a] rounded-lg p-8">
        <h2 className="text-2xl font-bold text-white mb-6">
          {questions[currentQuestion].question}
        </h2>

        <div className="space-y-3">
          {questions[currentQuestion].options.map((option, index) => (
            <motion.button
              key={index}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => !showResult && setSelectedAnswer(index)}
              className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                selectedAnswer === index
                  ? 'border-[#b85a3a] bg-[#3a3a3a]'
                  : 'border-[#3a3a3a] hover:border-[#4a4a4a]'
              } ${
                showResult
                  ? index === questions[currentQuestion].correct
                        ? 'border-green-500 bg-green-500/10'
                    : index === selectedAnswer
                        ? 'border-red-500 bg-red-500/10'
                    : ''
                  : ''
              }`}
            >
              <span className="text-white">{option}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Actions */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => setView('management')}
              className="px-6 py-2 text-[#9ca3af] hover:text-white transition-colors"
            >
              Exit Quiz
            </button>
            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                disabled={selectedAnswer === null || showResult}
                className="px-6 py-3 bg-[#3a3a3a] rounded-lg text-white font-medium hover:bg-[#4a4a4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
          Check Answer
              </button>
              {showResult && (
                <button
                  onClick={handleNext}
                  className="px-6 py-3 bg-[#b85a3a] rounded-lg text-white font-medium hover:bg-[#a04a2a] transition-colors"
                >
                  {currentQuestion < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                </button>
              )}
            </div>
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
        <h3 className="text-3xl font-bold text-white mb-6 text-center">Quiz Results</h3>
        
        <div className="mb-6">
          <div className="text-center mb-4">
            <p className="text-6xl font-bold text-[#b85a3a] mb-2">
              {results ? Math.round((results.correct / results.total) * 100) : 0}%
            </p>
            <p className="text-[#9ca3af]">Score</p>
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
          Back to Quiz
        </motion.button>
      </motion.div>
    </div>
  );
});
