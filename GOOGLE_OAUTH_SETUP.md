# Google OAuth Setup Guide

## Fixing "redirect_uri_mismatch" Error

This error occurs when the redirect URI configured in Google Cloud Console doesn't match the one that Supabase uses when acting as OAuth proxy.

## Important: How Supabase OAuth Works

When using Supabase for OAuth, **Supabase acts as a proxy** between your app and Google. The flow is:

1. User clicks "Sign in with Google" in your app
2. Your app calls `supabase.auth.signInWithOAuth()` with `redirectTo: ${window.location.origin}/auth/callback`
3. **Supabase redirects to Google** using its own callback URL: `https://[your-project].supabase.co/auth/v1/callback`
4. Google redirects back to **Supabase** (not directly to your app)
5. Supabase processes the authentication and then redirects to your app's `/auth/callback`

**Therefore**: The redirect URI in **Google Cloud Console** must be the **Supabase callback URL**, not your app's URL.

## Step 1: Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (the one configured for Supabase)
3. Navigate to **APIs & Services** → **Credentials**
4. Click on your **OAuth 2.0 Client ID** (the one used by Supabase)
5. Under **"Authorized redirect URIs"**, click **"ADD URI"** and add:

### The Supabase Callback URL:
```
https://ypepyifdhyogsugtamxw.supabase.co/auth/v1/callback
```

⚠️ **Important**: Replace `ypepyifdhyogsugtamxw` with your actual Supabase project reference ID.

You can find your Supabase project ID:
- In your Supabase dashboard URL: `https://app.supabase.com/project/[PROJECT_ID]`
- In your Supabase project settings → API → Project URL (the subdomain part)

6. Click **"SAVE"**

## Step 2: Configure Supabase Dashboard

In Supabase, you need to configure where Supabase should redirect users AFTER processing the OAuth callback from Google.

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. Under **"Redirect URLs"**, add:

### For Local Development:
```
http://localhost:5173/auth/callback
```

### For Production:
```
https://your-production-domain.com/auth/callback
```

Replace `your-production-domain.com` with your actual domain (e.g., `https://your-app.vercel.app/auth/callback`)

5. Under **"Site URL"**, set:
   - Local: `http://localhost:5173`
   - Production: `https://your-production-domain.com`

6. Save the changes

## Step 3: Verify Google OAuth Provider in Supabase

1. In Supabase Dashboard, go to **Authentication** → **Providers**
2. Click on **Google** provider
3. Verify that:
   - Google provider is **Enabled**
   - Client ID and Client Secret are correctly configured
   - The Client ID matches the one in Google Cloud Console

## Step 4: Verify Configuration

After making changes:

1. Wait 1-2 minutes for changes to propagate
2. Try signing in with Google again
3. The redirect should now work correctly

## Important Notes

⚠️ **Critical**: 
- **Google Cloud Console** needs the **Supabase callback URL**: `https://[project-id].supabase.co/auth/v1/callback`
- **Supabase Dashboard** needs your **app's callback URL**: `https://your-domain.com/auth/callback`

⚠️ **The redirect URIs must match EXACTLY**:
- Protocol: `http://` vs `https://`
- Port number (if specified)
- Path: Must be exactly `/auth/v1/callback` for Supabase (in Google Cloud Console)
- Trailing slashes matter

## Common Issues

### Still getting redirect_uri_mismatch?

The error message shows which redirect URI Google is receiving. In your case:
```
redirect_uri=https://ypepyifdhyogsugtamxw.supabase.co/auth/v1/callback
```

**Solution**: Add this exact URL to Google Cloud Console:
1. Copy the exact URL from the error: `https://ypepyifdhyogsugtamxw.supabase.co/auth/v1/callback`
2. Go to Google Cloud Console → Credentials → Your OAuth Client
3. Add this URL to "Authorized redirect URIs"
4. Save and wait 1-2 minutes

1. **Check for typos**: Ensure no extra spaces or characters
2. **Clear browser cache**: Sometimes cached OAuth responses cause issues
3. **Verify Supabase project ID**: Make sure you're using the correct Supabase project reference in the URL
4. **Wait a few minutes**: Changes can take 1-2 minutes to propagate
5. **Check Google OAuth credentials**: Verify the Client ID in Supabase matches the one in Google Cloud Console

### Multiple Environments

For **Google Cloud Console**, you only need **one redirect URI**:
```
https://ypepyifdhyogsugtamxw.supabase.co/auth/v1/callback
```

For **Supabase Dashboard**, add all your app's callback URLs:
```
http://localhost:5173/auth/callback
https://staging.your-domain.com/auth/callback
https://your-domain.com/auth/callback
```

## Testing

After configuration:

1. Clear browser cache or use incognito mode
2. Try signing in with Google
3. You should be redirected to Google's sign-in page
4. After authentication, you'll be redirected back to `/auth/callback`
5. The app should automatically redirect you to `/home`

## Need Help?

If you're still having issues:
- Check the browser console for specific error messages
- Verify your Google OAuth credentials in Supabase Dashboard → Authentication → Providers
- Ensure your domain is verified in Google Cloud Console (for production)

