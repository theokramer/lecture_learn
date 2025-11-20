import 'dart:io';
import 'dart:convert';
import 'package:syncfusion_flutter_pdf/pdf.dart';
import 'package:archive/archive.dart';

class DocumentProcessorService {
  static final DocumentProcessorService _instance = DocumentProcessorService._internal();
  factory DocumentProcessorService() => _instance;
  DocumentProcessorService._internal();

  bool isAudioFile(String mimeType) {
    return mimeType.startsWith('audio/');
  }

  bool isVideoFile(String mimeType) {
    return mimeType.startsWith('video/');
  }

  bool isPdfFile(String mimeType) {
    return mimeType == 'application/pdf';
  }

  /// Process document and extract text (matches website's documentProcessor.processDocument)
  Future<String> processDocument(File file) async {
    final mimeType = await _getMimeType(file);
    final fileName = file.path.split('/').last.toLowerCase();
    
    // PDF files
    if (mimeType == 'application/pdf' || fileName.endsWith('.pdf')) {
      return await _extractTextFromPdf(file);
    }
    // Text files
    else if (mimeType.startsWith('text/') || mimeType == 'application/json' ||
             fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.json')) {
      return await file.readAsString();
    }
    // DOCX files (modern Word format)
    else if (mimeType == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
             fileName.endsWith('.docx')) {
      return await _extractTextFromDocx(file);
    }
    // PPTX files (PowerPoint)
    else if (mimeType == 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
             fileName.endsWith('.pptx')) {
      return await _extractTextFromPptx(file);
    }
    else {
      throw Exception('Unsupported file type: ${mimeType.isEmpty ? 'unknown' : mimeType}');
    }
  }

