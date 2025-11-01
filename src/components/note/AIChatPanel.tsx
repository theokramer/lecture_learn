import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiPlus, HiPaperAirplane, HiSparkles, HiLightBulb, HiXMark } from 'react-icons/hi2';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import { usePdfSelection } from '../../context/PdfSelectionContext';
import { openaiService } from '../../services/openai';
import { chatHistoryService, type ChatMessage } from '../../services/chatHistoryService';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';

interface AIChatPanelProps {
  width: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onResize: (width: number) => void;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

const CHAT_TEMPLATES = [
  { id: 'explain', label: 'Explain this concept', prompt: 'Explain the key concepts in simple terms with examples.' },
  { id: 'summarize', label: 'Summarize', prompt: 'Provide a concise summary of the main points.' },
  { id: 'examples', label: 'Give examples', prompt: 'Provide real-world examples and applications.' },
  { id: 'questions', label: 'Generate study questions', prompt: 'Generate practice questions based on this content.' },
  { id: 'connect', label: 'Connect ideas', prompt: 'How do the different concepts in this content relate to each other?' },
];

export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  width,
  isCollapsed,
  onToggleCollapse,
  onResize,
  isMobile = false,
  isOpen = false,
  onClose,
}) => {
  const { selectedNoteId, notes } = useAppData();
  const { user } = useAuth();
  const { selectedText: pdfSelectedText, clearSelection } = usePdfSelection();
  const currentNote = notes.find(n => n.id === selectedNoteId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevWidthRef = useRef(width);
  const mouseXWhenMinReachedRef = useRef<number | null>(null);
  const startMouseXRef = useRef(0);
  const initialMinWidthRef = useRef(0);

  // Load conversation history on mount or when note changes
  useEffect(() => {
    if (!user || !selectedNoteId) {
      setMessages([]);
      setConversationId(null);
      setSuggestedQuestions([]);
      return;
    }

    const loadConversation = async () => {
      try {
        const convId = await chatHistoryService.getOrCreateConversation(user.id, selectedNoteId);
        setConversationId(convId);
        
        const loadedMessages = await chatHistoryService.loadConversationMessages(convId);
        setMessages(loadedMessages.length > 0 ? loadedMessages : [
          {
            id: '1',
            role: 'assistant',
            content: "I'm your personal tutor! I can help explain concepts, answer questions, and guide your learning. What would you like to explore?",
            timestamp: new Date(),
          },
        ]);

        // Generate suggested questions based on note content
        if (currentNote?.content && currentNote.content.length > 50) {
          generateSuggestedQuestions(currentNote.content);
        }
      } catch (error: any) {
        console.error('Error loading conversation:', error);
        // If table doesn't exist, just show default message (graceful degradation)
        if (error?.code === 'PGRST205') {
          setMessages([
            {
              id: '1',
              role: 'assistant',
              content: "I'm your personal tutor! I can help explain concepts, answer questions, and guide your learning. What would you like to explore?\n\n*Note: Chat history is disabled until database tables are set up. Run chat-history-schema.sql in Supabase.*",
              timestamp: new Date(),
            },
          ]);
          setConversationId(null); // Disable saving until tables exist
        }
      }
    };

    loadConversation();
  }, [user, selectedNoteId, currentNote?.content]);

  // Generate suggested questions from note content
  const generateSuggestedQuestions = async (content: string) => {
    try {
      const prompt = `Based on the following content, generate 3-4 short, specific questions a student might ask. Return only the questions, one per line, no numbering:

${content.substring(0, 2000)}`;

      const response = await openaiService.chatCompletions([
        { role: 'user', content: prompt }
      ], content);

      const questions = response
        .split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0 && !q.match(/^\d+[\.\)]/))
        .slice(0, 4);
      
      setSuggestedQuestions(questions);
    } catch (error) {
      console.error('Error generating suggested questions:', error);
      // If rate limit, silently fail (don't show suggested questions)
      if ((error as any)?.code === 'DAILY_LIMIT_REACHED') {
        console.log('Rate limit reached - suggested questions unavailable');
      }
    }
  };

  // Listen for quick action events from PDF selection
  useEffect(() => {
    const handleQuickAction = (event: CustomEvent) => {
      const { message } = event.detail;
      if (message && user) {
        // Create a temporary handler that uses the current message
        handleSend(message);
      }
    };

    window.addEventListener('ai-chat-quick-action', handleQuickAction as EventListener);
    return () => {
      window.removeEventListener('ai-chat-quick-action', handleQuickAction as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      const minWidth = Math.max(380, window.innerWidth * 0.25);
      const clampedWidth = Math.max(minWidth, Math.min(newWidth, 600));
      
      const isDraggingRight = clampedWidth < prevWidthRef.current;
      
      if (prevWidthRef.current === minWidth && mouseXWhenMinReachedRef.current === null) {
        const dragDirection = e.clientX - startMouseXRef.current;
        if (dragDirection > 0) {
          mouseXWhenMinReachedRef.current = startMouseXRef.current;
        }
      }
      
      if (isDraggingRight && clampedWidth === minWidth && mouseXWhenMinReachedRef.current === null) {
        mouseXWhenMinReachedRef.current = e.clientX;
      }
      
      onResize(clampedWidth);
      prevWidthRef.current = clampedWidth;
      
      if (mouseXWhenMinReachedRef.current !== null) {
        const additionalDragDistance = e.clientX - mouseXWhenMinReachedRef.current;
        const collapseThreshold = window.innerWidth * 0.03;
        
        if (additionalDragDistance >= collapseThreshold) {
          onToggleCollapse();
          setIsResizing(false);
          mouseXWhenMinReachedRef.current = null;
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      mouseXWhenMinReachedRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    if (isResizing) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, onResize, onToggleCollapse, width]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || !user) return;

    // If messageText is provided (from quick action), it already includes the selected text
    // Otherwise, if there's selected PDF text from context, include it
    const fullMessage = messageText 
      ? textToSend // Quick action already formatted with selected text
      : (pdfSelectedText 
        ? `[Selected text from PDF: "${pdfSelectedText}"]\n\n${textToSend}`
        : textToSend);

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: fullMessage,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    if (!messageText) setInput('');
    if (pdfSelectedText) clearSelection(); // Clear PDF selection after sending
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      // Save user message (only if conversation exists and table is set up)
      if (conversationId) {
        try {
          await chatHistoryService.saveMessage(conversationId, 'user', fullMessage);
        } catch (saveError: any) {
          // If save fails due to missing table, continue anyway
          if (saveError?.code !== 'PGRST205') {
            console.error('Error saving message:', saveError);
          }
        }
      }

      // Get AI response
      const context = currentNote?.content || '';
      const aiResponse = await openaiService.chatCompletions([
        { role: 'user', content: fullMessage }
      ], context);

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Save AI response (only if conversation exists and table is set up)
      if (conversationId) {
        try {
          await chatHistoryService.saveMessage(conversationId, 'assistant', aiResponse);
        } catch (saveError: any) {
          // If save fails due to missing table, continue anyway
          if (saveError?.code !== 'PGRST205') {
            console.error('Error saving AI message:', saveError);
          }
        }
      }
    } catch (error: any) {
      console.error('Error getting AI response:', error);
      let errorContent = "I'm sorry, I couldn't process your request at this moment. Please try again.";
      
      // Check if this is a rate limit error by code OR by the error message/type
      const isRateLimit = error?.code === 'DAILY_LIMIT_REACHED' || 
                         error?.message?.includes('Daily limit') ||
                         (error instanceof Error && error.message.includes('429'));
      
      if (error?.code === 'ACCOUNT_LIMIT_REACHED') {
        errorContent = "You have already used your one-time AI generation quota. No additional AI generations are available.";
      } else if (error?.code === 'DAILY_LIMIT_REACHED' || isRateLimit) {
        errorContent = "Daily AI limit reached. Please try again tomorrow.";
      }
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateClick = (template: typeof CHAT_TEMPLATES[0]) => {
    if (!currentNote?.content) return;
    handleSend(template.prompt);
    setShowTemplates(false);
  };

  // Prevent body scroll when mobile modal is open
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = 'hidden';
    } else if (!isMobile) {
      document.body.style.overflow = '';
    }
    return () => {
      if (isMobile) {
        document.body.style.overflow = '';
      }
    };
  }, [isMobile, isOpen]);

  // Mobile modal version
  if (isMobile) {
    // Return null when closed on mobile (don't render collapsed button)
    if (!isOpen) {
      return null;
    }
    
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 z-[150] backdrop-blur-sm"
            />
            
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[151] flex flex-col bg-[#2a2a2a] lg:hidden"
            >
              {/* Header */}
              <div className="p-4 border-b border-[#3a3a3a] flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <HiSparkles className="w-6 h-6 text-[#b85a3a]" />
                  <h2 className="text-xl font-bold text-white">AI Tutor</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-[#3a3a3a] rounded-lg transition-colors"
                  aria-label="Close chat"
                >
                  <HiXMark className="w-6 h-6 text-[#9ca3af]" />
                </button>
              </div>

              {/* Suggested Questions */}
              {showSuggestions && suggestedQuestions.length > 0 && (
                <div className="px-4 py-3 border-b border-[#3a3a3a] flex-shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <HiLightBulb className="w-4 h-4 text-[#d4a944]" />
                    <span className="text-sm text-[#9ca3af]">Suggested questions:</span>
                  </div>
                  <div className="space-y-2">
                    {suggestedQuestions.map((question, idx) => (
                      <motion.button
                        key={idx}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSend(question)}
                        className="w-full text-left px-3 py-2 bg-[#1a1a1a] hover:bg-[#3a3a3a] rounded-lg text-sm text-white transition-colors"
                      >
                        {question}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <AnimatePresence>
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] px-4 py-3 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-[#1a1a1a] text-white'
                            : 'bg-[#3a3a3a] text-white'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <div className="text-sm text-white">
                            <MarkdownRenderer content={message.content} />
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="bg-[#3a3a3a] px-4 py-3 rounded-lg">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-[#9ca3af] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-[#9ca3af] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-[#9ca3af] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-[#3a3a3a] flex-shrink-0 space-y-3">
                {/* PDF Selection Indicator */}
                {pdfSelectedText && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-3 py-2 bg-[#1a1a1a] border border-[#b85a3a] rounded-lg text-xs text-white"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate flex-1">
                        📄 Selected: "{pdfSelectedText.substring(0, 50)}{pdfSelectedText.length > 50 ? '...' : ''}"
                      </span>
                      <button
                        onClick={clearSelection}
                        className="text-[#9ca3af] hover:text-white transition-colors"
                        title="Clear selection"
                      >
                        ✕
                      </button>
                    </div>
                  </motion.div>
                )}
                {/* Templates */}
                {showTemplates && (
                  <div className="grid grid-cols-2 gap-2">
                    {CHAT_TEMPLATES.map((template) => (
                      <motion.button
                        key={template.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleTemplateClick(template)}
                        className="px-3 py-2 bg-[#1a1a1a] hover:bg-[#3a3a3a] rounded-lg text-xs text-white transition-colors text-left"
                      >
                        {template.label}
                      </motion.button>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="px-3 py-3 bg-[#1a1a1a] hover:bg-[#3a3a3a] rounded-lg transition-colors"
                    title="Templates"
                  >
                    <HiSparkles className="w-5 h-5 text-[#9ca3af]" />
                  </button>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder={pdfSelectedText ? `Ask about "${pdfSelectedText.substring(0, 30)}..."` : "Ask anything..."}
                    className="flex-1 px-4 py-3 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white placeholder:text-[#6b7280] focus:outline-none focus:border-[#b85a3a] transition-colors"
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isLoading}
                    className="p-3 rounded-lg bg-[#b85a3a] hover:bg-[#a04a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <HiPaperAirplane className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  if (isCollapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="w-16 bg-[#1a1a1a] flex items-center justify-center border-l border-[#3a3a3a] hover:bg-[#2a2a2a] transition-colors"
      >
        <HiPaperAirplane className="w-6 h-6 text-[#9ca3af]" />
      </button>
    );
  }

  return (
    <motion.div
      ref={chatRef}
      className="relative bg-[#2a2a2a] border-l border-[#3a3a3a] flex flex-col h-full"
      style={{ width: `${width}px` }}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ 
        opacity: 0,
        x: 100,
        transition: { duration: 0.3, ease: "easeInOut" }
      }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={(e) => {
          setIsResizing(true);
          prevWidthRef.current = width;
          mouseXWhenMinReachedRef.current = null;
          startMouseXRef.current = e.clientX;
          initialMinWidthRef.current = Math.max(380, window.innerWidth * 0.25);
        }}
        className="absolute left-0 top-0 bottom-0 w-1 hover:w-2 hover:bg-[#b85a3a] cursor-col-resize transition-all z-10"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6">
          <button
            onClick={onToggleCollapse}
            className="mb-4 flex items-center gap-2 text-[#9ca3af] hover:text-white transition-colors"
          >
            <HiPlus className="w-5 h-5 rotate-45" />
            <span className="text-sm">Close</span>
          </button>
          <div className="flex items-center gap-2 mb-2">
            <HiSparkles className="w-6 h-6 text-[#b85a3a]" />
            <h2 className="text-3xl font-bold text-white">AI Tutor</h2>
          </div>
          <p className="text-[#9ca3af] text-lg">
            I can help explain concepts, answer questions, and guide your learning!
          </p>
        </div>

        {/* Suggested Questions */}
        {showSuggestions && suggestedQuestions.length > 0 && (
          <div className="px-6 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <HiLightBulb className="w-4 h-4 text-[#d4a944]" />
              <span className="text-sm text-[#9ca3af]">Suggested questions:</span>
            </div>
            <div className="space-y-2">
              {suggestedQuestions.map((question, idx) => (
                <motion.button
                  key={idx}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSend(question)}
                  className="w-full text-left px-3 py-2 bg-[#1a1a1a] hover:bg-[#3a3a3a] rounded-lg text-sm text-white transition-colors"
                >
                  {question}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-6">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-[#1a1a1a] text-white'
                      : 'bg-[#3a3a3a] text-white'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="text-sm text-white">
                      <MarkdownRenderer content={message.content} />
                    </div>
                  ) : (
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  )}
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-[#3a3a3a] px-4 py-3 rounded-lg">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-[#9ca3af] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-[#9ca3af] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-[#9ca3af] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-6 border-t border-[#3a3a3a] space-y-3">
          {/* PDF Selection Indicator */}
          {pdfSelectedText && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-3 py-2 bg-[#1a1a1a] border border-[#b85a3a] rounded-lg text-xs text-white"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate flex-1">
                  📄 Selected: "{pdfSelectedText.substring(0, 50)}{pdfSelectedText.length > 50 ? '...' : ''}"
                </span>
                <button
                  onClick={clearSelection}
                  className="text-[#9ca3af] hover:text-white transition-colors"
                  title="Clear selection"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
          {/* Templates */}
          {showTemplates && (
            <div className="grid grid-cols-2 gap-2">
              {CHAT_TEMPLATES.map((template) => (
                <motion.button
                  key={template.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleTemplateClick(template)}
                  className="px-3 py-2 bg-[#1a1a1a] hover:bg-[#3a3a3a] rounded-lg text-xs text-white transition-colors text-left"
                >
                  {template.label}
                </motion.button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="px-3 py-3 bg-[#1a1a1a] hover:bg-[#3a3a3a] rounded-lg transition-colors"
              title="Templates"
            >
              <HiSparkles className="w-5 h-5 text-[#9ca3af]" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={pdfSelectedText ? `Ask about "${pdfSelectedText.substring(0, 30)}..."` : "Ask anything..."}
              className="flex-1 px-4 py-3 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white placeholder:text-[#6b7280] focus:outline-none focus:border-[#b85a3a] transition-colors"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="p-3 rounded-lg bg-[#b85a3a] hover:bg-[#a04a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <HiPaperAirplane className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
