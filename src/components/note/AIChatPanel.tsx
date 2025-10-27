import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiPlus, HiPaperAirplane } from 'react-icons/hi2';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatPanelProps {
  width: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onResize: (width: number) => void;
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  width,
  isCollapsed,
  onToggleCollapse,
  onResize,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "I can work with you on your docs and answer any questions!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const prevWidthRef = useRef(width);
  const mouseXWhenMinReachedRef = useRef<number | null>(null);
  const startMouseXRef = useRef(0);
  const initialMinWidthRef = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      // Use percentage-based minimum width (25% of screen, or 380px absolute minimum)
      const minWidth = Math.max(380, window.innerWidth * 0.25);
      const clampedWidth = Math.max(minWidth, Math.min(newWidth, 600));
      
      // Check if we're dragging to the right (shrinking the panel)
      const isDraggingRight = clampedWidth < prevWidthRef.current;
      
      // Handle starting at minimum width - initialize tracking if we start there
      if (prevWidthRef.current === minWidth && mouseXWhenMinReachedRef.current === null) {
        const dragDirection = e.clientX - startMouseXRef.current;
        if (dragDirection > 0) {
          // User is dragging to the right from the start
          mouseXWhenMinReachedRef.current = startMouseXRef.current;
        }
      }
      
      // If we hit the minimum width while dragging right, record the mouse X position
      if (isDraggingRight && clampedWidth === minWidth && mouseXWhenMinReachedRef.current === null) {
        mouseXWhenMinReachedRef.current = e.clientX;
      }
      
      onResize(clampedWidth);
      prevWidthRef.current = clampedWidth;
      
      // Auto-collapse: if we've hit minimum and user drags 3% more screen width to the right
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

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages([...messages, userMessage]);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "That's a great question! Let me help you understand that better. Would you like me to explain any specific part in more detail?",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);

    setInput('');
  };

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
      className="relative bg-[#2a2a2a] border-l border-[#3a3a3a] flex flex-col"
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
          <h2 className="text-3xl font-bold text-white mb-2">Hey there!</h2>
          <p className="text-[#9ca3af] text-lg">
            I can work with you on your docs and answer any questions!
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 space-y-4">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-[#1a1a1a] text-white'
                      : 'bg-[#3a3a3a] text-white'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Input */}
        <div className="p-6 border-t border-[#3a3a3a]">
          <div className="flex gap-2">
            <button className="p-3 rounded-lg bg-[#1a1a1a] hover:bg-[#2a2a2a] transition-colors">
              <HiPlus className="w-5 h-5 text-[#9ca3af]" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything"
              className="flex-1 px-4 py-3 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg text-white placeholder:text-[#6b7280] focus:outline-none focus:border-[#b85a3a] transition-colors"
            />
            <button
              onClick={handleSend}
              className="p-3 rounded-lg bg-[#b85a3a] hover:bg-[#a04a2a] transition-colors"
            >
              <HiPaperAirplane className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
