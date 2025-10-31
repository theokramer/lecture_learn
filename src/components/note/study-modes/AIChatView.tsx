import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { HiSparkles } from 'react-icons/hi2';
import { useAppData } from '../../../context/AppDataContext';
import { storageService } from '../../../services/supabase';
import { usePdfSelection } from '../../../context/PdfSelectionContext';

export const AIChatView: React.FC = () => {
  const { selectedNoteId, notes } = useAppData();
  const { setSelectedText } = usePdfSelection();
  const currentNote = notes.find(n => n.id === selectedNoteId);
  const documents = currentNote?.documents || [];
  const pdfDocuments = documents.filter(doc => doc.type === 'pdf');

  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [pdfPages, setPdfPages] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfCanvasUrls, setPdfCanvasUrls] = useState<Record<number, string>>({});
  const [selectedPdfText, setSelectedPdfText] = useState<string>('');
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef<Record<number, { canvas: HTMLCanvasElement; textLayer: HTMLDivElement }>>({});
  const pdfDocumentRef = useRef<any>(null);
  const pdfBlobRef = useRef<Blob | null>(null);

  // Load first PDF document by default
  useEffect(() => {
    if (pdfDocuments.length > 0 && !selectedDocument) {
      setSelectedDocument(pdfDocuments[0]);
    }
  }, [pdfDocuments, selectedDocument]);

  const blobUrlRef = useRef<string | null>(null);

  // Load PDF preview
  useEffect(() => {
    const loadPDF = async () => {
      if (!selectedDocument) return;

      // Cleanup previous blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      try {
        // Download the PDF file and store blob for reuse
        const blob = await storageService.downloadFile(selectedDocument.url);
        if (!blob) throw new Error('Failed to download PDF');
        
        // Store blob for creating fresh ArrayBuffers when needed
        pdfBlobRef.current = blob;
        
        // Create blob URL for display reference
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;

        // Load PDF with pdfjs - use local worker file
        const pdfjsLib = await import('pdfjs-dist');
        // Use .mjs extension for ES module compatibility
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('/pdfjs/pdf.worker.min.mjs', window.location.origin).href;

        // Create ArrayBuffer from blob for initial load
        const arrayBuffer = await blob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        // Store the PDF document object to reuse it
        pdfDocumentRef.current = pdf;
        
        const totalPages = pdf.numPages;

        setPdfPages(Array.from({ length: totalPages }, (_, i) => i + 1));
        setCurrentPage(1);
        setPdfCanvasUrls({}); // Clear old pages
      } catch (error) {
        console.error('Error loading PDF:', error);
        // Reset refs on error
        pdfDocumentRef.current = null;
        pdfBlobRef.current = null;
      }
    };

    loadPDF();

    // Cleanup blob URL and refs when component unmounts or document changes
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      
      // Safely remove page container if it exists
      if (pageContainerRef.current && pageContainerRef.current.parentNode) {
        try {
          pageContainerRef.current.parentNode.removeChild(pageContainerRef.current);
        } catch (e) {
          // Ignore errors - React may have already removed it
        }
        pageContainerRef.current = null;
      }
      
      pdfDocumentRef.current = null;
      pdfBlobRef.current = null;
      canvasRefs.current = {};
    };
  }, [selectedDocument]);

  // Render PDF pages with text layer for text selection
  const renderPDFPage = async (pageNum: number, container: HTMLDivElement) => {
    if (!pdfDocumentRef.current) return;

    try {
      // Use the cached PDF document object to avoid ArrayBuffer issues
      const pdf = pdfDocumentRef.current;
      const page = await pdf.getPage(pageNum);

      // Calculate responsive scale based on container width
      const containerWidth = container.clientWidth || container.offsetWidth || 800;
      const containerHeight = container.clientHeight || container.offsetHeight || 600;
      const padding = 32; // Account for container padding
      const availableWidth = containerWidth - padding;
      const availableHeight = containerHeight - padding;
      
      // Get page dimensions at scale 1.0 to calculate proper scale
      const defaultViewport = page.getViewport({ scale: 1.0 });
      const pageWidth = defaultViewport.width;
      const pageHeight = defaultViewport.height;
      
      // Calculate scale to fit container (maintain aspect ratio)
      const scaleX = availableWidth / pageWidth;
      const scaleY = availableHeight / pageHeight;
      const scale = Math.min(2.0, Math.min(scaleX, scaleY, 2.0)); // Max scale of 2.0 for quality
      
      const viewport = page.getViewport({ scale });
      
      // Create canvas container
      const pageContainer = document.createElement('div');
      pageContainer.style.position = 'relative';
      pageContainer.style.display = 'inline-block';
      pageContainer.style.maxWidth = '100%';
      pageContainer.style.maxHeight = '100%';
      pageContainer.style.width = 'auto';
      pageContainer.style.height = 'auto';
      
      // Create canvas for visual rendering
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.display = 'block';
      canvas.style.maxWidth = '100%';
      canvas.style.maxHeight = '100%';
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      };

      await page.render(renderContext).promise;

      // Create text layer container
      const textLayerDiv = document.createElement('div');
      textLayerDiv.className = 'pdf-text-layer';
      textLayerDiv.style.position = 'absolute';
      textLayerDiv.style.left = '0';
      textLayerDiv.style.top = '0';
      textLayerDiv.style.width = `${viewport.width}px`;
      textLayerDiv.style.height = `${viewport.height}px`;
      textLayerDiv.style.overflow = 'hidden';
      textLayerDiv.style.opacity = '0.2';
      textLayerDiv.style.lineHeight = '1.0';
      textLayerDiv.style.userSelect = 'text';

      // Get text content and render text layer
      const textContent = await page.getTextContent();
      const textItems = textContent.items;
      
      // Import pdfjs for Util.transform
      const pdfjsLib = await import('pdfjs-dist');

      for (const item of textItems) {
        if (!('str' in item) || !item.str || !('transform' in item)) continue;
        
        // Transform coordinates from PDF space to viewport space using PDF.js Util
        const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
        
        const span = document.createElement('span');
        span.textContent = item.str;
        span.style.position = 'absolute';
        span.style.left = `${transform[4]}px`;
        span.style.top = `${viewport.height - transform[5]}px`;
        span.style.fontSize = `${Math.abs(transform[0])}px`;
        span.style.fontFamily = ('fontName' in item && item.fontName) ? item.fontName : 'sans-serif';
        span.style.color = 'rgba(0,0,0,0)'; // Transparent but selectable
        span.style.cursor = 'text';
        span.style.whiteSpace = 'pre';
        span.style.pointerEvents = 'auto';
        span.style.transformOrigin = 'left top';
        
        textLayerDiv.appendChild(span);
      }
      
      // Make text layer selectable and visible to pointer events
      textLayerDiv.style.pointerEvents = 'auto';
      textLayerDiv.style.color = 'transparent';

      // Assemble page container
      pageContainer.appendChild(canvas);
      pageContainer.appendChild(textLayerDiv);
      
      // Store refs
      canvasRefs.current[pageNum] = { canvas, textLayer: textLayerDiv };
      
      // Update state with data URL for loading indicator
      const dataUrl = canvas.toDataURL();
      setPdfCanvasUrls(prev => ({ ...prev, [pageNum]: dataUrl }));

      // React-safe DOM manipulation: only remove manually created nodes
      requestAnimationFrame(() => {
        if (!container) return;
        
        // Store reference to page container
        const existingContainer = pageContainerRef.current;
        
        // Only remove the existing manually created pageContainer (not React-managed nodes)
        if (existingContainer && existingContainer.parentNode === container) {
          try {
            container.removeChild(existingContainer);
          } catch (e) {
            // Ignore if React already removed it
          }
        }
        
        // Add new page container only if it's not already a child
        if (pageContainer.parentNode !== container) {
          container.appendChild(pageContainer);
        }
        pageContainerRef.current = pageContainer;
      });
    } catch (err) {
      console.error('Error rendering PDF page:', err);
    }
  };

  // Load current page with text layer
  useEffect(() => {
    if (selectedDocument?.type === 'pdf' && pdfDocumentRef.current && pdfPages.length > 0 && currentPage && pdfContainerRef.current) {
      const container = pdfContainerRef.current;
      renderPDFPage(currentPage, container);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfPages.length, currentPage, selectedDocument?.id]);

  // Handle text selection in PDF
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        const text = selection.toString().trim();
        setSelectedPdfText(text);
        setSelectedText(text); // Update context for chat panel
      } else {
        setSelectedPdfText('');
        setSelectedText('');
      }
    };

    // Only handle selections within the PDF container
    const container = pdfContainerRef.current;
    if (container) {
      container.addEventListener('mouseup', handleSelection);
      return () => container.removeEventListener('mouseup', handleSelection);
    }
  }, [setSelectedText]);

  const handlePrevPage = () => {
    if (currentPage > 1 && pdfContainerRef.current) {
      setCurrentPage(currentPage - 1);
      if (pdfContainerRef.current) {
        renderPDFPage(currentPage - 1, pdfContainerRef.current);
      }
    }
  };

  const handleNextPage = () => {
    if (currentPage < pdfPages.length && pdfContainerRef.current) {
      setCurrentPage(currentPage + 1);
      if (pdfContainerRef.current) {
        renderPDFPage(currentPage + 1, pdfContainerRef.current);
      }
    }
  };

  const handleQuickAction = (action: string, text: string) => {
    const prompts: Record<string, string> = {
      'explain': `Explain this in simple terms with examples: "${text}"`,
      'example': `Give me a real-world example of this: "${text}"`,
      'summarize': `Summarize this concisely: "${text}"`,
      'details': `Provide more details about this: "${text}"`,
      'why': `Why is this important? "${text}"`,
      'how': `How does this work? "${text}"`,
      'compare': `Compare this with similar concepts: "${text}"`,
    };

    const message = prompts[action] || `${action}: "${text}"`;
    
    // Dispatch custom event to trigger send in AIChatPanel
    const event = new CustomEvent('ai-chat-quick-action', { 
      detail: { message, selectedText: text } 
    });
    window.dispatchEvent(event);
    
    // Clear selection after sending
    setSelectedPdfText('');
    setSelectedText('');
  };

  if (pdfDocuments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-0">
        <div className="text-center">
          <HiSparkles className="w-16 h-16 text-[#b85a3a] mx-auto mb-4" />
          <p className="text-white text-lg mb-2">No PDF documents found</p>
          <p className="text-gray-400">Upload a PDF document to use AI Chat with PDF</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* PDF Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#4a4a4a] bg-[#1a1a1a] flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {pdfDocuments.length > 1 && (
            <select
              value={selectedDocument?.id || ''}
              onChange={(e) => {
                const doc = pdfDocuments.find(d => d.id === e.target.value);
                if (doc) setSelectedDocument(doc);
              }}
              className="px-3 py-1 bg-[#2a2a2a] border border-[#3a3a3a] rounded text-white text-sm flex-shrink-0"
            >
              {pdfDocuments.map(doc => (
                <option key={doc.id} value={doc.id}>{doc.name}</option>
              ))}
            </select>
          )}
          <span className="text-white text-sm truncate ml-2">
            {selectedDocument?.name}
          </span>
        </div>
        {pdfPages.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-[#2a2a2a] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#3a3a3a] transition-colors text-sm"
            >
              Prev
            </button>
            <span className="text-white text-sm">
              {currentPage} / {pdfPages.length}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === pdfPages.length}
              className="px-3 py-1 bg-[#2a2a2a] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#3a3a3a] transition-colors text-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* PDF Content */}
      <div 
        ref={pdfContainerRef}
        className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-0 max-w-full"
      >
        {!pdfCanvasUrls[currentPage] && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white">Loading page {currentPage}...</p>
          </div>
        )}
      </div>

      {/* Selection Toolbar with Quick Actions */}
      {selectedPdfText && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="p-3 bg-[#2a2a2a] border-t border-[#3a3a3a] flex-shrink-0"
        >
          <div className="flex flex-col gap-3">
            {/* Selected Text Preview */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 flex-1 truncate">
                "{selectedPdfText.substring(0, 60)}{selectedPdfText.length > 60 ? '...' : ''}"
              </span>
              <button
                onClick={() => {
                  setSelectedPdfText('');
                  setSelectedText('');
                }}
                className="px-2 py-1 bg-[#3a3a3a] text-white rounded text-sm hover:bg-[#4a4a4a] transition-colors"
                title="Clear selection"
              >
                ✕
              </button>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleQuickAction('explain', selectedPdfText)}
                className="px-3 py-1.5 bg-[#b85a3a] text-white rounded text-xs font-medium hover:bg-[#a04a2a] transition-colors"
              >
                💡 Explain
              </button>
              <button
                onClick={() => handleQuickAction('example', selectedPdfText)}
                className="px-3 py-1.5 bg-[#b85a3a] text-white rounded text-xs font-medium hover:bg-[#a04a2a] transition-colors"
              >
                📚 Example
              </button>
              <button
                onClick={() => handleQuickAction('summarize', selectedPdfText)}
                className="px-3 py-1.5 bg-[#b85a3a] text-white rounded text-xs font-medium hover:bg-[#a04a2a] transition-colors"
              >
                📝 Summarize
              </button>
              <button
                onClick={() => handleQuickAction('details', selectedPdfText)}
                className="px-3 py-1.5 bg-[#b85a3a] text-white rounded text-xs font-medium hover:bg-[#a04a2a] transition-colors"
              >
                🔍 More Details
              </button>
              <button
                onClick={() => handleQuickAction('why', selectedPdfText)}
                className="px-3 py-1.5 bg-[#b85a3a] text-white rounded text-xs font-medium hover:bg-[#a04a2a] transition-colors"
              >
                ❓ Why Important?
              </button>
              <button
                onClick={() => handleQuickAction('how', selectedPdfText)}
                className="px-3 py-1.5 bg-[#b85a3a] text-white rounded text-xs font-medium hover:bg-[#a04a2a] transition-colors"
              >
                ⚙️ How It Works
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
