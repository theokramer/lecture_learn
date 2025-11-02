# Deploying to Vercel

This guide will help you deploy your Nano AI app to Vercel.

## Prerequisites

1. A GitHub account
2. A Vercel account (free tier is available)
3. A Supabase project with the database set up
4. An OpenAI API key

## Step 1: Push Your Code to GitHub

If you haven't already, push your code to GitHub:

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended for first time)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Vercel will automatically detect it's a Vite project
5. Configure your environment variables (see Step 3 below)
6. Click "Deploy"

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (first time)
vercel

# For production deployment
vercel --prod
```

## Step 3: Configure Environment Variables

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add the following variables:

| Name | Value | Environment |
|------|-------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | Production, Preview, Development |
| `VITE_OPENAI_API_KEY` | Your OpenAI API key | Production, Preview, Development |

**Important:** 
- Add each variable to all environments (Production, Preview, Development)
- Vercel will automatically build your app with these variables
- Never expose your API keys in your code

## Step 4: Verify Deployment

1. After deployment, Vercel will provide you with a URL like `https://your-app.vercel.app`
2. Visit the URL to test your application
3. Try logging in with your Supabase credentials

## Step 5: Custom Domain (Optional)

If you have a custom domain:

1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Follow Vercel's instructions to configure DNS
4. SSL certificate will be automatically provisioned

## Environment Variables

Make sure you have these environment variables set up in your Vercel project:

- `VITE_SUPABASE_URL`: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `VITE_OPENAI_API_KEY`: Your OpenAI API key

## Automatic Deployments

Vercel automatically deploys:
- **Production**: Every push to your main branch
- **Preview**: Every pull request and other branches

## Troubleshooting

### Build Fails

- Check the Vercel build logs for errors
- Ensure all environment variables are set
- Verify your `package.json` has the correct build script

### Environment Variables Not Working

- Make sure variable names start with `VITE_`
- Redeploy the project after adding new variables
- Check that variables are enabled for the correct environment

### API Errors

- Verify your Supabase URL and keys are correct
- Check your OpenAI API key is valid
- Review browser console for specific error messages

### Static File Not Found (404)

- The `vercel.json` rewrite rules should handle this
- Check that your build output is in the `dist` directory

## Performance Tips

1. **Enable Edge Network**: Vercel automatically uses edge caching
2. **Optimize Images**: Use Vercel's Image Optimization
3. **Monitor Analytics**: Check Vercel Analytics for performance metrics
4. **Use Environment-Specific Variables**: Use preview URLs for testing

## Cost Estimate

### Vercel (Free Tier)
- 100GB bandwidth per month
- Unlimited deployments
- Automatic SSL
- Custom domains

For higher traffic, consider upgrading to the Pro plan ($20/month).

## Need Help?

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Support](https://vercel.com/support)
- Check your deployment logs in the Vercel dashboard

## Next Steps

After successful deployment:

1. Test all features in the production environment
2. Set up monitoring and analytics
3. Configure backup and recovery procedures
4. Consider setting up a staging environment

