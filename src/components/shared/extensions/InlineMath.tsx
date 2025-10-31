import { Node, type RawCommands, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { InlineMathNodeView } from './InlineMathNodeView';
import katex from 'katex';
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
      // Inline math: $formula$
      // This regex matches $...$ but not $$...$$
      new InputRule({
        find: /\$([^$\n]+?)\$$/,
        handler: ({ state, range, match }) => {
          const formula = match[1].trim();
          const { from, to } = range;
          
          if (!formula) return null;
          
          // Replace with inline math node
          const tr = state.tr
            .delete(from, to)
            .insert(
              state.schema.nodes.inlineMath.create({ formula })
            );
          
          return tr;
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

