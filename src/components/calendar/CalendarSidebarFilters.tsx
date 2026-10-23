import type { ComponentType } from 'react';
import { CalendarCheck, CalendarDays, Check, Clock3, MoreHorizontal, Settings, SquareCheck } from 'lucide-react';
import { CALENDAR_TYPES, CALENDAR_TYPE_ORDER, PRIORITY_LABELS, PRIORITY_ORDER } from '@/lib/calendar/theme';
import type { CalendarFilters, CalendarPriority, CalendarType } from '@/lib/calendar/types';

export type SidebarSection = 'calendar' | 'today' | 'upcoming' | 'tasks';

export interface CalendarSidebarFiltersProps {
  active: SidebarSection;
  onSelectSection: (section: SidebarSection) => void;
  upcomingCount: number;
  /** Unscheduled count. */
  tasksCount: number;
  filters: CalendarFilters;
  onToggleType: (type: CalendarType) => void;
  onTogglePriority: (priority: CalendarPriority) => void;
  onSettings: () => void;
  userName: string;
  userSubtitle: string;
  userImage?: string;
}

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-neutral-400';

interface NavEntry {
  id: SidebarSection;
  label: string;
  Icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}

const NAV: NavEntry[] = [
  { id: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { id: 'today', label: 'Today', Icon: CalendarCheck },
  { id: 'upcoming', label: 'Upcoming', Icon: Clock3 },
  { id: 'tasks', label: 'Tasks', Icon: SquareCheck },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function CalendarSidebarFilters({
  active,
  onSelectSection,
  upcomingCount,
  tasksCount,
  filters,
  onToggleType,
  onTogglePriority,
  onSettings,
  userName,
  userSubtitle,
  userImage,
}: CalendarSidebarFiltersProps) {
  const counts: Partial<Record<SidebarSection, number>> = { upcoming: upcomingCount, tasks: tasksCount };

  return (
    <nav aria-label="Calendar sidebar" className="flex h-full flex-col bg-[#f7f7f6] px-3 py-4 text-neutral-900">
      <ul className="space-y-0.5">
        {NAV.map(({ id, label, Icon }) => {
          const count = counts[id];
          const isActive = active === id;
          return (
            <li key={id}>
              <button
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectSection(id)}
                className={`flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm ${FOCUS} ${
                  isActive ? 'bg-neutral-200/70 font-medium' : 'hover:bg-neutral-100'
                }`}
              >
                <Icon className="h-[18px] w-[18px] text-neutral-600" strokeWidth={1.75} />
                <span className="flex-1 text-left">{label}</span>
                {count !== undefined && <span className="text-sm font-normal text-neutral-400">{count}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-6 px-3 text-[13px] text-neutral-500">My calendars</h3>
      <ul className="mt-2 space-y-0.5">
        {CALENDAR_TYPE_ORDER.map((type) => {
          const on = filters.types[type];
          const color = CALENDAR_TYPES[type].dot;
          return (
            <li key={type}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => onToggleType(type)}
                className={`flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm hover:bg-neutral-100 ${FOCUS}`}
              >
                <span
                  aria-hidden
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px]"
                  style={
                    on
                      ? { backgroundColor: color, border: `1.5px solid ${color}` }
                      : { backgroundColor: '#fff', border: `1.5px solid ${color}` }
                  }
                >
                  {on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </span>
                <span>{CALENDAR_TYPES[type].label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-6 px-3 text-[13px] text-neutral-500">Priority</h3>
      <div className="mt-2 flex flex-wrap gap-1.5 px-3">
        {PRIORITY_ORDER.map((priority) => {
          const on = filters.priorities[priority];
          return (
            <button
              key={priority}
              type="button"
              aria-pressed={on}
              onClick={() => onTogglePriority(priority)}
              className={`h-7 rounded-full border px-2.5 text-xs ${FOCUS} ${
                on
                  ? 'border-neutral-300 bg-white font-medium text-neutral-800'
                  : 'border-transparent bg-transparent text-neutral-400 line-through hover:bg-neutral-100'
              }`}
            >
              {PRIORITY_LABELS[priority]}
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="border-t border-neutral-200 pt-2">
        <button
          type="button"
          onClick={onSettings}
          className={`flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm hover:bg-neutral-100 ${FOCUS}`}
        >
          <Settings className="h-[18px] w-[18px] text-neutral-600" strokeWidth={1.75} />
          Settings
        </button>
        <div className="mt-1 flex items-center gap-3 px-2 py-1.5">
          {userImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userImage} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-300 text-xs font-medium text-neutral-700"
            >
              {initials(userName)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{userName}</div>
            <div className="truncate text-[13px] text-neutral-500">{userSubtitle}</div>
          </div>
          <button
            type="button"
            aria-label="Account menu"
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-200/60 ${FOCUS}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
