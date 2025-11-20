import 'package:flutter/cupertino.dart';
import '../models/study_content.dart';

class StudyModeColors {
  static Color getColor(StudyMode mode) {
    // All study modes use white as primary color
    return const Color(0xFF8D1647);
  }

  static List<Color> getGradientColors(StudyMode mode) {
    // All study modes use white gradient
    return [const Color(0xFFFFFFFF), const Color(0xFFE5E5E5)];
  }
}

