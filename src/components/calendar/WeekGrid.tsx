import React, { useEffect, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { format, isSameDay, isWeekend } from 'date-fns';
import type { CalendarItem } from '@/lib/calendar/types';
import { GRID_END_HOUR, GRID_START_HOUR, HOUR_HEIGHT, SNAP_MINUTES } from '@/lib/calendar/theme';
import { layoutDay, timezoneLabel, topFor } from '@/lib/calendar/layout';
import { EventCard } from './EventCard';

const HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => GRID_START_HOUR + i);
const GRID_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT;
/** Room above the 07:00 line so its label isn't clipped. */
const GRID_PAD_TOP = 16;
const GUTTER_WIDTH = 76;

export const dayDropId = (day: Date) => `day:${format(day, 'yyyy-MM-dd')}`;

export interface DayDropData {
  day: Date;
}

/** Where a dragged item would land, already snapped. */
export interface DropPreview {
  dropId: string;
  top: number;
  height: number;
  label: string;
}

export interface WeekGridProps {
  days: Date[];
  items: CalendarItem[];
  now: Date;
  selectedId: string | null;
  /** The day the tray and logged summary follow. */
  selectedDay: Date;
  /** Activity with a running focus timer. */
  activeActivityId?: string;
  dropPreview: DropPreview | null;
  onSelectItem: (item: CalendarItem, anchor: HTMLElement) => void;
  onSelectDay: (day: Date) => void;
  /** Click on an empty slot: new activity at `time` ('HH:MM'). */
  onCreateAt: (day: Date, time: string) => void;
}

function DayColumn({
  day,
  items,
  now,
  selectedId,
  activeActivityId,
  dropPreview,
  onSelectItem,
  onCreateAt,
}: {
  day: Date;
  items: CalendarItem[];
  now: Date;
  selectedId: string | null;
  activeActivityId?: string;
  dropPreview: DropPreview | null;
  onSelectItem: WeekGridProps['onSelectItem'];
  onCreateAt: WeekGridProps['onCreateAt'];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(day), data: { day } satisfies DayDropData });
  const isToday = isSameDay(day, now);
  const nowTop = topFor(now);
  const showNow = isToday && nowTop >= 0 && nowTop <= GRID_HEIGHT;

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Only clicks on the empty column, not on cards or overlays.
    if (event.target !== event.currentTarget) return;
    const minutes = Math.floor(((event.nativeEvent.offsetY / HOUR_HEIGHT) * 60) / SNAP_MINUTES) * SNAP_MINUTES;
    const total = GRID_START_HOUR * 60 + Math.max(0, minutes);
    onCreateAt(day, `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`);
  };

  return (
    <div
      ref={setNodeRef}
      data-drop-id={dayDropId(day)}
      onClick={handleClick}
      title="Click an empty slot to add an activity"
      className={`relative cursor-cell border-l border-neutral-200 transition-colors ${
        isOver ? 'bg-neutral-100/80' : isWeekend(day) ? 'bg-neutral-50/80' : ''
      }`}
      style={{ height: GRID_HEIGHT }}
    >
      {layoutDay(items).map((positioned) => (
        <EventCard
          key={positioned.item.id}
          item={positioned.item}
          top={positioned.top}
          height={positioned.height}
          column={positioned.column}
          columns={positioned.columns}
          selected={positioned.item.id === selectedId}
          active={positioned.item.activityId === activeActivityId}
          onSelect={onSelectItem}
        />
      ))}
      {dropPreview && (
        <div
          className="pointer-events-none absolute inset-x-1 z-10 rounded-lg border-[1.5px] border-dashed border-neutral-400 bg-neutral-900/[0.03] px-2 py-1 text-[11px] font-medium tabular-nums text-neutral-500"
          style={{ top: dropPreview.top, height: dropPreview.height }}
        >
          {dropPreview.label}
        </div>
      )}
      {showNow && (
        <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop }}>
          <div className="absolute -left-[5px] -top-[4.5px] size-[9px] rounded-full bg-[#e0624a]" />
          <div className="h-[2px] -translate-y-1/2 bg-[#e0624a]" />
        </div>
      )}
    </div>
  );
}

