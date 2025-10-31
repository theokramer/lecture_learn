import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import { OfflineIndicator } from './components/shared/OfflineIndicator';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
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
                  <OfflineIndicator />
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