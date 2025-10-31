import { Node, type RawCommands, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { BlockMathNodeView } from './BlockMathNodeView';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Augment TipTap Commands to include our custom blockMath command
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockMath: {
      /** Insert a block math node with the given LaTeX formula */
      setBlockMath: (attributes: { formula: string }) => ReturnType;
    };
  }
}

export const BlockMath = Node.create({
  name: 'blockMath',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: 'block',

  atom: true,
  content: '',
  
  addNodeView() {
    return ReactNodeViewRenderer(BlockMathNodeView);
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
        tag: 'div[data-type="block-math"]',
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
    return ['div', { 
      class: 'block-math', 
      'data-type': 'block-math',
      'data-formula': formula
    }];
  },

  addInputRules() {
    return [
      // Block math: $$formula$$ (trigger on space/enter after closing $$)
      new InputRule({
        find: /\$\$([^$]+?)\$\$\s/,
        handler: ({ state, range, match }) => {
          const formula = match[1].trim();
          const { from, to } = range;
          
          const node = state.schema.nodes.blockMath.create({ formula });
          const tr = state.tr
            .delete(from, to - 1) // -1 to keep the space
            .insert(from, node);
          
          // Select the newly created node so it enters edit mode
          tr.setSelection(state.doc.resolve(from).textAfter ? undefined : undefined);
          return tr;
        },
      }),
      // Block math: $$formula$$ (trigger on enter/newline after closing $$)
      new InputRule({
        find: /\$\$([^$]+?)\$\$$/,
        handler: ({ state, range, match, chain }) => {
          const formula = match[1].trim();
          const { from, to } = range;
          
          const node = state.schema.nodes.blockMath.create({ formula });
          const tr = state.tr
            .delete(from, to)
            .insert(from, node);
          
          return tr;
        },
      }),
    ];
  },

  addCommands(): Partial<RawCommands> {
    return {
      setBlockMath:
        (attributes: { formula: string }) =>
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    } as Partial<RawCommands>;
  },
});

