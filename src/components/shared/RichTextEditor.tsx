import React, { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';

const Color = TextStyle.extend({
  name: 'color',
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.color,
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.color) {
            return {};
          }
          return {
            style: `color: ${attributes.color}`,
          };
        },
      },
    };
  },
});
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Link } from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Highlight } from '@tiptap/extension-highlight';
import { BlockMath } from './extensions/BlockMath';
import { InlineMath } from './extensions/InlineMath';
import { 
  HiBold, 
  HiItalic, 
  HiUnderline, 
  HiStrikethrough, 
  HiLink, 
  HiPhoto,
  HiListBullet as HiBulletList,
  HiQueueList as HiNumberedList,
} from 'react-icons/hi2';
import { HiCode } from 'react-icons/hi';
import { 
  HiX,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
} from 'react-icons/hi';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
}

/**
 * Preprocesses HTML content to convert LaTeX formulas to TipTap nodes
 * This handles existing content that contains $...$ and $$...$$ patterns
 */
function preprocessLaTeXContent(html: string): string {
  if (!html || typeof html !== 'string') return html;

  // Extract text content from HTML, process it, then reconstruct
  // This is simpler than trying to parse HTML with regex
  
  // First, process block math: $$formula$$
  // Use a more robust regex that handles multiline and various contexts
  let processed = html;
  
  // Process block math first (to avoid conflicts with inline math)
  // Match $$...$$ patterns, handling multiline formulas
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula, offset) => {
    // Check if this is inside an HTML tag attribute
    const beforeMatch = processed.substring(0, offset);
    const lastTagEnd = beforeMatch.lastIndexOf('>');
    const lastTagStart = beforeMatch.lastIndexOf('<');
    
    // If we're inside an HTML tag (between < and >), don't replace
    if (lastTagStart > lastTagEnd) {
      return match;
    }

    const trimmedFormula = formula.trim();
    if (!trimmedFormula) return match;

    // Escape formula for HTML attribute
    const escapedFormula = trimmedFormula
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return `<div data-type="block-math" data-formula="${escapedFormula}"></div>`;
  });

  // Now process inline math: $formula$ (single dollar signs)
  // But only if they're not part of $$...$$ (which we already processed)
  processed = processed.replace(/\$([^$\n]+?)\$/g, (match, formula, offset) => {
    // Check if we're inside an HTML tag
    const beforeMatch = processed.substring(0, offset);
    const lastTagEnd = beforeMatch.lastIndexOf('>');
    const lastTagStart = beforeMatch.lastIndexOf('<');
    
    // If we're inside a tag, don't replace
    if (lastTagStart > lastTagEnd) {
      return match;
    }

    // Check if this is part of block math (should have $$ before and after)
    // Look for $$ before this match
    const before = processed.substring(Math.max(0, offset - 2), offset);
    const after = processed.substring(offset + match.length, Math.min(processed.length, offset + match.length + 2));
    
    // If surrounded by $ signs, skip (it's block math that wasn't matched properly)
    if ((before === '$' || before.endsWith('$')) && (after === '$' || after.startsWith('$'))) {
      return match;
    }

    const trimmedFormula = formula.trim();
    if (!trimmedFormula) return match;

    // Escape formula for HTML attribute
    const escapedFormula = trimmedFormula
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return `<span data-type="inline-math" data-formula="${escapedFormula}"></span>`;
  });

  return processed;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  placeholder = 'Start typing...',
  editable = true,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        // Disable extensions we're adding separately to avoid duplicates
        link: false,
        underline: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Color,
      TextStyle,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-400 hover:text-blue-300 underline',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-gray-600',
        },
      }),
      TableRow,
      TableCell,
      TableHeader,
      Highlight.configure({
        multicolor: true,
      }),
      BlockMath,
      InlineMath,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[500px] p-6',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // Preprocess content to convert LaTeX patterns to TipTap nodes
      const processedContent = preprocessLaTeXContent(content);
      editor.commands.setContent(processedContent);
    }
  }, [content, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const addRowAfter = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().addRowAfter().run();
  }, [editor]);

  const addColumnAfter = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().addColumnAfter().run();
  }, [editor]);

  const deleteTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().deleteTable().run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {editable && (
        <div className="border-b border-[#4a4a4a] bg-[#2a2a2a] px-4 py-2 flex items-center gap-1 flex-wrap">
          {/* Text Formatting */}
          <div className="flex items-center gap-1 pr-2 border-r border-[#4a4a4a]">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-2 rounded hover:bg-[#3a3a3a] transition-colors ${
                editor.isActive('bold') ? 'bg-[#3a3a3a] text-[#b85a3a]' : 'text-gray-300'
              }`}
              title="Bold"
            >
              <HiBold className="w-5 h-5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-2 rounded hover:bg-[#3a3a3a] transition-colors ${
                editor.isActive('italic') ? 'bg-[#3a3a3a] text-[#b85a3a]' : 'text-gray-300'
              }`}
              title="Italic"
            >
              <HiItalic className="w-5 h-5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-2 rounded hover:bg-[#3a3a3a] transition-colors ${
                editor.isActive('underline') ? 'bg-[#3a3a3a] text-[#b85a3a]' : 'text-gray-300'
              }`}
              title="Underline"
            >
              <HiUnderline className="w-5 h-5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`p-2 rounded hover:bg-[#3a3a3a] transition-colors ${
                editor.isActive('strike') ? 'bg-[#3a3a3a] text-[#b85a3a]' : 'text-gray-300'
              }`}
              title="Strikethrough"
            >
              <HiStrikethrough className="w-5 h-5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleCode().run()}
              className={`p-2 rounded hover:bg-[#3a3a3a] transition-colors ${
                editor.isActive('code') ? 'bg-[#3a3a3a] text-[#b85a3a]' : 'text-gray-300'
              }`}
              title="Code"
            >
              <HiCode className="w-5 h-5" />
            </button>
          </div>

          {/* Headings */}
          <div className="flex items-center gap-1 pr-2 border-r border-[#4a4a4a]">
            <select
              onChange={(e) => {
                const level = parseInt(e.target.value);
                if (level === 0) {
                  editor.chain().focus().setParagraph().run();
                } else {
                  editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run();
                }
              }}
              value={
                editor.isActive('heading', { level: 1 }) ? '1' :
                editor.isActive('heading', { level: 2 }) ? '2' :
                editor.isActive('heading', { level: 3 }) ? '3' : '0'
              }
              className="bg-[#1a1a1a] border border-[#4a4a4a] rounded px-3 py-1 text-white text-sm"
            >
              <option value="0">Paragraph</option>
              <option value="1">Heading 1</option>
              <option value="2">Heading 2</option>
              <option value="3">Heading 3</option>
            </select>
          </div>

          {/* Lists */}
          <div className="flex items-center gap-1 pr-2 border-r border-[#4a4a4a]">
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-2 rounded hover:bg-[#3a3a3a] transition-colors ${
                editor.isActive('bulletList') ? 'bg-[#3a3a3a] text-[#b85a3a]' : 'text-gray-300'
              }`}
              title="Bullet List"
            >
              <HiBulletList className="w-5 h-5" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-2 rounded hover:bg-[#3a3a3a] transition-colors ${
                editor.isActive('orderedList') ? 'bg-[#3a3a3a] text-[#b85a3a]' : 'text-gray-300'
              }`}
              title="Numbered List"
            >
              <HiNumberedList className="w-5 h-5" />
            </button>
          </div>

          {/* Text Alignment */}
          <div className="flex items-center gap-1 pr-2 border-r border-[#4a4a4a]">
            <button
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              className={`p-2 rounded hover:bg-[#3a3a3a] transition-colors ${
                editor.isActive({ textAlign: 'left' }) ? 'bg-[#3a3a3a] text-[#b85a3a]' : 'text-gray-300'
              }`}
              title="Align Left"
            >
              ←
            </button>
            <button
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              className={`p-2 rounded hover:bg-[#3a3a3a] transition-colors ${
                editor.isActive({ textAlign: 'center' }) ? 'bg-[#3a3a3a] text-[#b85a3a]' : 'text-gray-300'
              }`}
              title="Align Center"
            >
              ≡
            </button>
            <button
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              className={`p-2 rounded hover:bg-[#3a3a3a] transition-colors ${
                editor.isActive({ textAlign: 'right' }) ? 'bg-[#3a3a3a] text-[#b85a3a]' : 'text-gray-300'
              }`}
              title="Align Right"
            >
              →
            </button>
          </div>

          {/* Highlight */}
          <div className="flex items-center gap-1 pr-2 border-r border-[#4a4a4a]">
            <input
              type="color"
              onInput={(e) => editor.chain().focus().setHighlight({ color: e.currentTarget.value }).run()}
              className="w-8 h-8 rounded cursor-pointer"
              title="Highlight Color"
            />
          </div>

          {/* Link */}
          <button
            onClick={setLink}
            className={`p-2 rounded hover:bg-[#3a3a3a] transition-colors text-gray-300`}
            title="Add Link"
          >
            <HiLink className="w-5 h-5" />
          </button>

          {/* Table */}
          <div className="flex items-center gap-1 pr-2 border-r border-[#4a4a4a]">
            <button
              onClick={insertTable}
              className="p-2 rounded hover:bg-[#3a3a3a] transition-colors text-gray-300"
              title="Insert Table"
            >
              <HiPhoto className="w-5 h-5" />
            </button>
            {editor.isActive('table') && (
              <>
                <button
                  onClick={addRowAfter}
                  className="p-2 rounded hover:bg-[#3a3a3a] transition-colors text-gray-300"
                  title="Add Row"
                >
                  <HiOutlineChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={addColumnAfter}
                  className="p-2 rounded hover:bg-[#3a3a3a] transition-colors text-gray-300"
                  title="Add Column"
                >
                  <HiOutlineChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={deleteTable}
                  className="p-2 rounded hover:bg-[#3a3a3a] transition-colors text-gray-300 text-red-400"
                  title="Delete Table"
                >
                  <HiX className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Undo/Redo */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => editor.chain().focus().undo().run()}
              className="p-2 rounded hover:bg-[#3a3a3a] transition-colors text-gray-300"
              title="Undo"
            >
              ↶
            </button>
            <button
              onClick={() => editor.chain().focus().redo().run()}
              className="p-2 rounded hover:bg-[#3a3a3a] transition-colors text-gray-300"
              title="Redo"
            >
              ↷
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto bg-[#2a2a2a]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

