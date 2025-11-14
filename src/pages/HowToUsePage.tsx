import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/home/Sidebar';
import { HiFolderPlus, HiPencilSquare, HiMagnifyingGlass, HiDocumentText, HiSpeakerWave, HiLink } from 'react-icons/hi2';
import { motion } from 'framer-motion';

export const HowToUsePage: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: HiFolderPlus,
      title: 'Organize with Folders',
      description: 'Create folders to organize your notes by topic, course, or subject. You can create nested folders for better organization.',
      color: 'bg-blue-500',
    },
    {
      icon: HiPencilSquare,
      title: 'Create Notes',
      description: 'Click "New Note" to create a note. You can add content from various sources including audio, documents, and web links.',
      color: 'bg-green-500',
    },
    {
      icon: HiMagnifyingGlass,
      title: 'Search Everything',
      description: 'Use the search bar to quickly find notes by title or content. The search works across all your notes and folders.',
      color: 'bg-purple-500',
    },
    {
      icon: HiDocumentText,
      title: 'Upload Documents',
      description: 'Upload PDFs, text files, and other documents. The AI will extract and process the content for you.',
      color: 'bg-yellow-500',
    },
    {
      icon: HiSpeakerWave,
      title: 'Record Audio',
      description: 'Record voice notes that are automatically transcribed using advanced AI transcription.',
      color: 'bg-red-500',
    },
    {
      icon: HiLink,
      title: 'Add Web Links',
      description: 'Add YouTube URLs or other web links to include external content in your notes.',
      color: 'bg-indigo-500',
    },
  ];

  return (
    <div className="flex h-screen bg-[#1a1a1a]">
      <Sidebar activePage="how-to-use" />

      <div className="flex-1 flex flex-col">
        <div className="bg-[#2a2a2a] px-8 py-4 border-b border-[#3a3a3a]">
          <h1 className="text-2xl font-bold text-white">How to Use</h1>
        </div>

        <div className="flex-1 p-8 pb-20 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-white mb-4">Welcome to RocketLearn</h2>
              <p className="text-[#9ca3af] text-lg">
                Learn how to make the most out of your note-taking app
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a] hover:border-[#b85a3a] transition-colors"
                  >
                    <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center mb-4`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                    <p className="text-[#9ca3af]">{feature.description}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Quick Start */}
            <div className="bg-[#2a2a2a] rounded-xl p-8 border border-[#3a3a3a]">
              <h3 className="text-2xl font-bold text-white mb-6">Quick Start Guide</h3>
              
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#b85a3a] rounded-full flex items-center justify-center text-white font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Create Your First Note</h4>
                    <p className="text-[#9ca3af]">
                      Click "New Note" in the top bar and choose how you want to add content: record audio, upload a document, or add a web link.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#b85a3a] rounded-full flex items-center justify-center text-white font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Organize with Folders</h4>
                    <p className="text-[#9ca3af]">
                      Create folders to organize your notes by topic. Click on any folder to navigate into it and see its contents.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#b85a3a] rounded-full flex items-center justify-center text-white font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Study with AI</h4>
                    <p className="text-[#9ca3af]">
                      Once your note is created, open it to use AI-powered study modes: summaries, flashcards, quizzes, and exercises.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <button
                  onClick={() => navigate('/home')}
                  className="px-6 py-3 bg-[#b85a3a] hover:bg-[#a04a2a] text-white rounded-lg font-medium transition-colors"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
