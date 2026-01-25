'use client';

import { useState, useEffect } from 'react';
import { WorksheetQuestion } from '@/context/WorksheetContext';
import { MathRenderer } from './MathRenderer';
import { ContentWithFigures, hasFigureMarkers } from './ContentWithFigures';
import { getSourceImageUrls } from '@/lib/supabase';

interface WorksheetPrintViewProps {
  questions: WorksheetQuestion[];
  mode: 'questions' | 'answers';
  compactLayout?: boolean;
  hideSolutions?: boolean;
}

// Cache for source image URLs
type SourceImageCache = Record<string, string[]>;

// Parsed item can be a sub-item like (a) or a section header like "2. Simplify:"
interface ParsedItem {
  type: 'stem' | 'subitem' | 'section-header';
  content: string;
}

// Remove "Solutions:" section and everything after it
function removeSolutionsSection(content: string): string {
  const solutionPattern = /^\s*(Solutions?|Answers?|Worked\s+solutions?):\s*$/im;
  const lines = content.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (solutionPattern.test(line)) {
      break; // Stop at Solutions header
    }
    result.push(line);
  }

  return result.join('\n').trim();
}

// Parse content to extract stem, sub-items like (a)(b)(c), and section headers like "2. Simplify:" or "Solutions:"
function parseContent(content: string): ParsedItem[] {
  const lines = content.split('\n');
  const subItemPattern = /^\s*\(([a-z])\)\s*/i;
  const numberedHeaderPattern = /^\s*\d+\.\s+\S/; // e.g., "2. Simplify:"
  const labelHeaderPattern = /^\s*(Solutions?|Answers?|Worked\s+solutions?):\s*$/i; // e.g., "Solutions:", "Answer:"

  const result: ParsedItem[] = [];
  let currentItem: { type: ParsedItem['type']; lines: string[] } | null = null;

  const flushCurrent = () => {
    if (currentItem && currentItem.lines.length > 0) {
      result.push({
        type: currentItem.type,
        content: currentItem.lines.join('\n').trim()
      });
    }
    currentItem = null;
  };

  for (const line of lines) {
    const isSubItem = subItemPattern.test(line);
    const isNumberedHeader = numberedHeaderPattern.test(line);
    const isLabelHeader = labelHeaderPattern.test(line);
    const isSectionHeader = isNumberedHeader || isLabelHeader;

    if (isSubItem) {
      flushCurrent();
      currentItem = { type: 'subitem', lines: [line] };
    } else if (isSectionHeader && result.length > 0) {
      // Only treat as section header if we already have some content (not the first line)
      flushCurrent();
      currentItem = { type: 'section-header', lines: [line] };
    } else if (currentItem) {
      currentItem.lines.push(line);
    } else {
      // Start as stem
      currentItem = { type: 'stem', lines: [line] };
    }
  }

  flushCurrent();
  return result;
}

// Legacy function for non-compact mode and answer parsing
function parseSubItems(content: string): { stem: string; subItems: string[] } {
  const items = parseContent(content);
  const stemParts = items.filter(i => i.type === 'stem' || i.type === 'section-header');
  const subItems = items.filter(i => i.type === 'subitem').map(i => i.content);

  return {
    stem: stemParts.map(i => i.content).join('\n'),
    subItems
  };
}

// Parse answer content to match sub-items
function parseAnswerSubItems(content: string): string[] {
  const lines = content.split('\n');
  const subItemPattern = /^\s*\(([a-z])\)\s*/i;

  let subItems: string[] = [];
  let currentSubItem: string[] = [];

  for (const line of lines) {
    const match = line.match(subItemPattern);
    if (match) {
      if (currentSubItem.length > 0) {
        subItems.push(currentSubItem.join('\n'));
      }
      currentSubItem = [line];
    } else {
      currentSubItem.push(line);
    }
  }

  if (currentSubItem.length > 0) {
    subItems.push(currentSubItem.join('\n'));
  }

  return subItems;
}

