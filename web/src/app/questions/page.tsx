import Link from 'next/link';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { FilterSidebar } from '@/components/FilterSidebar';
import { QuestionCard } from '@/components/QuestionCard';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

interface SearchParams {
  chapter?: string;
  difficulty?: string;
  type?: string;
  itemType?: string;
  page?: string;
}

async function getChapters() {
  const { data } = await supabase
    .from('chapters')
    .select('id, title')
    .is('parent_id', null)
    .order('order_index');
  return data || [];
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
        chapter:chapters!inner(
          id,
          title
        )
      )
    `, { count: 'exact' });

  // Chapter filter
  if (searchParams.chapter) {
    query = query.eq('item.chapter.id', searchParams.chapter);
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

async function getTotalCount() {
  const { count } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true });
  return count || 0;
}

function Pagination({ currentPage, totalPages, searchParams }: {
  currentPage: number;
  totalPages: number;
  searchParams: SearchParams;
}) {
  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    if (searchParams.chapter) params.set('chapter', searchParams.chapter);
    if (searchParams.difficulty) params.set('difficulty', searchParams.difficulty);
    if (searchParams.type) params.set('type', searchParams.type);
    if (searchParams.itemType) params.set('itemType', searchParams.itemType);
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

  const [chapters, { questions, count: filteredCount }, totalCount] = await Promise.all([
    getChapters(),
    getQuestions(params),
    getTotalCount(),
  ]);

  const totalPages = Math.ceil(filteredCount / PAGE_SIZE);

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
            <span className="text-gray-600">Questions</span>
          </div>
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            ← Back to Chapters
          </Link>
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
          />
        </Suspense>

        {/* Questions list */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Stats */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, filteredCount)} of {filteredCount} questions
            </p>
            <p className="text-xs text-gray-400">
              Page {currentPage} of {totalPages}
            </p>
          </div>

          {/* Question cards */}
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={(currentPage - 1) * PAGE_SIZE + idx}
              />
            ))}
          </div>

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
      </div>
    </div>
  );
}
