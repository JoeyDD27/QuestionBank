'use client';

import Link from 'next/link';
import { useWorksheet } from '@/context/WorksheetContext';

export function WorksheetBadge() {
  const { selected } = useWorksheet();

  if (selected.length === 0) return null;

  return (
    <Link
      href="/worksheet"
      className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
      </svg>
      <span className="text-sm font-medium">{selected.length} selected → Print</span>
    </Link>
  );
}
