'use client';

import { useState, useRef } from 'react';
import { MathRenderer } from './MathRenderer';
import { useWorksheet, WorksheetQuestion } from '@/context/WorksheetContext';
import { uploadFigure, deleteFigure, getFigureUrl } from '@/lib/supabase';

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

export interface QuestionFigure {
  id: string;
  storage_path: string;
  order_index: number;
}

export interface QuestionData {
  id: string;
  problem_latex: string;
  answer_latex: string | null;
  has_answer: boolean;
  metadata: QuestionMetadata | null;
  // Supabase returns nested relations as arrays
  item: {
    type: string;
    source_image_ids?: string[];
    chapter: {
      title: string;
    }[] | { title: string };
  }[] | {
    type: string;
    source_image_ids?: string[];
    chapter: {
      title: string;
    }[] | { title: string };
  };
  figures?: QuestionFigure[];
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

// Helper to convert QuestionData to WorksheetQuestion
export function toWorksheetQuestion(question: QuestionData): WorksheetQuestion {
  const item = Array.isArray(question.item) ? question.item[0] : question.item;
  const itemType = item?.type || 'unknown';
  const chapter = item?.chapter;
  const chapterTitle = Array.isArray(chapter) ? chapter[0]?.title : chapter?.title || '';
  const sourceImageIds = item?.source_image_ids || [];

  // Convert figures to URLs
  const figureUrls = question.figures
    ?.sort((a, b) => a.order_index - b.order_index)
    .map(f => getFigureUrl(f.storage_path)) || [];

  return {
    id: question.id,
    problem_latex: question.problem_latex,
    answer_latex: question.answer_latex,
    chapterTitle,
    itemType,
    metadata: question.metadata ? {
      difficulty: question.metadata.difficulty,
      question_type: question.metadata.question_type,
      topics: question.metadata.topics,
    } : null,
    sourceImageIds,
    figureUrls,
  };
}

interface QuestionCardProps {
  question: QuestionData;
  index: number;
  onFiguresChange?: () => void;
}

export function QuestionCard({ question, index, onFiguresChange }: QuestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [localFigures, setLocalFigures] = useState(question.figures || []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isSelected, toggle } = useWorksheet();

  const metadata = question.metadata || {};
  const difficulty = metadata.difficulty;
  const selected = isSelected(question.id);

  // Handle Supabase nested relation arrays
  const item = Array.isArray(question.item) ? question.item[0] : question.item;
  const itemType = item?.type || 'unknown';
  const chapter = item?.chapter;
  const chapterTitle = Array.isArray(chapter) ? chapter[0]?.title : chapter?.title;
  const hasSourceImages = item?.source_image_ids && item.source_image_ids.length > 0;

  const handleToggle = () => {
    toggle(toWorksheetQuestion({ ...question, figures: localFigures }));
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadFigure(question.id, file);
      if (result) {
        const newFigure: QuestionFigure = {
          id: result.id,
          storage_path: result.storage_path,
          order_index: localFigures.length,
        };
        setLocalFigures(prev => [...prev, newFigure]);
        onFiguresChange?.();
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteFigure = async (figureId: string) => {
    if (!confirm('删除此图表？')) return;
    const success = await deleteFigure(figureId);
    if (success) {
      setLocalFigures(prev => prev.filter(f => f.id !== figureId));
      onFiguresChange?.();
    }
  };

  // Truncate long content for preview
  const previewContent = question.problem_latex.length > 300 && !expanded
    ? question.problem_latex.slice(0, 300) + '...'
    : question.problem_latex;

  return (
    <div className={`bg-white border rounded-lg p-4 hover:shadow-md transition-shadow ${selected ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={selected}
            onChange={handleToggle}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
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

          {/* No Answer Warning */}
          {!question.answer_latex && (
            <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
              无答案
            </span>
          )}

          {/* Has source images indicator */}
          {hasSourceImages && (
            <span className="px-2 py-0.5 text-xs bg-violet-100 text-violet-700 rounded">
              有原图
            </span>
          )}
        </div>

        {/* Upload figure button - right side */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1 transition-colors"
          >
            {uploading ? (
              <span>上传中...</span>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>上传图表</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Chapter Info */}
      <div className="text-xs text-gray-500 mb-2">
        {chapterTitle}
      </div>

      {/* Figures Section */}
      {localFigures.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {/* Display uploaded figures */}
          {localFigures
            .sort((a, b) => a.order_index - b.order_index)
            .map((fig) => (
              <div key={fig.id} className="relative group">
                <img
                  src={getFigureUrl(fig.storage_path)}
                  alt="Figure"
                  className="h-16 w-auto rounded border cursor-pointer hover:opacity-90"
                  onClick={() => setLightboxUrl(getFigureUrl(fig.storage_path))}
                />
                <button
                  onClick={() => handleDeleteFigure(fig.id)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  title="删除"
                >
                  ×
                </button>
              </div>
            ))}
        </div>
      )}

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

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Figure enlarged"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
