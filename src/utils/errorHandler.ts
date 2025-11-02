/**
 * Error handling utilities for consistent error management across the app
 * Enhanced with audit logging and improved error categorization
 */

import { logError as logAuditError } from '../services/auditService';
import { supabase } from '../services/supabase';

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

/**
 * Error categories for better handling and audit logging
 */
export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  STORAGE = 'storage',
  RATE_LIMIT = 'rate_limit',
  SYSTEM = 'system',
  UNKNOWN = 'unknown',
}

/**
 * Categorizes errors for proper handling
 */
export function categorizeError(error: unknown): ErrorCategory {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
      return ErrorCategory.NETWORK;
    }
    
    if (message.includes('unauthorized') || message.includes('auth') || message.includes('session')) {
      return ErrorCategory.AUTHENTICATION;
    }
    
    if (message.includes('forbidden') || message.includes('permission') || message.includes('policy')) {
      return ErrorCategory.AUTHORIZATION;
    }
    
    if (message.includes('rate limit') || message.includes('429')) {
      return ErrorCategory.RATE_LIMIT;
    }
    
    if (message.includes('quota') || message.includes('storage')) {
      return ErrorCategory.STORAGE;
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }
  }
  
  return ErrorCategory.UNKNOWN;
}

/**
 * Maps technical errors to user-friendly messages
 * Does not expose sensitive information
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const category = categorizeError(error);
    
    switch (category) {
      case ErrorCategory.NETWORK:
        return 'Network connection failed. Please check your internet connection and try again.';
      
      case ErrorCategory.AUTHENTICATION:
        return 'Your session has expired. Please log in again.';
      
      case ErrorCategory.AUTHORIZATION:
        return 'You don\'t have permission to perform this action.';
      
      case ErrorCategory.RATE_LIMIT:
        return 'Too many requests. Please wait a moment and try again.';
      
      case ErrorCategory.STORAGE:
        return 'Storage limit reached. Please free up some space and try again.';
      
      case ErrorCategory.VALIDATION:
        if (message.includes('duplicate') || message.includes('unique')) {
          return 'This item already exists.';
        }
        if (message.includes('foreign key') || message.includes('constraint')) {
          return 'Unable to perform this operation. Some required data is missing.';
        }
        return 'Invalid input. Please check your data and try again.';
      
      case ErrorCategory.SYSTEM:
        if (message.includes('timeout')) {
          return 'Request timed out. Please try again.';
        }
        if (message.includes('file') || message.includes('upload')) {
          return 'File upload failed. Please try again or use a smaller file.';
        }
        return 'A system error occurred. Please try again later.';
      
      default:
        // Never expose raw error messages in production
        if (import.meta.env.PROD) {
          return 'An unexpected error occurred. Please try again.';
        }
        // In development, show more details
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  }
  
  if (typeof error === 'string') {
    // Sanitize string errors
    if (import.meta.env.PROD) {
      return 'An unexpected error occurred. Please try again.';
    }
    return error;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Checks if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      message.includes('network request failed')
    );
  }
  return false;
}

/**
 * Checks if the browser is online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
  } = options;

  let lastError: unknown;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if we've exhausted attempts
      if (attempt === maxRetries) {
        break;
      }
      
      // Don't retry on authentication errors
      if (error instanceof Error && (
        error.message.toLowerCase().includes('unauthorized') ||
        error.message.toLowerCase().includes('auth')
      )) {
        break;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Error logger with audit logging integration
 * Logs errors to console (dev) and audit log (all environments)
 */
export async function logError(error: unknown, context?: string, userId?: string): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  const category = categorizeError(error);
  
  const logData = {
    message: errorMessage.substring(0, 500), // Truncate long messages
    stack: errorStack ? errorStack.substring(0, 1000) : undefined, // Truncate stack traces
    context,
    category,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  };
  
  // Log to console in development
  if (import.meta.env.DEV) {
    console.error('Error logged:', logData);
  }
  
  // Log to audit service (non-blocking)
  try {
    // Get current user if not provided
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
    }
    
    // Determine severity based on category
    let severity: 'low' | 'medium' | 'high' = 'low';
    if (category === ErrorCategory.AUTHORIZATION || category === ErrorCategory.RATE_LIMIT) {
      severity = 'medium';
    } else if (category === ErrorCategory.AUTHENTICATION) {
      severity = 'high';
    }
    
    await logAuditError(error, context || 'unknown', userId);
  } catch (auditError) {
    // Don't let audit logging failures break error handling
    if (import.meta.env.DEV) {
      console.warn('Failed to log error to audit service:', auditError);
    }
  }
  
  // TODO: Uncomment to enable Sentry integration
  // if (import.meta.env.PROD && window.Sentry) {
  //   window.Sentry.captureException(error, {
  //     extra: logData,
  //     tags: { context, category },
  //   });
  // }
}

/**
 * Gracefully handle errors with user-friendly messages
 * Enhanced with audit logging and better error categorization
 */
export async function handleError(
  error: unknown,
  context?: string,
  showToast?: (message: string) => void,
  userId?: string
): Promise<void> {
  // Log error asynchronously (don't await to avoid blocking)
  logError(error, context, userId).catch(() => {
    // Silently fail if audit logging fails
  });
  
  const userMessage = getUserFriendlyErrorMessage(error);
  
  if (showToast) {
    showToast(userMessage);
  } else if (import.meta.env.DEV) {
    console.error(`[${context || 'Error'}]`, userMessage, error);
  }
}

/**
 * Synchronous version for backwards compatibility
 * Note: This version doesn't include audit logging, use handleError for new code
 */
export function handleErrorSync(
  error: unknown,
  context?: string,
  showToast?: (message: string) => void
): void {
  // Trigger async logging without blocking
  logError(error, context).catch(() => {});
  
  const userMessage = getUserFriendlyErrorMessage(error);
  
  if (showToast) {
    showToast(userMessage);
  } else if (import.meta.env.DEV) {
    console.error(`[${context || 'Error'}]`, userMessage, error);
  }
}


