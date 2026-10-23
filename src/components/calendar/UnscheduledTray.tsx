'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ChevronDown, ChevronUp, GripVertical, Inbox } from 'lucide-react';
import { CALENDAR_TYPES, PRIORITY_LABELS } from '@/lib/calendar/theme';
import type { DragPayload, UnscheduledItem } from '@/lib/calendar/types';

/** Droppable id for the tray: dropping a planned card here unschedules it. */
export const TRAY_DROP_ID = 'tray';

export interface UnscheduledTrayProps {
  items: UnscheduledItem[]; // already filtered
  open: boolean;
  onToggle: () => void;
}

function ChipBody({ item }: { item: UnscheduledItem }) {
  const theme = CALENDAR_TYPES[item.type];
  return (
    <>
      <GripVertical className="w-3.5 shrink-0" style={{ color: theme.textMuted }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium" style={{ color: theme.text }}>
          {item.title}
        </span>
        <span className="block truncate text-xs" style={{ color: theme.textMuted }}>
          {item.durationMinutes} min · {PRIORITY_LABELS[item.priority]}
        </span>
      </span>
    </>
  );
}

const CHIP_CLASS = 'flex w-[200px] shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-left';

export function TrayChipPreview({ item }: { item: UnscheduledItem }) {
  return (
    <div className={`${CHIP_CLASS} cursor-grabbing`} style={{ background: CALENDAR_TYPES[item.type].fill }}>
      <ChipBody item={item} />
    </div>
  );
}

function TrayChip({ item }: { item: UnscheduledItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tray:${item.id}`,
    data: { source: 'tray', item } satisfies DragPayload,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`${CHIP_CLASS} ${isDragging ? 'cursor-grabbing opacity-40' : 'cursor-grab'}`}
      style={{ background: CALENDAR_TYPES[item.type].fill }}
    >
      <ChipBody item={item} />
    </div>
  );
}

export function UnscheduledTray({ items, open, onToggle }: UnscheduledTrayProps) {
  const Chevron = open ? ChevronDown : ChevronUp;
  const { setNodeRef, isOver } = useDroppable({ id: TRAY_DROP_ID });
  return (
    <div ref={setNodeRef} className={`border-t border-neutral-200 transition-colors ${isOver ? 'bg-neutral-50' : 'bg-white'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex h-11 w-full items-center gap-2 px-4 text-left"
      >
        <Inbox className="h-4 w-4 text-neutral-500" aria-hidden />
        <span className="text-sm font-medium text-neutral-900">Unscheduled</span>
        <span className="rounded-full bg-neutral-100 px-2 text-xs text-neutral-600">{items.length}</span>
        <span className="hidden text-sm text-neutral-400 sm:inline">Drag onto the calendar</span>
        <Chevron className="ml-auto h-4 w-4 text-neutral-500" aria-hidden />
      </button>
      {open && (
        <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-3">
          {items.length === 0 ? (
            <p className="text-sm text-neutral-400">Everything is on the calendar.</p>
          ) : (
            items.map((item) => <TrayChip key={item.id} item={item} />)
          )}
        </div>
      )}
    </div>
  );
}
