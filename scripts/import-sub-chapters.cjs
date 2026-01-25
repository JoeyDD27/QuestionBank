/**
 * Import sub-chapter data to items table based on image ranges
 *
 * Run: node scripts/import-sub-chapters.cjs
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

const supabaseUrl = 'https://orfxntmcywouoqpasivm.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Missing SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Load sub_chapters config
const subChaptersPath = path.join(__dirname, '../sub_chapters.json');
const subChaptersConfig = JSON.parse(fs.readFileSync(subChaptersPath, 'utf-8'));

// Helper: get image number from filename like "image195.png"
function getImageNumber(filename) {
  const match = filename.match(/image(\d+)\.png/);
  return match ? parseInt(match[1], 10) : null;
}

// Helper: find sub-chapter for an image number
function findSubChapter(chapterKey, imageNum) {
  const chapter = subChaptersConfig[chapterKey];
  if (!chapter || !chapter.subChapters) return null;

  for (const sub of chapter.subChapters) {
    if (imageNum >= sub.start && imageNum <= sub.end) {
      return sub.title;
    }
  }
  return null;
}

// Fetch all records with pagination
async function fetchAll(table, select, orderBy = 'id') {
  const PAGE_SIZE = 1000;
  let allData = [];
  let page = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(orderBy)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allData = allData.concat(data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }

  return allData;
}

async function main() {
  console.log('Loading items with their images...\n');

  // Get all items with chapter info and source images (paginated)
  const items = await fetchAll('items', `
    id,
    chapter_id,
    source_image_id,
    source_image_ids,
    chapters!inner(order_index, title)
  `);

  console.log(`Found ${items.length} items\n`);

  // Get all images for lookup (paginated)
  const images = await fetchAll('images', 'id, filename');

  // Create image lookup map
  const imageMap = new Map();
  for (const img of images) {
    imageMap.set(img.id, img.filename);
  }

  // Process each item
  const updates = [];
  const stats = { updated: 0, skipped: 0, noMatch: 0 };

  for (const item of items) {
    const chapterOrder = item.chapters?.order_index;
    const chapterKey = `ch${String(chapterOrder).padStart(2, '0')}`;

    // Skip if this chapter doesn't have sub-chapters configured
    if (!subChaptersConfig[chapterKey]) {
      stats.skipped++;
      continue;
    }

    // Get the first source image for this item
    let imageFilename = null;
    if (item.source_image_id) {
      imageFilename = imageMap.get(item.source_image_id);
    } else if (item.source_image_ids && item.source_image_ids.length > 0) {
      imageFilename = imageMap.get(item.source_image_ids[0]);
    }

    if (!imageFilename) {
      stats.noMatch++;
      continue;
    }

    const imageNum = getImageNumber(imageFilename);
    if (!imageNum) {
      stats.noMatch++;
      continue;
    }

    const subChapter = findSubChapter(chapterKey, imageNum);
    if (subChapter) {
      updates.push({ id: item.id, sub_chapter: subChapter });
      stats.updated++;
    } else {
      stats.noMatch++;
    }
  }

  console.log(`Stats: ${stats.updated} to update, ${stats.skipped} skipped (no config), ${stats.noMatch} no match\n`);

  if (updates.length === 0) {
    console.log('No updates to apply.');
    return;
  }

  // Batch update in chunks
  const BATCH_SIZE = 100;
  console.log(`Applying ${updates.length} updates in batches of ${BATCH_SIZE}...\n`);

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);

    for (const update of batch) {
      const { error } = await supabase
        .from('items')
        .update({ sub_chapter: update.sub_chapter })
        .eq('id', update.id);

      if (error) {
        console.error(`Error updating item ${update.id}:`, error);
      }
    }

    console.log(`Updated ${Math.min(i + BATCH_SIZE, updates.length)} / ${updates.length}`);
  }

  // Print summary by sub-chapter
  console.log('\n--- Sub-chapter distribution ---');
  const subChapterCounts = {};
  for (const u of updates) {
    subChapterCounts[u.sub_chapter] = (subChapterCounts[u.sub_chapter] || 0) + 1;
  }
  for (const [name, count] of Object.entries(subChapterCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count}`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
