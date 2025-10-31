import React, { useRef, useState, useEffect } from 'react';
import { IoAdd, IoDownloadOutline, IoRefresh, IoEyeOutline, IoPencil, IoCheckmark, IoClose } from 'react-icons/io5';
import { HiDocument } from 'react-icons/hi2';
import { useAppData } from '../../context/AppDataContext';
import { Button } from '../shared/Button';
import { storageService, studyContentService, documentService, supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { AudioPlayer } from '../audio/AudioPlayer';
import { DocumentPreview } from './DocumentPreview';
import { EmptyState } from '../shared/EmptyState';
import toast from 'react-hot-toast';
import { handleError } from '../../utils/errorHandler';

export const DocumentManagement: React.FC = React.memo(() => {
  const { notes, selectedNoteId, uploadDocumentToNote, refreshData } = useAppData();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [previewDocument, setPreviewDocument] = useState<{ id: string; name: string; type: string; url: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggedOverId, setDraggedOverId] = useState<string | null>(null);
  const [initialContentHash, setInitialContentHash] = useState<string>('');
  const previousNoteIdRef = useRef<string | null>(null);

  const currentNote = notes.find(n => n.id === selectedNoteId);
  const documents = currentNote?.documents || [];

  // Track initial content to detect modifications
  // Reset initial content hash when note changes
  useEffect(() => {
    // If note ID changed, reset the initial content hash
    if (selectedNoteId !== previousNoteIdRef.current) {
      previousNoteIdRef.current = selectedNoteId;
      // Find the note from the current notes array
      const note = notes.find(n => n.id === selectedNoteId);
      if (note?.content !== undefined) {
        setInitialContentHash(note.content || '');
      } else {
        setInitialContentHash('');
      }
    }
  }, [selectedNoteId, notes]);

  // Check if content has been modified (compare current content with initial content)
  const hasContentChanged = currentNote?.content !== undefined && 
                            currentNote.content !== initialContentHash && 
                            initialContentHash !== '' &&
                            currentNote.content !== '';

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
          handleError(error, `DocumentManagement: Loading audio URL for ${doc.id}`, toast.error);
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
      handleError(error, 'DocumentManagement: Uploading documents', toast.error);
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
      handleError(error, 'DocumentManagement: Downloading document', toast.error);
    }
  };

  const handleRegenerate = async () => {
    if (!currentNote || !selectedNoteId || !user) return;

    setIsRegenerating(true);
    try {
      // Fetch the latest note content directly from the database to ensure we have the most up-to-date content
      const { data: noteData, error: noteError } = await supabase
        .from('notes')
        .select('content')
        .eq('id', selectedNoteId)
        .eq('user_id', user.id)
        .single();

      if (noteError || !noteData) {
        toast.error('Failed to fetch latest note content');
        return;
      }

      const latestContent = noteData.content || '';

      await studyContentService.generateAndSaveAllStudyContent(selectedNoteId, latestContent);
      
      // Update initial content hash to reflect that we've regenerated
      setInitialContentHash(latestContent);
      
      // Refresh data to update the UI
      await refreshData();
      
      toast.success('Study content regenerated successfully!');
    } catch (error) {
      handleError(error, 'DocumentManagement: Regenerating study content', toast.error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handlePreview = (doc: any) => {
    // Only show preview for PDFs and images
    if (doc.type === 'pdf' || doc.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      setPreviewDocument(doc);
    }
  };

  const handleStartRename = (doc: any) => {
    setRenamingId(doc.id);
    setRenameValue(doc.name);
  };

  const handleSaveRename = async (docId: string) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }

    try {
      await documentService.renameDocument(docId, renameValue.trim());
      setRenamingId(null);
      await refreshData();
    } catch (error) {
      handleError(error, 'DocumentManagement: Renaming document', toast.error);
    }
  };

  const handleCancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  const handleDragStart = (e: React.DragEvent, docId: string) => {
    setDraggedId(docId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, docId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedId && draggedId !== docId) {
      setDraggedOverId(docId);
    }
  };

  const handleDragLeave = () => {
    setDraggedOverId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetDocId: string) => {
    e.preventDefault();
    
    if (!draggedId || draggedId === targetDocId || !currentNote) {
      setDraggedId(null);
      setDraggedOverId(null);
      return;
    }

    try {
      const draggedDoc = documents.find(d => d.id === draggedId);
      const targetDoc = documents.find(d => d.id === targetDocId);
      
      if (!draggedDoc || !targetDoc) return;

      // Calculate new order based on target position
      const draggedIndex = documents.findIndex(d => d.id === draggedId);
      const targetIndex = documents.findIndex(d => d.id === targetDocId);

      // Create a new date that places the dragged item after the target
      const baseDate = new Date(targetDoc.uploadedAt);
      const newDate = new Date(baseDate.getTime() + (draggedIndex < targetIndex ? 1000 : -1000));

      await documentService.updateDocumentOrder(draggedId, newDate);
      await refreshData();
    } catch (error) {
      handleError(error, 'DocumentManagement: Reordering document', toast.error);
    } finally {
      setDraggedId(null);
      setDraggedOverId(null);
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6 pb-8 lg:pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 lg:mb-6">
        <div>
          <h3 className="text-xl lg:text-2xl font-semibold text-white mb-2">Documents</h3>
          <p className="text-sm lg:text-base text-[#9ca3af]">
            {documents.length} document{documents.length !== 1 ? 's' : ''} attached
          </p>
        </div>
        <Button
          onClick={handleBrowseClick}
          className="flex items-center justify-center gap-2 w-full sm:w-auto"
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
            const isRenaming = renamingId === doc.id;
            const isDraggedOver = draggedOverId === doc.id;
            const canPreview = doc.type === 'pdf' || doc.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);

            return (
              <div key={doc.id}>
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, doc.id)}
                  onDragOver={(e) => handleDragOver(e, doc.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, doc.id)}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 lg:p-4 bg-[#2a2a2a] rounded-lg border border-[#3a3a3a] hover:bg-[#323232] hover:border-[#4a4a4a] transition-all cursor-move ${
                    isDraggedOver ? 'border-[#b85a3a] bg-[#323232]' : ''
                  } ${draggedId === doc.id ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-3 lg:gap-4 flex-1 min-w-0">
                <span className="text-2xl lg:text-3xl flex-shrink-0">{getDocumentIcon(doc.type)}</span>
                <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(doc.id);
                              if (e.key === 'Escape') handleCancelRename();
                            }}
                            className="flex-1 px-2 py-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded text-white text-sm lg:text-base"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(doc.id)}
                            className="p-1 rounded hover:bg-[#3a3a3a] text-green-400"
                            title="Save"
                          >
                            <IoCheckmark className="w-4 h-4 lg:w-5 lg:h-5" />
                          </button>
                          <button
                            onClick={handleCancelRename}
                            className="p-1 rounded hover:bg-[#3a3a3a] text-red-400"
                            title="Cancel"
                          >
                            <IoClose className="w-4 h-4 lg:w-5 lg:h-5" />
                          </button>
                        </div>
                      ) : (
                        <>
                  <p className="text-white text-sm lg:text-base font-medium truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 lg:gap-3 text-xs lg:text-sm text-[#9ca3af] mt-1">
                    <span className="capitalize">{doc.type}</span>
                    <span>•</span>
                    <span>{formatFileSize(doc.size)}</span>
                  </div>
                        </>
                      )}
                </div>
              </div>
                  <div className="flex items-center gap-2 sm:ml-4 justify-end sm:justify-start">
                    {canPreview && !isRenaming && (
                      <button
                        onClick={() => handlePreview(doc)}
                        className="p-2 rounded-lg hover:bg-[#3a3a3a] transition-colors text-[#9ca3af] hover:text-white"
                        title="Preview document"
                      >
                        <IoEyeOutline className="w-4 h-4 lg:w-5 lg:h-5" />
                      </button>
                    )}
                    {!isRenaming && (
                      <button
                        onClick={() => handleStartRename(doc)}
                        className="p-2 rounded-lg hover:bg-[#3a3a3a] transition-colors text-[#9ca3af] hover:text-white"
                        title="Rename document"
                      >
                        <IoPencil className="w-4 h-4 lg:w-5 lg:h-5" />
                      </button>
                    )}
              <button
                onClick={() => handleDownload(doc)}
                      className="p-2 rounded-lg hover:bg-[#3a3a3a] transition-colors text-[#9ca3af] hover:text-white"
                title="Download document"
              >
                      <IoDownloadOutline className="w-4 h-4 lg:w-5 lg:h-5" />
              </button>
            </div>
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
          
          {/* Regenerate Button - Only show if content has been modified */}
          {hasContentChanged && (
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
          )}
        </div>
      ) : (
        <EmptyState
          icon={HiDocument}
          title="No Documents Yet"
          description="Upload PDFs, audio files, videos, or text documents to enhance your notes. Documents help AI generate better summaries and study materials."
          action={{
            label: 'Add Document',
            onClick: handleBrowseClick,
            variant: 'primary',
          }}
        />
      )}

      {previewDocument && (
        <DocumentPreview
          document={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      )}
    </div>
  );
});
DocumentManagement.displayName = 'DocumentManagement';

