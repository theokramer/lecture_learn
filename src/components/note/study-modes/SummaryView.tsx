import React, { useState, useEffect, useCallback } from 'react';
import { RichTextEditor } from '../../shared/RichTextEditor';
import { summaryService } from '../../../services/summaryService';
import { studyContentService } from '../../../services/supabase';
import { useAppData } from '../../../context/AppDataContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../../../context/SettingsContext';
import { HiSparkles, HiDocumentText, HiArrowPath, HiQuestionMarkCircle } from 'react-icons/hi2';
import 'katex/dist/katex.min.css';

export const SummaryView: React.FC = () => {
  const { selectedNoteId, notes } = useAppData();
  const { preferences } = useSettings();
  const currentNote = notes.find(n => n.id === selectedNoteId);
  
  const [summary, setSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasSummary, setHasSummary] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showLaTeXGuide, setShowLaTeXGuide] = useState(false);

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

  // Generate new summary
  const generateSummary = useCallback(async () => {
    if (!selectedNoteId || !currentNote) return;

    setIsGenerating(true);
    try {
      // Generate intelligent summary using the summary service
      const generatedSummary = await summaryService.generateIntelligentSummary(
        currentNote.content || '',
        currentNote.documents || [],
        { detailLevel: preferences.summaryDetailLevel || 'comprehensive' }
      );

      setSummary(generatedSummary);
      setHasSummary(true);
      
      // Save the generated summary
      await studyContentService.saveSummary(selectedNoteId, generatedSummary);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error generating summary:', error);
      alert('Failed to generate summary. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [selectedNoteId, currentNote]);

  // Load summary on mount or when note changes
  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Auto-save with debounce
  useEffect(() => {
    if (!hasSummary && summary === '') return;
    
    const timeoutId = setTimeout(() => {
      saveSummary(summary);
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [summary, saveSummary, hasSummary]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#b85a3a] mx-auto mb-4"></div>
          <p className="text-white">Loading summary...</p>
        </div>
      </div>
    );
  }

  if (!hasSummary && !isGenerating) {
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
              Create Your Summary
            </h2>
            <p className="text-[#9ca3af] text-lg mb-8">
              Generate an intelligent summary that combines all your documents
              and learning materials into one comprehensive study guide.
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
              onClick={generateSummary}
              disabled={isGenerating}
              className="px-8 py-4 bg-[#b85a3a] hover:bg-[#a04a2a] text-white rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-3"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  Generating Summary...
                </>
              ) : (
                <>
                  <HiSparkles className="w-6 h-6" />
                  Generate Summary
                </>
              )}
            </button>
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
          
          <button
            onClick={generateSummary}
            disabled={isGenerating || isSaving}
            className="px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <HiArrowPath className="w-4 h-4" />
            Regenerate
          </button>
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
        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.div
              key="generating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center h-full"
            >
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#b85a3a] mx-auto mb-4"></div>
                <p className="text-white text-xl mb-2">Generating Your Summary</p>
                <p className="text-gray-400">Analyzing your documents and creating a comprehensive summary...</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="editor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <RichTextEditor
                content={summary}
                onChange={setSummary}
                placeholder="Start writing your summary..."
                editable={true}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
