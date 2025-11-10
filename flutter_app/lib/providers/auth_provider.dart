import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../services/supabase_service.dart';
import '../utils/logger.dart';
import 'dart:async';

class AuthNotifier extends AsyncNotifier<User?> {
  final _supabase = SupabaseService();
  StreamSubscription? _authSubscription;

  @override
  Future<User?> build() async {
    AppLogger.debug('Building auth provider, checking for persisted session...', tag: 'AuthProvider');
    
    // Supabase automatically restores session from secure storage on initialization
    // Wait a bit to ensure Supabase has finished initializing and restored any session
    await Future.delayed(const Duration(milliseconds: 300));
    
    AppLogger.debug('Checking current user...', tag: 'AuthProvider');
    // Get current user (this checks persisted session from secure storage)
    // Supabase Flutter automatically restores the session, so currentSession
    // will be available if a session was previously saved
    final user = _supabase.getCurrentUser();
    
    if (user != null) {
      AppLogger.success('Found persisted user: ${user.email}', tag: 'AuthProvider');
    } else {
      AppLogger.info('No persisted user found', tag: 'AuthProvider');
    }
    
    // Listen for auth state changes (handles session refresh, new logins, and logouts)
    // This stream will also emit the current state immediately when subscribed,
    // including any restored session
    _authSubscription?.cancel();
    AppLogger.debug('Setting up auth state listener...', tag: 'AuthProvider');
    _authSubscription = _supabase.authStateChanges.listen((authState) {
      AppLogger.debug('Auth state changed: ${authState.session != null ? "Session exists" : "No session"}', tag: 'AuthProvider');
      if (authState.session?.user != null) {
        final currentUser = User.fromJson(authState.session!.user.toJson());
        AppLogger.success('Updating state with user: ${currentUser.email}', tag: 'AuthProvider');
        state = AsyncData(currentUser);
      } else {
        AppLogger.info('Clearing auth state (no session)', tag: 'AuthProvider');
        state = const AsyncData(null);
      }
    });
    
    // Clean up subscription when provider is disposed
    ref.onDispose(() {
      AppLogger.debug('Disposing auth provider', tag: 'AuthProvider');
      _authSubscription?.cancel();
    });
    
    return user;
  }

  Future<bool> signIn(String email, String password) async {
    AppLogger.info('Sign in attempt for: $email', tag: 'AuthProvider');
    try {
      state = const AsyncLoading();
      final response = await _supabase.signIn(email, password);
      if (response.user != null && response.session != null) {
        final user = User.fromJson(response.user!.toJson());
        AppLogger.success('Sign in successful for: ${user.email}', tag: 'AuthProvider');
        AppLogger.debug('Session should be saved by SupabaseService', tag: 'AuthProvider');
        state = AsyncData(user);
        return true;
      }
      AppLogger.warning('Sign in failed: no user or session in response', tag: 'AuthProvider');
      return false;
    } catch (e, stackTrace) {
      AppLogger.error('Sign in error', error: e, stackTrace: stackTrace, tag: 'AuthProvider');
      state = AsyncError(e, stackTrace);
      return false;
    }
  }

  Future<Map<String, dynamic>> signUp(String email, String password, String name) async {
    AppLogger.info('Sign up attempt for: $email', tag: 'AuthProvider');
    try {
      state = const AsyncLoading();
      final response = await _supabase.signUp(email, password, name);
      if (response.user != null && response.session != null) {
        final user = User.fromJson(response.user!.toJson());
        AppLogger.success('Sign up successful for: ${user.email}', tag: 'AuthProvider');
        AppLogger.debug('Session should be saved by SupabaseService', tag: 'AuthProvider');
        state = AsyncData(user);
        return {'success': true};
      }
      AppLogger.warning('Sign up completed but no session (may require email confirmation)', tag: 'AuthProvider');
      return {'success': false, 'error': 'Sign up failed'};
    } catch (e, stackTrace) {
      AppLogger.error('Sign up error', error: e, stackTrace: stackTrace, tag: 'AuthProvider');
      state = AsyncError(e, stackTrace);
      final errorMsg = e.toString();
      if (errorMsg.contains('compromised') || errorMsg.contains('breach')) {
        return {
          'success': false,
          'error': 'This password has been found in a data breach. Please choose a different password.',
        };
      }
      return {'success': false, 'error': errorMsg};
    }
  }

  Future<void> signOut() async {
    AppLogger.info('Sign out requested', tag: 'AuthProvider');
    await _supabase.signOut();
    // Clear the auth state - Supabase will also clear the persisted session
    AppLogger.success('Sign out complete, state cleared', tag: 'AuthProvider');
    state = const AsyncData(null);
  }
}

final authProvider = AsyncNotifierProvider<AuthNotifier, User?>(() {
  return AuthNotifier();
});

