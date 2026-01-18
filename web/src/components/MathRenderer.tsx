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
 * Auto-detect and wrap common math patterns in a plain text segment.
 * This handles cases where data contains plain text math like "e^3x ≠ 0" or "b²-4ac=0".
 */
function autoWrapMathInPlainText(text: string): string {
  let result = text;

  // Pattern 0: Complex expressions with fractions containing exponents
  result = result.replace(
    /\b([a-zA-Z0-9]*[a-zA-Z]\^[\w()]+)\/(\([^)]+\))/g,
    (match, num, den) => {
      const numLatex = num.replace(/\^(\([^)]+\)|[\w]+)/g, (_: string, exp: string) => {
        const cleanExp = exp.startsWith('(') ? exp.slice(1, -1) : exp;
        return `^{${cleanExp}}`;
      });
      const denClean = den.slice(1, -1);
      return `$\\frac{${numLatex}}{${denClean}}$`;
    }
  );

  // Pattern 1a: Expressions with LaTeX-style braces like "e^{3x}"
  result = result.replace(
    /\b([a-zA-Z]*[a-zA-Z])\^\{([^}]+)\}/g,
    (match, base, exp) => `$${base}^{${exp}}$`
  );

  // Pattern 1b: Expressions with caret notation like "e^3x", "e^(3x)"
  result = result.replace(
    /\b([a-zA-Z]+)\^(\([^)]+\)|[a-zA-Z0-9]+)/g,
    (match, base, exp) => {
      const cleanExp = exp.startsWith('(') ? exp.slice(1, -1) : exp;
      return `$${base}^{${cleanExp}}$`;
    }
  );

  // Pattern 2: Unicode superscript numbers (², ³, ⁴, etc.)
  const superscriptMap: Record<string, string> = {
    '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6',
    '⁷': '7', '⁸': '8', '⁹': '9', '⁰': '0', '¹': '1'
  };

  // Handle e^(-x²) style expressions
  result = result.replace(
    /\b([a-zA-Z])\^\(([^)]*[²³⁴⁵⁶⁷⁸⁹⁰¹][^)]*)\)/g,
    (match, base, content) => {
      const converted = content.replace(/([a-zA-Z]?)([²³⁴⁵⁶⁷⁸⁹⁰¹]+)/g, (_: string, letter: string, sups: string) => {
        const exp = sups.split('').map((s: string) => superscriptMap[s] || s).join('');
        return letter ? `${letter}^{${exp}}` : `^{${exp}}`;
      });
      return `$${base}^{${converted}}$`;
    }
  );

  // Unicode superscripts standalone
  result = result.replace(
    /([a-zA-Z])([²³⁴⁵⁶⁷⁸⁹⁰¹]+)/g,
    (match, base, sups) => {
      const exp = sups.split('').map((s: string) => superscriptMap[s] || s).join('');
      return `$${base}^{${exp}}$`;
    }
  );

  // Pattern 3: Square roots
  result = result.replace(/(\d+)\/√\(([^)]+)\)/g, (match, num, content) => {
    return `$\\frac{${num}}{\\sqrt{${content}}}$`;
  });
  result = result.replace(/√\(([^)]+)\)/g, (match, content) => `$\\sqrt{${content}}$`);

  // Pattern 4: Unicode math symbols
  const symbolMap: Record<string, string> = {
    '≠': '\\neq',
    '≤': '\\leq',
    '≥': '\\geq',
    '±': '\\pm',
    '∞': '\\infty',
    '∆': '\\Delta',
    '→': '\\to',
    '⇒': '\\Rightarrow',
    '½': '\\frac{1}{2}',
    '¼': '\\frac{1}{4}',
    '¾': '\\frac{3}{4}',
  };

  for (const [unicode, latex] of Object.entries(symbolMap)) {
    if (result.includes(unicode)) {
      result = result.replace(new RegExp(unicode, 'g'), `$${latex}$`);
    }
  }

  // Pattern 5: Simple fractions (careful not to match URLs)
  result = result.replace(
    /(?<=\s|^|\()([a-zA-Z0-9]+)\/(\([^)]+\)|[a-zA-Z0-9]+)(?=\s|$|\)|,|\.)/g,
    (match, num, den) => {
      if (/^(and|or|n|w)$/i.test(num)) return match;
      return `$\\frac{${num}}{${den}}$`;
    }
  );

  return result;
}

/**
 * Pre-process content to auto-wrap math patterns in plain text segments.
 */
function autoWrapMathPatterns(content: string): string {
  if (!content.includes('$')) {
    return autoWrapMathInPlainText(content);
  }

  const mathPattern = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;
  const parts = content.split(mathPattern);

  return parts.map(part => {
    if ((part.startsWith('$$') && part.endsWith('$$')) ||
        (part.startsWith('$') && part.endsWith('$') && part.length > 2)) {
      return part;
    }
    return autoWrapMathInPlainText(part);
  }).join('');
}

/**
 * Process LaTeX content and render math expressions.
 * Supports: $...$ (inline) and $$...$$ (display/block)
 */
function processLatex(content: string): string {
  if (!content) return '<span class="text-muted-foreground italic">No content</span>';

  // Auto-detect and wrap math patterns
  content = autoWrapMathPatterns(content);

  // No math delimiters - return as plain text
  if (!content.includes('$')) {
    return escapeHtml(content).replace(/\n/g, '<br>');
  }

  // Split by math delimiters
  const mathPattern = /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g;
  const parts = content.split(mathPattern);

  const renderedParts = parts.map(part => {
    // Display math: $$...$$
    if (part.startsWith('$$') && part.endsWith('$$')) {
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

    // Inline math: $...$
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
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
