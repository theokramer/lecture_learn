/**
 * Utility functions for generating file hashes
 * Used for caching model outputs based on file content
 */

/**
 * Generate SHA256 hash of file contents
 * @param file - File object to hash
 * @returns Promise resolving to hex hash string
 */
export async function generateFileHash(file: File | Blob): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    console.error('Error generating file hash:', error);
    throw new Error('Failed to generate file hash');
  }
}

/**
 * Generate cache key from file hash, prompt, and model
 * @param fileHash - SHA256 hash of file (empty string if no file)
 * @param prompt - The prompt text used for generation
 * @param model - The model name (e.g., 'gpt-4o-mini')
 * @returns Hex hash string
 */
export async function generateCacheKey(fileHash: string, prompt: string, model: string): Promise<string> {
  try {
    // Combine all parts into a single string
    const keyString = `${fileHash}|${prompt}|${model}`;
    
    // Hash the combined string
    const encoder = new TextEncoder();
    const data = encoder.encode(keyString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
  } catch (error) {
    console.error('Error generating cache key:', error);
    throw new Error('Failed to generate cache key');
  }
}


