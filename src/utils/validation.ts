/**
 * Input validation and sanitization utilities
 * Provides comprehensive validation for user inputs to prevent XSS, injection attacks, etc.
 */

/**
 * Sanitizes a string to prevent XSS attacks
 * Removes or escapes potentially dangerous HTML/script tags
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Escape HTML entities to prevent XSS
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized.trim();
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string' || email.trim().length === 0) {
    return false;
  }

  // RFC 5322 compliant email regex (simplified but practical)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates password strength
 * Returns object with validation result and messages
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let strength: 'weak' | 'medium' | 'strong' = 'weak';

  if (typeof password !== 'string') {
    return {
      valid: false,
      errors: ['Password must be a string'],
      strength: 'weak',
    };
  }

  // Minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Check for various character types
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }

  // Strength calculation
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (hasUpperCase) score++;
  if (hasLowerCase) score++;
  if (hasNumbers) score++;
  if (hasSpecialChars) score++;

  if (score >= 5) {
    strength = 'strong';
  } else if (score >= 3) {
    strength = 'medium';
  }

  // At least medium strength required for validation
  if (errors.length === 0 && strength !== 'weak') {
    return {
      valid: true,
      errors: [],
      strength,
    };
  }

  return {
    valid: errors.length === 0 && strength !== 'weak',
    errors,
    strength,
  };
}

/**
 * Validates file type based on MIME type or extension
 */
export function isValidFileType(
  file: File,
  allowedTypes: string[] = ['image/*', 'application/pdf', 'text/*', 'audio/*', 'video/*']
): boolean {
  if (!file || !file.type) {
    return false;
  }

  // Check MIME type
  for (const allowedType of allowedTypes) {
    if (allowedType.endsWith('/*')) {
      // Wildcard match (e.g., 'image/*')
      const baseType = allowedType.slice(0, -2);
      if (file.type.startsWith(baseType)) {
        return true;
      }
    } else if (file.type === allowedType) {
      return true;
    }
  }

  return false;
}

/**
 * Validates file size
 */
export function isValidFileSize(file: File, maxSizeBytes: number = 50 * 1024 * 1024): boolean {
  if (!file || file.size === undefined) {
    return false;
  }

  return file.size > 0 && file.size <= maxSizeBytes;
}

/**
 * Validates folder/note name
 */
export function isValidName(name: string, maxLength: number = 100): boolean {
  if (typeof name !== 'string') {
    return false;
  }

  const trimmed = name.trim();
  
  // Check length
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    return false;
  }

  // Check for potentially dangerous characters (for file system safety)
  // Allow letters, numbers, spaces, hyphens, underscores, and common punctuation
  const dangerousChars = /[<>:"|?*\x00-\x1f]/;
  if (dangerousChars.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Validates URL format
 */
export function isValidUrl(url: string): boolean {
  if (typeof url !== 'string' || url.trim().length === 0) {
    return false;
  }

  try {
    const parsed = new URL(url.trim());
    // Only allow http and https protocols
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  if (!isValidUrl(url)) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    // Allow youtube.com, youtu.be, and m.youtube.com
    return (
      hostname === 'youtube.com' ||
      hostname === 'www.youtube.com' ||
      hostname === 'youtu.be' ||
      hostname === 'm.youtube.com'
    );
  } catch {
    return false;
  }
}

/**
 * Sanitizes and validates user input for database storage
 * Combines sanitization with basic validation
 */
export function sanitizeForStorage(input: string, maxLength?: number): string {
  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input.trim();

  // Apply length limit if specified
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove control characters (except newlines and tabs for text content)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized;
}

/**
 * Validates note content
 */
export function isValidNoteContent(content: string): boolean {
  if (typeof content !== 'string') {
    return false;
  }

  // Content can be empty, but if present should be valid string
  // Check for extremely long content (potential DoS)
  const maxContentLength = 10 * 1024 * 1024; // 10MB
  return content.length <= maxContentLength;
}

/**
 * Rate limiting helper - tracks client-side request counts
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  /**
   * Check if action is allowed within rate limit
   * @param key - Unique identifier for the rate limit (e.g., userId or action type)
   * @param maxRequests - Maximum number of requests
   * @param windowMs - Time window in milliseconds
   */
  canProceed(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true;
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Get remaining requests in current window
   */
  getRemaining(key: string, maxRequests: number, windowMs: number): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);
    return Math.max(0, maxRequests - validRequests.length);
  }
}

// Export singleton instance
export const clientRateLimiter = new RateLimiter();

