import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IoMic, IoLink } from 'react-icons/io5';
import { HiDocumentText, HiDocumentPlus } from 'react-icons/hi2';
import { Modal } from '../components/shared/Modal';
import toast from 'react-hot-toast';
import { handleError } from '../utils/errorHandler';
import { linkProcessor } from '../services/linkProcessor';
import { useAppData } from '../context/AppDataContext';

export const NoteCreationPage: React.FC = () => {
  const navigate = useNavigate();
  const { createNote } = useAppData();
  const [showWebLinkModal, setShowWebLinkModal] = useState(false);
  const [webLinkUrl, setWebLinkUrl] = useState('');
  const [processingWebLink, setProcessingWebLink] = useState(false);

  const handleWebLink = () => {
    setShowWebLinkModal(true);
  };

  const processWebLink = async () => {
    if (!webLinkUrl.trim()) return;

    setProcessingWebLink(true);
    try {
      toast.loading('Processing link...', { id: 'link-processing' });
      
      // Close modal while processing
      setShowWebLinkModal(false);
      
      // Process the link using the link processor
      const result = await linkProcessor.processLink(webLinkUrl.trim());
      
      toast.success('Link processed successfully!', { id: 'link-processing' });
      
      // Navigate to processing page with the extracted content
      navigate('/note-creation/processing', { 
        state: { 
          text: result.content,
          title: result.title
        } 
      });
    } catch (error) {
      toast.error('Failed to process link', { id: 'link-processing' });
      handleError(error, 'NoteCreationPage: Processing web link', toast.error);
      setProcessingWebLink(false);
      // Reopen modal on error so user can try again
      setShowWebLinkModal(true);
    }
  };

  const handleCreateManualNote = async () => {
    try {
      const noteId = await createNote('New Note');
      // Navigate to note with summary mode to show summary tab automatically
      navigate(`/note?id=${noteId}&mode=summary`);
    } catch (error) {
      toast.error('Failed to create note');
      handleError(error, 'NoteCreationPage: Creating manual note', toast.error);
    }
  };

  const actions = [
    {
      id: 'record',
      title: 'Record audio',
      description: 'Record voice notes directly',
      icon: IoMic,
      color: 'bg-[#ef4444] text-white',
      onClick: () => navigate('/note-creation/record'),
    },
    {
      id: 'weblink',
      title: 'Web link',
      description: 'YouTube, websites, Google Drive, etc',
      icon: IoLink,
      color: 'bg-[#f5f5f5] text-[#1a1a1a]',
      onClick: handleWebLink,
    },
    {
      id: 'upload-pdf',
      title: 'Upload documents',
      description: 'Upload PDF, text, audio, and video files',
      icon: HiDocumentText,
      color: 'bg-[#f5f5f5] text-[#1a1a1a]',
      onClick: () => navigate('/note-creation/upload'),
    },
    {
      id: 'manual',
      title: 'Create note manually',
      description: 'Start with an empty note',
      icon: HiDocumentPlus,
      color: 'bg-[#f5f5f5] text-[#1a1a1a]',
      onClick: handleCreateManualNote,
    },
  ];

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="max-w-4xl mx-auto px-8 py-12 pb-20">
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={() => navigate('/home')}
            className="text-[#9ca3af] hover:text-white mb-6 transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-4xl font-bold text-white mb-4">New note</h1>
          <p className="text-[#9ca3af] text-lg">
            Record audio, upload documents, add a link, or create a note manually
          </p>
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-2 gap-6">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={action.onClick}
                className="p-6 rounded-xl bg-[#2a2a2a] hover:bg-[#3a3a3a] transition-colors text-left border border-[#3a3a3a]"
              >
                <div className={`w-14 h-14 rounded-full ${action.color} flex items-center justify-center mb-4`}>
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="font-semibold text-xl text-white mb-2">{action.title}</h3>
                <p className="text-sm text-[#9ca3af]">{action.description}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Web Link Modal */}
      <Modal
        isOpen={showWebLinkModal}
        onClose={() => setShowWebLinkModal(false)}
        title="Add Web Link"
      >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                URL
              </label>
              <input
                type="url"
                value={webLinkUrl}
                onChange={(e) => setWebLinkUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or https://drive.google.com/..."
                className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white focus:outline-none focus:border-[#b85a3a]"
                autoFocus
              />
              <p className="text-xs text-[#9ca3af] mt-1">
                Supports: YouTube videos, Google Drive links, and web pages
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWebLinkModal(false)}
                className="flex-1 px-6 py-3 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={processWebLink}
                disabled={!webLinkUrl.trim() || processingWebLink}
                className="flex-1 px-6 py-3 bg-[#b85a3a] hover:bg-[#a04a2a] disabled:bg-[#3a3a3a] disabled:text-[#6b7280] text-white rounded-lg font-medium transition-colors"
              >
                {processingWebLink ? 'Processing...' : 'Add'}
              </button>
            </div>
          </div>
        </Modal>
    </div>
  );
};

