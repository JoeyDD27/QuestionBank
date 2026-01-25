#!/usr/bin/env node
/**
 * Rule-based metadata preprocessing for Phase 2
 *
 * Extracts metadata from questions without AI:
 * - exercise_id, original_chapter, original_section
 * - competition source
 * - flags (challenge, has_solution, has_hints)
 * - has_diagram, contexts
 * - sub_question_count
 * - ib_topics from chapter mapping
 *
 * Usage:
 *   node scripts/rule-preprocess.cjs [options]
 *
 * Options:
 *   --dry-run     Preview mode, no actual writes
 *   --limit=N     Process only N questions
 *   --chapter=X   Process only chapter X (by title)
 */

const { createClient } = require('@supabase/supabase-js');
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

// Parse command line args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitMatch = args.find(a => a.startsWith('--limit='));
const limit = limitMatch ? parseInt(limitMatch.split('=')[1]) : null;
const chapterMatch = args.find(a => a.startsWith('--chapter='));
const chapterFilter = chapterMatch ? chapterMatch.split('=')[1] : null;

/**
 * Extract metadata from question content using rules
 */
function extractMetadata(problemLatex, itemType, chapterTitle) {
  const metadata = {};
  const text = problemLatex || '';

  // === Exercise ID (e.g., "EXERCISE 8A", "EXERCISE 2C", "EXERCISE 8E.1", "REVIEW SET 2A") ===
  const exerciseMatch = text.match(/^(EXERCISE|REVIEW SET)\s+(\d+)([A-Z](?:\.\d+)?)?/i);
  if (exerciseMatch) {
    metadata.exercise_type = exerciseMatch[1].toLowerCase() === 'review set' ? 'review' : 'exercise';
    metadata.original_chapter = parseInt(exerciseMatch[2]);
    metadata.original_section = exerciseMatch[3] || null;
    metadata.exercise_id = exerciseMatch[2] + (exerciseMatch[3] || '');
  }

  // === Competition source (e.g., "(Source: AMC 12)") ===
  const sourceMatches = text.matchAll(/\(Source:\s*([^)]+)\)/gi);
  const sources = [];
  for (const match of sourceMatches) {
    sources.push(match[1].trim());
  }
  if (sources.length > 0) {
    metadata.source = { competitions: sources };
    metadata.flags = metadata.flags || [];
    metadata.flags.push('challenge');
    metadata.difficulty = 5;
    metadata.level = 'competition';
    metadata.exam_types = ['Competition'];
  }

  // === Star/Challenge markers ===
  if (text.includes('★') || text.includes('\\star') || text.includes('｢\\star｣') || /\bChallenge\b/i.test(text)) {
    metadata.flags = metadata.flags || [];
    if (!metadata.flags.includes('challenge')) {
      metadata.flags.push('challenge');
    }
    if (!metadata.difficulty) {
      metadata.difficulty = 4;
      metadata.level = 'advanced';
    }
  }

  // === Hints ===
  if (/\bHints?:\s*\d/i.test(text)) {
    metadata.flags = metadata.flags || [];
    metadata.flags.push('has_hints');
  }

  // === Has solution (examples or contains "Solution") ===
  if (itemType === 'example' || /\bSolutions?:/i.test(text)) {
    metadata.flags = metadata.flags || [];
    metadata.flags.push('has_solution');
  }

  // === Has diagram ===
  if (/\b(diagram|graph|figure|shown|below|at right|above)\b/i.test(text)) {
    metadata.has_diagram = true;
    metadata.flags = metadata.flags || [];
    if (!metadata.flags.includes('requires_diagram')) {
      metadata.flags.push('requires_diagram');
    }
  }

  // === Context detection ===
  if (/[£€\$]|yen|peso|\binterest\b|\binvestment\b|\bcompound\b|\bdepreciation\b|\bbank\b|\bloan\b|\bsavings?\b/i.test(text)) {
    metadata.contexts = ['finance'];
  } else if (/\brectangle\b|\btriangle\b|\bcircle\b|\barea\b|\bperimeter\b|\bangle\b|\bsquare\b.*\bside\b|\bradius\b/i.test(text)) {
    metadata.contexts = ['geometry'];
  } else if (/\bkm\b|\bmetre\b|\bspeed\b|\bdistance\b|\btravel\b|\brate\b|\bkph\b|\bmph\b/i.test(text)) {
    metadata.contexts = ['real_world'];
  } else {
    metadata.contexts = ['pure_math'];
  }

  // === Sub-question count ===
  const subQuestions = text.match(/\([a-z]\)/g);
  if (subQuestions) {
    const uniqueSubs = [...new Set(subQuestions)];
    metadata.sub_question_count = uniqueSubs.length;
    if (uniqueSubs.length >= 4) {
      metadata.flags = metadata.flags || [];
      metadata.flags.push('multi_step');
    }
  }

  // Deduplicate flags
  if (metadata.flags) {
    metadata.flags = [...new Set(metadata.flags)];
  }

  return metadata;
}

