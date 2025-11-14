# Web Deployment Guide - RocketLearn

This guide walks you through deploying RocketLearn to Vercel for web production.

## Prerequisites

1. A GitHub account
2. A Vercel account (free tier available at [vercel.com](https://vercel.com))
3. A Supabase project with production database configured
4. OpenAI API key

## Step 1: Prepare Your Repository

1. Ensure your code is pushed to GitHub:
   ```bash
   git add .
   git commit -m "Prepare for production deployment"
   git push origin main
   ```

2. Verify all environment variables are documented in `.env.example`

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Vercel will automatically detect it's a Vite project
5. Configure project settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (if repository root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (first time - will configure project)
vercel

# For production deployment
vercel --prod
```

## Step 3: Configure Environment Variables

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add the following variables for **all environments** (Production, Preview, Development):

| Variable Name | Description | Where to Find |
|--------------|-------------|---------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | Supabase Dashboard → Settings → API → Project API keys → `anon` `public` |
| `VITE_OPENAI_API_KEY` | Your OpenAI API key | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

**Important:**
- Add each variable to **all environments** (Production, Preview, Development)
- Never commit `.env` files to version control
- Vercel will automatically rebuild your app when variables are updated

## Step 4: Verify Deployment

1. After deployment, Vercel provides a URL like `https://your-app.vercel.app`
2. Visit the URL to test your application
3. Verify:
   - Login/signup functionality
   - Note creation
   - File uploads
   - AI features

## Step 5: Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Follow Vercel's DNS configuration instructions
4. Vercel will automatically provision SSL certificates

## Step 6: Configure Supabase for Production

1. Update Supabase redirect URLs:
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Add your production URL: `https://your-app.vercel.app`
   - Add auth callback URL: `https://your-app.vercel.app/auth/callback`

2. Verify RLS policies are enabled:
   - Run `supabase-schema.sql` in production database
   - Ensure all tables have Row Level Security enabled

3. Deploy edge functions:
   ```bash
   supabase functions deploy ai-generate
   supabase functions deploy process-link
   ```

## Step 7: Security Checklist

Before going live, verify:

- [ ] Security headers are configured in `vercel.json`
- [ ] Environment variables are set in Vercel
- [ ] HTTPS is enforced (automatic with Vercel)
- [ ] Supabase RLS policies are active
- [ ] Audit logging is enabled (`audit_log` table exists)
- [ ] Rate limiting is configured
- [ ] Error tracking is set up (optional: Sentry)

## Step 8: CI/CD Integration (Optional)

Vercel automatically deploys on git push. To customize:

1. Go to **Settings** → **Git**
2. Configure branch deployments:
   - Production: `main` branch
   - Preview: All other branches

## Monitoring & Maintenance

### View Logs
- Vercel Dashboard → **Deployments** → Click deployment → **Logs**
- Supabase Dashboard → **Edge Functions** → View logs

### Performance Monitoring
- Vercel Analytics (built-in)
- Check bundle size in build logs

### Error Tracking
Consider integrating Sentry for error tracking:
1. Sign up at [sentry.io](https://sentry.io)
2. Create a project
3. Install `@sentry/react` and configure in `src/main.tsx`

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Verify all dependencies are in `package.json`
- Ensure environment variables are set

### Environment Variables Not Working
- Restart deployment after adding variables
- Verify variable names match exactly (case-sensitive)
- Check Vercel logs for variable access errors

### Authentication Issues
- Verify Supabase redirect URLs include production domain
- Check Supabase dashboard for auth errors
- Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct

### CORS Errors
- Verify Supabase CORS settings allow your domain
- Check edge function CORS headers

## Rollback

If you need to rollback:

1. Go to **Deployments** in Vercel dashboard
2. Find the previous working deployment
3. Click **"..."** → **"Promote to Production"**

## Next Steps

- Set up monitoring and alerts
- Configure custom error pages (optional)
- Set up automated backups
- Review security audit logs regularly


