// Supabase Edge Function: ai-generate
// Enforces a per-user daily cap (15) on AI generations, then proxies to OpenAI Chat Completions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const DAILY_LIMIT = 15;

function getUtcDateString(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getResetAtIso(): string {
  const now = new Date();
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  return reset.toISOString();
}

async function incrementUsageOrThrow(supabase: any, userId: string) {
  const usageDate = getUtcDateString();

  // Ensure row exists
  await supabase
    .from('daily_ai_usage')
    .upsert({ user_id: userId, usage_date: usageDate, count: 0 }, { onConflict: 'user_id,usage_date' });

  // Fetch current count
  const { data: row, error: selectError } = await supabase
    .from('daily_ai_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('usage_date', usageDate)
    .single();

  if (selectError) throw selectError;

  if ((row?.count ?? 0) >= DAILY_LIMIT) {
    const body = {
      code: 'DAILY_LIMIT_REACHED',
      message: 'Daily AI generation limit reached',
      limit: DAILY_LIMIT,
      remaining: 0,
      resetAt: getResetAtIso(),
    };
    return new Response(JSON.stringify(body), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }

  // Increment
  const { error: updateError } = await supabase
    .from('daily_ai_usage')
    .update({ count: (row?.count ?? 0) + 1 })
    .eq('user_id', userId)
    .eq('usage_date', usageDate);

  if (updateError) throw updateError;
  return null;
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function callOpenAI(messages: any[], model = 'gpt-4o-mini', temperature = 0.7) {
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, temperature })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${err}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content ?? '';
  return { content };
}

async function transcribeAudio(audioBase64: string, mimeType: string = 'audio/webm') {
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
  
  // Convert base64 to bytes for FormData
  const binaryString = atob(audioBase64);
  const audioBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    audioBytes[i] = binaryString.charCodeAt(i);
  }
  
  const blob = new Blob([audioBytes], { type: mimeType });
  const formData = new FormData();
  const file = new File([blob], 'audio.webm', { type: mimeType });
  formData.append('file', file);
  formData.append('model', 'whisper-1');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: formData
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI transcription error: ${res.status} ${err}`);
  }
  const json = await res.json();
  return { text: json.text || '' };
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: 'Missing Supabase env' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const body = await req.json();
    const requestType = body?.type || 'chat'; // 'chat' or 'transcription'

    // Enforce limit for both chat and transcription
    const limitResponse = await incrementUsageOrThrow(supabase, user.id);
    if (limitResponse) {
      // Ensure CORS headers on limit response
      const lr = limitResponse;
      const body = await lr.text();
      return new Response(body, { status: lr.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Handle transcription
    if (requestType === 'transcription') {
      const audioBase64 = body?.audioBase64;
      const mimeType = body?.mimeType || 'audio/webm';
      if (!audioBase64) {
        return new Response(JSON.stringify({ error: 'Missing audioBase64' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      
      // Check size before processing (base64 string length, approximate original size is ~75% of base64 length)
      const estimatedSizeBytes = (audioBase64.length * 3) / 4;
      const MAX_SIZE = 6 * 1024 * 1024; // 6MB limit for Supabase Edge Functions
      
      if (estimatedSizeBytes > MAX_SIZE) {
        const sizeMB = (estimatedSizeBytes / (1024 * 1024)).toFixed(2);
        return new Response(
          JSON.stringify({ 
            error: `Audio file is too large (${sizeMB} MB). Maximum size is 6 MB. Please record a shorter audio.` 
          }), 
          { status: 413, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      
      try {
        const result = await transcribeAudio(audioBase64, mimeType);
        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (transcribeError) {
        const errorMsg = transcribeError instanceof Error ? transcribeError.message : String(transcribeError);
        // If OpenAI returns an error about file size, return proper JSON error
        if (errorMsg.includes('too large') || errorMsg.includes('413') || errorMsg.includes('25MB')) {
          return new Response(
            JSON.stringify({ 
              error: 'Audio file is too large. OpenAI Whisper has a 25MB limit. Please record a shorter audio.' 
            }), 
            { status: 413, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
        throw transcribeError; // Re-throw to be caught by outer try-catch
      }
    }

    // Handle chat completion
    const messages = body?.messages ?? [];
    const model = body?.model ?? 'gpt-4o-mini';
    const temperature = body?.temperature ?? 0.7;
    const result = await callOpenAI(messages, model, temperature);
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});


