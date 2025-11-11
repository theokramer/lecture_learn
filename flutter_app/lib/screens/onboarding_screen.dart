import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';
import '../models/onboarding_data.dart';
import '../services/onboarding_service.dart';
import '../widgets/onboarding/progress_bar.dart';
import '../widgets/onboarding/mascot_image.dart';
import '../constants/onboarding_colors.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen>
    with TickerProviderStateMixin {
  int _currentStep = 0;
  OnboardingData _onboardingData = OnboardingData();
  
  late AnimationController _fadeController;
  late AnimationController _slideController;
  late AnimationController _scaleController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;
  late Animation<double> _scaleAnimation;

  // Total number of steps - reorganized flow with transitions every 4-6 questions
  static const int totalSteps = 24;

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

    _fadeController.forward();
    _slideController.forward();
    _scaleController.forward();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _slideController.dispose();
    _scaleController.dispose();
    super.dispose();
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
    }
  }

  Future<void> _completeOnboarding() async {
    await OnboardingService.completeOnboarding(_onboardingData.toJson());
    if (mounted) {
      context.go('/login');
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
      // Questions 1-4 (Student status, Learning style, Difficult format, Study problem)
      case 1:
        return _buildQuestionScreen(
          title: "What best describes your current student status?",
          subtitle: "Help us personalize your learning experience",
          options: [
            _Option("High School", CupertinoIcons.building_2_fill),
            _Option("College/University", CupertinoIcons.book),
            _Option("Grad School", CupertinoIcons.person),
            _Option("Certification", CupertinoIcons.star),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              studentStatus: ["High School", "College/University", "Grad School", "Certification"][index],
            );
          },
          selectedIndex: ["High School", "College/University", "Grad School", "Certification"]
              .indexWhere((e) => e == _onboardingData.studentStatus),
        );
      case 2:
        return _buildQuestionScreen(
          title: "Which phrase best describes your learning style?",
          subtitle: "Choose the feature you need most",
          options: [
            _Option("I need things broken down simply.", CupertinoIcons.square_grid_2x2),
            _Option("I need personalized practice questions.", CupertinoIcons.checkmark_circle),
            _Option("I need someone to walk me through the material.", CupertinoIcons.person_2),
            _Option("I need both speed and depth.", CupertinoIcons.bolt),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              learningStyle: ["Simple breakdown", "Practice questions", "Guided walkthrough", "Speed and depth"][index],
            );
          },
          selectedIndex: ["Simple breakdown", "Practice questions", "Guided walkthrough", "Speed and depth"]
              .indexWhere((e) => e == _onboardingData.learningStyle),
        );
      case 3:
        return _buildQuestionScreen(
          title: "Which format do you find most difficult to learn from?",
          subtitle: "We'll help you master any format",
          options: [
            _Option("Long, dense textbooks", CupertinoIcons.doc_text),
            _Option("Rapid-fire lecture slides", CupertinoIcons.rectangle_stack),
            _Option("Complex PDF articles", CupertinoIcons.doc),
            _Option("Unorganized notes", CupertinoIcons.doc_on_doc),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              difficultFormat: ["Textbooks", "Lecture slides", "PDF articles", "Unorganized notes"][index],
            );
          },
          selectedIndex: ["Textbooks", "Lecture slides", "PDF articles", "Unorganized notes"]
              .indexWhere((e) => e == _onboardingData.difficultFormat),
        );
      case 4:
        return _buildQuestionScreen(
          title: "What's the biggest problem with your current study routine?",
          subtitle: "We'll help you address this directly",
          options: [
            _Option("Too much time wasted", CupertinoIcons.clock),
            _Option("Material is overwhelming", CupertinoIcons.exclamationmark_triangle),
            _Option("Poor retention/Memory", CupertinoIcons.circle_grid_3x3),
            _Option("Lack of motivation", CupertinoIcons.square),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              studyProblem: ["Time wasted", "Overwhelming", "Poor retention", "Lack of motivation"][index],
            );
          },
          selectedIndex: ["Time wasted", "Overwhelming", "Poor retention", "Lack of motivation"]
              .indexWhere((e) => e == _onboardingData.studyProblem),
        );
      // Transition 1: After 4 questions
      case 5:
        return _buildTransitionScreen(
          title: "We'll Help You Master\nAny Format",
          description: "Whether it's dense textbooks, rapid slides, or complex PDFs - our AI breaks everything down into digestible, learnable chunks.",
          mascotPath: "assets/mascot/ChatGPT Image Nov 10, 2025 at 03_54_21 PM.png",
        );
      // Questions 5-8 (Review struggle, Stuck strategy, Exam readiness, Engagement)
      case 6:
        return _buildQuestionScreen(
          title: "When you review lecture material, do you primarily struggle with:",
          subtitle: "Understanding your struggle helps us help you better",
          options: [
            _Option("Understanding the Core Concept", CupertinoIcons.lightbulb),
            _Option("Remembering the Specific Details", CupertinoIcons.circle_grid_3x3),
            _Option("Applying the Information", CupertinoIcons.wrench),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              reviewStruggle: ["Core concepts", "Specific details", "Application"][index],
            );
          },
          selectedIndex: ["Core concepts", "Specific details", "Application"]
              .indexWhere((e) => e == _onboardingData.reviewStruggle),
        );
      case 7:
        return _buildQuestionScreen(
          title: "When you get stuck, what's your current strategy to understand a tough topic?",
          subtitle: "Let's find you a better solution",
          options: [
            _Option("Google/YouTube", CupertinoIcons.play_circle),
            _Option("Ask a classmate", CupertinoIcons.person_2),
            _Option("Email the Professor", CupertinoIcons.mail),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              stuckStrategy: ["Google/YouTube", "Ask classmate", "Email professor"][index],
            );
          },
          selectedIndex: ["Google/YouTube", "Ask classmate", "Email professor"]
              .indexWhere((e) => e == _onboardingData.stuckStrategy),
        );
      case 8:
        return _buildQuestionScreen(
          title: "How often do you feel completely ready for a major exam (e.g., no anxiety)?",
          subtitle: "Let's change this for the better",
          options: [
            _Option("Never", CupertinoIcons.smiley),
            _Option("Rarely", CupertinoIcons.smiley),
            _Option("Sometimes", CupertinoIcons.smiley),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              examReadiness: ["Never", "Rarely", "Sometimes"][index],
            );
          },
          selectedIndex: ["Never", "Rarely", "Sometimes"]
              .indexWhere((e) => e == _onboardingData.examReadiness),
        );
      case 9:
        return _buildQuestionScreen(
          title: "How important is it to you that studying feels engaging and maybe even fun?",
          subtitle: "Your experience matters to us",
          options: [
            _Option("Not important", CupertinoIcons.smiley),
            _Option("Somewhat important", CupertinoIcons.smiley),
            _Option("Very important", CupertinoIcons.smiley),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              engagementImportance: ["Not important", "Somewhat important", "Very important"][index],
            );
          },
          selectedIndex: ["Not important", "Somewhat important", "Very important"]
              .indexWhere((e) => e == _onboardingData.engagementImportance),
        );
      // Transition 2: After 4 more questions (total 8)
      case 10:
        return _buildTransitionScreen(
          title: "Your AI Tutor is Ready 24/7",
          description: "Stuck on a concept? Your personalized AI tutor is always available to explain things simply, at your pace, using your own materials.",
          mascotPath: "assets/mascot/ChatGPT Image Nov 10, 2025 at 03_54_21 PM.png",
        );
      // Questions 9-12 (Stressful subject, Hours, Daily time, Academic goal)
      case 11:
        return _buildQuestionScreen(
          title: "What is the one subject that causes you the most stress this term?",
          subtitle: "We'll focus on helping you with this area",
          options: [
            _Option("Math/Science", CupertinoIcons.number),
            _Option("Writing/Humanities", CupertinoIcons.pencil_ellipsis_rectangle),
            _Option("Technical/Coding", CupertinoIcons.chevron_left_slash_chevron_right),
            _Option("I'm stressed about all of them", CupertinoIcons.smiley),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              stressfulSubject: ["Math/Science", "Writing/Humanities", "Technical/Coding", "All of them"][index],
            );
          },
          selectedIndex: ["Math/Science", "Writing/Humanities", "Technical/Coding", "All of them"]
              .indexWhere((e) => e == _onboardingData.stressfulSubject),
        );
      case 12:
        return _buildQuestionScreen(
          title: "On average, how many hours per week do you spend organizing and summarizing notes?",
          subtitle: "Let's see how much time we can save you",
          options: [
            _Option("1-3 hours", null, number: "1"),
            _Option("4-6 hours", null, number: "4"),
            _Option("7-10 hours", null, number: "7"),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              hoursPerWeek: [3, 6, 10][index],
            );
          },
          selectedIndex: [3, 6, 10].indexWhere((e) => e == _onboardingData.hoursPerWeek),
        );
      case 13:
        return _buildQuestionScreen(
          title: "How much time are you ready to invest each day to truly improve your grades?",
          subtitle: "Your commitment level helps us personalize your experience",
          options: [
            _Option("30 min", CupertinoIcons.clock),
            _Option("1 hour", CupertinoIcons.timer),
            _Option("2 hours", CupertinoIcons.timer),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              dailyTimeCommitment: [30, 60, 120][index],
            );
          },
          selectedIndex: [30, 60, 120].indexWhere((e) => e == _onboardingData.dailyTimeCommitment),
        );
      case 14:
        return _buildQuestionScreen(
          title: "What is your ultimate academic goal for the next 12 months?",
          subtitle: "Let's work together to make it happen",
          options: [
            _Option("Acing my current courses", CupertinoIcons.star),
            _Option("Getting into Grad School/Job", CupertinoIcons.briefcase),
            _Option("Maintaining a high GPA", CupertinoIcons.chart_bar),
            _Option("Learning a key skill", CupertinoIcons.star),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              academicGoal: ["Ace courses", "Grad school/Job", "High GPA", "Learn skill"][index],
            );
          },
          selectedIndex: ["Ace courses", "Grad school/Job", "High GPA", "Learn skill"]
              .indexWhere((e) => e == _onboardingData.academicGoal),
        );
      // Transition 3: After 4 more questions (total 12)
      case 15:
        return _buildTransitionScreen(
          title: "Stop Summarizing.\nStart Learning.",
          description: "Did you know students using Nano AI reduce note organization time by up to 75%? We handle the boring stuff.",
          mascotPath: "assets/mascot/ChatGPT Image Nov 10, 2025 at 02_21_54 PM.png",
        );
      // Questions 13-14 (Extra time, Free time feeling)
      case 16:
        return _buildQuestionScreen(
          title: "If you could instantly reduce your overall weekly study time by 50%, what would you do with the extra time?",
          subtitle: "Dream big - this could be your reality",
          options: [
            _Option("Sleep more", CupertinoIcons.bed_double),
            _Option("Spend time with friends", CupertinoIcons.person_2),
            _Option("Take on a new project", CupertinoIcons.rocket),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              extraTimeUsage: ["Sleep", "Friends", "New project"][index],
            );
          },
          selectedIndex: ["Sleep", "Friends", "New project"]
              .indexWhere((e) => e == _onboardingData.extraTimeUsage),
        );
      case 17:
        return _buildQuestionScreen(
          title: "If you had an extra 10 hours of free time this week, what would it feel like?",
          subtitle: "Visualize your success",
          options: [
            _Option("Less stressed", CupertinoIcons.smiley),
            _Option("More confident", CupertinoIcons.hand_raised),
            _Option("Recharged/Refreshed", CupertinoIcons.battery_charging),
          ],
          onSelect: (index) {
            _onboardingData = _onboardingData.copyWith(
              freeTimeFeeling: ["Less stressed", "More confident", "Recharged"][index],
            );
          },
          selectedIndex: ["Less stressed", "More confident", "Recharged"]
              .indexWhere((e) => e == _onboardingData.freeTimeFeeling),
        );
      // Transition 4: After final 2 questions
      case 18:
        return _buildTransitionScreen(
          title: "Imagine Study Time Cut by 50%",
          description: "Our AI reads your PDFs, Slides, and Notes in seconds, creating instant, targeted summaries. More learning, less effort.",
          mascotPath: "assets/mascot/ChatGPT Image Nov 10, 2025 at 03_54_21 PM.png",
        );
      // Transition 5: Feature highlight
      case 19:
        return _buildTransitionScreen(
          title: "Make Learning FUN Again",
          description: "We turn your boring lecture slides into interactive quizzes and clear conversation flows. Effortless study, guaranteed.",
          mascotPath: "assets/mascot/ChatGPT Image Nov 10, 2025 at 02_21_54 PM.png",
        );
      // Transition 6: Final feature
      case 20:
        return _buildTransitionScreen(
          title: "Stuck? Never Again.",
          description: "Your personalized AI Tutor is ready 24/7. Get complex topics explained simply, at your pace, using your own uploaded materials.",
          mascotPath: "assets/mascot/ChatGPT Image Nov 10, 2025 at 03_54_21 PM.png",
        );
      case 21:
        return _buildPersonalizedPlanScreen();
      case 22:
        return _buildNotificationScreen();
      case 23:
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
          const Spacer(),
          // Big mascot image - using latest image
          Hero(
            tag: 'mascot',
            child: MascotImage(
              imagePath: "assets/mascot/ChatGPT Image Nov 10, 2025 at 03_54_21 PM.png",
              width: 280,
              height: 280,
            ),
          ),
          const SizedBox(height: 48),
          const Text(
            "Welcome to Nano AI",
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
          const Spacer(),
          _LargeGradientButton(
            text: "Get Started",
            trailingIcon: CupertinoIcons.arrow_right,
            onPressed: _nextStep,
          ),
          const SizedBox(height: 20),
          const Text(
            "By continuing, you agree to our Terms of Service\nand Privacy Policy.",
            style: TextStyle(
              fontSize: 11,
              color: Color(0xFF9CA3AF),
              height: 1.4,
            ),
            textAlign: TextAlign.center,
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
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 24),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                    height: 1.2,
                    letterSpacing: -0.5,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 15,
                    color: Colors.white70,
                    fontWeight: FontWeight.w400,
                    height: 1.4,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 36),
                ...options.asMap().entries.map((entry) {
                  final index = entry.key;
                  final option = entry.value;
                  return _EnhancedOptionButton(
                    text: option.text,
                    icon: option.icon,
                    number: option.number,
                    isSelected: selectedIndex == index,
                    onTap: () {
                      onSelect(index);
                      setState(() {});
                    },
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
            onPressed: selectedIndex != null ? _nextStep : null,
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
            width: 280,
            height: 280,
          ),
          const SizedBox(height: 48),
          Text(
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
          const SizedBox(height: 24),
          Text(
            description,
            style: const TextStyle(
              fontSize: 15,
              color: Colors.white70,
              height: 1.6,
            ),
            textAlign: TextAlign.center,
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
                  "Nano AI would like to send you notifications",
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
                        onPressed: _nextStep,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: _PrimaryButton(
                        text: "Allow",
                        onPressed: () async {
                          final status = await Permission.notification.request();
                          if (status.isGranted) {
                            HapticFeedback.mediumImpact();
                          }
                          _nextStep();
                        },
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
            onPressed: _nextStep,
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
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
          Container(
            padding: const EdgeInsets.all(28),
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
                  "4.8",
                  style: TextStyle(
                    fontSize: 56,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(
                    5,
                    (index) => const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 2),
                      child: Icon(
                        CupertinoIcons.star_fill,
                        color: Color(0xFFFFB800),
                        size: 28,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  "200+ App Ratings",
                  style: TextStyle(
                    fontSize: 15,
                    color: Color(0xFF9CA3AF),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          const Text(
            "Nano AI was made for people like you",
            style: TextStyle(
              fontSize: 18,
              color: Colors.white,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.2,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildTestimonialAvatar(),
              const SizedBox(width: -12),
              _buildTestimonialAvatar(),
              const SizedBox(width: -12),
              _buildTestimonialAvatar(),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                CupertinoIcons.person_2,
                color: Color(0xFFB85A3A),
                size: 22,
              ),
              const SizedBox(width: 10),
              const Text(
                "10K+ Nano AI Users",
                style: TextStyle(
                  fontSize: 17,
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 40),
          Container(
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
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "Sarah Miller",
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          SizedBox(height: 4),
                          Row(
                            children: [
                              Icon(
                                CupertinoIcons.star_fill,
                                color: Color(0xFFFFB800),
                                size: 16,
                              ),
                              SizedBox(width: 4),
                              Icon(
                                CupertinoIcons.star_fill,
                                color: Color(0xFFFFB800),
                                size: 16,
                              ),
                              SizedBox(width: 4),
                              Icon(
                                CupertinoIcons.star_fill,
                                color: Color(0xFFFFB800),
                                size: 16,
                              ),
                              SizedBox(width: 4),
                              Icon(
                                CupertinoIcons.star_fill,
                                color: Color(0xFFFFB800),
                                size: 16,
                              ),
                              SizedBox(width: 4),
                              Icon(
                                CupertinoIcons.star_fill,
                                color: Color(0xFFFFB800),
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
                const Text(
                  "This app is incredible! So much cheaper than a tutor and it really works. The AI explanations are so clear and easy to understand!",
                  style: TextStyle(
                    fontSize: 15,
                    color: Color(0xFF9CA3AF),
                    height: 1.6,
                  ),
                ),
              ],
            ),
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

  Widget _buildTestimonialAvatar() {
    return Container(
      width: 52,
      height: 52,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: OnboardingColors.buttonGradientColors.take(2).toList(),
        ),
        shape: BoxShape.circle,
        border: Border.all(
          color: OnboardingColors.backgroundColor,
          width: 3,
        ),
      ),
      child: const Icon(
        CupertinoIcons.person,
        color: Colors.white,
        size: 26,
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
      duration: const Duration(milliseconds: 100),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.95).animate(
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
    HapticFeedback.selectionClick();
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
          margin: const EdgeInsets.only(bottom: 12),
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
      duration: const Duration(milliseconds: 100),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.97).animate(
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
    return GestureDetector(
      onTapDown: isEnabled ? (_) => _pressController.forward() : null,
      onTapUp: isEnabled
          ? (_) {
              _pressController.reverse();
              HapticFeedback.mediumImpact();
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
                  color: isEnabled ? Colors.white : OnboardingColors.disabledTextColor,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                ),
              ),
              if (widget.trailingIcon != null && isEnabled) ...[
                const SizedBox(width: 12),
                Icon(
                  widget.trailingIcon,
                  color: Colors.white,
                  size: 24,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// Primary button for notifications
class _PrimaryButton extends StatelessWidget {
  final String text;
  final VoidCallback onPressed;

  const _PrimaryButton({
    required this.text,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: OnboardingColors.notificationButtonGradientColors,
        ),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: OnboardingColors.notificationButtonGradientColors.first.withOpacity(0.4),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: CupertinoButton(
        padding: EdgeInsets.zero,
        onPressed: () {
          HapticFeedback.mediumImpact();
          onPressed();
        },
        child: Text(
          text,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 17,
            fontWeight: FontWeight.w600,
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

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    );

    _controller.addListener(() {
      setState(() {
        _progress = _controller.value * 0.17;
        if (_controller.value > 0.25 && _completedItems == 0) {
          _completedItems = 1;
        } else if (_controller.value > 0.5 && _completedItems == 1) {
          _completedItems = 2;
        } else if (_controller.value > 0.75 && _completedItems == 2) {
          _completedItems = 3;
        } else if (_controller.value > 0.9 && _completedItems == 3) {
          _completedItems = 4;
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
            "Setting up your learning journey",
            style: TextStyle(
              fontSize: 20,
              color: Colors.white,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 24),
          OnboardingProgressBar(progress: _progress, height: 10),
          const SizedBox(height: 16),
          const Text(
            "Analyzing your profile...",
            style: TextStyle(
              fontSize: 17,
              color: Color(0xFF9CA3AF),
            ),
          ),
          const SizedBox(height: 56),
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
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Your Personalized Plan",
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 28),
                _buildPlanItem("Smart Study Schedule", _completedItems >= 1),
                const SizedBox(height: 20),
                _buildPlanItem("AI Tutor Support", _completedItems >= 2),
                const SizedBox(height: 20),
                _buildPlanItem("Progress Tracking", _completedItems >= 3),
                const SizedBox(height: 20),
                _buildPlanItem("Adaptive Learning", _completedItems >= 4),
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
            width: 28,
            height: 28,
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
              borderRadius: BorderRadius.circular(8),
            ),
            child: isCompleted
                ? const Icon(
                    CupertinoIcons.checkmark,
                    color: Colors.white,
                    size: 18,
                  )
                : null,
          ),
          const SizedBox(width: 16),
          Text(
            text,
            style: TextStyle(
              fontSize: 17,
              color: isCompleted ? Colors.white : const Color(0xFF9CA3AF),
              fontWeight: isCompleted ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
