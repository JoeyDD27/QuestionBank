#!/usr/bin/env node
/**
 * Import chapter data into Supabase
 *
 * Usage:
 *   node scripts/import-chapter.cjs --ch=N [options]
 *
 * Options:
 *   --ch=N          Chapter number (required)
 *   --clear         Clear existing data before import
 *   --images-only   Only upload images to Storage
 *   --data-only     Only import data (images already exist)
 *   --dry-run       Preview mode, no actual writes
 *
 * Reads SUPABASE_ANON_KEY from .env file or environment variable
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

// Load .env file
function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://orfxntmcywouoqpasivm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_ANON_KEY. Set it in .env file or environment variable.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const EXTRACTIONS_DIR = path.join(PROJECT_ROOT, 'extractions');
const IMAGES_DIR = path.join(PROJECT_ROOT, 'docx_extracted', 'word', 'media_compressed');
const STORAGE_BUCKET = 'question-images';
const STORAGE_PATH = 'algebra';

/**
 * Convert LaTeX math delimiters from $...$ to ｢...｣
 * This avoids conflicts with currency symbols like $30,000
 *
 * Important: Must handle \$ (escaped dollar sign in LaTeX) correctly.
 * \$ should NOT be treated as a delimiter.
 */
function convertMathDelimiters(text) {
  if (!text) return text;

  // Temporarily replace \$ with a placeholder
  const placeholder = '\x00ESCAPED_DOLLAR\x00';
  let result = text.replace(/\\\$/g, placeholder);

  // Convert $...$ to ｢...｣
  result = result.replace(/\$([^$]+)\$/g, '｢$1｣');

  // Restore \$
  result = result.replace(new RegExp(placeholder, 'g'), '\\$');

  return result;
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    chapter: null,
    clear: false,
    imagesOnly: false,
    dataOnly: false,
    dryRun: false
  };

  for (const arg of args) {
    if (arg.startsWith('--ch=')) {
      result.chapter = parseInt(arg.replace('--ch=', ''), 10);
    } else if (arg === '--clear') {
      result.clear = true;
    } else if (arg === '--images-only') {
      result.imagesOnly = true;
    } else if (arg === '--data-only') {
      result.dataOnly = true;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    }
  }

  return result;
}

// Load chapter ranges
function loadChapterRanges() {
  const rangesPath = path.join(PROJECT_ROOT, 'chapter_image_ranges.json');
  return JSON.parse(fs.readFileSync(rangesPath, 'utf-8'));
}

// Get chapter info from ranges
function getChapterInfo(chapterNum) {
  const ranges = loadChapterRanges();
  const key = `ch${chapterNum.toString().padStart(2, '0')}`;
  return ranges[key] || null;
}

// Get chapter from database by order_index
async function getChapterFromDB(chapterNum) {
  const { data, error } = await supabase
    .from('chapters')
    .select('id, title, order_index')
    .eq('order_index', chapterNum)
    .single();

  if (error) return null;
  return data;
}

// Get image records for a chapter
async function getImageRecords(chapterId) {
  const { data, error } = await supabase
    .from('images')
    .select('id, filename')
    .eq('chapter_id', chapterId);

  if (error) {
    console.error('Failed to fetch images:', error.message);
    return {};
  }

  const map = {};
  for (const img of data || []) {
    map[img.filename] = img.id;
  }
  return map;
}

