import 'dart:math' as math;
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../utils/logger.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 3000),
    )..repeat();

    _fadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: const Interval(0.0, 0.6, curve: Curves.easeOut),
    ));

    _scaleAnimation = Tween<double>(
      begin: 0.8,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: const Interval(0.0, 0.6, curve: Curves.easeOut),
    ));

    _animationController.forward();

    // Check auth state and navigate after animation
    _checkAuthAndNavigate();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _checkAuthAndNavigate() async {
    // Wait for animation to complete
    await Future.delayed(const Duration(milliseconds: 1500));

    if (!mounted) return;

    // Wait for auth state to resolve (with timeout)
    int attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts && mounted) {
      final authState = ref.read(authProvider);
      
      final shouldNavigate = authState.when(
        data: (user) {
          if (mounted) {
            if (user != null) {
              AppLogger.info('User logged in, navigating to /home', tag: 'SplashScreen');
              context.go('/home');
            } else {
              AppLogger.info('No user, navigating to /login', tag: 'SplashScreen');
              context.go('/login');
            }
          }
          return true;
        },
        loading: () {
          return false; // Keep waiting
        },
        error: (error, stackTrace) {
          AppLogger.error('Auth error, navigating to /login', error: error, stackTrace: stackTrace, tag: 'SplashScreen');
          if (mounted) {
            context.go('/login');
          }
          return true;
        },
      );
      
      if (shouldNavigate) break;
      
      // Wait a bit before checking again
      await Future.delayed(const Duration(milliseconds: 300));
      attempts++;
    }
    
    // If still loading after max attempts, navigate to login
    if (attempts >= maxAttempts && mounted) {
      AppLogger.warning('Auth check timeout, navigating to /login', tag: 'SplashScreen');
      context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1A1A1A),
      body: AnimatedBuilder(
        animation: _animationController,
        builder: (context, child) {
          return Container(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment.topLeft,
                radius: 1.5,
                colors: [
                  const Color(0xFF2A1A1A),
                  const Color(0xFF1A1A1A),
                  const Color(0xFF1A1A1A),
                ],
                stops: const [0.0, 0.5, 1.0],
              ),
            ),
            child: Stack(
              children: [
                // Animated background particles/glow effect
                Positioned.fill(
                  child: CustomPaint(
                    painter: _ParticlePainter(_animationController.value),
                  ),
                ),
                // Main content
                Center(
                  child: Opacity(
                    opacity: _fadeAnimation.value,
                    child: Transform.scale(
                      scale: _scaleAnimation.value,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          // Logo/Icon with animated glow effect
                          Container(
                            width: 120,
                            height: 120,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: RadialGradient(
                                colors: [
                                  const Color(0xFFB85A3A).withOpacity(0.4 * _fadeAnimation.value),
                                  const Color(0xFFB85A3A).withOpacity(0.0),
                                ],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFFB85A3A).withOpacity(0.6 * _fadeAnimation.value),
                                  blurRadius: 50,
                                  spreadRadius: 15,
                                ),
                                BoxShadow(
                                  color: const Color(0xFFB85A3A).withOpacity(0.3 * _fadeAnimation.value),
                                  blurRadius: 80,
                                  spreadRadius: 25,
                                ),
                              ],
                            ),
                            child: const Icon(
                              CupertinoIcons.sparkles,
                              size: 64,
                              color: Color(0xFFB85A3A),
                            ),
                          ),
                          const SizedBox(height: 32),
                          // App Name with gradient text effect
                          ShaderMask(
                            shaderCallback: (bounds) => const LinearGradient(
                              colors: [
                                Color(0xFFFFFFFF),
                                Color(0xFFB85A3A),
                                Color(0xFFFFFFFF),
                              ],
                              stops: [0.0, 0.5, 1.0],
                            ).createShader(bounds),
                            child: const Text(
                              'Nano AI',
                              style: TextStyle(
                                fontSize: 48,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                                letterSpacing: -1.5,
                                height: 1.1,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          // Tagline
                          Text(
                            'Your AI-Powered Learning Companion',
                            style: TextStyle(
                              fontSize: 17,
                              color: const Color(0xFF9CA3AF).withOpacity(0.9 * _fadeAnimation.value),
                              fontWeight: FontWeight.w400,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 56),
                          // Loading indicator with custom styling
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: const Color(0xFF2A2A2A).withOpacity(0.5),
                            ),
                            child: const CupertinoActivityIndicator(
                              radius: 14,
                              color: Color(0xFFB85A3A),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// Custom painter for animated background particles
class _ParticlePainter extends CustomPainter {
  final double animationValue;

  _ParticlePainter(this.animationValue);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFFB85A3A).withOpacity(0.1)
      ..style = PaintingStyle.fill;

    // Draw animated particles
    for (int i = 0; i < 8; i++) {
      final angle = (i * 45.0 + animationValue * 360) * math.pi / 180;
      final radius = size.width * 0.4;
      final x = size.width / 2 + radius * (animationValue * 0.5 + 0.5) * math.cos(angle);
      final y = size.height / 2 + radius * (animationValue * 0.5 + 0.5) * math.sin(angle);
      
      canvas.drawCircle(
        Offset(x, y),
        3 + (animationValue * 2),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_ParticlePainter oldDelegate) {
    return oldDelegate.animationValue != animationValue;
  }
}

