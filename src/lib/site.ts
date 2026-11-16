// What search engines, link previews and AI answer engines are told about Tasky.
// Used by the root metadata, the share image, the manifest copy, robots, the sitemap and llms.txt.

/** The production address. Previews and local copies still point canonical links here. */
export const SITE_URL = 'https://tasky.manasbuilds.me';

export const SITE_NAME = 'Tasky';

export const SITE_TITLE = 'Tasky – Daily Planner, Focus Timer & Time Tracker';

/** Kept under ~160 characters so search results show it whole. */
export const SITE_DESCRIPTION =
  'Plan your day on a board and a calendar, run a focus timer, and see the hours you put into building and learning. Free, and it works offline.';

export const SITE_KEYWORDS = [
  'daily planner',
  'task board',
  'kanban',
  'focus timer',
  'pomodoro',
  'time tracker',
  'time blocking',
  'calendar planner',
  'productivity app',
  'reading list',
];

/** What the app does, in plain sentences. Each one is a feature in the app today. */
export const SITE_FEATURES = [
  'Task board with To do, Doing, Done and Parking columns, with drag and drop',
  'Tasks tagged Build or Learn, with priorities, deadlines, estimates and subtasks',
  'Week calendar for time-blocking tasks onto days and hours',
  'Focus timer that logs the minutes worked on each task',
  'Analytics for time logged, a daily focus goal and a streak',
  'Canvas: a board of saved links, articles and videos to read later',
  'Browser extension and phone share sheet that save links to the canvas',
  'Works offline as an installable app; signing in with Google syncs across devices',
  'Light and dark themes, and JSON export and import',
];
