import React, { useState, useEffect, useCallback } from 'react';
import { RichTextEditor } from '../../shared/RichTextEditor';
import { studyContentService } from '../../../services/supabase';
import { useAppData } from '../../../context/AppDataContext';
import { motion } from 'framer-motion';
import { useSettings } from '../../../context/SettingsContext';
import { HiSparkles, HiDocumentText, HiQuestionMarkCircle, HiArrowDownTray } from 'react-icons/hi2';
import { exportService } from '../../../services/exportService';
import toast from 'react-hot-toast';
import { ContentSkeleton } from '../../shared/SkeletonLoader';
import 'katex/dist/katex.min.css';

export const SummaryView: React.FC = () => {
  const { selectedNoteId, notes, currentStudyMode } = useAppData();
  const { preferences } = useSettings();
  const currentNote = notes?.find(n => n.id === selectedNoteId) || null;
  
  const [summary, setSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasSummary, setHasSummary] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showLaTeXGuide, setShowLaTeXGuide] = useState(false);
  const [generationFailed, setGenerationFailed] = useState(false);
  const [hasAttemptedAutoGenerate, setHasAttemptedAutoGenerate] = useState(false);

  // LaTeX examples with proper escaping
  const latexExamples = {
    inline: 'The formula is $E = mc^2$ where m is mass.',
    block: 'The quadratic formula is: $$x = ' + String.fromCharCode(92) + 'frac{-b ' + String.fromCharCode(92) + 'pm ' + String.fromCharCode(92) + 'sqrt{b^2 - 4ac}}{2a}$$',
    commands: {
      frac: String.fromCharCode(92) + 'frac{a}{b}',
      alpha: String.fromCharCode(92) + 'alpha, ' + String.fromCharCode(92) + 'beta, ' + String.fromCharCode(92) + 'gamma',
      sqrt: String.fromCharCode(92) + 'sqrt{x}',
      integral: String.fromCharCode(92) + 'int_0^1',
      sum: String.fromCharCode(92) + 'sum_{i=1}^n',
    },
  };

  // Load existing summary
  const loadSummary = useCallback(async () => {
    if (!selectedNoteId) return;
    
    setIsLoading(true);
    setGenerationFailed(false);
    setHasAttemptedAutoGenerate(false);
    try {
      const studyContent = await studyContentService.getStudyContent(selectedNoteId);
      if (studyContent.summary && studyContent.summary.trim() !== '') {
        setSummary(studyContent.summary);
        setHasSummary(true);
      } else {
        setSummary('');
        setHasSummary(false);
      }
    } catch (error) {
      console.error('Error loading summary:', error);
      setSummary('');
      setHasSummary(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedNoteId]);

  // Auto-save summary changes
  const saveSummary = useCallback(async (content: string) => {
    if (!selectedNoteId) return;
    
    setIsSaving(true);
    try {
      await studyContentService.saveSummary(selectedNoteId, content);
      setLastSaved(new Date());
      setHasSummary(true);
    } catch (error) {
      console.error('Error saving summary:', error);
    } finally {
      setIsSaving(false);
    }
  }, [selectedNoteId]);

  // Generate new summary (can be called manually or automatically)
  const generateSummary = useCallback(async (isAutoGenerate = false) => {
    if (!selectedNoteId || !currentNote) {
      setIsGenerating(false);
      return;
    }

    // Only set isGenerating if not already set (for auto-generate case, it's set before calling)
    if (!isGenerating) {
      setIsGenerating(true);
    }
    setGenerationFailed(false);
    if (isAutoGenerate) {
      setHasAttemptedAutoGenerate(true);
    }
    
    try {
      // Generate and save in background via service (faster model under the hood)
      const generatedSummary = await studyContentService.generateAndSaveSummary(
        selectedNoteId,
        currentNote.content || '',
        preferences.summaryDetailLevel || 'standard'
      );

      setSummary(generatedSummary);
      setHasSummary(true);
      setLastSaved(new Date());
      setGenerationFailed(false);
    } catch (error: any) {
      console.error('Error generating summary:', error);
      setGenerationFailed(true);
      const code = error?.code || error?.name;
      if (code === 'DAILY_LIMIT_REACHED') {
        const resetAt = error?.resetAt ? new Date(error.resetAt) : null;
        const when = resetAt ? ` after ${resetAt.toLocaleTimeString()}` : ' tomorrow';
        if (!isAutoGenerate) {
          toast.error(`Daily AI limit reached (15/day). Please try again${when}.`);
        }
      } else {
        if (!isAutoGenerate) {
          toast.error('Failed to generate summary. Please try again.');
        }
      }
    } finally {
      setIsGenerating(false);
    }
  }, [selectedNoteId, currentNote, preferences.summaryDetailLevel, isGenerating]);

  // Load summary on mount, when note changes, or when switching to summary view
  useEffect(() => {
    loadSummary();
  }, [loadSummary, currentStudyMode]);

  // Auto-generate summary in background when no summary exists
  useEffect(() => {
    if (!selectedNoteId || !currentNote || hasSummary || isLoading || isGenerating || hasAttemptedAutoGenerate) return;
    
    // Only auto-generate if there's enough content
    const content = currentNote.content || '';
    if (content.trim().length < 50) return;

    // Set generating state immediately to show loading screen
    setIsGenerating(true);
    setHasAttemptedAutoGenerate(true);

    // Trigger background generation
    generateSummary(true).catch(err => {
      console.error('Background summary generation failed:', err);
      // Note: generateSummary will set isGenerating to false and generationFailed to true on error
    });
  }, [selectedNoteId, currentNote, hasSummary, isLoading, isGenerating, hasAttemptedAutoGenerate, generateSummary]);

  // Poll for newly generated summaries when we're generating or just finished
  // (Note: NoteViewPage handles auto-switching to summary view when summary is detected)
  useEffect(() => {
    if (!selectedNoteId || hasSummary) return;
    
    if (!isGenerating && !hasAttemptedAutoGenerate) return; // Don't poll if we haven't started generating yet

    // Poll every 3 seconds to check if a summary was generated in the background
    const pollInterval = setInterval(async () => {
      try {
        const studyContent = await studyContentService.getStudyContent(selectedNoteId);
        if (studyContent.summary && studyContent.summary.trim() !== '') {
          // Summary was generated! Load it automatically
          setSummary(studyContent.summary);
          setHasSummary(true);
          setLastSaved(new Date());
          setGenerationFailed(false);
        }
      } catch (error) {
        // Silently fail - we're just polling
        console.debug('Polling for summary:', error);
      }
    }, 3000); // Check every 3 seconds

    // Stop polling after 2 minutes if still no summary
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
    }, 120000); // 2 minutes

    // Clean up polling when component unmounts or conditions change
    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [selectedNoteId, hasSummary, isGenerating, hasAttemptedAutoGenerate]);

  // Auto-save with debounce
  useEffect(() => {
    if (!hasSummary && summary === '') return;
    
    const autoSaveInterval = preferences.autoSaveInterval || 2000;
    const timeoutId = setTimeout(() => {
      saveSummary(summary);
    }, autoSaveInterval);

    return () => clearTimeout(timeoutId);
  }, [summary, saveSummary, hasSummary, preferences.autoSaveInterval]);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <ContentSkeleton />
      </div>
    );
  }

  // Show generating screen when generating OR when we've attempted auto-generation but haven't failed yet
  if (isGenerating || (hasAttemptedAutoGenerate && !hasSummary && !generationFailed)) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-2xl px-8"
        >
          <div className="bg-[#2a2a2a] rounded-3xl p-12 border border-[#3a3a3a]">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#b85a3a] mx-auto mb-6"></div>
            <h2 className="text-3xl font-bold text-white mb-4">
              Generating Your Summary
            </h2>
            <p className="text-[#9ca3af] text-lg">
              Analyzing your documents and creating a comprehensive summary...
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Only show "Generate Summary" button if generation failed
  if (!hasSummary && generationFailed) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-2xl px-8"
        >
          <div className="bg-[#2a2a2a] rounded-3xl p-12 border border-[#3a3a3a]">
            <HiSparkles className="w-20 h-20 text-[#b85a3a] mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Generate Your Summary
            </h2>
            <p className="text-[#9ca3af] text-lg mb-8">
              Summary generation failed. Click below to try again.
            </p>
            
            {currentNote?.documents && currentNote.documents.length > 0 && (
              <div className="mb-8 text-left">
                <p className="text-white mb-3 font-semibold">Your Documents:</p>
                <div className="space-y-2">
                  {currentNote.documents.map((doc, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-gray-300">
                      <HiDocumentText className="w-5 h-5" />
                      <span className="text-sm">{doc.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => generateSummary(false)}
              disabled={isGenerating}
              className="px-8 py-4 bg-[#b85a3a] hover:bg-[#a04a2a] text-white rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-3"
            >
              <HiSparkles className="w-6 h-6" />
              Generate Summary
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // If no summary and not generating and not failed and not attempted, show empty state (shouldn't happen often)
  // This handles edge cases where auto-generation hasn't triggered yet
  if (!hasSummary && !isGenerating && !generationFailed && !hasAttemptedAutoGenerate) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-2xl px-8"
        >
          <div className="bg-[#2a2a2a] rounded-3xl p-12 border border-[#3a3a3a]">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#b85a3a] mx-auto mb-6"></div>
            <h2 className="text-3xl font-bold text-white mb-4">
              Generating Your Summary
            </h2>
            <p className="text-[#9ca3af] text-lg">
              Please wait while we generate your summary...
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with save status */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#4a4a4a] bg-[#1a1a1a]">
        <div className="flex items-center gap-3">
          <HiSparkles className="w-6 h-6 text-[#b85a3a]" />
          <h3 className="text-lg font-semibold text-white">AI Summary</h3>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowLaTeXGuide(!showLaTeXGuide)}
            className="px-3 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            title="LaTeX Help"
          >
            <HiQuestionMarkCircle className="w-5 h-5" />
            <span className="hidden md:inline">LaTeX Help</span>
          </button>

          {isSaving && (
            <span className="text-sm text-gray-400 flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#b85a3a]"></div>
              Saving...
            </span>
          )}
          {!isSaving && lastSaved && (
            <span className="text-sm text-gray-400">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          
          {hasSummary && summary && (
            <button
              onClick={async () => {
                if (!currentNote || !summary) return;
                try {
                  await exportService.exportNoteToMarkdown(currentNote.title, '', summary);
                  toast.success('Summary exported to Markdown successfully');
                } catch (error) {
                  console.error('Error exporting summary:', error);
                  toast.error('Failed to export summary');
                }
              }}
              className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2"
              title="Export summary to Markdown"
            >
              <HiArrowDownTray className="w-4 h-4" />
              <span className="hidden md:inline">Export</span>
            </button>
          )}
        </div>
      </div>

      {/* LaTeX Guide Modal */}
      {showLaTeXGuide && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-2xl p-8 max-w-2xl max-h-[80vh] overflow-y-auto border border-[#4a4a4a]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Using LaTeX in Your Summary</h2>
              <button
                onClick={() => setShowLaTeXGuide(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Inline Math</h3>
                <p className="text-gray-300 mb-2">Use single dollar signs for inline formulas:</p>
                <pre className="bg-[#1a1a1a] p-4 rounded text-sm text-green-400">{latexExamples.inline}</pre>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Block Math</h3>
                <p className="text-gray-300 mb-2">Use double dollar signs for displayed equations:</p>
                <pre className="bg-[#1a1a1a] p-4 rounded text-sm text-green-400">{latexExamples.block}</pre>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Common LaTeX Commands</h3>
                <div className="bg-[#1a1a1a] p-4 rounded text-sm space-y-2 text-gray-300">
                  <p><code className="text-green-400">{latexExamples.commands.frac}</code> - Fractions</p>
                  <p><code className="text-green-400">x^2</code> - Superscripts</p>
                  <p><code className="text-green-400">x_1</code> - Subscripts</p>
                  <p><code className="text-green-400">{latexExamples.commands.alpha}</code> - Greek letters</p>
                  <p><code className="text-green-400">{latexExamples.commands.sqrt}</code> - Square root</p>
                  <p><code className="text-green-400">{latexExamples.commands.integral}</code> - Integrals</p>
                  <p><code className="text-green-400">{latexExamples.commands.sum}</code> - Summation</p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#4a4a4a]">
                <p className="text-sm text-gray-400">
                  Tip: After writing your LaTeX, the formulas will automatically render in real-time.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rich Text Editor */}
      <div className="flex-1 overflow-hidden">
        <RichTextEditor
          content={summary}
          onChange={setSummary}
          placeholder="Start writing your summary..."
          editable={true}
        />
      </div>
    </div>
  );
};
