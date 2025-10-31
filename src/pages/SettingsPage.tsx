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
        <label className="text-sm font-medium text-[#9ca3af]">{label}</label>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Math.max(min, Math.min(max, parseFloat(e.target.value) || min)))}
          className="w-20 px-3 py-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white text-sm"
        />
        {unit && <span className="text-sm text-[#9ca3af]">{unit}</span>}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer accent-[#b85a3a]"
      />
      <div className="flex justify-between text-xs text-[#6b7280]">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#1a1a1a]">
      <Sidebar activePage="settings" />

      <div className="flex-1 flex flex-col">
        <div className="bg-[#2a2a2a] px-8 py-4 border-b border-[#3a3a3a]">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>

        <div className="flex-1 p-8 pb-20 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Profile Section */}
            <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
              <div className="flex items-center gap-3 mb-6">
                <HiUser className="w-6 h-6 text-[#b85a3a]" />
                <h2 className="text-xl font-bold text-white">Profile</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#9ca3af] mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={user?.name || ''}
                    className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white"
                    disabled
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#9ca3af] mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white"
                    disabled
                  />
                </div>
              </div>
            </div>

            {/* API Settings */}
            <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
              <div className="flex items-center gap-3 mb-6">
                <HiKey className="w-6 h-6 text-[#b85a3a]" />
                <h2 className="text-xl font-bold text-white">API Settings</h2>
              </div>

              <p className="text-[#9ca3af] text-sm mb-4">
                API keys are configured via environment variables. Contact your administrator to change them.
              </p>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#9ca3af]">Supabase</span>
                  <span className="text-green-500">Configured</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#9ca3af]">OpenAI</span>
                  <span className="text-green-500">Configured</span>
                </div>
              </div>
            </div>

            {/* Study Content Settings */}
            <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <HiAcademicCap className="w-6 h-6 text-[#b85a3a]" />
                  <h2 className="text-xl font-bold text-white">Study Content</h2>
                </div>
                {showSaveButton && (
                  <Button onClick={handleSavePreferences} variant="primary" className="py-2">
                    Save Changes
                  </Button>
                )}
              </div>

              <p className="text-[#9ca3af] text-sm mb-6">
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
                  <label className="text-sm font-medium text-[#9ca3af]">Summary detail level</label>
                  <select
                    value={localPreferences.summaryDetailLevel || 'comprehensive'}
                    onChange={(e) => handlePreferenceChange('summaryDetailLevel', e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white text-sm"
                  >
                    <option value="concise">Concise</option>
                    <option value="standard">Standard</option>
                    <option value="comprehensive">Comprehensive (default)</option>
                  </select>
                  <p className="text-xs text-[#6b7280]">Controls how thorough AI summaries are. Longer summaries cost more; choose Concise for cheaper/faster output.</p>
                </div>
              </div>
            </div>

            {/* Theme & Appearance */}
            <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <HiPaintBrush className="w-6 h-6 text-[#b85a3a]" />
                  <h2 className="text-xl font-bold text-white">Theme & Appearance</h2>
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
                    <p className="text-white font-medium">Theme</p>
                    <p className="text-sm text-[#9ca3af]">
                      Currently using {isDarkMode ? 'dark' : 'light'} theme
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const newTheme = isDarkMode ? 'light' : 'dark';
                      handlePreferenceChange('theme', newTheme);
                      updatePreferences({ theme: newTheme });
                    }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <HiSun className={`w-5 h-5 transition-colors ${!isDarkMode ? 'text-[#b85a3a]' : 'text-[#9ca3af]'}`} />
                    <div className={`relative w-12 h-6 rounded-full transition-colors ${isDarkMode ? 'bg-[#b85a3a]' : 'bg-[#3a3a3a]'}`}>
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isDarkMode ? 'translate-x-6' : ''}`} />
                    </div>
                    <HiMoon className={`w-5 h-5 transition-colors ${isDarkMode ? 'text-[#b85a3a]' : 'text-[#9ca3af]'}`} />
                  </button>
                </div>

                {/* Accent Color Picker */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-[#9ca3af] mb-2">
                      Accent Color
                    </label>
                    <p className="text-xs text-[#6b7280] mb-3">
                      Choose a color theme for buttons, highlights, and accents throughout the app.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {ACCENT_COLORS.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => handlePreferenceChange('accentColor', color.value)}
                          className={`w-10 h-10 rounded-lg border-2 transition-all ${
                            (localPreferences.accentColor || '#b85a3a') === color.value
                              ? 'border-white scale-110'
                              : 'border-[#3a3a3a] hover:border-[#5a5a5a]'
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
                  <label className="block text-sm font-medium text-[#9ca3af]">
                    Editor Font
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handlePreferenceChange('editorFont', 'default')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        (localPreferences.editorFont || 'default') === 'default'
                          ? 'bg-[#b85a3a] text-white'
                          : 'bg-[#1a1a1a] border border-[#3a3a3a] text-[#9ca3af] hover:bg-[#2a2a2a]'
                      }`}
                    >
                      Default
                    </button>
                    <button
                      onClick={() => handlePreferenceChange('editorFont', 'monospace')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        localPreferences.editorFont === 'monospace'
                          ? 'bg-[#b85a3a] text-white'
                          : 'bg-[#1a1a1a] border border-[#3a3a3a] text-[#9ca3af] hover:bg-[#2a2a2a]'
                      }`}
                    >
                      Monospace
                    </button>
                  </div>
                  <p className="text-xs text-[#6b7280]">
                    Choose between the default system font or monospace for the text editor.
                  </p>
                </div>

                {/* Note List Density */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[#9ca3af]">
                    Note List View
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handlePreferenceChange('noteListDensity', 'compact')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        localPreferences.noteListDensity === 'compact'
                          ? 'bg-[#b85a3a] text-white'
                          : 'bg-[#1a1a1a] border border-[#3a3a3a] text-[#9ca3af] hover:bg-[#2a2a2a]'
                      }`}
                    >
                      Compact
                    </button>
                    <button
                      onClick={() => handlePreferenceChange('noteListDensity', 'detailed')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        (localPreferences.noteListDensity || 'detailed') === 'detailed'
                          ? 'bg-[#b85a3a] text-white'
                          : 'bg-[#1a1a1a] border border-[#3a3a3a] text-[#9ca3af] hover:bg-[#2a2a2a]'
                      }`}
                    >
                      Detailed
                    </button>
                  </div>
                  <p className="text-xs text-[#6b7280]">
                    Compact shows less information per note, detailed shows more.
                  </p>
                </div>
              </div>
            </div>

            {/* Preferences */}
            <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <HiMoon className="w-6 h-6 text-[#b85a3a]" />
                  <h2 className="text-xl font-bold text-white">Preferences</h2>
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
                  <label className="block text-sm font-medium text-[#9ca3af]">
                    Default Study Mode
                  </label>
                  <select
                    value={localPreferences.defaultStudyMode || 'summary'}
                    onChange={(e) => handlePreferenceChange('defaultStudyMode', e.target.value as StudyMode)}
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white text-sm"
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
                  <p className="text-xs text-[#6b7280]">
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
                    <p className="text-white font-medium">Browser Notifications</p>
                    <p className="text-sm text-[#9ca3af]">
                      {notificationPermissionGranted
                        ? 'Notifications are enabled'
                        : 'Enable browser notifications for important updates'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleNotificationToggle(!(localPreferences.notificationsEnabled || false))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      (localPreferences.notificationsEnabled || false) && notificationPermissionGranted
                        ? 'bg-[#b85a3a]'
                        : 'bg-[#3a3a3a]'
                    }`}
                    disabled={!notificationPermissionGranted && !(localPreferences.notificationsEnabled || false)}
                  >
                    <div
                      className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        (localPreferences.notificationsEnabled || false) && notificationPermissionGranted
                          ? 'translate-x-6'
                          : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Language (Future-proofing placeholder) */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[#9ca3af]">
                    Language
                  </label>
                  <select
                    value={localPreferences.language || 'en'}
                    onChange={(e) => handlePreferenceChange('language', e.target.value)}
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white text-sm"
                    disabled
                  >
                    <option value="en">English</option>
                  </select>
                  <p className="text-xs text-[#6b7280]">
                    Multi-language support coming soon.
                  </p>
                </div>

                {/* AI Model (Future-proofing placeholder) */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[#9ca3af]">
                    AI Model
                  </label>
                  <select
                    value={localPreferences.aiModel || ''}
                    onChange={(e) => handlePreferenceChange('aiModel', e.target.value)}
                    className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white text-sm"
                    disabled
                  >
                    <option value="">Default</option>
                  </select>
                  <p className="text-xs text-[#6b7280]">
                    Model selection coming soon.
                  </p>
                </div>
              </div>
            </div>

            {/* Account */}
            <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
              <div className="flex items-center gap-3 mb-6">
                <HiUser className="w-6 h-6 text-[#b85a3a]" />
                <h2 className="text-xl font-bold text-white">Account</h2>
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
