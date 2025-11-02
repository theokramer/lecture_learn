// Supabase Edge Function: ai-generate
// Proxies to OpenAI Chat Completions and Whisper APIs

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

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

/**
 * Logs audit events to audit_log table
 * Handles errors gracefully to prevent breaking the main flow
 */
async function logAuditEvent(
  supabase: any,
  eventType: string,
  userId: string,
  details: Record<string, any> = {},
  severity: 'low' | 'medium' | 'high' | 'critical' = 'low',
  success: boolean = true
): Promise<void> {
  try {
    // Get client IP from request headers if available
    const ipAddress = details.ipAddress || 'unknown';
    const userAgent = details.userAgent || 'edge-function';

    const auditEntry = {
      event_type: eventType,
      user_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent,
      details: { ...details, ipAddress: undefined, userAgent: undefined }, // Remove from details
      severity,
      success,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('audit_log').insert(auditEntry);

    if (error) {
      console.warn('[AUDIT] Failed to log event:', error.message);
    } else {
      console.log(`[AUDIT] ✅ Logged event: ${eventType}`);
    }
  } catch (error) {
    // Silently fail - don't let audit logging break the main flow
    console.warn('[AUDIT] Error logging event (non-critical):', error);
  }
}

async function checkDailyLimitOrThrow(supabase: any, userId: string, userEmail?: string) {
  const usageDate = getUtcDateString();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[RATE_LIMIT_CHECK] 🔍 Starting Rate Limit Check');
  console.log(`[RATE_LIMIT_CHECK] User ID: ${userId}`);
  console.log(`[RATE_LIMIT_CHECK] User Email: ${userEmail || 'N/A'}`);
  console.log(`[RATE_LIMIT_CHECK] Date: ${usageDate}`);

  // Skip rate limit for premium users (@premium.de email domain)
  if (userEmail && userEmail.toLowerCase().endsWith('@premium.de')) {
    console.log(`[RATE_LIMIT_CHECK] ⭐ PREMIUM USER - Skipping rate limit check`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return null; // No limit for premium users
  }

  // Fetch custom limit from account_limits table
  console.log('[RATE_LIMIT_CHECK] Fetching custom limit from account_limits...');
  const { data: accountLimit, error: limitError } = await supabase
    .from('account_limits')
    .select('daily_ai_limit')
    .eq('user_id', userId)
    .single();

  if (limitError && limitError.code !== 'PGRST116') {
    console.log(`[RATE_LIMIT_CHECK] ⚠️  Error fetching custom limit:`, limitError);
  }

  // Use custom limit if found, otherwise default to 150
  // Ensure limit is at least 1 (never allow 0 or negative)
  let DAILY_LIMIT = accountLimit?.daily_ai_limit ?? 150;
  if (DAILY_LIMIT < 1) {
    console.warn(`[RATE_LIMIT_CHECK] ⚠️  Invalid limit value ${DAILY_LIMIT}, defaulting to 150`);
    DAILY_LIMIT = 150;
  }
  console.log(`[RATE_LIMIT_CHECK] 📊 Daily Limit: ${DAILY_LIMIT} (${accountLimit ? '✨ custom' : '📌 default'})`);

  // Select current count (RLS disabled on this table, so always reliable)
  console.log('[RATE_LIMIT_CHECK] Checking current usage from daily_ai_usage...');
  const { data: existingRow, error: selectError } = await supabase
    .from('daily_ai_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('usage_date', usageDate)
    .single();

  // If row doesn't exist, create it
  if (selectError && selectError.code === 'PGRST116') {
    console.log(`[RATE_LIMIT_CHECK] 🆕 No usage row found for today, creating new entry...`);
    const { error: insertError } = await supabase
      .from('daily_ai_usage')
      .insert({ user_id: userId, usage_date: usageDate, count: 0 });

    if (insertError) {
      console.error(`[RATE_LIMIT_CHECK] ❌ Error creating new usage row:`, insertError);
      throw insertError;
    }
    
    console.log(`[RATE_LIMIT_CHECK] ✅ New usage row created (count: 0)`);
    console.log(`[RATE_LIMIT_CHECK] ✅ ALLOW - First generation of the day`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return null;
  }

  if (selectError) {
    console.error(`[RATE_LIMIT_CHECK] ❌ Unexpected error fetching usage:`, selectError);
    throw selectError;
  }

  const currentCount = existingRow?.count ?? 0;
  const remaining = Math.max(0, DAILY_LIMIT - currentCount);
  console.log(`[RATE_LIMIT_CHECK] 📈 Current Usage: ${currentCount}/${DAILY_LIMIT}`);
  console.log(`[RATE_LIMIT_CHECK] 🎯 Remaining: ${remaining}`);

  // Check if limit is reached
  if (currentCount >= DAILY_LIMIT) {
    console.log(`[RATE_LIMIT_CHECK] ⛔ LIMIT REACHED!`);
    console.log(`[RATE_LIMIT_CHECK] User has exhausted their daily limit (${currentCount}/${DAILY_LIMIT})`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const body = {
      code: 'DAILY_LIMIT_REACHED',
      message: `You have reached your daily AI generation limit (${DAILY_LIMIT}). Please try again tomorrow.`,
      limit: DAILY_LIMIT,
      remaining: 0,
      resetAt: getResetAtIso(),
    };
    return new Response(JSON.stringify(body), { 
      status: 429, 
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      } 
    });
  }

  console.log(`[RATE_LIMIT_CHECK] ✅ ALLOW - User under limit (${remaining} remaining)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  return null; // No limit reached
}

async function incrementDailyUsage(
  supabase: any, 
  userId: string, 
  userEmail?: string,
  tokensUsed: number = 0
) {
  // Skip increment for premium users
  if (userEmail && userEmail.toLowerCase().endsWith('@premium.de')) {
    console.log('[INCREMENT_USAGE] ⭐ PREMIUM USER - Skipping usage increment');
    return; // Don't track usage for premium users
  }

  const usageDate = getUtcDateString();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[INCREMENT_USAGE] 📝 Incrementing daily usage count');
  console.log(`[INCREMENT_USAGE] User ID: ${userId}`);
  console.log(`[INCREMENT_USAGE] Date: ${usageDate}`);
  console.log(`[INCREMENT_USAGE] Tokens used: ${tokensUsed}`);

  // Fetch current count and token_count
  const { data: row, error: selectError } = await supabase
    .from('daily_ai_usage')
    .select('count, token_count')
    .eq('user_id', userId)
    .eq('usage_date', usageDate)
    .single();

  if (selectError) {
    console.error(`[INCREMENT_USAGE] ❌ Error fetching current count:`, selectError);
    throw selectError;
  }

  const oldCount = row?.count ?? 0;
  const newCount = oldCount + 1;
  const oldTokens = row?.token_count ?? 0;
  const newTokens = oldTokens + tokensUsed;
  
  console.log(`[INCREMENT_USAGE] Count: ${oldCount} → ${newCount}`);
  console.log(`[INCREMENT_USAGE] Tokens: ${oldTokens} → ${newTokens}`);

  // Increment both count and token_count
  const { error: updateError } = await supabase
    .from('daily_ai_usage')
    .update({ count: newCount, token_count: newTokens })
    .eq('user_id', userId)
    .eq('usage_date', usageDate);

  if (updateError) {
    console.error(`[INCREMENT_USAGE] ❌ Error updating count:`, updateError);
    throw updateError;
  }
  
  console.log(`[INCREMENT_USAGE] ✅ Successfully incremented (count: ${newCount}, tokens: ${newTokens})`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function callOpenAI(
  messages: any[], 
  model = 'gpt-4o-mini', 
  temperature = 0.7,
  retryCount = 0,
  maxRetries = 3
): Promise<{ content: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }> {
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
  
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature })
    });

    if (!res.ok) {
      // Handle 429 (rate limit) with exponential backoff
      if (res.status === 429 && retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // 1s, 2s, 4s, 8s... max 30s
        console.log(`[OPENAI] Rate limited (429), retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return callOpenAI(messages, model, temperature, retryCount + 1, maxRetries);
      }
      
      const err = await res.text();
      throw new Error(`OpenAI error: ${res.status} ${err}`);
    }
    
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? '';
    const usage = json?.usage;
    
    return { content, usage };
  } catch (error) {
    // Re-throw with retry logic for network errors too
    if (retryCount < maxRetries && error instanceof Error && error.message.includes('fetch')) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      console.log(`[OPENAI] Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callOpenAI(messages, model, temperature, retryCount + 1, maxRetries);
    }
    throw error;
  }
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
  
  let userId: string | null = null; // Track userId for audit logging in catch blocks
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: 'Missing Supabase env' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('[AUTH] ❌ Unauthorized request');
      // Log unauthorized access attempt (no userId available)
      await logAuditEvent(
        supabase,
        'unauthorized_access_attempt',
        'anonymous',
        { error: userError?.message || 'No user found', endpoint: '/ai-generate' },
        'high',
        false
      );
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    console.log(`[AUTH] ✅ User authenticated: ${user.id}`);
    console.log(`[AUTH] 📧 User email: ${user.email || 'N/A'}`);
    userId = user.id; // Store for audit logging

    // ⚠️ CHECK RATE LIMIT BEFORE ANY AI GENERATION
    // Skip completely for premium users (@premium.de email domain)
    const isPremiumUser = user.email && user.email.toLowerCase().endsWith('@premium.de');
    
    if (!isPremiumUser) {
    console.log('[RATE_LIMIT] Starting rate limit check...');
      const limitCheck = await checkDailyLimitOrThrow(supabase, user.id, user.email);
    if (limitCheck) {
      // Rate limit exceeded - return 429 error response
      console.log('[RATE_LIMIT] ❌ Request blocked due to rate limit');
      // Log rate limit event
      await logAuditEvent(
        supabase,
        'rate_limit_exceeded',
        user.id,
        { resource: 'ai_generation' },
        'medium',
        false
      );
      return limitCheck;
    }
    console.log('[RATE_LIMIT] ✅ Rate limit check passed, proceeding with request');
    } else {
      console.log('[RATE_LIMIT] ⭐ PREMIUM USER - Completely bypassing rate limit checks');
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
    console.log(`[REQUEST] Type: ${requestType}`);

    // Log AI generation request
    const startTime = Date.now();
    await logAuditEvent(
      supabase,
      'ai_generation_requested',
      user.id,
      { 
        request_type: requestType,
        ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown'
      },
      'low',
      true
    );

    // Handle transcription
    if (requestType === 'transcription') {
      console.log('[TRANSCRIPTION] Starting transcription request...');
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
          console.log(`[TRANSCRIPTION] 🎤 Starting transcription from storage: "${trimmedPath}"`);
          // Use the authenticated supabase client for storage operations
          const result = await transcribeAudioFromStorage(trimmedPath, supabase);
          console.log('[TRANSCRIPTION] ✅ Transcription successful');
          
          // Prepare response BEFORE incrementing (ensures we have valid result)
          const responseData = JSON.stringify(result);
          console.log('[TRANSCRIPTION] ✅ Response prepared');
          
          // Increment usage count AFTER successful generation and response preparation
          // This ensures the generation truly succeeded before counting it
          // Premium users skip increment (handled in function)
          try {
            await incrementDailyUsage(supabase, user.id, user.email);
            console.log('[TRANSCRIPTION] ✅ Usage count incremented (or skipped for premium)');
          } catch (markError) {
            console.error('[TRANSCRIPTION] ⚠️  Error incrementing daily usage:', markError);
            // Still return success as transcription worked, but log the issue
          }
          
          // Log successful AI generation
          const duration = Date.now() - startTime;
          await logAuditEvent(
            supabase,
            'ai_generation_completed',
            user.id,
            { 
              request_type: 'transcription',
              duration_ms: duration,
              method: 'storage_path'
            },
            'low',
            true
          );
          
          console.log('[TRANSCRIPTION] ✅ Returning result to client');
          return new Response(responseData, { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
        } catch (transcribeError) {
          const errorMsg = transcribeError instanceof Error ? transcribeError.message : String(transcribeError);
          console.error('Transcription error:', errorMsg);
          
          // Log failed AI generation
          await logAuditEvent(
            supabase,
            'ai_generation_failed',
            user.id,
            { 
              request_type: 'transcription',
              error: errorMsg.substring(0, 200),
              method: 'storage_path'
            },
            'medium',
            false
          );
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
        console.log('[TRANSCRIPTION] 🎤 Starting transcription from base64 audio');
        const result = await transcribeAudio(audioBase64, mimeType);
        console.log('[TRANSCRIPTION] ✅ Transcription successful');
        
        // Prepare response BEFORE incrementing (ensures we have valid result)
        const responseData = JSON.stringify(result);
        console.log('[TRANSCRIPTION] ✅ Response prepared');
        
        // Increment usage count AFTER successful generation and response preparation
        // This ensures the generation truly succeeded before counting it
        // Premium users skip increment (handled in function)
        try {
          await incrementDailyUsage(supabase, user.id, user.email);
          console.log('[TRANSCRIPTION] ✅ Usage count incremented (or skipped for premium)');
        } catch (markError) {
          console.error('[TRANSCRIPTION] ⚠️  Error incrementing daily usage:', markError);
          // Still return success as transcription worked, but log the issue
        }
        
        // Log successful AI generation
        const duration = Date.now() - startTime;
        await logAuditEvent(
          supabase,
          'ai_generation_completed',
          user.id,
          { 
            request_type: 'transcription',
            duration_ms: duration,
            method: 'base64'
          },
          'low',
          true
        );
        
        console.log('[TRANSCRIPTION] ✅ Returning result to client');
        return new Response(responseData, { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      } catch (transcribeError) {
        const errorMsg = transcribeError instanceof Error ? transcribeError.message : String(transcribeError);
        
        // Log failed AI generation
        await logAuditEvent(
          supabase,
          'ai_generation_failed',
          user.id,
          { 
            request_type: 'transcription',
            error: errorMsg.substring(0, 200),
            method: 'base64'
          },
          'medium',
          false
        );
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
    console.log('[CHAT] 💬 Starting chat completion request');
    const messages = body?.messages ?? [];
    const model = body?.model ?? 'gpt-4o-mini';
    const temperature = body?.temperature ?? 0.7;
    const fileHash = body?.fileHash ?? ''; // Optional file hash for caching
    const prompt = messages.map((m: any) => m.content).join('\n'); // Extract prompt for cache key
    
    console.log(`[CHAT] Model: ${model}, Messages: ${messages.length}, FileHash: ${fileHash || 'none'}`);
    
    try {
      // Check cache before calling OpenAI
      let result: { content: string; usage?: any };
      let fromCache = false;
      
      if (fileHash) {
        // Generate cache key (in Deno, we use Web Crypto API)
        const keyString = `${fileHash}|${prompt}|${model}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(keyString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const cacheKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Check cache
        const { data: cachedData, error: cacheError } = await supabase
          .from('model_cache')
          .select('response, expires_at')
          .eq('cache_key', cacheKey)
          .eq('user_id', user.id)
          .gte('expires_at', new Date().toISOString())
          .maybeSingle();
        
        if (!cacheError && cachedData) {
          console.log('[CHAT] ✅ Cache hit! Using cached response');
          result = { content: cachedData.response.content, usage: cachedData.response.usage };
          fromCache = true;
        } else {
          console.log('[CHAT] Cache miss or expired, calling OpenAI');
        }
      }
      
      // Call OpenAI if not from cache
      if (!fromCache) {
        result = await callOpenAI(messages, model, temperature);
        console.log('[CHAT] ✅ Chat completion successful');
        
        // Store in cache if fileHash provided
        if (fileHash && result.content) {
          try {
            const keyString = `${fileHash}|${prompt}|${model}`;
            const encoder = new TextEncoder();
            const data = encoder.encode(keyString);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const cacheKey = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);
            
            await supabase
              .from('model_cache')
              .upsert({
                cache_key: cacheKey,
                user_id: user.id,
                response: { content: result.content, usage: result.usage, model },
                expires_at: expiresAt.toISOString(),
              }, {
                onConflict: 'cache_key'
              });
            
            console.log('[CHAT] ✅ Response cached');
          } catch (cacheError) {
            console.warn('[CHAT] ⚠️  Failed to cache response:', cacheError);
            // Don't fail the request if caching fails
          }
        }
      }
      
      // Extract token usage
      const tokensUsed = result.usage?.total_tokens ?? 0;
      
      // Prepare response BEFORE incrementing (ensures we have valid result)
      const responseData = JSON.stringify({ content: result.content });
      console.log('[CHAT] ✅ Response prepared');
      
      // Increment usage count and tokens AFTER successful generation and response preparation
      // This ensures the generation truly succeeded before counting it
      // Premium users skip increment (handled in function)
      try {
        await incrementDailyUsage(supabase, user.id, user.email, tokensUsed);
        console.log('[CHAT] ✅ Usage count incremented (or skipped for premium)');
      } catch (markError) {
        console.error('[CHAT] ⚠️  Error incrementing daily usage:', markError);
        // Still return success as chat completion worked, but log the issue
      }
      
      // Log successful AI generation
      const duration = Date.now() - startTime;
      await logAuditEvent(
        supabase,
        'ai_generation_completed',
        user.id,
        { 
          request_type: 'chat',
          duration_ms: duration,
          model,
          messages_count: messages.length,
          tokens_used: tokensUsed,
          from_cache: fromCache
        },
        'low',
        true
      );
      
      console.log('[CHAT] ✅ Returning result to client');
      return new Response(responseData, { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    } catch (chatError) {
      const errorMsg = chatError instanceof Error ? chatError.message : String(chatError);
      
      // Log failed AI generation
      await logAuditEvent(
        supabase,
        'ai_generation_failed',
        user.id,
        { 
          request_type: 'chat',
          error: errorMsg.substring(0, 200),
          model,
          messages_count: messages.length
        },
        'medium',
        false
      );
      
      throw chatError; // Re-throw to be caught by outer try-catch
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    
    // Log general error if not already logged
    // (Some errors might have been logged above, but catch-all ensures we log everything)
    if (userId) {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          await logAuditEvent(
            supabase,
            'error_occurred',
            currentUser.id,
            { 
              error: msg.substring(0, 200),
              endpoint: '/ai-generate'
            },
            'medium',
            false
          );
        }
      } catch (auditError) {
        // Silently fail audit logging
        console.warn('[AUDIT] Failed to log error:', auditError);
      }
    }
    
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});


