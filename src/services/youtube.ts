// YouTube transcript functionality temporarily disabled due to CORS issues
// This package requires server-side implementation

export const youtubeService = {
  async getTranscript(videoUrl: string): Promise<string> {
    throw new Error('YouTube transcript feature is temporarily disabled. Please use other input methods.');
  },

  extractVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*?v=([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  },

  async getTranscriptWithFallback(videoUrl: string): Promise<string> {
    throw new Error('YouTube transcript feature is temporarily disabled. Please use other input methods.');
  },
};
