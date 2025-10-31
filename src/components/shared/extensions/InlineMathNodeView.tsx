import React, { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export const InlineMathNodeView: React.FC<ReactNodeViewProps> = ({
  node,
  updateAttributes,
  selected,
}) => {
  const formulaAttr = node.attrs.formula as string | undefined;
  const [formula, setFormula] = useState(formulaAttr || '');
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const renderRef = useRef<HTMLSpanElement>(null);

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
          inputRef.current.select();
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
            displayMode: false,
          });
        } catch (error) {
          renderRef.current.innerHTML = `<span class="text-red-400">Error: ${formula}</span>`;
        }
      }
    }
  }, [isEditing, formula]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleKeyDown = () => {
    // Don't exit on Enter - only on blur
    // Allow normal text editing behavior
  };

  return (
    <NodeViewWrapper as="span" className="inline-math-wrapper" style={{ display: 'inline-block' }}>
      {isEditing ? (
        <span
          className="inline-math-edit"
          onMouseDown={(e) => e.stopPropagation()}
          style={{ display: 'inline-block' }}
        >
          <input
            ref={inputRef}
            type="text"
            value={formula}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="px-2 py-1 bg-[#1a1a1a] border-2 border-[#b85a3a] rounded text-white font-mono text-sm focus:outline-none min-w-[100px]"
            placeholder="LaTeX formula"
            style={{ fontFamily: 'monospace' }}
          />
        </span>
      ) : (
        <span
          ref={renderRef}
          className="inline-math cursor-pointer hover:bg-[#2a2a2a]/50 rounded px-1 transition-colors"
          title="Click to edit"
          onClick={() => setIsEditing(true)}
          style={{ display: 'inline-block', verticalAlign: 'baseline' }}
        />
      )}
    </NodeViewWrapper>
  );
};

