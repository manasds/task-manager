import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { 
  Search, 
  X, 
  Layers,
  SlidersHorizontal
} from 'lucide-react';
import { 
  Activity, 
  ActivityStatus, 
  STATUS_COLUMNS, 
  CATEGORIES, 
  ActivityCategory, 
  ActivityPriority,
  activityCategorySchema,
  activityPrioritySchema
} from '../types/activity';
import { TaskCard } from './TaskCard';
import { getTodayDateString } from '../utils/dates';
import { isActivityOnDate } from '../utils/workSessions';

interface BoardViewProps {
  activities: Activity[];
  onDeleteActivity: (activityId: string) => void;
  onMoveActivityStatus: (activityId: string, newStatus: ActivityStatus, targetIndex?: number) => void;
  onStartFocus: (activity: Activity) => void;
  onEditActivity: (activity: Activity) => void;
  onViewActivity: (activity: Activity) => void;
  activeTimerTaskId?: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const BoardViewBase: React.FC<BoardViewProps> = ({
  activities,
  onDeleteActivity,
  onMoveActivityStatus,
  onStartFocus,
  onEditActivity,
  onViewActivity,
  activeTimerTaskId,
  selectedDate,
  onSelectDate,
}) => {
  const [draggedActivityId, setDraggedActivityId] = useState<string | null>(null);
  const [activeDropColumn, setActiveDropColumn] = useState<ActivityStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory | 'all'>('all');
  const [selectedPriority, setSelectedPriority] = useState<ActivityPriority | 'all'>('all');

  // Mobile active column selector
  const [mobileActiveColumn, setMobileActiveColumn] = useState<ActivityStatus>('in_progress');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount =
    Number(selectedCategory !== 'all') + Number(selectedPriority !== 'all');

  const dateOptions = (
    <>
      <option value={getTodayDateString()}>Today</option>
      {selectedDate !== 'all' && selectedDate !== getTodayDateString() && (
        <option value={selectedDate}>
          {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </option>
      )}
      <option value="all">All Dates</option>
    </>
  );

  // Filter activities
  const filteredActivities = activities.filter((act) => {
    if (act.status !== 'parked' && selectedDate !== 'all' && !isActivityOnDate(act, selectedDate)) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = act.title.toLowerCase().includes(q);
      const matchDesc = act.description?.toLowerCase().includes(q);

      if (!matchTitle && !matchDesc) return false;
    }

    if (selectedCategory !== 'all' && act.category !== selectedCategory) {
      return false;
    }

    if (selectedPriority !== 'all' && act.priority !== selectedPriority) {
      return false;
    }

    return true;
  });

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, activityId: string) => {
    e.dataTransfer.setData('text/plain', activityId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedActivityId(activityId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedActivityId(null);
    setActiveDropColumn(null);
  }, []);

  const handleDragOverColumn = (e: React.DragEvent<HTMLDivElement>, colStatus: ActivityStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (activeDropColumn !== colStatus) {
      setActiveDropColumn(colStatus);
    }
  };

  const handleDropOnColumn = (e: React.DragEvent<HTMLDivElement>, colStatus: ActivityStatus) => {
    e.preventDefault();
    const actId = e.dataTransfer.getData('text/plain') || draggedActivityId;

    if (actId) {
      onMoveActivityStatus(actId, colStatus);
    }

    setDraggedActivityId(null);
    setActiveDropColumn(null);
  };

  // Read through a ref so the handler stays stable and memoized cards skip re-rendering.
  const activitiesRef = useRef(activities);
  useLayoutEffect(() => {
    activitiesRef.current = activities;
  });

  const handleToggleComplete = useCallback((activityId: string) => {
    const act = activitiesRef.current.find((a) => a.id === activityId);

    if (!act) return;

    onMoveActivityStatus(activityId, act.status === 'completed' ? 'in_progress' : 'completed');
  }, [onMoveActivityStatus]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
      
      {/* Filtering Toolbar: on phones, search + date + a Filters toggle share one row. */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-2 py-2 sm:my-4 sm:p-1.5 w-full sm:bg-white sm:border sm:border-slate-200 sm:rounded-[18px] sm:shadow-xs">
        <div className="flex items-center gap-2 flex-1 sm:max-w-md min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search activities..."
              aria-label="Search activities"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-9 min-h-10 sm:min-h-9 text-[13px] bg-page border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-1 sm:right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 min-h-9 min-w-9 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <select
            value={selectedDate}
            onChange={(e) => onSelectDate(e.target.value)}
            aria-label="Filter by date"
            className="sm:hidden w-24 shrink-0 min-h-10 text-xs font-medium bg-white border border-slate-300 rounded-xl px-2.5 text-slate-600 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
          >
            {dateOptions}
          </select>

          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-label="Filters"
            aria-expanded={filtersOpen}
            className={`sm:hidden relative size-10 shrink-0 flex items-center justify-center rounded-xl border transition-colors ${
              filtersOpen ? 'btn-ink' : 'btn-paper'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center tabular-nums">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter Controls: always inline on sm+, behind the Filters toggle on phones. */}
        <div className={`${filtersOpen ? 'flex' : 'hidden'} sm:flex items-center gap-2 min-w-0`}>
          <select
            value={selectedCategory}
            onChange={(e) => {
              const picked = activityCategorySchema.safeParse(e.target.value);
              setSelectedCategory(picked.success ? picked.data : 'all');
            }}
            aria-label="Filter by category"
            className="flex-1 sm:flex-none min-w-0 min-h-10 sm:min-h-9 text-[13px] font-medium rounded-xl px-2.5 sm:px-3 text-slate-600 max-sm:border max-sm:border-slate-200 sm:hover:bg-slate-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500/20 cursor-pointer transition-colors"
          >
            <option value="all">Type</option>
            {Object.values(CATEGORIES).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => {
              const picked = activityPrioritySchema.safeParse(e.target.value);
              setSelectedPriority(picked.success ? picked.data : 'all');
            }}
            aria-label="Filter by priority"
            className="flex-1 sm:flex-none min-w-0 min-h-10 sm:min-h-9 text-[13px] font-medium rounded-xl px-2.5 sm:px-3 text-slate-600 max-sm:border max-sm:border-slate-200 sm:hover:bg-slate-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500/20 cursor-pointer transition-colors"
          >
            <option value="all">Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={selectedDate}
            onChange={(e) => onSelectDate(e.target.value)}
            aria-label="Filter by date"
            className="hidden sm:block min-w-0 min-h-9 text-[13px] font-medium rounded-xl px-3 text-slate-600 hover:bg-slate-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500/20 cursor-pointer transition-colors"
          >
            {dateOptions}
          </select>

        </div>
      </div>

      {/* Mobile Column Segmented Control (sm:hidden) */}
      <div className="sm:hidden flex p-1 bg-tray rounded-[14px]" role="tablist">
        {STATUS_COLUMNS.map((col) => {
          const count = filteredActivities.filter((a) => a.status === col.id).length;
          const isActive = mobileActiveColumn === col.id;

          return (
            <button
              key={col.id}
              onClick={() => setMobileActiveColumn(col.id)}
              role="tab"
              aria-selected={isActive}
              className={`flex-1 h-8.5 rounded-[10px] text-xs font-semibold whitespace-nowrap transition-colors flex items-center justify-center gap-1 ${
                isActive ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{col.shortTitle}</span>
              <span className={`text-[11px] font-mono tabular-nums ${isActive ? 'text-slate-600' : 'text-slate-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Drag & Drop Columns (Responsive: 1 selected column on mobile, 4-col grid on sm+) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 items-stretch sm:gap-4">
        {STATUS_COLUMNS.map((col) => {
          const colActivities = filteredActivities.filter((a) => a.status === col.id);
          const colMinutes = colActivities.reduce((acc, c) => acc + (c.estimatedMinutes || 0), 0);

          // On mobile, hide columns that aren't the selected mobileActiveColumn
          const isHiddenOnMobile = mobileActiveColumn !== col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOverColumn(e, col.id)}
              onDragLeave={(e) => {
                const next = e.relatedTarget;

                if (next instanceof Node && e.currentTarget.contains(next)) return;

                if (activeDropColumn === col.id) {
                  setActiveDropColumn(null);
                }
              }}
              onDrop={(e) => handleDropOnColumn(e, col.id)}
              className={`flex flex-col sm:bg-tray sm:rounded-3xl sm:shadow-[inset_0_1px_2px_rgb(0_0_0/0.04)] pt-2 pb-3 sm:p-3 min-h-125 sm:min-h-155 h-full ${
                isHiddenOnMobile ? 'hidden sm:flex' : 'flex'
              }`}
            >
              {/* Column Header: mobile tabs already show title and count. */}
              <div className="flex items-center justify-between px-1.5 sm:pt-1 mb-2 sm:mb-2.5">
                <div className="flex items-center gap-2">
                  <h3 className="hidden sm:block text-[15px] font-semibold tracking-tight text-slate-900">
                    {col.title}
                  </h3>
                  <span className="hidden sm:inline text-[11px] font-mono font-medium text-slate-500 bg-white border border-slate-200 px-1.5 py-px rounded-full tabular-nums">
                    {colActivities.length}
                  </span>
                </div>

                <span className="text-[11px] text-slate-500 font-mono tabular-nums" title="Total estimated hours">
                  {Math.round((colMinutes / 60) * 10) / 10}h
                </span>
              </div>

              {/* Activities List */}
              <div className="flex-1 space-y-2.5 overflow-y-auto overflow-x-hidden p-0.5 -m-0.5">
                {colActivities.length === 0 ? (
                  <div className="h-40 border-[1.5px] border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-4 text-center">
                    <Layers className="w-5 h-5 text-slate-300 mb-1.5" />
                    <p className="text-xs font-medium text-slate-500">
                      No activities in {col.title.toLowerCase()}
                    </p>
                  </div>
                ) : (
                  colActivities.map((act, index) => (
                    <TaskCard
                      key={act.id}
                      activity={act}
                      index={index}
                      isDragging={draggedActivityId === act.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onToggleComplete={handleToggleComplete}
                      onStartFocus={onStartFocus}
                      onEdit={onEditActivity}
                      onView={onViewActivity}
                      onDelete={onDeleteActivity}
                      onMoveToStatus={onMoveActivityStatus}
                      isTimerActiveForTask={activeTimerTaskId === act.id}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export const BoardView = React.memo(BoardViewBase);
