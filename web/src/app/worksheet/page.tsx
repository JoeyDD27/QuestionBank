'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useWorksheet } from '@/context/WorksheetContext';
import { SortableItem } from '@/components/SortableItem';
import { WorksheetPrintView } from '@/components/WorksheetPrintView';
import { exportToWord } from '@/lib/export-word';

export default function WorksheetPage() {
  const { selected, remove, reorder, clear, toggleOriginalImage } = useWorksheet();
  const [previewMode, setPreviewMode] = useState<'questions' | 'answers'>('questions');
  const [compactLayout, setCompactLayout] = useState(false);
  const [hideSolutions, setHideSolutions] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = selected.findIndex(q => q.id === active.id);
      const newIndex = selected.findIndex(q => q.id === over.id);
      reorder(oldIndex, newIndex);
    }
  };

  const handlePrint = (mode: 'questions' | 'answers') => {
    const params = new URLSearchParams({
      mode,
      compactLayout: compactLayout.toString(),
      hideSolutions: hideSolutions.toString(),
    });
    window.open(`/worksheet/print?${params.toString()}`, '_blank');
  };

  // Truncate text for display
  const truncate = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
  };

  const getPreview = (latex: string) => {
    const firstLine = latex.split('\n')[0];
    const clean = firstLine.replace(/[｢｣$]/g, '').trim();
    return truncate(clean, 60);
  };

  if (selected.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <Link href="/" className="text-xl font-bold text-gray-900 hover:text-blue-600">
                QuestionBank
              </Link>
              <span className="text-gray-400 mx-2">/</span>
              <span className="text-gray-600">Worksheet</span>
            </div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">No questions selected</p>
            <Link
              href="/questions"
              className="text-blue-600 hover:text-blue-800"
            >
              Go to Questions to select some
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <Link href="/" className="text-xl font-bold text-gray-900 hover:text-blue-600">
              QuestionBank
            </Link>
            <span className="text-gray-400 mx-2">/</span>
            <span className="text-gray-600">Worksheet ({selected.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Compact toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={compactLayout}
                onChange={(e) => setCompactLayout(e.target.checked)}
                className="rounded"
              />
              Compact
            </label>
            {/* Hide Solutions toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-600 mr-2">
              <input
                type="checkbox"
                checked={hideSolutions}
                onChange={(e) => setHideSolutions(e.target.checked)}
                className="rounded"
              />
              Hide Solutions
            </label>
            <div className="w-px h-6 bg-gray-300" />
            <button
              onClick={() => handlePrint('questions')}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button
              onClick={() => handlePrint('answers')}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Answers
            </button>
            <div className="w-px h-6 bg-gray-300" />
            <button
              onClick={() => exportToWord(selected, 'questions', 'Worksheet', false, hideSolutions)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Word
            </button>
            <button
              onClick={() => exportToWord(selected, 'answers', 'Worksheet', false, hideSolutions)}
              className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Word Ans
            </button>
            <Link
              href="/questions"
              className="text-sm text-gray-500 hover:text-blue-600 ml-2"
            >
              ← Back
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Left panel: Selected questions */}
        <div className="w-80 bg-white border-r flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Selected ({selected.length})</h2>
              <p className="text-xs text-gray-500">Drag to reorder</p>
            </div>
            <button
              onClick={clear}
              className="text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
            >
              Clear
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={selected.map(q => q.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-1">
                  {selected.map((q, idx) => {
                    const hasSourceImages = q.sourceImageIds && q.sourceImageIds.length > 0;
                    return (
                      <SortableItem key={q.id} id={q.id}>
                        <div className="flex items-start gap-2 p-2 rounded bg-gray-50 group">
                          <span className="text-xs text-gray-400 mt-0.5 w-5">{idx + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 truncate">
                              {getPreview(q.problem_latex)}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs text-gray-400 truncate">
                                {q.chapterTitle}
                              </p>
                              {hasSourceImages && (
                                <button
                                  onClick={() => toggleOriginalImage(q.id)}
                                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                                    q.useOriginalImage
                                      ? 'bg-violet-600 text-white'
                                      : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
                                  }`}
                                >
                                  {q.useOriginalImage ? '✓ 用原图' : '用原图'}
                                </button>
                              )}
                              {q.figureUrls && q.figureUrls.length > 0 && (
                                <span className="text-xs text-teal-600">
                                  {q.figureUrls.length} 图
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => remove(q.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </SortableItem>
                    );
                  })}
                </ul>
              </SortableContext>
            </DndContext>
          </div>

        </div>

        {/* Right panel: Preview */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Preview mode toggle */}
          <div className="mb-4 flex items-center gap-2">
            <button
              onClick={() => setPreviewMode('questions')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                previewMode === 'questions'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Questions
            </button>
            <button
              onClick={() => setPreviewMode('answers')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                previewMode === 'answers'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Answers
            </button>
          </div>

          {/* Preview content */}
          <div className="bg-white border rounded-lg shadow-sm p-8 max-w-3xl mx-auto">
            <WorksheetPrintView
              questions={selected}
              mode={previewMode}
              compactLayout={compactLayout}
              hideSolutions={hideSolutions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
