import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/note.dart';
import '../models/folder.dart';
import '../models/document.dart';
import '../models/user.dart' as app_models;
import '../models/study_content.dart';
import '../models/chat_message.dart';
import '../utils/logger.dart';
import 'dart:io';
import 'dart:convert';

class SupabaseService {
  static final SupabaseService _instance = SupabaseService._internal();
  factory SupabaseService() => _instance;
  SupabaseService._internal();

  SupabaseClient? _client;
  bool _initialized = false;
  static const _storage = FlutterSecureStorage();
  static const _sessionKey = 'supabase_session';
  static const _userKey = 'supabase_user';

  Future<void> initialize(String url, String anonKey) async {
    if (_initialized) return;
    AppLogger.info('Initializing Supabase...', tag: 'SupabaseService');
    
    // Supabase Flutter automatically persists sessions by default
    // The session is stored in secure storage and restored on app restart
    await Supabase.initialize(
      url: url,
      anonKey: anonKey,
    );
    _client = Supabase.instance.client;
    _initialized = true;
    
    // Check if we have a persisted session
    await _checkAndRestoreSession();
  }
  
  Future<void> _checkAndRestoreSession() async {
    try {
      AppLogger.debug('Checking for persisted session...', tag: 'SupabaseService');
      
      // Check Supabase's built-in session first
      final currentSession = _client?.auth.currentSession;
      if (currentSession != null) {
        AppLogger.success('Found Supabase session: ${currentSession.user.email}', tag: 'SupabaseService');
        // Also save it to our secure storage for redundancy
        await _saveSessionToStorage(currentSession);
        return;
      }
      
      // Check our secure storage
      final savedSession = await _storage.read(key: _sessionKey);
      final savedUser = await _storage.read(key: _userKey);
      
      if (savedSession != null && savedUser != null) {
        AppLogger.debug('Found saved session in secure storage', tag: 'SupabaseService');
        try {
          final userData = jsonDecode(savedUser) as Map<String, dynamic>;
          
          // Note: Supabase handles session restoration automatically,
          // but we log this for debugging
          AppLogger.success('Session data found for user: ${userData['email']}', tag: 'SupabaseService');
          AppLogger.info('Supabase should have restored this session automatically', tag: 'SupabaseService');
        } catch (e) {
          AppLogger.error('Error parsing saved session', error: e, tag: 'SupabaseService');
          await _clearStoredSession();
        }
      } else {
        AppLogger.info('No persisted session found', tag: 'SupabaseService');
      }
    } catch (e) {
      AppLogger.error('Error checking session', error: e, tag: 'SupabaseService');
    }
  }
  
  Future<void> _saveSessionToStorage(Session session) async {
    try {
      AppLogger.debug('Saving session to secure storage...', tag: 'SupabaseService');
      final sessionData = {
        'access_token': session.accessToken,
        'refresh_token': session.refreshToken ?? '',
        'expires_at': session.expiresAt,
        'expires_in': session.expiresIn,
      };
      final userData = session.user.toJson();
      
      await _storage.write(key: _sessionKey, value: jsonEncode(sessionData));
      await _storage.write(key: _userKey, value: jsonEncode(userData));
      AppLogger.success('Session saved successfully for: ${session.user.email}', tag: 'SupabaseService');
    } catch (e) {
      AppLogger.error('Error saving session', error: e, tag: 'SupabaseService');
    }
  }
  
  Future<void> _clearStoredSession() async {
    try {
      AppLogger.debug('Clearing stored session...', tag: 'SupabaseService');
      await _storage.delete(key: _sessionKey);
      await _storage.delete(key: _userKey);
      AppLogger.success('Stored session cleared', tag: 'SupabaseService');
    } catch (e) {
      AppLogger.error('Error clearing session', error: e, tag: 'SupabaseService');
    }
  }

  SupabaseClient get client {
    if (!_initialized || _client == null) {
      throw Exception('Supabase not initialized. Please check your .env file.');
    }
    return _client!;
  }

