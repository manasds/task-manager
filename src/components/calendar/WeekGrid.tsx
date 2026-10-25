import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { format, isSameDay, isWeekend } from 'date-fns';
import type { CalendarItem } from '@/lib/calendar/types';
import {
  GRID_END_HOUR,
  GRID_MINUTES,
  GRID_START_HOUR,
  GRID_WIDTH,
  HOUR_WIDTH,
  LANE_HEIGHT,
  SNAP_MINUTES,
} from '@/lib/calendar/theme';
import { toTimeString } from '@/lib/calendar/activities';
import { laneCount, layoutDay, offsetFor, timezoneLabel } from '@/lib/calendar/layout';
import { EventCard } from './EventCard';

const HOURS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => GRID_START_HOUR + i);

/** Room left of the 07:00 line so its label isn't clipped, and after 23:00 for the last one. */
const TIME_PAD = 20;
const GUTTER_WIDTH = 96;

/** Space above the first lane and below the last one in a day row. */
const ROW_PAD = 6;

/** Gap between stacked cards. */
const LANE_GAP = 4;

/** Day view has one row with room to spare: fixed, tall cards (h-28) instead of stretched ones. */
const DAY_CARD_HEIGHT = 112;

/** Hour lines drawn as the row's background, so they line up with the cards for free. */
const HOUR_LINES = `repeating-linear-gradient(to right, rgb(226 232 240 / 0.9) 0 1px, transparent 1px ${HOUR_WIDTH}px)`;

const NO_ITEMS: CalendarItem[] = [];

export const dayDropId = (day: Date) => `day:${format(day, 'yyyy-MM-dd')}`;

export interface DayDropData {
  day: Date;
}

/** Where a dragged item would land, already snapped. */
export interface DropPreview {
  dropId: string;
  left: number;
  width: number;
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

function DayRow({
  day,
  items,
  now,
  selected,
  dayView,
  selectedId,
  activeActivityId,
  dropPreview,
  onSelectItem,
  onSelectDay,
  onCreateAt,
}: {
  day: Date;
  items: CalendarItem[];
  now: Date;
  /** Highlight the label: the day the tray and summary follow. */
  selected: boolean;
  /** Single-day view: tall fixed-height cards instead of lanes that share the row height. */
  dayView: boolean;
  selectedId: string | null;
  activeActivityId?: string;
  dropPreview: DropPreview | null;
  onSelectItem: WeekGridProps['onSelectItem'];
  onSelectDay: WeekGridProps['onSelectDay'];
  onCreateAt: WeekGridProps['onCreateAt'];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(day), data: { day } satisfies DayDropData });
  const positioned = useMemo(() => layoutDay(items), [items]);
  const lanes = laneCount(positioned);
  const isToday = isSameDay(day, now);
  const weekend = isWeekend(day);
  const laneHeight = dayView ? DAY_CARD_HEIGHT + LANE_GAP : LANE_HEIGHT;

  // Week rows stretch to fill the panel, so lanes split the row's real height (each card ~85%+ of
  // its share). Day view stacks fixed-height lanes from the top.
  const laneBox = (lane: number) =>
    dayView
      ? { top: `${ROW_PAD + lane * laneHeight}px`, height: `${DAY_CARD_HEIGHT}px` }
      : {
          top: `calc(${(lane / lanes) * 100}% + ${LANE_GAP}px)`,
          height: `calc(${100 / lanes}% - ${LANE_GAP * 2}px)`,
        };

  // Snapped slot under the mouse on empty space: shows where a click would create an activity.
  const [hoverMinutes, setHoverMinutes] = useState<number | null>(null);

  const slotAt = (event: React.MouseEvent<HTMLDivElement>) => {
    // Only the empty row, not cards or overlays.
    if (event.target !== event.currentTarget) return null;
    const minutes = Math.floor(((event.nativeEvent.offsetX / HOUR_WIDTH) * 60) / SNAP_MINUTES) * SNAP_MINUTES;

    return Math.min(Math.max(0, minutes), GRID_MINUTES - SNAP_MINUTES);
  };

  const slotTime = (minutes: number) => {
    const slot = new Date(day);
    slot.setHours(GRID_START_HOUR, minutes, 0, 0);

    return toTimeString(slot);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const minutes = slotAt(event);

    if (minutes !== null) onCreateAt(day, slotTime(minutes));
  };

