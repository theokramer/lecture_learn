import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:animations/animations.dart';
import '../providers/auth_provider.dart';
import '../utils/error_handler.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> with SingleTickerProviderStateMixin {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _isSignUp = false;
  bool _isLoading = false;
  String? _error;
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeInOut,
    );
    _animationController.forward();
  }

  @override
  void dispose() {
    _animationController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) {
      HapticFeedback.mediumImpact();
      return;
    }

    HapticFeedback.lightImpact();
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await ref.read(authProvider.notifier).signIn(
            _emailController.text.trim(),
            _passwordController.text,
          );

      if (result['success'] == true && mounted) {
        HapticFeedback.mediumImpact();
        context.go('/home');
      } else {
        HapticFeedback.heavyImpact();
        setState(() {
          _error = result['error'] ?? 'Invalid email or password';
          _isLoading = false;
        });
      }
    } catch (e) {
      HapticFeedback.heavyImpact();
      ErrorHandler.logError(e, context: 'Sign in', tag: 'LoginScreen');
      setState(() {
        _error = ErrorHandler.getUserFriendlyMessage(e);
        _isLoading = false;
      });
    }
  }

  Future<void> _handleSignUp() async {
    if (!_formKey.currentState!.validate()) {
      HapticFeedback.mediumImpact();
      return;
    }

    HapticFeedback.lightImpact();
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await ref.read(authProvider.notifier).signUp(
            _emailController.text.trim(),
            _passwordController.text,
            _nameController.text.trim(),
          );

      if (result['success'] == true && mounted) {
        HapticFeedback.mediumImpact();
        
        // Check if email confirmation is required
        if (result['requiresEmailConfirmation'] == true) {
          final email = result['email'] ?? _emailController.text.trim();
          setState(() {
            _isLoading = false;
            _error = null;
          });
          
          // Show email confirmation dialog
          showCupertinoDialog(
            context: context,
            builder: (context) => CupertinoAlertDialog(
              title: const Text('Check Your Email'),
              content: Text(
                'We\'ve sent a confirmation email to $email. Please check your inbox and click the confirmation link to activate your account.',
              ),
              actions: [
                CupertinoDialogAction(
                  isDefaultAction: true,
                  onPressed: () {
                    Navigator.of(context).pop();
                    // Switch to login mode after showing the message
                    setState(() {
                      _isSignUp = false;
                    });
                  },
                  child: const Text('OK'),
                ),
              ],
            ),
          );
        } else {
          // Email already confirmed or confirmation not required, proceed to home
          context.go('/home');
        }
      } else {
        HapticFeedback.heavyImpact();
        setState(() {
          _error = result['error'] ?? 'Sign up failed';
          _isLoading = false;
        });
      }
    } catch (e) {
      HapticFeedback.heavyImpact();
      ErrorHandler.logError(e, context: 'Sign up', tag: 'LoginScreen');
      setState(() {
        _error = ErrorHandler.getUserFriendlyMessage(e);
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: const Color(0xFF1A1A1A),
      child: SafeArea(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 40),
                  // Logo/Title with animation
                  Hero(
                    tag: 'app_logo',
                    child: const Text(
                      'RocketLearn',
                      style: TextStyle(
                        fontSize: 52,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFFFFFFF),
                        letterSpacing: -1.5,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Your AI-powered learning companion',
                    style: TextStyle(
                      fontSize: 18,
                      color: Color(0xFF9CA3AF),
                      fontWeight: FontWeight.w400,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 60),
                  // Error message with slide animation
                  if (_error != null)
                    SlideTransition(
                      position: Tween<Offset>(
                        begin: const Offset(-1, 0),
                        end: Offset.zero,
                      ).animate(CurvedAnimation(
                        parent: _animationController,
                        curve: Curves.easeOut,
                      )),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        margin: const EdgeInsets.only(bottom: 24),
                        decoration: BoxDecoration(
                          color: Colors.red.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: Colors.red.withOpacity(0.3),
                            width: 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              CupertinoIcons.exclamationmark_circle_fill,
                              color: Colors.red,
                              size: 20,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                _error!,
                                style: const TextStyle(
                                  color: Colors.red,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w500,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  // Email field
                  CupertinoTextField(
                    controller: _emailController,
                    placeholder: 'Email',
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: const Color(0xFF2A2A2A),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: const Color(0xFF3A3A3A),
                        width: 1.5,
                      ),
                    ),
                    style: const TextStyle(
                      color: Color(0xFFFFFFFF),
                      fontSize: 16,
                      fontWeight: FontWeight.w400,
                    ),
                    placeholderStyle: const TextStyle(
                      color: Color(0xFF9CA3AF),
                      fontSize: 16,
                    ),
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    textInputAction: TextInputAction.next,
                  ),
                  const SizedBox(height: 16),
                  // Password field
                  CupertinoTextField(
                    controller: _passwordController,
                    placeholder: 'Password',
                    padding: const EdgeInsets.all(18),
                    obscureText: true,
                    decoration: BoxDecoration(
                      color: const Color(0xFF2A2A2A),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: const Color(0xFF3A3A3A),
                        width: 1.5,
                      ),
                    ),
                    style: const TextStyle(
                      color: Color(0xFFFFFFFF),
                      fontSize: 16,
                      fontWeight: FontWeight.w400,
                    ),
                    placeholderStyle: const TextStyle(
                      color: Color(0xFF9CA3AF),
                      fontSize: 16,
                    ),
                    textInputAction: _isSignUp ? TextInputAction.next : TextInputAction.done,
                    onSubmitted: (_) => _isSignUp ? null : _handleLogin(),
                  ),
                  // Name field (sign up only)
                  if (_isSignUp) ...[
                    const SizedBox(height: 16),
                    CupertinoTextField(
                      controller: _nameController,
                      placeholder: 'Name',
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: const Color(0xFF2A2A2A),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: const Color(0xFF3A3A3A),
                          width: 1.5,
                        ),
                      ),
                      style: const TextStyle(
                        color: Color(0xFFFFFFFF),
                        fontSize: 16,
                        fontWeight: FontWeight.w400,
                      ),
                      placeholderStyle: const TextStyle(
                        color: Color(0xFF9CA3AF),
                        fontSize: 16,
                      ),
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => _handleSignUp(),
                    ),
                  ],
                  const SizedBox(height: 32),
                  // Submit button
                  OpenContainer(
                    closedElevation: 0,
                    openElevation: 0,
                    closedColor: Colors.transparent,
                    openColor: Colors.transparent,
                    transitionDuration: const Duration(milliseconds: 300),
                    closedBuilder: (context, action) => CupertinoButton.filled(
                      onPressed: _isLoading ? null : (_isSignUp ? _handleSignUp : _handleLogin),
                      color: const Color(0xFFB85A3A),
                      borderRadius: BorderRadius.circular(14),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      disabledColor: const Color(0xFF3A3A3A),
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CupertinoActivityIndicator(
                                color: Color(0xFFFFFFFF),
                                radius: 10,
                              ),
                            )
                          : Text(
                              _isSignUp ? 'Sign Up' : 'Sign In',
                              style: const TextStyle(
                                color: Color(0xFFFFFFFF),
                                fontSize: 17,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.5,
                              ),
                            ),
                    ),
                    openBuilder: (context, action) => Container(),
                  ),
                  const SizedBox(height: 20),
                  // Toggle sign up/sign in
                  TextButton(
                    onPressed: () {
                      HapticFeedback.selectionClick();
                      setState(() {
                        _isSignUp = !_isSignUp;
                        _error = null;
                      });
                    },
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: Text(
                      _isSignUp
                          ? 'Already have an account? Sign In'
                          : 'Don\'t have an account? Sign Up',
                      style: const TextStyle(
                        color: Color(0xFFB85A3A),
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
