'use client';

import { MathRenderer } from './MathRenderer';

/** Check if content contains any [FIGURE:N] markers */
export function hasFigureMarkers(content: string): boolean {
  return /\[FIGURE:\d+\]/.test(content);
}

interface ContentSegment {
  type: 'text' | 'figure';
  /** For text: the content string. For figure: the index N from [FIGURE:N] */
  value: string;
  figureIndex?: number;
}

/** Split content_latex into interleaved text and figure segments */
export function parseFigureSegments(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const re = /\[FIGURE:(\d+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    // Text before this marker
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'figure', value: match[0], figureIndex: parseInt(match[1], 10) });
    lastIndex = re.lastIndex;
  }

  // Trailing text
  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return segments;
}

interface ContentWithFiguresProps {
  content: string;
  figureUrls: string[];
  /** Extra CSS class for figure images */
  imgClassName?: string;
  /** If provided, called when a figure image is clicked */
  onImageClick?: (url: string) => void;
}

/**
 * Renders content_latex with [FIGURE:N] markers replaced by inline images.
 * Returns null if content has no markers — caller should fall back to original rendering.
 */
export function ContentWithFigures({ content, figureUrls, imgClassName, onImageClick }: ContentWithFiguresProps) {
  if (!hasFigureMarkers(content)) return null;

  const segments = parseFigureSegments(content);

  return (
    <div>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          const trimmed = seg.value.trim();
          if (!trimmed) return null;
          return (
            <div key={i} className="mb-1">
              <MathRenderer content={trimmed} />
            </div>
          );
        }

        // Figure segment
        const idx = seg.figureIndex ?? 0;
        const url = figureUrls[idx];
        if (!url) return null; // missing figure — skip silently

        return (
          <div key={i} className="my-2">
            <img
              src={url}
              alt={`Figure ${idx + 1}`}
              className={imgClassName || 'max-w-md w-auto'}
              style={{ cursor: onImageClick ? 'pointer' : undefined }}
              onClick={onImageClick ? () => onImageClick(url) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
