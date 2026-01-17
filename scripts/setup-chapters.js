import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SUPABASE_URL = 'https://orfxntmcywouoqpasivm.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const SOURCE_ID = 'a6cb81ed-4fef-4059-93b2-311d69fd45b7'

async function setupChapters() {
  const sections = JSON.parse(readFileSync('section_index.json', 'utf-8'))

  console.log('Inserting chapters...')

  for (let i = 0; i < sections.length; i++) {
    const chapter = sections[i]

    // Insert main chapter
    const { data: chapterData, error: chapterError } = await supabase
      .from('chapters')
      .insert({
        source_id: SOURCE_ID,
        title: chapter.title,
        order_index: i + 1
      })
      .select()
      .single()

    if (chapterError) {
      console.error(`Failed to insert chapter ${i + 1}:`, chapterError)
      continue
    }

    console.log(`Ch${i + 1}: ${chapter.title} (id: ${chapterData.id})`)

    // Insert subsections
    if (chapter.subsections) {
      for (let j = 0; j < chapter.subsections.length; j++) {
        const sub = chapter.subsections[j]

        const { data: subData, error: subError } = await supabase
          .from('chapters')
          .insert({
            source_id: SOURCE_ID,
            title: sub.title,
            parent_id: chapterData.id,
            order_index: j + 1
          })
          .select()
          .single()

        if (subError) {
          console.error(`  Failed to insert subsection:`, subError)
          continue
        }

        // Insert images for this subsection
        if (sub.images && sub.images.length > 0) {
          const uniqueImages = [...new Set(sub.images)]
          const imageRecords = uniqueImages.map(img => ({
            source_id: SOURCE_ID,
            filename: img,
            storage_path: `algebra/${img}`,
            chapter_id: subData.id
          }))

          const { error: imgError } = await supabase
            .from('images')
            .insert(imageRecords)

          if (imgError) {
            console.error(`  Failed to insert images:`, imgError)
          } else {
            console.log(`  - ${sub.title} (${uniqueImages.length} images)`)
          }
        }
      }
    }
  }

  console.log('\nDone!')
}

setupChapters().catch(console.error)
