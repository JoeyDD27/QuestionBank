#!/usr/bin/env node
/**
 * Import extracted JSON files into Supabase database
 * Handles multiple JSON schemas and normalizes to database format
 * V2: Correctly matches items to subsections
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SUPABASE_URL = 'https://orfxntmcywouoqpasivm.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_ANON_KEY environment variable')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const SOURCE_ID = 'a6cb81ed-4fef-4059-93b2-311d69fd45b7'
const EXTRACTIONS_DIR = join(__dirname, '..', 'extractions')

// Cache for lookups
let chaptersCache = null
let imagesCache = null

async function loadChapters() {
  if (chaptersCache) return chaptersCache
  const { data, error } = await supabase
    .from('chapters')
    .select('id, title, parent_id, order_index')
    .eq('source_id', SOURCE_ID)
  if (error) throw error
  chaptersCache = data
  return data
}

async function loadImages() {
  if (imagesCache) return imagesCache
  const allImages = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase
      .from('images')
      .select('id, filename, chapter_id')
      .eq('source_id', SOURCE_ID)
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    allImages.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  imagesCache = new Map(allImages.map(img => [img.filename, img]))
  return imagesCache
}

// Get main chapter and its subsections
function getChapterInfo(filename, chapters) {
  const match = filename.match(/ch(\d+)_/)
  if (!match) return null

  const chapterNum = parseInt(match[1], 10)
  const mainChapter = chapters.find(c => !c.parent_id && c.order_index === chapterNum)
  if (!mainChapter) return null

  const subsections = chapters.filter(c => c.parent_id === mainChapter.id)
    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))

  return { mainChapter, subsections }
}

// Find best matching subsection by title
function findSubsectionByTitle(title, subsections) {
  if (!title || !subsections.length) return null

  const normalizedTitle = title.toLowerCase().trim()

  // Exact match
  for (const sub of subsections) {
    if (sub.title.toLowerCase().trim() === normalizedTitle) {
      return sub.id
    }
  }

  // Partial match - title contains or is contained
  for (const sub of subsections) {
    const subTitle = sub.title.toLowerCase().trim()
    if (subTitle.includes(normalizedTitle) || normalizedTitle.includes(subTitle)) {
      return sub.id
    }
  }

  // Word overlap match
  const titleWords = normalizedTitle.split(/\s+/).filter(w => w.length > 3)
  let bestMatch = null
  let bestScore = 0
  for (const sub of subsections) {
    const subWords = sub.title.toLowerCase().split(/\s+/)
    const overlap = titleWords.filter(w => subWords.some(sw => sw.includes(w) || w.includes(sw))).length
    if (overlap > bestScore) {
      bestScore = overlap
      bestMatch = sub.id
    }
  }
  if (bestScore >= 1) return bestMatch

  return null
}

// Detect schema type
function detectSchema(content) {
  if (content.subsections?.some(s => s.items)) return 'subsections_items'
  if (content.subsections?.some(s => s.content)) return 'subsections_content'
  if (content.subsections) return 'subsections'
  if (content.sections) return 'sections'
  if (content.extractions) return 'extractions'
  if (content.items) return 'items_flat'
  if (content.concepts || content.examples || content.exercises) return 'categorized'
  return 'unknown'
}

// Extract items with subsection info
function extractItemsWithSubsection(content, schema) {
  const items = []

  switch (schema) {
    case 'items_flat':
      // No subsection info in flat items
      return (content.items || []).map(item => ({ ...item, _subsectionTitle: null }))

    case 'subsections_items':
      for (const sub of content.subsections || []) {
        for (const item of sub.items || []) {
          items.push({ ...item, _subsectionTitle: sub.title })
        }
      }
      return items

    case 'subsections_content':
      for (const sub of content.subsections || []) {
        if (Array.isArray(sub.content)) {
          for (const item of sub.content) {
            items.push({ ...item, _subsectionTitle: sub.title, type: sub.type || item.type })
          }
        } else if (sub.content) {
          items.push({ content: sub.content, _subsectionTitle: sub.title, type: sub.type })
        } else {
          items.push({ ...sub, _subsectionTitle: sub.title })
        }
      }
      return items

    case 'sections':
      for (const section of content.sections || []) {
        if (section.content && Array.isArray(section.content)) {
          for (const item of section.content) {
            items.push({ ...item, _subsectionTitle: section.title })
          }
        } else if (section.content && typeof section.content === 'string') {
          items.push({ type: section.type || 'concept', content_latex: section.content, _subsectionTitle: section.title })
        }
        if (section.type && !section.content) {
          items.push({ ...section, _subsectionTitle: section.title })
        }
      }
      return items

    case 'extractions':
      for (const ext of content.extractions || []) {
        items.push({ ...ext, _subsectionTitle: ext.section })
      }
      return items

    case 'categorized':
      const subTitle = content.title || content.chapter || null
      for (const concept of content.concepts || []) {
        items.push({ ...concept, type: 'concept', _subsectionTitle: subTitle })
      }
      for (const example of content.examples || []) {
        items.push({ ...example, type: 'example', _subsectionTitle: subTitle })
      }
      for (const exercise of content.exercises || []) {
        items.push({ ...exercise, type: 'exercise', _subsectionTitle: subTitle })
      }
      return items

    default:
      if (content.items) return content.items.map(i => ({ ...i, _subsectionTitle: null }))
      return []
  }
}

// Normalize item type
function normalizeType(type) {
  if (!type) return 'concept'
  const t = type.toLowerCase()
  if (t.includes('example') || t === 'worked_example') return 'example'
  if (t.includes('exercise') || t === 'practice' || t === 'problem') return 'exercise'
  return 'concept'
}

// Extract title from content
function extractTitle(item) {
  if (item.title) return item.title
  if (item.example_number) return `Example ${item.example_number}`
  if (item.exercise_number) return `Exercise ${item.exercise_number}`

  const content = item.content_latex || item.content
  if (typeof content === 'string') {
    const match = content.match(/\*\*([^*]+)\*\*/)
    if (match) return match[1].substring(0, 100)
  }

  return null
}

