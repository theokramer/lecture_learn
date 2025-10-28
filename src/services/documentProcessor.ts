import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker - using jsdelivr CDN for better reliability
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export const documentProcessor = {
  async extractTextFromPDF(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      
      let fullText = '';
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      return fullText.trim();
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error('Failed to extract text from PDF');
    }
  },

  async extractTextFromTextFile(file: File): Promise<string> {
    return await file.text();
  },

  async extractTextFromWord(file: File): Promise<string> {
    // DOC/DOCX files are complex binary formats that require special parsing
    // For now, we'll return a message that the file was uploaded
    // In a production environment, you'd use a library like mammoth.js or similar
    return `[Word document uploaded: ${file.name}]\n\nNote: Word document text extraction is not yet implemented in the browser. The file has been stored as an attachment.`;
  },

  async extractAudioFromVideo(videoFile: File): Promise<Blob> {
    try {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const audioContext = new AudioContext();
        const mediaSource = URL.createObjectURL(videoFile);
        
        video.src = mediaSource;
        video.muted = true;
        
        video.onloadedmetadata = async () => {
          try {
            const stream = video.captureStream();
            const mediaStreamDestination = audioContext.createMediaStreamDestination();
            const sourceNode = audioContext.createMediaElementSource(video);
            
            sourceNode.connect(mediaStreamDestination);
            
            // Record the audio
            const mediaRecorder = new MediaRecorder(mediaStreamDestination.stream);
            const chunks: Blob[] = [];
            
            mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) {
                chunks.push(e.data);
              }
            };
            
            mediaRecorder.onstop = () => {
              const audioBlob = new Blob(chunks, { type: 'audio/webm' });
              URL.revokeObjectURL(mediaSource);
              resolve(audioBlob);
            };
            
            mediaRecorder.start();
            video.play();
            
            // Stop after video duration
            setTimeout(() => {
              mediaRecorder.stop();
              video.pause();
            }, video.duration * 1000);
          } catch (err) {
            URL.revokeObjectURL(mediaSource);
            reject(err);
          }
        };
        
        video.onerror = () => {
          URL.revokeObjectURL(mediaSource);
          reject(new Error('Failed to load video'));
        };
      });
    } catch (error) {
      console.error('Error extracting audio from video:', error);
      throw new Error('Failed to extract audio from video');
    }
  },

  async processDocument(file: File): Promise<{ text: string; type: string }> {
    const fileType = file.type;
    let text = '';

    if (fileType === 'application/pdf') {
      text = await this.extractTextFromPDF(file);
    } else if (fileType.startsWith('text/') || fileType === 'application/json') {
      text = await this.extractTextFromTextFile(file);
    } else if (fileType.includes('word') || fileType.includes('document') || 
               file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
      text = await this.extractTextFromWord(file);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    return { text, type: fileType };
  },

  isAudioFile(fileType: string): boolean {
    return fileType.startsWith('audio/');
  },

  isVideoFile(fileType: string): boolean {
    return fileType.startsWith('video/');
  },

  supportsAudioExtraction(fileType: string): boolean {
    return this.isAudioFile(fileType) || this.isVideoFile(fileType);
  },
};
