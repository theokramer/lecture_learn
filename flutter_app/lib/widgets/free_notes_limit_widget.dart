import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:superwallkit_flutter/superwallkit_flutter.dart';
import '../utils/logger.dart';

/// Widget shown when user has reached the limit of free notes with study content
/// Designed as a bottom modal overlay
class FreeNotesLimitWidget extends ConsumerWidget {
  final VoidCallback? onDismiss;

  const FreeNotesLimitWidget({
    super.key,
    this.onDismiss,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF2A2A2A),
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(20),
          topRight: Radius.circular(20),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag handle
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 24),
                decoration: BoxDecoration(
                  color: const Color(0xFF4A4A4A),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              // Icon
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: const Color(0xFF2F2F2F),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  CupertinoIcons.star_fill,
                  size: 50,
                  color: Color(0xFFFFD700),
                ),
              ),
              const SizedBox(height: 32),
              const Text(
                'Free Notes Limit Reached',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFFFFFFF),
                  letterSpacing: -0.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              const Text(
                'You\'ve used your one free note with study content. Upgrade to Premium to create unlimited notes with flashcards, quizzes, exercises, and more!',
                style: TextStyle(
                  fontSize: 16,
                  color: Color(0xFF9CA3AF),
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              CupertinoButton.filled(
                onPressed: () async {
                  try {
                    AppLogger.info('🎯 [FreeNotesLimit] Showing Superwall paywall...', tag: 'FreeNotesLimitWidget');
                    
                    // Dismiss the current modal first
                    if (onDismiss != null) {
                      onDismiss!();
                    } else {
                      Navigator.of(context).pop();
                    }
                    
                    // Register the Superwall placement - this will show the paywall automatically
                    Superwall.shared.registerPlacement(
                      'campaign_trigger',
                      feature: () {
                        AppLogger.info('✅ [FreeNotesLimit] Superwall feature callback executed - user has access', tag: 'FreeNotesLimitWidget');
                        // User has subscribed or already has access
                        // The onDismiss callback will handle navigation if needed
                      },
                    );
                    
                    AppLogger.info('✅ [FreeNotesLimit] Superwall placement registered: campaign_trigger', tag: 'FreeNotesLimitWidget');
                  } catch (e) {
                    AppLogger.error('❌ [FreeNotesLimit] Error showing Superwall paywall: $e', tag: 'FreeNotesLimitWidget');
                    // On error, just dismiss
                    if (context.mounted) {
                      if (onDismiss != null) {
                        onDismiss!();
                      } else {
                        Navigator.of(context).pop();
                      }
                    }
                  }
                },
                color: const Color(0xFFFFFFFF),
                borderRadius: BorderRadius.circular(16),
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                child: const Text(
                  'Upgrade to Premium',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1A1A1A),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              CupertinoButton(
                onPressed: () {
                  if (onDismiss != null) {
                    onDismiss!();
                  } else {
                    Navigator.of(context).pop();
                  }
                },
                child: const Text(
                  'Maybe Later',
                  style: TextStyle(
                    fontSize: 17,
                    color: Color(0xFF9CA3AF),
                  ),
                ),
              ),
              const SizedBox(height: 8), // Extra padding at bottom
            ],
          ),
        ),
      ),
    );
  }
}

