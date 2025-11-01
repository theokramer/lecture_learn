import { supabase } from './supabase';

export interface LinkContent {
  title: string;
  content: string;
  sourceUrl: string;
  sourceType: 'youtube' | 'google-drive' | 'web' | 'unknown';
}

export const linkProcessor = {
  /**
   * Determines the type of link (YouTube, Google Drive, etc.)
   */
  detectLinkType(url: string): 'youtube' | 'google-drive' | 'web' | 'unknown' {
    const normalizedUrl = url.toLowerCase().trim();
    
    // Check for YouTube
    if (normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be')) {
      return 'youtube';
    }
    
    // Check for Google Drive (including shared links)
    if (
      normalizedUrl.includes('drive.google.com') || 
      normalizedUrl.includes('docs.google.com') ||
      normalizedUrl.includes('sheets.google.com') ||
      normalizedUrl.includes('slides.google.com') ||
      normalizedUrl.includes('forms.google.com')
    ) {
      return 'google-drive';
    }
    
    // Check for valid web URL
    if (normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')) {
      return 'web';
    }
    
    return 'unknown';
  },

  /**
   * Extracts video ID from YouTube URL
   */
  extractYouTubeVideoId(url: string): string | null {
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

  /**
   * Validates that a URL is well-formed
   */
  validateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  },

  /**
   * Processes a link and extracts content using backend services
   */
  async processLink(url: string): Promise<LinkContent> {
    const trimmedUrl = url.trim();
    
    // Validate URL format
    if (!this.validateUrl(trimmedUrl)) {
      throw new Error('Invalid URL format. Please provide a valid URL starting with http:// or https://');
    }
    
    const linkType = this.detectLinkType(trimmedUrl);
    
    if (linkType === 'unknown') {
      throw new Error('Unsupported link type. Please provide a valid YouTube, Google Drive, or web URL.');
    }
    
    try {
      switch (linkType) {
        case 'youtube':
          return await this.processYouTubeLink(trimmedUrl);
        case 'google-drive':
          return await this.processGoogleDriveLink(trimmedUrl);
        case 'web':
          return await this.processWebLink(trimmedUrl);
        default:
          throw new Error('Unsupported link type. Please provide a valid YouTube, Google Drive, or web URL.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to process link: ${errorMessage}`);
    }
  },

  /**
   * Processes YouTube links by extracting transcript
   */
  async processYouTubeLink(url: string): Promise<LinkContent> {
    const videoId = this.extractYouTubeVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL. Could not extract video ID.');
    }

    // Call backend edge function to get YouTube transcript
    const { data, error } = await supabase.functions.invoke('process-link', {
      body: {
        type: 'youtube',
        url: url,
        videoId: videoId,
      },
    } as any);

    // Handle errors - check response data first since we return 200 for all responses
    if (error) {
      const errorMsg = (error as any)?.message || String(error);
      throw new Error(`Failed to call process-link function: ${errorMsg}`);
    }

    if (!data) {
      throw new Error('No response received from server');
    }

    // Check if the response indicates an error
    if (data.error) {
      throw new Error(data.error);
    }

    if (!data.success) {
      throw new Error('Transcript extraction failed');
    }

    if (!data.transcript && !data.content) {
      throw new Error('No transcript content received from server');
    }

    return {
      title: data.title || `YouTube: ${videoId}`,
      content: data.content || data.transcript,
      sourceUrl: url,
      sourceType: 'youtube',
    };
  },

  /**
   * Processes Google Drive links
   */
  async processGoogleDriveLink(url: string): Promise<LinkContent> {
    try {
      // Call backend to process Google Drive link
      const { data, error } = await supabase.functions.invoke('process-link', {
        body: {
          type: 'google-drive',
          url: url,
        },
      } as any);

      if (error) {
        throw error;
      }

      if (data && data.content) {
        return {
          title: data.title || 'Google Drive Document',
          content: `Google Drive Document\nSource: ${url}\n\n${data.content}`,
          sourceUrl: url,
          sourceType: 'google-drive',
        };
      }

      // Fallback: Google Drive requires authentication
      return {
        title: 'Google Drive Document',
        content: `Google Drive Document\nSource: ${url}\n\nNote: Direct access to Google Drive documents requires authentication. Please download the document and upload it directly using the Upload Documents feature, or share the document with public access and provide a direct link.`,
        sourceUrl: url,
        sourceType: 'google-drive',
      };
    } catch (error) {
      // Final fallback
      return {
        title: 'Google Drive Document',
        content: `Google Drive Document\nSource: ${url}\n\nNote: This Google Drive link could not be automatically processed. To add content:\n1. Download the document from Google Drive\n2. Upload it directly using the Upload Documents feature\n3. Or manually add notes about the document here`,
        sourceUrl: url,
        sourceType: 'google-drive',
      };
    }
  },

  /**
   * Processes general web links by extracting and summarizing content
   */
  async processWebLink(url: string): Promise<LinkContent> {
    try {
      // Call backend to extract web page content
      const { data, error } = await supabase.functions.invoke('process-link', {
        body: {
          type: 'web',
          url: url,
        },
      } as any);

      if (error) {
        throw error;
      }

      if (data && data.content) {
        return {
          title: data.title || 'Web Page',
          content: `Web Page Content\nSource: ${url}\n\n${data.content}`,
          sourceUrl: url,
          sourceType: 'web',
        };
      }

      throw new Error('No content received');
    } catch (error) {
      // Final fallback
      return {
        title: 'Web Page',
        content: `Web Page\nSource: ${url}\n\nNote: The web page content could not be automatically extracted. Please manually add your notes about this page.`,
        sourceUrl: url,
        sourceType: 'web',
      };
    }
  },
};

