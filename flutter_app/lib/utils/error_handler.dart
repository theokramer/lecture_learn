import 'dart:io';
import '../services/ai_gateway_service.dart';
import 'logger.dart';

/// Centralized error handling with user-friendly messages
class ErrorHandler {
  /// Get user-friendly error message
  /// Never exposes sensitive information or technical details
  static String getUserFriendlyMessage(dynamic error) {
    if (error == null) {
      return 'An unexpected error occurred. Please try again.';
    }

    // Handle specific error types
    if (error is RateLimitError) {
      if (error.code == 'ACCOUNT_LIMIT_REACHED') {
        return 'You\'ve reached your one-time AI generation limit.';
      }
      if (error.code == 'DAILY_LIMIT_REACHED') {
        return 'Daily limit reached. Please try again tomorrow.';
      }
      return 'Too many requests. Please wait a moment and try again.';
    }

    final errorString = error.toString().toLowerCase();

    // Network errors
    if (error is SocketException ||
        errorString.contains('network') ||
        errorString.contains('connection') ||
        errorString.contains('timeout') ||
        errorString.contains('failed to fetch')) {
      return 'Network error. Please check your internet connection and try again.';
    }

    // Authentication errors
    if (errorString.contains('unauthorized') ||
        errorString.contains('authentication') ||
        errorString.contains('session') ||
        errorString.contains('token')) {
      return 'Your session has expired. Please log in again.';
    }

    // Permission errors
    if (errorString.contains('permission') ||
        errorString.contains('forbidden') ||
        errorString.contains('access denied')) {
      return 'You don\'t have permission to perform this action.';
    }

    // Validation errors
    if (errorString.contains('validation') ||
        errorString.contains('invalid') ||
        errorString.contains('required')) {
      return 'Invalid input. Please check your data and try again.';
    }

    // File errors
    if (errorString.contains('file') ||
        errorString.contains('upload') ||
        errorString.contains('size') ||
        errorString.contains('format')) {
      return 'File error. Please check the file format and size, then try again.';
    }

    // Storage errors
    if (errorString.contains('storage') ||
        errorString.contains('quota') ||
        errorString.contains('space')) {
      return 'Storage limit reached. Please free up some space and try again.';
    }

    // YouTube-specific errors
    if (errorString.contains('youtube')) {
      return 'YouTube videos are not supported. Please try a different link.';
    }

    // Generic error - never expose technical details in production
    return 'Something went wrong. Please try again.';
  }

  /// Log error with context
  static void logError(
    dynamic error, {
    String? context,
    String? tag,
    StackTrace? stackTrace,
    Map<String, dynamic>? additionalContext,
  }) {
    AppLogger.error(
      'Error${context != null ? ' in $context' : ''}',
      error: error,
      stackTrace: stackTrace,
      context: additionalContext,
      tag: tag ?? context,
    );
  }

  /// Handle error and return user-friendly message
  static String handleError(
    dynamic error, {
    String? context,
    StackTrace? stackTrace,
    Map<String, dynamic>? additionalContext,
  }) {
    logError(error, context: context, stackTrace: stackTrace, additionalContext: additionalContext);
    return getUserFriendlyMessage(error);
  }
}

