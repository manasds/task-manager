import React, { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { X, Pencil, CalendarDays, Clock, Timer, ListChecks } from "lucide-react";
import { Activity, CATEGORIES, PRIORITY_CONFIG, STATUS_COLUMNS } from "../types/activity";
import { formatMinutes, parseLocalDate } from "../utils/workSessions";

interface TaskDetailModalProps {
  activity: Activity;
  /** Saves edited notes; called on close only if they changed. */
  onSave: (activity: Activity) => void;
  onClose: () => void;
  /** Open the full edit form instead. */
  onEdit: () => void;
}

function formatDate(date: string): string {
  return parseLocalDate(date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);

  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function Detail({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-w-0" title={label}>
      <Icon className="size-3.5 shrink-0 text-slate-400" aria-label={label} />
      <span className="truncate">{children}</span>
    </div>
  );
}

const iconButton =
  "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 outline-hidden hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-slate-400 transition-colors";

/** Read-only view of a task. Only the notes can be edited here. */
export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ activity, onSave, onClose, onEdit }) => {
  const [notes, setNotes] = useState(activity.description ?? "");
  const category = CATEGORIES[activity.category];
  const priority = PRIORITY_CONFIG[activity.priority];
  const status = STATUS_COLUMNS.find((c) => c.id === activity.status);
  const doneCount = activity.subtasks.filter((s) => s.completed).length;

  const saveNotes = () => {
    const trimmed = notes.trim();

    if (trimmed !== (activity.description ?? "")) onSave({ ...activity, description: trimmed || undefined });
  };

  const close = () => {
    saveNotes();
    onClose();
  };

  // Re-attached each render so Escape saves the latest notes.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
      >
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        <div className="px-5 sm:px-6 pt-4 sm:pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md"
                style={{ backgroundColor: category.lightBg, color: category.textColor }}
              >
                <span className="size-1.5 rounded-full" style={{ backgroundColor: category.color }} />
                {category.label}
              </span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 ${priority.textColor}`}>
                <span className="size-1.5 rounded-full" style={{ backgroundColor: priority.dotColor }} />
                {priority.label}
              </span>
              {status && <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">{status.title}</span>}
            </div>
            <div className="flex items-center gap-0.5 -mr-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  saveNotes();
                  onEdit();
                }}
                className={iconButton}
                aria-label="Edit activity"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" onClick={close} className={iconButton} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <h3
            id="task-detail-title"
            className={`mt-2 text-lg font-semibold leading-snug ${
              activity.status === "completed" ? "text-slate-500 line-through" : "text-slate-900"
            }`}
          >
            {activity.title}
          </h3>

          {/* Two quiet rows of details, so the notes below get the space. */}
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600 tabular-nums">
            <Detail icon={CalendarDays} label="Dates">
              {formatDate(activity.date)}
              {activity.deadline && <span className="text-slate-400"> → </span>}
              {activity.deadline && formatDate(activity.deadline)}
            </Detail>
            <Detail icon={Clock} label="Scheduled time">
              {activity.scheduledTime ? formatTime(activity.scheduledTime) : <span className="text-slate-400">No time set</span>}
            </Detail>
            <Detail icon={Timer} label="Time logged">
              {formatMinutes(activity.actualMinutes)}
              <span className="text-slate-400"> of {formatMinutes(activity.estimatedMinutes)}</span>
            </Detail>
            {activity.subtasks.length > 0 && (
              <Detail icon={ListChecks} label="Checklist">
                {doneCount}/{activity.subtasks.length} done
              </Detail>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col px-5 sm:px-6 pt-4 pb-5 mt-4 border-t border-slate-100">
          <label htmlFor="task-detail-notes" className="mb-2 text-xs font-semibold text-slate-700">
            Notes
          </label>
          <textarea
            id="task-detail-notes"
            placeholder="Context, requirements, links or outcomes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="flex-1 block w-full min-h-60 resize-none px-4 py-3 rounded-xl bg-slate-50 border border-slate-200/80 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition-colors"
          />
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={close}
              className="h-9 px-5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 rounded-lg shadow-xs transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
