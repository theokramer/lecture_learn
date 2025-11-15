import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/note.dart';
import '../models/folder.dart';
import '../models/study_content.dart';
import '../models/user.dart';
import '../services/supabase_service.dart';
import '../services/ai_gateway_service.dart';
import '../services/document_processor_service.dart';
import '../utils/logger.dart';
import '../utils/error_handler.dart';
import '../utils/environment.dart';
import 'auth_provider.dart';
import 'dart:io';

class AppDataNotifier extends Notifier<AppDataState> {
  final _supabase = SupabaseService();
  final _aiGateway = AIGatewayService();

  @override
  AppDataState build() {
    final authValue = ref.read(authProvider);
    User? user;
    try {
      user = authValue.value;
    } catch (_) {
      // User not loaded yet, will load when auth is ready
    }
    if (user != null) {
      // Load data asynchronously after build
      Future.microtask(() => refreshData());
    }
    return AppDataState();
  }

  Future<void> refreshData() async {
    final authValue = ref.read(authProvider);
    User? user;
    try {
      user = authValue.value;
    } catch (_) {
      return;
    }
    if (user == null) return;

    try {
      state = state.copyWith(loading: true);
      final folders = await _supabase.getAllFolders(user.id);
      final notes = await _supabase.getNotes(user.id);
      
      AppLogger.info('Refreshed data: ${folders.length} folders, ${notes.length} notes', tag: 'AppDataProvider');
      // Debug: log notes with their folderIds
      if (Environment.isDevelopment) {
        for (var note in notes) {
          AppLogger.debug('Note "${note.title}" - folderId: ${note.folderId ?? "null (root)"}', tag: 'AppDataProvider');
        }
      }
      
      state = state.copyWith(
        folders: folders,
        allFolders: folders,
        notes: notes,
        loading: false,
      );
    } catch (e) {
      AppLogger.error('Error refreshing data', error: e, tag: 'AppDataProvider');
      state = state.copyWith(loading: false, error: ErrorHandler.getUserFriendlyMessage(e));
    }
  }

  Future<String> createNote(String title, {String? folderId, String content = ''}) async {
    final authValue = ref.read(authProvider);
    User? user;
    try {
      user = authValue.value;
    } catch (_) {
      throw Exception('Not authenticated');
    }
    if (user == null) throw Exception('Not authenticated');

    try {
      final note = await _supabase.createNote(user.id, title, folderId, content: content);
      await refreshData();
      return note.id;
    } catch (e) {
      throw Exception('Failed to create note: $e');
    }
  }

  Future<void> updateNote(String id, {String? title, String? content, String? folderId}) async {
    await _supabase.updateNote(id, title: title, content: content, folderId: folderId);
    await refreshData();
  }

  Future<void> deleteNote(String id) async {
    await _supabase.deleteNote(id);
    await refreshData();
  }

  Future<void> moveNote(String id, String? newFolderId) async {
    try {
      AppLogger.info('Moving note $id to folder: ${newFolderId ?? "null (root)"}', tag: 'AppDataProvider');
      await _supabase.moveNote(id, newFolderId);
      AppLogger.success('Note moved, refreshing data...', tag: 'AppDataProvider');
      await refreshData();
      AppLogger.success('Data refreshed after move', tag: 'AppDataProvider');
    } catch (e, stackTrace) {
      AppLogger.error('Error moving note', error: e, stackTrace: stackTrace, tag: 'AppDataProvider');
      rethrow;
    }
  }

  Future<String> createFolder(String name, String? parentId) async {
    final authValue = ref.read(authProvider);
    User? user;
    try {
      user = authValue.value;
    } catch (_) {
      throw Exception('Not authenticated');
    }
    if (user == null) throw Exception('Not authenticated');

    try {
      await _supabase.createFolder(user.id, name, parentId);
      await refreshData();
      return '';
    } catch (e) {
      throw Exception('Failed to create folder: $e');
    }
  }

  Future<void> deleteFolder(String id) async {
    await _supabase.deleteFolder(id);
    await refreshData();
  }

