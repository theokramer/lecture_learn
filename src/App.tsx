import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppDataProvider } from './context/AppDataContext';
import { LoginScreen } from './components/auth/LoginScreen';
import { HomePage } from './pages/HomePage';
import { NoteViewPage } from './pages/NoteViewPage';
import { NoteCreationPage } from './pages/NoteCreationPage';
import { RecordAudioPage } from './pages/RecordAudioPage';
import { ProcessingPage } from './pages/ProcessingPage';
import { UploadPage } from './pages/UploadPage';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <AppDataProvider>
        <Router>
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
            <Route path="/" element={<Navigate to="/home" />} />
          </Routes>
        </Router>
      </AppDataProvider>
    </AuthProvider>
  );
}

export default App;