  return (
    <div
      className="flex min-h-14 basis-0 border-b border-slate-200 last:border-b-0"
      // Busy days take a bigger share of the panel; empty days shrink toward their minimum.
      style={{ flexGrow: items.length > 0 ? 2 + lanes : 1 }}
    >
      <button
        type="button"
        onClick={() => onSelectDay(day)}
        aria-pressed={selected}
        aria-label={format(day, 'EEEE, MMMM d')}
        className={`sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-slate-200 px-3 text-left text-[13px] outline-none hover:bg-slate-100 focus-visible:bg-slate-100 ${
          weekend ? 'bg-slate-50' : 'bg-white'
        } ${selected ? 'shadow-[inset_2px_0_0_#0f172a]' : ''}`}
        style={{ width: GUTTER_WIDTH }}
      >
        <span className={isToday ? 'font-medium text-slate-900' : 'text-slate-500'}>{format(day, 'EEE')}</span>
        {isToday ? (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-slate-900 px-1 font-medium text-white">
            {format(day, 'd')}
          </span>
        ) : (
          <span className="font-medium text-slate-900">{format(day, 'd')}</span>
        )}
      </button>

      <div
        ref={setNodeRef}
        data-drop-id={dayDropId(day)}
        onClick={handleClick}
        onMouseMove={(event) => {
          const minutes = slotAt(event);
          setHoverMinutes((current) => (current === minutes ? current : minutes));
        }}
        onMouseLeave={() => setHoverMinutes(null)}
        aria-label={`${format(day, 'EEEE')}: click an empty slot to add an activity`}
        className={`relative shrink-0 cursor-cell transition-colors ${
          isOver ? 'bg-slate-100/80' : weekend ? 'bg-slate-50/80' : ''
        }`}
        style={{
          marginLeft: TIME_PAD,
          marginRight: TIME_PAD,
          width: GRID_WIDTH,
          minHeight: lanes * laneHeight + ROW_PAD * 2 - LANE_GAP,
          backgroundImage: HOUR_LINES,
          backgroundSize: `${HOUR_WIDTH}px 100%`,
        }}
      >
        {positioned.map((card) => {
          return (
            <EventCard
              key={card.item.id}
              item={card.item}
              left={card.left}
              width={card.width}
              {...laneBox(card.lane)}
              roomy={dayView}
              strip={card.strip}
              hasStrips={card.hasStrips}
              selected={card.item.id === selectedId}
              active={card.item.activityId === activeActivityId}
              onSelect={onSelectItem}
            />
          );
        })}
        {hoverMinutes !== null && !dropPreview && (
          <div
            className="pointer-events-none absolute flex items-center rounded-lg bg-slate-900/[0.04] px-2 text-[11px] font-medium tabular-nums text-slate-500"
            style={{
              left: (hoverMinutes / 60) * HOUR_WIDTH + 2,
              width: (SNAP_MINUTES / 60) * HOUR_WIDTH - 4,
              ...laneBox(0),
            }}
          >
            + {slotTime(hoverMinutes)}
          </div>
        )}
        {dropPreview && (
          <div
            className="pointer-events-none absolute z-10 truncate rounded-lg border-[1.5px] border-dashed border-slate-400 bg-slate-900/[0.03] px-2 py-1 text-[11px] font-medium tabular-nums text-slate-500"
            style={{ left: dropPreview.left, width: dropPreview.width, ...laneBox(0) }}
          >
            {dropPreview.label}
          </div>
        )}
      </div>
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

  // One pass over the items, so each row gets a stable array and only re-lays-out when it changes.
  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();

    for (const item of items) map.set(item.day, [...(map.get(item.day) ?? []), item]);

    return map;
  }, [items]);

  const showsToday = days.some((day) => isSameDay(day, now));
  const nowLeft = offsetFor(now);
  const nowInRange = showsToday && nowLeft >= 0 && nowLeft <= GRID_WIDTH;
  const timeOrigin = GUTTER_WIDTH + TIME_PAD;

  // Open scrolled to an hour and a half before now (or 08:00), like a desktop calendar.
  useEffect(() => {
    const el = scrollRef.current;

    if (!el) return;
    const target = nowInRange ? nowLeft - HOUR_WIDTH * 1.5 : HOUR_WIDTH;
    el.scrollLeft = Math.max(0, target);
    // Only on mount: later ticks of `now` must not yank the scroll position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
      <div className="relative flex min-h-full w-max flex-col">
        {/* Hour header */}
        <div className="sticky top-0 z-30 flex h-10 shrink-0 border-b border-slate-200 bg-white">
          <div
            className="sticky left-0 z-10 flex shrink-0 items-center border-r border-slate-200 bg-white px-3 text-[12px] text-slate-500"
            style={{ width: GUTTER_WIDTH }}
          >
            {timezoneLabel(now)}
          </div>
          <div className="relative shrink-0" style={{ width: GRID_WIDTH + TIME_PAD * 2 }}>
            {HOURS.map((hour) => (
              <span
                key={hour}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[12px] tabular-nums text-slate-500"
                style={{ left: TIME_PAD + (hour - GRID_START_HOUR) * HOUR_WIDTH }}
              >
                {String(hour).padStart(2, '0')}:00
              </span>
            ))}
            {nowInRange && (
              <span
                className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-[5px] bg-[#c2410c] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white"
                style={{ left: TIME_PAD + nowLeft }}
              >
                {format(now, 'HH:mm')}
              </span>
            )}
          </div>
        </div>

        {/* One row per day */}
        <div className="relative flex flex-1 flex-col">
          {days.map((day) => (
            <DayRow
              key={day.toISOString()}
              day={day}
              items={itemsByDay.get(format(day, 'yyyy-MM-dd')) ?? NO_ITEMS}
              now={now}
              selected={days.length > 1 && isSameDay(day, selectedDay)}
              dayView={days.length === 1}
              selectedId={selectedId}
              activeActivityId={activeActivityId}
              dropPreview={dropPreview?.dropId === dayDropId(day) ? dropPreview : null}
              onSelectItem={onSelectItem}
              onSelectDay={onSelectDay}
              onCreateAt={onCreateAt}
            />
          ))}
          {nowInRange && (
            <div
              className="pointer-events-none absolute inset-y-0 z-10 w-[2px] -translate-x-1/2 bg-[#c2410c]"
              style={{ left: timeOrigin + nowLeft }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
