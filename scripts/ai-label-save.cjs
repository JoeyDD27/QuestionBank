#!/usr/bin/env node
/**
 * Save AI annotation results to database
 *
 * Usage:
 *   node scripts/ai-label-save.cjs --input=FILE
 *   cat results.json | node scripts/ai-label-save.cjs
 *
 * Input format (JSON array):
 * [
 *   {
 *     "id": "uuid",
 *     "difficulty": 1-5,
 *     "level": "beginner|intermediate|advanced|competition",
 *     "question_type": "...",
 *     "skills": [...],
 *     "topics": [...],
 *     "exam_types": [...],
 *     "grade_levels": [...]
 *   },
 *   ...
 * ]
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
    console.error('[DRY RUN] Would update:');
    for (const a of annotations.slice(0, 3)) {
      console.error(`  ${a.id}: difficulty=${a.difficulty}, type=${a.question_type}`);
    }
    return;
  }

  let success = 0;
  let failed = 0;

  for (const annotation of annotations) {
    const { id, ...fields } = annotation;

    if (!id) {
      console.error('Skipping annotation without id');
      failed++;
      continue;
    }

    // Get existing metadata
    const { data: existing, error: fetchError } = await supabase
      .from('questions')
      .select('metadata')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error(`Error fetching ${id}:`, fetchError.message);
      failed++;
      continue;
    }

    // Merge new fields into existing metadata
    const newMetadata = {
      ...(existing?.metadata || {}),
      ...fields
    };

    // Update
    const { error: updateError } = await supabase
      .from('questions')
      .update({ metadata: newMetadata })
      .eq('id', id);

    if (updateError) {
      console.error(`Error updating ${id}:`, updateError.message);
      failed++;
    } else {
      success++;
    }
  }

  console.error(`Done: ${success} updated, ${failed} failed`);

  // Output summary
  console.log(JSON.stringify({ success, failed }));
}

main().catch(console.error);
