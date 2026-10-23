'use client';

import { useDraggable } from '@dnd-kit/core';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';
import { CALENDAR_TYPES } from '@/lib/calendar/theme';
import { formatRange } from '@/lib/calendar/layout';
import type { CalendarItem, DragPayload } from '@/lib/calendar/types';

export interface EventCardProps {
  item: CalendarItem;
  /** Absolute position inside the day column, in px / fractions. */
  top: number;
  height: number;
  column: number;
  columns: number;
  selected: boolean;
  onSelect: (item: CalendarItem, anchor: HTMLElement) => void;
}

export function EventCard({ item, top, height, column, columns, selected, onSelect }: EventCardProps) {
  const theme = CALENDAR_TYPES[item.type];
  const logged = item.kind === 'logged';
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `grid:${item.id}`,
    data: { source: 'grid', item } satisfies DragPayload,
    disabled: logged,
  });

  const compact = height < 44;
  const range = formatRange(item.start, item.end);
  const label = `${item.title}, ${format(item.start, 'EEE d MMM')} ${range}, ${item.kind}`;

  const cursor = isDragging ? 'cursor-grabbing' : logged ? 'cursor-pointer' : 'cursor-grab';

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => onSelect(item, e.currentTarget)}
      aria-label={label}
      title={logged ? 'Logged session' : undefined}
      className={`absolute flex flex-col overflow-hidden rounded-lg px-2.5 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
        compact ? 'justify-center' : 'justify-start'
      } ${cursor} ${isDragging ? 'z-20 opacity-60' : 'z-10'}`}
      style={{
        top,
        height,
        left: `calc(${(column / columns) * 100}% + 4px)`,
        width: `calc(${100 / columns}% - 8px)`,
        background: logged ? theme.fillSoft : theme.fill,
        border: logged ? `1.5px dashed ${theme.border}` : '1px solid transparent',
        boxShadow: selected ? `inset 0 0 0 2px ${theme.text}8c` : undefined,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
    >
      <span className="flex min-w-0 items-center gap-1 text-[13px] font-medium leading-tight" style={{ color: theme.text }}>
        <span className="truncate">{item.title}</span>
        {logged && compact && <Clock className="h-3 w-3 shrink-0" aria-hidden />}
      </span>
      {!compact && (
        <span className="mt-0.5 flex items-center gap-1 truncate text-xs" style={{ color: theme.textMuted }}>
          {logged && <Clock className="h-3 w-3 shrink-0" aria-hidden />}
          <span className="truncate">{range}</span>
        </span>
      )}
    </button>
  );
}