  // Auth
  Future<AuthResponse> signIn(String email, String password) async {
    AppLogger.info('Signing in user: $email', tag: 'SupabaseService');
    final response = await client.auth.signInWithPassword(
      email: email,
      password: password,
    );
    
    if (response.session != null) {
      AppLogger.success('Sign in successful, saving session...', tag: 'SupabaseService');
      await _saveSessionToStorage(response.session!);
      AppLogger.success('Session saved for: ${response.user?.email}', tag: 'SupabaseService');
    } else {
      AppLogger.warning('Sign in response has no session', tag: 'SupabaseService');
    }
    
    return response;
  }

  Future<AuthResponse> signUp(String email, String password, String name) async {
    AppLogger.info('Signing up user: $email', tag: 'SupabaseService');
    final response = await client.auth.signUp(
      email: email,
      password: password,
      data: {'name': name},
    );
    
    if (response.session != null) {
      AppLogger.success('Sign up successful, saving session...', tag: 'SupabaseService');
      await _saveSessionToStorage(response.session!);
      AppLogger.success('Session saved for: ${response.user?.email}', tag: 'SupabaseService');
    } else {
      AppLogger.warning('Sign up response has no session (may require email confirmation)', tag: 'SupabaseService');
    }
    
    return response;
  }

  Future<AuthResponse> signInAnonymously() async {
    AppLogger.info('Signing in anonymously...', tag: 'SupabaseService');
    final response = await client.auth.signInAnonymously();
    
    if (response.session != null) {
      AppLogger.success('Anonymous sign in successful, saving session...', tag: 'SupabaseService');
      await _saveSessionToStorage(response.session!);
      AppLogger.success('Anonymous session saved for user: ${response.user?.id}', tag: 'SupabaseService');
    } else {
      AppLogger.warning('Anonymous sign in response has no session', tag: 'SupabaseService');
    }
    
    return response;
  }

  Future<void> signOut() async {
    AppLogger.info('Signing out user...', tag: 'SupabaseService');
    await client.auth.signOut();
    await _clearStoredSession();
    AppLogger.success('User signed out and session cleared', tag: 'SupabaseService');
  }

  app_models.User? getCurrentUser() {
    final session = client.auth.currentSession;
    if (session == null) {
      AppLogger.info('No current session found', tag: 'SupabaseService');
      return null;
    }
    AppLogger.success('Current user found: ${session.user.email}', tag: 'SupabaseService');
    return app_models.User.fromJson(session.user.toJson());
  }

  Stream<AuthState> get authStateChanges => client.auth.onAuthStateChange;

  // Folders
  Future<List<Folder>> getFolders(String userId, {String? parentId}) async {
    final response = await client
        .from('folders')
        .select()
        .eq('user_id', userId)
        .order('created_at', ascending: false);
    
    final allFolders = (response as List)
        .map((f) => Folder.fromJson(f as Map<String, dynamic>))
        .toList();
    
    // Filter by parentId in Dart
    if (parentId == null) {
      return allFolders.where((f) => f.parentId == null).toList();
    } else {
      return allFolders.where((f) => f.parentId == parentId).toList();
    }
  }

  Future<List<Folder>> getAllFolders(String userId) async {
    final response = await client
        .from('folders')
        .select()
        .eq('user_id', userId)
        .order('created_at', ascending: false);
    return (response as List)
        .map((f) => Folder.fromJson(f as Map<String, dynamic>))
        .toList();
  }

  Future<Folder> createFolder(String userId, String name, String? parentId) async {
    final response = await client.from('folders').insert({
      'user_id': userId,
      'name': name,
      'parent_id': parentId,
    }).select().single();
    return Folder.fromJson(response);
  }

  Future<void> updateFolder(String id, String name) async {
    await client.from('folders').update({'name': name}).eq('id', id);
  }

  Future<void> deleteFolder(String id) async {
    await client.from('folders').delete().eq('id', id);
  }

  Future<void> moveFolder(String id, String? newParentId) async {
    await client.from('folders').update({'parent_id': newParentId}).eq('id', id);
  }

