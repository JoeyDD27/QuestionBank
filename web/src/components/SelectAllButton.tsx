'use client';

import { useWorksheet } from '@/context/WorksheetContext';
import { QuestionData, toWorksheetQuestion } from './QuestionCard';

interface SelectAllButtonProps {
  questions: QuestionData[];
}

export function SelectAllButton({ questions }: SelectAllButtonProps) {
  const { selected, addMultiple, removeMultiple, isSelected } = useWorksheet();

  // Check how many of current page questions are selected
  const currentPageSelected = questions.filter(q => isSelected(q.id)).length;
  const allSelected = currentPageSelected === questions.length;
  const someSelected = currentPageSelected > 0 && !allSelected;

  const handleToggleAll = () => {
    if (allSelected) {
      // Deselect all current page questions
      removeMultiple(questions.map(q => q.id));
    } else {
      // Select all current page questions
      addMultiple(questions.map(toWorksheetQuestion));
    }
  };

  return (
    <button
      onClick={handleToggleAll}
      className={`flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg transition-colors ${
        allSelected || someSelected
          ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
          : 'bg-white hover:bg-gray-50 text-gray-700'
      }`}
    >
      <input
        type="checkbox"
        checked={allSelected}
        ref={(el) => {
          if (el) el.indeterminate = someSelected;
        }}
        onChange={() => {}}
        className="w-4 h-4 rounded border-gray-300 text-blue-600"
      />
      <span>
        {allSelected ? 'Deselect Page' : `Select Page (${questions.length})`}
      </span>
    </button>
  );
}