// Upload images to Storage
async function uploadImages(chapterNum, chapterInfo, dryRun = false) {
  const { start, end } = chapterInfo;
  console.log(`\nUploading images ${start}-${end} to Storage...`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = start; i <= end; i++) {
    const filename = `image${i}.png`;
    const localPath = path.join(IMAGES_DIR, filename);
    const storagePath = `${STORAGE_PATH}/${filename}`;

    if (!fs.existsSync(localPath)) {
      console.log(`  MISSING: ${filename}`);
      failed++;
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY RUN] Would upload: ${filename}`);
      uploaded++;
      continue;
    }

    const fileBuffer = fs.readFileSync(localPath);
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) {
      if (error.message.includes('already exists')) {
        skipped++;
      } else {
        console.log(`  FAILED: ${filename} - ${error.message}`);
        failed++;
      }
    } else {
      uploaded++;
    }
  }

  console.log(`  Uploaded: ${uploaded}, Skipped: ${skipped}, Failed: ${failed}`);
  return { uploaded, skipped, failed };
}

// Create image records in database
async function createImageRecords(chapterNum, chapterInfo, chapterId, dryRun = false) {
  const { start, end } = chapterInfo;
  console.log(`\nCreating image records in database...`);

  let created = 0;
  let existing = 0;

  for (let i = start; i <= end; i++) {
    const filename = `image${i}.png`;
    const storagePath = `${STORAGE_PATH}/${filename}`;

    if (dryRun) {
      console.log(`  [DRY RUN] Would create: ${filename}`);
      created++;
      continue;
    }

    // Check if already exists
    const { data: existingImg } = await supabase
      .from('images')
      .select('id')
      .eq('chapter_id', chapterId)
      .eq('filename', filename)
      .single();

    if (existingImg) {
      existing++;
      continue;
    }

    const { error } = await supabase.from('images').insert({
      chapter_id: chapterId,
      filename: filename,
      storage_path: storagePath,
      order_index: i - start + 1
    });

    if (error) {
      console.log(`  FAILED: ${filename} - ${error.message}`);
    } else {
      created++;
    }
  }

  console.log(`  Created: ${created}, Already existed: ${existing}`);
  return { created, existing };
}

// Clear existing data for a chapter
async function clearChapterData(chapterId, dryRun = false) {
  console.log(`\nClearing existing data...`);

  if (dryRun) {
    console.log('  [DRY RUN] Would clear items and questions');
    return;
  }

  // Get item IDs
  const { data: items } = await supabase
    .from('items')
    .select('id')
    .eq('chapter_id', chapterId);

  if (items && items.length > 0) {
    const itemIds = items.map(i => i.id);

    // Delete questions first (foreign key)
    await supabase.from('questions').delete().in('item_id', itemIds);

    // Delete items
    await supabase.from('items').delete().eq('chapter_id', chapterId);

    console.log(`  Cleared ${items.length} items and their questions`);
  } else {
    console.log('  No existing data to clear');
  }
}

// Import data from extraction files
async function importData(chapterNum, chapterId, imageMap, dryRun = false) {
  const chapterPrefix = `ch${chapterNum.toString().padStart(2, '0')}_`;
  const files = fs.readdirSync(EXTRACTIONS_DIR)
    .filter(f => f.startsWith(chapterPrefix) && f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    console.log(`\nNo extraction files found for ch${chapterNum.toString().padStart(2, '0')}`);
    return { items: 0, questions: 0 };
  }

  console.log(`\nImporting from ${files.length} extraction file(s)...`);

  let globalIndex = 0;
  let itemsInserted = 0;
  let questionsInserted = 0;
  let imagesLinked = 0;

  for (const file of files) {
    console.log(`\n  Processing ${file}`);
    const filePath = path.join(EXTRACTIONS_DIR, file);

    let content;
    try {
      content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      console.log(`    ERROR: JSON parse failed - ${e.message}`);
      continue;
    }

    if (!content.items || !Array.isArray(content.items)) {
      console.log(`    WARNING: No items array found`);
      continue;
    }

    console.log(`    Found ${content.items.length} items`);

    for (const item of content.items) {
      globalIndex++;

      // Get source_image_ids (support multiple images)
      const sourceImages = item.source_images || [];
      const sourceImageIds = sourceImages.map(img => imageMap[img]).filter(Boolean);
      const sourceImageId = sourceImageIds[0] || null; // Keep first for legacy field
      if (sourceImageIds.length > 0) imagesLinked++;

      if (dryRun) {
        itemsInserted++;
        if (item.content_latex) questionsInserted++;
        continue;
      }

      // Insert item
      const { data: dbItem, error: itemErr } = await supabase.from('items').insert({
        chapter_id: chapterId,
        type: item.type || 'concept',
        title: null,
        instruction: null,
        source_image_id: sourceImageId,
        source_image_ids: sourceImageIds,
        order_index: globalIndex
      }).select().single();

      if (itemErr) {
        console.log(`    Item error: ${itemErr.message}`);
        continue;
      }
      itemsInserted++;

      // Insert question
      if (item.content_latex) {
        const convertedLatex = convertMathDelimiters(item.content_latex);
        const { error: qErr } = await supabase.from('questions').insert({
          item_id: dbItem.id,
          source_image_id: sourceImageId,
          label: null,
          problem_latex: convertedLatex,
          problem_text: null,
          has_answer: false,
          answer_latex: null,
          solution_steps: null,
          choices: null
        });
        if (!qErr) questionsInserted++;
      }
    }
  }

  console.log(`\n  Items inserted: ${itemsInserted}`);
  console.log(`  Questions inserted: ${questionsInserted}`);
  console.log(`  Images linked: ${imagesLinked}`);

  return { items: itemsInserted, questions: questionsInserted, imagesLinked };
}

async function main() {
  const args = parseArgs();

  if (!args.chapter) {
    console.error('Usage: node scripts/import-chapter.cjs --ch=N [--clear] [--images-only] [--data-only] [--dry-run]');
    process.exit(1);
  }

  const chapterNum = args.chapter;
  const chapterPadded = chapterNum.toString().padStart(2, '0');

  console.log('='.repeat(50));
  console.log(`QuestionBank Chapter Import - ch${chapterPadded}`);
  console.log('='.repeat(50));

  if (args.dryRun) {
    console.log('MODE: DRY RUN (no actual writes)');
  }
  if (args.imagesOnly) {
    console.log('MODE: Images only');
  }
  if (args.dataOnly) {
    console.log('MODE: Data only');
  }
  if (args.clear) {
    console.log('MODE: Clear existing data first');
  }

  // Get chapter info from ranges
  const chapterInfo = getChapterInfo(chapterNum);
  if (!chapterInfo) {
    console.error(`Chapter ${chapterNum} not found in chapter_image_ranges.json`);
    process.exit(1);
  }

  console.log(`\nChapter: ${chapterInfo.title}`);
  console.log(`Images: ${chapterInfo.start} - ${chapterInfo.end} (${chapterInfo.end - chapterInfo.start + 1} images)`);

  // Get chapter from database
  const chapter = await getChapterFromDB(chapterNum);
  if (!chapter) {
    console.error(`Chapter ${chapterNum} not found in database`);
    process.exit(1);
  }

  console.log(`Database ID: ${chapter.id.slice(0, 8)}...`);

  // Clear existing data if requested
  if (args.clear && !args.imagesOnly) {
    await clearChapterData(chapter.id, args.dryRun);
  }

  // Upload images if not data-only
  if (!args.dataOnly) {
    await uploadImages(chapterNum, chapterInfo, args.dryRun);
    await createImageRecords(chapterNum, chapterInfo, chapter.id, args.dryRun);
  }

  // Import data if not images-only
  if (!args.imagesOnly) {
    const imageMap = await getImageRecords(chapter.id);
    console.log(`\nLoaded ${Object.keys(imageMap).length} image records`);
    await importData(chapterNum, chapter.id, imageMap, args.dryRun);
  }

  console.log('\n' + '='.repeat(50));
  console.log('COMPLETE');
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