  Future<void> moveFolder(String id, String? newParentId) async {
    await _supabase.moveFolder(id, newParentId);
    await refreshData();
  }

  Future<void> processAudioRecording(File audioFile, String title, {String? folderId}) async {
    final authValue = ref.read(authProvider);
    User? user;
    try {
      user = authValue.value;
    } catch (_) {
      throw Exception('Not authenticated');
    }
    if (user == null) throw Exception('Not authenticated');

    try {
      // Validate audio file exists and has content
      if (!await audioFile.exists()) {
        throw Exception('Audio file does not exist');
      }
      final fileSize = await audioFile.length();
      if (fileSize == 0) {
        throw Exception('Audio file is empty');
      }
      AppLogger.debug('Processing audio file: ${audioFile.path}, size: $fileSize bytes', tag: 'AppDataProvider');

      // Check rate limit
      await _aiGateway.checkRateLimit(user.id, user.email);

      // Upload audio
      final storagePath = await _supabase.uploadFile(user.id, audioFile);
      AppLogger.debug('Audio uploaded to storage: $storagePath', tag: 'AppDataProvider');

      // Transcribe using Supabase Edge Function (exactly like website)
      final transcription = await _aiGateway.transcribeAudio(
        audioFile,
        storagePath: storagePath,
        userId: user.id,
      );

      // Generate title using Supabase Edge Function (exactly like website)
      String? aiTitle;
      try {
        aiTitle = await _aiGateway.generateTitle(transcription);
      } catch (e) {
        // Title generation is optional - will use provided title or default
        AppLogger.warning('Title generation failed (non-critical)', error: e, tag: 'AppDataProvider');
      }

      // Create note
      final noteId = await createNote(aiTitle ?? title, folderId: folderId, content: transcription);

      // Create document record
      await _supabase.createDocument(
        noteId,
        audioFile.path.split('/').last,
        storagePath,
        await audioFile.length(),
        'audio',
      );

      // Generate study content in background
      _generateStudyContent(noteId, transcription);

      state = state.copyWith(selectedNoteId: noteId);
    } catch (e) {
      if (e is RateLimitError) {
        rethrow;
      }
      throw Exception('Failed to process audio: $e');
    }
  }

