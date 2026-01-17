import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://orfxntmcywouoqpasivm.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!SUPABASE_KEY) {
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const BUCKET = 'question-images'
const MEDIA_DIR = './docx_extracted/word/media'
const BATCH_SIZE = 50

async function uploadImages() {
  console.log('Reading images from', MEDIA_DIR)

  const files = readdirSync(MEDIA_DIR)
    .filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.gif'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0')
      const numB = parseInt(b.match(/\d+/)?.[0] || '0')
      return numA - numB
    })

  console.log(`Found ${files.length} images to upload`)

  let uploaded = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE)

    const results = await Promise.allSettled(
      batch.map(async (filename) => {
        const filePath = join(MEDIA_DIR, filename)
        const fileBuffer = readFileSync(filePath)
        const storagePath = `algebra/${filename}`

        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, fileBuffer, {
            contentType: filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
            upsert: true
          })

        if (error) {
          if (error.message?.includes('already exists')) {
            return { status: 'skipped', filename }
          }
          throw new Error(`${filename}: ${error.message}`)
        }
        return { status: 'uploaded', filename }
      })
    )

    results.forEach(r => {
      if (r.status === 'fulfilled') {
        if (r.value.status === 'uploaded') uploaded++
        else skipped++
      } else {
        console.error('Failed:', r.reason)
        failed++
      }
    })

    console.log(`Progress: ${Math.min(i + BATCH_SIZE, files.length)}/${files.length} (uploaded: ${uploaded}, skipped: ${skipped}, failed: ${failed})`)
  }

  console.log('\n=== Upload Complete ===')
  console.log(`Uploaded: ${uploaded}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total: ${files.length}`)

  // Get public URL format
  console.log(`\nPublic URL format: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/algebra/{filename}`)
}

uploadImages().catch(console.error)
