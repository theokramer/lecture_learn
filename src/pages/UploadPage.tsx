import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoCloudUpload, IoClose, IoArrowBack } from 'react-icons/io5';
import { HiDocument } from 'react-icons/hi2';
import { documentProcessor } from '../services/documentProcessor';
import { useAuth } from '../context/AuthContext';
import { openaiService } from '../services/openai';
import { storageService } from '../services/supabase';

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file => {
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'audio/mpeg', 'audio/wav', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
      return validTypes.includes(file.type);
    });
    setFiles([...files, ...validFiles]); // Removed .slice(0, 3) to allow unlimited files
  }, [files]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(file => {
      const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'audio/mpeg', 'audio/wav', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
      return validTypes.includes(file.type);
    });
    setFiles([...files, ...validFiles]); // Removed .slice(0, 3) to allow unlimited files
  }, [files]);

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0 || !user) return;

    setUploading(true);
    try {
      let combinedText = '';
      const title = files.length === 1 
        ? files[0].name.replace(/\.[^/.]+$/, '') 
        : `Uploaded ${files.length} files`;

      // Array to store file metadata
      const fileMetadata: Array<{ file: File; storagePath: string }> = [];

      // Process each file
      for (const file of files) {
        console.log(`Processing file: ${file.name}, type: ${file.type}`);
        
        try {
          // Upload file to storage
          const storagePath = await storageService.uploadFile(user.id, file);
          fileMetadata.push({ file, storagePath });

          // Extract content
          if (documentProcessor.isAudioFile(file.type)) {
            // Audio file - transcribe
            const blob = new Blob([file], { type: file.type });
            const transcription = await openaiService.transcribeAudio(blob);
            combinedText += `File: ${file.name}\n${transcription}\n\n`;
          } else if (documentProcessor.isVideoFile(file.type)) {
            // Video file - extract audio and transcribe
            const audioBlob = await documentProcessor.extractAudioFromVideo(file);
            const transcription = await openaiService.transcribeAudio(audioBlob);
            combinedText += `File: ${file.name}\n${transcription}\n\n`;
          } else {
            // Document file (PDF, DOC, TXT, etc.)
            const { text } = await documentProcessor.processDocument(file);
            combinedText += `File: ${file.name}\n${text}\n\n`;
          }
        } catch (fileError) {
          console.error(`Error processing ${file.name}:`, fileError);
          combinedText += `File: ${file.name}\n[Error processing file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}]\n\n`;
        }
      }

      // Navigate to processing with the text and file metadata
      navigate('/note-creation/processing', {
        state: {
          text: combinedText,
          title: title,
          fileMetadata: fileMetadata
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload files. Please try again.');
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] px-8 py-12 pb-20">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <button
          onClick={() => navigate('/note-creation')}
          className="text-[#9ca3af] hover:text-white mb-8 transition-colors inline-flex items-center gap-2"
        >
          <IoArrowBack className="w-5 h-5" />
          Back
        </button>

        <h1 className="text-4xl font-bold text-white mb-4">Upload Documents</h1>
        <p className="text-[#9ca3af] text-lg mb-12">Upload your documents, audio, or video files</p>

        {/* Upload Area */}
        <div className="bg-[#2a2a2a] rounded-3xl p-12 border border-[#3a3a3a]">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-[#3a3a3a] rounded-xl p-12 text-center hover:border-[#b85a3a] transition-colors"
          >
            <IoCloudUpload className="w-16 h-16 mx-auto mb-6 text-[#9ca3af]" />
            <p className="text-white text-xl mb-2">Drag and drop files here</p>
            <p className="text-sm text-[#9ca3af] mb-6">or</p>
            <label className="inline-block px-6 py-3 bg-[#b85a3a] hover:bg-[#a04a2a] text-white rounded-lg font-medium transition-colors cursor-pointer">
              Browse Files
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.mp3,.wav,.mp4,.mov,.avi"
              />
            </label>
            <p className="text-xs text-[#9ca3af] mt-6">
              Supported: PDF, DOC, DOCX, TXT, MP3, WAV, MP4, MOV, AVI
            </p>
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="mt-8 space-y-4">
              <h4 className="text-lg font-medium text-white">Selected Files ({files.length})</h4>
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-[#1a1a1a] rounded-lg border border-[#3a3a3a]"
                >
                  <div className="flex items-center gap-4">
                    <HiDocument className="w-8 h-8 text-[#9ca3af]" />
                    <div>
                      <p className="text-white font-medium">{file.name}</p>
                      <p className="text-sm text-[#9ca3af]">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="p-2 hover:bg-[#3a3a3a] rounded transition-colors"
                  >
                    <IoClose className="w-6 h-6 text-[#9ca3af]" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end mt-10 mb-4">
            <button
              onClick={() => navigate('/note-creation')}
              className="px-6 py-3 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={files.length === 0 || uploading}
              className="px-6 py-3 bg-[#b85a3a] hover:bg-[#a04a2a] disabled:bg-[#3a3a3a] disabled:text-[#6b7280] text-white rounded-lg font-medium transition-colors"
            >
              {uploading ? 'Processing...' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

