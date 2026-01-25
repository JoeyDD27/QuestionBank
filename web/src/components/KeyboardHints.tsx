'use client';

import { useState } from 'react';

export function KeyboardHints() {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShow(!show)}
        className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
        title="Keyboard shortcuts"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
        </svg>
        <span>Shortcuts</span>
      </button>

      {show && (
        <div className="absolute right-0 top-6 z-50 bg-white border rounded-lg shadow-lg p-3 w-48">
          <p className="text-xs font-medium text-gray-700 mb-2">Keyboard Shortcuts</p>
          <ul className="text-xs text-gray-600 space-y-1">
            <li><kbd className="px-1 bg-gray-100 rounded">j</kbd> / <kbd className="px-1 bg-gray-100 rounded">↓</kbd> - Next</li>
            <li><kbd className="px-1 bg-gray-100 rounded">k</kbd> / <kbd className="px-1 bg-gray-100 rounded">↑</kbd> - Previous</li>
            <li><kbd className="px-1 bg-gray-100 rounded">Space</kbd> - Toggle select</li>
            <li><kbd className="px-1 bg-gray-100 rounded">Enter</kbd> - Go to worksheet</li>
            <li><kbd className="px-1 bg-gray-100 rounded">Esc</kbd> - Clear focus</li>
          </ul>
        </div>
      )}
    </div>
  );
}
