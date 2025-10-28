import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface LaTeXRendererProps {
  content: string;
}

export const LaTeXRenderer: React.FC<LaTeXRendererProps> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Find all code blocks with class "language-latex" or "language-math"
    const codeBlocks = container.querySelectorAll('pre > code.language-latex, pre > code.language-math');
    
    codeBlocks.forEach((codeBlock) => {
      const formula = codeBlock.textContent || '';
      if (formula.trim() === '') return;

      const parent = codeBlock.parentElement;
      if (!parent) return;

      // Create a new div for the rendered LaTeX
      const mathDiv = document.createElement('div');
      mathDiv.className = 'katex-rendered overflow-x-auto my-4';

      try {
        katex.render(formula, mathDiv, {
          throwOnError: false,
          displayMode: true,
        });
        parent.replaceWith(mathDiv);
      } catch (error) {
        console.error('Error rendering LaTeX:', error);
      }
    });

    // Find inline math markers like $formula$
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent || '';
      if (!text.includes('$')) continue;

      // Simple $inline$ and $$block$$ math detection
      const dollarRegex = /(\$\$?)([^\$\n]+?)\1/g;
      const matches = [...text.matchAll(dollarRegex)];
      
      if (matches.length === 0) continue;

      let newText = text;
      const fragments: (Text | Element)[] = [];

      for (const match of matches) {
        const fullMatch = match[0];
        const delimiter = match[1];
        const formula = match[2];
        const startIndex = match.index || 0;
        const endIndex = startIndex + fullMatch.length;

        // Text before the match
        if (startIndex > 0) {
          const textNode = document.createTextNode(text.substring(0, startIndex));
          fragments.push(textNode);
        }

        // Render the LaTeX
        try {
          const mathSpan = document.createElement('span');
          const isBlock = delimiter === '$$';
          katex.render(formula, mathSpan, {
            throwOnError: false,
            displayMode: isBlock,
          });
          mathSpan.className = `katex-inline ${isBlock ? 'katex-block' : ''}`;
          fragments.push(mathSpan);
        } catch (error) {
          // On error, keep the original text
          const textNode = document.createTextNode(fullMatch);
          fragments.push(textNode);
        }

        // Update text for next iteration
        newText = text.substring(endIndex);
      }

      if (fragments.length > 0) {
        const parent = node.parentNode;
        if (parent && fragments.length > 0) {
          fragments.push(document.createTextNode(newText));
          const fragment = document.createDocumentFragment();
          fragments.forEach((frag) => fragment.appendChild(frag));
          parent.replaceChild(fragment, node);
        }
      }
    }
  }, [content]);

  return (
    <div ref={containerRef} dangerouslySetInnerHTML={{ __html: content }} />
  );
};

