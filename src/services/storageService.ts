/**
 * Enhanced storage service with chunked uploads, resumption, and progress tracking
 */
import { supabase } from './supabase';
import { withRetry } from '../utils/errorHandler';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed: number; // bytes per second
  timeRemaining: number; // seconds
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  userId: string;
  chunkSize?: number;
}

export interface ChunkUploadState {
  fileId: string;
  fileName: string;
  totalChunks: number;
  uploadedChunks: number[];
  storagePath: string;
}

/**
 * Compress image to WebP format if possible
 */
async function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<File> {
  // Only compress images
  if (!file.type.startsWith('image/')) {
    return file;
  }

  try {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(file); // Fallback to original
        return;
      }

      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
                type: 'image/webp',
                lastModified: file.lastModified,
              });
              
              // Only use compressed if it's smaller
              if (compressedFile.size < file.size) {
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            } else {
              resolve(file);
            }
          },
          'image/webp',
          quality
        );
      };

      img.onerror = () => resolve(file); // Fallback to original on error
      img.src = URL.createObjectURL(file);
    });
  } catch (error) {
    // Fallback to original file on any error
    return file;
  }
}

/**
 * Get or create upload state in localStorage
 */
function getUploadState(fileId: string): ChunkUploadState | null {
  try {
    const stored = localStorage.getItem(`upload_${fileId}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Save upload state to localStorage
 */
function saveUploadState(state: ChunkUploadState): void {
  try {
    localStorage.setItem(`upload_${state.fileId}`, JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save upload state:', error);
  }
}

/**
 * Clear upload state
 */
function clearUploadState(fileId: string): void {
  try {
    localStorage.removeItem(`upload_${fileId}`);
  } catch {
    // Ignore
  }
}

/**
 * Upload a single chunk
 */
async function uploadChunk(
  chunk: Blob,
  chunkIndex: number,
  storagePath: string,
  _options: UploadOptions
): Promise<void> {
  const chunkPath = `${storagePath}.chunk.${chunkIndex}`;
  
  await withRetry(async () => {
    const { error } = await supabase.storage
      .from('documents')
      .upload(chunkPath, chunk, {
        upsert: true,
      });

    if (error) throw error;
  });
}

/**
 * Combine chunks into final file
 */
async function combineChunks(
  storagePath: string,
  totalChunks: number,
  _userId: string
): Promise<void> {
  // For Supabase, we need to read all chunks and combine them
  // This is a simplified version - in production, you might want server-side chunking
  
  const chunks: Blob[] = [];
  
  for (let i = 0; i < totalChunks; i++) {
    const chunkPath = `${storagePath}.chunk.${i}`;
    const { data, error } = await supabase.storage
      .from('documents')
      .download(chunkPath);
    
    if (error || !data) {
      throw new Error(`Failed to download chunk ${i}`);
    }
    
    chunks.push(data);
  }

  // Combine chunks
  const combinedBlob = new Blob(chunks);
  
  // Upload combined file
  const { error } = await supabase.storage
    .from('documents')
    .upload(storagePath, combinedBlob, {
      upsert: true,
    });

  if (error) throw error;

  // Clean up chunks
  const chunkPaths = Array.from({ length: totalChunks }, (_, i) => `${storagePath}.chunk.${i}`);
  await supabase.storage
    .from('documents')
    .remove(chunkPaths);
}

/**
 * Enhanced upload with chunking and progress tracking
 */
export async function uploadFileWithProgress(
  file: File,
  options: UploadOptions
): Promise<string> {
  const { userId, onProgress, chunkSize = CHUNK_SIZE } = options;
  
  // Compress images before upload
  const processedFile = await compressImage(file);
  
  const fileId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const fileExt = processedFile.name.split('.').pop();
  const storagePath = `${userId}/${Date.now()}.${fileExt}`;
  
  const startTime = Date.now();

  // Check for existing upload state (resume)
  let uploadState = getUploadState(fileId);
  const shouldChunk = processedFile.size > LARGE_FILE_THRESHOLD;

  if (!uploadState && shouldChunk) {
    // Create new upload state
    const totalChunks = Math.ceil(processedFile.size / chunkSize);
    uploadState = {
      fileId,
      fileName: processedFile.name,
      totalChunks,
      uploadedChunks: [],
      storagePath,
    };
    saveUploadState(uploadState);
  }

  if (shouldChunk && uploadState) {
    // Chunked upload
    const { totalChunks, uploadedChunks } = uploadState;
    let totalUploaded = uploadedChunks.length * chunkSize;

    for (let i = 0; i < totalChunks; i++) {
      if (uploadedChunks.includes(i)) {
        continue; // Skip already uploaded chunks
      }

      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, processedFile.size);
      const chunk = processedFile.slice(start, end);

      await uploadChunk(chunk, i, storagePath, options);
      
      uploadedChunks.push(i);
      totalUploaded = uploadedChunks.length * chunkSize;
      uploadState.uploadedChunks = uploadedChunks;
      saveUploadState(uploadState);

      // Calculate progress
      const now = Date.now();
      const timeElapsed = (now - startTime) / 1000;
      const loaded = totalUploaded;
      const total = processedFile.size;
      const speed = timeElapsed > 0 ? loaded / timeElapsed : 0;
      const remaining = total - loaded;
      const timeRemaining = speed > 0 ? remaining / speed : 0;

      if (onProgress) {
        onProgress({
          loaded,
          total,
          percentage: Math.min((loaded / total) * 100, 99), // Cap at 99% until combine
          speed,
          timeRemaining,
        });
      }
    }

    // Combine chunks
    await combineChunks(storagePath, totalChunks, userId);

    if (onProgress) {
      onProgress({
        loaded: processedFile.size,
        total: processedFile.size,
        percentage: 100,
        speed: 0,
        timeRemaining: 0,
      });
    }

    clearUploadState(fileId);
  } else {
    // Simple upload for small files
    let loaded = 0;

    // Note: Supabase doesn't support progress tracking natively
    // This is a simplified implementation
    await withRetry(async () => {
      const { error } = await supabase.storage
        .from('documents')
        .upload(storagePath, processedFile);

      if (error) throw error;
      loaded = processedFile.size;
    });

    if (onProgress) {
      const now = Date.now();
      const timeElapsed = (now - startTime) / 1000;
      const speed = timeElapsed > 0 ? loaded / timeElapsed : 0;

      onProgress({
        loaded,
        total: processedFile.size,
        percentage: 100,
        speed,
        timeRemaining: 0,
      });
    }
  }

  return storagePath;
}

/**
 * Simple upload (backward compatible)
 */
export async function uploadFile(userId: string, file: File): Promise<string> {
  // Use chunked upload for large files, simple upload for small files
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;

  // For files < 10MB, use simple upload
  if (file.size < LARGE_FILE_THRESHOLD) {
    const compressedFile = await compressImage(file);
    await withRetry(async () => {
      const { error } = await supabase.storage
        .from('documents')
        .upload(fileName, compressedFile);

      if (error) throw error;
    });
    return fileName;
  }

  // For large files, use chunked upload
  return uploadFileWithProgress(file, { userId });
}

/**
 * Get file URL for playback/display
 * Creates a signed URL that works for audio/video streaming
 */
export async function getFileUrl(path: string): Promise<string> {
  try {
    // Create a signed URL that expires in 1 hour (good for playback)
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(path, 3600); // 1 hour expiry

    if (error || !data) {
      console.warn('Failed to create signed URL, trying public URL:', error);
      // Fallback to public URL if signed URL fails
      const urlData = supabase.storage
        .from('documents')
        .getPublicUrl(path);
      return urlData.data.publicUrl;
    }

    return data.signedUrl;
  } catch (err) {
    console.error('Error creating file URL:', err);
    // Final fallback to public URL
    const urlData = supabase.storage
      .from('documents')
      .getPublicUrl(path);
    return urlData.data.publicUrl;
  }
}

/**
 * Download file
 */
export async function downloadFile(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from('documents')
    .download(path);

  if (error) throw error;
  return data;
}

/**
 * Delete file
 */
export async function deleteFile(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from('documents')
    .remove([path]);

  if (error) throw error;
}

// Export default object for backward compatibility
export const storageService = {
  uploadFile,
  getFileUrl,
  downloadFile,
  deleteFile,
  uploadFileWithProgress,
};

