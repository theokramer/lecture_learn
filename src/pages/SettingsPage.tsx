import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Sidebar } from '../components/home/Sidebar';
import { Button } from '../components/shared/Button';
import { HiUser, HiKey, HiMoon, HiSun, HiAcademicCap } from 'react-icons/hi2';
import { HiLogout } from 'react-icons/hi';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { preferences, updatePreferences } = useSettings();
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [showSaveButton, setShowSaveButton] = useState(false);
  
  const isDarkMode = (localPreferences.theme || preferences.theme || 'dark') === 'dark';

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

  const NumberSlider = ({ label, value, onChange, min = 3, max = 30 }: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[#9ca3af]">{label}</label>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
          className="w-20 px-3 py-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white text-sm"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer accent-[#b85a3a]"
      />
      <div className="flex justify-between text-xs text-[#6b7280]">
        <span>{min}</span>
        <span>{max}</span>
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

            {/* Preferences */}
            <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
              <div className="flex items-center gap-3 mb-6">
                <HiMoon className="w-6 h-6 text-[#b85a3a]" />
                <h2 className="text-xl font-bold text-white">Preferences</h2>
              </div>

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
