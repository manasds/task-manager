import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { WEEK_OPTIONS } from '@/lib/calendar/theme';

export interface MiniMonthProps {
  /** Any date in the visible week/day; its Monday-start week row gets a light highlight band. */
  anchorDate: Date;
  today: Date;
  /** Month currently displayed in the mini calendar (first of month). */
  month: Date;
  onMonthChange: (month: Date) => void;
  onSelectDate: (date: Date) => void;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-neutral-400';

export function MiniMonth({ anchorDate, today, month, onMonthChange, onSelectDate }: MiniMonthProps) {
  const first = startOfMonth(month);
  const days = eachDayOfInterval({
    start: startOfWeek(first, WEEK_OPTIONS),
    end: endOfWeek(endOfMonth(first), WEEK_OPTIONS),
  });
  const weeks = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
  const anchorWeekStart = startOfWeek(anchorDate, WEEK_OPTIONS);

  return (
    <div className="select-none">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-medium text-neutral-900">{format(month, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonthChange(addMonths(first, -1))}
            className={`flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-200/60 ${FOCUS}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => onMonthChange(addMonths(first, 1))}
            className={`flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-200/60 ${FOCUS}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 text-center text-xs text-neutral-400">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="flex h-8 items-center justify-center">
            {d}
          </div>
        ))}
      </div>

      <div className="flex flex-col">
        {weeks.map((week) => {
          const isAnchorWeek = isSameDay(week[0], anchorWeekStart);
          return (
            <div
              key={week[0].toISOString()}
              className={`grid grid-cols-7 rounded-lg ${isAnchorWeek ? 'bg-neutral-200/60' : ''}`}
            >
              {week.map((day) => {
                const isToday = isSameDay(day, today);
                const inMonth = isSameMonth(day, first);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    aria-label={format(day, 'EEEE, MMMM d, yyyy')}
                    aria-current={isToday ? 'date' : undefined}
                    onClick={() => onSelectDate(day)}
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-sm tabular-nums ${FOCUS} ${
                      isToday
                        ? 'bg-neutral-900 font-medium text-white'
                        : `${inMonth ? 'text-neutral-900' : 'text-neutral-400'} hover:bg-neutral-200/70`
                    }`}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
