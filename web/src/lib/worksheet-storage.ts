import type { WorksheetQuestion } from '@/context/WorksheetContext';

const STORAGE_KEY = 'questionbank-worksheet';

export function saveWorksheet(questions: WorksheetQuestion[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
  } catch (e) {
    console.error('Failed to save worksheet:', e);
  }
}

export function loadWorksheet(): WorksheetQuestion[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load worksheet:', e);
  }
  return [];
}

export function clearWorksheet(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear worksheet:', e);
  }
}
