'use client';

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { saveWorksheet, loadWorksheet } from '@/lib/worksheet-storage';

export interface WorksheetQuestion {
  id: string;
  problem_latex: string;
  answer_latex: string | null;
  chapterTitle: string;
  itemType: string;
  metadata: {
    difficulty?: number;
    question_type?: string;
    topics?: string[];
  } | null;
  // Image-related fields
  sourceImageIds?: string[];  // Original source image IDs from extraction
  figureUrls?: string[];      // User-uploaded figure URLs
  useOriginalImage?: boolean; // Whether to use original image instead of LaTeX
}

interface WorksheetState {
  selected: WorksheetQuestion[];
  isLoaded: boolean;
}

type WorksheetAction =
  | { type: 'ADD'; question: WorksheetQuestion }
  | { type: 'REMOVE'; id: string }
  | { type: 'TOGGLE'; question: WorksheetQuestion }
  | { type: 'CLEAR' }
  | { type: 'REORDER'; fromIndex: number; toIndex: number }
  | { type: 'LOAD'; questions: WorksheetQuestion[] }
  | { type: 'ADD_MULTIPLE'; questions: WorksheetQuestion[] }
  | { type: 'REMOVE_MULTIPLE'; ids: string[] }
  | { type: 'TOGGLE_ORIGINAL_IMAGE'; id: string }
  | { type: 'UPDATE_QUESTION'; question: WorksheetQuestion };

function worksheetReducer(state: WorksheetState, action: WorksheetAction): WorksheetState {
  switch (action.type) {
    case 'ADD': {
      if (state.selected.some(q => q.id === action.question.id)) {
        return state;
      }
      return { ...state, selected: [...state.selected, action.question] };
    }
    case 'REMOVE': {
      return { ...state, selected: state.selected.filter(q => q.id !== action.id) };
    }
    case 'TOGGLE': {
      const exists = state.selected.some(q => q.id === action.question.id);
      if (exists) {
        return { ...state, selected: state.selected.filter(q => q.id !== action.question.id) };
      }
      return { ...state, selected: [...state.selected, action.question] };
    }
    case 'CLEAR': {
      return { ...state, selected: [] };
    }
    case 'REORDER': {
      const newSelected = [...state.selected];
      const [removed] = newSelected.splice(action.fromIndex, 1);
      newSelected.splice(action.toIndex, 0, removed);
      return { ...state, selected: newSelected };
    }
    case 'LOAD': {
      return { ...state, selected: action.questions, isLoaded: true };
    }
    case 'ADD_MULTIPLE': {
      const newQuestions = action.questions.filter(
        q => !state.selected.some(existing => existing.id === q.id)
      );
      return { ...state, selected: [...state.selected, ...newQuestions] };
    }
    case 'REMOVE_MULTIPLE': {
      return { ...state, selected: state.selected.filter(q => !action.ids.includes(q.id)) };
    }
    case 'TOGGLE_ORIGINAL_IMAGE': {
      return {
        ...state,
        selected: state.selected.map(q =>
          q.id === action.id
            ? { ...q, useOriginalImage: !q.useOriginalImage }
            : q
        ),
      };
    }
    case 'UPDATE_QUESTION': {
      return {
        ...state,
        selected: state.selected.map(q =>
          q.id === action.question.id ? action.question : q
        ),
      };
    }
    default:
      return state;
  }
}

interface WorksheetContextType {
  selected: WorksheetQuestion[];
  isSelected: (id: string) => boolean;
  add: (question: WorksheetQuestion) => void;
  remove: (id: string) => void;
  toggle: (question: WorksheetQuestion) => void;
  clear: () => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  addMultiple: (questions: WorksheetQuestion[]) => void;
  removeMultiple: (ids: string[]) => void;
  toggleOriginalImage: (id: string) => void;
  updateQuestion: (question: WorksheetQuestion) => void;
  isLoaded: boolean;
}

const WorksheetContext = createContext<WorksheetContextType | null>(null);

export function WorksheetProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(worksheetReducer, { selected: [], isLoaded: false });

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadWorksheet();
    dispatch({ type: 'LOAD', questions: saved });
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (state.isLoaded) {
      saveWorksheet(state.selected);
    }
  }, [state.selected, state.isLoaded]);

  const value: WorksheetContextType = {
    selected: state.selected,
    isSelected: (id: string) => state.selected.some(q => q.id === id),
    add: (question) => dispatch({ type: 'ADD', question }),
    remove: (id) => dispatch({ type: 'REMOVE', id }),
    toggle: (question) => dispatch({ type: 'TOGGLE', question }),
    clear: () => dispatch({ type: 'CLEAR' }),
    reorder: (fromIndex, toIndex) => dispatch({ type: 'REORDER', fromIndex, toIndex }),
    addMultiple: (questions) => dispatch({ type: 'ADD_MULTIPLE', questions }),
    removeMultiple: (ids) => dispatch({ type: 'REMOVE_MULTIPLE', ids }),
    toggleOriginalImage: (id) => dispatch({ type: 'TOGGLE_ORIGINAL_IMAGE', id }),
    updateQuestion: (question) => dispatch({ type: 'UPDATE_QUESTION', question }),
    isLoaded: state.isLoaded,
  };

  return (
    <WorksheetContext.Provider value={value}>
      {children}
    </WorksheetContext.Provider>
  );
}

export function useWorksheet() {
  const context = useContext(WorksheetContext);
  if (!context) {
    throw new Error('useWorksheet must be used within a WorksheetProvider');
  }
  return context;
}
