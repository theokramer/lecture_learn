import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppDataProvider } from './context/AppDataContext';
import { SettingsProvider } from './context/SettingsContext';
import { PdfSelectionProvider } from './context/PdfSelectionContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { HomePage } from './pages/HomePage';
import { NoteViewPage } from './pages/NoteViewPage';
import { NoteCreationPage } from './pages/NoteCreationPage';
import { RecordAudioPage } from './pages/RecordAudioPage';
import { ProcessingPage } from './pages/ProcessingPage';
import { UploadPage } from './pages/UploadPage';
import { SettingsPage } from './pages/SettingsPage';
import { HowToUsePage } from './pages/HowToUsePage';
import { SupportPage } from './pages/SupportPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { LearnFlashcardsPage } from './pages/LearnFlashcardsPage';
import { useGlobalKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { supabase } from './services/supabase';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

// OAuth callback handler component
const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Check for OAuth error in query params
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        
        if (error) {
          console.error('OAuth error:', error, errorDescription);
          navigate('/login?error=' + encodeURIComponent(errorDescription || error));
          return;
        }

        // Supabase OAuth uses hash fragments (#access_token=...)
        // The Supabase client automatically processes these when the page loads
        // Wait a bit for the session to be established
        const checkSession = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log('✅ OAuth session established');
            navigate('/home');
          } else {
            // Try again after a short delay
            setTimeout(async () => {
              const { data: { session: retrySession } } = await supabase.auth.getSession();
              if (retrySession) {
                navigate('/home');
              } else {
                console.error('❌ No session found after OAuth callback');
                navigate('/login?error=authentication_failed');
              }
            }, 1000);
          }
        };

        // Small delay to allow Supabase to process the hash fragment
        setTimeout(checkSession, 300);
      } catch (err) {
        console.error('OAuth callback error:', err);
        navigate('/login?error=authentication_failed');
      }
    };

    handleOAuthCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a1a]">
      <div className="text-white">Completing sign in...</div>
    </div>
  );
};

// Global keyboard shortcuts handler
const GlobalShortcutsHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useGlobalKeyboardShortcuts();
  return <>{children}</>;
};

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <SettingsProvider>
        <AppDataProvider>
            <PdfSelectionProvider>
          <Router>
                <GlobalShortcutsHandler>
                  <Toaster
                    position="top-right"
                    toastOptions={{
                      duration: 4000,
                      style: {
                        background: '#2a2a2a',
                        color: '#fff',
                        border: '1px solid #3a3a3a',
                        borderRadius: '0.5rem',
                      },
                      success: {
                        iconTheme: {
                          primary: '#10b981',
                          secondary: '#fff',
                        },
                      },
                      error: {
                        iconTheme: {
                          primary: '#ef4444',
                          secondary: '#fff',
                        },
                      },
                    }}
                  />
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />
            <Route
              path="/home"
              element={
                <PrivateRoute>
                  <HomePage />
                </PrivateRoute>
              }
            />
            <Route
              path="/note"
              element={
                <PrivateRoute>
                  <NoteViewPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/note-creation"
              element={
                <PrivateRoute>
                  <NoteCreationPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/note-creation/record"
              element={
                <PrivateRoute>
                  <RecordAudioPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/note-creation/processing"
              element={
                <PrivateRoute>
                  <ProcessingPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/note-creation/upload"
              element={
                <PrivateRoute>
                  <UploadPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <PrivateRoute>
                  <AnalyticsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/learn-flashcards"
              element={
                <PrivateRoute>
                  <LearnFlashcardsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <SettingsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/how-to-use"
              element={
                <PrivateRoute>
                  <HowToUsePage />
                </PrivateRoute>
              }
            />
            <Route
              path="/support"
              element={
                <PrivateRoute>
                  <SupportPage />
                </PrivateRoute>
              }
            />
            <Route path="/" element={<Navigate to="/home" />} />
          </Routes>
                </GlobalShortcutsHandler>
        </Router>
            </PdfSelectionProvider>
        </AppDataProvider>
      </SettingsProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;