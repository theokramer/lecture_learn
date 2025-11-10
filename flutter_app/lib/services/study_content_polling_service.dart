import 'dart:async';
import 'supabase_service.dart';
import '../models/study_content.dart';
import '../utils/logger.dart';

/// Service to poll for study content in the background
/// Continues polling even when app is backgrounded or user switches notes
class StudyContentPollingService {
  static final StudyContentPollingService _instance = StudyContentPollingService._internal();
  factory StudyContentPollingService() => _instance;
  StudyContentPollingService._internal();

  final Map<String, Timer> _pollTimers = {};
  final Map<String, Function(StudyContent)> _callbacks = {};
  final Map<String, DateTime> _noteCreatedAt = {};
  final SupabaseService _supabase = SupabaseService();

  /// Start polling for a note's study content
  /// Continues even if widget is disposed or app goes to background
  void startPolling({
    required String noteId,
    required DateTime noteCreatedAt,
    required Function(StudyContent) onContentFound,
    Duration? maxDuration,
  }) {
    // Cancel existing polling for this note if any
    stopPolling(noteId);

    _noteCreatedAt[noteId] = noteCreatedAt;
    _callbacks[noteId] = onContentFound;

    final startTime = DateTime.now();
    final maxPollDuration = maxDuration ?? const Duration(minutes: 5);
    int pollCount = 0;
    const maxPolls = 100; // 100 polls * 3 seconds = 5 minutes max

    AppLogger.info('Starting background polling for note: $noteId', tag: 'PollingService');

    _pollTimers[noteId] = Timer.periodic(const Duration(seconds: 3), (timer) async {
      pollCount++;

      // Check if max duration exceeded
      if (DateTime.now().difference(startTime) > maxPollDuration) {
        AppLogger.warning('Polling timeout for note: $noteId', tag: 'PollingService');
        stopPolling(noteId);
        return;
      }

      // Check if max polls exceeded
      if (pollCount >= maxPolls) {
        AppLogger.warning('Max polls reached for note: $noteId', tag: 'PollingService');
        stopPolling(noteId);
        return;
      }

      try {
        // Fetch from Supabase
        final content = await _supabase.getStudyContent(noteId);
        final hasContent = content.flashcards.isNotEmpty ||
            content.quizQuestions.isNotEmpty ||
            content.exercises.isNotEmpty ||
            content.feynmanTopics.isNotEmpty ||
            content.summary.isNotEmpty;

        if (hasContent) {
          AppLogger.success('Study content found for note: $noteId', tag: 'PollingService');
          // Notify callback
          final callback = _callbacks[noteId];
          if (callback != null) {
            callback(content);
          }
          // Stop polling
          stopPolling(noteId);
        } else {
          // Still no content, continue polling
          if (pollCount % 10 == 0) {
            // Log every 10 polls (every 30 seconds)
            AppLogger.debug('Still polling for note: $noteId (poll $pollCount)', tag: 'PollingService');
          }
        }
      } catch (e) {
        AppLogger.warning('Error polling for note $noteId', error: e, tag: 'PollingService');
        // Continue polling on error (might be temporary network issue)
      }
    });
  }

  /// Stop polling for a specific note
  void stopPolling(String noteId) {
    _pollTimers[noteId]?.cancel();
    _pollTimers.remove(noteId);
    _callbacks.remove(noteId);
    _noteCreatedAt.remove(noteId);
    AppLogger.info('Stopped polling for note: $noteId', tag: 'PollingService');
  }

  /// Check if a note is currently being polled
  bool isPolling(String noteId) {
    return _pollTimers.containsKey(noteId) && _pollTimers[noteId]!.isActive;
  }

  /// Get the creation time for a note (if being polled)
  DateTime? getNoteCreatedAt(String noteId) {
    return _noteCreatedAt[noteId];
  }

  /// Stop all polling (e.g., on app close)
  void stopAllPolling() {
    for (final noteId in _pollTimers.keys.toList()) {
      stopPolling(noteId);
    }
  }
}

