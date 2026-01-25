import Link from 'next/link';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { FilterSidebar } from '@/components/FilterSidebar';
import { QuestionCard } from '@/components/QuestionCard';
import { QuestionsList } from '@/components/QuestionsList';
import { WorksheetSidebar } from '@/components/WorksheetSidebar';
import { SelectAllButton } from '@/components/SelectAllButton';
import { WorksheetBadge } from '@/components/WorksheetBadge';
import { KeyboardHints } from '@/components/KeyboardHints';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

interface SearchParams {
  source?: string;
  chapter?: string;
  subChapter?: string;
  difficulty?: string;
  type?: string;
  itemType?: string;
  topics?: string;
  labeled?: string;
  page?: string;
  q?: string;
}

interface Source {
  id: string;
  filename: string;
  subject: string | null;
}

async function getSources(): Promise<Source[]> {
  const { data } = await supabase
    .from('sources')
    .select('id, filename, subject')
    .order('created_at');
  return data || [];
}

function getSourceLabel(source: Source): string {
  if (source.filename === 'Algebra full.docx') return 'Algebra';
  if (source.subject) return source.subject;
  return source.filename.replace(/\.docx$/i, '');
}

async function getChapters(sourceId?: string) {
  let query = supabase
    .from('chapters')
    .select('id, title')
    .is('parent_id', null)
    .order('order_index');

  if (sourceId) {
    query = query.eq('source_id', sourceId);
  }

  const { data } = await query;
  return data || [];
}

// Sub-chapter config for ordering
import subChaptersConfig from '@/data/sub-chapters.json';

async function getSubChapters(chapterId?: string) {
  if (!chapterId) return [];

  const normalizeTitle = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

  // Get distinct sub_chapter values for items in this chapter
  const { data } = await supabase
    .from('items')
    .select('sub_chapter, chapter:chapters!inner(id, order_index)')
    .eq('chapter.id', chapterId)
    .not('sub_chapter', 'is', null);

  if (!data) return [];

  // Count items per sub_chapter
  const counts: Record<string, number> = {};
  const normalizedCounts: Record<string, number> = {};
  const normalizedNames: Record<string, string> = {};
  let chapterOrderIndex = 1;

  for (const item of data) {
    const sub = item.sub_chapter;
    if (sub) {
      counts[sub] = (counts[sub] || 0) + 1;
      const key = normalizeTitle(sub);
      normalizedCounts[key] = (normalizedCounts[key] || 0) + 1;
      if (!normalizedNames[key]) {
        normalizedNames[key] = sub;
      }
    }
    // Get chapter order_index
    const chapter = Array.isArray(item.chapter) ? item.chapter[0] : item.chapter;
    if (chapter?.order_index) {
      chapterOrderIndex = chapter.order_index;
    }
  }

  // Get order from config
  const chapterKey = `ch${String(chapterOrderIndex).padStart(2, '0')}` as keyof typeof subChaptersConfig;
  const configChapter = subChaptersConfig[chapterKey];
  const ordered: { name: string; count: number }[] = [];
  const seen = new Set<string>();

  if (configChapter?.subChapters) {
    for (const sub of configChapter.subChapters) {
      const key = normalizeTitle(sub.title);
      const count = normalizedCounts[key];
      if (count !== undefined) {
        ordered.push({ name: sub.title, count });
        seen.add(key);
      }
    }
  }

  // Append any remaining sub-chapters not in config
  for (const [key, count] of Object.entries(normalizedCounts)) {
    if (!seen.has(key)) {
      ordered.push({ name: normalizedNames[key] ?? key, count });
    }
  }

  return ordered;
}

