import { supabase, storageService } from './supabase';

export class DailyLimitError extends Error {
  limit: number;
  remaining: number;
  resetAt: string;
  code: string;
  constructor(message: string, info: { limit: number; remaining: number; resetAt: string; code: string }) {
    super(message);
    this.limit = info.limit;
    this.remaining = info.remaining;
    this.resetAt = info.resetAt;
    this.code = info.code;
  }
}

export const aiGateway = {
  async chatCompletion(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options?: { model?: string; temperature?: number }
  ): Promise<string> {
    const { data, error } = await supabase.functions.invoke('ai-generate', {
      body: {
        type: 'chat',
        messages,
        model: options?.model || 'gpt-4o-mini',
        temperature: options?.temperature ?? 0.7,
      },
    } as any);

    if (error) {
      // Supabase wraps non-2xx as error; try to parse limit response shape
      const errBody: any = (error as any)?.context || {};
      if (errBody?.code === 'DAILY_LIMIT_REACHED') {
        throw new DailyLimitError(errBody?.message || 'Daily limit reached', {
          limit: errBody.limit ?? 15,
          remaining: errBody.remaining ?? 0,
          resetAt: errBody.resetAt ?? new Date().toISOString(),
          code: 'DAILY_LIMIT_REACHED',
        });
      }
      throw error;
    }

    return (data as any)?.content ?? '';
  },

  async transcribeAudio(audioBlob: Blob, storagePath?: string, userId?: string): Promise<string> {
    // Threshold for using storage-based transcription (2MB - safe for direct base64)
    // Files larger than this will use storage-based approach
    const STORAGE_THRESHOLD = 2 * 1024 * 1024; // 2 MB
    
    try {
      let finalStoragePath = storagePath;
      
      // If storage path is already provided, always use it (ProcessingPage uploads first)
      // Otherwise, check if file is large enough to require storage
      if (!finalStoragePath && audioBlob.size > STORAGE_THRESHOLD) {
        if (!userId) {
          throw new Error('UserId required for large audio file transcription');
        }
        
        // Upload audio to storage for large files
        const audioFile = new File([audioBlob], 'recording.webm', { 
          type: audioBlob.type || 'audio/webm' 
        });
        finalStoragePath = await storageService.uploadFile(userId, audioFile);
      }

      let data, error;
      
      // Always use storage path if provided (preferred method for reliability)
      if (finalStoragePath) {
        console.log(`Using storage-based transcription for path: ${finalStoragePath}`);
        try {
          const result = await supabase.functions.invoke('ai-generate', {
            body: {
              type: 'transcription',
              storagePath: finalStoragePath,
            },
          } as any);
          data = result.data;
          error = result.error;
        } catch (invokeError: any) {
          const errorMessage = invokeError?.message || String(invokeError);
          if (errorMessage.includes('text/html') || 
              errorMessage.includes('JSON') && errorMessage.includes('parse')) {
            throw new Error(
              'Failed to transcribe audio from storage. Please try again.'
            );
          }
          throw invokeError;
        }
      } else {
        // Use direct base64 only for small files when no storage path is provided
        console.log(`Using direct base64 transcription for small file (${audioBlob.size} bytes)`);
        // Use direct base64 for small files
        const arrayBuffer = await audioBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
        const base64 = btoa(binaryString);
        const mimeType = audioBlob.type || 'audio/webm';

        try {
          const result = await supabase.functions.invoke('ai-generate', {
            body: {
              type: 'transcription',
              audioBase64: base64,
              mimeType,
            },
          } as any);
          data = result.data;
          error = result.error;
        } catch (invokeError: any) {
          const errorMessage = invokeError?.message || String(invokeError);
          
          if (errorMessage.includes('text/html') || 
              errorMessage.includes('JSON') && errorMessage.includes('parse') ||
              errorMessage.includes('Unexpected token')) {
            // Fallback to storage-based approach if direct upload fails
            console.log('Direct base64 transcription failed, falling back to storage-based approach');
            if (!userId) {
              throw new Error(
                'Audio file is too large to process directly. Please record a shorter audio.'
              );
            }
            // Upload and retry with storage approach
            const audioFile = new File([audioBlob], 'recording.webm', { 
              type: audioBlob.type || 'audio/webm' 
            });
            const fallbackStoragePath = await storageService.uploadFile(userId, audioFile);
            
            const retryResult = await supabase.functions.invoke('ai-generate', {
              body: {
                type: 'transcription',
                storagePath: fallbackStoragePath,
              },
            } as any);
            data = retryResult.data;
            error = retryResult.error;
          } else {
            throw invokeError;
          }
        }
      }

      if (error) {
        const errBody: any = (error as any)?.context || {};
        
        if (errBody?.code === 'DAILY_LIMIT_REACHED') {
          throw new DailyLimitError(errBody?.message || 'Daily limit reached', {
            limit: errBody.limit ?? 15,
            remaining: errBody.remaining ?? 0,
            resetAt: errBody.resetAt ?? new Date().toISOString(),
            code: 'DAILY_LIMIT_REACHED',
          });
        }
        
        const errorMessage = (error as any)?.message || String(error);
        if (errorMessage.includes('timeout') || errorMessage.includes('504')) {
          throw new Error(
            'Transcription request timed out. Please try again.'
          );
        }
        
        throw error;
      }

      const transcriptionText = (data as any)?.text ?? '';
      
      // Log transcription details for debugging
      console.log(`Transcription received: ${transcriptionText.length} characters, ${transcriptionText.split(/\s+/).length} words`);
      if (transcriptionText.length < 100) {
        console.warn('Warning: Transcription seems unusually short. Expected longer text for recording.');
      }
      
      return transcriptionText;
    } catch (error) {
      if (error instanceof DailyLimitError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Transcription error:', errorMessage);
      throw new Error(`Failed to transcribe audio: ${errorMessage}`);
    }
  },
};


