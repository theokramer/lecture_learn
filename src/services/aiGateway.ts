import { supabase, storageService } from './supabase';

export class RateLimitError extends Error {
  limit: number;
  remaining: number;
  resetAt?: string;
  code: string;
  usedAt?: string;
  
  constructor(message: string, info: { limit: number; remaining: number; code: string; resetAt?: string; usedAt?: string }) {
    super(message);
    this.limit = info.limit;
    this.remaining = info.remaining;
    this.resetAt = info.resetAt;
    this.code = info.code;
    this.usedAt = info.usedAt;
  }
}

// Keep alias for backwards compatibility
export const DailyLimitError = RateLimitError;

/**
 * Check if user has reached their daily AI usage limit
 * @param userId - User ID to check
 * @throws RateLimitError if limit is reached
 */
export async function checkRateLimit(userId: string): Promise<void> {
  try {
    // Get today's date in UTC (YYYY-MM-DD)
    const today = new Date();
    const usageDate = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
    
    // Get user's daily limit (may not exist, so use maybeSingle)
    const { data: accountLimit, error: limitError } = await supabase
      .from('account_limits')
      .select('daily_ai_limit')
      .eq('user_id', userId)
      .maybeSingle();
    
    // If error and it's not "no rows", throw it
    if (limitError && limitError.code !== 'PGRST116') {
      console.warn('Error checking account limit:', limitError);
    }
    
    // Default to 30 to match backend default
    const dailyLimit = accountLimit?.daily_ai_limit ?? 30;
    
    // Get today's usage count (may not exist yet, so use maybeSingle)
    const { data: usageData, error: usageError } = await supabase
      .from('daily_ai_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('usage_date', usageDate)
      .maybeSingle();
    
    // If error and it's not "no rows", throw it
    if (usageError && usageError.code !== 'PGRST116') {
      console.warn('Error checking daily usage:', usageError);
    }
    
    const currentCount = usageData?.count ?? 0;
    
    // Check if limit reached
    if (currentCount >= dailyLimit) {
      // Calculate reset time (tomorrow at 00:00 UTC)
      const reset = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1, 0, 0, 0));
      
      throw new RateLimitError(
        `You have reached your daily AI generation limit (${dailyLimit}). Please try again tomorrow.`,
        {
          limit: dailyLimit,
          remaining: 0,
          resetAt: reset.toISOString(),
          code: 'DAILY_LIMIT_REACHED',
        }
      );
    }
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw error; // Re-throw rate limit errors
    }
    // If database query fails, don't block - let the actual generation fail instead
    // This prevents blocking users due to database connectivity issues
    console.warn('Failed to check rate limit:', error);
    // Don't throw - let the actual AI call fail if limit is truly reached
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
      
      // Also check if error itself is the parsed body
      let errorCode = errBody?.code;
      let errorMsg = errBody?.message;
      
      // Handle 429 responses (might be wrapped differently)
      if ((error as any)?.status === 429) {
        errorCode = 'DAILY_LIMIT_REACHED';
        errorMsg = 'Daily limit reached';
      }
      
      if (errorCode === 'DAILY_LIMIT_REACHED') {
        throw new RateLimitError(errorMsg || 'Daily limit reached', {
          limit: errBody.limit ?? 15,
          remaining: errBody.remaining ?? 0,
          resetAt: errBody.resetAt ?? new Date().toISOString(),
          code: 'DAILY_LIMIT_REACHED',
        });
      }
      if (errorCode === 'ACCOUNT_LIMIT_REACHED') {
        throw new RateLimitError(errorMsg || 'Account limit reached - you have already used your one-time AI generation quota', {
          limit: 1,
          remaining: 0,
          code: 'ACCOUNT_LIMIT_REACHED',
          usedAt: errBody.usedAt,
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
        console.log('Request payload:', {
          type: 'transcription',
          storagePath: finalStoragePath,
          storagePathType: typeof finalStoragePath,
          storagePathLength: finalStoragePath.length,
        });
        try {
          const result = await supabase.functions.invoke('ai-generate', {
            body: {
              type: 'transcription',
              storagePath: finalStoragePath,
            },
          } as any);
          
          console.log('Transcription invoke result:', { 
            hasData: !!result.data, 
            hasError: !!result.error,
            dataKeys: result.data ? Object.keys(result.data) : [],
            errorType: typeof result.error,
            errorContent: result.error,
          });
          
          data = result.data;
          error = result.error;
          
          // If Supabase wrapped the error, try to extract the actual error message
          if (error && typeof error === 'object') {
            const errorContext = (error as any)?.context;
            if (errorContext) {
              console.log('Error context:', errorContext);
              // If context is the error response body, extract the error message
              if (errorContext.error || errorContext.message) {
                console.log('Found error message in context:', errorContext.error || errorContext.message);
              }
            }
          }
          
          // Check if data contains an error object (function returned error in JSON body)
          // Supabase functions.invoke might parse error responses into data instead of error
          if (data && typeof data === 'object') {
            if ((data as any)?.error && !error) {
              console.log('Found error in data:', (data as any).error);
              error = { message: (data as any).error, context: data };
            }
            // Also check if the entire data object is just an error message
            if (!(data as any)?.text && !(data as any)?.content && Object.keys(data).length === 1 && (data as any)?.error) {
              console.log('Data object is error response:', data);
              error = { message: (data as any).error, context: data };
            }
          }
          
          // Also check if error is a string (might be the error message directly)
          if (error && typeof error === 'string') {
            error = { message: error };
          }
        } catch (invokeError: any) {
          console.error('Invoke error:', invokeError);
          console.error('Invoke error details:', {
            message: invokeError?.message,
            name: invokeError?.name,
            context: invokeError?.context,
            stack: invokeError?.stack,
          });
          
          // Try to extract error message from Supabase error response
          let errorMessage = invokeError?.message || String(invokeError);
          const errorContext = invokeError?.context;
          
          // Try to read the response body if errorContext is a Response object
          let responseBody: any = null;
          if (errorContext instanceof Response) {
            try {
              // Clone the response so we can read it without consuming it
              const clonedResponse = errorContext.clone();
              const text = await clonedResponse.text();
              console.log('Response body text:', text);
              try {
                responseBody = JSON.parse(text);
                console.log('Parsed response body:', responseBody);
              } catch (parseError) {
                console.log('Failed to parse response as JSON, using raw text');
                responseBody = { error: text };
              }
            } catch (readError) {
              console.error('Failed to read response body:', readError);
            }
          }
          
          // Extract error from response body
          if (responseBody) {
            if (responseBody.error) {
              errorMessage = responseBody.error;
            } else if (responseBody.message) {
              errorMessage = responseBody.message;
            }
          }
          
          // Supabase might wrap the error response body in context
          if (errorContext && !(errorContext instanceof Response)) {
            // If context has an error property, use it
            if (errorContext.error) {
              errorMessage = errorContext.error;
            } else if (errorContext.message) {
              errorMessage = errorContext.message;
            } else if (typeof errorContext === 'string') {
              errorMessage = errorContext;
            }
          }
          
          // Handle JSON parse errors (function might have returned HTML error page)
          if (errorMessage.includes('text/html') || 
              (errorMessage.includes('JSON') && errorMessage.includes('parse')) ||
              errorMessage.includes('Unexpected token')) {
            throw new Error(
              'Failed to transcribe audio from storage. The service may be temporarily unavailable. Please try again.'
            );
          }
          
          // Check for 400 Bad Request specifically
          if (errorMessage.includes('400') || errorMessage.includes('Bad Request') || 
              (errorContext instanceof Response && errorContext.status === 400)) {
            // Use extracted error from response body if available
            if (responseBody?.error) {
              throw new Error(`Transcription request error: ${responseBody.error}`);
            }
            
            throw new Error(
              'Invalid transcription request. The audio file may not have been uploaded correctly. Please try recording again.'
            );
          }
          
          // Re-throw with better context
          throw new Error(`Transcription service error: ${errorMessage}`);
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
          
          console.log('Transcription invoke result (base64):', { 
            hasData: !!result.data, 
            hasError: !!result.error,
            dataKeys: result.data ? Object.keys(result.data) : [],
            errorType: typeof result.error
          });
          
          data = result.data;
          error = result.error;
          
          // Check if data contains an error object (function returned error in JSON body)
          // Supabase functions.invoke might parse error responses into data instead of error
          if (data && typeof data === 'object') {
            if ((data as any)?.error && !error) {
              console.log('Found error in data:', (data as any).error);
              error = { message: (data as any).error, context: data };
            }
            // Also check if the entire data object is just an error message
            if (!(data as any)?.text && !(data as any)?.content && Object.keys(data).length === 1 && (data as any)?.error) {
              console.log('Data object is error response:', data);
              error = { message: (data as any).error, context: data };
            }
          }
          
          // Also check if error is a string (might be the error message directly)
          if (error && typeof error === 'string') {
            error = { message: error };
          }
        } catch (invokeError: any) {
          const errorMessage = invokeError?.message || String(invokeError);
          console.error('Invoke error:', invokeError);
          
          if (errorMessage.includes('text/html') || 
              (errorMessage.includes('JSON') && errorMessage.includes('parse')) ||
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
            
            try {
              const retryResult = await supabase.functions.invoke('ai-generate', {
                body: {
                  type: 'transcription',
                  storagePath: fallbackStoragePath,
                },
              } as any);
              
              console.log('Retry transcription invoke result:', { 
                hasData: !!retryResult.data, 
                hasError: !!retryResult.error,
                dataKeys: retryResult.data ? Object.keys(retryResult.data) : [],
                errorType: typeof retryResult.error
              });
              
              data = retryResult.data;
              error = retryResult.error;
              
              // Check if retry result also contains error
              if (data && typeof data === 'object' && (data as any)?.error && !error) {
                console.log('Found error in retry data:', (data as any).error);
                error = { message: (data as any).error, context: data };
              }
              
              // Also check if error is a string
              if (error && typeof error === 'string') {
                error = { message: error };
              }
            } catch (retryError: any) {
              console.error('Retry also failed:', retryError);
              throw new Error(`Transcription service error: ${retryError?.message || String(retryError)}`);
            }
          } else {
            throw new Error(`Transcription service error: ${errorMessage}`);
          }
        }
      }

      if (error) {
        // Supabase wraps non-2xx as error; try to parse limit response shape
        const errBody: any = (error as any)?.context || {};
        if (errBody?.code === 'DAILY_LIMIT_REACHED') {
          throw new RateLimitError(errBody?.message || 'Daily limit reached', {
            limit: errBody.limit ?? 15,
            remaining: errBody.remaining ?? 0,
            resetAt: errBody.resetAt ?? new Date().toISOString(),
            code: 'DAILY_LIMIT_REACHED',
          });
        }
        if (errBody?.code === 'ACCOUNT_LIMIT_REACHED') {
          throw new RateLimitError(errBody?.message || 'Account limit reached - you have already used your one-time AI generation quota', {
            limit: 1,
            remaining: 0,
            code: 'ACCOUNT_LIMIT_REACHED',
            usedAt: errBody.usedAt,
          });
        }
        throw error;
      }

      // Validate that we have transcription data
      if (!data || (typeof data === 'object' && !(data as any)?.text)) {
        console.error('No transcription data received:', data);
        throw new Error('Transcription service returned no data. Please try again.');
      }
      
      const transcriptionText = (data as any)?.text ?? '';
      
      // Log transcription details for debugging
      console.log(`Transcription received: ${transcriptionText.length} characters, ${transcriptionText.split(/\s+/).length} words`);
      
      if (!transcriptionText || transcriptionText.trim().length === 0) {
        console.error('Empty transcription received');
        throw new Error('Transcription returned empty text. The audio may be too quiet, contain no speech, or the service may be experiencing issues. Please try again.');
      }
      
      if (transcriptionText.length < 10) {
        console.warn('Warning: Transcription seems unusually short. Expected longer text for recording.');
      }
      
      return transcriptionText;
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Transcription error:', errorMessage);
      
      // If error already has a clear message, preserve it; otherwise wrap it
      if (errorMessage && errorMessage.length > 0 && !errorMessage.includes('Failed to transcribe')) {
        // Re-throw the original error to preserve its message
        throw error;
      }
      
      throw new Error(`Failed to transcribe audio: ${errorMessage}`);
    }
  },
};