  Future<void> processUploadedFiles(List<File> files, String title, {String? folderId}) async {
    final authValue = ref.read(authProvider);
    User? user;
    try {
      user = authValue.value;
    } catch (_) {
      throw Exception('Not authenticated');
    }
    if (user == null) throw Exception('Not authenticated');

    try {
      await _aiGateway.checkRateLimit(user.id, user.email);

      String combinedText = '';
      final fileMetadata = <Map<String, dynamic>>[];
      final documentProcessor = DocumentProcessorService();

      for (final file in files) {
        // Upload file to storage first
        final storagePath = await _supabase.uploadFile(user.id, file);
        fileMetadata.add({
          'file': file,
          'storagePath': storagePath,
        });

        // Extract content from file (matches website's UploadPage.tsx)
        try {
          final fileName = file.path.split('/').last;
          final fileSize = await file.length();
          final mimeType = await _getMimeType(file);
          
          AppLogger.debug('Processing file: $fileName (${(fileSize / 1024 / 1024).toStringAsFixed(2)} MB, type: $mimeType)', tag: 'AppDataProvider');
          
          if (documentProcessor.isAudioFile(mimeType)) {
            // Audio file - transcribe using Edge Function
            final transcription = await _aiGateway.transcribeAudio(
              file,
              storagePath: storagePath,
              userId: user.id,
            );
            combinedText += 'File: $fileName\n$transcription\n\n';
          } else if (documentProcessor.isVideoFile(mimeType)) {
            // Video file - for now, just note it (video audio extraction is complex)
            combinedText += 'File: $fileName\n[Video file - audio extraction not yet implemented]\n\n';
          } else {
            // Document file (PDF, DOCX, PPTX, TXT, etc.) - extract text
            AppLogger.debug('Extracting text from document: $fileName', tag: 'AppDataProvider');
            final text = await documentProcessor.processDocument(file);
            final textLength = text.length;
            AppLogger.debug('Extracted ${textLength} characters from $fileName', tag: 'AppDataProvider');
            
            if (text.trim().isEmpty) {
              throw Exception('No text content found in file. The file may be empty, contain only images, or be in an unsupported format.');
            }
            
            combinedText += 'File: $fileName\n$text\n\n';
          }
        } catch (fileError) {
          AppLogger.error('Error processing file ${file.path}', error: fileError, tag: 'AppDataProvider');
          // Re-throw the error so user knows which file failed
          throw Exception('Failed to process file "${file.path.split('/').last}": $fileError');
        }
      }

      // Ensure we have content before creating note
      if (combinedText.trim().isEmpty) {
        throw Exception('No content extracted from uploaded files. Please ensure the files contain readable text.');
      }

      // Generate title using Supabase Edge Function (exactly like website)
      String? aiTitle;
      try {
        aiTitle = await _aiGateway.generateTitle(combinedText);
      } catch (e) {
        // Title generation is optional - will use provided title or default
        AppLogger.warning('Title generation failed (non-critical)', error: e, tag: 'AppDataProvider');
      }

      // Create note - ensure title is not empty
      final finalTitle = (aiTitle ?? title).trim();
      if (finalTitle.isEmpty) {
        throw Exception('Note title cannot be empty');
      }
      
      final noteId = await createNote(finalTitle, folderId: folderId, content: combinedText);

      // Create document records
      for (final metadata in fileMetadata) {
        final file = metadata['file'] as File;
        final extension = file.path.split('.').last.toLowerCase();
        final docType = _getDocumentType(extension);
        await _supabase.createDocument(
          noteId,
          file.path.split('/').last,
          metadata['storagePath'] as String,
          await file.length(),
          docType,
        );
      }

      // Generate study content in background
      _generateStudyContent(noteId, combinedText);

      state = state.copyWith(selectedNoteId: noteId);
    } catch (e) {
      if (e is RateLimitError) {
        rethrow;
      }
      throw Exception('Failed to process files: $e');
    }
  }

