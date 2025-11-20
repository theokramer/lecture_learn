import 'dart:async';
import 'package:flutter/cupertino.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:superwallkit_flutter/superwallkit_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/onboarding_data.dart';
import '../services/onboarding_service.dart';
import '../widgets/onboarding/progress_bar.dart';
import '../widgets/onboarding/mascot_image.dart';
import '../constants/onboarding_colors.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen>
    with TickerProviderStateMixin {
  int _currentStep = 0;
  OnboardingData _onboardingData = OnboardingData();
  
  late AnimationController _fadeController;
  late AnimationController _slideController;
  late AnimationController _scaleController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _scaleAnimation;
  
  // Animation controllers for transition screen text
  late AnimationController _transitionTitleController;
  late AnimationController _transitionDescriptionController;
  late Animation<double> _transitionTitleAnimation;
  late Animation<Offset> _transitionTitleSlideAnimation;
  late Animation<double> _transitionDescriptionAnimation;
  late Animation<Offset> _transitionDescriptionSlideAnimation;
  
  // Timer for transition screen button delay
  bool _transitionButtonEnabled = false;
  Timer? _transitionTimer;

  // Total number of steps - reorganized flow with transitions every 4-6 questions
  static const int totalSteps = 17;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _slideController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _scaleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    
    // Transition screen text animations
    _transitionTitleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _transitionDescriptionController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
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
    
    // Transition text animations
    _transitionTitleAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _transitionTitleController, curve: Curves.easeOut),
    );
    _transitionTitleSlideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _transitionTitleController, curve: Curves.easeOut));
    
    _transitionDescriptionAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _transitionDescriptionController, curve: Curves.easeOut),
    );
    _transitionDescriptionSlideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _transitionDescriptionController, curve: Curves.easeOut));

    _fadeController.forward();
    _slideController.forward();
    _scaleController.forward();
    
    // Initialize transition animations if starting on a transition screen
    _checkAndStartTransitionAnimations();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _slideController.dispose();
    _scaleController.dispose();
    _transitionTitleController.dispose();
    _transitionDescriptionController.dispose();
    _transitionTimer?.cancel();
    super.dispose();
  }
  
  bool _isTransitionScreen(int step) {
    return step == 4 || step == 6 || step == 13;
  }
  
  void _checkAndStartTransitionAnimations() {
    if (_isTransitionScreen(_currentStep)) {
      _transitionButtonEnabled = false;
      _transitionTitleController.reset();
      _transitionDescriptionController.reset();
      
      // Start text animations with slight delay
      Future.delayed(const Duration(milliseconds: 200), () {
        if (mounted) {
          _transitionTitleController.forward();
        }
      });
      Future.delayed(const Duration(milliseconds: 400), () {
        if (mounted) {
          _transitionDescriptionController.forward();
        }
      });
      
      // Enable button after 1 second
      _transitionTimer?.cancel();
      _transitionTimer = Timer(const Duration(seconds: 1), () {
        if (mounted) {
          setState(() {
            _transitionButtonEnabled = true;
          });
        }
      });
    } else {
      _transitionButtonEnabled = true;
      _transitionTimer?.cancel();
      // Ensure controllers are in a valid state for non-transition screens
      // Set them to their final state so they don't cause issues if accidentally used
      if (!_transitionTitleController.isCompleted) {
        _transitionTitleController.value = 1.0;
      }
      if (!_transitionDescriptionController.isCompleted) {
        _transitionDescriptionController.value = 1.0;
      }
    }
  }

  void _nextStep() {
    try {
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
        _checkAndStartTransitionAnimations();
      } else {
        _completeOnboarding();
      }
    } catch (e) {
      // Handle any errors during step transition
      print('Error in _nextStep: $e');
      // Still try to complete onboarding if we're at the last step
      if (_currentStep >= totalSteps - 1) {
        _completeOnboarding();
      }
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
      _checkAndStartTransitionAnimations();
    }
  }

  Future<void> _completeOnboarding() async {
    try {
      // Stop all animations before navigating
      _fadeController.stop();
      _slideController.stop();
      _scaleController.stop();
      _transitionTitleController.stop();
      _transitionDescriptionController.stop();
      _transitionTimer?.cancel();
      
      await OnboardingService.completeOnboarding(_onboardingData.toJson());
      
      // Show Superwall paywall before navigating to login
      if (mounted) {
        try {
          Superwall.shared.registerPlacement('campaign_trigger', feature: () {
            // User has access to premium features after subscribing
            // This callback is executed if the user subscribes
          });
        } catch (e) {
          print('Error showing Superwall paywall: $e');
          // Continue to login even if paywall fails
        }
      }
      
      // Navigate to login after paywall is dismissed
      if (mounted) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            context.go('/login');
          }
        });
      }
    } catch (e) {
      // Handle error during onboarding completion
      print('Error completing onboarding: $e');
      // Still try to navigate to login even if saving fails
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
            // Progress bar and back button
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
            
            // Main content
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
      // Group 1: Understanding the user (Steps 1-3)
      case 1:
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
      case 2:
        return _buildQuestionScreen(
          title: "What's killing your study time?",
          subtitle: "Be honest - we're here to fix it",
          options: [
            _Option("Wasting hours on note-taking", CupertinoIcons.clock),
            _Option("Feeling overwhelmed by material", CupertinoIcons.exclamationmark_triangle),
            _Option("Struggling to retain information", CupertinoIcons.circle_grid_3x3),
            _Option("Losing motivation to study", CupertinoIcons.square),
            _Option("Can't focus or concentrate", CupertinoIcons.eye_slash),
            _Option("Not knowing where to start", CupertinoIcons.question_circle),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              studyProblem: ["Time wasted", "Overwhelming", "Poor retention", "Lack of motivation", "Can't focus", "Don't know where to start"][index],
            );
          },
          selectedIndex: ["Time wasted", "Overwhelming", "Poor retention", "Lack of motivation", "Can't focus", "Don't know where to start"]
              .indexWhere((e) => e == _onboardingData.studyProblem),
        );
      case 3:
        return _buildQuestionScreen(
          title: "What format makes you want to quit?",
          subtitle: "We'll transform it into something you'll love",
          options: [
            _Option("Dense, boring textbooks", CupertinoIcons.doc_text),
            _Option("Endless lecture slides", CupertinoIcons.rectangle_stack),
            _Option("Complex PDF articles", CupertinoIcons.doc),
            _Option("Messy, unorganized notes", CupertinoIcons.doc_on_doc),
            _Option("Video lectures (too long)", CupertinoIcons.play_rectangle),
            _Option("All of the above", CupertinoIcons.list_bullet),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              difficultFormat: ["Textbooks", "Lecture slides", "PDF articles", "Unorganized notes", "Video lectures", "All formats"][index],
            );
          },
          selectedIndex: ["Textbooks", "Lecture slides", "PDF articles", "Unorganized notes", "Video lectures", "All formats"]
              .indexWhere((e) => e == _onboardingData.difficultFormat),
        );
      // Group 2: Getting stuck and help - Adapted to format answer
      case 4:
        String? formatText = _onboardingData.difficultFormat?.toLowerCase();
        String title = "Where do you get stuck most?";
        String subtitle = "We'll give you exactly what you need";
        if (formatText != null) {
          if (formatText.contains("textbook")) {
            title = "What's hardest about textbooks?";
            subtitle = "We'll break down those dense chapters for you";
          } else if (formatText.contains("slide")) {
            title = "What's hardest about lecture slides?";
            subtitle = "We'll organize and explain every concept";
          } else if (formatText.contains("pdf")) {
            title = "What's hardest about PDF articles?";
            subtitle = "We'll extract and simplify the key points";
          } else if (formatText.contains("note")) {
            title = "What's hardest about messy notes?";
            subtitle = "We'll organize and structure everything";
          } else if (formatText.contains("video")) {
            title = "What's hardest about video lectures?";
            subtitle = "We'll summarize and highlight what matters";
          }
        }
        return _buildQuestionScreen(
          title: title,
          subtitle: subtitle,
          options: [
            _Option("Grasping the big picture", CupertinoIcons.lightbulb),
            _Option("Remembering key details", CupertinoIcons.circle_grid_3x3),
            _Option("Using it in practice", CupertinoIcons.wrench),
            _Option("Connecting different concepts", CupertinoIcons.link),
            _Option("Understanding technical jargon", CupertinoIcons.textformat),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              reviewStruggle: ["Core concepts", "Specific details", "Application", "Connecting concepts", "Technical terms"][index],
            );
          },
          selectedIndex: ["Core concepts", "Specific details", "Application", "Connecting concepts", "Technical terms"]
              .indexWhere((e) => e == _onboardingData.reviewStruggle),
        );
      case 5:
        return _buildQuestionScreen(
          title: "What do you do when you're stuck?",
          subtitle: "There's a better way - and it's instant",
          options: [
            _Option("Search Google or YouTube", CupertinoIcons.play_circle),
            _Option("Ask a friend or classmate", CupertinoIcons.person_2),
            _Option("Email the professor", CupertinoIcons.mail),
            _Option("Use ChatGPT", CupertinoIcons.chat_bubble_2),
            _Option("Skip it and hope for the best", CupertinoIcons.arrow_right),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              stuckStrategy: ["Google/YouTube", "Ask classmate", "Email professor", "ChatGPT", "Skip it"][index],
            );
          },
          selectedIndex: ["Google/YouTube", "Ask classmate", "Email professor", "ChatGPT", "Skip it"]
              .indexWhere((e) => e == _onboardingData.stuckStrategy),
        );
      // Transition 2: After stuck questions - References getting help
      case 6:
        return _buildTransitionScreen(
          title: "Get Instant Help\nWhen You're Stuck",
          description: "No more waiting for office hours or scrolling through endless search results. Your personal AI tutor is ready 24/7 to explain concepts, answer questions, and guide you through any challenge - instantly.",
          mascotPath: "assets/mascot/ChatGPT Image Nov 10, 2025 at 03_54_21 PM.png",
        );
      // Group 3: Learning preferences
      case 7:
        return _buildQuestionScreen(
          title: "How do you learn best?",
          subtitle: "We'll match your perfect learning style",
          options: [
            _Option("Simple, clear explanations", CupertinoIcons.square_grid_2x2),
            _Option("Practice questions & quizzes", CupertinoIcons.checkmark_circle),
            _Option("Step-by-step guidance", CupertinoIcons.person_2),
            _Option("Fast & comprehensive", CupertinoIcons.bolt),
            _Option("Visual examples & diagrams", CupertinoIcons.photo),
            _Option("Repetition & memorization", CupertinoIcons.arrow_clockwise),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              learningStyle: ["Simple breakdown", "Practice questions", "Guided walkthrough", "Speed and depth", "Visual examples", "Repetition"][index],
            );
          },
          selectedIndex: ["Simple breakdown", "Practice questions", "Guided walkthrough", "Speed and depth", "Visual examples", "Repetition"]
              .indexWhere((e) => e == _onboardingData.learningStyle),
        );
      case 8:
        return _buildQuestionScreen(
          title: "Should studying actually be enjoyable?",
          subtitle: "We think it can be - and we'll prove it",
          options: [
            _Option("Just get it done", CupertinoIcons.checkmark),
            _Option("Would be nice", CupertinoIcons.smiley),
            _Option("Pretty important", CupertinoIcons.star),
            _Option("Absolutely essential", CupertinoIcons.heart),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              engagementImportance: ["Not important", "Somewhat important", "Important", "Very important"][index],
            );
          },
          selectedIndex: ["Not important", "Somewhat important", "Important", "Very important"]
              .indexWhere((e) => e == _onboardingData.engagementImportance),
        );
      // Group 4: Goals and time
      case 9:
        return _buildQuestionScreen(
          title: "How much time do you need for preparing to learn?",
          subtitle: "Including note taking, creating flashcards, and organizing materials",
          options: [
            _Option("Less than 30 minutes", CupertinoIcons.clock),
            _Option("30-60 minutes", CupertinoIcons.timer),
            _Option("1-2 hours", CupertinoIcons.timer),
            _Option("2-3 hours", CupertinoIcons.timer),
            _Option("3+ hours", CupertinoIcons.timer),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              dailyTimeCommitment: [30, 60, 120, 180, 240][index],
            );
          },
          selectedIndex: [30, 60, 120, 180, 240].indexWhere((e) => e == _onboardingData.dailyTimeCommitment),
        );
      case 10:
        return _buildQuestionScreen(
          title: "What's your biggest academic goal?",
          subtitle: "This is how we'll help you crush it",
          options: [
            _Option("Ace all my courses", CupertinoIcons.star),
            _Option("Get into grad school or land my dream job", CupertinoIcons.briefcase),
            _Option("Maintain a perfect GPA", CupertinoIcons.chart_bar),
            _Option("Master a critical skill", CupertinoIcons.star),
            _Option("Pass my exams without stress", CupertinoIcons.checkmark_seal),
            _Option("Just survive this semester", CupertinoIcons.heart),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              academicGoal: ["Ace courses", "Grad school/Job", "High GPA", "Learn skill", "Pass exams", "Survive semester"][index],
            );
          },
          selectedIndex: ["Ace courses", "Grad school/Job", "High GPA", "Learn skill", "Pass exams", "Survive semester"]
              .indexWhere((e) => e == _onboardingData.academicGoal),
        );
      // Screen 11: Adapted to time preparation answer
      case 11:
        int? prepTime = _onboardingData.dailyTimeCommitment;
        String title = "What would you do with that time saved?";
        String subtitle = "This is about to become your reality";
        if (prepTime != null) {
          if (prepTime <= 30) {
            title = "What would you do with 30 extra minutes daily?";
            subtitle = "That's 3.5 hours per week - all yours";
          } else if (prepTime <= 60) {
            title = "What would you do with 1 extra hour daily?";
            subtitle = "That's 7 hours per week - all yours";
          } else if (prepTime <= 120) {
            title = "What would you do with 2 extra hours daily?";
            subtitle = "That's 14 hours per week - all yours";
          } else {
            title = "What would you do with 3+ extra hours daily?";
            subtitle = "That's 20+ hours per week - all yours";
          }
        }
        return _buildQuestionScreen(
          title: title,
          subtitle: subtitle,
          options: [
            _Option("Finally get enough sleep", CupertinoIcons.bed_double),
            _Option("Hang out with friends more", CupertinoIcons.person_2),
            _Option("Pursue a passion project", CupertinoIcons.rocket),
            _Option("Exercise and take care of myself", CupertinoIcons.heart),
            _Option("Work on other courses", CupertinoIcons.book),
            _Option("Just relax and recharge", CupertinoIcons.moon),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              extraTimeUsage: ["Sleep", "Friends", "New project", "Exercise", "Other courses", "Relax"][index],
            );
          },
          selectedIndex: ["Sleep", "Friends", "New project", "Exercise", "Other courses", "Relax"]
              .indexWhere((e) => e == _onboardingData.extraTimeUsage),
        );
      // Transition 3: After time/goal questions - References time savings
      case 12:
        return _buildTransitionScreen(
          title: "Stop Wasting Time.\nStart Dominating.",
          description: "${_onboardingData.dailyTimeCommitment != null ? 'Those ${(_onboardingData.dailyTimeCommitment! / 60).toStringAsFixed(1)} hours on prep work? ' : ''}Gone. Our AI creates perfect summaries, flashcards, and study materials in seconds. ${_onboardingData.academicGoal != null ? 'Your goal to ${_onboardingData.academicGoal!.toLowerCase()}? ' : ''}Consider it done.",
          mascotPath: "assets/mascot/ChatGPT Image Nov 10, 2025 at 02_21_54 PM.png",
        );
      case 13:
        return _buildQuestionScreen(
          title: "How would that extra time make you feel?",
          subtitle: "This feeling is closer than you think",
          options: [
            _Option("Way less stressed", CupertinoIcons.smiley),
            _Option("Super confident", CupertinoIcons.hand_raised),
            _Option("Completely recharged", CupertinoIcons.battery_charging),
            _Option("In control of my life", CupertinoIcons.checkmark_seal),
            _Option("Like I can finally breathe", CupertinoIcons.wind),
            _Option("Ready to take on anything", CupertinoIcons.bolt),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              freeTimeFeeling: ["Less stressed", "More confident", "Recharged", "In control", "Can breathe", "Ready for anything"][index],
            );
          },
          selectedIndex: ["Less stressed", "More confident", "Recharged", "In control", "Can breathe", "Ready for anything"]
              .indexWhere((e) => e == _onboardingData.freeTimeFeeling),
        );
      // Personalized Plan Screen
      case 14:
        return _buildPersonalizedPlanScreen();
      // Notification Screen
      case 15:
        return _buildNotificationScreen();
      // Rating Screen
      case 16:
        return _buildRatingScreen();
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
          // Bigger mascot image - using latest image
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
                // Question title - left aligned
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
                // Subtitle - left aligned with better styling
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
                // Options with better spacing
                ...options.asMap().entries.map((entry) {
                  final index = entry.key;
                  final option = entry.value;
                  return Padding(
                    padding: EdgeInsets.only(bottom: index < options.length - 1 ? 14 : 0),
                    child: _EnhancedOptionButton(
                      text: option.text,
                      icon: option.icon,
                      number: option.number,
                      isSelected: selectedIndex == index,
                      onTap: () {
                        onSelect(index);
                        setState(() {});
                      },
                    ),
                  );
                }),
                const SizedBox(height: 100), // Space for pinned button
              ],
            ),
          ),
        ),
        // Pinned continue button
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

  Widget _buildTransitionScreen({
    required String title,
    required String description,
    required String mascotPath,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Spacer(),
          // Big mascot image - using latest image for some transitions
          MascotImage(
            imagePath: mascotPath,
            width: 350,
            height: 350,
          ),
          const SizedBox(height: 48),
          // Animated title
          FadeTransition(
            opacity: _transitionTitleAnimation,
            child: SlideTransition(
              position: _transitionTitleSlideAnimation,
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                  height: 1.2,
                  letterSpacing: -0.8,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
          const SizedBox(height: 24),
          // Animated description
          FadeTransition(
            opacity: _transitionDescriptionAnimation,
            child: SlideTransition(
              position: _transitionDescriptionSlideAnimation,
              child: Text(
                description,
                style: const TextStyle(
                  fontSize: 15,
                  color: Colors.white70,
                  height: 1.6,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
          const Spacer(),
          _LargeGradientButton(
            text: "Continue",
            trailingIcon: CupertinoIcons.arrow_right,
            onPressed: _transitionButtonEnabled ? _nextStep : null,
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
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.3),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
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
                          boxShadow: [
                            BoxShadow(
                              color: OnboardingColors.optionButtonGradientColors.first.withOpacity(0.4),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
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
    // Request permission if Allow was clicked
    if (allowNotifications == true) {
      final status = await Permission.notification.request();
      if (status.isGranted) {
        HapticFeedback.mediumImpact();
      }
    } else if (allowNotifications == false) {
      HapticFeedback.lightImpact();
    } else {
      // Continue button was clicked - show dialog first
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

    // Show dialog for Allow/Don't Allow buttons
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
    
    // Wait for dialog to fully close, then proceed
    if (mounted) {
      // Add a small delay to ensure dialog is fully dismissed
      await Future.delayed(const Duration(milliseconds: 200));
      if (mounted) {
        _nextStep();
      }
    }
  }

  Widget _buildRatingScreen() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(height: 32),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text(
                "Rate us",
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                  letterSpacing: -0.8,
                ),
              ),
              const SizedBox(width: 12),
              Icon(
                CupertinoIcons.heart_fill,
                color: OnboardingColors.buttonGradientColors.first,
                size: 32,
              ),
            ],
          ),
          const SizedBox(height: 40),
          const Text(
            "RocketLearn was made for people like you",
            style: TextStyle(
              fontSize: 18,
              color: Colors.white,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.2,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 40),
          _buildTestimonialCard(
            name: "Sarah Miller",
            text: "This app is incredible! So much cheaper than a tutor and it really works. The AI explanations are so clear and easy to understand!",
          ),
          const SizedBox(height: 20),
          _buildTestimonialCard(
            name: "Michael Chen",
            text: "I've tried so many study apps, but RocketLearn actually understands how I learn. The flashcards and quizzes are perfectly tailored to my needs.",
          ),
          const SizedBox(height: 20),
          _buildTestimonialCard(
            name: "Emily Rodriguez",
            text: "Game changer! I went from struggling with my classes to acing my exams. The AI tutor is like having a personal teacher available 24/7.",
          ),
          const SizedBox(height: 20),
          _buildTestimonialCard(
            name: "James Wilson",
            text: "The time I save on note-taking alone makes this worth it. Plus, the summaries are actually helpful - not just generic AI output.",
          ),
          const SizedBox(height: 40),
          _LargeGradientButton(
            text: "Continue",
            trailingIcon: CupertinoIcons.arrow_right,
            onPressed: _nextStep,
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }
  
  Widget _buildTestimonialCard({required String name, required String text}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: OnboardingColors.surfaceColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: OnboardingColors.borderColor,
          width: 1.5,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: OnboardingColors.buttonGradientColors.take(2).toList(),
                  ),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  CupertinoIcons.person,
                  color: Colors.white,
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Row(
                      children: [
                        Icon(
                          CupertinoIcons.star_fill,
                          color: Color(0xFF8D1647),
                          size: 16,
                        ),
                        SizedBox(width: 4),
                        Icon(
                          CupertinoIcons.star_fill,
                          color: Color(0xFF8D1647),
                          size: 16,
                        ),
                        SizedBox(width: 4),
                        Icon(
                          CupertinoIcons.star_fill,
                          color: Color(0xFF8D1647),
                          size: 16,
                        ),
                        SizedBox(width: 4),
                        Icon(
                          CupertinoIcons.star_fill,
                          color: Color(0xFF8D1647),
                          size: 16,
                        ),
                        SizedBox(width: 4),
                        Icon(
                          CupertinoIcons.star_fill,
                          color: Color(0xFF8D1647),
                          size: 16,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Icon(
                CupertinoIcons.quote_bubble,
                color: OnboardingColors.buttonGradientColors.first,
                size: 32,
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            text,
            style: const TextStyle(
              fontSize: 15,
              color: Color(0xFF9CA3AF),
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }

}

class _Option {
  final String text;
  final IconData? icon;
  final String? number;

  _Option(this.text, this.icon, {this.number});
}

// Enhanced option button with press feedback
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
          duration: const Duration(milliseconds: 0), // Instant color change
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

// Large gradient button with press feedback
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

// Secondary button for notifications
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
        _progress = _controller.value; // Now goes to 1.0 (100%)
        // Complete items progressively
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
