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
  // Rich 3-color gradient with darker cyan/teal theme
  static const List<Color> buttonGradientColors = [
    Color(0xFF0891B2), // Darker cyan
    Color(0xFF0E7490), // Even darker cyan
    Color(0xFF155E75), // Darkest cyan
  ];
  
  // Option button gradient colors (when selected)
  // Distinct emerald/green gradient for answer buttons
  static const List<Color> optionButtonGradientColors = [
    Color(0xFF10B981), // Emerald
    Color(0xFF059669), // Darker emerald
  ];
  
  // Progress bar gradient colors
  // Subtle 2-color gradient matching continue button
  static const List<Color> progressBarGradientColors = [
    Color(0xFF6366F1), // Indigo
    Color(0xFF818CF8), // Lighter indigo
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
  static const Color checkmarkColor = Color(0xFF10B981); // Emerald to match option buttons
}

