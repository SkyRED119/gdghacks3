export type ViewMode = 'week' | 'month' | 'semester';
export type ThemeMode = 'dark' | 'light';
export type SyncState = 'idle' | 'syncing' | 'synced' | 'error';
export type EventType = 'assignment' | 'midterm' | 'exam' | 'quiz' | 'important' | 'lab';

export interface CourseEvent {
  id: string;
  title: string;
  courseCode: string;
  courseName: string;
  /** Where the event came from */
  source: 'D2L' | 'Course Outline' | 'Manual';
  /** Display date, e.g. "Feb 12" */
  date: string;
  /** ISO date string e.g. "2026-02-12" */
  isoDate: string;
  /** Week number 1–16 */
  week: number;
  month: string;
  type: EventType;
  /** Percentage weight of the course grade */
  weight: number;
  /** Grade received (0–100), null if not yet graded */
  grade?: number | null;
  /** AI confidence % for parsed data */
  confidence: number;
  /** Whether the student submitted on time */
  submittedOnTime?: boolean;
}

export interface PlayerState {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  currencyA: number; // on-time completion
  currencyB: number; // grade quality
  streak: number;
  title: string;
}

// ─── Extension data shapes (from background.js) ────────────────────────────
export interface ExtensionGrade {
  id: string;
  courseId: string;
  course: string;
  title: string;
  grade: number | null;
  maxGrade: number | null;
  percentage: number | null;
  source: string;
}

export interface ExtensionAssignment {
  id: string;
  courseId: string;
  course: string;
  title: string;
  dueDate: string | null;
  status: 'pending' | 'submitted';
  grade: number | null;
  maxGrade: number | null;
  url: string | null;
  source: string;
  syncedAt: string;
  priority: number;
}
