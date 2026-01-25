/**
 * Parse document.xml to find sub-chapter titles and their associated images
 *
 * This script:
 * 1. Reads document.xml and document.xml.rels
 * 2. Finds all text content and image references in order
 * 3. Maps images to sub-chapters based on document structure
 *
 * Run: node scripts/parse-doc-structure.cjs
 */

const fs = require('fs');
const path = require('path');

const docPath = path.join(__dirname, '../docx_extracted/word/document.xml');
const relsPath = path.join(__dirname, '../docx_extracted/word/_rels/document.xml.rels');

// Chapter 01 sub-chapter titles (as they appear in the Word doc)
// Order matters - we'll match in order of appearance
const ch01SubChapters = [
  'Unit 1 expression',
  'Key words in algebra',
  'Changing words to symbols',
  'Generalizing arithmetic',
  'Algebraic substitutions',
  'Algebraic products and quotients in index notation',
  'Significant figures',
  'Scientific notation',
  'Negative bases',
  'Index laws',
  'Square roots',
  'Rules for square roots',  // might appear as "Rules for square" in doc
  'More exercise',
];

// Build rId -> image mapping
function buildImageMap() {
  const xml = fs.readFileSync(relsPath, 'utf-8');
  const pattern = /Id="(rId\d+)"[^>]*Target="media\/(image\d+\.png)"/g;
  const map = new Map();
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    map.set(match[1], match[2]);
  }
  return map;
}

// Parse document.xml to find elements in order
function parseDocument() {
  const xml = fs.readFileSync(docPath, 'utf-8');

  // We need to find the order of:
  // 1. Text that matches sub-chapter titles
  // 2. Image references (r:embed="rIdN")

  const elements = [];

  // Split by paragraphs to maintain rough order
  // In Word XML, <w:p> is a paragraph
  const paragraphs = xml.split(/<w:p[^>]*>/);

  let currentPosition = 0;

  for (const para of paragraphs) {
    // Extract all text from this paragraph
    const textMatches = para.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    let paraText = '';
    for (const m of textMatches) {
      paraText += m[1];
    }
    paraText = paraText.trim();

    // Check if this text matches any sub-chapter title
    for (const title of ch01SubChapters) {
      // Handle partial matches (e.g., "Rules for square" matches "Rules for square roots")
      const normalizedTitle = title.toLowerCase();
      const normalizedPara = paraText.toLowerCase();
      if (normalizedPara === normalizedTitle ||
          normalizedPara.includes(normalizedTitle) ||
          (normalizedTitle.includes('rules for square') && normalizedPara.includes('rules for square'))) {
        elements.push({
          type: 'subchapter',
          title: title,
          position: currentPosition,
          rawText: paraText
        });
        break;
      }
    }

    // Find image references in this paragraph
    const imageMatches = para.matchAll(/r:embed="(rId\d+)"/g);
    for (const m of imageMatches) {
      elements.push({
        type: 'image',
        rId: m[1],
        position: currentPosition
      });
    }

    currentPosition++;
  }

  return elements;
}

// Main
const imageMap = buildImageMap();
console.log(`Loaded ${imageMap.size} image mappings\n`);

const elements = parseDocument();
console.log(`Found ${elements.length} elements (sub-chapters + images)\n`);

// Count elements by type
const subChapterElements = elements.filter(e => e.type === 'subchapter');
const imageElements = elements.filter(e => e.type === 'image');

console.log(`Sub-chapters found: ${subChapterElements.length}`);
console.log(`Image references found: ${imageElements.length}\n`);

// Print found sub-chapters
console.log('--- Sub-chapters found in document order ---');
subChapterElements.forEach((e, i) => {
  console.log(`${i + 1}. "${e.title}" (position: ${e.position})`);
});

// Now map images to sub-chapters
// For each sub-chapter, find images that appear after it and before the next sub-chapter
console.log('\n--- Image ranges by sub-chapter ---');

let currentSubChapter = null;
let currentImages = [];
const subChapterImageRanges = [];

for (const element of elements) {
  if (element.type === 'subchapter') {
    // Save previous sub-chapter's images
    if (currentSubChapter && currentImages.length > 0) {
      const imageNumbers = currentImages.map(rId => {
        const filename = imageMap.get(rId);
        if (filename) {
          const match = filename.match(/image(\d+)\.png/);
          return match ? parseInt(match[1]) : null;
        }
        return null;
      }).filter(n => n !== null);

      if (imageNumbers.length > 0) {
        subChapterImageRanges.push({
          title: currentSubChapter,
          start: Math.min(...imageNumbers),
          end: Math.max(...imageNumbers),
          count: imageNumbers.length
        });
      }
    }

    currentSubChapter = element.title;
    currentImages = [];
  } else if (element.type === 'image') {
    currentImages.push(element.rId);
  }
}

// Don't forget the last sub-chapter
if (currentSubChapter && currentImages.length > 0) {
  const imageNumbers = currentImages.map(rId => {
    const filename = imageMap.get(rId);
    if (filename) {
      const match = filename.match(/image(\d+)\.png/);
      return match ? parseInt(match[1]) : null;
    }
    return null;
  }).filter(n => n !== null);

  if (imageNumbers.length > 0) {
    subChapterImageRanges.push({
      title: currentSubChapter,
      start: Math.min(...imageNumbers),
      end: Math.max(...imageNumbers),
      count: imageNumbers.length
    });
  }
}

// Print results
subChapterImageRanges.forEach((range, i) => {
  console.log(`${i + 1}. ${range.title}: images ${range.start}-${range.end} (${range.count} images)`);
});

// Filter to only Chapter 01 range (images 1-194)
console.log('\n--- Chapter 01 sub-chapters (images 1-194) ---');
const ch01Ranges = subChapterImageRanges.filter(r => r.start <= 194);
ch01Ranges.forEach((range, i) => {
  const endInCh01 = Math.min(range.end, 194);
  console.log(`${i + 1}. ${range.title}: images ${range.start}-${endInCh01}`);
});

// Generate JSON config
console.log('\n--- Generated JSON config ---');
const config = {
  ch01: {
    title: 'Algebra',
    start: 1,
    end: 194,
    subChapters: ch01Ranges.map((range, i) => ({
      title: range.title,
      start: range.start,
      end: Math.min(range.end, 194),
      order: i + 1
    }))
  }
};
console.log(JSON.stringify(config, null, 2));
