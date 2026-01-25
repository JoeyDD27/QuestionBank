/**
 * Extract table of contents (chapters and sub-chapters) from Word document
 *
 * Run: node scripts/extract-toc.cjs
 */

const fs = require('fs');
const path = require('path');

const documentPath = path.join(__dirname, '../docx_extracted/word/document.xml');
const outputPath = path.join(__dirname, '../sub_chapters.json');

// Read the document.xml file
const xmlContent = fs.readFileSync(documentPath, 'utf-8');

// Extract paragraphs with their styles
// Looking for TOC entries (toc 1, toc 2) or heading styles

// Pattern to match paragraph style references
const pStylePattern = /<w:pStyle w:val="([^"]+)"/g;
const textPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;

// Find all TOC entries
const tocEntries = [];

// Split by paragraphs
const paragraphs = xmlContent.split(/<w:p[^>]*>/);

for (const para of paragraphs) {
  // Check if this paragraph has a TOC or heading style
  const styleMatch = para.match(/<w:pStyle w:val="([^"]+)"/);
  if (!styleMatch) continue;

  const style = styleMatch[1];

  // TOC1 = main chapter (heading 1), TOC2 = sub-chapter (heading 2)
  // Also check for direct heading styles: "1", "2", "3", etc.
  let level = 0;
  if (style === 'TOC1' || style === '1') {
    level = 1;
  } else if (style === 'TOC2' || style === '2') {
    level = 2;
  } else if (style === 'TOC3' || style === '3') {
    level = 3;
  }

  if (level === 0) continue;

  // Extract all text content from this paragraph
  let textContent = '';
  let match;
  const textRe = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  while ((match = textRe.exec(para)) !== null) {
    textContent += match[1];
  }

  // Clean up the text - remove page numbers and dots
  textContent = textContent.trim()
    .replace(/\.{3,}\d+$/g, '') // Remove trailing dots and page numbers
    .replace(/\t\d+$/g, '') // Remove tab + page number
    .replace(/\d+$/g, '') // Remove trailing numbers
    .replace(/\.+$/g, '') // Remove trailing dots
    .trim();

  if (textContent && textContent.length > 2) {
    tocEntries.push({
      level,
      title: textContent
    });
  }
}

console.log(`Found ${tocEntries.length} TOC entries`);

// Check if we found TOC entries
if (tocEntries.length === 0) {
  console.log('\nNo TOC entries found. Let me try a different approach...');
  console.log('Looking for heading styles directly in document...\n');

  // Try to find text near TOC markers by looking at the raw content
  const sampleMatches = xmlContent.match(/<w:pStyle w:val="[^"]+"/g);
  if (sampleMatches) {
    const styleSet = new Set(sampleMatches);
    console.log('Styles found in document:');
    styleSet.forEach(s => console.log('  ', s));
  }
}

// Group into chapters
const chapters = [];
let currentChapter = null;

for (const entry of tocEntries) {
  if (entry.level === 1) {
    if (currentChapter) {
      chapters.push(currentChapter);
    }
    currentChapter = {
      title: entry.title,
      subChapters: []
    };
  } else if (entry.level === 2 && currentChapter) {
    currentChapter.subChapters.push(entry.title);
  }
}

if (currentChapter) {
  chapters.push(currentChapter);
}

console.log(`\nOrganized into ${chapters.length} main chapters:`);
chapters.forEach((ch, i) => {
  console.log(`\n${i + 1}. ${ch.title}`);
  ch.subChapters.forEach(sub => {
    console.log(`   - ${sub}`);
  });
});

// Save to JSON file
fs.writeFileSync(outputPath, JSON.stringify(chapters, null, 2));
console.log(`\nSaved to ${outputPath}`);