  void _generateStudyContent(String noteId, String content) {
    // Generate in background via Supabase Edge Function (exactly like website)
    // NOTE: This is ONLY called during note creation, NEVER when viewing existing notes
    Future(() async {
      try {
        if (content.trim().isEmpty || content.length < 50) {
          AppLogger.warning('Not enough content to generate study content', tag: 'AppDataProvider');
          return;
        }

        AppLogger.info('Starting study content generation for note: $noteId', tag: 'AppDataProvider');
        AppLogger.debug('NOTE: This is only called during note creation, not when viewing notes', tag: 'AppDataProvider');
        
        // Detect language from content using AI
        final detectedLanguage = await _aiGateway.detectLanguage(content);
        AppLogger.info('Detected language: $detectedLanguage', tag: 'AppDataProvider');

        // Check existing study content to avoid regenerating
        final existing = await _supabase.getStudyContent(noteId);
        final hasSummary = existing.summary.isNotEmpty;
        final hasFlashcards = existing.flashcards.isNotEmpty;
        final hasQuiz = existing.quizQuestions.isNotEmpty;
        final hasExercises = existing.exercises.isNotEmpty;
        final hasFeynmanTopics = existing.feynmanTopics.isNotEmpty;
        
        // If all content already exists, skip generation entirely
        if (hasSummary && hasFlashcards && hasQuiz && hasExercises && hasFeynmanTopics) {
          AppLogger.success('All study content already exists, skipping generation', tag: 'AppDataProvider');
          return;
        }
        
        AppLogger.debug('Existing content status - Summary: $hasSummary, Flashcards: $hasFlashcards, Quiz: $hasQuiz, Exercises: $hasExercises, Feynman: $hasFeynmanTopics', tag: 'AppDataProvider');
        
        // Get documents for summary context
        final note = state.notes.firstWhere((n) => n.id == noteId, orElse: () => throw Exception('Note not found'));
        final documents = note.documents.map((d) => <String, dynamic>{
          'name': d.name,
          'type': d.type.toString().split('.').last,
        }).toList();

        // Generate summary, flashcards, quiz, exercises, and feynman topics in parallel
        final futures = <Future<dynamic>>[];

        String summary = existing.summary;
        List<Flashcard> flashcards = existing.flashcards;
        List<QuizQuestion> quizQuestions = existing.quizQuestions;
        List<Exercise> exercises = existing.exercises;
        List<FeynmanTopic> feynmanTopics = existing.feynmanTopics;
        
        // Generate summary if it doesn't exist
        if (!hasSummary) {
          futures.add(_aiGateway.generateSummary(content, documents: documents, detailLevel: 'comprehensive', language: detectedLanguage).then((generatedSummary) {
            return generatedSummary; // Return the summary string
          }).catchError((e) {
            AppLogger.error('Error generating summary', error: e, tag: 'AppDataProvider');
            return ''; // Return empty string on error
          }));
        }

        if (!hasFlashcards) {
          futures.add(_aiGateway.generateFlashcards(content, count: 20, language: detectedLanguage).then((data) {
            return data.asMap().entries.map((entry) {
              final card = entry.value;
              return Flashcard(
                id: 'gen-${DateTime.now().millisecondsSinceEpoch}-${entry.key}',
                front: card['front'] as String,
                back: card['back'] as String,
                hint: card['hint'] as String?,
              );
            }).toList();
          }).catchError((e) {
            AppLogger.error('Error generating flashcards', error: e, tag: 'AppDataProvider');
            return <Flashcard>[];
          }));
        }

        if (!hasQuiz) {
          futures.add(_aiGateway.generateQuiz(content, count: 15, language: detectedLanguage).then((data) {
            return data.asMap().entries.map((entry) {
              final question = entry.value;
              return QuizQuestion(
                id: 'gen-${DateTime.now().millisecondsSinceEpoch}-${entry.key}',
                question: question['question'] as String,
                options: (question['options'] as List).cast<String>(),
                correctAnswer: question['correctAnswer'] as int,
                hint: question['hint'] as String?,
                explanation: question['explanation'] as String?,
              );
            }).toList();
          }).catchError((e) {
            AppLogger.error('Error generating quiz', error: e, tag: 'AppDataProvider');
            return <QuizQuestion>[];
          }));
        }

        if (!hasExercises) {
          futures.add(_aiGateway.generateExercises(content, count: 10, language: detectedLanguage).then((data) {
            return data.asMap().entries.map((entry) {
              final exercise = entry.value;
              return Exercise(
                id: 'gen-${DateTime.now().millisecondsSinceEpoch}-${entry.key}',
                question: exercise['question'] as String,
                solution: exercise['solution'] as String,
                hint: exercise['hint'] as String?,
              );
            }).toList();
          }).catchError((e) {
            AppLogger.error('Error generating exercises', error: e, tag: 'AppDataProvider');
            return <Exercise>[];
          }));
        }

        if (!hasFeynmanTopics) {
          futures.add(_aiGateway.generateFeynmanTopics(content, language: detectedLanguage).then((data) {
            return data.map((topic) {
              return FeynmanTopic(
                id: topic['id'] as String,
                title: topic['title'] as String,
                description: topic['description'] as String,
              );
            }).toList();
          }).catchError((e) {
            AppLogger.error('Error generating feynman topics', error: e, tag: 'AppDataProvider');
            return <FeynmanTopic>[];
          }));
        }

        // Wait for all generations to complete and collect results
        if (futures.isNotEmpty) {
          final results = await Future.wait(futures);
          int resultIndex = 0;
          
          if (!hasSummary && resultIndex < results.length) {
            final summaryResult = results[resultIndex++];
            summary = summaryResult is String ? summaryResult : (summaryResult?.toString() ?? '');
          }
          if (!hasFlashcards && resultIndex < results.length) {
            final flashcardResult = results[resultIndex++];
            flashcards = flashcardResult is List<Flashcard> ? flashcardResult : <Flashcard>[];
          }
          if (!hasQuiz && resultIndex < results.length) {
            final quizResult = results[resultIndex++];
            quizQuestions = quizResult is List<QuizQuestion> ? quizResult : <QuizQuestion>[];
          }
          if (!hasExercises && resultIndex < results.length) {
            final exerciseResult = results[resultIndex++];
            exercises = exerciseResult is List<Exercise> ? exerciseResult : <Exercise>[];
          }
          if (!hasFeynmanTopics && resultIndex < results.length) {
            final feynmanResult = results[resultIndex++];
            feynmanTopics = feynmanResult is List<FeynmanTopic> ? feynmanResult : <FeynmanTopic>[];
          }
        }

        // Save study content
        final studyContent = StudyContent(
          summary: summary,
          flashcards: flashcards,
          quizQuestions: quizQuestions,
          exercises: exercises,
          feynmanTopics: feynmanTopics,
        );

        await _supabase.saveStudyContent(noteId, studyContent);
        AppLogger.success('Study content generation completed for note: $noteId', tag: 'AppDataProvider');
      } catch (e) {
        AppLogger.error('Background study content generation failed', error: e, tag: 'AppDataProvider');
        // Don't throw - this is background processing
      }
    });
  }

