import 'dart:io';
import 'package:path_provider/path_provider.dart';
import '../utils/logger.dart';

/// Service for managing local document storage
/// Stores documents on the device instead of Supabase storage
class LocalDocumentService {
  static final LocalDocumentService _instance = LocalDocumentService._internal();
  factory LocalDocumentService() => _instance;
  LocalDocumentService._internal();

  static const String _localPathPrefix = 'local://';
  Directory? _documentsDirectory;

  /// Initialize the documents directory
  Future<void> initialize() async {
    if (_documentsDirectory != null) return;
    
    try {
      final appDir = await getApplicationDocumentsDirectory();
      _documentsDirectory = Directory('${appDir.path}/documents');
      
      if (!await _documentsDirectory!.exists()) {
        await _documentsDirectory!.create(recursive: true);
        AppLogger.info('Created documents directory: ${_documentsDirectory!.path}', tag: 'LocalDocumentService');
      }
      
      AppLogger.info('Local documents directory initialized: ${_documentsDirectory!.path}', tag: 'LocalDocumentService');
    } catch (e) {
      AppLogger.error('Failed to initialize documents directory', error: e, tag: 'LocalDocumentService');
      rethrow;
    }
  }

  /// Check if a path is a local path
  static bool isLocalPath(String path) {
    return path.startsWith(_localPathPrefix);
  }

  /// Extract the actual file path from a local path identifier
  static String? extractLocalPath(String path) {
    if (!isLocalPath(path)) return null;
    return path.substring(_localPathPrefix.length);
  }

  /// Store a file locally and return a local path identifier
  /// The identifier can be stored in the database
  Future<String> storeFile(File file, String userId, {String? customFileName}) async {
    await initialize();
    
    try {
      final fileName = customFileName ?? file.path.split('/').last;
      final sanitizedFileName = _sanitizeFileName(fileName);
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final finalFileName = '${timestamp}_$sanitizedFileName';
      
      // Create user-specific directory
      final userDir = Directory('${_documentsDirectory!.path}/$userId');
      if (!await userDir.exists()) {
        await userDir.create(recursive: true);
      }
      
      final destinationFile = File('${userDir.path}/$finalFileName');
      await file.copy(destinationFile.path);
      
      final localPath = '${userDir.path}/$finalFileName';
      final pathIdentifier = '$_localPathPrefix$localPath';
      
      AppLogger.info('Stored file locally: $fileName -> $localPath', tag: 'LocalDocumentService');
      return pathIdentifier;
    } catch (e) {
      AppLogger.error('Failed to store file locally', error: e, tag: 'LocalDocumentService');
      rethrow;
    }
  }

  /// Get a File object from a local path identifier
  Future<File?> getFile(String pathIdentifier) async {
    if (!isLocalPath(pathIdentifier)) {
      AppLogger.warning('Path is not a local path: $pathIdentifier', tag: 'LocalDocumentService');
      return null;
    }
    
    final localPath = extractLocalPath(pathIdentifier);
    if (localPath == null) return null;
    
    final file = File(localPath);
    if (await file.exists()) {
      return file;
    }
    
    AppLogger.warning('Local file not found: $localPath', tag: 'LocalDocumentService');
    return null;
  }

  /// Delete a local file
  Future<bool> deleteFile(String pathIdentifier) async {
    if (!isLocalPath(pathIdentifier)) {
      return false;
    }
    
    final localPath = extractLocalPath(pathIdentifier);
    if (localPath == null) return false;
    
    try {
      final file = File(localPath);
      if (await file.exists()) {
        await file.delete();
        AppLogger.info('Deleted local file: $localPath', tag: 'LocalDocumentService');
        return true;
      }
      return false;
    } catch (e) {
      AppLogger.error('Failed to delete local file: $localPath', error: e, tag: 'LocalDocumentService');
      return false;
    }
  }

  /// Get file size
  Future<int?> getFileSize(String pathIdentifier) async {
    final file = await getFile(pathIdentifier);
    if (file == null) return null;
    
    try {
      return await file.length();
    } catch (e) {
      AppLogger.error('Failed to get file size', error: e, tag: 'LocalDocumentService');
      return null;
    }
  }

  /// Check if file exists
  Future<bool> fileExists(String pathIdentifier) async {
    final file = await getFile(pathIdentifier);
    return file != null;
  }

  /// Clean up old files (optional - for maintenance)
  Future<void> cleanupOldFiles(String userId, {Duration maxAge = const Duration(days: 90)}) async {
    await initialize();
    
    try {
      final userDir = Directory('${_documentsDirectory!.path}/$userId');
      if (!await userDir.exists()) return;
      
      final now = DateTime.now();
      final files = userDir.listSync();
      int deletedCount = 0;
      
      for (final entity in files) {
        if (entity is File) {
          final stat = await entity.stat();
          final age = now.difference(stat.modified);
          
          if (age > maxAge) {
            await entity.delete();
            deletedCount++;
          }
        }
      }
      
      if (deletedCount > 0) {
        AppLogger.info('Cleaned up $deletedCount old files for user $userId', tag: 'LocalDocumentService');
      }
    } catch (e) {
      AppLogger.error('Failed to cleanup old files', error: e, tag: 'LocalDocumentService');
    }
  }

  /// Sanitize filename for safe storage
  String _sanitizeFileName(String fileName) {
    // Remove invalid characters
    final sanitized = fileName.replaceAll(RegExp(r'[<>:"/\\|?*]'), '_');
    // Limit length
    if (sanitized.length > 200) {
      final ext = sanitized.split('.').last;
      final base = sanitized.substring(0, 200 - ext.length - 1);
      return '$base.$ext';
    }
    return sanitized;
  }
}

