import React, { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export const BlockMathNodeView: React.FC<ReactNodeViewProps> = ({
  node,
  updateAttributes,
  selected,
}) => {
  const formulaAttr = node.attrs.formula as string | undefined;
  const [formula, setFormula] = useState(formulaAttr || '');
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const renderRef = useRef<HTMLDivElement>(null);

  // Update local state when node attributes change
  useEffect(() => {
    const newFormula = formulaAttr || '';
    setFormula(newFormula);
    // If formula is empty, enter edit mode automatically
    if (!newFormula.trim()) {
      setIsEditing(true);
    }
  }, [formulaAttr]);

  // Enter edit mode when selected or when clicking on rendered math
  useEffect(() => {
    if (selected && inputRef.current) {
      setIsEditing(true);
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(0, inputRef.current.value.length);
        }
      }, 10);
    }
  }, [selected]);

  // Render katex when not editing
  useEffect(() => {
    if (!isEditing && renderRef.current) {
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
  }, [isEditing, formula]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newFormula = e.target.value;
    setFormula(newFormula);
    updateAttributes({ formula: newFormula });
    // Stay in edit mode while typing
    setIsEditing(true);
  };

  const handleBlur = () => {
    // Only exit edit mode on blur if we have content
    if (formula.trim()) {
      setIsEditing(false);
      updateAttributes({ formula });
    }
    // If empty, keep in edit mode (node will stay editable)
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't exit on Enter - only on blur
    // Allow normal text editing behavior
  };

  return (
    <NodeViewWrapper className="block-math-wrapper my-6">
      {isEditing ? (
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
          onClick={() => setIsEditing(true)}
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

