import 'dart:async';
import 'package:flutter/cupertino.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:superwallkit_flutter/superwallkit_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:in_app_review/in_app_review.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/onboarding_data.dart';
import '../services/onboarding_service.dart';
import '../widgets/onboarding/progress_bar.dart';
import '../widgets/onboarding/mascot_image.dart';
import '../constants/onboarding_colors.dart';
import '../providers/auth_provider.dart';
import '../utils/logger.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen>
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
  
  // Animation controllers for transition screens
  late AnimationController _transitionTitleController;
  late AnimationController _transitionDescriptionController;
  late AnimationController _transitionMascotController;
  late Animation<double> _transitionTitleAnimation;
  late Animation<Offset> _transitionTitleSlideAnimation;
  late Animation<double> _transitionDescriptionAnimation;
  late Animation<Offset> _transitionDescriptionSlideAnimation;
  late Animation<double> _transitionMascotAnimation;
  late Animation<double> _transitionMascotScaleAnimation;
  bool _transitionButtonEnabled = false;
  Timer? _transitionTimer;
  bool _ratingCompleted = false; // Track if user has completed the rating dialog
  bool _hasNavigatedAfterPaywall = false; // Track if we've already navigated after paywall
  Timer? _paywallDismissalTimer; // Timer to handle paywall dismissal
  
  // Scroll controllers for scroll views
  final ScrollController _questionScrollController = ScrollController();
  final ScrollController _multiSelectScrollController = ScrollController();
  final ScrollController _welcomeScrollController = ScrollController();
  final ScrollController _planScrollController = ScrollController();
  
  // Total steps - comprehensive flow with transitions
  static const int totalSteps = 16;

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
    
    // Transition screen animations
    _transitionTitleController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _transitionDescriptionController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _transitionMascotController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    
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
    
    _transitionMascotAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _transitionMascotController, curve: Curves.easeOut),
    );
    _transitionMascotScaleAnimation = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _transitionMascotController, curve: Curves.easeOutCubic),
    );

    _fadeController.forward();
    _slideController.forward();
    _scaleController.forward();
    
    // Check and start appropriate animations
    _checkAndStartAnimations();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _slideController.dispose();
    _scaleController.dispose();
    _chartController.dispose();
    _benefitController.dispose();
    _transitionTitleController.dispose();
    _transitionDescriptionController.dispose();
    _transitionMascotController.dispose();
    _transitionTimer?.cancel();
    _paywallDismissalTimer?.cancel();
    _questionScrollController.dispose();
    _multiSelectScrollController.dispose();
    _welcomeScrollController.dispose();
    _planScrollController.dispose();
    super.dispose();
  }
  
  bool _isBenefitScreen(int step) {
    return step == 3;
  }
  
  bool _isTransitionScreen(int step) {
    // Steps 6, 8, 13, and 15 are transition screens
    return step == 6 || step == 8 || step == 13 || step == 15;
  }
  
  /// Helper method to wrap content with a fixed bottom continue button
  /// Ensures the button is always at the same position and content is scrollable
  Widget _buildScreenWithFixedButton({
    required Widget content,
    VoidCallback? onContinue,
    bool enableContinue = true,
    String? buttonText,
    IconData? trailingIcon,
  }) {
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: content,
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
            text: buttonText ?? "Continue",
            trailingIcon: trailingIcon ?? CupertinoIcons.arrow_right,
            onPressed: enableContinue ? (onContinue ?? _nextStep) : null,
          ),
        ),
      ],
    );
  }
  
  void _checkAndStartAnimations() {
      // Reset rating completed flag when entering rating screen (step 11)
      if (_currentStep == 11) {
        _ratingCompleted = false;
      }
      
      if (_isBenefitScreen(_currentStep)) {
        _chartController.reset();
        _benefitController.reset();
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) {
            _chartController.forward();
            _benefitController.forward();
          }
        });
    } else if (_isTransitionScreen(_currentStep)) {
      _transitionButtonEnabled = false;
      _transitionTitleController.reset();
      _transitionDescriptionController.reset();
      _transitionMascotController.reset();
      
      // Start mascot animation immediately
      _transitionMascotController.forward();
      
      // Start title animation after a short delay
      Future.delayed(const Duration(milliseconds: 200), () {
        if (mounted) {
          _transitionTitleController.forward();
        }
      });
      
      // Start description animation after title
      Future.delayed(const Duration(milliseconds: 400), () {
        if (mounted) {
          _transitionDescriptionController.forward();
        }
      });
      
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
      if (!_transitionTitleController.isCompleted) {
        _transitionTitleController.value = 1.0;
      }
      if (!_transitionDescriptionController.isCompleted) {
        _transitionDescriptionController.value = 1.0;
      }
      if (!_transitionMascotController.isCompleted) {
        _transitionMascotController.value = 1.0;
      }
    }
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
      _checkAndStartAnimations();
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
      _checkAndStartAnimations();
    }
  }

  /// Sign in anonymously and navigate to home
  Future<void> _signInAndNavigate() async {
    if (!mounted || _hasNavigatedAfterPaywall) return;
    _hasNavigatedAfterPaywall = true;
    
    try {
      AppLogger.info('🔐 [Onboarding] Attempting anonymous sign-in...', tag: 'OnboardingScreen');
      final authNotifier = ref.read(authProvider.notifier);
      final result = await authNotifier.signInAnonymously();

      if (result['success'] == true) {
        AppLogger.success('✅ [Onboarding] Anonymous sign-in successful', tag: 'OnboardingScreen');
      } else {
        AppLogger.info('ℹ️ [Onboarding] Anonymous sign-in not available, continuing without auth', tag: 'OnboardingScreen');
      }
    } catch (e) {
      AppLogger.info('ℹ️ [Onboarding] Anonymous sign-in failed (may be disabled), continuing without auth: $e', tag: 'OnboardingScreen');
    }

    // Navigate to home (not login)
    AppLogger.info('🏠 [Onboarding] Navigating to home...', tag: 'OnboardingScreen');
    if (mounted) {
      // Add a small delay to ensure paywall is fully dismissed
      await Future.delayed(const Duration(milliseconds: 500));
      if (mounted) {
        context.go('/home');
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
      _transitionTitleController.stop();
      _transitionDescriptionController.stop();
      _transitionMascotController.stop();
      _transitionTimer?.cancel();
      
      await OnboardingService.completeOnboarding(_onboardingData.toJson());
      
      if (mounted) {
        try {
          AppLogger.info('🎯 [Onboarding] Showing Superwall paywall...', tag: 'OnboardingScreen');
          
          // Register the Superwall placement - this will show the paywall automatically
          Superwall.shared.registerPlacement(
            'campaign_trigger',
            feature: () {
              AppLogger.info('✅ [Onboarding] Superwall feature callback executed - user has access', tag: 'OnboardingScreen');
              // Cancel the dismissal timer since user subscribed
              _paywallDismissalTimer?.cancel();
              // This callback is executed if user has access (after subscribing or already subscribed)
              // Sign in anonymously and navigate to home
              _signInAndNavigate();
            },
          );

          AppLogger.info('✅ [Onboarding] Superwall placement registered: campaign_trigger', tag: 'OnboardingScreen');

          // Set a timeout to handle paywall dismissal (when user clicks X)
          // This will catch when the paywall is dismissed without subscribing
          _paywallDismissalTimer = Timer(const Duration(seconds: 5), () {
            if (mounted && !_hasNavigatedAfterPaywall) {
              AppLogger.info('⚠️ [Onboarding] Paywall likely dismissed - signing in and navigating to home', tag: 'OnboardingScreen');
              _signInAndNavigate();
            }
          });
        } catch (e) {
          AppLogger.error('❌ [Onboarding] Error showing Superwall paywall: $e', tag: 'OnboardingScreen');
          // On error, sign in and navigate to home
          _signInAndNavigate();
        }
      }
    } catch (e) {
      AppLogger.error('❌ [Onboarding] Error completing onboarding: $e', tag: 'OnboardingScreen');
      // On error, sign in and navigate to home
      if (mounted) {
        _signInAndNavigate();
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
      // Step 1: Student status FIRST (as requested)
      case 1:
        return _buildQuestionScreen(
          title: "What best describes you?",
          subtitle: "We're building something amazing just for you",
          options: [
            _Option("Student (High School, College, or Grad)", CupertinoIcons.book),
            _Option("Professional or Working Adult", CupertinoIcons.briefcase),
            _Option("Preparing for Certification", CupertinoIcons.star),
            _Option("Lifelong Learner", CupertinoIcons.lightbulb),
            _Option("Teacher or Educator", CupertinoIcons.person_2),
            _Option("Other", CupertinoIcons.ellipsis),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              studentStatus: ["Student", "Professional", "Certification", "Lifelong Learner", "Teacher", "Other"][index],
            );
          },
          selectedIndex: ["Student", "Professional", "Certification", "Lifelong Learner", "Teacher", "Other"]
              .indexWhere((e) => e == _onboardingData.studentStatus),
        );
      // Step 2: Study problems (multi-select)
      case 2:
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
      // Step 3: Productivity benefit (moved to beginning, improved)
      case 3:
        return _buildProductivityBenefitScreen();
      // Step 4: Difficult format (only supported formats)
      case 4:
        return _buildQuestionScreen(
          title: "Which type of study material is hardest for you?",
          subtitle: "Tell us what format you find most challenging - we'll help you master it",
          options: [
            _Option("Research papers & articles", CupertinoIcons.doc),
            _Option("Lecture slides", CupertinoIcons.rectangle_stack),
            _Option("Hearing lectures (audio)", CupertinoIcons.mic),
            _Option("Technical documentation", CupertinoIcons.doc_text),
            _Option("Textbooks & reading materials", CupertinoIcons.book),
            _Option("My own notes", CupertinoIcons.textformat),
          ],
          onSelect: (index) {
            // Map natural language options to internal format values
            // Index 0: "Research papers & articles" -> "PDF"
            // Index 1: "Lecture slides" -> "PowerPoint"
            // Index 2: "Hearing lectures (audio)" -> "Audio"
            // Index 3: "Technical documentation" -> "Technical documentation"
            // Index 4: "Textbooks & reading materials" -> "Textbook"
            // Index 5: "My own notes" -> "Text files"
            final formatMap = ["PDF", "PowerPoint", "Audio", "Technical documentation", "Textbook", "Text files"];
            final newFormat = formatMap[index];
            // Reset reviewStruggle when format changes
            if (_onboardingData.difficultFormat != newFormat) {
            _onboardingData = _onboardingData.copyWith(
                difficultFormat: newFormat,
                reviewStruggle: null, // Reset the next question's answer
            );
            } else {
              _onboardingData = _onboardingData.copyWith(
                difficultFormat: newFormat,
              );
            }
          },
          selectedIndex: ["PDF", "PowerPoint", "Audio", "Technical documentation", "Textbook", "Text files"]
              .indexWhere((e) => e == _onboardingData.difficultFormat),
        );
      // Step 5: Review struggle (adapted to format)
      case 5:
        String? formatText = _onboardingData.difficultFormat?.toLowerCase();
        String title = "Where do you get stuck most?";
        String subtitle = "We'll give you exactly what you need";
        List<_Option> options = [
          _Option("Grasping the big picture", CupertinoIcons.lightbulb),
          _Option("Remembering key details", CupertinoIcons.circle_grid_3x3),
          _Option("Using it in practice", CupertinoIcons.wrench),
          _Option("Connecting different concepts", CupertinoIcons.link),
          _Option("Understanding technical jargon", CupertinoIcons.textformat),
        ];
        List<String> optionValues = ["Core concepts", "Specific details", "Application", "Connecting concepts", "Technical terms"];
        
        if (formatText != null) {
          if (formatText.contains("pdf") || formatText.contains("word") || formatText.contains("paper")) {
            title = "What's hardest about research papers & articles?";
            subtitle = "We'll extract and simplify the key points for you";
            options = [
              _Option("Too long and dense", CupertinoIcons.doc),
              _Option("Academic language is confusing", CupertinoIcons.textformat),
              _Option("Can't identify main arguments", CupertinoIcons.lightbulb),
              _Option("Too many citations and references", CupertinoIcons.book),
              _Option("Hard to remember the details", CupertinoIcons.circle_grid_3x3),
            ];
            optionValues = ["Too dense", "Academic language", "Main arguments", "Too many citations", "Remembering details"];
          } else if (formatText.contains("slide") || formatText.contains("powerpoint") || formatText.contains("presentation")) {
            title = "What's hardest about lecture slides?";
            subtitle = "We'll organize and explain every concept clearly";
            options = [
              _Option("Too many slides to review", CupertinoIcons.rectangle_stack),
              _Option("Missing context from the lecture", CupertinoIcons.question_circle),
              _Option("Can't tell what's important", CupertinoIcons.star),
              _Option("Information is too fragmented", CupertinoIcons.doc_on_doc),
              _Option("Hard to connect the concepts", CupertinoIcons.link),
            ];
            optionValues = ["Too many slides", "Missing context", "Prioritization", "Fragmented info", "Connecting concepts"];
          } else if (formatText.contains("audio") || formatText.contains("hearing")) {
            title = "What's hardest about hearing lectures?";
            subtitle = "We'll transcribe and summarize exactly what matters";
            options = [
              _Option("Too long and time-consuming", CupertinoIcons.clock),
              _Option("Can't skip to important parts", CupertinoIcons.play_rectangle),
              _Option("Hard to take notes while listening", CupertinoIcons.pencil),
              _Option("Easy to lose focus", CupertinoIcons.eye_slash),
              _Option("Can't review specific sections easily", CupertinoIcons.arrow_clockwise),
            ];
            optionValues = ["Too long", "Finding key parts", "Taking notes", "Staying focused", "Reviewing sections"];
          } else if (formatText.contains("technical") || formatText.contains("documentation")) {
            title = "What's hardest about technical documentation?";
            subtitle = "We'll simplify and explain every concept clearly";
            options = [
              _Option("Too complex and technical", CupertinoIcons.gear),
              _Option("Hard to find what I need", CupertinoIcons.search),
              _Option("Jargon and terminology is confusing", CupertinoIcons.textformat),
              _Option("Missing practical examples", CupertinoIcons.lightbulb),
              _Option("Too dry and hard to follow", CupertinoIcons.book),
            ];
            optionValues = ["Too complex", "Finding info", "Technical jargon", "Missing examples", "Hard to follow"];
          } else if (formatText.contains("video") || formatText.contains("watching")) {
            title = "What's hardest about watching video lectures?";
            subtitle = "We'll summarize and highlight exactly what matters";
            options = [
              _Option("Too long and time-consuming", CupertinoIcons.clock),
              _Option("Can't skip to important parts", CupertinoIcons.play_rectangle),
              _Option("Hard to take notes while watching", CupertinoIcons.pencil),
              _Option("Easy to lose focus", CupertinoIcons.eye_slash),
              _Option("Can't review specific sections easily", CupertinoIcons.arrow_clockwise),
            ];
            optionValues = ["Too long", "Finding key parts", "Taking notes", "Staying focused", "Reviewing sections"];
          } else if (formatText.contains("textbook") || formatText.contains("reading")) {
            title = "What's hardest about textbooks & reading materials?";
            subtitle = "We'll break down those dense chapters and make them digestible";
            options = [
              _Option("Too much information to process", CupertinoIcons.doc_text),
              _Option("Can't find the key points", CupertinoIcons.search),
              _Option("Dull and hard to stay focused", CupertinoIcons.eye_slash),
              _Option("Too technical and complex", CupertinoIcons.textformat),
              _Option("Everything feels equally important", CupertinoIcons.circle_grid_3x3),
            ];
            optionValues = ["Information overload", "Finding key points", "Staying focused", "Technical complexity", "Prioritization"];
          } else if ((formatText.contains("text") && formatText.contains("file")) || formatText.contains("note") || formatText.contains("own")) {
            title = "What's hardest about your own notes?";
            subtitle = "We'll organize and structure everything perfectly";
            options = [
              _Option("Everything is disorganized", CupertinoIcons.doc_on_doc),
              _Option("Can't find what I need", CupertinoIcons.search),
              _Option("Missing important information", CupertinoIcons.exclamationmark_triangle),
              _Option("Hard to review effectively", CupertinoIcons.arrow_clockwise),
              _Option("Incomplete or unclear notes", CupertinoIcons.question_circle),
            ];
            optionValues = ["Disorganized", "Finding info", "Missing info", "Reviewing", "Incomplete notes"];
          }
        }
        return _buildQuestionScreen(
          title: title,
          subtitle: subtitle,
          options: options,
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              reviewStruggle: optionValues[index],
            );
          },
          selectedIndex: optionValues.indexWhere((e) => e == _onboardingData.reviewStruggle),
        );
      // Step 6: RocketLearn makes it fun and easy
      case 6:
        return _buildRocketLearnTransformationScreen();
      // Step 7: Stuck strategy
      case 7:
        return _buildQuestionScreen(
          title: "What do you do when you don't understand something?",
          subtitle: "When you're stuck on a concept or problem, how do you usually get help?",
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
      // Step 8: Transition - Get Instant Help
      case 8:
        return _buildTransitionScreen(
          title: "Stuck?\nNever Again",
          description: "No more waiting for office hours or scrolling through endless search results. Your personal AI tutor is ready 24/7 to explain concepts, answer questions, and guide you through any challenge - instantly.",
          mascotPath: "assets/mascot/angry.png",
        );
      // Step 9: Learning styles (multi-select)
      case 9:
        return _buildMultiSelectQuestionScreen(
          title: "How do you learn best?",
          subtitle: "We'll match your perfect learning style",
          options: [
            _Option("Simple, clear explanations", CupertinoIcons.square_grid_2x2),
            _Option("Practice exercises & problems", CupertinoIcons.pencil_ellipsis_rectangle),
            _Option("Quizzes to test understanding", CupertinoIcons.checkmark_circle),
            _Option("Step-by-step guidance", CupertinoIcons.person_2),
            _Option("Repetition & flashcards", CupertinoIcons.arrow_clockwise),
            _Option("Fast summaries & overviews", CupertinoIcons.bolt),
          ],
          selectedIndices: _onboardingData.learningStyles?.map((s) {
            return ["Simple breakdown", "Practice exercises", "Quizzes", "Guided walkthrough", "Repetition", "Fast summaries"].indexOf(s);
          }).where((i) => i >= 0).toList() ?? [],
          onSelectionChanged: (indices) {
            final styles = indices.map((i) => ["Simple breakdown", "Practice exercises", "Quizzes", "Guided walkthrough", "Repetition", "Fast summaries"][i]).toList();
            _onboardingData = _onboardingData.copyWith(learningStyles: styles);
          },
        );
      // Step 10: Great you can do it with RocketLearn
      case 10:
        return _buildRocketLearnCapabilityScreen();
      // Step 11: Rating screen
      case 11:
        return _buildRatingScreen();
      // Step 12: Academic goal
      case 12:
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
      // Step 13: Call to action based on academic goal
      case 13:
        return _buildAcademicGoalCallToActionScreen();
      // Step 14: Personalized plan
      case 14:
        return _buildPersonalizedPlanScreen();
      // Step 15: Plan success screen
      case 15:
        return _buildPlanSuccessScreen();
      // Step 16: Notifications
      case 16:
        return _buildNotificationScreen();
      default:
        return _buildWelcomeScreen();
    }
  }

  Widget _buildWelcomeScreen() {
    final screenHeight = MediaQuery.of(context).size.height;
    final mascotSize = (screenHeight * 0.35).clamp(300.0, 400.0);
    
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(height: screenHeight * 0.08),
          Hero(
            tag: 'mascot',
            child: MascotImage(
              imagePath: "assets/mascot/open-arms.png",
              width: mascotSize,
              height: mascotSize,
            ),
          ),
          SizedBox(height: screenHeight * 0.05),
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
                const SizedBox(height: 32),
                ...options.asMap().entries.map((entry) {
                  final index = entry.key;
                  final option = entry.value;
                  final isSelected = selectedIndices.contains(index);
                  return Padding(
                    padding: EdgeInsets.only(bottom: index < options.length - 1 ? 14 : 0),
                    child: _MultiSelectOptionButton(
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

  Widget _buildTransitionScreen({
    required String title,
    required String description,
    required String mascotPath,
  }) {
    final screenHeight = MediaQuery.of(context).size.height;
    final screenWidth = MediaQuery.of(context).size.width;
    // Make mascot bigger but ensure it fits on smallest iPhone (SE: 375x667)
    // Use responsive sizing that works on all screens
    final mascotSize = (screenHeight * 0.38).clamp(280.0, 380.0);
    // Ensure it doesn't exceed screen width with padding
    final maxMascotSize = (screenWidth - 80).clamp(280.0, 380.0);
    final finalMascotSize = mascotSize < maxMascotSize ? mascotSize : maxMascotSize;
    
    return _buildScreenWithFixedButton(
      enableContinue: _transitionButtonEnabled,
      content: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(height: screenHeight * 0.04),
          // Big mascot image with animation
          FadeTransition(
            opacity: _transitionMascotAnimation,
            child: ScaleTransition(
              scale: _transitionMascotScaleAnimation,
              child: MascotImage(
                imagePath: mascotPath,
                width: finalMascotSize,
                height: finalMascotSize,
              ),
                      ),
                    ),
                    const SizedBox(height: 24),
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
                const SizedBox(height: 16),
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
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildProductivityBenefitScreen() {
    final screenHeight = MediaQuery.of(context).size.height;
    final chartHeight = (screenHeight * 0.38).clamp(240.0, 300.0);
    
    return _buildScreenWithFixedButton(
      content: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(height: screenHeight * 0.05),
          AnimatedBuilder(
            animation: _chartAnimation,
            builder: (context, child) {
              return Container(
                height: chartHeight,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
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
                    // Chart
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 20),
                        child: Stack(
                        children: [
                          LineChart(
                        LineChartData(
                              minY: 0,
                              maxY: 100,
                          gridData: FlGridData(
                            show: true,
                            drawVerticalLine: false,
                            horizontalInterval: 25,
                            getDrawingHorizontalLine: (value) {
                              return FlLine(
                                color: OnboardingColors.borderColor.withOpacity(0.15),
                                strokeWidth: 1,
                                dashArray: [4, 4],
                              );
                            },
                          ),
                          titlesData: FlTitlesData(
                            show: true,
                            bottomTitles: AxisTitles(
                              sideTitles: SideTitles(
                                    showTitles: false,
                                  ),
                                ),
                                leftTitles: const AxisTitles(
                              sideTitles: SideTitles(showTitles: false),
                            ),
                            rightTitles: const AxisTitles(
                              sideTitles: SideTitles(showTitles: false),
                            ),
                                topTitles: const AxisTitles(
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
                                  curveSmoothness: 0.5,
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
                                        strokeWidth: 3,
                                    strokeColor: Colors.white,
                                  );
                                },
                              ),
                              belowBarData: BarAreaData(
                                show: true,
                                gradient: LinearGradient(
                                  colors: OnboardingColors.optionButtonGradientColors
                                          .map((c) => c.withOpacity(0.15))
                                      .toList(),
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                ),
                              ),
                            ),
                          ],
                        ),
                          ),
                          // Custom week labels positioned at data points
                          Positioned.fill(
                            child: LayoutBuilder(
                              builder: (context, constraints) {
                                final chartWidth = constraints.maxWidth;
                                // fl_chart maps x values 1-4 across the chart width
                                // We need to calculate pixel positions for each week
                                final minX = 0.0;
                                final maxX = 5.0; // Chart goes from 0 to 5 (we use 1-4)
                                final pixelPerUnit = chartWidth / (maxX - minX);
                                
                                return Stack(
                                  children: [1, 2, 3, 4].map((week) {
                                    // Calculate x position: week 1 is at x=1, week 2 at x=2, etc.
                                    final xValue = week.toDouble();
                                    final xPosition = (xValue - minX) * pixelPerUnit;
                                    
                                    return Positioned(
                                      left: xPosition - 14,
                                      bottom: -24,
                                      child: Text(
                                        "W$week",
                                        style: TextStyle(
                                          fontSize: 13,
                                          color: Colors.white.withOpacity(0.7),
                                          fontWeight: FontWeight.w600,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                    );
                                  }).toList(),
                                );
                              },
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
          const SizedBox(height: 28),
          FadeTransition(
            opacity: _benefitAnimation,
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 18),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        OnboardingColors.optionButtonGradientColors.first.withOpacity(0.2),
                        OnboardingColors.optionButtonGradientColors.last.withOpacity(0.1),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: OnboardingColors.optionButtonGradientColors.first.withOpacity(0.3),
                      width: 1.5,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "Week 1",
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.white.withOpacity(0.5),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            "30%",
                  style: TextStyle(
                    fontSize: 28,
                              color: Colors.white.withOpacity(0.8),
                    fontWeight: FontWeight.bold,
                              letterSpacing: -0.5,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 32),
                      Container(
                        width: 50,
                        height: 3,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: OnboardingColors.optionButtonGradientColors,
                          ),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      const SizedBox(width: 32),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            "Week 4",
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.white.withOpacity(0.5),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            "90%",
                            style: TextStyle(
                              fontSize: 32,
                              color: OnboardingColors.optionButtonGradientColors.first,
                              fontWeight: FontWeight.bold,
                              letterSpacing: -0.5,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                const Text(
                  "3x more efficient in just 4 weeks. RocketLearn's AI handles the busywork - summaries, flashcards, practice questions - so you can focus on what actually matters: learning.",
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.white70,
                    height: 1.6,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildRocketLearnCapabilityScreen() {
    final learningStyles = _onboardingData.learningStyles ?? [];
    final hasExercises = learningStyles.contains("Practice exercises");
    final hasQuizzes = learningStyles.contains("Quizzes");
    final hasFlashcards = learningStyles.contains("Repetition");
    final hasSummaries = learningStyles.contains("Fast summaries");
    final hasGuidance = learningStyles.contains("Guided walkthrough");
    
    // Build list of capabilities based on user's learning styles
    final capabilities = <Map<String, dynamic>>[];
    
    if (hasSummaries || learningStyles.isEmpty) {
      capabilities.add({
        'title': 'AI-Powered Summaries',
        'icon': CupertinoIcons.doc_text,
        'description': 'Get instant summaries of any content',
      });
    }
    if (hasExercises || learningStyles.isEmpty) {
      capabilities.add({
        'title': 'Practice Exercises',
        'icon': CupertinoIcons.pencil_ellipsis_rectangle,
        'description': 'Generate custom practice problems',
      });
    }
    if (hasQuizzes || learningStyles.isEmpty) {
      capabilities.add({
        'title': 'Interactive Quizzes',
        'icon': CupertinoIcons.checkmark_circle,
        'description': 'Test your understanding instantly',
      });
    }
    if (hasFlashcards || learningStyles.isEmpty) {
      capabilities.add({
        'title': 'Smart Flashcards',
        'icon': CupertinoIcons.collections,
        'description': 'Create flashcards automatically',
      });
    }
    if (hasGuidance || learningStyles.isEmpty) {
      capabilities.add({
        'title': '24/7 AI Tutor',
        'icon': CupertinoIcons.chat_bubble_2,
        'description': 'Get help whenever you\'re stuck',
      });
    }
    
    return _buildScreenWithFixedButton(
      content: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(height: 20),
          FadeTransition(
            opacity: _benefitAnimation,
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: OnboardingColors.optionButtonGradientColors,
                    ),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    CupertinoIcons.rocket_fill,
                    size: 48,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                  "Great! You Can Do It\nWith RocketLearn",
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
                Text(
                  learningStyles.isNotEmpty
                      ? "Based on how you learn, here's how RocketLearn helps:"
                      : "Here's how RocketLearn helps you learn:",
                  style: const TextStyle(
                                fontSize: 16,
                    color: Color(0xFF9CA3AF),
                    height: 1.4,
                              ),
                  textAlign: TextAlign.center,
                            ),
                          ],
                      ),
                    ),
                    const SizedBox(height: 24),
          ...capabilities.map((capability) {
            return FadeTransition(
              opacity: _benefitAnimation,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Container(
                  padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: OnboardingColors.surfaceColor,
                    borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: OnboardingColors.borderColor,
                    width: 1.5,
                  ),
                ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: OnboardingColors.optionButtonGradientColors,
                          ),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          capability['icon'] as IconData,
                                color: Colors.white,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                            Text(
                              capability['title'] as String,
                              style: const TextStyle(
                                fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              capability['description'] as String,
                              style: const TextStyle(
                                fontSize: 14,
                                color: Color(0xFF9CA3AF),
                              ),
                            ),
                          ],
                              ),
                            ),
                          ],
                        ),
                    ),
              ),
            );
          }),
          const SizedBox(height: 20),
                  ],
                ),
              );
  }

  Widget _buildRocketLearnTransformationScreen() {
    final format = _onboardingData.difficultFormat?.toLowerCase() ?? '';
    final struggle = _onboardingData.reviewStruggle?.toLowerCase() ?? '';
    
    String title = "RocketLearn Makes It\nFun & Effortless";
    String description = "We transform your challenging content into engaging, easy-to-understand study materials that actually stick.";
    
    // Personalize based on format and struggle
    if (format.contains("pdf") || format.contains("word") || format.contains("paper")) {
      if (struggle.contains("dense") || struggle.contains("overload")) {
        description = "Those dense papers? We break them down into clear, digestible summaries. No more information overload - just the key insights you need.";
      } else if (struggle.contains("language") || struggle.contains("technical")) {
        description = "Complex academic language? We simplify it into plain English. Technical jargon becomes easy-to-understand concepts.";
      } else {
        description = "Long, boring papers become engaging summaries. Key points highlighted, main arguments clear - study smarter, not harder.";
      }
    } else if (format.contains("slide") || format.contains("powerpoint")) {
      if (struggle.contains("many") || struggle.contains("fragmented")) {
        description = "Hundreds of slides? We organize them into a coherent story. Fragmented information becomes a clear learning path.";
      } else {
        description = "Overwhelming slide decks become structured summaries. Every concept explained clearly, every connection made obvious.";
      }
    } else if (format.contains("audio") || format.contains("hearing")) {
      if (struggle.contains("long") || struggle.contains("time")) {
        description = "Hours of lectures? We transcribe and summarize them instantly. Get the key points without listening to everything.";
      } else if (struggle.contains("focus") || struggle.contains("notes")) {
        description = "Hard to focus while listening? We handle the note-taking. You get perfect transcripts and summaries automatically.";
      } else {
        description = "Audio lectures become searchable, summarized text. Find any topic instantly, review key points in minutes.";
      }
    } else if (format.contains("technical") || format.contains("documentation")) {
      if (struggle.contains("complex") || struggle.contains("technical")) {
        description = "Complex technical docs? We break them down into clear, understandable explanations. Technical jargon becomes plain language.";
      } else if (struggle.contains("find") || struggle.contains("search")) {
        description = "Can't find what you need? We organize and structure everything. Find any concept instantly, get clear explanations.";
      } else if (struggle.contains("jargon") || struggle.contains("terminology")) {
        description = "Confusing terminology? We explain every technical term in simple language. Complex concepts become easy to understand.";
      } else if (struggle.contains("example") || struggle.contains("practical")) {
        description = "Missing practical examples? We add clear examples and use cases. Abstract concepts become concrete and applicable.";
      } else {
        description = "Dry technical docs become engaging learning materials. Everything explained clearly, organized perfectly, ready to use.";
      }
    } else if (format.contains("video")) {
      if (struggle.contains("long") || struggle.contains("time")) {
        description = "Long video lectures? We extract the essentials. Watch what matters, skip the rest - or just read the summary.";
      } else if (struggle.contains("focus") || struggle.contains("notes")) {
        description = "Can't take notes while watching? We do it for you. Perfect transcripts, key moments highlighted, summaries ready.";
      } else {
        description = "Video lectures become interactive study materials. Transcripts, summaries, and key moments - all at your fingertips.";
      }
    } else if (format.contains("textbook") || format.contains("reading")) {
      description = "Dense textbooks become clear study guides. Chapters summarized, concepts explained, key points highlighted - learning made simple.";
    } else if (format.contains("note") || format.contains("own")) {
      if (struggle.contains("disorganized") || struggle.contains("find")) {
        description = "Messy notes? We organize and structure them perfectly. Find anything instantly, review effectively, study efficiently.";
      } else {
        description = "Your scattered notes become organized study materials. Everything structured, searchable, and ready for review.";
      }
    }
    
    final screenHeight = MediaQuery.of(context).size.height;
    final screenWidth = MediaQuery.of(context).size.width;
    // Make mascot bigger but ensure it fits on smallest iPhone (SE: 375x667)
    final mascotSize = (screenHeight * 0.38).clamp(280.0, 380.0);
    final maxMascotSize = (screenWidth - 80).clamp(280.0, 380.0);
    final finalMascotSize = mascotSize < maxMascotSize ? mascotSize : maxMascotSize;
    
    return _buildScreenWithFixedButton(
      enableContinue: true,
      content: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(height: screenHeight * 0.04),
          // Big mascot image with animation
          FadeTransition(
            opacity: _transitionMascotAnimation,
            child: ScaleTransition(
              scale: _transitionMascotScaleAnimation,
              child: MascotImage(
                imagePath: "assets/mascot/celebrate.png",
                width: finalMascotSize,
                height: finalMascotSize,
              ),
                      ),
                    ),
                    const SizedBox(height: 24),
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
                const SizedBox(height: 16),
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
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildAcademicGoalCallToActionScreen() {
    final goal = _onboardingData.academicGoal;
    String title = "Ready to Crush Your Goals?";
    String description = "RocketLearn is designed to help you achieve exactly what you want. Let's make it happen.";
    String actionText = "Let's Start";
    
    // Personalize based on academic goal
    if (goal != null) {
      switch (goal) {
        case "Ace courses":
          title = "Ready to Ace\nEvery Course?";
          description = "RocketLearn gives you the tools to dominate your classes. AI-powered summaries, flashcards, and practice questions - everything you need to excel.";
          actionText = "Start Acing Courses";
          break;
        case "Grad school/Job":
          title = "Ready to Land\nYour Dream Opportunity?";
          description = "Your future starts now. RocketLearn helps you master the skills and knowledge you need to get into grad school or land that dream job.";
          actionText = "Start Your Journey";
          break;
        case "High GPA":
          title = "Ready to Achieve\nThat Perfect GPA?";
          description = "Every assignment, every exam, every class - RocketLearn helps you stay on top of it all. Get the grades you deserve.";
          actionText = "Start Achieving";
          break;
        case "Learn skill":
          title = "Ready to Master\nNew Skills?";
          description = "Whether it's coding, languages, or any subject - RocketLearn breaks down complex topics into digestible, learnable chunks.";
          actionText = "Start Learning";
          break;
        case "Pass exams":
          title = "Ready to Pass\nWith Confidence?";
          description = "No more exam stress. RocketLearn creates personalized study materials, practice questions, and quizzes to ensure you're fully prepared.";
          actionText = "Start Preparing";
          break;
        case "Survive semester":
          title = "Ready to Survive\nThis Semester?";
          description = "We've got your back. RocketLearn takes the overwhelm out of studying, so you can get through this semester without burning out.";
          actionText = "Let's Survive Together";
          break;
        default:
          break;
      }
    }
    
    final screenHeight = MediaQuery.of(context).size.height;
    final screenWidth = MediaQuery.of(context).size.width;
    final mascotSize = (screenHeight * 0.38).clamp(280.0, 380.0);
    final maxMascotSize = (screenWidth - 80).clamp(280.0, 380.0);
    final finalMascotSize = mascotSize < maxMascotSize ? mascotSize : maxMascotSize;
    
    return _buildScreenWithFixedButton(
      enableContinue: true,
      onContinue: _nextStep,
      buttonText: actionText,
      content: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
          SizedBox(height: screenHeight * 0.04),
          // Mascot image with animation
          FadeTransition(
            opacity: _transitionMascotAnimation,
            child: ScaleTransition(
              scale: _transitionMascotScaleAnimation,
              child: MascotImage(
                imagePath: "assets/mascot/on-rocket.png",
                width: finalMascotSize,
                height: finalMascotSize,
              ),
            ),
          ),
          const SizedBox(height: 32),
          FadeTransition(
            opacity: _transitionTitleAnimation,
            child: SlideTransition(
              position: _transitionTitleSlideAnimation,
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 32,
                                fontWeight: FontWeight.bold,
                  color: Colors.white,
                  height: 1.2,
                  letterSpacing: -0.8,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
          const SizedBox(height: 20),
          FadeTransition(
            opacity: _transitionDescriptionAnimation,
            child: SlideTransition(
              position: _transitionDescriptionSlideAnimation,
              child: Text(
                description,
                style: const TextStyle(
                  fontSize: 16,
                  color: Colors.white70,
                  height: 1.6,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildRatingScreen() {
    final screenHeight = MediaQuery.of(context).size.height;
    final screenWidth = MediaQuery.of(context).size.width;
    final mascotSize = (screenHeight * 0.35).clamp(250.0, 350.0);
    final maxMascotSize = (screenWidth - 80).clamp(250.0, 350.0);
    final finalMascotSize = mascotSize < maxMascotSize ? mascotSize : maxMascotSize;
    
    return _buildScreenWithFixedButton(
      enableContinue: !_ratingCompleted,
      onContinue: () async {
        // Show the rating dialog when user clicks Rate Now
        try {
          final InAppReview inAppReview = InAppReview.instance;
          if (await inAppReview.isAvailable()) {
            // Request review - this will show the native dialog
            await inAppReview.requestReview();
            // Mark rating as completed
            if (mounted) {
              setState(() {
                _ratingCompleted = true;
              });
            }
            // Wait 2.5 seconds before navigating to next screen
            await Future.delayed(const Duration(milliseconds: 2500));
            if (mounted && _currentStep == 11) {
              _nextStep();
            }
          } else {
            // If review is not available, mark as completed and navigate after delay
            if (mounted) {
              setState(() {
                _ratingCompleted = true;
              });
            }
            await Future.delayed(const Duration(seconds: 5));
            if (mounted && _currentStep == 11) {
              _nextStep();
            }
          }
        } catch (e) {
          print('Error requesting review: $e');
          // On error, mark as completed and navigate after delay
          if (mounted) {
            setState(() {
              _ratingCompleted = true;
            });
          }
          await Future.delayed(const Duration(seconds: 5));
          if (mounted && _currentStep == 11) {
            _nextStep();
          }
        }
      },
      buttonText: _ratingCompleted ? "Thank you!" : "Continue",
      trailingIcon: _ratingCompleted ? CupertinoIcons.checkmark : CupertinoIcons.arrow_right,
      content: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(height: screenHeight * 0.04),
          // Mascot image with animation
          FadeTransition(
            opacity: _transitionMascotAnimation,
            child: ScaleTransition(
              scale: _transitionMascotScaleAnimation,
              child: MascotImage(
                imagePath: "assets/mascot/celebrate.png",
                width: finalMascotSize,
                height: finalMascotSize,
              ),
            ),
          ),
          const SizedBox(height: 32),
          // Title with stars
          const Text(
            "Love RocketLearn?",
            style: TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.bold,
              color: Colors.white,
              letterSpacing: -0.8,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(5, (index) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Icon(
                CupertinoIcons.star_fill,
                color: OnboardingColors.optionButtonGradientColors.first,
                size: 32,
              ),
            )),
          ),
          const SizedBox(height: 24),
          const Text(
            "Your feedback helps us improve and reach more students like you",
            style: TextStyle(
              fontSize: 16,
              color: Colors.white70,
              height: 1.6,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildPersonalizedPlanScreen() {
    return _PersonalizedPlanBuilder(
      onComplete: _nextStep,
      scrollController: _planScrollController,
    );
  }

  Widget _buildPlanSuccessScreen() {
    final studentStatus = _onboardingData.studentStatus;
    final goal = _onboardingData.academicGoal;
    final learningStyles = _onboardingData.learningStyles ?? [];
    final studyProblems = _onboardingData.studyProblems ?? [];
    final difficultFormat = _onboardingData.difficultFormat;
    
    // Build personalized title based on student status and academic goal
    String title = "We've created the perfect plan\nfor you to achieve your goals";
    
    if (studentStatus == "Professional") {
      // Business professional / Working adult
      if (goal == "Grad school/Job") {
        title = "We've created the perfect plan\nfor your career advancement";
      } else if (goal == "Learn skill") {
        title = "We've created the perfect plan\nto accelerate your professional growth";
      } else if (goal == "Pass exams") {
        title = "We've created the perfect plan\nto help you ace your professional exams";
      } else {
        title = "We've created the perfect plan\nto help you excel in your career";
      }
    } else if (studentStatus == "Certification") {
      // Preparing for certification
      if (goal == "Pass exams") {
        title = "We've created the perfect plan\nto help you pass your certification";
      } else if (goal == "Learn skill") {
        title = "We've created the perfect plan\nto master your certification skills";
      } else {
        title = "We've created the perfect plan\nto help you get certified";
      }
    } else if (studentStatus == "Teacher") {
      // Teacher or Educator
      if (goal == "Learn skill") {
        title = "We've created the perfect plan\nto enhance your teaching skills";
      } else {
        title = "We've created the perfect plan\nto support your educational goals";
      }
    } else if (studentStatus == "Lifelong Learner") {
      // Lifelong Learner
      if (goal == "Learn skill") {
        title = "We've created the perfect plan\nfor your continuous learning journey";
      } else {
        title = "We've created the perfect plan\nto fuel your curiosity";
      }
    } else if (studentStatus == "Student") {
      // Student (High School, College, or Grad)
      if (goal == "Ace courses") {
        title = "We've created the perfect plan\nfor you to ace all your courses";
      } else if (goal == "Grad school/Job") {
        title = "We've created the perfect plan\nto help you land your dream opportunity";
      } else if (goal == "High GPA") {
        title = "We've created the perfect plan\nfor you to achieve that perfect GPA";
      } else if (goal == "Learn skill") {
        title = "We've created the perfect plan\nfor you to master new skills";
      } else if (goal == "Pass exams") {
        title = "We've created the perfect plan\nfor you to pass your exams with confidence";
      } else if (goal == "Survive semester") {
        title = "We've created the perfect plan\nto help you survive this semester";
      } else {
        title = "We've created the perfect plan\nfor your academic success";
      }
    } else {
      // Other or default
      if (goal == "Learn skill") {
        title = "We've created the perfect plan\nfor you to master new skills";
      } else if (goal == "Grad school/Job") {
        title = "We've created the perfect plan\nto help you reach your goals";
      } else {
        title = "We've created the perfect plan\nfor you to achieve your goals";
      }
    }
    
    // Build personalized description text based on student status
    String descriptionText = "Based on your answers, we've customized RocketLearn to match your unique learning style:";
    
    if (studentStatus == "Professional") {
      descriptionText = "Based on your professional needs, we've customized RocketLearn to help you learn efficiently:";
    } else if (studentStatus == "Certification") {
      descriptionText = "Based on your certification goals, we've customized RocketLearn to help you prepare effectively:";
    } else if (studentStatus == "Teacher") {
      descriptionText = "Based on your teaching needs, we've customized RocketLearn to support your educational goals:";
    } else if (studentStatus == "Lifelong Learner") {
      descriptionText = "Based on your learning preferences, we've customized RocketLearn to fuel your curiosity:";
    } else if (studentStatus == "Student") {
      descriptionText = "Based on your answers, we've customized RocketLearn to match your unique learning style:";
    }
    
    // Build personalized text snippets based on user's answers
    final List<String> personalizedSnippets = [];
    
    // Add snippets based on learning styles (with status-specific wording)
    if (learningStyles.contains("Fast summaries")) {
      if (studentStatus == "Professional") {
        personalizedSnippets.add("Quick AI summaries to help you stay on top of your workload");
      } else if (studentStatus == "Certification") {
        personalizedSnippets.add("AI-powered summaries of certification materials tailored to your pace");
      } else {
        personalizedSnippets.add("AI-powered summaries tailored to your learning pace");
      }
    }
    if (learningStyles.contains("Practice exercises")) {
      if (studentStatus == "Professional") {
        personalizedSnippets.add("Practical exercises to reinforce your professional skills");
      } else if (studentStatus == "Certification") {
        personalizedSnippets.add("Certification-style practice exercises to test your knowledge");
      } else {
        personalizedSnippets.add("Custom practice exercises to reinforce your understanding");
      }
    }
    if (learningStyles.contains("Quizzes")) {
      if (studentStatus == "Professional") {
        personalizedSnippets.add("Interactive quizzes to validate your professional knowledge");
      } else if (studentStatus == "Certification") {
        personalizedSnippets.add("Exam-style quizzes to prepare you for your certification");
      } else {
        personalizedSnippets.add("Interactive quizzes to test your knowledge");
      }
    }
    if (learningStyles.contains("Repetition")) {
      if (studentStatus == "Professional") {
        personalizedSnippets.add("Smart flashcards for efficient professional skill retention");
      } else if (studentStatus == "Certification") {
        personalizedSnippets.add("Smart flashcards for spaced repetition of key concepts");
      } else {
        personalizedSnippets.add("Smart flashcards for spaced repetition");
      }
    }
    if (learningStyles.contains("Guided walkthrough")) {
      if (studentStatus == "Professional") {
        personalizedSnippets.add("24/7 AI tutor ready to guide you through complex topics");
      } else if (studentStatus == "Certification") {
        personalizedSnippets.add("24/7 AI tutor to help you master certification material");
      } else {
        personalizedSnippets.add("24/7 AI tutor ready to guide you step-by-step");
      }
    }
    
    // Add snippets based on study problems (with status-specific wording)
    if (studyProblems.contains("Too much content")) {
      if (studentStatus == "Professional") {
        personalizedSnippets.add("Break down complex professional content into manageable insights");
      } else if (studentStatus == "Certification") {
        personalizedSnippets.add("Organize certification materials into digestible study chunks");
      } else {
        personalizedSnippets.add("Break down overwhelming content into manageable chunks");
      }
    }
    if (studyProblems.contains("Hard to remember")) {
      if (studentStatus == "Professional") {
        personalizedSnippets.add("Memory techniques optimized for busy professionals");
      } else if (studentStatus == "Certification") {
        personalizedSnippets.add("Memory techniques to help you retain certification knowledge");
      } else {
        personalizedSnippets.add("Memory techniques optimized for your learning style");
      }
    }
    if (studyProblems.contains("Not engaging")) {
      if (studentStatus == "Professional") {
        personalizedSnippets.add("Engaging, interactive methods that fit into your busy schedule");
      } else if (studentStatus == "Certification") {
        personalizedSnippets.add("Engaging study methods to keep you motivated during prep");
      } else {
        personalizedSnippets.add("Engaging, interactive study methods that keep you motivated");
      }
    }
    
    // Add snippet based on difficult format
    if (difficultFormat != null) {
      if (studentStatus == "Professional") {
        personalizedSnippets.add("Specialized tools for mastering ${difficultFormat.toLowerCase()} content in your field");
      } else if (studentStatus == "Certification") {
        personalizedSnippets.add("Specialized tools for mastering ${difficultFormat.toLowerCase()} certification materials");
      } else {
        personalizedSnippets.add("Specialized tools for mastering ${difficultFormat.toLowerCase()} content");
      }
    }
    
    // If no specific snippets, add default ones based on status
    if (personalizedSnippets.isEmpty) {
      if (studentStatus == "Professional") {
        personalizedSnippets.addAll([
          "AI-powered summaries tailored to your professional needs",
          "Interactive quizzes and practice exercises for skill building",
          "24/7 AI tutor ready to help you succeed in your career",
        ]);
      } else if (studentStatus == "Certification") {
        personalizedSnippets.addAll([
          "AI-powered summaries of certification materials",
          "Exam-style practice questions and quizzes",
          "24/7 AI tutor to help you pass your certification",
        ]);
      } else {
        personalizedSnippets.addAll([
          "AI-powered summaries tailored to your needs",
          "Interactive quizzes and practice exercises",
          "24/7 AI tutor ready to help you succeed",
        ]);
      }
    }
    
    // Limit to 3 snippets for better UI
    final displaySnippets = personalizedSnippets.take(3).toList();
    
    final screenHeight = MediaQuery.of(context).size.height;
    final screenWidth = MediaQuery.of(context).size.width;
    final mascotSize = (screenHeight * 0.35).clamp(250.0, 350.0);
    final maxMascotSize = (screenWidth - 80).clamp(250.0, 350.0);
    final finalMascotSize = mascotSize < maxMascotSize ? mascotSize : maxMascotSize;
    
    return _buildScreenWithFixedButton(
      enableContinue: _transitionButtonEnabled,
      onContinue: _nextStep,
      buttonText: "Let's Get Started",
      trailingIcon: CupertinoIcons.arrow_right,
      content: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(height: screenHeight * 0.04),
          // Success mascot image with animation
          FadeTransition(
            opacity: _transitionMascotAnimation,
            child: ScaleTransition(
              scale: _transitionMascotScaleAnimation,
              child: MascotImage(
                imagePath: "assets/mascot/success.png",
                width: finalMascotSize,
                height: finalMascotSize,
              ),
            ),
          ),
          const SizedBox(height: 32),
          // Title with animation
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
          // Description with animation
          FadeTransition(
            opacity: _transitionDescriptionAnimation,
            child: SlideTransition(
              position: _transitionDescriptionSlideAnimation,
              child: Column(
                children: [
                  Text(
                    descriptionText,
                    style: const TextStyle(
                      fontSize: 16,
                      color: Colors.white70,
                      height: 1.6,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  // Personalized snippets
                  ...displaySnippets.map((snippet) => Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(top: 6, right: 12),
                          child: Icon(
                            CupertinoIcons.checkmark_circle_fill,
                            color: OnboardingColors.optionButtonGradientColors.first,
                            size: 20,
                          ),
                        ),
                        Expanded(
                          child: Text(
                            snippet,
                            style: const TextStyle(
                              fontSize: 15,
                              color: Colors.white,
                              height: 1.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  )),
                ],
              ),
            ),
          ),
          const SizedBox(height: 40),
        ],
      ),
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

  _Option(this.text, this.icon);
}

class _EnhancedOptionButton extends StatefulWidget {
  final String text;
  final IconData? icon;
  final bool isSelected;
  final VoidCallback onTap;

  const _EnhancedOptionButton({
    required this.text,
    this.icon,
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
              if (widget.icon != null)
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
              if (widget.icon != null) const SizedBox(width: 16),
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

// Multi-select option button with checkbox indicator
class _MultiSelectOptionButton extends StatefulWidget {
  final String text;
  final IconData? icon;
  final bool isSelected;
  final VoidCallback onTap;

  const _MultiSelectOptionButton({
    required this.text,
    this.icon,
    required this.isSelected,
    required this.onTap,
  });

  @override
  State<_MultiSelectOptionButton> createState() => _MultiSelectOptionButtonState();
}

class _MultiSelectOptionButtonState extends State<_MultiSelectOptionButton>
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
              // Checkbox indicator on the left
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: widget.isSelected
                      ? Colors.white
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: widget.isSelected
                        ? Colors.white
                        : Colors.white.withOpacity(0.4),
                    width: 2,
                  ),
                ),
                child: widget.isSelected
                    ? const Icon(
                        CupertinoIcons.checkmark,
                        color: Color(0xFF8D1647),
                        size: 16,
                      )
                    : null,
              ),
              const SizedBox(width: 16),
              if (widget.icon != null)
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
              if (widget.icon != null) const SizedBox(width: 16),
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
  final ScrollController? scrollController;

  const _PersonalizedPlanBuilder({
    required this.onComplete,
    this.scrollController,
  });

  @override
  State<_PersonalizedPlanBuilder> createState() => _PersonalizedPlanBuilderState();
}

class _PersonalizedPlanBuilderState extends State<_PersonalizedPlanBuilder>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  int _completedItems = 0;
  double _progress = 0.0;
  bool _animationCompleted = false;
  
  final List<String> _planItems = [
    "AI-Powered Summaries",
    "24/7 AI Tutor Chat",
    "Smart Flashcards",
    "Interactive Quizzes",
    "Practice Exercises",
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
        // Check if animation is completed
        if (_controller.isCompleted && !_animationCompleted) {
          _animationCompleted = true;
        }
      });
    });

    _controller.forward().then((_) {
      if (mounted) {
        setState(() {
          _animationCompleted = true;
        });
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            controller: widget.scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
                const SizedBox(height: 20),
          Text(
            "${(_progress * 100).toInt()}%",
            style: const TextStyle(
                    fontSize: 56,
              fontWeight: FontWeight.bold,
              color: Colors.white,
              letterSpacing: -1.5,
            ),
          ),
                const SizedBox(height: 12),
          const Text(
            "Creating Your Personalized Plan",
            style: TextStyle(
                    fontSize: 18,
              color: Colors.white,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
                OnboardingProgressBar(progress: _progress, height: 10),
                const SizedBox(height: 12),
          Text(
                  _progress < 0.5
                ? "Analyzing your learning style..."
                    : _progress < 0.9
                          ? "Customizing study features..."
                        : "Almost ready!",
            style: const TextStyle(
                    fontSize: 15,
              color: Color(0xFF9CA3AF),
            ),
          ),
                const SizedBox(height: 20),
          Container(
                  padding: const EdgeInsets.all(20),
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
                    mainAxisSize: MainAxisSize.min,
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
                                    fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              letterSpacing: -0.5,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            "Tailored just for you",
                            style: TextStyle(
                                    fontSize: 13,
                              color: Color(0xFF9CA3AF),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                      const SizedBox(height: 20),
                ...List.generate(_planItems.length, (index) {
                  return Padding(
                          padding: EdgeInsets.only(bottom: index < _planItems.length - 1 ? 12 : 0),
                    child: _buildPlanItem(_planItems[index], _completedItems > index),
                  );
                }),
              ],
            ),
          ),
                const SizedBox(height: 40),
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
            onPressed: _animationCompleted ? widget.onComplete : null,
          ),
      ),
      ],
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
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 16,
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