export function WeekGrid({
  days,
  items,
  now,
  selectedId,
  selectedDay,
  activeActivityId,
  dropPreview,
  onSelectItem,
  onSelectDay,
  onCreateAt,
}: WeekGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const columns = `${GUTTER_WIDTH}px repeat(${days.length}, minmax(0, 1fr))`;
  const showsToday = days.some((day) => isSameDay(day, now));
  const nowTop = topFor(now);
  const nowInRange = showsToday && nowTop >= 0 && nowTop <= GRID_HEIGHT;

  // Open scrolled to an hour before now (or 08:00), like a desktop calendar.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = nowInRange ? nowTop - HOUR_HEIGHT * 1.5 : HOUR_HEIGHT;
    el.scrollTop = Math.max(0, target);
    // Only on mount: later ticks of `now` must not yank the scroll position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
      <div className={days.length > 1 ? 'min-w-[760px]' : ''}>
        {/* Day headers */}
        <div
          className="sticky top-0 z-20 grid border-b border-neutral-200 bg-white"
          style={{ gridTemplateColumns: columns }}
        >
          <div className="flex h-12 items-center px-3 text-[12px] text-neutral-500">{timezoneLabel(now)}</div>
          {days.map((day) => {
            const isToday = isSameDay(day, now);
            const isSelected = days.length > 1 && isSameDay(day, selectedDay);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => onSelectDay(day)}
                aria-pressed={isSelected}
                aria-label={format(day, 'EEEE, MMMM d')}
                className={`flex h-12 items-center gap-2 px-3 text-left text-[13px] outline-none hover:bg-neutral-100/70 focus-visible:bg-neutral-100 ${
                  isSelected ? 'shadow-[inset_0_-2px_0_#171717]' : ''
                } ${isWeekend(day) ? 'bg-neutral-50/80' : ''}`}
              >
                <span className={isToday ? 'font-medium text-neutral-900' : 'text-neutral-500'}>{format(day, 'EEE')}</span>
                {isToday ? (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-neutral-900 px-1 font-medium text-white">
                    {format(day, 'd')}
                  </span>
                ) : (
                  <span className="font-medium text-neutral-900">{format(day, 'd')}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="relative grid pb-6" style={{ gridTemplateColumns: columns, paddingTop: GRID_PAD_TOP }}>
          <div className="relative" style={{ height: GRID_HEIGHT }}>
            {HOURS.map((hour) => (
              <span
                key={hour}
                className="absolute right-3 -translate-y-1/2 text-[12px] tabular-nums text-neutral-500"
                style={{ top: (hour - GRID_START_HOUR) * HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, '0')}:00
              </span>
            ))}
            {nowInRange && (
              <span
                className="absolute right-1.5 z-10 -translate-y-1/2 rounded-[5px] bg-[#e0624a] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white"
                style={{ top: nowTop }}
              >
                {format(now, 'HH:mm')}
              </span>
            )}
          </div>

          {/* Hour lines sit behind the day columns. */}
          <div
            className="pointer-events-none absolute right-0"
            style={{ left: GUTTER_WIDTH, top: GRID_PAD_TOP, height: GRID_HEIGHT }}
          >
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute inset-x-0 border-t border-neutral-200/80"
                style={{ top: (hour - GRID_START_HOUR) * HOUR_HEIGHT }}
              />
            ))}
            {nowInRange && (
              <div className="absolute inset-x-0 h-px bg-[#e0624a]/40" style={{ top: nowTop }} />
            )}
          </div>

          {days.map((day) => (
            <DayColumn
              key={day.toISOString()}
              day={day}
              items={items.filter((item) => item.day === format(day, 'yyyy-MM-dd'))}
              now={now}
              selectedId={selectedId}
              activeActivityId={activeActivityId}
              onCreateAt={onCreateAt}
              dropPreview={dropPreview?.dropId === dayDropId(day) ? dropPreview : null}
              onSelectItem={onSelectItem}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
