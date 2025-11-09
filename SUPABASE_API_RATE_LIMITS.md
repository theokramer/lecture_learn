# Supabase API Rate Limiting Setup

## Overview

This guide shows how to use the Supabase Management API to configure rate limits for your authentication service.

**Note:** These limits are for authentication operations (login, signup, password reset, OTP, etc.), not for custom business logic like AI generation limits.

---

## Prerequisites

1. Supabase Account
2. Access Token from Supabase Dashboard
3. Project Reference ID
4. `curl` or similar HTTP client

---

## Step 1: Get Your Credentials

### Get Access Token
1. Go to [https://supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
2. Create a new token (or copy existing personal access token)
3. Copy the token value

### Get Project Reference
1. Go to your Supabase project dashboard
2. Project Settings → General
3. Copy the `Project Reference` (looks like: `abc123def456`)

---

## Step 2: Set Environment Variables

```bash
export SUPABASE_ACCESS_TOKEN="your-access-token-here"
export PROJECT_REF="your-project-ref-here"
```

---

## Step 3: Check Current Rate Limits

```bash
curl -X GET "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  | jq 'to_entries | map(select(.key | startswith("rate_limit_"))) | from_entries'
```

**Output example:**
```json
{
  "rate_limit_anonymous_users": 4,
  "rate_limit_email_sent": 4,
  "rate_limit_sms_sent": 4,
  "rate_limit_verify": 15,
  "rate_limit_token_refresh": 150,
  "rate_limit_otp": 6,
  "rate_limit_web3": 10
}
```

---

## Step 4: Update Rate Limits

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rate_limit_anonymous_users": 10,
    "rate_limit_email_sent": 10,
    "rate_limit_sms_sent": 10,
    "rate_limit_verify": 10,
    "rate_limit_token_refresh": 10,
    "rate_limit_otp": 10,
    "rate_limit_web3": 10
  }'
```

---

## Rate Limit Settings

| Setting | Purpose | Typical Value |
|---------|---------|---------------|
| `rate_limit_anonymous_users` | Max signups per hour | 4-10 |
| `rate_limit_email_sent` | Max password reset emails per hour | 4-10 |
| `rate_limit_sms_sent` | Max SMS per hour | 4-10 |
| `rate_limit_verify` | Max verification attempts | 10-15 |
| `rate_limit_token_refresh` | Max token refreshes per hour | 150 |
| `rate_limit_otp` | Max OTP attempts | 6-10 |
| `rate_limit_web3` | Max Web3 sign attempts | 10 |

---

## Scripting the Update

Save as `update-rate-limits.sh`:

```bash
#!/bin/bash

# Configuration
SUPABASE_ACCESS_TOKEN="$1"
PROJECT_REF="$2"

if [ -z "$SUPABASE_ACCESS_TOKEN" ] || [ -z "$PROJECT_REF" ]; then
  echo "Usage: ./update-rate-limits.sh <access-token> <project-ref>"
  exit 1
fi

# Update rate limits
curl -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rate_limit_anonymous_users": 10,
    "rate_limit_email_sent": 10,
    "rate_limit_sms_sent": 10,
    "rate_limit_verify": 15,
    "rate_limit_token_refresh": 150,
    "rate_limit_otp": 10,
    "rate_limit_web3": 10
  }' | jq .

echo "Rate limits updated successfully!"
```

Run with:
```bash
chmod +x update-rate-limits.sh
./update-rate-limits.sh "your-token" "your-project-ref"
```

---

## Example: Strict Limits

For high security:
```json
{
  "rate_limit_anonymous_users": 2,
  "rate_limit_email_sent": 3,
  "rate_limit_sms_sent": 2,
  "rate_limit_verify": 5,
  "rate_limit_token_refresh": 50,
  "rate_limit_otp": 3,
  "rate_limit_web3": 5
}
```

---

## Example: Permissive Limits

For development/testing:
```json
{
  "rate_limit_anonymous_users": 50,
  "rate_limit_email_sent": 50,
  "rate_limit_sms_sent": 50,
  "rate_limit_verify": 100,
  "rate_limit_token_refresh": 500,
  "rate_limit_otp": 50,
  "rate_limit_web3": 50
}
```

---

## Custom Business Logic Rate Limiting

**Important:** The Supabase API only controls authentication rate limits.

For custom rate limiting (like "limit AI generation to once per day"):
- Implement in your Edge Functions
- Track usage in a custom table
- Check before allowing operation

Example implementation:
```typescript
// Check usage from custom table
const usage = await supabase
  .from('ai_usage')
  .select('count')
  .eq('user_id', userId)
  .eq('date', today);

if (usage.count >= limit) {
  return new Response({ error: 'Limit reached' }, { status: 429 });
}

// Proceed with operation
```

---

## Monitoring

Check rate limits regularly:
```bash
watch -n 3600 'curl -s -X GET "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  | jq'
```

---

## Reference

- [Supabase Management API Docs](https://supabase.com/docs/reference/api/post-projects)
- [Auth Configuration](https://supabase.com/docs/guides/auth)
- [Rate Limiting Best Practices](https://supabase.com/docs/guides/platform/rate-limits)

