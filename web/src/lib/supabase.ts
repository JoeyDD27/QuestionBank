import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const STORAGE_URL = `${supabaseUrl}/storage/v1/object/public/question-images`
export const FIGURES_STORAGE_URL = `${supabaseUrl}/storage/v1/object/public/question-figures`

export function getImageUrl(filename: string): string {
  return `${STORAGE_URL}/algebra/${filename}`
}

export function getFigureUrl(storagePath: string): string {
  return `${FIGURES_STORAGE_URL}/${storagePath}`
}

// Compress image before upload
async function compressImage(file: File, maxWidth: number = 800, quality: number = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      let { width, height } = img

      // Scale down if too wide
      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height
      ctx?.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to compress image'))
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

// Upload a figure image for a question
export async function uploadFigure(questionId: string, file: File): Promise<{ id: string; storage_path: string } | null> {
  try {
    // Compress image
    const compressed = await compressImage(file, 800, 0.8)

    // Generate unique path
    const ext = 'jpg'
    const path = `${questionId}/${crypto.randomUUID()}.${ext}`

    // Upload to Storage
    const { error: uploadError } = await supabase.storage
      .from('question-figures')
      .upload(path, compressed, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return null
    }

    // Get current max order_index for this question
    const { data: existingFigures } = await supabase
      .from('question_figures')
      .select('order_index')
      .eq('question_id', questionId)
      .order('order_index', { ascending: false })
      .limit(1)

    const nextOrder = existingFigures && existingFigures.length > 0
      ? (existingFigures[0].order_index || 0) + 1
      : 0

    // Insert record
    const { data, error: insertError } = await supabase
      .from('question_figures')
      .insert({
        question_id: questionId,
        storage_path: path,
        filename: file.name,
        order_index: nextOrder,
      })
      .select('id, storage_path')
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      // Cleanup: remove uploaded file
      await supabase.storage.from('question-figures').remove([path])
      return null
    }

    return data
  } catch (e) {
    console.error('uploadFigure error:', e)
    return null
  }
}

// Delete a figure
export async function deleteFigure(figureId: string): Promise<boolean> {
  try {
    // Get storage path first
    const { data, error: selectError } = await supabase
      .from('question_figures')
      .select('storage_path')
      .eq('id', figureId)
      .single()

    if (selectError || !data) {
      console.error('Failed to find figure:', selectError)
      return false
    }

    // Delete from Storage
    const { error: storageError } = await supabase.storage
      .from('question-figures')
      .remove([data.storage_path])

    if (storageError) {
      console.error('Storage delete error:', storageError)
      // Continue to delete DB record anyway
    }

    // Delete from DB
    const { error: deleteError } = await supabase
      .from('question_figures')
      .delete()
      .eq('id', figureId)

    if (deleteError) {
      console.error('DB delete error:', deleteError)
      return false
    }

    return true
  } catch (e) {
    console.error('deleteFigure error:', e)
    return false
  }
}

// Get source image URLs from image IDs
export async function getSourceImageUrls(imageIds: string[]): Promise<string[]> {
  if (!imageIds || imageIds.length === 0) return []

  const { data, error } = await supabase
    .from('images')
    .select('filename')
    .in('id', imageIds)

  if (error || !data) return []

  return data.map(img => getImageUrl(img.filename))
}
