# Deploy process-link Edge Function

## Quick Deploy Steps

The `process-link` edge function needs to be deployed to Supabase. Here's how:

### Step 1: Make sure you're logged in and linked to your project

```bash
# Login to Supabase (if not already logged in)
supabase login

# Link to your project (if not already linked)
supabase link --project-ref ypepyifdhyogsugtamxw
```

### Step 2: Deploy the process-link function

```bash
# Deploy the process-link edge function
supabase functions deploy process-link
```

### Step 3: Verify Deployment

After deployment, verify it's working:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/ypepyifdhyogsugtamxw
2. Navigate to **Edge Functions** in the sidebar
3. You should see `process-link` in the list (alongside `ai-generate`)
4. It should show as "Active" or "Deployed"

### Step 4: Check Function Logs (if needed)

If you encounter issues, check the logs:

```bash
# View logs for process-link function
supabase functions logs process-link --follow
```

### Environment Variables

The `process-link` function needs these environment variables (same as `ai-generate`):

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key

These should already be set if you've deployed `ai-generate`. If not, set them:

```bash
# Set environment variables (if not already set)
supabase secrets set SUPABASE_URL=https://ypepyifdhyogsugtamxw.supabase.co
supabase secrets set SUPABASE_ANON_KEY=your_anon_key_here
```

You can also set them in the Supabase Dashboard:
1. Go to **Edge Functions** → **Settings** (or **Configuration**)
2. Add the secrets if they're missing

## Troubleshooting

### Error: "Function not found" or 404
- Make sure the function is deployed: `supabase functions deploy process-link`
- Check the function name matches exactly: `process-link` (not `process_link`)

### Error: "Missing Supabase env"
- Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` secrets
- These are shared across all edge functions in your project

### Error: "Unauthorized"
- Make sure the user is authenticated in your app
- The function requires a valid JWT token in the Authorization header

### Function Deployed but Still Not Working
1. Check the logs: `supabase functions logs process-link`
2. Try testing with a simple YouTube URL
3. Verify the function appears in the Supabase Dashboard

## Testing

After deployment, test the function:

```bash
# Test with curl (replace YOUR_ACCESS_TOKEN with your actual token)
curl -X POST \
  https://ypepyifdhyogsugtamxw.supabase.co/functions/v1/process-link \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "youtube",
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "videoId": "dQw4w9WgXcQ"
  }'
```

Or test it directly in your app by trying to add a YouTube link.


