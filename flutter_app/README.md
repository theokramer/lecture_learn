# RocketLearn - Flutter App

A complete Flutter app that replicates the functionality of the React web app, optimized for iOS with native Apple design principles.

## Features

- 📝 Notes and folder management
- 🎤 Audio recording and transcription
- 📄 Document upload (PDF, DOC, etc.)
- 🤖 AI-powered summaries, flashcards, quizzes
- 💬 AI chat interface
- 📱 Native iOS navigation and design

## Setup

1. Install Flutter (3.0.0 or higher)
2. Copy `.env.example` to `.env` and add your credentials:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   OPENAI_API_KEY=your_openai_api_key
   ```
3. Run `flutter pub get`
4. Run `flutter run` (iOS simulator or device)

## Project Structure

```
lib/
  ├── main.dart
  ├── models/          # Data models
  ├── services/        # Backend services
  ├── providers/       # State management
  ├── screens/         # UI screens
  ├── widgets/         # Reusable widgets
  └── utils/           # Utilities
```

