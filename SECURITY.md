# Security Documentation - Nano AI

## Overview

This document outlines the security architecture, practices, and procedures for Nano AI.

## Security Architecture

### Authentication & Authorization

- **Authentication**: Supabase Auth with email/password and OAuth (Google)
- **Session Management**: JWT tokens managed by Supabase
- **Authorization**: Row Level Security (RLS) policies in PostgreSQL
- **Password Security**: 
  - Minimum 8 characters
  - Leaked password protection (HaveIBeenPwned integration)
  - Secure password hashing via Supabase

### Data Protection

- **Encryption in Transit**: All connections use HTTPS/TLS 1.2+
- **Encryption at Rest**: Supabase handles database encryption
- **API Keys**: Stored as environment variables, never in code
- **Sensitive Data**: User content stored in Supabase with RLS policies

### Network Security

- **Security Headers**: 
  - Content Security Policy (CSP)
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Strict-Transport-Security (HSTS)
  - Referrer-Policy: strict-origin-when-cross-origin
- **CORS**: Configured to allow only trusted domains
- **Rate Limiting**: Client-side and server-side rate limiting

## Security Features

### Input Validation & Sanitization

All user inputs are validated and sanitized:

- **Email Validation**: RFC 5322 compliant
- **Password Validation**: Strength requirements enforced
- **File Upload Validation**: Type and size limits
- **XSS Protection**: HTML escaping and sanitization
- **SQL Injection Prevention**: Parameterized queries via Supabase

### Audit Logging

Comprehensive audit logging tracks:

- Authentication events (login, logout, signup)
- Security events (failed auth, rate limit hits)
- Data access (note creation, file uploads)
- API usage (AI generation requests)
- Error events

All logs stored in `audit_log` table with:
- Event type and severity
- User ID and IP address
- Timestamp and details
- Success/failure status

### Error Handling

- **Error Messages**: Never expose sensitive information
- **Error Categorization**: Network, auth, validation, etc.
- **Error Logging**: Structured logging to audit system
- **User-Friendly Messages**: Technical details hidden from users

### Rate Limiting

- **Client-Side**: Prevents excessive API calls from browser
- **Server-Side**: Daily limits per user account
- **Progressive Warnings**: Users notified before hitting limits
- **Premium Bypass**: Premium users have higher/unlimited limits

## Environment Security

### Environment Variables

Required environment variables:
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anon/public key
- `VITE_OPENAI_API_KEY`: OpenAI API key

**Security Practices:**
- Variables validated at startup
- Never commit `.env` files
- Use different keys for development/production
- Rotate keys periodically

### Production Checklist

- [ ] Security headers configured
- [ ] HTTPS enforced
- [ ] Environment variables set correctly
- [ ] RLS policies active
- [ ] Audit logging enabled
- [ ] Rate limiting configured
- [ ] Error tracking set up
- [ ] Backups configured

## Vulnerability Reporting

If you discover a security vulnerability:

1. **Do NOT** open a public issue
2. Email security concerns to: [your-security-email@example.com]
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will:
- Acknowledge receipt within 48 hours
- Investigate and respond within 7 days
- Provide updates on fix timeline
- Credit you in security advisories (if desired)

## Security Audit Checklist

### Application Security

- [ ] All dependencies up to date
- [ ] No known vulnerabilities in dependencies
- [ ] Input validation on all user inputs
- [ ] Output encoding for user-generated content
- [ ] Authentication required for all protected routes
- [ ] Authorization checks on all data access
- [ ] Error handling doesn't expose sensitive info
- [ ] Secure session management
- [ ] CSRF protection (handled by Supabase)

### Infrastructure Security

- [ ] HTTPS enforced everywhere
- [ ] Security headers configured
- [ ] Database access restricted (RLS)
- [ ] API keys stored securely
- [ ] Logging and monitoring active
- [ ] Backup and recovery procedures tested
- [ ] Access controls on admin functions

### Data Protection

- [ ] User data encrypted at rest
- [ ] User data encrypted in transit
- [ ] PII handling compliant with regulations
- [ ] Data retention policies defined
- [ ] User data deletion capability
- [ ] Privacy policy published and accessible

## Incident Response

### Security Incident Procedure

1. **Identify**: Detect and confirm security incident
2. **Contain**: Isolate affected systems/services
3. **Assess**: Determine scope and impact
4. **Remediate**: Fix vulnerability and restore service
5. **Document**: Record incident and lessons learned
6. **Notify**: Inform affected users if required by law

### Common Security Issues

**Unauthorized Access:**
- Review audit logs for suspicious activity
- Reset affected user passwords
- Revoke compromised sessions
- Update access controls if needed

**Data Breach:**
- Immediately contain breach
- Assess data exposed
- Notify affected users and authorities (if required)
- Review and strengthen security measures

**DDoS Attack:**
- Use Vercel's built-in DDoS protection
- Monitor rate limits
- Temporarily block malicious IPs if needed

## Best Practices for Developers

1. **Never commit secrets**: Use environment variables
2. **Validate all inputs**: Don't trust user data
3. **Use parameterized queries**: Prevent SQL injection
4. **Keep dependencies updated**: Regular security audits
5. **Follow principle of least privilege**: Minimal permissions
6. **Log security events**: Enable audit logging
7. **Handle errors securely**: Don't leak information
8. **Review code regularly**: Security code reviews
9. **Test security features**: Security testing in QA
10. **Stay informed**: Keep up with security best practices

## Compliance

### GDPR (EU Users)

- User data access and export
- Right to deletion
- Privacy by design
- Data breach notification
- Consent management

### CCPA (California Users)

- Right to know what data is collected
- Right to delete personal information
- Right to opt-out of sale (N/A - we don't sell data)
- Non-discrimination for exercising rights

## Security Updates

Security updates are released as needed. Subscribe to security advisories to receive notifications.

## Contact

For security concerns: [your-security-email@example.com]

For general questions: [support-email@example.com]

