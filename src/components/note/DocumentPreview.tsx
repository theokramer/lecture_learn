import React, { useState, useEffect, useRef } from 'react';
import { IoClose } from 'react-icons/io5';
import { storageService } from '../../services/supabase';

interface DocumentPreviewProps {
  document: {
    id: string;
    name: string;
    type: string;
    url: string;
  };
  onClose: () => void;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ document, onClose }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfPages, setPdfPages] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const loadPreview = async () => {
      // Cleanup previous blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      setLoading(true);
      setError(null);
      
      try {
        const url = await storageService.getFileUrl(document.url);
        if (url.startsWith('blob:')) {
          blobUrlRef.current = url;
        }
        setPreviewUrl(url);

        // For PDFs, we'll load the first page initially
        if (document.type === 'pdf') {
          try {
            // Dynamically import pdfjs-dist
            const pdfjsLib = await import('pdfjs-dist');
            
            // Set worker source - use local worker file (.mjs for ES module)
            pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('/pdfjs/pdf.worker.min.mjs', window.location.origin).href;
            
            const loadingTask = pdfjsLib.getDocument({ url });
            const pdf = await loadingTask.promise;
            const totalPages = pdf.numPages;
            
            // Generate array of page numbers
            setPdfPages(Array.from({ length: totalPages }, (_, i) => i + 1));
            setLoading(false);
          } catch (pdfError) {
            console.error('Error loading PDF:', pdfError);
            setError('Failed to load PDF. Please download the file to view it.');
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading preview:', err);
        setError('Failed to load preview');
        setLoading(false);
      }
    };

    loadPreview();

    // Cleanup blob URL when component unmounts or document changes
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [document]);

  const renderPDFPage = async (pageNum: number): Promise<string> => {
    if (!previewUrl) return '';
    
    try {
      const pdfjsLib = await import('pdfjs-dist');
      // Use .mjs extension for ES module compatibility
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('/pdfjs/pdf.worker.min.mjs', window.location.origin).href;
      
      const loadingTask = pdfjsLib.getDocument({ url: previewUrl });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(pageNum);
      
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = window.document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) return '';
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      };
      
      await page.render(renderContext).promise;
      
      return canvas.toDataURL();
    } catch (err) {
      console.error('Error rendering PDF page:', err);
      return '';
    }
  };

  const [pdfCanvasUrls, setPdfCanvasUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    if (document.type === 'pdf' && previewUrl && pdfPages.length > 0) {
      // Load current page
      renderPDFPage(currentPage).then(url => {
        if (url) {
          setPdfCanvasUrls(prev => ({ ...prev, [currentPage]: url }));
        }
      });
    }
  }, [document.type, previewUrl, pdfPages, currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < pdfPages.length) {
      setCurrentPage(currentPage + 1);
      // Preload next page if not loaded
      if (!pdfCanvasUrls[currentPage + 1]) {
        renderPDFPage(currentPage + 1).then(url => {
          if (url) {
            setPdfCanvasUrls(prev => ({ ...prev, [currentPage + 1]: url }));
          }
        });
      }
    }
  };

  if (loading && !previewUrl) {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
        <div className="bg-[#2a2a2a] rounded-lg p-8 max-w-md mx-4">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
          >
            <IoClose className="w-6 h-6" />
          </button>
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#b85a3a] text-white rounded-lg hover:bg-[#a04a2a] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-lg w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#3a3a3a]">
          <h3 className="text-white text-lg font-semibold truncate flex-1">{document.name}</h3>
          {document.type === 'pdf' && pdfPages.length > 0 && (
            <div className="flex items-center gap-4 mx-4">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-[#2a2a2a] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#3a3a3a] transition-colors"
              >
                Prev
              </button>
              <span className="text-white text-sm">
                Page {currentPage} of {pdfPages.length}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === pdfPages.length}
                className="px-3 py-1 bg-[#2a2a2a] text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#3a3a3a] transition-colors"
              >
                Next
              </button>
            </div>
          )}
          <button
            onClick={onClose}
            className="ml-4 p-2 rounded-lg hover:bg-[#2a2a2a] transition-colors text-white"
            title="Close preview"
          >
            <IoClose className="w-6 h-6" />
          </button>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
          {document.type === 'pdf' ? (
            <div className="w-full h-full flex items-center justify-center">
              {pdfCanvasUrls[currentPage] ? (
                <img
                  src={pdfCanvasUrls[currentPage]}
                  alt={`Page ${currentPage}`}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-white">Loading page {currentPage}...</p>
                </div>
              )}
            </div>
          ) : document.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
            <img
              src={previewUrl || ''}
              alt={document.name}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-center text-white">
              <p>Preview not available for this file type.</p>
              <p className="text-sm text-gray-400 mt-2">Please download the file to view it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

