import { supabase } from './supabase';

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

  async transcribeAudio(audioBlob: Blob): Promise<string> {
    // Check file size - Supabase Edge Functions have ~6MB limit for request body
    // Base64 encoding increases size by ~33%, so we limit to ~4.5MB raw to be safe
    const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5 MB
    
    if (audioBlob.size > MAX_FILE_SIZE) {
      const sizeMB = (audioBlob.size / (1024 * 1024)).toFixed(2);
      throw new Error(
        `Audio file is too large (${sizeMB} MB). Maximum size is 4.5 MB. ` +
        `Please record a shorter audio or compress the file.`
      );
    }

    try {
      // Convert blob to base64 efficiently
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
      const base64 = btoa(binaryString);
      const mimeType = audioBlob.type || 'audio/webm';

      let data, error;
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
        // Catch errors from Supabase client itself (e.g., when server returns HTML)
        const errorMessage = invokeError?.message || String(invokeError);
        
        // Check for HTML error response (indicates payload too large before reaching edge function)
        if (errorMessage.includes('text/html') || 
            errorMessage.includes('JSON') && errorMessage.includes('parse') ||
            errorMessage.includes('Unexpected token')) {
          throw new Error(
            'Audio file is too large to process. The request was rejected before processing. ' +
            'Please record a shorter audio (under 2 minutes) or split it into smaller segments.'
          );
        }
        
        // Re-throw other invoke errors
        throw invokeError;
      }

      if (error) {
        // Supabase wraps non-2xx as error; try to parse limit response shape
        const errBody: any = (error as any)?.context || {};
        
        // Check for daily limit error
        if (errBody?.code === 'DAILY_LIMIT_REACHED') {
          throw new DailyLimitError(errBody?.message || 'Daily limit reached', {
            limit: errBody.limit ?? 15,
            remaining: errBody.remaining ?? 0,
            resetAt: errBody.resetAt ?? new Date().toISOString(),
            code: 'DAILY_LIMIT_REACHED',
          });
        }
        
        // Check if it's a size/payload error
        const errorMessage = (error as any)?.message || String(error);
        if (errorMessage.includes('Payload Too Large') || 
            errorMessage.includes('413') ||
            errorMessage.includes('Request Entity Too Large') ||
            errorMessage.includes('too large') ||
            errorMessage.includes('text/html')) {
          throw new Error(
            'Audio file is too large to process. Please record a shorter audio (under 2 minutes) or split it into smaller segments.'
          );
        }
        
        // Check for timeout errors
        if (errorMessage.includes('timeout') || errorMessage.includes('504')) {
          throw new Error(
            'Transcription request timed out. The audio file may be too large. Please try a shorter recording.'
          );
        }
        
        throw error;
      }

      return (data as any)?.text ?? '';
    } catch (error) {
      // Re-throw DailyLimitError as-is
      if (error instanceof DailyLimitError) {
        throw error;
      }
      
      // Wrap other errors with more context
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('too large') || errorMessage.includes('size')) {
        throw error; // Already has good message
      }
      
      throw new Error(`Failed to transcribe audio: ${errorMessage}`);
    }
  },
};


