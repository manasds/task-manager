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
  const shortCategory = categoryMeta.label.split(/[&/]/)[0].trim();

  const completedSubtasks = activity.subtasks.filter((s) => s.completed).length;
  const totalSubtasks = activity.subtasks.length;

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMenu(false);
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
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
    ? STATUS_COLUMNS[currentStatusIdx + 1]
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
      className={`group relative box-border bg-white rounded-2xl border-2 transition-colors duration-200 select-none touch-manipulation min-h-28 ${
        isDragging
          ? 'opacity-40 scale-[0.98] border-indigo-400'
          : isTimerActiveForTask
            ? 'border-indigo-500 bg-indigo-50/30'
            : isCompleted
              ? 'border-slate-200/80 bg-slate-50/70'
              : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="p-3 space-y-2.5">
        
        {/* Top Header: Unboxed metadata with typographic separators */}
        <div className="flex items-center justify-between gap-1.5 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="inline-flex items-center gap-1 min-w-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: categoryMeta.lightBg,
                color: categoryMeta.textColor,
              }}
              title={categoryMeta.label}
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: categoryMeta.color }}
              />
              <span className="truncate">{shortCategory}</span>
            </span>
            <span className="text-slate-300 shrink-0" aria-hidden="true">·</span>
            <span className="shrink-0 tabular-nums text-slate-500">{activity.estimatedMinutes}m</span>
            <span className="text-slate-300 shrink-0" aria-hidden="true">·</span>
            <span className={`shrink-0 font-medium ${priorityMeta.textColor}`}>{priorityMeta.label}</span>
          </div>

          <div className="flex items-center shrink-0">
            <span className="hidden sm:inline-flex text-slate-300 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-0.5 transition-opacity">
              <GripVertical className="w-3.5 h-3.5" />
            </span>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="size-7 max-sm:size-11 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Activity options"
                aria-haspopup="menu"
                aria-expanded={showMenu}
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
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-slate-700 hover:bg-slate-50 text-left min-h-10"
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
                            className="flex items-center gap-2 w-full px-3.5 py-2 text-slate-700 hover:bg-slate-50 text-left min-h-9.5"
                          >
                            <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Move to {col.title.split(/[&/]/)[0].trim()}</span>
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
                    className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-rose-600 hover:bg-rose-50 text-left min-h-10"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>Delete Activity</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Task Title & Checkbox */}
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={handleCheckboxClick}
            className="mt-0.5 size-5 max-sm:size-11 max-sm:-ml-2 max-sm:-mt-2 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-colors shrink-0"
            aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
          >
            {isCompleted ? (
              <CheckCircle2 className="size-4 text-emerald-600 fill-emerald-50" />
            ) : (
              <Circle className="size-4 hover:stroke-emerald-500" />
            )}
          </button>
          
          <div className="flex-1 min-w-0">
            <h4
              onClick={() => onEdit(activity)}
              className={`text-sm font-semibold cursor-pointer transition-colors leading-snug line-clamp-2 ${
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

        {/* Footer: quiet metadata on the left, actions on the right */}
        {(activity.scheduledTime || totalSubtasks > 0 || activity.actualMinutes > 0 ) && !isCompleted && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex items-center gap-2.5 min-w-0 tabular-nums">
              {activity.scheduledTime && (
                <span className="shrink-0 font-medium text-slate-600" title="Scheduled time">
                  {activity.scheduledTime}
                </span>
              )}
              {totalSubtasks > 0 && (
                <span className="inline-flex items-center gap-1 shrink-0" title="Checklist progress">
                  <ListChecks className="w-3.5 h-3.5 text-slate-400" />
                  {completedSubtasks}/{totalSubtasks}
                </span>
              )}
              {activity.actualMinutes > 0 && (
                <span className="inline-flex items-center gap-1 shrink-0" title="Time logged">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {activity.actualMinutes}m
                </span>
              )}
            </div>

            {!isCompleted && (
              <div className="flex items-center gap-0.5 shrink-0">
                {nextStatus && onMoveToStatus && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      soundManager.playDrop();
                      onMoveToStatus(activity.id, nextStatus.id);
                    }}
                    title={`Move to ${nextStatus.shortTitle}`}
                    aria-label={`Move to ${nextStatus.shortTitle}`}
                    className="sm:hidden size-9 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleStartTimer}
                  title={isTimerActiveForTask ? 'Focus session active' : 'Start focus timer on this activity'}
                  className={`min-h-8 max-sm:min-h-9 px-2.5 rounded-lg transition-[color,background-color,border-color,opacity] flex items-center gap-1.5 font-semibold ${
                    isTimerActiveForTask
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 border border-slate-200 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100'
                  }`}
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{isTimerActiveForTask ? 'Active' : 'Focus'}</span>
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