  /// Generate specific study content type on demand
  Future<void> generateStudyContentType(String noteId, String contentType) async {
    try {
      final note = state.notes.firstWhere(
        (n) => n.id == noteId,
        orElse: () => throw Exception('Note not found'),
      );

      if (note.content.trim().isEmpty || note.content.length < 50) {
        throw Exception('Not enough content to generate study content');
      }

      AppLogger.info('Generating $contentType for note: $noteId', tag: 'AppDataProvider');

      // Get existing content
      final existing = await _supabase.getStudyContent(noteId);
      final documents = note.documents.map((d) => <String, dynamic>{
        'name': d.name,
        'type': d.type.toString().split('.').last,
      }).toList();

      String summary = existing.summary;
      List<Flashcard> flashcards = existing.flashcards;
      List<QuizQuestion> quizQuestions = existing.quizQuestions;
      List<Exercise> exercises = existing.exercises;
      List<FeynmanTopic> feynmanTopics = existing.feynmanTopics;

      // Detect language from content using AI
      final detectedLanguage = await _aiGateway.detectLanguage(note.content);
      AppLogger.info('Detected language: $detectedLanguage', tag: 'AppDataProvider');
      
      // Generate the requested content type
      switch (contentType) {
        case 'summary':
          if (summary.isEmpty) {
            summary = await _aiGateway.generateSummary(
              note.content,
              documents: documents,
              detailLevel: 'comprehensive',
              language: detectedLanguage,
            );
          }
          break;
        case 'flashcards':
          if (flashcards.isEmpty) {
            final data = await _aiGateway.generateFlashcards(note.content, count: 20, language: detectedLanguage);
            flashcards = data.asMap().entries.map((entry) {
              final card = entry.value;
              return Flashcard(
                id: 'gen-${DateTime.now().millisecondsSinceEpoch}-${entry.key}',
                front: card['front'] as String,
                back: card['back'] as String,
                hint: card['hint'] as String?,
              );
            }).toList();
          }
          break;
        case 'quiz':
          if (quizQuestions.isEmpty) {
            final data = await _aiGateway.generateQuiz(note.content, count: 15, language: detectedLanguage);
            quizQuestions = data.asMap().entries.map((entry) {
              final question = entry.value;
              return QuizQuestion(
                id: 'gen-${DateTime.now().millisecondsSinceEpoch}-${entry.key}',
                question: question['question'] as String,
                options: (question['options'] as List).cast<String>(),
                correctAnswer: question['correctAnswer'] as int,
                hint: question['hint'] as String?,
                explanation: question['explanation'] as String?,
              );
            }).toList();
          }
          break;
        case 'exercises':
          if (exercises.isEmpty) {
            final data = await _aiGateway.generateExercises(note.content, count: 10, language: detectedLanguage);
            exercises = data.asMap().entries.map((entry) {
              final exercise = entry.value;
              return Exercise(
                id: 'gen-${DateTime.now().millisecondsSinceEpoch}-${entry.key}',
                question: exercise['question'] as String,
                solution: exercise['solution'] as String,
                hint: exercise['hint'] as String?,
              );
            }).toList();
          }
          break;
        case 'feynman':
          if (feynmanTopics.isEmpty) {
            final data = await _aiGateway.generateFeynmanTopics(note.content, language: detectedLanguage);
            feynmanTopics = data.map((topic) {
              return FeynmanTopic(
                id: topic['id'] as String,
                title: topic['title'] as String,
                description: topic['description'] as String,
              );
            }).toList();
          }
          break;
      }

      // Save updated study content
      final studyContent = StudyContent(
        summary: summary,
        flashcards: flashcards,
        quizQuestions: quizQuestions,
        exercises: exercises,
        feynmanTopics: feynmanTopics,
      );

      await _supabase.saveStudyContent(noteId, studyContent);
      AppLogger.success('$contentType generated and saved for note: $noteId', tag: 'AppDataProvider');
    } catch (e) {
      AppLogger.error('Error generating $contentType', error: e, tag: 'AppDataProvider');
      rethrow;
    }
  }

