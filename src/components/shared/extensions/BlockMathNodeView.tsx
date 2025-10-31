import React, { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface BlockMathNodeViewProps {
  node: {
    attrs: {
      formula: string;
    };
  };
  updateAttributes: (attrs: { formula: string }) => void;
  selected: boolean;
  extension: any;
}

export const BlockMathNodeView: React.FC<BlockMathNodeViewProps> = ({
  node,
  updateAttributes,
  selected,
}) => {
  const [formula, setFormula] = useState(node.attrs.formula || '');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const renderRef = useRef<HTMLDivElement>(null);

  // Update local state when node attributes change
  useEffect(() => {
    setFormula(node.attrs.formula || '');
  }, [node.attrs.formula]);

  // Enter edit mode when selected
  useEffect(() => {
    if (selected && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [selected]);

  // Render katex when not selected
  useEffect(() => {
    if (!selected && renderRef.current) {
      // Clear previous content
      renderRef.current.innerHTML = '';
      
      if (formula.trim()) {
        try {
          katex.render(formula, renderRef.current, {
            throwOnError: false,
            displayMode: true,
          });
        } catch (error) {
          renderRef.current.innerHTML = `<div class="text-red-400 p-4 bg-red-900/20 rounded border border-red-500/50">Error: ${formula}</div>`;
        }
      }
    }
  }, [selected, formula]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newFormula = e.target.value;
    setFormula(newFormula);
    updateAttributes({ formula: newFormula });
  };

  const handleBlur = () => {
    // Save on blur
    updateAttributes({ formula });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow Shift+Enter for newlines
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      inputRef.current?.blur();
    }
  };

  return (
    <NodeViewWrapper className="block-math-wrapper my-6">
      {selected ? (
        <div
          className="block-math-edit"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <textarea
            ref={inputRef}
            value={formula}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full p-4 bg-[#1a1a1a] border-2 border-[#b85a3a] rounded-lg text-white font-mono text-sm focus:outline-none resize-y min-h-[80px]"
            placeholder="Enter LaTeX formula..."
            style={{ fontFamily: 'monospace' }}
          />
          <div className="text-xs text-gray-500 mt-2 px-4">
            Type your LaTeX formula. It will render when you click elsewhere.
          </div>
        </div>
      ) : (
        <div
          ref={renderRef}
          className="block-math my-6 text-center overflow-x-auto cursor-pointer hover:bg-[#2a2a2a]/50 rounded-lg p-2 transition-colors"
          title="Click to edit"
          style={{
            minHeight: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      )}
    </NodeViewWrapper>
  );
};

