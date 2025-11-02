// Supabase Edge Function: process-link
// Handles link processing for YouTube transcripts, Google Drive, and web pages

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
// @deno-types="https://esm.sh/youtube-transcript-api@3.0.6"
import YoutubeTranscript from 'https://esm.sh/youtube-transcript-api@3.0.6';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// YouTube transcript extraction using youtube-transcript-api package
async function getYouTubeTranscript(videoId: string): Promise<{ transcript: string; title: string }> {
  try {
    // Get video title first
    let title = `YouTube Video ${videoId}`;
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const oembedResponse = await fetch(oembedUrl);
      if (oembedResponse.ok) {
        const oembed = await oembedResponse.json();
        title = oembed.title || title;
      }
    } catch (titleError) {
      console.log('Could not fetch title:', titleError);
      // Continue without title
    }

    // Try using youtube-transcript-api package first (better error handling)
    try {
      console.log(`Attempting to fetch transcript using youtube-transcript-api for video: ${videoId}`);
      
      // Try English first
      let transcriptItems = [];
      const languages = ['en', 'en-US', 'en-GB'];
      
      for (const lang of languages) {
        try {
          transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, { lang });
          if (transcriptItems && transcriptItems.length > 0) {
            console.log(`Successfully fetched transcript in ${lang} (${transcriptItems.length} items)`);
            break;
          }
        } catch (langError) {
          console.log(`Failed to fetch transcript in ${lang}:`, langError);
          continue;
        }
      }
      
      // If English didn't work, try auto-detecting language
      if (transcriptItems.length === 0) {
        try {
          transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
          console.log(`Successfully fetched transcript (auto-detected language, ${transcriptItems.length} items)`);
        } catch (autoError) {
          console.log('Auto-detect also failed:', autoError);
        }
      }
      
      if (transcriptItems && transcriptItems.length > 0) {
        // Combine transcript items into a single text
        const transcript = transcriptItems
          .map((item: any) => item.text)
          .join(' ')
          .trim();
        
        if (transcript && transcript.length > 50) {
          console.log(`Successfully extracted ${transcript.length} characters using youtube-transcript-api`);
          return { transcript, title };
        }
      }
    } catch (packageError) {
      console.log('youtube-transcript-api package failed, falling back to direct API:', packageError);
      // Fall through to fallback method
    }
    
    // Fallback: Use direct timedtext API (original method)
    console.log('Using fallback: direct timedtext API');
    const languages = ['en', 'en-US', 'en-GB', 'en-AU', 'en-NZ'];
    let transcript = '';
    
    // Try to get English transcripts
    for (const lang of languages) {
      try {
        const transcriptUrl = `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}`;
        console.log(`Trying to fetch transcript with language: ${lang}`);
        
        const response = await fetch(transcriptUrl);
        if (!response.ok) {
          console.log(`Failed to fetch ${lang}: ${response.status}`);
          continue;
        }
        
        const xml = await response.text();
        console.log(`Received XML for ${lang}, length: ${xml.length}`);
        
        // Parse the XML
        if (xml && xml.length > 100) {
          // Extract text from <text> tags
          const textMatches = xml.match(/<text[^>]*>([^<]*)<\/text>/g);
          
          if (textMatches && textMatches.length > 0) {
            transcript = textMatches
              .map((match: string) => {
                // Extract just the text content between tags
                const textContent = match.replace(/<text[^>]*>/g, '').replace(/<\/text>/g, '').trim();
                
                // Decode HTML entities
                return textContent
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&amp;/g, '&')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .replace(/&nbsp;/g, ' ')
                  .trim();
              })
              .filter((text: string) => text.length > 0)
              .join(' ');
            
            if (transcript && transcript.length > 50) {
              console.log(`Successfully extracted ${transcript.length} characters of transcript in ${lang} (fallback)`);
              return { transcript: transcript.trim(), title };
            }
          }
        }
      } catch (langError) {
        console.log(`Error trying language ${lang}:`, langError);
        continue;
      }
    }
    
    // If we still don't have a transcript, throw an error
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('No transcript available for this video. The video may not have captions enabled.');
    }
    
    return { transcript: transcript.trim(), title };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('YouTube transcript extraction error:', errorMessage);
    throw new Error(`YouTube transcript extraction failed: ${errorMessage}`);
  }
}

// Process Google Drive link
async function processGoogleDriveLink(url: string): Promise<{ title: string; content: string }> {
  // Google Drive links require authentication to access content
  // For now, return a helpful message
  return {
    title: 'Google Drive Document',
    content: 'Note: Google Drive documents require authentication to access. Please download the document and upload it directly, or share the document with public access and provide a direct download link.',
  };
}

// Process web page
async function processWebLink(url: string): Promise<{ title: string; content: string }> {
  try {
    // Fetch the web page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StudyNotesBot/1.0)',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch web page: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Web Page';
    
    // Simple text extraction (remove HTML tags)
    // In production, you might want to use a proper HTML parser
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit content length
    if (content.length > 5000) {
      content = content.substring(0, 5000) + '... [Content truncated]';
    }
    
    return { title, content };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to process web page: ${errorMessage}`);
  }
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase env' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch (jsonError) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body. Expected JSON.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const linkType = body?.type; // 'youtube', 'google-drive', or 'web'
    const url = body?.url;

    if (!linkType || !url) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type and url' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let result: { title: string; content: string; transcript?: string };

    switch (linkType) {
      case 'youtube':
        const videoId = body?.videoId;
        if (!videoId) {
          return new Response(
            JSON.stringify({ error: 'Missing videoId for YouTube link' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
        try {
          console.log(`Processing YouTube video: ${videoId}`);
          const youtubeResult = await getYouTubeTranscript(videoId);
          console.log(`Successfully extracted transcript for video ${videoId}`);
          result = {
            title: youtubeResult.title,
            content: youtubeResult.transcript,
            transcript: youtubeResult.transcript,
          };
        } catch (youtubeError) {
          const errorMsg = youtubeError instanceof Error ? youtubeError.message : String(youtubeError);
          console.error('YouTube transcript extraction error:', errorMsg);
          console.error('Error details:', {
            videoId,
            errorType: typeof youtubeError,
            errorName: youtubeError instanceof Error ? youtubeError.name : 'N/A',
            stack: youtubeError instanceof Error ? youtubeError.stack : 'N/A',
          });
          // Return error in response body with 200 status
          // Supabase discards response bodies for non-2xx status codes
          return new Response(
            JSON.stringify({ 
              error: `YouTube transcript extraction failed: ${errorMsg}. The video may not have captions available, or the extraction method may not work for this video.`,
              success: false
            }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
        break;

      case 'google-drive':
        result = await processGoogleDriveLink(url);
        break;

      case 'web':
        result = await processWebLink(url);
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unsupported link type: ${linkType}`, success: false }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
    }

    return new Response(JSON.stringify({ ...result, success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Edge function error:', msg);
    console.error('Error stack:', e instanceof Error ? e.stack : 'N/A');
    // Return all errors with 200 status and error in body
    return new Response(JSON.stringify({ error: msg, success: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});

