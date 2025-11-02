# Nano AI - Setup Instructions

This document provides step-by-step instructions to set up the Nano AI app with Supabase and OpenAI integration.

## Prerequisites

- Node.js 18+ and npm installed
- A Supabase account (free tier is sufficient)
- An OpenAI API key

## Step 1: Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down your project URL and anon key from Settings > API
3. In the Supabase dashboard, go to SQL Editor
4. Copy and paste the contents of `supabase-schema.sql`
5. Run the SQL script to create all necessary tables and policies

## Step 2: Set Up Storage

1. In Supabase, go to **Storage**
2. Click **"New bucket"**
3. Name: **`documents`**
4. Public bucket: **OFF** (make it private)
5. Click **"Create bucket"**
6. Go to **SQL Editor** in Supabase
7. Copy and paste the contents of `storage-policies.sql`
8. Run the SQL script to create RLS policies for storage

**Alternative:** The storage policies SQL script creates policies that ensure users can only access files in their own user folders (based on the folder name structure).

## Step 3: Get API Keys

### Supabase
1. Go to your project settings
2. Copy the Project URL
3. Copy the Anon/public key (under API keys)

### OpenAI
1. Go to [platform.openai.com](https://platform.openai.com)
2. Navigate to API keys
3. Create a new secret key
4. Copy the key (you won't be able to see it again!)

## Step 4: Configure Environment Variables

1. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

2. Edit `.env` and add your credentials:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_OPENAI_API_KEY=your_openai_api_key
```

**Important:** Never commit the `.env` file to version control!

## Step 5: Install Dependencies

```bash
npm install
```

## Step 6: Run the Application

```bash
npm run dev
```

The app should now be running at `http://localhost:5173`

## Step 7: Create Your First Account

1. The app will redirect you to the login page
2. Click on "Sign Up" to create a new account
3. You'll receive an email confirmation
4. Once logged in, you can start creating notes!

## Features

- ✅ User authentication with Supabase Auth
- ✅ Create and organize folders
- ✅ Create notes from multiple sources:
  - Voice recordings (transcribed with OpenAI Whisper)
  - Uploaded PDFs and text documents
  - YouTube videos (transcripts)
  - Web links
- ✅ Search across all notes
- ✅ Navigate through folders
- ✅ Settings page
- ✅ How to Use page
- ✅ Support page

## Troubleshooting

### API Keys Not Working
- Make sure your `.env` file is in the root directory
- Restart the dev server after changing `.env`
- Check that the keys are correct (no extra spaces)

### Database Connection Issues
- Verify your Supabase URL and key are correct
- Check that the SQL schema was run successfully
- Ensure Row Level Security policies are enabled

### Upload Issues
- Check that the storage bucket `documents` exists
- Verify storage policies are set up correctly
- Check browser console for specific error messages

## Cost Estimates

### Supabase (Free Tier)
- Database: 500MB
- Storage: 1GB
- Auth: 50,000 active users
- API requests: 2M per month

### OpenAI (Pay-as-you-go)
- Transcription: ~$0.006 per minute
- Chat completions: ~$0.03 per 1K tokens (GPT-4)
- Estimated: $20-50/month for moderate usage

## Support

For issues or questions:
- Check the Support page in the app
- Review the How to Use page for features
- Check browser console for error messages
