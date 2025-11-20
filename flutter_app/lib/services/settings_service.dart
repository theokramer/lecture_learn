import 'package:shared_preferences/shared_preferences.dart';

class SettingsService {
  static const String _flashcardCountKey = 'flashcard_count';
  static const String _quizCountKey = 'quiz_count';
  static const String _exerciseCountKey = 'exercise_count';
  static const String _feynmanTopicCountKey = 'feynman_topic_count';
  static const String _autoGenerateKey = 'auto_generate';
  static const String _hapticFeedbackKey = 'haptic_feedback';
  static const String _soundEffectsKey = 'sound_effects';

  // Default values
  static const int defaultFlashcardCount = 20;
  static const int defaultQuizCount = 15;
  static const int defaultExerciseCount = 10;
  static const int defaultFeynmanTopicCount = 4;

  // Get flashcard count
  static Future<int> getFlashcardCount() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_flashcardCountKey) ?? defaultFlashcardCount;
  }

  // Set flashcard count
  static Future<void> setFlashcardCount(int count) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_flashcardCountKey, count);
  }

  // Get quiz count
  static Future<int> getQuizCount() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_quizCountKey) ?? defaultQuizCount;
  }

  // Set quiz count
  static Future<void> setQuizCount(int count) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_quizCountKey, count);
  }

  // Get exercise count
  static Future<int> getExerciseCount() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_exerciseCountKey) ?? defaultExerciseCount;
  }

  // Set exercise count
  static Future<void> setExerciseCount(int count) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_exerciseCountKey, count);
  }

  // Get feynman topic count
  static Future<int> getFeynmanTopicCount() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_feynmanTopicCountKey) ?? defaultFeynmanTopicCount;
  }

  // Set feynman topic count
  static Future<void> setFeynmanTopicCount(int count) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_feynmanTopicCountKey, count);
  }

  // Get auto-generate setting
  static Future<bool> getAutoGenerate() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_autoGenerateKey) ?? true;
  }

  // Set auto-generate setting
  static Future<void> setAutoGenerate(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_autoGenerateKey, value);
  }

  // Get haptic feedback setting
  static Future<bool> getHapticFeedback() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_hapticFeedbackKey) ?? true;
  }

  // Set haptic feedback setting
  static Future<void> setHapticFeedback(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_hapticFeedbackKey, value);
  }

  // Get sound effects setting
  static Future<bool> getSoundEffects() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_soundEffectsKey) ?? true;
  }

  // Set sound effects setting
  static Future<void> setSoundEffects(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_soundEffectsKey, value);
  }

  // Clear all settings (reset to defaults)
  static Future<void> clearAllSettings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_flashcardCountKey);
    await prefs.remove(_quizCountKey);
    await prefs.remove(_exerciseCountKey);
    await prefs.remove(_feynmanTopicCountKey);
    await prefs.remove(_autoGenerateKey);
    await prefs.remove(_hapticFeedbackKey);
    await prefs.remove(_soundEffectsKey);
  }
}


