import { Mark, type RawCommands, InputRule } from '@tiptap/core';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Augment TipTap Commands to include our custom inlineMath commands
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineMath: {
      setInlineMath: (attributes: { formula: string }) => ReturnType;
      toggleInlineMath: (attributes: { formula: string }) => ReturnType;
    };
  }
}

export const InlineMath = Mark.create({
  name: 'inlineMath',

  addAttributes() {
    return {
      formula: {
        default: '',
        parseHTML: (element: HTMLElement) => {
          return element.getAttribute('data-formula') || element.textContent || '';
        },
        renderHTML: (attributes: { formula: string }) => {
          return {
            'data-formula': attributes.formula,
          };
        },
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
          const formula = element.getAttribute('data-formula') || element.textContent || '';
          return { formula };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const formula = HTMLAttributes.formula || '';
    let html = '';
    
    try {
      html = katex.renderToString(formula, {
        throwOnError: false,
        displayMode: false,
      });
    } catch (error) {
      html = `<span class="text-red-400">Error: ${formula}</span>`;
    }

    return ['span', { 
      'data-type': 'inline-math', 
      class: 'inline-math',
      'data-formula': formula,
      dangerouslySetInnerHTML: { __html: html }
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
          
          // Replace the $...$ with the formula text and apply the mark
          const tr = state.tr
            .delete(from, to)
            .insertText(formula, from);
          
          // Apply the inline math mark to the inserted text
          const mark = this.type.create({ formula });
          tr.addMark(from, from + formula.length, mark);
          
          return tr;
        },
      }),
    ];
  },

  addCommands(): Partial<RawCommands> {
    return {
      setInlineMath: (attributes: { formula: string }) => ({ commands }: { commands: any }) => {
        return commands.setMark(this.name, attributes);
      },
      toggleInlineMath: (attributes: { formula: string }) => ({ commands }: { commands: any }) => {
        return commands.toggleMark(this.name, attributes);
      },
    } as Partial<RawCommands>;
  },
});

