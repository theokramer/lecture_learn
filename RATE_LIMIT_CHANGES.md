# Rate Limit Implementation: Daily → Once Per Account

## Overview
Changed the AI generation rate limiting system from **15 generations per day per user** to **1 generation per account lifetime** (once per account, ever).

## Changes Made

### 1. Database Schema (supabase-schema.sql)
- **Deprecated**: `daily_ai_usage` table (kept for backward compatibility)
- **New**: `account_ai_usage` table
  - Tracks whether a user has already used their one-time AI generation
  - Stores the timestamp when the quota was used
  - Row-level security ensures users can only see/modify their own records

**Migration Script**: Run `MIGRATE_TO_ACCOUNT_LIMITS.sql` in Supabase to set up the new table.

### 2. Edge Function (supabase/functions/ai-generate/index.ts)
- Replaced `incrementUsageOrThrow()` with `checkAccountLevelLimitOrThrow()`
- New function `markAccountLimitAsUsed()` marks the account as having used their quota
- Updated all three success paths to mark the limit as used:
  - Chat completions
  - Audio transcription (storage-based)
  - Audio transcription (base64-based)
- Returns error code `ACCOUNT_LIMIT_REACHED` (instead of `DAILY_LIMIT_REACHED`)

### 3. API Gateway (src/services/aiGateway.ts)
- Renamed `DailyLimitError` → `RateLimitError` (kept alias for backward compatibility)
- Added `usedAt` field to track when the quota was used
- Updated error detection to handle both old and new error codes:
  - `DAILY_LIMIT_REACHED` (for backward compatibility)
  - `ACCOUNT_LIMIT_REACHED` (new account-level limit)
- Updated both `chatCompletion()` and `transcribeAudio()` methods

### 4. UI Components - Error Messages Updated
Updated all components to display different messages for account vs. daily limits:

#### SummaryView (src/components/note/study-modes/SummaryView.tsx)
```
ACCOUNT_LIMIT_REACHED: "You have already used your one-time AI generation quota. No additional AI generations are available."
```

#### AIChatPanel (src/components/note/AIChatPanel.tsx)
```
ACCOUNT_LIMIT_REACHED: "You have already used your one-time AI generation quota. No additional AI generations are available."
```

#### ExercisesView (src/components/note/study-modes/ExercisesView.tsx)
```
ACCOUNT_LIMIT_REACHED: "You have already used your one-time AI generation quota. No additional AI generations are available."
```

#### FeynmanView (src/components/note/study-modes/FeynmanView.tsx)
```
ACCOUNT_LIMIT_REACHED: "You have already used your one-time AI generation quota. No additional AI generations are available."
```

#### QuizView (src/components/note/study-modes/QuizView.tsx)
```
ACCOUNT_LIMIT_REACHED: "You have already used your one-time AI generation quota. No additional AI generations are available."
```

#### ProcessingPage (src/pages/ProcessingPage.tsx)
```
ACCOUNT_LIMIT_REACHED: "You have already used your one-time AI generation quota. No additional AI generations are available."
```

## How It Works

### User Flow: First Generation (Allowed)
1. User requests AI generation (chat, summary, quiz, etc.)
2. Edge function checks `account_ai_usage.has_used_ai_generation`
3. If `FALSE` → Allow generation to proceed
4. After successful generation → Set `has_used_ai_generation = TRUE` and store `ai_generation_used_at`
5. Return success response

### User Flow: Subsequent Generations (Blocked)
1. User requests AI generation
2. Edge function checks `account_ai_usage.has_used_ai_generation`
3. If `TRUE` → Return HTTP 429 with error code `ACCOUNT_LIMIT_REACHED`
4. Frontend catches error and displays: "You have already used your one-time AI generation quota..."

## Database Setup

### Option A: Clean Database (New Users)
Run the main schema file:
```sql
-- Run in Supabase SQL Editor
-- From: supabase-schema.sql
```

### Option B: Existing Database
Run the migration script:
```sql
-- Run in Supabase SQL Editor
-- From: MIGRATE_TO_ACCOUNT_LIMITS.sql
```

This will:
- Create the new `account_ai_usage` table if it doesn't exist
- Drop and recreate the RLS policies safely
- Keep the old `daily_ai_usage` table for backward compatibility (optional delete)

## Files Modified

### Backend
- `supabase/functions/ai-generate/index.ts` - Updated rate limit checking logic
- `supabase-schema.sql` - Added new `account_ai_usage` table definition

### Frontend
- `src/services/aiGateway.ts` - Updated error handling classes and methods
- `src/components/note/AIChatPanel.tsx` - Updated error messages
- `src/components/note/study-modes/SummaryView.tsx` - Updated error messages
- `src/components/note/study-modes/ExercisesView.tsx` - Updated error messages
- `src/components/note/study-modes/FeynmanView.tsx` - Updated error messages
- `src/components/note/study-modes/QuizView.tsx` - Updated error messages
- `src/pages/ProcessingPage.tsx` - Updated error messages

## Error Response Format

### ACCOUNT_LIMIT_REACHED Response (HTTP 429)
```json
{
  "code": "ACCOUNT_LIMIT_REACHED",
  "message": "You have already used your one-time AI generation quota. No additional generations are available.",
  "limit": 1,
  "remaining": 0,
  "usedAt": "2025-11-01T15:30:00.000Z"
}
```

### DAILY_LIMIT_REACHED Response (HTTP 429) - Legacy
```json
{
  "code": "DAILY_LIMIT_REACHED",
  "message": "Daily AI generation limit reached",
  "limit": 15,
  "remaining": 0,
  "resetAt": "2025-11-02T00:00:00.000Z"
}
```

## Backward Compatibility

- The `RateLimitError` class is aliased as `DailyLimitError` for backward compatibility
- Both error codes are handled in all components
- Old `daily_ai_usage` table is preserved (can be deleted if not needed)

## Testing Checklist

- [ ] Run migration script in Supabase
- [ ] Create a new account and generate AI content once
- [ ] Try to generate again and verify limit error
- [ ] Check that error message displays correctly in UI
- [ ] Verify in database that `account_ai_usage.has_used_ai_generation` is TRUE for used accounts
- [ ] Test all study modes (Summary, Quiz, Exercises, Feynman, Chat)
- [ ] Test both audio transcription and chat completions

## Rollback Instructions

If needed to revert to daily limits:

1. Delete the `account_ai_usage` table:
```sql
DROP TABLE account_ai_usage;
```

2. Revert the Edge Function code to use `incrementUsageOrThrow()` instead of `checkAccountLevelLimitOrThrow()`

3. Update all UI components to check for `DAILY_LIMIT_REACHED` only

## Future Enhancements

- Consider adding a per-user override/admin panel to reset quotas
- Add analytics to track how many users have used their quota
- Consider tiered limits (e.g., 5 for free users, unlimited for premium)
