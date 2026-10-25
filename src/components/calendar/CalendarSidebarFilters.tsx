import { Check } from 'lucide-react';
import { CALENDAR_TYPES, CALENDAR_TYPE_ORDER, PRIORITY_LABELS, PRIORITY_ORDER } from '@/lib/calendar/theme';
import type { CalendarFilters, CalendarPriority, CalendarType } from '@/lib/calendar/types';

export interface CalendarSidebarFiltersProps {
  filters: CalendarFilters;
  onToggleType: (type: CalendarType) => void;
  onTogglePriority: (priority: CalendarPriority) => void;
}

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-slate-400';

export function CalendarSidebarFilters({ filters, onToggleType, onTogglePriority }: CalendarSidebarFiltersProps) {
  return (
    <nav aria-label="Calendar sidebar" className="flex h-full flex-col bg-[#f8fafc] px-3 py-4 text-slate-900">
      <h3 className="px-3 text-[13px] text-slate-500">Types</h3>
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
                className={`flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm hover:bg-slate-100 ${FOCUS}`}
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

      <h3 className="mt-6 px-3 text-[13px] text-slate-500">Priority</h3>
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
                  ? 'border-slate-300 bg-white font-medium text-slate-800'
                  : 'border-transparent bg-transparent text-slate-400 line-through hover:bg-slate-100'
              }`}
            >
              {PRIORITY_LABELS[priority]}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
