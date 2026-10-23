'use client';

import { useRef, type TouchEvent } from 'react';
import { differenceInMinutes, format } from 'date-fns';
import { Clock } from 'lucide-react';
import { formatRange } from '@/lib/calendar/layout';
import { CALENDAR_TYPES, PRIORITY_LABELS } from '@/lib/calendar/theme';
import type { CalendarItem, UnscheduledItem } from '@/lib/calendar/types';

export interface DayAgendaProps {
  /** The selected day's blocks (planned + logged), already filtered. Any order. */
  items: CalendarItem[];
  /** Whether the day shown is today (controls the "Now" marker). */
  isToday: boolean;
  now: Date;
  unscheduled: UnscheduledItem[];
  addable: { id: string; title: string }[];
  activeActivityId?: string;
  onSelectItem: (item: CalendarItem, anchor: HTMLElement) => void;
  /** Give an unscheduled task a time ('HH:MM') on this day. */
  onSchedule: (activityId: string, time: string) => void;
  onAddToDay: (activityId: string) => void;
  onOpenItem: (activityId: string) => void;
  /** Swipe left / right to change day. */
  onPrevDay: () => void;
  onNextDay: () => void;
}

const NOW_COLOR = '#e0624a';
const QUICK_TIMES = ['09:00', '13:00', '16:00'];
const TIME_BUTTON_CLASS =
  'inline-flex h-9 min-w-16 items-center justify-center rounded-lg bg-neutral-100 px-3 text-[13px] font-medium tabular-nums text-neutral-800 active:bg-neutral-200';

function AgendaRow({
  item,
  focusing,
  onSelect,
}: {
  item: CalendarItem;
  focusing: boolean;
  onSelect: DayAgendaProps['onSelectItem'];
}) {
  const theme = CALENDAR_TYPES[item.type];
  const logged = item.kind === 'logged';
  const minutes = differenceInMinutes(item.end, item.start);
  const range = formatRange(item.start, item.end);
  const cardStyle: React.CSSProperties = logged
    ? { background: theme.fillSoft, border: `1.5px dashed ${theme.border}` }
    : { background: theme.fill, boxShadow: focusing ? 'inset 0 0 0 2px #6366f1' : undefined };

  return (
    <button
      type="button"
      onClick={(e) => onSelect(item, e.currentTarget)}
      aria-label={`${item.title}, ${range}, ${logged ? 'logged' : 'planned'}${item.completed ? ', done' : ''}`}
      className={`flex min-h-14 w-full gap-3 rounded-xl px-2 py-2 text-left outline-none hover:bg-neutral-50 active:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-400 ${
        item.completed ? 'opacity-60' : ''
      }`}
    >
      <span className="w-12 shrink-0">
        <span className="block text-[13px] font-medium tabular-nums text-neutral-900">{format(item.start, 'HH:mm')}</span>
        <span className="block text-[12px] tabular-nums text-neutral-400">{format(item.end, 'HH:mm')}</span>
      </span>
      <span className="block min-w-0 flex-1 rounded-lg px-3 py-2" style={cardStyle}>
        <span
          className={`block truncate text-[14px] font-medium ${item.completed ? 'line-through' : ''}`}
          style={{ color: theme.text }}
        >
          {item.title}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[12px]" style={{ color: theme.textMuted }}>
          {logged ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden />
              Logged {minutes} min
            </span>
          ) : (
            <span>
              {minutes} min · {PRIORITY_LABELS[item.priority]}
            </span>
          )}
          {item.checklist && (
            <span>
              · {item.checklist.done}/{item.checklist.total}
            </span>
          )}
          {focusing && (
            <span className="rounded-full bg-indigo-50 px-2 text-[11px] font-medium text-indigo-700">Focusing</span>
          )}
        </span>
      </span>
    </button>
  );
}

function NowMarker({ now }: { now: Date }) {
  return (
    <div className="flex items-center gap-3 px-2 py-1" role="separator" aria-label={`Now, ${format(now, 'HH:mm')}`}>
      <span className="flex w-12 shrink-0">
        <span className="rounded-[5px] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white" style={{ background: NOW_COLOR }}>
          {format(now, 'HH:mm')}
        </span>
      </span>
      <span className="relative h-[2px] flex-1" style={{ background: NOW_COLOR }}>
        <span
          className="absolute left-0 top-1/2 size-[9px] -translate-y-1/2 rounded-full"
          style={{ background: NOW_COLOR }}
        />
      </span>
    </div>
  );
}

