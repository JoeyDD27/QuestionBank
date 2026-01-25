import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, ImageRun, convertInchesToTwip } from 'docx';
import { saveAs } from 'file-saver';
import { WorksheetQuestion } from '@/context/WorksheetContext';
import { getSourceImageUrls } from '@/lib/supabase';
import { hasFigureMarkers, parseFigureSegments } from '@/components/ContentWithFigures';

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Basic',
  2: 'Easy',
  3: 'Medium',
  4: 'Hard',
  5: 'Competition',
};

// Remove "Solutions:" section and everything after it
function removeSolutionsSection(content: string): string {
  const solutionPattern = /^\s*(Solutions?|Answers?|Worked\s+solutions?):\s*$/im;
  const lines = content.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (solutionPattern.test(line)) {
      break;
    }
    result.push(line);
  }

  return result.join('\n').trim();
}

// Fetch image as ArrayBuffer for Word embedding
async function fetchImageAsBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch (e) {
    console.error('Failed to fetch image:', url, e);
    return null;
  }
}

// Get image dimensions (returns reasonable defaults if can't be determined)
async function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Scale to max width of 5 inches while preserving aspect ratio
      const maxWidthInches = 5;
      let width = img.width;
      let height = img.height;

      // Assuming 96 DPI for web images
      const widthInches = width / 96;
      if (widthInches > maxWidthInches) {
        const scale = maxWidthInches / widthInches;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      resolve({ width, height });
    };
    img.onerror = () => {
      resolve({ width: 400, height: 300 }); // Default dimensions
    };
    img.src = url;
  });
}

// Convert LaTeX markers to plain text for Word
function cleanLatex(text: string): string {
  return text
    .replace(/[｢｣]/g, '') // Remove custom math markers
    .replace(/\$([^$]+)\$/g, '$1') // Remove inline math markers
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)') // Convert fractions
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)') // Convert square roots
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\infty/g, '∞')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\sum/g, 'Σ')
    .replace(/\\int/g, '∫')
    .replace(/\^(\{[^}]+\}|\d)/g, (_, exp) => `^${exp.replace(/[{}]/g, '')}`)
    .replace(/_(\{[^}]+\}|\d)/g, (_, sub) => `_${sub.replace(/[{}]/g, '')}`)
    .replace(/\\[a-zA-Z]+/g, '') // Remove remaining LaTeX commands
    .replace(/[{}]/g, '') // Remove remaining braces
    .trim();
}

// Image data type for caching
interface ImageData {
  buffer: ArrayBuffer;
  width: number;
  height: number;
}