  /// Public method to generate study content for a note
  /// Used when creating notes from web links or manual creation
  void generateStudyContentForNote(String noteId, String content) {
    _generateStudyContent(noteId, content);
  }

  Future<String> _getMimeType(File file) async {
    final extension = file.path.split('.').last.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'txt':
      case 'md':
        return 'text/plain';
      case 'json':
        return 'application/json';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'pptx':
        return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      case 'mp3':
      case 'wav':
        return 'audio/mpeg';
      case 'mp4':
        return 'video/mp4';
      default:
        return 'application/octet-stream';
    }
  }

  String _getDocumentType(String extension) {
    switch (extension.toLowerCase()) {
      case 'pdf':
        return 'pdf';
      case 'doc':
      case 'docx':
        return 'doc';
      case 'txt':
      case 'md':
      case 'json':
        return 'text';
      case 'mp3':
      case 'wav':
        return 'audio';
      case 'mp4':
        return 'video';
      default:
        return 'text';
    }
  }

  void setSelectedNoteId(String? id) {
    state = state.copyWith(selectedNoteId: id);
  }

  void setCurrentFolderId(String? id) {
    state = state.copyWith(currentFolderId: id);
  }

  void setCurrentStudyMode(StudyMode mode) {
    state = state.copyWith(currentStudyMode: mode);
  }
}

class AppDataState {
  final List<Folder> folders;
  final List<Folder> allFolders;
  final List<Note> notes;
  final bool loading;
  final String? error;
  final String? selectedNoteId;
  final String? currentFolderId;
  final StudyMode currentStudyMode;

  AppDataState({
    this.folders = const [],
    this.allFolders = const [],
    this.notes = const [],
    this.loading = false,
    this.error,
    this.selectedNoteId,
    this.currentFolderId,
    this.currentStudyMode = StudyMode.summary,
  });

  AppDataState copyWith({
    List<Folder>? folders,
    List<Folder>? allFolders,
    List<Note>? notes,
    bool? loading,
    String? error,
    String? selectedNoteId,
    String? currentFolderId,
    StudyMode? currentStudyMode,
  }) {
    return AppDataState(
      folders: folders ?? this.folders,
      allFolders: allFolders ?? this.allFolders,
      notes: notes ?? this.notes,
      loading: loading ?? this.loading,
      error: error ?? this.error,
      selectedNoteId: selectedNoteId ?? this.selectedNoteId,
      currentFolderId: currentFolderId ?? this.currentFolderId,
      currentStudyMode: currentStudyMode ?? this.currentStudyMode,
    );
  }

  List<Folder> get currentFolders {
    if (currentFolderId == null) {
      return folders.where((f) => f.parentId == null).toList();
    }
    return folders.where((f) => f.parentId == currentFolderId).toList();
  }

  List<Note> get currentNotes {
    if (currentFolderId == null) {
      return notes.where((n) => n.folderId == null).toList();
    }
    return notes.where((n) => n.folderId == currentFolderId).toList();
  }
}

final appDataProvider = NotifierProvider<AppDataNotifier, AppDataState>(() {
  return AppDataNotifier();
});

