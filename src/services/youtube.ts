// YouTube transcript functionality - now uses backend edge function
import { linkProcessor } from './linkProcessor';

export const youtubeService = {
  async getTranscript(videoUrl: string): Promise<string> {
    try {
      const result = await linkProcessor.processYouTubeLink(videoUrl);
      // Extract just the transcript text, removing the header
      const transcriptStart = result.content.indexOf('\n\n');
      if (transcriptStart > 0) {
        return result.content.substring(transcriptStart + 2);
      }
      return result.content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get YouTube transcript: ${errorMessage}`);
    }
  },

  extractVideoId(url: string): string | null {
    return linkProcessor.extractYouTubeVideoId(url);
  },

  async getTranscriptWithFallback(videoUrl: string): Promise<string> {
    try {
      return await this.getTranscript(videoUrl);
    } catch (error) {
      // Return a fallback message instead of throwing
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Note: Could not extract transcript for this YouTube video: ${videoUrl}\n\nError: ${errorMessage}\n\nPlease add your own notes about this video.`;
    }
  },
};
