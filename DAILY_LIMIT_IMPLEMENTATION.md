# Daily AI Usage Limit - Implementation Summary

## ✅ What's Already Built

Your app already has a complete **daily AI usage limit system** in place. It:

1. ✅ **Tracks daily usage** - Each day, per user
2. ✅ **Checks before generating** - Before every AI operation
3. ✅ **Increments after success** - Counts successful generations
4. ✅ **Shows user errors** - Clear "try again tomorrow" messages
5. ✅ **Resets daily** - Fresh count at 00:00 UTC each day
6. ✅ **Configurable limits** - Adjustable per user via database

## How It Works

### The Flow

```
User Creates Note with Audio/Text
         ↓
[Check Rate Limit]
  ├─ Fetch today's count from database
  ├─ Compare against daily_ai_limit
  └─ If count < limit → ALLOW
     If count >= limit → REJECT with "DAILY_LIMIT_REACHED"
         ↓
If REJECTED:
  └─ Show Error: "Daily AI limit reached. Please try again tomorrow."
         ↓
If ALLOWED:
  ├─ Generate AI content (transcribe, summarize, etc.)
  ├─ On Success: Increment counter in database
  └─ User sees generated content
```

## Key Components

### 1. Database (`daily_ai_usage` table)

```
user_id      | usage_date | count | created_at
─────────────┼────────────┼───────┼─────────────
user-123     | 2025-11-01 | 1     | 2025-11-01
user-456     | 2025-11-01 | 0     | 2025-11-01
user-123     | 2025-10-31 | 1     | 2025-10-31
```

### 2. Edge Function (`supabase/functions/ai-generate/index.ts`)

**Before any generation:**
- ✅ `checkDailyLimitOrThrow()` - Checks if user is under limit
- Returns 429 error if limit reached

**After successful generation:**
- ✅ `incrementDailyUsage()` - Increments the counter

### 3. Frontend Error Handling

All UI components catch `DAILY_LIMIT_REACHED` errors and show:

```
"Daily AI limit reached (15/day). Please try again tomorrow."
```

## Where It's Used

### ✅ ProcessingPage (Audio/Text Upload)
- When transcribing audio
- When auto-generating title
- When generating study materials

### ✅ Study Mode Components
- `SummaryView` - Summary generation
- `QuizView` - Quiz generation
- `ExercisesView` - Exercises generation
- `FlashcardsView` - Flashcards generation
- `FeynmanView` - Feynman method feedback
- `AIChatPanel` - Chat completions

## Current Status

| Component | Status | Limit Check | Error Handling |
|-----------|--------|-------------|----------------|
| Edge Function | ✅ | Pre-generation | Returns 429 |
| aiGateway | ✅ | Error parsing | Throws RateLimitError |
| ProcessingPage | ✅ | Calls services | Displays error |
| SummaryView | ✅ | Calls service | Toast error |
| QuizView | ✅ | Calls service | UI error state |
| ExercisesView | ✅ | Calls service | UI error state |
| FlashcardsView | ✅ | Calls service | UI error state |
| FeynmanView | ✅ | Calls service | Feedback message |
| AIChatPanel | ✅ | Calls service | Chat message |

## Testing the System

### Test 1: Verify Today's Count

```sql
-- See how many times the user generated today
SELECT * FROM daily_ai_usage 
WHERE user_id = 'YOUR_USER_ID' 
  AND usage_date = CURRENT_DATE;
```

**Results:**
- Empty → User hasn't used AI today (can generate)
- count = 0 → Record created but no uses yet
- count = 1 → 1 generation used

### Test 2: Set Custom Limit & Test

```sql
-- Give user 3 generations per day
INSERT INTO account_limits (user_id, daily_ai_limit)
VALUES ('test-user-id', 3)
ON CONFLICT (user_id) DO UPDATE SET daily_ai_limit = 3;

-- Now test:
-- Gen 1 → Works ✅
-- Gen 2 → Works ✅
-- Gen 3 → Works ✅
-- Gen 4 → Error: "Daily AI limit reached" ❌
```

### Test 3: Check Error in Edge Function Logs

When limit is reached, you'll see in Supabase logs:

```
[RATE_LIMIT_CHECK] 📈 Current Usage: 3/3
[RATE_LIMIT_CHECK] 🎯 Remaining: 0
[RATE_LIMIT_CHECK] ⛔ LIMIT REACHED!
```

