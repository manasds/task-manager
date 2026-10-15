import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  CheckCircle2, 
  Circle
} from 'lucide-react';
import { 
  Activity, 
  ActivityCategory, 
  ActivityPriority, 
  ActivityStatus, 
  CATEGORIES, 
  Subtask 
} from '../types/activity';
import { getTodayDateString } from '../utils/storage';
import { soundManager } from '../utils/audio';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (activity: Activity) => void;
  initialActivity?: Activity | null;
  defaultStatus?: ActivityStatus;
  defaultTime?: string;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialActivity,
  defaultStatus = 'backlog',
  defaultTime,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ActivityCategory>('deep_work');
  const [priority, setPriority] = useState<ActivityPriority>('medium');
  const [status, setStatus] = useState<ActivityStatus>(defaultStatus);
  const [estimatedMinutes, setEstimatedMinutes] = useState(45);
  const [actualMinutes, setActualMinutes] = useState(0);
  const [scheduledTime, setScheduledTime] = useState(defaultTime || '');
  const [date, setDate] = useState(getTodayDateString());
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialActivity) {
      setTitle(initialActivity.title);
      setDescription(initialActivity.description || '');
      setCategory(initialActivity.category);
      setPriority(initialActivity.priority);
      setStatus(initialActivity.status);
      setEstimatedMinutes(initialActivity.estimatedMinutes || 30);
      setActualMinutes(initialActivity.actualMinutes || 0);
      setScheduledTime(initialActivity.scheduledTime || '');
      setDate(initialActivity.date || getTodayDateString());
      setSubtasks(initialActivity.subtasks || []);
      setTags(initialActivity.tags || []);
    } else {
      setTitle('');
      setDescription('');
      setCategory('deep_work');
      setPriority('medium');
      setStatus(defaultStatus);
      setEstimatedMinutes(45);
      setActualMinutes(0);
      setScheduledTime(defaultTime || '');
      setDate(getTodayDateString());
      setSubtasks([]);
      setTags([]);
    }
    setError('');
  }, [initialActivity, defaultStatus, defaultTime, isOpen]);

  if (!isOpen) return null;

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks([
      ...subtasks,
      {
        id: `sub-${Date.now()}`,
        title: newSubtaskTitle.trim(),
        completed: false,
      },
    ]);
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (id: string) => {
    soundManager.playDrop();
    setSubtasks(
      subtasks.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s))
    );
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter((s) => s.id !== id));
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/^#/, '');
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title for the activity');
      return;
    }

    const activityToSave: Activity = {
      id: initialActivity ? initialActivity.id : `act-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      priority,
      status,
      estimatedMinutes: Number(estimatedMinutes) || 30,
      actualMinutes: Number(actualMinutes) || 0,
      scheduledTime: scheduledTime || undefined,
      date,
      subtasks,
      tags,
      createdAt: initialActivity ? initialActivity.createdAt : new Date().toISOString(),
      completedAt: status === 'completed' ? (initialActivity?.completedAt || new Date().toISOString()) : undefined,
    };

    soundManager.playDrop();
    onSave(activityToSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
      <div 
        className="bg-white rounded-t-3xl sm:rounded-2xl max-w-xl w-full max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile Grab Handle Bar */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {initialActivity ? 'Edit Activity' : 'Create New Activity'}
            </h3>
            <p className="text-xs text-slate-500">
              Configure parameters, estimates, and checklist
            </p>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 active:bg-slate-100 rounded-xl transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Title input with min-h-[44px] */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 text-xs">Activity Title *</label>
            <input
              type="text"
              autoFocus
              placeholder="e.g. Architect Database Caching Layer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm font-medium px-3.5 min-h-[44px] border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Category & Priority Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 text-xs">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ActivityCategory)}
                className="w-full px-3 min-h-[44px] border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 cursor-pointer text-xs"
              >
                {Object.values(CATEGORIES).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 text-xs">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ActivityPriority)}
                className="w-full px-3 min-h-[44px] border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 cursor-pointer text-xs"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Status & Estimated Minutes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 text-xs">Board Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ActivityStatus)}
                className="w-full px-3 min-h-[44px] border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 cursor-pointer text-xs"
              >
                <option value="backlog">Planned & Queued</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review / Verify</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 text-xs">Estimated Duration</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="5"
                  max="600"
                  step="5"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(Math.max(5, parseInt(e.target.value, 10) || 5))}
                  className="w-full px-3 min-h-[44px] border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 font-mono tabular-nums text-xs"
                />
                <span className="text-slate-500 shrink-0 font-medium">min</span>
              </div>
            </div>
          </div>

          {/* Quick estimate preset chips with touch targets */}
          <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium">Presets:</span>
            {[15, 25, 45, 60, 90].map((mins) => (
              <button
                type="button"
                key={mins}
                onClick={() => setEstimatedMinutes(mins)}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold tabular-nums transition-colors active:scale-95 ${
                  estimatedMinutes === mins
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>

          {/* Date & Scheduled Time Row */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 text-xs">Target Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 min-h-[44px] border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 text-xs">Scheduled Time</label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full px-3 min-h-[44px] border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 font-mono text-xs"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5 pt-1">
            <label className="font-semibold text-slate-700 text-xs">Notes / Objectives</label>
            <textarea
              rows={2}
              placeholder="Context, requirements, links or outcomes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 text-xs"
            />
          </div>

          {/* Subtask Checklist */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 text-xs">Checklist Subtasks</label>
              <span className="text-[11px] text-slate-400 font-medium">
                {subtasks.filter((s) => s.completed).length}/{subtasks.length} done
              </span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {subtasks.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200/80"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleSubtask(sub.id)}
                    className="flex items-center gap-2.5 min-w-0 text-left min-h-[36px]"
                  >
                    {sub.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span
                      className={`truncate text-xs ${
                        sub.completed ? 'text-slate-400 line-through' : 'text-slate-800'
                      }`}
                    >
                      {sub.title}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubtask(sub.id)}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-rose-600 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add checklist item..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                className="flex-1 px-3 min-h-[44px] border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-500 text-xs"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="min-h-[44px] px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold text-xs active:scale-95 transition-transform"
              >
                Add
              </button>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <label className="font-semibold text-slate-700 text-xs">Tags</label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {tags.map((t) => (
                <span
                  key={t}
                  className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="hover:text-rose-600 text-slate-400 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder="Tag + enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                className="px-3 min-h-[36px] border border-slate-200 rounded-xl text-xs w-32 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Modal Footer Actions with min-h-[48px] touch CTAs */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 font-semibold text-slate-600 hover:text-slate-900 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 rounded-xl shadow-xs transition-all"
            >
              {initialActivity ? 'Save Changes' : 'Create Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
