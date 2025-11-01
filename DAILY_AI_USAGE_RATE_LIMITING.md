# Daily AI Usage Rate Limiting

## Overview

This document describes how the app tracks **daily AI usage** and enforces a configurable daily limit (default: 1 generation per day).

## How It Works

### Database Table

The `daily_ai_usage` table tracks usage per user per day:

```sql
CREATE TABLE daily_ai_usage (
  user_id UUID NOT NULL,
  usage_date DATE NOT NULL,
  count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, usage_date)
);
```

**Fields:**
- `user_id`: User identifier
- `usage_date`: Date in UTC (YYYY-MM-DD)
- `count`: Number of AI generations used that day
- `created_at`: When record was created

### Rate Limiting Flow

```
┌─────────────────────────┐
│ User Requests AI        │
│ Generation              │
└────────────┬────────────┘
             │
             ▼
    ┌────────────────────────────┐
    │ Check DAILY_AI_USAGE Table │
    │ For Today's Date           │
    └────────────┬───────────────┘
             │
             ├──────────────────────────┐
             │ No Record for Today      │
             ▼                          ▼
       Create New Record          Find Existing Record
       count = 0                   Get current count
             │                          │
             └──────────────┬───────────┘
                            │
                ┌───────────▼──────────┐
                │ Is count < limit?   │
                └───────┬──────────────┘
                        │
          ┌─────────────┴──────────────┐
          │                            │
         YES                          NO
          │                            │
          ▼                            ▼
    Allow generation          Return 429 Error
    Increment count           (DAILY_LIMIT_REACHED)
                                      │
                                      ▼
                           Show "Try again tomorrow"
```

## Backend Implementation

### File: `supabase/functions/ai-generate/index.ts`

#### Daily Limit Check

**Function:** `checkDailyLimitOrThrow()`

```typescript
async function checkDailyLimitOrThrow(supabase: any, userId: string) {
  const usageDate = getUtcDateString();
  
  // 1. Get custom limit from account_limits table
  const { data: accountLimit } = await supabase
    .from('account_limits')
    .select('daily_ai_limit')
    .eq('user_id', userId)
    .single();
  
  const DAILY_LIMIT = accountLimit?.daily_ai_limit ?? 1;
  
  // 2. Get today's usage
  const { data: existingRow } = await supabase
    .from('daily_ai_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('usage_date', usageDate)
    .single();
  
  // 3. If no record exists, create it (first use of the day)
  if (!existingRow) {
    await supabase
      .from('daily_ai_usage')
      .insert({ user_id: userId, usage_date: usageDate, count: 0 });
    return null; // Allow
  }
  
  // 4. Check if limit reached
  if (existingRow.count >= DAILY_LIMIT) {
    return new Response(
      JSON.stringify({
        code: 'DAILY_LIMIT_REACHED',
        message: 'Daily limit reached. Please try again tomorrow.',
        limit: DAILY_LIMIT,
        remaining: 0,
        resetAt: getResetAtIso(), // Tomorrow at 00:00 UTC
      }),
      { status: 429 }
    );
  }
  
  return null; // Allow
}
```

#### Incrementing Counter

**Function:** `incrementDailyUsage()`

```typescript
async function incrementDailyUsage(supabase: any, userId: string) {
  const usageDate = getUtcDateString();
  
  const { data: row } = await supabase
    .from('daily_ai_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('usage_date', usageDate)
    .single();
  
  const newCount = (row?.count ?? 0) + 1;
  
  await supabase
    .from('daily_ai_usage')
    .update({ count: newCount })
    .eq('user_id', userId)
    .eq('usage_date', usageDate);
}
```

### Integration Points

1. **Every AI generation request** calls:
   ```typescript
   const limitCheck = await checkDailyLimitOrThrow(supabase, user.id);
   if (limitCheck) return limitCheck; // Reject if over limit
   ```

2. **After successful generation** calls:
   ```typescript
   await incrementDailyUsage(supabase, user.id);
   ```

## Frontend Implementation

### File: `src/services/aiGateway.ts`

Error handling for `DAILY_LIMIT_REACHED`:

```typescript
if (errBody?.code === 'DAILY_LIMIT_REACHED') {
  throw new RateLimitError(
    errBody?.message || 'Daily limit reached',
    {
      limit: errBody.limit ?? 15,
      remaining: 0,
      resetAt: errBody.resetAt ?? new Date().toISOString(),
      code: 'DAILY_LIMIT_REACHED',
    }
  );
}
```

### UI Components

All study mode components handle the error:

**Pattern:**
```typescript
catch (error: any) {
  if (error?.code === 'DAILY_LIMIT_REACHED') {
    const resetAt = error?.resetAt ? new Date(error.resetAt) : null;
    const when = resetAt ? ` after ${resetAt.toLocaleTimeString()}` : ' tomorrow';
    showError(`Daily AI limit reached. Please try again${when}.`);
  }
  // ... other error cases
}
```

**Components:**
- ✅ `SummaryView.tsx` - Toast notification
- ✅ `QuizView.tsx` - Error state
- ✅ `ExercisesView.tsx` - Error state
- ✅ `FeynmanView.tsx` - Feedback message
- ✅ `FlashcardsView.tsx` - Error state
- ✅ `AIChatPanel.tsx` - Chat message

## Configuring the Limit

### Default Limit
- **Default**: 1 generation per day per user

### Per-User Custom Limit

Edit user's limit in the `account_limits` table:

