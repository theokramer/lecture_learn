import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/note_view_screen.dart';
import 'screens/note_creation_screen.dart';
import 'screens/record_audio_screen.dart';
import 'screens/processing_screen.dart';
import 'screens/upload_screen.dart';
import 'screens/web_link_screen.dart';
import 'services/supabase_service.dart';
import 'providers/auth_provider.dart';
import 'models/user.dart';
import 'utils/logger.dart';
import 'utils/environment.dart';
import 'dart:io';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load environment variables from .env file
  try {
    await dotenv.load(fileName: '.env');
  } catch (e) {
    // If .env file doesn't exist, try environment variables
    if (Environment.isDevelopment) {
      AppLogger.warning('.env file not found, using environment variables', tag: 'main');
    }
  }

  // Get environment variables (from .env or system environment)
  // Check for both VITE_ prefix (from web) and direct names
  final supabaseUrl = dotenv.env['VITE_SUPABASE_URL'] ?? 
                     dotenv.env['SUPABASE_URL'] ?? 
                     const String.fromEnvironment('SUPABASE_URL', defaultValue: '');
  final supabaseAnonKey = dotenv.env['VITE_SUPABASE_ANON_KEY'] ?? 
                          dotenv.env['SUPABASE_ANON_KEY'] ?? 
                          const String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: '');

  if (supabaseUrl.isEmpty || supabaseAnonKey.isEmpty) {
    AppLogger.error(
      'Missing Supabase environment variables!',
      context: {
        'message': 'Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY',
      },
      tag: 'main',
    );
    // Don't throw - let the app start and show error on login screen
  } else {
    // Initialize Supabase
    AppLogger.info('Initializing Supabase service...', tag: 'main');
    await SupabaseService().initialize(supabaseUrl, supabaseAnonKey);
    AppLogger.success('Supabase service initialized', tag: 'main');
    
    // OpenAI key is stored in Supabase, so we don't initialize it here
    // The app will use Supabase Edge Functions or RPC calls for OpenAI features
  }

  // Set iOS status bar style
  if (Platform.isIOS) {
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarBrightness: Brightness.dark,
        systemNavigationBarColor: Color(0xFF1A1A1A),
      ),
    );
  }

  runApp(
    const ProviderScope(
      child: MyApp(),
    ),
  );
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Note: Navigation logic is now handled in SplashScreen
    // This listener is kept for any other auth state changes during app usage
    ref.listen<AsyncValue<User?>>(authProvider, (previous, next) {
      // Only handle auth changes if not on splash screen
      if (previous?.isLoading == true && next.hasValue) {
        final user = next.value;
        final currentLocation = _router.routerDelegate.currentConfiguration.uri.path;
        
        // Don't navigate if we're on splash screen (it handles its own navigation)
        if (currentLocation == '/splash') {
          return;
        }
        
        AppLogger.debug('Auth state resolved. User: ${user?.email ?? "null"}', tag: 'MyApp');
        
        // Use a post-frame callback to ensure the router is ready
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (user != null && currentLocation == '/login') {
            // User logged in while on login page
            AppLogger.info('User logged in, navigating to /home', tag: 'MyApp');
            _router.go('/home');
          } else if (user == null && currentLocation != '/login' && currentLocation != '/splash') {
            // User logged out while on other pages
            AppLogger.info('User logged out, navigating to /login', tag: 'MyApp');
            _router.go('/login');
          }
        });
      }
    });

    return MaterialApp.router(
      title: 'Nano AI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6366F1), // Indigo - neutral primary color
          brightness: Brightness.dark,
        ),
        scaffoldBackgroundColor: const Color(0xFF1A1A1A),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF2A2A2A),
          foregroundColor: Color(0xFFFFFFFF),
          elevation: 0,
        ),
      ),
      routerConfig: _router,
      builder: (context, child) {
        return DefaultTextStyle(
          style: const TextStyle(
            color: Color(0xFFFFFFFF),
            fontSize: 16,
            fontWeight: FontWeight.w400,
          ),
          child: child!,
        );
      },
    );
  }
}

final _router = GoRouter(
  initialLocation: '/splash', // Start with splash screen
  routes: [
    GoRoute(
      path: '/splash',
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/home',
      builder: (context, state) => const HomeScreen(),
    ),
    GoRoute(
      path: '/note',
      builder: (context, state) {
        final noteId = state.uri.queryParameters['id'];
        return NoteViewScreen(noteId: noteId);
      },
    ),
    GoRoute(
      path: '/note-creation',
      builder: (context, state) {
        final folderId = state.uri.queryParameters['folderId'];
        return NoteCreationScreen(folderId: folderId);
      },
    ),
    GoRoute(
      path: '/note-creation/record',
      builder: (context, state) {
        final folderId = state.uri.queryParameters['folderId'];
        return RecordAudioScreen(folderId: folderId);
      },
    ),
    GoRoute(
      path: '/note-creation/processing',
      builder: (context, state) {
        final extra = state.extra as Map<String, dynamic>?;
        final folderId = state.uri.queryParameters['folderId'];
        // Check if extra contains text content (from web link) or audio blob
        final textContent = extra != null && extra.containsKey('text')
            ? extra
            : null;
        final audioBlob = extra != null && extra.containsKey('audioFile')
            ? extra
            : null;
        return ProcessingScreen(
          audioBlob: audioBlob,
          textContent: textContent,
          folderId: folderId,
        );
      },
    ),
            GoRoute(
              path: '/note-creation/web-link',
              builder: (context, state) {
                final folderId = state.uri.queryParameters['folderId'];
                return WebLinkScreen(folderId: folderId);
              },
            ),
            GoRoute(
              path: '/note-creation/upload',
              builder: (context, state) {
                final folderId = state.uri.queryParameters['folderId'];
                return UploadScreen(folderId: folderId);
              },
            ),
  ],
  redirect: (context, state) {
    final currentLocation = state.matchedLocation;
    
    // Allow splash screen to handle its own navigation
    if (currentLocation == '/splash') {
      return null;
    }
    
    final authState = ProviderScope.containerOf(context).read(authProvider);
    final isGoingToLogin = currentLocation == '/login';

    // Wait for auth state to finish loading before making routing decisions
    // This ensures we check for persisted sessions properly
    return authState.when(
      data: (user) {
        final isLoggedIn = user != null;
        AppLogger.debug(
          'Auth state: ${isLoggedIn ? "Logged in as ${user.email}" : "Not logged in"}, going to: $currentLocation',
          tag: 'Router',
        );
        
        // If not logged in and not going to login, redirect to login
        if (!isLoggedIn && !isGoingToLogin) {
          AppLogger.debug('Redirecting to /login (not logged in)', tag: 'Router');
          return '/login';
        }
        // If logged in and trying to go to login, redirect to home
        if (isLoggedIn && isGoingToLogin) {
          AppLogger.debug('Redirecting to /home (already logged in)', tag: 'Router');
          return '/home';
        }
        AppLogger.debug('No redirect needed', tag: 'Router');
        return null;
      },
      loading: () {
        // While loading, don't redirect - let the current route stay
        // This prevents flickering during session restoration
        AppLogger.debug('Auth state loading, waiting...', tag: 'Router');
        return null;
      },
      error: (error, stackTrace) {
        // On error, redirect to login (unless already on splash)
        AppLogger.error('Auth state error', error: error, stackTrace: stackTrace, tag: 'Router');
        if (!isGoingToLogin && currentLocation != '/splash') {
          AppLogger.debug('Redirecting to /login (error)', tag: 'Router');
          return '/login';
        }
        return null;
      },
    );
  },
);

