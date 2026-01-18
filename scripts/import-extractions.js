#!/usr/bin/env node
/**
 * Import extracted JSON files into Supabase database
 *
 * Schema A: Simple import
 * - 1 JSON item → 1 DB item + 1 DB question
 * - Entire content_latex stored as problem_latex
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join, basename, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SUPABASE_URL = 'https://orfxntmcywouoqpasivm.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_ANON_KEY environment variable')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const EXTRACTIONS_DIR = join(__dirname, '..', 'extractions')

// Load chapter_image_ranges.json
function loadChapterRanges() {
  const rangesPath = join(__dirname, '..', 'chapter_image_ranges.json')
  return JSON.parse(readFileSync(rangesPath, 'utf-8'))
}

// Get chapter from database by order_index
async function getChapterByNumber(chapterNum) {
  const { data, error } = await supabase
    .from('chapters')
    .select('id, title, order_index')
    .eq('order_index', chapterNum)
    .single()

  if (error) return null
  return data
}

// Extract chapter number from filename (e.g., "ch01_algebra_part1.json" → 1)
function getChapterNumFromFilename(filename) {
  const match = filename.match(/ch(\d+)_/)
  if (!match) return null
  return parseInt(match[1], 10)
}

// Process a single extraction file
async function processFile(filePath, dryRun = false) {
  const filename = basename(filePath)
  console.log(`\n📄 ${filename}`)

  // Parse JSON
  let content
  try {
    content = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch (e) {
    console.log(`  ⚠️ JSON parse error: ${e.message.slice(0, 50)}`)
    return { items: 0, questions: 0, errors: 1 }
  }

  // Get chapter number from filename
  const chapterNum = getChapterNumFromFilename(filename)
  if (!chapterNum) {
    console.log(`  ⚠️ Could not extract chapter number from filename`)
    return { items: 0, questions: 0, errors: 1 }
  }

  // Get chapter from database
  const chapter = await getChapterByNumber(chapterNum)
  if (!chapter) {
    console.log(`  ⚠️ Chapter ${chapterNum} not found in database`)
    return { items: 0, questions: 0, errors: 1 }
  }

  console.log(`  Chapter: ${chapter.title} (id: ${chapter.id.slice(0, 8)}...)`)

  // Validate items_flat schema
  if (!content.items || !Array.isArray(content.items)) {
    console.log(`  ⚠️ No items array found (expected items_flat schema)`)
    return { items: 0, questions: 0, errors: 1 }
  }

  console.log(`  Found ${content.items.length} items`)
  console.log(`  Images range: ${content.images_range || 'not specified'}`)

  if (dryRun) {
    console.log(`  🔍 [DRY RUN] Would insert ${content.items.length} items`)
    return { items: content.items.length, questions: content.items.length, errors: 0 }
  }

  let itemsInserted = 0
  let questionsInserted = 0

  for (let i = 0; i < content.items.length; i++) {
    const item = content.items[i]

    // Insert item
    const { data: dbItem, error: itemError } = await supabase
      .from('items')
      .insert({
        chapter_id: chapter.id,
        type: item.type || 'concept',
        title: null,
        instruction: null,
        source_image_id: null,
        order_index: i + 1
      })
      .select()
      .single()

    if (itemError) {
      console.log(`  ❌ Item insert error: ${itemError.message}`)
      continue
    }
    itemsInserted++

    // Insert question with entire content_latex
    const contentLatex = item.content_latex || ''
    if (contentLatex) {
      const { error: qError } = await supabase
        .from('questions')
        .insert({
          item_id: dbItem.id,
          source_image_id: null,
          label: null,
          problem_latex: contentLatex,
          problem_text: null,
          has_answer: false,
          answer_latex: null,
          solution_steps: null,
          choices: null
        })

      if (qError) {
        console.log(`  ❌ Question insert error: ${qError.message}`)
      } else {
        questionsInserted++
      }
    }
  }

  console.log(`  ✅ Inserted ${itemsInserted} items, ${questionsInserted} questions`)
  return { items: itemsInserted, questions: questionsInserted, errors: 0 }
}

// Clear existing data for a chapter
async function clearChapterData(chapterNum) {
  const chapter = await getChapterByNumber(chapterNum)
  if (!chapter) return

  console.log(`\nClearing existing data for ch${chapterNum.toString().padStart(2, '0')}...`)

  // Get item IDs for this chapter
  const { data: items } = await supabase
    .from('items')
    .select('id')
    .eq('chapter_id', chapter.id)

  if (items && items.length > 0) {
    const itemIds = items.map(i => i.id)

    // Delete questions first (foreign key)
    const { error: qErr } = await supabase
      .from('questions')
      .delete()
      .in('item_id', itemIds)

    if (qErr) console.log(`  ⚠️ Failed to delete questions: ${qErr.message}`)

    // Delete items
    const { error: iErr } = await supabase
      .from('items')
      .delete()
      .eq('chapter_id', chapter.id)

    if (iErr) console.log(`  ⚠️ Failed to delete items: ${iErr.message}`)

    console.log(`  Cleared ${items.length} items`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const clearFirst = args.includes('--clear')
  const singleFile = args.find(a => a.endsWith('.json'))
  const chapterArg = args.find(a => a.startsWith('--ch='))

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No data will be inserted\n')
  }

  // Determine which files to process
  let files
  if (singleFile) {
    files = [join(EXTRACTIONS_DIR, singleFile)]
  } else if (chapterArg) {
    const chNum = chapterArg.replace('--ch=', '').padStart(2, '0')
    files = readdirSync(EXTRACTIONS_DIR)
      .filter(f => f.startsWith(`ch${chNum}_`) && f.endsWith('.json'))
      .sort()
      .map(f => join(EXTRACTIONS_DIR, f))
  } else {
    files = readdirSync(EXTRACTIONS_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .map(f => join(EXTRACTIONS_DIR, f))
  }

  if (files.length === 0) {
    console.log('No files to process')
    return
  }

  console.log(`Processing ${files.length} file(s)...`)

  // Clear existing data if requested
  if (clearFirst && !dryRun) {
    const chapterNums = new Set(files.map(f => getChapterNumFromFilename(basename(f))).filter(Boolean))
    for (const num of chapterNums) {
      await clearChapterData(num)
    }
  }

  let totalItems = 0
  let totalQuestions = 0
  let totalErrors = 0

  for (const file of files) {
    const result = await processFile(file, dryRun)
    totalItems += result.items
    totalQuestions += result.questions
    totalErrors += result.errors
  }

  console.log('\n' + '='.repeat(50))
  console.log('SUMMARY')
  console.log('='.repeat(50))
  console.log(`Files processed: ${files.length}`)
  console.log(`Items inserted: ${totalItems}`)
  console.log(`Questions inserted: ${totalQuestions}`)
  console.log(`Errors: ${totalErrors}`)
}

main().catch(console.error)
