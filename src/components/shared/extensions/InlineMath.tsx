import { Mark } from '@tiptap/core';
import 'katex/dist/katex.min.css';

export const InlineMath = Mark.create({
  name: 'inlineMath',

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
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const formula = HTMLAttributes.formula || '';
    return ['span', { 'data-type': 'inline-math', class: 'inline-math' }, 0];
  },

  addCommands() {
    return {
      setInlineMath: (attributes: { formula: string }) => ({ commands }) => {
        return commands.setMark(this.name, attributes);
      },
      toggleInlineMath: (attributes: { formula: string }) => ({ commands }) => {
        return commands.toggleMark(this.name, attributes);
      },
    };
  },
});

