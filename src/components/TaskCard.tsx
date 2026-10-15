import React from 'react';
import { 
  Clock, 
  CheckCircle2, 
  Circle, 
  Play, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  ListChecks, 
  GripVertical,
  CalendarClock,
  ArrowRight
} from 'lucide-react';
import { Activity, CATEGORIES, PRIORITY_CONFIG, ActivityStatus, STATUS_COLUMNS } from '../types/activity';
import { soundManager } from '../utils/audio';

interface TaskCardProps {
  activity: Activity;
  index: number;
  isDragging?: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, activityId: string) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOverCard?: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
  onToggleComplete: (activityId: string) => void;
  onStartFocus: (activity: Activity) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activityId: string) => void;
  onMoveToStatus?: (activityId: string, targetStatus: ActivityStatus) => void;
  isTimerActiveForTask?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  activity,
  index,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onToggleComplete,
  onStartFocus,
  onEdit,
  onDelete,
  onMoveToStatus,
  isTimerActiveForTask,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const categoryMeta = CATEGORIES[activity.category] || CATEGORIES.deep_work;
  const priorityMeta = PRIORITY_CONFIG[activity.priority] || PRIORITY_CONFIG.medium;
  const isCompleted = activity.status === 'completed';

  const completedSubtasks = activity.subtasks.filter((s) => s.completed).length;
  const totalSubtasks = activity.subtasks.length;

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleComplete(activity.id);
  };

  const handleStartTimer = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundManager.playDragStart();
    onStartFocus(activity);
  };

  // Determine next status for 1-tap mobile advancement
  const currentStatusIdx = STATUS_COLUMNS.findIndex((c) => c.id === activity.status);
  const nextStatus = currentStatusIdx >= 0 && currentStatusIdx < STATUS_COLUMNS.length - 1
    ? STATUS_COLUMNS[currentStatusIdx + 1].id
    : null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        soundManager.playDragStart();
        onDragStart(e, activity.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        if (onDragOverCard) {
          e.preventDefault();
          onDragOverCard(e, index);
        }
      }}
      className={`group relative bg-white rounded-2xl border transition-all duration-200 select-none touch-manipulation ${
        isDragging
          ? 'opacity-40 scale-95 border-indigo-400 shadow-md ring-2 ring-indigo-400/20'
          : 'border-slate-200/90 hover:border-slate-300 hover:shadow-xs'
      } ${isCompleted ? 'bg-slate-50/70 border-slate-200/60' : ''} ${
        isTimerActiveForTask ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-xs' : ''
      }`}
    >
      <div className="p-3.5 sm:p-4 space-y-2.5">
        
        {/* Top Header: Unboxed metadata with typographic separators */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: categoryMeta.color }}
              title={categoryMeta.label}
            />
            <span className="font-semibold text-slate-700 truncate">
              {categoryMeta.label}
            </span>
            <span className="text-slate-300 shrink-0" aria-hidden="true">·</span>
            <span className="truncate tabular-nums">{activity.estimatedMinutes}m</span>
            <span className="text-slate-300 shrink-0" aria-hidden="true">·</span>
            <span className={`font-medium ${priorityMeta.textColor}`}>{priorityMeta.label}</span>
          </div>

          {/* Drag Handle & Menu with >= 44px touch targets */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="hidden sm:inline-flex text-slate-300 group-hover:text-slate-400 cursor-grab active:cursor-grabbing p-1">
              <GripVertical className="w-4 h-4" />
            </span>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 active:bg-slate-100 rounded-xl transition-colors"
                aria-label="Activity options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 text-xs">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onEdit(activity);
                    }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-slate-700 hover:bg-slate-50 text-left min-h-[40px]"
                  >
                    <Edit3 className="w-4 h-4 text-slate-500" />
                    <span>Edit Activity</span>
                  </button>

                  {/* Quick status change buttons */}
                  {onMoveToStatus && (
                    <>
                      <div className="border-t border-slate-100 my-1" />
                      {STATUS_COLUMNS.map((col) => {
                        if (col.id === activity.status) return null;
                        return (
                          <button
                            key={col.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowMenu(false);
                              onMoveToStatus(activity.id, col.id);
                            }}
                            className="flex items-center gap-2 w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 text-left min-h-[38px]"
                          >
                            <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Move to {col.title}</span>
                          </button>
                        );
                      })}
                    </>
                  )}

                  <div className="border-t border-slate-100 my-1" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDelete(activity.id);
                    }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-rose-600 hover:bg-rose-50 text-left min-h-[40px]"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>Delete Activity</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Task Title & Checkbox with >= 44px Touch Target */}
        <div className="flex items-start gap-1">
          <button
            type="button"
            onClick={handleCheckboxClick}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center -ml-2 -mt-2 text-slate-400 hover:text-emerald-600 transition-colors shrink-0"
            aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-50" />
            ) : (
              <Circle className="w-5 h-5 hover:stroke-emerald-500" />
            )}
          </button>
          
          <div className="flex-1 min-w-0 pt-0.5">
            <h4
              onClick={() => onEdit(activity)}
              className={`text-sm font-semibold cursor-pointer transition-colors leading-snug ${
                isCompleted ? 'text-slate-400 line-through' : 'text-slate-900 hover:text-indigo-600'
              }`}
            >
              {activity.title}
            </h4>

            {activity.description && (
              <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                {activity.description}
              </p>
            )}
          </div>
        </div>

        {/* Scheduled time badge if present */}
        {activity.scheduledTime && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 py-1 px-2.5 rounded-lg border border-slate-200/60 w-fit">
            <CalendarClock className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-mono tabular-nums font-semibold">{activity.scheduledTime}</span>
          </div>
        )}

        {/* Footer info: Subtasks, Logged duration, Quick 1-tap Advance & Focus */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            {totalSubtasks > 0 && (
              <span className="flex items-center gap-1 text-slate-600 tabular-nums">
                <ListChecks className="w-4 h-4 text-slate-400" />
                <span>{completedSubtasks}/{totalSubtasks}</span>
              </span>
            )}
            <span className="flex items-center gap-1 tabular-nums font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{activity.actualMinutes}m</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Quick 1-tap Advance on Mobile */}
            {nextStatus && onMoveToStatus && !isCompleted && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  soundManager.playDrop();
                  onMoveToStatus(activity.id, nextStatus);
                }}
                title="Advance to next column"
                className="sm:hidden min-h-[38px] px-2 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 bg-slate-100 rounded-lg flex items-center gap-1 active:scale-95"
              >
                <span>Advance</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}

            {/* Quick Focus Button */}
            {!isCompleted && (
              <button
                type="button"
                onClick={handleStartTimer}
                title={isTimerActiveForTask ? 'Focus session active' : 'Start focus timer on this activity'}
                className={`min-h-[38px] flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors active:scale-95 ${
                  isTimerActiveForTask
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'text-slate-700 font-medium hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50'
                }`}
              >
                <Play className="w-3 h-3 fill-current" />
                <span className="text-xs">{isTimerActiveForTask ? 'Active' : 'Focus'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
