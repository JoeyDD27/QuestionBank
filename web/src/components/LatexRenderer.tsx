"use client";

import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";

interface LatexRendererProps {
  content: string;
  className?: string;
}

export default function LatexRenderer({ content, className = "" }: LatexRendererProps) {
  if (!content) return null;

  // Split content by LaTeX delimiters and render
  const parts: React.ReactNode[] = [];
  let remaining = content;
  let key = 0;

  // Process block math first ($$...$$)
  while (remaining.length > 0) {
    const blockMatch = remaining.match(/\$\$([\s\S]*?)\$\$/);
    const inlineMatch = remaining.match(/\$([^\$\n]+?)\$/);

    if (blockMatch && (!inlineMatch || blockMatch.index! <= inlineMatch.index!)) {
      // Add text before
      if (blockMatch.index! > 0) {
        parts.push(
          <span key={key++} className="whitespace-pre-wrap">
            {remaining.slice(0, blockMatch.index)}
          </span>
        );
      }
      // Add block math
      try {
        parts.push(
          <div key={key++} className="my-2 overflow-x-auto">
            <BlockMath math={blockMatch[1].trim()} />
          </div>
        );
      } catch {
        parts.push(
          <code key={key++} className="text-red-500">
            {blockMatch[0]}
          </code>
        );
      }
      remaining = remaining.slice(blockMatch.index! + blockMatch[0].length);
    } else if (inlineMatch) {
      // Add text before
      if (inlineMatch.index! > 0) {
        parts.push(
          <span key={key++} className="whitespace-pre-wrap">
            {remaining.slice(0, inlineMatch.index)}
          </span>
        );
      }
      // Add inline math
      try {
        parts.push(<InlineMath key={key++} math={inlineMatch[1]} />);
      } catch {
        parts.push(
          <code key={key++} className="text-red-500">
            {inlineMatch[0]}
          </code>
        );
      }
      remaining = remaining.slice(inlineMatch.index! + inlineMatch[0].length);
    } else {
      // No more math, add remaining text
      parts.push(
        <span key={key++} className="whitespace-pre-wrap">
          {remaining}
        </span>
      );
      break;
    }
  }

  return <div className={className}>{parts}</div>;
}
