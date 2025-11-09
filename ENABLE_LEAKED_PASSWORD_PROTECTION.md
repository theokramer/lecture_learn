# Enable Leaked Password Protection

## Summary

**Issue**: Leaked password protection is currently disabled in Supabase Auth. This means users can set passwords that have been compromised in data breaches (as tracked by HaveIBeenPwned.org).

**Risk**: Compromised passwords are commonly reused, which increases the risk of credential stuffing attacks and account breaches.

**Solution**: Enable the leaked password protection feature in Supabase Auth settings.

## Why This Matters

- **Security**: Prevents users from using passwords known to be compromised
- **Low friction**: Minimal impact on legitimate users
- **Best practice**: Recommended security control for production systems
- **Protection**: Reduces risk of account takeover attacks

## How to Enable

### Step 1: Navigate to Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **Settings** → **Security**

### Step 2: Enable Leaked Password Protection

1. Find the **"Leaked password protection"** or **"Check passwords against HaveIBeenPwned"** option
2. Toggle it **ON**
3. Click **"Save"** or **"Update"**

### Alternative Path (if different UI)

If the exact path varies, look for:
- **Authentication** → **Policies** → **Security**
- **Project Settings** → **Auth** → **Security**
- **Settings** → **Auth** → **Password Policy**

## User Experience Considerations

### Error Messages

When a user tries to set a compromised password, they should see a clear message. Update your sign-up/sign-in error handling to display user-friendly messages:

```typescript
// Example error message handling
if (error.message.includes('compromised') || error.message.includes('breach')) {
  setError('This password has been found in a data breach. Please choose a different, unique password.');
}
```

### Password Strength Guidance

Consider adding password strength indicators or requirements:
- Minimum length (8+ characters recommended)
- Mix of uppercase, lowercase, numbers, special characters
- No common words or patterns

## Implementation in Code

Update your authentication components to handle leaked password errors gracefully.

### In `LoginScreen.tsx` or `AuthContext.tsx`:

```typescript
// Handle leaked password errors
catch (error: any) {
  if (error.message?.includes('compromised') || 
      error.message?.includes('breach') ||
      error.message?.includes('pwned')) {
    setError('This password has been found in a data breach. Please choose a different password.');
  } else {
    setError('An error occurred during sign up');
  }
}
```

## Complementary Security Measures

### 1. Strong Password Policy
- Minimum 8-12 characters
- Require mix of character types
- Check against common passwords

### 2. Multi-Factor Authentication (MFA)
- Enable MFA for additional security
- Consider requiring MFA for sensitive operations

### 3. Monitor Auth Logs
- Review suspicious sign-in patterns
- Set up alerts for failed login attempts
- Monitor for credential stuffing attempts

### 4. User Communication
- Inform users about password security best practices
- Provide clear guidance on creating strong passwords
- Send security notices if a breach is detected

## Testing After Enabling

1. **Test sign-up flow**: Try creating an account with a known compromised password (from HaveIBeenPwned database)
2. **Test password change**: Attempt to change password to a compromised one
3. **Verify error messages**: Ensure users see clear, actionable error messages
4. **Test legitimate passwords**: Verify that strong, unique passwords work normally

## Known Compromised Passwords for Testing

⚠️ **DO NOT use these in production** - Only for testing:
- Common passwords like "password123", "12345678", "qwerty", etc.
- Passwords from well-known breaches

## Monitoring

After enabling:

1. Monitor sign-up completion rates (should remain similar)
2. Track password-related error rates
3. Review user feedback about password requirements
4. Monitor for any latency issues in sign-up/password-change flows

## Best Practices

1. **Clear messaging**: Always explain why a password was rejected
2. **Guidance**: Provide tips for creating strong passwords
3. **Support**: Make it easy for users to reset passwords if needed
4. **Balance**: Security vs. user experience - don't make it too restrictive

## Related Configuration

Also consider enabling/checking:
- ✅ **Minimum password length**: 8+ characters
- ✅ **Password complexity requirements**
- ✅ **Rate limiting** on authentication endpoints
- ✅ **Account lockout** after multiple failed attempts
- ✅ **Email verification** required for sign-ups

## Resources

- [HaveIBeenPwned](https://haveibeenpwned.com/) - Check if passwords have been compromised
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [OWASP Password Guidelines](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

## Next Steps

1. ✅ Enable leaked password protection in Supabase Dashboard
2. ✅ Update error handling in authentication components
3. ✅ Test the feature with known compromised passwords
4. ✅ Monitor user feedback and adjust messaging if needed
5. ✅ Consider implementing additional security measures (MFA, stronger policies)

---

**Note**: This feature uses the HaveIBeenPwned API (k-anonymity model) to check passwords without exposing the actual password to the service. This is secure and privacy-preserving.


