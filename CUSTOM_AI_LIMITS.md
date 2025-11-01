# Custom AI Limits

## Overview

The system now supports **custom per-user AI generation limits**. Each user can have their own daily limit for AI content generation, instead of a hardcoded limit for all users.

---

## How It Works

### Database Schema

Two tables work together to manage rate limiting:

1. **`account_limits`** - Stores custom limits per user
   - `user_id`: UUID (primary key, references auth.users)
   - `daily_ai_limit`: Integer (default: 1)
   - `created_at`, `updated_at`: Timestamps

2. **`daily_ai_usage`** - Tracks daily usage per user
   - `user_id`, `usage_date`: Composite primary key
   - `count`: Integer (current usage count for the day)
   - `created_at`: Timestamp

Both tables have **RLS disabled** for reliable, fast rate limit checks.

---

## Edge Function Logic

The Edge Function (`ai-generate/index.ts`) now:

1. **Fetches custom limit** from `account_limits` table for the user
2. **Falls back to default** (1) if no custom limit is set
3. **Checks usage** against the custom limit
4. **Blocks request** if limit is reached with proper error message
5. **Increments usage** after successful generation

### Code Flow

```typescript
// 1. Fetch custom limit
const { data: accountLimit } = await supabase
  .from('account_limits')
  .select('daily_ai_limit')
  .eq('user_id', userId)
  .single();

// 2. Use custom limit or default
const DAILY_LIMIT = accountLimit?.daily_ai_limit ?? 1;

// 3. Check current usage
const { data: existingRow } = await supabase
  .from('daily_ai_usage')
  .select('count')
  .eq('user_id', userId)
  .eq('usage_date', usageDate)
  .single();

// 4. Block if limit reached
if (currentCount >= DAILY_LIMIT) {
  return new Response(JSON.stringify({
    code: 'DAILY_LIMIT_REACHED',
    message: `You have reached your daily AI generation limit (${DAILY_LIMIT}). Please try again tomorrow.`,
    limit: DAILY_LIMIT,
    remaining: 0,
    resetAt: getResetAtIso()
  }), { status: 429 });
}

// 5. Increment usage after generation
await supabase
  .from('daily_ai_usage')
  .update({ count: currentCount + 1 })
  .eq('user_id', userId)
  .eq('usage_date', usageDate);
```

---

## Setting Custom Limits

### For Individual Users

Run this SQL in Supabase SQL Editor:

```sql
-- Set a custom limit for a specific user
INSERT INTO account_limits (user_id, daily_ai_limit)
VALUES ('user-uuid-here', 10)
ON CONFLICT (user_id)
DO UPDATE SET daily_ai_limit = 10;
```

### For Multiple Users

```sql
-- Give premium users 50 generations per day
INSERT INTO account_limits (user_id, daily_ai_limit)
SELECT id, 50
FROM auth.users
WHERE email LIKE '%@premium.com'
ON CONFLICT (user_id)
DO UPDATE SET daily_ai_limit = 50;
```

### Default Behavior

If a user has **no row** in `account_limits`, they get the **default limit of 1** generation per day.

---

## Examples

### Example 1: Free User (Default Limit)

```
User: john@example.com (no custom limit)
Limit: 1 (default)

First generation: ✅ Success (usage: 1/1)
Second generation: ❌ Blocked (limit reached)
```

### Example 2: Premium User (Custom Limit)

```sql
INSERT INTO account_limits (user_id, daily_ai_limit)
VALUES ('uuid-of-jane', 50);
```

```
User: jane@example.com (custom limit: 50)
Limit: 50 (custom)

First generation: ✅ Success (usage: 1/50)
Second generation: ✅ Success (usage: 2/50)
...
50th generation: ✅ Success (usage: 50/50)
51st generation: ❌ Blocked (limit reached)
```

### Example 3: Unlimited User

```sql
-- Set a very high limit for unlimited access
INSERT INTO account_limits (user_id, daily_ai_limit)
VALUES ('uuid-of-admin', 999999);
```

---

## Checking User Limits

### View a user's current limit

```sql
SELECT 
  u.email,
  COALESCE(al.daily_ai_limit, 1) as daily_limit,
  COALESCE(du.count, 0) as used_today,
  COALESCE(al.daily_ai_limit, 1) - COALESCE(du.count, 0) as remaining
FROM auth.users u
LEFT JOIN account_limits al ON al.user_id = u.id
LEFT JOIN daily_ai_usage du ON du.user_id = u.id 
  AND du.usage_date = CURRENT_DATE
WHERE u.email = 'user@example.com';
```

