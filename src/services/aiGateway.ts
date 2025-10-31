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
        messages,
        model: options?.model || 'gpt-4o-mini',
        temperature: options?.temperature ?? 0.7,
      },
    } as any);

    if (error) {
      // Supabase wraps non-2xx as error; try to parse limit response shape
      const errBody: any = (error as any)?.context || {};
      const code = errBody?.code || (error as any)?.name;
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
};


