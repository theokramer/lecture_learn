import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/note.dart';
import '../models/folder.dart';
import '../models/document.dart';
import '../models/user.dart' as app_models;
import '../models/study_content.dart';
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
    print('🔐 [SupabaseService] Initializing Supabase...');
    
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
      print('🔍 [SupabaseService] Checking for persisted session...');
      
      // Check Supabase's built-in session first
      final currentSession = _client?.auth.currentSession;
      if (currentSession != null) {
        print('✅ [SupabaseService] Found Supabase session: ${currentSession.user.email}');
        // Also save it to our secure storage for redundancy
        await _saveSessionToStorage(currentSession);
        return;
      }
      
      // Check our secure storage
      final savedSession = await _storage.read(key: _sessionKey);
      final savedUser = await _storage.read(key: _userKey);
      
      if (savedSession != null && savedUser != null) {
        print('📦 [SupabaseService] Found saved session in secure storage');
        try {
          final userData = jsonDecode(savedUser) as Map<String, dynamic>;
          
          // Note: Supabase handles session restoration automatically,
          // but we log this for debugging
          print('✅ [SupabaseService] Session data found for user: ${userData['email']}');
          print('ℹ️ [SupabaseService] Supabase should have restored this session automatically');
        } catch (e) {
          print('❌ [SupabaseService] Error parsing saved session: $e');
          await _clearStoredSession();
        }
      } else {
        print('ℹ️ [SupabaseService] No persisted session found');
      }
    } catch (e) {
      print('❌ [SupabaseService] Error checking session: $e');
    }
  }
  
  Future<void> _saveSessionToStorage(Session session) async {
    try {
      print('💾 [SupabaseService] Saving session to secure storage...');
      final sessionData = {
        'access_token': session.accessToken,
        'refresh_token': session.refreshToken ?? '',
        'expires_at': session.expiresAt,
        'expires_in': session.expiresIn,
      };
      final userData = session.user.toJson();
      
      await _storage.write(key: _sessionKey, value: jsonEncode(sessionData));
      await _storage.write(key: _userKey, value: jsonEncode(userData));
      print('✅ [SupabaseService] Session saved successfully for: ${session.user.email}');
    } catch (e) {
      print('❌ [SupabaseService] Error saving session: $e');
    }
  }
  
  Future<void> _clearStoredSession() async {
    try {
      print('🗑️ [SupabaseService] Clearing stored session...');
      await _storage.delete(key: _sessionKey);
      await _storage.delete(key: _userKey);
      print('✅ [SupabaseService] Stored session cleared');
    } catch (e) {
      print('❌ [SupabaseService] Error clearing session: $e');
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
    print('🔑 [SupabaseService] Signing in user: $email');
    final response = await client.auth.signInWithPassword(
      email: email,
      password: password,
    );
    
    if (response.session != null) {
      print('✅ [SupabaseService] Sign in successful, saving session...');
      await _saveSessionToStorage(response.session!);
      print('✅ [SupabaseService] Session saved for: ${response.user?.email}');
    } else {
      print('⚠️ [SupabaseService] Sign in response has no session');
    }
    
    return response;
  }

  Future<AuthResponse> signUp(String email, String password, String name) async {
    print('📝 [SupabaseService] Signing up user: $email');
    final response = await client.auth.signUp(
      email: email,
      password: password,
      data: {'name': name},
    );
    
    if (response.session != null) {
      print('✅ [SupabaseService] Sign up successful, saving session...');
      await _saveSessionToStorage(response.session!);
      print('✅ [SupabaseService] Session saved for: ${response.user?.email}');
    } else {
      print('⚠️ [SupabaseService] Sign up response has no session (may require email confirmation)');
    }
    
    return response;
  }

  Future<void> signOut() async {
    print('🚪 [SupabaseService] Signing out user...');
    await client.auth.signOut();
    await _clearStoredSession();
    print('✅ [SupabaseService] User signed out and session cleared');
  }

  app_models.User? getCurrentUser() {
    final session = client.auth.currentSession;
    if (session == null) {
      print('ℹ️ [SupabaseService] No current session found');
      return null;
    }
    print('✅ [SupabaseService] Current user found: ${session.user.email}');
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
    final response = await client
        .from('notes')
        .select()
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

  Future<Note> createNote(String userId, String title, String? folderId, {String content = ''}) async {
    final response = await client.from('notes').insert({
      'user_id': userId,
      'title': title,
      'folder_id': folderId,
      'content': content,
    }).select().single();
    return Note.fromJson(response);
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
    print('🔄 [SupabaseService] Moving note $id to folder: ${newFolderId ?? "null (root)"}');
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
      print('✅ [SupabaseService] Note moved successfully. New folder_id: ${updatedFolderId ?? "null (root)"}');
      
      // Verify the update actually worked
      if (updatedFolderId != newFolderId) {
        throw Exception('Update verification failed: expected folder_id ${newFolderId ?? "null"}, got ${updatedFolderId ?? "null"}');
      }
    } catch (e) {
      print('❌ [SupabaseService] Error moving note: $e');
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

  Future<String> uploadFile(String userId, File file) async {
    final fileName = '${DateTime.now().millisecondsSinceEpoch}_${file.path.split('/').last}';
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
    return client.storage.from('documents').getPublicUrl(path);
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
        return StudyContent();
      }

      // Take the first (most recent) row, similar to web app behavior
      final data = (response as List).first;

      return StudyContent.fromJson(data as Map<String, dynamic>);
    } catch (e) {
      print('Error loading study content: $e');
      // Return empty content on error rather than crashing
      return StudyContent();
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
      }).toList(),
      'quiz_questions': content.quizQuestions.map((q) => {
        'id': q.id,
        'question': q.question,
        'options': q.options,
        'correct': q.correctAnswer,
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
}

