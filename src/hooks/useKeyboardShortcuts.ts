import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface KeyboardShortcutsOptions {
  onSave?: () => void;
  onSearch?: () => void;
  onNewNote?: () => void;
  onHelp?: () => void;
  onClose?: () => void;
  enabled?: boolean;
}

export const useKeyboardShortcuts = (options: KeyboardShortcutsOptions = {}) => {
  const {
    onSave,
    onSearch,
    onNewNote,
    onHelp,
    onClose,
    enabled = true,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.isContentEditable;
      
      // Allow Escape to work even in inputs
      if (e.key === 'Escape' && onClose) {
        e.preventDefault();
        onClose();
        return;
      }

      // Don't trigger other shortcuts if typing in inputs
      if (isInput && e.key !== 'Escape') return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + S: Save
      if (modKey && e.key === 's' && onSave) {
        e.preventDefault();
        onSave();
        return;
      }

      // Cmd/Ctrl + F: Focus search
      if (modKey && e.key === 'f' && onSearch) {
        e.preventDefault();
        onSearch();
        return;
      }

      // Cmd/Ctrl + N: New note
      if (modKey && e.key === 'n' && onNewNote) {
        e.preventDefault();
        onNewNote();
        return;
      }

      // Cmd/Ctrl + K: Help/Quick actions
      if (modKey && e.key === 'k' && onHelp) {
        e.preventDefault();
        onHelp();
        return;
      }

      // Cmd/Ctrl + ?: Show keyboard shortcuts help
      if (modKey && e.key === '/') {
        e.preventDefault();
        if (onHelp) {
          onHelp();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onSave, onSearch, onNewNote, onHelp, onClose]);

  return null;
};

// Global keyboard shortcuts hook for app-wide shortcuts
export const useGlobalKeyboardShortcuts = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.isContentEditable;
      
      if (isInput) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl + N: New note (global)
      if (modKey && e.key === 'n') {
        e.preventDefault();
        navigate('/note-creation');
        return;
      }

      // Cmd/Ctrl + K: Quick actions / Help (global)
      if (modKey && e.key === 'k') {
        e.preventDefault();
        // This will be handled by components that use useKeyboardShortcuts
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
};

