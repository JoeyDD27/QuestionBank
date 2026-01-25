#!/usr/bin/env node
/**
 * Fetch unlabeled subquestions for AI annotation
 *
 * Usage:
 *   node scripts/ai-label-fetch-subq.cjs [options]
 *
 * Options:
 *   --batch-size=N   Number of subquestions per batch (default: 50)
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
  // Count total subquestions
  const { count: total } = await supabase
    .from('subquestions')
    .select('*', { count: 'exact', head: true });

  // Count labeled (have question_type in subquestion_metadata)
  const { count: labeled } = await supabase
    .from('subquestion_metadata')
    .select('*', { count: 'exact', head: true })
    .not('question_type', 'is', null);

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
    console.error('All subquestions are labeled!');
    process.exit(0);
  }

  // Get all IDs that already have question_type (up to 2000)
  const { data: labeledIds } = await supabase
    .from('subquestion_metadata')
    .select('subquestion_id')
    .not('question_type', 'is', null)
    .limit(2000);

  const labeledIdSet = new Set((labeledIds || []).map(r => r.subquestion_id));

  // Fetch ALL subquestion IDs first (just IDs, lightweight)
  // Note: Supabase default limit is 1000, so we need to explicitly set higher
  const { data: allIds } = await supabase
    .from('subquestions')
    .select('id')
    .order('id')
    .limit(2000);

  // Filter to get unlabeled IDs
  const unlabeledIds = (allIds || [])
    .map(r => r.id)
    .filter(id => !labeledIdSet.has(id))
    .slice(0, batchSize);

  if (unlabeledIds.length === 0) {
    console.error('No unlabeled subquestions found');
    const batch = [];
    // Format for AI labeling - empty
    const formattedBatch = [];
    const output = {
      batch_size: 0,
      total_remaining: unlabeled,
      subquestions: []
    };
    const jsonOutput = JSON.stringify(output, null, 2);
    if (outputFile) {
      fs.writeFileSync(outputFile, jsonOutput);
      console.error(`Wrote 0 subquestions to ${outputFile}`);
    } else {
      console.log(jsonOutput);
    }
    return;
  }

  // Now fetch full data for these specific IDs
  const { data: subquestions, error } = await supabase
    .from('subquestions')
    .select(`
      id,
      label,
      context_latex,
      content_latex,
      question:questions!inner(
        id,
        problem_latex,
        metadata,
        item:items!inner(
          type,
          chapter:chapters!inner(
            title
          )
        )
      )
    `)
    .in('id', unlabeledIds);

  if (error) {
    console.error('Error fetching subquestions:', error);
    process.exit(1);
  }

  const batch = subquestions || [];

  // Format for AI labeling
  const formattedBatch = batch.map((sq, idx) => {
    const parentContent = (sq.question?.problem_latex || '').slice(0, 200);
    const context = sq.context_latex || '';
    const content = sq.content_latex || '';

    return {
      id: sq.id,
      index: idx + 1,
      label: sq.label,
      chapter: sq.question?.item?.chapter?.title || 'Unknown',
      item_type: sq.question?.item?.type || 'unknown',
      parent_metadata: {
        topics: sq.question?.metadata?.topics,
        difficulty: sq.question?.metadata?.difficulty
      },
      // Include context if it exists
      context: context ? context.slice(0, 300) : null,
      content: content.slice(0, 500)
    };
  });

  const output = {
    batch_size: formattedBatch.length,
    total_remaining: unlabeled,
    subquestions: formattedBatch
  };

  const jsonOutput = JSON.stringify(output, null, 2);

  if (outputFile) {
    fs.writeFileSync(outputFile, jsonOutput);
    console.error(`Wrote ${formattedBatch.length} subquestions to ${outputFile}`);
  } else {
    console.log(jsonOutput);
  }
}

main().catch(console.error);
