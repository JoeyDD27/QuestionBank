#!/usr/bin/env node
/**
 * Fetch unlabeled questions for AI annotation
 *
 * Usage:
 *   node scripts/ai-label-fetch.cjs [options]
 *
 * Options:
 *   --batch-size=N   Number of questions per batch (default: 50)
 *   --output=FILE    Output to file instead of stdout
 *   --stats          Show statistics only
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
const batchSizeArg = args.find(a => a.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 50;
const outputArg = args.find(a => a.startsWith('--output='));
const outputFile = outputArg ? outputArg.split('=')[1] : null;
const statsOnly = args.includes('--stats');

async function main() {
  // Count total and unlabeled
  const { count: total } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true });

  const { count: labeled } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .not('metadata->difficulty', 'is', null);

  const unlabeled = total - labeled;

  if (statsOnly) {
    console.log(JSON.stringify({
      total,
      labeled,
      unlabeled,
      batches_remaining: Math.ceil(unlabeled / batchSize)
    }, null, 2));
    return;
  }

  console.error(`Progress: ${labeled}/${total} labeled, ${unlabeled} remaining`);

  if (unlabeled === 0) {
    console.error('All questions are labeled!');
    process.exit(0);
  }

  // Fetch unlabeled questions
  const { data: questions, error } = await supabase
    .from('questions')
    .select(`
      id,
      problem_latex,
      metadata,
      item:items!inner(
        type,
        chapter:chapters!inner(
          title
        )
      )
    `)
    .is('metadata->difficulty', null)
    .limit(batchSize);

  if (error) {
    console.error('Error fetching questions:', error);
    process.exit(1);
  }

  // Format for AI labeling
  const batch = questions.map((q, idx) => ({
    id: q.id,
    index: idx + 1,
    chapter: q.item?.chapter?.title || 'Unknown',
    item_type: q.item?.type || 'unknown',
    existing_metadata: {
      ib_topics: q.metadata?.ib_topics,
      contexts: q.metadata?.contexts,
      flags: q.metadata?.flags,
      exercise_id: q.metadata?.exercise_id
    },
    content: (q.problem_latex || '').slice(0, 800) // Truncate long content
  }));

  const output = {
    batch_size: batch.length,
    total_remaining: unlabeled,
    questions: batch
  };

  const jsonOutput = JSON.stringify(output, null, 2);

  if (outputFile) {
    fs.writeFileSync(outputFile, jsonOutput);
    console.error(`Wrote ${batch.length} questions to ${outputFile}`);
  } else {
    console.log(jsonOutput);
  }
}

main().catch(console.error);
