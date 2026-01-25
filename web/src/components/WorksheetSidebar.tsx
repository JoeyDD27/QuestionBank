'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWorksheet } from '@/context/WorksheetContext';

export function WorksheetSidebar() {
  const { selected, remove, clear, isLoaded } = useWorksheet();
  const [collapsed, setCollapsed] = useState(true);

  // Auto-expand when loaded and there are selected items
  useEffect(() => {
    if (isLoaded && selected.length > 0) {
      setCollapsed(false);
    }
  }, [isLoaded, selected.length]);

  // Truncate text for display
  const truncate = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
  };

  // Get first line/question of content for preview
  const getPreview = (latex: string) => {
    const firstLine = latex.split('\n')[0];
    // Remove LaTeX markers for cleaner preview
    const clean = firstLine.replace(/[｢｣$]/g, '').trim();
    return truncate(clean, 40);
  };

  // Collapsed view - just a toggle button with count
  if (collapsed) {
    return (
      <aside className="w-12 bg-white border-l flex flex-col items-center py-4">
        <button
          onClick={() => setCollapsed(false)}
          className="relative p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Show worksheet"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {selected.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
              {selected.length}
            </span>
          )}
        </button>
        {selected.length > 0 && (
          <Link
            href="/worksheet"
            className="mt-4 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Preview worksheet"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </Link>
        )}
      </aside>
    );
  }

  return (
    <aside className="w-72 bg-white border-l flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Worksheet</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{selected.length} selected</span>
            <button
              onClick={() => setCollapsed(true)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              title="Collapse"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Selected questions list */}
      <div className="flex-1 overflow-y-auto p-2">
        {selected.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Click checkboxes to add questions
          </div>
        ) : (
          <ul className="space-y-1">
            {selected.map((q, idx) => (
              <li
                key={q.id}
                className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 group"
              >
                <span className="text-xs text-gray-400 mt-0.5">{idx + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">
                    {getPreview(q.problem_latex)}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {q.chapterTitle}
                  </p>
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
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t space-y-2">
        {selected.length > 0 && (
          <>
            <Link
              href="/worksheet"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Preview & Print
            </Link>
            <button
              onClick={clear}
              className="w-full px-4 py-2 text-gray-600 hover:text-red-600 text-sm"
            >
              Clear All
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
