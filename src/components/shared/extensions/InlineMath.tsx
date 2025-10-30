import { Mark, type RawCommands } from '@tiptap/core';
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
    return ['span', { 'data-type': 'inline-math', class: 'inline-math' }, 0];
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

