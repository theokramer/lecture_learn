/**
 * Environment variable validation and validation utilities
 * Validates all required environment variables at startup
 */

interface EnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  openaiApiKey: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  config?: EnvConfig;
}

/**
 * Validates URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Validates Supabase URL format
 */
function isValidSupabaseUrl(url: string): boolean {
  if (!isValidUrl(url)) {
    return false;
  }
  // Supabase URLs typically contain .supabase.co
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('supabase.co') || parsed.hostname.includes('supabase.io');
  } catch {
    return false;
  }
}

/**
 * Validates API key format (basic check)
 */
function isValidApiKey(key: string, minLength: number = 10): boolean {
  return typeof key === 'string' && key.trim().length >= minLength;
}

/**
 * Validates OpenAI API key format
 */
function isValidOpenAIKey(key: string): boolean {
  // OpenAI keys typically start with 'sk-' and are 51+ characters
  return isValidApiKey(key, 20) && (key.startsWith('sk-') || key.length >= 20);
}

/**
 * Validates Supabase anon key format
 */
function isValidSupabaseAnonKey(key: string): boolean {
  // Supabase keys are typically JWT-like base64 strings, at least 100 characters
  return isValidApiKey(key, 50);
}

/**
 * Validates all required environment variables
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const env = import.meta.env;

  // Check for required variables
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
  const openaiApiKey = env.VITE_OPENAI_API_KEY;

  // Validate Supabase URL
  if (!supabaseUrl) {
    errors.push('VITE_SUPABASE_URL is missing. Please add it to your .env file.');
  } else if (!isValidSupabaseUrl(supabaseUrl)) {
    errors.push(
      'VITE_SUPABASE_URL is invalid. It should be a valid Supabase project URL (e.g., https://xxx.supabase.co).'
    );
  }

  // Validate Supabase Anon Key
  if (!supabaseAnonKey) {
    errors.push('VITE_SUPABASE_ANON_KEY is missing. Please add it to your .env file.');
  } else if (!isValidSupabaseAnonKey(supabaseAnonKey)) {
    errors.push(
      'VITE_SUPABASE_ANON_KEY is invalid. It should be a valid Supabase anon/public key.'
    );
  }

  // Validate OpenAI API Key (only if provided - might be optional in some contexts)
  if (openaiApiKey && !isValidOpenAIKey(openaiApiKey)) {
    errors.push(
      'VITE_OPENAI_API_KEY is invalid. It should be a valid OpenAI API key (typically starts with "sk-").'
    );
  }

  // Warn if in production but missing keys
  if (env.PROD && (!supabaseUrl || !supabaseAnonKey)) {
    errors.push(
      'Production mode detected but required environment variables are missing. The app will not function correctly.'
    );
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return {
    valid: true,
    errors: [],
    config: {
      supabaseUrl: supabaseUrl!,
      supabaseAnonKey: supabaseAnonKey!,
      openaiApiKey: openaiApiKey || '',
      isDevelopment: env.DEV,
      isProduction: env.PROD,
    },
  };
}

/**
 * Validates environment and throws if invalid
 * Should be called at app startup
 */
export function validateAndThrow(): EnvConfig {
  const result = validateEnvironment();
  
  if (!result.valid) {
    const errorMessage = [
      '❌ Environment validation failed:',
      ...result.errors,
      '',
      'Please check your .env file and ensure all required variables are set.',
    ].join('\n');
    
    // In development, show helpful error
    if (import.meta.env.DEV) {
      console.error(errorMessage);
    }
    
    throw new Error(`Environment validation failed: ${result.errors.join('; ')}`);
  }
  
  return result.config!;
}

/**
 * Gets validated environment configuration
 * Throws if environment is invalid
 */
export function getEnvConfig(): EnvConfig {
  return validateAndThrow();
}


