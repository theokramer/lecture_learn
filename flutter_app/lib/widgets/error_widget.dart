import 'package:flutter/cupertino.dart';
import '../utils/error_handler.dart';

/// Reusable error widget for displaying errors to users
class AppErrorWidget extends StatelessWidget {
  final String? message;
  final dynamic error;
  final VoidCallback? onRetry;
  final String? retryLabel;
  final IconData? icon;

  const AppErrorWidget({
    super.key,
    this.message,
    this.error,
    this.onRetry,
    this.retryLabel,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final errorMessage = message ?? ErrorHandler.getUserFriendlyMessage(error);
    final errorIcon = icon ?? CupertinoIcons.exclamationmark_triangle;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              errorIcon,
              size: 64,
              color: const Color(0xFFEF4444),
            ),
            const SizedBox(height: 24),
            const Text(
              'Error',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Color(0xFFFFFFFF),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              errorMessage,
              style: const TextStyle(
                fontSize: 16,
                color: Color(0xFF9CA3AF),
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 32),
              CupertinoButton.filled(
                onPressed: onRetry,
                color: const Color(0xFF6366F1),
                borderRadius: BorderRadius.circular(16),
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                child: Text(
                  retryLabel ?? 'Try Again',
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

