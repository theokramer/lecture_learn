import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HiLightBulb, HiSparkles, HiXMark } from 'react-icons/hi2';

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

export const FeynmanView: React.FC = () => {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [explanation, setExplanation] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const suggestedTopics: Topic[] = [
    {
      id: '1',
      title: 'Explain: React Hooks',
      description: 'Describe how React hooks work and why they exist',
    },
    {
      id: '2',
      title: 'Explain: Virtual DOM',
      description: 'Explain the concept of Virtual DOM and its purpose',
    },
    {
      id: '3',
      title: 'Explain: JavaScript Closures',
      description: 'Describe what closures are in JavaScript with examples',
    },
    {
      id: '4',
      title: 'Explain: API vs REST',
      description: 'Describe the difference between API and REST',
    },
  ];

  const handleTopicSelect = (topicId: string) => {
    setSelectedTopic(topicId);
    setExplanation('');
    setFeedback(null);
  };

  const handleExplain = () => {
    if (!explanation.trim()) return;

    // Simulate AI feedback
    const mockFeedback: Feedback = {
      id: Date.now().toString(),
      score: Math.floor(Math.random() * 30) + 70, // 70-100
      feedback: "Your explanation shows good understanding! You mentioned the key concepts clearly. However, try to simplify the technical terms a bit more - imagine explaining this to a child who's never heard of it before.",
      suggestions: [
        "Use more analogies to explain complex concepts",
        "Break down the explanation into smaller, digestible parts",
        "Avoid jargon and technical terms where possible",
      ],
    };
    setFeedback(mockFeedback);
  };

  const handleNewTopic = () => {
    setSelectedTopic(null);
    setExplanation('');
    setFeedback(null);
  };

  if (!selectedTopic) {
    return (
      <div className="h-full overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Feynman Technique</h2>
            <p className="text-[#9ca3af] text-lg">
              Pick a topic and explain it as if you're teaching it to a child. This helps you truly understand the concept.
            </p>
          </div>

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
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-8">
      <div className="max-w-3xl mx-auto w-full flex flex-col h-full">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {selectedTopic === 'custom' ? 'Explain your concept' : suggestedTopics.find(t => t.id === selectedTopic)?.title}
            </h2>
            <p className="text-[#9ca3af]">
              Explain this concept as simply as possible. Imagine teaching it to a 5-year-old!
            </p>
          </div>
          <button
            onClick={handleNewTopic}
            className="p-2 hover:bg-[#3a3a3a] rounded-lg transition-colors"
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