  Future<String> _getMimeType(File file) async {
    final extension = file.path.split('.').last.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'txt':
      case 'md':
        return 'text/plain';
      case 'json':
        return 'application/json';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'pptx':
        return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      case 'mp3':
      case 'wav':
        return 'audio/mpeg';
      case 'mp4':
        return 'video/mp4';
      default:
        return 'application/octet-stream';
    }
  }

  /// Extract text from PDF (matches website's extractTextFromPDF)
  /// Handles large PDFs by processing page by page to reduce memory usage
  Future<String> _extractTextFromPdf(File file) async {
    try {
      final fileSize = await file.length();
      final fileSizeMB = fileSize / 1024 / 1024;
      
      // For large files (>10MB) or many pages, process page-by-page from the start
      // This reduces memory usage significantly
      final bytes = await file.readAsBytes();
      
      PdfDocument? pdfDocument;
      try {
        print('🔍 [PDF Debug] Starting PDF extraction for: ${file.path.split('/').last}');
        print('🔍 [PDF Debug] File size: ${fileSizeMB.toStringAsFixed(2)} MB (${fileSize} bytes)');
        
        pdfDocument = PdfDocument(inputBytes: bytes);
        final pageCount = pdfDocument.pages.count;
        final actualPageCount = pdfDocument.pages.count; // Get actual count
        
        print('🔍 [PDF Debug] PDF document loaded successfully');
        print('🔍 [PDF Debug] Reported page count: $pageCount');
        print('🔍 [PDF Debug] Actual page count: $actualPageCount');
        
        // Validate page count
        if (pageCount <= 0) {
          pdfDocument.dispose();
          throw Exception('PDF has no pages or invalid page count ($pageCount). The file may be corrupted or empty.');
        }
        
        // Log PDF info for debugging
        print('PDF Info: ${file.path.split('/').last} - ${pageCount} pages, ${fileSizeMB.toStringAsFixed(2)} MB');
        
        // For large files (>10MB) or many pages (>20), process one page at a time
        // This is slower but much more memory-efficient
        final usePageByPage = fileSizeMB > 10 || pageCount > 20;
        
        if (usePageByPage) {
          print('Processing PDF page-by-page: $pageCount pages, ${fileSizeMB.toStringAsFixed(2)} MB');
          return await _extractTextPageByPage(pdfDocument, pageCount);
        }
        
        // For smaller PDFs, try batch processing first
        final batchSize = 10; // Smaller batches for better reliability
        final useBatching = pageCount > 10; // Use batching for PDFs with more than 10 pages
        
        if (useBatching) {
          print('Processing PDF in batches: $pageCount pages, batch size: $batchSize');
          final textParts = <String>[];
          
          // Ensure we don't exceed the actual number of pages
          final actualPageCount = pdfDocument.pages.count;
          final maxPage = pageCount < actualPageCount ? pageCount : actualPageCount;
          
          print('🔍 [PDF Debug] Batch processing: actualPageCount=$actualPageCount, maxPage=$maxPage, batchSize=$batchSize');
          
          for (int startPage = 0; startPage < maxPage; startPage += batchSize) {
            final endPage = (startPage + batchSize - 1 < maxPage) 
                ? startPage + batchSize - 1 
                : maxPage - 1;
            
            print('🔍 [PDF Debug] Batch: startPage=$startPage, endPage=$endPage, maxPage=$maxPage, actualPageCount=$actualPageCount');
            
            // Validate page indices
            if (startPage < 0 || startPage >= actualPageCount || endPage < 0 || endPage >= actualPageCount) {
              print('❌ [PDF Debug] Invalid page range: $startPage-$endPage (valid range: 0-${actualPageCount - 1})');
              continue;
            }
            
            try {
              print('Extracting pages $startPage-$endPage of $maxPage...');
              print('🔍 [PDF Debug] Creating PdfTextExtractor for batch $startPage-$endPage');
              final textExtractor = PdfTextExtractor(pdfDocument);
              
              print('🔍 [PDF Debug] Calling extractText(startPageIndex: $startPage, endPageIndex: $endPage)');
              final batchText = textExtractor.extractText(
                startPageIndex: startPage, 
                endPageIndex: endPage
              );
              
              print('🔍 [PDF Debug] Batch $startPage-$endPage extraction successful, text length: ${batchText.length}');
              
              if (batchText.trim().isNotEmpty) {
                textParts.add(batchText);
                print('Successfully extracted ${endPage - startPage + 1} pages (${batchText.length} characters)');
              } else {
                print('Warning: No text extracted from pages $startPage-$endPage');
              }
            } catch (batchError, stackTrace) {
              // If batch fails, fall back to page-by-page for this batch
              print('❌ [PDF Debug] Batch error extracting pages $startPage-$endPage:');
              print('❌ [PDF Error] Error message: $batchError');
              print('❌ [PDF Error] Error type: ${batchError.runtimeType}');
              print('❌ [PDF Error] Stack trace: $stackTrace');
              print('Falling back to page-by-page extraction for this batch...');
              
              final actualPageCount = pdfDocument.pages.count;
              print('🔍 [PDF Debug] Fallback: Processing pages $startPage to $endPage individually');
              
              for (int page = startPage; page <= endPage && page < actualPageCount; page++) {
                // Validate page index
                if (page < 0 || page >= actualPageCount) {
                  print('❌ [PDF Debug] Fallback: Skipping invalid page index: $page (valid: 0-${actualPageCount - 1})');
                  continue;
                }
                
                try {
                  print('🔍 [PDF Debug] Fallback: Extracting page $page individually');
                  final textExtractor = PdfTextExtractor(pdfDocument);
                  final pageText = textExtractor.extractText(
                    startPageIndex: page, 
                    endPageIndex: page
                  );
                  if (pageText.trim().isNotEmpty) {
                    textParts.add(pageText);
                    print('✅ [PDF Debug] Fallback: Page $page extracted successfully');
                  } else {
                    print('⚠️ [PDF Debug] Fallback: Page $page extracted but empty');
                  }
                } catch (pageError, pageStackTrace) {
                  final errorMsg = pageError.toString();
                  print('❌ [PDF Debug] Fallback error on page $page:');
                  print('❌ [PDF Error] Error message: $errorMsg');
                  print('❌ [PDF Error] Error type: ${pageError.runtimeType}');
                  print('❌ [PDF Error] Stack trace: $pageStackTrace');
                  
                  if (errorMsg.contains('Invalid position') || errorMsg.contains('position: -1')) {
                    print('❌ [PDF Debug] Invalid position error on page $page - page may be corrupted');
                  }
                }
              }
            }
          }
          
          pdfDocument.dispose();
          final fullText = textParts.join('\n\n').trim();
          
          if (fullText.isEmpty) {
            throw Exception('No text could be extracted from PDF (${pageCount} pages). The PDF may contain only images or be password-protected.');
          }
          
          // Sanitize the extracted text to remove invalid characters
          final sanitized = _sanitizeExtractedText(fullText);
          
          print('PDF extraction complete: ${sanitized.length} characters extracted from $pageCount pages');
          return sanitized;
        } else {
          // For very small PDFs (10 pages or less), try to extract all at once
          try {
            // Validate page count before bulk extraction
            final actualPageCount = pdfDocument.pages.count;
            if (actualPageCount <= 0) {
              throw Exception('PDF has no pages. Cannot extract text.');
            }
            
            final maxPage = pageCount < actualPageCount ? pageCount : actualPageCount;
            print('Extracting all $maxPage pages at once...');
      final textExtractor = PdfTextExtractor(pdfDocument);
            final fullText = textExtractor.extractText(
              startPageIndex: 0, 
              endPageIndex: maxPage - 1
            );
      
      pdfDocument.dispose();
            final trimmed = fullText.trim();
            
            if (trimmed.isEmpty) {
              throw Exception('No text could be extracted from PDF (${pageCount} pages). The PDF may contain only images or be password-protected.');
            }
            
            // Sanitize the extracted text to remove invalid characters
            final sanitized = _sanitizeExtractedText(trimmed);
            
            print('PDF extraction complete: ${sanitized.length} characters extracted');
            return sanitized;
          } catch (e) {
            // If bulk extraction fails, fall back to page-by-page
            print('Bulk extraction failed, falling back to page-by-page: $e');
            pdfDocument.dispose();
            // Re-open document for page-by-page processing
            final bytes = await file.readAsBytes();
            pdfDocument = PdfDocument(inputBytes: bytes);
            return await _extractTextPageByPage(pdfDocument, pageCount);
          }
        }
      } catch (e) {
        pdfDocument?.dispose();
        rethrow;
      }
    } catch (e) {
      // Provide more helpful error messages
      if (e.toString().contains('password') || e.toString().contains('encrypted')) {
        throw Exception('PDF is password-protected or encrypted. Please unlock it before uploading.');
      } else if (e.toString().contains('corrupt') || e.toString().contains('invalid')) {
        throw Exception('PDF file appears to be corrupted or invalid. Please check the file and try again.');
      } else if (e.toString().contains('memory') || e.toString().contains('out of memory')) {
        throw Exception('PDF is too large to process. Please try splitting it into smaller files or use a PDF with fewer pages.');
      } else {
      throw Exception('Failed to extract text from PDF: $e');
      }
    }
  }

  /// Extract text from PDF page by page (most memory-efficient method)
  /// This method processes one page at a time to minimize memory usage
  Future<String> _extractTextPageByPage(PdfDocument pdfDocument, int pageCount) async {
    print('🔍 [PDF Debug] _extractTextPageByPage called with pageCount: $pageCount');
    
    // Validate page count
    if (pageCount <= 0) {
      throw Exception('Invalid page count: $pageCount. Cannot extract text from empty PDF.');
    }
    
    final textParts = <String>[];
    int successCount = 0;
    int failCount = 0;
    
    // Ensure we don't exceed the actual number of pages
    final actualPageCount = pdfDocument.pages.count;
    final maxPage = pageCount < actualPageCount ? pageCount : actualPageCount;
    
    print('🔍 [PDF Debug] actualPageCount: $actualPageCount, maxPage: $maxPage');
    print('🔍 [PDF Debug] Will process pages 0 to ${maxPage - 1} (inclusive)');
    
    for (int page = 0; page < maxPage; page++) {
      try {
        print('🔍 [PDF Debug] Processing page index: $page (page ${page + 1} of $maxPage)');
        
        // Validate page index before extraction
        if (page < 0 || page >= actualPageCount) {
          print('❌ [PDF Debug] Invalid page index: $page (valid range: 0-${actualPageCount - 1})');
          failCount++;
          continue;
        }
        
        if (page % 10 == 0) {
          print('Extracting page ${page + 1}/$maxPage...');
        }
        
        print('🔍 [PDF Debug] Creating PdfTextExtractor for page $page');
        final textExtractor = PdfTextExtractor(pdfDocument);
        
        print('🔍 [PDF Debug] Calling extractText(startPageIndex: $page, endPageIndex: $page)');
        final pageText = textExtractor.extractText(
          startPageIndex: page, 
          endPageIndex: page
        );
        
        print('🔍 [PDF Debug] Page $page extraction successful, text length: ${pageText.length}');
        
        if (pageText.trim().isNotEmpty) {
          textParts.add(pageText);
          successCount++;
          print('✅ [PDF Debug] Page $page: Success (${pageText.length} chars)');
        } else {
          failCount++;
          print('⚠️ [PDF Debug] Page $page: Empty text extracted');
        }
      } catch (pageError, stackTrace) {
        failCount++;
        final errorMsg = pageError.toString();
        print('❌ [PDF Debug] Error extracting page $page:');
        print('❌ [PDF Error] Error message: $errorMsg');
        print('❌ [PDF Error] Error type: ${pageError.runtimeType}');
        print('❌ [PDF Error] Stack trace: $stackTrace');
        
        // Check if it's an invalid position error
        if (errorMsg.contains('Invalid position') || errorMsg.contains('position: -1')) {
          print('❌ [PDF Debug] Invalid position error detected for page $page');
          print('❌ [PDF Debug] This usually means the page has corrupted or invalid content');
        } else {
          print('❌ [PDF Debug] Other error type for page $page');
        }
        // Continue with next page
      }
    }
    
    pdfDocument.dispose();
    final fullText = textParts.join('\n\n').trim();
    
    if (fullText.isEmpty) {
      throw Exception('No text could be extracted from PDF ($pageCount pages). The PDF may contain only images or be password-protected.');
    }
    
    // Sanitize the extracted text to remove invalid characters that could break JSON encoding
    final sanitized = _sanitizeExtractedText(fullText);
    
    print('PDF extraction complete: ${sanitized.length} characters extracted from $successCount/$pageCount pages (${failCount} failed)');
    return sanitized;
  }

  /// Sanitize extracted text to remove characters that could break JSON encoding
  /// Removes null bytes, control characters, and other problematic characters
  String _sanitizeExtractedText(String text) {
    if (text.isEmpty) return text;
    
    // Remove null bytes and other control characters that break JSON
    String sanitized = text.replaceAll('\x00', ''); // Null bytes
    sanitized = sanitized.replaceAll(RegExp(r'[\x01-\x08\x0B-\x0C\x0E-\x1F]'), ''); // Other control chars except \n, \r, \t
    
    // Remove invalid UTF-8 sequences by encoding/decoding
    try {
      // This will throw if there are invalid UTF-8 sequences
      final bytes = utf8.encode(sanitized);
      sanitized = utf8.decode(bytes, allowMalformed: false);
    } catch (e) {
      // If encoding fails, try with allowMalformed to at least get something
      try {
        final bytes = utf8.encode(text);
        sanitized = utf8.decode(bytes, allowMalformed: true);
        // Remove any remaining problematic characters
        sanitized = sanitized.replaceAll('\x00', '');
        sanitized = sanitized.replaceAll(RegExp(r'[\x01-\x08\x0B-\x0C\x0E-\x1F]'), '');
      } catch (e2) {
        // Last resort: keep only printable ASCII and common Unicode
        sanitized = text.replaceAll(RegExp(r'[^\x20-\x7E\n\r\t\u00A0-\uFFFF]'), '');
      }
    }
    
    // Normalize line endings
    sanitized = sanitized.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
    
    // Remove excessive whitespace (more than 3 consecutive newlines)
    sanitized = sanitized.replaceAll(RegExp(r'\n{4,}'), '\n\n\n');
    
    return sanitized.trim();
  }

  /// Extract text from DOCX (matches website's extractTextFromDOCX)
  Future<String> _extractTextFromDocx(File file) async {
    try {
      final bytes = await file.readAsBytes();
      final archive = ZipDecoder().decodeBytes(bytes);
      
      // DOCX files contain document.xml with the text
      final documentFile = archive.findFile('word/document.xml');
      if (documentFile == null) {
        throw Exception('Invalid DOCX file: word/document.xml not found');
      }
      
      final xmlContent = utf8.decode(documentFile.content);
      // Simple XML text extraction - remove tags and extract text
      final text = xmlContent
          .replaceAll(RegExp(r'<[^>]+>'), ' ') // Remove XML tags
          .replaceAll(RegExp(r'\s+'), ' ') // Normalize whitespace
          .trim();
      
      return text;
    } catch (e) {
      throw Exception('Failed to extract text from DOCX: $e');
    }
  }

  /// Extract text from PPTX (matches website's extractTextFromPPTX)
  Future<String> _extractTextFromPptx(File file) async {
    try {
      final bytes = await file.readAsBytes();
      final archive = ZipDecoder().decodeBytes(bytes);
      
      // PPTX files contain slides in ppt/slides/slide*.xml
      final slideFiles = archive.files
          .where((f) => f.name.startsWith('ppt/slides/slide') && f.name.endsWith('.xml'))
          .toList()
        ..sort((a, b) => a.name.compareTo(b.name));
      
      final textNodes = <String>[];
      
      for (final slideFile in slideFiles) {
        final xmlContent = utf8.decode(slideFile.content);
        // Extract text from XML - remove tags and extract text
        final text = xmlContent
            .replaceAll(RegExp(r'<[^>]+>'), ' ') // Remove XML tags
            .replaceAll(RegExp(r'\s+'), ' ') // Normalize whitespace
            .trim();
        
        if (text.isNotEmpty) {
          textNodes.add(text);
        }
      }
      
      return textNodes.join('\n\n').trim();
    } catch (e) {
      throw Exception('Failed to extract text from PPTX: $e');
    }
  }

}

