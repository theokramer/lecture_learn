import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/study_content.dart';

class StudyModeSelector extends StatelessWidget {
  final StudyMode currentMode;
  final Function(StudyMode) onModeChanged;

  const StudyModeSelector({
    super.key,
    required this.currentMode,
    required this.onModeChanged,
  });

  @override
  Widget build(BuildContext context) {
    final modes = [
      StudyMode.summary,
      StudyMode.aiChat,
      StudyMode.flashcards,
      StudyMode.quiz,
      StudyMode.exercises,
      StudyMode.feynman,
    ];

    return Container(
      height: 70,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            const Color(0xFF1A1A1A),
            const Color(0xFF1F1F1F),
          ],
        ),
        border: const Border(
          bottom: BorderSide(
            color: Color(0xFF3A3A3A),
            width: 0.5,
          ),
        ),
      ),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        itemCount: modes.length,
        itemBuilder: (context, index) {
          final mode = modes[index];
          final isSelected = mode == currentMode;
          final modeData = _getModeData(mode);

          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: GestureDetector(
              onTap: () {
                HapticFeedback.selectionClick();
                onModeChanged(mode);
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOutCubic,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFFFFFFFF) : const Color(0xFF2A2A2A),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected
                        ? const Color(0xFFFFFFFF)
                        : const Color(0xFF3A3A3A),
                    width: isSelected ? 1.5 : 1,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      modeData['icon'] as IconData,
                      size: 18,
                      color: isSelected
                          ? const Color(0xFF1A1A1A)
                          : const Color(0xFF9CA3AF),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      modeData['label'] as String,
                      style: TextStyle(
                        color: isSelected
                            ? const Color(0xFF1A1A1A)
                            : const Color(0xFF9CA3AF),
                        fontSize: 15,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Map<String, dynamic> _getModeData(StudyMode mode) {
    switch (mode) {
      case StudyMode.summary:
        return {
          'label': 'Summary',
          'icon': CupertinoIcons.doc_text_fill,
          'color': const Color(0xFF3B82F6),
        };
      case StudyMode.feynman:
        return {
          'label': 'Feynman',
          'icon': CupertinoIcons.lightbulb_fill,
          'color': const Color(0xFFF59E0B),
        };
      case StudyMode.flashcards:
        return {
          'label': 'Flashcards',
          'icon': CupertinoIcons.collections,
          'color': const Color(0xFF10B981),
        };
      case StudyMode.quiz:
        return {
          'label': 'Quiz',
          'icon': CupertinoIcons.question_circle_fill,
          'color': const Color(0xFF8B5CF6),
        };
      case StudyMode.exercises:
        return {
          'label': 'Exercises',
          'icon': CupertinoIcons.pencil_ellipsis_rectangle,
          'color': const Color(0xFFEF4444),
        };
      case StudyMode.documents:
        return {
          'label': 'Documents',
          'icon': CupertinoIcons.doc_on_doc_fill,
          'color': const Color(0xFF6366F1),
        };
      case StudyMode.aiChat:
        return {
          'label': 'AI Chat',
          'icon': CupertinoIcons.chat_bubble_2_fill,
          'color': const Color(0xFF06B6D4),
        };
    }
  }
}
