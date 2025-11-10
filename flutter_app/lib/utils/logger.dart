import 'package:flutter/foundation.dart';
import 'dart:convert';

/// Production-ready logging service
/// Replaces print() statements with structured logging
class AppLogger {
  static const String _tag = '[NanoAI]';
  
  /// Debug logs - only shown in debug mode
  static void debug(String message, {Map<String, dynamic>? context, String? tag}) {
    if (kDebugMode) {
      final contextStr = context != null ? ' ${jsonEncode(context)}' : '';
      debugPrint('🐛 $_tag${tag != null ? '[$tag]' : ''} $message$contextStr');
    }
  }
  
  /// Info logs - shown in debug, sent to analytics in production
  static void info(String message, {Map<String, dynamic>? context, String? tag}) {
    debugPrint('ℹ️ $_tag${tag != null ? '[$tag]' : ''} $message');
    // TODO: Send to analytics service in production
    // if (kReleaseMode) {
    //   AnalyticsService.logEvent('info_log', {'message': message, ...?context});
    // }
  }
  
  /// Warning logs
  static void warning(String message, {Object? error, Map<String, dynamic>? context, String? tag}) {
    final errorStr = error != null ? ' Error: $error' : '';
    final contextStr = context != null ? ' ${jsonEncode(context)}' : '';
    debugPrint('⚠️ $_tag${tag != null ? '[$tag]' : ''} $message$errorStr$contextStr');
    // TODO: Send to crash reporting in production
  }
  
  /// Error logs - always logged, sent to crash reporting in production
  static void error(
    String message, {
    Object? error,
    StackTrace? stackTrace,
    Map<String, dynamic>? context,
    String? tag,
  }) {
    final errorStr = error != null ? ' Error: $error' : '';
    final stackStr = stackTrace != null ? '\nStack: $stackTrace' : '';
    final contextStr = context != null ? ' ${jsonEncode(context)}' : '';
    
    debugPrint('❌ $_tag${tag != null ? '[$tag]' : ''} $message$errorStr$stackStr$contextStr');
    
    // TODO: Send to crash reporting service in production
    // if (kReleaseMode) {
    //   CrashReportingService.recordError(
    //     error ?? Exception(message),
    //     stackTrace,
    //     context: context,
    //   );
    // }
  }
  
  /// Success logs
  static void success(String message, {Map<String, dynamic>? context, String? tag}) {
    debugPrint('✅ $_tag${tag != null ? '[$tag]' : ''} $message');
  }
  
  /// Network request logs
  static void network(String method, String url, {int? statusCode, String? tag}) {
    final status = statusCode != null ? ' [$statusCode]' : '';
    debugPrint('🌐 $_tag${tag != null ? '[$tag]' : ''} $method $url$status');
  }
}


