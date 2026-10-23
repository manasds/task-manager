import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import type { Activity } from '@/types/activity';
import type {
  CalendarFilters,
  CalendarItem,
  CalendarPriority,
  CalendarType,
  CalendarViewMode,
  DragPayload,
} from '@/lib/calendar/types';
import { GRID_END_HOUR, GRID_START_HOUR, HOUR_HEIGHT, SNAP_MINUTES, WEEK_OPTIONS } from '@/lib/calendar/theme';
import { formatRange, passesFilters } from '@/lib/calendar/layout';
import {
  addableTo,
  addToDay,
  calendarItems,
  canRemoveFromDay,
  moveToSlot,
  removeFromDay,
  toTimeString,
  unschedule,
  unscheduledOn,
} from '@/lib/calendar/activities';
import { formatMinutes, localDateString, parseLocalDate, taskStatsForDate } from '@/utils/workSessions';
import { soundManager } from '@/utils/audio';
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

type DragTarget = { id: string | number; data: { current?: unknown } } | null;

function dragTitle(data: { current?: unknown }): string {
  return (data.current as DragPayload | undefined)?.item.title ?? 'Activity';
}

function targetLabel(over: DragTarget): string {
  if (!over) return 'nowhere';
  if (over.id === TRAY_DROP_ID) return 'Unscheduled';
  const day = (over.data.current as DayDropData | undefined)?.day;
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

function clientY(event: Event | null): number | null {
  if (!event) return null;
  if ('touches' in event) {
    const touch = (event as TouchEvent).touches[0] ?? (event as TouchEvent).changedTouches[0];
    return touch ? touch.clientY : null;
  }
  return 'clientY' in event ? (event as MouseEvent).clientY : null;
}

/**
 * Snapped start for a drag: where the dragged item's top edge sits in the hovered day column.
 * Uses the live pointer and the column's current position, so it stays right while the grid
 * auto-scrolls during the drag.
 */
function dropStart(
  event: DragMoveEvent | DragEndEvent,
  pointerY: number | null,
  durationMinutes: number,
): { day: Date; start: Date } | null {
  const { active, over } = event;
  const data = over?.data.current as DayDropData | undefined;
  const startY = clientY(event.activatorEvent);
  const initial = active.rect.current.initial;
  const column = over ? document.querySelector(`[data-drop-id="${String(over.id)}"]`) : null;
  if (!data?.day || pointerY === null || startY === null || !initial || !column) return null;
  const itemTop = pointerY - (startY - initial.top);
  const raw = ((itemTop - column.getBoundingClientRect().top) / HOUR_HEIGHT) * 60;
  const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
  const minutes = Math.min(Math.max(0, snapped), GRID_MINUTES - Math.min(durationMinutes, GRID_MINUTES));
  return { day: data.day, start: addMinutes(startOfDay(data.day), GRID_START_HOUR * 60 + minutes) };
}

function payloadDuration(payload: DragPayload): number {
  return payload.source === 'grid'
    ? differenceInMinutes(payload.item.end, payload.item.start)
    : payload.item.durationMinutes;
}

export interface CalendarViewProps {
  activities: Activity[];
  /** 'YYYY-MM-DD', shared with the Planner and Activity tabs. */
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

/** Planner and Activity in one week view: planned blocks, logged sessions and the unscheduled queue. */
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
  const pointerYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!dragging) return;
    const track = (event: MouseEvent | TouchEvent) => {
      pointerYRef.current = clientY(event);
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
    () => calendarItems(activities, dayKeys, today).filter((item) => passesFilters(item, filters)),
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
    () => addableTo(activities, selectedDate).map((a) => ({ id: a.id, title: a.title })),
    [activities, selectedDate],
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
    pointerYRef.current = clientY(event.activatorEvent);
    setDragging((event.active.data.current as DragPayload | undefined) ?? null);
    setSelected(null);
    soundManager.playDragStart();
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (!dragging || !event.over) {
      setDropPreview(null);
      return;
    }
    const minutes = payloadDuration(dragging);
    const target = dropStart(event, pointerYRef.current, minutes);
    if (!target) {
      setDropPreview(null);
      return;
    }
    const top = ((target.start.getHours() - GRID_START_HOUR) * 60 + target.start.getMinutes()) * (HOUR_HEIGHT / 60);
    const next: DropPreview = {
      dropId: String(event.over.id),
      top,
      height: Math.max(24, (minutes / 60) * HOUR_HEIGHT),
      label: formatRange(target.start, addMinutes(target.start, minutes)),
    };
    setDropPreview((current) => (current && current.dropId === next.dropId && current.top === next.top ? current : next));
  };

  const finishDrag = () => {
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
        soundManager.playDrop();
      }
      return;
    }

    const target = dropStart(event, pointerYRef.current, payloadDuration(payload));
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
    soundManager.playDrop();
    if (result.note) onToast(result.note);
  };

  // Re-resolve the open item each render so the popover follows edits and closes if it disappears.
  const selectedItem = selected ? visibleItems.find((item) => item.id === selected.id) : undefined;
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
      <div className="my-5 border-t border-neutral-200" />
      <LoggedSummary
        dayLabel={selectedDayLabel}
        stats={loggedStats}
        totalMinutes={loggedTotal}
        onOpen={(activity) => {
          setRailSheetOpen(false);
          onEditActivity(activity);
        }}
      />
      <div className="my-5 border-t border-neutral-200" />
      <UpcomingRail items={upcomingItems} today={now} now={now} onSelectItem={selectItem} />
    </>
  );

  return (
    <div className="mx-auto max-w-[1600px] md:px-6 md:pt-5">
      <div className="relative flex h-[calc(100dvh-17.5rem)] min-h-[520px] flex-col overflow-hidden border-y border-neutral-200 bg-[#f7f7f6] md:h-[calc(100dvh-9.5rem)] md:min-h-[640px] md:rounded-2xl md:border md:shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
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
                    className="absolute inset-0 z-30 bg-neutral-900/20"
                  />
                )}
                <aside className="absolute inset-y-0 left-0 z-40 w-[200px] shrink-0 overflow-y-auto border-r border-neutral-200 bg-[#f7f7f6] md:static md:z-auto">
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
                    soundManager.playDrop();
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
                    onSelectDay={(day) => {
                      onSelectDate(localDateString(day));
                      setSelected(null);
                    }}
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

            <aside className="hidden w-[284px] shrink-0 overflow-y-auto border-l border-neutral-200 bg-[#f7f7f6] px-5 py-4 lg:block">
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
