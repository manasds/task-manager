import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  addDays,
  addMinutes,
  addWeeks,
  differenceInMinutes,
  endOfWeek,
  format,
  getISOWeek,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { X } from 'lucide-react';
import type {
  CalendarFilters,
  CalendarItem,
  CalendarPriority,
  CalendarType,
  CalendarViewMode,
  DragPayload,
  UnscheduledItem,
} from '@/lib/calendar/types';
import { GRID_END_HOUR, GRID_START_HOUR, HOUR_HEIGHT, SNAP_MINUTES } from '@/lib/calendar/theme';
import { createMockItems, createMockUnscheduled, WEEK_OPTIONS } from '@/lib/calendar/mock';
import { formatRange, passesFilters } from '@/lib/calendar/layout';
import { CalendarHeader } from './CalendarHeader';
import { CalendarSidebarFilters } from './CalendarSidebarFilters';
import { EventPopover } from './EventPopover';
import { MiniMonth } from './MiniMonth';
import { UnscheduledTray, TrayChipPreview, TRAY_DROP_ID } from './UnscheduledTray';
import { UpcomingRail } from './UpcomingRail';
import { WeekGrid, type DayDropData, type DropPreview } from './WeekGrid';

const ALL_FILTERS: CalendarFilters = {
  types: { build: true, learn: true },
  priorities: { urgent: true, high: true, medium: true, low: true },
};

const GRID_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;

/**
 * Whatever is under the pointer wins, so a wide tray chip lands on the day you point at.
 * The tray beats day columns, whose rects run on below the visible scroll area.
 */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const tray = hits.find((hit) => hit.id === TRAY_DROP_ID);
  if (tray) return [tray];
  return hits.length > 0 ? hits : rectIntersection(args);
};

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return mobile;
}

/** Ticks once a minute, on the minute, so the current-time line stays honest. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);
  return now;
}

function rangeSubtitle(start: Date, end: Date): string {
  const tail = isSameMonth(start, end) ? format(end, 'd') : format(end, 'MMM d');
  return `Week ${getISOWeek(start)} · ${format(start, 'MMM d')} – ${tail}`;
}

/** Snapped start for a drag, from the dragged node's top edge relative to the day column. */
function dropStart(event: DragMoveEvent | DragEndEvent, durationMinutes: number): { day: Date; start: Date } | null {
  const { active, over } = event;
  const rect = active.rect.current.translated;
  const data = over?.data.current as DayDropData | undefined;
  if (!over || !rect || !data) return null;
  const raw = ((rect.top - over.rect.top) / HOUR_HEIGHT) * 60;
  const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
  const minutes = Math.min(Math.max(0, snapped), GRID_MINUTES - durationMinutes);
  return { day: data.day, start: addMinutes(startOfDay(data.day), GRID_START_HOUR * 60 + minutes) };
}

function payloadDuration(payload: DragPayload): number {
  return payload.source === 'grid'
    ? differenceInMinutes(payload.item.end, payload.item.start)
    : payload.item.durationMinutes;
}