// Get first source image
function getSourceImage(item, imagesMap) {
  const images = item.source_images || item.images || []
  const imgName = Array.isArray(images) ? images[0] : item.image || item.source_image
  if (!imgName) return null
  return imagesMap.get(imgName)?.id || null
}

// Parse questions from item
function parseQuestions(item) {
  const questions = []

  if (item.questions && Array.isArray(item.questions)) {
    for (const q of item.questions) {
      questions.push({
        label: q.label || null,
        problem_latex: q.latex || q.problem_latex || q.question || q.content || q.text || '',
        problem_text: q.text || null,
        answer_latex: q.answer_latex || q.answer || q.solution || null,
        solution_steps: q.solution_steps || q.steps || null,
        choices: q.choices || q.options || null,
        has_answer: !!(q.answer_latex || q.answer || q.solution)
      })
    }
    return questions
  }

  const content = item.content_latex || item.content || ''
  if (content && item.type !== 'concept') {
    questions.push({
      label: null,
      problem_latex: typeof content === 'string' ? content : JSON.stringify(content),
      problem_text: null,
      answer_latex: item.answer_latex || item.answer || null,
      solution_steps: item.solution_steps || null,
      choices: null,
      has_answer: !!(item.answer_latex || item.answer)
    })
  }

  return questions
}

