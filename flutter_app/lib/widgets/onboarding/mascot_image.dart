import 'package:flutter/material.dart';
import 'dart:ui' as ui;

/// Widget to display mascot images from assets/mascot
/// Easily replaceable by changing the asset path
class MascotImage extends StatelessWidget {
  final String imagePath;
  final double? width;
  final double? height;
  final BoxFit fit;

  const MascotImage({
    super.key,
    required this.imagePath,
    this.width,
    this.height,
    this.fit = BoxFit.contain,
  });

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      imagePath,
      width: width,
      height: height,
      fit: fit,
      errorBuilder: (context, error, stackTrace) {
        // Fallback to placeholder if image not found
        return Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            color: const Color(0xFF2A2A2A),
            borderRadius: BorderRadius.circular(20),
          ),
          child: const Icon(
            Icons.image_not_supported,
            color: Color(0xFF9CA3AF),
            size: 48,
          ),
        );
      },
    );
  }
}

