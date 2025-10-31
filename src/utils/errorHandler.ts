/**
 * Error handling utilities for consistent error management across the app
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

/**
 * Maps technical errors to user-friendly messages
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('failed to fetch')) {
      return 'Network connection failed. Please check your internet connection and try again.';
    }
    
    // Authentication errors
    if (message.includes('unauthorized') || message.includes('auth')) {
      return 'Your session has expired. Please log in again.';
    }
    
    // Storage/quota errors
    if (message.includes('quota') || message.includes('storage')) {
      return 'Storage limit reached. Please free up some space and try again.';
    }
    
    // Timeout errors
    if (message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    
    // Supabase errors
    if (message.includes('duplicate') || message.includes('unique')) {
      return 'This item already exists.';
    }
    
    if (message.includes('foreign key') || message.includes('constraint')) {
      return 'Unable to perform this operation. Some required data is missing.';
    }
    
    if (message.includes('row-level security') || message.includes('policy')) {
      return 'You don\'t have permission to perform this action.';
    }
    
    // File upload errors
    if (message.includes('file') || message.includes('upload')) {
      return 'File upload failed. Please try again or use a smaller file.';
    }
    
    // Generic error fallback
    return error.message || 'An unexpected error occurred. Please try again.';
  }
  
  if (typeof error === 'string') {
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
 * Error logger - can be extended to send to external service
 */
export function logError(error: unknown, context?: string): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  const logData = {
    message: errorMessage,
    stack: errorStack,
    context,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  };
  
  // Log to console in development
  if (import.meta.env.DEV) {
    console.error('Error logged:', logData);
  }
  
  // TODO: Uncomment to enable Sentry integration
  // if (import.meta.env.PROD && window.Sentry) {
  //   window.Sentry.captureException(error, {
  //     extra: logData,
  //     tags: { context },
  //   });
  // }
}

/**
 * Gracefully handle errors with user-friendly messages
 */
export function handleError(
  error: unknown,
  context?: string,
  showToast?: (message: string) => void
): void {
  logError(error, context);
  
  const userMessage = getUserFriendlyErrorMessage(error);
  
  if (showToast) {
    showToast(userMessage);
  } else if (import.meta.env.DEV) {
    console.error(`[${context || 'Error'}]`, userMessage, error);
  }
}


