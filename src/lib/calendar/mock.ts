import { addDays, addMinutes, startOfWeek } from 'date-fns';
import type { CalendarItem, CalendarItemKind, CalendarPriority, CalendarType, UnscheduledItem } from './types';

/** Monday-start week, matching every other date-fns call in the calendar. */
export const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

interface Seed {
  title: string;
  type: CalendarType;
  priority: CalendarPriority;
  kind: CalendarItemKind;
  /** 0 = Monday. */
  day: number;
  /** 'HH:MM'. */
  start: string;
  minutes: number;
  notes?: string;
  checklist?: { done: number; total: number };
}

const SEEDS: Seed[] = [
  { title: 'Weekly Planning', type: 'build', priority: 'high', kind: 'planned', day: 0, start: '09:00', minutes: 30, notes: 'Pick the three outcomes for the week.' },
  { title: 'Product Sync', type: 'learn', priority: 'medium', kind: 'planned', day: 0, start: '11:00', minutes: 60 },
  { title: 'Focus Time', type: 'build', priority: 'high', kind: 'logged', day: 0, start: '14:00', minutes: 60, notes: 'Logged focus session on the sync engine.' },
  { title: 'Design Review', type: 'build', priority: 'high', kind: 'planned', day: 1, start: '09:30', minutes: 60, checklist: { done: 2, total: 5 } },
  { title: 'Client Meeting', type: 'learn', priority: 'urgent', kind: 'planned', day: 1, start: '11:00', minutes: 60 },
  { title: 'Project Planning', type: 'build', priority: 'medium', kind: 'logged', day: 1, start: '15:00', minutes: 60 },
  { title: 'Team Standup', type: 'learn', priority: 'medium', kind: 'planned', day: 2, start: '10:00', minutes: 60 },
  { title: 'Research Review', type: 'build', priority: 'low', kind: 'planned', day: 2, start: '13:00', minutes: 60, notes: 'Read through the interview notes.' },
  { title: 'Deep Work', type: 'build', priority: 'high', kind: 'logged', day: 2, start: '15:00', minutes: 75 },
  { title: 'Sprint Planning', type: 'build', priority: 'high', kind: 'planned', day: 3, start: '09:00', minutes: 60, checklist: { done: 1, total: 4 } },
  { title: 'Quick Catch-up', type: 'learn', priority: 'low', kind: 'planned', day: 3, start: '11:30', minutes: 30 },
  { title: 'Design Handoff', type: 'build', priority: 'medium', kind: 'planned', day: 3, start: '14:00', minutes: 60 },
  { title: 'Handoff notes', type: 'learn', priority: 'low', kind: 'logged', day: 3, start: '14:30', minutes: 45 },
  { title: 'Weekly Check-in', type: 'learn', priority: 'medium', kind: 'planned', day: 4, start: '09:30', minutes: 30 },
  { title: 'Project Review', type: 'build', priority: 'high', kind: 'planned', day: 4, start: '11:00', minutes: 60, checklist: { done: 3, total: 3 } },
  { title: 'Weekly Wrap-up', type: 'learn', priority: 'low', kind: 'planned', day: 4, start: '14:00', minutes: 60 },
  { title: 'Code review pass', type: 'build', priority: 'medium', kind: 'logged', day: 4, start: '16:00', minutes: 50 },
  { title: 'Side project spike', type: 'learn', priority: 'low', kind: 'planned', day: 5, start: '10:00', minutes: 60 },
  { title: 'Reading: SICP ch. 3', type: 'learn', priority: 'low', kind: 'logged', day: 5, start: '17:00', minutes: 40 },
  {
    title: 'Plan Next Week',
    type: 'build',
    priority: 'medium',
    kind: 'planned',
    day: 6,
    start: '16:00',
    minutes: 60,
    notes: 'Review priorities, check upcoming deadlines, and block focus time for the week ahead.',
    checklist: { done: 1, total: 3 },
  },
];

const UNSCHEDULED: UnscheduledItem[] = [
  { id: 'u-1', title: 'Write release notes', type: 'build', priority: 'high', durationMinutes: 60, checklist: { done: 0, total: 3 } },
  { id: 'u-2', title: 'Watch caching talk', type: 'learn', priority: 'medium', durationMinutes: 45 },
  { id: 'u-3', title: 'Triage issues', type: 'build', priority: 'low', durationMinutes: 30 },
  { id: 'u-4', title: 'Refactor sync tests', type: 'build', priority: 'urgent', durationMinutes: 90, notes: 'Split the integration suite.' },
  { id: 'u-5', title: 'Read RFC 9110', type: 'learn', priority: 'low', durationMinutes: 30 },
];

/** Mock items laid out on the week containing `today`, so the grid is never empty. */
export function createMockItems(today: Date = new Date()): CalendarItem[] {
  const monday = startOfWeek(today, WEEK_OPTIONS);
  return SEEDS.map((seed, index) => {
    const [hours, minutes] = seed.start.split(':').map(Number);
    const start = addMinutes(addDays(monday, seed.day), hours * 60 + minutes);
    return {
      id: `c-${index + 1}`,
      title: seed.title,
      type: seed.type,
      priority: seed.priority,
      kind: seed.kind,
      start,
      end: addMinutes(start, seed.minutes),
      notes: seed.notes,
      checklist: seed.checklist,
    };
  });
}

export function createMockUnscheduled(): UnscheduledItem[] {
  return UNSCHEDULED.map((item) => ({ ...item }));
}
