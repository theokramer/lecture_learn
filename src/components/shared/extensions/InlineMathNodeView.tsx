import React, { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface InlineMathNodeViewProps {
  node: {
    attrs: {
      formula: string;
    };
  };
  updateAttributes: (attrs: { formula: string }) => void;
  selected: boolean;
}

export const InlineMathNodeView: React.FC<InlineMathNodeViewProps> = ({
  node,
  updateAttributes,
  selected,
}) => {
  const [formula, setFormula] = useState(node.attrs.formula || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const renderRef = useRef<HTMLSpanElement>(null);

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
            displayMode: false,
          });
        } catch (error) {
          renderRef.current.innerHTML = `<span class="text-red-400">Error: ${formula}</span>`;
        }
      }
    }
  }, [selected, formula]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFormula = e.target.value;
    setFormula(newFormula);
    updateAttributes({ formula: newFormula });
  };

  const handleBlur = () => {
    // Save on blur
    updateAttributes({ formula });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Save on Enter
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    }
  };

  return (
    <NodeViewWrapper as="span" className="inline-math-wrapper" style={{ display: 'inline-block' }}>
      {selected ? (
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
          style={{ display: 'inline-block', verticalAlign: 'baseline' }}
        />
      )}
    </NodeViewWrapper>
  );
};