  // Notes
  Future<List<Note>> getNotes(String userId, {String? folderId}) async {
    // Explicitly select all fields including content to ensure full content is fetched
    final response = await client
        .from('notes')
        .select('id, user_id, folder_id, title, content, created_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', ascending: false);
    
    final allNotes = (response as List)
        .map((n) => Note.fromJson(n as Map<String, dynamic>))
        .toList();
    
    // Filter by folderId in Dart
    // If folderId is provided, filter by it. Otherwise return ALL notes.
    List<Note> filteredNotes;
    if (folderId != null) {
      // Filter to specific folder
      filteredNotes = allNotes.where((n) => n.folderId == folderId).toList();
    } else {
      // Return all notes (used when refreshing all data)
      filteredNotes = allNotes;
    }

    // Load documents for each note
    final notesWithDocs = <Note>[];
    for (var note in filteredNotes) {
      final docs = await getDocuments(note.id);
      notesWithDocs.add(note.copyWith(documents: docs));
    }

    return notesWithDocs;
  }

  /// Fetch a single note with full content (useful for large transcriptions)
  Future<Note> getNoteById(String noteId) async {
    try {
      final response = await client
          .from('notes')
          .select('id, user_id, folder_id, title, content, created_at, updated_at')
          .eq('id', noteId)
          .single();
      
      final note = Note.fromJson(response);
      
      // Load documents for the note
      final docs = await getDocuments(note.id);
      
      AppLogger.debug('Fetched note: id=$noteId, contentLength=${note.content.length}', tag: 'SupabaseService');
      
      return note.copyWith(documents: docs);
    } catch (e) {
      AppLogger.error('Error fetching note by ID: $noteId', error: e, tag: 'SupabaseService');
      rethrow;
    }
  }

  Future<Note> createNote(String userId, String title, String? folderId, {String content = ''}) async {
    // Ensure all required fields are present and valid
    final insertData = <String, dynamic>{
      'user_id': userId,
      'title': title.isNotEmpty ? title : 'Untitled Note',
    };
    
    // Only include folder_id if it's not null (Supabase handles null differently)
    if (folderId != null && folderId.isNotEmpty) {
      insertData['folder_id'] = folderId;
    }
    
    // Always include content, even if empty (Supabase requires it to be present)
    // For very large content, ensure it's a valid string that can be JSON-encoded
    if (content.isNotEmpty) {
      // Sanitize content to ensure it's valid for JSON encoding
      String sanitizedContent = content;
      
      // Remove null bytes and control characters that break JSON
      sanitizedContent = sanitizedContent.replaceAll('\x00', '');
      sanitizedContent = sanitizedContent.replaceAll(RegExp(r'[\x01-\x08\x0B-\x0C\x0E-\x1F]'), '');
      
      // Ensure valid UTF-8 encoding
      try {
        final bytes = utf8.encode(sanitizedContent);
        sanitizedContent = utf8.decode(bytes, allowMalformed: false);
      } catch (e) {
        // If encoding fails, try with allowMalformed
        try {
          final bytes = utf8.encode(content);
          sanitizedContent = utf8.decode(bytes, allowMalformed: true);
          sanitizedContent = sanitizedContent.replaceAll('\x00', '');
          sanitizedContent = sanitizedContent.replaceAll(RegExp(r'[\x01-\x08\x0B-\x0C\x0E-\x1F]'), '');
        } catch (e2) {
          // Last resort: keep only safe characters
          sanitizedContent = content.replaceAll(RegExp(r'[^\x20-\x7E\n\r\t\u00A0-\uFFFF]'), '');
        }
      }
      
      // Test JSON encoding to ensure it's valid
      try {
        jsonEncode(sanitizedContent);
        insertData['content'] = sanitizedContent;
      } catch (jsonError) {
        AppLogger.error('Content cannot be JSON encoded', error: jsonError, tag: 'SupabaseService');
        // If JSON encoding fails, try to fix it by removing problematic characters
        sanitizedContent = sanitizedContent.replaceAll(RegExp(r'[^\x20-\x7E\n\r\t\u00A0-\uFFFF]'), '');
        insertData['content'] = sanitizedContent;
      }
    } else {
      insertData['content'] = '';
    }
    
    try {
      AppLogger.debug('Creating note: title=$title, contentLength=${content.length}, folderId=$folderId', tag: 'SupabaseService');
      final response = await client.from('notes').insert(insertData).select().single();
      return Note.fromJson(response);
    } catch (e) {
      AppLogger.error('Error creating note', error: e, tag: 'SupabaseService');
      AppLogger.debug('Insert data: userId=$userId, title=$title, folderId=$folderId, contentLength=${content.length}', tag: 'SupabaseService');
      
      // Check for specific error types
      final errorStr = e.toString();
      if (errorStr.contains('PGRST102') || errorStr.contains('Empty or invalid json')) {
        // This might be due to content being too large or containing invalid characters
        if (content.length > 10 * 1024 * 1024) { // 10MB
          throw Exception('Note content is too large (${(content.length / 1024 / 1024).toStringAsFixed(2)} MB). Please split into smaller notes.');
        }
        throw Exception('Failed to create note: Invalid content format. Please check the file content and try again.');
      }
      
      rethrow;
    }
  }

