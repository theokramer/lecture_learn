/// Application-wide constants
/// Centralizes magic numbers and strings for easier maintenance
class AppConstants {
  // Polling
  static const Duration pollingInterval = Duration(seconds: 3);
  static const Duration maxPollingDuration = Duration(minutes: 5);
  static const int maxPollCount = 100; // 100 polls * 3 seconds = 5 minutes
  
  // Note creation timing
  static const Duration initialGenerationWindow = Duration(minutes: 5);
  static const Duration initialGenerationLoadingTimeout = Duration(minutes: 2);
  
  // File upload limits
  static const int maxFileSizeBytes = 50 * 1024 * 1024; // 50MB
  static const int maxAudioFileSizeBytes = 25 * 1024 * 1024; // 25MB
  static const List<String> allowedAudioFormats = ['m4a', 'mp3', 'wav', 'webm', 'ogg', 'flac'];
  static const List<String> allowedDocumentFormats = ['pdf', 'txt', 'md', 'docx', 'pptx', 'json'];
  
  // Content generation
  static const int minContentLength = 50; // Minimum characters for AI generation
  static const int flashcardCount = 20;
  static const int quizQuestionCount = 15;
  static const int exerciseCount = 10;
  static const int feynmanTopicCount = 4;
  
  // UI Constants
  static const Duration animationDuration = Duration(milliseconds: 250);
  static const Duration longPressDuration = Duration(milliseconds: 500);
  static const double defaultBorderRadius = 16.0;
  static const double cardBorderRadius = 18.0;
  static const double iconSize = 24.0;
  static const double largeIconSize = 50.0;
  
  // Colors (if needed as constants)
  static const int primaryColor = 0xFF6366F1; // Indigo
  static const int folderColor = 0xFFB85A3A; // Orange/Brown
  static const int backgroundColor = 0xFF1A1A1A;
  static const int surfaceColor = 0xFF2A2A2A;
  static const int borderColor = 0xFF3A3A3A;
  
  // Text limits
  static const int maxNoteTitleLength = 100;
  static const int maxFolderNameLength = 50;
  static const int maxSearchQueryLength = 200;
  
  // Network
  static const Duration networkTimeout = Duration(seconds: 30);
  static const int maxRetries = 3;
  static const Duration retryInitialDelay = Duration(seconds: 1);
  
  // Private constructor to prevent instantiation
  AppConstants._();
}


