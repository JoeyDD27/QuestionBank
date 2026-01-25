#!/usr/bin/env node
/**
 * Batch upload cropped figures to Supabase
 *
 * Usage:
 *   node scripts/upload-figures.cjs --source=year4 --ch=1
 *
 * This script:
 * 1. Queries items + questions for the given chapter
 * 2. Uploads figure images to 'question-figures' storage bucket
 * 3. Creates question_figures records linking figures to questions
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

// Load .env
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
  console.error('Missing SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const FIGURES_BUCKET = 'question-images';

// Figure mapping: order_index → list of figure file paths
// Images 1-7 are small standalone concept images, uploaded as-is
// Images 8-13 have MinerU-cropped bar graphs
// Images 14-15 are rotated, with MinerU crops from rotated versions
const FIGURE_MAP = {
  1: [
    { file: 'year4_extracted/word/media_compressed/image1.png', label: 'pictograph' }
  ],
  2: [
    { file: 'year4_extracted/word/media_compressed/image2.png', label: 'bar_chart' }
  ],
  3: [
    { file: 'year4_extracted/word/media_compressed/image3.png', label: 'line_graph' }
  ],
  4: [
    { file: 'year4_extracted/word/media_compressed/image4.png', label: 'pie_chart' }
  ],
  5: [
    { file: 'year4_extracted/word/media_compressed/image5.png', label: 'histogram_vs_bar' }
  ],
  6: [
    { file: 'year4_extracted/word/media_compressed/image6.png', label: 'data_table' },
    { file: 'year4_extracted/word/media_compressed/image7.png', label: 'bar_graph' }
  ],
  7: [
    { file: 'year4_figures/unit1/merged/image8/fig_00_M_figure.jpg', label: 'fruit_bar_graph' }
  ],
  8: [
    { file: 'year4_figures/unit1/merged/image9/fig_00_M_figure.jpg', label: 'animals_bar_graph' }
  ],
  9: [
    { file: 'year4_figures/unit1/merged/image10/fig_00_M_figure.jpg', label: 'savings_bar_graph' }
  ],
  10: [
    { file: 'year4_figures/unit1/merged/image11/fig_00_M_figure.jpg', label: 'instruments_bar_graph' }
  ],
  11: [
    { file: 'year4_figures/unit1/merged/image12/fig_00_M_figure.jpg', label: 'charity_bar_graph' }
  ],
  12: [
    { file: 'year4_figures/unit1/merged/image13/fig_00_M_figure.jpg', label: 'flowers_bar_graph' }
  ],
  13: [
    { file: 'year4_figures/unit1_rotated/merged/image14_rotated/fig_00_M_figure.jpg', label: 'stickers_bar_graph' },
    { file: 'year4_figures/unit1_rotated/merged/image15_rotated/fig_00_M_figure.jpg', label: 'bar_model_before' },
    { file: 'year4_figures/unit1_rotated/merged/image15_rotated/fig_01_M_figure.jpg', label: 'bar_model_after' },
    { file: 'year4_figures/unit1_rotated/merged/image15_rotated/fig_02_M_figure.jpg', label: 'bar_model_method2' }
  ],
  // #14 (image16) has no figures - just text
  15: [
    { file: 'year4_figures/unit1_part2/merged/image17_rotated/fig_00_M_figure.jpg', label: 'figure_a_200' },
    { file: 'year4_figures/unit1_part2/merged/image17_rotated/fig_01_M_figure.jpg', label: 'figure_b_x' }
  ],
  16: [
    { file: 'year4_figures/unit1_part2/merged/image18_rotated/fig_00_M_figure.jpg', label: 'savings_bar_graph' }
  ],
  17: [
    { file: 'year4_figures/unit1_part2/merged/image19_rotated/fig_00_M_figure.jpg', label: 'pets_bar_graph' }
  ],
  18: [
    { file: 'year4_figures/unit1_part2/merged/image20_rotated/fig_00_M_figure.jpg', label: 'library_visitors' }
  ],
  19: [
    { file: 'year4_figures/unit1_part2/merged/image21_rotated/fig_00_M_figure.jpg', label: 'flowers_sales' }
  ],
  20: [
    { file: 'year4_figures/unit1_part2/merged/image22_rotated/fig_00_M_figure.jpg', label: 'pupils_walk_school' }
  ],
  21: [
    { file: 'year4_figures/unit1_part2/merged/image23_rotated/fig_00_M_figure.jpg', label: 'clinic_patients' }
  ],
  22: [
    { file: 'year4_figures/unit1_part2/merged/image24_rotated/fig_00_M_figure.jpg', label: 'library_books' }
  ],
  23: [
    { file: 'year4_figures/unit1_part2/merged/image25_rotated/fig_04_G_chart_diagram.jpg', label: 'shells_pictograph' }
  ],
  24: [
    { file: 'year4_figures/unit1_part2/merged/image26_rotated/fig_00_M_figure.jpg', label: 'shells_bar_graph' }
  ],
  25: [
    { file: 'year4_figures/unit1_part2/merged/image27_rotated/fig_00_M_figure.jpg', label: 'marbles_bar_graph' }
  ]
};

async function getSourceId(sourceName) {
  const filenamePatterns = {
    algebra: 'Algebra full.docx',
    year4: 'Year 4 math.docx',
  };
  const { data, error } = await supabase
    .from('sources')
    .select('id')
    .eq('filename', filenamePatterns[sourceName])
    .single();
  if (error) return null;
  return data.id;
}

async function getChapterId(chapterNum, sourceId) {
  let query = supabase
    .from('chapters')
    .select('id')
    .eq('order_index', chapterNum);
  if (sourceId) query = query.eq('source_id', sourceId);

  const { data, error } = await query.single();
  if (error) return null;
  return data.id;
}

async function getQuestionsForChapter(chapterId) {
  // Get items with their questions, ordered by order_index
  const { data: items, error } = await supabase
    .from('items')
    .select('id, order_index, questions(id)')
    .eq('chapter_id', chapterId)
    .order('order_index');

  if (error) {
    console.error('Failed to fetch items:', error.message);
    return [];
  }

  // Flatten to { order_index, question_id }
  const result = [];
  for (const item of items) {
    if (item.questions && item.questions.length > 0) {
      result.push({
        order_index: item.order_index,
        question_id: item.questions[0].id
      });
    }
  }
  return result;
}

async function clearExistingFigures(questionIds) {
  if (questionIds.length === 0) return;

  console.log(`Clearing existing figures for ${questionIds.length} questions...`);

  // Get existing figures
  const { data: existing } = await supabase
    .from('question_figures')
    .select('id, storage_path')
    .in('question_id', questionIds);

  if (existing && existing.length > 0) {
    // Delete storage files
    const paths = existing.map(f => f.storage_path);
    const { error: storageErr } = await supabase.storage
      .from(FIGURES_BUCKET)
      .remove(paths);
    if (storageErr) {
      console.log(`  Storage cleanup warning: ${storageErr.message}`);
    }

    // Delete records
    const ids = existing.map(f => f.id);
    await supabase.from('question_figures').delete().in('id', ids);
    console.log(`  Cleared ${existing.length} existing figures`);
  } else {
    console.log('  No existing figures to clear');
  }
}

async function uploadFigure(questionId, filePath, orderIndex) {
  const fullPath = path.join(PROJECT_ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  MISSING: ${filePath}`);
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
  const fileExt = ext === '.png' ? 'png' : 'jpg';

  const storagePath = `figures/${questionId}/${crypto.randomUUID()}.${fileExt}`;
  const fileBuffer = fs.readFileSync(fullPath);

  // Upload to storage
  const { error: uploadErr } = await supabase.storage
    .from(FIGURES_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType,
      cacheControl: '31536000',
      upsert: false
    });

  if (uploadErr) {
    console.log(`  Upload error: ${uploadErr.message}`);
    return false;
  }

  // Create record
  const { error: insertErr } = await supabase
    .from('question_figures')
    .insert({
      question_id: questionId,
      storage_path: storagePath,
      filename: path.basename(filePath),
      order_index: orderIndex
    });

  if (insertErr) {
    console.log(`  Insert error: ${insertErr.message}`);
    // Clean up uploaded file
    await supabase.storage.from(FIGURES_BUCKET).remove([storagePath]);
    return false;
  }

  return true;
}

async function main() {
  const args = process.argv.slice(2);
  let chapterNum = null;
  let sourceName = 'year4';

  for (const arg of args) {
    if (arg.startsWith('--ch=')) chapterNum = parseInt(arg.replace('--ch=', ''), 10);
    if (arg.startsWith('--source=')) sourceName = arg.replace('--source=', '');
  }

  if (!chapterNum) {
    console.error('Usage: node scripts/upload-figures.cjs --source=year4 --ch=1');
    process.exit(1);
  }

  console.log('='.repeat(50));
  console.log(`Figure Upload - ch${chapterNum.toString().padStart(2, '0')} [${sourceName}]`);
  console.log('='.repeat(50));

  // Get source and chapter
  const sourceId = await getSourceId(sourceName);
  if (!sourceId) {
    console.error(`Source "${sourceName}" not found`);
    process.exit(1);
  }

  const chapterId = await getChapterId(chapterNum, sourceId);
  if (!chapterId) {
    console.error(`Chapter ${chapterNum} not found`);
    process.exit(1);
  }

  // Get questions
  const questions = await getQuestionsForChapter(chapterId);
  console.log(`\nFound ${questions.length} questions`);

  // Clear existing figures
  const questionIds = questions.map(q => q.question_id);
  await clearExistingFigures(questionIds);

  // Upload figures
  let uploaded = 0;
  let failed = 0;

  for (const q of questions) {
    const figures = FIGURE_MAP[q.order_index];
    if (!figures || figures.length === 0) {
      console.log(`  Item #${q.order_index}: no figures mapped`);
      continue;
    }

    console.log(`\n  Item #${q.order_index}: uploading ${figures.length} figure(s)`);

    for (let i = 0; i < figures.length; i++) {
      const fig = figures[i];
      const success = await uploadFigure(q.question_id, fig.file, i);
      if (success) {
        console.log(`    ✓ ${fig.label} (${path.basename(fig.file)})`);
        uploaded++;
      } else {
        console.log(`    ✗ ${fig.label} (${path.basename(fig.file)})`);
        failed++;
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`COMPLETE: ${uploaded} uploaded, ${failed} failed`);
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