  Future<void> updateNote(String id, {String? title, String? content, String? folderId}) async {
    final updates = <String, dynamic>{};
    if (title != null) updates['title'] = title;
    if (content != null) updates['content'] = content;
    if (folderId != null) updates['folder_id'] = folderId;
    await client.from('notes').update(updates).eq('id', id);
  }

  Future<void> deleteNote(String id) async {
    await client.from('notes').delete().eq('id', id);
  }

  Future<void> moveNote(String id, String? newFolderId) async {
    AppLogger.info('Moving note $id to folder: ${newFolderId ?? "null (root)"}', tag: 'SupabaseService');
    try {
      // Explicitly set folder_id - including null to clear it
      // Supabase requires null to be explicitly included in the update map
      final updateData = <String, dynamic>{};
      if (newFolderId == null) {
        // Explicitly set to null to move to root
        updateData['folder_id'] = null;
      } else {
        updateData['folder_id'] = newFolderId;
      }
      
      // Use select() to get the updated row back and verify the update worked
      final response = await client
          .from('notes')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
      
      final updatedFolderId = response['folder_id'] as String?;
      AppLogger.success('Note moved successfully. New folder_id: ${updatedFolderId ?? "null (root)"}', tag: 'SupabaseService');
      
      // Verify the update actually worked
      if (updatedFolderId != newFolderId) {
        throw Exception('Update verification failed: expected folder_id ${newFolderId ?? "null"}, got ${updatedFolderId ?? "null"}');
      }
    } catch (e) {
      AppLogger.error('Error moving note', error: e, tag: 'SupabaseService');
      rethrow;
    }
  }

  // Documents
  Future<List<Document>> getDocuments(String noteId) async {
    final response = await client
        .from('documents')
        .select()
        .eq('note_id', noteId)
        .order('uploaded_at', ascending: false);
    return (response as List)
        .map((d) => Document.fromJson(d as Map<String, dynamic>))
        .toList();
  }

  Future<Document> createDocument(String noteId, String fileName, String storagePath, int size, String type) async {
    final response = await client.from('documents').insert({
      'note_id': noteId,
      'name': fileName,
      'type': type,
      'storage_path': storagePath,
      'size': size,
    }).select().single();
    return Document.fromJson(response);
  }

  /// Sanitizes a filename for use in Supabase Storage
  /// Replaces invalid characters with underscores and preserves the extension
  String _sanitizeFileName(String fileName) {
    // Split filename and extension
    final parts = fileName.split('.');
    if (parts.length < 2) {
      // No extension, just sanitize the whole name
      return fileName.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_');
    }
    
    // Get extension (last part)
    final extension = parts.last;
    // Get base name (everything except last part)
    final baseName = parts.sublist(0, parts.length - 1).join('.');
    
    // Sanitize base name: replace invalid characters with underscores
    // Allow: alphanumeric, dots, hyphens, underscores
    final sanitizedBase = baseName.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_');
    
    // Remove consecutive underscores and trim
    final cleanedBase = sanitizedBase.replaceAll(RegExp(r'_+'), '_').replaceAll(RegExp(r'^_|_$'), '');
    
    // Reconstruct filename
    return '$cleanedBase.$extension';
  }

