import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IoMic, IoLink, IoCloudUpload } from 'react-icons/io5';
import { HiDocumentText } from 'react-icons/hi2';

export const NoteCreationPage: React.FC = () => {
  const navigate = useNavigate();

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
      onClick: () => console.log('web link clicked'),
    },
    {
      id: 'upload-pdf',
      title: 'Upload PDF/text',
      description: 'Upload documents',
      icon: HiDocumentText,
      color: 'bg-[#f5f5f5] text-[#1a1a1a]',
      onClick: () => navigate('/note-creation/upload'),
    },
    {
      id: 'upload-audio',
      title: 'Upload audio',
      description: 'Upload audio files',
      icon: IoCloudUpload,
      color: 'bg-[#f5f5f5] text-[#1a1a1a]',
      onClick: () => navigate('/note-creation/upload'),
    },
  ];

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="max-w-4xl mx-auto px-8 py-12">
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
            Record audio, upload audio, or use a YouTube URL
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
    </div>
  );
};

