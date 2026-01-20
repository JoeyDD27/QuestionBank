'use client';

import { useState } from 'react';
import { MathRenderer } from './MathRenderer';

interface QuestionMetadata {
  difficulty?: number;
  question_type?: string;
  skills?: string[];
  topics?: string[];
  ib_topics?: string[];
  grade_levels?: string[];
  exam_types?: string[];
  level?: string;
  flags?: string[];
  sub_question_count?: number;
}

interface QuestionData {
  id: string;
  problem_latex: string;
  answer_latex: string | null;
  has_answer: boolean;
  metadata: QuestionMetadata | null;
  // Supabase returns nested relations as arrays
  item: {
    type: string;
    chapter: {
      title: string;
    }[] | { title: string };
  }[] | {
    type: string;
    chapter: {
      title: string;
    }[] | { title: string };
  };
}

interface QuestionCardProps {
  question: QuestionData;
  index: number;
}

const DIFFICULTY_COLORS: Record<number, string> = {
  1: 'bg-green-100 text-green-800',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-yellow-100 text-yellow-800',
  4: 'bg-orange-100 text-orange-800',
  5: 'bg-red-100 text-red-800',
};

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Basic',
  2: 'Easy',
  3: 'Medium',
  4: 'Hard',
  5: 'Competition',
};

const TYPE_COLORS: Record<string, string> = {
  concept: 'bg-purple-100 text-purple-800',
  example: 'bg-cyan-100 text-cyan-800',
  exercise: 'bg-emerald-100 text-emerald-800',
};

export function QuestionCard({ question, index }: QuestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const metadata = question.metadata || {};
  const difficulty = metadata.difficulty;

  // Handle Supabase nested relation arrays
  const item = Array.isArray(question.item) ? question.item[0] : question.item;
  const itemType = item?.type || 'unknown';
  const chapter = item?.chapter;
  const chapterTitle = Array.isArray(chapter) ? chapter[0]?.title : chapter?.title;

  // Truncate long content for preview
  const previewContent = question.problem_latex.length > 300 && !expanded
    ? question.problem_latex.slice(0, 300) + '...'
    : question.problem_latex;

  return (
    <div className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-500">#{index + 1}</span>

          {/* Item Type Badge */}
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${TYPE_COLORS[itemType] || 'bg-gray-100 text-gray-800'}`}>
            {itemType}
          </span>

          {/* Difficulty Badge */}
          {difficulty && (
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${DIFFICULTY_COLORS[difficulty] || 'bg-gray-100 text-gray-800'}`}>
              D{difficulty}: {DIFFICULTY_LABELS[difficulty]}
            </span>
          )}

          {/* Question Type */}
          {metadata.question_type && (
            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">
              {metadata.question_type.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>

      {/* Chapter Info */}
      <div className="text-xs text-gray-500 mb-2">
        {chapterTitle}
      </div>

      {/* Content */}
      <div className="text-sm text-gray-800">
        <MathRenderer content={previewContent} />
      </div>

      {/* Expand/Collapse for long content */}
      {question.problem_latex.length > 300 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-blue-600 hover:text-blue-800"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      {/* Answer Toggle */}
      {question.has_answer && question.answer_latex && (
        <div className="mt-3 pt-3 border-t">
          <button
            onClick={() => setShowAnswer(!showAnswer)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <span>{showAnswer ? '▼' : '▶'}</span>
            <span>{showAnswer ? 'Hide Answer' : 'Show Answer'}</span>
          </button>
          {showAnswer && (
            <div className="mt-2 p-3 bg-blue-50 rounded text-sm">
              <MathRenderer content={question.answer_latex} />
            </div>
          )}
        </div>
      )}

      {/* Metadata Details (expanded view) */}
      {expanded && (
        <div className="mt-3 pt-3 border-t">
          <div className="text-xs text-gray-600 space-y-1">
            {metadata.skills && metadata.skills.length > 0 && (
              <div>
                <span className="font-medium">Skills:</span>{' '}
                {metadata.skills.join(', ')}
              </div>
            )}
            {metadata.topics && metadata.topics.length > 0 && (
              <div>
                <span className="font-medium">Topics:</span>{' '}
                {[...new Set(metadata.topics)].join(', ')}
              </div>
            )}
            {metadata.ib_topics && metadata.ib_topics.length > 0 && (
              <div>
                <span className="font-medium">IB Topics:</span>{' '}
                {metadata.ib_topics.join(', ')}
              </div>
            )}
            {metadata.grade_levels && metadata.grade_levels.length > 0 && (
              <div>
                <span className="font-medium">Grade:</span>{' '}
                {metadata.grade_levels.join(', ')}
              </div>
            )}
            {metadata.flags && metadata.flags.length > 0 && (
              <div>
                <span className="font-medium">Flags:</span>{' '}
                {metadata.flags.join(', ')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
