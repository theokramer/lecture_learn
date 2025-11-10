# Crash Reporting Setup Guide

## Overview
This guide explains how to set up crash reporting for the Flutter app to track errors in production.

## Options

### Option 1: Firebase Crashlytics (Recommended)
Firebase Crashlytics is free and integrates well with Flutter.

#### Setup Steps:
1. **Add dependencies to `pubspec.yaml`**:
```yaml
dependencies:
  firebase_core: ^2.24.2
  firebase_crashlytics: ^3.4.9
```

2. **Initialize in `main.dart`**:
```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Firebase.initializeApp();
  
  // Pass all uncaught errors to Crashlytics
  FlutterError.onError = (errorDetails) {
    FirebaseCrashlytics.instance.recordFlutterFatalError(errorDetails);
  };
  
  // Pass uncaught async errors
  PlatformDispatcher.instance.onError = (error, stack) {
    FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
    return true;
  };
  
  runApp(const MyApp());
}
```

3. **Update AppLogger to send to Crashlytics**:
```dart
// In lib/utils/logger.dart
import 'package:firebase_crashlytics/firebase_crashlytics.dart';

static void error(
  String message, {
  Object? error,
  StackTrace? stackTrace,
  Map<String, dynamic>? context,
  String? tag,
}) {
  // ... existing logging ...
  
  // Send to Crashlytics in production
  if (kReleaseMode && error != null) {
    FirebaseCrashlytics.instance.recordError(
      error,
      stackTrace,
      reason: message,
      information: context?.entries.map((e) => DiagnosticsProperty(e.key, e.value)).toList(),
    );
  }
}
```

### Option 2: Sentry
Sentry provides detailed error tracking and performance monitoring.

#### Setup Steps:
1. **Add dependencies**:
```yaml
dependencies:
  sentry_flutter: ^7.15.0
```

2. **Initialize in `main.dart`**:
```dart
import 'package:sentry_flutter/sentry_flutter.dart';

Future<void> main() async {
  await SentryFlutter.init(
    (options) {
      options.dsn = 'YOUR_SENTRY_DSN';
      options.tracesSampleRate = 1.0;
    },
    appRunner: () => runApp(const MyApp()),
  );
}
```

3. **Update AppLogger**:
```dart
import 'package:sentry_flutter/sentry_flutter.dart';

static void error(...) {
  // ... existing logging ...
  
  if (kReleaseMode && error != null) {
    Sentry.captureException(
      error,
      stackTrace: stackTrace,
      hint: Hint.withMap(context ?? {}),
    );
  }
}
```

## Integration with ErrorHandler

Update `ErrorHandler.logError` to automatically send to crash reporting:

```dart
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
  
  // Send to crash reporting in production
  if (kReleaseMode) {
    // Firebase Crashlytics
    FirebaseCrashlytics.instance.recordError(
      error,
      stackTrace,
      reason: context,
      information: additionalContext?.entries
          .map((e) => DiagnosticsProperty(e.key, e.value))
          .toList(),
    );
    
    // OR Sentry
    // Sentry.captureException(
    //   error,
    //   stackTrace: stackTrace,
    //   hint: Hint.withMap(additionalContext ?? {}),
    // );
  }
}
```

## Benefits

1. **Automatic Error Tracking**: All errors logged via AppLogger are tracked
2. **Stack Traces**: Full stack traces for debugging
3. **Context**: Additional context (user ID, screen, etc.) included
4. **Alerts**: Get notified when errors occur in production
5. **Analytics**: Track error rates and trends

## Next Steps

1. Choose crash reporting service (Firebase Crashlytics recommended)
2. Add dependencies to `pubspec.yaml`
3. Initialize in `main.dart`
4. Update `AppLogger.error()` to send to crash reporting
5. Test error tracking
6. Set up alerts/notifications


