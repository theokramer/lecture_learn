import 'dart:io';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/app_data_provider.dart';
import '../providers/auth_provider.dart';
import '../services/ai_gateway_service.dart';
import '../services/document_processor_service.dart';
import '../utils/error_handler.dart';
import '../widgets/error_widget.dart';
import '../widgets/free_notes_limit_widget.dart';

class ProcessingScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic>? audioBlob;
  final String? folderId;
  final Map<String, dynamic>? textContent; // For web link content
  final List<File>? files; // For file uploads

  const ProcessingScreen({
    super.key,
    this.audioBlob,
    this.folderId,
    this.textContent,
    this.files,
  });

  @override
  ConsumerState<ProcessingScreen> createState() => _ProcessingScreenState();
}

class _ProcessingScreenState extends ConsumerState<ProcessingScreen> {
  double _progress = 0.0;
  String _currentTask = 'Initializing...';
  String _subTask = 'Preparing to process your content';
  String? _error;

  Future<String> _getMimeType(File file) async {
    final extension = file.path.split('.').last.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'txt':
        return 'text/plain';
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'm4a':
        return 'audio/mp4';
      default:
        return 'application/octet-stream';
    }
  }

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
      if (mounted) {
        setState(() {
          _currentTask = 'Verifying account...';
          _subTask = 'Checking your account limits';
          _progress = 0.01;
        });
      }

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

      if (mounted) {
        setState(() {
          _currentTask = 'Checking availability...';
          _subTask = 'Verifying AI service availability';
          _progress = 0.05;
        });
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
        if (mounted) {
          setState(() {
            _currentTask = 'Creating note...';
            _subTask = 'Saving web link content to your notes';
            _progress = 0.3;
          });
        }

        // Create note with the extracted content
        final noteId = await appData.createNote(title, folderId: widget.folderId, content: text);

        if (mounted) {
          setState(() {
            _currentTask = 'Note created!';
            _subTask = 'Study content is generating in the background. You can view your note now.';
            _progress = 1.0;
          });
        }

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
          _currentTask = 'Transcribing audio...';
          _progress = 0.2;
          _subTask = 'Converting speech to text using AI transcription';
        });

        await appData.processAudioRecording(audioFile, title, folderId: widget.folderId);

        setState(() {
          _currentTask = 'Transcription complete!';
          _subTask = 'Your note is ready. Study content is generating in the background.';
          _progress = 1.0;
        });

        await Future.delayed(const Duration(milliseconds: 800));

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
        // Check for files in extra data (from upload screen)
        final extra = GoRouterState.of(context).extra as Map<String, dynamic>?;
        final files = widget.files ?? (extra?['files'] as List<File>?);
        
        if (files != null && files.isNotEmpty) {
          // Handle file uploads
          final title = files.length == 1
              ? files[0].path.split('/').last.replaceAll(RegExp(r'\.[^.]*$'), '')
              : 'Uploaded ${files.length} files';

          // Count file types for better progress messages
          final documentProcessor = DocumentProcessorService();
          int audioCount = 0;
          int videoCount = 0;
          for (final file in files) {
            final mimeType = await _getMimeType(file);
            if (documentProcessor.isAudioFile(mimeType)) {
              audioCount++;
            } else if (documentProcessor.isVideoFile(mimeType)) {
              videoCount++;
            }
          }

          // Process files with detailed progress updates
          if (mounted) {
            String subTaskMessage = 'Extracting text from documents';
            if (videoCount > 0 && audioCount > 0) {
              subTaskMessage = 'Transcribing audio and video, and extracting text from documents';
            } else if (videoCount > 0) {
              subTaskMessage = 'Transcribing video and extracting text from documents';
            } else if (audioCount > 0) {
              subTaskMessage = 'Transcribing audio and extracting text from documents';
            }
            
            setState(() {
              _currentTask = 'Processing ${files.length} file${files.length > 1 ? 's' : ''}...';
              _subTask = subTaskMessage;
              _progress = 0.1;
            });
          }

          await appData.processUploadedFiles(files, title, folderId: widget.folderId);

          if (mounted) {
            setState(() {
              _currentTask = 'Files processed!';
              _subTask = 'Your note is ready. Study content is generating in the background.';
              _progress = 1.0;
            });
          }

          await Future.delayed(const Duration(milliseconds: 800));

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
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Animated icon container
                Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        const Color(0xFF8D1647).withOpacity(0.2),
                        const Color(0xFF8D1647).withOpacity(0.1),
                      ],
                    ),
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: CupertinoActivityIndicator(
                      radius: 25,
                      color: Color(0xFF8D1647),
                    ),
                  ),
                ),
                const SizedBox(height: 48),
                // Main title
                Text(
                  _currentTask,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFFFFFFF),
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 16),
                // Subtitle with details
                Text(
                  _subTask,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: const Color(0xFF9CA3AF).withOpacity(0.9),
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 48),
                // Progress bar
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    height: 10,
                    decoration: BoxDecoration(
                      color: const Color(0xFF2A2A2A),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Stack(
                      children: [
                        // Background
                        Container(
                          width: double.infinity,
                          height: 10,
                          color: const Color(0xFF2A2A2A),
                        ),
                        // Progress fill
                        FractionallySizedBox(
                          widthFactor: _progress,
                          child: Container(
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [
                                  Color(0xFF8D1647),
                                  Color(0xFFB01E5A),
                                ],
                              ),
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                // Percentage
                Text(
                  '${(_progress * 100).toInt()}%',
                  style: const TextStyle(
                    color: Color(0xFF9CA3AF),
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 48),
                // Info text
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2A2A2A),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: const Color(0xFF3A3A3A),
                      width: 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        CupertinoIcons.info,
                        color: Color(0xFF8D1647),
                        size: 20,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'This may take a few moments. Your note will be ready soon!',
                          style: TextStyle(
                            color: const Color(0xFF9CA3AF).withOpacity(0.9),
                            fontSize: 14,
                            height: 1.4,
                          ),
                        ),
                      ),
                    ],
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

