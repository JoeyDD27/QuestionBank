'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QuestionCard, QuestionData, toWorksheetQuestion } from './QuestionCard';
import { useWorksheet } from '@/context/WorksheetContext';

interface QuestionsListProps {
  questions: QuestionData[];
  startIndex: number;
}

export function QuestionsList({ questions, startIndex }: QuestionsListProps) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const { toggle, selected } = useWorksheet();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't handle if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.key) {
      case 'j':
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, questions.length - 1));
        break;
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
        break;
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < questions.length) {
          toggle(toWorksheetQuestion(questions[focusedIndex]));
        }
        break;
      case 'Enter':
        if (selected.length > 0) {
          router.push('/worksheet');
        }
        break;
      case 'Escape':
        setFocusedIndex(-1);
        break;
    }
  }, [focusedIndex, questions, toggle, selected.length, router]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && containerRef.current) {
      const focusedElement = containerRef.current.children[focusedIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [focusedIndex]);

  return (
    <div ref={containerRef} className="space-y-4">
      {questions.map((q, idx) => (
        <div
          key={q.id}
          className={`transition-all ${focusedIndex === idx ? 'ring-2 ring-blue-400 ring-offset-2 rounded-lg' : ''}`}
          onClick={() => setFocusedIndex(idx)}
        >
          <QuestionCard
            question={q}
            index={startIndex + idx}
          />
        </div>
      ))}
    </div>
  );
}