async function getQuestions(searchParams: SearchParams) {
  const page = parseInt(searchParams.page || '1', 10);
  const offset = (page - 1) * PAGE_SIZE;

  // Build query
  let query = supabase
    .from('questions')
    .select(`
      id,
      problem_latex,
      answer_latex,
      has_answer,
      metadata,
      item:items!inner(
        type,
        sub_chapter,
        source_image_ids,
        chapter:chapters!inner(
          id,
          title,
          source_id
        )
      ),
      figures:question_figures(
        id,
        storage_path,
        order_index
      )
    `, { count: 'exact' });

  // Source filter (when no specific chapter selected)
  if (searchParams.source && !searchParams.chapter) {
    query = query.eq('item.chapter.source_id', searchParams.source);
  }

  // Chapter filter
  if (searchParams.chapter) {
    query = query.eq('item.chapter.id', searchParams.chapter);
  }

  // Sub-chapter filter
  if (searchParams.subChapter) {
    const subChapters = searchParams.subChapter.split(',');
    query = query.in('item.sub_chapter', subChapters);
  }

  // Item type filter
  if (searchParams.itemType) {
    const types = searchParams.itemType.split(',');
    query = query.in('item.type', types);
  }

  // Difficulty filter (JSONB) - use .contains() method
  if (searchParams.difficulty) {
    const difficulties = searchParams.difficulty.split(',');
    if (difficulties.length === 1) {
      query = query.contains('metadata', { difficulty: parseInt(difficulties[0], 10) });
    } else {
      // For multiple values, use .or() with contains conditions
      const orConditions = difficulties.map(d => `metadata.cs.{"difficulty":${d}}`).join(',');
      query = query.or(orConditions);
    }
  }

  // Question type filter (JSONB) - use .contains() method
  if (searchParams.type) {
    const types = searchParams.type.split(',');
    if (types.length === 1) {
      query = query.contains('metadata', { question_type: types[0] });
    } else {
      // For multiple values, use .or() with contains conditions
      const orConditions = types.map(t => `metadata.cs.{"question_type":"${t}"}`).join(',');
      query = query.or(orConditions);
    }
  }

  // Topics filter (JSONB array) - filter questions containing any of the selected topics
  if (searchParams.topics) {
    const topics = searchParams.topics.split(',');
    if (topics.length === 1) {
      query = query.contains('metadata', { topics: [topics[0]] });
    } else {
      const orConditions = topics.map(t => `metadata.cs.{"topics":["${t}"]}`).join(',');
      query = query.or(orConditions);
    }
  }

  // Labeled only filter
  if (searchParams.labeled === '1') {
    query = query.not('metadata->difficulty', 'is', null);
  }

  // Search filter (search in problem_latex)
  if (searchParams.q) {
    query = query.ilike('problem_latex', `%${searchParams.q}%`);
  }

  // Order and pagination
  query = query
    .order('created_at', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching questions:', error);
    return { questions: [], count: 0 };
  }

  return { questions: data || [], count: count || 0 };
}

async function getTotalCount(sourceId?: string) {
  if (sourceId) {
    const { count } = await supabase
      .from('questions')
      .select('*, item:items!inner(chapter:chapters!inner(id, source_id))', { count: 'exact', head: true })
      .eq('item.chapter.source_id', sourceId);
    return count || 0;
  }
  const { count } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true });
  return count || 0;
}

async function getLabeledCount(chapterId?: string, sourceId?: string) {
  let query = supabase
    .from('questions')
    .select('*, item:items!inner(chapter:chapters!inner(id, source_id))', { count: 'exact', head: true })
    .not('metadata->difficulty', 'is', null);

  if (chapterId) {
    query = query.eq('item.chapter.id', chapterId);
  } else if (sourceId) {
    query = query.eq('item.chapter.source_id', sourceId);
  }

  const { count } = await query;
  return count || 0;
}

async function getTopics(chapterId?: string) {
  // If chapter is selected, get topics only from that chapter
  if (chapterId) {
    const { data } = await supabase.rpc('get_topic_counts_by_chapter', { p_chapter_id: chapterId });
    if (data) return data;
  }
  // Fallback to all topics
  const { data } = await supabase.rpc('get_topic_counts');
  return data || [];
}

interface FilterCounts {
  itemTypes: Record<string, number>;
  difficulties: Record<string, number>;
  questionTypes: Record<string, number>;
}

async function getFilterCounts(chapterId?: string, sourceId?: string): Promise<FilterCounts> {
  // Build base query with optional chapter/source filter
  let baseQuery = supabase
    .from('questions')
    .select('metadata, item:items!inner(type, chapter:chapters!inner(id, source_id))');

  if (chapterId) {
    baseQuery = baseQuery.eq('item.chapter.id', chapterId);
  } else if (sourceId) {
    baseQuery = baseQuery.eq('item.chapter.source_id', sourceId);
  }

  const { data } = await baseQuery;

  const counts: FilterCounts = {
    itemTypes: {},
    difficulties: {},
    questionTypes: {},
  };

  if (!data) return counts;

  for (const q of data) {
    // Item type - q.item is an array due to join, get first element
    const item = Array.isArray(q.item) ? q.item[0] : q.item;
    const itemType = (item as { type: string } | null)?.type;
    if (itemType) {
      counts.itemTypes[itemType] = (counts.itemTypes[itemType] || 0) + 1;
    }

    // Difficulty
    const metadata = q.metadata as { difficulty?: number; question_type?: string } | null;
    const difficulty = metadata?.difficulty;
    if (difficulty) {
      counts.difficulties[String(difficulty)] = (counts.difficulties[String(difficulty)] || 0) + 1;
    }

    // Question type
    const qType = metadata?.question_type;
    if (qType) {
      counts.questionTypes[qType] = (counts.questionTypes[qType] || 0) + 1;
    }
  }

  return counts;
}

