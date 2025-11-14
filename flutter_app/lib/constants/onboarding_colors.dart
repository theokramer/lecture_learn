/// Onboarding Color Constants
/// 
/// TO CHANGE COLORS QUICKLY:
/// 1. Background color: Change `backgroundColor` below
/// 2. Button gradient: Change `buttonGradientColors` list below
/// 3. Option button gradient: Change `optionButtonGradientColors` list below
/// 4. Progress bar gradient: Change `progressBarGradientColors` list below
/// 
/// All colors are defined here for easy customization!

import 'package:flutter/material.dart';

class OnboardingColors {
  // Background color
  static const Color backgroundColor = Color(0xFF000000); // Pure black
  
  // Button gradient colors (Continue button, Get Started, etc.)
  // Vibrant teal to darker blue-green gradient (matching the image)
  static const List<Color> buttonGradientColors = [
        Color(0xFFffb000), // Purple
    Color(0xFFE85E5A), // Darker purple

  ];
  
  // Option button gradient colors (when selected)
  // Colorful but subtle purple gradient for answer buttons
  static const List<Color> optionButtonGradientColors = [
    Color(0xFFbc003b), // Vibrant teal
    Color.fromARGB(255, 148, 0, 47), // Darker blue-green
  ];
  
  // Progress bar gradient colors
  // Matching the continue button teal/blue-green gradient
  static const List<Color> progressBarGradientColors = [
        Color(0xFFffb000), // Purple
    Color(0xFFff7500), // Darker purple
  ];
  
  // Notification button gradient
  static const List<Color> notificationButtonGradientColors = [
    Color(0xFF6366F1), // Indigo
    Color(0xFF8B5CF6), // Purple
  ];
  
  // Text colors
  static const Color primaryTextColor = Colors.white;
  static const Color secondaryTextColor = Colors.white70;
  static const Color disabledTextColor = Color(0xFF6B7280);
  
  // Surface colors
  static const Color surfaceColor = Color(0xFF1A1A1A);
  static const Color borderColor = Color(0xFF2A2A2A);
  
  // Checkmark color in option buttons
  static const Color checkmarkColor = Color(0xFF8B5CF6); // Purple to match option buttons
}