async function main() {
  console.log('=== Rule-based Metadata Preprocessing ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (limit) console.log(`Limit: ${limit} questions`);
  if (chapterFilter) console.log(`Chapter filter: ${chapterFilter}`);
  console.log('');

  // 1. Load chapter-topic mappings
  const { data: mappings, error: mappingError } = await supabase
    .from('chapter_topic_mapping')
    .select('chapter_id, ib_topic_code');

  if (mappingError) {
    console.error('Error loading chapter mappings:', mappingError);
    process.exit(1);
  }

  const chapterTopics = {};
  for (const m of mappings) {
    if (!chapterTopics[m.chapter_id]) {
      chapterTopics[m.chapter_id] = [];
    }
    chapterTopics[m.chapter_id].push(m.ib_topic_code);
  }
  console.log(`Loaded ${mappings.length} chapter-topic mappings`);

  // 2. Load all questions with item and chapter info (with pagination)
  const pageSize = 1000;
  let questions = [];
  let page = 0;

  while (true) {
    let query = supabase
      .from('questions')
      .select(`
        id,
        problem_latex,
        metadata,
        item:items!inner(
          id,
          type,
          chapter:chapters!inner(
            id,
            title
          )
        )
      `)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    const { data, error: questionsError } = await query;

    if (questionsError) {
      console.error('Error loading questions:', questionsError);
      process.exit(1);
    }

    if (!data || data.length === 0) break;

    questions = questions.concat(data);
    page++;

    if (limit && questions.length >= limit) {
      questions = questions.slice(0, limit);
      break;
    }

    if (data.length < pageSize) break;
  }

  console.log(`Loaded ${questions.length} questions`);

  // Filter by chapter if specified
  let filtered = questions;
  if (chapterFilter) {
    filtered = questions.filter(q =>
      q.item?.chapter?.title?.toLowerCase().includes(chapterFilter.toLowerCase())
    );
    console.log(`Filtered to ${filtered.length} questions in chapter "${chapterFilter}"`);
  }

  // 3. Process each question
  const stats = {
    total: filtered.length,
    updated: 0,
    skipped: 0,
    withExerciseId: 0,
    withSource: 0,
    withChallenge: 0,
    withDiagram: 0,
    contexts: {}
  };

  const updates = [];

  for (const q of filtered) {
    const itemType = q.item?.type;
    const chapterId = q.item?.chapter?.id;
    const chapterTitle = q.item?.chapter?.title;

    // Extract rule-based metadata
    const extracted = extractMetadata(q.problem_latex, itemType, chapterTitle);

    // Add IB topics from chapter mapping
    if (chapterId && chapterTopics[chapterId]) {
      extracted.ib_topics = chapterTopics[chapterId];
    }

    // Merge with existing metadata (don't overwrite AI-generated fields)
    const existingMetadata = q.metadata || {};
    const newMetadata = {
      ...existingMetadata,
      ...extracted,
      // Merge arrays instead of replacing
      flags: [...new Set([...(existingMetadata.flags || []), ...(extracted.flags || [])])],
      ib_topics: extracted.ib_topics || existingMetadata.ib_topics
    };

    // Clean up empty arrays
    if (newMetadata.flags?.length === 0) delete newMetadata.flags;

    // Track stats
    if (extracted.exercise_id) stats.withExerciseId++;
    if (extracted.source) stats.withSource++;
    if (extracted.flags?.includes('challenge')) stats.withChallenge++;
    if (extracted.has_diagram) stats.withDiagram++;
    if (extracted.contexts) {
      const ctx = extracted.contexts[0];
      stats.contexts[ctx] = (stats.contexts[ctx] || 0) + 1;
    }

    updates.push({
      id: q.id,
      metadata: newMetadata
    });
  }

  console.log('\n=== Stats ===');
  console.log(`Total questions: ${stats.total}`);
  console.log(`With exercise_id: ${stats.withExerciseId}`);
  console.log(`With competition source: ${stats.withSource}`);
  console.log(`Challenge/star marked: ${stats.withChallenge}`);
  console.log(`Has diagram: ${stats.withDiagram}`);
  console.log('Contexts:', stats.contexts);

  // 4. Update database
  if (dryRun) {
    console.log('\n[DRY RUN] Would update', updates.length, 'questions');
    console.log('\nSample updates (first 3):');
    for (const u of updates.slice(0, 3)) {
      console.log(`  ${u.id}:`, JSON.stringify(u.metadata, null, 2).slice(0, 200) + '...');
    }
  } else {
    console.log(`\nUpdating ${updates.length} questions...`);

    // Batch update in chunks of 100
    const chunkSize = 100;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);

      for (const u of chunk) {
        const { error } = await supabase
          .from('questions')
          .update({ metadata: u.metadata })
          .eq('id', u.id);

        if (error) {
          console.error(`Error updating ${u.id}:`, error);
        } else {
          stats.updated++;
        }
      }

      process.stdout.write(`\rProgress: ${Math.min(i + chunkSize, updates.length)}/${updates.length}`);
    }

    console.log(`\n\nUpdated ${stats.updated} questions`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
