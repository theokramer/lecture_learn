import React, { useState } from 'react';
import { Sidebar } from '../components/home/Sidebar';
import { HiQuestionMarkCircle, HiChatBubbleLeftRight } from 'react-icons/hi2';
import { HiBookOpen, HiOutlineMail } from 'react-icons/hi';

export const SupportPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('general');

  const faqs = {
    general: [
      {
        q: 'How do I create a new note?',
        a: 'Click the "New Note" button in the top bar on the home page. You can then choose to record audio, upload documents (including audio files), add a web link, or create a note manually.',
      },
      {
        q: 'Can I organize my notes in folders?',
        a: 'Yes! Click "Create Folder" to add a new folder. You can create nested folders for better organization. Click on a folder to navigate into it.',
      },
      {
        q: 'How does the search function work?',
        a: 'Type your search query in the search bar. The search looks through all your notes, even across different folders. Clear the search to return to normal view.',
      },
    ],
    audio: [
      {
        q: 'How do I record audio?',
        a: 'Go to "New Note" → "Record audio". Press the microphone button to start recording, and press it again to stop. Your audio will be automatically transcribed.',
      },
      {
        q: 'What audio formats are supported?',
        a: 'We support MP3, WAV, and other common audio formats. You can upload audio files via the "Upload documents" option or record directly using your device microphone.',
      },
    ],
    documents: [
      {
        q: 'What file types can I upload?',
        a: 'You can upload PDFs, Word documents (.doc, .docx), OpenDocument files (.odt, .ods), Excel files (.xls, .xlsx), PowerPoint (.ppt, .pptx), text files (.txt, .md, .json), images, audio, and video files. The AI will extract and process the content from all supported document formats.',
      },
      {
        q: 'Is there a file size limit?',
        a: 'Yes, each file should be under 10MB for best performance. You can upload up to 3 files at once per note.',
      },
    ],
  };

  return (
    <div className="flex h-screen bg-[#1a1a1a]">
      <Sidebar activePage="support" />

      <div className="flex-1 flex flex-col">
        <div className="bg-[#2a2a2a] px-8 py-4 border-b border-[#3a3a3a]">
          <h1 className="text-2xl font-bold text-white">Support</h1>
        </div>

        <div className="flex-1 p-8 pb-20 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* FAQ Section */}
            <div className="bg-[#2a2a2a] rounded-xl p-8 border border-[#3a3a3a]">
              <div className="flex items-center gap-3 mb-6">
                <HiQuestionMarkCircle className="w-6 h-6 text-[#b85a3a]" />
                <h2 className="text-2xl font-bold text-white">Frequently Asked Questions</h2>
              </div>

              {/* Category Tabs */}
              <div className="flex gap-3 mb-6">
                {['general', 'audio', 'documents'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedCategory === cat
                        ? 'bg-[#b85a3a] text-white'
                        : 'bg-[#1a1a1a] text-[#9ca3af] hover:bg-[#3a3a3a]'
                    }`}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>

              {/* FAQ List */}
              <div className="space-y-4">
                {faqs[selectedCategory as keyof typeof faqs].map((faq, index) => (
                  <div key={index} className="bg-[#1a1a1a] rounded-lg p-4 border border-[#3a3a3a]">
                    <h3 className="text-white font-semibold mb-2">{faq.q}</h3>
                    <p className="text-[#9ca3af]">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Section */}
            <div className="bg-[#2a2a2a] rounded-xl p-8 border border-[#3a3a3a]">
              <div className="flex items-center gap-3 mb-6">
                <HiChatBubbleLeftRight className="w-6 h-6 text-[#b85a3a]" />
                <h2 className="text-2xl font-bold text-white">Still Need Help?</h2>
              </div>

              <div className="space-y-4">
                <a
                  href="mailto:support@learningnotes.com"
                  className="flex items-center gap-3 p-4 bg-[#1a1a1a] rounded-lg border border-[#3a3a3a] hover:border-[#b85a3a] transition-colors group"
                >
                  <HiOutlineMail className="w-5 h-5 text-[#9ca3af] group-hover:text-[#b85a3a]" />
                  <div>
                    <p className="text-white font-medium">Email Us</p>
                    <p className="text-sm text-[#9ca3af]">Get help from our support team</p>
                  </div>
                </a>

                <a
                  href="#"
                  className="flex items-center gap-3 p-4 bg-[#1a1a1a] rounded-lg border border-[#3a3a3a] hover:border-[#b85a3a] transition-colors group"
                >
                  <HiBookOpen className="w-5 h-5 text-[#9ca3af] group-hover:text-[#b85a3a]" />
                  <div>
                    <p className="text-white font-medium">View Documentation</p>
                    <p className="text-sm text-[#9ca3af]">Browse our full documentation</p>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
