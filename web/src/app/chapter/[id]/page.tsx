import Link from "next/link";
import Image from "next/image";
import { supabase, getImageUrl } from "@/lib/supabase";
import { Chapter, Image as ImageType, Item, Question } from "@/lib/types";
import { notFound } from "next/navigation";
import { MathRenderer } from "@/components/MathRenderer";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getChapter(id: string): Promise<Chapter | null> {
  const { data, error } = await supabase
    .from("chapters")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

async function getSubsections(parentId: string): Promise<Chapter[]> {
  const { data, error } = await supabase
    .from("chapters")
    .select("*")
    .eq("parent_id", parentId)
    .order("order_index");

  if (error) return [];
  return data || [];
}

async function getImagesBatch(chapterIds: string[]): Promise<Record<string, ImageType[]>> {
  if (chapterIds.length === 0) return {};

  const { data, error } = await supabase
    .from("images")
    .select("*")
    .in("chapter_id", chapterIds)
    .order("filename");

  if (error) return {};

  const byChapter: Record<string, ImageType[]> = {};
  for (const img of data || []) {
    if (!byChapter[img.chapter_id]) byChapter[img.chapter_id] = [];
    byChapter[img.chapter_id].push(img);
  }
  return byChapter;
}

interface ItemWithQuestions extends Item {
  questions: Question[];
  source_image?: ImageType;
}

async function getItemsBatch(chapterIds: string[]): Promise<Record<string, ItemWithQuestions[]>> {
  if (chapterIds.length === 0) return {};

  // Get all items for all chapters in one query
  // Note: Supabase defaults to 1000 row limit
  const { data: items, error: itemsError } = await supabase
    .from("items")
    .select("*")
    .in("chapter_id", chapterIds)
    .order("order_index")
    .limit(5000);

  if (itemsError || !items || items.length === 0) return {};

  // Get all questions for these items in one query
  // Note: Supabase defaults to 1000 row limit, use range() to get more
  const itemIds = items.map(i => i.id);
  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .in("item_id", itemIds)
    .range(0, 9999);

  // Get all source images in one query
  const imageIds = items.map(i => i.source_image_id).filter(Boolean);
  const { data: images } = imageIds.length > 0
    ? await supabase.from("images").select("*").in("id", imageIds).limit(5000)
    : { data: [] };

  // Build lookup maps
  const imagesById: Record<string, ImageType> = {};
  for (const img of images || []) {
    imagesById[img.id] = img;
  }

  const questionsByItem: Record<string, Question[]> = {};
  for (const q of questions || []) {
    if (!questionsByItem[q.item_id]) questionsByItem[q.item_id] = [];
    questionsByItem[q.item_id].push(q);
  }

  // Group items by chapter
  const byChapter: Record<string, ItemWithQuestions[]> = {};
  for (const item of items) {
    if (!byChapter[item.chapter_id]) byChapter[item.chapter_id] = [];
    byChapter[item.chapter_id].push({
      ...item,
      questions: questionsByItem[item.id] || [],
      source_image: item.source_image_id ? imagesById[item.source_image_id] : undefined
    });
  }

  return byChapter;
}

interface SectionData {
  chapter: Chapter;
  images: ImageType[];
  items: ItemWithQuestions[];
  totalQuestions: number;
}

export default async function ChapterPage({ params }: PageProps) {
  const { id } = await params;
  const chapter = await getChapter(id);

  if (!chapter) {
    notFound();
  }

  const subsections = await getSubsections(id);

  // Collect all chapter IDs (current + subsections) for batch queries
  const allChapterIds = [id, ...subsections.map(s => s.id)];

  // Fetch all data in parallel with batch queries (2 queries instead of N*3)
  const [imagesByChapter, itemsByChapter] = await Promise.all([
    getImagesBatch(allChapterIds),
    getItemsBatch(allChapterIds)
  ]);

  // Build section data for current chapter and all subsections
  const sections: SectionData[] = [];

  // Current chapter's own content
  const currentImages = imagesByChapter[id] || [];
  const currentItems = itemsByChapter[id] || [];
  if (currentItems.length > 0 || currentImages.length > 0) {
    sections.push({
      chapter,
      images: currentImages,
      items: currentItems,
      totalQuestions: currentItems.reduce((acc, i) => acc + i.questions.length, 0)
    });
  }

  // Each subsection's content (no additional queries needed!)
  for (const sub of subsections) {
    const subImages = imagesByChapter[sub.id] || [];
    const subItems = itemsByChapter[sub.id] || [];
    sections.push({
      chapter: sub,
      images: subImages,
      items: subItems,
      totalQuestions: subItems.reduce((acc, i) => acc + i.questions.length, 0)
    });
  }

  const grandTotalItems = sections.reduce((acc, s) => acc + s.items.length, 0);
  const grandTotalQuestions = sections.reduce((acc, s) => acc + s.totalQuestions, 0);
  const grandTotalImages = sections.reduce((acc, s) => acc + s.images.length, 0);

  const typeColors: Record<string, string> = {
    concept: "bg-blue-100 text-blue-800 border-blue-300",
    example: "bg-green-100 text-green-800 border-green-300",
    exercise: "bg-orange-100 text-orange-800 border-orange-300"
  };

  const typeBg: Record<string, string> = {
    concept: "bg-blue-50",
    example: "bg-green-50",
    exercise: "bg-orange-50"
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sticky header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/" className="hover:text-blue-600">Home</Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">{chapter.title}</span>
          </nav>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">{chapter.title}</h1>
            <div className="flex gap-4 text-sm">
              <span className="text-gray-500">
                <strong className="text-gray-700">{sections.length}</strong> sections
              </span>
              <span className="text-gray-500">
                <strong className="text-gray-700">{grandTotalItems}</strong> items
              </span>
              <span className="text-gray-500">
                <strong className="text-gray-700">{grandTotalQuestions}</strong> questions
              </span>
              <span className="text-gray-500">
                <strong className="text-gray-700">{grandTotalImages}</strong> images
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Table of contents - vertical list */}
      {sections.length > 1 && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 text-sm">
              {sections.map((s, idx) => (
                <a
                  key={s.chapter.id}
                  href={`#section-${idx}`}
                  className={`px-2 py-1 rounded hover:bg-gray-100 truncate ${
                    s.items.length > 0 ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
                  {idx + 1}. {s.chapter.title}
                  {s.items.length > 0 && (
                    <span className="ml-1 text-xs text-gray-500">({s.items.length})</span>
                  )}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {sections.map((section, sectionIdx) => (
          <section
            key={section.chapter.id}
            id={`section-${sectionIdx}`}
            className="mb-8 scroll-mt-32"
          >
            {/* Section header */}
            <div className="bg-white rounded-t-lg border border-b-0 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-400">
                    {sectionIdx + 1}
                  </span>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {section.chapter.title}
                  </h2>
                </div>
                <div className="flex gap-3 text-sm">
                  <span className={section.items.length > 0 ? "text-green-600" : "text-gray-400"}>
                    {section.items.length} items
                  </span>
                  <span className={section.totalQuestions > 0 ? "text-green-600" : "text-gray-400"}>
                    {section.totalQuestions} questions
                  </span>
                  <span className="text-gray-500">
                    {section.images.length} images
                  </span>
                </div>
              </div>

              {/* Progress indicator */}
              {section.images.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${section.items.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`}
                      style={{ width: section.items.length > 0 ? '100%' : '0%' }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">
                    {section.items.length > 0 ? '✓ Extracted' : '⚠ Not extracted'}
                  </span>
                </div>
              )}
            </div>

            {/* Section content */}
            <div className="bg-white rounded-b-lg border shadow-sm">
              {section.items.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {section.items.map((item, itemIdx) => (
                    <div key={item.id} className="p-4">
                      {/* Item header */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm text-gray-400 font-mono">
                          #{itemIdx + 1}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${typeColors[item.type]}`}>
                          {item.type}
                        </span>
                        {item.title && (
                          <span className="font-medium text-gray-800">{item.title}</span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">
                          {item.questions.length} question{item.questions.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Side-by-side comparison */}
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Left: Original image */}
                        <div className={`rounded-lg border-2 border-dashed border-gray-300 ${typeBg[item.type] || 'bg-gray-50'}`}>
                          <div className="px-3 py-1.5 border-b border-gray-200 bg-white/50">
                            <span className="text-xs font-medium text-gray-500">
                              📷 Source Image
                            </span>
                          </div>
                          <div className="p-3">
                            {item.source_image ? (
                              <Image
                                src={getImageUrl(item.source_image.filename)}
                                alt={item.source_image.filename}
                                width={500}
                                height={350}
                                className="w-full h-auto rounded border bg-white"
                                style={{ maxHeight: "400px", objectFit: "contain" }}
                                loading="lazy"
                              />
                            ) : (
                              <div className="text-gray-400 text-sm italic p-8 text-center">
                                No source image linked
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right: Extracted content */}
                        <div className="rounded-lg border-2 border-gray-300 bg-white">
                          <div className="px-3 py-1.5 border-b border-gray-200 bg-gray-50">
                            <span className="text-xs font-medium text-gray-500">
                              📝 Extracted Content
                            </span>
                          </div>
                          <div className="p-3 space-y-3 max-h-[500px] overflow-y-auto">
                            {item.questions.length > 0 ? (
                              item.questions.map((q, qIdx) => (
                                <div key={q.id} className="bg-gray-50 rounded p-3 border">
                                  <div className="flex items-start gap-2">
                                    {q.label ? (
                                      <span className="text-sm font-bold text-gray-600 min-w-[1.5rem]">
                                        {q.label}.
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-400 min-w-[1.5rem]">
                                        Q{qIdx + 1}
                                      </span>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <MathRenderer
                                        content={q.problem_latex}
                                        className="text-gray-800"
                                      />
                                      {q.has_answer && q.answer_latex && (
                                        <details className="mt-2">
                                          <summary className="text-xs text-green-600 cursor-pointer hover:underline font-medium">
                                            ✓ Show Answer
                                          </summary>
                                          <div className="mt-1 p-2 bg-green-50 rounded border border-green-200">
                                            <MathRenderer
                                              content={q.answer_latex}
                                              className="text-green-800 text-sm"
                                            />
                                          </div>
                                        </details>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-gray-400 text-sm italic text-center py-4">
                                No questions extracted
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : section.images.length > 0 ? (
                /* No extracted content, show images only */
                <div className="p-4">
                  <div className="text-amber-600 text-sm mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    ⚠️ This section has {section.images.length} images but no extracted content yet.
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {section.images.map((img) => (
                      <div key={img.id} className="bg-gray-50 rounded border overflow-hidden">
                        <Image
                          src={getImageUrl(img.filename)}
                          alt={img.filename}
                          width={200}
                          height={150}
                          className="w-full h-auto"
                          loading="lazy"
                        />
                        <div className="px-2 py-1 text-xs text-gray-500 truncate border-t">
                          {img.filename}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">
                  No content in this section
                </div>
              )}
            </div>
          </section>
        ))}

        {sections.length === 0 && (
          <div className="bg-white rounded-lg border p-12 text-center text-gray-500">
            No content available for this chapter yet.
          </div>
        )}
      </main>
    </div>
  );
}
