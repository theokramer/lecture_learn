import 'dart:async';
import 'dart:io';
import '../constants/app_constants.dart';
import 'logger.dart';

/// Retry helper for network requests with exponential backoff
class RetryHelper {
  /// Execute a function with retry logic
  static Future<T> withRetry<T>(
    Future<T> Function() fn, {
    int maxRetries = AppConstants.maxRetries,
    Duration initialDelay = AppConstants.retryInitialDelay,
    Duration? maxDelay,
    bool Function(dynamic error)? shouldRetry,
  }) async {
    final maxDelayDuration = maxDelay ?? const Duration(seconds: 30);
    int attempt = 0;
    Duration delay = initialDelay;
    dynamic lastError;

    while (attempt <= maxRetries) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Check if we should retry this error
        if (shouldRetry != null && !shouldRetry(error)) {
          AppLogger.warning(
            'Error not retryable',
            error: error,
            tag: 'RetryHelper',
          );
          rethrow;
        }

        // Don't retry on authentication errors
        final errorStr = error.toString().toLowerCase();
        if (errorStr.contains('unauthorized') ||
            errorStr.contains('authentication') ||
            errorStr.contains('forbidden')) {
          AppLogger.warning(
            'Authentication error, not retrying',
            error: error,
            tag: 'RetryHelper',
          );
          rethrow;
        }

        // Don't retry if we've exhausted attempts
        if (attempt >= maxRetries) {
          AppLogger.error(
            'Max retries reached',
            error: error,
            tag: 'RetryHelper',
          );
          break;
        }

        attempt++;
        AppLogger.info(
          'Retrying (attempt $attempt/${maxRetries + 1}) after ${delay.inMilliseconds}ms',
          context: {'error': error.toString()},
          tag: 'RetryHelper',
        );

        await Future.delayed(delay);
        delay = Duration(
          milliseconds: (delay.inMilliseconds * 2).clamp(
            initialDelay.inMilliseconds,
            maxDelayDuration.inMilliseconds,
          ),
        );
      }
    }

    throw lastError ?? Exception('Unknown error after retries');
  }

  /// Check if error is retryable (network errors)
  static bool isRetryableError(dynamic error) {
    if (error is SocketException) return true;
    if (error is TimeoutException) return true;

    final errorStr = error.toString().toLowerCase();
    return errorStr.contains('network') ||
        errorStr.contains('connection') ||
        errorStr.contains('timeout') ||
        errorStr.contains('failed to fetch');
  }
}


