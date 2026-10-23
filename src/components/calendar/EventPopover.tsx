'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { AlignLeft, Bell, Clock, Flag, ListChecks, MapPin, Pencil, Trash2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CALENDAR_TYPES, PRIORITY_LABELS } from '@/lib/calendar/theme';
import { formatRange } from '@/lib/calendar/layout';
import type { CalendarItem } from '@/lib/calendar/types';

export interface EventPopoverProps {
  item: CalendarItem;
  /** Card or rail row it was opened from; position next to it. */
  anchor: HTMLElement;
  onClose: () => void;
}

const WIDTH = 320;
const GAP = 12;
const MARGIN = 8;

function Row({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

export function EventPopover({ item, anchor, onClose }: EventPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const theme = CALENDAR_TYPES[item.type];
  const logged = item.kind === 'logged';

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const rect = anchor.getBoundingClientRect();
      const height = el.offsetHeight;
      let left = rect.left - GAP - WIDTH;
      if (left < MARGIN) left = rect.right + GAP;
      left = Math.max(MARGIN, Math.min(left, window.innerWidth - WIDTH - MARGIN));
      const top = Math.max(MARGIN, Math.min(rect.top, window.innerHeight - height - MARGIN));
      setPos({ left, top });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor]);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchor.contains(target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [anchor, onClose]);

  const checklist = item.checklist;
  const pct = checklist && checklist.total > 0 ? Math.round((checklist.done / checklist.total) * 100) : 0;
  const iconButton =
    'flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800';

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={item.title}
      tabIndex={-1}
      className="fixed z-50 rounded-xl border border-neutral-200 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)] outline-none"
      style={{ width: WIDTH, left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <span className="h-2 w-2 rounded-sm" style={{ background: theme.dot }} />
          {theme.label}
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" aria-label="Edit" className={iconButton} onClick={onClose}>
            <Pencil className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Delete" className={iconButton} onClick={onClose}>
            <Trash2 className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Close" className={iconButton} onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <h3 className="mt-3 text-[15px] font-medium text-neutral-900">{item.title}</h3>
      <ul className="mt-3 space-y-2.5 text-sm text-neutral-800">
        <Row icon={Clock}>
          {format(item.start, 'EEE, MMM d')} · {formatRange(item.start, item.end)}
        </Row>
        {item.location && <Row icon={MapPin}>{item.location}</Row>}
        <Row icon={Flag}>
          {PRIORITY_LABELS[item.priority]}
          {logged ? ' · Logged session' : ' · Planned'}
        </Row>
        {!logged && <Row icon={Bell}>10 minutes before</Row>}
        {item.notes && (
          <Row icon={AlignLeft}>
            <p className="leading-relaxed text-neutral-500">{item.notes}</p>
          </Row>
        )}
        {checklist && (
          <Row icon={ListChecks}>
            <div>
              {checklist.done} of {checklist.total} done
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-neutral-100">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: theme.dot }} />
            </div>
          </Row>
        )}
      </ul>
    </div>,
    document.body,
  );
}
