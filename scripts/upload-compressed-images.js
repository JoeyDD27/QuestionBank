#!/usr/bin/env node
/**
 * Upload compressed images to Supabase storage, replacing originals
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
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
const COMPRESSED_DIR = join(__dirname, '..', 'docx_extracted', 'word', 'media_compressed')
const BUCKET = 'question-images'
const FOLDER = 'algebra'

async function main() {
  const files = readdirSync(COMPRESSED_DIR).filter(f => f.endsWith('.png'))
  console.log(`Found ${files.length} compressed images to upload`)

  let uploaded = 0
  let errors = 0

  for (let i = 0; i < files.length; i++) {
    const filename = files[i]
    const filePath = join(COMPRESSED_DIR, filename)
    const storagePath = `${FOLDER}/${filename}`

    try {
      const fileBuffer = readFileSync(filePath)

      // Upload with upsert to replace existing
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: 'image/png',
          upsert: true
        })

      if (error) {
        console.error(`❌ ${filename}: ${error.message}`)
        errors++
      } else {
        uploaded++
        if (uploaded % 100 === 0) {
          console.log(`✓ Uploaded ${uploaded}/${files.length}`)
        }
      }
    } catch (e) {
      console.error(`❌ ${filename}: ${e.message}`)
      errors++
    }
  }

  console.log(`\n========================================`)
  console.log(`Uploaded: ${uploaded}`)
  console.log(`Errors: ${errors}`)
}

main().catch(console.error)