export async function exportToWord(
  questions: WorksheetQuestion[],
  mode: 'questions' | 'answers',
  title: string,
  showDifficulty: boolean = false,
  hideSolutions: boolean = false
): Promise<void> {
  const children: Paragraph[] = [];

  // Pre-fetch all images needed
  const imageCache: Record<string, ImageData> = {};
  // Map question ID → source image URLs (for inline figures and original image mode)
  const sourceImageUrlMap: Record<string, string[]> = {};

  // Collect all image URLs that need to be fetched
  const urlsToFetch: string[] = [];

  for (const q of questions) {
    // Source images (if useOriginalImage or inline figure markers)
    const needsSourceImages = (q.useOriginalImage || hasFigureMarkers(q.problem_latex))
      && q.sourceImageIds && q.sourceImageIds.length > 0;
    if (needsSourceImages) {
      const sourceUrls = await getSourceImageUrls(q.sourceImageIds!);
      sourceImageUrlMap[q.id] = sourceUrls;
      urlsToFetch.push(...sourceUrls);
    }
    // Figure images
    if (q.figureUrls) {
      urlsToFetch.push(...q.figureUrls);
    }
  }

  // Fetch all images in parallel
  await Promise.all(
    urlsToFetch.map(async (url) => {
      if (imageCache[url]) return;
      const buffer = await fetchImageAsBuffer(url);
      if (buffer) {
        const dimensions = await getImageDimensions(url);
        imageCache[url] = { buffer, ...dimensions };
      }
    })
  );

  // Title
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      alignment: 'center',
      spacing: { after: 200 },
    })
  );

  // Subtitle for answers
  if (mode === 'answers') {
    children.push(
      new Paragraph({
        text: 'Answer Key',
        alignment: 'center',
        spacing: { after: 400 },
        children: [
          new TextRun({
            text: 'Answer Key',
            color: '666666',
            size: 24,
          }),
        ],
      })
    );
  }

  // Name and Date line for questions
  if (mode === 'questions') {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Name: _______________________', size: 22 }),
          new TextRun({ text: '          Date: _____________', size: 22 }),
        ],
        spacing: { after: 400 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        },
      })
    );
  }

  // Questions (using for...of to support async operations)
  for (let idx = 0; idx < questions.length; idx++) {
    const q = questions[idx];

    // Check if we should use original images
    const useOriginalImages = q.useOriginalImage && q.sourceImageIds && q.sourceImageIds.length > 0;
    const sourceImageUrls = sourceImageUrlMap[q.id] || [];

    // Question number
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({ text: `${idx + 1}. `, bold: true }),
        ],
      })
    );

    // If using original images, show images instead of text
    if (useOriginalImages && sourceImageUrls.length > 0) {
      for (const url of sourceImageUrls) {
        const imgData = imageCache[url];
        if (imgData) {
          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: imgData.buffer,
                  transformation: {
                    width: imgData.width,
                    height: imgData.height,
                  },
                  type: 'jpg',
                }),
              ],
              spacing: { after: 100 },
            })
          );
        }
      }
    } else {
      // Regular text content
      const contentToExport = hideSolutions
        ? removeSolutionsSection(q.problem_latex)
        : q.problem_latex;

      const hasInlineFigs = hasFigureMarkers(contentToExport);
      // For inline figures: prefer uploaded figures (cropped), fall back to source images
      const inlineFigUrls = (q.figureUrls && q.figureUrls.length > 0) ? q.figureUrls : sourceImageUrls;

      if (hasInlineFigs && inlineFigUrls.length > 0) {
        // Inline figure mode: interleave text and images
        const segments = parseFigureSegments(contentToExport);
        let isFirst = true;

        for (const seg of segments) {
          if (seg.type === 'text') {
            const lines = cleanLatex(seg.value).split('\n').filter(l => l.trim());
            for (const line of lines) {
              const difficultyText = isFirst && showDifficulty && q.metadata?.difficulty
                ? ` [${DIFFICULTY_LABELS[q.metadata.difficulty]}]`
                : '';
              children.push(
                new Paragraph({
                  spacing: { after: isFirst ? 100 : 50 },
                  children: [
                    new TextRun({ text: isFirst ? line : `    ${line}` }),
                    difficultyText ? new TextRun({ text: difficultyText, color: '999999', size: 20 }) : new TextRun({ text: '' }),
                  ],
                })
              );
              isFirst = false;
            }
          } else {
            // Figure segment
            const figIdx = seg.figureIndex ?? 0;
            const url = inlineFigUrls[figIdx];
            if (url) {
              const imgData = imageCache[url];
              if (imgData) {
                children.push(
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: imgData.buffer,
                        transformation: {
                          width: Math.min(imgData.width, 400),
                          height: Math.round(imgData.height * Math.min(1, 400 / imgData.width)),
                        },
                        type: 'jpg',
                      }),
                    ],
                    spacing: { after: 100 },
                  })
                );
              }
            }
          }
        }
      } else {
        // Standard text-only rendering
        const questionLines = cleanLatex(contentToExport).split('\n').filter(line => line.trim());

        // First line
        const firstLine = questionLines[0] || '';
        const difficultyText = showDifficulty && q.metadata?.difficulty
          ? ` [${DIFFICULTY_LABELS[q.metadata.difficulty]}]`
          : '';

        children.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: firstLine }),
              difficultyText ? new TextRun({ text: difficultyText, color: '999999', size: 20 }) : new TextRun({ text: '' }),
            ],
          })
        );

        // Remaining lines
        questionLines.slice(1).forEach(line => {
          children.push(
            new Paragraph({
              text: `    ${line}`,
              spacing: { after: 50 },
            })
          );
        });
      }
    }

    // Figure images — skip when rendered inline via markers
    const contentForCheck = hideSolutions
      ? removeSolutionsSection(q.problem_latex)
      : q.problem_latex;
    if (q.figureUrls && q.figureUrls.length > 0 && !hasFigureMarkers(contentForCheck)) {
      for (const url of q.figureUrls) {
        const imgData = imageCache[url];
        if (imgData) {
          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: imgData.buffer,
                  transformation: {
                    width: Math.min(imgData.width, 400),
                    height: Math.round(imgData.height * Math.min(1, 400 / imgData.width)),
                  },
                  type: 'jpg',
                }),
              ],
              spacing: { after: 100 },
            })
          );
        }
      }
    }

    // Answer (only in answers mode)
    if (mode === 'answers') {
      if (q.answer_latex) {
        const answerLines = cleanLatex(q.answer_latex).split('\n').filter(line => line.trim());
        answerLines.forEach((line, lineIdx) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: lineIdx === 0 ? `    Answer: ${line}` : `    ${line}`,
                  color: '047857',
                }),
              ],
              spacing: { after: 50 },
            })
          );
        });
      } else {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '    （答案未录入）',
                color: '999999',
                italics: true,
              }),
            ],
            spacing: { after: 50 },
          })
        );
      }
    }

    // Space for answer (questions mode)
    if (mode === 'questions') {
      children.push(
        new Paragraph({
          text: '',
          spacing: { after: 300 },
          border: {
            bottom: { style: BorderStyle.DASHED, size: 1, color: 'DDDDDD' },
          },
        })
      );
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 720,  // 0.5 inch
            right: 720,
            bottom: 720,
            left: 720,
          },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${mode}.docx`;
  saveAs(blob, filename);
}