```sql
-- Set user to 15 generations per day
INSERT INTO account_limits (user_id, daily_ai_limit)
VALUES ('user-uuid', 15)
ON CONFLICT (user_id) DO UPDATE
SET daily_ai_limit = 15;

-- Check current limit
SELECT * FROM account_limits WHERE user_id = 'user-uuid';
```

## Admin Commands

### Check User's Today's Usage

```sql
SELECT user_id, usage_date, count 
FROM daily_ai_usage 
WHERE user_id = 'USER_UUID' 
  AND usage_date = CURRENT_DATE;
```

### Check All Users' Today's Usage

```sql
SELECT user_id, usage_date, count 
FROM daily_ai_usage 
WHERE usage_date = CURRENT_DATE
ORDER BY count DESC;
```

### Find Users Who Hit Today's Limit

```sql
SELECT u.user_id, u.usage_date, u.count, l.daily_ai_limit
FROM daily_ai_usage u
LEFT JOIN account_limits l ON u.user_id = l.user_id
WHERE u.usage_date = CURRENT_DATE
  AND u.count >= COALESCE(l.daily_ai_limit, 1)
ORDER BY u.count DESC;
```

### Reset User's Daily Count

```sql
DELETE FROM daily_ai_usage 
WHERE user_id = 'USER_UUID' 
  AND usage_date = CURRENT_DATE;
```

### Check User's Limit Setting

```sql
SELECT user_id, daily_ai_limit 
FROM account_limits 
WHERE user_id = 'USER_UUID';

-- If not found, user uses default limit of 1
```

## What Counts as 1 Generation?

Each of these uses 1 count toward daily limit:

| Action | Component | Type |
|--------|-----------|------|
| Chat message | AI Chat Panel | Chat |
| Transcribe audio | ProcessingPage | Transcription |
| Generate summary | SummaryView | Summary |
| Generate quiz | QuizView | Quiz |
| Generate exercises | ExercisesView | Exercises |
| Generate flashcards | FlashcardsView | Flashcards |
| Feynman feedback | FeynmanView | Feedback |
| Auto title | ProcessingPage | Title generation |

## Error Messages Shown to Users

### When Daily Limit Reached

**Toast/Error Message:**
```
"Daily AI limit reached (15/day). Please try again tomorrow."
```

or with specific reset time:

```
"Daily AI limit reached. Please try again after 11:30:45 PM."
```

### In Processing Page

If transcription hits limit during processing:
```
"Daily AI limit reached. Please try again tomorrow."
```

## Testing

### Test 1: Basic Limit Check

```sql
-- Before any generation
SELECT * FROM daily_ai_usage WHERE user_id = 'test-user-id' AND usage_date = CURRENT_DATE;
-- Result: empty (no record)

-- After 1st generation
SELECT * FROM daily_ai_usage WHERE user_id = 'test-user-id' AND usage_date = CURRENT_DATE;
-- Result: count = 1

-- Try 2nd generation (with default limit of 1)
-- Result: Error "Daily AI limit reached"
```

### Test 2: Custom Limit

```sql
-- Set user to 5/day limit
INSERT INTO account_limits (user_id, daily_ai_limit) 
VALUES ('test-user-id', 5)
ON CONFLICT (user_id) DO UPDATE SET daily_ai_limit = 5;

-- User can now generate 5 times per day
-- On 6th attempt: "Daily AI limit reached"
```

### Test 3: Daily Reset

```sql
-- At 00:00 UTC:
-- Old day's data remains in daily_ai_usage table
SELECT * FROM daily_ai_usage WHERE user_id = 'test-user-id';

-- But new generation creates new record for new date
SELECT * FROM daily_ai_usage WHERE user_id = 'test-user-id' AND usage_date = CURRENT_DATE;
-- Result: count = 1 (fresh for new day)
```

## Monitoring

### Edge Function Logs

Look for `[RATE_LIMIT_CHECK]` messages:

```
[RATE_LIMIT_CHECK] 🔍 Starting Rate Limit Check
[RATE_LIMIT_CHECK] User ID: uuid-123
[RATE_LIMIT_CHECK] Date: 2025-11-01
[RATE_LIMIT_CHECK] 📊 Daily Limit: 1 (default)
[RATE_LIMIT_CHECK] 📈 Current Usage: 0/1
[RATE_LIMIT_CHECK] 🎯 Remaining: 1
[RATE_LIMIT_CHECK] ✅ ALLOW - User under limit
```

Or when limit reached:

```
[RATE_LIMIT_CHECK] 📈 Current Usage: 1/1
[RATE_LIMIT_CHECK] 🎯 Remaining: 0
[RATE_LIMIT_CHECK] ⛔ LIMIT REACHED!
```

## Best Practices

1. **Before any AI generation** → check limit
2. **After successful generation** → increment counter
3. **Show clear error messages** → "try again tomorrow"
4. **In processing** → handle limit gracefully
5. **Monitor logs** → watch for `[RATE_LIMIT_CHECK]` patterns

## Troubleshooting

### User Can Still Generate After Limit

1. Check edge function was deployed: `supabase functions deploy ai-generate`
2. Check table `daily_ai_usage` exists
3. Check RLS is disabled: `ALTER TABLE daily_ai_usage DISABLE ROW LEVEL SECURITY;`

### Count Not Increasing

1. Check logs for `[INCREMENT_USAGE]` messages
2. Verify database connection
3. Ensure transaction completes successfully

### Wrong Reset Time Displayed

1. Check user's timezone vs server timezone (uses UTC)
2. Reset is always next day at 00:00 UTC

## Related Features

- **Account Limits**: One-time quota system (separate table)
- **Processing Page**: Main entry point for transcription
- **Edge Function**: Core rate limiting logic
