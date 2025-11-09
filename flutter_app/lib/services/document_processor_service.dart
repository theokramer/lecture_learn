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
  Future<String> _extractTextFromPdf(File file) async {
    try {
      final bytes = await file.readAsBytes();
      final pdfDocument = PdfDocument(inputBytes: bytes);
      
      // Extract text from all pages at once (more efficient)
      final textExtractor = PdfTextExtractor(pdfDocument);
      final fullText = textExtractor.extractText(startPageIndex: 0, endPageIndex: pdfDocument.pages.count - 1);
      
      pdfDocument.dispose();
      return fullText.trim();
    } catch (e) {
      throw Exception('Failed to extract text from PDF: $e');
    }
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

