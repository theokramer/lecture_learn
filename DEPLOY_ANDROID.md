# Android Deployment Guide - RocketLearn

This guide walks you through building and deploying the RocketLearn React Native app to the Google Play Store.

## Prerequisites

1. **Google Play Console Account** ($25 one-time fee)
   - Sign up at [play.google.com/console](https://play.google.com/console)
   - Complete developer registration

2. **Development Environment**
   - Node.js 18+
   - Java Development Kit (JDK) 17
   - Android Studio (latest version)
   - Android SDK (API level 33+)

3. **React Native Development Tools**
   - Watchman: `brew install watchman` (macOS) or install separately
   - React Native CLI (optional): `npm install -g react-native-cli`

## Step 1: Set Up React Native Project

1. Navigate to your project root:
   ```bash
   cd /path/to/react-learning-notes
   ```

2. Initialize React Native (if not already done):
   ```bash
   npx react-native init RocketLearn --directory mobile --template react-native-template-typescript
   ```

3. Navigate to mobile directory:
   ```bash
   cd mobile
   ```

## Step 2: Configure Android Project

### 2.1 Configure AndroidManifest.xml

Edit `mobile/android/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    
    <application
        android:name=".MainApplication"
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:allowBackup="false"
        android:theme="@style/AppTheme">
        <!-- Your activities -->
    </application>
</manifest>
```

### 2.2 Configure Build Gradle

Edit `mobile/android/app/build.gradle`:

```gradle
android {
    compileSdkVersion 34
    
    defaultConfig {
        applicationId "com.yourcompany.rocketlearn"
        minSdkVersion 23
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }
    
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
                storeFile file(MYAPP_RELEASE_STORE_FILE)
                storePassword MYAPP_RELEASE_STORE_PASSWORD
                keyAlias MYAPP_RELEASE_KEY_ALIAS
                keyPassword MYAPP_RELEASE_KEY_PASSWORD
            }
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 2.3 Create Signing Key

1. Generate a keystore file:
   ```bash
   cd android/app
   keytool -genkeypair -v -storetype PKCS12 -keystore rocket-learn-release-key.keystore -alias rocket-learn-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **IMPORTANT**: 
   - Remember the password you set
   - Store the keystore file securely
   - **Lose this file = cannot update your app**
   - Backup the keystore file

3. Create `mobile/android/gradle.properties`:
   ```properties
   MYAPP_RELEASE_STORE_FILE=rocket-learn-release-key.keystore
   MYAPP_RELEASE_KEY_ALIAS=rocket-learn-key-alias
   MYAPP_RELEASE_STORE_PASSWORD=your_store_password
   MYAPP_RELEASE_KEY_PASSWORD=your_key_password
   ```

   **Note**: Add `gradle.properties` to `.gitignore` to protect secrets.

### 2.4 Configure ProGuard

Create/edit `mobile/android/app/proguard-rules.pro`:

```proguard
# Keep React Native classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }

# Keep your app classes
-keep class com.yourcompany.rocketlearn.** { *; }

# Keep Supabase classes if needed
-keep class io.supabase.** { *; }
```

## Step 3: Configure Google Play Console

### 3.1 Create App

1. Go to [play.google.com/console](https://play.google.com/console)
2. Click **Create app**
3. Fill in:
   - **App name**: RocketLearn
   - **Default language**: English
   - **App or game**: App
   - **Free or paid**: Select appropriate
   - **Declarations**: Accept policies

### 3.2 Complete Store Listing

1. **App access**:
   - Select access level
   - Add content rating questionnaire

2. **Privacy policy**:
   - Required URL to privacy policy

3. **App content**:
   - Content rating
   - Target audience
   - Data safety form

4. **Store listing**:
   - Short description (80 chars)
   - Full description (4000 chars)
   - Screenshots (required):
     - Phone: 1080 x 1920 px (at least 2)
     - Tablet: 1200 x 1600 px (optional)
   - Feature graphic: 1024 x 500 px
   - App icon: 512 x 512 px

## Step 4: Build Release APK/AAB

### 4.1 Build Android App Bundle (AAB) - Recommended

```bash
cd mobile/android
./gradlew bundleRelease
```

Output: `app/build/outputs/bundle/release/app-release.aab`

### 4.2 Build APK (Alternative)

```bash
cd mobile/android
./gradlew assembleRelease
```

Output: `app/build/outputs/apk/release/app-release.apk`

**Note**: Google Play requires AAB format (Android App Bundle) for new apps.

### 4.3 Verify Build

1. Test on device:
   ```bash
   npx react-native run-android --variant=release
   ```

2. Or install APK manually:
   ```bash
   adb install app/build/outputs/apk/release/app-release.apk
   ```

## Step 5: Upload to Play Console

### 5.1 Create Release

1. In Play Console, go to **Production** → **Create new release**
2. Upload your AAB file
3. Add **Release name** (e.g., "1.0.0")
4. Add **Release notes**
5. Click **Review release**

### 5.2 Internal Testing (Optional)

1. Go to **Testing** → **Internal testing**
2. Create new release
3. Upload AAB
4. Add testers (email addresses)
5. Share test link

### 5.3 Submit for Review

1. Complete all required sections:
   - Store listing
   - Content rating
   - Privacy policy
   - Data safety
   - Target audience

2. Review app information

3. Click **Start rollout to Production**

4. Review time: Typically 1-3 days

## Step 6: Release Management

### 6.1 Update Version

For updates, increment in `mobile/android/app/build.gradle`:

```gradle
versionCode 2  // Increment by 1
versionName "1.0.1"
```

### 6.2 Staged Rollout (Recommended)

1. **Gradual rollout**: Start with 20% of users
2. Monitor for issues
3. Increase to 100% if stable

### 6.3 Release Types

- **Production**: Full release to all users
- **Open testing**: Public beta
- **Closed testing**: Limited beta
- **Internal testing**: Team only

## Common Issues & Solutions

### Build Errors

**Gradle sync failed**:
```bash
cd android
./gradlew clean
./gradlew --stop
```

**NDK not found**:
- Install NDK in Android Studio SDK Manager
- Set `ndkVersion` in `build.gradle`

### Signing Issues

**"Keystore file not found"**:
- Verify path in `gradle.properties`
- Use absolute path if relative doesn't work

**"Wrong password"**:
- Double-check passwords in `gradle.properties`
- Ensure no extra spaces

### Upload Errors

**"App not compliant with Target API level"**:
- Update `targetSdkVersion` to latest
- Test thoroughly before uploading

**"Upload failed"**:
- Check file size (max 150MB for AAB)
- Verify AAB format (not APK)

## Security Checklist

Before submitting:
- [ ] ProGuard/R8 enabled for code obfuscation
- [ ] No hardcoded API keys or secrets
- [ ] HTTPS for all network requests
- [ ] Permissions requested only when needed
- [ ] Data safety form completed accurately
- [ ] Privacy policy published and linked

## Keystore Management

### Best Practices

1. **Backup**: Store keystore in secure location (encrypted)
2. **Version Control**: Never commit keystore to git
3. **Access Control**: Limit who has access to keystore
4. **Password Management**: Use password manager for passwords
5. **Documentation**: Document keystore location securely

### If Keystore is Lost

- Cannot update existing app
- Must create new app with new package name
- Users will need to reinstall

## Google Play Policies

Ensure compliance with:
- [Google Play Developer Policy](https://play.google.com/about/developer-content-policy/)
- Privacy requirements
- Content guidelines
- Technical requirements
- Data safety requirements

## Support & Resources

- [React Native Android Setup](https://reactnative.dev/docs/environment-setup)
- [Android Developer Documentation](https://developer.android.com/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Android App Bundle Guide](https://developer.android.com/guide/app-bundle)

## Next Steps

After app is live:
- Monitor crash reports in Play Console
- Track user reviews and ratings
- Analyze user analytics
- Plan updates and feature releases
- Engage with users via reviews


