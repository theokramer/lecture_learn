import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { IoMic, IoLink, IoCloudUpload } from 'react-icons/io5';
import { HiDocumentText } from 'react-icons/hi2';
import { Modal } from '../shared/Modal';
import { DocumentUpload } from '../modals/DocumentUpload';
import { VoiceRecording } from '../modals/VoiceRecording';

interface NoteCreationProps {
  isOpen: boolean;
  onClose: () => void;
  onNoteCreated: () => void;
}

export const NoteCreation: React.FC<NoteCreationProps> = ({ 
  isOpen, 
  onClose,
  onNoteCreated,
}) => {
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const actions = [
    {
      id: 'record',
      title: 'Record audio',
      description: 'Record voice notes directly',
      icon: IoMic,
      color: 'bg-[#ef4444] text-white',
      onClick: () => setActiveAction('record'),
    },
    {
      id: 'weblink',
      title: 'Web link',
      description: 'YouTube, websites, Google Drive, etc',
      icon: IoLink,
      color: 'bg-[#f5f5f5] text-[#1a1a1a]',
      onClick: () => setActiveAction('weblink'),
    },
    {
      id: 'upload-pdf',
      title: 'Upload PDF/text',
      description: 'Upload documents',
      icon: HiDocumentText,
      color: 'bg-[#f5f5f5] text-[#1a1a1a]',
      onClick: () => setActiveAction('upload'),
    },
    {
      id: 'upload-audio',
      title: 'Upload audio',
      description: 'Upload audio files',
      icon: IoCloudUpload,
      color: 'bg-[#f5f5f5] text-[#1a1a1a]',
      onClick: () => setActiveAction('upload'),
    },
  ];

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="md" title="New note">
        <div>
          <p className="text-[#6b7280] mb-6 text-sm">
            Record audio, upload audio, or use a YouTube URL
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={action.onClick}
                  className="p-4 rounded-lg bg-[#2a2a2a] hover:bg-[#3a3a3a] transition-colors text-left border border-[#3a3a3a]"
                >
                  <div className={`w-12 h-12 rounded-full ${action.color} flex items-center justify-center mb-3`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-semibold text-white mb-1">{action.title}</h3>
                  <p className="text-sm text-[#9ca3af]">{action.description}</p>
                </motion.button>
              );
            })}
          </div>
        </div>
      </Modal>

      {activeAction === 'record' && (
        <VoiceRecording
          isOpen={true}
          onClose={() => {
            setActiveAction(null);
            onClose();
          }}
          onComplete={() => {
            setActiveAction(null);
            onClose();
            onNoteCreated();
          }}
        />
      )}

      {activeAction === 'upload' && (
        <DocumentUpload
          isOpen={true}
          onClose={() => {
            setActiveAction(null);
          }}
          onComplete={() => {
            setActiveAction(null);
            onNoteCreated();
          }}
        />
      )}
    </>
  );
};
