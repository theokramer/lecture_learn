# Quick Start Guide

## Getting Started in 5 Minutes

### 1. Install Flutter
```bash
# Check if Flutter is installed
flutter --version

# If not installed, follow: https://flutter.dev/docs/get-started/install
```

### 2. Clone and Setup
```bash
cd flutter_app
flutter pub get
```

### 3. Configure Environment

**Option A: Environment Variables (Recommended for Development)**
```bash
export SUPABASE_URL="your_supabase_url"
export SUPABASE_ANON_KEY="your_supabase_key"
export OPENAI_API_KEY="your_openai_key"
```

**Option B: Modify main.dart**
Edit `lib/main.dart` and replace the `String.fromEnvironment` calls with your actual values (for testing only).

### 4. Run on iOS Simulator
```bash
# Open iOS Simulator
open -a Simulator

# Run the app
flutter run
```

### 5. Test the App
1. Sign up or log in
2. Create a folder
3. Record an audio note
4. View the note and explore study modes
5. Try the AI chat

## Common Issues

**"Missing Supabase environment variables"**
- Set environment variables before running
- Or modify main.dart temporarily

**"Pod install failed" (iOS)**
```bash
cd ios
pod install
cd ..
flutter run
```

**"Microphone permission denied"**
- Check `ios/Runner/Info.plist` has microphone permission
- Reset simulator: Device > Erase All Content and Settings

## Next Steps

- Read `FLUTTER_SETUP.md` for detailed setup
- Customize colors in `main.dart` theme
- Add your app icon in `ios/Runner/Assets.xcassets/AppIcon.appiconset/`

