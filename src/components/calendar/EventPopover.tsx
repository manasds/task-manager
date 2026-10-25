'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { differenceInMinutes, format } from 'date-fns';
import { AlignLeft, Clock, Flag, ListChecks, Pencil, Play, Trash2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CALENDAR_TYPES, PRIORITY_LABELS } from '@/lib/calendar/theme';
import { formatRange } from '@/lib/calendar/layout';
import type { CalendarItem } from '@/lib/calendar/types';

export interface EventPopoverProps {
  item: CalendarItem;
  /** Card or rail row it was opened from; position next to it. */
  anchor: HTMLElement;
  /** This activity's focus timer is running. */
  isFocusing: boolean;
  /** Planned only on this day as an extra day. */
  canRemoveFromDay: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStartFocus: () => void;
  onUnschedule: () => void;
  onRemoveFromDay: () => void;
}

const WIDTH = 320;
const GAP = 12;
const MARGIN = 8;

function Row({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

export function EventPopover({
  item,
  anchor,
  isFocusing,
  canRemoveFromDay,
  onClose,
  onEdit,
  onDelete,
  onStartFocus,
  onUnschedule,
  onRemoveFromDay,
}: EventPopoverProps) {
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

      // Too narrow to sit beside the anchor: centre it below (or above) instead of covering it.
      if (window.innerWidth < WIDTH * 2) {
        const below = rect.bottom + MARGIN;
        const top = below + height <= window.innerHeight - MARGIN ? below : rect.top - MARGIN - height;
        setPos({
          left: Math.max(MARGIN, (window.innerWidth - el.offsetWidth) / 2),
          top: Math.max(MARGIN, Math.min(top, window.innerHeight - height - MARGIN)),
        });

        return;
      }

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

  // The parent passes a new onClose each render; keep the latest without re-running the setup below.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const popover = ref.current;
    popover?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };

    const onDown = (e: MouseEvent) => {
      const target = e.target;

      if (target instanceof Node && (popover?.contains(target) || anchor.contains(target))) return;
      onCloseRef.current();
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);

      // Hand keyboard focus back to the card it was opened from.
      if (popover?.contains(document.activeElement) && anchor.isConnected) anchor.focus();
    };
  }, [anchor]);

  const checklist = item.checklist;
  const pct = checklist && checklist.total > 0 ? Math.round((checklist.done / checklist.total) * 100) : 0;

  const iconButton =
    'flex h-7 w-7 items-center justify-center rounded-md text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-slate-400';

  const footerButton = 'h-8 rounded-lg px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-slate-400';
  const secondary = `${footerButton} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={item.title}
      tabIndex={-1}
      className="fixed z-50 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)] outline-none"
      style={{ width: `min(${WIDTH}px, calc(100vw - ${MARGIN * 2}px))`, left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="h-2 w-2 rounded-sm" style={{ background: theme.dot }} />
          {theme.label}
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" aria-label="Edit activity" className={iconButton} onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </button>
          {item.kind === 'planned' && (
            <button type="button" aria-label="Delete activity" className={iconButton} onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button type="button" aria-label="Close" className={iconButton} onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <h3 className="mt-3 text-[15px] font-medium text-slate-900">{item.title}</h3>
      <ul className="mt-3 space-y-2.5 text-sm text-slate-800">
        <Row icon={Clock}>
          {format(item.start, 'EEE, MMM d')} · {formatRange(item.start, item.end)}
          {logged && ` · ${item.minutes ?? differenceInMinutes(item.end, item.start)} min`}
        </Row>
        <Row icon={Flag}>
          {`${PRIORITY_LABELS[item.priority]} · ${logged ? ((item.sessions ?? 1) > 1 ? `${item.sessions} logged sessions` : 'Logged session') : item.completed ? 'Done' : 'Planned'}`}
        </Row>
        {item.notes && (
          <Row icon={AlignLeft}>
            <p className="leading-relaxed text-slate-500">{item.notes}</p>
          </Row>
        )}
        {checklist && (
          <Row icon={ListChecks}>
            <div>
              {checklist.done} of {checklist.total} done
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: theme.dot }} />
            </div>
          </Row>
        )}
      </ul>
      {!logged && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {!item.completed &&
            (isFocusing ? (
              <button type="button" onClick={onStartFocus} className={`${footerButton} bg-indigo-50 text-indigo-700`}>
                Focusing…
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartFocus}
                className={`${footerButton} flex items-center gap-1.5 bg-slate-900 text-white hover:bg-slate-800`}
              >
                <Play className="h-3.5 w-3.5" aria-hidden />
                Start focus
              </button>
            ))}
          <button type="button" onClick={onUnschedule} title="Clear the time; it moves back to Unscheduled" className={secondary}>
            Unschedule
          </button>
          {canRemoveFromDay && (
            <button type="button" onClick={onRemoveFromDay} className={`${secondary} text-rose-600 hover:bg-rose-50`}>
              Remove from day
            </button>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
}
