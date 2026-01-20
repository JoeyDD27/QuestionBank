'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface Chapter {
  id: string;
  title: string;
}

interface FilterSidebarProps {
  chapters: Chapter[];
  totalCount: number;
  filteredCount: number;
}

const DIFFICULTIES = [
  { value: '1', label: 'Basic' },
  { value: '2', label: 'Easy' },
  { value: '3', label: 'Medium' },
  { value: '4', label: 'Hard' },
  { value: '5', label: 'Competition' },
];

const QUESTION_TYPES = [
  { value: 'calculation', label: 'Calculation' },
  { value: 'simplification', label: 'Simplification' },
  { value: 'equation_solving', label: 'Equation Solving' },
  { value: 'proof', label: 'Proof' },
  { value: 'application', label: 'Application' },
  { value: 'graphing', label: 'Graphing' },
  { value: 'fill_blank', label: 'Fill in Blank' },
  { value: 'explain', label: 'Explain' },
  { value: 'multi_part', label: 'Multi-part' },
  { value: 'true_false', label: 'True/False' },
];

const ITEM_TYPES = [
  { value: 'concept', label: 'Concept' },
  { value: 'example', label: 'Example' },
  { value: 'exercise', label: 'Exercise' },
];

export function FilterSidebar({ chapters, totalCount, filteredCount }: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentChapter = searchParams.get('chapter') || '';
  const currentDifficulties = searchParams.get('difficulty')?.split(',').filter(Boolean) || [];
  const currentTypes = searchParams.get('type')?.split(',').filter(Boolean) || [];
  const currentItemTypes = searchParams.get('itemType')?.split(',').filter(Boolean) || [];

  const updateParams = useCallback((key: string, value: string | string[]) => {
    const params = new URLSearchParams(searchParams.toString());

    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(key, value.join(','));
      } else {
        params.delete(key);
      }
    } else {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    // Reset to page 1 when filters change
    params.delete('page');

    router.push(`/questions?${params.toString()}`);
  }, [router, searchParams]);

  const toggleArrayValue = (current: string[], value: string) => {
    if (current.includes(value)) {
      return current.filter(v => v !== value);
    }
    return [...current, value];
  };

  const resetFilters = () => {
    router.push('/questions');
  };

  const hasFilters = currentChapter || currentDifficulties.length > 0 || currentTypes.length > 0 || currentItemTypes.length > 0;

  return (
    <div className="w-64 flex-shrink-0 bg-white border-r p-4 overflow-y-auto">
      <div className="mb-4">
        <h2 className="font-semibold text-gray-900">Filters</h2>
        <p className="text-sm text-gray-500">
          {filteredCount === totalCount
            ? `${totalCount} questions`
            : `${filteredCount} of ${totalCount} questions`}
        </p>
      </div>

      {/* Chapter Filter */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">Chapter</label>
        <select
          value={currentChapter}
          onChange={(e) => updateParams('chapter', e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Chapters</option>
          {chapters.map((ch, idx) => (
            <option key={ch.id} value={ch.id}>
              {idx + 1}. {ch.title}
            </option>
          ))}
        </select>
      </div>

      {/* Item Type Filter */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Item Type</label>
        <div className="space-y-1">
          {ITEM_TYPES.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={currentItemTypes.includes(value)}
                onChange={() => updateParams('itemType', toggleArrayValue(currentItemTypes, value))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Difficulty Filter */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
        <div className="space-y-1">
          {DIFFICULTIES.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={currentDifficulties.includes(value)}
                onChange={() => updateParams('difficulty', toggleArrayValue(currentDifficulties, value))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{value}. {label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Question Type Filter */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {QUESTION_TYPES.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={currentTypes.includes(value)}
                onChange={() => updateParams('type', toggleArrayValue(currentTypes, value))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Reset Button */}
      {hasFilters && (
        <button
          onClick={resetFilters}
          className="w-full py-2 px-4 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          Reset Filters
        </button>
      )}
    </div>
  );
}
