import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { HiLightBulb, HiSparkles, HiXMark } from 'react-icons/hi2';
import { openaiService } from '../../../services/openai';
import { studyContentService } from '../../../services/supabase';
import { useAppData } from '../../../context/AppDataContext';

interface Topic {
  id: string;
  title: string;
  description: string;
}

interface Feedback {
  id: string;
  score: number;
  feedback: string;
  suggestions: string[];
}

interface FeynmanViewProps {
  noteContent: string;
}

export const FeynmanView: React.FC<FeynmanViewProps> = ({ noteContent }) => {
  const { selectedNoteId } = useAppData();
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [explanation, setExplanation] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [suggestedTopics, setSuggestedTopics] = useState<Topic[]>([]);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved topics from Supabase
  useEffect(() => {
    const loadSavedTopics = async () => {
      if (!selectedNoteId) return;
      
      try {
        const studyContent = await studyContentService.getStudyContent(selectedNoteId);
        
        if (studyContent.feynmanTopics && studyContent.feynmanTopics.length > 0) {
          setSuggestedTopics(studyContent.feynmanTopics);
        } else if (noteContent && noteContent.trim().length >= 50) {
          // Only generate if no saved topics and note content exists
          generateTopics();
        } else {
          // Not enough content for default topics
          setSuggestedTopics([
            {
              id: '1',
              title: 'Explain the main concept',
              description: 'Explain the main concept from your notes in simple terms',
            },
            {
              id: '2',
              title: 'Explain key terms',
              description: 'Explain the key terms and definitions',
            },
            {
              id: '3',
              title: 'Explain how concepts relate',
              description: 'Explain how different concepts from your notes relate to each other',
            },
          ]);
        }
      } catch (err) {
        console.error('Error loading saved topics:', err);
        // Still try to generate if there's an error loading
        if (noteContent && noteContent.trim().length >= 50) {
          generateTopics();
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedTopics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoteId]);

  // Save topics to Supabase
  const saveTopics = useCallback(async (topicsToSave: Topic[]) => {
    if (!selectedNoteId) return;
    
    try {
      await studyContentService.saveStudyContent(selectedNoteId, {
        feynmanTopics: topicsToSave,
      });
    } catch (err) {
      console.error('Error saving topics:', err);
    }
  }, [selectedNoteId]);

  // Generate topics from note content
  const generateTopics = async () => {
    if (!noteContent || noteContent.trim().length < 50) {
        // Not enough content, use default topics
      setSuggestedTopics([
        {
          id: '1',
          title: 'Explain the main concept',
          description: 'Explain the main concept from your notes in simple terms',
        },
        {
          id: '2',
          title: 'Explain key terms',
          description: 'Explain the key terms and definitions',
        },
        {
          id: '3',
          title: 'Explain how concepts relate',
          description: 'Explain how different concepts from your notes relate to each other',
        },
      ]);
      return;
    }

    setIsGeneratingTopics(true);
    try {
      const prompt = `Based on this note content, generate 3-4 specific topics that a student could practice explaining using the Feynman Technique. Focus on the main concepts, terms, or ideas that would be good for teaching.\n\nNote content:\n${noteContent}\n\nReturn a JSON array of objects with "title" (short topic title starting with "Explain:") and "description" (brief description). Keep titles concise (max 50 chars).`;
      
      const response = await openaiService.chatCompletions(
        [{ role: 'user', content: prompt }],
        'You are an educational assistant helping create practice topics.'
      );
      
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const topics = JSON.parse(jsonMatch[0]);
        const formattedTopics = topics.map((t: any, idx: number) => ({
          id: (idx + 1).toString(),
          title: t.title || `Topic ${idx + 1}`,
          description: t.description || '',
        }));
        setSuggestedTopics(formattedTopics);
        
        // Save topics to Supabase
        await saveTopics(formattedTopics);
      } else {
        // Fallback topics if parsing fails
        const fallbackTopics = [
          {
            id: '1',
            title: 'Explain the main concept',
            description: 'Explain the main concept from your notes',
          },
        ];
        setSuggestedTopics(fallbackTopics);
        await saveTopics(fallbackTopics);
      }
    } catch (error) {
      console.error('Error generating topics:', error);
      // Use default topics on error
      setSuggestedTopics([
        {
          id: '1',
          title: 'Explain the main concept',
          description: 'Explain the main concept from your notes',
        },
      ]);
    } finally {
      setIsGeneratingTopics(false);
    }
  };

  const handleTopicSelect = (topicId: string) => {
    setSelectedTopic(topicId);
    setExplanation('');
    setFeedback(null);
  };

  const handleExplain = async () => {
    if (!explanation.trim()) return;

    try {
      // Get AI feedback using OpenAI
      const feedbackPrompt = `Based on this note content:\n\n${noteContent}\n\nReview this student explanation and provide constructive feedback:\n\n${explanation}\n\nProvide feedback in JSON format: {"score": number (0-100), "feedback": "string", "suggestions": ["string array"]}`;
      
      const aiResponse = await openaiService.chatCompletions([
        { role: 'user', content: feedbackPrompt }
      ], 'You are a helpful teaching assistant that provides constructive feedback on student explanations using the Feynman Technique.');
      
      // Parse the response
      const feedbackMatch = aiResponse.match(/\{[^}]+\}/);
      if (feedbackMatch) {
        const parsed = JSON.parse(feedbackMatch[0]);
        setFeedback({
          id: Date.now().toString(),
          score: parsed.score || 75,
          feedback: parsed.feedback || aiResponse,
          suggestions: parsed.suggestions || [],
        });
      } else {
        // Fallback if parsing fails
        setFeedback({
          id: Date.now().toString(),
          score: 75,
          feedback: aiResponse,
          suggestions: [],
        });
      }
    } catch (error) {
      console.error('Error getting AI feedback:', error);
      // Fallback feedback
      setFeedback({
        id: Date.now().toString(),
        score: 75,
        feedback: "I couldn't process your explanation at this moment. Please try again.",
        suggestions: ["Try simplifying your explanation", "Use more examples"],
      });
    }
  };

  const handleNewTopic = () => {
    setSelectedTopic(null);
    setExplanation('');
    setFeedback(null);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-white text-lg">Loading topics...</p>
      </div>
    );
  }

  if (!selectedTopic) {
    return (
      <div className="h-full overflow-y-auto p-8 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Feynman Technique</h2>
            <p className="text-[#9ca3af] text-lg">
              Pick a topic and explain it as if you're teaching it to a child. This helps you truly understand the concept.
            </p>
          </div>

          {isGeneratingTopics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-6 bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] animate-pulse">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-3 bg-[#3a3a3a] rounded-lg w-12 h-12"></div>
                    <div className="flex-1">
                      <div className="h-6 bg-[#3a3a3a] rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-[#3a3a3a] rounded w-full"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Suggested Topics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suggestedTopics.map((topic) => (
              <motion.button
                key={topic.id}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleTopicSelect(topic.id)}
                className="text-left p-6 bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] hover:border-[#b85a3a] transition-all group"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-3 bg-[#b85a3a]/20 rounded-lg group-hover:bg-[#b85a3a]/30 transition-colors">
                    <HiLightBulb className="w-6 h-6 text-[#b85a3a]" />
                  </div>
                  <h3 className="text-xl font-semibold text-white flex-1">{topic.title}</h3>
                </div>
                <p className="text-[#9ca3af]">{topic.description}</p>
              </motion.button>
                ))}
              </div>

              <div className="mt-8 p-6 bg-[#2a2a2a] rounded-lg border border-[#3a3a3a]">
                <button
                  onClick={() => setSelectedTopic('custom')}
                  className="text-left w-full flex items-center gap-3 text-white hover:text-[#b85a3a] transition-colors"
                >
                  <HiSparkles className="w-6 h-6" />
                  <span className="font-medium">I want to explain something else</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-8 pb-12">
      <div className="max-w-3xl mx-auto w-full flex flex-col h-full">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-white mb-3">
              {selectedTopic === 'custom' ? 'Explain your concept' : suggestedTopics.find(t => t.id === selectedTopic)?.title}
            </h2>
            {selectedTopic !== 'custom' && suggestedTopics.find(t => t.id === selectedTopic)?.description && (
              <div className="p-4 bg-[#1a1a1a] border border-[#b85a3a]/30 rounded-lg mb-2">
                <p className="text-white font-medium mb-1">Your task:</p>
                <p className="text-[#9ca3af] leading-relaxed">
                  {suggestedTopics.find(t => t.id === selectedTopic)?.description}
                </p>
              </div>
            )}
            {(selectedTopic === 'custom' || !suggestedTopics.find(t => t.id === selectedTopic)?.description) && (
              <p className="text-[#9ca3af]">
                Explain this concept as simply as possible. Imagine teaching it to a 5-year-old!
              </p>
            )}
          </div>
          <button
            onClick={handleNewTopic}
            className="p-2 hover:bg-[#3a3a3a] rounded-lg transition-colors ml-4"
          >
            <HiXMark className="w-6 h-6 text-[#9ca3af]" />
          </button>
        </div>

        {!feedback ? (
          <>
            {/* Explanation Input */}
            <div className="flex-1 flex flex-col">
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Write your explanation here..."
                className="flex-1 p-6 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg text-white placeholder:text-[#6b7280] focus:outline-none focus:border-[#b85a3a] transition-colors resize-none"
              />
              
              <div className="mt-4 flex justify-end">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleExplain}
                  disabled={!explanation.trim()}
                  className="px-6 py-3 bg-[#b85a3a] rounded-lg text-white font-medium hover:bg-[#a04a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Get Feedback
                </motion.button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Feedback Display */}
            <div className="flex-1 space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-[#2a2a2a] rounded-lg border border-[#3a3a3a]"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white">Your Feedback</h3>
                  <div className="px-4 py-2 bg-[#b85a3a]/20 rounded-lg">
                    <span className="text-[#b85a3a] font-bold text-lg">{feedback.score}%</span>
                  </div>
                </div>
                <p className="text-[#9ca3af] mb-4">{feedback.feedback}</p>
                
                <div className="border-t border-[#3a3a3a] pt-4">
                  <h4 className="text-white font-medium mb-2">Suggestions:</h4>
                  <ul className="space-y-2">
                    {feedback.suggestions.map((suggestion, idx) => (
                      <li key={idx} className="text-[#9ca3af] flex items-start gap-2">
                        <span className="text-[#b85a3a]">•</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleNewTopic}
                  className="flex-1 px-6 py-3 bg-[#2a2a2a] rounded-lg text-white font-medium hover:bg-[#3a3a3a] transition-colors border border-[#3a3a3a]"
                >
                  Choose Another Topic
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setFeedback(null)}
                  className="flex-1 px-6 py-3 bg-[#b85a3a] rounded-lg text-white font-medium hover:bg-[#a04a2a] transition-colors"
                >
                  Try Again
                </motion.button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};