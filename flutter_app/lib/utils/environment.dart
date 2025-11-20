import 'package:flutter/foundation.dart';

/// Environment detection utilities
class Environment {
  /// Check if running in production mode
  static bool get isProduction => kReleaseMode;
  
  /// Check if running in debug/development mode
  static bool get isDevelopment => kDebugMode;
  
  /// Check if running in profile mode
  static bool get isProfile => kProfileMode;
  
  /// Get environment name
  static String get name {
    if (kReleaseMode) return 'production';
    if (kProfileMode) return 'profile';
    return 'development';
  }
  
  /// Check if we should show debug information
  static bool get showDebugInfo => kDebugMode;
  
  /// Check if we should enable verbose logging
  static bool get enableVerboseLogging => kDebugMode;
  
}


