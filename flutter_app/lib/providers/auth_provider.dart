import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../services/supabase_service.dart';
import 'dart:async';

class AuthNotifier extends AsyncNotifier<User?> {
  final _supabase = SupabaseService();
  StreamSubscription? _authSubscription;

  @override
  Future<User?> build() async {
    print('🔍 [AuthProvider] Building auth provider, checking for persisted session...');
    
    // Supabase automatically restores session from secure storage on initialization
    // Wait a bit to ensure Supabase has finished initializing and restored any session
    await Future.delayed(const Duration(milliseconds: 300));
    
    print('🔍 [AuthProvider] Checking current user...');
    // Get current user (this checks persisted session from secure storage)
    // Supabase Flutter automatically restores the session, so currentSession
    // will be available if a session was previously saved
    final user = _supabase.getCurrentUser();
    
    if (user != null) {
      print('✅ [AuthProvider] Found persisted user: ${user.email}');
    } else {
      print('ℹ️ [AuthProvider] No persisted user found');
    }
    
    // Listen for auth state changes (handles session refresh, new logins, and logouts)
    // This stream will also emit the current state immediately when subscribed,
    // including any restored session
    _authSubscription?.cancel();
    print('👂 [AuthProvider] Setting up auth state listener...');
    _authSubscription = _supabase.authStateChanges.listen((authState) {
      print('🔄 [AuthProvider] Auth state changed: ${authState.session != null ? "Session exists" : "No session"}');
      if (authState.session?.user != null) {
        final currentUser = User.fromJson(authState.session!.user.toJson());
        print('✅ [AuthProvider] Updating state with user: ${currentUser.email}');
        state = AsyncData(currentUser);
      } else {
        print('ℹ️ [AuthProvider] Clearing auth state (no session)');
        state = const AsyncData(null);
      }
    });
    
    // Clean up subscription when provider is disposed
    ref.onDispose(() {
      print('🧹 [AuthProvider] Disposing auth provider');
      _authSubscription?.cancel();
    });
    
    return user;
  }

  Future<bool> signIn(String email, String password) async {
    print('🔑 [AuthProvider] Sign in attempt for: $email');
    try {
      state = const AsyncLoading();
      final response = await _supabase.signIn(email, password);
      if (response.user != null && response.session != null) {
        final user = User.fromJson(response.user!.toJson());
        print('✅ [AuthProvider] Sign in successful for: ${user.email}');
        print('💾 [AuthProvider] Session should be saved by SupabaseService');
        state = AsyncData(user);
        return true;
      }
      print('⚠️ [AuthProvider] Sign in failed: no user or session in response');
      return false;
    } catch (e, stackTrace) {
      print('❌ [AuthProvider] Sign in error: $e');
      state = AsyncError(e, stackTrace);
      return false;
    }
  }

  Future<Map<String, dynamic>> signUp(String email, String password, String name) async {
    print('📝 [AuthProvider] Sign up attempt for: $email');
    try {
      state = const AsyncLoading();
      final response = await _supabase.signUp(email, password, name);
      if (response.user != null && response.session != null) {
        final user = User.fromJson(response.user!.toJson());
        print('✅ [AuthProvider] Sign up successful for: ${user.email}');
        print('💾 [AuthProvider] Session should be saved by SupabaseService');
        state = AsyncData(user);
        return {'success': true};
      }
      print('⚠️ [AuthProvider] Sign up completed but no session (may require email confirmation)');
      return {'success': false, 'error': 'Sign up failed'};
    } catch (e, stackTrace) {
      print('❌ [AuthProvider] Sign up error: $e');
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
    print('🚪 [AuthProvider] Sign out requested');
    await _supabase.signOut();
    // Clear the auth state - Supabase will also clear the persisted session
    print('✅ [AuthProvider] Sign out complete, state cleared');
    state = const AsyncData(null);
  }
}

final authProvider = AsyncNotifierProvider<AuthNotifier, User?>(() {
  return AuthNotifier();
});

