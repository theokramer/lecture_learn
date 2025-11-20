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
import '../widgets/free_notes_limit_widget.dart';

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
      final appData = ref.read(appDataProvider.notifier);
      final authState = ref.read(authProvider);
      final user = authState.value;

      if (user == null) {
        throw Exception('User not authenticated');
      }

      // Check limit FIRST, before any processing
      setState(() {
        _currentTask = 'Checking...';
        _progress = 0.01;
      });

      try {
        final canCreate = await appData.canCreateNoteWithStudyContent();
        if (!canCreate) {
          // This shouldn't happen as exception is thrown, but handle it anyway
          setState(() {
            _error = 'You have reached the limit of free notes with study content. Please upgrade to premium to create more notes.';
          });
          return;
        }
      } catch (e) {
        if (e is NoteCreationLimitException) {
          setState(() {
            _error = e.message;
          });
          return;
        }
        rethrow;
      }

      setState(() {
        _currentTask = 'Checking rate limit...';
        _progress = 0.05;
      });

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
          if (mounted) {
            // Use post-frame callback to ensure navigation happens safely
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) {
                try {
                  context.go('/home');
                } catch (e) {
                  // If go() fails, try popping first then navigating
                  if (context.canPop()) {
                    context.pop();
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      if (mounted) {
                        try {
                          context.go('/home');
                        } catch (_) {
                          // Last resort: just ensure we're not stuck
                        }
                      }
                    });
                  }
                }
              }
            });
          }
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

        // Limit already checked at the start, proceed with processing
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

        // Generate study content and wait for completion
        await appData.generateStudyContentForNote(noteId, text);

        setState(() {
          _progress = 1.0;
        });

        await Future.delayed(const Duration(milliseconds: 500));

        if (mounted) {
          // Use post-frame callback to ensure navigation happens safely
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              try {
                context.go('/note?id=$noteId');
              } catch (e) {
                // If go() fails, try popping first then navigating
                if (context.canPop()) {
                  context.pop();
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted) {
                      try {
                        context.go('/note?id=$noteId');
                      } catch (_) {
                        // Last resort: just ensure we're not stuck
                      }
                    }
                  });
                }
              }
            }
          });
        }
      } else if (widget.audioBlob != null && widget.audioBlob!['audioFile'] != null) {
        final audioFile = widget.audioBlob!['audioFile'] as File;
        final title = widget.audioBlob!['title'] as String? ?? 'Voice Recording';

        // Limit already checked at the start, proceed with processing
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
          // Use post-frame callback to ensure navigation happens safely
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              try {
                if (noteId != null) {
                  context.go('/note?id=$noteId');
                } else {
                  context.go('/home');
                }
              } catch (e) {
                // If go() fails, try popping first then navigating
                if (context.canPop()) {
                  context.pop();
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted) {
                      try {
                        if (noteId != null) {
                          context.go('/note?id=$noteId');
                        } else {
                          context.go('/home');
                        }
                      } catch (_) {
                        // Last resort: just ensure we're not stuck
                      }
                    }
                  });
                }
              }
            }
          });
        }
      } else {
        throw Exception('No content to process');
      }
    } catch (e) {
      // Handle note creation limit exception (shouldn't happen as we check at start, but handle just in case)
      if (e is NoteCreationLimitException) {
        setState(() {
          _error = e.message;
        });
        return;
      }

      ErrorHandler.logError(e, context: 'Processing content', tag: 'ProcessingScreen');
      setState(() {
        _error = ErrorHandler.getUserFriendlyMessage(e);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // Check if error is a note creation limit exception
    final isLimitReached = _error != null && 
        (_error!.contains('limit of free notes') || 
         _error!.contains('reached the limit') ||
         _error!.contains('NoteCreationLimitException'));

    if (_error != null) {
      // Show modal overlay for limit reached, otherwise show error widget
      if (isLimitReached) {
        // Show as bottom modal overlay
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            showCupertinoModalPopup(
              context: context,
              builder: (context) => FreeNotesLimitWidget(
                onDismiss: () {
                  if (mounted) {
                    Navigator.of(context).pop();
                    context.go('/home');
                  }
                },
              ),
            );
          }
        });
      }
      
      return CupertinoPageScaffold(
        backgroundColor: const Color(0xFF1A1A1A),
        child: SafeArea(
          child: Stack(
            children: [
              // Show error widget for non-limit errors
              if (!isLimitReached)
                AppErrorWidget(
                  message: _error,
                  onRetry: () {
                    setState(() {
                      _error = null;
                    });
                    _processContent();
                  },
                  retryLabel: 'Try Again',
                ),
              Positioned(
                top: 16,
                right: 16,
                child: CupertinoButton(
                  padding: EdgeInsets.zero,
                  minSize: 44,
                  onPressed: () {
                    if (mounted) {
                      context.go('/home');
                    }
                  },
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFF3A3A3A),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      CupertinoIcons.xmark,
                      color: Color(0xFFFFFFFF),
                      size: 18,
                    ),
                  ),
                ),
              ),
            ],
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
                      valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFFFFFFF)),
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