  Future<String> uploadFile(String userId, File file) async {
    final originalFileName = file.path.split('/').last;
    final sanitizedFileName = _sanitizeFileName(originalFileName);
    final fileName = '${DateTime.now().millisecondsSinceEpoch}_$sanitizedFileName';
    final path = '$userId/$fileName';
    
    // Determine MIME type from file extension
    final extension = file.path.split('.').last.toLowerCase();
    final mimeType = _getMimeType(extension);
    
    // Upload with correct content type so Edge Function can detect it
    await client.storage.from('documents').upload(
      path,
      file,
      fileOptions: FileOptions(
        contentType: mimeType,
        upsert: false,
      ),
    );
    return path;
  }

  String _getMimeType(String extension) {
    switch (extension) {
      case 'm4a':
        return 'audio/m4a';
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'webm':
        return 'audio/webm';
      case 'ogg':
        return 'audio/ogg';
      case 'flac':
        return 'audio/flac';
      case 'mp4':
        return 'audio/mp4';
      default:
        return 'audio/wav'; // Default to wav for maximum compatibility
    }
  }

  Future<String> getFileUrl(String path) async {
    // Check if it's a local path (starts with "local://")
    if (path.startsWith('local://')) {
      // For local paths, return the path as-is (will be handled by LocalDocumentService)
      return path;
    }
    // For remote paths, get the public URL from Supabase storage
    return client.storage.from('documents').getPublicUrl(path);
  }

  /// Get a signed URL for a file in storage (expires in specified seconds)
  Future<String> getSignedUrl(String path, {int expiresIn = 3600}) async {
    try {
      final signedUrl = await client.storage
          .from('documents')
          .createSignedUrl(path, expiresIn);
      return signedUrl;
    } catch (e) {
      throw Exception('Failed to create signed URL: $e');
    }
  }

  // Study Content
  Future<StudyContent> getStudyContent(String noteId) async {
    try {
      // Get all rows and take the most recent one (handles duplicates like web app)
      final response = await client
          .from('study_content')
          .select()
          .eq('note_id', noteId)
          .order('updated_at', ascending: false);

      if ((response as List).isEmpty) {
        // No content exists - return empty content (this is a valid state, not an error)
        AppLogger.debug('No study content found for note: $noteId', tag: 'SupabaseService');
        return StudyContent();
      }

      // Take the first (most recent) row, similar to web app behavior
      final data = (response as List).first;
      final content = StudyContent.fromJson(data as Map<String, dynamic>);
      
      AppLogger.success('Study content loaded successfully for note: $noteId', 
        context: {
          'summary': content.summary.isNotEmpty ? '${content.summary.length} chars' : 'empty',
          'flashcards': content.flashcards.length,
          'quiz': content.quizQuestions.length,
          'exercises': content.exercises.length,
          'feynman': content.feynmanTopics.length,
        },
        tag: 'SupabaseService',
      );
      
      return content;
    } catch (e) {
      AppLogger.error('Error loading study content for note $noteId', error: e, tag: 'SupabaseService');
      // Re-throw the error so the UI knows loading failed
      rethrow;
    }
  }

  Future<void> saveStudyContent(String noteId, StudyContent content) async {
    final data = <String, dynamic>{
      'note_id': noteId,
      'summary': content.summary,
      'flashcards': content.flashcards.map((f) => {
        'id': f.id,
        'front': f.front,
        'back': f.back,
        'hint': f.hint,
      }).toList(),
      'quiz_questions': content.quizQuestions.map((q) => {
        'id': q.id,
        'question': q.question,
        'options': q.options,
        'correct': q.correctAnswer,
        'hint': q.hint,
        'explanation': q.explanation,
      }).toList(),
      'exercises': content.exercises.map((e) => {
        'id': e.id,
        'question': e.question,
        'solution': e.solution,
      }).toList(),
      'feynman_topics': content.feynmanTopics.map((t) => {
        'id': t.id,
        'title': t.title,
        'description': t.description,
      }).toList(),
    };

    // Check if exists
    final existing = await client
        .from('study_content')
        .select('id')
        .eq('note_id', noteId)
        .maybeSingle();

    if (existing != null) {
      await client.from('study_content').update(data).eq('id', existing['id']);
    } else {
      await client.from('study_content').insert(data);
    }
  }

