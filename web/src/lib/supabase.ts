import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const STORAGE_URL = `${supabaseUrl}/storage/v1/object/public/question-images`

export function getImageUrl(filename: string): string {
  return `${STORAGE_URL}/algebra/${filename}`
}
