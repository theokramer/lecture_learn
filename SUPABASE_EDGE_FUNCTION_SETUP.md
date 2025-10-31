# Supabase Edge Function Setup Guide

This guide will help you set up the `ai-generate` edge function in Supabase to enable audio transcription.

## Prerequisites

1. Supabase CLI installed
2. Your Supabase project set up
3. OpenAI API key ready

## Step 1: Install Supabase CLI (if not already installed)

```bash
npm install -g supabase
```

Or using Homebrew (Mac):
```bash
brew install supabase/tap/supabase
```

## Step 2: Login to Supabase

```bash
supabase login
```

This will open a browser window for authentication.

## Step 3: Link Your Project

```bash
# Navigate to your project directory
cd /path/to/react-learning-notes

# Link to your Supabase project
supabase link --project-ref your-project-ref
```

You can find your project ref in your Supabase dashboard URL: `https://supabase.com/dashboard/project/[PROJECT_REF]`

Or link using your project URL:
```bash
supabase link --project-ref ypepyifdhyogsugtamxw
```

## Step 4: Set Environment Variables

You need to set these environment variables for your edge function in Supabase:

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** → **Settings** (or use CLI)

### Option A: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Click on **Edge Functions** in the sidebar
3. Click on the **Settings** tab (or Configuration) tab
4. Add the following secrets:

| Secret Name | Description | Where to find it |
|------------|-------------|------------------|
| `OPENAI_API_KEY` | Your OpenAI API key | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `SUPABASE_URL` | Your Supabase project URL | Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon key | Project Settings → API → Project API keys → `anon` `public` |

### Option B: Using Supabase CLI

```bash
# Set OpenAI API key
supabase secrets set OPENAI_API_KEY=your_openai_api_key_here

# Set Supabase URL
supabase secrets set SUPABASE_URL=https://ypepyifdhyogsugtamxw.supabase.co

# Set Supabase Anon Key
supabase secrets set SUPABASE_ANON_KEY=your_anon_key_here
```

**Important:** The edge function needs these environment variables to:
- Access OpenAI API for transcription
- Access Supabase storage to download audio files
- Create authenticated Supabase clients

## Step 5: Deploy the Edge Function

```bash
# Deploy the ai-generate function
supabase functions deploy ai-generate
```

The deployment will:
- Upload the function code from `supabase/functions/ai-generate/index.ts`
- Set up the function endpoint at `https://your-project.supabase.co/functions/v1/ai-generate`
- Configure CORS and authentication

## Step 6: Verify Deployment

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions**
3. You should see `ai-generate` in the list
4. Check that it shows as "Active" or "Deployed"

## Step 7: Test the Function

You can test the function using curl or from your app. The function should be accessible at:
```
https://ypepyifdhyogsugtamxw.supabase.co/functions/v1/ai-generate
```

## Troubleshooting

### Error: "Missing OPENAI_API_KEY"
- **Solution**: Make sure you've set the `OPENAI_API_KEY` secret in Supabase
- Check in Dashboard → Edge Functions → Settings → Secrets

### Error: "Missing Supabase env"
- **Solution**: Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` secrets
- These should match your project URL and anon key from Project Settings → API

### Error: "Unauthorized"
- **Solution**: Make sure you're sending the Authorization header with a valid JWT token
- The function requires authentication to prevent unauthorized access

### Error: 400 Bad Request - "Missing storagePath or audioBase64"
- **Solution**: This means the request body is malformed
- Check that you're sending `{ type: 'transcription', storagePath: '...' }` correctly

### Error: 400 Bad Request - Storage download failed
- **Solution**: Check storage bucket permissions
- Ensure the `documents` bucket exists
- Verify RLS policies allow authenticated users to read their own files
- Check that the storage path is correct (format: `userId/filename.webm`)

### Function Not Found (404)
- **Solution**: The function might not be deployed
- Run `supabase functions deploy ai-generate` again
- Check the function name matches exactly: `ai-generate`

### Check Function Logs

View logs in real-time:
```bash
supabase functions logs ai-generate
```

Or in the Supabase Dashboard:
1. Go to **Edge Functions** → **ai-generate**
2. Click on **Logs** tab
3. Check for any error messages

## Storage Bucket Setup

Make sure your `documents` storage bucket is set up correctly:

1. Go to **Storage** in Supabase Dashboard
2. Ensure `documents` bucket exists
3. Check that RLS policies allow:
   - Users can upload files to their own folder (`userId/...`)
   - Users can read files from their own folder
   - The edge function can read files (using service role or authenticated user token)

## Testing the Transcription Flow

1. Record audio in your app
2. Upload audio file to storage (should get path like `userId/timestamp.webm`)
3. Call edge function with `{ type: 'transcription', storagePath: 'userId/timestamp.webm' }`
4. Edge function should:
   - Download file from storage
   - Send to OpenAI Whisper API
   - Return transcription text

## Next Steps

After setting up the edge function:
1. Test audio transcription in your app
2. Check edge function logs for any errors
3. Monitor OpenAI API usage
4. Verify storage bucket permissions if downloads fail

## Additional Resources

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Supabase Storage RLS Policies](https://supabase.com/docs/guides/storage/security/access-control)

