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

async function checkDailyLimitOrThrow(supabase: any, userId: string) {
  const usageDate = getUtcDateString();

  console.log(`Checking daily AI usage limit for user: ${userId}, date: ${usageDate}`);

  // Ensure row exists
  const { error: upsertError } = await supabase
    .from('daily_ai_usage')
    .upsert({ user_id: userId, usage_date: usageDate, count: 0 }, { onConflict: 'user_id,usage_date' });

  if (upsertError) {
    console.error(`Upsert error in checkDailyLimitOrThrow:`, upsertError);
    throw upsertError;
  }

  // Fetch current count
  const { data: row, error: selectError } = await supabase
    .from('daily_ai_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('usage_date', usageDate)
    .single();

  if (selectError) {
    console.error(`Select error in checkDailyLimitOrThrow:`, selectError);
    throw selectError;
  }

  const currentCount = row?.count ?? 0;
  console.log(`Current daily usage count: ${currentCount}`);

  // Allow only 1 generation per day (changed from 15)
  const DAILY_LIMIT = 1;
  if (currentCount >= DAILY_LIMIT) {
    console.log(`Daily limit reached for user: ${userId}`);
    const body = {
      code: 'DAILY_LIMIT_REACHED',
      message: 'You have already generated AI content today. Please try again tomorrow.',
      limit: DAILY_LIMIT,
      remaining: 0,
      resetAt: getResetAtIso(),
    };
    return new Response(JSON.stringify(body), { status: 429, headers: { 'Content-Type': 'application/json' } });
  }

  console.log(`No limit reached for user: ${userId}, proceeding with generation`);
  return null; // No limit reached
}

async function incrementDailyUsage(supabase: any, userId: string) {
  const usageDate = getUtcDateString();
  
  console.log(`Incrementing daily usage for user: ${userId}, date: ${usageDate}`);

  // Fetch current count
  const { data: row, error: selectError } = await supabase
    .from('daily_ai_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('usage_date', usageDate)
    .single();

  if (selectError) {
    console.error(`Select error in incrementDailyUsage:`, selectError);
    throw selectError;
  }

  // Increment
  const { error: updateError } = await supabase
    .from('daily_ai_usage')
    .update({ count: (row?.count ?? 0) + 1 })
    .eq('user_id', userId)
    .eq('usage_date', usageDate);

  if (updateError) {
    console.error(`Update error in incrementDailyUsage:`, updateError);
    throw updateError;
  }
  
  console.log(`Successfully incremented daily usage for user: ${userId}`);
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

async function transcribeAudioFromStorage(storagePath: string, supabaseClient: any) {
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
  
  try {
    console.log(`Attempting to download file from storage path: "${storagePath}"`);
    console.log(`Storage client available: ${!!supabaseClient}, Storage available: ${!!supabaseClient?.storage}`);
    
    // Download file from storage with timeout
    const downloadPromise = supabaseClient.storage
      .from('documents')
      .download(storagePath)
      .then((result: any) => {
        console.log('Storage download response:', {
          hasData: !!result?.data,
          hasError: !!result?.error,
          dataSize: result?.data?.size,
          errorDetails: result?.error,
        });
        
        if (result.error) {
          console.error('Storage download error:', result.error);
          // Extract error message from Supabase error object
          const errorMessage = result.error?.message || result.error?.error_description || JSON.stringify(result.error);
          const errorToThrow = new Error(`Storage download failed: ${errorMessage}`);
          (errorToThrow as any).supabaseError = result.error;
          throw errorToThrow;
        }
        return result;
      })
      .catch((error: any) => {
        // Log the full error for debugging
        console.error('Storage download promise error:', {
          errorType: typeof error,
          errorName: error?.name,
          errorMessage: error?.message,
          supabaseError: error?.supabaseError,
          fullError: error,
        });
        throw error;
      });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Storage download timeout after 30 seconds')), 30000);
    });
    
    let downloadResult: any;
    try {
      downloadResult = await Promise.race([downloadPromise, timeoutPromise]);
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('Storage download failed:', errorMsg);
      console.error('Storage download error details:', {
        message: errorMsg,
        errorType: typeof error,
        errorName: error?.name,
        supabaseError: error?.supabaseError,
        stack: error?.stack,
      });
      
      if (errorMsg.includes('timeout')) {
        throw new Error('Storage download timeout after 30 seconds');
      }
      // Check for common storage errors
      if (errorMsg.includes('not found') || errorMsg.includes('404') || errorMsg.includes('NoSuchKey')) {
        throw new Error(`Audio file not found in storage at path: ${storagePath}`);
      }
      if (errorMsg.includes('permission') || errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
        throw new Error(`Permission denied accessing audio file at path: ${storagePath}`);
      }
      if (errorMsg.includes('400') || errorMsg.includes('Bad Request')) {
        throw new Error(`Invalid storage path or request: ${storagePath}. Error: ${errorMsg}`);
      }
      // Re-throw with more context
      throw new Error(`Storage download failed: ${errorMsg}`);
    }
    
    const { data: fileData } = downloadResult;
    
    if (!fileData) {
      console.error('Storage download error: No file data returned for path:', storagePath);
      throw new Error('Failed to download audio from storage: No file data returned');
    }
    
    // Log file info for debugging
    console.log(`Downloaded file from storage: ${storagePath}, size: ${fileData.size} bytes, type: ${fileData.type || 'unknown'}`);
    
    // Convert blob to File for FormData
    const formData = new FormData();
    const file = new File([fileData], 'audio.webm', { type: fileData.type || 'audio/webm' });
    formData.append('file', file);
    formData.append('model', 'whisper-1');

    // Transcribe with OpenAI, with timeout
    const transcriptionPromise = fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData
    });
    
    const transcriptionTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI transcription timeout after 5 minutes')), 300000);
    });
    
    const res = await Promise.race([
      transcriptionPromise,
      transcriptionTimeoutPromise
    ]) as Response;

    if (!res.ok) {
      const err = await res.text();
      console.error(`OpenAI transcription error: ${res.status} ${err}`);
      throw new Error(`OpenAI transcription error: ${res.status} ${err}`);
    }
    
    const json = await res.json();
    const transcriptionText = json.text || '';
    console.log(`Transcription completed. Length: ${transcriptionText.length} characters`);
    return { text: transcriptionText };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Error in transcribeAudioFromStorage:', errorMsg);
    throw error;
  }
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

    let body: any;
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error('JSON parse error:', jsonError);
      return new Response(
        JSON.stringify({ error: 'Invalid request body. Expected JSON.' }), 
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    
    const requestType = body?.type || 'chat'; // 'chat' or 'transcription'

    // Enforce limit for both chat and transcription
    const limitResponse = await checkDailyLimitOrThrow(supabase, user.id);
    if (limitResponse) {
      // Ensure CORS headers on limit response
      const lr = limitResponse;
      const body = await lr.text();
      return new Response(body, { status: lr.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Handle transcription
    if (requestType === 'transcription') {
      const storagePath = body?.storagePath;
      const audioBase64 = body?.audioBase64;
      const mimeType = body?.mimeType || 'audio/webm';
      
      console.log('Transcription request received:', {
        hasStoragePath: !!storagePath,
        storagePathType: typeof storagePath,
        storagePathValue: storagePath,
        storagePathLength: storagePath ? storagePath.length : 0,
        hasAudioBase64: !!audioBase64,
        audioBase64Length: audioBase64 ? audioBase64.length : 0,
        bodyKeys: Object.keys(body || {}),
      });
      
      // If storage path is provided, use storage-based transcription (for large files)
      // Validate storagePath is a non-empty string
      if (storagePath && typeof storagePath === 'string' && storagePath.trim().length > 0) {
        const trimmedPath = storagePath.trim();
        try {
          console.log(`Starting transcription from storage path: "${trimmedPath}"`);
          // Use the authenticated supabase client for storage operations
          const result = await transcribeAudioFromStorage(trimmedPath, supabase);
          console.log('Transcription successful');
          // Mark account limit as used
          try {
            await incrementDailyUsage(supabase, user.id);
          } catch (markError) {
            console.error('Error marking account usage as used:', markError);
            // Still return success as transcription worked, but log the issue
          }
          return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        } catch (transcribeError) {
          const errorMsg = transcribeError instanceof Error ? transcribeError.message : String(transcribeError);
          console.error('Transcription error:', errorMsg);
          console.error('Error details:', {
            errorType: typeof transcribeError,
            errorName: transcribeError instanceof Error ? transcribeError.name : 'N/A',
            storagePath: trimmedPath,
            stack: transcribeError instanceof Error ? transcribeError.stack : 'N/A',
          });
          
          // Return proper JSON error responses instead of throwing (which might return HTML)
          if (errorMsg.includes('too large') || errorMsg.includes('413') || errorMsg.includes('25MB')) {
            return new Response(
              JSON.stringify({ 
                error: 'Audio file is too large. OpenAI Whisper has a 25MB limit. Please record a shorter audio.' 
              }), 
              { status: 413, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          }
          
          if (errorMsg.includes('timeout')) {
            return new Response(
              JSON.stringify({ 
                error: 'Transcription request timed out. The audio file may be too large or the service is overloaded.' 
              }), 
              { status: 504, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          }
          
          if (errorMsg.includes('download') || errorMsg.includes('storage') || errorMsg.includes('not found') || errorMsg.includes('404')) {
            return new Response(
              JSON.stringify({ 
                error: `Failed to access audio file from storage: ${errorMsg}` 
              }), 
              { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          }
          
          if (errorMsg.includes('permission') || errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
            return new Response(
              JSON.stringify({ 
                error: `Permission denied accessing audio file: ${errorMsg}` 
              }), 
              { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          }
          
          // Generic error - still return JSON
          return new Response(
            JSON.stringify({ 
              error: `Transcription failed: ${errorMsg}` 
            }), 
            { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
      }
      
      // Fallback to base64 for small files
      if (!audioBase64) {
        console.error('Transcription request missing both storagePath and audioBase64:', {
          bodyKeys: Object.keys(body || {}),
          storagePathValue: storagePath,
          storagePathType: typeof storagePath,
          storagePathTrimmed: storagePath ? storagePath.trim() : null,
          storagePathLength: storagePath ? storagePath.length : 0,
          storagePathTrimmedLength: storagePath ? storagePath.trim().length : 0,
        });
        return new Response(
          JSON.stringify({ 
            error: `Missing audioBase64 or storagePath. Provide either a storagePath (string) or audioBase64 (string) for transcription. Received: storagePath=${JSON.stringify(storagePath)}, type=${typeof storagePath}` 
          }), 
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
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
        // Mark account limit as used
        try {
          await incrementDailyUsage(supabase, user.id);
        } catch (markError) {
          console.error('Error marking account usage as used:', markError);
          // Still return success as transcription worked, but log the issue
        }
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
    // Mark account limit as used
    try {
      await incrementDailyUsage(supabase, user.id);
    } catch (markError) {
      console.error('Error marking account usage as used:', markError);
      // Still return success as chat completion worked, but log the issue
    }
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});


