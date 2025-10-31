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
    const messages = body?.messages ?? [];
    const model = body?.model ?? 'gpt-4o-mini';
    const temperature = body?.temperature ?? 0.7;

    // Enforce limit
    const limitResponse = await incrementUsageOrThrow(supabase, user.id);
    if (limitResponse) {
      // Ensure CORS headers on limit response
      const lr = limitResponse;
      const body = await lr.text();
      return new Response(body, { status: lr.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Proxy to OpenAI
    const result = await callOpenAI(messages, model, temperature);
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});


