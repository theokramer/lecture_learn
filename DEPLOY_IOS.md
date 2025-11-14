# iOS Deployment Guide - RocketLearn

This guide walks you through building and deploying the RocketLearn React Native app to the iOS App Store.

## Prerequisites

1. **Apple Developer Account** ($99/year)
   - Sign up at [developer.apple.com](https://developer.apple.com)
   - Enroll in Apple Developer Program

2. **macOS Computer** (required for iOS development)
   - macOS 12.0 or later
   - Xcode 14.0 or later

3. **Xcode**
   - Download from Mac App Store
   - Install Command Line Tools: `xcode-select --install`

4. **CocoaPods**
   - Install: `sudo gem install cocoapods`

5. **React Native Development Environment**
   - Node.js 18+
   - Watchman: `brew install watchman`

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

## Step 2: Configure iOS Project

### 2.1 Install iOS Dependencies

```bash
cd ios
pod install
cd ..
```

### 2.2 Configure Info.plist

Edit `mobile/ios/RocketLearn/Info.plist` and add required permissions:

```xml
<key>NSCameraUsageDescription</key>
<string>RocketLearn needs access to your camera to scan documents and capture images for your notes.</string>

<key>NSMicrophoneUsageDescription</key>
<string>RocketLearn needs access to your microphone to record audio notes.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>RocketLearn needs access to your photo library to import images and documents.</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>RocketLearn needs permission to save images to your photo library.</string>
```

### 2.3 Configure App Identifier

1. Open `mobile/ios/RocketLearn.xcworkspace` in Xcode
2. Select project in Navigator
3. Go to **Signing & Capabilities**
4. Set **Bundle Identifier**: `com.yourcompany.rocketlearn` (replace with your identifier)
5. Select your **Team** (Apple Developer account)

## Step 3: Configure App Store Connect

### 3.1 Create App in App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+**
3. Fill in app information:
   - **Platform**: iOS
   - **Name**: RocketLearn
   - **Primary Language**: English
   - **Bundle ID**: Select your identifier
   - **SKU**: Unique identifier (e.g., `rocket-learn-001`)
   - **User Access**: Full Access

### 3.2 Configure App Information

1. **App Information**:
   - Category: Productivity / Education
   - Privacy Policy URL: [Your privacy policy URL]

2. **Pricing and Availability**:
   - Set price (Free or Paid)
   - Select countries

3. **Prepare for Submission**:
   - Upload screenshots (required sizes)
   - App preview videos (optional)
   - Description and keywords
   - Support URL
   - Marketing URL (optional)
   - Privacy policy URL

## Step 4: Build for App Store

### 4.1 Configure Release Build

1. In Xcode, select **Product** → **Scheme** → **Edit Scheme**
2. Select **Archive** configuration
3. Set **Build Configuration** to **Release**

### 4.2 Archive the App

1. Select **Any iOS Device** (not simulator) in device selector
2. Go to **Product** → **Archive**
3. Wait for archive to complete
4. **Organizer** window will open

### 4.3 Validate Archive

1. In Organizer, select your archive
2. Click **Validate App**
3. Sign in with Apple Developer account
4. Select your team
5. Fix any validation errors

### 4.4 Distribute to App Store

1. In Organizer, select your archive
2. Click **Distribute App**
3. Select **App Store Connect**
4. Choose distribution options:
   - **Upload**: Upload immediately
   - **Export**: Save for later
5. Select **Automatically manage signing**
6. Review and click **Upload**

## Step 5: Submit for Review

### 5.1 Complete App Store Listing

1. In App Store Connect, go to your app
2. Click **+ Version or Platform** → **iOS**
3. Fill in version information:
   - **Version**: 1.0.0
   - **What's New**: Release notes

4. Upload screenshots (required):
   - iPhone 6.7" Display: 1290 x 2796 pixels
   - iPhone 6.5" Display: 1284 x 2778 pixels
   - iPhone 5.5" Display: 1242 x 2208 pixels
   - iPad Pro (12.9"): 2048 x 2732 pixels

### 5.2 App Review Information

1. **Contact Information**:
   - First name, Last name
   - Phone number
   - Email address

2. **Demo Account** (if app requires login):
   - Create test account credentials

3. **Notes** (optional):
   - Special instructions for reviewers

### 5.3 Submit for Review

1. Complete all required information
2. Click **Submit for Review**
3. App status will change to **Waiting for Review**
4. Typical review time: 24-48 hours

## Step 6: TestFlight Beta Testing (Optional)

### 6.1 Set Up TestFlight

1. In App Store Connect, go to **TestFlight** tab
2. Add internal testers (up to 100)
3. Add external testers (up to 10,000)

### 6.2 Upload Beta Build

1. Archive and upload build (same as production)
2. Wait for processing (15-60 minutes)
3. Distribute to testers
4. Testers receive email invitation

## Step 7: Release Management

### 7.1 Release Types

- **Automatic Release**: App releases immediately after approval
- **Manual Release**: You control when to release

### 7.2 Update Process

For updates:
1. Update version number in Xcode
2. Build and archive new version
3. Upload to App Store Connect
4. Submit new version for review

## Common Issues & Solutions

### Build Errors

**"No such module"**:
```bash
cd ios
pod install
cd ..
```

**Code signing errors**:
- Verify Bundle Identifier matches App Store Connect
- Check team selection in Xcode
- Ensure certificates are valid

### Archive Issues

**"Archive not available"**:
- Select **Any iOS Device** (not simulator)
- Clean build folder: **Product** → **Clean Build Folder**

**Missing dSYM for hermesvm.framework**:

This is a common issue with React Native Hermes. Fix it by configuring dSYM generation:

1. In Xcode, select your project in Navigator
2. Select the **RocketLearn** target
3. Go to **Build Settings** tab
4. Search for "Debug Information Format"
5. Set **Debug Information Format** to **DWARF with dSYM File** for **Release** configuration
6. Search for "Generate Debug Symbols"
7. Ensure **Generate Debug Symbols** is set to **Yes**
8. Search for "Strip Debug Symbols During Copy"
9. Set **Strip Debug Symbols During Copy** to **No** for **Release** configuration

Alternatively, add this to your `Podfile` post_install hook:

```ruby
post_install do |installer|
  react_native_post_install(
    installer,
    config[:reactNativePath],
    :mac_catalyst_enabled => false,
  )
  
  # Fix dSYM generation for Hermes
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['DEBUG_INFORMATION_FORMAT'] = 'dwarf-with-dsym'
      config.build_settings['STRIP_STYLE'] = 'non-global'
      config.build_settings['DEPLOYMENT_POSTPROCESSING'] = 'NO'
    end
  end
end
```

Then run:
```bash
cd ios
pod install
cd ..
```

After updating, clean and rebuild:
1. **Product** → **Clean Build Folder** (Shift + Cmd + K)
2. **Product** → **Archive** again

**Validation failures**:
- Fix all warnings
- Ensure all required assets are present
- Verify app meets App Store guidelines

## App Store Guidelines

Ensure your app complies with:
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Privacy requirements
- Content guidelines
- Technical requirements

## Code Signing & Certificates

### Automatic Signing (Recommended)

Xcode handles certificates automatically:
1. Enable **Automatically manage signing** in Xcode
2. Select your team
3. Xcode creates certificates and provisioning profiles

### Manual Signing

If manual signing needed:
1. Create certificates in [developer.apple.com](https://developer.apple.com/account)
2. Download and install certificates
3. Create provisioning profiles
4. Configure in Xcode

## Security Checklist

Before submitting:
- [ ] App Transport Security enabled
- [ ] No hardcoded secrets or API keys
- [ ] HTTPS for all network requests
- [ ] Privacy manifest configured (if required)
- [ ] Data collection disclosed in privacy policy
- [ ] Permissions requested only when needed

## Support & Resources

- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [React Native iOS Setup](https://reactnative.dev/docs/environment-setup)

## Next Steps

After app is live:
- Monitor reviews and ratings
- Track analytics
- Plan updates and feature releases
- Engage with users
- Iterate based on feedback

