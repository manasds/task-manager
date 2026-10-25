import { differenceInMinutes, format } from 'date-fns';
import type { CalendarItem, CalendarFilters } from './types';
import { GRID_START_HOUR, GRID_WIDTH, HOUR_WIDTH, MIN_CARD_WIDTH } from './theme';

export interface PositionedItem {
  item: CalendarItem;
  /** Horizontal box inside the day row, in px. */
  left: number;
  width: number;
  /** Stacked lane within the row: cards that overlap in time go on separate lanes. */
  lane: number;
  /**
   * Logged session drawn as a strip on its own activity's planned card, instead of taking a lane.
   * Set on the session; the planned card gets `hasStrips`.
   */
  strip?: boolean;
  hasStrips?: boolean;
}

function minutesIntoGrid(date: Date): number {
  return (date.getHours() - GRID_START_HOUR) * 60 + date.getMinutes();
}

/** Distance from the 07:00 edge, in px. */
export function offsetFor(date: Date): number {
  return (minutesIntoGrid(date) / 60) * HOUR_WIDTH;
}

/** Where a card is drawn: pinned inside 07:00–23:00 and at least MIN_CARD_WIDTH wide. */
function cardBox(item: CalendarItem) {
  const rawLeft = offsetFor(item.start);
  const rawRight = rawLeft + (differenceInMinutes(item.end, item.start) / 60) * HOUR_WIDTH;
  const left = Math.min(Math.max(0, rawLeft), GRID_WIDTH - MIN_CARD_WIDTH);
  const right = Math.min(GRID_WIDTH, Math.max(left + MIN_CARD_WIDTH, rawRight));

  return { left, width: right - left };
}

/**
 * Lay out one day's row: each card takes the first lane that is free at its start.
 * Overlap uses the drawn boxes, so short or pinned blocks never cover each other.
 */
export function layoutDay(items: CalendarItem[]): PositionedItem[] {
  const planned = items.filter((item) => item.kind === 'planned');

  // A session that overlaps its own planned block is "how the plan went", not a separate event.
  const hostOf = (item: CalendarItem) =>
    item.kind === 'logged'
      ? planned.find((p) => p.activityId === item.activityId && item.start < p.end && item.end > p.start)
      : undefined;

  const strips = items.filter((item) => hostOf(item));
  const laneItems = items.filter((item) => !strips.includes(item));

  const boxes = laneItems
    .map((item) => ({ item, ...cardBox(item) }))
    .sort((a, b) => a.left - b.left || b.width - a.width);

  const result: PositionedItem[] = [];
  const laneEnds: number[] = [];

  for (const box of boxes) {
    let lane = laneEnds.findIndex((end) => end <= box.left);

    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = box.left + box.width;
    result.push({ item: box.item, left: box.left, width: box.width, lane });
  }

  for (const item of strips) {
    const host = result.find((p) => p.item === hostOf(item));

    if (!host) continue;
    host.hasStrips = true;
    // Only the part of the session inside the plan is drawn: the strip never pokes past its card.
    const box = cardBox(item);
    const left = Math.max(box.left, host.left);
    const right = Math.min(box.left + box.width, host.left + host.width);
    result.push({ item, left, width: Math.max(0, right - left), lane: host.lane, strip: true });
  }

  return result;
}

/** Lanes a row needs; an empty day still gets one. */
export function laneCount(positioned: PositionedItem[]): number {
  return Math.max(1, ...positioned.map((p) => p.lane + 1));
}

export function formatRange(start: Date, end: Date): string {
  return `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`;
}

export function passesFilters(item: { type: CalendarItem['type']; priority: CalendarItem['priority'] }, filters: CalendarFilters): boolean {
  return filters.types[item.type] && filters.priorities[item.priority];
}

/** e.g. "GMT+5:30", taken from the browser's offset. */
export function timezoneLabel(date: Date = new Date()): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;

  return `GMT${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}
