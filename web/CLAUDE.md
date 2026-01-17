# QuestionBank Web

Math question bank for tutoring teachers to select and print practice worksheets.

## Project Goal

- Teachers browse/filter questions by chapter
- Generate printable practice sheets (questions + separate answer key)
- Future: filter by difficulty, question type

## Commands

```bash
npm run dev      # Start dev server (port 3001)
npm run build    # Production build
npm run lint     # ESLint
```

## Stack

- Next.js 16.1.3 (App Router, Server Components)
- React 19, TypeScript 5
- Supabase (PostgreSQL + Storage)
- Tailwind CSS v4
- KaTeX (math rendering)

## Structure

```
src/
├── app/                    # App Router pages
│   ├── page.tsx           # Home - chapter list
│   └── chapter/[id]/      # Chapter detail page
├── lib/
│   ├── supabase.ts        # Supabase client + image URL helper
│   └── types.ts           # Database interfaces
```

## Database Schema

**Supabase Project**: `orfxntmcywouoqpasivm`

### Tables

- `sources` - Document sources (e.g., "Algebra full.docx")
- `chapters` - Hierarchical chapters (parent_id for nesting)
- `images` - Image metadata, stored in Storage bucket `question-images/algebra/`
- `items` - Content items (concept/example/exercise)
- `questions` - Math problems with LaTeX

### Key Relationships

```
sources → chapters → items → questions
                  → images
```

## Environment

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://orfxntmcywouoqpasivm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-key>
```

## Image Storage

Images in Supabase Storage bucket `question-images/algebra/`.

Access URL pattern:
```
https://orfxntmcywouoqpasivm.supabase.co/storage/v1/object/public/question-images/algebra/{filename}
```

Use `getImageUrl(filename)` from `src/lib/supabase.ts`.

## Data Extraction

Extracted content from Word doc images stored in `/extractions/*.json` (70 files, 2.5MB).

### Extraction Quality (Verified)
- LaTeX formulas: accurate (fractions, roots, exponents, logs all correct)
- Questions + answers: complete
- Ready for conversion and import

### JSON Format Variations
The 70 files use ~8 different schemas:
- `subsections → items[]`
- `subsections → content[]`
- `sections → content[]`
- `sections → concepts[]`
- `topics → content[] + exercises[]`
- `extractions[]`
- `items[]` (flat)
- `concepts[] + examples[] + exercises[]`

**Next step**: Write conversion script to unify all formats into target schema.

### Local Images
Original images at: `/docx_extracted/word/media/image*.png`

### Target Schema for Import
```
Item: chapter_id, type (concept/example/exercise), title, instruction
Question: item_id, label, problem_latex, answer_latex, solution_steps, has_answer
```

## Patterns

- Server Components for data fetching (no `use client`)
- Direct Supabase queries in page components
- next/image with Supabase remote patterns configured
