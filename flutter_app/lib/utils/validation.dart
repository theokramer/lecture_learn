import 'dart:io';
import '../constants/app_constants.dart';

/// Input validation and sanitization utilities
class ValidationUtils {
  /// Validate email format
  static bool isValidEmail(String email) {
    if (email.isEmpty) return false;
    final emailRegex = RegExp(
      r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
    );
    return emailRegex.hasMatch(email);
  }

  /// Validate password strength
  static bool isValidPassword(String password) {
    if (password.length < 8) return false;
    // At least one letter and one number
    final hasLetter = RegExp(r'[a-zA-Z]').hasMatch(password);
    final hasNumber = RegExp(r'[0-9]').hasMatch(password);
    return hasLetter && hasNumber;
  }

  /// Validate URL format
  static bool isValidUrl(String url) {
    try {
      final uri = Uri.parse(url);
      return uri.hasScheme && (uri.scheme == 'http' || uri.scheme == 'https');
    } catch (e) {
      return false;
    }
  }

  /// Validate note title
  static bool isValidNoteTitle(String title) {
    final trimmed = title.trim();
    return trimmed.isNotEmpty && trimmed.length <= AppConstants.maxNoteTitleLength;
  }

  /// Validate folder name
  static bool isValidFolderName(String name) {
    final trimmed = name.trim();
    if (trimmed.isEmpty) return false;
    if (trimmed.length > AppConstants.maxFolderNameLength) return false;
    // Prevent special characters that might cause issues
    final invalidChars = RegExp(r'[<>:"/\\|?*]');
    return !invalidChars.hasMatch(trimmed);
  }

  /// Validate file size
  static bool isValidFileSize(File file, {int? maxSize}) {
    try {
      final size = file.lengthSync();
      final max = maxSize ?? AppConstants.maxFileSizeBytes;
      return size > 0 && size <= max;
    } catch (e) {
      return false;
    }
  }

  /// Validate audio file size
  static bool isValidAudioFileSize(File file) {
    try {
      final size = file.lengthSync();
      return size > 0 && size <= AppConstants.maxAudioFileSizeBytes;
    } catch (e) {
      return false;
    }
  }

  /// Validate audio file format
  static bool isValidAudioFormat(String fileName) {
    final extension = fileName.split('.').last.toLowerCase();
    return AppConstants.allowedAudioFormats.contains(extension);
  }

  /// Validate document file format
  static bool isValidDocumentFormat(String fileName) {
    final extension = fileName.split('.').last.toLowerCase();
    return AppConstants.allowedDocumentFormats.contains(extension);
  }

  /// Sanitize string input (basic XSS prevention)
  static String sanitizeInput(String input) {
    if (input.isEmpty) return input;
    // Remove null bytes
    var sanitized = input.replaceAll('\x00', '');
    // Trim whitespace
    sanitized = sanitized.trim();
    return sanitized;
  }

  /// Validate content length for AI generation
  static bool hasEnoughContentForGeneration(String content) {
    final trimmed = content.trim();
    return trimmed.length >= AppConstants.minContentLength;
  }

  /// Get file size in human-readable format
  static String formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}


