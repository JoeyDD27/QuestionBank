# Extraction Guide for QuestionBank

## Content Types

1. **concept** - Definitions, explanations, key points
2. **example** - Worked examples with solutions
3. **exercise** - Practice problems (may or may not have answers)

## JSON Output Format

```json
{
  "chapter": "Chapter Title",
  "subsection": "Subsection Title",
  "items": [
    {
      "type": "concept",
      "title": "Definition name",
      "content_latex": "$$...$$",
      "content_text": "Plain text version",
      "source_images": ["image1.png"]
    },
    {
      "type": "example",
      "title": "Example 1",
      "instruction": "Write in product notation:",
      "questions": [
        {
          "label": "a",
          "problem_latex": "$t \\times 6s$",
          "answer_latex": "$6st$",
          "solution_steps": [
            {"latex": "$t \\times 6s$", "explanation": "Original expression"},
            {"latex": "$= 6st$", "explanation": "Rewrite without × symbol"}
          ]
        }
      ],
      "source_images": ["image1.png"]
    },
    {
      "type": "exercise",
      "title": "Exercise 1A",
      "instruction": "Simplify the following:",
      "questions": [
        {
          "label": "1",
          "problem_latex": "$3x + 2x$",
          "has_answer": false
        }
      ],
      "source_images": ["image5.png", "image6.png"]
    }
  ]
}
```

## Storage URLs

Images are stored at:
`https://orfxntmcywouoqpasivm.supabase.co/storage/v1/object/public/question-images/algebra/{filename}`

## Supabase Project

- Project ID: `orfxntmcywouoqpasivm`
- URL: `https://orfxntmcywouoqpasivm.supabase.co`
