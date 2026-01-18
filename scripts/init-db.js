#!/usr/bin/env node
/**
 * Initialize database with source and chapters from chapter_image_ranges.json
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
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

async function main() {
  console.log('Initializing database...\n')

  // 1. Create source
  console.log('Creating source...')
  const { data: source, error: sourceError } = await supabase
    .from('sources')
    .upsert({
      filename: 'Algebra full.docx',
      subject: 'Mathematics'
    }, { onConflict: 'filename' })
    .select()
    .single()

  if (sourceError) {
    // Try insert if upsert fails (no unique constraint)
    const { data: existingSource } = await supabase
      .from('sources')
      .select()
      .eq('filename', 'Algebra full.docx')
      .single()

    if (existingSource) {
      console.log(`  Source exists: ${existingSource.id}`)
      var sourceId = existingSource.id
    } else {
      const { data: newSource, error } = await supabase
        .from('sources')
        .insert({ filename: 'Algebra full.docx', subject: 'Mathematics' })
        .select()
        .single()
      if (error) throw error
      console.log(`  Created source: ${newSource.id}`)
      var sourceId = newSource.id
    }
  } else {
    console.log(`  Source: ${source.id}`)
    var sourceId = source.id
  }

  // 2. Read chapter_image_ranges.json
  const rangesPath = join(__dirname, '..', 'chapter_image_ranges.json')
  const ranges = JSON.parse(readFileSync(rangesPath, 'utf-8'))
  console.log(`\nLoaded ${Object.keys(ranges).length} chapters from chapter_image_ranges.json`)

  // 3. Create chapters
  console.log('\nCreating chapters...')
  const chapters = []

  for (const [chKey, info] of Object.entries(ranges)) {
    const orderIndex = parseInt(chKey.replace('ch', ''), 10)
    chapters.push({
      source_id: sourceId,
      title: info.title,
      order_index: orderIndex,
      parent_id: null
    })
  }

  // Check existing chapters
  const { data: existingChapters } = await supabase
    .from('chapters')
    .select('id, title, order_index')
    .eq('source_id', sourceId)

  if (existingChapters && existingChapters.length > 0) {
    console.log(`  Found ${existingChapters.length} existing chapters`)

    // Delete existing to start fresh
    const { error: deleteError } = await supabase
      .from('chapters')
      .delete()
      .eq('source_id', sourceId)

    if (deleteError) {
      console.error('  Failed to delete existing chapters:', deleteError.message)
      return
    }
    console.log('  Deleted existing chapters')
  }

  // Insert new chapters
  const { data: insertedChapters, error: chaptersError } = await supabase
    .from('chapters')
    .insert(chapters)
    .select()

  if (chaptersError) {
    console.error('Failed to insert chapters:', chaptersError.message)
    return
  }

  console.log(`  Created ${insertedChapters.length} chapters`)

  // 4. Summary
  console.log('\n' + '='.repeat(50))
  console.log('DATABASE INITIALIZED')
  console.log('='.repeat(50))
  console.log(`Source ID: ${sourceId}`)
  console.log(`Chapters: ${insertedChapters.length}`)
  console.log('\nChapter list:')

  for (const ch of insertedChapters.sort((a, b) => a.order_index - b.order_index)) {
    console.log(`  ${ch.order_index.toString().padStart(2)}. ${ch.title}`)
  }
}

main().catch(console.error)
