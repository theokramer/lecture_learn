import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface EditorContentRendererProps {
  html: string;
}

export const EditorContentRenderer: React.FC<EditorContentRendererProps> = ({ html }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Process all code blocks to check for LaTeX
    const codeBlocks = container.querySelectorAll('pre code');
    codeBlocks.forEach((code) => {
      const language = code.getAttribute('class') || '';
      const formula = code.textContent || '';
      
      if (language.includes('latex') || language.includes('math') || formula.includes('\\')) {
        // This might be LaTeX
        const parent = code.parentElement;
        if (parent && parent.tagName === 'PRE') {
          const mathDiv = document.createElement('div');
          mathDiv.className = 'katex-display my-6 text-center overflow-x-auto';
          
          try {
            katex.render(formula, mathDiv, {
              throwOnError: false,
              displayMode: true,
            });
            parent.replaceWith(mathDiv);
          } catch (error) {
            // Keep original code block if rendering fails
            console.error('LaTeX rendering error:', error);
          }
        }
      }
    });

    // Process inline dollar signs for math
    const textWalker = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.includes('$')) {
        const parent = node.parentElement;
        if (!parent) return;

        const text = node.textContent || '';
        const dollarRegex = /(\$\$?)([^\$\n]+?)\1/g;
        
        let lastIndex = 0;
        let match;
        const fragments: (Node | string)[] = [];

        while ((match = dollarRegex.exec(text)) !== null) {
          const fullMatch = match[0];
          const delimiter = match[1];
          const formula = match[2];
          const startIndex = match.index;
          const endIndex = startIndex + fullMatch.length;

          // Add text before the match
          if (startIndex > lastIndex) {
            const textNode = document.createTextNode(text.substring(lastIndex, startIndex));
            fragments.push(textNode);
          }

          // Render LaTeX
          try {
            const mathSpan = document.createElement('span');
            katex.render(formula, mathSpan, {
              throwOnError: false,
              displayMode: delimiter === '$$',
            });
            mathSpan.className = 'katex-inline';
            if (delimiter === '$$') {
              mathSpan.style.display = 'block';
              mathSpan.style.textAlign = 'center';
              mathSpan.style.margin = '1rem 0';
            }
            fragments.push(mathSpan);
          } catch (error) {
            // Keep original text on error
            const textNode = document.createTextNode(fullMatch);
            fragments.push(textNode);
          }

          lastIndex = endIndex;
        }

        // Add remaining text
        if (lastIndex < text.length) {
          const textNode = document.createTextNode(text.substring(lastIndex));
          fragments.push(textNode);
        }

        // Replace the original text node with fragments
        if (fragments.length > 0) {
          const documentFragment = document.createDocumentFragment();
          fragments.forEach((frag) => {
            if (typeof frag === 'string') {
              documentFragment.appendChild(document.createTextNode(frag));
            } else {
              documentFragment.appendChild(frag);
            }
          });
          parent.replaceChild(documentFragment, node);
        }
      } else {
        node.childNodes.forEach(textWalker);
      }
    };

    container.childNodes.forEach(textWalker);
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="prose prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