export function WorksheetPrintView({
  questions,
  mode,
  compactLayout = false,
  hideSolutions = false,
}: WorksheetPrintViewProps) {
  const [sourceImageCache, setSourceImageCache] = useState<SourceImageCache>({});
  const [loadingImages, setLoadingImages] = useState(true);

  // Fetch source images for questions that need them (original image mode or inline figures)
  useEffect(() => {
    const fetchSourceImages = async () => {
      const questionsNeedingImages = questions.filter(
        q => q.sourceImageIds && q.sourceImageIds.length > 0 && (
          q.useOriginalImage || hasFigureMarkers(q.problem_latex)
        )
      );

      if (questionsNeedingImages.length === 0) {
        setLoadingImages(false);
        return;
      }

      const cache: SourceImageCache = {};
      await Promise.all(
        questionsNeedingImages.map(async (q) => {
          if (q.sourceImageIds) {
            const urls = await getSourceImageUrls(q.sourceImageIds);
            cache[q.id] = urls;
          }
        })
      );

      setSourceImageCache(cache);
      setLoadingImages(false);
    };

    fetchSourceImages();
  }, [questions]);

  // Show loading only if we have questions needing source images
  const hasQuestionsNeedingImages = questions.some(
    q => q.sourceImageIds && q.sourceImageIds.length > 0 && (
      q.useOriginalImage || hasFigureMarkers(q.problem_latex)
    )
  );
  if (loadingImages && hasQuestionsNeedingImages) {
    return <div className="text-center py-4 text-gray-500">加载图片中...</div>;
  }

  return (
    <div className="print-view text-sm">

      {/* Questions/Answers */}
      <div className="space-y-3">
        {questions.map((q, idx) => {
          const sourceImageUrls = sourceImageCache[q.id] || [];
          // Filter out Solutions section when hideSolutions is enabled
          const contentToShow = hideSolutions
            ? removeSolutionsSection(q.problem_latex)
            : q.problem_latex;
          const parsedItems = parseContent(contentToShow);
          const hasSubItems = parsedItems.filter(i => i.type === 'subitem').length > 1;
          const answerSubItems = q.answer_latex ? parseAnswerSubItems(q.answer_latex) : [];

          // For compact mode, track sub-item index for answer matching
          let subItemIndex = 0;

          // Check if we should show original images instead of LaTeX
          const showOriginalImages = q.useOriginalImage && sourceImageUrls.length > 0;
          // Check for inline figure markers
          const hasInlineFigs = hasFigureMarkers(contentToShow);

          return (
            <div key={q.id} className="question-item">
              {/* Question number */}
              <div className="flex items-start gap-2">
                <span className="font-semibold text-gray-700 shrink-0">{idx + 1}.</span>
                <div className="flex-1 min-w-0">

                  {/* Original image mode: show source images instead of LaTeX */}
                  {showOriginalImages ? (
                    <div className="space-y-2">
                      {sourceImageUrls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`Question ${idx + 1} - Image ${i + 1}`}
                          className="max-w-full"
                        />
                      ))}
                      {/* Answer (only in answers mode) */}
                      {mode === 'answers' && (
                        q.answer_latex ? (
                          <div className="mt-1 pl-2 border-l-2 border-emerald-300 text-emerald-800">
                            <MathRenderer content={q.answer_latex} />
                          </div>
                        ) : (
                          <div className="mt-1 pl-2 border-l-2 border-gray-300 text-gray-400 italic text-xs">
                            （答案未录入）
                          </div>
                        )
                      )}
                    </div>
                  ) : hasInlineFigs ? (
                    /* Inline figure mode: [FIGURE:N] markers in content */
                    <div>
                      <ContentWithFigures
                        content={contentToShow}
                        figureUrls={(q.figureUrls && q.figureUrls.length > 0) ? q.figureUrls : sourceImageUrls}
                        imgClassName="max-w-[60%] w-auto"
                      />
                      {/* Answer */}
                      {mode === 'answers' && (
                        q.answer_latex ? (
                          <div className="mt-1 pl-2 border-l-2 border-emerald-300 text-emerald-800">
                            <MathRenderer content={q.answer_latex} />
                          </div>
                        ) : (
                          <div className="mt-1 pl-2 border-l-2 border-gray-300 text-gray-400 italic text-xs">
                            （答案未录入）
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Compact mode with sub-items: use grid with full-width headers */}
                      {hasSubItems && compactLayout ? (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {parsedItems.map((item, i) => {
                            if (item.type === 'stem' || item.type === 'section-header') {
                              // Stem and section headers span full width
                              return (
                                <div key={i} className="col-span-2 text-gray-800 mb-1">
                                  <MathRenderer content={item.content} />
                                </div>
                              );
                            } else {
                              // Sub-items in grid
                              const currentSubItemIndex = subItemIndex++;
                              return (
                                <div key={i} className="text-gray-800">
                                  <MathRenderer content={item.content} />
                                  {/* Inline answer for this sub-item in answers mode */}
                                  {mode === 'answers' && answerSubItems[currentSubItemIndex] && (
                                    <div className="mt-0.5 pl-2 border-l-2 border-emerald-300 text-emerald-800 text-xs">
                                      <MathRenderer content={answerSubItems[currentSubItemIndex]} />
                                    </div>
                                  )}
                                </div>
                              );
                            }
                          })}
                        </div>
                      ) : (
                        /* Regular single-column layout */
                        <>
                          {parsedItems.map((item, i) => (
                            <div key={i} className="text-gray-800 mb-1">
                              <MathRenderer content={item.content} />
                            </div>
                          ))}

                          {/* Answer (only in answers mode, non-compact) */}
                          {mode === 'answers' && (
                            q.answer_latex ? (
                              <div className="mt-1 pl-2 border-l-2 border-emerald-300 text-emerald-800">
                                <MathRenderer content={q.answer_latex} />
                              </div>
                            ) : (
                              <div className="mt-1 pl-2 border-l-2 border-gray-300 text-gray-400 italic text-xs">
                                （答案未录入）
                              </div>
                            )
                          )}
                        </>
                      )}

                      {/* Answer in compact mode when no sub-items parsed correctly */}
                      {compactLayout && hasSubItems && mode === 'answers' && answerSubItems.length === 0 && q.answer_latex && (
                        <div className="mt-1 pl-2 border-l-2 border-emerald-300 text-emerald-800">
                          <MathRenderer content={q.answer_latex} />
                        </div>
                      )}

                      {/* No answer message in compact mode */}
                      {compactLayout && hasSubItems && mode === 'answers' && !q.answer_latex && (
                        <div className="mt-1 pl-2 border-l-2 border-gray-300 text-gray-400 italic text-xs">
                          （答案未录入）
                        </div>
                      )}
                    </>
                  )}

                  {/* Figure images — hidden when rendered inline via markers */}
                  {q.figureUrls && q.figureUrls.length > 0 && !hasInlineFigs && (
                    <div className="mt-2 space-y-2">
                      {q.figureUrls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`Figure ${i + 1}`}
                          className="max-w-[60%]"
                        />
                      ))}
                    </div>
                  )}

                  {/* Space for answer (only in questions mode) */}
                  {mode === 'questions' && (
                    <div className={`border-b border-dashed border-gray-200 ${compactLayout ? 'mt-1 pb-1' : 'mt-2 pb-2'}`} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
