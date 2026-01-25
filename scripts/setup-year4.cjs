#!/usr/bin/env node
/**
 * Initialize Year 4 Math source and chapters in Supabase
 *
 * Usage:
 *   node scripts/setup-year4.cjs [--clear]
 *
 * Options:
 *   --clear   Remove existing Year 4 source and chapters before creating
 *
 * Creates:
 *   - 1 source record for "Year 4 math.docx"
 *   - 5 chapter records (Unit 1-5)
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

const YEAR4_SOURCE = {
  filename: 'Year 4 math.docx',
  subject: 'Year 4 Math',
};

const YEAR4_CHAPTERS = [
  { order_index: 1, title: 'Unit 1: Graph' },
  { order_index: 2, title: 'Unit 2: Numbers' },
  { order_index: 3, title: 'Unit 3: Fraction' },
  { order_index: 4, title: 'Unit 4: Decimal' },
  { order_index: 5, title: 'Unit 5: Geometry' },
];

async function clearYear4Data() {
  console.log('Clearing existing Year 4 data...');

  // Find existing source
  const { data: source } = await supabase
    .from('sources')
    .select('id')
    .eq('filename', YEAR4_SOURCE.filename)
    .single();

  if (!source) {
    console.log('  No existing Year 4 source found.');
    return;
  }

  // Find chapters for this source
  const { data: chapters } = await supabase
    .from('chapters')
    .select('id')
    .eq('source_id', source.id);

  if (chapters && chapters.length > 0) {
    const chapterIds = chapters.map(c => c.id);

    // Delete items and questions for these chapters
    const { data: items } = await supabase
      .from('items')
      .select('id')
      .in('chapter_id', chapterIds);

    if (items && items.length > 0) {
      const itemIds = items.map(i => i.id);
      await supabase.from('questions').delete().in('item_id', itemIds);
      await supabase.from('items').delete().in('chapter_id', chapterIds);
      console.log(`  Deleted ${items.length} items and their questions`);
    }

    // Delete images for these chapters
    const { data: images } = await supabase
      .from('images')
      .select('id')
      .in('chapter_id', chapterIds);

    if (images && images.length > 0) {
      await supabase.from('images').delete().in('chapter_id', chapterIds);
      console.log(`  Deleted ${images.length} image records`);
    }

    // Delete chapters
    await supabase.from('chapters').delete().eq('source_id', source.id);
    console.log(`  Deleted ${chapters.length} chapters`);
  }

  // Delete source
  await supabase.from('sources').delete().eq('id', source.id);
  console.log('  Deleted source record');
}

async function main() {
  const doClear = process.argv.includes('--clear');

  console.log('='.repeat(50));
  console.log('Year 4 Math - Database Setup');
  console.log('='.repeat(50));

  if (doClear) {
    await clearYear4Data();
    console.log('');
  }

  // 1. Create source
  console.log('Creating source record...');
  const { data: existingSource } = await supabase
    .from('sources')
    .select('id')
    .eq('filename', YEAR4_SOURCE.filename)
    .single();

  let sourceId;
  if (existingSource) {
    sourceId = existingSource.id;
    console.log(`  Source already exists: ${sourceId.slice(0, 8)}...`);
  } else {
    const { data: newSource, error: sourceErr } = await supabase
      .from('sources')
      .insert(YEAR4_SOURCE)
      .select()
      .single();

    if (sourceErr) {
      console.error('  Failed to create source:', sourceErr.message);
      process.exit(1);
    }
    sourceId = newSource.id;
    console.log(`  Created source: ${sourceId.slice(0, 8)}...`);
  }

  // 2. Create chapters
  console.log('\nCreating chapter records...');
  for (const ch of YEAR4_CHAPTERS) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('chapters')
      .select('id')
      .eq('source_id', sourceId)
      .eq('order_index', ch.order_index)
      .single();

    if (existing) {
      console.log(`  ${ch.title} — already exists (${existing.id.slice(0, 8)}...)`);
      continue;
    }

    const { data: newCh, error: chErr } = await supabase
      .from('chapters')
      .insert({
        source_id: sourceId,
        title: ch.title,
        order_index: ch.order_index,
        parent_id: null,
      })
      .select()
      .single();

    if (chErr) {
      console.error(`  Failed to create ${ch.title}:`, chErr.message);
    } else {
      console.log(`  ${ch.title} — created (${newCh.id.slice(0, 8)}...)`);
    }
  }

  // 3. Verify
  console.log('\nVerification:');
  const { data: allChapters } = await supabase
    .from('chapters')
    .select('id, title, order_index')
    .eq('source_id', sourceId)
    .order('order_index');

  if (allChapters) {
    for (const ch of allChapters) {
      console.log(`  [${ch.order_index}] ${ch.title} (${ch.id.slice(0, 8)}...)`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('COMPLETE');
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
