import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type DataRef,
  type Over,
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
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { X } from 'lucide-react';
import type { Activity } from '@/types/activity';
import type {
  CalendarFilters,
  CalendarItem,
  CalendarPriority,
  CalendarType,
  CalendarViewMode,
  DragPayload,
} from '@/lib/calendar/types';
import { GRID_MINUTES, GRID_START_HOUR, HOUR_WIDTH, MIN_CARD_WIDTH, SNAP_MINUTES, WEEK_OPTIONS } from '@/lib/calendar/theme';
import { formatRange, offsetFor, passesFilters } from '@/lib/calendar/layout';
import {
  addableTo,
  addToDay,
  calendarItems,
  canRemoveFromDay,
  mergeLoggedRuns,
  moveToSlot,
  removeFromDay,
  toTimeString,
  unschedule,
  unscheduledOn,
} from '@/lib/calendar/activities';
import { formatMinutes, localDateString, parseLocalDate, taskStatsForDate } from '@/utils/workSessions';
import { CalendarHeader } from './CalendarHeader';
import { CalendarSidebarFilters } from './CalendarSidebarFilters';
import { DayAgenda } from './DayAgenda';
import { EventPopover } from './EventPopover';
import { LoggedSummary } from './LoggedSummary';
import { MiniMonth } from './MiniMonth';
import { UnscheduledTray, TrayChipPreview, TRAY_DROP_ID } from './UnscheduledTray';
import { UpcomingRail } from './UpcomingRail';
import { WeekGrid, type DayDropData, type DropPreview } from './WeekGrid';

const ALL_FILTERS: CalendarFilters = {
  types: { build: true, learn: true },
  priorities: { urgent: true, high: true, medium: true, low: true },
};


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

function dragPayload(data: DataRef): DragPayload | undefined {
  // SAFETY: the calendar's only draggables, EventCard and TrayChip, set their data to a DragPayload.
  return data.current as DragPayload | undefined;
}

function dayDrop(data: DataRef): DayDropData | undefined {
  // SAFETY: day columns in WeekGrid set their data to a DayDropData; the tray droppable sets none.
  return data.current as DayDropData | undefined;
}

function dragTitle(data: DataRef): string {
  return dragPayload(data)?.item.title ?? 'Activity';
}

function targetLabel(over: Over | null): string {
  if (!over) return 'nowhere';

  if (over.id === TRAY_DROP_ID) return 'Unscheduled';
  const day = dayDrop(over.data)?.day;

  return day ? format(day, 'EEEE, MMMM d') : 'the calendar';
}

/** Screen reader messages with titles and days instead of internal ids. */
const announcements: Announcements = {
  onDragStart: ({ active }) => `Picked up ${dragTitle(active.data)}.`,
  onDragOver: ({ active, over }) => `${dragTitle(active.data)} is over ${targetLabel(over)}.`,
  onDragEnd: ({ active, over }) =>
    over ? `${dragTitle(active.data)} dropped on ${targetLabel(over)}.` : `${dragTitle(active.data)} was not moved.`,
  onDragCancel: ({ active }) => `Moving ${dragTitle(active.data)} was cancelled.`,
};

const MOBILE_QUERY = '(max-width: 767px)';

function subscribeMobile(onChange: () => void): () => void {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener('change', onChange);

  return () => query.removeEventListener('change', onChange);
}

/** Read synchronously on the client, so phones never render the desktop grid first. */
function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
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

function clientX(event: Event | null): number | null {
  // Desktop Safari and Firefox have no TouchEvent constructor.
  if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
    const touch = event.touches[0] ?? event.changedTouches[0];

    return touch ? touch.clientX : null;
  }

  return event instanceof MouseEvent ? event.clientX : null;
}

/**
 * Snapped start for a drag: where the dragged item's left edge sits in the hovered day row.
 * Uses the live pointer and the column's current position, so it stays right while the grid
 * auto-scrolls during the drag.
 */
function dropStart(
  event: DragMoveEvent | DragEndEvent,
  pointerX: number | null,
  durationMinutes: number,
): { day: Date; start: Date } | null {
  const { active, over } = event;
  const data = over ? dayDrop(over.data) : undefined;
  const startX = clientX(event.activatorEvent);
  const initial = active.rect.current.initial;
  const row = over ? document.querySelector(`[data-drop-id="${String(over.id)}"]`) : null;

  if (!data?.day || pointerX === null || startX === null || !initial || !row) return null;
  const itemLeft = pointerX - (startX - initial.left);
  const raw = ((itemLeft - row.getBoundingClientRect().left) / HOUR_WIDTH) * 60;
  const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
  const minutes = Math.min(Math.max(0, snapped), GRID_MINUTES - Math.min(durationMinutes, GRID_MINUTES));
  // setHours keeps wall-clock time, so a DST change day doesn't shift the slot by an hour.
  const start = new Date(data.day);
  start.setHours(GRID_START_HOUR, minutes, 0, 0);

  return { day: data.day, start };
}

