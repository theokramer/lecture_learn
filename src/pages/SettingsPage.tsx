import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Sidebar } from '../components/home/Sidebar';
import { Button } from '../components/shared/Button';
import { HiUser, HiKey, HiMoon, HiSun, HiAcademicCap, HiPaintBrush } from 'react-icons/hi2';
import { HiLogout } from 'react-icons/hi';
import type { StudyMode } from '../types';
import { requestNotificationPermission, isNotificationPermissionGranted } from '../utils/notificationUtils';

// Predefined accent color palette
const ACCENT_COLORS = [
  { name: 'Orange', value: '#b85a3a' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Yellow', value: '#f59e0b' },
];

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { preferences, updatePreferences } = useSettings();
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [showSaveButton, setShowSaveButton] = useState(false);
  const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(isNotificationPermissionGranted());
  
  const isDarkMode = (localPreferences.theme || preferences.theme || 'dark') === 'dark';

  // Sync local preferences when context preferences change
  useEffect(() => {
    setLocalPreferences(preferences);
  }, [preferences]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handlePreferenceChange = (key: keyof typeof preferences, value: any) => {
    const newPreferences = { ...localPreferences, [key]: value };
    setLocalPreferences(newPreferences);
    setShowSaveButton(true);
  };

  const handleSavePreferences = () => {
    updatePreferences(localPreferences);
    setShowSaveButton(false);
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled && !notificationPermissionGranted) {
      const granted = await requestNotificationPermission();
      setNotificationPermissionGranted(granted);
      if (!granted) {
        return; // Don't enable if permission was denied
      }
    }
    handlePreferenceChange('notificationsEnabled', enabled);
  };

  const NumberSlider = ({ label, value, onChange, min = 3, max = 30, step = 1, unit = '' }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-secondary">{label}</label>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Math.max(min, Math.min(max, parseFloat(e.target.value) || min)))}
          className="w-20 px-3 py-1 bg-bg-primary border border-border-primary rounded-lg text-text-primary text-sm transition-all focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        {unit && <span className="text-sm text-text-secondary">{unit}</span>}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-bg-primary rounded-lg appearance-none cursor-pointer accent-accent transition-all"
      />
      <div className="flex justify-between text-xs text-text-tertiary">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-bg-primary">
      <Sidebar activePage="settings" />

      <div className="flex-1 flex flex-col">
        <div className="bg-bg-secondary px-8 py-4 border-b border-border-primary shadow-sm">
          <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        </div>

        <div className="flex-1 p-8 pb-20 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Profile Section */}
            <div className="bg-bg-secondary rounded-xl p-6 border border-border-primary shadow-md">
              <div className="flex items-center gap-3 mb-6">
                <HiUser className="w-6 h-6 text-accent" />
                <h2 className="text-xl font-bold text-text-primary">Profile</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={user?.name || ''}
                    className="w-full px-4 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary transition-all focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    disabled
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    className="w-full px-4 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary transition-all focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    disabled
                  />
                </div>
              </div>
            </div>

            {/* API Settings */}
            <div className="bg-bg-secondary rounded-xl p-6 border border-border-primary shadow-md">
              <div className="flex items-center gap-3 mb-6">
                <HiKey className="w-6 h-6 text-accent" />
                <h2 className="text-xl font-bold text-text-primary">API Settings</h2>
              </div>

              <p className="text-text-secondary text-sm mb-4">
                API keys are configured via environment variables. Contact your administrator to change them.
              </p>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Supabase</span>
                  <span className="text-green-500">Configured</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">OpenAI</span>
                  <span className="text-green-500">Configured</span>
                </div>
              </div>
            </div>

            {/* Study Content Settings */}
            <div className="bg-bg-secondary rounded-xl p-6 border border-border-primary shadow-md">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <HiAcademicCap className="w-6 h-6 text-accent" />
                  <h2 className="text-xl font-bold text-text-primary">Study Content</h2>
                </div>
                {showSaveButton && (
                  <Button onClick={handleSavePreferences} variant="primary" className="py-2">
                    Save Changes
                  </Button>
                )}
              </div>

              <p className="text-text-secondary text-sm mb-6">
                Configure how many flashcards, quiz questions, and exercises to generate for each note.
              </p>

              <div className="space-y-6">
                <NumberSlider
                  label="Flashcards per note"
                  value={localPreferences.flashcardsCount}
                  onChange={(value) => handlePreferenceChange('flashcardsCount', value)}
                />
                <NumberSlider
                  label="Quiz questions per note"
                  value={localPreferences.quizCount}
                  onChange={(value) => handlePreferenceChange('quizCount', value)}
                />
                <NumberSlider
                  label="Exercises per note"
                  value={localPreferences.exercisesCount}
                  onChange={(value) => handlePreferenceChange('exercisesCount', value)}
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-secondary">Summary detail level</label>
                  <select
                    value={localPreferences.summaryDetailLevel || 'comprehensive'}
                    onChange={(e) => handlePreferenceChange('summaryDetailLevel', e.target.value as any)}
                    className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary text-sm transition-all focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="concise">Concise</option>
                    <option value="standard">Standard</option>
                    <option value="comprehensive">Comprehensive (default)</option>
                  </select>
                  <p className="text-xs text-text-tertiary">Controls how thorough AI summaries are. Longer summaries cost more; choose Concise for cheaper/faster output.</p>
                </div>
              </div>
            </div>

            {/* Theme & Appearance */}
            <div className="bg-bg-secondary rounded-xl p-6 border border-border-primary shadow-md">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <HiPaintBrush className="w-6 h-6 text-accent" />
                  <h2 className="text-xl font-bold text-text-primary">Theme & Appearance</h2>
                </div>
                {showSaveButton && (
                  <Button onClick={handleSavePreferences} variant="primary" className="py-2">
                    Save Changes
                  </Button>
                )}
              </div>

              <div className="space-y-6">
                {/* Theme Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-text-primary font-medium">Theme</p>
                    <p className="text-sm text-text-secondary">
                      Currently using {isDarkMode ? 'dark' : 'light'} theme
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const newTheme = isDarkMode ? 'light' : 'dark';
                      handlePreferenceChange('theme', newTheme);
                      updatePreferences({ theme: newTheme });
                    }}
                    className="flex items-center gap-2 cursor-pointer transition-all duration-200 hover:scale-105"
                  >
                    <HiSun className={`w-5 h-5 transition-colors ${!isDarkMode ? 'text-accent' : 'text-text-secondary'}`} />
                    <div className={`relative w-12 h-6 rounded-full transition-all duration-300 ${isDarkMode ? 'bg-accent' : 'bg-bg-tertiary'}`}>
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md ${isDarkMode ? 'translate-x-6' : ''}`} />
                    </div>
                    <HiMoon className={`w-5 h-5 transition-colors ${isDarkMode ? 'text-accent' : 'text-text-secondary'}`} />
                  </button>
                </div>

                {/* Accent Color Picker */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Accent Color
                    </label>
                    <p className="text-xs text-text-tertiary mb-3">
                      Choose a color theme for buttons, highlights, and accents throughout the app.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {ACCENT_COLORS.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => handlePreferenceChange('accentColor', color.value)}
                          className={`w-10 h-10 rounded-lg border-2 transition-all duration-200 hover:scale-110 ${
                            (localPreferences.accentColor || '#b85a3a') === color.value
                              ? 'border-text-primary scale-110 shadow-glow'
                              : 'border-border-primary hover:border-border-secondary'
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Font Size Slider */}
                <NumberSlider
                  label={`Font Size (${Math.round((localPreferences.fontSize || 1.0) * 100)}%)`}
                  value={localPreferences.fontSize || 1.0}
                  onChange={(value) => handlePreferenceChange('fontSize', value)}
                  min={0.75}
                  max={2.0}
                  step={0.05}
                  unit=""
                />

                {/* Editor Font Toggle */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-text-secondary">
                    Editor Font
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handlePreferenceChange('editorFont', 'default')}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        (localPreferences.editorFont || 'default') === 'default'
                          ? 'bg-accent text-white shadow-glow'
                          : 'bg-bg-primary border border-border-primary text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                      }`}
                    >
                      Default
                    </button>
                    <button
                      onClick={() => handlePreferenceChange('editorFont', 'monospace')}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        localPreferences.editorFont === 'monospace'
                          ? 'bg-accent text-white shadow-glow'
                          : 'bg-bg-primary border border-border-primary text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                      }`}
                    >
                      Monospace
                    </button>
                  </div>
                  <p className="text-xs text-text-tertiary">
                    Choose between the default system font or monospace for the text editor.
                  </p>
                </div>

                {/* Note List Density */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-text-secondary">
                    Note List View
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handlePreferenceChange('noteListDensity', 'compact')}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        localPreferences.noteListDensity === 'compact'
                          ? 'bg-accent text-white shadow-glow'
                          : 'bg-bg-primary border border-border-primary text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                      }`}
                    >
                      Compact
                    </button>
                    <button
                      onClick={() => handlePreferenceChange('noteListDensity', 'detailed')}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                        (localPreferences.noteListDensity || 'detailed') === 'detailed'
                          ? 'bg-accent text-white shadow-glow'
                          : 'bg-bg-primary border border-border-primary text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                      }`}
                    >
                      Detailed
                    </button>
                  </div>
                  <p className="text-xs text-text-tertiary">
                    Compact shows less information per note, detailed shows more.
                  </p>
                </div>
              </div>
            </div>

            {/* Preferences */}
            <div className="bg-bg-secondary rounded-xl p-6 border border-border-primary shadow-md">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <HiMoon className="w-6 h-6 text-accent" />
                  <h2 className="text-xl font-bold text-text-primary">Preferences</h2>
                </div>
                {showSaveButton && (
                  <Button onClick={handleSavePreferences} variant="primary" className="py-2">
                    Save Changes
                  </Button>
                )}
              </div>

              <div className="space-y-6">
                {/* Default Study Mode */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-text-secondary">
                    Default Study Mode
                  </label>
                  <select
                    value={localPreferences.defaultStudyMode || 'summary'}
                    onChange={(e) => handlePreferenceChange('defaultStudyMode', e.target.value as StudyMode)}
                    className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary text-sm transition-all focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="summary">Summary</option>
                    <option value="transcript">Transcript</option>
                    <option value="feynman">Feynman</option>
                    <option value="flashcards">Flashcards</option>
                    <option value="quiz">Quiz</option>
                    <option value="exercises">Exercises</option>
                    <option value="documents">Documents</option>
                    <option value="ai-chat">AI Chat</option>
                  </select>
                  <p className="text-xs text-text-tertiary">
                    Which study mode to open first when viewing a note.
                  </p>
                </div>

                {/* Auto-save Interval */}
                <NumberSlider
                  label={`Auto-save Interval (${(localPreferences.autoSaveInterval || 2000) / 1000}s)`}
                  value={(localPreferences.autoSaveInterval || 2000) / 1000}
                  onChange={(value) => handlePreferenceChange('autoSaveInterval', value * 1000)}
                  min={1}
                  max={10}
                  step={1}
                  unit="s"
                />

                {/* Notifications Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-text-primary font-medium">Browser Notifications</p>
                    <p className="text-sm text-text-secondary">
                      {notificationPermissionGranted
                        ? 'Notifications are enabled'
                        : 'Enable browser notifications for important updates'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleNotificationToggle(!(localPreferences.notificationsEnabled || false))}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                      (localPreferences.notificationsEnabled || false) && notificationPermissionGranted
                        ? 'bg-accent'
                        : 'bg-bg-tertiary'
                    }`}
                    disabled={!notificationPermissionGranted && !(localPreferences.notificationsEnabled || false)}
                  >
                    <div
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md ${
                        (localPreferences.notificationsEnabled || false) && notificationPermissionGranted
                          ? 'translate-x-6'
                          : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Language (Future-proofing placeholder) */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-text-secondary">
                    Language
                  </label>
                  <select
                    value={localPreferences.language || 'en'}
                    onChange={(e) => handlePreferenceChange('language', e.target.value)}
                    className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary text-sm transition-all focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 opacity-60"
                    disabled
                  >
                    <option value="en">English</option>
                  </select>
                  <p className="text-xs text-text-tertiary">
                    Multi-language support coming soon.
                  </p>
                </div>

                {/* AI Model (Future-proofing placeholder) */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-text-secondary">
                    AI Model
                  </label>
                  <select
                    value={localPreferences.aiModel || ''}
                    onChange={(e) => handlePreferenceChange('aiModel', e.target.value)}
                    className="w-full px-3 py-2 bg-bg-primary border border-border-primary rounded-lg text-text-primary text-sm transition-all focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 opacity-60"
                    disabled
                  >
                    <option value="">Default</option>
                  </select>
                  <p className="text-xs text-text-tertiary">
                    Model selection coming soon.
                  </p>
                </div>
              </div>
            </div>

            {/* Account */}
            <div className="bg-bg-secondary rounded-xl p-6 border border-border-primary shadow-md">
              <div className="flex items-center gap-3 mb-6">
                <HiUser className="w-6 h-6 text-accent" />
                <h2 className="text-xl font-bold text-text-primary">Account</h2>
              </div>

              <div className="space-y-4">
                <Button
                  onClick={handleLogout}
                  variant="danger"
                  className="flex items-center gap-2"
                >
                  <HiLogout className="w-5 h-5" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
