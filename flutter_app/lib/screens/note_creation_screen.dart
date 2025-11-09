import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:animations/animations.dart';

class NoteCreationScreen extends StatelessWidget {
  final String? folderId;
  
  const NoteCreationScreen({super.key, this.folderId});

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: const Color(0xFF1A1A1A),
      navigationBar: const CupertinoNavigationBar(
        backgroundColor: Color(0xFF2A2A2A),
        border: Border(
          bottom: BorderSide(
            color: Color(0xFF3A3A3A),
            width: 0.5,
          ),
        ),
        middle: Text(
          'New Note',
          style: TextStyle(
            color: Color(0xFFFFFFFF),
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 20),
              const Text(
                'Create a new note',
                style: TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFFFFFFF),
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Choose how you want to create your note',
                style: TextStyle(
                  fontSize: 17,
                  color: Color(0xFF9CA3AF),
                  fontWeight: FontWeight.w400,
                ),
              ),
              const SizedBox(height: 48),
              _buildOption(
                context,
                icon: CupertinoIcons.mic_fill,
                title: 'Record Audio',
                description: 'Record voice notes directly',
                color: const Color(0xFFEF4444),
                onTap: () {
                  HapticFeedback.selectionClick();
                  final path = folderId != null 
                      ? '/note-creation/record?folderId=$folderId'
                      : '/note-creation/record';
                  context.push(path);
                },
              ),
              const SizedBox(height: 16),
              _buildOption(
                context,
                icon: CupertinoIcons.link,
                title: 'Web Link',
                description: 'Websites, Google Drive, and other web pages',
                color: const Color(0xFF3B82F6),
                onTap: () {
                  HapticFeedback.selectionClick();
                  final path = folderId != null 
                      ? '/note-creation/web-link?folderId=$folderId'
                      : '/note-creation/web-link';
                  context.push(path);
                },
              ),
              const SizedBox(height: 16),
              _buildOption(
                context,
                icon: CupertinoIcons.doc_text,
                title: 'Upload Documents',
                description: 'Upload PDF, text, audio, and video files',
                color: const Color(0xFF10B981),
                onTap: () {
                  HapticFeedback.selectionClick();
                  final path = folderId != null 
                      ? '/note-creation/upload?folderId=$folderId'
                      : '/note-creation/upload';
                  context.push(path);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOption(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String description,
    required VoidCallback onTap,
    Color? color,
  }) {
    return OpenContainer(
      closedElevation: 0,
      openElevation: 0,
      closedColor: Colors.transparent,
      openColor: Colors.transparent,
      transitionDuration: const Duration(milliseconds: 250),
      closedBuilder: (context, action) => GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF2A2A2A),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: const Color(0xFF3A3A3A),
              width: 1.5,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: (color ?? const Color(0xFFFFFFFF)).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  icon,
                  color: color ?? const Color(0xFFFFFFFF),
                  size: 30,
                ),
              ),
              const SizedBox(width: 20),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Color(0xFFFFFFFF),
                        fontSize: 19,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.3,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      description,
                      style: const TextStyle(
                        color: Color(0xFF9CA3AF),
                        fontSize: 15,
                        fontWeight: FontWeight.w400,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              const Icon(
                CupertinoIcons.chevron_right,
                color: Color(0xFF9CA3AF),
                size: 20,
              ),
            ],
          ),
        ),
      ),
      openBuilder: (context, action) => Container(),
    );
  }
}