## Admin Operations

### Check User's Current Daily Usage

```sql
SELECT user_id, usage_date, count 
FROM daily_ai_usage 
WHERE user_id = 'user-uuid' 
  AND usage_date = CURRENT_DATE;
```

### Check User's Configured Limit

```sql
SELECT daily_ai_limit 
FROM account_limits 
WHERE user_id = 'user-uuid';
-- If not found → user has default limit of 1
```

### Set Custom Limit for User

```sql
INSERT INTO account_limits (user_id, daily_ai_limit)
VALUES ('user-uuid', 10)
ON CONFLICT (user_id) DO UPDATE SET daily_ai_limit = 10;
```

### Reset User's Counter (Testing)

```sql
DELETE FROM daily_ai_usage 
WHERE user_id = 'user-uuid' 
  AND usage_date = CURRENT_DATE;

-- Next generation will create new record with count = 0
```

### Find Users Who Hit Today's Limit

```sql
SELECT u.user_id, u.count, l.daily_ai_limit
FROM daily_ai_usage u
LEFT JOIN account_limits l ON u.user_id = l.user_id
WHERE u.usage_date = CURRENT_DATE
  AND u.count >= COALESCE(l.daily_ai_limit, 1);
```

## File References

### Backend Files

1. **`supabase/functions/ai-generate/index.ts`**
   - `checkDailyLimitOrThrow()` - Checks limit before generation
   - `incrementDailyUsage()` - Increments after generation
   - Called at line ~361 (check)
   - Called at line ~528, 630, 662 (increment)

2. **`supabase-schema.sql`**
   - `daily_ai_usage` table definition (lines 242-255)
   - Indexes and RLS policies

### Frontend Files

1. **`src/services/aiGateway.ts`**
   - `DAILY_LIMIT_REACHED` error handling
   - Throws `RateLimitError` with code and message

2. **UI Components** (catch `DAILY_LIMIT_REACHED`)
   - `src/components/note/study-modes/SummaryView.tsx`
   - `src/components/note/study-modes/QuizView.tsx`
   - `src/components/note/study-modes/ExercisesView.tsx`
   - `src/components/note/study-modes/FeynmanView.tsx`
   - `src/components/note/study-modes/FlashcardsView.tsx`
   - `src/components/note/AIChatPanel.tsx`

## How to Use It

### For Regular Users

1. **First generation** → Works ✅
2. **Second generation** → Error if limit is 1, works if limit > 1
3. **Next day at 00:00 UTC** → Counter resets, can generate again

### For Admins

1. **Monitor usage**: Check `daily_ai_usage` table
2. **Adjust limits**: Update `account_limits` table
3. **Reset counters**: Delete records from `daily_ai_usage`
4. **Watch logs**: Look for `[RATE_LIMIT_CHECK]` messages

## What Happens When Limit is Hit

### User Experience

1. User attempts AI generation
2. Gets error message:
   ```
   "Daily AI limit reached. Please try again tomorrow."
   ```
3. Cannot generate until next day at 00:00 UTC
4. All AI features are blocked (summary, quiz, exercises, etc.)

### In Processing Page

If uploading audio and transcription hits limit:
- Error is caught
- User sees: "Daily AI limit reached. Please try again tomorrow."
- Audio upload is aborted
- User is returned to home page

### In Study Mode

If trying to generate in any study mode (summary, quiz, etc.):
- Error is caught
- User sees error in that specific component
- Can try again tomorrow

## Error Messages

Users see these messages:

| Scenario | Message |
|----------|---------|
| Daily limit reached | `"Daily AI limit reached. Please try again tomorrow."` |
| At specific time | `"Daily AI limit reached. Please try again after 11:30 PM."` |
| Processing page | `"Daily AI limit reached. Please try again tomorrow."` |
| Chat panel | `"Daily AI limit reached (15/day). Please try again tomorrow."` |

## Summary

✅ **The daily AI usage limit is fully implemented and working!**

- ✅ Checks before every generation
- ✅ Increments after success
- ✅ Resets daily at 00:00 UTC
- ✅ Shows clear error messages
- ✅ Configurable per user
- ✅ Monitored via logs
- ✅ Managed via database

You're ready to deploy or customize as needed!

---

**For detailed technical info**, see `DAILY_AI_USAGE_RATE_LIMITING.md`
