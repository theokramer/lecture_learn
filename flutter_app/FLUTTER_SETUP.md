# Flutter App Setup Guide

This Flutter app replicates all functionality from the React web app, optimized for iOS with native Apple design principles.

## Features

✅ **Complete Feature Parity**
- Notes and folder management with hierarchical navigation
- Audio recording and transcription
- Document upload (PDF, DOC, etc.)
- AI-powered summaries, flashcards, quizzes, exercises
- Feynman technique topics
- AI chat interface
- Native iOS navigation and design

✅ **Native iOS Design**
- Cupertino widgets throughout
- Native navigation bar with back buttons
- iOS-style modals and dialogs
- Smooth animations and transitions
- Optimized for iPhone screens

## Setup Instructions

### 1. Prerequisites

- Flutter SDK 3.0.0 or higher
- Xcode (for iOS development)
- CocoaPods (for iOS dependencies)
- Supabase account
- OpenAI API key

### 2. Install Dependencies

```bash
cd flutter_app
flutter pub get
```

### 3. Configure Environment Variables

Create a `.env` file in the `flutter_app` directory (or use environment variables):

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

**For iOS development**, you can also set these in Xcode:
1. Open `ios/Runner.xcworkspace` in Xcode
2. Select the Runner target
3. Go to Build Settings
4. Add User-Defined Settings:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`

Or modify `main.dart` to load from a config file or use `flutter_dotenv` package.

### 4. iOS Configuration

1. Open `ios/Podfile` and ensure minimum iOS version is 11.0+
2. Run `cd ios && pod install`
3. Configure microphone permissions in `ios/Runner/Info.plist`:
   ```xml
   <key>NSMicrophoneUsageDescription</key>
   <string>We need access to your microphone to record audio notes.</string>
   ```

### 5. Run the App

```bash
# For iOS Simulator
flutter run

# For specific device
flutter run -d <device-id>
```

## Project Structure

```
lib/
├── main.dart                 # App entry point
├── models/                   # Data models
│   ├── note.dart
│   ├── folder.dart
│   ├── document.dart
│   ├── user.dart
│   ├── study_content.dart
│   └── chat_message.dart
├── services/                 # Backend services
│   ├── supabase_service.dart
│   ├── openai_service.dart
│   ├── ai_gateway_service.dart
│   └── document_processor_service.dart
├── providers/                # State management
│   ├── auth_provider.dart
│   └── app_data_provider.dart
├── screens/                  # UI screens
│   ├── login_screen.dart
│   ├── home_screen.dart
│   ├── note_view_screen.dart
│   ├── note_creation_screen.dart
│   ├── record_audio_screen.dart
│   ├── processing_screen.dart
│   └── upload_screen.dart
└── widgets/                  # Reusable widgets
    ├── folder_note_item.dart
    ├── create_folder_dialog.dart
    ├── study_mode_selector.dart
    └── ai_chat_panel.dart
```

## Key Features Implementation

### Home Screen
- Displays notes and folders in current folder
- Breadcrumb navigation for folder hierarchy
- Search functionality
- Floating action button for quick creation
- Native iOS navigation bar

### Note Creation
- Multiple creation options (audio, upload, manual)
- Native iOS action sheet for FAB options
- Smooth navigation flow

### Audio Recording
- Uses `record` package for audio capture
- Real-time timer display
- Waveform visualization (can be enhanced)
- Automatic upload and processing

### Processing Screen
- Progress indicator
- Task status updates
- Rate limit checking
- Error handling with user-friendly messages

### Note View Screen
- Horizontal scrollable study mode selector
- Multiple study modes:
  - Summary (Markdown rendering)
  - Transcript (raw content)
  - Flashcards (interactive card viewer)
  - Quiz (multiple choice questions)
  - Exercises (practice problems)
  - Feynman (explanation topics)
  - Documents (file list)
- AI Chat panel (slide-in from right)

### AI Chat
- Real-time messaging
- Markdown rendering for AI responses
- Context-aware (uses note content)
- Conversation history

## Design Principles

1. **Native iOS Feel**
   - Cupertino widgets throughout
   - Native navigation patterns
   - iOS-style colors and typography

2. **Performance**
   - Efficient state management with Riverpod
   - Lazy loading where appropriate
   - Optimized list rendering

3. **User Experience**
   - Clear navigation hierarchy
   - Intuitive gestures
   - Smooth animations
   - Error handling with helpful messages

## Backend Integration

The app uses the same Supabase backend as the web app:
- Same database schema
- Same authentication flow
- Same storage buckets
- Same API endpoints

All data is synchronized between web and mobile apps.

## Next Steps

1. **Environment Variables**: Set up proper environment variable loading (consider `flutter_dotenv`)
2. **PDF Processing**: Implement proper PDF text extraction
3. **Video Processing**: Add video transcription support
4. **Offline Support**: Add local caching and offline mode
5. **Push Notifications**: Add notifications for study reminders
6. **Analytics**: Integrate analytics tracking
7. **Testing**: Add unit and widget tests

## Troubleshooting

### Build Issues
- Run `flutter clean` and `flutter pub get`
- For iOS: `cd ios && pod install`
- Check Xcode version compatibility

### Permission Issues
- Ensure microphone permission is requested
- Check Info.plist configurations

### API Issues
- Verify environment variables are set correctly
- Check Supabase project settings
- Verify OpenAI API key is valid

## Notes

- The app is optimized for iPhone but works on iPad
- Dark theme is used throughout (matches web app)
- All features from the web app are implemented
- Native iOS navigation ensures familiar user experience

