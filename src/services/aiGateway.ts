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
    // Convert blob to base64 efficiently
    const arrayBuffer = await audioBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
    const base64 = btoa(binaryString);
    const mimeType = audioBlob.type || 'audio/webm';

    const { data, error } = await supabase.functions.invoke('ai-generate', {
      body: {
        type: 'transcription',
        audioBase64: base64,
        mimeType,
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

    return (data as any)?.text ?? '';
  },
};


