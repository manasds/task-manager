import { Activity } from '../types/activity';

export const STORAGE_KEY = 'orbittask_activities_v1';
export const GOAL_STORAGE_KEY = 'orbittask_daily_goal_minutes';

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateOffset(daysOffset: number): string {
  return shiftIsoDate(getTodayDateString(), daysOffset);
}

/** Move a YYYY-MM-DD by whole local days. Date-only strings are not UTC instants. */
export function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function generateInitialActivities(): Activity[] {
  const today = getTodayDateString();
  const dMinus1 = getDateOffset(-1);
  const dMinus2 = getDateOffset(-2);
  const dMinus3 = getDateOffset(-3);
  const dMinus4 = getDateOffset(-4);
  const dMinus5 = getDateOffset(-5);
  const dMinus6 = getDateOffset(-6);

  return [
    // --- TODAY'S ACTIVITIES ---
    {
      id: 'act-1',
      title: 'Design high-converting onboarding flow',
      description: 'Audit drop-off points, wireframe streamlined step 1 & 2 in Figma.',
      category: 'deep_work',
      priority: 'high',
      status: 'in_progress',
      estimatedMinutes: 90,
      actualMinutes: 55,
      scheduledTime: '09:30',
      date: today,
      subtasks: [
        { id: 'sub-1', title: 'Export benchmark dropoff funnel', completed: true },
        { id: 'sub-2', title: 'Draft revised 3-step registration layout', completed: true },
        { id: 'sub-3', title: 'Validate copy with product marketing', completed: false },
      ],
      tags: ['Figma', 'UX', 'Growth'],
      createdAt: `${today}T08:00:00Z`,
    },
    {
      id: 'act-2',
      title: '45-minute HIIT & Core Workout',
      description: 'Interval sprints, kettlebell swings, and mobility cooldown.',
      category: 'health_fitness',
      priority: 'medium',
      status: 'completed',
      estimatedMinutes: 45,
      actualMinutes: 48,
      scheduledTime: '07:30',
      date: today,
      subtasks: [
        { id: 'sub-4', title: 'Warmup & dynamic stretches', completed: true },
        { id: 'sub-5', title: '4 sets kettlebell circuits', completed: true },
        { id: 'sub-6', title: 'Hydration & protein shake', completed: true },
      ],
      tags: ['Fitness', 'Morning'],
      completedAt: `${today}T08:20:00Z`,
      createdAt: `${today}T07:15:00Z`,
    },
    {
      id: 'act-3',
      title: 'Quarterly Sprint Planning & Architecture Review',
      description: 'Review tech debt items and finalize Q4 database indexing plan.',
      category: 'admin_meetings',
      priority: 'urgent',
      status: 'completed',
      estimatedMinutes: 60,
      actualMinutes: 65,
      scheduledTime: '11:00',
      date: today,
      subtasks: [
        { id: 'sub-7', title: 'Review open Jira bottlenecks', completed: true },
        { id: 'sub-8', title: 'Assign tech lead for caching migration', completed: true },
      ],
      tags: ['Engineering', 'Sync'],
      completedAt: `${today}T12:05:00Z`,
      createdAt: `${today}T09:00:00Z`,
    },
    {
      id: 'act-4',
      title: 'Interactive SVG Chart Component Refactor',
      description: 'Build responsive viewBox curves with cubic bezier smoothing and accessible tooltips.',
      category: 'deep_work',
      priority: 'high',
      status: 'review',
      estimatedMinutes: 80,
      actualMinutes: 75,
      scheduledTime: '13:30',
      date: today,
      subtasks: [
        { id: 'sub-9', title: 'Calculate normalized coordinate scales', completed: true },
        { id: 'sub-10', title: 'Implement animated hover cursors', completed: true },
        { id: 'sub-11', title: 'Test screen-reader aria labels', completed: false },
      ],
      tags: ['Frontend', 'Charts'],
      createdAt: `${today}T10:00:00Z`,
    },
    {
      id: 'act-5',
      title: 'Read chapter 4 of "Designing Data-Intensive Apps"',
      description: 'Deep dive into replication logs, multi-leader consensus, and quorum reads.',
      category: 'learning',
      priority: 'medium',
      status: 'backlog',
      estimatedMinutes: 40,
      actualMinutes: 0,
      scheduledTime: '16:00',
      date: today,
      subtasks: [
        { id: 'sub-12', title: 'Highlight key consensus failure modes', completed: false },
        { id: 'sub-13', title: 'Write 3 executive summary bullet notes', completed: false },
      ],
      tags: ['Book', 'Architecture'],
      createdAt: `${today}T11:00:00Z`,
    },
    {
      id: 'act-6',
      title: 'Design visual icon set for activity badges',
      description: 'Create uniform 24px grid vector icons with matching stroke weights.',
      category: 'creative',
      priority: 'low',
      status: 'backlog',
      estimatedMinutes: 50,
      actualMinutes: 0,
      scheduledTime: '17:30',
      date: today,
      subtasks: [
        { id: 'sub-14', title: 'Rough concept sketches', completed: false },
        { id: 'sub-15', title: 'SVG export and optimization', completed: false },
      ],
      tags: ['Design', 'Icons'],
      createdAt: `${today}T12:00:00Z`,
    },
    {
      id: 'act-7',
      title: 'Evening wind-down & journal reflections',
      description: 'Log daily wins, review tomorrow schedule, and 10m mindful breathing.',
      category: 'personal',
      priority: 'low',
      status: 'backlog',
      estimatedMinutes: 25,
      actualMinutes: 0,
      scheduledTime: '20:30',
      date: today,
      subtasks: [
        { id: 'sub-16', title: 'Journal entry: 3 key accomplishments', completed: false },
        { id: 'sub-17', title: 'Check calendar for tomorrow 9 AM call', completed: false },
      ],
      tags: ['Mindfulness', 'Habit'],
      createdAt: `${today}T12:30:00Z`,
    },

    // --- RECENT DAYS HISTORICAL (FOR VIBRANT TREND CHARTS) ---
    // Yesterday (dMinus1)
    {
      id: 'act-hist-1',
      title: 'Write production API rate-limiting middleware',
      category: 'deep_work',
      priority: 'urgent',
      status: 'completed',
      estimatedMinutes: 120,
      actualMinutes: 110,
      date: dMinus1,
      subtasks: [],
      tags: ['Backend'],
      completedAt: `${dMinus1}T16:00:00Z`,
      createdAt: `${dMinus1}T09:00:00Z`,
    },
    {
      id: 'act-hist-2',
      title: '5km Outdoor Morning Trail Run',
      category: 'health_fitness',
      priority: 'medium',
      status: 'completed',
      estimatedMinutes: 35,
      actualMinutes: 32,
      date: dMinus1,
      subtasks: [],
      tags: ['Running'],
      completedAt: `${dMinus1}T08:00:00Z`,
      createdAt: `${dMinus1}T07:00:00Z`,
    },
    {
      id: 'act-hist-3',
      title: 'Client Demo & Feedback Workshop',
      category: 'admin_meetings',
      priority: 'high',
      status: 'completed',
      estimatedMinutes: 50,
      actualMinutes: 55,
      date: dMinus1,
      subtasks: [],
      tags: ['Client'],
      completedAt: `${dMinus1}T11:00:00Z`,
      createdAt: `${dMinus1}T09:30:00Z`,
    },
    {
      id: 'act-hist-4',
      title: 'Podcast recording: Modern Web Performance',
      category: 'creative',
      priority: 'medium',
      status: 'completed',
      estimatedMinutes: 60,
      actualMinutes: 60,
      date: dMinus1,
      subtasks: [],
      tags: ['Audio'],
      completedAt: `${dMinus1}T18:00:00Z`,
      createdAt: `${dMinus1}T15:00:00Z`,
    },

    // 2 Days Ago (dMinus2)
    {
      id: 'act-hist-5',
      title: 'PostgreSQL Query Optimization & Index Tuning',
      category: 'deep_work',
      priority: 'high',
      status: 'completed',
      estimatedMinutes: 90,
      actualMinutes: 95,
      date: dMinus2,
      subtasks: [],
      tags: ['SQL'],
      completedAt: `${dMinus2}T15:00:00Z`,
      createdAt: `${dMinus2}T09:00:00Z`,
    },
    {
      id: 'act-hist-6',
      title: 'Strength Training: Heavy Upper Body',
      category: 'health_fitness',
      priority: 'high',
      status: 'completed',
      estimatedMinutes: 60,
      actualMinutes: 58,
      date: dMinus2,
      subtasks: [],
      tags: ['Gym'],
      completedAt: `${dMinus2}T18:30:00Z`,
      createdAt: `${dMinus2}T17:00:00Z`,
    },
    {
      id: 'act-hist-7',
      title: 'Explore TypeScript 5.5 type narrowing improvements',
      category: 'learning',
      priority: 'medium',
      status: 'completed',
      estimatedMinutes: 45,
      actualMinutes: 45,
      date: dMinus2,
      subtasks: [],
      tags: ['Tech'],
      completedAt: `${dMinus2}T20:30:00Z`,
      createdAt: `${dMinus2}T19:00:00Z`,
    },

    // 3 Days Ago (dMinus3)
    {
      id: 'act-hist-8',
      title: 'Implement drag and drop state reordering logic',
      category: 'deep_work',
      priority: 'urgent',
      status: 'completed',
      estimatedMinutes: 100,
      actualMinutes: 105,
      date: dMinus3,
      subtasks: [],
      tags: ['Engineering'],
      completedAt: `${dMinus3}T14:00:00Z`,
      createdAt: `${dMinus3}T08:30:00Z`,
    },
    {
      id: 'act-hist-9',
      title: 'Team bi-weekly retrospective & kudos',
      category: 'admin_meetings',
      priority: 'medium',
      status: 'completed',
      estimatedMinutes: 45,
      actualMinutes: 40,
      date: dMinus3,
      subtasks: [],
      tags: ['Retrospective'],
      completedAt: `${dMinus3}T16:00:00Z`,
      createdAt: `${dMinus3}T15:00:00Z`,
    },
    {
      id: 'act-hist-10',
      title: 'Yoga flow & spinal decompression session',
      category: 'health_fitness',
      priority: 'low',
      status: 'completed',
      estimatedMinutes: 30,
      actualMinutes: 30,
      date: dMinus3,
      subtasks: [],
      tags: ['Yoga'],
      completedAt: `${dMinus3}T19:00:00Z`,
      createdAt: `${dMinus3}T18:00:00Z`,
    },

    // 4 Days Ago (dMinus4)
    {
      id: 'act-hist-11',
      title: 'Full-stack authentication security audit',
      category: 'deep_work',
      priority: 'urgent',
      status: 'completed',
      estimatedMinutes: 120,
      actualMinutes: 130,
      date: dMinus4,
      subtasks: [],
      tags: ['Security'],
      completedAt: `${dMinus4}T16:00:00Z`,
      createdAt: `${dMinus4}T09:00:00Z`,
    },
    {
      id: 'act-hist-12',
      title: 'Design UI layout system & spacing tokens',
      category: 'creative',
      priority: 'medium',
      status: 'completed',
      estimatedMinutes: 60,
      actualMinutes: 60,
      date: dMinus4,
      subtasks: [],
      tags: ['Design System'],
      completedAt: `${dMinus4}T12:00:00Z`,
      createdAt: `${dMinus4}T10:00:00Z`,
    },
    {
      id: 'act-hist-13',
      title: 'Grocery meal prep for the work week',
      category: 'personal',
      priority: 'medium',
      status: 'completed',
      estimatedMinutes: 50,
      actualMinutes: 45,
      date: dMinus4,
      subtasks: [],
      tags: ['Nutrition'],
      completedAt: `${dMinus4}T19:00:00Z`,
      createdAt: `${dMinus4}T17:30:00Z`,
    },

    // 5 Days Ago (dMinus5)
    {
      id: 'act-hist-14',
      title: '25km endurance cycling workout',
      category: 'health_fitness',
      priority: 'high',
      status: 'completed',
      estimatedMinutes: 75,
      actualMinutes: 72,
      date: dMinus5,
      subtasks: [],
      tags: ['Cycling'],
      completedAt: `${dMinus5}T09:30:00Z`,
      createdAt: `${dMinus5}T08:00:00Z`,
    },
    {
      id: 'act-hist-15',
      title: 'Draft technical RFC for client offline sync',
      category: 'deep_work',
      priority: 'high',
      status: 'completed',
      estimatedMinutes: 90,
      actualMinutes: 85,
      date: dMinus5,
      subtasks: [],
      tags: ['RFC', 'Spec'],
      completedAt: `${dMinus5}T15:00:00Z`,
      createdAt: `${dMinus5}T11:00:00Z`,
    },

    // 6 Days Ago (dMinus6)
    {
      id: 'act-hist-16',
      title: 'Weekly financial reconciliation and invoices',
      category: 'admin_meetings',
      priority: 'medium',
      status: 'completed',
      estimatedMinutes: 45,
      actualMinutes: 50,
      date: dMinus6,
      subtasks: [],
      tags: ['Finance'],
      completedAt: `${dMinus6}T11:00:00Z`,
      createdAt: `${dMinus6}T09:30:00Z`,
    },
    {
      id: 'act-hist-17',
      title: 'Review Machine Learning fundamentals course',
      category: 'learning',
      priority: 'medium',
      status: 'completed',
      estimatedMinutes: 60,
      actualMinutes: 65,
      date: dMinus6,
      subtasks: [],
      tags: ['AI/ML'],
      completedAt: `${dMinus6}T17:00:00Z`,
      createdAt: `${dMinus6}T15:00:00Z`,
    },
  ];
}

export function loadActivities(): Activity[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

export function saveActivities(activities: Activity[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
  } catch {
    // local storage quota or error
  }
}

export function loadDailyGoalMinutes(): number {
  if (typeof window === 'undefined') return 360; // 6 hours default
  try {
    const raw = localStorage.getItem(GOAL_STORAGE_KEY);
    if (!raw) return 360;
    const num = parseInt(raw, 10);
    return isNaN(num) || num <= 0 ? 360 : num;
  } catch {
    return 360;
  }
}

export function saveDailyGoalMinutes(minutes: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GOAL_STORAGE_KEY, String(minutes));
  } catch {
    //
  }
}