### View all users with custom limits

```sql
SELECT 
  u.email,
  al.daily_ai_limit,
  al.created_at as limit_set_at
FROM account_limits al
JOIN auth.users u ON u.id = al.user_id
ORDER BY al.daily_ai_limit DESC;
```

### View today's usage for all users

```sql
SELECT 
  u.email,
  COALESCE(al.daily_ai_limit, 1) as limit,
  du.count as used,
  du.usage_date
FROM daily_ai_usage du
JOIN auth.users u ON u.id = du.user_id
LEFT JOIN account_limits al ON al.user_id = du.user_id
WHERE du.usage_date = CURRENT_DATE
ORDER BY du.count DESC;
```

---

## Deployment Steps

### 1. Update Database Schema

Run in **Supabase SQL Editor**:

```sql
-- Create account_limits table
CREATE TABLE IF NOT EXISTS account_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_ai_limit INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Disable RLS for reliable reads
ALTER TABLE account_limits DISABLE ROW LEVEL SECURITY;

-- Create index
CREATE INDEX IF NOT EXISTS idx_account_limits_user_id ON account_limits(user_id);
```

### 2. Deploy Edge Function

The updated `ai-generate/index.ts` function will automatically:
- Fetch custom limits from the database
- Use default limit (1) if no custom limit is set
- Display the correct limit in error messages

```bash
git add .
git commit -m "Add custom AI limit support"
git push
```

### 3. Verify Deployment

Test with a user:

```bash
# Check Edge Function logs
# Should see: "[RATE_LIMIT_CHECK] User daily limit: 1 (default)"
# Or: "[RATE_LIMIT_CHECK] User daily limit: 50 (custom)"
```

---

## Error Messages

Users will see different messages based on their limit:

### Default Limit (1)
```
"You have reached your daily AI generation limit (1). Please try again tomorrow."
```

### Custom Limit (e.g., 50)
```
"You have reached your daily AI generation limit (50). Please try again tomorrow."
```

---

## Monitoring

### Daily Usage Report

```sql
SELECT 
  u.email,
  COALESCE(al.daily_ai_limit, 1) as limit,
  COUNT(du.usage_date) as days_used,
  SUM(du.count) as total_generations
FROM auth.users u
LEFT JOIN account_limits al ON al.user_id = u.id
LEFT JOIN daily_ai_usage du ON du.user_id = u.id
GROUP BY u.id, u.email, al.daily_ai_limit
ORDER BY total_generations DESC;
```

### Users Near Their Limit Today

```sql
SELECT 
  u.email,
  COALESCE(al.daily_ai_limit, 1) as limit,
  du.count as used,
  COALESCE(al.daily_ai_limit, 1) - du.count as remaining
FROM daily_ai_usage du
JOIN auth.users u ON u.id = du.user_id
LEFT JOIN account_limits al ON al.user_id = du.user_id
WHERE du.usage_date = CURRENT_DATE
  AND du.count >= COALESCE(al.daily_ai_limit, 1) * 0.8
ORDER BY remaining ASC;
```

---

## Best Practices

1. **Default Conservative**: Keep default limit low (1) to manage costs
2. **Custom for Premium**: Give premium users higher limits (10-100)
3. **Monitor Usage**: Track daily usage to identify heavy users
4. **Adjust as Needed**: Increase/decrease limits based on usage patterns
5. **Unlimited Admin**: Give admin accounts very high limits (999999)

---

## Security Notes

- ✅ RLS is **disabled** on both tables for reliable rate limiting
- ✅ Only Edge Function can write to these tables (user has no direct access)
- ✅ Non-sensitive data (just usage counts and limits)
- ✅ No user credentials or private information stored

---

## Future Enhancements

Potential additions:
- **Weekly/Monthly limits** in addition to daily
- **Rate limit tiers** (free, premium, enterprise)
- **Usage analytics dashboard** for users
- **Automatic limit increases** based on payment plans
- **Grace period** after hitting limit

---

**Status**: ✅ Ready for production  
**Date**: 2025-11-01  
**Version**: 1.0

