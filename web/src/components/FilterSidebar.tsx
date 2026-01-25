'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, useEffect } from 'react';

interface Chapter {
  id: string;
  title: string;
}

interface Topic {
  topic: string;
  cnt: number;
}

interface SubChapter {
  name: string;
  count: number;
}

interface FilterCounts {
  itemTypes: Record<string, number>;
  difficulties: Record<string, number>;
  questionTypes: Record<string, number>;
}

interface FilterSidebarProps {
  chapters: Chapter[];
  totalCount: number;
  filteredCount: number;
  labeledCount: number;
  topics: Topic[];
  filterCounts: FilterCounts;
  subChapters: SubChapter[];
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
  { value: 'expansion', label: 'Expansion' },
  { value: 'factorization', label: 'Factorization' },
  { value: 'equation_solving', label: 'Equation Solving' },
  { value: 'graphing', label: 'Graphing' },
  { value: 'explain', label: 'Explain/Proof' },
  { value: 'application', label: 'Application' },
  { value: 'concept', label: 'Concept' },
  { value: 'multi_part', label: 'Multi-part' },
];

const ITEM_TYPES = [
  { value: 'concept', label: 'Concept' },
  { value: 'definition', label: 'Definition' },
  { value: 'example', label: 'Example' },
  { value: 'exercise', label: 'Exercise' },
  { value: 'investigation', label: 'Investigation' },
];

