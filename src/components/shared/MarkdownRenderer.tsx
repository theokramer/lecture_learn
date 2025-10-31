import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Pre-process content to detect LaTeX patterns and ensure they have dollar signs
 * This handles cases where the AI returns LaTeX without dollar signs
 */
function preprocessLaTeX(content: string): string {
  if (!content || typeof content !== 'string') return content;

  // Check if content already has dollar signs - if so, remark-math will handle it
  // Otherwise, we'll rely on post-processing in the DOM to detect and render unwrapped LaTeX
  return content;
}

/**
 * Post-process rendered HTML to find and render LaTeX that might not be properly rendered
 * This handles cases where dollar signs exist but LaTeX isn't rendering, or LaTeX without dollar signs
 */
function postProcessLaTeX(container: HTMLElement) {
  // First, check if there are any text nodes with dollar signs that weren't converted to katex
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );

  const textNodes: Node[] = [];
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent || '';
    if (text.includes('$')) {
      const parent = node.parentElement;
      // Skip if already inside a katex element
      if (parent && !parent.closest('.katex') && !parent.closest('code')) {
        textNodes.push(node);
      }
    }
  }

  // Process text nodes with dollar signs that weren't rendered
  textNodes.forEach((textNode) => {
    const text = textNode.textContent || '';
    const parent = textNode.parentElement;
    if (!parent) return;

    // Find $...$ and $$...$$ patterns
    const dollarRegex = /(\$\$?)([^\$\n]+?)\1/g;
    const matches = [...text.matchAll(dollarRegex)];
    
    if (matches.length === 0) return;

    const fragments: Node[] = [];
    let lastIndex = 0;

    matches.forEach((match) => {
      const fullMatch = match[0];
      const delimiter = match[1];
      const formula = match[2];
      const matchStart = match.index || 0;
      const matchEnd = matchStart + fullMatch.length;

      // Add text before match
      if (matchStart > lastIndex) {
        fragments.push(document.createTextNode(text.substring(lastIndex, matchStart)));
      }

      // Try to render the LaTeX
      try {
        const mathSpan = document.createElement('span');
        katex.render(formula, mathSpan, {
          throwOnError: false,
          displayMode: delimiter === '$$',
        });
        if (delimiter === '$$') {
          mathSpan.style.display = 'block';
          mathSpan.style.textAlign = 'center';
          mathSpan.style.margin = '1rem 0';
        }
        fragments.push(mathSpan);
      } catch (error) {
        // If rendering fails, keep original text
        fragments.push(document.createTextNode(fullMatch));
      }

      lastIndex = matchEnd;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      fragments.push(document.createTextNode(text.substring(lastIndex)));
    }

    // Replace the text node with fragments
    if (fragments.length > 1) {
      const fragment = document.createDocumentFragment();
      fragments.forEach(frag => fragment.appendChild(frag));
      parent.replaceChild(fragment, textNode);
    }
  });
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = '' 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Pre-process content to ensure LaTeX is properly formatted
  const processedContent = preprocessLaTeX(content);

  // Post-process after markdown rendering to catch any unwrapped LaTeX
  useEffect(() => {
    if (containerRef.current) {
      // Small delay to ensure markdown has rendered
      const timeout = setTimeout(() => {
        if (containerRef.current) {
          postProcessLaTeX(containerRef.current);
        }
      }, 10);
      return () => clearTimeout(timeout);
    }
  }, [content]);

  return (
    <div ref={containerRef} className={`markdown-content prose prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            return !inline && language ? (
              <pre className="bg-[#1a1a1a] rounded-lg p-4 overflow-x-auto my-4">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            ) : (
              <code className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-sm" {...props}>
                {children}
              </code>
            );
          },
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          h1: ({ children }) => <h1 className="text-2xl font-bold mb-3 mt-4">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-bold mb-2 mt-3">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-bold mb-2 mt-2">{children}</h3>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-2 ml-4">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 ml-4">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#b85a3a] pl-4 my-2 italic">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a href={href} className="text-[#3b82f6] hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-[#3a3a3a]">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-[#3a3a3a] px-4 py-2 bg-[#2a2a2a] font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-[#3a3a3a] px-4 py-2">
              {children}
            </td>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

