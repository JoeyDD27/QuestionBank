'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';

interface MathRendererProps {
  content: string;
  className?: string;
}

// Escape HTML special characters to prevent XSS
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Process LaTeX content and render math expressions.
 * Uses Japanese brackets as delimiters to avoid conflicts with currency $:
 * - Inline: ｢...｣ (U+FF62, U+FF63)
 * - Block: ｢｢...｣｣
 */
function processLatex(content: string): string {
  if (!content) return '<span class="text-muted-foreground italic">No content</span>';

  // No math delimiters - return as plain text
  if (!content.includes('｢')) {
    return escapeHtml(content).replace(/\n/g, '<br>');
  }

  // Split by math delimiters: ｢｢...｣｣ (block) and ｢...｣ (inline)
  const mathPattern = /(｢｢[\s\S]*?｣｣|｢[^｢｣]+?｣)/g;
  const parts = content.split(mathPattern);

  const renderedParts = parts.map(part => {
    // Display math: ｢｢...｣｣
    if (part.startsWith('｢｢') && part.endsWith('｣｣')) {
      const math = part.slice(2, -2).trim();
      try {
        return katex.renderToString(math, {
          throwOnError: false,
          displayMode: true,
          output: 'html',
        });
      } catch {
        return `<span class="text-red-500">${escapeHtml(part)}</span>`;
      }
    }

    // Inline math: ｢...｣
    if (part.startsWith('｢') && part.endsWith('｣') && part.length > 2) {
      const math = part.slice(1, -1);
      try {
        return katex.renderToString(math, {
          throwOnError: false,
          displayMode: false,
          output: 'html',
        });
      } catch {
        return `<span class="text-red-500">${escapeHtml(part)}</span>`;
      }
    }

    // Plain text - escape HTML and convert newlines
    let text = escapeHtml(part);
    text = text.replace(/\n/g, '<br>');
    return text;
  });

  return renderedParts.join('');
}

/**
 * Main component for rendering mixed text and LaTeX content.
 */
export function MathRenderer({ content, className = '' }: MathRendererProps) {
  const renderedHtml = useMemo(() => processLatex(content), [content]);

  return (
    <div
      className={`math-content ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}

/**
 * Simple inline math renderer.
 */
export function InlineMath({ content }: { content: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(content, {
        throwOnError: false,
        displayMode: false,
        output: 'html',
      });
    } catch {
      return escapeHtml(content);
    }
  }, [content]);

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Block-level display math renderer.
 */
export function DisplayMath({ content }: { content: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(content, {
        throwOnError: false,
        displayMode: true,
        output: 'html',
      });
    } catch {
      return escapeHtml(content);
    }
  }, [content]);

  return <div className="my-2" dangerouslySetInnerHTML={{ __html: html }} />;
}

// Default export for backward compatibility
export default MathRenderer;
