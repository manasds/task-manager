import React, { useState } from 'react';
import { 
  Plus, 
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
  ActivityPriority 
} from '../types/activity';
import { TaskCard } from './TaskCard';
import { GoalSelect } from './GoalSelect';
import { soundManager } from '../utils/audio';
import { getTodayDateString } from '../utils/dates';
import { isActivityOnDate } from '../utils/workSessions';

interface BoardViewProps {
  activities: Activity[];
  onUpdateActivity: (activity: Activity) => void;
  onDeleteActivity: (activityId: string) => void;
  onMoveActivityStatus: (activityId: string, newStatus: ActivityStatus, targetIndex?: number) => void;
  onStartFocus: (activity: Activity) => void;
  onEditActivity: (activity: Activity) => void;
  activeTimerTaskId?: string;
  selectedDate: string;
  /** 'all' or a goal name. */
  goal: string;
  onGoalChange: (goal: string) => void;
  onSelectDate: (date: string) => void;
}

export const BoardView: React.FC<BoardViewProps> = ({
  activities,
  onUpdateActivity,
  onDeleteActivity,
  onMoveActivityStatus,
  onStartFocus,
  onEditActivity,
  activeTimerTaskId,
  selectedDate,
  goal,
  onGoalChange,
  onSelectDate,
}) => {
  const [draggedActivityId, setDraggedActivityId] = useState<string | null>(null);
  const [activeDropColumn, setActiveDropColumn] = useState<ActivityStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory | 'all'>('all');
  const [selectedPriority, setSelectedPriority] = useState<ActivityPriority | 'all'>('all');
  const [quickAddColumn, setQuickAddColumn] = useState<ActivityStatus | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');
  
  // Mobile active column selector
  const [mobileActiveColumn, setMobileActiveColumn] = useState<ActivityStatus>('in_progress');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount =
    Number(selectedCategory !== 'all') + Number(selectedPriority !== 'all') + Number(goal !== 'all');

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
    if (goal !== 'all' && act.goal !== goal) return false;

    if (act.status !== 'parked' && selectedDate !== 'all' && !isActivityOnDate(act, selectedDate)) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = act.title.toLowerCase().includes(q);
      const matchDesc = act.description?.toLowerCase().includes(q);
      const matchTag = act.tags.some((t) => t.toLowerCase().includes(q));

      if (!matchTitle && !matchDesc && !matchTag) return false;
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
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, activityId: string) => {
    e.dataTransfer.setData('text/plain', activityId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedActivityId(activityId);
  };

  const handleDragEnd = () => {
    setDraggedActivityId(null);
    setActiveDropColumn(null);
  };

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
      soundManager.playDrop();
      onMoveActivityStatus(actId, colStatus);
    }

    setDraggedActivityId(null);
    setActiveDropColumn(null);
  };

  const handleToggleComplete = (activityId: string) => {
    const act = activities.find((a) => a.id === activityId);

    if (!act) return;

    if (act.status === 'completed') {
      onUpdateActivity({
        ...act,
        status: 'in_progress',
        completedAt: undefined,
      });
    } else {
      soundManager.playComplete();
      onUpdateActivity({
        ...act,
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
    }
  };

  const handleQuickAddSubmit = (status: ActivityStatus) => {
    if (!quickAddTitle.trim()) {
      setQuickAddColumn(null);

      return;
    }

    const newAct: Activity = {
      id: `task-${crypto.randomUUID()}`,
      title: quickAddTitle.trim(),
      ...(goal !== 'all' ? { goal } : {}),
      category: 'build',
      priority: 'medium',
      status,
      estimatedMinutes: 30,
      actualMinutes: 0,
      date: selectedDate === 'all' ? getTodayDateString() : selectedDate,
      subtasks: [],
      tags: [],
      createdAt: new Date().toISOString(),
    };

    soundManager.playDrop();
    onUpdateActivity(newAct);
    setQuickAddTitle('');
    setQuickAddColumn(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
      
      {/* Filtering Toolbar: on phones, search + date + a Filters toggle share one row. */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 py-2 sm:p-2 w-full">
        <div className="flex items-center gap-2 flex-1 sm:max-w-md min-w-0">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search activities or tags..."
              aria-label="Search activities"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-9 min-h-10 sm:min-h-11 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
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
            className="sm:hidden w-24 shrink-0 min-h-10 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-slate-700 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
          >
            {dateOptions}
          </select>

          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-label="Filters"
            aria-expanded={filtersOpen}
            className={`sm:hidden relative size-10 shrink-0 flex items-center justify-center rounded-xl border transition-colors ${
              filtersOpen ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter Controls: always inline on sm+, behind the Filters toggle on phones. */}
        <div className={`${filtersOpen ? 'flex' : 'hidden'} sm:flex items-center gap-2 min-w-0`}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as ActivityCategory | 'all')}
            aria-label="Filter by category"
            className="flex-1 sm:flex-none min-w-0 min-h-10 sm:min-h-11 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 text-slate-700 hover:bg-slate-100/80 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
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
            onChange={(e) => setSelectedPriority(e.target.value as ActivityPriority | 'all')}
            aria-label="Filter by priority"
            className="flex-1 sm:flex-none min-w-0 min-h-10 sm:min-h-11 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 text-slate-700 hover:bg-slate-100/80 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
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
            className="hidden sm:block min-w-0 min-h-11 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 text-slate-700 hover:bg-slate-100/80 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
          >
            {dateOptions}
          </select>

          <GoalSelect
            activities={activities}
            value={goal}
            onChange={onGoalChange}
            className="flex-1 sm:flex-none min-w-0 min-h-10 sm:min-h-11 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 text-slate-700 hover:bg-slate-100/80 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Mobile Column Segmented Control (sm:hidden) */}
      <div className="sm:hidden flex p-1 bg-slate-100 rounded-xl" role="tablist">
        {STATUS_COLUMNS.map((col) => {
          const count = filteredActivities.filter((a) => a.status === col.id).length;
          const isActive = mobileActiveColumn === col.id;

          return (
            <button
              key={col.id}
              onClick={() => {
                soundManager.playDragStart();
                setMobileActiveColumn(col.id);
              }}
              role="tab"
              aria-selected={isActive}
              className={`flex-1 h-8 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center justify-center gap-1 ${
                isActive ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{col.shortTitle}</span>
              <span className={`text-[10px] tabular-nums ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Drag & Drop Columns (Responsive: 1 selected column on mobile, 4-col grid on sm+) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 items-stretch ">
        {STATUS_COLUMNS.map((col) => {
          const colActivities = filteredActivities.filter((a) => a.status === col.id);
          const colMinutes = colActivities.reduce((acc, c) => acc + (c.estimatedMinutes || 0), 0);

          // On mobile, hide columns that aren't the selected mobileActiveColumn
          const isHiddenOnMobile = mobileActiveColumn !== col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOverColumn(e, col.id)}
              onDragLeave={() => {
                if (activeDropColumn === col.id) {
                  setActiveDropColumn(null);
                }
              }}
              onDrop={(e) => handleDropOnColumn(e, col.id)}
              className={`flex flex-col sm:bg-white sm:border sm:border-neutral-100 pt-2 pb-3 sm:p-3.5 min-h-125 sm:min-h-155 h-full transition-all duration-200 ${
                isHiddenOnMobile ? 'hidden sm:flex' : 'flex'
              }`}
            >
              {/* Column Header: the mobile tabs already show title and count, so phones get the hint here instead. */}
              <div className="flex items-center justify-between sm:pb-3 px-1 sm:border-b border-slate-200/60 mb-2 sm:mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="hidden sm:block text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {col.title}
                  </h3>
                  <span className="hidden sm:inline text-[11px] font-semibold text-slate-600 bg-white/90 border border-slate-200 px-2 py-0.5 rounded-md tabular-nums shadow-2xs">
                    {colActivities.length}
                  </span>
                  <span className="sm:hidden text-[11px] text-slate-500">{col.hint}</span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-mono tabular-nums" title="Total estimated hours">
                    {Math.round((colMinutes / 60) * 10) / 10}h
                  </span>
                  <button
                    onClick={() => {
                      setQuickAddColumn(col.id);
                      setQuickAddTitle('');
                    }}
                    title={`Add activity to ${col.title}`}
                    aria-label={`Add activity to ${col.title}`}
                    className="hidden sm:flex min-h-9 min-w-9 items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Column Hint text */}
              <div className="hidden sm:block text-[11px] text-slate-500 px-1 mb-3">
                {col.hint}
              </div>

              {/* Quick Inline Add Form */}
              {quickAddColumn === col.id && (
                <div className="mb-3 p-3 bg-white rounded-2xl border border-indigo-200 shadow-sm space-y-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Activity title..."
                    value={quickAddTitle}
                    onChange={(e) => setQuickAddTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleQuickAddSubmit(col.id);

                      if (e.key === 'Escape') setQuickAddColumn(null);
                    }}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 min-h-10"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickAddColumn(null)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 rounded-lg min-h-9"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAddSubmit(col.id)}
                      className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-2xs min-h-9"
                    >
                      Add Activity
                    </button>
                  </div>
                </div>
              )}

              {/* Activities List */}
              <div className="flex-1 space-y-2.5 overflow-y-auto overflow-x-hidden p-0.5 -m-0.5">
                {colActivities.length === 0 ? (
                  <div className="h-40 border-2 border-dashed border-slate-200/90 rounded-2xl flex flex-col items-center justify-center p-4 text-center">
                    <Layers className="w-5 h-5 text-slate-300 mb-1.5" />
                    <p className="text-xs font-medium text-slate-400">
                      No activities in {col.title.toLowerCase()}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Add an activity below
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
                      onDelete={onDeleteActivity}
                      onMoveToStatus={(id, status) => {
                        soundManager.playDrop();
                        onMoveActivityStatus(id, status);
                      }}
                      isTimerActiveForTask={activeTimerTaskId === act.id}
                    />
                  ))
                )}
              </div>

              {/* Bottom Quick Add Trigger (Touch Target >= 44px) */}
              <button
                type="button"
                onClick={() => {
                  setQuickAddColumn(col.id);
                  setQuickAddTitle('');
                }}
                className="mt-3 min-h-11 py-2.5 px-3 border border-dashed border-slate-300/80 hover:border-slate-400 hover:bg-white/80 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 transition-colors active:scale-98"
              >
                <Plus className="w-4 h-4 text-slate-400" />
                <span>Add Activity</span>
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
};
