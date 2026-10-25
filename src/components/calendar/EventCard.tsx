'use client';

import { useDraggable } from '@dnd-kit/core';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';
import { CALENDAR_TYPES } from '@/lib/calendar/theme';
import { formatRange } from '@/lib/calendar/layout';
import type { CalendarItem, DragPayload } from '@/lib/calendar/types';

export interface EventCardProps {
  item: CalendarItem;
  /** Absolute box inside the day row. Horizontal in px; vertical as CSS lengths (week rows size lanes in %). */
  left: number;
  width: number;
  top: string;
  height: string;
  /** Tall card (day view): the title may wrap to two lines. */
  roomy?: boolean;
  selected: boolean;
  /** Focus timer is running on this activity. */
  active: boolean;
  /** Logged session drawn as a thin bar along the bottom of its planned card. */
  strip?: boolean;
  /** Planned card that carries session strips: keep its text clear of them. */
  hasStrips?: boolean;
  onSelect: (item: CalendarItem, anchor: HTMLElement) => void;
}

/** Bottom band a planned card keeps clear for its session strips, in px. */
const STRIP_BAND = 8;

/** Below this width the time range is dropped; below the second, the title too. */
const RANGE_MIN_WIDTH = 84;
const TITLE_MIN_WIDTH = 36;

export function EventCard({ item, left, width, top, height, roomy, selected, active, strip, hasStrips, onSelect }: EventCardProps) {
  const theme = CALENDAR_TYPES[item.type];
  const logged = item.kind === 'logged';

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `grid:${item.id}`,
    data: { source: 'grid', item } satisfies DragPayload,
    disabled: logged,
  });

  const showRange = width >= RANGE_MIN_WIDTH;
  const showTitle = width >= TITLE_MIN_WIDTH;
  const sessions = (item.sessions ?? 1) > 1 ? ` (${item.sessions} sessions)` : '';
  const range = formatRange(item.start, item.end);
  const label = `${item.title}, ${format(item.start, 'EEE d MMM')} ${range}, ${item.kind}${sessions}${item.completed ? ', done' : ''}`;

  const cursor = isDragging ? 'cursor-grabbing' : logged ? 'cursor-pointer' : 'cursor-grab';
  const tooltip = `${item.title} · ${logged ? 'logged' : 'planned'} ${range}${sessions}`;

  if (strip) {
    return (
      <button
        type="button"
        onClick={(e) => onSelect(item, e.currentTarget)}
        aria-label={label}
        title={tooltip}
        className="absolute z-10 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        style={{
          // Bottom edge of the host card, below its text (the host keeps that band clear).
          top: `calc(${top} + ${height} - ${STRIP_BAND - 2}px)`,
          height: 3,
          left: left + 4,
          width: Math.max(6, width - 8),
          background: theme.dot,
          boxShadow: selected ? `0 0 0 2px ${theme.text}8c` : undefined,
        }}
      />
    );
  }

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => onSelect(item, e.currentTarget)}
      aria-label={label}
      title={tooltip}
      className={`absolute flex flex-col justify-center overflow-hidden rounded-lg px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${cursor} ${isDragging ? 'z-20 opacity-60' : 'z-10'}`}
      style={{
        top,
        height,
        left,
        width,
        paddingBottom: hasStrips ? STRIP_BAND : undefined,
        background: logged ? theme.fillSoft : theme.fill,
        border: logged ? `1.5px dashed ${theme.border}` : '1px solid transparent',
        boxShadow: selected
          ? `inset 0 0 0 2px ${theme.text}8c`
          : active
            ? 'inset 0 0 0 2px #6366f1'
            : undefined,
        opacity: item.completed && !isDragging ? 0.6 : undefined,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
    >
      {showTitle ? (
        <span className="flex min-w-0 items-center gap-1 text-[13px] font-medium leading-tight" style={{ color: theme.text }}>
          {logged && !showRange && <Clock className="h-3 w-3 shrink-0" aria-hidden />}
          <span
            className={`${roomy ? 'line-clamp-2' : 'truncate'} ${
              item.completed ? 'line-through' : ''
            }`}
          >
            {item.title}
          </span>
        </span>
      ) : (
        logged && <Clock className="mx-auto h-3 w-3 shrink-0" style={{ color: theme.text }} aria-hidden />
      )}
      {showRange && (
        <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs" style={{ color: theme.textMuted }}>
          {logged && <Clock className="h-3 w-3 shrink-0" aria-hidden />}
          <span className="truncate">{range}</span>
        </span>
      )}
    </button>
  );
}