function Pagination({ currentPage, totalPages, searchParams }: {
  currentPage: number;
  totalPages: number;
  searchParams: SearchParams;
}) {
  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    if (searchParams.source) params.set('source', searchParams.source);
    if (searchParams.chapter) params.set('chapter', searchParams.chapter);
    if (searchParams.subChapter) params.set('subChapter', searchParams.subChapter);
    if (searchParams.difficulty) params.set('difficulty', searchParams.difficulty);
    if (searchParams.type) params.set('type', searchParams.type);
    if (searchParams.itemType) params.set('itemType', searchParams.itemType);
    if (searchParams.topics) params.set('topics', searchParams.topics);
    if (searchParams.labeled) params.set('labeled', searchParams.labeled);
    if (searchParams.q) params.set('q', searchParams.q);
    params.set('page', page.toString());
    return `/questions?${params.toString()}`;
  };

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const delta = 2;

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      {/* Previous */}
      {currentPage > 1 && (
        <Link
          href={buildUrl(currentPage - 1)}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
        >
          ←
        </Link>
      )}

      {/* Page numbers */}
      {getPageNumbers().map((page, idx) => (
        typeof page === 'number' ? (
          <Link
            key={idx}
            href={buildUrl(page)}
            className={`px-3 py-1 text-sm border rounded ${
              page === currentPage
                ? 'bg-blue-600 text-white border-blue-600'
                : 'hover:bg-gray-50'
            }`}
          >
            {page}
          </Link>
        ) : (
          <span key={idx} className="px-2 text-gray-400">{page}</span>
        )
      ))}

      {/* Next */}
      {currentPage < totalPages && (
        <Link
          href={buildUrl(currentPage + 1)}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
        >
          →
        </Link>
      )}
    </div>
  );
}

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const currentPage = parseInt(params.page || '1', 10);

  const sources = await getSources();
  const selectedSourceId = params.source || sources[0]?.id;

  const [chapters, { questions, count: filteredCount }, totalCount, labeledCount, topics, filterCounts, subChapters] = await Promise.all([
    getChapters(selectedSourceId),
    getQuestions(params),
    getTotalCount(selectedSourceId),
    getLabeledCount(params.chapter, selectedSourceId),
    getTopics(params.chapter),
    getFilterCounts(params.chapter, selectedSourceId),
    getSubChapters(params.chapter),
  ]);

  const totalPages = Math.ceil(filteredCount / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <Link href="/" className="text-xl font-bold text-gray-900 hover:text-blue-600">
                QuestionBank
              </Link>
              <span className="text-gray-400 mx-2">/</span>
              <span className="text-gray-600">Questions</span>
            </div>
            {sources.length > 1 && (
              <div className="flex gap-1 ml-4">
                {sources.map(source => (
                  <Link
                    key={source.id}
                    href={`/questions?source=${source.id}`}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      selectedSourceId === source.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {getSourceLabel(source)}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <WorksheetBadge />
            <Link
              href="/"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              ← Back to Chapters
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <Suspense fallback={<div className="w-64 bg-white border-r p-4">Loading...</div>}>
          <FilterSidebar
            chapters={chapters}
            totalCount={totalCount}
            filteredCount={filteredCount}
            labeledCount={labeledCount}
            topics={topics}
            filterCounts={filterCounts}
            subChapters={subChapters}
          />
        </Suspense>

        {/* Questions list */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Stats & Select All */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-600">
                Showing {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, filteredCount)} of {filteredCount} questions
              </p>
              {questions.length > 0 && (
                <SelectAllButton questions={questions} />
              )}
            </div>
            <div className="flex items-center gap-4">
              <KeyboardHints />
              <p className="text-xs text-gray-400">
                Page {currentPage} of {totalPages}
              </p>
            </div>
          </div>

          {/* Question cards */}
          <QuestionsList
            questions={questions}
            startIndex={(currentPage - 1) * PAGE_SIZE}
          />

          {questions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No questions found matching your filters.
            </div>
          )}

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            searchParams={params}
          />
        </main>

        {/* Worksheet Sidebar */}
        <WorksheetSidebar />
      </div>
    </div>
  );
}
