import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';

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

  async extractTextFromDOCX(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (error) {
      console.error('Error extracting text from DOCX:', error);
      throw new Error('Failed to extract text from DOCX file');
    }
  },

  async extractTextFromODT(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // ODT files contain content.xml with the document text
      const contentFile = zip.file('content.xml');
      if (!contentFile) {
        throw new Error('Invalid ODT file: content.xml not found');
      }
      
      const xmlContent = await contentFile.async('string');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Extract text from XML using XPath or DOM traversal
      // OpenDocument uses text:p for paragraphs and text:span for text spans
      const textNodes: string[] = [];
      
      // Function to recursively extract text from nodes
      const extractText = (node: Node): void => {
        if (node.nodeType === Node.TEXT_NODE && node.textContent) {
          textNodes.push(node.textContent.trim());
        }
        node.childNodes.forEach(child => extractText(child));
      };
      
      extractText(xmlDoc.documentElement);
      
      // Join text and clean up extra whitespace
      return textNodes
        .filter(text => text.length > 0)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch (error) {
      console.error('Error extracting text from ODT:', error);
      throw new Error('Failed to extract text from ODT file');
    }
  },

  async extractTextFromODS(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // ODS files contain content.xml with spreadsheet data
      const contentFile = zip.file('content.xml');
      if (!contentFile) {
        throw new Error('Invalid ODS file: content.xml not found');
      }
      
      const xmlContent = await contentFile.async('string');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Extract text from table cells
      const textNodes: string[] = [];
      const cells = xmlDoc.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:table:1.0', 'table-cell') || 
                    xmlDoc.getElementsByTagName('table:table-cell');
      
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        const textElements = cell.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:text:1.0', 'p') ||
                            cell.getElementsByTagName('text:p');
        
        for (let j = 0; j < textElements.length; j++) {
          const text = textElements[j].textContent?.trim();
          if (text) {
            textNodes.push(text);
          }
        }
      }
      
      // Join cells with tabs, rows with newlines
      return textNodes.join('\t').replace(/\t+/g, '\t').trim();
    } catch (error) {
      console.error('Error extracting text from ODS:', error);
      throw new Error('Failed to extract text from ODS file');
    }
  },

  async extractTextFromExcel(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      let fullText = '';
      
      // Process each sheet
      workbook.SheetNames.forEach((sheetName, index) => {
        if (index > 0) fullText += '\n\n';
        fullText += `Sheet: ${sheetName}\n`;
        
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        // Convert rows to text
        jsonData.forEach((row: any) => {
          const rowText = Array.isArray(row) 
            ? row.map(cell => String(cell || '')).filter(cell => cell.trim()).join('\t')
            : Object.values(row).map(cell => String(cell || '')).filter(cell => cell.trim()).join('\t');
          
          if (rowText.trim()) {
            fullText += rowText + '\n';
          }
        });
      });
      
      return fullText.trim();
    } catch (error) {
      console.error('Error extracting text from Excel:', error);
      throw new Error('Failed to extract text from Excel file');
    }
  },

  async extractTextFromPPTX(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // PPTX files contain slides in ppt/slides/slide*.xml
      const slideFiles = Object.keys(zip.files).filter(name => 
        name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
      ).sort();
      
      const textNodes: string[] = [];
      
      for (const slidePath of slideFiles) {
        const slideFile = zip.file(slidePath);
        if (!slideFile) continue;
        
        const xmlContent = await slideFile.async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
        
        // Extract text from paragraphs (a:p elements in PPTX)
        const paragraphs = xmlDoc.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'p') ||
                          xmlDoc.getElementsByTagName('a:p');
        
        for (let i = 0; i < paragraphs.length; i++) {
          const paragraph = paragraphs[i];
          const textElements = paragraph.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 't') ||
                              paragraph.getElementsByTagName('a:t');
          
          let paragraphText = '';
          for (let j = 0; j < textElements.length; j++) {
            const text = textElements[j].textContent || '';
            paragraphText += text;
          }
          
          if (paragraphText.trim()) {
            textNodes.push(paragraphText.trim());
          }
        }
      }
      
      return textNodes.join('\n\n').trim();
    } catch (error) {
      console.error('Error extracting text from PPTX:', error);
      throw new Error('Failed to extract text from PowerPoint file');
    }
  },

  async extractTextFromLegacyDOC(_file: File): Promise<string> {
    // Legacy .doc files are binary format and hard to parse in browser
    // For now, return a helpful message
    throw new Error('Legacy .doc files are not fully supported. Please convert to .docx format or upload as PDF.');
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
            // @ts-ignore - captureStream may not be available in all TypeScript types
            const stream = (video as any).captureStream();
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
    const fileName = file.name.toLowerCase();
    let text = '';

    // PDF files
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      text = await this.extractTextFromPDF(file);
    }
    // Text files
    else if (fileType.startsWith('text/') || fileType === 'application/json' || 
             fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.json')) {
      text = await this.extractTextFromTextFile(file);
    }
    // DOCX files (modern Word format)
    else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
             fileName.endsWith('.docx')) {
      text = await this.extractTextFromDOCX(file);
    }
    // Legacy DOC files
    else if (fileType === 'application/msword' || fileName.endsWith('.doc')) {
      text = await this.extractTextFromLegacyDOC(file);
    }
    // ODT files (OpenDocument Text)
    else if (fileType === 'application/vnd.oasis.opendocument.text' || fileName.endsWith('.odt')) {
      text = await this.extractTextFromODT(file);
    }
    // ODS files (OpenDocument Spreadsheet)
    else if (fileType === 'application/vnd.oasis.opendocument.spreadsheet' || fileName.endsWith('.ods')) {
      text = await this.extractTextFromODS(file);
    }
    // Excel files (XLSX)
    else if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
             fileName.endsWith('.xlsx')) {
      text = await this.extractTextFromExcel(file);
    }
    // Legacy Excel files (XLS)
    else if (fileType === 'application/vnd.ms-excel' || fileName.endsWith('.xls')) {
      text = await this.extractTextFromExcel(file);
    }
    // PowerPoint files (PPTX)
    else if (fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
             fileName.endsWith('.pptx')) {
      text = await this.extractTextFromPPTX(file);
    }
    // Legacy PowerPoint files (PPT)
    else if (fileType === 'application/vnd.ms-powerpoint' || fileName.endsWith('.ppt')) {
      throw new Error('Legacy .ppt files are not fully supported. Please convert to .pptx format.');
    }
    else {
      throw new Error(`Unsupported file type: ${fileType || 'unknown'}`);
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
