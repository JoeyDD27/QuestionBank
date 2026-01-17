export interface Source {
  id: string
  filename: string
  subject: string | null
  created_at: string
}

export interface Chapter {
  id: string
  source_id: string | null
  title: string
  parent_id: string | null
  order_index: number | null
}

export interface Image {
  id: string
  source_id: string | null
  filename: string
  storage_path: string
  chapter_id: string | null
}

export interface Item {
  id: string
  chapter_id: string | null
  type: 'concept' | 'example' | 'exercise'
  title: string | null
  instruction: string | null
  source_image_id: string | null
  order_index: number | null
}

export interface Question {
  id: string
  item_id: string | null
  source_image_id: string | null
  label: string | null
  problem_latex: string
  problem_text: string | null
  has_answer: boolean
  answer_latex: string | null
  solution_steps: { latex: string; explanation: string }[] | null
  choices: { label: string; text: string }[] | null
  tags: string[] | null
  created_at: string
}

export interface ChapterWithSubsections extends Chapter {
  subsections?: Chapter[]
  image_count?: number
}
