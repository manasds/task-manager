import { differenceInMinutes, format } from 'date-fns';
import type { CalendarItem, CalendarFilters } from './types';
import { GRID_HEIGHT, GRID_START_HOUR, HOUR_HEIGHT, MIN_CARD_HEIGHT } from './theme';

export interface PositionedItem {
  item: CalendarItem;
  top: number;
  height: number;
  /** Side-by-side lane within an overlap cluster. */
  column: number;
  columns: number;
}

function minutesIntoGrid(date: Date): number {
  return (date.getHours() - GRID_START_HOUR) * 60 + date.getMinutes();
}

export function topFor(date: Date): number {
  return (minutesIntoGrid(date) / 60) * HOUR_HEIGHT;
}

/** Where a card is drawn: pinned inside 07:00–23:00 and at least MIN_CARD_HEIGHT tall. */
function cardBox(item: CalendarItem) {
  const rawTop = topFor(item.start);
  const rawBottom = rawTop + (differenceInMinutes(item.end, item.start) / 60) * HOUR_HEIGHT;
  const top = Math.min(Math.max(0, rawTop), GRID_HEIGHT - MIN_CARD_HEIGHT);
  const bottom = Math.min(GRID_HEIGHT, Math.max(top + MIN_CARD_HEIGHT, rawBottom));

  return { top, height: bottom - top };
}

/**
 * Lay out one day's items: cards that overlap as drawn split the column width evenly.
 * Overlap uses the drawn boxes, so short or pinned blocks never cover each other.
 */
export function layoutDay(items: CalendarItem[]): PositionedItem[] {
  const boxes = items
    .map((item) => ({ item, ...cardBox(item) }))
    .sort((a, b) => a.top - b.top || b.height - a.height);

  const result: PositionedItem[] = [];
  let cluster: PositionedItem[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const positioned of cluster) positioned.columns = laneEnds.length;
    result.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const box of boxes) {
    const bottom = box.top + box.height;

    if (box.top >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= box.top);

    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(bottom);
    } else {
      laneEnds[lane] = bottom;
    }

    clusterEnd = Math.max(clusterEnd, bottom);
    cluster.push({ item: box.item, top: box.top, height: box.height, column: lane, columns: 1 });
  }

  flush();

  return result;
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
