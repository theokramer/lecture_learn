import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/cupertino.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:superwallkit_flutter/superwallkit_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/onboarding_data.dart';
import '../services/onboarding_service.dart';
import '../widgets/onboarding/progress_bar.dart';
import '../widgets/onboarding/mascot_image.dart';
import '../constants/onboarding_colors.dart';

class OnboardingScreenNew extends ConsumerStatefulWidget {
  const OnboardingScreenNew({super.key});

  @override
  ConsumerState<OnboardingScreenNew> createState() => _OnboardingScreenNewState();
}

class _OnboardingScreenNewState extends ConsumerState<OnboardingScreenNew>
    with TickerProviderStateMixin {
  int _currentStep = 0;
  OnboardingData _onboardingData = OnboardingData();
  
  // Animation controllers
  late AnimationController _fadeController;
  late AnimationController _slideController;
  late AnimationController _scaleController;
  late AnimationController _chartController;
  late AnimationController _benefitController;
  
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _scaleAnimation;
  late Animation<double> _chartAnimation;
  late Animation<double> _benefitAnimation;
  
  // Total steps - streamlined flow
  static const int totalSteps = 12;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _slideController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _scaleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _chartController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _benefitController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );
    
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _fadeController, curve: Curves.easeOut),
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0.05, 0),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _slideController, curve: Curves.easeOut));
    
    _scaleAnimation = Tween<double>(begin: 0.96, end: 1.0).animate(
      CurvedAnimation(parent: _scaleController, curve: Curves.easeOut),
    );
    
    _chartAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _chartController, curve: Curves.easeOutCubic),
    );
    
    _benefitAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _benefitController, curve: Curves.easeOutCubic),
    );

    _fadeController.forward();
    _slideController.forward();
    _scaleController.forward();
    
    // Start chart animation if on benefit screen
    if (_isBenefitScreen(_currentStep)) {
      _chartController.forward();
      _benefitController.forward();
    }
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _slideController.dispose();
    _scaleController.dispose();
    _chartController.dispose();
    _benefitController.dispose();
    super.dispose();
  }
  
  bool _isBenefitScreen(int step) {
    return step == 2 || step == 5 || step == 8;
  }

  void _nextStep() {
    if (_currentStep < totalSteps - 1) {
      setState(() {
        _currentStep++;
      });
      _fadeController.reset();
      _slideController.reset();
      _scaleController.reset();
      _fadeController.forward();
      _slideController.forward();
      _scaleController.forward();
      
      // Start chart animations for benefit screens
      if (_isBenefitScreen(_currentStep)) {
        _chartController.reset();
        _benefitController.reset();
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) {
            _chartController.forward();
            _benefitController.forward();
          }
        });
      }
    } else {
      _completeOnboarding();
    }
  }

  void _previousStep() {
    if (_currentStep > 0) {
      setState(() {
        _currentStep--;
      });
      _fadeController.reset();
      _slideController.reset();
      _scaleController.reset();
      _fadeController.forward();
      _slideController.forward();
      _scaleController.forward();
      
      if (_isBenefitScreen(_currentStep)) {
        _chartController.reset();
        _benefitController.reset();
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) {
            _chartController.forward();
            _benefitController.forward();
          }
        });
      }
    }
  }

  Future<void> _completeOnboarding() async {
    try {
      _fadeController.stop();
      _slideController.stop();
      _scaleController.stop();
      _chartController.stop();
      _benefitController.stop();
      
      await OnboardingService.completeOnboarding(_onboardingData.toJson());
      
      if (mounted) {
        try {
          Superwall.shared.registerPlacement('campaign_trigger', feature: () {});
        } catch (e) {
          print('Error showing Superwall paywall: $e');
        }
      }
      
      if (mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            context.go('/login');
          }
        });
      }
    } catch (e) {
      print('Error completing onboarding: $e');
      if (mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            context.go('/login');
          }
        });
      }
    }
  }

  double get _progress => (_currentStep + 1) / totalSteps;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OnboardingColors.backgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            if (_currentStep > 0)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(
                  children: [
                    CupertinoButton(
                      padding: EdgeInsets.zero,
                      minSize: 0,
                      onPressed: _previousStep,
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: OnboardingColors.surfaceColor,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          CupertinoIcons.chevron_left,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: OnboardingProgressBar(progress: _progress, height: 10),
                    ),
                  ],
                ),
              )
            else
              const SizedBox(height: 12),
            
            Expanded(
              child: FadeTransition(
                opacity: _fadeAnimation,
                child: SlideTransition(
                  position: _slideAnimation,
                  child: ScaleTransition(
                    scale: _scaleAnimation,
                    child: _buildStepContent(),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStepContent() {
    switch (_currentStep) {
      case 0:
        return _buildWelcomeScreen();
      case 1:
        return _buildMultiSelectQuestionScreen(
          title: "What's holding you back?",
          subtitle: "We'll fix them all",
          options: [
            _Option("Wasting hours on note-taking", CupertinoIcons.clock),
            _Option("Feeling overwhelmed by material", CupertinoIcons.exclamationmark_triangle),
            _Option("Struggling to retain information", CupertinoIcons.circle_grid_3x3),
            _Option("Losing motivation to study", CupertinoIcons.square),
            _Option("Can't focus or concentrate", CupertinoIcons.eye_slash),
            _Option("Not knowing where to start", CupertinoIcons.question_circle),
          ],
          selectedIndices: _onboardingData.studyProblems?.map((p) {
            return ["Time wasted", "Overwhelming", "Poor retention", "Lack of motivation", "Can't focus", "Don't know where to start"].indexOf(p);
          }).where((i) => i >= 0).toList() ?? [],
          onSelectionChanged: (indices) {
            final problems = indices.map((i) => ["Time wasted", "Overwhelming", "Poor retention", "Lack of motivation", "Can't focus", "Don't know where to start"][i]).toList();
            _onboardingData = _onboardingData.copyWith(studyProblems: problems);
          },
        );
      case 2:
        return _buildTimeSavingsBenefitScreen();
      case 3:
        return _buildQuestionScreen(
          title: "What best describes you?",
          subtitle: "We're building something amazing just for you",
          options: [
            _Option("High School Student", CupertinoIcons.building_2_fill),
            _Option("College/University Student", CupertinoIcons.book),
            _Option("Grad Student", CupertinoIcons.person),
            _Option("Professional Certification", CupertinoIcons.star),
            _Option("Curious Learner", CupertinoIcons.lightbulb),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              studentStatus: ["High School", "College/University", "Grad School", "Certification", "Curious Learner"][index],
            );
          },
          selectedIndex: ["High School", "College/University", "Grad School", "Certification", "Curious Learner"]
              .indexWhere((e) => e == _onboardingData.studentStatus),
        );
      case 4:
        return _buildMultiSelectQuestionScreen(
          title: "How do you learn best?",
          subtitle: "We'll match your perfect learning style",
          options: [
            _Option("Simple, clear explanations", CupertinoIcons.square_grid_2x2),
            _Option("Practice questions & quizzes", CupertinoIcons.checkmark_circle),
            _Option("Step-by-step guidance", CupertinoIcons.person_2),
            _Option("Repetition & memorization", CupertinoIcons.arrow_clockwise),
            _Option("Fast & comprehensive", CupertinoIcons.bolt),
          ],
          selectedIndices: _onboardingData.learningStyles?.map((s) {
            return ["Simple breakdown", "Practice questions", "Guided walkthrough", "Repetition", "Speed and depth"].indexOf(s);
          }).where((i) => i >= 0).toList() ?? [],
          onSelectionChanged: (indices) {
            final styles = indices.map((i) => ["Simple breakdown", "Practice questions", "Guided walkthrough", "Repetition", "Speed and depth"][i]).toList();
            _onboardingData = _onboardingData.copyWith(learningStyles: styles);
          },
        );
      case 5:
        return _buildProductivityBenefitScreen();
      case 6:
        return _buildQuestionScreen(
          title: "What's your biggest academic goal?",
          subtitle: "This is how we'll help you crush it",
          options: [
            _Option("Ace all my courses", CupertinoIcons.star),
            _Option("Get into grad school or land my dream job", CupertinoIcons.briefcase),
            _Option("Maintain a perfect GPA", CupertinoIcons.chart_bar),
            _Option("Master a critical skill", CupertinoIcons.star),
            _Option("Pass my exams without stress", CupertinoIcons.checkmark_seal),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              academicGoal: ["Ace courses", "Grad school/Job", "High GPA", "Learn skill", "Pass exams"][index],
            );
          },
          selectedIndex: ["Ace courses", "Grad school/Job", "High GPA", "Learn skill", "Pass exams"]
              .indexWhere((e) => e == _onboardingData.academicGoal),
        );
      case 7:
        return _buildQuestionScreen(
          title: "How much time do you spend on prep work?",
          subtitle: "Note-taking, flashcards, organizing materials",
          options: [
            _Option("Less than 30 min/day", CupertinoIcons.clock),
            _Option("30-60 min/day", CupertinoIcons.timer),
            _Option("1-2 hours/day", CupertinoIcons.timer),
            _Option("2-3 hours/day", CupertinoIcons.timer),
            _Option("3+ hours/day", CupertinoIcons.timer),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              dailyTimeCommitment: [30, 60, 120, 180, 240][index],
            );
          },
          selectedIndex: [30, 60, 120, 180, 240].indexWhere((e) => e == _onboardingData.dailyTimeCommitment),
        );
      case 8:
        return _buildSuccessRateBenefitScreen();
      case 9:
        return _buildMultiSelectQuestionScreen(
          title: "What would you do with that time?",
          subtitle: "We'll help you get there",
          options: [
            _Option("Finally get enough sleep", CupertinoIcons.bed_double),
            _Option("Hang out with friends more", CupertinoIcons.person_2),
            _Option("Pursue a passion project", CupertinoIcons.rocket),
            _Option("Exercise and take care of myself", CupertinoIcons.heart),
            _Option("Work on other courses", CupertinoIcons.book),
            _Option("Just relax and recharge", CupertinoIcons.moon),
          ],
          selectedIndices: _onboardingData.extraTimeUsage?.map((u) {
            return ["Sleep", "Friends", "New project", "Exercise", "Other courses", "Relax"].indexOf(u);
          }).where((i) => i >= 0).toList() ?? [],
          onSelectionChanged: (indices) {
            final usages = indices.map((i) => ["Sleep", "Friends", "New project", "Exercise", "Other courses", "Relax"][i]).toList();
            _onboardingData = _onboardingData.copyWith(extraTimeUsage: usages);
          },
        );
      case 10:
        return _buildPersonalizedPlanScreen();
      case 11:
        return _buildNotificationScreen();
      default:
        return _buildWelcomeScreen();
    }
  }

  Widget _buildWelcomeScreen() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Spacer(flex: 2),
          Hero(
            tag: 'mascot',
            child: MascotImage(
              imagePath: "assets/mascot/ChatGPT Image Nov 10, 2025 at 03_54_21 PM.png",
              width: 350,
              height: 350,
            ),
          ),
          const Spacer(flex: 3),
          const Text(
            "Welcome to RocketLearn",
            style: TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.bold,
              color: Colors.white,
              letterSpacing: -0.8,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          const Text(
            "Your AI-powered study assistant",
            style: TextStyle(
              fontSize: 16,
              color: Colors.white,
              fontWeight: FontWeight.w400,
            ),
            textAlign: TextAlign.center,
          ),
          const Spacer(flex: 2),
          _LargeGradientButton(
            text: "Get Started",
            trailingIcon: CupertinoIcons.arrow_right,
            onPressed: _nextStep,
          ),
          const SizedBox(height: 20),
          Builder(
            builder: (context) {
              return Text.rich(
                TextSpan(
                  text: "By continuing, you agree to our ",
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF9CA3AF),
                    height: 1.4,
                  ),
                  children: [
                    TextSpan(
                      text: 'Terms of Service',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFFB85A3A),
                        decoration: TextDecoration.underline,
                        height: 1.4,
                      ),
                      recognizer: TapGestureRecognizer()
                        ..onTap = () async {
                          final url = Uri.parse('https://sites.google.com/view/rocket-learn/terms-of-service');
                          if (await canLaunchUrl(url)) {
                            await launchUrl(url, mode: LaunchMode.externalApplication);
                          }
                        },
                    ),
                    const TextSpan(
                      text: "\nand ",
                      style: TextStyle(
                        fontSize: 11,
                        color: Color(0xFF9CA3AF),
                        height: 1.4,
                      ),
                    ),
                    TextSpan(
                      text: 'Privacy Policy',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFFB85A3A),
                        decoration: TextDecoration.underline,
                        height: 1.4,
                      ),
                      recognizer: TapGestureRecognizer()
                        ..onTap = () async {
                          final url = Uri.parse('https://sites.google.com/view/rocket-learn/privacy-policy');
                          if (await canLaunchUrl(url)) {
                            await launchUrl(url, mode: LaunchMode.externalApplication);
                          }
                        },
                    ),
                    const TextSpan(
                      text: ".",
                      style: TextStyle(
                        fontSize: 11,
                        color: Color(0xFF9CA3AF),
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
                textAlign: TextAlign.center,
              );
            },
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildQuestionScreen({
    required String title,
    required String subtitle,
    required List<_Option> options,
    required Function(int) onSelect,
    int? selectedIndex,
  }) {
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 32),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    height: 1.3,
                    letterSpacing: -0.6,
                  ),
                  textAlign: TextAlign.left,
                ),
                const SizedBox(height: 16),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white.withOpacity(0.75),
                    fontWeight: FontWeight.w400,
                    height: 1.5,
                    letterSpacing: -0.2,
                  ),
                  textAlign: TextAlign.left,
                ),
                const SizedBox(height: 40),
                ...options.asMap().entries.map((entry) {
                  final index = entry.key;
                  final option = entry.value;
                  return Padding(
                    padding: EdgeInsets.only(bottom: index < options.length - 1 ? 14 : 0),
                    child: _EnhancedOptionButton(
                      text: option.text,
                      icon: option.icon,
                      isSelected: selectedIndex == index,
                      onTap: () {
                        onSelect(index);
                        setState(() {});
                      },
                    ),
                  );
                }),
                const SizedBox(height: 100),
              ],
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          decoration: BoxDecoration(
            color: OnboardingColors.backgroundColor,
            border: Border(
              top: BorderSide(
                color: OnboardingColors.borderColor,
                width: 1,
              ),
            ),
          ),
          child: _LargeGradientButton(
            text: "Continue",
            trailingIcon: CupertinoIcons.arrow_right,
            onPressed: (selectedIndex != null && selectedIndex >= 0) ? _nextStep : null,
          ),
        ),
      ],
    );
  }

  Widget _buildMultiSelectQuestionScreen({
    required String title,
    required String subtitle,
    required List<_Option> options,
    required List<int> selectedIndices,
    required Function(List<int>) onSelectionChanged,
  }) {
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 32),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    height: 1.3,
                    letterSpacing: -0.6,
                  ),
                  textAlign: TextAlign.left,
                ),
                const SizedBox(height: 16),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white.withOpacity(0.75),
                    fontWeight: FontWeight.w400,
                    height: 1.5,
                    letterSpacing: -0.2,
                  ),
                  textAlign: TextAlign.left,
                ),
                const SizedBox(height: 40),
                ...options.asMap().entries.map((entry) {
                  final index = entry.key;
                  final option = entry.value;
                  final isSelected = selectedIndices.contains(index);
                  return Padding(
                    padding: EdgeInsets.only(bottom: index < options.length - 1 ? 14 : 0),
                    child: _EnhancedOptionButton(
                      text: option.text,
                      icon: option.icon,
                      isSelected: isSelected,
                      onTap: () {
                        final newSelection = List<int>.from(selectedIndices);
                        if (isSelected) {
                          newSelection.remove(index);
                        } else {
                          newSelection.add(index);
                        }
                        onSelectionChanged(newSelection);
                        setState(() {});
                      },
                    ),
                  );
                }),
                const SizedBox(height: 100),
              ],
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          decoration: BoxDecoration(
            color: OnboardingColors.backgroundColor,
            border: Border(
              top: BorderSide(
                color: OnboardingColors.borderColor,
                width: 1,
              ),
            ),
          ),
          child: _LargeGradientButton(
            text: "Continue",
            trailingIcon: CupertinoIcons.arrow_right,
            onPressed: selectedIndices.isNotEmpty ? _nextStep : null,
          ),
        ),
      ],
    );
  }

  Widget _buildTimeSavingsBenefitScreen() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Spacer(),
          // Animated chart showing time savings
          AnimatedBuilder(
            animation: _chartAnimation,
            builder: (context, child) {
              return Container(
                height: 300,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: OnboardingColors.surfaceColor,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: OnboardingColors.borderColor,
                    width: 1.5,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      "Time Saved Per Week",
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Expanded(
                      child: BarChart(
                        BarChartData(
                          alignment: BarChartAlignment.spaceAround,
                          maxY: 20,
                          barTouchData: BarTouchData(enabled: false),
                          titlesData: FlTitlesData(
                            show: true,
                            bottomTitles: AxisTitles(
                              sideTitles: SideTitles(
                                showTitles: true,
                                getTitlesWidget: (value, meta) {
                                  const labels = ['Before', 'After'];
                                  if (value.toInt() >= 0 && value.toInt() < labels.length) {
                                    return Padding(
                                      padding: const EdgeInsets.only(top: 8),
                                      child: Text(
                                        labels[value.toInt()],
                                        style: const TextStyle(
                                          color: Color(0xFF9CA3AF),
                                          fontSize: 12,
                                        ),
                                      ),
                                    );
                                  }
                                  return const Text('');
                                },
                                reservedSize: 30,
                              ),
                            ),
                            leftTitles: AxisTitles(
                              sideTitles: SideTitles(
                                showTitles: true,
                                reservedSize: 40,
                                getTitlesWidget: (value, meta) {
                                  return Text(
                                    '${value.toInt()}h',
                                    style: const TextStyle(
                                      color: Color(0xFF9CA3AF),
                                      fontSize: 12,
                                    ),
                                  );
                                },
                              ),
                            ),
                            topTitles: const AxisTitles(
                              sideTitles: SideTitles(showTitles: false),
                            ),
                            rightTitles: const AxisTitles(
                              sideTitles: SideTitles(showTitles: false),
                            ),
                          ),
                          gridData: FlGridData(
                            show: true,
                            drawVerticalLine: false,
                            horizontalInterval: 5,
                            getDrawingHorizontalLine: (value) {
                              return FlLine(
                                color: OnboardingColors.borderColor,
                                strokeWidth: 1,
                              );
                            },
                          ),
                          borderData: FlBorderData(show: false),
                          barGroups: [
                            BarChartGroupData(
                              x: 0,
                              barRods: [
                                BarChartRodData(
                                  toY: 15 * _chartAnimation.value,
                                  gradient: LinearGradient(
                                    colors: [
                                      OnboardingColors.borderColor,
                                      OnboardingColors.borderColor.withOpacity(0.5),
                                    ],
                                  ),
                                  width: 40,
                                  borderRadius: const BorderRadius.vertical(
                                    top: Radius.circular(8),
                                  ),
                                ),
                              ],
                            ),
                            BarChartGroupData(
                              x: 1,
                              barRods: [
                                BarChartRodData(
                                  toY: 2 * _chartAnimation.value,
                                  gradient: LinearGradient(
                                    colors: OnboardingColors.optionButtonGradientColors,
                                  ),
                                  width: 40,
                                  borderRadius: const BorderRadius.vertical(
                                    top: Radius.circular(8),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Row(
                      children: [
                        Container(
                          width: 12,
                          height: 12,
                          decoration: BoxDecoration(
                            color: OnboardingColors.borderColor,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          "Traditional Study",
                          style: TextStyle(
                            color: Color(0xFF9CA3AF),
                            fontSize: 14,
                          ),
                        ),
                        const Spacer(),
                        Container(
                          width: 12,
                          height: 12,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: OnboardingColors.optionButtonGradientColors,
                            ),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          "With RocketLearn",
                          style: TextStyle(
                            color: Color(0xFF9CA3AF),
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 48),
          FadeTransition(
            opacity: _benefitAnimation,
            child: Column(
              children: [
                const Text(
                  "Save 13+ Hours Per Week",
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    letterSpacing: -0.8,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                Text(
                  "That's ${(13 * 52 / 365).toStringAsFixed(1)} extra days per year to focus on what matters",
                  style: const TextStyle(
                    fontSize: 15,
                    color: Colors.white70,
                    height: 1.6,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          const Spacer(),
          _LargeGradientButton(
            text: "Continue",
            trailingIcon: CupertinoIcons.arrow_right,
            onPressed: _nextStep,
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildProductivityBenefitScreen() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Spacer(),
          AnimatedBuilder(
            animation: _chartAnimation,
            builder: (context, child) {
              return Container(
                height: 300,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: OnboardingColors.surfaceColor,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: OnboardingColors.borderColor,
                    width: 1.5,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      "Study Efficiency Improvement",
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Expanded(
                      child: LineChart(
                        LineChartData(
                          gridData: FlGridData(
                            show: true,
                            drawVerticalLine: false,
                            horizontalInterval: 20,
                            getDrawingHorizontalLine: (value) {
                              return FlLine(
                                color: OnboardingColors.borderColor,
                                strokeWidth: 1,
                              );
                            },
                          ),
                          titlesData: FlTitlesData(
                            show: true,
                            bottomTitles: AxisTitles(
                              sideTitles: SideTitles(
                                showTitles: true,
                                getTitlesWidget: (value, meta) {
                                  const labels = ['W1', 'W2', 'W3', 'W4'];
                                  if (value.toInt() >= 1 && value.toInt() <= 4) {
                                    return Padding(
                                      padding: const EdgeInsets.only(top: 12),
                                      child: Text(
                                        labels[value.toInt() - 1],
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                    );
                                  }
                                  return const Text('');
                                },
                                reservedSize: 40,
                              ),
                            ),
                            leftTitles: AxisTitles(
                              sideTitles: SideTitles(
                                showTitles: true,
                                reservedSize: 40,
                                getTitlesWidget: (value, meta) {
                                  return Text(
                                    '${value.toInt()}%',
                                    style: const TextStyle(
                                      color: Color(0xFF9CA3AF),
                                      fontSize: 12,
                                    ),
                                  );
                                },
                              ),
                            ),
                            topTitles: const AxisTitles(
                              sideTitles: SideTitles(showTitles: false),
                            ),
                            rightTitles: const AxisTitles(
                              sideTitles: SideTitles(showTitles: false),
                            ),
                          ),
                          borderData: FlBorderData(show: false),
                          lineBarsData: [
                            LineChartBarData(
                              spots: [
                                FlSpot(1, 30 * _chartAnimation.value),
                                FlSpot(2, 55 * _chartAnimation.value),
                                FlSpot(3, 75 * _chartAnimation.value),
                                FlSpot(4, 90 * _chartAnimation.value),
                              ],
                              isCurved: true,
                              gradient: LinearGradient(
                                colors: OnboardingColors.optionButtonGradientColors,
                              ),
                              barWidth: 4,
                              isStrokeCapRound: true,
                              dotData: FlDotData(
                                show: true,
                                getDotPainter: (spot, percent, barData, index) {
                                  return FlDotCirclePainter(
                                    radius: 6,
                                    color: OnboardingColors.optionButtonGradientColors.first,
                                    strokeWidth: 2,
                                    strokeColor: Colors.white,
                                  );
                                },
                              ),
                              belowBarData: BarAreaData(
                                show: true,
                                gradient: LinearGradient(
                                  colors: OnboardingColors.optionButtonGradientColors
                                      .map((c) => c.withOpacity(0.2))
                                      .toList(),
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 48),
          FadeTransition(
            opacity: _benefitAnimation,
            child: Column(
              children: [
                const Text(
                  "3x More Productive\nin Just 4 Weeks",
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    letterSpacing: -0.8,
                    height: 1.2,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                const Text(
                  "Students see dramatic improvements in retention and exam scores",
                  style: TextStyle(
                    fontSize: 15,
                    color: Colors.white70,
                    height: 1.6,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          const Spacer(),
          _LargeGradientButton(
            text: "Continue",
            trailingIcon: CupertinoIcons.arrow_right,
            onPressed: _nextStep,
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildSuccessRateBenefitScreen() {
    final prepTime = _onboardingData.dailyTimeCommitment ?? 120;
    final hoursSaved = (prepTime / 60) * 7; // Per week
    
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Spacer(),
          AnimatedBuilder(
            animation: _chartAnimation,
            builder: (context, child) {
              return Container(
                height: 300,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: OnboardingColors.surfaceColor,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: OnboardingColors.borderColor,
                    width: 1.5,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      "Success Rate Comparison",
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Expanded(
                      child: PieChart(
                        PieChartData(
                          sectionsSpace: 4,
                          centerSpaceRadius: 60,
                          sections: [
                            PieChartSectionData(
                              value: 35 * _chartAnimation.value,
                              title: '35%',
                              color: OnboardingColors.borderColor,
                              radius: 80,
                              titleStyle: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                            PieChartSectionData(
                              value: 65 * _chartAnimation.value,
                              title: '65%',
                              color: OnboardingColors.optionButtonGradientColors.first,
                              radius: 90,
                              titleStyle: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Column(
                          children: [
                            Container(
                              width: 16,
                              height: 16,
                              decoration: BoxDecoration(
                                color: OnboardingColors.borderColor,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              "Without AI",
                              style: TextStyle(
                                color: Color(0xFF9CA3AF),
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              "35%",
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(width: 48),
                        Column(
                          children: [
                            Container(
                              width: 16,
                              height: 16,
                              decoration: BoxDecoration(
                                color: OnboardingColors.optionButtonGradientColors.first,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              "With RocketLearn",
                              style: TextStyle(
                                color: Color(0xFF9CA3AF),
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              "65%",
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 48),
          FadeTransition(
            opacity: _benefitAnimation,
            child: Column(
              children: [
                Text(
                  "Save ${hoursSaved.toStringAsFixed(1)} Hours Per Week",
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    letterSpacing: -0.8,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                const Text(
                  "Students using RocketLearn see 65% higher success rates",
                  style: TextStyle(
                    fontSize: 15,
                    color: Colors.white70,
                    height: 1.6,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          const Spacer(),
          _LargeGradientButton(
            text: "Continue",
            trailingIcon: CupertinoIcons.arrow_right,
            onPressed: _nextStep,
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _buildPersonalizedPlanScreen() {
    return _PersonalizedPlanBuilder(
      onComplete: _nextStep,
    );
  }

  Widget _buildNotificationScreen() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Spacer(),
          const Text(
            "Reach Your Goals\nwith Notifications",
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Colors.white,
              height: 1.2,
              letterSpacing: -0.8,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 48),
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: OnboardingColors.surfaceColor,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: OnboardingColors.borderColor,
                width: 1.5,
              ),
            ),
            child: Column(
              children: [
                const Text(
                  "RocketLearn would like to send you notifications",
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white,
                    fontWeight: FontWeight.w500,
                    height: 1.4,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: _SecondaryButton(
                        text: "Don't Allow",
                        onPressed: () => _showNotificationDialog(false),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Container(
                        height: 52,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: OnboardingColors.optionButtonGradientColors,
                          ),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: CupertinoButton(
                          padding: EdgeInsets.zero,
                          onPressed: () {
                            HapticFeedback.mediumImpact();
                            _showNotificationDialog(true);
                          },
                          child: const Text(
                            "Allow",
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 17,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          Icon(
            CupertinoIcons.arrow_up,
            color: OnboardingColors.buttonGradientColors.first,
            size: 48,
          ),
          const Spacer(),
          _LargeGradientButton(
            text: "Continue",
            trailingIcon: CupertinoIcons.arrow_right,
            onPressed: () => _showNotificationDialog(null),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Future<void> _showNotificationDialog(bool? allowNotifications) async {
    if (allowNotifications == true) {
      final status = await Permission.notification.request();
      if (status.isGranted) {
        HapticFeedback.mediumImpact();
      }
    } else if (allowNotifications == false) {
      HapticFeedback.lightImpact();
    } else {
      if (mounted) {
        await showCupertinoDialog(
          context: context,
          builder: (context) => CupertinoAlertDialog(
            title: const Text('Notifications'),
            content: const Text('You can manage notification settings anytime in your device Settings.'),
            actions: [
              CupertinoDialogAction(
                isDefaultAction: true,
                onPressed: () {
                  Navigator.of(context).pop();
                },
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
      HapticFeedback.mediumImpact();
    }

    if (allowNotifications != null && mounted) {
      await showCupertinoDialog(
        context: context,
        builder: (context) => CupertinoAlertDialog(
          title: const Text('Notifications'),
          content: Text(
            allowNotifications == true
                ? 'Notifications enabled! You\'ll receive updates about your learning progress.'
                : 'Notifications disabled. You can enable them later in Settings.',
          ),
          actions: [
            CupertinoDialogAction(
              isDefaultAction: true,
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: const Text('OK'),
            ),
          ],
        ),
      );
    }
    
    if (mounted) {
      await Future.delayed(const Duration(milliseconds: 200));
      if (mounted) {
        _nextStep();
      }
    }
  }
}

class _Option {
  final String text;
  final IconData? icon;
  final String? number;

  _Option(this.text, this.icon, {this.number});
}

class _EnhancedOptionButton extends StatefulWidget {
  final String text;
  final IconData? icon;
  final String? number;
  final bool isSelected;
  final VoidCallback onTap;

  const _EnhancedOptionButton({
    required this.text,
    this.icon,
    this.number,
    required this.isSelected,
    required this.onTap,
  });

  @override
  State<_EnhancedOptionButton> createState() => _EnhancedOptionButtonState();
}

class _EnhancedOptionButtonState extends State<_EnhancedOptionButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _pressController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _pressController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.92).animate(
      CurvedAnimation(parent: _pressController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pressController.dispose();
    super.dispose();
  }

  void _handleTapDown(TapDownDetails details) {
    _pressController.forward();
  }

  void _handleTapUp(TapUpDetails details) {
    _pressController.reverse();
    HapticFeedback.lightImpact();
    widget.onTap();
  }

  void _handleTapCancel() {
    _pressController.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: _handleTapDown,
      onTapUp: _handleTapUp,
      onTapCancel: _handleTapCancel,
      child: ScaleTransition(
        scale: _scaleAnimation,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
          decoration: BoxDecoration(
            gradient: widget.isSelected
                ? LinearGradient(
                    colors: OnboardingColors.optionButtonGradientColors,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                : null,
            color: widget.isSelected ? null : OnboardingColors.surfaceColor,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: widget.isSelected
                  ? OnboardingColors.optionButtonGradientColors.first.withOpacity(0.6)
                  : OnboardingColors.borderColor,
              width: widget.isSelected ? 2 : 1.5,
            ),
            boxShadow: widget.isSelected
                ? [
                    BoxShadow(
                      color: OnboardingColors.optionButtonGradientColors.first.withOpacity(0.5),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                      spreadRadius: 0,
                    ),
                  ]
                : [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.3),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
          ),
          child: Row(
            children: [
              if (widget.number != null)
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: widget.isSelected
                        ? Colors.white.withOpacity(0.25)
                        : OnboardingColors.borderColor,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Text(
                      widget.number!,
                      style: TextStyle(
                        color: widget.isSelected ? Colors.white : OnboardingColors.secondaryTextColor,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                )
              else if (widget.icon != null)
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: widget.isSelected
                        ? Colors.white.withOpacity(0.25)
                        : OnboardingColors.borderColor,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    widget.icon,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
              if (widget.icon != null || widget.number != null) const SizedBox(width: 16),
              Expanded(
                child: Text(
                  widget.text,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w500,
                    height: 1.3,
                  ),
                ),
              ),
              if (widget.isSelected)
                Container(
                  width: 28,
                  height: 28,
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    CupertinoIcons.checkmark,
                    color: OnboardingColors.checkmarkColor,
                    size: 18,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LargeGradientButton extends StatefulWidget {
  final String text;
  final VoidCallback? onPressed;
  final IconData? trailingIcon;

  const _LargeGradientButton({
    required this.text,
    this.onPressed,
    this.trailingIcon,
  });

  @override
  State<_LargeGradientButton> createState() => _LargeGradientButtonState();
}

class _LargeGradientButtonState extends State<_LargeGradientButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _pressController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _pressController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.94).animate(
      CurvedAnimation(parent: _pressController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pressController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isEnabled = widget.onPressed != null;
    return AbsorbPointer(
      absorbing: !isEnabled,
      child: GestureDetector(
        onTapDown: isEnabled ? (_) => _pressController.forward() : null,
        onTapUp: isEnabled
            ? (_) {
                _pressController.reverse();
                HapticFeedback.lightImpact();
                widget.onPressed!();
              }
            : null,
        onTapCancel: isEnabled ? () => _pressController.reverse() : null,
        child: ScaleTransition(
          scale: _scaleAnimation,
          child: Container(
            width: double.infinity,
            height: 72,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              gradient: isEnabled
                  ? LinearGradient(
                      colors: OnboardingColors.buttonGradientColors,
                      begin: Alignment.centerLeft,
                      end: Alignment.centerRight,
                    )
                  : null,
              color: isEnabled ? null : OnboardingColors.surfaceColor,
              boxShadow: isEnabled
                  ? [
                      BoxShadow(
                        color: OnboardingColors.buttonGradientColors.first.withOpacity(0.4),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                        spreadRadius: 0,
                      ),
                    ]
                  : null,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  widget.text,
                  style: TextStyle(
                    color: isEnabled ? Colors.black : OnboardingColors.disabledTextColor,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
                if (widget.trailingIcon != null && isEnabled) ...[
                  const SizedBox(width: 12),
                  Icon(
                    widget.trailingIcon,
                    color: Colors.black,
                    size: 24,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SecondaryButton extends StatelessWidget {
  final String text;
  final VoidCallback onPressed;

  const _SecondaryButton({
    required this.text,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: const Color(0xFF2A2A2A),
          width: 1.5,
        ),
      ),
      child: CupertinoButton(
        padding: EdgeInsets.zero,
        onPressed: () {
          HapticFeedback.lightImpact();
          onPressed();
        },
        child: Text(
          text,
          style: const TextStyle(
            color: Color(0xFF9CA3AF),
            fontSize: 17,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _PersonalizedPlanBuilder extends StatefulWidget {
  final VoidCallback onComplete;

  const _PersonalizedPlanBuilder({required this.onComplete});

  @override
  State<_PersonalizedPlanBuilder> createState() => _PersonalizedPlanBuilderState();
}

class _PersonalizedPlanBuilderState extends State<_PersonalizedPlanBuilder>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  int _completedItems = 0;
  double _progress = 0.0;
  
  final List<String> _planItems = [
    "AI-Powered Summaries",
    "24/7 AI Tutor Chat",
    "Smart Flashcards",
    "Interactive Quizzes",
    "Practice Exercises",
    "Feynman Method",
    "Document Management",
    "Progress Tracking",
  ];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    );

    _controller.addListener(() {
      setState(() {
        _progress = _controller.value;
        int targetItems = (_controller.value * _planItems.length).floor();
        if (targetItems > _completedItems && targetItems <= _planItems.length) {
          _completedItems = targetItems;
        }
      });
    });

    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Spacer(),
          Text(
            "${(_progress * 100).toInt()}%",
            style: const TextStyle(
              fontSize: 72,
              fontWeight: FontWeight.bold,
              color: Colors.white,
              letterSpacing: -1.5,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            "Creating Your Personalized Plan",
            style: TextStyle(
              fontSize: 20,
              color: Colors.white,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 24),
          OnboardingProgressBar(progress: _progress, height: 10),
          const SizedBox(height: 16),
          Text(
            _progress < 0.3
                ? "Analyzing your learning style..."
                : _progress < 0.6
                    ? "Customizing study features..."
                    : _progress < 0.9
                        ? "Optimizing your plan..."
                        : "Almost ready!",
            style: const TextStyle(
              fontSize: 17,
              color: Color(0xFF9CA3AF),
            ),
          ),
          const SizedBox(height: 48),
          Container(
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  OnboardingColors.surfaceColor,
                  OnboardingColors.surfaceColor.withOpacity(0.8),
                ],
              ),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(
                color: OnboardingColors.optionButtonGradientColors.first.withOpacity(0.3),
                width: 2,
              ),
              boxShadow: [
                BoxShadow(
                  color: OnboardingColors.optionButtonGradientColors.first.withOpacity(0.2),
                  blurRadius: 30,
                  offset: const Offset(0, 15),
                  spreadRadius: 0,
                ),
                BoxShadow(
                  color: Colors.black.withOpacity(0.3),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: OnboardingColors.optionButtonGradientColors,
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(
                        CupertinoIcons.sparkles,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 16),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "Your Personalized Plan",
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              letterSpacing: -0.5,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            "Tailored just for you",
                            style: TextStyle(
                              fontSize: 14,
                              color: Color(0xFF9CA3AF),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 32),
                ...List.generate(_planItems.length, (index) {
                  return Padding(
                    padding: EdgeInsets.only(bottom: index < _planItems.length - 1 ? 18 : 0),
                    child: _buildPlanItem(_planItems[index], _completedItems > index),
                  );
                }),
              ],
            ),
          ),
          const Spacer(),
          _LargeGradientButton(
            text: "Continue",
            trailingIcon: CupertinoIcons.arrow_right,
            onPressed: widget.onComplete,
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildPlanItem(String text, bool isCompleted) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOutCubic,
      child: Row(
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 400),
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              gradient: isCompleted
                  ? LinearGradient(
                      colors: OnboardingColors.optionButtonGradientColors,
                    )
                  : null,
              color: isCompleted ? null : Colors.transparent,
              border: Border.all(
                color: isCompleted
                    ? Colors.transparent
                    : OnboardingColors.borderColor,
                width: 2,
              ),
              borderRadius: BorderRadius.circular(10),
              boxShadow: isCompleted
                  ? [
                      BoxShadow(
                        color: OnboardingColors.optionButtonGradientColors.first.withOpacity(0.4),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ]
                  : null,
            ),
            child: isCompleted
                ? const Icon(
                    CupertinoIcons.checkmark,
                    color: Colors.white,
                    size: 20,
                  )
                : null,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 17,
                color: isCompleted ? Colors.white : const Color(0xFF9CA3AF),
                fontWeight: isCompleted ? FontWeight.w600 : FontWeight.w500,
                letterSpacing: -0.2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

