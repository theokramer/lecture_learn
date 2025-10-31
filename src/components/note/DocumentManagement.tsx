import React, { useRef, useState, useEffect } from 'react';
import { IoAdd, IoDownloadOutline, IoRefresh } from 'react-icons/io5';
import { HiDocument } from 'react-icons/hi2';
import { useAppData } from '../../context/AppDataContext';
import { Button } from '../shared/Button';
import { storageService, studyContentService } from '../../services/supabase';
import { AudioPlayer } from '../audio/AudioPlayer';

export const DocumentManagement: React.FC = () => {
  const { notes, selectedNoteId, uploadDocumentToNote } = useAppData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

  const currentNote = notes.find(n => n.id === selectedNoteId);
  const documents = currentNote?.documents || [];

  // Load audio URLs for audio documents
  useEffect(() => {
    const loadAudioUrls = async () => {
      const audioDocs = documents.filter(doc => doc.type === 'audio' || doc.type === 'video');
      const urlMap: Record<string, string> = {};

      for (const doc of audioDocs) {
        try {
          const url = await storageService.getFileUrl(doc.url);
          urlMap[doc.id] = url;
        } catch (error) {
          console.error(`Error loading audio URL for ${doc.id}:`, error);
        }
      }

      setAudioUrls(urlMap);
    };

    if (documents.length > 0) {
      loadAudioUrls();
    }
  }, [documents]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentNote) return;

    try {
      for (const file of Array.from(files)) {
        await uploadDocumentToNote(currentNote.id, file);
      }
    } catch (error) {
      console.error('Error uploading documents:', error);
      alert('Failed to upload documents');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'audio':
        return '🎵';
      case 'video':
        return '🎥';
      case 'pdf':
        return '📄';
      case 'doc':
        return '📝';
      default:
        return '📄';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleDownload = async (doc: any) => {
    try {
      const blob = await storageService.downloadFile(doc.url);
      
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document');
    }
  };

  const handleRegenerate = async () => {
    if (!currentNote || !selectedNoteId) return;

    setIsRegenerating(true);
    try {
      await studyContentService.generateAndSaveAllStudyContent(selectedNoteId, currentNote.content);
      alert('Study content regenerated successfully!');
    } catch (error) {
      console.error('Error regenerating study content:', error);
      alert('Failed to regenerate study content');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-semibold text-white mb-2">Documents</h3>
          <p className="text-base text-[#9ca3af]">
            {documents.length} document{documents.length !== 1 ? 's' : ''} attached
          </p>
        </div>
        <Button
          onClick={handleBrowseClick}
          className="flex items-center gap-2"
        >
          <IoAdd className="w-5 h-5" />
          Add Document
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.mp3,.wav,.mp4,.mov,.avi"
        />
      </div>

      {documents.length > 0 ? (
        <div className="space-y-3">
          {documents.map((doc) => {
            const isAudio = doc.type === 'audio' || doc.type === 'video';
            const audioUrl = audioUrls[doc.id];

            return (
              <div key={doc.id}>
                <div
                  className="flex items-center justify-between p-4 bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] hover:bg-[#323232] hover:border-[#4a4a4a] transition-all"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className="text-3xl flex-shrink-0">{getDocumentIcon(doc.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-base font-medium truncate">{doc.name}</p>
                      <div className="flex items-center gap-3 text-sm text-[#9ca3af] mt-1">
                        <span className="capitalize">{doc.type}</span>
                        <span>•</span>
                        <span>{formatFileSize(doc.size)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-2 rounded-lg hover:bg-[#3a3a3a] transition-colors text-[#9ca3af] hover:text-white ml-4"
                    title="Download document"
                  >
                    <IoDownloadOutline className="w-6 h-6" />
                  </button>
                </div>
                
                {/* Audio Player for audio/video files */}
                {isAudio && audioUrl && (
                  <div className="mt-2">
                    <AudioPlayer audioUrl={audioUrl} title={doc.name} />
                  </div>
                )}
                {isAudio && !audioUrl && (
                  <div className="mt-2 text-xs text-[#9ca3af] p-2 bg-[#1a1a1a] rounded">
                    Loading audio...
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Regenerate Button */}
          <div className="mt-8 pt-6 border-t border-[#3a3a3a]">
            <Button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="w-full flex items-center justify-center gap-2"
            >
              <IoRefresh className={`w-5 h-5 ${isRegenerating ? 'animate-spin' : ''}`} />
              {isRegenerating ? 'Regenerating Study Content...' : 'Regenerate Study Content'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-16">
          <HiDocument className="w-16 h-16 mx-auto mb-4 text-[#9ca3af]" />
          <p className="text-base text-[#9ca3af]">
            No documents attached. Click "Add Document" to upload files.
          </p>
        </div>
      )}
    </div>
  );
};

