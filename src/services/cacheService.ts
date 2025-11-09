/**
 * Service for caching AI model outputs
 * Caches responses keyed by file hash + prompt + model combination
 */

import { supabase } from './supabase';
import { generateCacheKey } from '../utils/hashUtils';

export interface CachedResponse {
  content: string;
  tokens?: number;
  model: string;
}

/**
 * Get cached AI generation response if available and not expired
 * @param fileHash - SHA256 hash of the file (empty string if no file)
 * @param prompt - The prompt text used for generation
 * @param model - The model name
 * @returns Cached response or null if not found/expired
 */
export async function getCachedResponse(
  fileHash: string,
  prompt: string,
  model: string
): Promise<CachedResponse | null> {
  try {
    const cacheKey = await generateCacheKey(fileHash, prompt, model);
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return null; // Can't check cache without user
    }

    // Query cache for this key and user, check if not expired
    const { data, error } = await supabase
      .from('model_cache')
      .select('response, expires_at')
      .eq('cache_key', cacheKey)
      .eq('user_id', user.id)
      .gte('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.warn('Error fetching cache:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    // Return cached response
    return data.response as CachedResponse;
  } catch (error) {
    console.warn('Error in getCachedResponse:', error);
    return null; // Fail silently, continue without cache
  }
}

/**
 * Store AI generation response in cache
 * @param fileHash - SHA256 hash of the file (empty string if no file)
 * @param prompt - The prompt text used for generation
 * @param model - The model name
 * @param response - The response to cache
 * @param userId - User ID who generated this
 */
export async function setCachedResponse(
  fileHash: string,
  prompt: string,
  model: string,
  response: CachedResponse,
  userId: string
): Promise<void> {
  try {
    const cacheKey = await generateCacheKey(fileHash, prompt, model);
    
    // Calculate expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Upsert cache entry (replace if exists)
    const { error } = await supabase
      .from('model_cache')
      .upsert({
        cache_key: cacheKey,
        user_id: userId,
        response: response as any,
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'cache_key'
      });

    if (error) {
      console.warn('Error storing cache:', error);
      // Don't throw - caching is not critical
    }
  } catch (error) {
    console.warn('Error in setCachedResponse:', error);
    // Don't throw - caching is not critical
  }
}

/**
 * Delete expired cache entries (cleanup function)
 * Can be called periodically or on-demand
 */
export async function cleanupExpiredCache(): Promise<void> {
  try {
    const { error } = await supabase
      .from('model_cache')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) {
      console.warn('Error cleaning up expired cache:', error);
    }
  } catch (error) {
    console.warn('Error in cleanupExpiredCache:', error);
  }
}