  /// Get or create a conversation for a note
  Future<String> getOrCreateConversation(String userId, String? noteId) async {
    try {
      // Try to find existing conversation for this note
      if (noteId != null) {
        final existing = await client
            .from('chat_conversations')
            .select('id')
            .eq('user_id', userId)
            .eq('note_id', noteId)
            .maybeSingle();

        if (existing != null) {
          return existing['id'] as String;
        }
      }

      // Create new conversation
      final response = await client
          .from('chat_conversations')
          .insert({
            'user_id': userId,
            'note_id': noteId,
            'title': noteId != null ? 'Note Conversation' : 'General Conversation',
          })
          .select('id')
          .single();

      return response['id'] as String;
    } catch (e) {
      AppLogger.error('Error getting/creating conversation', error: e, tag: 'SupabaseService');
      rethrow;
    }
  }

  /// Load messages from a conversation
  Future<List<ChatMessage>> loadConversationMessages(String conversationId) async {
    try {
      final response = await client
          .from('chat_messages')
          .select()
          .eq('conversation_id', conversationId)
          .order('created_at', ascending: true);

      if (response.isEmpty) {
        return [];
      }

      return (response as List).map((msg) {
        return ChatMessage(
          id: msg['id'] as String,
          role: msg['role'] as String,
          content: msg['content'] as String,
          timestamp: DateTime.parse(msg['created_at'] as String),
        );
      }).toList();
    } catch (e) {
      AppLogger.error('Error loading conversation messages', error: e, tag: 'SupabaseService');
      rethrow;
    }
  }

  /// Save a message to a conversation
  Future<void> saveMessage(String conversationId, String role, String content) async {
    try {
      await client.from('chat_messages').insert({
        'conversation_id': conversationId,
        'role': role,
        'content': content,
      });

      // Update conversation's updated_at timestamp
      await client
          .from('chat_conversations')
          .update({'updated_at': DateTime.now().toIso8601String()})
          .eq('id', conversationId);

      AppLogger.debug('Message saved to conversation: $conversationId', tag: 'SupabaseService');
    } catch (e) {
      AppLogger.error('Error saving message', error: e, tag: 'SupabaseService');
      rethrow;
    }
  }

  /// Get count of notes with study content (including deleted ones)
  /// Returns the count of notes with study content for the user.
  /// If account_limits is blocked by RLS, counts directly from study_content table.
  Future<int> getNotesWithStudyContentCount(String userId) async {
    try {
      final response = await client
          .from('account_limits')
          .select('notes_with_study_content_count')
          .eq('user_id', userId)
          .maybeSingle();

      if (response == null) {
        // Try to create default entry if it doesn't exist
        try {
          await client.from('account_limits').insert({
            'user_id': userId,
            'daily_ai_limit': 150,
            'notes_with_study_content_count': 0,
          });
          return 0;
        } catch (insertError) {
          // If insert fails due to RLS, count directly from study_content table
          final errorStr = insertError.toString();
          if (errorStr.contains('row-level security') || errorStr.contains('42501')) {
            AppLogger.warning('RLS policy blocked account_limits insert - counting from study_content table', tag: 'SupabaseService');
            return await _countNotesWithStudyContentFromTable(userId);
          }
          rethrow;
        }
      }

      return (response['notes_with_study_content_count'] as int?) ?? 0;
    } catch (e) {
      AppLogger.error('Error getting notes with study content count', error: e, tag: 'SupabaseService');
      final errorStr = e.toString();
      // If RLS error, count directly from study_content table
      if (errorStr.contains('row-level security') || errorStr.contains('42501')) {
        AppLogger.warning('RLS error accessing account_limits - counting from study_content table', tag: 'SupabaseService');
        return await _countNotesWithStudyContentFromTable(userId);
      }
      // For other errors, return 0 to allow note creation (graceful degradation)
      return 0;
    }
  }

