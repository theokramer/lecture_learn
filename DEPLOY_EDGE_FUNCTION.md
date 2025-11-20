# Deploy Updated Edge Function

The Edge Function needs to be deployed to support AssemblyAI transcription API.

## Step 1: Set Environment Variables (API Keys)

You need to set these environment variables for your Edge Function. You can do this in two ways:

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/ypepyifdhyogsugtamxw
2. Click on **Edge Functions** in the left sidebar
3. Click on the **Settings** tab (or look for **Secrets** or **Configuration**)
4. Add the following secrets:

| Secret Name | Description | Where to find it |
|------------|-------------|------------------|
| `ASSEMBLYAI_API_KEY` | Your AssemblyAI API key | `399b27eda7b7465ab87c1d3fad55a8a0` (or get from AssemblyAI dashboard) |
| `OPENAI_API_KEY` | Your OpenAI API key | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `SUPABASE_URL` | Your Supabase project URL | Project Settings → API → Project URL (e.g., `https://ypepyifdhyogsugtamxw.supabase.co`) |
| `SUPABASE_ANON_KEY` | Your Supabase anon key | Project Settings → API → Project API keys → `anon` `public` |

**Note:** `ASSEMBLYAI_API_KEY` has a fallback value in the code, but it's better to set it as a secret for security.

### Option B: Using Supabase CLI

```bash
# Set AssemblyAI API key
supabase secrets set ASSEMBLYAI_API_KEY=399b27eda7b7465ab87c1d3fad55a8a0

# Set OpenAI API key (if you have one)
supabase secrets set OPENAI_API_KEY=your_openai_api_key_here

# Set Supabase URL
supabase secrets set SUPABASE_URL=https://ypepyifdhyogsugtamxw.supabase.co

# Set Supabase Anon Key
supabase secrets set SUPABASE_ANON_KEY=your_anon_key_here
```

**Important:** Make sure you're logged in and linked to your project first:
```bash
supabase login
supabase link --project-ref ypepyifdhyogsugtamxw
```

## Step 2: Deploy the Edge Function

```bash
cd /Users/theokramer/Documents/react-learning-notes
supabase functions deploy ai-generate
```

## Step 3: Verify Deployment

After deployment, the Edge Function should:
1. Accept `audioUrl` parameter (S4 URL) in addition to `storagePath`
2. Use the new `transcribeAudioFromUrl()` function for S4 URLs
3. Return updated error messages that include `audioUrl` in the list

You can verify in the Supabase Dashboard:
1. Go to **Edge Functions** in the sidebar
2. You should see `ai-generate` in the list
3. It should show as "Active" or "Deployed"

## Step 4: Test After Deployment

Try uploading an audio file again. The error message should now mention `audioUrl` if there's still an issue.

## File Size Support

The system now supports audio files of any size:
- **Flutter App**: Validates files up to 100 MB for audio files (can be increased)
- **AssemblyAI API**: Supports files of any size (no hard limit)
- **Edge Function**: Polls AssemblyAI API for up to 30 minutes for large files
- **Client Timeout**: Set to 10 minutes to allow for processing and network overhead

AssemblyAI provides reliable transcription with automatic polling for large files. The Edge Function handles the polling automatically.

## Transcription Quality Features

The transcription system includes several quality improvements:

1. **Automatic Language Detection**: Automatically detects the spoken language (supports 99+ languages) with 70% confidence threshold
2. **Auto Punctuation**: Automatically adds punctuation marks for better readability
3. **Text Formatting**: Formats text with proper capitalization and spacing
4. **Speaker Labels**: Identifies different speakers (useful for lectures with multiple speakers)
5. **Language Confidence Logging**: Logs the detected language and confidence score for debugging

These features ensure high-quality transcriptions that are ready for study and analysis.

## Troubleshooting

### Error: "Missing ASSEMBLYAI_API_KEY"
- **Solution**: Set the `ASSEMBLYAI_API_KEY` secret in Supabase Dashboard → Edge Functions → Settings → Secrets
- The code has a fallback, but it's better to set it properly

### Error: "Missing OPENAI_API_KEY"
- **Solution**: Set the `OPENAI_API_KEY` secret (only needed for chat completions, not transcription)

### Check Function Logs
If you encounter issues, check the logs:
```bash
supabase functions logs ai-generate --follow
```

