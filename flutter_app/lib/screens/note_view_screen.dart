import 'dart:async';
import 'dart:convert';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/app_data_provider.dart';
import '../models/study_content.dart';
import '../models/note.dart';
import '../services/supabase_service.dart';
import '../services/ai_gateway_service.dart';
import '../services/study_content_polling_service.dart';
import '../widgets/study_mode_selector.dart';
import '../widgets/ai_chat_panel.dart';
import '../widgets/html_with_latex_renderer.dart';
import '../utils/study_mode_colors.dart';
import '../utils/logger.dart';
import '../utils/error_handler.dart';

class NoteViewScreen extends ConsumerStatefulWidget {
  final String? noteId;

  const NoteViewScreen({super.key, this.noteId});

  @override
  ConsumerState<NoteViewScreen> createState() => _NoteViewScreenState();
}

class _NoteViewScreenState extends ConsumerState<NoteViewScreen> {
  StudyContent? _studyContent;
  bool _loadingContent = false;
  bool _hasContent = false;
  String? _generatingContentType; // Track which content type is being generated
  bool _isInitialGeneration = false; // Track if we're in initial generation phase
  final _pollingService = StudyContentPollingService();

  @override
  void initState() {
    super.initState();
    if (widget.noteId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        // IMPORTANT: When viewing a note, we ONLY fetch from Supabase
        // We NEVER trigger regeneration of study content
        ref.read(appDataProvider.notifier).setSelectedNoteId(widget.noteId);
        _loadStudyContent(); // Fetches from Supabase only
        _startPolling(); // Polls Supabase to check if background generation completed
      });
    }
  }

  @override
  void didUpdateWidget(NoteViewScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.noteId != widget.noteId) {
      // Stop polling for old note
      if (oldWidget.noteId != null) {
        _pollingService.stopPolling(oldWidget.noteId!);
      }
      _hasContent = false;
      if (widget.noteId != null) {
        _loadStudyContent();
        _startPolling();
      }
    }
  }

  @override
  void dispose() {
    // Don't stop polling when widget is disposed - let it continue in background
    // Polling will stop automatically when content is found or timeout is reached
    super.dispose();
  }

  Future<void> _loadStudyContent() async {
    if (widget.noteId == null) return;

    AppLogger.info('Loading study content from Supabase for note: ${widget.noteId}', tag: 'NoteViewScreen');

    setState(() {
      _loadingContent = true;
    });

    try {
      // Get note to check creation time
      final appData = ref.read(appDataProvider);
      final note = appData.notes.firstWhere(
        (n) => n.id == widget.noteId,
        orElse: () => Note(
          id: widget.noteId!,
          title: 'Note',
          content: '',
          createdAt: DateTime.now(),
          documents: [],
        ),
      );
      
      // Check if note was created recently (within last 5 minutes)
      // If so, we're likely in initial generation phase
      final now = DateTime.now();
      final timeSinceCreation = now.difference(note.createdAt);
      final isNewNote = timeSinceCreation.inMinutes < 5;

      // Check if background polling is already active for this note
      final isAlreadyPolling = _pollingService.isPolling(widget.noteId!);

      // ONLY fetch from Supabase - never regenerate
      final content = await SupabaseService().getStudyContent(widget.noteId!);
      final hasContent = content.flashcards.isNotEmpty ||
          content.quizQuestions.isNotEmpty ||
          content.exercises.isNotEmpty ||
          content.feynmanTopics.isNotEmpty ||
          content.summary.isNotEmpty;

      AppLogger.success('Study content loaded from Supabase. Has content: $hasContent, isNewNote: $isNewNote, isAlreadyPolling: $isAlreadyPolling', tag: 'NoteViewScreen');

      setState(() {
        _studyContent = content;
        _loadingContent = false;
        _hasContent = hasContent;
        // Only show initial generation loading if note is new AND has no content
        // If content loaded successfully (even if empty), we're not in initial generation
        // Also check if background polling is active (means generation might still be in progress)
        _isInitialGeneration = isNewNote && !hasContent && (isAlreadyPolling || timeSinceCreation.inMinutes < 2);
      });
    } catch (e) {
      AppLogger.error('Error loading study content', error: e, tag: 'NoteViewScreen');
      setState(() {
        _loadingContent = false;
        // On error, set empty content so generate buttons can show
        _studyContent = StudyContent();
        _isInitialGeneration = false; // Don't show initial generation if load failed
      });
    }
  }

  Future<void> _generateContentType(String contentType) async {
    if (widget.noteId == null) return;

    setState(() {
      _generatingContentType = contentType;
      _isInitialGeneration = false; // User manually triggered, so not initial generation
    });

    try {
      HapticFeedback.mediumImpact();
      await ref.read(appDataProvider.notifier).generateStudyContentType(
            widget.noteId!,
            contentType,
          );
      
      // Reload study content after generation
      await _loadStudyContent();
      
      HapticFeedback.selectionClick();
    } catch (e) {
      AppLogger.error('Error generating $contentType', error: e, tag: 'NoteViewScreen');
      ErrorHandler.logError(e, context: 'Generating $contentType', tag: 'NoteViewScreen');
      if (mounted) {
        final errorMessage = ErrorHandler.getUserFriendlyMessage(e);
        showCupertinoDialog(
          context: context,
          builder: (context) => CupertinoAlertDialog(
            title: const Text('Error'),
            content: Text(errorMessage),
            actions: [
              CupertinoDialogAction(
                onPressed: () => Navigator.pop(context),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _generatingContentType = null;
        });
      }
    }
  }

  void _startPolling() {
    if (widget.noteId == null) return;

    // Get note creation time
    final appData = ref.read(appDataProvider);
    final note = appData.notes.firstWhere(
      (n) => n.id == widget.noteId,
      orElse: () => Note(
        id: widget.noteId!,
        title: 'Note',
        content: '',
        createdAt: DateTime.now(),
        documents: [],
      ),
    );

    // Start background polling service
    // This continues even if widget is disposed or app goes to background
    _pollingService.startPolling(
      noteId: widget.noteId!,
      noteCreatedAt: note.createdAt,
      onContentFound: (content) {
        // Callback when content is found
        if (mounted && widget.noteId == note.id) {
          AppLogger.success('Study content detected via background polling', tag: 'NoteViewScreen');
          setState(() {
            _studyContent = content;
            _loadingContent = false;
            _hasContent = true;
            _isInitialGeneration = false; // Generation completed
          });
        }
      },
      maxDuration: const Duration(minutes: 5), // Poll for up to 5 minutes
    );

    // Also set up a timeout to stop showing initial generation after 2 minutes
    Timer(const Duration(minutes: 2), () {
      if (mounted && !_hasContent && _isInitialGeneration) {
        setState(() {
          _isInitialGeneration = false;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final appData = ref.watch(appDataProvider);
    final note = appData.notes.firstWhere(
      (n) => n.id == widget.noteId,
      orElse: () => Note(
        id: '',
        title: 'Note',
        content: '',
        createdAt: DateTime.now(),
        documents: [],
      ),
    );

    return CupertinoPageScaffold(
      backgroundColor: const Color(0xFF1A1A1A),
      navigationBar: CupertinoNavigationBar(
        backgroundColor: const Color(0xFF2A2A2A),
        border: const Border(
          bottom: BorderSide(
            color: Color(0xFF3A3A3A),
            width: 0.5,
          ),
        ),
        leading: CupertinoNavigationBarBackButton(
          color: const Color(0xFFFFFFFF),
          onPressed: () {
            HapticFeedback.selectionClick();
            Navigator.of(context).pop();
          },
        ),
        middle: Text(
          note.title,
          style: const TextStyle(
            color: Color(0xFFFFFFFF),
            fontSize: 17,
            fontWeight: FontWeight.bold,
            letterSpacing: -0.3,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      child: SafeArea(
        child: Column(
          children: [
            StudyModeSelector(
              currentMode: appData.currentStudyMode,
              onModeChanged: (mode) {
                HapticFeedback.selectionClick();
                ref.read(appDataProvider.notifier).setCurrentStudyMode(mode);
              },
            ),
            Expanded(
              child: _buildContent(note, appData.currentStudyMode),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(Note note, StudyMode mode) {
    if (_loadingContent) {
      return const Center(
        child: CupertinoActivityIndicator(
          radius: 15,
        ),
      );
    }

    switch (mode) {
      case StudyMode.summary:
        return _buildSummaryView();
      case StudyMode.flashcards:
        return _buildFlashcardsView();
      case StudyMode.quiz:
        return _buildQuizView();
      case StudyMode.exercises:
        return _buildExercisesView();
      case StudyMode.feynman:
        return _buildFeynmanView();
      case StudyMode.documents:
        return _buildDocumentsView(note);
      case StudyMode.aiChat:
        return _buildAIChatView(note);
    }
  }

  Widget _buildSummaryView() {
    final isGenerating = _generatingContentType == 'summary';
    final isEmpty = _studyContent?.summary.isEmpty ?? true;
    
    // Show loading during initial generation (first 2 minutes after note creation)
    if (_isInitialGeneration && isEmpty && !isGenerating) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CupertinoActivityIndicator(
              radius: 20,
            ),
            const SizedBox(height: 24),
            const Text(
              'Generating summary...',
              style: TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 18,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'This may take a few moments',
              style: TextStyle(
                color: const Color(0xFF9CA3AF).withOpacity(0.7),
                fontSize: 14,
              ),
            ),
          ],
        ),
      );
    }
    
    // Show loading screen while loading
    if (_loadingContent) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CupertinoActivityIndicator(
              radius: 15,
            ),
            const SizedBox(height: 24),
            const Text(
              'Loading summary...',
              style: TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }
    
    // Only show generate button if:
    // 1. Loading is complete (!_loadingContent)
    // 2. Content is actually empty
    // 3. Not currently generating
    // 4. Initial generation phase has ended (not in initial generation)
    // 5. We've attempted to load (_studyContent != null) - either successfully or with error
    final shouldShowGenerate = !_loadingContent && 
        isEmpty && 
        !isGenerating &&
        !_isInitialGeneration &&
        (_studyContent != null); // Must have attempted to load
    
    if (shouldShowGenerate) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFF3B82F6),
                      Color(0xFF60A5FA),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(25),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF3B82F6).withOpacity(0.4),
                      blurRadius: 25,
                      spreadRadius: 4,
                    ),
                  ],
                ),
                child: const Icon(
                  CupertinoIcons.doc_text_fill,
                  size: 50,
                  color: Color(0xFFFFFFFF),
                ),
              ),
              const SizedBox(height: 28),
              const Text(
                'No Summary Yet',
                style: TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Generate a comprehensive summary\nto help you understand the content',
                style: TextStyle(
                  color: const Color(0xFF9CA3AF).withOpacity(0.9),
                  fontSize: 15,
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 36),
              CupertinoButton.filled(
                onPressed: () => _generateContentType('summary'),
                color: const Color(0xFF3B82F6),
                borderRadius: BorderRadius.circular(16),
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      CupertinoIcons.sparkles,
                      size: 20,
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Generate Summary',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }
    
    if (isGenerating) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CupertinoActivityIndicator(
              radius: 15,
            ),
            const SizedBox(height: 24),
            const Text(
              'Generating summary...',
              style: TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }

    // Safety check: ensure _studyContent is not null and has content
    if (_studyContent == null || _studyContent!.summary.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                CupertinoIcons.doc_text,
                size: 64,
                color: Color(0xFF9CA3AF),
              ),
              const SizedBox(height: 24),
              const Text(
                'No Summary Available',
                style: TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Generate a summary to get started',
                style: TextStyle(
                  color: const Color(0xFF9CA3AF).withOpacity(0.8),
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: HtmlWithLatexRenderer(
        htmlContent: _studyContent!.summary,
      ),
    );
  }

  Widget _buildFlashcardsView() {
    final isGenerating = _generatingContentType == 'flashcards';
    final isEmpty = _studyContent?.flashcards.isEmpty ?? true;
    
    // Show loading during initial generation
    if (_isInitialGeneration && isEmpty && !isGenerating) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CupertinoActivityIndicator(
              radius: 20,
            ),
            const SizedBox(height: 24),
            const Text(
              'Generating flashcards...',
              style: TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 18,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'This may take a few moments',
              style: TextStyle(
                color: const Color(0xFF9CA3AF).withOpacity(0.7),
                fontSize: 14,
              ),
            ),
          ],
        ),
      );
    }
    
    // Show loading screen while loading
    if (_loadingContent) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CupertinoActivityIndicator(
              radius: 15,
            ),
            const SizedBox(height: 24),
            const Text(
              'Loading flashcards...',
              style: TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }
    
    final shouldShowGenerate = !_loadingContent && 
        isEmpty && 
        !isGenerating &&
        !_isInitialGeneration &&
        (_studyContent != null); // Must have attempted to load
    
    if (shouldShowGenerate) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFF10B981),
                      Color(0xFF34D399),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(25),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF10B981).withOpacity(0.4),
                      blurRadius: 25,
                      spreadRadius: 4,
                    ),
                  ],
                ),
                child: const Icon(
                  CupertinoIcons.collections,
                  size: 50,
                  color: Color(0xFFFFFFFF),
                ),
              ),
              const SizedBox(height: 28),
              const Text(
                'No Flashcards Yet',
                style: TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Generate flashcards to master\nthe key concepts',
                style: TextStyle(
                  color: const Color(0xFF9CA3AF).withOpacity(0.9),
                  fontSize: 15,
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 36),
              CupertinoButton.filled(
                onPressed: () => _generateContentType('flashcards'),
                color: const Color(0xFF10B981),
                borderRadius: BorderRadius.circular(16),
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      CupertinoIcons.sparkles,
                      size: 20,
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Generate Flashcards',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }
    
    if (isGenerating) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CupertinoActivityIndicator(
              radius: 15,
            ),
            const SizedBox(height: 24),
            const Text(
              'Generating flashcards...',
              style: TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }

    // Safety check: ensure _studyContent is not null and has content
    if (_studyContent == null || _studyContent!.flashcards.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                CupertinoIcons.collections,
                size: 64,
                color: Color(0xFF9CA3AF),
              ),
              const SizedBox(height: 24),
              const Text(
                'No Flashcards Available',
                style: TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Generate flashcards to get started',
                style: TextStyle(
                  color: const Color(0xFF9CA3AF).withOpacity(0.8),
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return _FlashcardViewer(
      flashcards: _studyContent!.flashcards,
      modeColor: StudyModeColors.getColor(StudyMode.flashcards),
    );
  }

  Widget _buildQuizView() {
    final isGenerating = _generatingContentType == 'quiz';
    final isEmpty = _studyContent?.quizQuestions.isEmpty ?? true;
    
    // Show loading during initial generation
    if (_isInitialGeneration && isEmpty && !isGenerating) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CupertinoActivityIndicator(
              radius: 20,
            ),
            const SizedBox(height: 24),
            const Text(
              'Generating quiz questions...',
              style: TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 18,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'This may take a few moments',
              style: TextStyle(
                color: const Color(0xFF9CA3AF).withOpacity(0.7),
                fontSize: 14,
              ),
            ),
          ],
        ),
      );
    }
    
    // Show loading screen while loading
    if (_loadingContent) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CupertinoActivityIndicator(
              radius: 15,
            ),
            const SizedBox(height: 24),
            const Text(
              'Loading quiz...',
              style: TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }
    
    final shouldShowGenerate = !_loadingContent && 
        isEmpty && 
        !isGenerating &&
        !_isInitialGeneration &&
        (_studyContent != null); // Must have attempted to load
    
    if (shouldShowGenerate) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFF8B5CF6),
                      Color(0xFFA78BFA),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(25),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF8B5CF6).withOpacity(0.4),
                      blurRadius: 25,
                      spreadRadius: 4,
                    ),
                  ],
                ),
                child: const Icon(
                  CupertinoIcons.question_circle_fill,
                  size: 50,
                  color: Color(0xFFFFFFFF),
                ),
              ),
              const SizedBox(height: 28),
              const Text(
                'No Quiz Yet',
                style: TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Generate quiz questions to test\nyour understanding',
                style: TextStyle(
                  color: const Color(0xFF9CA3AF).withOpacity(0.9),
                  fontSize: 15,
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 36),
              CupertinoButton.filled(
                onPressed: () => _generateContentType('quiz'),
                color: const Color(0xFF8B5CF6),
                borderRadius: BorderRadius.circular(16),
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      CupertinoIcons.sparkles,
                      size: 20,
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Generate Quiz',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }
    
    if (isGenerating) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CupertinoActivityIndicator(
              radius: 15,
            ),
            const SizedBox(height: 24),
            const Text(
              'Generating quiz questions...',
              style: TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }

    // Safety check: ensure _studyContent is not null and has content
    if (_studyContent == null || _studyContent!.quizQuestions.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                CupertinoIcons.question_circle,
                size: 64,
                color: Color(0xFF9CA3AF),
              ),
              const SizedBox(height: 24),
              const Text(
                'No Quiz Available',
                style: TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Generate quiz questions to get started',
                style: TextStyle(
                  color: const Color(0xFF9CA3AF).withOpacity(0.8),
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return _QuizViewer(
      questions: _studyContent!.quizQuestions,
      modeColor: StudyModeColors.getColor(StudyMode.quiz),
    );
  }

  Widget _buildExercisesView() {
    final isGenerating = _generatingContentType == 'exercises';
    final isEmpty = _studyContent?.exercises.isEmpty ?? true;
    
    // Show loading during initial generation
    if (_isInitialGeneration && isEmpty && !isGenerating) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CupertinoActivityIndicator(
              radius: 20,
            ),
            const SizedBox(height: 24),
            const Text(
              'Generating exercises...',
              style: TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 18,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'This may take a few moments',
              style: TextStyle(
                color: const Color(0xFF9CA3AF).withOpacity(0.7),
                fontSize: 14,
              ),
            ),
          ],
        ),
      );
    }
    
    // Show loading screen while loading
    if (_loadingContent) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CupertinoActivityIndicator(
              radius: 15,
            ),
            const SizedBox(height: 24),
            const Text(
              'Loading exercises...',
              style: TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }
    
    final shouldShowGenerate = !_loadingContent && 
        isEmpty && 
        !isGenerating &&
        !_isInitialGeneration &&
        (_studyContent != null); // Must have attempted to load
    
    if (shouldShowGenerate) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFFEF4444),
                      Color(0xFFF87171),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(25),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFEF4444).withOpacity(0.4),
                      blurRadius: 25,
                      spreadRadius: 4,
                    ),
                  ],
                ),
                child: const Icon(
                  CupertinoIcons.pencil_ellipsis_rectangle,
                  size: 50,
                  color: Color(0xFFFFFFFF),
                ),
              ),
              const SizedBox(height: 28),
              const Text(
                'No Exercises Yet',
                style: TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Generate practice exercises\nto reinforce your learning',
                style: TextStyle(
                  color: const Color(0xFF9CA3AF).withOpacity(0.9),
                  fontSize: 15,
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 36),
              CupertinoButton.filled(
                onPressed: () => _generateContentType('exercises'),
                color: const Color(0xFFEF4444),
                borderRadius: BorderRadius.circular(16),
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      CupertinoIcons.sparkles,
                      size: 20,
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Generate Exercises',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }
    
    if (isGenerating) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CupertinoActivityIndicator(
              radius: 15,
            ),
            const SizedBox(height: 24),
            const Text(
              'Generating exercises...',
              style: TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }

    // Safety check: ensure _studyContent is not null and has content
    if (_studyContent == null || _studyContent!.exercises.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                CupertinoIcons.pencil_ellipsis_rectangle,
                size: 64,
                color: Color(0xFF9CA3AF),
              ),
              const SizedBox(height: 24),
              const Text(
                'No Exercises Available',
                style: TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Generate exercises to get started',
                style: TextStyle(
                  color: const Color(0xFF9CA3AF).withOpacity(0.8),
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return _ExercisesViewer(
      exercises: _studyContent!.exercises,
      modeColor: StudyModeColors.getColor(StudyMode.exercises),
    );
  }

  Widget _buildFeynmanView() {
    final isGenerating = _generatingContentType == 'feynman';
    final isEmpty = _studyContent?.feynmanTopics.isEmpty ?? true;
    
    // Show loading during initial generation
    if (_isInitialGeneration && isEmpty && !isGenerating) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CupertinoActivityIndicator(
              radius: 20,
            ),
            const SizedBox(height: 24),
            const Text(
              'Generating Feynman topics...',
              style: TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 18,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'This may take a few moments',
              style: TextStyle(
                color: const Color(0xFF9CA3AF).withOpacity(0.7),
                fontSize: 14,
              ),
            ),
          ],
        ),
      );
    }
    
    // Show loading screen while loading
    if (_loadingContent) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CupertinoActivityIndicator(
              radius: 15,
            ),
            const SizedBox(height: 24),
            const Text(
              'Loading Feynman topics...',
              style: TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }
    
    final shouldShowGenerate = !_loadingContent && 
        isEmpty && 
        !isGenerating &&
        !_isInitialGeneration &&
        (_studyContent != null); // Must have attempted to load
    
    if (shouldShowGenerate) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFFF59E0B),
                      Color(0xFFFBBF24),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(25),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFF59E0B).withOpacity(0.4),
                      blurRadius: 25,
                      spreadRadius: 4,
                    ),
                  ],
                ),
                child: const Icon(
                  CupertinoIcons.lightbulb_fill,
                  size: 50,
                  color: Color(0xFFFFFFFF),
                ),
              ),
              const SizedBox(height: 28),
              const Text(
                'No Topics Yet',
                style: TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Generate Feynman topics to practice\nexplaining concepts simply',
                style: TextStyle(
                  color: const Color(0xFF9CA3AF).withOpacity(0.9),
                  fontSize: 15,
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 36),
              CupertinoButton.filled(
                onPressed: () => _generateContentType('feynman'),
                color: const Color(0xFFF59E0B),
                borderRadius: BorderRadius.circular(16),
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      CupertinoIcons.sparkles,
                      size: 20,
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Generate Topics',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }
    
    if (isGenerating) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CupertinoActivityIndicator(
              radius: 15,
            ),
            const SizedBox(height: 24),
            const Text(
              'Generating Feynman topics...',
              style: TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }

    // Safety check: ensure _studyContent is not null and has content
    if (_studyContent == null || _studyContent!.feynmanTopics.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                CupertinoIcons.lightbulb,
                size: 64,
                color: Color(0xFF9CA3AF),
              ),
              const SizedBox(height: 24),
              const Text(
                'No Feynman Topics Available',
                style: TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Generate topics to get started',
                style: TextStyle(
                  color: const Color(0xFF9CA3AF).withOpacity(0.8),
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return _FeynmanViewer(
      topics: _studyContent!.feynmanTopics,
      noteContent: ref.read(appDataProvider).notes
          .firstWhere((n) => n.id == widget.noteId, orElse: () => Note(
            id: '',
            title: 'Note',
            content: '',
            createdAt: DateTime.now(),
            documents: [],
          )).content,
      modeColor: StudyModeColors.getColor(StudyMode.feynman),
    );
  }

  Widget _buildDocumentsView(Note note) {
    if (note.documents.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              CupertinoIcons.doc_text,
              size: 64,
              color: Color(0xFF9CA3AF),
            ),
            const SizedBox(height: 16),
            const Text(
              'No documents',
              style: TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 16,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(24),
      itemCount: note.documents.length,
      itemBuilder: (context, index) {
        final doc = note.documents[index];
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: const Color(0xFF2A2A2A),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: const Color(0xFF3A3A3A),
              width: 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFF9CA3AF).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  CupertinoIcons.doc_text,
                  color: Color(0xFF9CA3AF),
                  size: 22,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Text(
                  doc.name,
                  style: const TextStyle(
                    color: Color(0xFFFFFFFF),
                    fontSize: 17,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAIChatView(Note note) {
    return AIChatPanel(noteId: widget.noteId ?? '');
  }
}

// Flashcard Viewer Widget
class _FlashcardViewer extends StatefulWidget {
  final List<Flashcard> flashcards;
  final Color modeColor;

  const _FlashcardViewer({required this.flashcards, required this.modeColor});

  @override
  State<_FlashcardViewer> createState() => _FlashcardViewerState();
}

class _FlashcardViewerState extends State<_FlashcardViewer>
    with SingleTickerProviderStateMixin {
  int _currentIndex = 0;
  bool _showBack = false;
  bool _showHint = false;
  late AnimationController _flipController;
  late Animation<double> _flipAnimation;

  @override
  void initState() {
    super.initState();
    _flipController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _flipAnimation = CurvedAnimation(
      parent: _flipController,
      curve: Curves.easeInOut,
    );
  }

  @override
  void dispose() {
    _flipController.dispose();
    super.dispose();
  }

  void _flipCard() {
    HapticFeedback.selectionClick();
    if (_flipController.isCompleted) {
      _flipController.reverse();
    } else {
      _flipController.forward();
    }
    setState(() {
      _showBack = !_showBack;
      if (_showBack) {
        _showHint = false; // Hide hint when showing back
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.flashcards.isEmpty) {
      return const Center(
        child: Text(
          'No flashcards',
          style: TextStyle(color: Color(0xFF9CA3AF)),
        ),
      );
    }

    final card = widget.flashcards[_currentIndex];

    return Column(
      children: [
        Expanded(
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                GestureDetector(
                  onTap: _flipCard,
                  child: AnimatedBuilder(
                    animation: _flipAnimation,
                    builder: (context, child) {
                      return Transform(
                        alignment: Alignment.center,
                        transform: Matrix4.identity()
                          ..setEntry(3, 2, 0.001)
                          ..rotateY(_flipAnimation.value * 3.14159),
                        child: _flipAnimation.value < 0.5
                            ? _buildCardSide(card.front, false)
                            : _buildCardSide(card.back, true),
                      );
                    },
                    child: null, // Explicitly set child to null
                  ),
                ),
                if (!_showBack && card.hint != null && card.hint!.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  CupertinoButton(
                    padding: EdgeInsets.zero,
                    minSize: 0,
                    onPressed: () {
                      HapticFeedback.selectionClick();
                      setState(() {
                        _showHint = !_showHint;
                      });
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        color: _showHint
                            ? widget.modeColor.withOpacity(0.2)
                            : const Color(0xFF2A2A2A),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _showHint
                              ? widget.modeColor
                              : const Color(0xFF3A3A3A),
                          width: 1,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            CupertinoIcons.lightbulb,
                            color: _showHint
                                ? widget.modeColor
                                : const Color(0xFF9CA3AF),
                            size: 18,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Hint',
                            style: TextStyle(
                              color: _showHint
                                  ? widget.modeColor
                                  : const Color(0xFF9CA3AF),
                              fontSize: 15,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_showHint) ...[
                    const SizedBox(height: 12),
                    Container(
                      margin: const EdgeInsets.symmetric(horizontal: 24),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: widget.modeColor.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: widget.modeColor.withOpacity(0.3),
                          width: 1,
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            CupertinoIcons.lightbulb_fill,
                            color: widget.modeColor,
                            size: 20,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              card.hint!,
                              style: TextStyle(
                                color: const Color(0xFFFFFFFF).withOpacity(0.9),
                                fontSize: 15,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(24),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (_currentIndex > 0)
                CupertinoButton(
                  onPressed: () {
                    HapticFeedback.selectionClick();
                    setState(() {
                      _currentIndex--;
                      _showBack = false;
                      _showHint = false;
                      _flipController.reset();
                    });
                  },
                  child: Text(
                    'Previous',
                    style: TextStyle(
                      color: widget.modeColor,
                      fontSize: 16,
                    ),
                  ),
                )
              else
                const SizedBox(width: 80),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFF2A2A2A),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${_currentIndex + 1} / ${widget.flashcards.length}',
                  style: const TextStyle(
                    color: Color(0xFF9CA3AF),
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              if (_currentIndex < widget.flashcards.length - 1)
                CupertinoButton(
                  onPressed: () {
                    HapticFeedback.selectionClick();
                    setState(() {
                      _currentIndex++;
                      _showBack = false;
                      _showHint = false;
                      _flipController.reset();
                    });
                  },
                  child: Text(
                    'Next',
                    style: TextStyle(
                      color: widget.modeColor,
                      fontSize: 16,
                    ),
                  ),
                )
              else
                const SizedBox(width: 80),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCardSide(String text, bool isBack) {
    return Transform(
      alignment: Alignment.center,
      transform: isBack ? (Matrix4.identity()..rotateY(3.14159)) : Matrix4.identity(),
      child: Container(
        margin: const EdgeInsets.all(24),
        padding: const EdgeInsets.all(32),
        width: double.infinity,
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.6,
        ),
        decoration: BoxDecoration(
          color: isBack ? const Color(0xFF2A2A2A) : const Color(0xFF2A2A2A),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isBack ? widget.modeColor : const Color(0xFF3A3A3A),
            width: 2,
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF000000).withOpacity(0.3),
              blurRadius: 20,
              spreadRadius: 2,
            ),
          ],
        ),
        child: SingleChildScrollView(
          child: Text(
            text,
            style: const TextStyle(
              color: Color(0xFFFFFFFF),
              fontSize: 22,
              fontWeight: FontWeight.w500,
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}

// Exercises Viewer Widget
class _ExercisesViewer extends StatefulWidget {
  final List<Exercise> exercises;
  final Color modeColor;

  const _ExercisesViewer({required this.exercises, required this.modeColor});

  @override
  State<_ExercisesViewer> createState() => _ExercisesViewerState();
}

class _ExercisesViewerState extends State<_ExercisesViewer> {
  int _currentIndex = 0;
  final TextEditingController _answerController = TextEditingController();
  String? _feedback;
  bool _isChecking = false;
  bool _showSolution = false;
  bool _hasChecked = false;
  bool _hasText = false;
  bool _showHint = false;

  @override
  void initState() {
    super.initState();
    _answerController.addListener(() {
      final hasText = _answerController.text.trim().isNotEmpty;
      if (hasText != _hasText) {
        setState(() {
          _hasText = hasText;
        });
      }
    });
  }

  @override
  void dispose() {
    _answerController.dispose();
    super.dispose();
  }

  Future<void> _checkAnswer() async {
    if (_answerController.text.trim().isEmpty) return;

    HapticFeedback.mediumImpact();

    setState(() {
      _isChecking = true;
      _hasChecked = true;
      _feedback = null;
    });

    try {
      final aiGateway = AIGatewayService();
      final exercise = widget.exercises[_currentIndex];
      final prompt = '''Compare the student's answer with the correct solution and provide constructive feedback.

Exercise Question: ${exercise.question}

Student's Answer:
${_answerController.text}

Correct Solution:
${exercise.solution ?? 'No solution provided'}

Provide feedback in this JSON format:
{
  "score": <number 0-100>,
  "feedback": "<positive, constructive feedback about what they did well and what needs improvement>",
  "isCorrect": <true/false>
}

Be encouraging but honest. If mostly correct, say so. If partially correct, explain what's right and what needs work. If incorrect, gently guide them to the right answer.

IMPORTANT: Return ONLY valid JSON, no additional text before or after.''';

      final response = await aiGateway.chatCompletion([
        {
          'role': 'system',
          'content': 'You are a helpful teaching assistant that provides constructive feedback on student answers. Always return valid JSON in the requested format.'
        },
        {'role': 'user', 'content': prompt}
      ], model: 'gpt-4o-mini', temperature: 0.7);

      // Try to extract JSON from the response
      String? feedbackText;
      
      // First, try to find JSON object (handles nested objects)
      final jsonObjectMatch = RegExp(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}').firstMatch(response);
      if (jsonObjectMatch != null) {
        try {
          final parsed = jsonDecode(jsonObjectMatch.group(0)!) as Map<String, dynamic>;
          feedbackText = parsed['feedback'] as String?;
        } catch (e) {
          AppLogger.warning('Error parsing JSON', error: e, tag: 'NoteViewScreen');
        }
      }
      
      // If no JSON found or parsing failed, try to extract from markdown code blocks
      if (feedbackText == null) {
        final codeBlockMatch = RegExp(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```').firstMatch(response);
        if (codeBlockMatch != null) {
          try {
            final parsed = jsonDecode(codeBlockMatch.group(1)!) as Map<String, dynamic>;
            feedbackText = parsed['feedback'] as String?;
          } catch (e) {
            AppLogger.warning('Error parsing JSON from code block', error: e, tag: 'NoteViewScreen');
          }
        }
      }
      
      // If still no feedback, use the raw response
        setState(() {
        _feedback = feedbackText ?? response.trim();
      });
      
      HapticFeedback.selectionClick();
    } catch (e) {
      AppLogger.error('Error checking answer', error: e, tag: 'NoteViewScreen');
      ErrorHandler.logError(e, context: 'Checking answer', tag: 'NoteViewScreen');
      final errorMessage = ErrorHandler.getUserFriendlyMessage(e);
      
      setState(() {
        _feedback = errorMessage;
      });
      HapticFeedback.heavyImpact();
    } finally {
      setState(() {
        _isChecking = false;
      });
    }
  }

  void _resetExercise() {
    setState(() {
      _answerController.clear();
      _feedback = null;
      _showSolution = false;
      _hasChecked = false;
      _isChecking = false;
      _hasText = false;
      _showHint = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.exercises.isEmpty) {
      return const Center(
        child: Text(
          'No exercises',
          style: TextStyle(color: Color(0xFF9CA3AF)),
        ),
      );
    }

    final exercise = widget.exercises[_currentIndex];

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2A2A2A),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    'Exercise ${_currentIndex + 1} of ${widget.exercises.length}',
                    style: const TextStyle(
                      color: Color(0xFF9CA3AF),
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        exercise.question,
                        style: const TextStyle(
                          color: Color(0xFFFFFFFF),
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          height: 1.4,
                        ),
                      ),
                    ),
                    if (exercise.hint != null && exercise.hint!.isNotEmpty) ...[
                      const SizedBox(width: 12),
                      CupertinoButton(
                        padding: EdgeInsets.zero,
                        minSize: 0,
                        onPressed: () {
                          HapticFeedback.selectionClick();
                          setState(() {
                            _showHint = !_showHint;
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: _showHint
                                ? widget.modeColor.withOpacity(0.2)
                                : const Color(0xFF2A2A2A),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: _showHint
                                  ? widget.modeColor
                                  : const Color(0xFF3A3A3A),
                              width: 1,
                            ),
                          ),
                          child: Icon(
                            CupertinoIcons.lightbulb,
                            color: _showHint
                                ? widget.modeColor
                                : const Color(0xFF9CA3AF),
                            size: 20,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                if (_showHint && exercise.hint != null && exercise.hint!.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: widget.modeColor.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: widget.modeColor.withOpacity(0.3),
                        width: 1,
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          CupertinoIcons.lightbulb_fill,
                          color: widget.modeColor,
                          size: 20,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            exercise.hint!,
                            style: TextStyle(
                              color: const Color(0xFFFFFFFF).withOpacity(0.9),
                              fontSize: 15,
                              height: 1.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                const Text(
                  'Your Answer:',
                  style: TextStyle(
                    color: Color(0xFF9CA3AF),
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF2A2A2A),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: const Color(0xFF3A3A3A),
                      width: 1,
                    ),
                  ),
                  child: CupertinoTextField(
                    controller: _answerController,
                    placeholder: 'Write your answer here...',
                    placeholderStyle: const TextStyle(
                      color: Color(0xFF6B7280),
                    ),
                    style: const TextStyle(
                      color: Color(0xFFFFFFFF),
                      fontSize: 16,
                    ),
                    maxLines: 12,
                    padding: const EdgeInsets.all(16),
                    enabled: !_isChecking,
                    decoration: const BoxDecoration(),
                  ),
                ),
                const SizedBox(height: 16),
                CupertinoButton.filled(
                  onPressed: (_isChecking || !_hasText)
                      ? null
                      : _checkAnswer,
                  color: widget.modeColor,
                  disabledColor: const Color(0xFF3A3A3A),
                  child: _isChecking
                      ? const CupertinoActivityIndicator(
                          color: Color(0xFFFFFFFF),
                        )
                      : const Text('Check My Work'),
                ),
                if (_feedback != null) ...[
                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3B82F6).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: const Color(0xFF3B82F6),
                        width: 1,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Feedback:',
                          style: TextStyle(
                            color: Color(0xFF93C5FD),
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          _feedback!,
                          style: const TextStyle(
                            color: Color(0xFFDBEAFE),
                            fontSize: 15,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                if (_hasChecked && exercise.solution != null) ...[
                  const SizedBox(height: 16),
                  CupertinoButton(
                    onPressed: () {
                      setState(() {
                        _showSolution = !_showSolution;
                      });
                    },
                    child: Text(
                      _showSolution ? 'Hide Solution' : 'Show Solution',
                      style: TextStyle(
                        color: widget.modeColor,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  if (_showSolution) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1A1A1A),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: const Color(0xFF3A3A3A),
                          width: 1,
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Solution:',
                            style: TextStyle(
                              color: Color(0xFFFFFFFF),
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            exercise.solution!,
                            style: const TextStyle(
                              color: Color(0xFF9CA3AF),
                              fontSize: 15,
                              fontFeatures: [FontFeature.tabularFigures()],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(24),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (_currentIndex > 0)
                CupertinoButton(
                  onPressed: () {
                    HapticFeedback.selectionClick();
                    setState(() {
                      _currentIndex--;
                      _resetExercise();
                    });
                  },
                  child: Text(
                    'Previous',
                    style: TextStyle(
                      color: widget.modeColor,
                      fontSize: 16,
                    ),
                  ),
                )
              else
                const SizedBox(width: 80),
              if (_currentIndex < widget.exercises.length - 1)
                CupertinoButton(
                  onPressed: () {
                    HapticFeedback.selectionClick();
                    setState(() {
                      _currentIndex++;
                      _resetExercise();
                    });
                  },
                  child: Text(
                    'Next',
                    style: TextStyle(
                      color: widget.modeColor,
                      fontSize: 16,
                    ),
                  ),
                )
              else
                const SizedBox(width: 80),
            ],
          ),
        ),
      ],
    );
  }
}

// Feynman Viewer Widget
class _FeynmanViewer extends StatefulWidget {
  final List<FeynmanTopic> topics;
  final String noteContent;
  final Color modeColor;

  const _FeynmanViewer({required this.topics, required this.noteContent, required this.modeColor});

  @override
  State<_FeynmanViewer> createState() => _FeynmanViewerState();
}

class _FeynmanViewerState extends State<_FeynmanViewer> {
  String? _selectedTopicId;
  final TextEditingController _explanationController = TextEditingController();
  String? _feedback;
  bool _isGettingFeedback = false;

  @override
  void dispose() {
    _explanationController.dispose();
    super.dispose();
  }

  void _selectTopic(String topicId) {
    HapticFeedback.selectionClick();
    setState(() {
      _selectedTopicId = topicId;
      _explanationController.clear();
      _feedback = null;
      _isGettingFeedback = false;
    });
  }

  Future<void> _getFeedback() async {
    if (_explanationController.text.trim().isEmpty) return;

    setState(() {
      _isGettingFeedback = true;
      _feedback = null;
    });

    try {
      final aiGateway = AIGatewayService();
      final feedbackPrompt = '''You are a CRITICAL but fair teacher evaluating a student's explanation using the Feynman Technique. The goal is to ensure the explanation is so simple that a 12-year-old could understand it.

Note content:
${widget.noteContent}

Student explanation to evaluate:
${_explanationController.text}

EVALUATION CRITERIA (BE STRICT):
1. Language should be SIMPLE - no jargon, technical terms without explanation, or complex vocabulary
2. Explanations should use ANALOGIES or real-world examples
3. Concepts should be broken down into the SMALLEST possible pieces
4. NO ASSUMPTIONS - the explanation should not assume prior knowledge
5. It should be conversational and clear, like talking to a 12-year-old

Score harshly (20-40%) if: using jargon, technical terms without explanation, assuming knowledge, lacking analogies, too complex
Score mediocre (50-70%) if: generally correct but could be simpler, missing key analogies, some complexity
Score well (80-100%) if: truly simple, uses great analogies, breaks down perfectly, conversational

Respond in JSON format: {"score": number (0-100), "feedback": "critical feedback string", "suggestions": ["string array of specific improvements"]}''';

      final response = await aiGateway.chatCompletion([
        {
          'role': 'system',
          'content': 'You are a STRICT but constructive teacher who insists on truly simple explanations. You must be critical and demand explanations suitable for a 12-year-old. Do not give high scores unless the explanation is genuinely simple, uses analogies, avoids jargon, and breaks concepts into digestible pieces.'
        },
        {'role': 'user', 'content': feedbackPrompt}
      ]);

      final feedbackMatch = RegExp(r'\{[^}]+\}').firstMatch(response);
      if (feedbackMatch != null) {
        final parsed = jsonDecode(feedbackMatch.group(0)!);
        setState(() {
          _feedback = parsed['feedback'] ?? response;
        });
      } else {
        setState(() {
          _feedback = response;
        });
      }
    } catch (e) {
      AppLogger.error('Error processing Feynman explanation', error: e, tag: 'NoteViewScreen');
      ErrorHandler.logError(e, context: 'Processing Feynman explanation', tag: 'NoteViewScreen');
      final errorMessage = ErrorHandler.getUserFriendlyMessage(e);
      setState(() {
        _feedback = errorMessage;
      });
    } finally {
      setState(() {
        _isGettingFeedback = false;
      });
    }
  }

  void _resetTopic() {
    setState(() {
      _selectedTopicId = null;
      _explanationController.clear();
      _feedback = null;
      _isGettingFeedback = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_selectedTopicId == null) {
      // Topic selection view
      return ListView.builder(
        padding: const EdgeInsets.all(24),
        itemCount: widget.topics.length,
        itemBuilder: (context, index) {
          final topic = widget.topics[index];
          return GestureDetector(
            onTap: () => _selectTopic(topic.id),
            child: Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF2A2A2A),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: const Color(0xFF3A3A3A),
                  width: 1,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    topic.title,
                    style: const TextStyle(
                      color: Color(0xFFFFFFFF),
                      fontSize: 19,
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (topic.description.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      topic.description,
                      style: const TextStyle(
                        color: Color(0xFF9CA3AF),
                        fontSize: 15,
                      ),
                      maxLines: 10,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      );
    }

    // Explanation input view
    final selectedTopic = widget.topics.firstWhere((t) => t.id == _selectedTopicId);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  selectedTopic.title,
                  style: const TextStyle(
                    color: Color(0xFFFFFFFF),
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              CupertinoButton(
                onPressed: _resetTopic,
                child: Text(
                  'Back',
                  style: TextStyle(
                    color: widget.modeColor,
                    fontSize: 16,
                  ),
                ),
              ),
            ],
          ),
          if (selectedTopic.description.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1A1A1A),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: widget.modeColor.withOpacity(0.3),
                  width: 1,
                ),
              ),
              child: Text(
                selectedTopic.description,
                style: const TextStyle(
                  color: Color(0xFF9CA3AF),
                  fontSize: 15,
                ),
              ),
            ),
          ],
          const SizedBox(height: 24),
          const Text(
            'Explain in simple terms, like talking to a 12-year-old. Use analogies and everyday examples. Avoid jargon and technical terms...',
            style: TextStyle(
              color: Color(0xFF9CA3AF),
              fontSize: 15,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFF2A2A2A),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: const Color(0xFF3A3A3A),
                width: 1,
              ),
            ),
            child: CupertinoTextField(
              controller: _explanationController,
              placeholder: 'Write your explanation here...',
              placeholderStyle: const TextStyle(
                color: Color(0xFF6B7280),
              ),
              style: const TextStyle(
                color: Color(0xFFFFFFFF),
                fontSize: 16,
              ),
              maxLines: 12,
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(),
            ),
          ),
          const SizedBox(height: 16),
          CupertinoButton.filled(
            onPressed: _isGettingFeedback ? null : _getFeedback,
            color: widget.modeColor,
            child: _isGettingFeedback
                ? const CupertinoActivityIndicator()
                : const Text('Get Feedback'),
          ),
          if (_feedback != null) ...[
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF3B82F6).withOpacity(0.2),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: const Color(0xFF3B82F6),
                  width: 1,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Feedback:',
                    style: TextStyle(
                      color: Color(0xFF93C5FD),
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _feedback!,
                    style: const TextStyle(
                      color: Color(0xFFDBEAFE),
                      fontSize: 15,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Flexible(
                        child: CupertinoButton(
                          onPressed: _resetTopic,
                          color: const Color(0xFF2A2A2A),
                          child: const Text('Choose Another Topic'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Flexible(
                        child: CupertinoButton.filled(
                          onPressed: () {
                            setState(() {
                              _feedback = null;
                              _explanationController.clear();
                            });
                          },
                          color: widget.modeColor,
                          child: const Text('Try Again'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// Quiz Viewer Widget
class _QuizViewer extends StatefulWidget {
  final List<QuizQuestion> questions;
  final Color modeColor;

  const _QuizViewer({required this.questions, required this.modeColor});

  @override
  State<_QuizViewer> createState() => _QuizViewerState();
}

class _QuizViewerState extends State<_QuizViewer> {
  int _currentIndex = 0;
  bool _showHint = false;

  @override
  Widget build(BuildContext context) {
    if (widget.questions.isEmpty) {
      return const Center(
        child: Text(
          'No questions',
          style: TextStyle(color: Color(0xFF9CA3AF)),
        ),
      );
    }

    final question = widget.questions[_currentIndex];

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2A2A2A),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    'Question ${_currentIndex + 1} of ${widget.questions.length}',
                    style: const TextStyle(
                      color: Color(0xFF9CA3AF),
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        question.question,
                        style: const TextStyle(
                          color: Color(0xFFFFFFFF),
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          height: 1.4,
                        ),
                        maxLines: 10,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (question.hint != null && question.hint!.isNotEmpty) ...[
                      const SizedBox(width: 12),
                      CupertinoButton(
                        padding: EdgeInsets.zero,
                        minSize: 0,
                        onPressed: () {
                          HapticFeedback.selectionClick();
                          setState(() {
                            _showHint = !_showHint;
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: _showHint
                                ? widget.modeColor.withOpacity(0.2)
                                : const Color(0xFF2A2A2A),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: _showHint
                                  ? widget.modeColor
                                  : const Color(0xFF3A3A3A),
                              width: 1,
                            ),
                          ),
                          child: Icon(
                            CupertinoIcons.lightbulb,
                            color: _showHint
                                ? widget.modeColor
                                : const Color(0xFF9CA3AF),
                            size: 20,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                if (_showHint && question.hint != null && question.hint!.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: widget.modeColor.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: widget.modeColor.withOpacity(0.3),
                        width: 1,
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          CupertinoIcons.lightbulb_fill,
                          color: widget.modeColor,
                          size: 20,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            question.hint!,
                            style: TextStyle(
                              color: const Color(0xFFFFFFFF).withOpacity(0.9),
                              fontSize: 15,
                              height: 1.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 32),
                ...question.options.asMap().entries.map((entry) {
                  final index = entry.key;
                  final option = entry.value;
                  final isSelected = question.userAnswer == index;
                  final isCorrect = index == question.correctAnswer;
                  final hasAnswer = question.userAnswer != null;
                  final showCorrect = hasAnswer && isCorrect;
                  final showWrong = hasAnswer && isSelected && !isCorrect;

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: GestureDetector(
                      onTap: () {
                        if (!hasAnswer) {
                          HapticFeedback.selectionClick();
                          setState(() {
                            question.userAnswer = index;
                          });
                        }
                      },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: showCorrect
                              ? const Color(0xFF10B981).withOpacity(0.2)
                              : showWrong
                                  ? const Color(0xFFEF4444).withOpacity(0.2)
                                  : isSelected && !hasAnswer
                                      ? const Color(0xFF3A3A3A)
                                      : const Color(0xFF2A2A2A),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: showCorrect
                                ? const Color(0xFF10B981)
                                : showWrong
                                    ? const Color(0xFFEF4444)
                                    : isSelected && !hasAnswer
                                        ? widget.modeColor
                                        : const Color(0xFF3A3A3A),
                            width: (showCorrect || showWrong || (isSelected && !hasAnswer)) ? 2 : 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                '${String.fromCharCode(65 + index)}. $option',
                                style: TextStyle(
                                  color: (showCorrect || showWrong || (isSelected && !hasAnswer))
                                      ? const Color(0xFFFFFFFF)
                                      : const Color(0xFF9CA3AF),
                                  fontSize: 17,
                                  fontWeight:
                                      (showCorrect || showWrong || (isSelected && !hasAnswer))
                                          ? FontWeight.w600
                                          : FontWeight.w400,
                                ),
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (showCorrect)
                              const Padding(
                                padding: EdgeInsets.only(left: 12),
                                child: Icon(
                                  CupertinoIcons.check_mark_circled_solid,
                                  color: Color(0xFF10B981),
                                  size: 24,
                                ),
                              ),
                            if (showWrong)
                              const Padding(
                                padding: EdgeInsets.only(left: 12),
                                child: Icon(
                                  CupertinoIcons.xmark_circle_fill,
                                  color: Color(0xFFEF4444),
                                  size: 24,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
                // Show explanation when answer is selected
                if (question.userAnswer != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: question.userAnswer == question.correctAnswer
                          ? const Color(0xFF10B981).withOpacity(0.15)
                          : const Color(0xFF3B82F6).withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: question.userAnswer == question.correctAnswer
                            ? const Color(0xFF10B981)
                            : const Color(0xFF3B82F6),
                        width: 1,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              question.userAnswer == question.correctAnswer
                                  ? CupertinoIcons.check_mark_circled_solid
                                  : CupertinoIcons.info_circle_fill,
                              color: question.userAnswer == question.correctAnswer
                                  ? const Color(0xFF10B981)
                                  : const Color(0xFF3B82F6),
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              question.userAnswer == question.correctAnswer
                                  ? 'Correct!'
                                  : 'Correct Answer: ${String.fromCharCode(65 + question.correctAnswer)}. ${question.options[question.correctAnswer]}',
                              style: TextStyle(
                                color: question.userAnswer == question.correctAnswer
                                    ? const Color(0xFF10B981)
                                    : const Color(0xFF93C5FD),
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        if (question.explanation != null && question.explanation!.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text(
                            question.explanation!,
                            style: TextStyle(
                              color: const Color(0xFFFFFFFF).withOpacity(0.9),
                              fontSize: 15,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(24),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              if (_currentIndex > 0)
                CupertinoButton(
                  onPressed: () {
                    HapticFeedback.selectionClick();
                    setState(() {
                      _currentIndex--;
                      _showHint = false;
                    });
                  },
                  child: Text(
                    'Previous',
                    style: TextStyle(
                      color: widget.modeColor,
                      fontSize: 16,
                    ),
                  ),
                )
              else
                const SizedBox(width: 80),
              if (_currentIndex < widget.questions.length - 1)
                CupertinoButton(
                  onPressed: () {
                    HapticFeedback.selectionClick();
                    setState(() {
                      _currentIndex++;
                      _showHint = false;
                    });
                  },
                  child: Text(
                    'Next',
                    style: TextStyle(
                      color: widget.modeColor,
                      fontSize: 16,
                    ),
                  ),
                )
              else
                const SizedBox(width: 80),
            ],
          ),
        ),
      ],
    );
  }
}
