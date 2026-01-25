'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWorksheet } from '@/context/WorksheetContext';
import { WorksheetPrintView } from '@/components/WorksheetPrintView';

function PrintContent() {
  const searchParams = useSearchParams();
  const { selected, isLoaded } = useWorksheet();

  const mode = (searchParams.get('mode') || 'questions') as 'questions' | 'answers';
  const compactLayout = searchParams.get('compactLayout') === 'true';
  const hideSolutions = searchParams.get('hideSolutions') === 'true';

  useEffect(() => {
    // Wait for content to load and render, then trigger print
    if (isLoaded && selected.length > 0) {
      // Small delay to ensure KaTeX renders
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoaded, selected.length]);

  if (!isLoaded) {
    return (
      <div className="p-8 text-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (selected.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No questions selected
      </div>
    );
  }

  return (
    <div className="print-container p-8 max-w-4xl mx-auto">
      <WorksheetPrintView
        questions={selected}
        mode={mode}
        compactLayout={compactLayout}
        hideSolutions={hideSolutions}
      />
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <PrintContent />
    </Suspense>
  );
}
