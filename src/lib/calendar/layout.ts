import { differenceInMinutes, format } from 'date-fns';
import type { CalendarItem, CalendarFilters } from './types';
import { GRID_END_HOUR, GRID_START_HOUR, HOUR_HEIGHT, MIN_CARD_HEIGHT } from './theme';

const GRID_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT;

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

/** Lay out one day's items: overlapping items split the column width evenly. */
export function layoutDay(items: CalendarItem[]): PositionedItem[] {
  const sorted = [...items].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime(),
  );
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

  for (const item of sorted) {
    const start = item.start.getTime();
    if (start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end.getTime());
    } else {
      laneEnds[lane] = item.end.getTime();
    }
    clusterEnd = Math.max(clusterEnd, item.end.getTime());
    // Blocks outside 07:00–23:00 are pinned to the nearest edge so they stay visible.
    const rawTop = topFor(item.start);
    const rawBottom = rawTop + (differenceInMinutes(item.end, item.start) / 60) * HOUR_HEIGHT;
    const top = Math.min(Math.max(0, rawTop), GRID_HEIGHT - MIN_CARD_HEIGHT);
    cluster.push({
      item,
      top,
      height: Math.min(Math.max(MIN_CARD_HEIGHT, Math.min(rawBottom, GRID_HEIGHT) - top), GRID_HEIGHT - top),
      column: lane,
      columns: 1,
    });
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