function payloadDuration(payload: DragPayload): number {
  return payload.source === 'grid'
    ? differenceInMinutes(payload.item.end, payload.item.start)
    : payload.item.durationMinutes;
}

export interface CalendarViewProps {
  activities: Activity[];
  /** 'YYYY-MM-DD', the app's selected day. */
  selectedDate: string;
  onSelectDate: (date: string) => void;
  activeTimerTaskId?: string;
  onUpdateActivity: (activity: Activity) => void;
  onDeleteActivity: (activityId: string) => void;
  onEditActivity: (activity: Activity) => void;
  onStartFocus: (activity: Activity) => void;
  /** New activity on `date` ('YYYY-MM-DD') at `time` ('HH:MM'). */
  onCreateActivity: (date: string, time: string) => void;
  onToast: (message: string) => void;
}

/** Plan and review in one view: planned blocks, logged sessions and the unscheduled queue. */
export function CalendarView({
  activities,
  selectedDate,
  onSelectDate,
  activeTimerTaskId,
  onUpdateActivity,
  onDeleteActivity,
  onEditActivity,
  onStartFocus,
  onCreateActivity,
  onToast,
}: CalendarViewProps) {
  const now = useNow();
  const isMobile = useIsMobile();
  const today = localDateString(now);
  const anchor = parseLocalDate(selectedDate);
  const [view, setView] = useState<CalendarViewMode>('week');
  const [miniMonth, setMiniMonth] = useState(() => startOfMonth(parseLocalDate(selectedDate)));
  const [filters, setFilters] = useState<CalendarFilters>(ALL_FILTERS);
  const [selected, setSelected] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const [trayOpen, setTrayOpen] = useState(true);
  // Separate flags so the desktop sidebar stays open while the phone drawer starts closed.
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [railSheetOpen, setRailSheetOpen] = useState(false);
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
  // Browsers fire a click on the card right after a drag ends; that must not open the popover.
  const justDraggedRef = useRef(false);
  // Latest pointer position during a drag (dnd-kit's own rects lag behind auto-scroll).
  const pointerXRef = useRef<number | null>(null);
  // dnd-kit can deliver a last move after the drop; it must not bring the preview back.
  const dragActiveRef = useRef(false);

  useEffect(() => {
    if (!dragging) return;

    const track = (event: MouseEvent | TouchEvent) => {
      pointerXRef.current = clientX(event);
    };

    window.addEventListener('mousemove', track, { passive: true });
    window.addEventListener('touchmove', track, { passive: true });

    return () => {
      window.removeEventListener('mousemove', track);
      window.removeEventListener('touchmove', track);
    };
  }, [dragging]);

  // Phones only have room for one day.
  const effectiveView: CalendarViewMode = isMobile ? 'day' : view;
  const sidebarOpen = isMobile ? mobileSidebarOpen : desktopSidebarOpen;
  const setSidebarOpen = isMobile ? setMobileSidebarOpen : setDesktopSidebarOpen;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const weekStart = startOfWeek(anchor, WEEK_OPTIONS);

  const days = useMemo(() => {
    const day = parseLocalDate(selectedDate);

    if (effectiveView === 'day') return [day];
    const monday = startOfWeek(day, WEEK_OPTIONS);

    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [effectiveView, selectedDate]);

  const dayKeys = useMemo(() => days.map(localDateString), [days]);

  const visibleItems = useMemo(
    () => mergeLoggedRuns(calendarItems(activities, dayKeys, today).filter((item) => passesFilters(item, filters))),
    [activities, dayKeys, today, filters],
  );

  const upcomingItems = useMemo(() => {
    const next7 = Array.from({ length: 7 }, (_, i) => localDateString(addDays(parseLocalDate(today), i)));

    return calendarItems(activities, next7, today).filter(
      (item) => item.kind === 'planned' && passesFilters(item, filters),
    );
  }, [activities, today, filters]);

  const trayItems = useMemo(
    () => unscheduledOn(activities, selectedDate).filter((item) => passesFilters(item, filters)),
    [activities, selectedDate, filters],
  );

  const addable = useMemo(
    () => addableTo(activities, selectedDate, today).map((a) => ({ id: a.id, title: a.title })),
    [activities, selectedDate, today],
  );

  const loggedStats = useMemo(
    () =>
      taskStatsForDate(activities, selectedDate).filter(
        (s) => filters.types[s.activity.category] && filters.priorities[s.activity.priority],
      ),
    [activities, selectedDate, filters],
  );

  const loggedTotal = loggedStats.reduce((sum, s) => sum + s.totalMinutes, 0);

  const plannedTotal = visibleItems
    .filter((item) => item.kind === 'planned' && item.day === selectedDate)
    .reduce((sum, item) => sum + differenceInMinutes(item.end, item.start), 0);

  const selectedDayLabel = selectedDate === today ? 'Today' : format(anchor, 'EEE d');
  const title = format(anchor, 'MMMM yyyy');
  const dayStats = `${selectedDayLabel}: ${formatMinutes(plannedTotal)} planned · ${formatMinutes(loggedTotal)} logged`;

  const subtitle =
    effectiveView === 'week'
      ? `${rangeSubtitle(weekStart, endOfWeek(anchor, WEEK_OPTIONS))} · ${dayStats}`
      : `${format(anchor, 'EEEE, MMM d')} · ${formatMinutes(plannedTotal)} planned · ${formatMinutes(loggedTotal)} logged`;

  const findActivity = (id: string) => activities.find((a) => a.id === id);

  const goTo = (date: Date) => {
    onSelectDate(localDateString(date));
    setMiniMonth(startOfMonth(date));
    setSelected(null);
  };

  const step = (direction: 1 | -1) => goTo(effectiveView === 'day' ? addDays(anchor, direction) : addWeeks(anchor, direction));

  const selectItem = (item: CalendarItem, el: HTMLElement) => {
    if (justDraggedRef.current) return;
    setSelected((current) => (current?.id === item.id ? null : { id: item.id, anchor: el }));
  };

  const toggleType = (type: CalendarType) =>
    setFilters((f) => ({ ...f, types: { ...f.types, [type]: !f.types[type] } }));

  const togglePriority = (priority: CalendarPriority) =>
    setFilters((f) => ({ ...f, priorities: { ...f.priorities, [priority]: !f.priorities[priority] } }));

  const handleDragStart = (event: DragStartEvent) => {
    pointerXRef.current = clientX(event.activatorEvent);
    dragActiveRef.current = true;
    setDragging(dragPayload(event.active.data) ?? null);
    setSelected(null);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (!dragActiveRef.current || !dragging || !event.over) {
      setDropPreview(null);

      return;
    }

    const minutes = payloadDuration(dragging);
    const target = dropStart(event, pointerXRef.current, minutes);

    if (!target) {
      setDropPreview(null);

      return;
    }

    const left = offsetFor(target.start);

    const next: DropPreview = {
      dropId: String(event.over.id),
      left,
      width: Math.max(MIN_CARD_WIDTH, (minutes / 60) * HOUR_WIDTH),
      label: formatRange(target.start, addMinutes(target.start, minutes)),
    };

    setDropPreview((current) => (current && current.dropId === next.dropId && current.left === next.left ? current : next));
  };

  const finishDrag = () => {
    dragActiveRef.current = false;
    setDragging(null);
    setDropPreview(null);
    justDraggedRef.current = true;
    setTimeout(() => {
      justDraggedRef.current = false;
    }, 0);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const payload = dragging;
    finishDrag();

    if (!payload) return;
    const activityId = payload.source === 'grid' ? payload.item.activityId : payload.item.id;
    const activity = findActivity(activityId);

    if (!activity) return;

    if (event.over?.id === TRAY_DROP_ID) {
      if (payload.source === 'grid') {
        onUpdateActivity(unschedule(activity));
      }

      return;
    }

    const target = dropStart(event, pointerXRef.current, payloadDuration(payload));

    if (!target) return;
    const sourceDay = payload.source === 'grid' ? payload.item.day : selectedDate;

    const result = moveToSlot(
      activity,
      sourceDay,
      localDateString(target.day),
      toTimeString(target.start),
      today,
    );

    onUpdateActivity(result.activity);

    if (result.note) onToast(result.note);
  };

  // Re-resolve the open item each render so the popover follows edits and closes if it disappears.
  // Upcoming can list days outside the visible range, so look there too.
  const selectedItem = selected
    ? (visibleItems.find((item) => item.id === selected.id) ?? upcomingItems.find((item) => item.id === selected.id))
    : undefined;

  const selectedActivity = selectedItem ? findActivity(selectedItem.activityId) : undefined;
  const closePopover = () => setSelected(null);

  const addTaskToDay = (id: string) => {
    const activity = findActivity(id);

    if (activity) onUpdateActivity(addToDay(activity, selectedDate));
  };

  const openTask = (id: string) => {
    if (justDraggedRef.current) return;
    const activity = findActivity(id);

    if (activity) onEditActivity(activity);
  };

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
      <div className="my-5 border-t border-slate-200" />
      <LoggedSummary
        dayLabel={selectedDayLabel}
        stats={loggedStats}
        totalMinutes={loggedTotal}
        onOpen={(activity) => {
          setRailSheetOpen(false);
          onEditActivity(activity);
        }}
      />
      <div className="my-5 border-t border-slate-200" />
      <UpcomingRail items={upcomingItems} today={now} now={now} onSelectItem={selectItem} />
    </>
  );

  return (
    <div className="mx-auto max-w-[1600px] md:px-6 md:pt-5">
      <div className="relative flex h-[calc(100dvh-17.5rem)] min-h-[520px] flex-col overflow-hidden border-y border-slate-200 bg-[#f8fafc] md:h-[calc(100dvh-9.5rem)] md:min-h-[640px] md:rounded-2xl md:border md:shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          accessibility={{ announcements }}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={finishDrag}
        >
          <div className="relative flex min-h-0 flex-1">
            {sidebarOpen && (
              <>
                {isMobile && (
                  <button
                    type="button"
                    aria-label="Close filters"
                    onClick={() => setSidebarOpen(false)}
                    className="absolute inset-0 z-30 bg-slate-900/20"
                  />
                )}
                <aside className="absolute inset-y-0 left-0 z-40 w-[200px] shrink-0 overflow-y-auto border-r border-slate-200 bg-[#f8fafc] md:static md:z-auto">
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
              {isMobile ? (
                <DayAgenda
                  items={visibleItems}
                  isToday={selectedDate === today}
                  now={now}
                  unscheduled={trayItems}
                  addable={addable}
                  activeActivityId={activeTimerTaskId}
                  onSelectItem={selectItem}
                  onSchedule={(id, time) => {
                    const activity = findActivity(id);

                    if (!activity) return;
                    onUpdateActivity(moveToSlot(activity, selectedDate, selectedDate, time, today).activity);
                  }}
                  onAddToDay={addTaskToDay}
                  onOpenItem={openTask}
                  onPrevDay={() => step(-1)}
                  onNextDay={() => step(1)}
                />
              ) : (
                <>
                  <WeekGrid
                    days={days}
                    items={visibleItems}
                    now={now}
                    selectedId={selectedItem?.id ?? null}
                    selectedDay={anchor}
                    activeActivityId={activeTimerTaskId}
                    dropPreview={dropPreview}
                    onSelectItem={selectItem}
                    onSelectDay={goTo}
                    onCreateAt={(day, time) => onCreateActivity(localDateString(day), time)}
                  />
                  <UnscheduledTray
                    items={trayItems}
                    open={trayOpen}
                    onToggle={() => setTrayOpen((o) => !o)}
                    dayLabel={selectedDayLabel}
                    addable={addable}
                    onAddToDay={addTaskToDay}
                    onOpenItem={openTask}
                  />
                </>
              )}
            </section>

            <aside className="hidden w-[284px] shrink-0 overflow-y-auto border-l border-slate-200 bg-[#f8fafc] px-5 py-4 lg:block">
              {rail}
            </aside>
          </div>

          <DragOverlay dropAnimation={null}>
            {dragging?.source === 'tray' ? <TrayChipPreview item={dragging.item} /> : null}
          </DragOverlay>
        </DndContext>

        {railSheetOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Month, logged and upcoming">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setRailSheetOpen(false)}
              className="absolute inset-0 bg-slate-900/30"
            />
            <div className="animate-in absolute inset-x-0 bottom-0 max-h-[75dvh] overflow-y-auto rounded-t-2xl bg-[#f8fafc] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl md:inset-x-auto md:right-4 md:bottom-4 md:w-[320px] md:rounded-2xl">
              <div className="mb-3 flex items-center justify-between">
                <span className="mx-auto h-1 w-10 rounded-full bg-slate-300 md:hidden" />
                <button
                  type="button"
                  onClick={() => setRailSheetOpen(false)}
                  aria-label="Close"
                  className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/60"
                >
                  <X className="size-4" />
                </button>
              </div>
              {rail}
            </div>
          </div>
        )}
      </div>

      {selected && selectedItem && selectedActivity && (
        <EventPopover
          item={selectedItem}
          anchor={selected.anchor}
          isFocusing={activeTimerTaskId === selectedActivity.id}
          canRemoveFromDay={canRemoveFromDay(selectedActivity, selectedItem.day, today)}
          onClose={closePopover}
          onEdit={() => {
            closePopover();
            onEditActivity(selectedActivity);
          }}
          onDelete={() => {
            closePopover();
            onDeleteActivity(selectedActivity.id);
          }}
          onStartFocus={() => {
            closePopover();
            onStartFocus(selectedActivity);
          }}
          onUnschedule={() => {
            closePopover();
            onUpdateActivity(unschedule(selectedActivity));
          }}
          onRemoveFromDay={() => {
            closePopover();
            onUpdateActivity(removeFromDay(selectedActivity, selectedItem.day));
          }}
        />
      )}
    </div>
  );
}
