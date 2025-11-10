import 'dart:io';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/app_data_provider.dart';
import '../providers/auth_provider.dart';
import '../services/ai_gateway_service.dart';
import '../utils/error_handler.dart';
import '../widgets/error_widget.dart';

class ProcessingScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic>? audioBlob;
  final String? folderId;
  final Map<String, dynamic>? textContent; // For web link content

  const ProcessingScreen({
    super.key,
    this.audioBlob,
    this.folderId,
    this.textContent,
  });

  @override
  ConsumerState<ProcessingScreen> createState() => _ProcessingScreenState();
}

class _ProcessingScreenState extends ConsumerState<ProcessingScreen> {
  double _progress = 0.0;
  String _currentTask = 'Initializing...';
  String? _error;

  @override
  void initState() {
    super.initState();
    _processContent();
  }

  Future<void> _processContent() async {
    try {
      setState(() {
        _currentTask = 'Checking rate limit...';
        _progress = 0.05;
      });

      final appData = ref.read(appDataProvider.notifier);
      final authState = ref.read(authProvider);
      final user = authState.value;

      if (user == null) {
        throw Exception('User not authenticated');
      }

      // Check rate limit
      try {
        await AIGatewayService().checkRateLimit(user.id, user.email);
      } catch (e) {
        if (e is RateLimitError) {
          setState(() {
            _error = e.code == 'ACCOUNT_LIMIT_REACHED'
                ? 'You have already used your one-time AI generation quota.'
                : 'Daily AI limit reached. Please try again tomorrow.';
          });
          await Future.delayed(const Duration(seconds: 2));
          if (mounted) context.go('/home');
          return;
        }
        rethrow;
      }

      // Check if we have text content from web link
      final textData = widget.textContent ?? 
          (GoRouterState.of(context).extra as Map<String, dynamic>?);
      if (textData != null && textData.containsKey('text')) {
        final text = textData['text'] as String;
        final title = textData['title'] as String? ?? 'Web Link';

        setState(() {
          _currentTask = 'Creating note from web link...';
          _progress = 0.3;
        });

        // Create note with the extracted content
        final noteId = await appData.createNote(title, folderId: widget.folderId, content: text);

        setState(() {
          _currentTask = 'Generating study content...';
          _progress = 0.6;
        });

        // Generate study content in background
        appData.generateStudyContentForNote(noteId, text);

        setState(() {
          _progress = 1.0;
        });

        await Future.delayed(const Duration(milliseconds: 500));

        if (mounted) {
          context.go('/note?id=$noteId');
        }
      } else if (widget.audioBlob != null && widget.audioBlob!['audioFile'] != null) {
        final audioFile = widget.audioBlob!['audioFile'] as File;
        final title = widget.audioBlob!['title'] as String? ?? 'Voice Recording';

        setState(() {
          _currentTask = 'Processing audio...';
          _progress = 0.3;
        });

        await appData.processAudioRecording(audioFile, title, folderId: widget.folderId);

        setState(() {
          _progress = 1.0;
        });

        await Future.delayed(const Duration(milliseconds: 500));

        if (mounted) {
          final noteId = ref.read(appDataProvider).selectedNoteId;
          if (noteId != null) {
            context.go('/note?id=$noteId');
          } else {
            context.go('/home');
          }
        }
      } else {
        throw Exception('No content to process');
      }
    } catch (e) {
      ErrorHandler.logError(e, context: 'Processing content', tag: 'ProcessingScreen');
      setState(() {
        _error = ErrorHandler.getUserFriendlyMessage(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return CupertinoPageScaffold(
        backgroundColor: const Color(0xFF1A1A1A),
        child: SafeArea(
          child: AppErrorWidget(
            message: _error,
            onRetry: () {
              setState(() {
                _error = null;
              });
              _processContent();
            },
            retryLabel: 'Try Again',
          ),
        ),
      );
    }

    return CupertinoPageScaffold(
      backgroundColor: const Color(0xFF1A1A1A),
      child: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text(
                  'Creating new note',
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFFFFFFF),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  _currentTask,
                  style: const TextStyle(
                    fontSize: 18,
                    color: Color(0xFF9CA3AF),
                  ),
                ),
                const SizedBox(height: 40),
                SizedBox(
                  width: double.infinity,
                  child: CupertinoActivityIndicator(
                    radius: 20,
                  ),
                ),
                const SizedBox(height: 24),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: SizedBox(
                    height: 8,
                    child: LinearProgressIndicator(
                      value: _progress,
                      backgroundColor: const Color(0xFF3A3A3A),
                      valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFB85A3A)),
                      minHeight: 8,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '${(_progress * 100).toInt()}%',
                  style: const TextStyle(
                    color: Color(0xFF9CA3AF),
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

