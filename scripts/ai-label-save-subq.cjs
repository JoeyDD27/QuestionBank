#!/usr/bin/env node
/**
 * Save AI annotation results for subquestions
 *
 * Usage:
 *   node scripts/ai-label-save-subq.cjs --input=FILE
 *   cat results.json | node scripts/ai-label-save-subq.cjs
 *
 * Input format (JSON array):
 * [
 *   {
 *     "id": "subquestion uuid",
 *     "difficulty": 1-5,
 *     "question_type": "...",
 *     "skills": [...],
 *     "topics": [...]
 *   },
 *   ...
 * ]
 *
 * Note: level is auto-calculated from difficulty
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

// Parse args
const args = process.argv.slice(2);
const inputArg = args.find(a => a.startsWith('--input='));
const inputFile = inputArg ? inputArg.split('=')[1] : null;
const dryRun = args.includes('--dry-run');

// Calculate level from difficulty
function difficultyToLevel(difficulty) {
  if (difficulty <= 2) return 'foundation';
  if (difficulty === 3) return 'standard';
  return 'extension'; // 4-5
}

async function main() {
  let inputJson;

  if (inputFile) {
    inputJson = fs.readFileSync(inputFile, 'utf-8');
  } else {
    // Read from stdin
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    inputJson = Buffer.concat(chunks).toString('utf-8');
  }

  let annotations;
  try {
    annotations = JSON.parse(inputJson);
  } catch (e) {
    console.error('Invalid JSON input:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(annotations)) {
    console.error('Input must be a JSON array');
    process.exit(1);
  }

  console.error(`Processing ${annotations.length} annotations...`);

  if (dryRun) {
    console.error('[DRY RUN] Would insert:');
    for (const a of annotations.slice(0, 3)) {
      const level = difficultyToLevel(a.difficulty);
      console.error(`  ${a.id}: difficulty=${a.difficulty}, level=${level}, type=${a.question_type}`);
    }
    return;
  }

  // Prepare rows for batch upsert
  const rows = [];
  const skipped = [];

  for (const annotation of annotations) {
    const { id, difficulty, question_type, skills, topics } = annotation;

    if (!id) {
      console.error('Skipping annotation without id');
      skipped.push({ reason: 'no_id' });
      continue;
    }

    // Build row with only provided fields
    const row = { subquestion_id: id };

    if (difficulty) {
      row.difficulty = difficulty;
      row.level = difficultyToLevel(difficulty);
    }
    if (question_type) row.question_type = question_type;
    if (skills) row.skills = skills;
    if (topics) row.topics = topics;

    // Must have at least one field besides id
    if (Object.keys(row).length <= 1) {
      console.error(`Skipping ${id}: no fields to update`);
      skipped.push({ id, reason: 'no_fields' });
      continue;
    }

    rows.push(row);
  }

  console.error(`Valid annotations: ${rows.length}, Skipped: ${skipped.length}`);

  if (rows.length === 0) {
    console.error('No valid annotations to insert');
    process.exit(1);
  }

  // Batch insert (upsert to handle duplicates)
  const { data, error } = await supabase
    .from('subquestion_metadata')
    .upsert(rows, {
      onConflict: 'subquestion_id',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('Error inserting:', error);
    process.exit(1);
  }

  console.error(`Done: ${rows.length} inserted/updated`);

  // Output summary
  console.log(JSON.stringify({
    success: rows.length,
    skipped: skipped.length
  }));
}

main().catch(console.error);