// Process a single file
async function processFile(filePath, chapters, imagesMap, dryRun = false) {
  const filename = basename(filePath)
  console.log(`\n📄 ${filename}`)

  let content
  try {
    content = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch (e) {
    console.log(`  ⚠️ JSON parse error: ${e.message.slice(0, 50)}`)
    return { items: 0, questions: 0, errors: 1 }
  }

  const schema = detectSchema(content)
  const chapterInfo = getChapterInfo(filename, chapters)

  if (!chapterInfo) {
    console.log(`  ⚠️ Could not match chapter`)
    return { items: 0, questions: 0, errors: 1 }
  }

  const { mainChapter, subsections } = chapterInfo
  console.log(`  Schema: ${schema}, Main: ${mainChapter.title} (${subsections.length} subsections)`)

  const rawItems = extractItemsWithSubsection(content, schema)
  if (rawItems.length === 0) {
    console.log(`  ⚠️ No items found`)
    return { items: 0, questions: 0, errors: 0 }
  }

  // Group items by subsection for reporting
  const itemsBySubsection = new Map()

  let itemsInserted = 0
  let questionsInserted = 0

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i]

    // Determine target chapter (subsection or main)
    let targetChapterId = mainChapter.id
    let targetName = mainChapter.title

    if (raw._subsectionTitle) {
      // Method 1: Match by subsection title from JSON
      const subId = findSubsectionByTitle(raw._subsectionTitle, subsections)
      if (subId) {
        targetChapterId = subId
        targetName = subsections.find(s => s.id === subId)?.title || raw._subsectionTitle
      }
    } else {
      // Method 2: Match by source image's chapter_id
      const images = raw.source_images || raw.images || []
      const imgName = Array.isArray(images) ? images[0] : raw.image || raw.source_image
      if (imgName) {
        const imgData = imagesMap.get(imgName)
        if (imgData && imgData.chapter_id) {
          // Check if this image's chapter is a subsection of our main chapter
          const matchingSub = subsections.find(s => s.id === imgData.chapter_id)
          if (matchingSub) {
            targetChapterId = matchingSub.id
            targetName = matchingSub.title
          }
        }
      }
    }

    // Track for reporting
    if (!itemsBySubsection.has(targetName)) {
      itemsBySubsection.set(targetName, 0)
    }
    itemsBySubsection.set(targetName, itemsBySubsection.get(targetName) + 1)

    const itemData = {
      chapter_id: targetChapterId,
      type: normalizeType(raw.type),
      title: extractTitle(raw),
      instruction: raw.instruction || raw.description || null,
      source_image_id: getSourceImage(raw, imagesMap),
      order_index: i + 1
    }

    if (dryRun) {
      itemsInserted++
      continue
    }

    const { data: insertedItem, error: itemError } = await supabase
      .from('items')
      .insert(itemData)
      .select()
      .single()

    if (itemError) {
      console.log(`  ❌ Item insert error: ${itemError.message}`)
      continue
    }

    itemsInserted++

    const questions = parseQuestions(raw)
    for (const q of questions) {
      if (!q.problem_latex) continue

      const questionData = {
        item_id: insertedItem.id,
        source_image_id: getSourceImage(raw, imagesMap),
        label: q.label,
        problem_latex: q.problem_latex,
        problem_text: q.problem_text,
        has_answer: q.has_answer,
        answer_latex: q.answer_latex,
        solution_steps: q.solution_steps,
        choices: q.choices
      }

      const { error: qError } = await supabase
        .from('questions')
        .insert(questionData)

      if (qError) {
        console.log(`  ❌ Question insert error: ${qError.message}`)
      } else {
        questionsInserted++
      }
    }
  }

  // Report distribution
  for (const [name, count] of itemsBySubsection) {
    const indicator = name === mainChapter.title ? '📁' : '  📂'
    console.log(`${indicator} ${name}: ${count} items`)
  }
  console.log(`  ✅ Total: ${itemsInserted} items, ${questionsInserted} questions`)

  return { items: itemsInserted, questions: questionsInserted, errors: 0 }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const singleFile = args.find(a => a.endsWith('.json'))

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No data will be inserted\n')
  }

  console.log('Loading chapters and images...')
  const chapters = await loadChapters()
  const imagesMap = await loadImages()
  console.log(`Loaded ${chapters.length} chapters, ${imagesMap.size} images`)

  let files
  if (singleFile) {
    files = [join(EXTRACTIONS_DIR, singleFile)]
  } else {
    files = readdirSync(EXTRACTIONS_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .map(f => join(EXTRACTIONS_DIR, f))
  }

  console.log(`\nProcessing ${files.length} files...`)

  let totalItems = 0
  let totalQuestions = 0
  let totalErrors = 0

  for (const file of files) {
    const result = await processFile(file, chapters, imagesMap, dryRun)
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
