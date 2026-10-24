import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { Clock } from 'lucide-react';
import { formatRange } from '@/lib/calendar/layout';
import { CALENDAR_TYPES } from '@/lib/calendar/theme';
import type { CalendarItem } from '@/lib/calendar/types';

export interface UpcomingRailProps {
  /** Already filtered by caller. */
  items: CalendarItem[];
  today: Date;
  /** For "No more events today". */
  now: Date;
  onSelectItem: (item: CalendarItem, anchor: HTMLElement) => void;
}

interface DayGroup {
  day: Date;
  items: CalendarItem[];
}

function dayLabel(day: Date, today: Date): string {
  if (isSameDay(day, today)) return `Today, ${format(day, 'EEE d')}`;

  if (isSameDay(day, addDays(today, 1))) return `Tomorrow, ${format(day, 'EEE d')}`;

  return format(day, 'EEE d');
}

export function UpcomingRail({ items, today, now, onSelectItem }: UpcomingRailProps) {
  const todayStart = startOfDay(today);
  const windowEnd = addDays(todayStart, 7);

  const upcoming = items
    .filter((item) => item.start >= now && item.start < windowEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Today's group is always present, even when empty.
  const groups: DayGroup[] = [{ day: todayStart, items: [] }];

  for (const item of upcoming) {
    const last = groups[groups.length - 1];

    if (isSameDay(last.day, item.start)) last.items.push(item);
    else groups.push({ day: startOfDay(item.start), items: [item] });
  }

  return (
    <section aria-label="Upcoming events" className="flex h-full min-h-0 flex-col">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-neutral-900">Upcoming</h2>
        <span className="text-sm text-neutral-500">Next 7 days</span>
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.day.toISOString()}>
            <h3 className="text-sm text-neutral-500">{dayLabel(group.day, today)}</h3>
            {group.items.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-400">No more events today</p>
            ) : (
              <ul className="mt-1.5 space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={(e) => onSelectItem(item, e.currentTarget)}
                      className="flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-neutral-400"
                    >
                      <span
                        aria-hidden
                        className="mt-[6px] h-2 w-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: CALENDAR_TYPES[item.type].dot }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-neutral-900">{item.title}</span>
                          {item.kind === 'logged' && (
                            <Clock aria-label="Logged" className="w-3 shrink-0 text-neutral-400" />
                          )}
                        </span>
                        <span className="block truncate text-[13px] text-neutral-500">
                          {formatRange(item.start, item.end)} · {CALENDAR_TYPES[item.type].label}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
