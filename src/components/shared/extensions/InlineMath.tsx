import { Node, type RawCommands, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { InlineMathNodeView } from './InlineMathNodeView';
import 'katex/dist/katex.min.css';

// Augment TipTap Commands to include our custom inlineMath commands
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineMath: {
      setInlineMath: (attributes: { formula: string }) => ReturnType;
    };
  }
}

export const InlineMath = Node.create({
  name: 'inlineMath',
  
  group: 'inline',
  
  inline: true,
  
  atom: true,
  
  addNodeView() {
    return ReactNodeViewRenderer(InlineMathNodeView);
  },

  addAttributes() {
    return {
      formula: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="inline-math"]',
        getAttrs: (node) => {
          if (typeof node === 'string') return false;
          const element = node as HTMLElement;
          return {
            formula: element.getAttribute('data-formula') || element.textContent || '',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const formula = HTMLAttributes.formula || '';
    // Return minimal HTML since React component will handle rendering
    return ['span', { 
      'data-type': 'inline-math', 
      class: 'inline-math',
      'data-formula': formula
    }];
  },

  addInputRules() {
    return [
      // Inline math: $formula$ (trigger on space after closing $)
      new InputRule({
        find: /\$([^$\n]+?)\$\s/,
        handler: ({ state, range, match }) => {
          const formula = match[1].trim();
          const { from, to } = range;
          
          if (!formula) return;
          
          // Check if it's part of $$ (block math) - if so, don't match
          const beforeText = state.doc.textBetween(Math.max(0, from - 2), from);
          if (beforeText === '$') return;
          
          const node = state.schema.nodes.inlineMath.create({ formula });
          state.tr.delete(from, to - 1).insert(from, node);
        },
      }),
      // Inline math: $formula$ (trigger on punctuation or end of line)
      new InputRule({
        find: /\$([^$\n]+?)\$$/,
        handler: ({ state, range, match }) => {
          const formula = match[1].trim();
          const { from, to } = range;
          
          if (!formula) return;
          
          // Check if it's part of $$ (block math) - if so, don't match
          const beforeText = state.doc.textBetween(Math.max(0, from - 2), from);
          if (beforeText === '$') return;
          
          const node = state.schema.nodes.inlineMath.create({ formula });
          state.tr.delete(from, to).insert(from, node);
        },
      }),
    ];
  },

  addCommands(): Partial<RawCommands> {
    return {
      setInlineMath: (attributes: { formula: string }) => ({ commands }: { commands: any }) => {
        return commands.insertContent({
          type: this.name,
          attrs: attributes,
        });
      },
    } as Partial<RawCommands>;
  },
});