/** UI-only preview: everything comes from the mock fixture and resets on refresh. */
export function CalendarView() {
  const now = useNow();
  const isMobile = useIsMobile();
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState<CalendarViewMode>('week');
  const [miniMonth, setMiniMonth] = useState(() => startOfMonth(new Date()));
  const [filters, setFilters] = useState<CalendarFilters>(ALL_FILTERS);
  const [scheduled, setScheduled] = useState<CalendarItem[]>(() => createMockItems());
  const [unscheduled, setUnscheduled] = useState<UnscheduledItem[]>(() => createMockUnscheduled());
  const [selected, setSelected] = useState<{ item: CalendarItem; anchor: HTMLElement } | null>(null);
  const [trayOpen, setTrayOpen] = useState(true);
  // Separate flags so the desktop sidebar stays open while the phone drawer starts closed.
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [railSheetOpen, setRailSheetOpen] = useState(false);
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);

  // Phones only have room for one day.
  const effectiveView: CalendarViewMode = isMobile ? 'day' : view;

  const sidebarOpen = isMobile ? mobileSidebarOpen : desktopSidebarOpen;
  const setSidebarOpen = isMobile ? setMobileSidebarOpen : setDesktopSidebarOpen;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const visibleItems = useMemo(() => scheduled.filter((item) => passesFilters(item, filters)), [scheduled, filters]);
  const visibleUnscheduled = useMemo(
    () => unscheduled.filter((item) => passesFilters(item, filters)),
    [unscheduled, filters],
  );

  const weekStart = startOfWeek(anchor, WEEK_OPTIONS);
  const days =
    effectiveView === 'day' ? [startOfDay(anchor)] : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const title = format(anchor, 'MMMM yyyy');
  const subtitle =
    effectiveView === 'week'
      ? rangeSubtitle(weekStart, endOfWeek(anchor, WEEK_OPTIONS))
      : `${format(anchor, 'EEEE, MMM d')} · Week ${getISOWeek(anchor)}`;

  const goTo = (date: Date) => {
    setAnchor(date);
    setMiniMonth(startOfMonth(date));
    setSelected(null);
  };

  const step = (direction: 1 | -1) => {
    if (effectiveView === 'day') goTo(addDays(anchor, direction));
    else goTo(addWeeks(anchor, direction));
  };

  const selectItem = (item: CalendarItem, el: HTMLElement) => {
    setSelected((current) => (current?.item.id === item.id ? null : { item, anchor: el }));
  };

  const toggleType = (type: CalendarType) =>
    setFilters((f) => ({ ...f, types: { ...f.types, [type]: !f.types[type] } }));
  const togglePriority = (priority: CalendarPriority) =>
    setFilters((f) => ({ ...f, priorities: { ...f.priorities, [priority]: !f.priorities[priority] } }));

  const handleDragStart = (event: DragStartEvent) => {
    setDragging((event.active.data.current as DragPayload | undefined) ?? null);
    setSelected(null);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (!dragging || !event.over) {
      setDropPreview(null);
      return;
    }
    const minutes = payloadDuration(dragging);
    const target = dropStart(event, minutes);
    if (!target) return setDropPreview(null);
    const end = addMinutes(target.start, minutes);
    const top = ((target.start.getHours() - GRID_START_HOUR) * 60 + target.start.getMinutes()) * (HOUR_HEIGHT / 60);
    setDropPreview((current) => {
      const next: DropPreview = {
        dropId: String(event.over?.id),
        top,
        height: Math.max(24, (minutes / 60) * HOUR_HEIGHT),
        label: formatRange(target.start, end),
      };
      return current && current.dropId === next.dropId && current.top === next.top ? current : next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const payload = dragging;
    setDragging(null);
    setDropPreview(null);
    if (!payload) return;
    if (event.over?.id === TRAY_DROP_ID) {
      if (payload.source === 'grid') {
        const { item } = payload;
        setScheduled((items) => items.filter((i) => i.id !== item.id));
        setUnscheduled((items) => [
          ...items,
          {
            id: item.id,
            title: item.title,
            type: item.type,
            priority: item.priority,
            durationMinutes: differenceInMinutes(item.end, item.start),
            notes: item.notes,
            checklist: item.checklist,
          },
        ]);
      }
      return;
    }
    const minutes = payloadDuration(payload);
    const target = dropStart(event, minutes);
    if (!target) return;
    const end = addMinutes(target.start, minutes);

    if (payload.source === 'grid') {
      setScheduled((items) =>
        items.map((item) => (item.id === payload.item.id ? { ...item, start: target.start, end } : item)),
      );
    } else {
      const { durationMinutes: _duration, ...rest } = payload.item;
      setUnscheduled((items) => items.filter((item) => item.id !== payload.item.id));
      setScheduled((items) => [...items, { ...rest, kind: 'planned', start: target.start, end }]);
    }
  };

  const handleDragCancel = () => {
    setDragging(null);
    setDropPreview(null);
  };

  const selectedVisible = selected && visibleItems.some((item) => item.id === selected.item.id) ? selected : null;

  const rail = (
    <>
      <MiniMonth
        anchorDate={anchor}
        today={now}
        month={miniMonth}
        onMonthChange={setMiniMonth}
        onSelectDate={(date) => {
          goTo(date);
          setRailSheetOpen(false);
        }}
      />
      <div className="my-5 border-t border-neutral-200" />
      <UpcomingRail items={visibleItems} today={now} now={now} onSelectItem={selectItem} />
    </>
  );

  return (
    <div className="mx-auto max-w-[1600px] md:px-6 md:pt-5">
      <div className="relative flex h-[calc(100dvh-16.5rem)] min-h-[520px] flex-col overflow-hidden border-y border-neutral-200 bg-[#f7f7f6] md:h-[calc(100dvh-9.5rem)] md:min-h-[640px] md:rounded-2xl md:border md:shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="relative flex min-h-0 flex-1">
            {sidebarOpen && (
              <>
                {isMobile && (
                  <button
                    type="button"
                    aria-label="Close sidebar"
                    onClick={() => setSidebarOpen(false)}
                    className="absolute inset-0 z-30 bg-neutral-900/20"
                  />
                )}
                <aside className="absolute inset-y-0 left-0 z-40 w-[220px] shrink-0 overflow-y-auto border-r border-neutral-200 bg-[#f7f7f6] md:static md:z-auto">
                  <CalendarSidebarFilters filters={filters} onToggleType={toggleType} onTogglePriority={togglePriority} />
                </aside>
              </>
            )}

            <section className="flex min-w-0 flex-1 flex-col bg-white">
              <CalendarHeader
                title={title}
                subtitle={subtitle}
                view={effectiveView}
                onViewChange={(next) => {
                  setView(next);
                  setSelected(null);
                }}
                onToday={() => goTo(new Date())}
                onPrev={() => step(-1)}
                onNext={() => step(1)}
                sidebarOpen={sidebarOpen}
                onToggleSidebar={() => setSidebarOpen((open) => !open)}
                onOpenRail={() => setRailSheetOpen(true)}
              />
              <WeekGrid
                  days={days}
                  items={visibleItems}
                  now={now}
                  selectedId={selectedVisible?.item.id ?? null}
                  dropPreview={dropPreview}
                  onSelectItem={selectItem}
                />
              <UnscheduledTray items={visibleUnscheduled} open={trayOpen} onToggle={() => setTrayOpen((o) => !o)} />
            </section>

            <aside className="hidden w-[284px] shrink-0 overflow-y-auto border-l border-neutral-200 bg-[#f7f7f6] px-5 py-4 lg:block">
              {rail}
            </aside>
          </div>

          <DragOverlay dropAnimation={null}>
            {dragging?.source === 'tray' ? <TrayChipPreview item={dragging.item} /> : null}
          </DragOverlay>
        </DndContext>

        {railSheetOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Month and upcoming">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setRailSheetOpen(false)}
              className="absolute inset-0 bg-neutral-900/30"
            />
            <div className="animate-in absolute inset-x-0 bottom-0 max-h-[75dvh] overflow-y-auto rounded-t-2xl bg-[#f7f7f6] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl md:inset-x-auto md:right-4 md:bottom-4 md:w-[320px] md:rounded-2xl">
              <div className="mb-3 flex items-center justify-between">
                <span className="mx-auto h-1 w-10 rounded-full bg-neutral-300 md:hidden" />
                <button
                  type="button"
                  onClick={() => setRailSheetOpen(false)}
                  aria-label="Close"
                  className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-200/60"
                >
                  <X className="size-4" />
                </button>
              </div>
              {rail}
            </div>
          </div>
        )}
      </div>

      {selectedVisible && (
        <EventPopover item={selectedVisible.item} anchor={selectedVisible.anchor} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
