# Quick Start: Account-Level Rate Limits

## What Changed
✅ **Old**: Users could generate AI 15 times per day  
✅ **New**: Each account gets **exactly 1 AI generation ever** (one-time quota)

## Installation (3 Steps)

### Step 1: Run Database Migration
1. Open **Supabase Console** → **SQL Editor**
2. Copy the entire contents of `MIGRATE_TO_ACCOUNT_LIMITS.sql`
3. Paste into SQL Editor and click **RUN**
4. ✅ You should see "Executed successfully"

### Step 2: Deploy Code Changes
All code changes are already in your repository:
- Edge Function: `supabase/functions/ai-generate/index.ts` ✅
- Frontend: `src/services/aiGateway.ts` + 6 UI components ✅

Just deploy as normal (git push or Vercel/your hosting)

### Step 3: Test It Works
1. Log in as a test user
2. Generate AI content (Summary, Quiz, Chat, etc.)
3. ✅ Should succeed
4. Try again
5. ✅ Should see error: "You have already used your one-time AI generation quota"

## Verify in Database

```sql
-- After generating, run this in Supabase SQL Editor
SELECT user_id, has_used_ai_generation, ai_generation_used_at 
FROM account_ai_usage 
LIMIT 10;
```

**After first generation:**
```
user_id                              | has_used_ai_generation | ai_generation_used_at
123e4567-e89b-12d3-a456-426614174000 | true                   | 2025-11-01T15:30:45.123Z
```

## Troubleshooting

### Table is empty after generation?
→ See `DEBUG_RATE_LIMIT.md` for detailed troubleshooting

### Permission errors?
→ Re-run `MIGRATE_TO_ACCOUNT_LIMITS.sql` (it fixes RLS policies)

### Generation still works twice?
→ Check Edge Function logs in Supabase Console

## Admin: Reset a User's Quota

```sql
-- Let user generate again
UPDATE account_ai_usage 
SET has_used_ai_generation = false, ai_generation_used_at = NULL
WHERE user_id = 'USER_ID_HERE';
```

## Admin: Reset All Users

```sql
-- WARNING: Allows ALL users to generate again!
UPDATE account_ai_usage 
SET has_used_ai_generation = false, ai_generation_used_at = NULL;
```

## Files Modified

```
Backend:
  ✅ supabase/functions/ai-generate/index.ts
  ✅ supabase-schema.sql

Frontend:
  ✅ src/services/aiGateway.ts
  ✅ src/components/note/AIChatPanel.tsx
  ✅ src/components/note/study-modes/SummaryView.tsx
  ✅ src/components/note/study-modes/ExercisesView.tsx
  ✅ src/components/note/study-modes/FeynmanView.tsx
  ✅ src/components/note/study-modes/QuizView.tsx
  ✅ src/pages/ProcessingPage.tsx

Documentation:
  📄 RATE_LIMIT_CHANGES.md (detailed explanation)
  📄 DEBUG_RATE_LIMIT.md (troubleshooting guide)
  📄 MIGRATE_TO_ACCOUNT_LIMITS.sql (database migration)
```

## Key Features

✅ **One-time quota**: Each account gets exactly 1 generation  
✅ **Lifetime tracking**: Quota never resets  
✅ **Tracks usage**: `ai_generation_used_at` timestamp stored  
✅ **Works everywhere**: Summary, Quiz, Exercises, Feynman, Chat, Audio  
✅ **User-friendly errors**: Clear message when limit reached  
✅ **Admin controls**: Can reset individual users or all users  
✅ **Logging**: Edge function logs all attempts (for debugging)  

## What Users See

**First generation:**
- ✅ "Generating summary..." → Success!

**Second generation:**
- ❌ "You have already used your one-time AI generation quota. No additional AI generations are available."

---

**Questions?** Check `DEBUG_RATE_LIMIT.md` or `RATE_LIMIT_CHANGES.md`
