import 'package:shared_preferences/shared_preferences.dart';

class OnboardingService {
  static const String _onboardingCompletedKey = 'onboarding_completed';
  static const String _onboardingDataKey = 'onboarding_data';

  /// Check if onboarding has been completed
  static Future<bool> isOnboardingCompleted() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_onboardingCompletedKey) ?? false;
  }

  /// Mark onboarding as completed
  static Future<void> completeOnboarding(Map<String, dynamic>? data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_onboardingCompletedKey, true);
    if (data != null) {
      // Store onboarding data if needed for personalization
      // You can store it as JSON string
    }
  }

  /// Reset onboarding (for testing/debugging)
  static Future<void> resetOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_onboardingCompletedKey);
    await prefs.remove(_onboardingDataKey);
  }
}

