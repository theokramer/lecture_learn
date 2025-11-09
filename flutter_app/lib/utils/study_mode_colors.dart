import 'package:flutter/cupertino.dart';
import '../models/study_content.dart';

class StudyModeColors {
  static Color getColor(StudyMode mode) {
    switch (mode) {
      case StudyMode.summary:
        return const Color(0xFF3B82F6);
      case StudyMode.aiChat:
        return const Color(0xFF06B6D4);
      case StudyMode.flashcards:
        return const Color(0xFF10B981);
      case StudyMode.quiz:
        return const Color(0xFF8B5CF6);
      case StudyMode.exercises:
        return const Color(0xFFEF4444);
      case StudyMode.feynman:
        return const Color(0xFFF59E0B);
      case StudyMode.documents:
        return const Color(0xFF6366F1);
    }
  }

  static List<Color> getGradientColors(StudyMode mode) {
    switch (mode) {
      case StudyMode.summary:
        return [const Color(0xFF3B82F6), const Color(0xFF60A5FA)];
      case StudyMode.aiChat:
        return [const Color(0xFF06B6D4), const Color(0xFF0891B2)];
      case StudyMode.flashcards:
        return [const Color(0xFF10B981), const Color(0xFF34D399)];
      case StudyMode.quiz:
        return [const Color(0xFF8B5CF6), const Color(0xFFA78BFA)];
      case StudyMode.exercises:
        return [const Color(0xFFEF4444), const Color(0xFFF87171)];
      case StudyMode.feynman:
        return [const Color(0xFFF59E0B), const Color(0xFFFBBF24)];
      case StudyMode.documents:
        return [const Color(0xFF6366F1), const Color(0xFF818CF8)];
    }
  }
}

