import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Chapter } from "@/lib/types";

export const dynamic = 'force-dynamic';

async function getChapters(): Promise<Chapter[]> {
  const { data, error } = await supabase
    .from("chapters")
    .select("*")
    .is("parent_id", null)
    .order("order_index");

  if (error) {
    console.error("Error fetching chapters:", error);
    return [];
  }
  return data || [];
}

async function getChapterStats(): Promise<Record<string, { images: number; items: number; questions: number }>> {
  // Get main chapters (no parent)
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id")
    .is("parent_id", null);

  if (!chapters) return {};

  const stats: Record<string, { images: number; items: number; questions: number }> = {};

  // Initialize all chapters
  chapters.forEach(c => {
    stats[c.id] = { images: 0, items: 0, questions: 0 };
  });

  // Count images per chapter using head:true (only returns count, no row limit)
  const imagePromises = chapters.map(async (c) => {
    const { count } = await supabase
      .from("images")
      .select("*", { count: "exact", head: true })
      .eq("chapter_id", c.id);
    return { id: c.id, count: count || 0 };
  });

  // Count items per chapter
  const itemPromises = chapters.map(async (c) => {
    const { count } = await supabase
      .from("items")
      .select("*", { count: "exact", head: true })
      .eq("chapter_id", c.id);
    return { id: c.id, count: count || 0 };
  });

  // Count questions per chapter (via items)
  const questionPromises = chapters.map(async (c) => {
    const { count } = await supabase
      .from("questions")
      .select("*, items!inner(chapter_id)", { count: "exact", head: true })
      .eq("items.chapter_id", c.id);
    return { id: c.id, count: count || 0 };
  });

  // Execute all in parallel
  const [imageCounts, itemCounts, questionCounts] = await Promise.all([
    Promise.all(imagePromises),
    Promise.all(itemPromises),
    Promise.all(questionPromises)
  ]);

  imageCounts.forEach(({ id, count }) => { stats[id].images = count; });
  itemCounts.forEach(({ id, count }) => { stats[id].items = count; });
  questionCounts.forEach(({ id, count }) => { stats[id].questions = count; });

  return stats;
}

export default async function Home() {
  const chapters = await getChapters();
  const chapterStats = await getChapterStats();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">QuestionBank</h1>
          <p className="text-gray-600 mt-1">Algebra Question Library</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Chapters</h2>
          <p className="text-gray-500 text-sm">{chapters.length} chapters available</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {chapters.map((chapter, index) => (
            <Link
              key={chapter.id}
              href={`/chapter/${chapter.id}`}
              className="block p-5 bg-white rounded-lg shadow-sm border hover:shadow-md hover:border-blue-300 transition-all"
            >
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">
                    {chapter.title}
                  </h3>
                  <div className="flex gap-3 text-sm text-gray-500 mt-1">
                    <span>{chapterStats[chapter.id]?.images || 0} images</span>
                    <span>{chapterStats[chapter.id]?.items || 0} items</span>
                    <span>{chapterStats[chapter.id]?.questions || 0} questions</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {chapters.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No chapters found. Please check database connection.
          </div>
        )}
      </main>
    </div>
  );
}
