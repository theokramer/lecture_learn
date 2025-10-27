import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../shared/Modal';
import { LoadingBar } from '../shared/LoadingBar';
import { Button } from '../shared/Button';
import { IoCloudUpload, IoClose } from 'react-icons/io5';
import { HiDocument } from 'react-icons/hi2';

interface DocumentUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ isOpen, onClose, onComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [task, setTask] = useState('Preparing upload...');

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file => {
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'audio/mpeg', 'audio/wav', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
      return validTypes.includes(file.type);
    });
    setFiles([...files, ...validFiles].slice(0, 3));
  }, [files]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(file => {
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'audio/mpeg', 'audio/wav', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
      return validTypes.includes(file.type);
    });
    setFiles([...files, ...validFiles].slice(0, 3));
  }, [files]);

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    // Close the modal when uploading starts
    onClose();
    
    const tasks = ['Analyzing documents...', 'Extracting audio...', 'Processing content...', 'Creating notes...'];
    
    for (let i = 0; i < tasks.length; i++) {
      for (let p = 0; p <= 100; p += 10) {
        await new Promise(resolve => setTimeout(resolve, 50));
        setProgress(p);
        setTask(tasks[i]);
      }
    }

    setTimeout(() => {
      setUploading(false);
      onComplete();
    }, 500);
  };

  return (
    <>
      <AnimatePresence>
        {uploading && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg px-8"
            >
              <div className="bg-[#1a1a1a] rounded-3xl p-12 border border-[#3a3a3a]">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-white mb-2">Creating new notes</h2>
                  <p className="text-[#9ca3af]">Processing your documents...</p>
                </div>
                <LoadingBar progress={progress} currentTask={task} estimatedTime="This should take a few minutes..." />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Modal isOpen={isOpen && !uploading} onClose={onClose} title="Upload Documents" size="lg">
        <div className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-[#3a3a3a] rounded-lg p-8 text-center hover:border-[#b85a3a] transition-colors"
          >
            <IoCloudUpload className="w-12 h-12 mx-auto mb-4 text-[#9ca3af]" />
            <p className="text-white mb-2">Drag and drop files here</p>
            <p className="text-sm text-[#9ca3af] mb-4">or</p>
            <label className="inline-block">
              <Button variant="secondary" size="sm">Browse Files</Button>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.mp3,.wav,.mp4,.mov,.avi"
              />
            </label>
            <p className="text-xs text-[#9ca3af] mt-4">
              Supported: PDF, DOC, DOCX, TXT, MP3, WAV, MP4, MOV, AVI (Max 3 files)
            </p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-white">Selected Files ({files.length}/3)</h4>
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <HiDocument className="w-5 h-5 text-[#9ca3af]" />
                    <div>
                      <p className="text-white text-sm">{file.name}</p>
                      <p className="text-xs text-[#9ca3af]">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="p-1 hover:bg-[#3a3a3a] rounded transition-colors"
                  >
                    <IoClose className="w-5 h-5 text-[#9ca3af]" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleUpload} disabled={files.length === 0}>
              Upload
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
