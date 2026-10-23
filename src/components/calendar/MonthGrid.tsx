import React from 'react';
import { addDays, endOfMonth, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import type { CalendarItem } from '@/lib/calendar/types';
import { CALENDAR_TYPES } from '@/lib/calendar/theme';
import { WEEK_OPTIONS } from '@/lib/calendar/mock';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_DOTS = 5;

export interface MonthGridProps {
  month: Date;
  items: CalendarItem[];
  today: Date;
  onSelectDate: (date: Date) => void;
}

/** Month at a glance: one coloured dot per activity. Picking a day opens it in Day view. */
export function MonthGrid({ month, items, today, onSelectDate }: MonthGridProps) {
  const first = startOfWeek(startOfMonth(month), WEEK_OPTIONS);
  const weeks = Math.ceil((endOfMonth(month).getTime() - first.getTime()) / (7 * 86_400_000));
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="grid grid-cols-7 border-b border-neutral-200">
        {WEEKDAYS.map((label) => (
          <div key={label} className="px-3 py-2.5 text-[12px] text-neutral-500">
            {label}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7" style={{ gridAutoRows: 'minmax(84px, 1fr)' }}>
        {days.map((day) => {
          const dayItems = items.filter((item) => isSameDay(item.start, day));
          const isToday = isSameDay(day, today);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate(day)}
              aria-label={`${format(day, 'EEEE, MMMM d')}, ${dayItems.length} activities`}
              className="flex flex-col items-start gap-2 border-b border-l border-neutral-200 p-2.5 text-left outline-none hover:bg-neutral-50 focus-visible:bg-neutral-100"
            >
              <span
                className={`flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-[13px] ${
                  isToday
                    ? 'bg-neutral-900 font-medium text-white'
                    : isSameMonth(day, month)
                      ? 'font-medium text-neutral-900'
                      : 'text-neutral-400'
                }`}
              >
                {format(day, 'd')}
              </span>
              {dayItems.length > 0 && (
                <span className="flex flex-wrap items-center gap-1">
                  {dayItems.slice(0, MAX_DOTS).map((item) => (
                    <span
                      key={item.id}
                      className="size-2 rounded-full"
                      style={{ backgroundColor: CALENDAR_TYPES[item.type].dot }}
                    />
                  ))}
                  {dayItems.length > MAX_DOTS && (
                    <span className="text-[11px] text-neutral-500">+{dayItems.length - MAX_DOTS}</span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
