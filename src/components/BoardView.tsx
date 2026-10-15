import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  X, 
  Layers,
  ChevronRight
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
import { soundManager } from '../utils/audio';

interface BoardViewProps {
  activities: Activity[];
  onUpdateActivity: (activity: Activity) => void;
  onDeleteActivity: (activityId: string) => void;
  onMoveActivityStatus: (activityId: string, newStatus: ActivityStatus, targetIndex?: number) => void;
  onOpenNewTaskModal: (initialStatus?: ActivityStatus) => void;
  onStartFocus: (activity: Activity) => void;
  onEditActivity: (activity: Activity) => void;
  activeTimerTaskId?: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export const BoardView: React.FC<BoardViewProps> = ({
  activities,
  onUpdateActivity,
  onDeleteActivity,
  onMoveActivityStatus,
  onOpenNewTaskModal,
  onStartFocus,
  onEditActivity,
  activeTimerTaskId,
  selectedDate,
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

  // Filter activities
  const filteredActivities = activities.filter((act) => {
    if (selectedDate !== 'all' && act.date !== selectedDate) {
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
      id: `act-${Date.now()}`,
      title: quickAddTitle.trim(),
      category: 'deep_work',
      priority: 'medium',
      status,
      estimatedMinutes: 30,
      actualMinutes: 0,
      date: selectedDate === 'all' ? new Date().toISOString().split('T')[0] : selectedDate,
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
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      
      {/* Filtering Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Search Input with min-h-[44px] */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search activities or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 min-h-[44px] text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Controls (Thumb targets >= 44px) */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as ActivityCategory | 'all')}
            className="min-h-[44px] text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-100/80 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All Categories</option>
            {Object.values(CATEGORIES).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value as ActivityPriority | 'all')}
            className="min-h-[44px] text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-100/80 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={selectedDate}
            onChange={(e) => onSelectDate(e.target.value)}
            className="min-h-[44px] text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-100/80 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
          >
            <option value={new Date().toISOString().split('T')[0]}>Today</option>
            <option value="all">All Dates</option>
          </select>
        </div>
      </div>

      {/* Mobile Column Segmented Carousel / Switcher (sm:hidden) */}
      <div className="sm:hidden flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none" role="tablist">
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
              className={`flex-1 min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 border ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{col.title.split(' ')[0]}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full tabular-nums ${
                isActive ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Drag & Drop Columns (Responsive: 1 selected column on mobile, 4-col grid on sm+) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 items-start">
        {STATUS_COLUMNS.map((col) => {
          const colActivities = filteredActivities.filter((a) => a.status === col.id);
          const colMinutes = colActivities.reduce((acc, c) => acc + (c.estimatedMinutes || 0), 0);
          const isDropActive = activeDropColumn === col.id;

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
              className={`flex flex-col bg-slate-100/70 border rounded-2xl p-3 sm:p-3.5 min-h-[500px] sm:min-h-[620px] transition-all duration-200 ${
                isHiddenOnMobile ? 'hidden sm:flex' : 'flex'
              } ${
                isDropActive
                  ? 'border-indigo-400 bg-indigo-50/40 ring-2 ring-indigo-400/20 shadow-sm'
                  : 'border-slate-200/80'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 px-1 border-b border-slate-200/60 mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {col.title}
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-600 bg-white/90 border border-slate-200 px-2 py-0.5 rounded-md tabular-nums shadow-2xs">
                    {colActivities.length}
                  </span>
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
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Column Hint text */}
              <div className="text-[11px] text-slate-500 px-1 mb-3">
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
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 min-h-[40px]"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickAddColumn(null)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 rounded-lg min-h-[36px]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAddSubmit(col.id)}
                      className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg shadow-2xs min-h-[36px]"
                    >
                      Add Activity
                    </button>
                  </div>
                </div>
              )}

              {/* Activities List */}
              <div className="flex-1 space-y-2.5 overflow-y-auto">
                {colActivities.length === 0 ? (
                  <div className="h-40 border-2 border-dashed border-slate-200/90 rounded-2xl flex flex-col items-center justify-center p-4 text-center">
                    <Layers className="w-5 h-5 text-slate-300 mb-1.5" />
                    <p className="text-xs font-medium text-slate-400">
                      No activities in {col.title.toLowerCase()}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Tap + below to add an activity
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
                className="mt-3 min-h-[44px] py-2.5 px-3 border border-dashed border-slate-300/80 hover:border-slate-400 hover:bg-white/80 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5 transition-colors active:scale-98"
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