function UnscheduledCard({
  item,
  onSchedule,
  onOpenItem,
}: {
  item: UnscheduledItem;
  onSchedule: DayAgendaProps['onSchedule'];
  onOpenItem: DayAgendaProps['onOpenItem'];
}) {
  const theme = CALENDAR_TYPES[item.type];
  return (
    <li className="space-y-2.5 rounded-xl border border-neutral-200 p-3">
      <button
        type="button"
        onClick={() => onOpenItem(item.id)}
        className="block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
      >
        <span className="flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-sm" style={{ background: theme.dot }} aria-hidden />
          <span
            className={`min-w-0 flex-1 truncate text-[14px] font-medium text-neutral-900 ${
              item.completed ? 'line-through opacity-60' : ''
            }`}
          >
            {item.title}
          </span>
        </span>
        <span className="mt-0.5 block pl-4 text-[12px] text-neutral-500">
          {item.durationMinutes} min · {PRIORITY_LABELS[item.priority]}
        </span>
      </button>
      {!item.completed && (
        <div>
          <p className="mb-1.5 text-[12px] text-neutral-500">Schedule at</p>
          <div className="flex gap-2">
            {QUICK_TIMES.map((time) => (
              <button
                key={time}
                type="button"
                onClick={() => onSchedule(item.id, time)}
                aria-label={`Schedule ${item.title} at ${time}`}
                className={TIME_BUTTON_CLASS}
              >
                {time}
              </button>
            ))}
            <label className={`relative overflow-hidden focus-within:ring-2 focus-within:ring-neutral-400 ${TIME_BUTTON_CLASS}`}>
              Other…
              <input
                type="time"
                step={1800}
                aria-label={`Pick a time for ${item.title}`}
                className="absolute inset-0 h-full w-full opacity-0"
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  if (!value) return;
                  onSchedule(item.id, value.slice(0, 5));
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>
        </div>
      )}
    </li>
  );
}

export function DayAgenda({
  items,
  isToday,
  now,
  unscheduled,
  addable,
  activeActivityId,
  onSelectItem,
  onSchedule,
  onAddToDay,
  onOpenItem,
  onPrevDay,
  onNextDay,
}: DayAgendaProps) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const sorted = [...items].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || Number(a.kind === 'logged') - Number(b.kind === 'logged'),
  );
  const nowIndex = isToday ? sorted.findIndex((item) => item.start.getTime() > now.getTime()) : -1;
  const nowAt = isToday ? (nowIndex === -1 ? sorted.length : nowIndex) : -1;

  const isFormField = (target: EventTarget) => target instanceof Element && target.closest('select, input') !== null;

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    touchStart.current = touch && !isFormField(e.target) ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    const touch = e.changedTouches[0];
    touchStart.current = null;
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
      if (dx < 0) onNextDay();
      else onPrevDay();
    }
  };

  const rows: React.ReactNode[] = [];
  sorted.forEach((item, i) => {
    if (i === nowAt) rows.push(<NowMarker key="now" now={now} />);
    rows.push(
      <AgendaRow
        key={item.id}
        item={item}
        focusing={item.kind === 'planned' && activeActivityId === item.activityId}
        onSelect={onSelectItem}
      />,
    );
  });
  if (nowAt === sorted.length) rows.push(<NowMarker key="now" now={now} />);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="px-3 py-3">
        {/* Keeps Unscheduled well below the schedule on light days. */}
        <section aria-label="Schedule" className="flex min-h-[40dvh] flex-col gap-1">
          {rows}
          {sorted.length === 0 && (
            <p className="my-auto py-6 text-center text-[13px] text-neutral-500">Nothing scheduled. Pick a time for a task below.</p>
          )}
        </section>

        <section aria-label="Unscheduled" className="mt-5 border-t border-neutral-100 pt-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-[14px] font-medium text-neutral-900">Unscheduled</h2>
            <span className="rounded-full bg-neutral-100 px-2 text-xs text-neutral-600">{unscheduled.length}</span>
            {addable.length > 0 && (
              <select
                aria-label="Add a task to this day"
                value=""
                onChange={(e) => {
                  if (e.target.value) onAddToDay(e.target.value);
                }}
                className="ml-auto h-9 max-w-[160px] rounded-lg border border-neutral-200 bg-white px-2 text-[13px] text-neutral-700"
              >
                <option value="">+ Add task</option>
                {addable.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          {unscheduled.length === 0 ? (
            <p className="text-[13px] text-neutral-500">Nothing unscheduled on this day.</p>
          ) : (
            <ul className="space-y-2">
              {unscheduled.map((item) => (
                <UnscheduledCard key={item.id} item={item} onSchedule={onSchedule} onOpenItem={onOpenItem} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