  /// Count notes with study content directly from the study_content table.
  /// This is used as a fallback when account_limits is blocked by RLS.
  Future<int> _countNotesWithStudyContentFromTable(String userId) async {
    try {
      // Get all notes for the user that have study content
      // Join notes with study_content to count distinct notes with actual content
      final notesResponse = await client
          .from('notes')
          .select('id')
          .eq('user_id', userId);

      if (notesResponse.isEmpty) {
        return 0;
      }

      final noteIds = (notesResponse as List).map((n) => n['id'] as String).toList();
      
      // Count distinct notes that have study content with actual data
      int count = 0;
      for (final noteId in noteIds) {
        try {
          // Check if study_content exists for this note
          final studyContentResponse = await client
              .from('study_content')
              .select('summary, flashcards, quiz_questions, exercises, feynman_topics')
              .eq('note_id', noteId)
              .order('updated_at', ascending: false)
              .limit(1);
          
          if (studyContentResponse.isNotEmpty) {
            final data = studyContentResponse.first;
            // Check if any study content actually exists
            final hasSummary = (data['summary'] as String? ?? '').trim().isNotEmpty;
            final hasFlashcards = (data['flashcards'] as List? ?? []).isNotEmpty;
            final hasQuiz = (data['quiz_questions'] as List? ?? []).isNotEmpty;
            final hasExercises = (data['exercises'] as List? ?? []).isNotEmpty;
            final hasFeynman = (data['feynman_topics'] as List? ?? []).isNotEmpty;
            
            if (hasSummary || hasFlashcards || hasQuiz || hasExercises || hasFeynman) {
              count++;
            }
          }
        } catch (e) {
          // Skip notes that can't be accessed
          continue;
        }
      }

      AppLogger.info('Counted $count notes with study content from table for user: $userId', tag: 'SupabaseService');
      return count;
    } catch (e) {
      AppLogger.error('Error counting notes with study content from table', error: e, tag: 'SupabaseService');
      // On error, return 0 to allow note creation (graceful degradation)
      return 0;
    }
  }

  /// Increment count of notes with study content
  /// If this fails due to RLS, the count will be accurate when queried from the table
  Future<void> incrementNotesWithStudyContentCount(String userId) async {
    try {
      // First, ensure the account_limits entry exists
      final existing = await client
          .from('account_limits')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();

      if (existing == null) {
        // Create entry with count = 1
        try {
          await client.from('account_limits').insert({
            'user_id': userId,
            'daily_ai_limit': 150,
            'notes_with_study_content_count': 1,
          });
          AppLogger.info('Created account_limits entry with count=1 for user: $userId', tag: 'SupabaseService');
        } catch (insertError) {
          final errorStr = insertError.toString();
          if (errorStr.contains('row-level security') || errorStr.contains('42501')) {
            AppLogger.warning('RLS blocked account_limits insert - count will be tracked via table queries', tag: 'SupabaseService');
            // Don't throw - count will be accurate when queried from table
            return;
          }
          rethrow;
        }
      } else {
        // Increment existing count
        try {
          await client.rpc('increment_notes_count', params: {'user_id_param': userId});
          AppLogger.info('Incremented notes with study content count via RPC for user: $userId', tag: 'SupabaseService');
        } catch (rpcError) {
          // If RPC doesn't exist or fails, use update with increment
          final currentCount = await getNotesWithStudyContentCount(userId);
          try {
            await client
                .from('account_limits')
                .update({'notes_with_study_content_count': currentCount + 1})
                .eq('user_id', userId);
            AppLogger.info('Incremented notes with study content count via update for user: $userId (new count: ${currentCount + 1})', tag: 'SupabaseService');
          } catch (updateError) {
            final errorStr = updateError.toString();
            if (errorStr.contains('row-level security') || errorStr.contains('42501')) {
              AppLogger.warning('RLS blocked account_limits update - count will be tracked via table queries', tag: 'SupabaseService');
              // Don't throw - count will be accurate when queried from table
              return;
            }
            rethrow;
          }
        }
      }
    } catch (e) {
      AppLogger.error('Error incrementing notes with study content count', error: e, tag: 'SupabaseService');
      // Don't throw - this is not critical for note creation
      // The count will be accurate when queried from the table
    }
  }
}

