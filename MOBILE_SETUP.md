# React Native Mobile App Setup Guide

This guide explains how to set up the React Native mobile app for Nano AI.

## Overview

The mobile app shares business logic with the web app through a shared codebase structure. This allows code reuse while maintaining platform-specific UI.

## Project Structure

```
react-learning-notes/
├── src/                    # Shared web/mobile code
│   ├── services/          # API clients, Supabase
│   ├── types/             # TypeScript types
│   └── utils/             # Shared utilities
├── mobile/                 # React Native app
│   ├── src/               # Mobile-specific code
│   │   ├── screens/       # Screen components
│   │   ├── components/    # Mobile UI components
│   │   └── navigation/    # Navigation setup
│   ├── ios/               # iOS native code
│   ├── android/           # Android native code
│   └── package.json       # Mobile dependencies
└── package.json           # Root package.json
```

## Step 1: Initialize React Native Project

```bash
# From project root
npx react-native@latest init NanoAI --directory mobile --template react-native-template-typescript

cd mobile
```

## Step 2: Install Core Dependencies

```bash
# Navigation
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs

# React Native dependencies
npm install react-native-screens react-native-safe-area-context

# Supabase (shared)
npm install @supabase/supabase-js

# Secure storage
npm install react-native-keychain

# File operations
npm install react-native-document-picker

# Audio recording
npm install react-native-audio-recorder-player

# Local storage
npm install @react-native-async-storage/async-storage

# Biometric authentication
npm install react-native-biometrics

# Deep linking
npm install react-native-deep-linking
```

### iOS-specific setup

```bash
cd ios
pod install
cd ..
```

## Step 3: Configure Shared Code

Create symlinks or use a monorepo tool to share code between web and mobile:

### Option A: Symlinks (Simple)

```bash
# From mobile directory
ln -s ../src/services src/shared/services
ln -s ../src/types src/shared/types
ln -s ../src/utils src/shared/utils
```

### Option B: npm/yarn workspaces (Recommended)

In root `package.json`:

```json
{
  "workspaces": [
    ".",
    "mobile"
  ]
}
```

## Step 4: Environment Configuration

Create `mobile/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
OPENAI_API_KEY=your_openai_key
```

Install `react-native-config`:

```bash
npm install react-native-config
```

## Step 5: Configure Native Projects

### iOS Configuration

1. **Info.plist permissions** (see DEPLOY_IOS.md)
2. **App Transport Security**: Already enabled by default
3. **Deep linking**: Configure URL scheme

### Android Configuration

1. **AndroidManifest.xml permissions** (see DEPLOY_ANDROID.md)
2. **Network Security Config**: Allow HTTPS connections
3. **Deep linking**: Configure intent filters

## Step 6: Create Navigation Structure

Create `mobile/src/navigation/AppNavigator.tsx`:

```typescript
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
// ... other screens

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        {/* ... other screens */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

## Step 7: Implement Core Features

### Authentication

- Use shared Supabase client from `src/services/supabase.ts`
- Implement biometric auth for mobile
- Handle deep linking for OAuth callbacks

### Secure Storage

```typescript
import * as Keychain from 'react-native-keychain';

// Store tokens securely
await Keychain.setGenericPassword('auth_token', token);

// Retrieve tokens
const credentials = await Keychain.getGenericPassword();
```

### File Operations

- Use `react-native-document-picker` for file selection
- Upload to Supabase Storage using shared storage service

## Step 8: Platform-Specific Code

Use platform detection:

```typescript
import { Platform } from 'react-native';

if (Platform.OS === 'ios') {
  // iOS-specific code
} else if (Platform.OS === 'android') {
  // Android-specific code
}
```

## Step 9: Testing

```bash
# Run iOS
npm run ios

# Run Android
npm run android

# Run on specific device
npm run ios -- --simulator="iPhone 14 Pro"
```

## Step 10: Build for Release

### iOS
See DEPLOY_IOS.md for detailed instructions.

### Android
See DEPLOY_ANDROID.md for detailed instructions.

## Shared Code Guidelines

### What to Share
- ✅ API clients (`services/`)
- ✅ Type definitions (`types/`)
- ✅ Utility functions (`utils/`)
- ✅ Business logic

### What NOT to Share
- ❌ UI components (different libraries)
- ❌ Routing/navigation (different systems)
- ❌ Platform-specific APIs

## Mobile-Specific Features

### Biometric Authentication
- Face ID / Touch ID (iOS)
- Fingerprint (Android)
- Implement login bypass after first auth

### Offline Support
- Cache notes locally
- Sync when online
- Show offline indicator

### Push Notifications
- Configure Firebase Cloud Messaging (Android)
- Configure Apple Push Notification Service (iOS)
- Implement notification handlers

## Troubleshooting

### Metro Bundler Issues
```bash
npm start -- --reset-cache
```

### iOS Build Issues
```bash
cd ios
pod install
pod update
cd ..
```

### Android Build Issues
```bash
cd android
./gradlew clean
./gradlew --stop
cd ..
```

## Next Steps

1. Implement core screens (Login, Home, NoteView)
2. Connect to shared Supabase services
3. Implement mobile-specific features (biometric auth, offline)
4. Test on real devices
5. Prepare for App Store/Play Store submission

## Resources

- [React Native Documentation](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Supabase React Native Guide](https://supabase.com/docs/guides/getting-started/tutorials/creating-mobile-apps)