export function FilterSidebar({ chapters, totalCount, filteredCount, labeledCount, topics, filterCounts, subChapters }: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentChapter = searchParams.get('chapter') || '';
  const currentSubChapters = searchParams.get('subChapter')?.split(',').filter(Boolean) || [];
  const currentDifficulties = searchParams.get('difficulty')?.split(',').filter(Boolean) || [];
  const currentTypes = searchParams.get('type')?.split(',').filter(Boolean) || [];
  const currentItemTypes = searchParams.get('itemType')?.split(',').filter(Boolean) || [];
  const currentTopics = searchParams.get('topics')?.split(',').filter(Boolean) || [];
  const labeledOnly = searchParams.get('labeled') === '1';
  const currentSearch = searchParams.get('q') || '';

  // Local search state with debounce
  const [searchInput, setSearchInput] = useState(currentSearch);
  const [topicFilter, setTopicFilter] = useState('');

  // Collapsible sections state - load from localStorage
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') {
      return { subChapter: true, itemType: true, difficulty: true, questionType: false, topics: false };
    }
    try {
      const saved = localStorage.getItem('qb-filter-sections');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { subChapter: true, itemType: true, difficulty: true, questionType: false, topics: false };
  });

  // Save expanded sections to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('qb-filter-sections', JSON.stringify(expandedSections));
    } catch {}
  }, [expandedSections]);

  // Sync search input with URL
  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== currentSearch) {
        updateParams('q', searchInput);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

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
    const source = searchParams.get('source');
    router.push(source ? `/questions?source=${source}` : '/questions');
  };

  const hasFilters = currentChapter || currentSubChapters.length > 0 || currentDifficulties.length > 0 || currentTypes.length > 0 || currentItemTypes.length > 0 || currentTopics.length > 0 || labeledOnly || currentSearch;

  // Filter topics by search
  const filteredTopics = topicFilter
    ? topics.filter(t => t.topic.toLowerCase().includes(topicFilter.toLowerCase()))
    : topics;

  // Quick filter presets
  const applyPreset = (preset: string) => {
    const params = new URLSearchParams();
    const source = searchParams.get('source');
    if (source) params.set('source', source);
    switch (preset) {
      case 'exercise-medium':
        params.set('itemType', 'exercise');
        params.set('difficulty', '3');
        break;
      case 'exercise-easy':
        params.set('itemType', 'exercise');
        params.set('difficulty', '1,2');
        break;
      case 'exercise-hard':
        params.set('itemType', 'exercise');
        params.set('difficulty', '4,5');
        break;
      case 'examples':
        params.set('itemType', 'example');
        break;
    }
    router.push(`/questions?${params.toString()}`);
  };

  // Collapsible section header
  const SectionHeader = ({ id, title, count }: { id: string; title: string; count?: number }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-2 hover:text-gray-900"
    >
      <span>
        {title}
        {count !== undefined && count > 0 && (
          <span className="ml-1 text-xs text-blue-600">({count})</span>
        )}
      </span>
      <svg
        className={`w-4 h-4 transition-transform ${expandedSections[id] ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );

  return (
    <div className="w-64 flex-shrink-0 bg-white border-r p-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-4">
        <h2 className="font-semibold text-gray-900">Filters</h2>
        <p className="text-sm text-gray-500">
          {filteredCount === totalCount
            ? `${totalCount} questions`
            : `${filteredCount} of ${totalCount} questions`}
        </p>
      </div>

      {/* Search Box */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search questions..."
            className="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Quick Presets */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2">Quick filters</p>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => applyPreset('exercise-easy')}
            className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100"
          >
            Easy
          </button>
          <button
            onClick={() => applyPreset('exercise-medium')}
            className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100"
          >
            Medium
          </button>
          <button
            onClick={() => applyPreset('exercise-hard')}
            className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100"
          >
            Hard
          </button>
          <button
            onClick={() => applyPreset('examples')}
            className="px-2 py-1 text-xs bg-cyan-50 text-cyan-700 rounded hover:bg-cyan-100"
          >
            Examples
          </button>
        </div>
      </div>

      {/* Labeled Only Toggle */}
      <div className="mb-4 pb-4 border-b">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={labeledOnly}
            onChange={() => updateParams('labeled', labeledOnly ? '' : '1')}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Labeled only</span>
          <span className="text-xs text-gray-400">({labeledCount})</span>
        </label>
      </div>

      {/* Chapter Filter */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Chapter</label>
        <select
          value={currentChapter}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            if (e.target.value) {
              params.set('chapter', e.target.value);
            } else {
              params.delete('chapter');
            }
            // Clear sub-chapter when chapter changes
            params.delete('subChapter');
            params.delete('page');
            router.push(`/questions?${params.toString()}`);
          }}
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Chapters</option>
          {chapters.map((ch, idx) => (
            <option key={ch.id} value={ch.id}>
              {idx + 1}. {ch.title}
            </option>
          ))}
        </select>
      </div>

      {/* Sub-Chapter Filter - only show when chapter is selected and has sub-chapters */}
      {currentChapter && subChapters.length > 0 && (
        <div className="mb-4">
          <SectionHeader id="subChapter" title="Sub-Chapter" count={currentSubChapters.length} />
          {expandedSections.subChapter && (
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {subChapters.map(({ name, count }) => (
                <label key={name} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentSubChapters.includes(name)}
                    onChange={() => updateParams('subChapter', toggleArrayValue(currentSubChapters, name))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700 truncate flex-1" title={name}>{name}</span>
                  <span className="text-xs text-gray-400">({count})</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Item Type Filter */}
      <div className="mb-4">
        <SectionHeader id="itemType" title="Item Type" count={currentItemTypes.length} />
        {expandedSections.itemType && (
          <div className="space-y-1">
            {ITEM_TYPES.map(({ value, label }) => {
              const cnt = filterCounts.itemTypes[value] || 0;
              return (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentItemTypes.includes(value)}
                    onChange={() => updateParams('itemType', toggleArrayValue(currentItemTypes, value))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                  <span className="text-xs text-gray-400">({cnt})</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Difficulty Filter */}
      <div className="mb-4">
        <SectionHeader id="difficulty" title="Difficulty" count={currentDifficulties.length} />
        {expandedSections.difficulty && (
          <div className="space-y-1">
            {DIFFICULTIES.map(({ value, label }) => {
              const cnt = filterCounts.difficulties[value] || 0;
              return (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentDifficulties.includes(value)}
                    onChange={() => updateParams('difficulty', toggleArrayValue(currentDifficulties, value))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{value}. {label}</span>
                  <span className="text-xs text-gray-400">({cnt})</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Question Type Filter */}
      <div className="mb-4">
        <SectionHeader id="questionType" title="Question Type" count={currentTypes.length} />
        {expandedSections.questionType && (
          <div className="space-y-1">
            {QUESTION_TYPES.map(({ value, label }) => {
              const cnt = filterCounts.questionTypes[value] || 0;
              return (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentTypes.includes(value)}
                    onChange={() => updateParams('type', toggleArrayValue(currentTypes, value))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                  <span className="text-xs text-gray-400">({cnt})</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Topics Filter */}
      {topics.length > 0 && (
        <div className="mb-4">
          <SectionHeader id="topics" title="Topics" count={currentTopics.length} />
          {expandedSections.topics && (
            <div>
              {/* Topic search */}
              <input
                type="text"
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                placeholder="Filter topics..."
                className="w-full border border-gray-300 rounded-md px-2 py-1 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="space-y-1 max-h-[800px] overflow-y-auto">
                {filteredTopics.map(({ topic, cnt }) => (
                  <label key={topic} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentTopics.includes(topic)}
                      onChange={() => updateParams('topics', toggleArrayValue(currentTopics, topic))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-700 truncate">{topic.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-gray-400">({cnt})</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
