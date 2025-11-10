# Analytics Setup Guide

## Overview
This guide explains how to set up analytics tracking for the Flutter app to monitor user behavior and app performance.

## Options

### Option 1: Firebase Analytics (Recommended)
Free, easy to integrate, and works well with Firebase Crashlytics.

#### Setup Steps:
1. **Add dependency**:
```yaml
dependencies:
  firebase_analytics: ^10.7.4
```

2. **Initialize in `main.dart`**:
```dart
import 'package:firebase_analytics/firebase_analytics.dart';

final analytics = FirebaseAnalytics.instance;
```

3. **Create Analytics Service**:
```dart
// lib/services/analytics_service.dart
import 'package:firebase_analytics/firebase_analytics.dart';

class AnalyticsService {
  static final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;
  
  static Future<void> logEvent(String name, Map<String, dynamic>? parameters) async {
    await _analytics.logEvent(
      name: name,
      parameters: parameters,
    );
  }
  
  // Helper methods for common events
  static Future<void> logNoteCreated() async {
    await logEvent('note_created', null);
  }
  
  static Future<void> logStudyModeViewed(String mode) async {
    await logEvent('study_mode_viewed', {'mode': mode});
  }
  
  static Future<void> logContentGenerated(String contentType) async {
    await logEvent('content_generated', {'type': contentType});
  }
}
```

4. **Track events in AppLogger**:
```dart
// In lib/utils/logger.dart
import '../services/analytics_service.dart';

static void info(String message, {...}) {
  // ... existing logging ...
  
  // Track important events
  if (kReleaseMode && message.contains('Note created')) {
    AnalyticsService.logNoteCreated();
  }
}
```

### Option 2: Mixpanel
More advanced analytics with user segmentation.

### Option 3: Custom Analytics
Send events to your own backend.

## Key Events to Track

### User Actions
- `note_created` - When a note is created
- `note_viewed` - When a note is viewed
- `study_mode_viewed` - When a study mode is accessed
- `content_generated` - When AI content is generated
- `folder_created` - When a folder is created
- `file_uploaded` - When files are uploaded

### Errors
- `error_occurred` - Track error types and frequency
- `rate_limit_hit` - Track rate limit events
- `network_error` - Track network issues

### Performance
- `screen_load_time` - Track screen load performance
- `content_generation_time` - Track AI generation speed
- `file_upload_time` - Track upload performance

## Integration Points

### In AppDataProvider
```dart
Future<String> createNote(...) async {
  try {
    final noteId = await _supabase.createNote(...);
    AnalyticsService.logNoteCreated();
    return noteId;
  } catch (e) {
    AnalyticsService.logEvent('note_creation_failed', {'error': e.toString()});
    rethrow;
  }
}
```

### In NoteViewScreen
```dart
void _onModeChanged(StudyMode mode) {
  AnalyticsService.logStudyModeViewed(mode.toString());
}
```

## Privacy Considerations

1. **Don't track PII**: Never track email, names, or note content
2. **Anonymize user IDs**: Use hashed user IDs
3. **Comply with GDPR**: Get user consent if required
4. **Opt-out option**: Allow users to disable analytics

## Next Steps

1. Choose analytics service
2. Add dependencies
3. Create AnalyticsService
4. Integrate tracking in key user actions
5. Set up dashboards
6. Monitor key metrics


