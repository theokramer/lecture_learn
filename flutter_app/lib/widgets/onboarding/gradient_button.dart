import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class GradientButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final IconData? trailingIcon;

  const GradientButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.trailingIcon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 56,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: onPressed != null && !isLoading
            ? const LinearGradient(
                colors: [
                  Color(0xFF8D1647), // Vibrant teal,
                  Color(0xFFFFFFFF), // White
                ],
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              )
            : null,
        color: onPressed == null || isLoading
            ? const Color(0xFF3A3A3A)
            : null,
        boxShadow: onPressed != null && !isLoading
            ? [
                BoxShadow(
                  color: const Color(0xFF8D1647).withOpacity(0.3),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: CupertinoButton(
        padding: EdgeInsets.zero,
        onPressed: onPressed != null && !isLoading
            ? () {
                HapticFeedback.mediumImpact();
                onPressed!();
              }
            : null,
        child: isLoading
            ? const CupertinoActivityIndicator(
                color: Colors.white,
                radius: 12,
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    text,
                    style: TextStyle(
                      color: (onPressed != null && !isLoading)
                          ? Colors.white
                          : const Color(0xFF9CA3AF),
                      fontSize: 17,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.5,
                    ),
                  ),
                  if (trailingIcon != null && (onPressed != null && !isLoading)) ...[
                    const SizedBox(width: 8),
                    Icon(
                      trailingIcon,
                      color: Colors.white,
                      size: 20,
                    ),
                  ],
                ],
              ),
      ),
    );
  }
}

