import React from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, PanelLeft } from 'lucide-react';
import type { CalendarViewMode } from '@/lib/calendar/types';

const VIEW_MODES: { id: CalendarViewMode; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
];

const ghostIconClass =
  'flex size-8 items-center justify-center text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400';

export interface CalendarHeaderProps {
  title: string;
  subtitle: string;
  view: CalendarViewMode;
  onViewChange: (view: CalendarViewMode) => void;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  /** Opens the mini month + upcoming sheet where the right rail is hidden. */
  onOpenRail: () => void;
}

export function CalendarHeader({
  title,
  subtitle,
  view,
  onViewChange,
  onToday,
  onPrev,
  onNext,
  sidebarOpen,
  onToggleSidebar,
  onOpenRail,
}: CalendarHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-3 border-b border-neutral-200 px-3 py-3 md:px-4">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Hide filters' : 'Show filters'}
        aria-expanded={sidebarOpen}
        className={`${ghostIconClass} rounded-lg`}
      >
        <PanelLeft className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[17px] font-semibold leading-tight text-neutral-900">{title}</h2>
        <p className="mt-0.5 truncate text-[13px] text-neutral-500">{subtitle}</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToday}
          className="h-8 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-800 hover:bg-neutral-50 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
        >
          Today
        </button>

        <div className="flex h-8 items-center overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <button type="button" onClick={onPrev} aria-label="Previous" className={ghostIconClass}>
            <ChevronLeft className="size-4" />
          </button>
          <span className="h-4 w-px bg-neutral-200" />
          <button type="button" onClick={onNext} aria-label="Next" className={ghostIconClass}>
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div role="tablist" aria-label="Calendar view" className="hidden h-8 items-center rounded-lg bg-neutral-100 p-0.5 md:flex">
          {VIEW_MODES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => onViewChange(id)}
              className={`h-7 rounded-md px-3.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400 ${
                view === id
                  ? 'bg-white font-medium text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button type="button" onClick={onOpenRail} aria-label="Month and upcoming" className={`${ghostIconClass} rounded-lg lg:hidden`}>
          <CalendarRange className="size-4" />
        </button>
      </div>
    </div>
  );
}
